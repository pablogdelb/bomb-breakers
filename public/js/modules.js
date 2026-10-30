// Interfaces interactivas de los minijuegos para el OPERADOR (gris, interactivo) y el INTÉRPRETE (color, solo lectura).
import { h, s, clear } from './dom.js';
import { sfx } from './sound.js';
import { HEX, COLOR_ABBR, symbol } from './art.js';

const GRAY = '#8d96a3';

function keypad({ n, label, onSubmit, testid }) {
  let code = [];
  const lcd = h('div', { class: 'lcd', 'data-testid': `${testid}-lcd` });
  const paint = () => {
    clear(lcd);
    for (let i = 0; i < n; i++) lcd.append(h('div', { class: `d ${code[i] === undefined ? 'empty' : ''}` }, code[i] === undefined ? '–' : code[i]));
  };
  const keys = h('div', { class: 'keypad' });
  for (const d of [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]) {
    keys.append(h('button', { class: 'key', 'data-testid': `key-${d}`, onclick: () => { if (code.length < n) { code.push(d); sfx.click(); paint(); } } }, d));
  }
  const del = h('button', { class: 'btn small', 'data-testid': 'key-del', onclick: () => { code.pop(); sfx.click(); paint(); } }, 'BORRAR');
  const go = h('button', { class: 'btn primary grow', 'data-testid': 'key-submit', onclick: () => {
    if (code.length !== n) return;
    const digits = code.slice(); code = []; paint(); onSubmit(digits);
  } }, label);
  paint();
  return { el: h('div', { class: 'stack' }, lcd, keys, h('div', { class: 'row' }, del, go)), reset: () => { code = []; paint(); }, setN: (v) => { if (v !== n) { n = v; code = []; paint(); } } };
}

/* ---------------- CABLES ---------------- */
function cables(role, ctx) {
  const op = role === 'operator';
  let sel = null, shown = [];
  const svg = s('svg', { viewBox: '0 0 360 290', class: 'svgwrap', 'data-testid': 'cables' });
  const btn = h('button', { class: 'btn danger block', disabled: true, 'data-testid': 'cut-btn', onclick: () => { if (sel) { sfx.snip(); ctx.send({ type: 'cut', pos: sel }); } } }, 'SELECCIONA UN CABLE');
  const info = h('div', { class: 'notice' });
  const el = h('div', { class: 'stack' }, h('div', { class: 'panel screws device' }, svg), op ? btn : null, info);
  function draw(v) {
    clear(svg);
    svg.append(s('rect', { x: 4, y: 4, width: 352, height: 282, rx: 14, fill: '#0f1620', stroke: '#2c3a4d', 'stroke-width': 2 }));
    for (const c of v.cables) {
      const y = 34 + (c.pos - 1) * 44, cut = v.cut.includes(c.pos);
      const a = (((c.pos * 37) % 5) - 2) * 9, b = (((c.pos * 53) % 5) - 2) * 9;
      const col = op ? GRAY : HEX[c.color];
      const g = s('g', { 'data-pos': c.pos });
      g.append(s('rect', { x: 10, y: y - 11, width: 26, height: 22, rx: 4, fill: '#5a6678' }), s('rect', { x: 324, y: y - 11, width: 26, height: 22, rx: 4, fill: '#5a6678' }));
      if (!cut) {
        const d = `M34 ${y} C 120 ${y + a}, 240 ${y + b}, 326 ${y}`;
        g.append(s('path', { d, fill: 'none', stroke: '#000', 'stroke-width': 14, opacity: .4, transform: 'translate(0 3)' }),
          s('path', { d, fill: 'none', stroke: col, 'stroke-width': 9, 'stroke-linecap': 'round', class: `wire ${sel === c.pos ? 'sel' : ''}` }),
          s('path', { d, fill: 'none', stroke: '#fff', 'stroke-width': 2, opacity: .3, transform: 'translate(0 -2)' }));
        const my = y + 0.375 * (a + b);
        g.append(s('circle', { cx: 180, cy: my, r: 15, fill: sel === c.pos ? '#fff' : '#0b1118', stroke: sel === c.pos ? '#fff' : '#9aa7b8', 'stroke-width': 2 }),
          s('text', { x: 180, y: my + 6, 'text-anchor': 'middle', 'font-family': 'Share Tech Mono, monospace', 'font-size': 20, fill: sel === c.pos ? '#000' : '#e6edf6' }, c.pos));
        if (op) g.append(s('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': 38, class: 'wire-hit', 'data-testid': `wire-${c.pos}`,
          onclick: () => { sel = c.pos; sfx.click(); draw(v); btn.disabled = false; btn.textContent = `CORTAR CABLE ${sel}`; } }));
      } else {
        g.append(s('path', { d: `M34 ${y} Q 100 ${y + 4} 150 ${y + 24}`, fill: 'none', stroke: col, 'stroke-width': 9, 'stroke-linecap': 'round', opacity: .55 }),
          s('path', { d: `M326 ${y} Q 260 ${y + 4} 210 ${y + 24}`, fill: 'none', stroke: col, 'stroke-width': 9, 'stroke-linecap': 'round', opacity: .55 }),
          s('text', { x: 180, y: y + 6, 'text-anchor': 'middle', 'font-family': 'Share Tech Mono, monospace', 'font-size': 16, fill: '#6b7b92' }, `#${c.pos} ✂`));
        if (!shown.includes(c.pos)) g.append(s('circle', { cx: 180, cy: y + 12, r: 14, fill: '#ffe27a', class: 'spark-cut' }));
      }
      svg.append(g);
    }
    shown = v.cut.slice();
  }
  return {
    el,
    update(v) {
      if (sel && v.cut.includes(sel)) { sel = null; btn.disabled = true; btn.textContent = 'SELECCIONA UN CABLE'; }
      draw(v);
      info.textContent = op ? 'Corta solo lo que te indique tu intérprete.' : 'Describe con gestos al experto los colores y números de los cables.';
    },
  };
}

/* ---------------- CAJA FUERTE ---------------- */
function safe(role, ctx) {
  const op = role === 'operator';
  const grid = h('div', { class: 'grid3', 'data-testid': 'safe-grid' });
  const pad = op ? keypad({ n: 4, label: 'ABRIR CAJA', testid: 'safe', onSubmit: (digits) => ctx.send({ type: 'code', digits }) }) : null;
  const el = h('div', { class: 'stack' }, h('div', { class: 'panel screws device' }, grid), pad?.el,
    op ? null : h('div', { class: 'notice' }, 'Tú ves los colores de la caja. El operador solo ve los números.'));
  return {
    el,
    update(v) {
      clear(grid);
      for (const g of v.grid) grid.append(h('div', { class: `cell ${op ? '' : g.color}` }, h('small', null, g.idx + 1), g.n));
      pad?.setN(v.digits);
    },
  };
}

/* ---------------- SIMÓN CORROMPIDO ---------------- */
function wedge(i) {
  const rad = (d) => (d * Math.PI) / 180, cx = 150, cy = 150, ro = 142, ri = 56;
  const a0 = -135 + i * 90 + 3, a1 = a0 + 84;
  const p = (r, a) => `${(cx + r * Math.cos(rad(a))).toFixed(1)} ${(cy + r * Math.sin(rad(a))).toFixed(1)}`;
  return `M ${p(ro, a0)} A ${ro} ${ro} 0 0 1 ${p(ro, a1)} L ${p(ri, a1)} A ${ri} ${ri} 0 0 0 ${p(ri, a0)} Z`;
}
function simon(role, ctx) {
  const op = role === 'operator';
  let lastReplay = -1, token = 0, view = null;
  const pads = [];
  const svg = s('svg', { viewBox: '0 0 300 300', class: 'pads', 'data-testid': 'simon' });
  const center = s('text', { x: 150, y: 160, 'text-anchor': 'middle', 'font-family': 'Share Tech Mono, monospace', 'font-size': 30, fill: '#e6edf6' });
  const dots = h('div', { class: 'row', style: { justifyContent: 'center' } });
  for (let i = 0; i < 4; i++) {
    const path = s('path', { d: wedge(i), class: 'pad', 'data-testid': `pad-${i}`, fill: GRAY, style: { color: GRAY },
      onpointerdown: (e) => { if (!op) return; e.preventDefault(); light(i, 160); sfx.pad(i); ctx.send({ type: 'press', pos: i }); } });
    pads.push(path); svg.append(path);
  }
  svg.append(s('circle', { cx: 150, cy: 150, r: 50, fill: '#0b1118', stroke: '#3a4b63', 'stroke-width': 3 }), center);
  const replay = op ? h('button', { class: 'btn block', 'data-testid': 'replay', onclick: () => ctx.send({ type: 'replay' }) }, '↻ REPETIR SECUENCIA') : null;
  const el = h('div', { class: 'stack' }, h('div', { class: 'panel screws device' }, svg, dots), replay,
    h('div', { class: 'notice' }, op ? 'Pulsa los botones que te indique tu intérprete, en orden.' : 'Tú ves los colores reales. Gestos al experto: ¿qué colores se encienden y en qué orden?'));
  function light(i, ms) { pads[i].classList.add('lit'); setTimeout(() => pads[i].classList.remove('lit'), ms); }
  async function play(seq, my) {
    for (let k = 0; k < seq.length; k++) {
      await new Promise((r) => setTimeout(r, 650));
      if (my !== token) return;
      light(seq[k], 450); sfx.pad(seq[k]);
    }
  }
  return {
    el,
    destroy() { token++; },
    update(v) {
      view = v;
      pads.forEach((p, i) => {
        const col = op ? GRAY : HEX[v.buttons[i]];
        p.setAttribute('fill', col); p.style.color = col;
      });
      center.textContent = `${v.progress}/${v.sequence.length}`;
      if (v.replay !== lastReplay) { lastReplay = v.replay; token++; play(v.sequence, token); }
    },
  };
}

/* ---------------- CIRCUITO DE EMERGENCIA ---------------- */
function circuit(role, ctx) {
  const op = role === 'operator';
  let sel = [], k = 0;
  const pilots = h('div', { class: 'pilots', 'data-testid': 'pilots' });
  const sws = h('div', { class: 'sw-row', 'data-testid': 'switches' });
  const apply = h('button', { class: 'btn primary grow', 'data-testid': 'apply', onclick: () => { ctx.send({ type: 'apply', switches: sel.slice() }); sel = sel.map(() => false); paintSw(); } }, 'APLICAR');
  const reset = h('button', { class: 'btn small', onclick: () => { sel = sel.map(() => false); paintSw(); sfx.click(); } }, 'REINICIAR');
  function paintSw() {
    clear(sws);
    sel.forEach((on, i) => sws.append(h('button', { class: `sw ${on ? 'on' : ''}`, 'data-testid': `sw-${i + 1}`, onclick: () => { sel[i] = !sel[i]; sfx.click(); paintSw(); } },
      h('span', { class: 'n' }, `INT ${i + 1}`), h('span', { class: 'knob' }), h('span', { class: 'n' }, on ? 'ON' : 'OFF'))));
  }
  const el = h('div', { class: 'stack' }, h('div', { class: 'panel screws device stack' }, h('div', { class: 'label' }, 'PILOTOS'), pilots,
    op ? h('div', { class: 'label' }, 'INTERRUPTORES') : null, op ? sws : null),
    op ? h('div', { class: 'row' }, reset, apply) : null,
    h('div', { class: 'notice' }, op ? 'Cada interruptor alterna varios pilotos. Púlsalos según tu intérprete y aplica.' : 'Tú ves el color y el estado de cada piloto.'));
  return {
    el,
    update(v) {
      clear(pilots);
      for (const p of v.pilots) pilots.append(h('div', { class: 'pilot', 'data-testid': `pilot-${p.idx}`, 'data-on': p.on ? 1 : 0 },
        h('div', { class: `bulb ${p.on ? 'on' : ''} ${op ? '' : `${p.color} col`}` }), `P${p.idx}`));
      if (op && v.switches !== k) { k = v.switches; sel = Array(k).fill(false); paintSw(); }
    },
  };
}

/* ---------------- JEROGLÍFICOS ---------------- */
function glyphs(role, ctx) {
  const op = role === 'operator';
  const tiles = h('div', { class: 'tiles', 'data-testid': 'glyphs' });
  return {
    el: h('div', { class: 'stack' }, h('div', { class: 'panel screws device' }, tiles),
      h('div', { class: 'notice' }, op ? 'Pulsa los símbolos que te indique tu intérprete, en el orden indicado.' : 'Ves las marcas de color. Gestos al experto: ¿qué símbolos llevan qué marca?')),
    update(v) {
      clear(tiles);
      for (const g of v.symbols) {
        const pressed = v.pressed.includes(g.pos);
        const kids = [h('span', { class: 'pos' }, g.pos), symbol(g.symbol, op ? '#cfd6df' : '#dfe6ef')];
        if (!op) kids.push(h('div', { class: 'marks' }, g.marks.map((m) => h('i', { style: { background: HEX[m] } }))));
        tiles.append(op
          ? h('button', { class: `tile ${pressed ? 'pressed' : ''}`, 'data-testid': `glyph-${g.pos}`, onclick: () => { sfx.click(); ctx.send({ type: 'press', pos: g.pos }); } }, kids)
          : h('div', { class: `tile ${pressed ? 'pressed' : ''}` }, kids));
      }
    },
  };
}

/* ---------------- PROTOCOLO FINAL ---------------- */
function protocol(role, ctx) {
  const op = role === 'operator';
  const list = h('div', { class: 'stack', 'data-testid': 'protocol' });
  const pad = op ? keypad({ n: 4, label: 'DESACTIVAR BOMBA', testid: 'protocol', onSubmit: (digits) => ctx.send({ type: 'code', digits }) }) : null;
  return {
    el: h('div', { class: 'stack' }, h('div', { class: 'panel screws device stack' }, h('div', { class: 'label' }, 'SELLOS DE MÓDULO'), list), pad?.el,
      h('div', { class: 'notice' }, op ? 'Dicta los identificadores al experto (puede oírte). Introduce el código que te indique el intérprete.' : 'Ves el color de cada sello. Gestos al experto, en el orden de la lista.')),
    update(v) {
      clear(list);
      v.entries.forEach((e, i) => list.append(h('div', { class: 'entry' }, h('span', { class: 'label' }, `${i + 1}`), h('span', { class: 'grow', style: { fontSize: '12px' } }, e.label),
        op ? h('span', { class: 'id' }, e.id) : h('span', { class: `swatch ${e.color}`, style: { minWidth: '48px', height: '34px' } }, COLOR_ABBR[e.color]))));
    },
  };
}

const MAKERS = { cables, safe, simon, circuit, glyphs, protocol };
export function createModule(type, role, ctx) {
  return MAKERS[type](role, ctx);
}
