import { randomBytes, createHash, randomUUID } from 'node:crypto';
import {
  generateBomb, DIFFICULTIES, PENALTY_MS, initModuleState, projectModule, validateModuleAction,
} from './engine/index.js';
import { ROLES_BY_SIZE } from './engine/common.js';

export const COUNTDOWN_MS = Number(process.env.COUNTDOWN_MS ?? 5000);
export const RECONNECT_MS = Number(process.env.RECONNECT_MS ?? 60000);
const MAX_PLAYERS = 8;
const TEAMS = ['red', 'blue'];

export const hashToken = (t) => createHash('sha256').update(t).digest('hex');
export const cleanName = (n) =>
  String(n ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);

const fail = (code, message) => ({ error: { code, message } });

export class Room {
  constructor(code, opts = {}) {
    this.code = code;
    this.players = new Map();
    this.hostId = null;
    this.teamSize = 3;
    this.difficulty = 'normal';
    this.status = 'lobby'; // lobby | countdown | playing | finished
    this.match = null;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.version = 0;
    this.fixedSeed = opts.fixedSeed || null; // solo para pruebas
    this.timeScale = opts.timeScale ?? Number(process.env.TIME_SCALE ?? 1); // para pruebas de jugabilidad
    this.onFx = () => {};
    this.onChange = () => {};
    this.clock = opts.clock || (() => Date.now());
  }

  // ---------- jugadores ----------
  addPlayer(name) {
    if (this.status !== 'lobby') return fail('in_progress', 'La partida ya está en curso');
    if (this.players.size >= MAX_PLAYERS) return fail('full', 'La sala está llena (máximo 8 jugadores)');
    const clean = cleanName(name);
    if (!clean) return fail('bad_name', 'Escribe un nombre');
    const taken = [...this.players.values()].some((p) => p.name.toLowerCase() === clean.toLowerCase());
    if (taken) return fail('name_taken', 'Ya hay alguien con ese nombre en la sala');
    const token = randomBytes(24).toString('base64url');
    const p = {
      id: randomUUID().slice(0, 8), name: clean, tokenHash: hashToken(token), team: null, role: null,
      ready: false, connected: false, disconnectedAt: null, send: null,
    };
    this.players.set(p.id, p);
    if (!this.hostId) this.hostId = p.id;
    this.touch();
    return { player: p, token };
  }

  authenticate(playerId, token) {
    const p = this.players.get(playerId);
    if (!p || typeof token !== 'string' || hashToken(token) !== p.tokenHash) return null;
    return p;
  }

  attach(p, send) {
    const old = p.send;
    p.send = send;
    p.connected = true;
    p.disconnectedAt = null;
    this.touch();
    return old; // el llamador cierra la conexión anterior (una sola sesión por jugador)
  }

  detach(p, send) {
    if (p.send !== send) return; // ya fue reemplazada
    p.send = null;
    p.connected = false;
    p.disconnectedAt = this.clock();
    this.touch();
    this.onChange();
  }

  removePlayer(id) {
    this.players.delete(id);
    if (this.hostId === id) this.hostId = this.nextHost();
    this.touch();
  }

  nextHost() {
    const conn = [...this.players.values()].filter((p) => p.connected);
    return (conn[0] || [...this.players.values()][0])?.id ?? null;
  }

  touch() {
    this.lastActivity = this.clock();
    this.version++;
  }

  roles() { return ROLES_BY_SIZE[this.teamSize]; }

  seatOwner(team, role) {
    return [...this.players.values()].find((p) => p.team === team && p.role === role) || null;
  }

  // ---------- lobby ----------
  chooseSeat(p, team, role) {
    if (this.status !== 'lobby') return fail('bad_state', 'Solo se puede cambiar de puesto en la sala de espera');
    if (!TEAMS.includes(team) || !this.roles().includes(role)) return fail('bad_seat', 'Puesto no válido');
    const owner = this.seatOwner(team, role);
    if (owner === p) { // soltar el puesto
      p.team = null; p.role = null; p.ready = false;
    } else if (!owner) {
      p.team = team; p.role = role; p.ready = false;
    } else { // intercambio de puestos
      [p.team, owner.team] = [owner.team, p.team];
      [p.role, owner.role] = [owner.role, p.role];
      p.ready = false; owner.ready = false;
    }
    this.touch();
    return {};
  }

  setReady(p, value) {
    if (this.status !== 'lobby') return fail('bad_state', 'No disponible ahora');
    if (!p.team) return fail('no_seat', 'Elige primero un equipo y un rol');
    p.ready = !!value;
    this.touch();
    return {};
  }

  configure(p, { teamSize, difficulty }) {
    if (p.id !== this.hostId) return fail('not_host', 'Solo el anfitrión puede configurar la sala');
    if (this.status !== 'lobby') return fail('bad_state', 'No disponible ahora');
    if (teamSize !== undefined) {
      if (teamSize !== 3 && teamSize !== 4) return fail('bad_config', 'Modalidad no válida');
      this.teamSize = teamSize;
      if (teamSize === 3)
        for (const q of this.players.values()) if (q.role === 'analyst') { q.team = null; q.role = null; }
    }
    if (difficulty !== undefined) {
      if (!DIFFICULTIES[difficulty]) return fail('bad_config', 'Dificultad no válida');
      this.difficulty = difficulty;
    }
    for (const q of this.players.values()) q.ready = false;
    this.touch();
    return {};
  }

  shuffle(p, mode) {
    if (p.id !== this.hostId) return fail('not_host', 'Solo el anfitrión puede hacerlo');
    if (this.status !== 'lobby') return fail('bad_state', 'No disponible ahora');
    const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
    if (mode === 'roles') {
      for (const team of TEAMS) {
        const members = [...this.players.values()].filter((q) => q.team === team);
        const roles = shuffle(members.map((q) => q.role));
        members.forEach((q, i) => (q.role = roles[i]));
      }
    } else if (mode === 'teams') {
      const seats = shuffle(TEAMS.flatMap((team) => this.roles().map((role) => ({ team, role }))));
      const list = shuffle([...this.players.values()]);
      list.forEach((q, i) => { q.team = seats[i]?.team ?? null; q.role = seats[i]?.role ?? null; });
    } else return fail('bad_config', 'Modo no válido');
    for (const q of this.players.values()) q.ready = false;
    this.touch();
    return {};
  }

  canStart() {
    const ps = [...this.players.values()];
    const need = this.teamSize * 2;
    if (ps.length !== need)
      return { ok: false, reason: `Hacen falta exactamente ${need} jugadores (hay ${ps.length})` };
    for (const team of TEAMS) for (const role of this.roles())
      if (!this.seatOwner(team, role)) return { ok: false, reason: 'Faltan puestos por ocupar en algún equipo' };
    if (ps.some((q) => !q.connected)) return { ok: false, reason: 'Hay jugadores desconectados' };
    if (ps.some((q) => !q.ready)) return { ok: false, reason: 'Todos los jugadores deben estar preparados' };
    return { ok: true };
  }

  start(p) {
    if (p.id !== this.hostId) return fail('not_host', 'Solo el anfitrión puede iniciar la partida');
    if (this.status !== 'lobby') return fail('bad_state', 'La partida ya ha comenzado');
    const c = this.canStart();
    if (!c.ok) return fail('cannot_start', c.reason);
    const seed = this.fixedSeed || randomBytes(8).toString('hex');
    const bomb = generateBomb(seed, this.difficulty, this.teamSize);
    const cfg = DIFFICULTIES[this.difficulty];
    const now = this.clock();
    const mkTeam = () => ({
      moduleIndex: 0, states: bomb.modules.map((m) => initModuleState(m)), errors: 0, penaltyMs: 0,
      status: 'playing', finishedAt: null,
    });
    this.match = {
      id: randomUUID().slice(0, 8), seed, bomb, cfg,
      startsAt: now + COUNTDOWN_MS,
      durationMs: Math.round(cfg.minutes * 60000 * this.timeScale),
      teams: { red: mkTeam(), blue: mkTeam() },
      winner: null, endedAt: null, seen: new Set(),
    };
    this.status = 'countdown';
    this.touch();
    this.onFx({ kind: 'countdown' });
    return {};
  }

  requestRematch() {
    if (this.status !== 'finished') return fail('bad_state', 'La partida no ha terminado');
    this.status = 'lobby';
    this.match = null;
    for (const q of this.players.values()) q.ready = false;
    this.touch();
    return {};
  }

  // ---------- partida ----------
  deadline(team) {
    const m = this.match;
    return m.startsAt + m.durationMs - m.teams[team].penaltyMs;
  }

  tick(now = this.clock()) {
    let changed = false;
    if (this.status === 'lobby') {
      for (const p of [...this.players.values()])
        if (!p.connected && p.disconnectedAt && now - p.disconnectedAt > RECONNECT_MS) {
          this.removePlayer(p.id);
          changed = true;
        }
      const host = this.players.get(this.hostId);
      if (host && !host.connected) {
        const alt = this.nextHost();
        if (alt && alt !== this.hostId && this.players.get(alt).connected) { this.hostId = alt; changed = true; }
      }
    }
    if (this.status === 'countdown' && now >= this.match.startsAt) {
      this.status = 'playing';
      changed = true;
    }
    if (this.status === 'playing') {
      for (const team of TEAMS) {
        const t = this.match.teams[team];
        if (t.status === 'playing' && now >= this.deadline(team)) {
          t.status = 'timeout';
          t.finishedAt = this.deadline(team);
          this.onFx({ kind: 'boom', team, cause: 'timeout' });
          changed = true;
        }
      }
      changed = this.checkEnd(now) || changed;
    }
    if (changed) { this.touch(); this.onChange(); }
    return changed;
  }

  checkEnd(now) {
    const m = this.match;
    if (this.status !== 'playing') return false;
    if (m.winner) return this.finish(now);
    if (TEAMS.every((tm) => m.teams[tm].status !== 'playing')) return this.finish(now);
    return false;
  }

  finish(now) {
    this.status = 'finished';
    this.match.endedAt = now;
    this.onFx({ kind: 'end', winner: this.match.winner });
    return true;
  }

  submitAction(p, msg) {
    if (this.status !== 'playing') return fail('bad_state', 'La partida no está en marcha');
    if (!p.team || p.role !== 'operator') return fail('forbidden', 'Solo el operador puede manipular la bomba');
    const now = this.clock();
    const m = this.match;
    const t = m.teams[p.team];
    if (t.status !== 'playing') return fail('bad_state', 'Tu bomba ya no está activa');
    if (now >= this.deadline(p.team)) { this.tick(now); return fail('timeout', 'Se acabó el tiempo'); }
    if (typeof msg.id !== 'string' || msg.id.length > 40) return fail('bad_action', 'Acción no válida');
    const key = `${p.id}:${msg.id}`;
    if (m.seen.has(key)) return { duplicate: true };
    m.seen.add(key);
    if (m.seen.size > 5000) m.seen.clear();

    const mod = m.bomb.modules[t.moduleIndex];
    const res = validateModuleAction(mod, t.states[t.moduleIndex], msg.action);
    if (res.outcome === 'invalid') return fail('bad_action', 'Acción no válida');
    t.states[t.moduleIndex] = res.state;
    if (res.outcome === 'wrong') {
      this.registerError(p.team, now);
    } else if (res.outcome === 'correct') {
      t.moduleIndex++;
      this.onFx({ kind: 'solved', team: p.team, module: t.moduleIndex });
      if (t.moduleIndex >= m.bomb.modules.length) {
        t.status = 'defused';
        t.finishedAt = now;
        if (!m.winner) m.winner = p.team;
        this.onFx({ kind: 'defused', team: p.team });
      }
    } else if (res.outcome === 'progress') {
      this.onFx({ kind: 'step', team: p.team });
    }
    this.checkEnd(now);
    this.touch();
    this.onChange();
    return {};
  }

  registerError(team, now) {
    const t = this.match.teams[team];
    const cfg = this.match.cfg;
    t.errors++;
    if (t.errors >= cfg.maxErrors) {
      t.status = 'exploded';
      t.finishedAt = now;
      this.onFx({ kind: 'boom', team, cause: 'errors' });
      return;
    }
    if (t.errors === cfg.penaltyAt) {
      t.penaltyMs += PENALTY_MS;
      this.onFx({ kind: 'penalty', team, errors: t.errors });
      if (now >= this.deadline(team)) {
        t.status = 'timeout';
        t.finishedAt = now;
        this.onFx({ kind: 'boom', team, cause: 'timeout' });
      }
      return;
    }
    this.onFx({ kind: 'error', team, errors: t.errors });
  }

  // ---------- vistas ----------
  publicTeam(team) {
    const m = this.match;
    const t = m.teams[team];
    return {
      status: t.status, moduleIndex: t.moduleIndex, moduleCount: m.bomb.modules.length,
      errors: t.errors, maxErrors: m.cfg.maxErrors, penaltyMs: t.penaltyMs,
      deadline: this.deadline(team),
      finishedMs: t.finishedAt ? t.finishedAt - m.startsAt : null,
    };
  }

  viewFor(p) {
    const now = this.clock();
    const out = {
      t: 'state', now,
      room: {
        code: this.code, status: this.status, teamSize: this.teamSize, difficulty: this.difficulty,
        hostId: this.hostId, version: this.version,
        players: [...this.players.values()].map((q) => ({
          id: q.id, name: q.name, team: q.team, role: q.role, ready: q.ready, connected: q.connected,
        })),
        canStart: this.status === 'lobby' ? this.canStart() : undefined,
      },
      me: { id: p.id, team: p.team, role: p.role, isHost: p.id === this.hostId },
    };
    if (this.match) {
      const m = this.match;
      out.match = {
        startsAt: m.startsAt, durationMs: m.durationMs, winner: m.winner,
        teams: { red: this.publicTeam('red'), blue: this.publicTeam('blue') },
        modules: this.status === 'countdown' ? undefined : m.bomb.modules.map((x) => x.type),
      };
      if (this.status === 'finished') {
        out.match.seed = m.seed;
        out.match.endedMs = m.endedAt - m.startsAt;
      }
      const t = p.team && m.teams[p.team];
      if (this.status === 'playing' && t && t.status === 'playing' && p.role) {
        const mod = m.bomb.modules[t.moduleIndex];
        out.module = {
          index: t.moduleIndex, type: mod.type,
          view: projectModule(mod, p.role, t.states[t.moduleIndex]),
        };
      }
    }
    return out;
  }

  broadcast() {
    for (const p of this.players.values()) if (p.send) p.send(this.viewFor(p));
  }
}
