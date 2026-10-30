// MINIJUEGO 2 · CAJA FUERTE
import { makeRng } from '../rng.js';
import { COLORS, invalid, isInt, same } from './common.js';

export const type = 'safe';
export const rating = 4;
const DIGITS = { easy: 2, normal: 3, hard: 4 };

export function computeCode(grid, param, digits) {
  const sum = (c) => grid.filter((g) => g.color === c).reduce((s, g) => s + g.n, 0);
  const d1 = sum('red') % 10;
  const d2 = (grid.filter((g) => g.color === 'blue').length + param) % 10;
  const greens = grid.filter((g) => g.color === 'green');
  const d3 = greens.length ? greens[greens.length - 1].n : 0; // última verde en orden de lectura
  const d4 = (d1 + d2 + d3) % 10;
  return [d1, d2, d3, d4].slice(0, digits);
}

export function generate(seed, difficulty, teamSize) {
  const rng = makeRng(seed);
  const digits = DIGITS[difficulty];
  for (let attempt = 0; attempt < 10000; attempt++) {
    const grid = Array.from({ length: 9 }, (_, i) => ({ idx: i, n: rng.int(10), color: rng.pick(COLORS) }));
    const count = (c) => grid.filter((g) => g.color === c).length;
    if (count('red') < 1 || count('blue') < 1) continue;
    if (digits >= 3 && count('green') < 1) continue;
    const param = teamSize === 4 ? rng.int(4) : 1;
    return { type, digits, teamSize, param, grid, code: computeCode(grid, param, digits) };
  }
  throw new Error('safe: no se pudo generar');
}

export const initState = () => ({ attempts: 0 });

export function projectForRole(p, role) {
  if (role === 'operator') return { kind: type, digits: p.digits, grid: p.grid.map((g) => ({ idx: g.idx, n: g.n })) };
  if (role === 'interpreter')
    return { kind: type, grid: p.grid.map((g) => ({ idx: g.idx, n: g.n, color: g.color })) };
  if (role === 'expert') return { kind: type, digits: p.digits, analyst: p.teamSize === 4, fixedParam: p.teamSize === 4 ? null : 1 };
  if (role === 'analyst') return { kind: type, param: p.param };
  return null;
}

export function validateAction(p, state, action) {
  if (!action || action.type !== 'code' || !Array.isArray(action.digits) || action.digits.length !== p.digits ||
      !action.digits.every((d) => isInt(d, 0, 9))) return invalid(state);
  if (!same(action.digits, p.code)) return { outcome: 'wrong', state: { attempts: state.attempts + 1 }, solved: false };
  return { outcome: 'correct', state, solved: true };
}

export const solve = (p) => [{ type: 'code', digits: p.code.slice() }];
