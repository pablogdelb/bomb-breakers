// MINIJUEGO 3 · SIMÓN CORROMPIDO
import { makeRng } from '../rng.js';
import { COLORS, invalid, isInt } from './common.js';

export const type = 'simon';
export const rating = 4;
const LENGTH = { easy: 2, normal: 3, hard: 4 };

// Posiciones de los botones: 0 arriba, 1 derecha, 2 abajo, 3 izquierda.
export function expectedPositions(p) {
  const observed = p.sequence.map((pos) => p.buttons[pos]);
  const ordered = p.reverse ? observed.slice().reverse() : observed;
  return ordered.map((c) => p.buttons.indexOf(p.map[c]));
}

export function generate(seed, difficulty, teamSize) {
  const rng = makeRng(seed);
  const len = LENGTH[difficulty];
  for (let attempt = 0; attempt < 10000; attempt++) {
    const buttons = rng.shuffle(COLORS);
    // biyección sin puntos fijos: el color mostrado nunca es el que hay que pulsar
    const target = rng.shuffle(COLORS);
    if (COLORS.some((c, i) => c === target[i])) continue;
    const map = Object.fromEntries(COLORS.map((c, i) => [c, target[i]]));
    const sequence = Array.from({ length: len }, () => rng.int(4));
    const reverse = teamSize === 4 ? rng.bool() : false;
    const p = { type, teamSize, buttons, map, sequence, reverse, len };
    const answer = expectedPositions(p);
    if (teamSize === 4) {
      const alt = expectedPositions({ ...p, reverse: !reverse });
      if (alt.join() === answer.join()) continue;
    }
    // la secuencia vista nunca coincide con la respuesta
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
  if (role === 'expert')
    return { kind: type, map: p.map, analyst: p.teamSize === 4 };
  if (role === 'analyst') return { kind: type, reverse: p.reverse ? 1 : 0 };
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
