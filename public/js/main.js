import { h, clear } from './dom.js';
import { Net } from './net.js';
import { applyPrefs } from './sound.js';
import { createHome, createLobby, createGame, createResults, toast } from './screens.js';

applyPrefs();
const root = document.getElementById('app');
let state = null, current = { name: null, comp: null }, status = 'connecting', connBar = null, replaced = false;

const net = new Net({
  onState(s) { state = s; render(); },
  onWelcome(w) { try { history.replaceState(null, '', `/${w.code}`); } catch { /* */ } },
  onFx(f) { current.comp?.fx?.(f); },
  onLeft() { state = null; try { history.replaceState(null, '', '/'); } catch { /* */ } render(); },
  onError(m) {
    if (m.code === 'resume_failed') toast('Tu sala ya no existe (el servidor se reinició). Crea una sala nueva y volved a entrar.', true);
    else if (current.name === 'home' && current.comp.error) current.comp.error(m);
    else toast(m.message || 'Error', true);
  },
  onReplaced() { replaced = true; state = null; clear(root); root.append(h('div', { class: 'stack home' }, h('h2', null, 'SESIÓN ABIERTA EN OTRA PESTAÑA'),
    h('p', { class: 'dim' }, 'Este jugador se ha conectado desde otra ventana.'), h('button', { class: 'btn primary', onclick: () => location.reload() }, 'USAR ESTA VENTANA'))); },
  onStatus(s) { status = s; paintConn(); },
});

function paintConn() {
  const show = status !== 'open' && !replaced;
  if (show && !connBar) { connBar = h('div', { class: 'conn', 'data-testid': 'conn' }, 'SIN CONEXIÓN · RECONECTANDO…'); document.body.append(connBar); }
  if (!show && connBar) { connBar.remove(); connBar = null; }
}

function screenFor(s) {
  if (!s) return 'home';
  const st = s.room.status;
  return st === 'lobby' ? 'lobby' : st === 'finished' ? 'results' : 'game';
}

function render() {
  if (replaced) return;
  const name = screenFor(state);
  if (name !== current.name) {
    current.comp?.destroy?.();
    clear(root);
    const prefill = (location.pathname.match(/^\/([A-Za-z0-9]{6})$/) || [])[1];
    current = { name, comp: { home: () => createHome({ net, prefill }), lobby: () => createLobby({ net }), game: () => createGame({ net }), results: () => createResults({ net }) }[name]() };
    root.append(current.comp.el);
    if (name !== 'home') { const emergency = null; void emergency; }
    window.scrollTo(0, 0);
  }
  if (state) current.comp.update(state);
}

net.start();
if (!net.hasSession) render();
else { root.append(h('div', { class: 'stack home' }, h('div', { class: 'label' }, 'RECUPERANDO PARTIDA…'))); setTimeout(() => { if (!state) { net.forget(); render(); } }, 6000); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') net.wake(); });
window.addEventListener('online', () => net.wake());
window.__bb = { get state() { return state; }, net };
