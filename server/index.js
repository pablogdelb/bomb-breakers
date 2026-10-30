import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomInt } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { Room, RECONNECT_MS } from './room.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
};
import { BUILD } from './build.js';
export { BUILD };
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function createGameServer({ port = Number(process.env.PORT || 3000), host = '0.0.0.0', fixedSeed = null, timeScale, createLimit = 10 } = {}) {
  const rooms = new Map();
  const clients = new Set();
  const ipCreates = new Map();

  const newCode = () => {
    for (;;) {
      const c = Array.from({ length: 6 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('');
      if (!rooms.has(c)) return c;
    }
  };

  const server = http.createServer(async (req, res) => {
    const headers = {
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self' ws: wss:; img-src 'self' data:; media-src 'self' data: blob:",
    };
    try {
      const url = new URL(req.url, 'http://x');
      if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json', ...headers });
        return res.end(JSON.stringify({ ok: true, rooms: rooms.size, build: BUILD }));
      }
      let file = decodeURIComponent(url.pathname);
      if (file === '/' || /^\/[A-Za-z0-9]{6}$/.test(file)) file = '/index.html'; // /ABC123 → enlace de invitación
      const full = path.normalize(path.join(PUBLIC, file));
      if (!full.startsWith(PUBLIC)) { res.writeHead(403, headers); return res.end(); }
      const data = await readFile(full);
      const cache = 'no-cache'; // el cliente siempre se revalida: evita mezclar versiones viejas en los móviles
      res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream', 'Cache-Control': cache, ...headers });
      res.end(data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain', ...headers });
      res.end('No encontrado');
    }
  });

  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8192 });

  function wire(room) {
    room.onChange = () => room.broadcast();
    room.onFx = (fx) => {
      const msg = JSON.stringify({ t: 'fx', ...fx });
      for (const p of room.players.values()) p.send && p.send(msg, true);
    };
  }

  wss.on('connection', (ws, req) => {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
    const ctx = { room: null, player: null, bucket: 60, last: Date.now() };
    const send = (obj, raw = false) => {
      if (ws.readyState === ws.OPEN) ws.send(raw ? obj : JSON.stringify(obj));
    };
    ctx.send = send;
    const err = (code, message) => send({ t: 'error', code, message });
    ws.isAlive = true;
    ws.on('pong', () => (ws.isAlive = true));

    ws.on('message', (data) => {
      const nowMs = Date.now();
      ctx.bucket = Math.min(60, ctx.bucket + ((nowMs - ctx.last) / 1000) * 30);
      ctx.last = nowMs;
      if (--ctx.bucket < 0) return err('rate_limited', 'Demasiadas peticiones');
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return err('bad_json', 'Mensaje no válido'); }
      if (!msg || typeof msg.t !== 'string') return err('bad_json', 'Mensaje no válido');
      try { handle(msg); } catch (e) { console.error(e); err('server', 'Error interno'); }
    });

    function bind(room, player, token) {
      room.attach(player, send);
      // una sola sesión por jugador: la conexión anterior (otra pestaña) queda sustituida
      for (const c of clients) if (c !== ctx && c.player === player) { c.player = null; c.room = null; c.ws.close(4001, 'replaced'); }
      ctx.room = room; ctx.player = player;
      send({ t: 'welcome', playerId: player.id, token, code: room.code });
      room.broadcast();
    }

    function handle(msg) {
      switch (msg.t) {
        case 'ping': return send({ t: 'pong', now: Date.now() });
        case 'create': {
          const hits = (ipCreates.get(ip) || []).filter((x) => nowMs() - x < 60000);
          if (hits.length >= createLimit) return err('rate_limited', 'Demasiadas salas creadas, espera un minuto');
          hits.push(nowMs()); ipCreates.set(ip, hits);
          if (rooms.size >= 500) return err('busy', 'Servidor lleno, inténtalo más tarde');
          const room = new Room(newCode(), { fixedSeed, timeScale });
          wire(room);
          const r = room.addPlayer(msg.name);
          if (r.error) return err(r.error.code, r.error.message);
          rooms.set(room.code, room);
          return bind(room, r.player, r.token);
        }
        case 'join': {
          const room = rooms.get(String(msg.code || '').toUpperCase());
          if (!room) return err('no_room', 'No existe ninguna sala con ese código');
          const r = room.addPlayer(msg.name);
          if (r.error) return err(r.error.code, r.error.message);
          return bind(room, r.player, r.token);
        }
        case 'resume': {
          const room = rooms.get(String(msg.code || '').toUpperCase());
          const player = room?.authenticate(msg.playerId, msg.token);
          if (!player) return err('resume_failed', 'No se pudo recuperar la sesión');
          return bind(room, player, msg.token);
        }
      }
      const { room, player } = ctx;
      if (!room || !player) return err('no_session', 'No estás en ninguna sala');
      let r = {};
      switch (msg.t) {
        case 'seat': r = room.chooseSeat(player, msg.team, msg.role); break;
        case 'ready': r = room.setReady(player, msg.value); break;
        case 'config': r = room.configure(player, msg); break;
        case 'shuffle': r = room.shuffle(player, msg.mode); break;
        case 'start': r = room.start(player); break;
        case 'action': r = room.submitAction(player, msg); break;
        case 'rematch': r = room.requestRematch(); break;
        case 'leave':
          if (room.status === 'lobby') { room.removePlayer(player.id); ctx.room = null; ctx.player = null; send({ t: 'left' }); }
          return room.broadcast();
        default: return err('unknown', 'Mensaje desconocido');
      }
      if (r.error) return send({ t: 'rejected', ...r.error, ref: msg.t, id: msg.id });
      if (!r.duplicate) room.broadcast();
    }
    const nowMs = () => Date.now();

    clients.add(ctx);
    ctx.ws = ws;
    ws.on('close', () => {
      clients.delete(ctx);
      if (ctx.room && ctx.player) { ctx.room.detach(ctx.player, send); }
    });
  });

  // reloj del servidor: temporizadores, reconexiones y limpieza
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      room.tick(now);
      const anyConnected = [...room.players.values()].some((p) => p.connected);
      const idle = now - room.lastActivity;
      if ((!anyConnected && idle > 30 * 60000) || now - room.createdAt > 8 * 3600000 || (room.players.size === 0)) rooms.delete(code);
    }
  }, 250);
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, 15000);
  timer.unref?.();
  heartbeat.unref?.();

  return new Promise((resolve) => {
    server.listen(port, host, () => {
      resolve({
        server, rooms, port: server.address().port,
        close: () => new Promise((r) => {
          clearInterval(timer);
          clearInterval(heartbeat);
          for (const ws of wss.clients) ws.terminate();
          wss.close(); server.close(() => r());
        }),
      });
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const g = await createGameServer();
  console.log(`BOMB BREAKERS escuchando en http://localhost:${g.port}`);
}
