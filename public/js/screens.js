import { h, clear, fill, fmtTime, store } from './dom.js';
import { sfx, settings, setSound, setMotion } from './sound.js';
import { heroBomb } from './art.js';
import { createModule } from './modules.js';
import { expertPage, analystSheet, roleCard, gestureGuide, ROLES, MODULE_SHORT, MODULE_TITLES } from './manual.js';

export const BUILD = '2026.10.30-dificil1';
export const TEAM_NAME = { red: 'EQUIPO ROJO', blue: 'EQUIPO AZUL' };
const DIFF_NAME = { easy: 'FÁCIL · 12 min', normal: 'NORMAL · 10 min', hard: 'DIFÍCIL · 8 min' };
const ROLE_ORDER = ['operator', 'expert', 'interpreter', 'analyst'];

export function toast(msg, bad = false) {
  const t = h('div', { class: `toast ${bad ? 'bad' : ''}` }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), bad ? 7000 : 3000);
}
export function banner(msg, kind = 'info') {
  const b = h('div', { class: `banner ${kind}` }, msg);
  document.body.append(b);
  setTimeout(() => b.remove(), 2300);
}
export function modal(content) {
  const m = h('div', { class: 'modal', onclick: (e) => { if (e.target === m) m.remove(); } },
    h('div', { class: 'sheet-in stack' }, content, h('button', { class: 'btn block', onclick: () => m.remove() }, 'CERRAR')));
  document.body.append(m);
  return m;
}

/* ====================== INICIO ====================== */
export function createHome({ net, onError, prefill }) {
  let mode = prefill ? 'join' : null;
  const el = h('div', { class: 'stack home' });
  const err = h('div', { class: 'err' });
  const nameIn = h('input', { type: 'text', maxlength: 16, placeholder: 'TU NOMBRE', autocomplete: 'off', 'data-testid': 'name', value: store.get('bb_name') || '' });
  const codeIn = h('input', { type: 'text', maxlength: 6, placeholder: 'CÓDIGO', class: 'code-input', autocomplete: 'off', autocapitalize: 'characters', 'data-testid': 'code', value: prefill || '' });
  function go() {
    err.textContent = '';
    const name = nameIn.value.trim();
    if (!name) { err.textContent = 'Escribe tu nombre'; return; }
    store.set('bb_name', name);
    if (mode === 'create') net.send({ t: 'create', name });
    else {
      const code = codeIn.value.trim().toUpperCase();
      if (code.length !== 6) { err.textContent = 'El código tiene 6 caracteres'; return; }
      net.send({ t: 'join', code, name });
    }
  }
  function paint() {
    clear(el);
    fill(el,
      h('div', { class: 'logo' }, 'BOMB', h('span', null, 'BREAKERS'), h('small', null, 'COMUNICACIÓN · LÓGICA · CAOS')),
      heroBomb());
    if (!mode) {
      el.append(h('div', { class: 'stack' },
        h('button', { class: 'btn primary block', 'data-testid': 'create', onclick: () => { mode = 'create'; paint(); } }, 'CREAR SALA'),
        h('button', { class: 'btn block', 'data-testid': 'join', onclick: () => { mode = 'join'; paint(); } }, 'UNIRSE A SALA'),
        h('p', { class: 'dim', style: { fontSize: '13px' } }, '2 equipos · 3 o 4 jugadores por equipo · todos con el móvil en la mano')));
    } else {
      el.append(h('div', { class: 'panel screws stack' },
        h('div', { class: 'label' }, mode === 'create' ? 'NUEVA SALA PRIVADA' : 'ENTRAR EN UNA SALA'),
        mode === 'join' ? codeIn : null, nameIn,
        h('button', { class: 'btn primary block', 'data-testid': 'go', onclick: go }, mode === 'create' ? 'CREAR' : 'ENTRAR'),
        h('button', { class: 'btn ghost block', onclick: () => { mode = null; err.textContent = ''; paint(); } }, 'VOLVER'), err));
    }
  }
  paint();
  for (const i of [nameIn, codeIn]) i.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  return { el, update() {}, error(m) { err.textContent = m.message || ''; } };
}

/* ====================== SALA DE ESPERA ====================== */
export function createLobby({ net }) {
  const el = h('div', { class: 'stack' });
  const link = (code) => `${location.origin}/${code}`;
  async function copy(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg); } catch { prompt('Copia el enlace:', text); }
  }
  function update(st) {
    const { room, me } = st;
    const isHost = me.isHost;
    const players = room.players;
    const roles = room.teamSize === 4 ? ROLE_ORDER : ROLE_ORDER.slice(0, 3);
    const coop = room.mode === 'coop';
    const teamList = coop ? ['red'] : ['red', 'blue'];
    const myP = players.find((p) => p.id === me.id);
    clear(el);
    fill(el,
      h('div', { class: 'panel screws roomcode' }, h('div', { class: 'label' }, 'CÓDIGO DE SALA'),
        h('div', { class: 'code', 'data-testid': 'room-code' }, room.code),
        h('div', { class: 'row', style: { justifyContent: 'center' } },
          h('button', { class: 'btn small', onclick: () => copy(link(room.code), 'Enlace copiado') }, 'COPIAR ENLACE'),
          navigator.share ? h('button', { class: 'btn small', onclick: () => navigator.share({ title: 'BOMB BREAKERS', text: `Únete a mi sala: ${room.code}`, url: link(room.code) }).catch(() => {}) }, 'COMPARTIR') : null)),
      h('div', { class: 'panel stack' }, h('div', { class: 'label' }, 'TIPO DE PARTIDA'),
        h('div', { class: 'chips' }, [['versus', '2 EQUIPOS'], ['coop', '1 EQUIPO · COOP']].map(([m, txt]) => h('button', { class: `chip ${room.mode === m ? 'active' : ''}`, disabled: !isHost, 'data-testid': `mode-${m}`, onclick: () => net.send({ t: 'config', mode: m }) }, txt))),
        coop ? h('div', { class: 'notice' }, 'Un solo equipo contra el reloj: desactivad la bomba antes de que se acabe el tiempo o los errores.') : null,
        h('div', { class: 'label' }, 'MODALIDAD'),
        h('div', { class: 'chips' }, [3, 4].map((n) => h('button', { class: `chip ${room.teamSize === n ? 'active' : ''}`, disabled: !isHost, 'data-testid': `size-${n}`, onclick: () => net.send({ t: 'config', teamSize: n }) }, coop ? `${n} JUGADORES` : `${n} CONTRA ${n}`))),
        h('div', { class: 'label' }, 'DIFICULTAD'),
        h('div', { class: 'chips' }, ['easy', 'normal', 'hard'].map((d) => h('button', { class: `chip ${room.difficulty === d ? 'active' : ''}`, disabled: !isHost, 'data-testid': `diff-${d}`, onclick: () => net.send({ t: 'config', difficulty: d }) }, DIFF_NAME[d]))),
        !isHost ? h('div', { class: 'notice' }, 'Solo el anfitrión cambia la configuración.') : null),
      h('div', { class: 'label', style: { textAlign: 'center' } }, 'ELIGE EQUIPO Y ROL (toca un puesto; si está ocupado, intercambias)'),
      h('div', { class: `teams ${coop ? 'one' : ''}` }, teamList.map((team) => h('div', { class: `team ${team}` }, h('h3', null, coop ? 'TU EQUIPO' : TEAM_NAME[team]),
        roles.map((role) => {
          const o = players.find((p) => p.team === team && p.role === role);
          const mine = o && o.id === me.id;
          return h('button', { class: `seat ${o ? 'taken' : 'free'} ${mine ? 'mine' : ''} ${o && !o.connected ? 'offline' : ''}`, 'data-testid': `seat-${team}-${role}`,
            onclick: () => net.send({ t: 'seat', team, role }) },
            h('span', { class: 'r' }, `${ROLES[role].icon} ${ROLES[role].name}`),
            h('span', { class: 'n' }, o ? o.name + (o.id === room.hostId ? ' ★' : '') : 'libre'),
            o ? h('span', { class: `st ${o.ready ? 'ready' : ''}` }, !o.connected ? 'DESCONECTADO' : o.ready ? '● LISTO' : '○ esperando') : null);
        })))),
      players.some((p) => !p.team) ? h('div', null, h('div', { class: 'label' }, 'SIN PUESTO'), players.filter((p) => !p.team).map((p) => h('span', { class: `pill ${p.id === me.id ? 'me' : ''}` }, p.name))) : null,
      h('div', { class: 'panel stack' },
        h('button', { class: `btn block ${myP?.ready ? 'ok' : ''}`, disabled: !myP?.team, 'data-testid': 'ready', onclick: () => net.send({ t: 'ready', value: !myP.ready }) }, myP?.ready ? '✔ ESTOY LISTO (toca para cancelar)' : 'ESTOY LISTO'),
        isHost ? h('div', { class: 'stack' },
          h('button', { class: 'btn primary block', disabled: !room.canStart?.ok, 'data-testid': 'start', onclick: () => net.send({ t: 'start' }) }, '▶ INICIAR PARTIDA'),
          !room.canStart?.ok ? h('div', { class: 'notice', 'data-testid': 'start-reason' }, room.canStart?.reason) : null,
          h('div', { class: 'row' },
            h('button', { class: 'btn small grow', onclick: () => net.send({ t: 'shuffle', mode: 'roles' }) }, '⇄ INTERCAMBIAR ROLES'),
            coop ? null : h('button', { class: 'btn small grow', onclick: () => net.send({ t: 'shuffle', mode: 'teams' }) }, '⇄ MEZCLAR EQUIPOS'))) : h('div', { class: 'notice' }, 'Esperando a que el anfitrión inicie la partida…')),
      h('div', { class: 'row' },
        h('button', { class: 'btn ghost grow', onclick: () => modal(gestureGuide()) }, '🖐 GESTOS'),
        h('button', { class: 'btn ghost grow', disabled: !me.role, onclick: () => me.role && modal(roleCard(me.role)) }, 'MI ROL'),
        h('button', { class: 'btn ghost grow', onclick: () => net.send({ t: 'leave' }) }, 'SALIR')),
      h('div', { class: 'notice', style: { fontSize: '11px' } }, `versión ${BUILD}`),
      h('div', { class: 'row' },
        h('button', { class: 'btn ghost grow', onclick: (e) => { setSound(!settings.sound); e.target.textContent = settings.sound ? '🔊 SONIDO: SÍ' : '🔇 SONIDO: NO'; sfx.click(); } }, settings.sound ? '🔊 SONIDO: SÍ' : '🔇 SONIDO: NO'),
        h('button', { class: 'btn ghost grow', onclick: (e) => { setMotion(!settings.motion); e.target.textContent = settings.motion ? '✨ ANIMACIONES: SÍ' : '✨ ANIMACIONES: NO'; } }, settings.motion ? '✨ ANIMACIONES: SÍ' : '✨ ANIMACIONES: NO')));
  }
  return { el, update };
}

/* ====================== PARTIDA ====================== */
const RULEBAR = {
  operator: 'Eres el CIEGO: tú manipulas la bomba. Escucha a tu intérprete.',
  expert: 'Eres el MUDO: solo gestos. Aplica el manual.',
  interpreter: 'Eres el SORDO: gestos al experto, voz al operador.',
  analyst: 'Solo puedes comunicar tus datos al experto con gestos.',
};

export function createGame({ net }) {
  const el = h('div', { class: 'game' });
  let st = null, comp = null, compKey = null, overlayKey = null, lastCount = null, lastTick = 0, deadShown = false;
  const timer = h('div', { class: 'timer', 'data-testid': 'timer' }, '--:--');
  const who = h('div', { class: 'who' });
  const strikes = h('div', { class: 'strikes', 'data-testid': 'strikes' });
  const hud = h('div', { class: 'hud' }, who, timer, strikes);
  const race = h('div', { class: 'race' });
  const slots = h('div', { class: 'slots' });
  const modname = h('div', { class: 'modname' });
  const rule = h('div', { class: 'rulebar' });
  const stage = h('div', { class: 'stage', 'data-testid': 'stage' });
  const overlay = h('div');
  const foot = h('div', { class: 'foot' },
    h('button', { class: 'btn ghost small', onclick: () => st?.me.role && modal(roleCard(st.me.role)) }, 'ROL'),
    h('button', { class: 'btn ghost small', onclick: () => modal(gestureGuide()) }, '🖐 GESTOS'),
    h('button', { class: 'btn ghost small', onclick: (e) => { setSound(!settings.sound); e.target.textContent = settings.sound ? '🔊' : '🔇'; } }, settings.sound ? '🔊' : '🔇'),
    h('button', { class: 'btn ghost small', onclick: (e) => { setMotion(!settings.motion); e.target.textContent = settings.motion ? '✨' : '▫️'; } }, settings.motion ? '✨' : '▫️'));
  el.append(hud, race, slots, modname, rule, stage, foot, overlay);

  const ctx = { send: (action) => net.send({ t: 'action', id: Math.random().toString(36).slice(2, 12), action }) };

  const myTeam = () => st.match.teams[st.me.team];
  function tickTimer() {
    if (!st?.match) return;
    const now = net.serverNow();
    const t = myTeam();
    const live = st.room.status === 'playing' && t.status === 'playing';
    const left = live ? t.deadline - now : st.room.status === 'countdown' ? st.match.durationMs : Math.max(0, t.deadline - (t.finishedMs != null ? st.match.startsAt + t.finishedMs : now));
    timer.textContent = fmtTime(left);
    timer.classList.toggle('low', live && left < 30000);
    if (live) {
      const sec = Math.ceil(left / 1000);
      if (sec !== lastTick) { lastTick = sec; if (left < 11000) sfx.tickUrgent(); else sfx.tick(); }
    }
    // cuenta atrás
    if (st.room.status === 'countdown') {
      const n = Math.max(1, Math.ceil((st.match.startsAt - now) / 1000));
      const c = overlay.querySelector('.count');
      if (c && n !== lastCount) { lastCount = n; c.textContent = n; sfx.countdown(n === 1); }
    }
  }
  const iv = setInterval(tickTimer, 100);

  function renderOverlay(newSt) {
    const status = newSt.room.status;
    const t = newSt.match.teams[newSt.me.team];
    const dead = status === 'playing' && t.status !== 'playing';
    const key = status === 'countdown' ? 'count' : dead ? `dead-${t.status}` : 'none';
    if (key === overlayKey) {
      if (dead) { const o = overlay.querySelector('[data-opp]'); if (o) o.textContent = oppText(newSt); }
      return;
    }
    overlayKey = key; lastCount = null;
    clear(overlay);
    if (key === 'count') {
      overlay.append(h('div', { class: 'overlay', 'data-testid': 'countdown' }, roleCard(newSt.me.role), h('div', { class: 'label' }, 'LA BOMBA SE ACTIVA EN'), h('div', { class: 'count' }, '5')));
    } else if (dead) {
      const timeout = t.status === 'timeout';
      const sparks = Array.from({ length: 24 }, () => {
        const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 260;
        return h('i', { class: 'spark', style: { '--dx': `${Math.cos(a) * d}px`, '--dy': `${Math.sin(a) * d}px` } });
      });
      if (!deadShown) { sfx.boom(); deadShown = true; }
      overlay.append(h('div', { class: 'boom', 'data-testid': 'boom' }, h('i', { class: 'fire' }), sparks, h('h1', null, 'BOOM'),
        h('p', null, timeout ? 'Se acabó el tiempo. Vuestra bomba ha explotado.' : 'Demasiados errores. Vuestra bomba ha explotado.'),
        h('p', { class: 'dim', 'data-opp': 1 }, oppText(newSt))));
    }
  }
  function oppText(s) {
    const opp = s.match.teams[s.me.team === 'red' ? 'blue' : 'red'];
    if (!opp) return '';
    const name = TEAM_NAME[s.me.team === 'red' ? 'blue' : 'red'];
    if (opp.status === 'playing') return `${name} sigue intentándolo: módulo ${opp.moduleIndex + 1}/${opp.moduleCount}`;
    return `${name}: ${opp.status === 'defused' ? 'bomba desactivada' : 'también ha fallado'}`;
  }

  function update(newSt) {
    const prev = st; st = newSt;
    const { me, match, room } = st;
    if (!prev || prev.room.status === 'lobby') deadShown = false;
    const t = match.teams[me.team];
    who.innerHTML = '';
    who.append(h('span', { class: `team-tag ${me.team}` }, TEAM_NAME[me.team]), h('b', null, ROLES[me.role]?.name || 'SIN ROL'));
    clear(strikes);
    for (let i = 0; i < t.maxErrors; i++) strikes.append(h('span', { class: `led ${i < t.errors ? 'on' : ''}` }));
    clear(race);
    race.classList.toggle('one', Object.keys(match.teams).length === 1);
    for (const tm of Object.keys(match.teams)) {
      const x = match.teams[tm];
      race.append(h('div', { class: `${tm} ${x.status !== 'playing' && x.status !== 'defused' ? 'dead' : ''}` },
        `${tm === 'red' ? 'ROJO' : 'AZUL'} ${x.moduleIndex}/${x.moduleCount}${x.status === 'defused' ? ' ✔' : x.status === 'exploded' || x.status === 'timeout' ? ' ✖' : ''}`,
        h('div', { class: 'bar' }, h('i', { style: { width: `${(x.moduleIndex / x.moduleCount) * 100}%` } })),
        h('div', { style: { marginTop: '4px', display: 'flex', gap: '4px' } }, Array.from({ length: x.maxErrors }, (_, i) => h('span', { class: `led ${i < x.errors ? 'on' : ''}`, style: { width: '8px', height: '8px' } })))));
    }
    clear(slots);
    (match.modules || []).forEach((m, i) => slots.append(h('div', { class: `slot ${i < t.moduleIndex ? 'done' : i === t.moduleIndex && t.status === 'playing' ? 'cur' : ''}` }, i < t.moduleIndex ? '✔' : MODULE_SHORT[m])));
    renderOverlay(st);
    rule.textContent = RULEBAR[me.role];

    if (st.module) {
      const key = `${st.module.index}:${st.module.type}:${me.role}`;
      modname.innerHTML = '';
      modname.append(h('div', { class: 'label' }, `MÓDULO ${st.module.index + 1} / ${t.moduleCount}`), h('h2', null, MODULE_TITLES[st.module.type]));
      if (key !== compKey) {
        comp?.destroy?.();
        compKey = key; clear(stage);
        comp = buildRoleView(st.module.type, me.role);
        stage.append(comp.el);
        stage.classList.toggle('gray', me.role === 'operator');
      }
      try {
        if (!st.module.view) throw new Error('sin vista para el rol');
        comp.update(st.module.view, st.module.type);
      } catch (e) {
        console.error(e);
        clear(stage);
        stage.append(h('div', { class: 'panel stack', 'data-testid': 'view-error' }, h('h3', null, 'NO SE PUEDE MOSTRAR TU PANTALLA'),
          h('p', null, `Rol: ${me.role} · módulo: ${st.module.type} · versión ${BUILD}`), h('button', { class: 'btn primary block', onclick: () => location.reload() }, 'RECARGAR')));
        comp = null; compKey = null;
      }
    } else if (room.status === 'countdown') {
      comp?.destroy?.(); comp = null; compKey = null; clear(stage); clear(modname);
      stage.append(h('div', { class: 'notice' }, 'Preparados…'));
    } else if (t.status !== 'playing') {
      comp?.destroy?.(); comp = null; compKey = null; clear(stage); clear(modname);
    }
    tickTimer();
  }

  function buildRoleView(type, role) {
    if (role === 'expert') {
      let last = '';
      const wrap = h('div');
      return { el: wrap, update(v) { const j = JSON.stringify(v); if (j !== last) { last = j; clear(wrap); wrap.append(expertPage(v, type)); } } };
    }
    if (role === 'analyst') {
      let last = '';
      const wrap = h('div');
      return { el: wrap, update(v) { const j = JSON.stringify(v); if (j !== last) { last = j; clear(wrap); wrap.append(analystSheet(v, type)); } } };
    }
    return createModule(type, role, ctx);
  }

  function fx(f) {
    if (!st) return;
    const mine = f.team === st.me.team;
    switch (f.kind) {
      case 'error':
        if (mine) { sfx.error(); document.body.append(h('div', { class: 'flash' })); setTimeout(() => document.querySelector('.flash')?.remove(), 1000); el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 500); banner(`⚠ ¡ERROR! ${f.errors}`, 'bad'); }
        else toast(`${TEAM_NAME[f.team]} se ha equivocado`);
        break;
      case 'penalty':
        if (mine) { sfx.penalty(); document.body.append(h('div', { class: 'flash' })); setTimeout(() => document.querySelector('.flash')?.remove(), 1000); el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 500); banner('⏱ ¡PENALIZACIÓN! −20 SEGUNDOS', 'bad'); }
        else toast(`${TEAM_NAME[f.team]}: −20 s de penalización`);
        break;
      case 'step': if (mine) sfx.step(); break;
      case 'solved': if (mine) { sfx.solved(); banner('✔ MÓDULO DESACTIVADO', 'good'); } else { sfx.blip(); toast(`${TEAM_NAME[f.team]} ha desactivado un módulo`); } break;
      case 'boom': if (!mine) { toast(`💥 ¡La bomba del ${TEAM_NAME[f.team]} ha explotado!`); } break;
      default: break;
    }
  }
  return { el, update, fx, destroy() { clearInterval(iv); comp?.destroy?.(); } };
}

/* ====================== RESULTADOS ====================== */
export function createResults({ net }) {
  const el = h('div', { class: 'stack' });
  let played = false;
  function update(st) {
    const { match, me, room } = st;
    const w = match.winner;
    const mine = w && w === me.team;
    const coop = room.mode === 'coop';
    if (!played) { played = true; (mine ? sfx.win : sfx.lose)(); }
    const names = { defused: 'DESACTIVADA', exploded: 'EXPLOTÓ (errores)', timeout: 'EXPLOTÓ (tiempo)', playing: 'SIN TERMINAR' };
    clear(el);
    fill(el,
      h('div', { class: `result-title ${mine ? 'win' : 'lose'}`, 'data-testid': 'result-title' },
        h('div', { class: 'label' }, 'RESULTADO'),
        h('h1', null, coop ? (w ? '¡BOMBA DESACTIVADA!' : 'LA BOMBA EXPLOTÓ') : w ? `${TEAM_NAME[w]} GANA` : 'NADIE DESACTIVÓ LA BOMBA'),
        h('p', null, coop ? (w ? '¡Lo habéis conseguido a tiempo!' : 'No lo habéis conseguido esta vez.') : w ? (mine ? '¡Vuestro equipo desactivó la bomba primero!' : 'El otro equipo fue más rápido.') : 'Ambas bombas explotaron.')),
      Object.keys(match.teams).map((tm) => {
        const x = match.teams[tm];
        return h('div', { class: `rteam ${tm} ${w === tm ? 'winner' : ''}` }, h('h3', { class: `team-tag ${tm}` }, coop ? 'VUESTRA BOMBA' : TEAM_NAME[tm], w === tm ? ' 🏆' : ''),
          h('dl', null, h('dt', null, 'Bomba'), h('dd', null, names[x.status]),
            h('dt', null, 'Módulos'), h('dd', null, `${x.moduleIndex} / ${x.moduleCount}`),
            h('dt', null, 'Errores'), h('dd', null, `${x.errors} / ${x.maxErrors}`),
            h('dt', null, x.status === 'defused' ? 'Tiempo de desactivación' : 'Tiempo hasta el fallo'), h('dd', null, x.finishedMs != null ? fmtTime(x.finishedMs) : '—'),
            x.penaltyMs ? [h('dt', null, 'Penalizaciones'), h('dd', null, `−${x.penaltyMs / 1000} s`)] : null));
      }),
      h('div', { class: 'panel stack' },
        h('button', { class: 'btn primary block', 'data-testid': 'rematch', onclick: () => net.send({ t: 'rematch' }) }, '↻ JUGAR REVANCHA'),
        h('p', { class: 'dim', style: { fontSize: '13px', textAlign: 'center' } }, 'Volvéis a la sala con los mismos equipos y roles. El anfitrión puede intercambiar roles, mezclar equipos o cambiar la dificultad. La bomba será nueva.'),
        h('div', { class: 'notice' }, `Semilla de esta partida: ${match.seed}`)));
  }
  return { el, update };
}
