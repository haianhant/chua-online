/**
 * Shared mutable control state between DOM UI (keyboard, joystick,
 * look-drag, buttons) and the 3D loop (player, camera).
 * Kept outside React state on purpose: it changes every frame.
 */

export type CameraMode = 'menu' | 'intro' | 'follow' | 'burner' | 'chant' | 'sweep' | 'bath';
export type PlayerGender = 'female' | 'male';

/** Watering ritual (MÚC NƯỚC & TƯỚI CÂY, Vườn Lộc Uyển) shared state. */
export type WaterPhase = 'idle' | 'scooping' | 'carrying' | 'watering';
export const waterState = {
  phase: 'idle' as WaterPhase,
  /** 0..1 during watering (5s sequence). */
  progress: 0,
  /** 0..1 within current pour swing. */
  pourT: 0,
};

/** Fish release ritual (THẢ CÁ PHÓNG SINH, Tâm Liên Hồ) shared state. */
export type ReleasePhase = 'idle' | 'releasing';
export const releaseState = {
  phase: 'idle' as ReleasePhase,
  count: 1 as 1 | 2 | 3,
  /** 0..1 across the 4.2s release animation. */
  progress: 0,
};

/** Two novice monks (2 Chú Tiểu) walking around the temple grounds. */
export type MonkId = 'taman' | 'tamminh';
export const monksState: Record<
  MonkId,
  { x: number; z: number; facing: number; name: string; title: string; talking: boolean }
> = {
  taman: {
    x: -6.5,
    z: 3.5,
    facing: 0,
    name: 'Chú tiểu Tâm An',
    title: 'Chú tiểu tri khách · Khuôn viên Tây & Chính điện',
    talking: false,
  },
  tamminh: {
    x: 7.5,
    z: 5.5,
    facing: 0,
    name: 'Chú tiểu Tâm Minh',
    title: 'Chú tiểu chấp tác · Sân đa & Vườn Lộc Uyển',
    talking: false,
  },
};

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
  gender: 'female' as PlayerGender,
  /** Active seat ID when sitting on a mat/bench/chair, so Player.tsx
      can apply exact seat-height offset without floating. */
  seatId: '' as string,
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
  burner: { x: 0, z: -2.65 },
  burnerApproach: { x: 0, z: -0.4 },
  chantPavilion: { x: 0, z: -10 }, // chanting spot: central aisle inside the hall, facing the main altar (Guanyin)
  chantApproach: { x: 0, z: -9 },
  /** Lotus pond (Tâm Liên Hồ, west side, spread out from central path) + the bank where you stand to release fish. */
  pond: { x: -16.0, z: 3.0 },
  pondApproach: { x: -11.1, z: 3.0 }, // east of the bank stones, on dry land
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
  /** Grounds loop zones (spread out across the enlarged 88x50m compound) */
  banyan: { x: 22, z: 8 },
  banyanBench: { x: 22, z: 11.2 },
  broom: { x: 20.2, z: 9.5 },
  /** Sweep spot (auto-walk target) + pile centre (near the basket).
      Spot is clear of the banyan trunk (22,8) r 0.9, the bench
      (22,11.2) and the basket (23.5,9). */
  sweepSpot: { x: 21.5, z: 9.5 },
  sweepPile: { x: 22.9, z: 9.6 },
  corridorChair: { x: 13.5, z: -2 },
  gardenGate: { x: 20.0, z: -10 },
  garden: { x: 26.5, z: -13.5 },
  waterJar: { x: 25.0, z: -12.8 },
  vegBed: { x: 27.5, z: -20 },
  teaTable: { x: 36.5, z: -18.5 },
  northPath: { x: 0, z: -32 },
  lakeBank: { x: -12.1, z: 3.0 },
  lakeSeat: { x: -11.7, z: 4.7 },
  bellTower: { x: -22, z: -9.0 },
  /** Vườn Lâm Tỳ Ni – Lễ đài Tắm Phật:
      placed spaciously in the north-west quadrant at (-28,-24),
      giving 11.4m open courtyard from the Main Hall and 7.5m from
      the Bell Tower. Pavilion centre (-28,-24), 5x5m, platform top 0.4;
      basin centre (-28,-23.5) r 0.6; ritual spot (-28,-22.4).
      Yard ~12x10m centred (-28,-23), x -34..-22, z -28..-18. */
  lumbini: { x: -28, z: -24 },
  lumbiniBasin: { x: -28, z: -23.5 },
  lumbiniSpot: { x: -28, z: -22.4 },
  lumbiniLadleRest: { x: -27.2, z: -23.5 },
  bounds: { minX: -46, maxX: 46, minZ: -44, maxZ: 32 },
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
  { id: 'banyan-bench', x: 22, z: 11.2, facing: 0, kind: 'bench', area: 'banyan', label: 'Bệ ngồi dưới tán đa Bách Linh' },
  { id: 'corridor-chair', x: 13.5, z: -2, facing: -Math.PI / 2, kind: 'corridorChair', area: 'corridor', label: 'Ghế cuối hiên, ngắm mái điện' },
  { id: 'lake-step', x: -11.7, z: 4.7, facing: -Math.PI / 2, kind: 'lakeStep', area: 'lake', label: 'Bậc ngồi ngắm Tâm Liên Hồ' },
  { id: 'tea-seat', x: 38.3, z: -18.5, facing: -Math.PI / 2, kind: 'teaSeat', area: 'tea', label: 'Ghế nhà trà, nhìn ra Vườn Lộc Uyển' },
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
  // Tea house platform: stone slab top 0.45, x 33..40, z -21.75..-15.25
  if (x > 33 && x < 40 && z > -21.75 && z < -15.25) return 0.45;
  // Vegetable beds (Vườn Lộc Uyển): soil top 0.24, x 25.0..30.0, rows
  // z -22.6..-21.4 / -20.6..-19.4 / -18.6..-17.4
  if (x > 25.0 && x < 30.0) {
    if ((z > -22.6 && z < -21.4) || (z > -20.6 && z < -19.4) || (z > -18.6 && z < -17.4)) return 0.24;
  }
  // Lumbini pavilion platform: stone slab top 0.4,
  // x -30.5..-25.5, z -26.5..-21.5, plus two south steps
  // (tops 0.27 / 0.13, x -29..-27).
  if (x > -30.5 && x < -25.5 && z > -26.5 && z < -21.5) return 0.4;
  const lumbiniSteps = [
    { minX: -29, maxX: -27, minZ: -21.5, maxZ: -21.0, top: 0.27 },
    { minX: -29, maxX: -27, minZ: -21.0, maxZ: -20.5, top: 0.13 },
  ];
  for (const s of lumbiniSteps) {
    if (x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ) return s.top;
  }
  // Tea house south steps (top 0.30 / 0.15, x 34.5..38.5),
  // matching Grounds.tsx step boxes.
  const teaSteps = [
    { minX: 34.5, maxX: 38.5, minZ: -15.25, maxZ: -14.75, top: 0.3 },
    { minX: 34.5, maxX: 38.5, minZ: -14.75, maxZ: -14.25, top: 0.15 },
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
  // Tam quan LOW STONE WALLS + perimeter front wall (z 13):
  // The gate openings (between the ±3.6 / ±1.4 pillars) stay walkable;
  // the low compound wall extends from ±3.6 all the way to ±44.
  { kind: 'box', minX: -44, maxX: -3.6, minZ: 12.75, maxZ: 13.25 }, // west front compound wall
  { kind: 'box', minX: 3.6, maxX: 44, minZ: 12.75, maxZ: 13.25 }, // east front compound wall
  { kind: 'box', minX: -44.25, maxX: -43.75, minZ: -36, maxZ: 13 }, // west perimeter wall
  { kind: 'box', minX: 43.75, maxX: 44.25, minZ: -36, maxZ: 13 }, // east perimeter wall
  { kind: 'box', minX: -44, maxX: 44, minZ: -36.25, maxZ: -35.75 }, // north perimeter wall
  // Tam quan pillars (the three openings stay walkable)
  { kind: 'circle', x: -3.6, z: 13, r: 0.5 },
  { kind: 'circle', x: -1.4, z: 13, r: 0.5 },
  { kind: 'circle', x: 1.4, z: 13, r: 0.5 },
  { kind: 'circle', x: 3.6, z: 13, r: 0.5 },
  // Incense burner (moved slightly north to z -2.65 so it sits right before the hall steps without blocking courtyard traffic)
  { kind: 'circle', x: 0, z: -2.65, r: 0.88 },
  // Lotus pond (Tâm Liên Hồ, moved west to (-16.0, 3.0))
  { kind: 'circle', x: -16.0, z: 3.0, r: 3.6 },
  { kind: 'circle', x: 8.5, z: 3.5, r: 0.7 }, // courtyard tree (front-east)
  { kind: 'circle', x: 6.5, z: 8.5, r: 1.1 }, // bamboo (front-east)
  { kind: 'circle', x: -7.5, z: 8.5, r: 1.1 }, // bamboo (front-west, clear of pond at -16)
  { kind: 'circle', x: -36.0, z: -8.0, r: 0.7 }, // courtyard tree (west of bell tower)
  { kind: 'circle', x: -16.5, z: -28.0, r: 0.7 }, // courtyard tree (between main hall and Lumbini)
  { kind: 'circle', x: 32.0, z: 2.0, r: 0.7 }, // courtyard tree (east of Cây đa Bách Linh)
  { kind: 'circle', x: -2.4, z: 8, r: 0.45 },
  { kind: 'circle', x: 2.4, z: 8, r: 0.45 },
  { kind: 'circle', x: -2.4, z: 3.5, r: 0.45 },
  { kind: 'circle', x: 2.4, z: 3.5, r: 0.45 },
  { kind: 'circle', x: -4.6, z: -2.0, r: 0.6 }, // bonsai (moved off the steps)
  { kind: 'circle', x: 4.6, z: -2.0, r: 0.6 }, // bonsai (moved off the steps)
  // Grounds loop: Cây đa Bách Linh at (22, 8), corridor pillars,
  // Vườn Lộc Uyển gate at (20.0, -10), Nhà trà at (36.5, -18.5),
  // Gác chuông at (-22, -9), Tâm Liên Hồ stones & signboards.
  { kind: 'circle', x: 22, z: 8, r: 0.9 },
  { kind: 'circle', x: 25.0, z: 8.5, r: 0.25 }, // banyan prop trunk (east)
  { kind: 'circle', x: 23.8, z: 6.0, r: 0.25 }, // banyan prop trunk (north-east)
  { kind: 'circle', x: 24.2, z: 10.0, r: 0.25 }, // banyan prop trunk (south-east)
  // Signboards ("Cây đa Bách Linh", "Tâm Liên Hồ", "Vườn Lộc Uyển")
  { kind: 'circle', x: 18.2, z: 11.2, r: 0.25 }, // signboard "Cây đa Bách Linh"
  { kind: 'circle', x: -13.2, z: 7.8, r: 0.25 }, // signboard "Tâm Liên Hồ"
  { kind: 'circle', x: 18.4, z: -7.6, r: 0.25 }, // signboard "Vườn Lộc Uyển"
  // Corridor pillars at their REAL positions (widened to 11.2/15.8)
  { kind: 'circle', x: 11.2, z: 2, r: 0.2 },
  { kind: 'circle', x: 15.8, z: 2, r: 0.2 },
  { kind: 'circle', x: 11.2, z: -2, r: 0.2 },
  { kind: 'circle', x: 15.8, z: -2, r: 0.2 },
  { kind: 'circle', x: 11.2, z: -6, r: 0.2 },
  { kind: 'circle', x: 15.8, z: -6, r: 0.2 },
  { kind: 'box', minX: 19.8, maxX: 20.2, minZ: -14.5, maxZ: -11.2 }, // garden wall, south of gate (at x 20.0)
  { kind: 'box', minX: 19.8, maxX: 20.2, minZ: -8.8, maxZ: -6.8 }, // garden wall, north of gate
  { kind: 'circle', x: 20.0, z: -11.2, r: 0.25 }, // garden gate post (south)
  { kind: 'circle', x: 20.0, z: -8.8, r: 0.25 }, // garden gate post (north)
  // NOTE (2026-11-04): the corridor chair deliberately has NO
  // collider — its seat IS the chair centre (13.5,-2).
  { kind: 'box', minX: 35.65, maxX: 37.35, minZ: -19, maxZ: -18 }, // tea table at (36.5, -18.5)
  // Tea house pillars (corners of the platform at x 33..40):
  { kind: 'circle', x: 33.6, z: -21.1, r: 0.25 },
  { kind: 'circle', x: 39.4, z: -21.1, r: 0.25 },
  { kind: 'circle', x: 33.6, z: -15.9, r: 0.25 },
  { kind: 'circle', x: 39.4, z: -15.9, r: 0.25 },
  { kind: 'box', minX: -23.7, maxX: -20.3, minZ: -10.7, maxZ: -7.3 }, // bell tower platform at (-22, -9.0)
  { kind: 'box', minX: -22.6, maxX: -21.4, minZ: -7.3, maxZ: -6.9 }, // bell tower steps (south, clear of z -5.0 path)
  // Lumbini pavilion at (-28, -24): four corner columns inset
  // 0.4m from the 5x5m platform edges
  { kind: 'circle', x: -30.1, z: -26.1, r: 0.25 },
  { kind: 'circle', x: -25.9, z: -26.1, r: 0.25 },
  { kind: 'circle', x: -30.1, z: -21.9, r: 0.25 },
  { kind: 'circle', x: -25.9, z: -21.9, r: 0.25 },
  // Lumbini bathing basin (r 0.6) at (-28, -23.5)
  { kind: 'circle', x: -28, z: -23.5, r: 0.6 },
  // Lumbini garden trees (trunks) + yard entrance sign post:
  { kind: 'circle', x: -32.5, z: -25.5, r: 0.5 },
  { kind: 'circle', x: -23.8, z: -26.0, r: 0.5 },
  { kind: 'circle', x: -32.0, z: -20.8, r: 0.5 },
  { kind: 'circle', x: -25.6, z: -18.2, r: 0.15 },
  { kind: 'circle', x: -11.7, z: 1.7, r: 0.4 }, // lake bank stone at Tâm Liên Hồ
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
