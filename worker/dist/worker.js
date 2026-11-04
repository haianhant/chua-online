// src/room.ts
var ROOM_CAPACITY = 15;
var BOUNDS = { minX: -13, maxX: 13, minZ: -15, maxZ: 19.5 };
var MAX_SPEED = 6;
var MAX_MSG_PER_SEC = 20;
var INCENSE_MIN_INTERVAL_MS = 5e3;
var TUNIC_COLORS = ["#e8e0cc", "#cfe0f0", "#f0d0d8", "#d8e8c8", "#e8ddc0", "#ddd0e8"];
function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++)
    h = h * 31 + s.charCodeAt(i) >>> 0;
  return h;
}
function sanitizeName(raw) {
  if (typeof raw !== "string")
    return "Kh\xE1ch";
  const clean = raw.replace(/[<>&/\\]/g, "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 30);
  return clean || "Kh\xE1ch";
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
var TempleRoom = class {
  constructor(ctx) {
    this.roomId = "chua-chung";
    this.sessions = /* @__PURE__ */ new Map();
    this.bySocket = /* @__PURE__ */ new Map();
    this.ctx = ctx;
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/__count") {
      return Response.json({ count: this.sessions.size });
    }
    this.roomId = request.headers.get("x-room-id") || this.roomId;
    const upgrade = request.headers.get("Upgrade");
    if (upgrade !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }
  broadcast(msg, exceptId) {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        const att = ws.deserializeAttachment?.();
        if (exceptId && att?.id === exceptId)
          continue;
        ws.send(data);
      } catch {
      }
    }
  }
  send(ws, msg) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
    }
  }
  publicPlayer(s) {
    return {
      id: s.id,
      name: s.name,
      color: s.color,
      x: s.x,
      z: s.z,
      facing: s.facing,
      state: s.state
    };
  }
  async webSocketMessage(ws, message) {
    let msg;
    try {
      msg = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message));
    } catch {
      return;
    }
    const now = Date.now();
    if (msg.type === "join") {
      const sessionId2 = typeof msg.sessionId === "string" ? msg.sessionId.slice(0, 64) : "";
      if (!sessionId2) {
        this.send(ws, { type: "error", message: "Missing sessionId" });
        return;
      }
      for (const [oldWs, oldId] of this.bySocket.entries()) {
        if (oldId === sessionId2 && oldWs !== ws) {
          try {
            oldWs.close(1e3, "Replaced by reconnect");
          } catch {
          }
          this.bySocket.delete(oldWs);
        }
      }
      if (this.sessions.size >= ROOM_CAPACITY && !this.sessions.has(sessionId2)) {
        this.send(ws, { type: "full", message: "Room is full" });
        return;
      }
      const name = sanitizeName(msg.name);
      const color = TUNIC_COLORS[hashString(sessionId2) % TUNIC_COLORS.length];
      const existing = this.sessions.get(sessionId2);
      const session2 = existing ?? {
        id: sessionId2,
        name,
        color,
        x: 0,
        z: 17.5,
        facing: Math.PI,
        state: "idle",
        lastUpdate: now,
        msgTimes: [],
        lastIncense: 0,
        lastRelease: 0
      };
      session2.name = name;
      session2.msgTimes = [];
      this.sessions.set(sessionId2, session2);
      this.bySocket.set(ws, sessionId2);
      try {
        ws.serializeAttachment({ id: sessionId2 });
      } catch {
      }
      this.send(ws, {
        type: "welcome",
        id: sessionId2,
        roomId: this.roomId,
        players: [...this.sessions.values()].map((s) => this.publicPlayer(s)),
        count: this.sessions.size
      });
      this.broadcast({ type: "join", player: this.publicPlayer(session2) }, sessionId2);
      this.broadcast({ type: "count", count: this.sessions.size });
      return;
    }
    const att = ws.deserializeAttachment?.();
    const sessionId = att?.id ?? this.bySocket.get(ws);
    if (!sessionId)
      return;
    const session = this.sessions.get(sessionId);
    if (!session)
      return;
    session.msgTimes = session.msgTimes.filter((t) => now - t < 1e3);
    session.msgTimes.push(now);
    if (session.msgTimes.length > MAX_MSG_PER_SEC * 2) {
      try {
        ws.close(1011, "Rate limit exceeded");
      } catch {
      }
      return;
    }
    if (session.msgTimes.length > MAX_MSG_PER_SEC)
      return;
    if (msg.type === "move") {
      const x = clamp(Number(msg.x) || 0, BOUNDS.minX, BOUNDS.maxX);
      const z = clamp(Number(msg.z) || 0, BOUNDS.minZ, BOUNDS.maxZ);
      const facing = Number(msg.facing) || 0;
      const state = ["idle", "walking", "sitting", "praying"].includes(String(msg.state)) ? msg.state : session.state;
      const dt = Math.max(0.05, (now - session.lastUpdate) / 1e3);
      const dx = x - session.x;
      const dz = z - session.z;
      const dist = Math.hypot(dx, dz);
      const maxDist = MAX_SPEED * dt + 0.5;
      let nx = x;
      let nz = z;
      if (dist > maxDist && dist > 0) {
        nx = session.x + dx / dist * maxDist;
        nz = session.z + dz / dist * maxDist;
      }
      session.x = nx;
      session.z = nz;
      session.facing = facing;
      session.state = state;
      session.lastUpdate = now;
      this.broadcast({ type: "move", id: sessionId, x: nx, z: nz, facing, state, t: now }, sessionId);
      return;
    }
    if (msg.type === "state") {
      const state = String(msg.state);
      if (["idle", "walking", "sitting", "praying", "offering_incense"].includes(state)) {
        session.state = state;
        session.lastUpdate = now;
        this.broadcast({ type: "state", id: sessionId, state }, sessionId);
      }
      return;
    }
    if (msg.type === "incense") {
      if (now - session.lastIncense < INCENSE_MIN_INTERVAL_MS)
        return;
      session.lastIncense = now;
      session.state = "offering_incense";
      this.broadcast({ type: "incense", id: sessionId, t: now }, sessionId);
      this.broadcast({ type: "state", id: sessionId, state: "offering_incense" }, sessionId);
      return;
    }
    if (msg.type === "release") {
      if (now - session.lastRelease < INCENSE_MIN_INTERVAL_MS)
        return;
      session.lastRelease = now;
      this.broadcast({ type: "release", id: sessionId, t: now }, sessionId);
      return;
    }
    if (msg.type === "ping") {
      this.send(ws, { type: "pong" });
    }
  }
  async webSocketClose(ws) {
    const att = ws.deserializeAttachment?.();
    const sessionId = att?.id ?? this.bySocket.get(ws);
    this.bySocket.delete(ws);
    if (!sessionId)
      return;
    const current = [...this.bySocket.entries()].find(([, id]) => id === sessionId);
    if (current)
      return;
    if (this.sessions.delete(sessionId)) {
      this.broadcast({ type: "leave", id: sessionId });
      this.broadcast({ type: "count", count: this.sessions.size });
    }
  }
  async webSocketError(ws) {
    await this.webSocketClose(ws);
  }
};

// src/index.ts
var ROOMS = ["chua-chung", "chua-chung-2", "chua-chung-3", "chua-chung-4", "chua-chung-5"];
var cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*"
};
async function roomCount(env, roomId) {
  try {
    const stub = env.TEMPLE_ROOM.getByName(roomId);
    const res = await stub.fetch("http://room/__count");
    const data = await res.json();
    return data.count ?? 0;
  } catch {
    return 0;
  }
}
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }
    if (url.pathname === "/health") {
      return Response.json({ ok: true, rooms: ROOMS, capacity: ROOM_CAPACITY }, { headers: cors });
    }
    if (url.pathname === "/api/rooms") {
      const counts = await Promise.all(ROOMS.map((id) => roomCount(env, id)));
      return Response.json(
        ROOMS.map((roomId, i) => ({ roomId, count: counts[i], capacity: ROOM_CAPACITY })),
        { headers: cors }
      );
    }
    if (url.pathname === "/ws") {
      const requested = url.searchParams.get("room");
      const candidates = requested ? [requested, ...ROOMS.filter((r) => r !== requested)] : ROOMS;
      for (const roomId of candidates) {
        const count = await roomCount(env, roomId);
        if (count < ROOM_CAPACITY) {
          const stub = env.TEMPLE_ROOM.getByName(roomId);
          const forwarded = new Request(request, {
            headers: { ...Object.fromEntries(request.headers.entries()), "x-room-id": roomId }
          });
          return stub.fetch(forwarded);
        }
      }
      return Response.json({ error: "All rooms are full" }, { status: 503, headers: cors });
    }
    return new Response("Not found", { status: 404, headers: cors });
  }
};
export {
  TempleRoom,
  src_default as default
};
