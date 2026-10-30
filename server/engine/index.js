import * as cables from './cables.js';
import * as safe from './safe.js';
import * as simon from './simon.js';
import * as circuit from './circuit.js';
import * as glyphs from './glyphs.js';
import * as protocol from './protocol.js';
import { makeRng } from '../rng.js';

export const MODULES = { cables, safe, simon, circuit, glyphs, protocol };
export const MODULE_NAMES = {
  cables: 'CABLES ENCADENADOS', safe: 'CAJA FUERTE', simon: 'SIMÓN CORROMPIDO',
  circuit: 'CIRCUITO DE EMERGENCIA', glyphs: 'JEROGLÍFICOS', protocol: 'PROTOCOLO FINAL',
};

// Parámetros de dificultad (los tiempos se pueden escalar con la variable TIME_SCALE para pruebas de jugabilidad)
export const DIFFICULTIES = {
  easy: { minutes: 12, modules: 3, protocol: false, maxErrors: 4, penaltyAt: 3 },
  normal: { minutes: 10, modules: 4, protocol: true, maxErrors: 3, penaltyAt: 2 },
  hard: { minutes: 8, modules: 5, protocol: true, maxErrors: 3, penaltyAt: 2 },
};
export const PENALTY_MS = 20000;
const BASIC = ['cables', 'safe', 'simon', 'circuit', 'glyphs'];

/** Genera la bomba completa a partir de la semilla. Ambos equipos reciben exactamente esta bomba. */
export function generateBomb(seed, difficulty, teamSize) {
  const cfg = DIFFICULTIES[difficulty];
  if (!cfg || (teamSize !== 3 && teamSize !== 4)) throw new Error('configuración inválida');
  const rng = makeRng(`${seed}|bomb`);
  // dificultad progresiva: ordenados por valoración, con desempate aleatorio
  const types = rng
    .shuffle(BASIC)
    .slice(0, cfg.modules)
    .map((t) => ({ t, k: MODULES[t].rating + rng.next() * 0.5 }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.t);
  const modules = types.map((t, i) => ({ type: t, puzzle: MODULES[t].generate(`${seed}|${i}|${t}`, difficulty, teamSize) }));
  if (cfg.protocol) {
    const last4 = types.slice(-4).map((t, i, arr) => `MÓDULO ${types.length - arr.length + i + 1} · ${MODULE_NAMES[t]}`);
    modules.push({
      type: 'protocol',
      puzzle: protocol.generate(`${seed}|protocol`, difficulty, teamSize, { labels: last4 }),
    });
  }
  return { seed, difficulty, teamSize, modules };
}

export const initModuleState = (m) => MODULES[m.type].initState(m.puzzle);
export const projectModule = (m, role, state) =>
  role === 'analyst' && m.puzzle.teamSize !== 4 ? null : MODULES[m.type].projectForRole(m.puzzle, role, state);
export const validateModuleAction = (m, state, action) => MODULES[m.type].validateAction(m.puzzle, state, action);
export const solveModule = (m) => MODULES[m.type].solve(m.puzzle);
