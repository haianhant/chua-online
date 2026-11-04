'use client';

import { Suspense, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useTextures } from './textures';
import TextSign from './TextSign';
import { ShakyamuniPreview, KsitigarbhaPreview } from './SideStatuesPreview';

/**
 * Vietnamese temple, built procedurally from textured parts — not flat
 * boxes: sloped tile roofs with upturned corners, round wooden columns,
 * stone steps, a three-gate tam quan and a small chanting pavilion.
 * All in one consistent Vietnamese idiom: dark wood, vermilion,
 * terracotta tile, bronze, garden green. No torii, no Japanese shrine
 * or Chinese palace elements mixed in.
 */

export function Roof({
  width,
  depth,
  rise,
  y,
  tile,
  z = 0,
}: {
  width: number;
  depth: number;
  rise: number;
  y: number;
  tile: THREE.Texture;
  z?: number;
}) {
  const slope = Math.sqrt((depth / 2 + 0.7) ** 2 + rise ** 2);
  const angle = Math.atan2(rise, depth / 2 + 0.7);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: tile, roughness: 0.85 }),
    [tile],
  );
  return (
    <group position={[0, y, z]}>
      {/* Two sloped tile panels */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          castShadow
          material={mat}
          position={[0, rise / 2, (s * depth) / 4]}
          rotation={[s * angle, 0, 0]}
        >
          <boxGeometry args={[width + 1.2, 0.18, slope]} />
        </mesh>
      ))}
      {/* Ridge beam */}
      <mesh castShadow position={[0, rise + 0.1, 0]}>
        <boxGeometry args={[width + 1.4, 0.28, 0.4]} />
        <meshStandardMaterial color="#7a2d1e" roughness={0.8} />
      </mesh>
      {/* Upturned corners (đầu đao): small angled tips at the four eaves */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz]) => (
        <mesh
          key={`${sx}${sz}`}
          castShadow
          position={[(sx * width) / 2, 0.35, (sz * depth) / 2 + sz * 0.3]}
          rotation={[sz * 0.55, 0, -sx * 0.45]}
        >
          <boxGeometry args={[0.9, 0.16, 0.9]} />
          <meshStandardMaterial color="#a8432a" roughness={0.85} />
        </mesh>
      ))}
      {/* Golden finials at the ridge ends */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * width) / 2 + s * 0.4, rise + 0.45, 0]}>
          <coneGeometry args={[0.22, 0.6, 8]} />
          <meshStandardMaterial color="#c9a227" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function Columns({
  positions,
  height,
  wood,
}: {
  positions: Array<[number, number]>;
  height: number;
  wood: THREE.Texture;
}) {
  return (
    <group>
      {positions.map(([x, z], i) => (
        <group key={i} position={[x, height / 2, z]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.26, 0.3, height, 14]} />
            <meshStandardMaterial map={wood} roughness={0.7} />
          </mesh>
          <mesh position={[0, -height / 2 + 0.12, 0]}>
            <cylinderGeometry args={[0.36, 0.4, 0.24, 14]} />
            <meshStandardMaterial color="#6f6a60" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function MainHall({ entered }: { entered: boolean }) {
  const { wood, roofTile, stone, door } = useTextures();
  // World coords: group at z -10, so relative z 0 = world -10.
  // Expanded v7 2026-11-03: interior x ±9.5, front wall world -5.8
  // (relative 4.2) with a 3.2m centre doorway, back wall world -26
  // (relative -16), roof beams y 6.65, upper roof y 9.0. Interior
  // floor top y 0.975. These numbers MUST match LAYOUT.hall and
  // the wall colliders in controls.ts.
  // Order from the door (south) northward: mats (world -12/-14) ->
  // empty ritual floor (-16..-19) -> altar table (-20.5) ->
  // platform/statue (-23.5) -> back wall (-26).
  return (
    <group position={[0, 0, -10]}>
      {/* Three SOLID stone steps up to the platform, in the RIGHT
          order (fixed 2026-11-03): walking from the courtyard
          (south) to the hall (north) you climb 0.28 -> 0.57 -> 0.85
          (flush with the platform). The old version had the
          heights REVERSED (highest step first, facing the
          courtyard) and each step was a thin 0.36m slab centred
          above the ground, so the upper steps visibly FLOATED
          with empty air underneath. Each step is now a solid
          block from the ground up to its top, in its own 0.5m
          z-band with no overlap, so nothing floats and nothing
          is reversed. Local z = world z + 10. */}
      {[
        { z: 5.25, top: 0.85, w: 20 },
        { z: 5.75, top: 0.57, w: 19.2 },
        { z: 6.25, top: 0.28, w: 18.4 },
      ].map((s, i) => (
        <mesh
          key={i}
          receiveShadow
          castShadow
          position={[0, s.top / 2, s.z]}
        >
          <boxGeometry args={[s.w, s.top, 0.5]} />
          <meshStandardMaterial map={stone} roughness={0.95} />
        </mesh>
      ))}
      {/* Platform (top y 0.85, world -26.5..-5) */}
      <mesh receiveShadow position={[0, 0.55, -5.75]}>
        <boxGeometry args={[20, 0.6, 21.5]} />
        <meshStandardMaterial map={stone} roughness={0.95} />
      </mesh>
      {/* Interior wooden floor (top y 0.975) */}
      <mesh receiveShadow position={[0, 0.9, -5.9]}>
        <boxGeometry args={[19, 0.15, 20.2]} />
        <meshStandardMaterial color="#7a5c3a" roughness={0.8} />
      </mesh>
      {/* Back + side walls (height 5.8, centre y 3.85) */}
      <mesh castShadow position={[0, 3.85, -16]}>
        <boxGeometry args={[19, 5.8, 0.3]} />
        <meshStandardMaterial color="#e8d9b8" roughness={0.9} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} castShadow position={[s * 9.5, 3.85, -5.9]}>
          <boxGeometry args={[0.3, 5.8, 20.2]} />
          <meshStandardMaterial color="#e8d9b8" roughness={0.9} />
        </mesh>
      ))}
      {/* Front wall segments, leaving the centre doorway open
          (x -1.7..1.7). Side doors stay shut, set into the wall. */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh castShadow position={[s * 5.6, 3.85, 4.2]}>
            <boxGeometry args={[7.8, 5.8, 0.3]} />
            <meshStandardMaterial color="#e8d9b8" roughness={0.9} />
          </mesh>
          <mesh castShadow position={[s * 5.6, 3.85, 4.35]}>
            <boxGeometry args={[2.6, 5.2, 0.14]} />
            <meshStandardMaterial map={door} roughness={0.7} />
          </mesh>
        </group>
      ))}
      {/* Main sign: CHÍNH ĐIỆN, on the front wall above the central
          doorway, below the front beam — never covering the statue
          (it is outside, on the facade). */}
      <TextSign text="CHÍNH ĐIỆN" width={2.6} height={0.5} position={[0, 5.9, 4.36]} />
      {/* Front colonnade. Doorway frame columns at ±1.9 leave
          a 3.2m clear passage (see controls.ts doorway colliders). */}
      <Columns
        wood={wood}
        height={5.8}
        positions={[
          [-9, 4.2],
          [-7.5, 4.2],
          [-4.5, 4.2],
          [-1.9, 4.2],
          [1.9, 4.2],
          [4.5, 4.2],
          [7.5, 4.2],
          [9, 4.2],
        ]}
      />
      <mesh castShadow position={[0, 6.65, 4.2]}>
        <boxGeometry args={[19.6, 0.35, 0.4]} />
        <meshStandardMaterial map={wood} roughness={0.7} />
      </mesh>
      {/* Open centre doors, swung back against the front wall */}
      {[-1, 1].map((s) => (
        <mesh key={s} castShadow position={[s * 2.25, 3.85, 4.2]} rotation={[0, s * 1.1, 0]}>
          <boxGeometry args={[1.3, 5.2, 0.12]} />
          <meshStandardMaterial map={door} roughness={0.7} />
        </mesh>
      ))}
      {/* Interior columns (world z -8 and -19), clear of mats/aisles.
          Back row moved inward 2026-11-03 evening at the user's order
          (right column left, left column right: ±7.5 -> ±6.5, then
          A1: -> ±6.0) so the back columns no longer stand in front
          of the side statues. Front row ±7.5 -> ±7.0 in A1 for the
          same reason. Colliders in controls.ts moved too. */}
      <Columns
        wood={wood}
        height={5.8}
        positions={[
          [-7.0, 2],
          [7.0, 2],
          [-6.0, -9],
          [6.0, -9],
        ]}
      />
      {/* Interior beams */}
      {[2, -9].map((z) => (
        <mesh key={z} castShadow position={[0, 6.65, z]}>
          <boxGeometry args={[15.4, 0.3, 0.35]} />
          <meshStandardMaterial map={wood} roughness={0.7} />
        </mesh>
      ))}
      {/* Red carpet runner: central aisle, doorway to altar table */}
      <mesh receiveShadow position={[0, 0.99, -3]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.4, 14]} />
        <meshStandardMaterial color="#7a1f1f" roughness={0.9} />
      </mesh>
      {/* 8 mats: two symmetric clusters either side of the central
          aisle, 2 rows x 2 mats each, all facing the main altar.
          Positions MUST match SEATS in controls.ts (relative z = world + 10). */}
      {[
        [-5.6, -2], [-3.4, -2], [-5.6, -4], [-3.4, -4],
        [3.4, -2], [5.6, -2], [3.4, -4], [5.6, -4],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh receiveShadow position={[0, 1.01, 0]}>
            <boxGeometry args={[0.9, 0.05, 0.7]} />
            <meshStandardMaterial color="#8a2a2a" roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.06, 0.15]}>
            <boxGeometry args={[0.7, 0.12, 0.4]} />
            <meshStandardMaterial color="#5a1a1a" roughness={0.9} />
          </mesh>
        </group>
      ))}
      {/* 9th hall seat: low wooden chair by the east wall (world 8.3, -18.5) */}
      {/* 9th hall chair REMOVED 2026-11-03: it stood at (8.3,-18.5),
          INSIDE the east side-altar platform footprint (x 7.5..9.5,
          z -19.8..-18.2), i.e. on top of the future Ksitigarbha
          altar. The hall now has 8 mats, no chair. */}
      {/* Side altars (world ±8.0, -21), facing south toward the
          central aisle. MOVED 2026-11-03 at the user's order: the old
          slots at (±8.5, -19) sat EXACTLY on the interior-column row
          (columns at (±7.5, -19), base r 0.4) — the 2.0m platform
          spanned x 7.5..9.5, so it pierced the column base AND the
          side wall (inner face x 9.35). New slots clear both: platform
          x 7.0..9.0 (0.35m off the wall), z -21.8..-20.2 (0.8m north
          of the column row), statues face south. Name boards REMOVED
          2026-11-03 at the user's order — the red back board stays
          as a backdrop, but no deity name sign remains. */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 8.0, 0, -11]}>
          <mesh receiveShadow position={[0, 1.05, 0]}>
            <boxGeometry args={[2.0, 0.18, 1.6]} />
            <meshStandardMaterial color="#6a5a3a" roughness={0.85} />
          </mesh>
          <mesh castShadow position={[0, 1.45, 0]}>
            <boxGeometry args={[1.8, 0.12, 1.0]} />
            <meshStandardMaterial map={wood} roughness={0.7} />
          </mesh>
          {[-0.76, 0.76].map((lx, i) => (
            <group key={i} position={[lx, 1.51, 0]}>
              <mesh castShadow position={[0, 0.15, 0]}>
                <cylinderGeometry args={[0.1, 0.13, 0.3, 12]} />
                <meshStandardMaterial color="#3a5a8a" roughness={0.6} />
              </mesh>
              <mesh position={[0, 0.36, 0]}>
                <sphereGeometry args={[0.14, 12, 12]} />
                <meshStandardMaterial color="#e8a0b8" roughness={0.7} />
              </mesh>
            </group>
          ))}
          <mesh castShadow position={[0, 1.75, -0.45]}>
            <boxGeometry args={[1.4, 0.5, 0.08]} />
            <meshStandardMaterial color="#7a1f1f" roughness={0.7} />
          </mesh>
          {/* Preview statues on the new altars (deployed for review).
              Plinth top r 0.60/0.55, bottom r 0.60/0.60 (clear of the
              lamps at ±0.76: west gap 0.03m, east gap 0.08m); statue
              base at table top 1.51 + plinth 0.12 = 1.63, centred on
              the plinth. East plinth enlarged 2026-11-04 for the
              +20% Ksitigarbha (footprint 0.853x0.805 at scale 1.3662
              vs the old 0.90 top diameter — margin was 0.047m).
              Shakyamuni's origin offset is compensated
              in SideStatuesPreview.tsx (update it with any scale). */}
          <mesh castShadow position={[0, 1.57, 0]}>
            <cylinderGeometry args={[s < 0 ? 0.6 : 0.55, s < 0 ? 0.6 : 0.6, 0.12, 20]} />
            <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
          </mesh>
          <group position={[0, 1.63, 0]}>
            {/* Lazy load (user, 2026-11-03 evening): the hall walls hide
                both side statues until the guest walks into the hall,
                so their GLBs are NOT fetched on the welcome screen —
                typing the name never competes with statue downloads.
                After entering, each statue loads in its own Suspense,
                so the scene never blanks and the statues appear one by
                one as ready, while the plinth/lamps are already there. */}
            {entered && (
              <Suspense fallback={null}>
                {s < 0 ? <ShakyamuniPreview /> : <KsitigarbhaPreview />}
              </Suspense>
            )}
          </group>
        </group>
      ))}
      {/* Raised main altar platform (world z -25.2 … -21.8, top y 1.335) */}
      <mesh receiveShadow position={[0, 1.16, -13.5]}>
        <boxGeometry args={[8, 0.36, 3.4]} />
        <meshStandardMaterial color="#6a5a3a" roughness={0.85} />
      </mesh>
      <mesh receiveShadow position={[0, 1.34, -13.5]}>
        <boxGeometry args={[7.6, 0.04, 3.1]} />
        <meshStandardMaterial color="#c9a227" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Lower step in front of the platform (world z -21.5) */}
      <mesh receiveShadow position={[0, 1.06, -11.5]}>
        <boxGeometry args={[8, 0.18, 0.5]} />
        <meshStandardMaterial color="#6a5a3a" roughness={0.85} />
      </mesh>
      {/* Wooden backdrop screen behind the statue (world z -25.8) */}
      <mesh castShadow position={[0, 3.4, -15.8]}>
        <boxGeometry args={[7, 4.2, 0.12]} />
        <meshStandardMaterial color="#4a2e1a" roughness={0.75} />
      </mesh>
      <mesh position={[0, 3.4, -15.73]}>
        <boxGeometry args={[6.6, 3.8, 0.02]} />
        <meshStandardMaterial color="#c9a227" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 3.4, -15.72]}>
        <boxGeometry args={[6.3, 3.5, 0.02]} />
        <meshStandardMaterial color="#3a2412" roughness={0.8} />
      </mesh>
      {/* Altar table (world z -20.5, in front of the platform) */}
      <group position={[0, 0, -10.5]}>
        <mesh castShadow position={[0, 1.45, 0]}>
          <boxGeometry args={[4.2, 0.15, 1.0]} />
          <meshStandardMaterial map={wood} roughness={0.7} />
        </mesh>
        {[-1.9, 1.9].map((x, i) => (
          <mesh key={i} castShadow position={[x, 1.2, 0]}>
            <boxGeometry args={[0.15, 0.5, 0.9]} />
            <meshStandardMaterial map={wood} roughness={0.7} />
          </mesh>
        ))}
        {[-1.5, 1.5].map((x, i) => (
          <group key={i} position={[x, 1.52, 0]}>
            <mesh castShadow position={[0, 0.15, 0]}>
              <cylinderGeometry args={[0.12, 0.16, 0.3, 12]} />
              <meshStandardMaterial color="#3a5a8a" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.38, 0]}>
              <sphereGeometry args={[0.16, 12, 12]} />
              <meshStandardMaterial color="#e8a0b8" roughness={0.7} />
            </mesh>
          </group>
        ))}
        {[-0.9, 0.9].map((x, i) => (
          <group key={i} position={[x, 1.52, 0.2]}>
            <mesh castShadow position={[0, 0.25, 0]}>
              <cylinderGeometry args={[0.05, 0.07, 0.5, 10]} />
              <meshStandardMaterial color="#c9a227" metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.55, 0]}>
              <sphereGeometry args={[0.07, 10, 10]} />
              <meshStandardMaterial color="#ffb347" emissive="#ff8c1a" emissiveIntensity={1.2} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 1.58, -0.2]}>
          <sphereGeometry args={[0.22, 12, 12]} />
          <meshStandardMaterial color="#c9a227" metalness={0.4} roughness={0.5} />
        </mesh>
      </group>
      {/* Hoành phi board above the altar + side boards */}
      <mesh castShadow position={[0, 5.5, -15.8]}>
        <boxGeometry args={[3.6, 0.7, 0.12]} />
        <meshStandardMaterial color="#7a1f1f" roughness={0.7} />
      </mesh>
      <mesh position={[0, 5.5, -15.73]}>
        <boxGeometry args={[3.4, 0.5, 0.02]} />
        <meshStandardMaterial color="#c9a227" metalness={0.6} roughness={0.35} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} castShadow position={[s * 8.8, 3.4, -15.8]}>
          <boxGeometry args={[0.5, 2.8, 0.1]} />
          <meshStandardMaterial color="#7a1f1f" roughness={0.7} />
        </mesh>
      ))}
      {/* Hanging lanterns inside, warm and dim */}
      {[-6, 6].map((x, i) => (
        <group key={i} position={[x, 0, 2]}>
          <mesh position={[0, 5.8, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.8, 8]} />
            <meshStandardMaterial color="#2a1a12" roughness={0.8} />
          </mesh>
          <mesh position={[0, 5.3, 0]} castShadow>
            <sphereGeometry args={[0.28, 14, 14]} />
            <meshStandardMaterial color="#ffb347" emissive="#ff8c1a" emissiveIntensity={0.5} roughness={0.7} />
          </mesh>
        </group>
      ))}
      {/* Central hanging lantern over the central aisle (world z -13),
          above eye level, so it frames rather than blocks the statue */}
      <group position={[0, 0, -3]}>
        <mesh position={[0, 6.2, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.7, 8]} />
          <meshStandardMaterial color="#2a1a12" roughness={0.8} />
        </mesh>
        <mesh position={[0, 5.75, 0]} castShadow>
          <sphereGeometry args={[0.32, 14, 14]} />
          <meshStandardMaterial color="#ffb347" emissive="#ff8c1a" emissiveIntensity={0.6} roughness={0.7} />
        </mesh>
      </group>
      {/* Warm interior lights (no shadows — the sun still does that) */}
      <pointLight position={[-6, 4, -2]} intensity={12} distance={16} decay={2} color="#ffb347" />
      <pointLight position={[6, 4, -2]} intensity={12} distance={16} decay={2} color="#ffb347" />
      <pointLight position={[0, 4.5, -8]} intensity={16} distance={14} decay={2} color="#ffd9a0" />
      {/* Statue light: warm, focused, from above and in front of the
          statue (world z -23.5), so the gold reads with depth */}
      <pointLight position={[0, 5.2, -13.5]} intensity={24} distance={12} decay={2} color="#ffd9a0" />
      <pointLight position={[0, 2.8, -12.8]} intensity={9} distance={8} decay={2} color="#ffe8c0" />
      {/* Lower + upper roofs. Lower roof extended north 2026-11-03
          evening at the user's order (top-down photo showed the altar
          platform uncovered): depth 20 -> 26 and centre shifted north
          3m (local z -3), so the north eave reaches local -16.7
          (world -26.7, 0.7m beyond the back wall at -16) while the
          south eave stays at local +10.7 (world +0.7, unchanged).
          Upper tier (wall box + upper roof) shifted north by the same
          3m so it stays centred on the lower ridge. */}
      <Roof width={20} depth={26} rise={2.5} y={6.8} z={-3} tile={roofTile} />
      <mesh castShadow position={[0, 8.3, -3]}>
        <boxGeometry args={[11, 1.2, 7]} />
        <meshStandardMaterial color="#e8d9b8" roughness={0.9} />
      </mesh>
      <Roof width={12} depth={8} rise={1.8} y={9.0} z={-3} tile={roofTile} />
    </group>
  );
}


export function TamQuan() {
  const { wood, roofTile, stone } = useTextures();
  return (
    <group position={[0, 0, 13]}>
      <Columns
        wood={wood}
        height={4.2}
        positions={[
          [-3.6, 0],
          [-1.4, 0],
          [1.4, 0],
          [3.6, 0],
        ]}
      />
      {/* Low side walls */}
      {[-1, 1].map((s) => (
        <mesh key={s} castShadow position={[s * 5.2, 0.8, 0]}>
          <boxGeometry args={[3.2, 1.6, 0.5]} />
          <meshStandardMaterial map={stone} roughness={0.95} />
        </mesh>
      ))}
      {/* Beams + the institute's real name sign. The beam is made
          taller (0.9m) so the sign sits fully on its south face,
          below the tiled roof: exactly one line, CHÙA HẢI AN,
          dark brown wood, warm yellow letters, thin gold border. */}
      <mesh castShadow position={[0, 4.35, 0]}>
        <boxGeometry args={[8.6, 0.9, 0.5]} />
        <meshStandardMaterial map={wood} roughness={0.7} />
      </mesh>
      <TextSign text="CHÙA HẢI AN" width={3.4} height={0.65} position={[0, 4.35, 0.26]} />
      <Roof width={9.5} depth={3.2} rise={1.3} y={4.6} tile={roofTile} />
    </group>
  );
}

/** Small open chanting pavilion east of the hall — the chanting zone. */
export function ChantPavilion() {
  const { wood, roofTile, stone } = useTextures();
  return (
    <group position={[12, 0, 6]}>
      <mesh receiveShadow position={[0, 0.25, 0]}>
        <boxGeometry args={[5.4, 0.5, 4.6]} />
        <meshStandardMaterial map={stone} roughness={0.95} />
      </mesh>
      <Columns
        wood={wood}
        height={3}
        positions={[
          [-2.1, -1.9],
          [2.1, -1.9],
          [-2.1, 1.9],
          [2.1, 1.9],
        ]}
      />
      <mesh castShadow position={[0, 3.15, 0]}>
        <boxGeometry args={[5, 0.3, 4.2]} />
        <meshStandardMaterial map={wood} roughness={0.7} />
      </mesh>
      {/* Prayer cushions facing the hall (west) */}
      {[-1.2, 0, 1.2].map((x, i) => (
        <mesh key={i} position={[x, 0.62, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.9, 0.22, 0.9]} />
          <meshStandardMaterial color="#7a1f1f" roughness={0.9} />
        </mesh>
      ))}
      {/* Low wooden altar table at the west edge */}
      <mesh castShadow position={[-2, 0.95, 0]}>
        <boxGeometry args={[0.6, 0.7, 2.2]} />
        <meshStandardMaterial map={wood} roughness={0.7} />
      </mesh>
      <Roof width={6} depth={5} rise={1.2} y={3.3} tile={roofTile} />
    </group>
  );
}

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const t = clock.getElapsedTime();
      ref.current.rotation.z = Math.sin(t * 0.8 + position[0]) * 0.02;
    }
  });
  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.28, 0.45, 2.8, 10]} />
        <meshStandardMaterial color="#5a3a22" roughness={0.9} />
      </mesh>
      <group ref={ref} position={[0, 3.4, 0]}>
        {[
          [0, 0.6, 0, 2.2],
          [-1.2, 0, 0.3, 1.5],
          [1.2, 0.1, -0.3, 1.5],
          [0.2, 1.4, 0, 1.3],
        ].map(([x, y, z, r], i) => (
          <mesh key={i} castShadow position={[x, y, z]}>
            <icosahedronGeometry args={[r, 1]} />
            <meshStandardMaterial color="#3f7a2e" roughness={0.9} flatShading />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Bamboo({ position }: { position: [number, number, number] }) {
  // Real bamboo, not green sticks (fixed 2026-11-03): segmented
  // yellow-green culms with darker node rings every ~0.8m, thin
  // leaves fanning from the top, stalks of varying heights in a
  // loose cluster instead of a perfect ring.
  const stalks: Array<[number, number, number]> = [
    [0, 0, 4.2], [0.5, 0.3, 3.6], [-0.5, 0.4, 3.9], [0.3, -0.5, 3.2],
    [-0.4, -0.4, 3.8], [0.8, -0.2, 3.0], [-0.8, 0.1, 3.4],
  ];
  return (
    <group position={position}>
      {stalks.map(([dx, dz, h], i) => (
        <group key={i} position={[dx, 0, dz]}>
          <mesh castShadow position={[0, h / 2, 0]}>
            <cylinderGeometry args={[0.055, 0.07, h, 8]} />
            <meshStandardMaterial color={i % 2 ? '#a8c86a' : '#96b85a'} roughness={0.8} />
          </mesh>
          {[0.8, 1.6, 2.4, 3.2].filter((y) => y < h - 0.3).map((y, j) => (
            <mesh key={j} position={[0, y, 0]}>
              <cylinderGeometry args={[0.075, 0.075, 0.06, 8]} />
              <meshStandardMaterial color="#7a8a3a" roughness={0.8} />
            </mesh>
          ))}
          {/* Leaves fanning from the top */}
          {[-0.5, 0, 0.5].map((a, j) => (
            <mesh key={j} position={[Math.sin(a) * 0.25, h - 0.15, Math.cos(a) * 0.1]} rotation={[0.5, a, 0]}>
              <boxGeometry args={[0.09, 0.6, 0.02]} />
              <meshStandardMaterial color="#3f7a2e" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function StoneLantern({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.2, 0]}>
        <boxGeometry args={[0.7, 0.4, 0.7]} />
        <meshStandardMaterial color="#8d8a82" roughness={0.95} />
      </mesh>
      <mesh castShadow position={[0, 0.65, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.5, 8]} />
        <meshStandardMaterial color="#8d8a82" roughness={0.95} />
      </mesh>
      <mesh castShadow position={[0, 1.05, 0]}>
        <boxGeometry args={[0.55, 0.35, 0.55]} />
        <meshStandardMaterial color="#a39e92" roughness={0.95} />
      </mesh>
      <mesh castShadow position={[0, 1.35, 0]}>
        <coneGeometry args={[0.5, 0.35, 4]} />
        <meshStandardMaterial color="#8d8a82" roughness={0.95} />
      </mesh>
    </group>
  );
}

function Bonsai({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.45, 0.35, 0.6, 12]} />
        <meshStandardMaterial color="#7a4a2a" roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0, 0.9, 0]} rotation={[0, 0, 0.2]}>
        <cylinderGeometry args={[0.08, 0.12, 0.7, 8]} />
        <meshStandardMaterial color="#5a3a22" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0.1, 1.4, 0]}>
        <icosahedronGeometry args={[0.55, 1]} />
        <meshStandardMaterial color="#2f6a24" roughness={0.9} flatShading />
      </mesh>
    </group>
  );
}

export function Garden() {
  const { grass } = useTextures();
  const clouds = useRef<THREE.Group>(null);
  const leaves = useRef<THREE.Points>(null);
  const leafData = useMemo(() => {
    const n = 90;
    const pos = new Float32Array(n * 3);
    const spd = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = -12 + Math.random() * 24;
      pos[i * 3 + 1] = Math.random() * 7;
      pos[i * 3 + 2] = -12 + Math.random() * 28;
      spd[i] = 0.3 + Math.random() * 0.5;
    }
    return { pos, spd };
  }, []);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    if (clouds.current) {
      clouds.current.children.forEach((c, i) => {
        c.position.x = ((c.position.x + delta * 0.25 + 35) % 70) - 35;
        void i;
      });
      void t;
    }
    const pts = leaves.current;
    if (pts) {
      const attr = pts.geometry.attributes.position as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < leafData.spd.length; i++) {
        arr[i * 3 + 1] -= leafData.spd[i] * delta;
        arr[i * 3] += Math.sin(t + i) * 0.003;
        if (arr[i * 3 + 1] < 0.1) arr[i * 3 + 1] = 6 + Math.random();
      }
      attr.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Grass ground + unified brick courtyard + entrance forecourt +
          low temple compound wall (tường bao khuôn viên chùa):
          The main temple courtyard [64, 46] at (0, 0.02, -10) spans
          x -32..32, z -33..13 — symmetric, starting right at Cổng Tam Quan
          (z 13) and enclosing the main hall, bell tower, Lumbini garden,
          lotus pond, banyan courtyard, corridor, vegetable garden, tea
          house, and north path (z -30). Outside Cổng Tam Quan (z 13..20),
          a 16x7m entrance forecourt at (0, 0.02, 16.5) abuts z 13 with
          no overlap. A traditional low perimeter wall wraps the entire
          64x46m compound so every structure sits unmistakably inside
          the temple grounds. */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -8]}>
        <planeGeometry args={[150, 150]} />
        <meshStandardMaterial map={grass} roughness={1} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -11.5]}>
        <planeGeometry args={[88, 49]} />
        <meshStandardMaterial color="#9a6b52" roughness={0.95} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 16.5]}>
        <planeGeometry args={[18, 7]} />
        <meshStandardMaterial color="#9a6b52" roughness={0.95} />
      </mesh>
      {/* Stone border curbing for the entrance forecourt (x ±9, z 13..20) */}
      {[-9, 9].map((x, i) => (
        <mesh key={`fc-${i}`} receiveShadow position={[x, 0.04, 16.5]}>
          <boxGeometry args={[0.3, 0.06, 7]} />
          <meshStandardMaterial color="#8d8a82" roughness={0.95} />
        </mesh>
      ))}
      {/* Traditional low temple compound perimeter wall (tường bao khuôn viên chùa)
          connecting from Tam Quan side walls (±6.8, 13) to (±44, 13),
          then North to (±44, -36) and across the back (-44..44, -36). */}
      {[
        // Front West & East segments (x -44..-6.8 and 6.8..44 at z 13)
        [-25.4, 13, 37.2, 0.42],
        [25.4, 13, 37.2, 0.42],
        // West & East perimeter walls (x ±44, z -36..13)
        [-44, -11.5, 0.42, 49],
        [44, -11.5, 0.42, 49],
        // North perimeter wall (z -36, x -44..44)
        [0, -36, 88.4, 0.42],
      ].map(([x, z, w, d], i) => (
        <group key={`pwall-${i}`} position={[x, 0, z]}>
          {/* Stone plinth base */}
          <mesh receiveShadow castShadow position={[0, 0.14, 0]}>
            <boxGeometry args={[w, 0.28, d]} />
            <meshStandardMaterial color="#8d8a82" roughness={0.95} />
          </mesh>
          {/* Warm lime-yellow wall body */}
          <mesh receiveShadow castShadow position={[0, 0.62, 0]}>
            <boxGeometry args={[w > d ? w : w * 0.85, 0.68, d > w ? d : d * 0.85]} />
            <meshStandardMaterial color="#e8d9b8" roughness={0.9} />
          </mesh>
          {/* Terracotta tile coping cap */}
          <mesh castShadow position={[0, 1.01, 0]}>
            <boxGeometry args={[w > d ? w + 0.08 : w + 0.12, 0.1, d > w ? d + 0.08 : d + 0.12]} />
            <meshStandardMaterial color="#a8432a" roughness={0.85} />
          </mesh>
        </group>
      ))}
      {/* Corner & interval pillars along the temple perimeter wall */}
      {[
        [-44, 13], [-25, 13], [25, 13], [44, 13],
        [-44, -3], [-44, -19], [-44, -36],
        [44, -3], [44, -19], [44, -36],
        [-22, -36], [0, -36], [22, -36],
      ].map(([x, z], i) => (
        <group key={`ppillar-${i}`} position={[x, 0, z]}>
          <mesh castShadow position={[0, 0.62, 0]}>
            <boxGeometry args={[0.58, 1.24, 0.58]} />
            <meshStandardMaterial color="#8d8a82" roughness={0.95} />
          </mesh>
          <mesh castShadow position={[0, 1.28, 0]}>
            <boxGeometry args={[0.68, 0.1, 0.68]} />
            <meshStandardMaterial color="#a8432a" roughness={0.85} />
          </mesh>
        </group>
      ))}
      {/* Central stone path from entrance forecourt through Tam Quan
          to the incense burner (stops cleanly at z 0.2, never cutting
          under the burner or into the hall steps). */}
      {Array.from({ length: 11 }).map((_, i) => (
        <mesh key={i} receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 16.2 - i * 1.6]}>
          <planeGeometry args={[2.2, 1.1]} />
          <meshStandardMaterial color="#b0a894" roughness={0.95} />
        </mesh>
      ))}
      {/* Lotus pond (Tâm Liên Hồ) lives in Pond.tsx now. */}
      {/* Courtyard trees spread out across the enlarged 88x49m compound,
          matching colliders in controls.ts and leaving generous open space
          between architectural zones. */}
      <Tree position={[8.5, 0, 3.5]} scale={1.05} />
      <Tree position={[-36.0, 0, -8.0]} scale={1.05} />
      <Tree position={[-16.5, 0, -28.0]} scale={0.95} />
      <Tree position={[32.0, 0, 2.0]} scale={1.0} />
      <Bamboo position={[6.5, 0, 8.5]} />
      <Bamboo position={[-7.5, 0, 8.5]} />
      <StoneLantern position={[-2.4, 0, 8]} />
      <StoneLantern position={[2.4, 0, 8]} />
      <StoneLantern position={[-2.4, 0, 3.5]} />
      <StoneLantern position={[2.4, 0, 3.5]} />
      {/* Bonsai flanking the steps, ON FLAT COURTYARD GROUND */}
      <Bonsai position={[-4.6, 0, -2.0]} />
      <Bonsai position={[4.6, 0, -2.0]} />

      {/* Distant misty hills — smooth DOMES far outside the enlarged compound */}
      {(
        [
          [-54, -64, 24, '#7a9a6a'],
          [54, -66, 26, '#6a8a62'],
          [0, -74, 28, '#7a9a72'],
        ] as Array<[number, number, number, string]>
      ).map(([x, z, r, col], i) => (
        <mesh key={i} position={[x, 0, z]} scale={[1, 0.35, 1]}>
          <sphereGeometry args={[r, 24, 16]} />
          <meshStandardMaterial color={col} roughness={1} />
        </mesh>
      ))}

      {/* Drifting clouds */}
      <group ref={clouds}>
        {[
          [-15, 14, -20],
          [5, 16, -25],
          [18, 13, -15],
        ].map(([x, y, z], i) => (
          <group key={i} position={[x, y, z]}>
            {[0, 1.2, -1.2].map((dx, j) => (
              <mesh key={j} position={[dx, 0, 0]} scale={[1, 0.45, 1]}>
                <sphereGeometry args={[1.6, 12, 12]} />
                <meshStandardMaterial color="#ffffff" transparent opacity={0.85} roughness={1} />
              </mesh>
            ))}
          </group>
        ))}
      </group>

      {/* Falling leaves / petals */}
      <points ref={leaves}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[leafData.pos, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.12} color="#c8d98a" transparent opacity={0.8} sizeAttenuation depthWrite={false} />
      </points>
    </group>
  );
}
