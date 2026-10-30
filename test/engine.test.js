import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateBomb, DIFFICULTIES, initModuleState, projectModule, validateModuleAction, solveModule,
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
test('cables: 8 cables y la solución cumple las reglas del manual (verificador independiente)', () => {
  const CUTS = { easy: 2, normal: 3, hard: 4 };
  for (const [d, s] of COMBOS) for (const b of bombs(d, s)) for (const m of b.modules.filter((x) => x.type === 'cables')) {
    const p = m.puzzle;
    assert.equal(p.cables.length, 8);
    assert.equal(p.answer.length, CUTS[d]);
    assert.equal(new Set(p.answer).size, p.answer.length);
    const color = (pos) => p.cables.find((c) => c.pos === pos).color;
    const a = p.answer, prm = p.params;
    const byPos = (list, cmp) => list.slice().sort(cmp)[0];
    const left = (n) => p.cables.filter((c) => !a.slice(0, n).includes(c.pos));
    // paso 1
    const reds = left(0).filter((c) => c.color === 'red').map((c) => c.pos).sort((x, y) => x - y);
    assert.equal(a[0], prm[0] ? reds[0] : reds.at(-1));
    // paso 2
    const blues = left(1).filter((c) => c.color === 'blue').map((c) => c.pos);
    assert.equal(color(a[1]), 'blue');
    const dir2 = prm[1] ? -1 : 1;
    assert.equal(a[1], byPos(blues, (x, y) => dir2 * (Math.abs(x - a[0]) - Math.abs(y - a[0])) || x - y));
    if (a.length > 2) {
      const g = left(2).filter((c) => c.color === 'green').map((c) => c.pos);
      const pool = g.length ? g : left(2).filter((c) => c.color === 'yellow').map((c) => c.pos);
      assert.equal(a[2], prm[2] ? Math.max(...pool) : Math.min(...pool));
    }
    if (a.length > 3) {
      const pool = left(3).filter((c) => c.color === 'green' || c.color === 'yellow').map((c) => c.pos);
      const dir4 = prm[3] ? 1 : -1; // p=0: el más lejano
      assert.equal(a[3], byPos(pool, (x, y) => dir4 * (Math.abs(x - a[2]) - Math.abs(y - a[2])) || x - y));
    }
    if (s === 3) assert.ok(prm.every((v) => v === 0));
  }
});

test('caja fuerte: cuadrícula 4×4 y código igual al cálculo independiente', () => {
  for (const [d, s] of COMBOS) for (const b of bombs(d, s)) for (const m of b.modules.filter((x) => x.type === 'safe')) {
    const p = m.puzzle;
    assert.equal(p.grid.length, 16);
    let red = 0, blue = 0, yellow = 0, lastGreen = 0;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const g = p.grid[r * 4 + c];
      if (g.color === 'red') red += g.n;
      if (g.color === 'blue') blue++;
      if (g.color === 'yellow') yellow++;
      if (g.color === 'green') lastGreen = g.n;
    }
    const d1 = red % 10, d2 = (blue + p.prm.A) % 10, d3 = (lastGreen + p.prm.B) % 10;
    const full = [d1, d2, d3, (d1 + d2 + d3) % 10, (3 * yellow + p.prm.C) % 10];
    assert.deepEqual(p.code, full.slice(0, p.digits));
    assert.equal(p.digits, { easy: 3, normal: 4, hard: 5 }[d]);
    if (s === 3) assert.deepEqual(p.prm, { A: 1, B: 0, C: 0 });
  }
});

test('simón: dos tablas biyectivas sin puntos fijos y distintas en todos los colores', () => {
  for (const [d, s] of COMBOS) for (const b of bombs(d, s)) for (const m of b.modules.filter((x) => x.type === 'simon')) {
    const p = m.puzzle;
    for (const t of p.tables) {
      assert.deepEqual(Object.values(t).sort(), [...COLORS].sort());
      for (const c of COLORS) assert.notEqual(t[c], c);
    }
    for (const c of COLORS) assert.notEqual(p.tables[0][c], p.tables[1][c]);
    assert.equal(p.sequence.length, { easy: 3, normal: 4, hard: 5 }[d]);
    let seq = p.sequence.map((pos) => p.buttons[pos]);
    if (p.reverse) seq = seq.reverse();
    const expected = seq.map((c) => p.buttons.findIndex((x) => x === p.tables[p.table][c]));
    assert.deepEqual(p.answer, expected);
    if (s === 3) { assert.equal(p.reverse, false); assert.equal(p.table, 0); }
  }
});

test('circuito: la solución GF(2) coincide con la búsqueda exhaustiva', () => {
  for (const [d, s] of COMBOS) for (const b of bombs(d, s, 100)) for (const m of b.modules.filter((x) => x.type === 'circuit')) {
    const p = m.puzzle;
    assert.equal(p.k, { easy: 4, normal: 5, hard: 6 }[d]);
    assert.equal(p.m, { easy: 3, normal: 4, hard: 5 }[d]);
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
    // objetivo = color meta encendido, el resto apagado; los pilotos de `flip` al revés
    p.pilotColors.forEach((c, j) => assert.equal(((p.target >> j) & 1) === 1, (c === p.goal) !== (((p.flip >> j) & 1) === 1)));
    if (s === 3) assert.equal(p.flip, 0); else assert.ok(p.flip > 0);
  }
});

test('jeroglíficos: 9 símbolos, conjunto correcto único y orden por la lista elegida', () => {
  for (const [d, s] of COMBOS) for (const b of bombs(d, s)) for (const m of b.modules.filter((x) => x.type === 'glyphs')) {
    const p = m.puzzle;
    assert.equal(p.layout.length, 9);
    assert.equal(new Set(p.layout).size, 9);
    const chosen = [];
    p.layout.forEach((sym, i) => {
      const mk = p.marks[i];
      if (mk.includes(p.activation) && !(p.block && mk.includes(p.block))) chosen.push(i + 1);
    });
    assert.equal(chosen.length, { easy: 3, normal: 4, hard: 5 }[d]);
    assert.deepEqual([...p.answer].sort((x, y) => x - y), chosen.sort((x, y) => x - y));
    const ranks = p.answer.map((pos) => p.priorities[p.list].indexOf(p.layout[pos - 1]));
    const sortedRanks = [...ranks].sort((a, c) => a - c);
    assert.deepEqual(ranks, p.reverse ? sortedRanks.reverse() : sortedRanks);
    if (d === 'hard') assert.ok(p.marks.some((mk) => mk.includes(p.activation) && mk.includes(p.block)), 'hay señuelos');
    if (s === 3) { assert.equal(p.list, 0); assert.equal(p.reverse, false); }
  }
});

test('protocolo: una cifra por módulo, fórmula con paridad y modificador propio', () => {
  const IDX = { red: 1, blue: 2, green: 3, yellow: 4 };
  for (const d of ['normal', 'hard']) for (const s of [3, 4]) for (const b of bombs(d, s)) {
    const m = b.modules.at(-1);
    const p = m.puzzle;
    assert.equal(p.entries.length, b.modules.length - 1);
    assert.equal(p.entries.length, { normal: 4, hard: 5 }[d]);
    p.entries.forEach((e, i) => {
      const k = IDX[e.color] * (e.id % 2 === 0 ? 2 : 1);
      assert.equal(p.code[i], (e.id + k + p.mods[i]) % 10);
    });
    if (s === 3) assert.ok(p.mods.every((x) => x === 0));
  }
  assert.equal((6 + 3 * 2 + 2) % 10, 4); // id 6 (par) verde(3): 6 + 3×2 + 2 = 14 → 4
  assert.equal((7 + 3 + 2) % 10, 2); // id 7 (impar) verde(3): 7 + 3 + 2 = 12 → 2
  assert.equal(generateBomb('x', 'easy', 3).modules.some((m) => m.type === 'protocol'), false);
});

// ---- Validación: las respuestas incorrectas se rechazan ----
function wrongActions(m) {
  const p = m.puzzle;
  const out = [];
  switch (m.type) {
    case 'cables': for (let pos = 1; pos <= 8; pos++) if (pos !== p.answer[0]) out.push({ type: 'cut', pos }); break;
    case 'safe': case 'protocol': {
      const n = m.type === 'safe' ? p.digits : p.entries.length;
      for (let i = 0; i < n; i++) { const d = p.code.slice(); d[i] = (d[i] + 1) % 10; out.push({ type: 'code', digits: d }); }
      break;
    }
    case 'simon': for (let pos = 0; pos < 4; pos++) if (pos !== p.answer[0]) out.push({ type: 'press', pos }); break;
    case 'glyphs': for (let pos = 1; pos <= 9; pos++) if (pos !== p.answer[0]) out.push({ type: 'press', pos }); break;
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

test('un fallo reinicia la secuencia en simón y jeroglíficos', () => {
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
      let s2 = r.state;
      for (const a of sol) s2 = validateModuleAction(m, s2, a).state;
      assert.equal(validateModuleAction(m, initModuleState(m), sol[0]).state.progress, 1);
    }
  }
});

// ---- Seguridad y reparto de información ----
const SECRET_KEYS = new Set(['answer', 'code', 'target', 'initial', 'cols', 'solution', 'seed']);
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
      case 'simon': assert.ok(!/sequence/.test(ex) && !/buttons/.test(ex)); assert.ok(!/tables/.test(it)); break;
      case 'circuit': assert.ok(!/"on"/.test(ex)); assert.ok(!/wiring/.test(it) && !/goal/.test(it)); break;
      case 'glyphs': assert.ok(!/layout|symbols|marks/.test(ex)); assert.ok(!/priorit|activation/.test(it)); break;
      case 'protocol': assert.ok(!/"color"/.test(ex)); assert.ok(!/formula/.test(it)); break;
    }
  }
});

// ---- Ningún jugador puede resolver solo: la respuesta cambia al variar lo que ese rol no ve ----
const rng = makeRng('mutations');
const answerOf = (type, p) => JSON.stringify(solveModule({ type, puzzle: p }));

const MUTATIONS = {
  // cada mutación cambia SOLO datos que el rol indicado no ve, recalculando la respuesta
  operator: {
    cables: (p) => { const c = p.cables.map((x) => ({ ...x, color: rng.pick(COLORS) })); const a = cables.solveRules(c, p.cuts, p.params); return a && { ...p, cables: c, answer: a }; },
    safe: (p) => { const g = p.grid.map((x) => ({ ...x, color: rng.pick(COLORS) })); return { ...p, grid: g, code: safe.computeCode(g, p.prm, p.digits) }; },
    simon: (p) => { const mk = () => { const t = rng.shuffle(COLORS); return Object.fromEntries(COLORS.map((c, i) => [c, t[i]])); }; const q = { ...p, tables: [mk(), mk()], buttons: rng.shuffle(COLORS) }; return { ...q, answer: simon.expectedPositions(q) }; },
    circuit: (p) => { const pc = p.pilotColors.map(() => rng.pick(COLORS)); const goal = rng.pick(pc); const target = circuit.targetMask(pc, goal, p.flip); return circuit.solveGF2(p.cols, p.m, p.initial ^ target) && { ...p, pilotColors: pc, goal, target }; },
    glyphs: (p) => { const marks = p.marks.map(() => rng.shuffle(COLORS).slice(0, rng.int(3))); const q = { ...p, marks, activation: rng.pick(COLORS) }; return { ...q, answer: glyphs.expectedOrder(q) }; },
    protocol: (p) => { const entries = p.entries.map((e) => ({ ...e, color: rng.pick(COLORS) })); return { ...p, entries, code: protocol.computeCode(entries, p.mods) }; },
  },
  expert: {
    cables: (p) => { const c = p.cables.map((x) => ({ ...x, color: rng.pick(COLORS) })); const a = cables.solveRules(c, p.cuts, p.params); return a && { ...p, cables: c, answer: a }; },
    safe: (p) => { const g = p.grid.map((_, i) => ({ idx: i, n: rng.int(10), color: rng.pick(COLORS) })); return { ...p, grid: g, code: safe.computeCode(g, p.prm, p.digits) }; },
    simon: (p) => { const q = { ...p, sequence: p.sequence.map(() => rng.int(4)), buttons: rng.shuffle(COLORS) }; return { ...q, answer: simon.expectedPositions(q) }; },
    circuit: (p) => { const initial = rng.int(1 << p.m); return circuit.solveGF2(p.cols, p.m, initial ^ p.target) && { ...p, initial }; },
    glyphs: (p) => { const q = { ...p, layout: rng.shuffle(glyphs.SYMBOLS), marks: p.marks.map((_, i) => p.marks[(i + 1) % p.marks.length]) }; return { ...q, answer: glyphs.expectedOrder(q) }; },
    protocol: (p) => { const entries = p.entries.map((e) => ({ ...e, id: rng.int(10), color: rng.pick(COLORS) })); return { ...p, entries, code: protocol.computeCode(entries, p.mods) }; },
  },
  interpreter: {
    simon: (p) => { const mk = () => { const t = rng.shuffle(COLORS); return Object.fromEntries(COLORS.map((c, i) => [c, t[i]])); }; const q = { ...p, tables: [mk(), mk()] }; return { ...q, answer: simon.expectedPositions(q) }; },
    circuit: (p) => { const cols = rng.shuffle(Array.from({ length: (1 << p.m) - 1 }, (_, i) => i + 1)).slice(0, p.k); return circuit.solveGF2(cols, p.m, p.initial ^ p.target) && { ...p, cols }; },
    glyphs: (p) => { const q = { ...p, priorities: [rng.shuffle(glyphs.SYMBOLS), rng.shuffle(glyphs.SYMBOLS)] }; return { ...q, answer: glyphs.expectedOrder(q) }; },
    safe: (p) => { const prm = { A: (p.prm.A + 1) % 4, B: (p.prm.B + 1) % 10, C: p.prm.C }; return { ...p, prm, code: safe.computeCode(p.grid, prm, p.digits) }; },
    cables: (p) => { const a = cables.solveRules(p.cables, p.cuts, p.params.map((v) => 1 - v)); return a && { ...p, answer: a }; },
    protocol: (p) => { const mods = p.mods.map((v) => (v + 3) % 10); return { ...p, mods, code: protocol.computeCode(p.entries, mods) }; },
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

test('el analista es imprescindible en 4 jugadores: CADA dato suyo cambia la respuesta (100 % de las bombas)', () => {
  for (const [d] of COMBOS.filter(([, s]) => s === 4)) for (const b of bombs(d, 4)) for (const m of b.modules) {
    const p = m.puzzle;
    switch (m.type) {
      case 'cables':
        p.params.forEach((v, i) => {
          const alt = cables.solveRules(p.cables, p.cuts, p.params.map((x, k) => (k === i ? 1 - x : x)));
          assert.ok(alt && alt[i] !== p.answer[i], `cables paso ${i + 1}`);
        });
        break;
      case 'safe':
        for (const k of safe.usedParams(p.digits)) {
          const prm = { ...p.prm, [k]: (p.prm[k] + 1) % (k === 'A' ? 4 : 10) };
          assert.notDeepEqual(safe.computeCode(p.grid, prm, p.digits), p.code, `safe ${k}`);
        }
        break;
      case 'simon': {
        const all = [0, 1].flatMap((t) => [false, true].map((r) => simon.expectedPositions({ ...p, table: t, reverse: r }).join()));
        assert.equal(new Set(all).size, 4);
        break;
      }
      case 'circuit':
        assert.notEqual(circuit.targetMask(p.pilotColors, p.goal, 0), p.target);
        for (let j = 0; j < p.m; j++) assert.notEqual(circuit.targetMask(p.pilotColors, p.goal, p.flip ^ (1 << j)), p.target);
        break;
      case 'glyphs': {
        const all = [0, 1].flatMap((l) => [false, true].map((r) => glyphs.expectedOrder({ ...p, list: l, reverse: r }).join()));
        assert.equal(new Set(all).size, 4);
        break;
      }
      case 'protocol':
        p.entries.forEach((e, i) => assert.notEqual(protocol.digit(e, p.mods[i] + 1), p.code[i]));
        break;
    }
  }
});

test('el analista tiene más trabajo: varios datos por módulo', () => {
  const count = (m, v) => {
    if (m === 'cables') return v.params.length;
    if (m === 'safe') return v.params.length;
    if (m === 'simon') return 2;
    if (m === 'circuit') return Math.max(1, v.flip.length);
    if (m === 'glyphs') return 2;
    return v.mods.length;
  };
  for (const b of bombs('hard', 4, 30)) for (const m of b.modules) {
    const v = projectModule(m, 'analyst', initModuleState(m));
    assert.ok(count(m.type, v) >= 2, `${m.type}: ${count(m.type, v)}`);
  }
});

test('en 3 contra 3 el analista no existe y los parámetros usan los valores fijos del manual', () => {
  for (const [d] of COMBOS.filter(([, s]) => s === 3)) for (const b of bombs(d, 3, 50)) for (const m of b.modules) {
    const p = m.puzzle;
    if (m.type === 'cables') assert.ok(p.params.every((v) => v === 0));
    if (m.type === 'safe') assert.deepEqual(p.prm, { A: 1, B: 0, C: 0 });
    if (m.type === 'simon') { assert.equal(p.reverse, false); assert.equal(p.table, 0); }
    if (m.type === 'glyphs') { assert.equal(p.reverse, false); assert.equal(p.list, 0); }
    if (m.type === 'circuit') assert.equal(p.flip, 0);
    if (m.type === 'protocol') assert.ok(p.mods.every((x) => x === 0));
  }
});

test('las bombas son más exigentes que antes en todos los niveles', () => {
  const hard = generateBomb('dif', 'hard', 3);
  const types = Object.fromEntries(hard.modules.map((m) => [m.type, m.puzzle]));
  assert.equal(types.cables.cables.length, 8);
  assert.equal(types.cables.answer.length, 4);
  assert.equal(types.safe.grid.length, 16);
  assert.equal(types.safe.code.length, 5);
  assert.equal(types.simon.sequence.length, 5);
  assert.equal(types.circuit.k, 6);
  assert.equal(types.glyphs.layout.length, 9);
  assert.equal(types.protocol.code.length, 5);
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
