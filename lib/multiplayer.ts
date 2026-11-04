/**
 * Multiplayer client store — WebSocket only, no database.
 *
 * - One stable sessionId per browser (localStorage), so a reconnect
 *   replaces the old connection instead of duplicating the avatar.
 * - Render and network are independent: the 3D loop never waits for
 *   the socket, and the socket never runs per frame. A bridge (in
 *   app/page.tsx) reads the local player's position ~10x/sec and
 *   sends only when something changed significantly.
 * - Remote movement is interpolated in RemotePlayers.tsx (not here):
 *   this store only holds the latest target per player.
 * - If the socket is absent, fails, or is disabled (solo mode), the
 *   app simply runs offline. No fake players are ever invented.
 */

export type RemoteState = 'idle' | 'walking' | 'sitting' | 'praying' | 'offering_incense';

export interface RemotePlayer {
  id: string;
  name: string;
  color: string;
  /** Latest target from the server (interpolated in 3D, not snapped). */
  target: { x: number; z: number; facing: number; state: RemoteState };
}

export type MpStatus = 'offline' | 'connecting' | 'online' | 'error';

const SESSION_KEY = 'thien-vien-session-id';
const WS_URL_KEY = 'thien-vien-ws-url';
const SOLO_KEY = 'thien-vien-solo';

export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function guestName(sessionId: string): string {
  let h = 0;
  for (let i = 0; i < sessionId.length; i++) h = (h * 31 + sessionId.charCodeAt(i)) >>> 0;
  return `Khách ${1000 + (h % 9000)}`;
}

export function getStoredWsUrl(): string {
  return localStorage.getItem(WS_URL_KEY) || '';
}

export function setStoredWsUrl(url: string) {
  if (url) localStorage.setItem(WS_URL_KEY, url);
  else localStorage.removeItem(WS_URL_KEY);
}

export function getSolo(): boolean {
  return localStorage.getItem(SOLO_KEY) === '1';
}

export function setSolo(v: boolean) {
  localStorage.setItem(SOLO_KEY, v ? '1' : '0');
}

type Listener = () => void;

class MultiplayerStore {
  status: MpStatus = 'offline';
  roomId = '';
  count = 0;
  players = new Map<string, RemotePlayer>();
  /** Timestamp (ms) of the latest remote incense event, per player. */
  incenseAt = new Map<string, number>();
  /** Timestamp (ms) of the latest remote fish-release event, per player. */
  releaseAt = new Map<string, number>();
  private ws: WebSocket | null = null;
  private url = '';
  private name = '';
  private sessionId = '';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private listeners = new Set<Listener>();
  private wantConnect = false;

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  private emit() {
    for (const fn of Array.from(this.listeners)) fn();
  }

  get snapshotVersion(): number {
    return this.players.size * 1000 + this.count;
  }

  connect(url: string, name: string) {
    this.disconnect(false);
    if (!url) {
      this.status = 'offline';
      this.emit();
      return;
    }
    this.url = url;
    this.name = name;
    this.sessionId = getSessionId();
    this.wantConnect = true;
    this.reconnectDelay = 1000;
    this.open();
  }

  private open() {
    if (!this.wantConnect || !this.url) return;
    this.status = 'connecting';
    this.emit();
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.status = 'error';
      this.emit();
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', sessionId: this.sessionId, name: this.name }));
    };
    ws.onmessage = (ev) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      this.handle(msg);
    };
    ws.onerror = () => {
      // onclose carries the state change; don't double-report.
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.players.clear();
      this.count = 0;
      this.roomId = '';
      if (this.wantConnect) {
        this.status = 'error';
        this.emit();
        this.scheduleReconnect();
      } else {
        this.status = 'offline';
        this.emit();
      }
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || !this.wantConnect) return;
    // Exponential backoff, capped at 30s. The sessionId is unchanged,
    // so the server replaces the old avatar instead of duplicating it.
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(30000, this.reconnectDelay * 2);
  }

  disconnect(emit = true) {
    this.wantConnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.players.clear();
    this.count = 0;
    this.roomId = '';
    this.status = 'offline';
    if (emit) this.emit();
  }

  updateName(name: string) {
    this.name = name;
    // Re-join with the same sessionId so the name updates in place.
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'join', sessionId: this.sessionId, name }));
    }
  }

  sendMove(x: number, z: number, facing: number, state: RemoteState) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'move', x, z, facing, state }));
  }

  sendState(state: RemoteState) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'state', state }));
  }

  sendIncense() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'incense' }));
  }

  sendRelease() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'release' }));
  }

  private upsert(p: { id: string; name: string; color: string; x: number; z: number; facing: number; state: RemoteState }) {
    const existing = this.players.get(p.id);
    if (existing) {
      existing.name = p.name;
      existing.color = p.color;
      existing.target = { x: p.x, z: p.z, facing: p.facing, state: p.state };
    } else {
      this.players.set(p.id, {
        id: p.id,
        name: p.name,
        color: p.color,
        target: { x: p.x, z: p.z, facing: p.facing, state: p.state },
      });
    }
  }

  private handle(msg: Record<string, unknown>) {
    if (msg.type === 'welcome') {
      this.status = 'online';
      if (typeof msg.roomId === 'string') this.roomId = msg.roomId;
      const players = msg.players as Array<{ id: string; name: string; color: string; x: number; z: number; facing: number; state: RemoteState }>;
      this.players.clear();
      for (const p of players ?? []) {
        if (p.id !== this.sessionId) this.upsert(p);
      }
      this.count = typeof msg.count === 'number' ? msg.count : this.players.size + 1;
      this.emit();
      return;
    }
    if (msg.type === 'join') {
      const p = msg.player as { id: string; name: string; color: string; x: number; z: number; facing: number; state: RemoteState };
      if (p && p.id !== this.sessionId) {
        this.upsert(p);
        this.emit();
      }
      return;
    }
    if (msg.type === 'leave') {
      if (typeof msg.id === 'string') {
        this.players.delete(msg.id);
        this.emit();
      }
      return;
    }
    if (msg.type === 'move') {
      const id = msg.id as string;
      const p = this.players.get(id);
      if (p) {
        p.target = {
          x: Number(msg.x),
          z: Number(msg.z),
          facing: Number(msg.facing),
          state: (msg.state as RemoteState) || p.target.state,
        };
        // No React re-render per move: RemotePlayers reads target
        // directly every frame and interpolates towards it.
      }
      return;
    }
    if (msg.type === 'state') {
      const p = this.players.get(msg.id as string);
      if (p) p.target.state = msg.state as RemoteState;
      return;
    }
    if (msg.type === 'incense') {
      const id = msg.id as string;
      this.incenseAt.set(id, Date.now());
      const p = this.players.get(id);
      if (p) p.target.state = 'offering_incense';
      this.emit();
      // After 4s the offering pose relaxes back to praying.
      setTimeout(() => {
        const q = this.players.get(id);
        if (q && q.target.state === 'offering_incense') q.target.state = 'praying';
      }, 4000);
      return;
    }
    if (msg.type === 'release') {
      const id = msg.id as string;
      this.releaseAt.set(id, Date.now());
      this.emit();
      return;
    }
    if (msg.type === 'count') {
      if (typeof msg.count === 'number') {
        this.count = msg.count;
        this.emit();
      }
      return;
    }
    if (msg.type === 'full') {
      // Worker entry already tries the next room; a 'full' here means
      // every room is full — stay in solo mode, honestly.
      this.status = 'error';
      this.emit();
    }
  }
}

export const multiplayer = new MultiplayerStore();
