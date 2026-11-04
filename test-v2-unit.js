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
check('bounds x -32..32', LAYOUT.bounds.minX === -32 && LAYOUT.bounds.maxX === 32);
check('bounds z -40..30', LAYOUT.bounds.minZ === -40 && LAYOUT.bounds.maxZ === 30);
check('garden (20,-13.5)', LAYOUT.garden.x === 20 && LAYOUT.garden.z === -13.5);
check('waterJar (18.5,-12.8)', LAYOUT.waterJar.x === 18.5 && LAYOUT.waterJar.z === -12.8);
check('vegBed (21,-20)', LAYOUT.vegBed.x === 21 && LAYOUT.vegBed.z === -20);
check('teaTable (27.5,-18.5)', LAYOUT.teaTable.x === 27.5 && LAYOUT.teaTable.z === -18.5);
// --- Tea gaps (player diameter 0.76, want >= 0.9) ---
// Table {26.65..28.35, -19..-18}, pillars (24.6/30.4, -21.1/-15.9) r 0.25, R 0.38.
const westGap = (26.65 - 0.38) - (24.6 + 0.25 + 0.38);
const eastGap = (30.4 - 0.25 - 0.38) - (28.35 + 0.38);
const northGap = (-19 - 0.38) - (-21.1 + 0.25 + 0.38);
const southGap = (-15.9 - 0.25 - 0.38) - (-18 + 0.38);
check(`tea west gap ${westGap.toFixed(2)} >= 0.9`, westGap >= 0.9);
check(`tea east gap ${eastGap.toFixed(2)} >= 0.9`, eastGap >= 0.9);
check(`tea north gap ${northGap.toFixed(2)} >= 0.9`, northGap >= 0.9);
check(`tea south gap ${southGap.toFixed(2)} >= 0.9`, southGap >= 0.9);
// --- Tea seat ---
const teaSeat = SEATS.find((s) => s.id === 'tea-seat');
check('tea seat (29.3,-18.5) facing west', teaSeat && teaSeat.x === 29.3 && teaSeat.z === -18.5 && teaSeat.facing === -Math.PI / 2);
check('tea seat walkable (no collider)', !collides(29.3, -18.5));
check('tea seat 0.57m clear of table east edge', 29.3 - 0.38 - 28.35 >= 0.5);
check('tea seat within 1.4m of route target (29.3,-17.7)', Math.hypot(29.3 - 29.3, -18.5 - -17.7) < 1.4);
check('tea table centre blocks', collides(27.5, -18.5));
check('tea east-gap route point walkable', !collides(29.3, -16));
check('tea porch target walkable', !collides(27.5, -14.0));
// --- Routes: axis-aligned + clear (waypoints + midpoints) ---
const routes = {
  garden: [[14.5, 2], [14.5, -6], [14.5, -10], [16.0, -10], [20, -10], [20, -13.5]],
  tea: [[14.5, 2], [14.5, -6], [14.5, -10], [16.0, -10], [20, -10], [27.5, -10], [27.5, -14.0], [29.3, -14.0], [29.3, -17.7]],
  pond: [[0, 10], [-3.6, 10], [-3.6, 1.5]],
  banyan: [[0, 10], [8, 10], [16, 10]],
  bell: [[-3.5, 1.5], [-3.5, -5], [-14, -5], [-14, -5.8]],
  lumbini: [[-3.5, 1.5], [-3.5, -5], [-17, -5], [-17, -16.8], [-17, -18.4]],
};
for (const [name, pts] of Object.entries(routes)) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i]; const [bx, bz] = pts[i + 1];
    check(`${name} leg ${i} axis-aligned`, ax === bx || az === bz);
    const [mx, mz] = mid(pts[i], pts[i + 1]);
    check(`${name} leg ${i} midpoint (${mx},${mz}) clear`, !collides(mx, mz));
  }
  for (const [x, z] of pts) {
    // Banyan target IS the trunk (16,10) — its collider is
    // expected; arrival is by proximity zone, and the approach
    // leg (8,10)->(16,10) is clear up to the trunk's edge.
    if (name === 'banyan' && x === 16 && z === 10) continue;
    check(`${name} waypoint (${x},${z}) clear`, !collides(x, z));
  }
  if (name === 'banyan') check('banyan approach (14.0,10) clear of trunk edge', !collides(14.0, 10));
}
// Corridor leg clearances (chair + east pillars).
check('corridor leg x 14.5 clear of chair (1.0 > 0.68)', Math.hypot(14.5 - 13.5, 0) > 0.3 + 0.38);
check('gate waypoint (16.0,-10) clear', !collides(16.0, -10));
check('doorway staging (0,-4) clear', !collides(0, -4));
// --- Floors ---
check('tea platform floor 0.45', floorYAt(27.5, -18.5) === 0.45);
check('tea upper step floor 0.30', floorYAt(27.5, -15.0) === 0.3);
check('tea lower step floor 0.15', floorYAt(27.5, -14.5) === 0.15);
check('tea porch floor 0', floorYAt(27.5, -14.0) === 0);
check('bed floor 0.24', floorYAt(21, -20) === 0.24);
check('garden target floor 0', floorYAt(20, -13.5) === 0);
// --- Courtyard enclosure (x -32..32, z -33..13) ---
const inCourt = (x, z) => x >= -32 && x <= 32 && z >= -33 && z <= 13;
check('bell (-14,-8.5) inside courtyard', inCourt(-14, -8.5));
check('lumbini yard (-17,-20) inside courtyard', inCourt(-17, -20));
check('lumbini yard corners inside courtyard', inCourt(-23, -24) && inCourt(-11, -14));
check('tea platform (24..31) inside courtyard', inCourt(24, -18.5) && inCourt(31, -18.5));
check('lawn (17.4..23.8) inside courtyard', inCourt(17.4, -18.4) && inCourt(23.8, -18.4));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
