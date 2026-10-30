// MINIJUEGO 6 · PROTOCOLO FINAL
import { makeRng } from '../rng.js';
import { COLORS, COLOR_INDEX, invalid, isInt, same } from './common.js';

export const type = 'protocol';
export const rating = 6;

export const computeCode = (entries, modifier) =>
  entries.map((e) => (e.id + COLOR_INDEX[e.color] + modifier) % 10);

// ctx.labels: nombres de los 4 módulos que intervienen, en orden de bomba.
export function generate(seed, difficulty, teamSize, ctx = {}) {
  const rng = makeRng(seed);
  const labels = ctx.labels || ['A', 'B', 'C', 'D'];
  const entries = labels.map((label) => ({ label, id: rng.int(10), color: rng.pick(COLORS) }));
  const modifier = teamSize === 4 ? 1 + rng.int(5) : 0;
  return { type, teamSize, entries, modifier, code: computeCode(entries, modifier) };
}

export const initState = () => ({ attempts: 0 });

export function projectForRole(p, role) {
  if (role === 'operator')
    return { kind: type, entries: p.entries.map((e) => ({ label: e.label, id: e.id })) };
  if (role === 'interpreter')
    return { kind: type, entries: p.entries.map((e) => ({ label: e.label, color: e.color })) };
  if (role === 'expert')
    return { kind: type, labels: p.entries.map((e) => e.label), analyst: p.teamSize === 4, fixedModifier: p.teamSize === 4 ? null : 0 };
  if (role === 'analyst') return { kind: type, modifier: p.modifier };
  return null;
}

export function validateAction(p, state, action) {
  if (!action || action.type !== 'code' || !Array.isArray(action.digits) || action.digits.length !== 4 ||
      !action.digits.every((d) => isInt(d, 0, 9))) return invalid(state);
  if (!same(action.digits, p.code)) return { outcome: 'wrong', state: { attempts: state.attempts + 1 }, solved: false };
  return { outcome: 'correct', state, solved: true };
}

export const solve = (p) => [{ type: 'code', digits: p.code.slice() }];
