# Thiền Viện Trực Tuyến — Multiplayer Worker (Cloudflare)

One Cloudflare Worker + one Durable Object class (`TempleRoom`) per
temple room. The frontend stays on Vercel; only realtime traffic goes
here, over WebSocket.

## Why Durable Objects (and the alternatives)

| Option | Pros | Cons |
|---|---|---|
| **Cloudflare Durable Objects (chosen)** | Stateful room in one place, WebSocket hibernation (idle rooms cost no duration), free tier: 100k DO requests/day + 13,000 GB-s/day, no server to babysit, edge latency | Needs a Cloudflare account + API token to deploy; proprietary runtime (workerd), not plain Node |
| Supabase Realtime / Firebase | Managed, easy auth, generous free tier | Another account + keys, Postgres/presence model is heavier than a room DO, costs grow with presence updates |
| Ably / Pusher | Excellent realtime, no server code | Paid beyond a small free quota, message-based pricing adds up at 10 Hz movement |
| Self-hosted Node WebSocket server | Full control, no vendor lock-in | You pay for and babysit a VM 24/7, need TLS, scaling and reconnect handling yourself |
| Vercel alone | Frontend already there | Serverless functions cannot hold a persistent WebSocket connection (Hobby max duration), so Vercel alone cannot do this |

## Deploy (needs a Cloudflare account)

```bash
cd worker
npm install
npx wrangler login        # or: CLOUDFLARE_API_TOKEN=... npx wrangler deploy
npx wrangler deploy
```

Note the Worker URL it prints, e.g.
`https://chua-online-temple.<your-subdomain>.workers.dev`.
Then tell the frontend about it in one of two ways (no code change):

1. Rebuild the frontend with
   `NEXT_PUBLIC_MULTIPLAYER_WS_URL=wss://chua-online-temple.<subdomain>.workers.dev/ws`
   and redeploy to Vercel, or
2. In the app: Cài đặt → "Địa chỉ phòng chung (WebSocket)" → paste the
   `wss://…/ws` URL → the app reconnects immediately and remembers it
   in localStorage (`thien-vien-ws-url`).

Until a Worker URL is configured, the app runs in solo mode
automatically — nothing breaks, nobody is shown as a fake player.

## Protocol (also implemented by the local test shim)

Client → server: `join {sessionId, name}`, `move {x, z, facing, state}`,
`state {state}`, `incense {}`, `ping`.
Server → client: `welcome {id, players, count}`,
`join {player}`, `leave {id}`, `move {id, x, z, facing, state, t}`,
`state {id, state}`, `incense {id, t}`, `count {count}`, `error`, `pong`.

Server-side rules: names are sanitised (max 30 chars, no `<>&/\`),
positions are clamped to the courtyard, movement is capped at 6 m/s
(over-fast jumps are clamped, not teleported), messages are capped at
20/sec per connection (over that they are dropped, over 40/sec the
socket is closed), incense is capped at 1 per 5 sec per player.
Player state is memory-only in the room object; it is forgotten on
leave. No prayer text, real name or real-world location is stored.

## Rooms

Rooms are `chua-chung`, `chua-chung-2`, … (capacity 15 each). The
Worker tries them in order and places a newcomer in the first room
with space, so two people are never silently split — unless every
room is full, in which case the client gets a 503 and stays in solo
mode with an honest message. The room ID is shown in the app header,
so testers can confirm they are in the same room.

## Local test shim

`../test/ws-shim/` is a small Node server implementing the same
protocol (not the Durable Object itself — that needs `workerd`).
It exists so the client, room assignment, reconnect and rate-limit
logic can be tested without a Cloudflare account. See its README.

## Shared merit board (Bảng Vàng đồng bộ, added 2026-11-05)

The merit board used to be local-only: your points lived in your
browser, the 8 devotees were fixed, and friends in the room showed
hash-derived placeholder points. A rank earned on one device never
appeared on another. The shared board fixes that.

- Routes (same Worker, no new binding): `GET /leaderboard` returns
  the top 50; `POST /leaderboard { name, points }` reports a total.
- Storage: the same `TempleRoom` class with a fixed instance id
  (`bang-vang`), so its storage is isolated from every room and no
  new class or migration is needed. One key holds at most 100
  entries, sorted by points, best score per display name (no login:
  one display name = one slot).
- What is stored: ONLY the display name the player chose (or the
  `Khách NNNN` guest name) + merit points. No prayer text, no
  location, no device data. This is the one deliberate exception to
  the room rule above ("nothing is stored") — the room itself still
  stores nothing after leave.
- Trust model: the server trusts the reported total but caps points
  at 1,000,000 and rate-limits reports to 1 per 10s per IP. There is
  no login, so a shared typed name shares one slot (best wins), and
  a forged total cannot be cryptographically ruled out — acceptable
  for a devotion board, not for a competition.
- Solo mode never reports, so private players never appear on the
  shared board. Offline clients fall back to the local board
  (yourself + the 8 devotee placeholders).
- Frontend (`lib/merit.ts`, `app/page.tsx`): reports your total when
  it changes (throttled 1/30s) and when the board opens, then
  fetches the shared board. Devotee placeholders step aside once
  their name plays for real. The board shows top 8 + your own row
  with its true rank.
