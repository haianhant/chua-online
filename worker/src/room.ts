/**
 * TempleRoom — one Cloudflare Durable Object = one temple room.
 *
 * Design rules (see worker/README.md):
 * - No database for continuous position. Player state lives only in
 *   this object's memory while connected, and is forgotten on leave.
 *   Nothing about prayers, real names or real-world location is stored.
 * - One player = one sessionId, chosen by the client and kept in its
 *   localStorage. Reconnecting with the same sessionId REPLACES the
 *   old socket, so a reconnect never creates a duplicate avatar.
 * - The server never trusts the client: it clamps positions to the
 *   courtyard, caps speed, sanitises names, and rate-limits messages.
 * - Audio is never broadcast. Only position, facing, animation state
 *   and transient incense / fish-release events leave a client.
 * - WebSocket hibernation is used (acceptWebSocket + webSocket*
 *   handlers) so an idle room costs no duration on the free tier.
 */

export type PlayerState = 'idle' | 'walking' | 'sitting' | 'praying' | 'offering_incense';

export interface Player {
  id: string;
  name: string;
  color: string;
  x: number;
  z: number;
  facing: number;
  state: PlayerState;
}

export const ROOM_CAPACITY = 15;
export const BOUNDS = { minX: -13, maxX: 13, minZ: -15, maxZ: 19.5 };
const MAX_SPEED = 6; // m/s, with tolerance for network jitter
const MAX_MSG_PER_SEC = 20;
const INCENSE_MIN_INTERVAL_MS = 5000;

export const TUNIC_COLORS = ['#e8e0cc', '#cfe0f0', '#f0d0d8', '#d8e8c8', '#e8ddc0', '#ddd0e8'];

export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return 'Khách';
  // Strip anything that could break a UI: angle brackets, slashes,
  // backslashes, control characters. React also renders names as text,
  // never as HTML, so this is defence in depth.
  const clean = raw.replace(/[<>&/\\]/g, '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 30);
  return clean || 'Khách';
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

interface Session {
  id: string;
  name: string;
  color: string;
  x: number;
  z: number;
  facing: number;
  state: PlayerState;
  lastUpdate: number;
  msgTimes: number[];
  lastIncense: number;
  lastRelease: number;
}

export class TempleRoom {
  private ctx: DurableObjectState;
  private roomId = 'chua-chung';
  private sessions = new Map<string, Session>();
  private bySocket = new Map<WebSocket, string>();

  constructor(ctx: DurableObjectState) {
    this.ctx = ctx;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/__count') {
      return Response.json({ count: this.sessions.size });
    }
    this.roomId = request.headers.get('x-room-id') || this.roomId;
    const upgrade = request.headers.get('Upgrade');
    if (upgrade !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    // Hibernation: the object sleeps while idle; handlers below wake it.
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  private broadcast(msg: object, exceptId?: string) {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        const att = (ws as unknown as { deserializeAttachment?: () => { id?: string } }).deserializeAttachment?.();
        if (exceptId && att?.id === exceptId) continue;
        ws.send(data);
      } catch {
        // A dead socket is cleaned up on webSocketClose.
      }
    }
  }

  private send(ws: WebSocket, msg: object) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // ignore
    }
  }

  private publicPlayer(s: Session): Player {
    return {
      id: s.id,
      name: s.name,
      color: s.color,
      x: s.x,
      z: s.z,
      facing: s.facing,
      state: s.state,
    };
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));
    } catch {
      return;
    }
    const now = Date.now();

    if (msg.type === 'join') {
      const sessionId = typeof msg.sessionId === 'string' ? msg.sessionId.slice(0, 64) : '';
      if (!sessionId) {
        this.send(ws, { type: 'error', message: 'Missing sessionId' });
        return;
      }
      // Reconnect with the same sessionId replaces the old socket:
      // no duplicate avatar, ever.
      for (const [oldWs, oldId] of this.bySocket.entries()) {
        if (oldId === sessionId && oldWs !== ws) {
          try {
            oldWs.close(1000, 'Replaced by reconnect');
          } catch {
            // ignore
          }
          this.bySocket.delete(oldWs);
        }
      }
      if (this.sessions.size >= ROOM_CAPACITY && !this.sessions.has(sessionId)) {
        this.send(ws, { type: 'full', message: 'Room is full' });
        return;
      }
      const name = sanitizeName(msg.name);
      const color = TUNIC_COLORS[hashString(sessionId) % TUNIC_COLORS.length];
      const existing = this.sessions.get(sessionId);
      const session: Session = existing ?? {
        id: sessionId,
        name,
        color,
        x: 0,
        z: 17.5,
        facing: Math.PI,
        state: 'idle',
        lastUpdate: now,
        msgTimes: [],
        lastIncense: 0,
        lastRelease: 0,
      };
      session.name = name;
      session.msgTimes = [];
      this.sessions.set(sessionId, session);
      this.bySocket.set(ws, sessionId);
      try {
        (ws as unknown as { serializeAttachment: (v: unknown) => void }).serializeAttachment({ id: sessionId });
      } catch {
        // Older runtimes without attachments: bySocket covers it.
      }
      // Snapshot to the newcomer (so they see everyone already here),
      // then a join broadcast to everyone else.
      this.send(ws, {
        type: 'welcome',
        id: sessionId,
        roomId: this.roomId,
        players: [...this.sessions.values()].map((s) => this.publicPlayer(s)),
        count: this.sessions.size,
      });
      this.broadcast({ type: 'join', player: this.publicPlayer(session) }, sessionId);
      this.broadcast({ type: 'count', count: this.sessions.size });
      return;
    }

    const att = (ws as unknown as { deserializeAttachment?: () => { id?: string } }).deserializeAttachment?.();
    const sessionId = att?.id ?? this.bySocket.get(ws);
    if (!sessionId) return;
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Rate limit: drop (and eventually close) abusive connections.
    session.msgTimes = session.msgTimes.filter((t) => now - t < 1000);
    session.msgTimes.push(now);
    if (session.msgTimes.length > MAX_MSG_PER_SEC * 2) {
      try {
        ws.close(1011, 'Rate limit exceeded');
      } catch {
        // ignore
      }
      return;
    }
    if (session.msgTimes.length > MAX_MSG_PER_SEC) return; // drop, don't broadcast

    if (msg.type === 'move') {
      const x = clamp(Number(msg.x) || 0, BOUNDS.minX, BOUNDS.maxX);
      const z = clamp(Number(msg.z) || 0, BOUNDS.minZ, BOUNDS.maxZ);
      const facing = Number(msg.facing) || 0;
      const state = ['idle', 'walking', 'sitting', 'praying'].includes(String(msg.state))
        ? (msg.state as PlayerState)
        : session.state;
      // Speed cap: clamp a jump to what is physically reachable since
      // the last accepted update, instead of teleporting the avatar.
      const dt = Math.max(0.05, (now - session.lastUpdate) / 1000);
      const dx = x - session.x;
      const dz = z - session.z;
      const dist = Math.hypot(dx, dz);
      const maxDist = MAX_SPEED * dt + 0.5;
      let nx = x;
      let nz = z;
      if (dist > maxDist && dist > 0) {
        nx = session.x + (dx / dist) * maxDist;
        nz = session.z + (dz / dist) * maxDist;
      }
      session.x = nx;
      session.z = nz;
      session.facing = facing;
      session.state = state;
      session.lastUpdate = now;
      this.broadcast({ type: 'move', id: sessionId, x: nx, z: nz, facing, state, t: now }, sessionId);
      return;
    }

    if (msg.type === 'state') {
      const state = String(msg.state);
      if (['idle', 'walking', 'sitting', 'praying', 'offering_incense'].includes(state)) {
        session.state = state as PlayerState;
        session.lastUpdate = now;
        this.broadcast({ type: 'state', id: sessionId, state }, sessionId);
      }
      return;
    }

    if (msg.type === 'incense') {
      if (now - session.lastIncense < INCENSE_MIN_INTERVAL_MS) return;
      session.lastIncense = now;
      session.state = 'offering_incense';
      // One transient event for everyone else. The burner itself is
      // never moved, rotated or resized by this — clients render only
      // a short smoke puff at the fixed burner position.
      this.broadcast({ type: 'incense', id: sessionId, t: now }, sessionId);
      this.broadcast({ type: 'state', id: sessionId, state: 'offering_incense' }, sessionId);
      return;
    }

    if (msg.type === 'release') {
      if (now - session.lastRelease < INCENSE_MIN_INTERVAL_MS) return;
      session.lastRelease = now;
      // Transient only: other clients render one ripple + one fish
      // locally. No fish, no history, no database is synced.
      this.broadcast({ type: 'release', id: sessionId, t: now }, sessionId);
      return;
    }

    if (msg.type === 'ping') {
      this.send(ws, { type: 'pong' });
    }
  }

  async webSocketClose(ws: WebSocket) {
    const att = (ws as unknown as { deserializeAttachment?: () => { id?: string } }).deserializeAttachment?.();
    const sessionId = att?.id ?? this.bySocket.get(ws);
    this.bySocket.delete(ws);
    if (!sessionId) return;
    // Only remove if this socket is still the current one for the
    // session (a reconnect may already have replaced it).
    const current = [...this.bySocket.entries()].find(([, id]) => id === sessionId);
    if (current) return;
    if (this.sessions.delete(sessionId)) {
      this.broadcast({ type: 'leave', id: sessionId });
      this.broadcast({ type: 'count', count: this.sessions.size });
    }
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }
}
