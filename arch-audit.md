# Architecture audit — working notes (2026-11-04 morning)
## Reference: the avatar
- Height ~2.42m incl. nón lá (hat top 2.42, head centre 1.98), tunic
  diameter 0.64–0.84, total width with arms ~0.98, player radius 0.38.
- Rule of thumb: furniture sized for a 1.7m person reads ~30% too
  small next to this avatar. Fix by enlarging/moving, NOT rebuilding.

## CONFIRMED (from source + user screenshot 07:28)
### Tea house (priority)
- Table top 0.89, chairs 0.6 wide / seat 0.80, cushions 0.55 —
  vs avatar 2.4m/0.98 wide: reads as doll furniture (user's words).
- Platform 5.5x4.5 mostly empty grey: furniture clustered centre.
- Fix: table ~1.6x0.95, top ~1.02; chairs ~0.8 wide, seat ~0.95;
  cushions ~0.75, thicker 0.16; spread cluster to fill platform.
  Keep seat facing the garden (south), table behind — original design.
  Update: table collider {17.8..19.2, -21.4..-20.6} if table grows,
  tea-seat target (18.5,-20.2) unchanged, porch targets unchanged.
### Garden / tea path (user morning feedback)
- (1) North bed row soil (x 17.9..21.1, z -19.1..-17.9, y 0..0.24)
  sinks into tea platform (x 15.75..21.25, z -23.25..-18.75, y 0..0.45)
  AND into upper tea step (x 17.5..19.5, z -18.8..-18.3, y 0.15..0.30).
- (2) Map auto-walk to tea porch, segment (17.0,-17.6)->(18.5,-19.5),
  passes through bed-row-1 footprint (point (17.9,-18.74) inside);
  beds have NO colliders, so the avatar walks through soil/plants.
- (3) Path stones (17.0,-15.6)/(17.0,-17.6) sit 0.1m from bed west
  edge (17.9), in a diagonal zigzag (14.0->14.8->15.8->16.2->17.0).
- Planned fix: beds centre x 19.5->20.2, width 3.2->2.6
  (x 18.9..21.5), rows z -18.5/-16.9/-15.3 -> -17.0/-15.4/-13.8;
  path stones to a clean west-edge line (14.2,-8),(14.6,-10),
  (15.0,-12),(15.4,-14),(16.0,-15.6),(16.4,-17.6),(18.0,-17.6);
  tea route via (18.0,-17.6)->porch (18.0,-19.5) straight north
  up the steps; garden route target (18,-16) stays clear
  (bed west edge now 18.9); LAYOUT.vegBed (19.5,-17.5)->(20.2,-15.4),
  waterStream group (19.5,-17.5)->(20.2,-15.4); flower bed at
  (15.7,-18.0) stays (clear of new staging line by >2m).
  Stone lantern (19.8,-16.5) vs new bed row2 (x 18.9..21.5,
  z -16.0..-14.8): lantern INSIDE bed footprint — MOVE lantern
  to (17.2,-16.0) or (22.0,-14.0) when beds move. Check on retest.
### Corridor chair ("floating" complaint)
- Code HAS legs (0..0.35, seat 0.35, back to 1.15) — but legs are
  0.08 thick dark wood on a dark reddish floor: on a phone they
  vanish and the seat reads as floating. Fix: legs 0.12 thick +
  low stretcher bars, same position (13.5,-2). Also confirm on
  retest shot whether the user meant this chair at all.
### UNRESOLVED from user words
- 'lối đi ra vườn nằm ngang giữa đường': no single object found
  in coordinates. Ask user to pinpoint on the retest overview shot.

## Other zones (read 2026-11-04, move-only notes)
- Hall mats 0.9x0.7, cushions 0.7x0.4: smallish vs avatar width
  0.98 but mats are floor cushions — leave unless user says so.
- Side altar tables 1.8x1.0 top ~1.51, main altar 4.2x1.0 top
  ~1.52: proportionate to avatar (63% of height). Leave.
- Burner r 0.85 body, top ~1.0, sticks to ~1.9: waist-high. Leave.
- Pond: visual water r 4.4 but collider r 3.6 — avatar can stand
  0.8m into the visual water edge. Fix candidate: collider 3.6->4.2
  (or leave; user did not complain — decide on retest).
- Bell tower, Lumbini pavilion/basin: proportions intentional
  (basin rim 0.9, statue 0.7 on pedestal 1.12 -> top 1.82 < avatar).
  Leave.
- Banyan trunk r 0.9 collider, bench, broom/basket: no overlap
  found in code. Leave pending visual retest.

## NEW SCOPE (user 2026-11-04 morning, screenshot image-20 + follow-up)
### Ground planes: overlapping, inconsistent (user: "rất là chồng chéo")
- The screenshot shows exactly the failure mode: a green patch, brown
  earth and path stones cutting across each other with raw, unmatched
  edges — the layers read as stacked rectangles, not one ground.
- Ground layers in code (all in plan, different y, so no z-fight but
  hard visual cuts): world click-plane 50x62 (World.tsx, y 0); base
  courtyard 70x70 + 26x30 (Temple.tsx); banyan-area 12x12 #9a6b52
  (Grounds 284); corridor floor 6.2x10 #9a6b52 (Grounds 453);
  garden green 10x10 #7a9a5a (Grounds 555); Lumbini yard 12x10
  #b0a184 (Lumbini 199); path stones 1.6x1.6 / 1.8x1.8 at y 0.04
  on top of all of the above; hall platform 20x21.5; pond circle
  r 4.4 + banks.
- Fix direction (move/trim only, no rebuild): audit every pair of
  overlapping ground planes in plan view and make edges MEET, not
  cross — trim the garden green so its south/west edges stop at the
  path line (with a stone edging strip where two surfaces must meet),
  keep each path stone fully on ONE surface (shift stones off
  boundaries), align corridor floor edges with the garden-wall line,
  and give Lumbini yard a clean border where the stone path enters.
  Where two browns meet (#9a6b52 vs base ground), either match the
  tone or separate them with an edging — no silent tone jump mid-yard.
### Overall consistency (user: "chưa nhất quán, rất rời rạc")
- The pass is NOT zone-by-zone fixes in isolation: check the whole
  walk as one continuous place — courtyard -> corridor -> garden ->
  tea, and pond -> bell -> Lumbini — for one material language
  (stone greys, wood browns, roof reds), one path width language,
  and clean transitions at every zone boundary. Anything that reads
  as a different place's offcut gets moved/trimmed/retoned, not rebuilt.
### Side statues +15% (user order)
- SideStatuesPreview.tsx: Shakyamuni scale 2.26 -> 2.599
  (~1.30m -> ~1.50m); Ksitigarbha scale 0.99 -> 1.1385
  (~1.57m -> ~1.81m, staff top ~2.02m -> ~2.32m — still under the
  hall wall height 5.8 and below Guanyin; check staff top vs the
  side-altar roofline on retest).
- WARNING in the file header: the Shakyamuni offset group
  (position [0.100, 0.357, 2.445]) cancels the model origin at scale
  2.26 and MUST be recomputed when the scale changes: new offset =
  old offset * (2.599 / 2.26) = [0.115, 0.410, 2.812].
  Ksitigarbha has no such offset (plain primitive) — scale only.
- Check after scaling: statue footprints vs side-altar tables
  (2.0x1.6 at y 1.05) and vs the side walls; statues sit ON the
  tables, so also check the statue base still lands on the tabletop,
  not floating or overhanging.
### Retest checklist for this pass (user: "kiểm thử kĩ về UI kiểu này")
- Ground edges at WALK level (camera at eye height, looking along
  each boundary) AND from a high angle, for every zone boundary —
  not just the garden/tea cluster.
- One continuous walk of the full loop (courtyard -> corridor ->
  garden -> tea, and pond -> bell -> Lumbini) watching only for
  visual continuity: tone jumps, raw edges, stones half-on/half-off
  a surface, paths that change width without reason.
- Side statues at +15% from front, 45 deg and close-up: base on
  table, no overhang, staff clear of the roof.

## 2026-11-04 v3 retest: hall -> garden WEDGE (real bug, fixed)
- v3: hall arrival OK (Quy le, 918s), statue shots reviewed clean:
  +15% reads as intended; Ksitigarbha close-up: standing monk, staff,
  jewel hand, base solid on plinth, lamps flanking; Shakyamuni seated
  on its altar with lamps, base on plinth, no overhang at frame distance.
- Garden leg FAILED: marker frozen at (7.33,-6.46) for 40+ min across
  all checks + one re-issue. Cause: the hall->garden first leg crosses
  the front wall diagonally into the pocket between the front-right
  wall (x 1.7..9.65, z -5.95..-5.65) and the door post (7.5,-5.8) r 0.3.
  The player ended exactly on the post's expanded circle (0.68m) and
  0.13m off the wall's expanded face; every tried direction failed
  the 80%-of-step test (per-axis partial steps rejected), so chosen
  stayed null every frame = hard freeze. A real user tapping
  'Vườn sau' from inside the hall would hit this.
- Fix (Player.tsx, 2026-11-04): wedge fallback — when no direction
  passes 80%, creep along the best partial direction instead of
  freezing. The final displacement is collision-clamped again, so this
  slides along the obstacle until a full step frees up; normal walks
  (offset 0 passes) are untouched; manual input still cancels auto-move.
- v4 retest (test-arch-garden.js) verifies exactly hall -> garden
  after the fix. Garden overview shots still pending (v3's show the
  pinned hall interior, not the garden).

## 2026-11-04 v2 REPL AN (user orders 14:51-14:59, screenshots image-21..24)
User verdict: the 2026-11-04 morning pass did NOT fix it — paths still
diagonal, garden + tea still overlap, banyan still 3 ground patches,
tea chair overlaps the table, bell + Lumbini look OUTSIDE the temple,
"too many overlaps". Order: RECALCULATE the whole map, REPOSITION the
surrounding structures, EXPAND the grounds BOLDLY. Plus: the east
statue (image-24) is Ksitigarbha (Địa Tạng Vương Bồ Tát) — +20% more.
Principles (per the 3D skill): ONE base ground + ONE brick courtyard
enclosing everything; zones as clean rectangles that abut, never
partially overlap; ALL routes + ALL stone lines axis-aligned (N-S /
E-W only, 90° turns); walkway gaps >= 0.9m; seat trigger (1.4m) must
exceed the standing-point distance; pedestal rechecked after scaling.
SITE PLAN v2 (x east, z south; hall north):
- Bounds x -32..32, z -40..30. Base grass [90,90] at (0,-6).
  Brick courtyard [52,50] at (0,-5) -> x -26..26, z -30..20, y 0.02
  (ENCLOSES hall, bell, Lumbini, garden, tea, pond, banyan, corridor).
  Click-plane [70,78] at (0,-5).
- Banyan cluster UNMOVED (trunk (16,10), bench, broom, sweep): the
  12x12 brown plane is REMOVED (it overlapped the brick courtyard
  x 10..13 and left a grass strip z 3..4 to the corridor floor);
  replaced by a flat stone ring (inner 1.3, outer 2.0) at y 0.03.
  Corridor floor plane REMOVED (same material as the courtyard).
  Courtyard->banyan stones: 5 (x 5..13.8), not 6 (the 6th sat under
  the trunk). Banyan->corridor stones (13.5, 8/6/4) kept, straight.
- Garden wall: north segment SHORTENED to z -8.8..-7 (was ..-5: it
  poked 1m into the corridor); gate (13,-10) unchanged.
- Lawn (green) MOVED east + enlarged: [14,17] at (24,-17.5) ->
  x 17..31, z -26..-9, y 0.04. Beds: 3 rows at (21,-22/-20/-18),
  soil [5.0,1.2] -> x 18.5..23.5; floorYAt beds 0.24. Jar
  (18.5,-12.8), dipper (19.1,-12.8), vegBed (21,-20), stream (21,-20).
  Garden target (20,-13.5). Shrubs: (11.5,-7.5) kept, (13.9,-13.3)
  -> (12.0,-13.5), (18.4,-13.4) kept. Flower bed -> (16.3,-13.0).
  Lanterns -> (18.5,-10.8), (21.5,-10.8). Pots -> (24.8,-14.6),
  (30.2,-14.6) flanking the tea steps.
- Tea house MOVED east + widened: platform [7.0,6.5] at (27.5,-18.5)
  -> x 24..31, z -21.75..-15.25, top 0.45. Pillars (24.6/30.4,
  -21.1/-15.9). South steps x 25.5..29.5: upper z -15.25..-14.75
  (0.30), lower z -14.75..-14.25 (0.15). Porch target (27.5,-14.0).
  Table (27.5,-18.5) [1.7,1.0], collider {26.65..28.35, -19..-18}.
  Gaps around table: west 1.04m, east 1.04m, north 1.09m, south 1.59m
  (all >= 0.9m, passable). CHAIR MOVED EAST of the table:
  (29.3,-18.5), facing WEST (-PI/2) -> sitter sees table + beds
  beyond (the old south chair overlapped the table: seated body
  reached z -20.58 vs table edge -20.5). New clearance 0.57m.
  Side table (25.0,-20.9), NW lantern (24.0,-23.5), cushions:
  north (27.5,-20.0), south (27.5,-17.0), porch (25.8,-15.7),
  (28.0,-15.7). Tea route target (29.3,-17.7), 0.8m from the seat.
- Routes (ALL axis-aligned): garden [(14.5,2),(14.5,-6),(14.5,-10),
  (13,-10),(20,-10)] -> (20,-13.5); tea [same prefix, (27.5,-10),
  (27.5,-14.0),(29.3,-14.0)] -> (29.3,-17.7); pond [(0,10),
  (-3.6,10)] -> (-3.6,1.5); banyan [(0,10),(8,10)] -> (16,10);
  lumbini [(-3.5,1.5),(-3.5,-5.2),(-17,-5.2),(-17,-16.8)] -> spot;
  bell + hall + chant + gate unchanged (already axis-aligned).
- Stone lines (visual, matching routes): N-S x 14.5 (z 2..-10);
  E-W z -10 (x 16..26); N-S x 27.5 (z -12,-14, on the lawn);
  pond E-W z -5 (x -10.5..-3.9) + N-S x -3.5 (z -2.8,-0.6,1.6);
  bell<->Lumbini E-W z -5.2 (x -12.5,-14.8,-17) + N-S x -17
  (z -7.5,-9.8,-12.1,-14.4) + landing [1.8,1.0] (-17,-16.0).
  Pond west stone abuts the Lumbini east stone at x -11.6 (shared
  edge, no overlap); corner joins share material + y.
- Map: new formula x=(wx+32)*10, y=(wz+40)*10, viewBox 640x700.
  Hall rect (225,140,190,202); tam quan (270,520,100,20); pond
  (235,415,r36); banyan (480,500,r26); lawn rect (490,140,140,170);
  tea rect (560,182,70,65); bell (190,320,r14); Lumbini (150,200,
  r16) + label east (172,204). Marker formula updated in tests too.
- Ksitigarbha (image-24 = Ngài Địa Tạng Vương Bồ Tát, east altar):
  scale 1.1385 -> 1.3662 (+20% on top of +15%): height ~2.17m,
  staff top world ~4.42m < beams 6.65m. Footprint measured via
  Blender: 0.624 x 0.589 at scale 1 -> 0.853 x 0.805 at 1.3662,
  vs east plinth top diameter 0.90 (margin 0.047, too tight) ->
  east plinth enlarged top r 0.45 -> 0.55, bottom 0.55 -> 0.60
  (lamp gap 0.08m, base stays Y=0, no sink/float).

## 2026-11-04 ~15:04 — V2 REPL AN TẠM DỪNG THEO LỆNH USER (chưa deploy)
User: dừng hết việc chùa, có việc quan trọng hơn. Trạng thái:
- LIVE KHÔNG ĐỔI: vẫn dpl_ARZU1nW2uk68XsqAmBeY1HFA1zYu (bản sắp xếp
  buổi sáng). Không có gì của v2 lên live.
- SOURCE ĐANG DỞ DANG, KHÔNG ĐƯỢC BUILD/DEPLOY: controls.ts đã sửa
  xong (bounds -32..32/-40..30, garden (20,-13.5), jar (18.5,-12.8),
  vegBed (21,-20), teaTable (27.5,-18.5), tea-seat (29.3,-18.5) facing
  -PI/2, floorYAt bệ trà + luống mới, collider bàn/cột trà + tường
  vườn rút ngắn); Grounds.tsx sửa được một nửa (vòng đá cây đa, bỏ
  sàn hành lang, tường vườn rút ngắn, bãi cỏ + luống + chum mới).
  CHƯA SỬA: nhà trà (vẫn ở vị trí cũ 18.5,-21 trong code, lệch với
  LAYOUT mới), routes + map trong page.tsx, đá đường, Lumbini,
  Temple.tsx (sân/bệ), SideStatuesPreview (Địa Tạng +20%), unit test.
  Vì vậy source hiện tại LỆCH NHAU (LAYOUT mới vs nhà trà/routes cũ)
  — khi quay lại v2 phải sửa nốt các phần CHƯA SỬA rồi mới build/test.
