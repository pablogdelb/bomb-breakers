// MINIJUEGO 1 · CABLES ENCADENADOS
import { makeRng } from '../rng.js';
import { COLORS, invalid, isInt } from './common.js';

export const type = 'cables';
export const rating = 3;
const CUTS = { easy: 1, normal: 2, hard: 3 };

// Reglas del manual. param=1 (solo con analista): primer rojo = posición menor y empates posteriores = posición mayor.
export function solveRules(cables, cuts, param) {
  const remaining = cables.slice();
  const order = [];
  let prev = null;
  for (let step = 0; step < cuts; step++) {
    let pick = null;
    if (step === 0) {
      const reds = remaining.filter((c) => c.color === 'red').map((c) => c.pos);
      if (reds.length) pick = param === 1 ? Math.min(...reds) : Math.max(...reds);
    } else if (step === 1) {
      const blues = remaining.filter((c) => c.color === 'blue').map((c) => c.pos);
      if (blues.length) {
        const dist = (p) => Math.abs(p - prev);
        const best = Math.min(...blues.map(dist));
        const tied = blues.filter((p) => dist(p) === best);
        pick = param === 1 ? Math.max(...tied) : Math.min(...tied);
      }
    } else {
      const greens = remaining.filter((c) => c.color === 'green').map((c) => c.pos);
      const yellows = remaining.filter((c) => c.color === 'yellow').map((c) => c.pos);
      const pool = greens.length ? greens : yellows;
      if (pool.length) pick = Math.min(...pool);
    }
    if (pick === null) return null;
    order.push(pick);
    prev = pick;
    remaining.splice(remaining.findIndex((c) => c.pos === pick), 1);
  }
  return order;
}

export function generate(seed, difficulty, teamSize) {
  const rng = makeRng(seed);
  const cuts = CUTS[difficulty];
  for (let attempt = 0; attempt < 10000; attempt++) {
    const cables = Array.from({ length: 6 }, (_, i) => ({ pos: i + 1, color: rng.pick(COLORS) }));
    const count = (c) => cables.filter((x) => x.color === c).length;
    if (count('red') < (teamSize === 4 ? 2 : 1)) continue;
    if (cuts >= 2 && count('blue') < 1) continue;
    if (cuts >= 3 && count('green') + count('yellow') < 1) continue;
    const param = teamSize === 4 ? rng.int(2) : 0;
    const answer = solveRules(cables, cuts, param);
    if (!answer) continue;
    // Con analista, el parámetro debe cambiar la respuesta: sin él no se puede resolver.
    if (teamSize === 4) {
      const other = solveRules(cables, cuts, 1 - param);
      if (!other || other.join() === answer.join()) continue;
    }
    return { type, cuts, teamSize, param, cables, answer };
  }
  throw new Error('cables: no se pudo generar');
}

export const initState = () => ({ cut: [] });

export function projectForRole(p, role, state) {
  if (role === 'operator')
    return { kind: type, cables: p.cables.map((c) => ({ pos: c.pos })), cut: state.cut };
  if (role === 'interpreter')
    return { kind: type, cables: p.cables.map((c) => ({ pos: c.pos, color: c.color })), cut: state.cut };
  if (role === 'expert') return { kind: type, steps: p.cuts, analyst: p.teamSize === 4 };
  if (role === 'analyst') return { kind: type, param: p.param };
  return null;
}

export function validateAction(p, state, action) {
  if (!action || action.type !== 'cut' || !isInt(action.pos, 1, 6) || state.cut.includes(action.pos))
    return invalid(state);
  if (p.answer[state.cut.length] !== action.pos) return { outcome: 'wrong', state, solved: false };
  const cut = [...state.cut, action.pos];
  const solved = cut.length === p.answer.length;
  return { outcome: solved ? 'correct' : 'progress', state: { cut }, solved };
}

export const solve = (p) => p.answer.map((pos) => ({ type: 'cut', pos }));
