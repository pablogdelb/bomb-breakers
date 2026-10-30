export const COLORS = ['red', 'blue', 'green', 'yellow'];
export const COLOR_INDEX = { red: 1, blue: 2, green: 3, yellow: 4 };
export const ROLES = ['operator', 'expert', 'interpreter', 'analyst'];
export const ROLES_BY_SIZE = {
  3: ['operator', 'expert', 'interpreter'],
  4: ['operator', 'expert', 'interpreter', 'analyst'],
};

export const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
export const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

// Resultados de validateAction:
//  invalid  -> acción mal formada o imposible (no cuenta como error)
//  info     -> acción válida que no avanza ni falla (p. ej. repetir secuencia)
//  progress -> paso correcto, módulo aún no resuelto
//  correct  -> módulo resuelto
//  wrong    -> equivocación (suma un error)
export const invalid = (state) => ({ outcome: 'invalid', state, solved: false });
