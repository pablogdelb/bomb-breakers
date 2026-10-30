// MINIJUEGO 1 · CABLES ENCADENADOS (8 cables; hasta 4 cortes; un parámetro del analista por corte)
import { makeRng } from '../rng.js';
import { COLORS, invalid, isInt } from './common.js';

export const type = 'cables';
export const rating = 3;
export const N_CABLES = 8;
const CUTS = { easy: 2, normal: 3, hard: 4 };
const dist = (a, b) => Math.abs(a - b);

/**
 * Reglas del manual. params[i] = 0/1 (sin analista, siempre 0).
 *  1. ROJO: mayor posición (p=1: menor).
 *  2. AZUL: el más cercano al último cortado (p=1: el más lejano). Empate: menor posición.
 *  3. VERDE de menor posición; si no hay verdes, AMARILLO de menor posición (p=1: la mayor).
 *  4. Entre VERDES y AMARILLOS restantes: el más lejano al último cortado (p=1: el más cercano). Empate: menor posición.
 */
export function solveRules(cables, cuts, params) {
  const remaining = cables.slice();
  const order = [];
  let prev = null;
  for (let step = 0; step < cuts; step++) {
    const p = params[step] === 1;
    const of = (...cs) => remaining.filter((c) => cs.includes(c.color)).map((c) => c.pos);
    let pick = null;
    if (step === 0) {
      const r = of('red');
      if (r.length) pick = p ? Math.min(...r) : Math.max(...r);
    } else if (step === 1) {
      const b = of('blue');
      if (b.length) {
        const d = b.map((x) => dist(x, prev));
        const t = p ? Math.max(...d) : Math.min(...d);
        pick = Math.min(...b.filter((x) => dist(x, prev) === t));
      }
    } else if (step === 2) {
      const g = of('green');
      const pool = g.length ? g : of('yellow');
      if (pool.length) pick = p ? Math.max(...pool) : Math.min(...pool);
    } else {
      const pool = of('green', 'yellow');
      if (pool.length) {
        const d = pool.map((x) => dist(x, prev));
        const t = p ? Math.min(...d) : Math.max(...d);
        pick = Math.min(...pool.filter((x) => dist(x, prev) === t));
      }
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
  for (let attempt = 0; attempt < 50000; attempt++) {
    const cables = Array.from({ length: N_CABLES }, (_, i) => ({ pos: i + 1, color: rng.pick(COLORS) }));
    const params = Array.from({ length: cuts }, () => (teamSize === 4 ? rng.int(2) : 0));
    const answer = solveRules(cables, cuts, params);
    if (!answer) continue;
    // Con analista, CADA parámetro debe cambiar el corte correspondiente: ninguno es decorativo.
    if (teamSize === 4) {
      let ok = true;
      for (let i = 0; i < cuts && ok; i++) {
        const alt = solveRules(cables, cuts, params.map((v, k) => (k === i ? 1 - v : v)));
        if (!alt || alt[i] === answer[i]) ok = false;
      }
      if (!ok) continue;
    }
    return { type, cuts, teamSize, params, cables, answer };
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
  if (role === 'analyst') return { kind: type, params: p.params, step: state.cut.length };
  return null;
}

export function validateAction(p, state, action) {
  if (!action || action.type !== 'cut' || !isInt(action.pos, 1, N_CABLES) || state.cut.includes(action.pos))
    return invalid(state);
  if (p.answer[state.cut.length] !== action.pos) return { outcome: 'wrong', state, solved: false };
  const cut = [...state.cut, action.pos];
  const solved = cut.length === p.answer.length;
  return { outcome: solved ? 'correct' : 'progress', state: { cut }, solved };
}

export const solve = (p) => p.answer.map((pos) => ({ type: 'cut', pos }));
