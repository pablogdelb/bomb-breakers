// MINIJUEGO 3 · SIMÓN CORROMPIDO (3–5 destellos, dos tablas de transformación, el analista elige tabla e inversión)
import { makeRng } from '../rng.js';
import { COLORS, invalid, isInt } from './common.js';

export const type = 'simon';
export const rating = 4;
const LENGTH = { easy: 3, normal: 4, hard: 5 };

// Posiciones de los botones: 0 arriba, 1 derecha, 2 abajo, 3 izquierda.
export function expectedPositions(p) {
  const observed = p.sequence.map((pos) => p.buttons[pos]);
  const ordered = p.reverse ? observed.slice().reverse() : observed;
  return ordered.map((c) => p.buttons.indexOf(p.tables[p.table][c]));
}

const derangement = (rng) => {
  for (;;) {
    const t = rng.shuffle(COLORS);
    if (!COLORS.some((c, i) => c === t[i])) return Object.fromEntries(COLORS.map((c, i) => [c, t[i]]));
  }
};

export function generate(seed, difficulty, teamSize) {
  const rng = makeRng(seed);
  const len = LENGTH[difficulty];
  for (let attempt = 0; attempt < 20000; attempt++) {
    const buttons = rng.shuffle(COLORS);
    const A = derangement(rng);
    const B = derangement(rng);
    if (COLORS.some((c) => A[c] === B[c])) continue; // las dos tablas difieren en todos los colores
    const sequence = Array.from({ length: len }, () => rng.int(4));
    const table = teamSize === 4 ? rng.int(2) : 0;
    const reverse = teamSize === 4 ? rng.bool() : false;
    const p = { type, teamSize, buttons, tables: [A, B], sequence, table, reverse, len };
    const answer = expectedPositions(p);
    if (teamSize === 4) {
      // las 4 combinaciones (tabla × inversión) dan respuestas distintas: ambos datos del analista importan
      const combos = [0, 1].flatMap((t) => [false, true].map((r) => expectedPositions({ ...p, table: t, reverse: r }).join()));
      if (new Set(combos).size !== 4) continue;
    }
    if (answer.join() === sequence.join()) continue;
    p.answer = answer;
    return p;
  }
  throw new Error('simon: no se pudo generar');
}

export const initState = () => ({ progress: 0, replay: 0 });

export function projectForRole(p, role, state) {
  if (role === 'operator')
    return { kind: type, sequence: p.sequence, progress: state.progress, replay: state.replay };
  if (role === 'interpreter')
    return { kind: type, buttons: p.buttons, sequence: p.sequence, progress: state.progress, replay: state.replay };
  if (role === 'expert') return { kind: type, tables: p.tables, analyst: p.teamSize === 4 };
  if (role === 'analyst') return { kind: type, table: p.table ? 'B' : 'A', reverse: p.reverse ? 1 : 0 };
  return null;
}

export function validateAction(p, state, action) {
  if (!action) return invalid(state);
  if (action.type === 'replay') return { outcome: 'info', state: { ...state, replay: state.replay + 1 }, solved: false };
  if (action.type !== 'press' || !isInt(action.pos, 0, 3)) return invalid(state);
  if (p.answer[state.progress] !== action.pos)
    return { outcome: 'wrong', state: { ...state, progress: 0 }, solved: false };
  const progress = state.progress + 1;
  const solved = progress === p.answer.length;
  return { outcome: solved ? 'correct' : 'progress', state: { ...state, progress }, solved };
}

export const solve = (p) => p.answer.map((pos) => ({ type: 'press', pos }));
