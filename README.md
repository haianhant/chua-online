# Thiền viện Hải An — Chùa Online 3D

Next.js 14 (App Router) + React Three Fiber + drei + Tailwind CSS.
Static export (`output: 'export'` in `next.config.mjs`), deployable on
Vercel as a plain static site — no server, no native binaries.

Live: https://chua-online-haianhants-projects.vercel.app/

## What it is now (v7, deployed dpl_JCNLxzenLPGpbNkYoKy2nQFeuwBw)

Official name: Thiền viện Hải An. Expanded hall (9 usable seats), walking loop (banyan → corridor → garden/tea house → lake), sweep/water/mindful-walk/bell/reading activities, 2D map, real 3D canvas-texture signs, background music 'Meditation Impromptu 01' by Kevin MacLeod (CC BY 4.0) on entry. Side statues still paused (not live).

## What it was (v2)

A walkable Vietnamese temple courtyard, not an orbit-around-a-model page:

- **Temple** (`components/three/Temple.tsx`): main hall with two-tier
  sloped tile roofs and upturned corners, round wooden columns, stone
  steps, three wooden doors; tam quan gate; a small open chanting
  pavilion east of the hall; garden, lotus pond, bamboo, bonsai, stone
  lanterns, misty hills, drifting clouds, falling leaves. Textures are
  generated on canvas (wood, tile, stone, brick, grass) — no downloaded
  images, no heavy GLB.
- **Movement** (`components/three/Player.tsx`, `CameraRig.tsx`,
  `controls.ts`): third-person camera, WASD/arrows, drag to look,
  wheel zoom, virtual joystick on touch screens, click-to-move,
  per-axis collision (walls, pillars, burner, pond, trees) and
  courtyard bounds. Spawn is in front of the tam quan.
- **Visitor** (`app/page.tsx`): welcome screen, name saved in
  localStorage (no account), name label above the character (DOM text,
  so Vietnamese renders correctly), sit/pray poses, settings to rename.
- **Incense ritual**: walk near the burner → "Nhấn E hoặc chạm để dâng
  hương" → choose a prayer (or write your own) → camera closes in →
  three sticks grow into the sand (never pop in) → ember + thin smoke →
  a personal message, saved to a local-only prayer book.
- **Niệm Phật** (`lib/chanting.ts`, `components/ui/ChantPanel.tsx`):
  only short danh hiệu (name chanting), a real player
  (play/pause/resume/stop, progress, volume, speed, once/repeat,
  hide text); dedication (hồi hướng) with editable, app-generated
  wording; "tĩnh tâm" (sit before the hall) or "nghe khi đi dạo"
  modes; progress saved locally. The former sutra/mantra and
  "theo tâm nguyện" sections were removed at the user's request
  (2026-11-03) — see the honesty rules below.
- **Mobile layout** (2026-11-03, live): desktop layout untouched;
  on <768px the top bar is one compact row ("Thiền Viện" + sound +
  ☰), secondary functions live in a bottom-sheet menu (real
  functions only, tap-outside to close), the joystick is 100px at the
  bottom-left in the safe area, and action buttons sit bottom-right
  opposite it. Tested by Playwright emulation at 375×667, 390×844,
  393×852, 414×896, 360×800, 768×1024, 844×390 landscape and
  1280×800 desktop — no overlaps, no horizontal overflow. Not yet
  verified on a real phone.
- **Lotus pond + fish release** (2026-11-03, live): the west pond
  is now a natural-shaped lotus pond (irregular water edge, grass
  bank, 18 stones, stepping stones, 10 lily pads, 4 lotus flowers,
  3 buds, ambient ripples). Near it, "Phóng sinh" opens a panel:
  release 1, 3 or 5 koi, or "Thả cá cầu bình an" (3 fish + blessing
  message shown 7s). Koi swim smoothly (steering capped, under the
  pads), cap 18 with pooling/reuse, no money, no points, no saved
  history, no water sound. Auto-move to the pond goes via the gate
  opening (waypoint at x 0, z 10) so it cannot stall on a tam quan
  pillar.
- **Multiplayer** (`lib/multiplayer.ts`,
  `components/three/RemotePlayers.tsx`, `worker/`): Cloudflare
  Durable Object rooms (15 players/room, overflow to the next room),
  WebSocket, adaptive 10 Hz send, interpolated remote avatars with
  name labels, hide-others and solo modes, offline fallback. See
  `worker/README.md` for architecture, trade-offs and deployment.
  The Worker is live and the live frontend build bakes in its
  `wss://…/ws` URL, so new visitors connect by default. A remote
  fish release shows as one fish + one ripple on each other client
  (event only — no fish state or history is synced).

## Honesty rules for chanting content (do not break these)

- Only the four short danh hiệu have audio, and it is **synthetic
  voice, labelled as reference listening** — never presented as a
  standard chant recording, and never as the voice of a real monk/nun.
- Sutra/mantra sections (tụng kinh, trì chú) and "theo tâm nguyện"
  were **removed entirely** at the user's request (2026-11-03):
  long sutra texts and their recordings raise copyright questions,
  and synthetic readings of sacred texts risk misleading
  practitioners. Do not re-add them without a verified, licensed
  source and the user's explicit approval, and never fill such gaps
  with invented text or a few-line fake sutra.
- Dedication (hồi hướng) wording is app-generated and labelled as
  such — never presented as original sutra text, never claiming a
  sutra cures illness, removes bad luck, brings wealth or changes fate.
- To add a verified danh hiệu: put the mp3 in
  `public/audio/chanting/<id>.mp3`, then set `audio` in `lib/chanting.ts`.

## Multiplayer — what is live and what is not

- The frontend (this repo, Vercel) contains the full multiplayer
  client: room pill in the top bar, hide-others, solo mode, WebSocket
  URL setting, adaptive send, interpolated remote avatars, remote
  incense smoke (one short puff at the fixed burner, never a moving
  burner, never unlimited sticks) and remote fish-release events.
- The Cloudflare Worker is deployed at
  `https://chua-online-temple.hunganhz179.workers.dev` (subdomain
  `hunganhz179`, verified via a managed browser on 2026-11-03:
  `/health` returns the 5 rooms with capacity 15, `/api/rooms`
  returns all rooms at count 0). The live frontend build bakes in
  `wss://chua-online-temple.hunganhz179.workers.dev/ws`, so new
  visitors connect by default. **Two real browsers/devices have not
  yet been seen seeing each other on the deployed Worker** — do not
  claim live multiplayer is proven until that passes. Real 2-device,
  mobile-device and 15-player tests are still pending.
- Re-uploading the Worker must omit the sqlite migration
  (`--no-migration` on the helper): re-sending it fails with
  error 10074, because the migration can only be applied once.
- VM caveat: curl/Node from this VM to workers.dev fails after a
  successful TLS handshake (VM egress proxy) — that is not Worker
  failure. Live Worker checks must run in the managed browser.

## Fonts

Noto Serif (titles) + Be Vietnam Pro (UI), both with the Vietnamese
subset via `next/font/google`. No letter-spacing on text elements —
that was part of the earlier diacritic display problem.

## Replace the placeholders

- Music: `public/audio/zen.mp3` is the background chant (synthetic
  A Di Đà Phật over a soft bell, default OFF). Replace with a licensed
  recording if you want the real thing.
- Bell: `public/audio/bell.mp3` (synthesised, start/end of chanting).

## Run locally

```bash
npm install
npm run dev
npm run build   # static export into out/
```

## Deploy

```bash
NEXT_PUBLIC_MULTIPLAYER_WS_URL=wss://chua-online-temple.hunganhz179.workers.dev/ws npm run build
python3 ~/workspace/custom-connectors/custom.vercel/bin/vercel_api.py deploy --dir out --name chua-online
```

After a successful deploy, keep about the 3 most recent
deployments and delete the older ones (user's standing rule,
2026-11-03, to save free-plan storage):

```bash
python3 ~/workspace/custom-connectors/custom.vercel/bin/vercel_api.py list-deployments --name chua-online
python3 ~/workspace/custom-connectors/custom.vercel/bin/vercel_api.py delete-deployment --id <older-deployment-id>
```

Note: a brand-new Vercel project defaults to SSO deployment
protection, which 302-redirects the public alias to a login. Clear it
once with a project PATCH setting `ssoProtection: null`, then verify
the alias returns 200.
