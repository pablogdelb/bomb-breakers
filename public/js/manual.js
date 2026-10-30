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

const PRIO = (list) => h('div', { class: 'prio' }, list.flatMap((sy, i) => [
  i ? h('span', { class: 'arrow' }, '→') : null,
  h('span', { style: { textAlign: 'center', fontSize: '9px' } }, h('span', { class: 'sym' }, symbol(sy, '#1c1a14')), h('br'), SYM_NAMES[sy]),
]));

function cablesPage(v) {
  const rows = [
    ['1', h('span', null, 'Corta el ', sw('red'), ' de ', B('MAYOR'), ' posición.'), h('span', null, 'El ', sw('red', false), ' de ', B('MENOR'), ' posición.')],
    ['2', h('span', null, 'Entre los ', sw('blue'), ': el ', B('MÁS CERCANO'), ' (en posición) al último cortado. Empate: la menor posición.'), h('span', null, 'Entre los azules: el ', B('MÁS LEJANO'), ' al último cortado. Empate: la menor posición.')],
    ['3', h('span', null, 'Entre los ', sw('green'), ': el de ', B('MENOR'), ' posición. Si no queda ninguno, el ', sw('yellow'), ' de menor posición.'), h('span', null, 'Igual, pero el de ', B('MAYOR'), ' posición (verdes; si no hay, amarillos).')],
    ['4', h('span', null, 'Entre ', sw('green', false), ' y ', sw('yellow', false), ' que queden: el ', B('MÁS LEJANO'), ' al último cortado. Empate: la menor posición.'), h('span', null, 'Entre verdes y amarillos: el ', B('MÁS CERCANO'), ' al último cortado. Empate: la menor posición.')],
  ].slice(0, v.steps);
  return [
    h('p', null, `Hay 8 cables (posiciones 1–8) y debes ordenar ${v.steps} cortes, `, B('en este orden'), '. Cada paso tiene dos variantes según su parámetro (0 ó 1).'),
    h('table', null, h('tr', null, h('th', null, 'PASO'), h('th', null, 'PARÁMETRO = 0'), h('th', null, 'PARÁMETRO = 1')),
      rows.map(([n, a, b2]) => h('tr', null, h('td', null, B(n)), h('td', { style: { textAlign: 'left', fontSize: '12px' } }, a), h('td', { style: { textAlign: 'left', fontSize: '12px' } }, b2)))),
    h('h4', null, 'PARÁMETROS'),
    v.analyst
      ? h('p', null, 'El ', B('ANALISTA'), ` te da ${v.steps} parámetros, uno por paso (0 ó 1). Pregúntale cada vez el del paso en el que estás.`)
      : h('p', null, 'Sin analista todos los parámetros valen ', B('0'), '.'),
    h('div', { class: 'note' }, 'Un corte equivocado suma un error y el cable no se pierde. El intérprete te dice los colores y el último cable cortado; el operador ejecuta.'),
  ];
}

function safePage(v) {
  const rows = [
    ['1ª', h('span', null, 'Suma de los números de las casillas ', sw('red'), '. Quédate con las ', B('unidades'), '.')],
    ['2ª', h('span', null, 'Nº de casillas ', sw('blue'), ' + ', B('A'), '. Unidades.')],
    ['3ª', h('span', null, 'Número de la casilla ', sw('green'), ' que quede ', B('más abajo y a la derecha'), ' (orden de lectura: izquierda→derecha, arriba→abajo; 0 si no hay verdes) + ', B('B'), '. Unidades.')],
    ['4ª', h('span', null, 'Suma de las tres cifras anteriores. Unidades.')],
    ['5ª', h('span', null, B('3 ×'), ' nº de casillas ', sw('yellow'), ' + ', B('C'), '. Unidades.')],
  ].slice(0, v.digits);
  return [
    h('p', null, `Combinación de ${v.digits} cifras sobre una cuadrícula de 4×4 (16 casillas).`),
    h('table', null, h('tr', null, h('th', null, 'CIFRA'), h('th', null, 'REGLA')), rows.map(([a, b2]) => h('tr', null, h('td', null, a), h('td', { style: { textAlign: 'left' } }, b2)))),
    h('h4', null, 'PARÁMETROS'),
    v.analyst
      ? h('p', null, 'El ', B('ANALISTA'), ' te da ', B('A'), ' (0–3), ', B('B'), ' (0–9)', v.digits >= 5 ? [' y ', B('C'), ' (0–9)'] : '', '.')
      : h('p', null, 'Sin analista: ', B(`A = ${v.fixed.A}`), ', ', B(`B = ${v.fixed.B}`), v.digits >= 5 ? [', ', B(`C = ${v.fixed.C}`)] : '', '.'),
    h('div', { class: 'note' }, 'Las casillas de un color que no aparece en las reglas no cuentan. El operador ve los números; el intérprete, números y colores.'),
  ];
}

function simonPage(v) {
  const order = ['red', 'blue', 'green', 'yellow'];
  return [
    h('p', null, 'Los destellos ', B('NO'), ' se repiten tal cual: cada color visto se sustituye por otro. Hay ', B('dos tablas'), ' (A y B).'),
    h('table', null, h('tr', null, h('th', null, 'SI SE ENCIENDE'), h('th', null, 'TABLA A → PULSA'), h('th', null, 'TABLA B → PULSA')),
      order.map((c) => h('tr', null, h('td', null, sw(c)), h('td', null, sw(v.tables[0][c])), h('td', null, sw(v.tables[1][c]))))),
    h('h4', null, 'TABLA Y ORDEN'),
    v.analyst
      ? h('p', null, 'El ', B('ANALISTA'), ' te dice dos cosas: ', B('qué tabla usar (A o B)'), ' y ', B('INVERTIR (sí/no)'), '. Si invertir = sí, primero das la vuelta al orden de la secuencia vista y después transformas los colores.')
      : h('p', null, 'Sin analista: usa siempre la ', B('tabla A'), ' y ', B('nunca'), ' inviertas la secuencia.'),
    h('div', { class: 'note' }, 'El intérprete traduce colores a posiciones (arriba, derecha, abajo, izquierda) para el operador. Si el operador se equivoca, la secuencia se reinicia y suma un error. El operador puede pedir repetir la secuencia.'),
  ];
}

function circuitPage(v) {
  return [
    h('p', null, `Hay ${v.wiring.length} interruptores y ${v.pilots} pilotos. Cada interruptor ALTERNA (enciende↔apaga) estos pilotos:`),
    h('table', null, h('tr', null, h('th', null, 'INTERRUPTOR'), h('th', null, 'ALTERNA PILOTOS')),
      v.wiring.map((w) => h('tr', null, h('td', null, B(w.sw)), h('td', null, w.toggles.map((t) => `P${t}`).join(' · '))))),
    h('h4', null, 'OBJETIVO'),
    h('p', null, 'Los pilotos de color ', sw(v.goal), ' deben quedar ', B('ENCENDIDOS'), ' y todos los demás ', B('APAGADOS'), '.'),
    v.analyst ? h('p', null, 'Excepción: el ', B('ANALISTA'), ' te dirá una lista de ', B('pilotos invertidos'), ': esos van ', B('al revés'), ' (si tocaría encendido, apagado; y viceversa).') : h('p', null, 'Sin analista no hay pilotos invertidos.'),
    h('h4', null, 'MÉTODO'),
    h('p', null, 'Necesitas el estado actual (encendido/apagado: lo ve el operador) y los colores (intérprete). Un interruptor pulsado dos veces se anula: cada uno se usa 0 ó 1 vez. Calcula qué interruptores activar y díselo al intérprete.'),
  ];
}

function glyphsPage(v) {
  return [
    h('p', null, 'Debe pulsarse cada símbolo que tenga la marca de color ', sw(v.activation),
      v.block ? [' y que ', B('NO'), ' tenga también la marca ', sw(v.block), '.'] : '.'),
    h('h4', null, 'LISTA A (de primero a último)'), PRIO(v.priorities[0]),
    h('h4', null, 'LISTA B (de primero a último)'), PRIO(v.priorities[1]),
    v.analyst
      ? h('p', null, 'El ', B('ANALISTA'), ' te dice ', B('qué lista usar (A o B)'), ' y ', B('INVERTIR (sí/no)'), '. Con invertir = sí, pulsa en el orden contrario.')
      : h('p', null, 'Sin analista: lista ', B('A'), ' y orden normal.'),
    h('div', { class: 'note' }, 'El intérprete ve qué símbolo está en cada posición (3×3) y sus marcas. Un símbolo equivocado reinicia la secuencia y suma un error.'),
  ];
}

function protocolPage(v) {
  return [
    h('p', null, 'Último paso. Hay ', B('una cifra por cada módulo'), ' de la lista (en ese orden):'),
    h('div', { class: 'formula' }, 'cifra = (ID + COLOR × K + MOD) mod 10'),
    h('ul', null,
      h('li', null, B('ID'), ': identificador de 0–9 del módulo (lo ve el operador y puede decírtelo).'),
      h('li', null, B('COLOR'), ': índice del sello (lo ve el intérprete): ', sw('red', false), '=1 ', sw('blue', false), '=2 ', sw('green', false), '=3 ', sw('yellow', false), '=4.'),
      h('li', null, B('K'), ' = ', B('2'), ' si el ID es ', B('PAR'), ' (0,2,4,6,8) y ', B('1'), ' si es ', B('IMPAR'), '.'),
      h('li', null, B('MOD'), v.analyst ? ': te lo da el analista, ' : ': sin analista vale siempre 0. ', v.analyst ? B('uno distinto para cada cifra') : '', v.analyst ? '.' : '')),
    h('h4', null, 'ORDEN DE LAS CIFRAS'),
    h('ol', null, v.labels.map((l) => h('li', null, l))),
    h('div', { class: 'note' }, 'Ejemplo: ID 6 (par), verde (3), MOD 2 → 6 + 3×2 + 2 = 14 → cifra 4. Con ID 7 (impar): 7 + 3×1 + 2 = 12 → cifra 2.'),
  ];
}

const PAGES = { cables: cablesPage, safe: safePage, simon: simonPage, circuit: circuitPage, glyphs: glyphsPage, protocol: protocolPage };

export function expertPage(view, type) {
  return h('div', { class: 'manual', 'data-testid': 'manual' }, h('h3', null, `MANUAL DE DESACTIVACIÓN · ${MODULE_TITLES[type]}`), PAGES[type](view));
}

const abox = (label, value, active, big) => h('div', { class: `abox ${active ? 'active' : ''}` }, h('div', { class: 'k' }, label), h('div', { class: `v ${big ? 'word' : ''}` }, value));

const ANALYST = {
  cables: (v) => ({ title: 'PARÁMETROS POR PASO', items: v.params.map((x, i) => abox(`PASO ${i + 1}`, x, i === v.step)), desc: `Uno por cada corte (0 ó 1). Se ilumina el paso actual (${Math.min(v.step + 1, v.params.length)}). Díselos al experto con los dedos cuando los pida.` }),
  safe: (v) => ({ title: 'PARÁMETROS DE LA CAJA', items: v.params.map((p) => abox(p.key, p.value)), desc: 'A: 0–3 · B y C: 0–9. Muéstraselos al experto con los dedos (una cifra cada vez).' }),
  simon: (v) => ({ title: 'TABLA E INVERSIÓN', items: [abox('TABLA', v.table, false, true), abox('INVERTIR', v.reverse ? 'SÍ' : 'NO', false, true)], desc: 'Dos datos: qué tabla de colores usa el experto (A o B) y si invierte el orden de la secuencia.' }),
  circuit: (v) => ({ title: 'PILOTOS INVERTIDOS', items: v.flip.map((n) => abox('PILOTO', `P${n}`, true)), desc: 'Estos pilotos tienen el objetivo al revés. Indícaselos al experto uno a uno con los dedos.' }),
  glyphs: (v) => ({ title: 'LISTA Y ORDEN', items: [abox('LISTA', v.list, false, true), abox('INVERTIR', v.reverse ? 'SÍ' : 'NO', false, true)], desc: 'Qué lista de prioridad usa el experto (A o B) y si el orden se invierte.' }),
  protocol: (v) => ({ title: 'MODIFICADOR DE CADA CIFRA', items: v.mods.map((x, i) => abox(`CIFRA ${i + 1}`, x)), desc: `Un modificador (0–9) distinto para cada cifra. Orden de las cifras: ${v.labels.map((l, i) => `${i + 1}=${l.replace('MÓDULO ', 'M')}`).join(' · ')}.` }),
};

export function analystSheet(view, type) {
  const { title, items, desc } = ANALYST[type](view);
  return h('div', { class: 'panel screws sheet', 'data-testid': 'analyst' },
    h('div', { class: 'label' }, `FICHA TÉCNICA · ${MODULE_TITLES[type]}`),
    h('div', { class: 'stamp', style: { margin: '12px 0 10px' } }, title),
    h('div', { class: 'aboxes', 'data-testid': 'analyst-values' }, items),
    h('div', { class: 'desc', style: { marginTop: '12px' } }, desc),
    h('div', { class: 'desc', style: { marginTop: '10px' } }, 'Solo puedes comunicar estos datos al experto mediante gestos. No puedes tocar la bomba ni ver el manual.'));
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
    can: ['Tienes varios datos técnicos por módulo (parámetros, tablas, pilotos, modificadores) que el experto necesita.', 'Puedes oír a los demás.'],
    cannot: ['Solo comunicas tus datos al experto mediante gestos.', 'No tocas la bomba ni ves el manual. No muestras tu pantalla.'],
    tip: 'Cada dato tuyo cambia la respuesta: sin ti el experto no sabe qué variante de la regla aplicar.',
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
