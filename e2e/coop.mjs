// E2E modo cooperativo: 3 móviles Chromium, 1 equipo, dificultad fácil, resuelven la bomba por la interfaz.
import { chromium, devices } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, existsSync } from 'node:fs';

process.env.COUNTDOWN_MS ??= '1200';
const { createGameServer } = await import('../server/index.js');
const { solveModule } = await import('../server/engine/index.js');
const SHOTS = new URL('./shots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const g = await createGameServer({ port: 0 });
const exe = process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ args: ['--no-sandbox'], executablePath: exe });
const base = `http://127.0.0.1:${g.port}`;
const errors = [];
const roles = ['operator', 'expert', 'interpreter'];
const players = [];
for (const name of ['Ana', 'Beto', 'Cleo']) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(`${name}: ${m.text()}`); });
  players.push({ name, page });
}
const T = (p, id) => p.page.locator(`[data-testid="${id}"]`);
const [host] = players;
await host.page.goto(base);
await T(host, 'create').click(); await T(host, 'name').fill('Ana'); await T(host, 'go').click();
await T(host, 'room-code').waitFor();
const code = (await T(host, 'room-code').textContent()).trim();
for (const p of players.slice(1)) { await p.page.goto(`${base}/${code}`); await T(p, 'name').fill(p.name); await T(p, 'go').click(); await T(p, 'room-code').waitFor(); }
await T(host, 'mode-coop').click();
await T(host, 'diff-easy').click();
await host.page.waitForFunction(() => window.__bb.state.room.mode === 'coop');
assert.equal(await host.page.locator('.team').count(), 1, 'solo un equipo en la sala');
assert.equal(await host.page.locator('[data-testid^="seat-blue"]').count(), 0);
players.forEach((p, i) => { p.role = roles[i]; });
for (const p of players) { await T(p, `seat-red-${p.role}`).click(); await p.page.waitForFunction((r) => document.querySelector(`[data-testid="seat-red-${r}"]`)?.classList.contains('mine'), p.role); }
await host.page.screenshot({ path: `${SHOTS}coop-lobby.png`, fullPage: true });
for (const p of players) await T(p, 'ready').click();
await host.page.waitForFunction(() => !document.querySelector('[data-testid="start"]').disabled);
await T(host, 'start').click();
for (const p of players) await p.page.waitForSelector('[data-testid="stage"] > *', { timeout: 15000 });
const bomb = g.rooms.get(code).match.bomb;
console.log('bomba coop:', bomb.modules.map((m) => m.type).join(' → '));
await host.page.waitForFunction(() => window.__bb.state.room.status === 'playing');
await host.page.waitForTimeout(400);
await host.page.screenshot({ path: `${SHOTS}coop-game.png` });
const op = players[0];
async function doAction(mod, a) {
  switch (mod.type) {
    case 'cables': await T(op, `wire-${a.pos}`).click(); await T(op, 'cut-btn').click(); break;
    case 'glyphs': await T(op, `glyph-${a.pos}`).click(); break;
    case 'simon': await T(op, `pad-${a.pos}`).dispatchEvent('pointerdown'); break;
    case 'safe': case 'protocol': for (const d of a.digits) await T(op, `key-${d}`).click(); await T(op, 'key-submit').click(); break;
    case 'circuit': for (let k = 0; k < a.switches.length; k++) if (a.switches[k]) await T(op, `sw-${k + 1}`).click(); await T(op, 'apply').click(); break;
  }
}
for (let m = 0; m < bomb.modules.length; m++) {
  const mod = bomb.modules[m];
  if (mod.type === 'simon') await op.page.waitForTimeout(3000);
  for (const a of solveModule(mod)) await doAction(mod, a);
  if (m < bomb.modules.length - 1) await op.page.waitForFunction((n) => window.__bb.state.module?.index === n, m + 1);
}
for (const p of players) await p.page.waitForSelector('[data-testid="result-title"]', { timeout: 8000 });
const title = (await T(host, 'result-title').textContent()).replace(/\s+/g, ' ');
assert.match(title, /BOMBA DESACTIVADA/);
await host.page.screenshot({ path: `${SHOTS}coop-result.png`, fullPage: true });
console.log('resultado:', title);
assert.deepEqual(errors, [], errors.join(' | '));
await browser.close(); await g.close();
console.log('E2E COOP OK');
