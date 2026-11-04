// E unit test: Lumbini colliders, floor heights, route waypoints,
// and D/hall regression. Run against the real controls.ts compiled
// with the project's tsc (no mocks of collides/floorYAt).
const { collides, floorYAt, LAYOUT } = require('/tmp/e-unit/controls.js');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name); }
}
// Blocked (must collide)
check('pavilion column NW blocks', collides(-19.1, -22.1));
check('pavilion column NE blocks', collides(-14.9, -22.1));
check('pavilion column SW blocks', collides(-19.1, -17.9));
check('pavilion column SE blocks', collides(-14.9, -17.9));
check('basin centre blocks', collides(-17, -19.5));
check('basin edge blocks (0.5m north)', collides(-17, -20.0));
check('garden tree NW blocks', collides(-21.5, -21.5));
check('garden tree NE blocks', collides(-12.8, -22));
check('garden tree W blocks', collides(-21, -16.8));
check('yard sign post blocks', collides(-15.2, -14.2));
// Walkable (must NOT collide)
check('ritual spot walkable', !collides(-17, -18.4));
check('pavilion centre walkable (basin aside: 0.5m south of basin edge)', !collides(-17, -18.4));
check('pavilion south entrance walkable', !collides(-17, -17.0));
check('pavilion steps walkable', !collides(-17, -16.8));
check('yard centre walkable', !collides(-17, -19.5 + 4.5)); // (-17,-15) yard entrance
check('path waypoint (-15.5,-5.2) walkable', !collides(-15.5, -5.2));
check('path waypoint (-15.5,-10) walkable', !collides(-15.5, -10));
check('path waypoint (-17,-14) walkable', !collides(-17, -14));
check('path waypoint (-17,-16.8) walkable', !collides(-17, -16.8));
check('path waypoint (-3.5,1.5) walkable', !collides(-3.5, 1.5));
check('path waypoint (-3.5,-5) walkable', !collides(-3.5, -5));
check('pavilion interior east walkable', !collides(-15.5, -20));
check('pavilion interior west walkable', !collides(-18.5, -20));
// Floor heights
check('pavilion platform floor 0.4', floorYAt(-17, -20) === 0.4);
check('pavilion platform corner floor 0.4', floorYAt(-19, -22) === 0.4);
check('lumbini upper step floor 0.27', floorYAt(-17, -17.25) === 0.27);
check('lumbini lower step floor 0.13', floorYAt(-17, -16.75) === 0.13);
check('yard ground floor 0', floorYAt(-17, -15) === 0);
check('ritual spot floor 0.4', floorYAt(-17, -18.4) === 0.4);
// Regression: D + hall unchanged
check('tea platform still 0.45', floorYAt(18.5, -21) === 0.45);
check('tea porch still walkable', !collides(18.5, -19.5));
check('corridor centre walkable', !collides(13.5, -2));
check('hall floor still 0.975', floorYAt(0, -12) === 0.975);
check('bell platform still blocks', collides(-13, -8));
check('bell standing spot walkable', !collides(-12, -5.5));
// LAYOUT sanity
check('LAYOUT.lumbiniSpot is (-17,-18.4)', LAYOUT.lumbiniSpot.x === -17 && LAYOUT.lumbiniSpot.z === -18.4);
check('LAYOUT.lumbiniBasin is (-17,-19.5)', LAYOUT.lumbiniBasin.x === -17 && LAYOUT.lumbiniBasin.z === -19.5);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
