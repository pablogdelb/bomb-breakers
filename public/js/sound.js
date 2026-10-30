// Efectos de sonido sintetizados con WebAudio (sin archivos externos; todo original).
import { store } from './dom.js';

let ctx = null;
let master = null;
const prefs = { sound: store.get('bb_sound') !== false, motion: store.get('bb_motion') !== false };
export const settings = prefs;

export function setSound(on) { prefs.sound = on; store.set('bb_sound', on); }
export function setMotion(on) {
  prefs.motion = on; store.set('bb_motion', on);
  document.body.classList.toggle('reduce-motion', !on);
}
export function applyPrefs() {
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (store.get('bb_motion') === null && reduced) prefs.motion = false;
  document.body.classList.toggle('reduce-motion', !prefs.motion);
}

export function unlock() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* sin audio */ }
}
['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.addEventListener(e, unlock, { passive: true }));

function tone(freq, dur, { type = 'square', vol = 0.15, at = 0, slide = 0 } = {}) {
  if (!prefs.sound || !ctx) return;
  const t0 = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(dur, { vol = 0.4, at = 0, freq = 1200, sweep = -1000 } = {}) {
  if (!prefs.sound || !ctx) return;
  const t0 = ctx.currentTime + at;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(freq, t0);
  f.frequency.exponentialRampToValueAtTime(Math.max(60, freq + sweep), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0);
}

const PAD_NOTES = [392, 523, 330, 262];
export const sfx = {
  click: () => tone(880, 0.05, { vol: 0.08 }),
  tick: () => tone(1500, 0.03, { vol: 0.05, type: 'square' }),
  tickUrgent: () => tone(1900, 0.06, { vol: 0.1 }),
  pad: (i) => tone(PAD_NOTES[i] ?? 440, 0.28, { type: 'triangle', vol: 0.2 }),
  countdown: (final) => tone(final ? 1320 : 660, final ? 0.5 : 0.15, { vol: 0.18 }),
  snip: () => { noise(0.07, { vol: 0.25, freq: 6000, sweep: -2000 }); tone(2400, 0.05, { vol: 0.08, at: 0.03 }); },
  step: () => { tone(660, 0.07, { vol: 0.12 }); tone(990, 0.09, { vol: 0.12, at: 0.07 }); },
  solved: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.2, at: i * 0.09 })),
  error: () => { tone(180, 0.35, { type: 'sawtooth', vol: 0.22 }); tone(150, 0.35, { type: 'sawtooth', vol: 0.22, at: 0.18 }); },
  alarm: () => { for (let i = 0; i < 4; i++) tone(i % 2 ? 620 : 880, 0.18, { type: 'square', vol: 0.16, at: i * 0.2 }); },
  penalty: () => { sfx.alarm(); tone(90, 0.6, { type: 'sawtooth', vol: 0.2, at: 0.1, slide: -40 }); },
  boom: () => { noise(1.6, { vol: 0.9, freq: 2400, sweep: -2200 }); tone(110, 1.2, { type: 'sine', vol: 0.5, slide: -80 }); },
  win: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.22, at: i * 0.12 })),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, { type: 'sawtooth', vol: 0.15, at: i * 0.2 })),
  blip: () => tone(440, 0.06, { vol: 0.05, type: 'sine' }),
};
