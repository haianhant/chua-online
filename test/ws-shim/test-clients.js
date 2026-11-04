/**
 * Tests the shim (and therefore the protocol the frontend speaks):
 * 2 clients see each other's moves, late joiner gets a snapshot,
 * leave removes the avatar, reconnect with the same sessionId does
 * NOT duplicate, incense is broadcast once per 5s, impossible jumps
 * are clamped, spam is dropped, and a 16th client lands in room 2.
 * Usage: node server.js in one terminal, then node test-clients.js
 */
const WebSocket = require('ws');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function client(sessionId, name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:8787/ws');
    const received = [];
    let welcome = null;
    ws.on('message', (d) => {
      const m = JSON.parse(d);
      received.push(m);
      if (m.type === 'welcome') { welcome = m; resolve({ ws, received, welcome }); }
      if (m.type === 'full') reject(new Error('full'));
    });
    ws.on('error', reject);
    ws.on('open', () => ws.send(JSON.stringify({ type: 'join', sessionId, name })));
  });
}
function count(received, type, id) {
  return received.filter((m) => m.type === type && (!id || m.id === id || m.player?.id === id)).length;
}
(async () => {
  const results = [];
  const check = (label, ok, extra = '') => { results.push([ok, label, extra]); console.log(`${ok ? 'PASS' : 'FAIL'} ${label} ${extra}`); };

  const A = await client('sess-A', 'Hải Anh');
  const B = await client('sess-B', 'Minh');
  await sleep(200);
  check('B sees A join (welcome snapshot includes A)', A.welcome.players.length === 1 && B.welcome.players.some((p) => p.id === 'sess-A'), `B snapshot: ${B.welcome.players.map((p) => p.id)}`);
  check('Room assignment is chua-chung for both', A.welcome.roomId === 'chua-chung' && B.welcome.roomId === 'chua-chung', `${A.welcome.roomId} / ${B.welcome.roomId}`);
  check('Count after 2 joins is 2', B.welcome.count === 2, `count=${B.welcome.count}`);

  // Move latency: 20 moves from A, measure time until B receives each
  const latencies = [];
  for (let i = 0; i < 20; i++) {
    const x = 0.2 * i; // slow walk, within speed cap
    const t0 = Date.now();
    A.ws.send(JSON.stringify({ type: 'move', x, z: 17.5, facing: 0, state: 'walking' }));
    const before = B.received.length;
    const deadline = Date.now() + 1000;
    while (B.received.length === before && Date.now() < deadline) await sleep(5);
    if (B.received.length > before) latencies.push(Date.now() - t0);
    await sleep(100);
  }
  check('A move reaches B (20/20)', latencies.length === 20, `avg latency ${latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : '?'}ms, max ${latencies.length ? Math.max(...latencies) : '?'}ms`);
  const lastMove = B.received.filter((m) => m.type === 'move' && m.id === 'sess-A').pop();
  check('B sees A near final position (no teleport yank)', lastMove && Math.abs(lastMove.x - 3.8) < 0.6, `x=${lastMove?.x}`);

  // Late joiner snapshot
  const C = await client('sess-C', 'Lan');
  await sleep(200);
  check('Late joiner C snapshot includes A and B', C.welcome.players.some((p) => p.id === 'sess-A') && C.welcome.players.some((p) => p.id === 'sess-B'), `C: ${C.welcome.players.map((p) => p.id)}`);
  check('Count after 3 joins is 3', C.welcome.count === 3, `count=${C.welcome.count}`);

  // Incense: once, then second within 5s dropped
  const incBefore = count(B.received, 'incense', 'sess-A');
  A.ws.send(JSON.stringify({ type: 'incense' }));
  await sleep(300);
  A.ws.send(JSON.stringify({ type: 'incense' }));
  await sleep(300);
  check('Incense broadcast exactly once (second within 5s dropped)', count(B.received, 'incense', 'sess-A') - incBefore === 1, `incense=${count(B.received, 'incense', 'sess-A') - incBefore}`);

  // Impossible jump is clamped, not teleported
  A.ws.send(JSON.stringify({ type: 'move', x: 100, z: 100, facing: 0, state: 'walking' }));
  await sleep(300);
  const jumped = B.received.filter((m) => m.type === 'move' && m.id === 'sess-A').pop();
  check('Impossible jump clamped to courtyard', jumped && jumped.x <= 13 && jumped.z <= 19.5 && Math.abs(jumped.x) < 20, `x=${jumped?.x}, z=${jumped?.z}`);

  // Spam: 50 moves in <1s should be dropped above 20/sec
  const movesBefore = count(B.received, 'move', 'sess-A');
  for (let i = 0; i < 50; i++) A.ws.send(JSON.stringify({ type: 'move', x: 1, z: 17.5, facing: 0, state: 'walking' }));
  await sleep(500);
  const movesAfter = count(B.received, 'move', 'sess-A') - movesBefore;
  check('Spam dropped (50 sent, far fewer broadcast)', movesAfter < 50, `broadcast=${movesAfter}`);

  // Leave
  A.ws.close();
  await sleep(400);
  check('A leave reaches B', count(B.received, 'leave', 'sess-A') >= 1, `leaves=${count(B.received, 'leave', 'sess-A')}`);

  // Reconnect with same sessionId: exactly one join, no duplicate
  const joinsBefore = count(B.received, 'join', 'sess-A');
  const A2 = await client('sess-A', 'Hải Anh');
  await sleep(300);
  check('Reconnect gives exactly one join (no duplicate avatar)', count(B.received, 'join', 'sess-A') - joinsBefore === 1, `joins=${count(B.received, 'join', 'sess-A') - joinsBefore}`);
  check('Reconnect snapshot room is still chua-chung', A2.welcome.roomId === 'chua-chung', A2.welcome.roomId);

  // 15-player room + overflow: fill room 1 to 15, 16th lands in room 2
  const extras = [];
  for (let i = 0; i < 12; i++) extras.push(await client(`sess-X${i}`, `Khách ${i}`));
  await sleep(300);
  const sixteenth = await client('sess-16', 'Người thứ 16');
  await sleep(200);
  check('16th client lands in room 2 (room 1 full at 15)', sixteenth.welcome.roomId === 'chua-chung-2', `room=${sixteenth.welcome.roomId}, count=${sixteenth.welcome.count}`);

  // Message rate at bridge pace (10/sec while walking)
  const rateBefore = B.received.length;
  const t0 = Date.now();
  for (let i = 0; i < 20; i++) { A2.ws.send(JSON.stringify({ type: 'move', x: 2 + i * 0.1, z: 17.5, facing: 0, state: 'walking' })); await sleep(100); }
  const rate = (B.received.length - rateBefore) / ((Date.now() - t0) / 1000);
  check('Bridge-rate moves arrive at ~10/sec (not per-frame)', rate >= 5 && rate <= 15, `${rate.toFixed(1)}/sec`);

  console.log(`\n${results.filter((r) => r[0]).length}/${results.length} checks passed`);
  process.exit(results.every((r) => r[0]) ? 0 : 1);
})().catch((e) => { console.error('TEST ERROR', e); process.exit(2); });
