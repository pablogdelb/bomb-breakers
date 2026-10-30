// MINIJUEGO 2 · CAJA FUERTE (cuadrícula 4×4, 3–5 cifras, hasta 3 parámetros del analista)
import { makeRng } from '../rng.js';
import { COLORS, invalid, isInt, same } from './common.js';

export const type = 'safe';
export const rating = 4;
const DIGITS = { easy: 3, normal: 4, hard: 5 };
export const FIXED = { A: 1, B: 0, C: 0 }; // valores sin analista (3 contra 3)

/**
 * 1ª: suma de casillas ROJAS (unidades).
 * 2ª: nº de casillas AZULES + A.
 * 3ª: número de la última casilla VERDE en orden de lectura (0 si no hay) + B.
 * 4ª: suma de las tres anteriores.
 * 5ª: 3 × nº de casillas AMARILLAS + C.   (todo mod 10)
 */
export function computeCode(grid, prm, digits) {
  const sum = (c) => grid.filter((g) => g.color === c).reduce((s, g) => s + g.n, 0);
  const count = (c) => grid.filter((g) => g.color === c).length;
  const greens = grid.filter((g) => g.color === 'green');
  const d1 = sum('red') % 10;
  const d2 = (count('blue') + prm.A) % 10;
  const d3 = ((greens.length ? greens[greens.length - 1].n : 0) + prm.B) % 10;
  const d4 = (d1 + d2 + d3) % 10;
  const d5 = (3 * count('yellow') + prm.C) % 10;
  return [d1, d2, d3, d4, d5].slice(0, digits);
}

// Parámetros que el analista necesita comunicar según nº de cifras
export const usedParams = (digits) => ['A', 'B', 'C'].slice(0, digits >= 5 ? 3 : 2);

export function generate(seed, difficulty, teamSize) {
  const rng = makeRng(seed);
  const digits = DIGITS[difficulty];
  for (let attempt = 0; attempt < 10000; attempt++) {
    const grid = Array.from({ length: 16 }, (_, i) => ({ idx: i, n: rng.int(10), color: rng.pick(COLORS) }));
    const count = (c) => grid.filter((g) => g.color === c).length;
    if (count('red') < 2 || count('blue') < 1 || count('green') < 1) continue;
    if (digits >= 5 && count('yellow') < 1) continue;
    const prm = teamSize === 4 ? { A: rng.int(4), B: rng.int(10), C: rng.int(10) } : { ...FIXED };
    return { type, digits, teamSize, prm, grid, code: computeCode(grid, prm, digits) };
  }
  throw new Error('safe: no se pudo generar');
}

export const initState = () => ({ attempts: 0 });

export function projectForRole(p, role) {
  if (role === 'operator') return { kind: type, digits: p.digits, grid: p.grid.map((g) => ({ idx: g.idx, n: g.n })) };
  if (role === 'interpreter')
    return { kind: type, grid: p.grid.map((g) => ({ idx: g.idx, n: g.n, color: g.color })) };
  if (role === 'expert') return { kind: type, digits: p.digits, analyst: p.teamSize === 4, fixed: p.teamSize === 4 ? null : FIXED };
  if (role === 'analyst') return { kind: type, params: usedParams(p.digits).map((k) => ({ key: k, value: p.prm[k] })) };
  return null;
}

export function validateAction(p, state, action) {
  if (!action || action.type !== 'code' || !Array.isArray(action.digits) || action.digits.length !== p.digits ||
      !action.digits.every((d) => isInt(d, 0, 9))) return invalid(state);
  if (!same(action.digits, p.code)) return { outcome: 'wrong', state: { attempts: state.attempts + 1 }, solved: false };
  return { outcome: 'correct', state, solved: true };
}

export const solve = (p) => [{ type: 'code', digits: p.code.slice() }];
