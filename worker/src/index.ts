/**
 * Worker entry: routes WebSocket upgrades to a TempleRoom Durable
 * Object, trying rooms in order so a full room never blocks entry —
 * the client is simply placed in the next room with space.
 *
 * Routes:
 *   GET /health            -> { ok: true }
 *   GET /api/rooms         -> [{ roomId, count }] for every room
 *   GET /ws?room=<id>      -> WebSocket upgrade to that room, or the
 *                             first room with space if it is full
 *                             (or no room was requested).
 */
import { TempleRoom, ROOM_CAPACITY } from './room';

export { TempleRoom };

export interface Env {
  // Structural type: the runtime provides getByName; the generic
  // DurableObjectNamespace<TempleRoom> brand is not satisfied by a
  // plain class, so type the binding by its shape instead.
  TEMPLE_ROOM: {
    getByName(name: string): DurableObjectStub;
  };
}

const ROOMS = ['chua-chung', 'chua-chung-2', 'chua-chung-3', 'chua-chung-4', 'chua-chung-5'];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

async function roomCount(env: Env, roomId: string): Promise<number> {
  try {
    const stub = env.TEMPLE_ROOM.getByName(roomId);
    const res = await stub.fetch('http://room/__count');
    const data = (await res.json()) as { count?: number };
    return data.count ?? 0;
  } catch {
    return 0;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }
    if (url.pathname === '/health') {
      return Response.json({ ok: true, rooms: ROOMS, capacity: ROOM_CAPACITY }, { headers: cors });
    }
    if (url.pathname === '/api/rooms') {
      const counts = await Promise.all(ROOMS.map((id) => roomCount(env, id)));
      return Response.json(
        ROOMS.map((roomId, i) => ({ roomId, count: counts[i], capacity: ROOM_CAPACITY })),
        { headers: cors },
      );
    }
    if (url.pathname === '/ws') {
      const requested = url.searchParams.get('room');
      const candidates = requested ? [requested, ...ROOMS.filter((r) => r !== requested)] : ROOMS;
      for (const roomId of candidates) {
        const count = await roomCount(env, roomId);
        if (count < ROOM_CAPACITY) {
          const stub = env.TEMPLE_ROOM.getByName(roomId);
          // Pass the room id along so the DO can report it in
          // welcome messages (a DO does not know its own name).
          const forwarded = new Request(request, {
            headers: { ...Object.fromEntries(request.headers.entries()), 'x-room-id': roomId },
          });
          return stub.fetch(forwarded);
        }
      }
      return Response.json({ error: 'All rooms are full' }, { status: 503, headers: cors });
    }
    return new Response('Not found', { status: 404, headers: cors });
  },
};
