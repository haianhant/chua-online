/**
 * Shared mutable control state between DOM UI (keyboard, joystick,
 * look-drag, buttons) and the 3D loop (player, camera).
 * Kept outside React state on purpose: it changes every frame.
 */

export type CameraMode = 'menu' | 'intro' | 'follow' | 'burner' | 'chant' | 'sweep';

/** Sweep (QUÉT LÁ ĐA) shared timeline state. The 3D loop (Grounds)
 * owns the timeline; the page only reads it for UI / movement lock
 * and writes pause / cancel requests. Leaf positions live in Grounds
 * refs (personal, local only — never sent over WebSocket, never
 * stored), so one guest sweeping never clears another's leaves. */
export type SweepPhase = 'idle' | 'preparing' | 'sweeping' | 'gathering' | 'completed';
export const sweepState = {
  phase: 'idle' as SweepPhase,
  paused: false,
  /** 0..1 across preparing+sweeping+gathering (completed = 1). */
  progress: 0,
  /** 0..1 within the current broom stroke (Player reads this for arm swing). */
  strokePhase: 0,
  /** Broom head world position, for leaf push + debug. */
  broomHead: { x: 14.2, z: 11.5 },
};

/** Bathing ritual (TẮM PHẬT, Request E) shared timeline state.
 * The 3D loop (Lumbini) owns the timeline; the page only reads it
 * for UI / movement lock and writes pause / cancel requests.
 * Like the sweep, the ritual is personal/local only in phase 1:
 * the page sends the existing whitelisted 'praying' state, so
 * remote players see a praying figure at Lumbini, not the ladle
 * detail (RemotePlayers render no tools). */
export type BathPhase = 'idle' | 'pray' | 'scoop' | 'pour' | 'finish' | 'done';
export const bathState = {
  phase: 'idle' as BathPhase,
  /** 1..3 while pouring, 0 otherwise. */
  pourRound: 0,
  /** 0..1 within the current pour (ladle tilt + stream). */
  pourT: 0,
  /** 0..1 across pray+scoop+3 pours+finish (done = 1). */
  progress: 0,
  /** Ladle world position, for the hand-attach + rest-spot logic. */
  ladle: { x: -16.2, z: -19.5, y: 0.62 },
};

export const controls = {
  keys: new Set<string>(),
  yaw: 0, // 0 = camera south of player, looking north to the hall
  pitch: 0.38,
  distance: 7,
  joystick: { x: 0, y: 0 },
  moveTarget: null as { x: number; z: number } | null,
  /** True while page auto-walks to the sweep spot (pending).
      Player allows ONLY auto-walk then, not manual input, and
      must NOT clear moveTarget (the old bug: canMove=false
      cleared the sweep walk, so the sweep never started). */
  sweepAutoWalk: false,
  /** True while page auto-walks to the Lumbini ritual spot
      (pending). Same rule as sweepAutoWalk: Player allows ONLY
      auto-walk then, never clears moveTarget. */
  bathAutoWalk: false,
  /** Optional waypoints for auto-move: walked in order before moveTarget.
      Used for the pond, whose direct diagonal from the spawn runs
      head-on into a tam quan pillar and stalls the auto-walk. */
  waypoints: [] as Array<{ x: number; z: number }>,
  mode: 'menu' as CameraMode,
  pose: 'stand' as 'stand' | 'sit' | 'pray' | 'kneel',
  /** Facing angle (atan2(x, z)) to turn to while sitting/kneeling.
      Hall seats face north (PI); lake seats face the water (west). */
  sitFacing: Math.PI,
  /** Mindful slow walk: half speed, set from the garden->lake path. */
  playerPos: { x: 0, y: 0, z: 17.5 },
  playerMoving: false,
  playerFacing: Math.PI,
  introT: 0,
};

/** Courtyard layout (metres, x east, z south). Hall is north (-z).
 *  Expanded 2026-11-03 (v7): hall interior x ±9.5, z -26..-5.8;
 *  grounds loop runs main courtyard -> banyan (east) -> corridor
 *  -> garden gate -> back garden / tea house (north-east) ->
 *  north path behind the hall -> lake bank (west) -> main courtyard.
 *  These numbers MUST match Temple.tsx / Grounds.tsx. */
export const LAYOUT = {
  spawn: { x: 0, z: 17.5 },
  burner: { x: 0, z: -2.2 },
  burnerApproach: { x: 0, z: 0.4 },
  chantPavilion: { x: 0, z: -10 }, // chanting spot: central aisle inside the hall, facing the main altar (Guanyin)
  chantApproach: { x: 0, z: -9 },
  /** Lotus pond (west side) + the bank where you stand to release fish. */
  pond: { x: -8.5, z: 1.5 },
  pondApproach: { x: -3.6, z: 1.5 }, // east of the bank stones, on dry land (was -4.6, at the water edge)
  hallFront: { x: 0, z: -5 },
  /** Main hall interior (world coords, matching Temple.tsx):
      expanded v7: front wall z -5.8 with a 3.2m centre doorway,
      side walls x ±9.5, back wall z -26, roof raised (beams y 6.65).
      Floor top y 0.975, platform y 0.85. */
  hall: { minX: -9.5, maxX: 9.5, minZ: -26, maxZ: -5.8, floorY: 0.975 },
  platform: { minX: -10, maxX: 10, minZ: -26.5, maxZ: -5, floorY: 0.85 },
  /** Ritual spot in front of the main altar, facing the statue (north).
      Order from the door: mats (z -12/-14) -> empty ritual floor
      (z -16..-19) -> altar table (z -20.5) -> platform/statue (-23.5). */
  altarSpot: { x: 0, z: -17.5 },
  altar: { x: 0, z: -23.5 },
  /** Side altars (moved 2026-11-03: (±8.0, -21), clear of the
      interior columns at (±6.5, -19) and the side walls x ±9.5):
      west = Shakyamuni, east = Ksitigarbha. Each faces south toward
      the central aisle. */
  sideAltarWest: { x: -8.0, z: -21 },
  sideAltarEast: { x: 8.0, z: -21 },
  /** Grounds loop zones */
  banyan: { x: 16, z: 10 },
  banyanBench: { x: 16, z: 13.2 },
  broom: { x: 14.2, z: 11.5 },
  /** Sweep spot (auto-walk target) + pile centre (near the basket).
      Spot is clear of the banyan trunk (16,10) r 0.9, the bench
      (16,13.2) and the basket (17.5,11). */
  sweepSpot: { x: 15.5, z: 11.5 },
  sweepPile: { x: 16.9, z: 11.6 },
  corridorChair: { x: 13.5, z: -2 },
  gardenGate: { x: 13, z: -10 },
  garden: { x: 20, z: -13.5 },
  waterJar: { x: 18.5, z: -12.8 },
  vegBed: { x: 21, z: -20 },
  teaTable: { x: 27.5, z: -18.5 },
  northPath: { x: 0, z: -30 },
  lakeBank: { x: -4.6, z: 1.5 },
  lakeSeat: { x: -4.2, z: 3.2 },
  bellTower: { x: -13, z: -8 },
  /** Vườn Lâm Tỳ Ni – Lễ đài Tắm Phật (Request E, 2026-11-04):
      behind the bell tower, left of the hall, in the empty
      north-west quadrant — no bounds expansion needed.
      Pavilion centre (-17,-20), 5x5m, platform top 0.4;
      basin centre (-17,-19.5) r 0.6; ritual spot (-17,-18.4)
      is 1.1m south of the basin centre, clear of the basin
      collider's effective radius (0.6+0.38=0.98) by 0.12m.
      Yard ~12x10m centred (-17,-19), x -23..-11, z -24..-14. */
  lumbini: { x: -17, z: -20 },
  lumbiniBasin: { x: -17, z: -19.5 },
  lumbiniSpot: { x: -17, z: -18.4 },
  lumbiniLadleRest: { x: -16.2, z: -19.5 },
  bounds: { minX: -32, maxX: 32, minZ: -40, maxZ: 30 },
};

/** Usable seats. Hall = 8 mats, all facing the main altar.
 *  The 9th seat (low chair at 8.3,-18.5) was REMOVED 2026-11-03:
 *  it stood inside the east side-altar platform footprint.
 *  Outdoor seats are extra and listed separately. */
export type Seat = {
  id: string;
  x: number;
  z: number;
  facing: number; // atan2(x, z); PI = north, -PI/2 = west, 0 = south
  kind: 'mat' | 'chair' | 'bench' | 'lakeStep' | 'corridorChair' | 'teaSeat';
  area: 'hall' | 'banyan' | 'corridor' | 'lake' | 'tea';
  label: string;
};

export const SEATS: Seat[] = [
  // Hall, left cluster (2 rows x 2 mats), facing north
  { id: 'hall-l1', x: -5.6, z: -12, facing: Math.PI, kind: 'mat', area: 'hall', label: 'Đệm trái, hàng trước' },
  { id: 'hall-l2', x: -3.4, z: -12, facing: Math.PI, kind: 'mat', area: 'hall', label: 'Đệm trái, hàng trước' },
  { id: 'hall-l3', x: -5.6, z: -14, facing: Math.PI, kind: 'mat', area: 'hall', label: 'Đệm trái, hàng sau' },
  { id: 'hall-l4', x: -3.4, z: -14, facing: Math.PI, kind: 'mat', area: 'hall', label: 'Đệm trái, hàng sau' },
  // Hall, right cluster, facing north
  { id: 'hall-r1', x: 3.4, z: -12, facing: Math.PI, kind: 'mat', area: 'hall', label: 'Đệm phải, hàng trước' },
  { id: 'hall-r2', x: 5.6, z: -12, facing: Math.PI, kind: 'mat', area: 'hall', label: 'Đệm phải, hàng trước' },
  { id: 'hall-r3', x: 3.4, z: -14, facing: Math.PI, kind: 'mat', area: 'hall', label: 'Đệm phải, hàng sau' },
  { id: 'hall-r4', x: 5.6, z: -14, facing: Math.PI, kind: 'mat', area: 'hall', label: 'Đệm phải, hàng sau' },
  // Outdoor seats (not counted in the hall 9)
  { id: 'banyan-bench', x: 16, z: 13.2, facing: 0, kind: 'bench', area: 'banyan', label: 'Bệ ngồi dưới tán đa' },
  { id: 'corridor-chair', x: 13.5, z: -2, facing: -Math.PI / 2, kind: 'corridorChair', area: 'corridor', label: 'Ghế cuối hiên, ngắm mái điện' },
  { id: 'lake-step', x: -4.2, z: 3.2, facing: -Math.PI / 2, kind: 'lakeStep', area: 'lake', label: 'Bậc ngồi ngắm hồ' },
  { id: 'tea-seat', x: 29.3, z: -18.5, facing: -Math.PI / 2, kind: 'teaSeat', area: 'tea', label: 'Ghế nhà trà, nhìn ra luống rau' },
];

/** True when the player stands inside the main hall. */
export function isInHall(x: number, z: number): boolean {
  const h = LAYOUT.hall;
  return x > h.minX && x < h.maxX && z > h.minZ && z < h.maxZ;
}

/** Ground height under the player: hall floor, platform, else courtyard. */
export function floorYAt(x: number, z: number): number {
  if (isInHall(x, z)) return LAYOUT.hall.floorY;
  const p = LAYOUT.platform;
  if (x > p.minX && x < p.maxX && z > p.minZ && z < p.maxZ) return p.floorY;
  // Tea house platform (site plan v2, 2026-11-04): stone slab top
  // 0.45, x 24..31, z -21.75..-15.25 — without this the player
  // sank into the slab when walking/sitting in the tea house.
  if (x > 24 && x < 31 && z > -21.75 && z < -15.25) return 0.45;
  // Vegetable beds (v2): soil top 0.24, x 18.5..23.5, rows
  // z -22.6..-21.4 / -20.6..-19.4 / -18.6..-17.4 — standing on a
  // bed to water it no longer sinks the feet into the soil.
  if (x > 18.5 && x < 23.5) {
    if ((z > -22.6 && z < -21.4) || (z > -20.6 && z < -19.4) || (z > -18.6 && z < -17.4)) return 0.24;
  }
  // Lumbini pavilion platform (Request E): stone slab top 0.4,
  // x -19.5..-14.5, z -22.5..-17.5, plus two south steps
  // (tops 0.27 / 0.13, x -18..-16). Same rule as the tea
  // house: without this the player sinks into the slab.
  if (x > -19.5 && x < -14.5 && z > -22.5 && z < -17.5) return 0.4;
  const lumbiniSteps = [
    { minX: -18, maxX: -16, minZ: -17.5, maxZ: -17.0, top: 0.27 },
    { minX: -18, maxX: -16, minZ: -17.0, maxZ: -16.5, top: 0.13 },
  ];
  for (const s of lumbiniSteps) {
    if (x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ) return s.top;
  }
  // Tea house south steps (v2, top 0.30 / 0.15, x 25.5..29.5),
  // matching Grounds.tsx step boxes.
  const teaSteps = [
    { minX: 25.5, maxX: 29.5, minZ: -15.25, maxZ: -14.75, top: 0.3 },
    { minX: 25.5, maxX: 29.5, minZ: -14.75, maxZ: -14.25, top: 0.15 },
  ];
  for (const s of teaSteps) {
    if (x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ) return s.top;
  }
  // Hall steps (world z, tops 0.36 / 0.54 / 0.72): the player
  // climbs them instead of walking through the slabs and
  // popping up at the platform edge.
  // Solid steps, south -> north: 0.28 -> 0.57 -> 0.85 (flush
  // with the platform). Distinct 0.5m bands, matching Temple.tsx.
  const steps = [
    { minX: -10, maxX: 10, minZ: -5.0, maxZ: -4.5, top: 0.85 },
    { minX: -9.6, maxX: 9.6, minZ: -4.5, maxZ: -4.0, top: 0.57 },
    { minX: -9.2, maxX: 9.2, minZ: -4.0, maxZ: -3.5, top: 0.28 },
  ];
  let stepY = 0;
  for (const s of steps) {
    if (x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ) stepY = Math.max(stepY, s.top);
  }
  if (stepY > 0) return stepY;
  return 0;
}

type Collider =
  | { kind: 'box'; minX: number; maxX: number; minZ: number; maxZ: number }
  | { kind: 'circle'; x: number; z: number; r: number };

const R = 0.38; // player radius, added to every collider

export const COLLIDERS: Collider[] = [
  // Main hall walls — the centre doorway (x -1.7..1.7 at z -5.8)
  // is OPEN, so the player can walk in. Side doors stay shut.
  { kind: 'box', minX: -9.65, maxX: -1.7, minZ: -5.95, maxZ: -5.65 }, // front-left wall
  { kind: 'box', minX: 1.7, maxX: 9.65, minZ: -5.95, maxZ: -5.65 }, // front-right wall
  { kind: 'box', minX: -9.65, maxX: 9.65, minZ: -26.15, maxZ: -25.85 }, // back wall
  { kind: 'box', minX: -9.65, maxX: -9.35, minZ: -26, maxZ: -5.8 }, // west wall
  { kind: 'box', minX: 9.35, maxX: 9.65, minZ: -26, maxZ: -5.8 }, // east wall
  // Front doorway frame columns (x ±1.9, z -5.8): the 3.2m
  // doorway stays walkable between them (3.2m clear).
  { kind: 'circle', x: -1.9, z: -5.8, r: 0.3 },
  { kind: 'circle', x: 1.9, z: -5.8, r: 0.3 },
  // Front colonnade (x ±4.5, ±7.5 at the front wall)
  { kind: 'circle', x: -4.5, z: -5.8, r: 0.3 },
  { kind: 'circle', x: 4.5, z: -5.8, r: 0.3 },
  { kind: 'circle', x: -7.5, z: -5.8, r: 0.3 },
  { kind: 'circle', x: 7.5, z: -5.8, r: 0.3 },
  // Interior columns: two rows, clear of the mat clusters and aisles
  { kind: 'circle', x: -7.0, z: -8, r: 0.3 },
  { kind: 'circle', x: 7.0, z: -8, r: 0.3 },
  { kind: 'circle', x: -6.0, z: -19, r: 0.3 },
  { kind: 'circle', x: 6.0, z: -19, r: 0.3 },
  // Raised main altar platform (world z -25.2 … -21.8, x ±4)
  { kind: 'box', minX: -4, maxX: 4, minZ: -25.2, maxZ: -21.8 },
  // Altar table (world z -20.5)
  { kind: 'box', minX: -2.1, maxX: 2.1, minZ: -21, maxZ: -20 },
  { kind: 'circle', x: 0, z: -23.5, r: 1.2 },
  // Side altar platforms (moved 2026-11-03: x ±8.0, z -21, clear of
  // the interior columns at (±6.5, -19) and the side walls x ±9.5)
  { kind: 'box', minX: -9.0, maxX: -7.0, minZ: -21.8, maxZ: -20.2 },
  { kind: 'box', minX: 7.0, maxX: 9.0, minZ: -21.8, maxZ: -20.2 },
  // Tam quan LOW STONE WALLS (Request C, 2026-11-04): Temple.tsx
  // TamQuan group at [0,0,13], walls at [±5.2, 0.8, 0] with box
  // [3.2, 1.6, 0.5] => world x 3.6..6.8 / -6.8..-3.6, z 12.75..13.25.
  // These had NO collider before, so the player walked straight
  // through them. The gate openings (between the ±3.6 / ±1.4
  // pillars) stay walkable — the walls sit outside the pillars.
  { kind: 'box', minX: -6.8, maxX: -3.6, minZ: 12.75, maxZ: 13.25 }, // west stone wall
  { kind: 'box', minX: 3.6, maxX: 6.8, minZ: 12.75, maxZ: 13.25 }, // east stone wall
  // Tam quan pillars (the three openings stay walkable)
  { kind: 'circle', x: -3.6, z: 13, r: 0.5 },
  { kind: 'circle', x: -1.4, z: 13, r: 0.5 },
  { kind: 'circle', x: 1.4, z: 13, r: 0.5 },
  { kind: 'circle', x: 3.6, z: 13, r: 0.5 },
  // Incense burner
  { kind: 'circle', x: 0, z: -2.2, r: 1.05 },
  // Lotus pond (larger now, so the collider matches the water edge)
  { kind: 'circle', x: -8.5, z: 1.5, r: 3.6 },
  { kind: 'circle', x: 4, z: 2, r: 0.7 }, // tree (moved west, away from the banyan)
  { kind: 'circle', x: 5, z: 8.5, r: 1.1 }, // bamboo (moved west, away from the banyan)
  { kind: 'circle', x: -9.5, z: 8.5, r: 1.1 },
  { kind: 'circle', x: -18.5, z: -4.5, r: 0.7 }, // tree (moved west again, clear of the bell tower)
  { kind: 'circle', x: -2.4, z: 8, r: 0.45 },
  { kind: 'circle', x: 2.4, z: 8, r: 0.45 },
  { kind: 'circle', x: -2.4, z: 3.5, r: 0.45 },
  { kind: 'circle', x: 2.4, z: 3.5, r: 0.45 },
  { kind: 'circle', x: -4.6, z: -2.0, r: 0.6 }, // bonsai (moved off the steps)
  { kind: 'circle', x: 4.6, z: -2.0, r: 0.6 }, // bonsai (moved off the steps)
  // Grounds loop: banyan trunk, corridor pillars, garden wall (gate open),
  // tea table, bell tower, lake bank stones. The garden gate at
  // (13, -10) is OPEN — the wall segments stop on either side of it.
  { kind: 'circle', x: 16, z: 10, r: 0.9 },
  { kind: 'circle', x: 19.0, z: 10.5, r: 0.25 }, // banyan prop trunk (east)
  { kind: 'circle', x: 13.2, z: 9.2, r: 0.25 }, // banyan prop trunk (west)
  { kind: 'circle', x: 18.2, z: 12.0, r: 0.25 }, // banyan prop trunk (south-east)
  // Corridor pillars at their REAL positions (Request D:
  // widened to 11.2/15.8, 4.6m apart, ~3.4m clear walkway —
  // the old 12.6/14.4 left only 0.64m clear, the cramped feel
  // the user complained about). Walkway centre (13.5) stays
  // clear, so auto-walk waypoints (13.5,2) / (13.5,-6) work.
  { kind: 'circle', x: 11.2, z: 2, r: 0.2 },
  { kind: 'circle', x: 15.8, z: 2, r: 0.2 },
  { kind: 'circle', x: 11.2, z: -2, r: 0.2 },
  { kind: 'circle', x: 15.8, z: -2, r: 0.2 },
  { kind: 'circle', x: 11.2, z: -6, r: 0.2 },
  { kind: 'circle', x: 15.8, z: -6, r: 0.2 },
  { kind: 'box', minX: 12.8, maxX: 13.2, minZ: -14, maxZ: -11.2 }, // garden wall, south of gate
  { kind: 'box', minX: 12.8, maxX: 13.2, minZ: -8.8, maxZ: -7 }, // garden wall, north of gate, shortened 2026-11-04 (was ..-5: it poked 1m into the corridor)
  { kind: 'circle', x: 13, z: -11.2, r: 0.25 }, // garden gate post (south)
  { kind: 'circle', x: 13, z: -8.8, r: 0.25 }, // garden gate post (north)
  // NOTE (2026-11-04): the corridor chair deliberately has NO
  // collider — its seat IS the chair centre (13.5,-2), and sit
  // arrival needs <0.45m, while any box around it would hold the
  // player >=0.68m out (half box + 0.38 player radius), so sitting
  // could never complete (caught by the arch retest). The 0.18m
  // auto-walk clip is fixed instead by routing at x 14.4, which
  // clears the chair footprint + player radius (0.9 > 0.68).
  { kind: 'box', minX: 26.65, maxX: 28.35, minZ: -19, maxZ: -18 }, // tea table (site plan v2, 2026-11-04)
  // Tea house pillars (v2, corners of the widened platform):
  // gaps around the table are west 1.04m / east 1.04m /
  // north 1.09m / south 1.59m — all passable for the 0.76m player.
  { kind: 'circle', x: 24.6, z: -21.1, r: 0.25 },
  { kind: 'circle', x: 30.4, z: -21.1, r: 0.25 },
  { kind: 'circle', x: 24.6, z: -15.9, r: 0.25 },
  { kind: 'circle', x: 30.4, z: -15.9, r: 0.25 },
  { kind: 'box', minX: -14.7, maxX: -11.3, minZ: -9.7, maxZ: -6.3 }, // bell tower platform (3.4m square, Request B)
  { kind: 'box', minX: -13.6, maxX: -12.4, minZ: -6.3, maxZ: -5.9 }, // bell tower steps (south)
  // Lumbini pavilion (Request E): four corner columns inset
  // 0.4m from the 5x5m platform edges; the centre (basin
  // aside) and the south entrance stay walkable.
  { kind: 'circle', x: -19.1, z: -22.1, r: 0.25 },
  { kind: 'circle', x: -14.9, z: -22.1, r: 0.25 },
  { kind: 'circle', x: -19.1, z: -17.9, r: 0.25 },
  { kind: 'circle', x: -14.9, z: -17.9, r: 0.25 },
  // Lumbini bathing basin (r 0.6): the ritual spot (-17,-18.4)
  // is 1.1m south, clear of the effective radius 0.98 by 0.12m.
  { kind: 'circle', x: -17, z: -19.5, r: 0.6 },
  // Lumbini garden trees (trunks) + yard entrance sign post:
  // all clear of the stone path (x -17) and the pavilion.
  { kind: 'circle', x: -21.5, z: -21.5, r: 0.5 },
  { kind: 'circle', x: -12.8, z: -22, r: 0.5 },
  { kind: 'circle', x: -21, z: -16.8, r: 0.5 },
  { kind: 'circle', x: -15.2, z: -14.2, r: 0.15 },
  { kind: 'circle', x: -4.2, z: 0.2, r: 0.4 }, // lake bank stone
];

export function collides(x: number, z: number): boolean {
  const b = LAYOUT.bounds;
  if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return true;
  for (const c of COLLIDERS) {
    if (c.kind === 'box') {
      if (x > c.minX - R && x < c.maxX + R && z > c.minZ - R && z < c.maxZ + R) return true;
    } else {
      const dx = x - c.x;
      const dz = z - c.z;
      if (dx * dx + dz * dz < (c.r + R) * (c.r + R)) return true;
    }
  }
  return false;
}

/** Move with per-axis collision: sliding along a wall still works. */
export function moveWithCollision(
  x: number,
  z: number,
  dx: number,
  dz: number,
): { x: number; z: number } {
  let nx = x;
  let nz = z;
  if (!collides(x + dx, z)) nx = x + dx;
  if (!collides(nx, z + dz)) nz = z + dz;
  return { x: nx, z: nz };
}
