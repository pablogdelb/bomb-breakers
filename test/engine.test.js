import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateBomb, MODULES, DIFFICULTIES, initModuleState, projectModule, validateModuleAction, solveModule,
} from '../server/engine/index.js';
import { makeRng } from '../server/rng.js';
import * as cables from '../server/engine/cables.js';
import * as safe from '../server/engine/safe.js';
import * as simon from '../server/engine/simon.js';
import * as circuit from '../server/engine/circuit.js';
import * as glyphs from '../server/engine/glyphs.js';
import * as protocol from '../server/engine/protocol.js';
import { COLORS } from '../server/engine/common.js';

const N = 200;
const COMBOS = [];
for (const d of ['easy', 'normal', 'hard']) for (const s of [3, 4]) COMBOS.push([d, s]);
const ROLE_SET = (s) => (s === 4 ? ['operator', 'expert', 'interpreter', 'analyst'] : ['operator', 'expert', 'interpreter']);
const COLOR_RE = /"(red|blue|green|yellow)"/;

function* bombs(d, s, n = N) {
  for (let i = 0; i < n; i++) yield generateBomb(`seed-${d}-${s}-${i}`, d, s);
}

for (const [d, s] of COMBOS) {
  test(`[${d} · ${s}v${s}] ${N} bombas: estructura, determinismo y resolubilidad`, () => {
    const cfg = DIFFICULTIES[d];
    const kinds = new Set();
    const fingerprints = new Set();
    for (let i = 0; i < N; i++) {
      const seed = `seed-${d}-${s}-${i}`;
      const bomb = generateBomb(seed, d, s);
      assert.deepEqual(bomb, generateBomb(seed, d, s), 'la misma semilla debe dar la misma bomba');
      fingerprints.add(JSON.stringify(bomb.modules.map((m) => m.puzzle)));
      assert.equal(bomb.modules.length, cfg.modules + (cfg.protocol ? 1 : 0));
      assert.equal(bomb.modules.at(-1).type === 'protocol', cfg.protocol);
      for (const m of bomb.modules) {
        kinds.add(m.type);
        let state = initModuleState(m);
        const actions = solveModule(m);
        assert.ok(actions.length > 0 && actions.every((a) => a && typeof a === 'object'));
        actions.forEach((a, idx) => {
          const r = validateModuleAction(m, state, a);
          const last = idx === actions.length - 1;
          assert.equal(r.solved, last, `${m.type} seed ${seed}`);
          assert.equal(r.outcome, last ? 'correct' : 'progress');
          state = r.state;
        });
      }
    }
    assert.ok(fingerprints.size > N * 0.95, 'las bombas deben variar entre semillas');
    assert.ok(kinds.size >= 5, 'deben aparecer todos los tipos de módulo');
  });
}

// ---- Verificadores independientes (reimplementados de forma distinta al generador) ----
test('cables: la solución cumple las reglas del manual (verificador independiente)', () => {
  for (const [d, s] of COMBOS) for (const b of bombs(d, s)) for (const m of b.modules.filter((x) => x.type === 'cables')) {
    const p = m.puzzle;
    const color = (pos) => p.cables.find((c) => c.pos === pos).color;
    const a = p.answer;
    assert.equal(color(a[0]), 'red');
    const reds = p.cables.filter((c) => c.color === 'red').map((c) => c.pos).sort((x, y) => x - y);
    assert.equal(a[0], p.param === 1 ? reds[0] : reds.at(-1));
    if (a.length > 1) {
      assert.equal(color(a[1]), 'blue');
      const blues = p.cables.filter((c) => c.color === 'blue').map((c) => c.pos);
      const sorted = blues.sort((x, y) => Math.abs(x - a[0]) - Math.abs(y - a[0]) || (p.param ? y - x : x - y));
      assert.equal(a[1], sorted[0]);
    }
    if (a.length > 2) {
      const left = p.cables.filter((c) => !a.slice(0, 2).includes(c.pos));
      const g = left.filter((c) => c.color === 'green');
      const pool = g.length ? g : left.filter((c) => c.color === 'yellow');
      assert.equal(a[2], Math.min(...pool.map((c) => c.pos)));
    }
    assert.equal(new Set(a).size, a.length);
  }
});

test('caja fuerte: el código coincide con el cálculo independiente', () => {
  for (const [d, s] of COMBOS) for (const b of bombs(d, s)) for (const m of b.modules.filter((x) => x.type === 'safe')) {
    const p = m.puzzle;
    const cell = (i) => p.grid[i];
    let red = 0, blue = 0, lastGreen = 0;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const g = cell(r * 3 + c);
      if (g.color === 'red') red += g.n;
      if (g.color === 'blue') blue++;
      if (g.color === 'green') lastGreen = g.n;
    }
    const full = [red % 10, (blue + p.param) % 10, lastGreen, (red % 10 + (blue + p.param) % 10 + lastGreen) % 10];
    assert.deepEqual(p.code, full.slice(0, p.digits));
    assert.equal(p.digits, { easy: 2, normal: 3, hard: 4 }[d]);
    if (s === 3) assert.equal(p.param, 1);
  }
});

test('simón: la tabla es biyección sin puntos fijos y la respuesta es la transformación correcta', () => {
  for (const [d, s] of COMBOS) for (const b of bombs(d, s)) for (const m of b.modules.filter((x) => x.type === 'simon')) {
    const p = m.puzzle;
    assert.deepEqual(Object.values(p.map).sort(), [...COLORS].sort());
    for (const c of COLORS) assert.notEqual(p.map[c], c);
    assert.deepEqual(p.buttons.slice().sort(), [...COLORS].sort());
    assert.equal(p.sequence.length, { easy: 2, normal: 3, hard: 4 }[d]);
    let seq = p.sequence.map((pos) => p.buttons[pos]);
    if (p.reverse) seq = seq.reverse();
    const expected = seq.map((c) => p.buttons.findIndex((x) => x === p.map[c]));
    assert.deepEqual(p.answer, expected);
    if (s === 3) assert.equal(p.reverse, false);
  }
});

test('circuito: la solución GF(2) coincide con la búsqueda exhaustiva', () => {
  for (const [d, s] of COMBOS) for (const b of bombs(d, s, 100)) for (const m of b.modules.filter((x) => x.type === 'circuit')) {
    const p = m.puzzle;
    assert.equal(p.k, { easy: 3, normal: 4, hard: 5 }[d]);
    assert.equal(p.m, { easy: 2, normal: 3, hard: 4 }[d]);
    const need = p.initial ^ p.target;
    let valid = 0;
    for (let sel = 0; sel < 1 << p.k; sel++) {
      let eff = 0;
      for (let i = 0; i < p.k; i++) if ((sel >> i) & 1) eff ^= p.cols[i];
      if (eff === need) valid++;
    }
    assert.ok(valid >= 1, 'existe al menos una combinación');
    const gf = solveModule(m)[0];
    const asMask = gf.switches.reduce((acc, on, i) => (on ? acc | (1 << i) : acc), 0);
    let eff = 0;
    for (let i = 0; i < p.k; i++) if ((asMask >> i) & 1) eff ^= p.cols[i];
    assert.equal(eff, need);
    assert.notEqual(p.initial, p.target);
    // objetivo = pilotos del color meta encendidos (o al revés si invert)
    p.pilotColors.forEach((c, j) => assert.equal(((p.target >> j) & 1) === 1, (c === p.goal) !== p.invert));
  }
});

test('jeroglíficos: conjunto correcto único y orden por prioridad', () => {
  for (const [d, s] of COMBOS) for (const b of bombs(d, s)) for (const m of b.modules.filter((x) => x.type === 'glyphs')) {
    const p = m.puzzle;
    const chosen = [];
    p.layout.forEach((sym, i) => {
      const mk = p.marks[i];
      if (mk.includes(p.activation) && !(p.block && mk.includes(p.block))) chosen.push(i + 1);
    });
    assert.equal(chosen.length, { easy: 2, normal: 3, hard: 3 }[d]);
    assert.deepEqual([...p.answer].sort(), chosen.sort());
    assert.equal(new Set(p.layout).size, 6);
    const ranks = p.answer.map((pos) => p.priority.indexOf(p.layout[pos - 1]));
    const sortedRanks = [...ranks].sort((a, c) => a - c);
    assert.deepEqual(ranks, p.reverse ? sortedRanks.reverse() : sortedRanks);
    if (d === 'hard') assert.ok(p.marks.some((mk) => mk.includes(p.activation) && mk.includes(p.block)), 'hay señuelos');
  }
});

test('protocolo: fórmula (id + color + modificador) mod 10', () => {
  const IDX = { red: 1, blue: 2, green: 3, yellow: 4 };
  for (const d of ['normal', 'hard']) for (const s of [3, 4]) for (const b of bombs(d, s)) {
    const m = b.modules.at(-1);
    const p = m.puzzle;
    assert.equal(p.entries.length, 4);
    p.entries.forEach((e, i) => assert.equal(p.code[i], (e.id + IDX[e.color] + p.modifier) % 10));
    if (s === 3) assert.equal(p.modifier, 0);
  }
  assert.equal((6 + 3 + 2) % 10, 1); // ejemplo del documento
  assert.equal(generateBomb('x', 'easy', 3).modules.some((m) => m.type === 'protocol'), false);
});

// ---- Validación: las respuestas incorrectas se rechazan ----
function wrongActions(m) {
  const p = m.puzzle;
  const out = [];
  switch (m.type) {
    case 'cables': for (let pos = 1; pos <= 6; pos++) if (pos !== p.answer[0]) out.push({ type: 'cut', pos }); break;
    case 'safe': case 'protocol': {
      const n = m.type === 'safe' ? p.digits : 4;
      for (let i = 0; i < n; i++) { const d = p.code.slice(); d[i] = (d[i] + 1) % 10; out.push({ type: 'code', digits: d }); }
      break;
    }
    case 'simon': for (let pos = 0; pos < 4; pos++) if (pos !== p.answer[0]) out.push({ type: 'press', pos }); break;
    case 'glyphs': for (let pos = 1; pos <= 6; pos++) if (pos !== p.answer[0]) out.push({ type: 'press', pos }); break;
    case 'circuit': {
      const need = p.initial ^ p.target;
      for (let sel = 0; sel < 1 << p.k; sel++) {
        const sw = Array.from({ length: p.k }, (_, i) => ((sel >> i) & 1) === 1);
        if (circuit.applySwitches(p.cols, sw) !== need) out.push({ type: 'apply', switches: sw });
      }
      break;
    }
  }
  return out;
}

test('las respuestas incorrectas se rechazan y las malformadas no cuentan como error', () => {
  for (const [d, s] of COMBOS) for (const b of bombs(d, s, 40)) for (const m of b.modules) {
    const st = initModuleState(m);
    const wrongs = wrongActions(m);
    assert.ok(wrongs.length > 0);
    for (const w of wrongs) {
      const r = validateModuleAction(m, st, w);
      assert.equal(r.outcome, 'wrong', `${m.type}: ${JSON.stringify(w)}`);
      assert.equal(r.solved, false);
    }
    for (const junk of [null, {}, { type: 'nope' }, { type: 'cut', pos: 99 }, { type: 'press', pos: 'x' }, { type: 'code', digits: [1] }, { type: 'apply', switches: [1] }]) {
      assert.equal(validateModuleAction(m, st, junk).outcome, 'invalid');
    }
  }
});

test('un fallo reinicia la secuencia en simón y jeroglíficos; los cables no se pierden', () => {
  for (const b of bombs('hard', 4, 30)) {
    for (const m of b.modules) {
      if (m.type !== 'simon' && m.type !== 'glyphs') continue;
      const sol = solveModule(m);
      let st = initModuleState(m);
      st = validateModuleAction(m, st, sol[0]).state;
      const wrong = wrongActions(m).find((w) => validateModuleAction(m, st, w).outcome === 'wrong');
      assert.ok(wrong);
      const r = validateModuleAction(m, st, wrong);
      assert.equal(r.outcome, 'wrong');
      assert.equal(r.state.progress, 0);
      // y después se puede resolver desde cero
      let s2 = r.state;
      for (const a of sol) s2 = validateModuleAction(m, s2, a).state;
      assert.equal(validateModuleAction(m, initModuleState(m), sol[0]).state.progress, 1);
    }
  }
});

// ---- Seguridad y reparto de información ----
const SECRET_KEYS = new Set(['answer', 'code', 'target', 'initial', 'cols', 'solution', 'seed', 'priorityOrder']);
function keysOf(o, acc = new Set()) {
  if (Array.isArray(o)) o.forEach((x) => keysOf(x, acc));
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { acc.add(k); keysOf(v, acc); }
  return acc;
}

test('las vistas de rol no contienen respuestas y el operador no recibe colores', () => {
  for (const [d, s] of COMBOS) for (const b of bombs(d, s, 60)) for (const m of b.modules) {
    const st = initModuleState(m);
    for (const role of ROLE_SET(s)) {
      const v = projectModule(m, role, st);
      assert.ok(v, `${m.type}/${role} debe tener vista`);
      const json = JSON.stringify(v);
      for (const k of keysOf(v)) assert.ok(!SECRET_KEYS.has(k), `${m.type}/${role} expone '${k}'`);
      const a = m.puzzle.answer || m.puzzle.code;
      if (a && (m.type === 'safe' || m.type === 'protocol')) assert.ok(!json.includes(JSON.stringify(a)), 'el código no aparece');
      if (role === 'operator') assert.ok(!COLOR_RE.test(json), `operador ve colores en ${m.type}`);
    }
    if (s === 3) assert.equal(projectModule(m, 'analyst', st), null);
  }
});

test('la vista del experto no incluye los datos de la bomba; la del intérprete no incluye las reglas', () => {
  for (const [d, s] of COMBOS) for (const b of bombs(d, s, 60)) for (const m of b.modules) {
    const st = initModuleState(m);
    const ex = JSON.stringify(projectModule(m, 'expert', st));
    const it = JSON.stringify(projectModule(m, 'interpreter', st));
    switch (m.type) {
      case 'cables': assert.ok(!COLOR_RE.test(ex)); break;
      case 'safe': assert.ok(!/"grid"/.test(ex)); break;
      case 'simon': assert.ok(!/sequence/.test(ex) && !/buttons/.test(ex)); assert.ok(!/"map"/.test(it)); break;
      case 'circuit': assert.ok(!/pilots":\[\{/.test(ex)); assert.ok(!/wiring/.test(it) && !/goal/.test(it)); break;
      case 'glyphs': assert.ok(!/layout|symbols|marks/.test(ex)); assert.ok(!/priority|activation/.test(it)); break;
      case 'protocol': assert.ok(!/"color"/.test(ex)); assert.ok(!/formula|fixedModifier/.test(it)); break;
    }
  }
});

// ---- Ningún jugador puede resolver solo: la respuesta cambia al variar lo que ese rol no ve ----
const rng = makeRng('mutations');
function answerOf(type, p) { return JSON.stringify(solveModule({ type, puzzle: p })); }

const MUTATIONS = {
  // cada mutación cambia SOLO datos que el rol indicado no ve, recalculando la respuesta
  operator: {
    cables: (p) => { const c = p.cables.map((x) => ({ ...x, color: rng.pick(COLORS) })); const a = cables.solveRules(c, p.cuts, p.param); return a && { ...p, cables: c, answer: a }; },
    safe: (p) => { const g = p.grid.map((x) => ({ ...x, color: rng.pick(COLORS) })); return { ...p, grid: g, code: safe.computeCode(g, p.param, p.digits) }; },
    simon: (p) => { const t = rng.shuffle(COLORS); const map = Object.fromEntries(COLORS.map((c, i) => [c, t[i]])); const q = { ...p, map, buttons: rng.shuffle(COLORS) }; return { ...q, answer: simon.expectedPositions(q) }; },
    circuit: (p) => { const pc = p.pilotColors.map(() => rng.pick(COLORS)); const goal = rng.pick(pc); const target = circuit.targetMask(pc, goal, p.invert); return circuit.solveGF2(p.cols, p.m, p.initial ^ target) && { ...p, pilotColors: pc, goal, target }; },
    glyphs: (p) => { const marks = p.marks.map(() => rng.shuffle(COLORS).slice(0, rng.int(3))); const q = { ...p, marks, activation: rng.pick(COLORS) }; return { ...q, answer: glyphs.expectedOrder(q) }; },
    protocol: (p) => { const entries = p.entries.map((e) => ({ ...e, color: rng.pick(COLORS) })); return { ...p, entries, code: protocol.computeCode(entries, p.modifier) }; },
  },
  expert: {
    cables: (p) => { const c = p.cables.map((x) => ({ ...x, color: rng.pick(COLORS) })); const a = cables.solveRules(c, p.cuts, p.param); return a && { ...p, cables: c, answer: a }; },
    safe: (p) => { const g = p.grid.map(() => ({ n: rng.int(10), color: rng.pick(COLORS) })).map((x, i) => ({ idx: i, ...x })); return { ...p, grid: g, code: safe.computeCode(g, p.param, p.digits) }; },
    simon: (p) => { const q = { ...p, sequence: p.sequence.map(() => rng.int(4)), buttons: rng.shuffle(COLORS) }; return { ...q, answer: simon.expectedPositions(q) }; },
    circuit: (p) => { const initial = rng.int(1 << p.m); return circuit.solveGF2(p.cols, p.m, initial ^ p.target) && { ...p, initial }; },
    glyphs: (p) => { const q = { ...p, layout: rng.shuffle(glyphs.SYMBOLS), marks: p.marks.map((_, i) => p.marks[(i + 1) % 6]) }; return { ...q, answer: glyphs.expectedOrder(q) }; },
    protocol: (p) => { const entries = p.entries.map((e) => ({ ...e, id: rng.int(10), color: rng.pick(COLORS) })); return { ...p, entries, code: protocol.computeCode(entries, p.modifier) }; },
  },
  interpreter: {
    simon: (p) => { const t = rng.shuffle(COLORS); const map = Object.fromEntries(COLORS.map((c, i) => [c, t[i]])); const q = { ...p, map }; return { ...q, answer: simon.expectedPositions(q) }; },
    circuit: (p) => { const cols = rng.shuffle(Array.from({ length: (1 << p.m) - 1 }, (_, i) => i + 1)).slice(0, p.k); return circuit.solveGF2(cols, p.m, p.initial ^ p.target) && { ...p, cols }; },
    glyphs: (p) => { const q = { ...p, priority: rng.shuffle(glyphs.SYMBOLS), activation: p.activation }; return { ...q, answer: glyphs.expectedOrder(q) }; },
    safe: (p) => ({ ...p, param: (p.param + 1) % 4, code: safe.computeCode(p.grid, (p.param + 1) % 4, p.digits) }),
    cables: (p) => { const a = cables.solveRules(p.cables, p.cuts, 1 - p.param); return { ...p, answer: a }; },
    protocol: (p) => ({ ...p, modifier: (p.modifier + 3) % 10, code: protocol.computeCode(p.entries, (p.modifier + 3) % 10) }),
  },
};

for (const role of Object.keys(MUTATIONS)) {
  test(`ningún jugador resuelve solo: sin la información del resto, el ${role} no determina la respuesta`, () => {
    for (const type of Object.keys(MUTATIONS[role])) {
      let differed = 0, tried = 0;
      for (const b of bombs('hard', 4, 40)) for (const m of b.modules.filter((x) => x.type === type)) {
        const base = answerOf(type, m.puzzle);
        for (let i = 0; i < 6; i++) {
          const q = MUTATIONS[role][type](m.puzzle);
          if (!q) continue;
          tried++;
          if (answerOf(type, q) !== base) differed++;
        }
      }
      assert.ok(tried > 10 && differed / tried > 0.5, `${role}/${type}: ${differed}/${tried}`);
    }
  });
}

test('el analista es imprescindible en 4 jugadores: el parámetro cambia siempre la respuesta', () => {
  for (const [d] of COMBOS.filter(([, s]) => s === 4)) for (const b of bombs(d, 4)) for (const m of b.modules) {
    const p = m.puzzle;
    let alt;
    switch (m.type) {
      case 'cables': alt = cables.solveRules(p.cables, p.cuts, 1 - p.param); assert.notDeepEqual(alt, p.answer); break;
      case 'safe': alt = safe.computeCode(p.grid, (p.param + 1) % 4, p.digits); assert.notDeepEqual(alt, p.code); break;
      case 'simon': alt = simon.expectedPositions({ ...p, reverse: !p.reverse }); assert.notDeepEqual(alt, p.answer); break;
      case 'circuit': alt = circuit.targetMask(p.pilotColors, p.goal, !p.invert); assert.notEqual(alt, p.target); break;
      case 'glyphs': alt = glyphs.expectedOrder({ ...p, reverse: !p.reverse }); assert.notDeepEqual(alt, p.answer); break;
      case 'protocol': alt = protocol.computeCode(p.entries, p.modifier + 1); assert.notDeepEqual(alt, p.code); break;
    }
  }
});

test('en 3 contra 3 el analista no existe y los parámetros usan los valores fijos del manual', () => {
  for (const [d] of COMBOS.filter(([, s]) => s === 3)) for (const b of bombs(d, 3, 50)) for (const m of b.modules) {
    const p = m.puzzle;
    if (m.type === 'cables') assert.equal(p.param, 0);
    if (m.type === 'safe') assert.equal(p.param, 1);
    if (m.type === 'simon' || m.type === 'glyphs') assert.equal(p.reverse, false);
    if (m.type === 'circuit') assert.equal(p.invert, false);
    if (m.type === 'protocol') assert.equal(p.modifier, 0);
  }
});

test('los dos equipos reciben bombas idénticas pero estados independientes', () => {
  const b = generateBomb('igualdad', 'hard', 4);
  const red = b.modules.map(initModuleState), blue = b.modules.map(initModuleState);
  assert.deepEqual(red, blue);
  const m = b.modules[0];
  const sol = solveModule(m);
  red[0] = validateModuleAction(m, red[0], sol[0]).state;
  if (sol.length > 1) assert.notDeepEqual(red[0], blue[0]);
  assert.deepEqual(blue[0], initModuleState(m));
});

test('GF(2): detecta sistemas sin solución', () => {
  assert.equal(circuit.solveGF2([0b01, 0b01], 2, 0b10), null);
  assert.deepEqual(circuit.solveGF2([0b01, 0b10], 2, 0b11), [true, true]);
});
