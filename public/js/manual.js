// Pantalla del EXPERTO (manual técnico) y del ANALISTA (ficha técnica) + guía de roles y gestos.
import { h } from './dom.js';
import { COLOR_ABBR, COLOR_NAMES, symbol, SYM_NAMES } from './art.js';

export const MODULE_TITLES = {
  cables: 'CABLES ENCADENADOS', safe: 'CAJA FUERTE', simon: 'SIMÓN CORROMPIDO',
  circuit: 'CIRCUITO DE EMERGENCIA', glyphs: 'JEROGLÍFICOS', protocol: 'PROTOCOLO FINAL',
};
export const MODULE_SHORT = { cables: 'CABLES', safe: 'CAJA', simon: 'SIMÓN', circuit: 'CIRCUITO', glyphs: 'GLIFOS', protocol: 'PROTOCOLO' };

const sw = (c, name = true) => h('span', null, h('span', { class: `swatch ${c}` }, COLOR_ABBR[c]), name ? ` ${COLOR_NAMES[c]}` : '');
const B = (t) => h('b', null, t);

function cablesPage(v) {
  const steps = [
    h('li', null, 'Corta el cable ', sw('red'), ' de ', B('MAYOR posición'), ' (el número más alto).'),
    h('li', null, 'Entre los cables ', sw('blue'), ', corta el que esté ', B('más cerca en posición'), ' del cable cortado justo antes. Si hay empate, el de ', B('menor posición'), '.'),
    h('li', null, 'Entre los cables ', sw('green'), ' que queden, corta el de ', B('menor posición'), '. Si no queda ninguno ', sw('green', false), ', corta el ', sw('yellow'), ' de menor posición.'),
  ].slice(0, v.steps);
  return [
    h('p', null, `Esta bomba exige ${v.steps} ${v.steps === 1 ? 'corte' : 'cortes'}, ` , B('en este orden'), '. Las posiciones son los números 1–6 de los cables.'),
    h('ol', null, steps),
    h('h4', null, 'PARÁMETRO'),
    v.analyst
      ? h('div', null, h('p', null, 'Pregunta al ', B('ANALISTA'), ' su parámetro (0 ó 1):'),
        h('ul', null, h('li', null, B('0'), ' → reglas normales (arriba).'),
          h('li', null, B('1'), ' → el primer cable ', sw('red'), ' es el de ', B('MENOR'), ' posición, y los empates posteriores se resuelven con la posición ', B('MAYOR'), '.')))
      : h('p', null, 'Sin analista el parámetro vale siempre ', B('0'), ' (reglas normales).'),
    h('div', { class: 'note' }, 'Un corte equivocado suma un error y el cable no se pierde. Tú no ves la bomba: necesitas los colores (intérprete) y que el operador ejecute.'),
  ];
}

function safePage(v) {
  const rows = [
    ['1ª', h('span', null, 'Suma de los números de las casillas ', sw('red'), '. Quédate con la ', B('cifra de las unidades'), '.')],
    ['2ª', h('span', null, 'Número de casillas ', sw('blue'), ' + ', B('PARÁMETRO'), '. Cifra de las unidades.')],
    ['3ª', h('span', null, 'Número de la casilla ', sw('green'), ' que quede ', B('más abajo y a la derecha'), ' (orden de lectura: izquierda→derecha, arriba→abajo). Si no hay ninguna verde: ', B('0'), '.')],
    ['4ª', h('span', null, 'Suma de las tres cifras anteriores. Cifra de las unidades.')],
  ].slice(0, v.digits);
  return [
    h('p', null, `Combinación de ${v.digits} cifras. Las casillas amarillas no cuentan.`),
    h('table', null, h('tr', null, h('th', null, 'CIFRA'), h('th', null, 'REGLA')), rows.map(([a, b]) => h('tr', null, h('td', null, a), h('td', { style: { textAlign: 'left' } }, b)))),
    h('h4', null, 'PARÁMETRO'),
    v.analyst ? h('p', null, 'Lo conoce el ', B('ANALISTA'), ' (número de 0 a 3).') : h('p', null, 'Sin analista el parámetro vale siempre ', B('1'), '.'),
    h('div', { class: 'note' }, 'El operador ve los números; el intérprete, los números y colores. Tú calculas. Indica el código con los dedos.'),
  ];
}

function simonPage(v) {
  const order = ['red', 'blue', 'green', 'yellow'];
  return [
    h('p', null, 'Los destellos ', B('NO'), ' se repiten tal cual: cada color visto se sustituye por otro según esta tabla.'),
    h('table', null, h('tr', null, h('th', null, 'SI SE ENCIENDE'), h('th', null, ''), h('th', null, 'PULSA')),
      order.map((c) => h('tr', null, h('td', null, sw(c)), h('td', null, '→'), h('td', null, sw(v.map[c]))))),
    h('h4', null, 'ORDEN'),
    v.analyst
      ? h('p', null, 'Pregunta al ', B('ANALISTA'), ': si dice ', B('INVERTIR = 1'), ', primero ', B('invierte el orden'), ' de la secuencia vista y después transforma los colores. Si dice 0, mantén el orden.')
      : h('p', null, 'Sin analista, la secuencia ', B('nunca'), ' se invierte.'),
    h('div', { class: 'note' }, 'Ejemplo: se encienden Rojo → Verde con la tabla Rojo→Azul, Verde→Rojo: hay que pulsar Azul → Rojo. El intérprete traduce colores a posiciones (arriba, derecha, abajo, izquierda) para el operador. Si el operador se equivoca, la secuencia se reinicia.'),
  ];
}

function circuitPage(v) {
  return [
    h('p', null, `Hay ${v.wiring.length} interruptores y ${v.pilots} pilotos. Cada interruptor ALTERNA (enciende↔apaga) estos pilotos:`),
    h('table', null, h('tr', null, h('th', null, 'INTERRUPTOR'), h('th', null, 'ALTERNA PILOTOS')),
      v.wiring.map((w) => h('tr', null, h('td', null, B(w.sw)), h('td', null, w.toggles.map((t) => `P${t}`).join(' · '))))),
    h('h4', null, 'OBJETIVO'),
    h('p', null, 'Los pilotos de color ', sw(v.goal), ' deben quedar ', B('ENCENDIDOS'), ' y todos los demás ', B('APAGADOS'), '.'),
    v.analyst ? h('p', null, 'Si el ', B('ANALISTA'), ' dice ', B('INVERTIR = 1'), ': al revés (los de ese color APAGADOS, el resto ENCENDIDOS).') : h('p', null, 'Sin analista no hay inversión.'),
    h('h4', null, 'MÉTODO'),
    h('p', null, 'Conoces el esquema. Necesitas el estado actual (apagado/encendido: lo ve el operador) y los colores (intérprete). Pulsar un interruptor dos veces lo anula: cada uno se usa 0 ó 1 vez. Indica al intérprete qué interruptores activar.'),
  ];
}

function glyphsPage(v) {
  return [
    h('p', null, 'Debe pulsarse cada símbolo que tenga la marca de color ', sw(v.activation),
      v.block ? [' y que ', B('NO'), ' tenga también la marca ', sw(v.block), '.'] : '.'),
    h('h4', null, 'ORDEN DE PRIORIDAD (de primero a último)'),
    h('div', { class: 'prio' }, v.priority.flatMap((sy, i) => [
      i ? h('span', { class: 'arrow' }, '→') : null,
      h('span', { style: { textAlign: 'center', fontSize: '10px' } }, h('span', { class: 'sym' }, symbol(sy, '#1c1a14')), h('br'), SYM_NAMES[sy]),
    ])),
    v.analyst
      ? h('p', null, 'Pregunta al ', B('ANALISTA'), ': si dice ', B('INVERTIR = 1'), ', pulsa los símbolos en el orden contrario.')
      : h('p', null, 'Sin analista el orden nunca se invierte.'),
    h('div', { class: 'note' }, 'El intérprete ve qué símbolo está en cada posición y sus marcas. Un símbolo equivocado reinicia la secuencia y suma un error.'),
  ];
}

function protocolPage(v) {
  return [
    h('p', null, 'Último paso. Construye un código de ', B('4 cifras'), ' (una por cada sello de la lista, en ese orden):'),
    h('div', { class: 'formula' }, 'cifra = (IDENTIFICADOR + ÍNDICE DE COLOR + MODIFICADOR) mod 10'),
    h('table', null, h('tr', null, ['red', 'blue', 'green', 'yellow'].map((c) => h('th', null, sw(c, false)))), h('tr', null, [1, 2, 3, 4].map((n) => h('td', null, B(n))))),
    h('ul', null, h('li', null, B('IDENTIFICADOR'), ': lo ve el operador (puede decírtelo en voz alta).'), h('li', null, B('COLOR del sello'), ': lo ve el intérprete (te lo indica con gestos).'),
      h('li', null, B('MODIFICADOR'), v.analyst ? ': te lo da el analista (con gestos).' : [': sin analista vale siempre ', B('0'), '.'])),
    h('h4', null, 'ORDEN DE LAS CIFRAS'),
    h('ol', null, v.labels.map((l) => h('li', null, l))),
    h('div', { class: 'note' }, 'Ejemplo: identificador 6, verde (3), modificador 2 → 6+3+2 = 11 → cifra 1. (Mod 10 = quedarse con las unidades.)'),
  ];
}

const PAGES = { cables: cablesPage, safe: safePage, simon: simonPage, circuit: circuitPage, glyphs: glyphsPage, protocol: protocolPage };

export function expertPage(view, type) {
  return h('div', { class: 'manual', 'data-testid': 'manual' }, h('h3', null, `MANUAL DE DESACTIVACIÓN · ${MODULE_TITLES[type]}`), PAGES[type](view));
}

const ANALYST = {
  cables: (v) => ['PARÁMETRO', v.param, 'Indícalo al experto con los dedos: 0 ó 1.'],
  safe: (v) => ['PARÁMETRO', v.param, 'Número de 0 a 3. Muéstralo con los dedos al experto.'],
  simon: (v) => ['INVERTIR', v.reverse ? 'SÍ' : 'NO', v.reverse ? 'La secuencia debe invertirse (muestra 1 con el dedo).' : 'No se invierte (muestra 0: puño cerrado).'],
  circuit: (v) => ['INVERTIR OBJETIVO', v.invert ? 'SÍ' : 'NO', v.invert ? 'El estado objetivo se invierte (1).' : 'El objetivo no se invierte (0).'],
  glyphs: (v) => ['INVERTIR ORDEN', v.reverse ? 'SÍ' : 'NO', v.reverse ? 'Hay que pulsar en orden inverso (1).' : 'Orden normal (0).'],
  protocol: (v) => ['MODIFICADOR', v.modifier, 'Número de 0 a 9. Se suma a todas las cifras. Muéstralo con los dedos.'],
};

export function analystSheet(view, type) {
  const [label, value, desc] = ANALYST[type](view);
  return h('div', { class: 'panel screws sheet', 'data-testid': 'analyst' },
    h('div', { class: 'label' }, `FICHA TÉCNICA · ${MODULE_TITLES[type]}`),
    h('div', { class: 'stamp', style: { margin: '12px 0 4px' } }, label),
    h('div', { class: `big ${typeof value === 'string' ? 'word' : ''}`, 'data-testid': 'analyst-value' }, value),
    h('div', { class: 'desc' }, desc),
    h('div', { class: 'desc', style: { marginTop: '12px' } }, 'Solo puedes comunicar este dato al experto mediante gestos. No puedes tocar la bomba ni ver el manual.'));
}

/* ---------------- roles y gestos ---------------- */
export const ROLES = {
  operator: {
    name: 'OPERADOR', nick: 'EL CIEGO', icon: '🧤',
    can: ['Eres el único que toca la bomba (cortar, pulsar, introducir códigos).', 'Ves la bomba en escala de grises: posiciones, formas y números, nunca colores.', 'Puedes hablar y oír a tus compañeros.'],
    cannot: ['No ves colores ni el manual.', 'Nadie más puede manipular la bomba.'],
    tip: 'Ejecuta lo que te diga tu intérprete. Dicta en voz alta lo que ves: el experto te oye.',
  },
  expert: {
    name: 'EXPERTO', nick: 'EL MUDO', icon: '📖',
    can: ['Tienes el manual de desactivación con todas las reglas.', 'Puedes oír a los demás.'],
    cannot: ['NO puedes hablar: solo gestos.', 'No puedes enseñar tu pantalla ni escribir mensajes.', 'No tocas la bomba y no sabes dónde están los colores.'],
    tip: 'El intérprete te gesticula lo que ve; tú aplicas el manual y le respondes con gestos.',
  },
  interpreter: {
    name: 'INTÉRPRETE', nick: 'EL SORDO', icon: '👁️',
    can: ['Ves la bomba a color: cables, luces y marcas.', 'Puedes hablar con el operador y usar gestos con el experto.'],
    cannot: ['NO usas nada de lo que oigas decir a otros (eres sordo).', 'No tienes manual ni puedes tocar la bomba.'],
    tip: 'Traduce: gestos al experto, voz al operador.',
  },
  analyst: {
    name: 'ANALISTA', nick: 'EL ANALISTA', icon: '📊',
    can: ['Tienes parámetros técnicos que el experto necesita.', 'Puedes oír a los demás.'],
    cannot: ['Solo comunicas tus datos al experto mediante gestos.', 'No tocas la bomba ni ves el manual. No muestras tu pantalla.'],
    tip: 'Sin tu parámetro el experto no sabe qué regla aplicar.',
  },
};

export function roleCard(role) {
  const r = ROLES[role];
  return h('div', { class: 'panel rolecard' }, h('div', { class: 'label' }, 'TU ROL'),
    h('h2', null, `${r.icon} ${r.name} · ${r.nick}`),
    h('ul', null, r.can.map((t) => h('li', null, '✔ ', t)), r.cannot.map((t) => h('li', { style: { color: '#ff9aa3' } }, '✖ ', t))),
    h('p', { class: 'dim', style: { fontSize: '13px' } }, r.tip));
}

export function gestureGuide() {
  const item = (t, d) => h('li', null, B(t), ' — ', d);
  return h('div', { class: 'stack' },
    h('h2', { style: { color: 'var(--amber)' } }, 'GUÍA DE GESTOS'),
    h('p', { class: 'dim' }, 'Sugerencias: acordadlas antes de empezar. La aplicación no traduce nada: la comunicación es presencial.'),
    h('div', { class: 'panel' }, h('h3', null, 'FLUJO'), h('p', null, 'INTÉRPRETE ⟶ (gestos) EXPERTO ⟶ (gestos) INTÉRPRETE ⟶ (voz) OPERADOR ⟶ manipula la bomba.'),
      h('p', { class: 'dim' }, 'Con analista: ANALISTA ⟶ (gestos) EXPERTO. El operador puede decir en voz alta lo que ve (el experto oye); el intérprete no usa lo que oye.')),
    h('div', { class: 'panel' }, h('h3', null, 'NÚMEROS'), h('ul', null,
      item('1–5', 'dedos de una mano.'), item('6–9', 'una mano con 5 + otra con 1–4 dedos.'), item('0', 'puño cerrado.'), item('Varias cifras', 'una a una, con una pausa entre ellas (palma abierta = nueva cifra).'))),
    h('div', { class: 'panel' }, h('h3', null, 'POSICIONES Y DIRECCIONES'), h('ul', null,
      item('Izquierda / derecha', 'señalar con el brazo (desde tu punto de vista, aclarad cuál).'), item('Arriba / abajo', 'señalar techo / suelo.'), item('Posición 1–6', 'con los dedos, igual que los números.'))),
    h('div', { class: 'panel' }, h('h3', null, 'SÍ / NO / REPETIR'), h('ul', null,
      item('Sí / confirmar', 'pulgar arriba.'), item('No / error', 'pulgar abajo o cruzar los brazos.'), item('Repite', 'mano girando; «más despacio»: palma hacia abajo.'), item('Listo / siguiente', 'palma extendida.'))),
    h('div', { class: 'panel' }, h('h3', null, 'COLORES (sugerencia)'), h('ul', null,
      item('Rojo', 'puño apretado (o señalar algo rojo).'), item('Azul', 'mano plana ondulando como agua.'), item('Verde', 'mano en forma de hoja / dedos en V.'), item('Amarillo', 'dedos juntos hacia arriba como una llama / señalar algo amarillo.'))),
    h('div', { class: 'panel' }, h('h3', null, 'SÍMBOLOS'), h('ul', null,
      item('Sol', 'círculo con los brazos y dedos abiertos.'), item('Luna', 'dibujar una C en el aire.'), item('Ancla', 'mano que cae con el dedo en gancho.'), item('Rombo', 'dedos formando un diamante.'), item('Espiral', 'girar el dedo en círculos.'), item('Rayo', 'zigzag con el brazo.'))),
    h('div', { class: 'panel' }, h('h3', null, 'REGLAS DE ORO'), h('ul', null,
      h('li', null, 'No se enseñan pantallas. No se escriben mensajes ni se usan otras apps.'), h('li', null, 'El mudo no habla. El sordo no usa lo que oye.'), h('li', null, 'Cada error acerca la explosión: confirmad antes de actuar.'))));
}
