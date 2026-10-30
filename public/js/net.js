import { store } from './dom.js';

const KEY = 'bb_session';

/** Conexión WebSocket con reconexión automática y reanudación de sesión por token. */
export class Net {
  constructor(handlers) {
    this.h = handlers;
    this.offset = 0;
    this.retry = 0;
    this.closed = false;
    this.session = store.get(KEY);
    this.pending = [];
  }
  get hasSession() { return !!this.session; }
  serverNow() { return Date.now() + this.offset; }
  start() { this.open(); }
  open() {
    clearTimeout(this.retryTimer);
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.h.onStatus('open');
      if (this.session) this.send({ t: 'resume', ...this.session });
      this.pending.splice(0).forEach((m) => this.send(m));
      clearInterval(this.pinger);
      this.pinger = setInterval(() => this.send({ t: 'ping' }), 10000);
    };
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.t === 'state') {
        // sincronización de reloj: el servidor es la única fuente de tiempo
        const off = m.now - Date.now();
        this.offset = this.offset === 0 ? off : this.offset * 0.5 + off * 0.5;
        this.h.onState(m);
      } else if (m.t === 'pong') {
        this.offset = m.now - Date.now();
      } else if (m.t === 'welcome') {
        this.session = { code: m.code, playerId: m.playerId, token: m.token };
        store.set(KEY, this.session);
        this.h.onWelcome(m);
      } else if (m.t === 'fx') this.h.onFx(m);
      else if (m.t === 'left') { this.forget(); this.h.onLeft(); }
      else if (m.t === 'error') {
        if (m.code === 'resume_failed') { this.forget(); this.h.onLeft(); }
        this.h.onError(m);
      } else if (m.t === 'rejected') this.h.onError(m);
    };
    ws.onclose = (ev) => {
      clearInterval(this.pinger);
      this.h.onStatus('closed');
      if (this.closed || ev.code === 4001) { if (ev.code === 4001) this.h.onReplaced(); return; }
      this.retry++;
      this.h.onStatus('reconnecting');
      this.retryTimer = setTimeout(() => this.open(), Math.min(4000, 400 * this.retry));
    };
    ws.onerror = () => ws.close();
  }
  send(m) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
    else if (m.t !== 'action' && m.t !== 'ping') this.pending.push(m); // las acciones de juego no se reenvían tras reconectar
  }
  forget() { this.session = null; store.del(KEY); }
  // al volver a primer plano en el móvil, comprobar la conexión
  wake() {
    if (!this.ws || this.ws.readyState > 1) this.open();
  }
}
