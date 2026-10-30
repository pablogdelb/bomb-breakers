// E2E: 8 navegadores móviles (Chromium) juegan una partida 4v4 difícil completa a través de la interfaz real.
import { chromium, devices } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, existsSync } from 'node:fs';

process.env.COUNTDOWN_MS ??= '1500';
const { createGameServer } = await import('../server/index.js');
const { solveModule } = await import('../server/engine/index.js');
const SHOTS = new URL('./shots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const g = await createGameServer({ port: 0 });
const base = `http://127.0.0.1:${g.port}`;
const exe = process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ args: ['--no-sandbox'], executablePath: exe });
const phone = devices['iPhone 13'];
const names = ['Ana', 'Beto', 'Cleo', 'Dani', 'Eva', 'Fran', 'Gus', 'Hugo'];
const roles = ['operator', 'expert', 'interpreter', 'analyst'];
const players = [];
const errors = [];
let step = 0;
const log = (m) => console.log(`[${String(++step).padStart(2, '0')}] ${m}`);

for (const name of names) {
  const ctx = await browser.newContext({ ...phone, locale: 'es-ES' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(`${name}: ${m.text()}`); });
  players.push({ name, ctx, page });
}
const [host] = players;
const T = (p, id) => p.page.locator(`[data-testid="${id}"]`);

// --- 1. crear sala y unirse (el resto por enlace de invitación) ---
await host.page.goto(base);
await T(host, 'create').click();
await T(host, 'name').fill(host.name);
await T(host, 'go').click();
await T(host, 'room-code').waitFor();
const code = (await T(host, 'room-code').textContent()).trim();
assert.match(code, /^[A-Z2-9]{6}$/);
log(`sala creada: ${code}`);
for (const p of players.slice(1)) {
  await p.page.goto(`${base}/${code}`); // enlace de invitación: el código viene prellenado
  assert.equal((await T(p, 'code').inputValue()).toUpperCase(), code);
  await T(p, 'name').fill(p.name);
  await T(p, 'go').click();
  await T(p, 'room-code').waitFor();
}
log('8 jugadores dentro');
await T(host, 'size-4').click();
await T(host, 'diff-hard').click();
await host.page.waitForSelector('[data-testid="seat-red-analyst"]');

// --- 2. puestos y listos ---
const seats = { red: {}, blue: {} };
let i = 0;
for (const team of ['red', 'blue']) for (const role of roles) {
  const p = players[i++];
  await T(p, `seat-${team}-${role}`).click();
  await p.page.waitForFunction(([t, r]) => document.querySelector(`[data-testid="seat-${t}-${r}"]`)?.classList.contains('mine'), [team, role]);
  p.team = team; p.role = role; seats[team][role] = p;
}
assert.ok(await T(host, 'start').isDisabled(), 'no se puede iniciar sin que todos estén listos');
log('start deshabilitado hasta que todos estén listos: ' + (await T(host, 'start-reason').textContent()));
await host.page.screenshot({ path: `${SHOTS}lobby.png`, fullPage: true });
for (const p of players) await T(p, 'ready').click();
await host.page.waitForFunction(() => !document.querySelector('[data-testid="start"]').disabled);
await T(host, 'start').click();
log('partida iniciada');
await host.page.waitForSelector('[data-testid="countdown"]');
await host.page.screenshot({ path: `${SHOTS}countdown.png` });
for (const p of players) await p.page.waitForSelector('[data-testid="stage"] > *', { timeout: 15000 });
await players[0].page.waitForTimeout(300);

const room = g.rooms.get(code);
const bomb = room.match.bomb;
log(`bomba (${bomb.modules.map((m) => m.type).join(' → ')})`);
const modIndex = async (p) => Number((await p.page.locator('.modname .label').textContent()).match(/MÓDULO (\d+)/)[1]) - 1;

async function doAction(op, mod, a) {
  switch (mod.type) {
    case 'cables': await T(op, `wire-${a.pos}`).click(); await T(op, 'cut-btn').click(); break;
    case 'glyphs': await T(op, `glyph-${a.pos}`).click(); break;
    case 'simon': await T(op, `pad-${a.pos}`).dispatchEvent('pointerdown'); break;
    case 'safe': case 'protocol':
      for (const d of a.digits) await T(op, `key-${d}`).click();
      await T(op, 'key-submit').click(); break;
    case 'circuit':
      for (let k = 0; k < a.switches.length; k++) if (a.switches[k]) await T(op, `sw-${k + 1}`).click();
      await T(op, 'apply').click(); break;
  }
}
async function wrongAction(op, mod) {
  const p = mod.puzzle;
  switch (mod.type) {
    case 'cables': case 'glyphs': return doAction(op, mod, { pos: [1, 2, 3, 4, 5, 6].find((x) => x !== p.answer[0]) });
    case 'simon': return doAction(op, mod, { pos: [0, 1, 2, 3].find((x) => x !== p.answer[0]) });
    case 'safe': case 'protocol': return doAction(op, mod, { digits: p.code.map((d, k) => (k ? d : (d + 1) % 10)) });
    case 'circuit': return doAction(op, mod, { switches: Array(p.k).fill(false) });
  }
}

// --- 3. capturas de cada rol en el primer módulo ---
for (const role of roles) await seats.red[role].page.screenshot({ path: `${SHOTS}role-${role}-m1-${bomb.modules[0].type}.png` });
const opHtml = await seats.red.operator.page.locator('[data-testid="stage"]').innerHTML();
assert.ok(!/#ff3b3b|#2f8cff|#2ee06f|#ffd21f/i.test(opHtml), 'el operador no recibe colores en el DOM');
log('el DOM del operador no contiene colores');

// --- 4. el equipo azul se equivoca 3 veces: explota ---
const blueOp = seats.blue.operator;
for (let k = 0; k < 3; k++) {
  await wrongAction(blueOp, bomb.modules[0]);
  await blueOp.page.waitForFunction((n) => window.__bb.state.match.teams.blue.errors >= n, k + 1);
  if (k === 0) await blueOp.page.screenshot({ path: `${SHOTS}error-flash.png` });
}
await blueOp.page.waitForSelector('[data-testid="boom"]');
await blueOp.page.waitForTimeout(600);
await blueOp.page.screenshot({ path: `${SHOTS}boom.png` });
log('equipo azul: explosión mostrada tras 3 errores');
assert.equal(room.match.teams.red.errors, 0, 'los errores del azul no afectan al rojo');

// --- 5. el equipo rojo comete 1 error (alarma) y luego resuelve toda la bomba por la UI ---
const redOp = seats.red.operator;
await wrongAction(redOp, bomb.modules[0]);
await redOp.page.waitForFunction(() => window.__bb.state.match.teams.red.errors === 1);
await redOp.page.waitForTimeout(400);
for (let m = 0; m < bomb.modules.length; m++) {
  const mod = bomb.modules[m];
  assert.equal(await modIndex(redOp), m);
  assert.equal(await modIndex(seats.red.expert), m);
  if (m > 0) for (const role of roles) await seats.red[role].page.screenshot({ path: `${SHOTS}role-${role}-m${m + 1}-${mod.type}.png` });
  if (mod.type === 'simon') await redOp.page.waitForTimeout(3500); // dejar terminar la secuencia
  for (const a of solveModule(mod)) await doAction(redOp, mod, a);
  log(`rojo resuelve módulo ${m + 1}: ${mod.type}`);
  if (m < bomb.modules.length - 1) await redOp.page.waitForFunction((n) => window.__bb.state.module?.index === n, m + 1);
}
for (const p of players) await p.page.waitForSelector('[data-testid="result-title"]', { timeout: 8000 });
const title = await T(host, 'result-title').textContent();
assert.match(title, /EQUIPO ROJO GANA/);
await redOp.page.screenshot({ path: `${SHOTS}results-win.png`, fullPage: true });
await blueOp.page.screenshot({ path: `${SHOTS}results-lose.png`, fullPage: true });
log('resultado: ' + title.replace(/\s+/g, ' '));

// --- 6. revancha ---
const oldSeed = room.match.seed;
await T(seats.blue.analyst, 'rematch').click();
for (const p of players) await p.page.waitForSelector('[data-testid="room-code"]');
for (const p of players) assert.ok(await T(p, `seat-${p.team}-${p.role}`).evaluate((e) => e.classList.contains('mine')), 'conserva puesto');
for (const p of players) await T(p, 'ready').click();
await host.page.waitForFunction(() => !document.querySelector('[data-testid="start"]').disabled);
await T(host, 'start').click();
await host.page.waitForFunction(() => window.__bb.state.room.status !== 'lobby', null, { timeout: 15000 });
assert.notEqual(room.match.seed, oldSeed);
log('revancha iniciada con bomba nueva');

// --- 7. recarga de página: el jugador recupera su asiento y la partida ---
await host.page.waitForFunction(() => window.__bb.state.room.status === 'playing', null, { timeout: 15000 });
const exp = seats.red.expert;
await exp.page.reload();
await exp.page.waitForFunction(() => window.__bb?.state?.me?.role === 'expert' && window.__bb.state.module, null, { timeout: 8000 });
await exp.page.screenshot({ path: `${SHOTS}after-reload-expert.png` });
log('reconexión tras recarga: el experto recupera rol y manual');

assert.deepEqual(errors, [], 'sin errores de consola/JS: ' + errors.join(' | '));
await browser.close();
await g.close();
log('E2E OK');
