import WebSocket from 'ws';

export class Bot {
  constructor(port, name) {
    this.port = port; this.name = name; this.state = null; this.fx = []; this.errors = []; this.rejected = [];
    this.waiters = [];
  }
  connect() {
    this.ws = new WebSocket(`ws://127.0.0.1:${this.port}/ws`);
    this.ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if (m.t === 'state') this.state = m;
      else if (m.t === 'welcome') Object.assign(this, { playerId: m.playerId, token: m.token, code: m.code });
      else if (m.t === 'fx') this.fx.push(m);
      else if (m.t === 'error') this.errors.push(m);
      else if (m.t === 'rejected') this.rejected.push(m);
      this.waiters = this.waiters.filter((w) => !w());
    });
    this.ws.on('close', () => { this.waiters = this.waiters.filter((w) => !w()); });
    return new Promise((res, rej) => { this.ws.once('open', res); this.ws.once('error', rej); });
  }
  send(o) { this.ws.send(JSON.stringify(o)); }
  until(pred, ms = 4000, label = 'condición') {
    return new Promise((res, rej) => {
      const check = () => { if (pred(this)) { res(this); return true; } return false; };
      if (check()) return;
      const to = setTimeout(() => rej(new Error(`timeout esperando ${label} (${this.name})`)), ms);
      this.waiters.push(() => { if (check()) { clearTimeout(to); return true; } return false; });
    });
  }
  async create() { await this.connect(); this.send({ t: 'create', name: this.name }); await this.until((b) => b.state, 2000, 'estado'); return this; }
  async join(code) { await this.connect(); this.send({ t: 'join', code, name: this.name }); await this.until((b) => b.state || b.errors.length, 2000, 'unirse'); return this; }
  close() { this.ws.close(); }
  get room() { return this.state?.room; }
  get me() { return this.state?.me; }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Crea una sala llena y deja a todos preparados. Devuelve bots por equipo/rol. */
export async function fullRoom(port, teamSize = 3, difficulty = 'normal') {
  const n = teamSize * 2;
  const bots = [];
  const host = await new Bot(port, 'Host').create();
  bots.push(host);
  for (let i = 1; i < n; i++) bots.push(await new Bot(port, `J${i}`).join(host.code));
  host.send({ t: 'config', teamSize, difficulty });
  await host.until((b) => b.room.teamSize === teamSize && b.room.difficulty === difficulty);
  const roles = teamSize === 4 ? ['operator', 'expert', 'interpreter', 'analyst'] : ['operator', 'expert', 'interpreter'];
  let i = 0;
  const by = { red: {}, blue: {} };
  for (const team of ['red', 'blue']) for (const role of roles) {
    const b = bots[i++];
    b.send({ t: 'seat', team, role });
    await b.until((x) => x.me.team === team && x.me.role === role, 2000, 'asiento');
    by[team][role] = b;
  }
  for (const b of bots) { b.send({ t: 'ready', value: true }); }
  await host.until((b) => b.room.players.every((p) => p.ready), 2000, 'todos listos');
  return { bots, host, by };
}
