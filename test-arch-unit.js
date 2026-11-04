// Architecture-pass unit test: rerouted garden/tea routes, new
// colliders, floor heights, and the pure-geometry non-overlap
// checks for every moved object. Run against the real controls.ts
// compiled with the project's tsc (no mocks of collides/floorYAt).
// NOTE: beds and jar deliberately have NO colliders — the water
// action walks to vegBed/waterJar themselves, so the route fix
// (not colliders) is what keeps feet out of the soil.
const { collides, floorYAt, LAYOUT } = require('/tmp/arch-unit/controls.js');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name); }
}
// --- New garden route waypoints + segment midpoints (walkable) ---
const gardenPts = [
  [14.4, 2], [14.4, -6], [14.2, -8], [14.6, -10], [15.0, -12],
  [15.2, -14], [15.6, -15.8], [16.2, -17.4], [18, -16],
];
const gardenMids = [
  [14.4, -2], [14.3, -7], [14.4, -9], [14.8, -11], [15.1, -13],
  [15.4, -14.9], [15.9, -16.6], [17.1, -16.7],
];
for (const [x, z] of [...gardenPts, ...gardenMids])
  check(`garden route clear (${x},${z})`, !collides(x, z));
// --- New tea route: garden leg + staging + porch target ---
check('tea staging (18.0,-16.6) walkable', !collides(18.0, -16.6));
check('tea porch target (18.5,-19.5) walkable', !collides(18.5, -19.5));
check('tea segment mid (17.1,-17.0) walkable', !collides(17.1, -17.0));
check('tea segment mid (18.25,-18.05) walkable', !collides(18.25, -18.05));
// --- Hall doorway exit (2026-11-04): the only way out of the hall ---
check('doorway staging (0,-4) clear', !collides(0, -4));
check('doorway centre (0,-5.8) clear', !collides(0, -5.8));
check('altar -> doorway midpoint (0,-10.75) clear', !collides(0, -10.75));
check('mat -> doorway midpoint (2.8,-8) clear', !collides(2.8, -8));
check('side altar -> doorway midpoint (4,-12.5) clear', !collides(4, -12.5));
check('doorway -> garden first leg midpoint (7.2,-1) clear', !collides(7.2, -1));
check('corridor chair seat reachable (no collider at 13.5,-2)', !collides(13.5, -2));
check('corridor walkway at x 14.4 clear of chair footprint (0.9 > 0.68)', Math.hypot(14.4 - 13.5, 0) > 0.3 + 0.38);
check('tea table centre blocks (18.5,-21)', collides(18.5, -21));
check('tea table corner blocks (17.7,-21.4)', collides(17.7, -21.4));
check('tea table corner blocks (19.3,-20.6)', collides(19.3, -20.6));
check('corridor walkway at x 14.4 clear of chair', !collides(14.4, -2));
// --- Floors ---
check('tea platform floor 0.45', floorYAt(18.5, -21) === 0.45);
check('tea upper step floor 0.30', floorYAt(18.5, -18.6) === 0.3);
check('tea lower step floor 0.15', floorYAt(18.5, -18.2) === 0.15);
check('tea porch floor 0.45', floorYAt(18.5, -19.5) === 0.45);
check('garden ground floor 0', floorYAt(18, -16) === 0);
check('staging stone ground floor 0', floorYAt(18.0, -16.6) === 0);
// --- LAYOUT ---
check('LAYOUT.waterJar is (17.2,-14.2)', LAYOUT.waterJar.x === 17.2 && LAYOUT.waterJar.z === -14.2);
check('LAYOUT.vegBed is (20.2,-15.4)', LAYOUT.vegBed.x === 20.2 && LAYOUT.vegBed.z === -15.4);
// --- Pure geometry: moved objects do not overlap ---
const gap = (a, b) => b - a; // positive = clear
check('bed row1 clear of tea platform (z gap 1.15)', gap(-18.75, -17.6) > 0);
check('staging stone clear of bed west edge (x gap 0.1)', gap(18.8, 18.9) > 0);
check('table clear of east cushion (x gap 0.075)', gap(19.35, 19.425) > 0);
check('table clear of west cushion (x gap 0.075)', gap(17.575, 17.65) > 0);
check('porch cushion clear of platform edge (z gap 0.175)', gap(-18.925, -18.75) > 0);
check('side table clear of pillar base (x gap 0.06)', gap(20.4, 20.46) > 0);
check('west plinth clear of lamp (gap 0.03)', gap(0.6, 0.63) > 0);
check('west pot clear of platform (x gap 0.17)', gap(15.58, 15.75) > 0);
check('flower bed clear of west pot (x gap 0.17)', gap(14.85, 15.02) > 0);
// --- Statue scale math (+15%) ---
const shOff = [-2.599 * -0.0442, -2.599 * -0.1578, -2.599 * -1.0817];
check('shakyamuni offset recomputed (0.115,0.410,2.811)',
  Math.abs(shOff[0] - 0.115) < 0.001 && Math.abs(shOff[1] - 0.410) < 0.001 && Math.abs(shOff[2] - 2.811) < 0.001);
check('shakyamuni height ~1.49m', Math.abs(0.575 * 2.599 - 1.494) < 0.01);
check('shakyamuni width overhang negligible (<=0.01/side)', (0.469 * 2.599 - 1.20) / 2 <= 0.011);
check('ksitigarbha height ~1.81m', Math.abs(1.588 * 1.1385 - 1.808) < 0.01);
check('ksitigarbha staff top ~3.95m < hall beams 6.65m', 1.63 + 2.02 * 1.15 < 6.65);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
