// MINIJUEGO 6 · PROTOCOLO FINAL (una cifra por módulo; el analista da un modificador distinto para cada cifra)
import { makeRng } from '../rng.js';
import { COLORS, COLOR_INDEX, invalid, isInt, same } from './common.js';

export const type = 'protocol';
export const rating = 6;

// cifra = (identificador + índice de color × (2 si el identificador es par, 1 si es impar) + modificador) mod 10
export const digit = (e, mod) => (e.id + COLOR_INDEX[e.color] * (e.id % 2 === 0 ? 2 : 1) + mod) % 10;
export const computeCode = (entries, mods) => entries.map((e, i) => digit(e, mods[i]));

// ctx.labels: nombres de los módulos que intervienen, en orden de bomba.
export function generate(seed, difficulty, teamSize, ctx = {}) {
  const rng = makeRng(seed);
  const labels = ctx.labels || ['A', 'B', 'C', 'D'];
  const entries = labels.map((label) => ({ label, id: rng.int(10), color: rng.pick(COLORS) }));
  const mods = entries.map(() => (teamSize === 4 ? rng.int(10) : 0));
  return { type, teamSize, entries, mods, code: computeCode(entries, mods) };
}

export const initState = () => ({ attempts: 0 });

export function projectForRole(p, role) {
  if (role === 'operator')
    return { kind: type, entries: p.entries.map((e) => ({ label: e.label, id: e.id })) };
  if (role === 'interpreter')
    return { kind: type, entries: p.entries.map((e) => ({ label: e.label, color: e.color })) };
  if (role === 'expert')
    return { kind: type, labels: p.entries.map((e) => e.label), analyst: p.teamSize === 4 };
  if (role === 'analyst') return { kind: type, mods: p.mods, labels: p.entries.map((e) => e.label) };
  return null;
}

export function validateAction(p, state, action) {
  if (!action || action.type !== 'code' || !Array.isArray(action.digits) || action.digits.length !== p.entries.length ||
      !action.digits.every((d) => isInt(d, 0, 9))) return invalid(state);
  if (!same(action.digits, p.code)) return { outcome: 'wrong', state: { attempts: state.attempts + 1 }, solved: false };
  return { outcome: 'correct', state, solved: true };
}

export const solve = (p) => [{ type: 'code', digits: p.code.slice() }];
