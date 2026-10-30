// MINIJUEGO 4 · CIRCUITO DE EMERGENCIA  (sistema lineal sobre GF(2))
import { makeRng } from '../rng.js';
import { COLORS, invalid } from './common.js';

export const type = 'circuit';
export const rating = 5;
const SIZE = { easy: [3, 2], normal: [4, 3], hard: [5, 4] }; // [interruptores, pilotos]

// cols[i] = máscara de pilotos que alterna el interruptor i. Resuelve A·x = b (XOR) con Gauss-Jordan.
export function solveGF2(cols, m, b) {
  const k = cols.length;
  const rows = [];
  for (let j = 0; j < m; j++) {
    let r = 0;
    for (let i = 0; i < k; i++) if ((cols[i] >> j) & 1) r |= 1 << i;
    rows.push({ r, rhs: (b >> j) & 1 });
  }
  const pivots = [];
  let row = 0;
  for (let col = 0; col < k && row < m; col++) {
    let p = row;
    while (p < m && !((rows[p].r >> col) & 1)) p++;
    if (p === m) continue;
    [rows[row], rows[p]] = [rows[p], rows[row]];
    for (let q = 0; q < m; q++)
      if (q !== row && ((rows[q].r >> col) & 1)) {
        rows[q].r ^= rows[row].r;
        rows[q].rhs ^= rows[row].rhs;
      }
    pivots.push(col);
    row++;
  }
  for (let q = row; q < m; q++) if (rows[q].r === 0 && rows[q].rhs === 1) return null;
  const x = Array(k).fill(false);
  pivots.forEach((col, i) => (x[col] = rows[i].rhs === 1));
  return x;
}

export const applySwitches = (cols, sel) => sel.reduce((acc, on, i) => (on ? acc ^ cols[i] : acc), 0);

export function targetMask(pilotColors, goal, invert) {
  let t = 0;
  pilotColors.forEach((c, j) => {
    if ((c === goal) !== !!invert) t |= 1 << j;
  });
  return t;
}

export function generate(seed, difficulty, teamSize) {
  const rng = makeRng(seed);
  const [k, m] = SIZE[difficulty];
  for (let attempt = 0; attempt < 10000; attempt++) {
    const all = rng.shuffle(Array.from({ length: (1 << m) - 1 }, (_, i) => i + 1));
    const cols = all.slice(0, k); // distintas y no nulas
    if (cols.reduce((a, c) => a | c, 0) !== (1 << m) - 1) continue; // todos los pilotos se pueden tocar
    const pilotColors = Array.from({ length: m }, () => rng.pick(COLORS));
    const goal = rng.pick(pilotColors);
    if (pilotColors.every((c) => c === goal)) continue;
    const invert = teamSize === 4 ? rng.bool() : false;
    const target = targetMask(pilotColors, goal, invert);
    const hidden = Array.from({ length: k }, () => rng.bool());
    const delta = applySwitches(cols, hidden);
    if (delta === 0) continue; // el estado inicial debe diferir del objetivo
    const initial = target ^ delta;
    if (teamSize === 4 && targetMask(pilotColors, goal, !invert) === target) continue;
    return { type, teamSize, k, m, cols, pilotColors, goal, invert, target, initial };
  }
  throw new Error('circuit: no se pudo generar');
}

export const initState = () => ({ attempts: 0 });

const bits = (mask, m) => Array.from({ length: m }, (_, j) => ((mask >> j) & 1) === 1);

export function projectForRole(p, role) {
  if (role === 'operator')
    return { kind: type, switches: p.k, pilots: bits(p.initial, p.m).map((on, i) => ({ idx: i + 1, on })) };
  if (role === 'interpreter')
    return { kind: type, pilots: bits(p.initial, p.m).map((on, i) => ({ idx: i + 1, on, color: p.pilotColors[i] })) };
  if (role === 'expert')
    return {
      kind: type, goal: p.goal, analyst: p.teamSize === 4, pilots: p.m,
      wiring: p.cols.map((c, i) => ({ sw: i + 1, toggles: bits(c, p.m).map((b, j) => (b ? j + 1 : 0)).filter(Boolean) })),
    };
  if (role === 'analyst') return { kind: type, invert: p.invert ? 1 : 0 };
  return null;
}

export function validateAction(p, state, action) {
  if (!action || action.type !== 'apply' || !Array.isArray(action.switches) || action.switches.length !== p.k ||
      !action.switches.every((v) => typeof v === 'boolean')) return invalid(state);
  const final = p.initial ^ applySwitches(p.cols, action.switches);
  if (final === p.target) return { outcome: 'correct', state, solved: true };
  return { outcome: 'wrong', state: { attempts: state.attempts + 1 }, solved: false };
}

export const solve = (p) => [{ type: 'apply', switches: solveGF2(p.cols, p.m, p.initial ^ p.target) }];
