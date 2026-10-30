import { s } from './dom.js';

export const HEX = { red: '#ff3b3b', blue: '#2f8cff', green: '#2ee06f', yellow: '#ffd21f' };
export const COLOR_NAMES = { red: 'ROJO', blue: 'AZUL', green: 'VERDE', yellow: 'AMARILLO' };
export const COLOR_ABBR = { red: 'R', blue: 'AZ', green: 'V', yellow: 'AM' };
export const SYM_NAMES = { sol: 'SOL', luna: 'LUNA', ancla: 'ANCLA', rombo: 'ROMBO', espiral: 'ESPIRAL', rayo: 'RAYO' };

/** Símbolos originales del módulo Jeroglíficos (viewBox 100x100). */
export function symbol(name, color = '#dfe6ef') {
  const st = { fill: 'none', stroke: color, 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  const svg = s('svg', { viewBox: '0 0 100 100', 'aria-label': SYM_NAMES[name] });
  switch (name) {
    case 'sol': {
      svg.append(s('circle', { ...st, cx: 50, cy: 50, r: 17 }));
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        svg.append(s('line', { ...st, x1: 50 + Math.cos(a) * 27, y1: 50 + Math.sin(a) * 27, x2: 50 + Math.cos(a) * 42, y2: 50 + Math.sin(a) * 42 }));
      }
      break;
    }
    case 'luna': svg.append(s('path', { ...st, d: 'M62 12 A40 40 0 1 0 62 88 A31 31 0 1 1 62 12 Z', fill: color, 'fill-opacity': .25 })); break;
    case 'ancla':
      svg.append(s('circle', { ...st, cx: 50, cy: 18, r: 8 }), s('line', { ...st, x1: 50, y1: 26, x2: 50, y2: 84 }),
        s('line', { ...st, x1: 34, y1: 40, x2: 66, y2: 40 }), s('path', { ...st, d: 'M18 60 Q22 86 50 86 Q78 86 82 60' }),
        s('path', { ...st, d: 'M10 66 L18 58 L26 68' }), s('path', { ...st, d: 'M74 68 L82 58 L90 66' }));
      break;
    case 'rombo': svg.append(s('polygon', { ...st, points: '50,8 90,50 50,92 10,50', fill: color, 'fill-opacity': .2 })); break;
    case 'espiral': {
      const pts = [];
      for (let t = 0; t < 4.3 * Math.PI; t += 0.18) pts.push(`${(50 + (2 + t * 3.3) * Math.cos(t)).toFixed(1)},${(50 + (2 + t * 3.3) * Math.sin(t)).toFixed(1)}`);
      svg.append(s('polyline', { ...st, points: pts.join(' ') }));
      break;
    }
    case 'rayo': svg.append(s('polygon', { ...st, points: '58,6 24,54 46,54 38,94 78,40 54,40', fill: color, 'fill-opacity': .25 })); break;
  }
  return svg;
}

/** Bomba decorativa de la pantalla de inicio (SVG animado por CSS inline). */
export function heroBomb() {
  const svg = s('svg', { viewBox: '0 0 300 300', class: 'hero-bomb', role: 'img', 'aria-label': 'Bomba' });
  svg.innerHTML = `
  <defs>
    <radialGradient id="hb-body" cx="38%" cy="32%" r="80%"><stop offset="0" stop-color="#4a5870"/><stop offset=".55" stop-color="#232c3a"/><stop offset="1" stop-color="#0c1018"/></radialGradient>
    <linearGradient id="hb-band" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffc247"/><stop offset="1" stop-color="#b86f00"/></linearGradient>
    <radialGradient id="hb-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffb020" stop-opacity=".9"/><stop offset="1" stop-color="#ffb020" stop-opacity="0"/></radialGradient>
  </defs>
  <circle cx="150" cy="178" r="108" fill="url(#hb-body)" stroke="#3a4a60" stroke-width="3"/>
  <rect x="112" y="52" width="76" height="34" rx="8" fill="#39465a" stroke="#5b6b82" stroke-width="3"/>
  <path d="M188 66 C 220 50, 232 36, 226 18" fill="none" stroke="#c8a96a" stroke-width="5" stroke-linecap="round"/>
  <circle cx="226" cy="16" r="16" fill="url(#hb-glow)"><animate attributeName="r" values="10;22;10" dur=".6s" repeatCount="indefinite"/></circle>
  <circle cx="226" cy="16" r="5" fill="#fff6c8"/>
  <rect x="48" y="150" width="204" height="14" fill="url(#hb-band)" opacity=".9"/>
  <rect x="48" y="196" width="204" height="14" fill="url(#hb-band)" opacity=".9"/>
  <rect x="86" y="162" width="128" height="36" rx="6" fill="#140507" stroke="#3a1015" stroke-width="3"/>
  <text x="150" y="190" text-anchor="middle" font-family="Share Tech Mono, monospace" font-size="30" fill="#ff5a5a">00:10<animate attributeName="opacity" values="1;.35;1" dur="1s" repeatCount="indefinite"/></text>
  <circle cx="96" cy="232" r="7" fill="#ff4655"><animate attributeName="opacity" values="1;.15;1" dur=".8s" repeatCount="indefinite"/></circle>
  <circle cx="204" cy="232" r="7" fill="#34e08a"><animate attributeName="opacity" values=".2;1;.2" dur=".8s" repeatCount="indefinite"/></circle>
  <path d="M120 232 q30 22 60 0" fill="none" stroke="#6b7b92" stroke-width="3" stroke-dasharray="4 5"/>
  <ellipse cx="100" cy="120" rx="26" ry="14" fill="#fff" opacity=".07" transform="rotate(-30 100 120)"/>`;
  return svg;
}
