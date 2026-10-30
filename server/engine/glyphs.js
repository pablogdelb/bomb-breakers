// MINIJUEGO 5 · JEROGLÍFICOS (9 símbolos, 3–5 seleccionados, dos listas de prioridad; el analista elige lista e inversión)
import { makeRng } from '../rng.js';
import { COLORS, invalid, isInt } from './common.js';

export const type = 'glyphs';
export const rating = 4;
export const SYMBOLS = ['sol', 'luna', 'ancla', 'rombo', 'espiral', 'rayo', 'estrella', 'gota', 'cruz'];
export const N_SYMBOLS = SYMBOLS.length;
const TARGETS = { easy: 3, normal: 4, hard: 5 };

// Seleccionados: marcados con el color de activación y (difícil) sin el color de bloqueo.
export function selectedPositions(p) {
  return p.marks
    .map((m, i) => ({ pos: i + 1, m }))
    .filter(({ m }) => m.includes(p.activation) && !(p.block && m.includes(p.block)))
    .map(({ pos }) => pos);
}

export function expectedOrder(p) {
  const prio = p.priorities[p.list];
  const rank = (pos) => prio.indexOf(p.layout[pos - 1]);
  const sorted = selectedPositions(p).sort((a, b) => rank(a) - rank(b));
  return p.reverse ? sorted.reverse() : sorted;
}

export function generate(seed, difficulty, teamSize) {
  const rng = makeRng(seed);
  const hard = difficulty === 'hard';
  const n = TARGETS[difficulty];
  for (let attempt = 0; attempt < 5000; attempt++) {
    const layout = rng.shuffle(SYMBOLS);
    const activation = rng.pick(COLORS);
    const block = hard ? rng.pick(COLORS.filter((c) => c !== activation)) : null;
    const others = COLORS.filter((c) => c !== activation);
    const posOrder = rng.shuffle(Array.from({ length: N_SYMBOLS }, (_, i) => i + 1));
    const targets = posOrder.slice(0, n);
    const decoys = hard ? posOrder.slice(n, n + 2 + rng.int(2)) : [];
    const marks = Array.from({ length: N_SYMBOLS }, () => []);
    const extra = (exclude) => {
      const pool = others.filter((c) => !exclude.includes(c));
      return rng.bool() ? [rng.pick(pool)] : [];
    };
    for (const pos of targets) marks[pos - 1] = [activation, ...extra(block ? [block] : [])];
    for (const pos of decoys) marks[pos - 1] = [activation, block];
    for (const pos of posOrder.slice(n + decoys.length)) marks[pos - 1] = rng.shuffle(others).slice(0, rng.int(3));
    const priorities = [rng.shuffle(SYMBOLS), rng.shuffle(SYMBOLS)];
    const list = teamSize === 4 ? rng.int(2) : 0;
    const reverse = teamSize === 4 ? rng.bool() : false;
    const p = { type, teamSize, layout, marks, activation, block, priorities, list, reverse, n };
    if (teamSize === 4) {
      // las 4 combinaciones (lista × inversión) dan órdenes distintos: ambos datos del analista importan
      const combos = [0, 1].flatMap((l) => [false, true].map((r) => expectedOrder({ ...p, list: l, reverse: r }).join()));
      if (new Set(combos).size !== 4) continue;
    }
    p.answer = expectedOrder(p);
    return p;
  }
  throw new Error('glyphs: no se pudo generar');
}

export const initState = () => ({ progress: 0, pressed: [] });

export function projectForRole(p, role, state) {
  if (role === 'operator')
    return { kind: type, symbols: p.layout.map((symbol, i) => ({ pos: i + 1, symbol })), pressed: state.pressed };
  if (role === 'interpreter')
    return {
      kind: type, pressed: state.pressed,
      symbols: p.layout.map((symbol, i) => ({ pos: i + 1, symbol, marks: p.marks[i] })),
    };
  if (role === 'expert')
    return { kind: type, activation: p.activation, block: p.block, priorities: p.priorities, analyst: p.teamSize === 4 };
  if (role === 'analyst') return { kind: type, list: p.list ? 'B' : 'A', reverse: p.reverse ? 1 : 0 };
  return null;
}

export function validateAction(p, state, action) {
  if (!action || action.type !== 'press' || !isInt(action.pos, 1, N_SYMBOLS) || state.pressed.includes(action.pos))
    return invalid(state);
  if (p.answer[state.progress] !== action.pos)
    return { outcome: 'wrong', state: { progress: 0, pressed: [] }, solved: false };
  const pressed = [...state.pressed, action.pos];
  const solved = pressed.length === p.answer.length;
  return { outcome: solved ? 'correct' : 'progress', state: { progress: pressed.length, pressed }, solved };
}

export const solve = (p) => p.answer.map((pos) => ({ type: 'press', pos }));
