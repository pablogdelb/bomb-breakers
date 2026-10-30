// MINIJUEGO 5 · JEROGLÍFICOS
import { makeRng } from '../rng.js';
import { COLORS, invalid, isInt } from './common.js';

export const type = 'glyphs';
export const rating = 4;
export const SYMBOLS = ['sol', 'luna', 'ancla', 'rombo', 'espiral', 'rayo'];
const TARGETS = { easy: 2, normal: 3, hard: 3 };

// Seleccionados: marcados con el color de activación y (difícil) sin el color de bloqueo.
export function selectedPositions(p) {
  return p.marks
    .map((m, i) => ({ pos: i + 1, m }))
    .filter(({ m }) => m.includes(p.activation) && !(p.block && m.includes(p.block)))
    .map(({ pos }) => pos);
}

export function expectedOrder(p) {
  const rank = (pos) => p.priority.indexOf(p.layout[pos - 1]);
  const sorted = selectedPositions(p).sort((a, b) => rank(a) - rank(b));
  return p.reverse ? sorted.reverse() : sorted;
}

export function generate(seed, difficulty, teamSize) {
  const rng = makeRng(seed);
  const hard = difficulty === 'hard';
  const n = TARGETS[difficulty];
  const layout = rng.shuffle(SYMBOLS);
  const activation = rng.pick(COLORS);
  const block = hard ? rng.pick(COLORS.filter((c) => c !== activation)) : null;
  const others = COLORS.filter((c) => c !== activation);
  const posOrder = rng.shuffle([1, 2, 3, 4, 5, 6]);
  const targets = posOrder.slice(0, n);
  const decoys = hard ? posOrder.slice(n, n + 1 + rng.int(2)) : [];
  const marks = Array.from({ length: 6 }, () => []);
  const randomExtra = (exclude) => {
    const pool = others.filter((c) => !exclude.includes(c));
    return rng.bool() ? [rng.pick(pool)] : [];
  };
  for (const pos of targets) marks[pos - 1] = [activation, ...randomExtra(block ? [block] : [])];
  for (const pos of decoys) marks[pos - 1] = [activation, block];
  for (const pos of posOrder.slice(n + decoys.length)) {
    const k = rng.int(3); // 0..2 marcas, nunca la de activación
    marks[pos - 1] = rng.shuffle(others).slice(0, k);
  }
  const priority = rng.shuffle(SYMBOLS);
  const reverse = teamSize === 4 ? rng.bool() : false;
  const p = { type, teamSize, layout, marks, activation, block, priority, reverse, n };
  p.answer = expectedOrder(p);
  return p;
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
    return { kind: type, activation: p.activation, block: p.block, priority: p.priority, analyst: p.teamSize === 4 };
  if (role === 'analyst') return { kind: type, reverse: p.reverse ? 1 : 0 };
  return null;
}

export function validateAction(p, state, action) {
  if (!action || action.type !== 'press' || !isInt(action.pos, 1, 6) || state.pressed.includes(action.pos))
    return invalid(state);
  if (p.answer[state.progress] !== action.pos)
    return { outcome: 'wrong', state: { progress: 0, pressed: [] }, solved: false };
  const pressed = [...state.pressed, action.pos];
  const solved = pressed.length === p.answer.length;
  return { outcome: solved ? 'correct' : 'progress', state: { progress: pressed.length, pressed }, solved };
}

export const solve = (p) => p.answer.map((pos) => ({ type: 'press', pos }));
