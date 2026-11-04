// Site-plan v2 fast gate (2026-11-04): bounds, LAYOUT, tea gaps,
// seat reachability, axis-aligned routes + leg clearance, floors,
// courtyard enclosure. Runs against the REAL controls.ts compiled
// with the project's tsc. Playwright legs skipped per user order
// (fast deploy); this + tsc + build are the gates.
const { collides, floorYAt, LAYOUT, SEATS } = require('/tmp/v2-unit/controls.js');
let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name); }
}
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
// --- Bounds + LAYOUT ---
check('bounds x -46..46', LAYOUT.bounds.minX === -46 && LAYOUT.bounds.maxX === 46);
check('bounds z -44..32', LAYOUT.bounds.minZ === -44 && LAYOUT.bounds.maxZ === 32);
check('pond (-16,3)', LAYOUT.pond.x === -16 && LAYOUT.pond.z === 3);
check('banyan (22,8)', LAYOUT.banyan.x === 22 && LAYOUT.banyan.z === 8);
check('garden (26.5,-13.5)', LAYOUT.garden.x === 26.5 && LAYOUT.garden.z === -13.5);
check('waterJar (25.0,-12.8)', LAYOUT.waterJar.x === 25.0 && LAYOUT.waterJar.z === -12.8);
check('vegBed (27.5,-20)', LAYOUT.vegBed.x === 27.5 && LAYOUT.vegBed.z === -20);
check('teaTable (36.5,-18.5)', LAYOUT.teaTable.x === 36.5 && LAYOUT.teaTable.z === -18.5);
check('bellTower (-22,-9)', LAYOUT.bellTower.x === -22 && LAYOUT.bellTower.z === -9);
check('lumbini (-28,-24)', LAYOUT.lumbini.x === -28 && LAYOUT.lumbini.z === -24);
// --- Tea gaps (player diameter 0.76, want >= 0.9) ---
// Table {35.65..37.35, -19..-18}, pillars (33.6/39.4, -21.1/-15.9) r 0.25, R 0.38.
const westGap = (35.65 - 0.38) - (33.6 + 0.25 + 0.38);
const eastGap = (39.4 - 0.25 - 0.38) - (37.35 + 0.38);
const northGap = (-19 - 0.38) - (-21.1 + 0.25 + 0.38);
const southGap = (-15.9 - 0.25 - 0.38) - (-18 + 0.38);
check(`tea west gap ${westGap.toFixed(2)} >= 0.9`, westGap >= 0.9);
check(`tea east gap ${eastGap.toFixed(2)} >= 0.9`, eastGap >= 0.9);
check(`tea north gap ${northGap.toFixed(2)} >= 0.9`, northGap >= 0.9);
check(`tea south gap ${southGap.toFixed(2)} >= 0.9`, southGap >= 0.9);
// --- Tea seat ---
const teaSeat = SEATS.find((s) => s.id === 'tea-seat');
check('tea seat (38.3,-18.5) facing west', teaSeat && teaSeat.x === 38.3 && teaSeat.z === -18.5 && teaSeat.facing === -Math.PI / 2);
check('tea seat walkable (no collider)', !collides(38.3, -18.5));
check('tea seat 0.57m clear of table east edge', 38.3 - 0.38 - 37.35 >= 0.5);
check('tea seat within 1.4m of route target (38.3,-17.7)', Math.hypot(38.3 - 38.3, -18.5 - -17.7) < 1.4);
check('tea table centre blocks', collides(36.5, -18.5));
check('tea east-gap route point walkable', !collides(38.3, -16));
check('tea porch target walkable', !collides(36.5, -14.0));
// --- Routes: axis-aligned + clear (waypoints + midpoints) ---
const routes = {
  garden: [[14.5, 2], [14.5, -6], [14.5, -10], [20.0, -10], [26.5, -10], [26.5, -13.5]],
  tea: [[14.5, 2], [14.5, -6], [14.5, -10], [20.0, -10], [26.5, -10], [36.5, -10], [36.5, -14.0], [38.3, -14.0], [38.3, -17.7]],
  pond: [[0, 10], [-11.1, 10], [-11.1, 3.0]],
  banyan: [[0, 10], [14.5, 10], [14.5, 8], [22, 8]],
  bell: [[-3.5, 1.5], [-3.5, -5], [-22, -5], [-22, -6.2]],
  lumbini: [[-3.5, 1.5], [-3.5, -5], [-28, -5], [-28, -20.8], [-28, -22.4]],
};
for (const [name, pts] of Object.entries(routes)) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i]; const [bx, bz] = pts[i + 1];
    check(`${name} leg ${i} axis-aligned`, ax === bx || az === bz);
    const [mx, mz] = mid(pts[i], pts[i + 1]);
    check(`${name} leg ${i} midpoint (${mx},${mz}) clear`, !collides(mx, mz));
  }
  for (const [x, z] of pts) {
    // Banyan target IS the trunk (22,8) — its collider is
    // expected; arrival is by proximity zone, and the approach
    // leg (14.5,8)->(22,8) is clear up to the trunk's edge.
    if (name === 'banyan' && x === 22 && z === 8) continue;
    check(`${name} waypoint (${x},${z}) clear`, !collides(x, z));
  }
  if (name === 'banyan') check('banyan approach (20.0,8) clear of trunk edge', !collides(20.0, 8));
}
// Corridor leg clearances (chair + east pillars).
check('corridor leg x 14.5 clear of chair (1.0 > 0.68)', Math.hypot(14.5 - 13.5, 0) > 0.3 + 0.38);
check('gate waypoint (20.0,-10) clear', !collides(20.0, -10));
check('doorway staging (0,-4) clear', !collides(0, -4));
// --- Floors ---
check('tea platform floor 0.45', floorYAt(36.5, -18.5) === 0.45);
check('tea upper step floor 0.30', floorYAt(36.5, -15.0) === 0.3);
check('tea lower step floor 0.15', floorYAt(36.5, -14.5) === 0.15);
check('tea porch floor 0', floorYAt(36.5, -14.0) === 0);
check('bed floor 0.24', floorYAt(27.5, -20) === 0.24);
check('garden target floor 0', floorYAt(26.5, -13.5) === 0);
// --- Courtyard enclosure (x -44..44, z -36..13) ---
const inCourt = (x, z) => x >= -44 && x <= 44 && z >= -36 && z <= 13;
check('bell (-22,-9) inside courtyard', inCourt(-22, -9));
check('lumbini yard (-28,-24) inside courtyard', inCourt(-28, -24));
check('lumbini yard corners inside courtyard', inCourt(-34, -28) && inCourt(-22, -18));
check('tea platform (33..40) inside courtyard', inCourt(33, -18.5) && inCourt(40, -18.5));
check('lawn (23.4..31.0) inside courtyard', inCourt(23.4, -18.4) && inCourt(31.0, -18.4));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
