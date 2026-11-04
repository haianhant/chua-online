/**
 * Local test shim — NOT the production Durable Object.
 * Implements the same protocol and the same server rules as
 * worker/src/room.ts + worker/src/index.ts (room assignment in
 * order, capacity 15, name sanitising, bounds + speed clamp,
 * 20 msg/sec rate limit, incense 1 per 5s, reconnect replaces the
 * old socket) so the frontend client can be tested without a
 * Cloudflare account. Run: node server.js  (port 8787)
 */
const { WebSocketServer } = require('ws');
const ROOMS = ['chua-chung', 'chua-chung-2', 'chua-chung-3', 'chua-chung-4', 'chua-chung-5'];
const CAPACITY = 15;
const BOUNDS = { minX: -13, maxX: 13, minZ: -15, maxZ: 19.5 };
const COLORS = ['#e8e0cc', '#cfe0f0', '#f0d0d8', '#d8e8c8', '#e8ddc0', '#ddd0e8'];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const sanitize = (raw) => {
  if (typeof raw !== 'string') return 'Khách';
  const c = raw.replace(/[<>&/\\]/g, '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 30);
  return c || 'Khách';
};

const rooms = new Map(ROOMS.map((id) => [id, new Map()]));
const sockets = new Map(); // ws -> { roomId, sessionId }

function broadcast(roomId, msg, exceptId) {
  const data = JSON.stringify(msg);
  for (const [ws, meta] of sockets.entries()) {
    if (meta.roomId === roomId && meta.sessionId !== exceptId && ws.readyState === 1) ws.send(data);
  }
}
function pub(s) { return { id: s.id, name: s.name, color: s.color, x: s.x, z: s.z, facing: s.facing, state: s.state }; }

const wss = new WebSocketServer({ port: 8787 });
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const requested = url.searchParams.get('room');
  const candidates = requested ? [requested, ...ROOMS.filter((r) => r !== requested)] : ROOMS;
  let roomId = null;
  for (const r of candidates) { if (rooms.get(r).size < CAPACITY) { roomId = r; break; } }
  if (!roomId) { ws.send(JSON.stringify({ type: 'full' })); ws.close(); return; }
  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    const now = Date.now();
    if (msg.type === 'join') {
      const sessionId = String(msg.sessionId || '').slice(0, 64);
      if (!sessionId) { ws.send(JSON.stringify({ type: 'error', message: 'Missing sessionId' })); return; }
      const room = rooms.get(roomId);
      for (const [oldWs, meta] of sockets.entries()) {
        if (meta.sessionId === sessionId && oldWs !== ws) { try { oldWs.close(1000, 'Replaced'); } catch {} sockets.delete(oldWs); }
      }
      if (room.size >= CAPACITY && !room.has(sessionId)) { ws.send(JSON.stringify({ type: 'full' })); return; }
      const existing = room.get(sessionId);
      const s = existing || { id: sessionId, name: sanitize(msg.name), color: COLORS[hash(sessionId) % COLORS.length], x: 0, z: 17.5, facing: Math.PI, state: 'idle', lastUpdate: now, msgTimes: [], lastIncense: 0 };
      s.name = sanitize(msg.name); s.msgTimes = [];
      room.set(sessionId, s);
      sockets.set(ws, { roomId, sessionId });
      ws.send(JSON.stringify({ type: 'welcome', id: sessionId, roomId, players: Array.from(room.values()).map(pub), count: room.size }));
      broadcast(roomId, { type: 'join', player: pub(s) }, sessionId);
      broadcast(roomId, { type: 'count', count: room.size });
      return;
    }
    const meta = sockets.get(ws); if (!meta) return;
    const room = rooms.get(meta.roomId); const s = room.get(meta.sessionId); if (!s) return;
    s.msgTimes = s.msgTimes.filter((t) => now - t < 1000); s.msgTimes.push(now);
    if (s.msgTimes.length > 40) { ws.close(1011, 'Rate limit'); return; }
    if (s.msgTimes.length > 20) return;
    if (msg.type === 'move') {
      const x = clamp(Number(msg.x) || 0, BOUNDS.minX, BOUNDS.maxX);
      const z = clamp(Number(msg.z) || 0, BOUNDS.minZ, BOUNDS.maxZ);
      const facing = Number(msg.facing) || 0;
      const state = ['idle', 'walking', 'sitting', 'praying'].includes(String(msg.state)) ? msg.state : s.state;
      const dt = Math.max(0.05, (now - s.lastUpdate) / 1000);
      const dx = x - s.x, dz = z - s.z, dist = Math.hypot(dx, dz), maxDist = 6 * dt + 0.5;
      let nx = x, nz = z;
      if (dist > maxDist && dist > 0) { nx = s.x + (dx / dist) * maxDist; nz = s.z + (dz / dist) * maxDist; }
      s.x = nx; s.z = nz; s.facing = facing; s.state = state; s.lastUpdate = now;
      broadcast(meta.roomId, { type: 'move', id: s.id, x: nx, z: nz, facing, state, t: now }, s.id);
      return;
    }
    if (msg.type === 'state') {
      if (['idle', 'walking', 'sitting', 'praying', 'offering_incense'].includes(String(msg.state))) {
        s.state = msg.state; s.lastUpdate = now;
        broadcast(meta.roomId, { type: 'state', id: s.id, state: s.state }, s.id);
      }
      return;
    }
    if (msg.type === 'incense') {
      if (now - s.lastIncense < 5000) return;
      s.lastIncense = now; s.state = 'offering_incense';
      broadcast(meta.roomId, { type: 'incense', id: s.id, t: now }, s.id);
      broadcast(meta.roomId, { type: 'state', id: s.id, state: 'offering_incense' }, s.id);
      return;
    }
    if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
  });
  ws.on('close', () => {
    const meta = sockets.get(ws); sockets.delete(ws); if (!meta) return;
    const still = Array.from(sockets.values()).some((m) => m.sessionId === meta.sessionId);
    if (still) return;
    const room = rooms.get(meta.roomId);
    if (room.delete(meta.sessionId)) {
      broadcast(meta.roomId, { type: 'leave', id: meta.sessionId });
      broadcast(meta.roomId, { type: 'count', count: room.size });
    }
  });
});
console.log('shim listening on ws://localhost:8787/ws');
