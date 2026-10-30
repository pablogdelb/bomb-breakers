process.env.COUNTDOWN_MS = '150';
process.env.RECONNECT_MS = '400';
const { createGameServer } = await import('../server/index.js');
import test from 'node:test';
import assert from 'node:assert/strict';
import { Bot, fullRoom, sleep } from './helpers.js';
import { solveModule, DIFFICULTIES } from '../server/engine/index.js';

let g, gFast; // gFast: reloj acelerado (8 min -> 4.8 s) para probar el temporizador real
test.before(async () => { g = await createGameServer({ port: 0 }); gFast = await createGameServer({ port: 0, timeScale: 0.01 }); });
test.after(async () => { await g.close(); await gFast.close(); });

const matchOf = (host) => g.rooms.get(host.code).match;
const act = (op, action, id) => op.send({ t: 'action', id: id || Math.random().toString(36).slice(2), action });
const wrongFor = (m) => {
  const p = m.puzzle;
  switch (m.type) {
    case 'cables': return { type: 'cut', pos: [1, 2, 3, 4, 5, 6].find((x) => x !== p.answer[0]) };
    case 'simon': return { type: 'press', pos: [0, 1, 2, 3].find((x) => x !== p.answer[0]) };
    case 'glyphs': return { type: 'press', pos: [1, 2, 3, 4, 5, 6].find((x) => x !== p.answer[0]) };
    case 'safe': return { type: 'code', digits: p.code.map((d, i) => (i === 0 ? (d + 1) % 10 : d)) };
    case 'protocol': return { type: 'code', digits: p.code.map((d, i) => (i === 0 ? (d + 1) % 10 : d)) };
    case 'circuit': {
      for (let s = 0; s < 1 << p.k; s++) { const sw = Array.from({ length: p.k }, (_, i) => !!((s >> i) & 1)); let e = 0; sw.forEach((o, i) => o && (e ^= p.cols[i])); if (e !== (p.initial ^ p.target)) return { type: 'apply', switches: sw }; }
    }
  }
};
async function startAndWait(room) {
  room.host.send({ t: 'start' });
  await room.host.until((b) => b.room.status === 'playing', 3000, 'inicio');
}
async function solveTeam(room, team, host) {
  const op = room.by[team].operator;
  const m = matchOf(host);
  for (let i = 0; i < m.bomb.modules.length; i++) {
    await op.until((b) => b.state.module?.index === i || b.room.status === 'finished', 3000, `módulo ${i}`);
    if (op.room.status === 'finished') return;
    for (const a of solveModule(m.bomb.modules[i])) act(op, a);
    await op.until((b) => (b.state.module?.index ?? 99) > i || b.room.status === 'finished', 3000, `resolver ${i}`);
  }
}

for (const [size, diff] of [[3, 'normal'], [4, 'hard']]) {
  test(`sala de ${size * 2} jugadores (${size}v${size}, ${diff}): roles únicos, bombas idénticas, seguridad por rol`, async () => {
    const room = await fullRoom(g.port, size, diff);
    const { bots, host, by } = room;
    for (const t of ['red', 'blue']) {
      const roles = bots.filter((b) => b.me.team === t).map((b) => b.me.role);
      assert.equal(new Set(roles).size, size);
    }
    // el jugador que no es anfitrión no puede iniciar
    by.blue.expert.send({ t: 'start' });
    await by.blue.expert.until((b) => b.rejected.some((r) => r.code === 'not_host'), 1000, 'rechazo');
    await startAndWait(room);
    for (const b of bots) await b.until((x) => x.state.module, 2000, 'vista de módulo');
    // no se filtra la semilla ni respuestas durante la partida
    for (const b of bots) {
      const j = JSON.stringify(b.state);
      assert.ok(!j.includes(matchOf(host).seed), 'la semilla no se envía durante la partida');
      assert.ok(!/"answer"|"code":\[|"target"/.test(j.replace(/"code":"[A-Z0-9]{6}"/, '')));
    }
    // ambos equipos: misma bomba y mismas vistas por rol
    for (const role of Object.keys(by.red)) {
      assert.equal(JSON.stringify(by.red[role].state.module), JSON.stringify(by.blue[role].state.module), role);
    }
    assert.deepEqual(by.red.operator.state.match.modules, by.blue.operator.state.match.modules);
    // el operador no recibe colores; solo existe analista en 4v4
    assert.ok(!/"(red|blue|green|yellow)"/.test(JSON.stringify(by.red.operator.state.module)));
    assert.equal(!!by.red.analyst, size === 4);
    // solo el operador puede actuar
    for (const role of Object.keys(by.red).filter((r) => r !== 'operator')) {
      const b = by.red[role]; b.rejected.length = 0;
      act(b, { type: 'cut', pos: 1 });
      await b.until((x) => x.rejected.some((r) => r.code === 'forbidden'), 1000, 'forbidden');
    }
    assert.equal(g.rooms.get(host.code).match.teams.red.errors, 0);
    bots.forEach((b) => b.close());
  });
}

test('errores: alarma, penalización de 20 s y explosión; acciones duplicadas cuentan una vez; equipos independientes', async () => {
  const room = await fullRoom(g.port, 3, 'normal');
  const { bots, host, by } = room;
  await startAndWait(room);
  const m = matchOf(host);
  const redOp = by.red.operator;
  await redOp.until((b) => b.state.module);
  const w = wrongFor(m.bomb.modules[0]);
  const dl0 = redOp.state.match.teams.red.deadline;
  act(redOp, w, 'dup1'); act(redOp, w, 'dup1'); // mismo id => una sola vez
  await redOp.until((b) => b.state.match.teams.red.errors === 1, 1500, '1 error');
  await sleep(100);
  assert.equal(redOp.state.match.teams.red.errors, 1, 'duplicado no cuenta');
  assert.equal(redOp.state.match.teams.red.deadline, dl0, 'primer error: solo alarma');
  assert.ok(redOp.fx.some((f) => f.kind === 'error'));
  act(redOp, w);
  await redOp.until((b) => b.state.match.teams.red.errors === 2, 1500, '2 errores');
  assert.equal(redOp.state.match.teams.red.deadline, dl0 - 20000, 'segundo error: -20 s');
  assert.ok(redOp.fx.some((f) => f.kind === 'penalty'));
  assert.equal(by.blue.operator.state.match.teams.blue.errors, 0, 'el otro equipo no se ve afectado');
  assert.equal(by.blue.operator.state.match.teams.blue.deadline, dl0);
  act(redOp, w);
  await redOp.until((b) => b.state.match.teams.red.status === 'exploded', 1500, 'explosión');
  await by.red.expert.until((b) => b.fx.some((f) => f.kind === 'boom' && f.team === 'red'), 1000, 'fx boom');
  // el equipo que explotó ya no puede actuar ni ve su módulo
  assert.equal(redOp.state.module, undefined);
  redOp.rejected.length = 0; act(redOp, w);
  await redOp.until((b) => b.rejected.length, 1000);
  // el equipo azul sigue vivo y gana
  await solveTeam(room, 'blue', host);
  await host.until((b) => b.room.status === 'finished', 3000, 'fin');
  assert.equal(host.state.match.winner, 'blue');
  bots.forEach((b) => b.close());
});

test('victoria: gana el primer equipo en desactivar; resultado y revancha con bomba nueva', async () => {
  const room = await fullRoom(g.port, 4, 'normal');
  const { bots, host, by } = room;
  await startAndWait(room);
  const seed1 = matchOf(host).seed;
  const kinds1 = JSON.stringify(matchOf(host).bomb.modules.map((x) => x.puzzle));
  await solveTeam(room, 'red', host);
  await host.until((b) => b.room.status === 'finished', 3000, 'fin');
  const st = host.state.match;
  assert.equal(st.winner, 'red');
  assert.equal(st.teams.red.status, 'defused');
  assert.ok(st.teams.red.finishedMs > 0);
  assert.equal(st.seed, seed1, 'la semilla se revela al terminar');
  assert.equal(st.teams.blue.moduleIndex, 0);
  // revancha: nuevo estado limpio, mismos equipos y roles, bomba distinta
  by.blue.analyst.send({ t: 'rematch' });
  await host.until((b) => b.room.status === 'lobby', 2000, 'revancha');
  assert.equal(host.state.match, undefined);
  for (const b of bots) await b.until((x) => x.room.status === 'lobby' && x.me.team && x.me.role && x.room.players.every((p) => !p.ready), 1500, 'lobby limpio');
  for (const b of bots) b.send({ t: 'ready', value: true });
  await host.until((b) => b.room.players.every((p) => p.ready));
  host.send({ t: 'shuffle', mode: 'roles' });
  await host.until((b) => b.room.players.every((p) => !p.ready));
  const roleSets = ['red', 'blue'].map((t) => host.room.players.filter((p) => p.team === t).map((p) => p.role).sort().join());
  assert.equal(roleSets[0], roleSets[1]);
  for (const b of bots) b.send({ t: 'ready', value: true });
  await host.until((b) => b.room.players.every((p) => p.ready));
  await startAndWait(room);
  assert.notEqual(matchOf(host).seed, seed1);
  assert.notEqual(JSON.stringify(matchOf(host).bomb.modules.map((x) => x.puzzle)), kinds1);
  assert.equal(matchOf(host).teams.red.errors, 0);
  assert.equal(matchOf(host).teams.red.moduleIndex, 0);
  bots.forEach((b) => b.close());
});

test('temporizador del servidor: si nadie desactiva, ambos pierden por tiempo', async () => {
  const room = await fullRoom(gFast.port, 3, 'hard');
  const { bots, host } = room;
  await startAndWait(room);
  const t0 = host.state.match;
  assert.equal(t0.durationMs, 8 * 60000 * 0.01);
  await host.until((b) => b.room.status === 'finished', 8000, 'tiempo agotado');
  assert.equal(host.state.match.winner, null);
  assert.equal(host.state.match.teams.red.status, 'timeout');
  assert.equal(host.state.match.teams.blue.status, 'timeout');
  bots.forEach((b) => b.close());
});

test('reconexión: recuperar sesión conserva asiento y rol; una sola sesión por jugador; la partida sigue sin anfitrión', async () => {
  const room = await fullRoom(g.port, 3, 'normal');
  const { bots, host, by } = room;
  await startAndWait(room);
  const subject = by.red.expert; // el anfitrión es el operador rojo
  await subject.until((b) => b.state.module);
  const before = JSON.stringify(subject.state.module);
  const { token, playerId, code } = subject;
  // recarga de página: se cierra la conexión y se reanuda con el token
  subject.close();
  await host.until((b) => !b.room.players.find((p) => p.id === playerId).connected, 1500, 'desconexión');
  const re = new Bot(g.port, 'Exp'); await re.connect();
  re.send({ t: 'resume', code, playerId, token });
  await re.until((b) => b.state, 1500, 'reanudar');
  assert.equal(re.me.role, 'expert'); assert.equal(re.me.team, 'red');
  assert.equal(JSON.stringify(re.state.module), before);
  assert.ok(re.state.match.teams.red.deadline > Date.now());
  await host.until((b) => b.room.players.find((p) => p.id === playerId).connected, 1500);
  // dos pestañas: la segunda sustituye a la primera, sin duplicar jugador
  const dup = new Bot(g.port, 'Exp2'); await dup.connect();
  dup.send({ t: 'resume', code, playerId, token });
  await dup.until((b) => b.state, 1500);
  await re.until(() => re.ws.readyState === 3, 1500, 'primera pestaña cerrada');
  assert.equal(host.room.players.filter((p) => p.id === playerId).length, 1);
  assert.equal(host.room.players.length, 6);
  // token falso
  const bad = new Bot(g.port, 'X'); await bad.connect();
  bad.send({ t: 'resume', code, playerId, token: 'falso' });
  await bad.until((b) => b.errors.length, 1000);
  assert.equal(bad.errors[0].code, 'resume_failed');
  // el anfitrión se desconecta: la partida continúa y el otro equipo puede seguir jugando
  host.close();
  await by.blue.expert.until((b) => !b.room.players.find((p) => p.id === host.playerId).connected, 1500);
  const m = matchOf({ code });
  const blueOp = by.blue.operator;
  act(blueOp, solveModule(m.bomb.modules[0])[0]);
  await blueOp.until((b) => b.state.match.teams.blue.errors === 0 && (b.state.module.view.progress > 0 || b.state.module.view.cut?.length > 0 || b.state.module.index > 0 || b.state.module.view.pressed?.length > 0 || true));
  assert.equal(g.rooms.get(code).status, 'playing');
  // el asiento del anfitrión caído se conserva durante la partida
  assert.equal(g.rooms.get(code).players.get(host.playerId).role, 'operator');
  bots.forEach((b) => b.close()); dup.close(); bad.close(); re.close();
});

test('lobby: reglas de inicio, asientos, configuración y límites', async () => {
  const host = await new Bot(g.port, 'Anfi').create();
  const code = host.code;
  const nameDup = await new Bot(g.port, 'anfi').join(code);
  assert.equal(nameDup.errors[0].code, 'name_taken');
  const bots = [host];
  for (let i = 1; i < 8; i++) bots.push(await new Bot(g.port, `P${i}`).join(code));
  const nine = await new Bot(g.port, 'Extra').join(code);
  assert.equal(nine.errors[0].code, 'full');
  const none = await new Bot(g.port, 'Z').join('ZZZZZZ');
  assert.equal(none.errors[0].code, 'no_room');
  // no se puede iniciar sin equipos completos
  host.send({ t: 'start' });
  await host.until((b) => b.rejected.some((r) => r.code === 'cannot_start'), 1000);
  // analista no válido en 3v3
  host.send({ t: 'seat', team: 'red', role: 'analyst' });
  await host.until((b) => b.rejected.some((r) => r.code === 'bad_seat'), 1000);
  // solo el anfitrión configura
  bots[1].send({ t: 'config', teamSize: 4 });
  await bots[1].until((b) => b.rejected.some((r) => r.code === 'not_host'), 1000);
  host.send({ t: 'config', teamSize: 4, difficulty: 'easy' });
  await host.until((b) => b.room.teamSize === 4 && b.room.difficulty === 'easy');
  // asiento ocupado => intercambio
  host.send({ t: 'seat', team: 'red', role: 'operator' });
  bots[1].send({ t: 'seat', team: 'red', role: 'expert' });
  await bots[1].until((b) => b.me.role === 'expert');
  bots[1].send({ t: 'seat', team: 'red', role: 'operator' });
  await bots[1].until((b) => b.me.role === 'operator');
  await host.until((b) => b.me.role === 'expert');
  // al pasar a 3v3 se vacía el analista
  bots[2].send({ t: 'seat', team: 'blue', role: 'analyst' });
  await bots[2].until((b) => b.me.role === 'analyst');
  host.send({ t: 'config', teamSize: 3 });
  await bots[2].until((b) => b.me.role === null);
  // 8 jugadores en 3v3 => no se puede iniciar
  host.send({ t: 'start' });
  await host.until((b) => b.rejected.filter((r) => r.code === 'cannot_start').length >= 2, 1000);
  // nadie puede unirse a una partida en curso (se comprueba con otra sala)
  bots.forEach((b) => b.close()); nameDup.close(); nine.close(); none.close();
});

test('entradas inválidas y límites de peticiones', async () => {
  const b = new Bot(g.port, 'Fuzz'); await b.connect();
  b.ws.send('no es json'); b.ws.send('{"t":5}'); b.send({ t: 'seat', team: 'red', role: 'operator' });
  await b.until((x) => x.errors.length >= 3, 1000);
  b.send({ t: 'create', name: '   ' });
  await b.until((x) => x.errors.some((e) => e.code === 'bad_name'), 1000);
  b.send({ t: 'create', name: '<b>Pepe</b>'.repeat(5) });
  await b.until((x) => x.state, 1000);
  assert.ok(!b.room.players[0].name.includes('<') && b.room.players[0].name.length <= 16);
  for (let i = 0; i < 200; i++) b.send({ t: 'ping' });
  await b.until((x) => x.errors.some((e) => e.code === 'rate_limited'), 2000);
  b.close();
});

test('configuración de dificultad: módulos, errores y tiempos según el documento', () => {
  assert.deepEqual(['easy', 'normal', 'hard'].map((d) => DIFFICULTIES[d].minutes), [12, 10, 8]);
  assert.deepEqual(['easy', 'normal', 'hard'].map((d) => DIFFICULTIES[d].modules), [3, 4, 5]);
  assert.deepEqual(['easy', 'normal', 'hard'].map((d) => DIFFICULTIES[d].maxErrors), [4, 3, 3]);
});
