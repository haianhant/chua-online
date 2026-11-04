'use client';

import { Suspense, memo, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useTextures } from './textures';
import { controls } from './controls';
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
      {/* Upturned corners (đầu đao cong vút truyền thống) + chuông gió đồng */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz]) => (
        <group
          key={`${sx}${sz}`}
          position={[(sx * width) / 2, 0.35, (sz * depth) / 2 + sz * 0.3]}
        >
          {/* Phần bệ đầu đao */}
          <mesh
            castShadow
            rotation={[sz * 0.55, 0, -sx * 0.45]}
          >
            <boxGeometry args={[1.05, 0.18, 1.05]} />
            <meshStandardMaterial color="#a8432a" roughness={0.82} />
          </mesh>
          {/* Mũi đao uốn cong vút lên trời */}
          <mesh
            castShadow
            position={[sx * 0.42, 0.36, sz * 0.38]}
            rotation={[sz * 0.85, 0, -sx * 0.78]}
          >
            <coneGeometry args={[0.18, 0.95, 6]} />
            <meshStandardMaterial color="#b84a2c" roughness={0.75} />
          </mesh>
          {/* Viền vàng trang trí đầu đao */}
          <mesh
            position={[sx * 0.28, 0.22, sz * 0.24]}
            rotation={[sz * 0.72, 0, -sx * 0.65]}
          >
            <boxGeometry args={[0.14, 0.48, 0.14]} />
            <meshStandardMaterial color="#d4af37" metalness={0.55} roughness={0.38} />
          </mesh>
          {/* Chuông gió đồng treo dưới đầu đao (Phong linh) */}
          <mesh position={[sx * 0.35, -0.22, sz * 0.32]}>
            <cylinderGeometry args={[0.06, 0.10, 0.18, 8]} />
            <meshStandardMaterial color="#c9a227" metalness={0.68} roughness={0.32} />
          </mesh>
        </group>
      ))}
      {/* Golden finials at the ridge ends (Kìm nóc mạ vàng) */}
      {[-1, 1].map((s) => (
        <group key={s} position={[(s * width) / 2 + s * 0.4, rise + 0.45, 0]}>
          <mesh>
            <coneGeometry args={[0.24, 0.68, 8]} />
            <meshStandardMaterial color="#d4af37" metalness={0.72} roughness={0.32} />
          </mesh>
          <mesh position={[0, 0.38, 0]}>
            <sphereGeometry args={[0.11, 10, 10]} />
            <meshStandardMaterial color="#ffd75e" metalness={0.8} roughness={0.25} />
          </mesh>
        </group>
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

export const MainHall = memo(function MainHall({ entered }: { entered: boolean }) {
  const { wood, roofTile, stone, door } = useTextures();
  const sideStatuesRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!sideStatuesRef.current) return;
    // Distance-cull the 276k-triangle indoor side statues when the player is far out in the courtyard
    const nearHall = controls.playerPos.z < 3.5 && Math.abs(controls.playerPos.x) < 16;
    if (sideStatuesRef.current.visible !== nearHall) {
      sideStatuesRef.current.visible = nearHall;
    }
  });

  // World coords: group at z -10, so relative z 0 = world -10.
  // Expanded v7 2026-11-03: interior x ±9.5, front wall world -5.8
  // (relative 4.2) with a 3.2m centre doorway, back wall world -26
  // (relative -16), roof beams y 6.65, upper roof y 9.0. Interior
  // floor top y 0.975. These numbers MUST match LAYOUT.hall and
  // the wall colliders in controls.ts.
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
      {/* 16 mats + 8 Sutra Desks (Kinh Án): two symmetric clusters either
          side of the central aisle, 4 rows x 2 mats each (16 seats total),
          all facing the main altar. Positions MUST match SEATS in controls.ts
          (relative z = world z + 10 -> -0.2, -2.0, -4.0, -5.8). */}
      {[
        [-5.6, -0.2], [-3.4, -0.2], [3.4, -0.2], [5.6, -0.2],
        [-5.6, -2.0], [-3.4, -2.0], [3.4, -2.0], [5.6, -2.0],
        [-5.6, -4.0], [-3.4, -4.0], [3.4, -4.0], [5.6, -4.0],
        [-5.6, -5.8], [-3.4, -5.8], [3.4, -5.8], [5.6, -5.8],
      ].map(([x, z], i) => (
        <group key={`hall-mat-${i}`} position={[x, 0, z]}>
          {/* Thảm nỉ đỏ viền vàng */}
          <mesh receiveShadow position={[0, 1.005, 0]}>
            <boxGeometry args={[1.02, 0.04, 0.78]} />
            <meshStandardMaterial color="#8a2420" roughness={0.88} />
          </mesh>
          <mesh position={[0, 1.028, 0]}>
            <boxGeometry args={[0.92, 0.015, 0.68]} />
            <meshStandardMaterial color="#d4af37" metalness={0.45} roughness={0.45} />
          </mesh>
          {/* Bồ đoàn hoa sen tròn (Lotus meditation cushion) */}
          <mesh position={[0, 1.075, 0.10]}>
            <cylinderGeometry args={[0.32, 0.36, 0.11, 14]} />
            <meshStandardMaterial color="#681818" roughness={0.85} />
          </mesh>
          <mesh position={[0, 1.132, 0.10]}>
            <cylinderGeometry args={[0.22, 0.28, 0.02, 12]} />
            <meshStandardMaterial color="#d4af37" metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {/* 8 Bàn Kinh Án gỗ thấp (Low wooden sutra desks with open golden sutra books & wooden fish) */}
      {[-0.2, -2.0, -4.0, -5.8].flatMap((rz, rIdx) =>
        [-4.5, 4.5].map((rx, sIdx) => (
          <group key={`sutra-desk-${rIdx}-${sIdx}`} position={[rx, 1.0, rz - 0.56]}>
            {/* Mặt bàn kinh gỗ lim sơn son viền vàng */}
            <mesh castShadow position={[0, 0.30, 0]}>
              <boxGeometry args={[3.15, 0.06, 0.42]} />
              <meshStandardMaterial map={wood} roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.335, 0]}>
              <boxGeometry args={[2.95, 0.012, 0.32]} />
              <meshStandardMaterial color="#7a1b18" roughness={0.75} />
            </mesh>
            {/* Chân bàn kinh */}
            {[-1.42, 1.42].map((lx, li) => (
              <mesh key={li} position={[lx, 0.15, 0]}>
                <boxGeometry args={[0.10, 0.28, 0.36]} />
                <meshStandardMaterial map={wood} roughness={0.75} />
              </mesh>
            ))}
            {/* 2 Cuốn Kinh Phật mở trang vàng trước mỗi tọa cụ (±1.1m) */}
            {[-1.1, 1.1].map((bx, bi) => (
              <group key={bi} position={[bx, 0.35, 0]}>
                <mesh rotation={[-0.08, 0, 0]}>
                  <boxGeometry args={[0.42, 0.022, 0.26]} />
                  <meshStandardMaterial color="#f6e7c1" roughness={0.8} />
                </mesh>
                <mesh position={[0, 0.014, 0]}>
                  <boxGeometry args={[0.02, 0.01, 0.26]} />
                  <meshStandardMaterial color="#8f241e" roughness={0.6} />
                </mesh>
              </group>
            ))}
            {/* Mõ gỗ (Mộc ngư) & Chuông gia trì ở giữa bàn kinh */}
            <mesh position={[-0.14, 0.40, 0]} scale={[1.1, 0.85, 0.95]}>
              <sphereGeometry args={[0.085, 10, 10]} />
              <meshStandardMaterial color="#9e2a1e" roughness={0.55} />
            </mesh>
            <mesh position={[0.14, 0.39, 0]}>
              <cylinderGeometry args={[0.06, 0.08, 0.09, 10]} />
              <meshStandardMaterial color="#d4af37" metalness={0.75} roughness={0.28} />
            </mesh>
          </group>
        )),
      )}
      {/* Side altars (world ±8.0, -21), facing south toward the central aisle. */}
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
          <mesh castShadow position={[0, 1.57, 0]}>
            <cylinderGeometry args={[s < 0 ? 0.6 : 0.55, s < 0 ? 0.6 : 0.6, 0.12, 20]} />
            <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
          </mesh>
        </group>
      ))}
      {/* Distance-culled high-poly side statues (hidden when player is far outside in courtyard) */}
      <group ref={sideStatuesRef}>
        {entered && (
          <>
            <group position={[-8.0, 1.63, -11]}>
              <Suspense fallback={null}>
                <ShakyamuniPreview />
              </Suspense>
            </group>
            <group position={[8.0, 1.63, -11]}>
              <Suspense fallback={null}>
                <KsitigarbhaPreview />
              </Suspense>
            </group>
          </>
        )}
      </group>
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
      {/* Single optimized warm interior pointLight (replaces 5 separate pointLights to eliminate fragment shader overhead on high-res PC displays) */}
      <pointLight position={[0, 4.9, -8.5]} intensity={24} distance={22} decay={1.6} color="#ffd9a0" />

      {/* 🎋 Ống xâm Từ Bi (Compassionate Bamboo Fortune Cylinder) trên đôn gỗ cạnh bàn thờ (world x 2.2, z -19.8) */}
      <group position={[2.2, 0.98, -9.8]}>
        {/* Đôn gỗ chạm khắc đặt ống xâm */}
        <mesh castShadow position={[0, 0.32, 0]}>
          <cylinderGeometry args={[0.32, 0.28, 0.64, 14]} />
          <meshStandardMaterial color="#4a2816" roughness={0.75} />
        </mesh>
        <mesh position={[0, 0.65, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 0.04, 16]} />
          <meshStandardMaterial color="#c9a227" metalness={0.55} roughness={0.38} />
        </mesh>
        {/* Ống xâm tre sơn đỏ đai đồng */}
        <mesh castShadow position={[0, 0.84, 0]}>
          <cylinderGeometry args={[0.13, 0.115, 0.34, 16]} />
          <meshStandardMaterial color="#8f241e" roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.96, 0]}>
          <torusGeometry args={[0.128, 0.014, 8, 18]} />
          <meshStandardMaterial color="#d4af37" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Các thẻ xâm tre đầu sơn đỏ nhô lên trong ống */}
        {[-0.05, -0.02, 0.01, 0.04, 0, -0.03, 0.03].map((ox, idx) => (
          <group
            key={`stick-${idx}`}
            position={[ox, 1.05, ((idx % 3) - 1) * 0.035]}
            rotation={[(idx - 3) * 0.06, idx * 0.5, (idx - 3) * 0.08]}
          >
            <mesh>
              <boxGeometry args={[0.022, 0.22, 0.008]} />
              <meshStandardMaterial color="#dfb87b" roughness={0.75} />
            </mesh>
            <mesh position={[0, 0.095, 0]}>
              <boxGeometry args={[0.024, 0.045, 0.01]} />
              <meshStandardMaterial color="#b82921" roughness={0.6} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Thềm rồng đá xanh chạm mây (Dragon-carved stone balustrades flanking the front steps) */}
      {[-9.3, -3.1, 3.1, 9.3].map((bx, idx) => (
        <group key={`dragon-step-${idx}`} position={[bx, 0, 5.5]}>
          {/* Thân thành bậc đá xanh nghiêng theo bậc tam cấp */}
          <mesh castShadow position={[0, 0.52, 0]} rotation={[0.42, 0, 0]}>
            <boxGeometry args={[0.34, 0.42, 2.15]} />
            <meshStandardMaterial color="#6d726e" roughness={0.88} />
          </mesh>
          {/* Đường vân mây rồng uốn lượn dọc thành bậc */}
          {[0.35, 0, -0.35].map((oz, wi) => (
            <mesh key={wi} castShadow position={[0, 0.68 - wi * 0.14, oz]} scale={[0.9, 0.7, 1.2]}>
              <sphereGeometry args={[0.19, 10, 10]} />
              <meshStandardMaterial color="#7c827d" roughness={0.84} />
            </mesh>
          ))}
          {/* Đầu rồng đá chầu ở chân bậc tam cấp (z = 6.45) */}
          <group position={[0, 0.38, 0.95]}>
            <mesh castShadow>
              <boxGeometry args={[0.42, 0.44, 0.46]} />
              <meshStandardMaterial color="#646a66" roughness={0.86} />
            </mesh>
            <mesh position={[0, 0.22, 0.08]}>
              <sphereGeometry args={[0.18, 10, 10]} />
              <meshStandardMaterial color="#757b77" roughness={0.84} />
            </mesh>
            <mesh position={[0, 0.08, 0.26]}>
              <sphereGeometry args={[0.09, 10, 10]} />
              <meshStandardMaterial color="#c9a227" metalness={0.5} roughness={0.45} />
            </mesh>
          </group>
        </group>
      ))}

      {/* Câu đối sơn son thếp vàng & đèn lồng đỏ treo mặt tiền tầng 1 */}
      {[-7.5, -4.5, -1.9, 1.9, 4.5, 7.5].map((cx, idx) => (
        <group key={`couplet-${idx}`} position={[cx, 3.85, 4.52]}>
          <mesh castShadow>
            <boxGeometry args={[0.34, 3.8, 0.05]} />
            <meshStandardMaterial color="#7a1b18" roughness={0.62} />
          </mesh>
          <mesh position={[0, 0, 0.028]}>
            <boxGeometry args={[0.26, 3.55, 0.01]} />
            <meshStandardMaterial color="#d4af37" metalness={0.65} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0, 0.036]}>
            <boxGeometry args={[0.20, 3.35, 0.01]} />
            <meshStandardMaterial color="#8a1f1b" roughness={0.65} />
          </mesh>
          {/* Họa tiết chữ vàng dọc câu đối */}
          {[-1.2, -0.72, -0.24, 0.24, 0.72, 1.2].map((cy, ci) => (
            <mesh key={ci} position={[0, cy, 0.044]}>
              <circleGeometry args={[0.068, 8]} />
              <meshStandardMaterial color="#ffd86b" metalness={0.72} roughness={0.28} />
            </mesh>
          ))}
        </group>
      ))}
      {[-6.0, -3.2, 3.2, 6.0].map((lx, idx) => (
        <group key={`front-lantern-${idx}`} position={[lx, 6.25, 5.2]}>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.5, 8]} />
            <meshStandardMaterial color="#2a1a12" />
          </mesh>
          <mesh castShadow>
            <sphereGeometry args={[0.28, 14, 14]} />
            <meshStandardMaterial color="#d93829" emissive="#ff6b2b" emissiveIntensity={0.45} roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.34, 0]}>
            <cylinderGeometry args={[0.04, 0.08, 0.22, 8]} />
            <meshStandardMaterial color="#d4af37" metalness={0.6} roughness={0.35} />
          </mesh>
        </group>
      ))}

      {/* =====================================================================
          KIẾN TRÚC ĐẠI HÙNG BẢO ĐIỆN 3 TẦNG CHỒNG DIÊM 12 MÁI ĐAO ĐỒ SỘ
         ===================================================================== */}
      {/* TẦNG 1: Mái hạ điện rộng uy nghi (Lower roof tier 1) */}
      <Roof width={21.4} depth={26.6} rise={2.35} y={6.75} z={-3} tile={roofTile} />

      {/* TẦNG 2: Lầu Tàng Kinh / Cổ diêm tầng 2 (y = 7.6 .. 10.5, z = -3) */}
      <group position={[0, 7.6, -3]}>
        {/* Sàn hành lang gỗ & Lan can con tiện bao quanh tầng 2 */}
        <mesh castShadow receiveShadow position={[0, 0.15, 0]}>
          <boxGeometry args={[16.8, 0.3, 18.8]} />
          <meshStandardMaterial map={wood} roughness={0.75} />
        </mesh>
        {/* Lan can gỗ sơn đỏ viền vàng mặt trước & mặt sau tầng 2 */}
        {[-9.2, 9.2].map((rz, ri) => (
          <group key={`rail-fb-${ri}`} position={[0, 0.62, rz]}>
            <mesh castShadow position={[0, 0.26, 0]}>
              <boxGeometry args={[16.6, 0.09, 0.12]} />
              <meshStandardMaterial color="#7a241b" roughness={0.7} />
            </mesh>
            <mesh position={[0, -0.05, 0]}>
              <boxGeometry args={[16.4, 0.42, 0.06]} />
              <meshStandardMaterial color="#c9a227" metalness={0.45} roughness={0.45} />
            </mesh>
          </group>
        ))}
        {/* Lan can gỗ mặt Đông & Tây tầng 2 */}
        {[-8.2, 8.2].map((rx, ri) => (
          <group key={`rail-ew-${ri}`} position={[rx, 0.62, 0]}>
            <mesh castShadow position={[0, 0.26, 0]}>
              <boxGeometry args={[0.12, 0.09, 18.6]} />
              <meshStandardMaterial color="#7a241b" roughness={0.7} />
            </mesh>
            <mesh position={[0, -0.05, 0]}>
              <boxGeometry args={[0.06, 0.42, 18.4]} />
              <meshStandardMaterial color="#c9a227" metalness={0.45} roughness={0.45} />
            </mesh>
          </group>
        ))}
        {/* Thân lầu tầng 2 (Second-story timber & gold-trimmed walls) */}
        <mesh castShadow position={[0, 1.55, 0]}>
          <boxGeometry args={[14.8, 2.7, 16.6]} />
          <meshStandardMaterial color="#e8d9b8" roughness={0.86} />
        </mesh>
        {/* Hàng cột gỗ đỏ bao quanh tầng 2 */}
        {[
          [-7.2, 8.1], [-3.8, 8.1], [0, 8.1], [3.8, 8.1], [7.2, 8.1],
          [-7.2, -8.1], [-3.8, -8.1], [0, -8.1], [3.8, -8.1], [7.2, -8.1],
          [-7.2, -2.7], [7.2, -2.7], [-7.2, 2.7], [7.2, 2.7],
        ].map(([cx, cz], ci) => (
          <mesh key={`t2-col-${ci}`} castShadow position={[cx, 1.55, cz]}>
            <cylinderGeometry args={[0.20, 0.22, 2.7, 12]} />
            <meshStandardMaterial map={wood} roughness={0.7} />
          </mesh>
        ))}
        {/* Các ô cửa bức bàn & cửa sổ chữ Thọ thếp vàng mặt trước tầng 2 */}
        {[-5.4, -1.9, 1.9, 5.4].map((wx, wi) => (
          <group key={`t2-win-${wi}`} position={[wx, 1.48, 8.32]}>
            <mesh>
              <boxGeometry args={[2.1, 1.85, 0.08]} />
              <meshStandardMaterial color="#5c2818" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0, 0.045]}>
              <ringGeometry args={[0.32, 0.48, 16]} />
              <meshStandardMaterial color="#d4af37" metalness={0.65} roughness={0.35} />
            </mesh>
          </group>
        ))}
        {/* Bức hoành phi lớn tầng 2: ĐẠI HÙNG BẢO ĐIỆN */}
        <TextSign text="ĐẠI HÙNG BẢO ĐIỆN" width={4.2} height={0.62} position={[0, 2.32, 8.38]} />
      </group>
      {/* Mái đao tầng 2 (Second-tier curved roof) */}
      <Roof width={17.2} depth={19.6} rise={2.15} y={10.35} z={-3} tile={roofTile} />

      {/* TẦNG 3: Thượng Điện Cửu Trùng & Đỉnh Lưỡng Long Chầu Pháp Luân (y = 11.4 .. 16.2, z = -3) */}
      <group position={[0, 11.35, -3]}>
        {/* Đế lầu & lan can chạm sen vàng tầng 3 */}
        <mesh castShadow position={[0, 0.16, 0]}>
          <boxGeometry args={[12.0, 0.32, 12.8]} />
          <meshStandardMaterial map={wood} roughness={0.75} />
        </mesh>
        {/* Thân lầu tầng 3 */}
        <mesh castShadow position={[0, 1.25, 0]}>
          <boxGeometry args={[10.4, 2.1, 11.2]} />
          <meshStandardMaterial color="#8a241b" roughness={0.75} />
        </mesh>
        {/* Phù điêu hoa sen & Bánh xe Pháp luân vàng 4 mặt tầng 3 */}
        {[-3.2, 0, 3.2].map((fx, fi) => (
          <group key={`t3-frieze-${fi}`} position={[fx, 1.25, 5.64]}>
            <mesh>
              <boxGeometry args={[2.2, 1.35, 0.06]} />
              <meshStandardMaterial color="#d4af37" metalness={0.65} roughness={0.32} />
            </mesh>
            <mesh position={[0, 0, 0.04]}>
              <ringGeometry args={[0.24, 0.42, 16]} />
              <meshStandardMaterial color="#fff1a8" metalness={0.8} roughness={0.22} />
            </mesh>
          </group>
        ))}
        {/* Cột góc tầng 3 */}
        {[
          [-5.1, 5.5], [5.1, 5.5], [-5.1, -5.5], [5.1, -5.5],
          [-1.8, 5.5], [1.8, 5.5],
        ].map(([cx, cz], ci) => (
          <mesh key={`t3-col-${ci}`} castShadow position={[cx, 1.25, cz]}>
            <cylinderGeometry args={[0.17, 0.19, 2.1, 10]} />
            <meshStandardMaterial color="#4a2615" roughness={0.7} />
          </mesh>
        ))}
      </group>
      {/* Mái đao tầng 3 cao vút (Third-tier monumental roof) */}
      <Roof width={12.8} depth={13.8} rise={2.05} y={13.45} z={-3} tile={roofTile} />

      {/* ĐỈNH MÁI CHÍNH ĐIỆN: Lưỡng Long Chầu Pháp Luân (Golden Dharma Wheel & Twin Dragons at y ≈ 16.0m) */}
      <group position={[0, 15.85, -3]}>
        {/* Bệ hoa sen nâng Pháp Luân giữa bờ nóc */}
        <mesh castShadow position={[0, 0, 0]}>
          <cylinderGeometry args={[0.42, 0.55, 0.28, 12]} />
          <meshStandardMaterial color="#d4af37" metalness={0.75} roughness={0.28} />
        </mesh>
        {/* Bánh xe Pháp Luân tỏa hào quang vàng (Golden Dharma Wheel) */}
        <mesh castShadow position={[0, 0.62, 0]}>
          <torusGeometry args={[0.48, 0.075, 12, 24]} />
          <meshStandardMaterial color="#ffd75e" metalness={0.85} roughness={0.2} emissive="#c98a18" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0, 0.62, 0]}>
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshStandardMaterial color="#ffe885" metalness={0.88} roughness={0.18} />
        </mesh>
        {[0, 1, 2, 3].map((sp) => (
          <mesh key={sp} position={[0, 0.62, 0]} rotation={[0, 0, (sp * Math.PI) / 4]}>
            <cylinderGeometry args={[0.032, 0.032, 0.92, 8]} />
            <meshStandardMaterial color="#ffd75e" metalness={0.82} roughness={0.22} />
          </mesh>
        ))}
        {/* Lưỡng Long (Hai tượng rồng vàng uốn lượn hai bên bờ nóc chầu về Pháp Luân) */}
        {[-1, 1].map((side) => (
          <group key={`ridge-dragon-${side}`} position={[side * 2.1, 0.18, 0]}>
            {[0, 1, 2, 3].map((seg) => (
              <mesh
                key={seg}
                castShadow
                position={[side * (seg * 0.52 - 0.75), Math.sin(seg * 1.1) * 0.22 + 0.18, 0]}
                scale={[1.2, 0.85, 0.7]}
              >
                <sphereGeometry args={[0.24 - seg * 0.025, 10, 10]} />
                <meshStandardMaterial color="#d4af37" metalness={0.75} roughness={0.28} />
              </mesh>
            ))}
            {/* Đầu rồng hướng vào Pháp Luân */}
            <mesh castShadow position={[-side * 1.15, 0.42, 0]}>
              <sphereGeometry args={[0.26, 12, 12]} />
              <meshStandardMaterial color="#ffd75e" metalness={0.8} roughness={0.25} />
            </mesh>
          </group>
        ))}
      </group>

      {/* =====================================================================
          TẢ CHUNG LÂU & HỮU CỔ LÂU (Twin 2-Story Ceremonial Wing Pavilions
          flanking the Main Hall facade at local x = ±10.6, z = 3.2, widening
          the monumental Main Hall complex to 25m across)
         ===================================================================== */}
      {[-1, 1].map((side) => (
        <group key={`wing-pavilion-${side}`} position={[side * 10.6, 0, 3.2]}>
          {/* Đế đá xanh 2 cấp */}
          <mesh receiveShadow castShadow position={[0, 0.42, 0]}>
            <boxGeometry args={[2.5, 0.84, 2.5]} />
            <meshStandardMaterial map={stone} roughness={0.92} />
          </mesh>
          {/* 4 Cột tầng 1 */}
          {[
            [-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95],
          ].map(([cx, cz], ci) => (
            <mesh key={ci} castShadow position={[cx, 2.15, cz]}>
              <cylinderGeometry args={[0.14, 0.16, 2.6, 10]} />
              <meshStandardMaterial map={wood} roughness={0.7} />
            </mesh>
          ))}
          {/* Mái tầng 1 */}
          <Roof width={2.9} depth={2.9} rise={0.85} y={3.45} tile={roofTile} />
          {/* Lầu tầng 2: Chuông đồng (Tả) & Trống Bát Nhã (Hữu) */}
          <group position={[0, 4.15, 0]}>
            <mesh castShadow position={[0, 0.12, 0]}>
              <boxGeometry args={[2.1, 0.22, 2.1]} />
              <meshStandardMaterial map={wood} roughness={0.75} />
            </mesh>
            {[
              [-0.78, -0.78], [0.78, -0.78], [-0.78, 0.78], [0.78, 0.78],
            ].map(([cx, cz], ci) => (
              <mesh key={ci} castShadow position={[cx, 1.05, cz]}>
                <cylinderGeometry args={[0.11, 0.13, 1.7, 10]} />
                <meshStandardMaterial map={wood} roughness={0.7} />
              </mesh>
            ))}
            {side < 0 ? (
              /* Trống Bát Nhã sơn đỏ bịt da bên lầu Tây */
              <mesh position={[0, 1.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.42, 0.42, 0.65, 14]} />
                <meshStandardMaterial color="#8f241e" roughness={0.6} />
              </mesh>
            ) : (
              /* Khánh đồng / Chuông gia trì bên lầu Đông */
              <mesh position={[0, 1.02, 0]}>
                <cylinderGeometry args={[0.24, 0.36, 0.68, 14]} />
                <meshStandardMaterial color="#d4af37" metalness={0.75} roughness={0.28} />
              </mesh>
            )}
          </group>
          <Roof width={2.5} depth={2.5} rise={0.95} y={5.95} tile={roofTile} />
        </group>
      ))}
    </group>
  );
});


export const TamQuan = memo(function TamQuan() {
  const { wood, roofTile, stone } = useTextures();
  return (
    <group position={[0, 0, 13]}>
      {/* 4 cột trụ chính của Tam Quan (giữ nguyên vị trí collider -3.6, -1.4, 1.4, 3.6) */}
      <Columns
        wood={wood}
        height={4.5}
        positions={[
          [-3.6, 0],
          [-1.4, 0],
          [1.4, 0],
          [3.6, 0],
        ]}
      />
      {/* 2 trụ biểu đá / cột phụ bên ngoài trên tường bao tạo dáng Tam Quan 3 cửa bề thế */}
      {[-5.8, 5.8].map((px, idx) => (
        <group key={`outer-col-${idx}`} position={[px, 2.1, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.24, 0.28, 4.2, 12]} />
            <meshStandardMaterial map={wood} roughness={0.72} />
          </mesh>
          <mesh position={[0, 2.25, 0]}>
            <sphereGeometry args={[0.22, 10, 10]} />
            <meshStandardMaterial color="#d4af37" metalness={0.65} roughness={0.32} />
          </mesh>
        </group>
      ))}
      {/* Tường đá xanh hai bên nối với tường bao */}
      {[-1, 1].map((s) => (
        <mesh key={s} castShadow position={[s * 5.2, 0.9, 0]}>
          <boxGeometry args={[3.2, 1.8, 0.55]} />
          <meshStandardMaterial map={stone} roughness={0.95} />
        </mesh>
      ))}
      {/* Câu đối sơn son thếp vàng trên 4 cột cổng Tam Quan */}
      {[-3.6, -1.4, 1.4, 3.6].map((cx, idx) => (
        <group key={`tq-couplet-${idx}`} position={[cx, 2.35, 0.31]}>
          <mesh>
            <boxGeometry args={[0.26, 2.7, 0.04]} />
            <meshStandardMaterial color="#7a1b18" roughness={0.65} />
          </mesh>
          <mesh position={[0, 0, 0.025]}>
            <boxGeometry args={[0.18, 2.48, 0.01]} />
            <meshStandardMaterial color="#d4af37" metalness={0.65} roughness={0.32} />
          </mesh>
        </group>
      ))}
      {/* Xà ngang & Bảng tên chính CHÙA HẢI AN tầng 1 */}
      <mesh castShadow position={[0, 4.35, 0]}>
        <boxGeometry args={[12.4, 0.9, 0.55]} />
        <meshStandardMaterial map={wood} roughness={0.7} />
      </mesh>
      <TextSign text="CHÙA HẢI AN" width={3.6} height={0.68} position={[0, 4.35, 0.30]} />

      {/* Mái đao hai cổng bên (Cửa Giả & Cửa Không) */}
      {[-4.4, 4.4].map((wx, idx) => (
        <group key={`wing-roof-${idx}`} position={[wx, 0, 0]}>
          <Roof width={3.8} depth={3.0} rise={0.95} y={4.05} tile={roofTile} />
        </group>
      ))}
      {/* Mái chính tầng 1 Tam Quan */}
      <Roof width={10.2} depth={3.6} rise={1.35} y={4.65} tile={roofTile} />

      {/* =====================================================================
          TẦNG 2: GÁC TAM QUAN CỔ TỰ (2-Story Watchtower Pavilion, y = 5.4..9.2)
         ===================================================================== */}
      <group position={[0, 5.45, 0]}>
        {/* Sàn & lan can gỗ con tiện Gác Tam Quan tầng 2 */}
        <mesh castShadow position={[0, 0.14, 0]}>
          <boxGeometry args={[6.4, 0.28, 3.0]} />
          <meshStandardMaterial map={wood} roughness={0.75} />
        </mesh>
        {[-1.38, 1.38].map((rz, ri) => (
          <mesh key={`tq-rail-${ri}`} position={[0, 0.48, rz]}>
            <boxGeometry args={[6.2, 0.42, 0.08]} />
            <meshStandardMaterial color="#c9a227" metalness={0.48} roughness={0.42} />
          </mesh>
        ))}
        {/* Thân lầu Gác Tam Quan tầng 2 */}
        <mesh castShadow position={[0, 1.15, 0]}>
          <boxGeometry args={[5.2, 1.85, 2.2]} />
          <meshStandardMaterial color="#8a241b" roughness={0.75} />
        </mesh>
        {/* 4 cột gỗ Gác Tam Quan */}
        {[
          [-2.4, 1.0], [2.4, 1.0], [-2.4, -1.0], [2.4, -1.0],
        ].map(([cx, cz], ci) => (
          <mesh key={`tq-ucol-${ci}`} castShadow position={[cx, 1.15, cz]}>
            <cylinderGeometry args={[0.16, 0.18, 1.85, 10]} />
            <meshStandardMaterial map={wood} roughness={0.7} />
          </mesh>
        ))}
        {/* Ô cửa vòm & phù điêu Pháp luân vàng trên Gác Tam Quan */}
        <mesh position={[0, 1.12, 1.12]}>
          <circleGeometry args={[0.46, 18]} />
          <meshStandardMaterial color="#d4af37" metalness={0.68} roughness={0.3} />
        </mesh>
        {/* Đèn lồng đỏ treo hai bên Gác Tam Quan */}
        {[-2.8, 2.8].map((lx, li) => (
          <mesh key={`tq-lan-${li}`} position={[lx, 1.45, 1.15]}>
            <sphereGeometry args={[0.20, 12, 12]} />
            <meshStandardMaterial color="#d93829" emissive="#ff6b2b" emissiveIntensity={0.45} />
          </mesh>
        ))}
      </group>
      {/* Mái chồng diêm tầng 2 Gác Tam Quan (Double-eave upper tower roof) */}
      <Roof width={6.8} depth={3.2} rise={1.15} y={7.35} tile={roofTile} />
      <Roof width={5.2} depth={2.5} rise={1.05} y={8.35} tile={roofTile} />
    </group>
  );
});

/** Small open chanting pavilion east of the hall — the chanting zone. */
export const ChantPavilion = memo(function ChantPavilion() {
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
});

/**
 * Niệm Phật Đường Tây — Lầu Tụng Kinh Liên Hoa 2 Tầng tại (-15.5, 0, -16.5):
 * Điện niệm kinh mở thoáng 4 mặt phía Tây Chính Điện (bắc Tâm Liên Hồ),
 * gồm 8 bồ đoàn hoa sen & bàn kinh án gỗ lim (west-chant-1..8), đại mộc ngư,
 * chuông gia trì và bảo tọa Phật A Di Đà, cho phép nhiều Phật tử cùng ngồi tụng kinh.
 */
export const WestChantingHall = memo(function WestChantingHall() {
  const { wood, roofTile, stone } = useTextures();
  // Local coords relative to (-15.5, 0, -16.5):
  // 8 seats in controls.ts at world x = -18.2, -16.4, -14.6, -12.8 (local x = -2.7, -0.9, 0.9, 2.7)
  // Row 1 world z = -17.0 (local z = -0.5), Row 2 world z = -14.8 (local z = 1.7)
  const localXs = [-2.7, -0.9, 0.9, 2.7];
  const localZs = [-0.5, 1.7];

  return (
    <group position={[-15.5, 0, -16.5]}>
      {/* Nền đá xanh 2 cấp (top y = 0.25 khớp với floorYAt) */}
      <mesh receiveShadow castShadow position={[0, 0.125, 0]}>
        <boxGeometry args={[8.8, 0.25, 7.8]} />
        <meshStandardMaterial map={stone} roughness={0.92} />
      </mesh>
      {/* Viền gạch gốm đỏ trên mặt sàn Niệm Phật Đường */}
      <mesh receiveShadow position={[0, 0.255, 0.2]}>
        <boxGeometry args={[7.8, 0.01, 6.6]} />
        <meshStandardMaterial color="#8a4b38" roughness={0.88} />
      </mesh>
      {/* Bậc tam cấp phía Nam & phía Đông */}
      <mesh receiveShadow position={[0, 0.08, 4.1]}>
        <boxGeometry args={[3.2, 0.16, 0.5]} />
        <meshStandardMaterial map={stone} roughness={0.92} />
      </mesh>
      <mesh receiveShadow position={[4.6, 0.08, 0.5]}>
        <boxGeometry args={[0.5, 0.16, 2.8]} />
        <meshStandardMaterial map={stone} roughness={0.92} />
      </mesh>

      {/* 8 Cột gỗ lim sơn son thếp vàng nâng mái tầng 1 (khớp collider góc ±3.8, ±3.2) */}
      <Columns
        wood={wood}
        height={3.6}
        positions={[
          [-3.8, -3.2],
          [3.8, -3.2],
          [-3.8, 3.2],
          [3.8, 3.2],
          [-1.5, -3.2],
          [1.5, -3.2],
          [-3.8, 0],
          [3.8, 0],
        ]}
      />
      {/* Xà ngang & Hoành phi NIỆM PHẬT ĐƯỜNG */}
      <mesh castShadow position={[0, 3.7, 0]}>
        <boxGeometry args={[8.2, 0.28, 7.0]} />
        <meshStandardMaterial map={wood} roughness={0.7} />
      </mesh>
      <TextSign text="NIỆM PHẬT ĐƯỜNG" width={3.2} height={0.52} position={[0, 3.68, 3.56]} />

      {/* Hương án & Bảo tọa Phật A Di Đà ở phía Bắc (local z = -2.6, world z = -19.1) */}
      <group position={[0, 0.25, -2.6]}>
        {/* Bệ thờ gỗ chạm sen vàng */}
        <mesh castShadow position={[0, 0.48, 0]}>
          <boxGeometry args={[2.8, 0.96, 1.0]} />
          <meshStandardMaterial map={wood} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.97, 0]}>
          <boxGeometry args={[2.6, 0.03, 0.86]} />
          <meshStandardMaterial color="#d4af37" metalness={0.6} roughness={0.35} />
        </mesh>
        {/* Vách hậu sơn son thếp vàng */}
        <mesh castShadow position={[0, 1.55, -0.45]}>
          <boxGeometry args={[2.6, 1.9, 0.10]} />
          <meshStandardMaterial color="#7a1b18" roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.65, -0.38]}>
          <ringGeometry args={[0.38, 0.56, 20]} />
          <meshStandardMaterial color="#ffd75e" metalness={0.8} roughness={0.22} emissive="#c98a18" emissiveIntensity={0.25} />
        </mesh>
        {/* Tôn tượng Phật A Di Đà tọa đài sen vàng */}
        <mesh position={[0, 1.08, -0.05]}>
          <cylinderGeometry args={[0.32, 0.38, 0.18, 14]} />
          <meshStandardMaterial color="#d4af37" metalness={0.75} roughness={0.28} />
        </mesh>
        <mesh castShadow position={[0, 1.44, -0.05]}>
          <coneGeometry args={[0.28, 0.62, 12]} />
          <meshStandardMaterial color="#ffd75e" metalness={0.85} roughness={0.2} emissive="#c98a18" emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[0, 1.84, -0.05]}>
          <sphereGeometry args={[0.14, 12, 12]} />
          <meshStandardMaterial color="#ffe680" metalness={0.85} roughness={0.2} />
        </mesh>
        {/* Đại Mộc Ngư (Mõ lớn) & Đại Gia Trì Chung trên đôn hai bên bàn thờ */}
        <mesh position={[-0.95, 1.12, 0.15]} scale={[1.2, 0.9, 1.0]}>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshStandardMaterial color="#9e241a" roughness={0.5} />
        </mesh>
        <mesh position={[0.95, 1.12, 0.15]}>
          <cylinderGeometry args={[0.14, 0.18, 0.22, 12]} />
          <meshStandardMaterial color="#d4af37" metalness={0.78} roughness={0.25} />
        </mesh>
      </group>

      {/* 8 Bồ đoàn Hoa Sen & 8 Bàn Kinh Án (west-chant-1..8) */}
      {localZs.flatMap((lz, rIdx) =>
        localXs.map((lx, cIdx) => (
          <group key={`wchant-seat-${rIdx}-${cIdx}`} position={[lx, 0.25, lz]}>
            {/* Thảm tọa cụ đỏ viền kim tuyến */}
            <mesh receiveShadow position={[0, 0.02, 0]}>
              <boxGeometry args={[0.92, 0.04, 0.74]} />
              <meshStandardMaterial color="#8a2420" roughness={0.88} />
            </mesh>
            {/* Đệm bồ đoàn tròn */}
            <mesh position={[0, 0.08, 0.08]}>
              <cylinderGeometry args={[0.30, 0.34, 0.10, 14]} />
              <meshStandardMaterial color="#681818" roughness={0.85} />
            </mesh>
            <mesh position={[0, 0.135, 0.08]}>
              <cylinderGeometry args={[0.20, 0.25, 0.018, 12]} />
              <meshStandardMaterial color="#d4af37" metalness={0.5} roughness={0.4} />
            </mesh>
            {/* Bàn Kinh Án cá nhân + Sách Kinh Phật mở + Mõ gỗ */}
            <group position={[0, 0, -0.52]}>
              <mesh castShadow position={[0, 0.28, 0]}>
                <boxGeometry args={[0.88, 0.05, 0.36]} />
                <meshStandardMaterial map={wood} roughness={0.7} />
              </mesh>
              {[-0.36, 0.36].map((dx, di) => (
                <mesh key={di} position={[dx, 0.14, 0]}>
                  <boxGeometry args={[0.07, 0.26, 0.30]} />
                  <meshStandardMaterial map={wood} roughness={0.75} />
                </mesh>
              ))}
              <mesh position={[-0.08, 0.32, 0]} rotation={[-0.08, 0, 0]}>
                <boxGeometry args={[0.38, 0.02, 0.24]} />
                <meshStandardMaterial color="#f6e7c1" roughness={0.8} />
              </mesh>
              <mesh position={[0.24, 0.35, 0]} scale={[1.1, 0.85, 0.95]}>
                <sphereGeometry args={[0.065, 8, 8]} />
                <meshStandardMaterial color="#9e2a1e" roughness={0.55} />
              </mesh>
            </group>
          </group>
        )),
      )}

      {/* Mái đao tầng 1 & Cổ diêm lầu tầng 2 (2-Story 8-Eave Chanting Pavilion) */}
      <Roof width={9.2} depth={8.2} rise={1.65} y={3.85} tile={roofTile} />
      <group position={[0, 5.2, 0]}>
        <mesh castShadow position={[0, 0.75, 0]}>
          <boxGeometry args={[5.4, 1.5, 4.6]} />
          <meshStandardMaterial color="#8a241b" roughness={0.75} />
        </mesh>
        {[-1.6, 0, 1.6].map((wx, wi) => (
          <mesh key={wi} position={[wx, 0.78, 2.33]}>
            <ringGeometry args={[0.20, 0.32, 14]} />
            <meshStandardMaterial color="#d4af37" metalness={0.68} roughness={0.3} />
          </mesh>
        ))}
      </group>
      <Roof width={6.4} depth={5.6} rise={1.45} y={6.65} tile={roofTile} />
    </group>
  );
});

/**
 * Đài Niệm Kinh Bảo Tháp (East Stupa Chanting Pavilion) tại (35.0, 0, 6.8):
 * Đài tụng kinh có mái đao phía Nam Bảo Tháp 7 Tầng, gồm 6 tọa cụ hoa sen &
 * bàn kinh (stupa-chant-1..6) hướng trực diện lên Bảo Tháp Báo Ân.
 */
export const EastChantingPavilion = memo(function EastChantingPavilion() {
  const { wood, roofTile, stone } = useTextures();
  // Local coords relative to (35.0, 0, 6.8):
  // 6 seats in controls.ts at world x = 33.2, 35.0, 36.8 (local x = -1.8, 0, 1.8)
  // Row 1 world z = 5.8 (local z = -1.0), Row 2 world z = 7.6 (local z = 0.8)
  const localXs = [-1.8, 0, 1.8];
  const localZs = [-1.0, 0.8];

  return (
    <group position={[35.0, 0, 6.8]}>
      {/* Nền đá xanh (top y = 0.25 khớp với floorYAt) */}
      <mesh receiveShadow castShadow position={[0, 0.125, 0]}>
        <boxGeometry args={[6.8, 0.25, 5.2]} />
        <meshStandardMaterial map={stone} roughness={0.92} />
      </mesh>
      {/* 4 cột trụ góc (khớp collider ±2.9, ±2.1) */}
      <Columns
        wood={wood}
        height={3.2}
        positions={[
          [-2.9, -2.1],
          [2.9, -2.1],
          [-2.9, 2.1],
          [2.9, 2.1],
        ]}
      />
      <mesh castShadow position={[0, 3.32, 0]}>
        <boxGeometry args={[6.2, 0.26, 4.6]} />
        <meshStandardMaterial map={wood} roughness={0.7} />
      </mesh>
      <TextSign text="ĐÀI NIỆM KINH" width={2.6} height={0.45} position={[0, 3.32, -2.35]} />
      <Roof width={7.2} depth={5.6} rise={1.35} y={3.45} tile={roofTile} />

      {/* 6 Bồ đoàn Hoa Sen & Bàn Kinh hướng Bắc về Bảo Tháp 7 Tầng */}
      {localZs.flatMap((lz, rIdx) =>
        localXs.map((lx, cIdx) => (
          <group key={`schant-seat-${rIdx}-${cIdx}`} position={[lx, 0.25, lz]}>
            <mesh receiveShadow position={[0, 0.02, 0]}>
              <boxGeometry args={[0.90, 0.04, 0.72]} />
              <meshStandardMaterial color="#8a2420" roughness={0.88} />
            </mesh>
            <mesh position={[0, 0.08, 0.08]}>
              <cylinderGeometry args={[0.29, 0.33, 0.10, 14]} />
              <meshStandardMaterial color="#681818" roughness={0.85} />
            </mesh>
            {/* Bàn kinh án thấp phía Bắc mỗi tọa cụ */}
            <group position={[0, 0, -0.48]}>
              <mesh castShadow position={[0, 0.26, 0]}>
                <boxGeometry args={[0.84, 0.045, 0.34]} />
                <meshStandardMaterial map={wood} roughness={0.7} />
              </mesh>
              <mesh position={[0, 0.30, 0]} rotation={[-0.08, 0, 0]}>
                <boxGeometry args={[0.36, 0.02, 0.22]} />
                <meshStandardMaterial color="#f6e7c1" roughness={0.8} />
              </mesh>
            </group>
          </group>
        )),
      )}
    </group>
  );
});

/**
 * Đài Bia Vàng Công Đức Chùa Hải An (Golden Merit Leaderboard Stele Pavilion) tại (8.8, 0, -1.2):
 * Nhà bia 2 tầng mái đao truyền thống Việt Nam với Rùa đá đội bia (Quy趺),
 * Bia Vàng Công Đức chạm khắc 8 phẩm vị tu tập và danh sách Phật tử phát tâm công đức.
 */
export const MeritBoardMonument = memo(function MeritBoardMonument({
  onOpenMeritModal,
}: {
  onOpenMeritModal?: () => void;
}) {
  const { wood, roofTile, stone } = useTextures();
  return (
    <group
      position={[8.8, 0, -1.2]}
      onClick={(e) => {
        if (onOpenMeritModal) {
          e.stopPropagation();
          onOpenMeritModal();
        }
      }}
    >
      {/* Đế đá xanh bát giác 2 cấp */}
      <mesh receiveShadow castShadow position={[0, 0.14, 0]}>
        <boxGeometry args={[3.4, 0.28, 2.2]} />
        <meshStandardMaterial map={stone} roughness={0.92} />
      </mesh>
      {/* 4 cột gỗ sơn son nâng mái Nhà Bia */}
      <Columns
        wood={wood}
        height={3.1}
        positions={[
          [-1.35, -0.75],
          [1.35, -0.75],
          [-1.35, 0.75],
          [1.35, 0.75],
        ]}
      />
      {/* Rùa đá đội bia (Traditional Vietnamese stone tortoise pedestal) */}
      <group position={[0, 0.28, 0]}>
        <mesh castShadow position={[0, 0.18, 0]} scale={[1.1, 0.55, 1.35]}>
          <sphereGeometry args={[0.52, 12, 10]} />
          <meshStandardMaterial color="#6d706c" roughness={0.88} />
        </mesh>
        {/* Đầu rùa đá hướng Nam đón Phật tử */}
        <mesh castShadow position={[0, 0.24, 0.68]}>
          <sphereGeometry args={[0.17, 10, 10]} />
          <meshStandardMaterial color="#787c77" roughness={0.85} />
        </mesh>
      </group>
      {/* Thân Bia Đá & Bảng Sơn Son Thếp Vàng (Golden Merit Stele) */}
      <mesh castShadow position={[0, 1.68, 0]}>
        <boxGeometry args={[1.85, 2.25, 0.22]} />
        <meshStandardMaterial color="#5e615d" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.68, 0.12]}>
        <boxGeometry args={[1.65, 2.02, 0.03]} />
        <meshStandardMaterial color="#7a1b18" roughness={0.62} />
      </mesh>
      <mesh position={[0, 1.68, 0.14]}>
        <boxGeometry args={[1.52, 1.88, 0.015]} />
        <meshStandardMaterial color="#d4af37" metalness={0.68} roughness={0.32} />
      </mesh>
      <mesh position={[0, 1.68, 0.15]}>
        <boxGeometry args={[1.42, 1.78, 0.01]} />
        <meshStandardMaterial color="#5a1512" roughness={0.68} />
      </mesh>
      {/* Các dòng chữ vàng khắc tên Phật tử trên Bảng Vàng Công Đức */}
      {[0.58, 0.36, 0.14, -0.08, -0.30, -0.52].map((ry, ri) => (
        <mesh key={ri} position={[0, 1.68 + ry, 0.16]}>
          <planeGeometry args={[1.22, 0.11]} />
          <meshStandardMaterial
            color={ri === 0 ? '#ffe875' : '#e0b848'}
            metalness={0.75}
            roughness={0.28}
            emissive={ri === 0 ? '#c98a18' : '#7a5210'}
            emissiveIntensity={ri === 0 ? 0.35 : 0.15}
          />
        </mesh>
      ))}
      {/* Bảng tên BẢNG VÀNG CÔNG ĐỨC */}
      <TextSign text="BẢNG VÀNG CÔNG ĐỨC" width={2.7} height={0.46} position={[0, 3.15, 0.82]} />
      {/* Mái đao chồng diêm Nhà Bia Công Đức */}
      <Roof width={3.6} depth={2.5} rise={0.95} y={3.25} tile={roofTile} />
      <Roof width={2.6} depth={1.8} rise={0.78} y={4.05} tile={roofTile} />
    </group>
  );
});

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
      <mesh position={[0, 1.35, 0]}>
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
      <mesh position={[0, 0.9, 0]} rotation={[0, 0, 0.2]}>
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

export const Garden = memo(function Garden({
  onOpenMeritModal,
}: {
  onOpenMeritModal?: () => void;
}) {
  const { grass } = useTextures();
  const clouds = useRef<THREE.Group>(null);
  const leaves = useRef<THREE.Points>(null);
  const leafData = useMemo(() => {
    const n = 72;
    const pos = new Float32Array(n * 3);
    const spd = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = -16 + Math.random() * 32;
      pos[i * 3 + 1] = Math.random() * 7;
      pos[i * 3 + 2] = -14 + Math.random() * 30;
      spd[i] = 0.3 + Math.random() * 0.5;
    }
    return { pos, spd };
  }, []);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    if (clouds.current) {
      clouds.current.children.forEach((c) => {
        c.position.x = ((c.position.x + delta * 0.25 + 35) % 70) - 35;
      });
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
      {/* Vast grass landscape + 88x49m grand brick courtyard + expanded 36x9.4m
          outer ceremonial plaza (Quảng Trường Tiền Đường Đại Bái, z 13..22.4) */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -8]}>
        <planeGeometry args={[220, 220]} />
        <meshStandardMaterial map={grass} roughness={1} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -11.5]}>
        <planeGeometry args={[88, 49]} />
        <meshStandardMaterial color="#9a6b52" roughness={0.95} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 17.7]}>
        <planeGeometry args={[36, 9.4]} />
        <meshStandardMaterial color="#9a6b52" roughness={0.95} />
      </mesh>
      {/* Stone border curbing for the grand outer plaza (x ±18, z 13..22.4) */}
      {[-18, 18].map((x, i) => (
        <mesh key={`fc-${i}`} receiveShadow position={[x, 0.04, 17.7]}>
          <boxGeometry args={[0.36, 0.08, 9.4]} />
          <meshStandardMaterial color="#8d8a82" roughness={0.95} />
        </mesh>
      ))}
      {/* Chiếu Hoa Sen Pháp Luân Đá Xanh giữa Quảng Trường Tiền Đường (0, 0.036, 17.6) */}
      <group position={[0, 0.036, 17.6]}>
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.65, 2.25, 24]} />
          <meshStandardMaterial color="#d4af37" metalness={0.55} roughness={0.42} />
        </mesh>
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.62, 24]} />
          <meshStandardMaterial color="#837e72" roughness={0.9} />
        </mesh>
      </group>
      {/* 6 Cột Cờ Phướn Ngũ Sắc Phật Giáo dọc Quảng Trường Tiền Đường */}
      {[-14.5, -9.5, -5.2, 5.2, 9.5, 14.5].map((fx, fi) => (
        <group key={`buddhist-flag-${fi}`} position={[fx, 0, 17.8]}>
          <mesh castShadow position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.26, 0.34, 0.44, 10]} />
            <meshStandardMaterial color="#7d7a72" roughness={0.9} />
          </mesh>
          <mesh castShadow position={[0, 3.1, 0]}>
            <cylinderGeometry args={[0.05, 0.07, 5.8, 8]} />
            <meshStandardMaterial color="#5c3118" roughness={0.75} />
          </mesh>
          <mesh position={[0, 6.08, 0]}>
            <sphereGeometry args={[0.11, 10, 10]} />
            <meshStandardMaterial color="#ffd75e" metalness={0.8} roughness={0.25} />
          </mesh>
          {/* Phướn Tam Bảo đỏ viền vàng rủ xuống */}
          <mesh position={[0.24, 4.45, 0]}>
            <boxGeometry args={[0.42, 2.35, 0.02]} />
            <meshStandardMaterial
              color={fi % 2 === 0 ? '#b82921' : '#d49b1f'}
              roughness={0.75}
            />
          </mesh>
        </group>
      ))}
      {/* Traditional low temple compound perimeter wall (tường bao khuôn viên chùa)
          connecting from Tam Quan side walls (±6.8, 13) to (±44, 13),
          then North to (±44, -36) and across the back (-44..44, -36). */}
      {[
        [-25.4, 13, 37.2, 0.42],
        [25.4, 13, 37.2, 0.42],
        [-44, -11.5, 0.42, 49],
        [44, -11.5, 0.42, 49],
        [0, -36, 88.4, 0.42],
      ].map(([x, z, w, d], i) => (
        <group key={`pwall-${i}`} position={[x, 0, z]}>
          <mesh receiveShadow castShadow position={[0, 0.14, 0]}>
            <boxGeometry args={[w, 0.28, d]} />
            <meshStandardMaterial color="#8d8a82" roughness={0.95} />
          </mesh>
          <mesh receiveShadow castShadow position={[0, 0.62, 0]}>
            <boxGeometry args={[w > d ? w : w * 0.85, 0.68, d > w ? d : d * 0.85]} />
            <meshStandardMaterial color="#e8d9b8" roughness={0.9} />
          </mesh>
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
          <mesh position={[0, 1.28, 0]}>
            <boxGeometry args={[0.68, 0.1, 0.68]} />
            <meshStandardMaterial color="#a8432a" roughness={0.85} />
          </mesh>
        </group>
      ))}
      {/* Central stone path from entrance forecourt through Tam Quan to the incense burner */}
      {Array.from({ length: 13 }).map((_, i) => (
        <mesh key={i} receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 19.4 - i * 1.6]}>
          <planeGeometry args={[2.4, 1.15]} />
          <meshStandardMaterial color="#b0a894" roughness={0.95} />
        </mesh>
      ))}
      {/* Courtyard trees spread out across the enlarged 88x49m compound */}
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
      <StoneLantern position={[-3.4, 0, 16.5]} />
      <StoneLantern position={[3.4, 0, 16.5]} />
      {/* Bonsai flanking the steps */}
      <Bonsai position={[-4.6, 0, -2.0]} />
      <Bonsai position={[4.6, 0, -2.0]} />

      {/* Niệm Phật Đường Tây 2 Tầng (8 chỗ ngồi tụng kinh: west-chant-1..8) */}
      <WestChantingHall />

      {/* Đài Niệm Kinh Bảo Tháp (6 chỗ ngồi tụng kinh: stupa-chant-1..6) */}
      <EastChantingPavilion />

      {/* Đài Bia Vàng Công Đức Chùa Hải An tại (8.8, 0, -1.2) */}
      <MeritBoardMonument onOpenMeritModal={onOpenMeritModal} />

      {/* Bảo Tháp Báo Ân 7 Tầng (Seven-Story Octagonal Lotus Stupa at (35.0, 0, -2.5)) */}
      <SevenStoryStupa />

      {/* Distant misty hills — smooth DOMES far outside the enlarged compound */}
      {(
        [
          [-54, -64, 24, '#7a9a6a'],
          [54, -66, 26, '#6a8a62'],
          [0, -74, 28, '#7a9a72'],
        ] as Array<[number, number, number, string]>
      ).map(([x, z, r, col], i) => (
        <mesh key={i} position={[x, 0, z]} scale={[1, 0.35, 1]}>
          <sphereGeometry args={[r, 20, 14]} />
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
                <sphereGeometry args={[1.6, 10, 10]} />
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
});

/**
 * Bảo Tháp Báo Ân 7 Tầng (Seven-Story Octagonal Buddhist Stupa) tại (35.0, 0, -2.5):
 * Kiến trúc tháp bát giác truyền thống Việt Nam cao ~19.5m với đế đá xanh chạm sen,
 * 7 tầng tháp gạch đỏ nâu thu nhỏ dần lên cao, mỗi tầng có 8 mái đao cong vút treo
 * chuông gió đồng, 4 ô khám thờ Phật mạ vàng, và đỉnh Cửu Phẩm Liên Hoa / Hồ Lô Vàng.
 */
export const SevenStoryStupa = memo(function SevenStoryStupa() {
  const { stone } = useTextures();
  const tiers = [
    { y: 1.0, h: 2.35, rBody: 1.95, rRoof: 2.75 },
    { y: 3.35, h: 2.15, rBody: 1.74, rRoof: 2.48 },
    { y: 5.50, h: 1.98, rBody: 1.54, rRoof: 2.22 },
    { y: 7.48, h: 1.82, rBody: 1.35, rRoof: 1.96 },
    { y: 9.30, h: 1.66, rBody: 1.18, rRoof: 1.72 },
    { y: 10.96, h: 1.52, rBody: 1.02, rRoof: 1.50 },
    { y: 12.48, h: 1.40, rBody: 0.86, rRoof: 1.30 },
  ];

  return (
    <group position={[35.0, 0, -2.5]}>
      {/* Lối đá xanh dẫn từ hành lang Đông sang Bảo Tháp */}
      {[-6.5, -5.0, -3.5].map((ox, i) => (
        <mesh key={`stupa-path-${i}`} receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[ox, 0.032, 0]}>
          <planeGeometry args={[1.1, 1.5]} />
          <meshStandardMaterial color="#b0a894" roughness={0.95} />
        </mesh>
      ))}

      {/* Đế tháp đá xanh 2 cấp bát giác + Lan can đá chạm hoa sen */}
      <mesh receiveShadow castShadow position={[0, 0.25, 0]}>
        <cylinderGeometry args={[2.85, 3.05, 0.5, 8]} />
        <meshStandardMaterial map={stone} roughness={0.92} />
      </mesh>
      <mesh receiveShadow castShadow position={[0, 0.72, 0]}>
        <cylinderGeometry args={[2.35, 2.55, 0.48, 8]} />
        <meshStandardMaterial color="#7d786e" roughness={0.88} />
      </mesh>
      {/* Vòng cánh sen đá nâng chân tháp */}
      <mesh position={[0, 0.98, 0]}>
        <cylinderGeometry args={[2.18, 2.38, 0.14, 16]} />
        <meshStandardMaterial color="#c9a227" metalness={0.55} roughness={0.38} />
      </mesh>
      {/* Bậc tam cấp đá phía Tây hướng về sân Chính điện */}
      <mesh receiveShadow position={[-2.65, 0.22, 0]}>
        <boxGeometry args={[0.9, 0.44, 1.4]} />
        <meshStandardMaterial map={stone} roughness={0.92} />
      </mesh>

      {/* 7 Tầng Tháp Bát Giác (7 Octagonal Stories with upturned eaves & golden Buddha niches) */}
      {tiers.map((t, idx) => (
        <group key={`stupa-tier-${idx}`} position={[0, t.y, 0]}>
          {/* Thân tháp bát giác gạch nung đỏ sẫm truyền thống */}
          <mesh castShadow receiveShadow position={[0, t.h / 2, 0]}>
            <cylinderGeometry args={[t.rBody * 0.94, t.rBody, t.h, 8]} />
            <meshStandardMaterial color="#8c3324" roughness={0.78} />
          </mesh>
          {/* Viền chỉ vàng chân & cổ tầng tháp */}
          <mesh position={[0, t.h - 0.12, 0]}>
            <cylinderGeometry args={[t.rBody * 0.97, t.rBody * 0.97, 0.12, 8]} />
            <meshStandardMaterial color="#d4af37" metalness={0.62} roughness={0.35} />
          </mesh>
          {/* 4 Ô khám thờ Phật mạ vàng (Đông - Tây - Nam - Bắc mỗi tầng) */}
          {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((ang, ni) => (
            <group
              key={`niche-${ni}`}
              position={[
                Math.sin(ang) * (t.rBody * 0.90),
                t.h * 0.46,
                Math.cos(ang) * (t.rBody * 0.90),
              ]}
              rotation={[0, ang, 0]}
            >
              <mesh>
                <boxGeometry args={[0.42, 0.62, 0.08]} />
                <meshStandardMaterial color="#3d1e12" roughness={0.75} />
              </mesh>
              <mesh position={[0, -0.06, 0.04]}>
                <coneGeometry args={[0.13, 0.34, 10]} />
                <meshStandardMaterial color="#ffd75e" metalness={0.82} roughness={0.22} emissive="#c98a18" emissiveIntensity={0.2} />
              </mesh>
              <mesh position={[0, 0.14, 0.04]}>
                <sphereGeometry args={[0.075, 10, 10]} />
                <meshStandardMaterial color="#ffe680" metalness={0.85} roughness={0.2} />
              </mesh>
            </group>
          ))}
          {/* Mái ngói bát giác uốn cong (Octagonal pagoda roof eave) */}
          <mesh castShadow position={[0, t.h + 0.18, 0]}>
            <coneGeometry args={[t.rRoof, 0.56, 8]} />
            <meshStandardMaterial color="#a83b24" roughness={0.78} />
          </mesh>
          {/* 8 Đầu đao cong vút + Chuông gió đồng ở 8 góc mái mỗi tầng */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((c) => {
            const a = (c * Math.PI) / 4 + Math.PI / 8;
            const rx = Math.sin(a) * (t.rRoof * 0.94);
            const rz = Math.cos(a) * (t.rRoof * 0.94);
            return (
              <group key={`eave-${c}`} position={[rx, t.h + 0.05, rz]} rotation={[0, a, 0]}>
                <mesh position={[0, 0.14, 0.16]} rotation={[-0.65, 0, 0]}>
                  <coneGeometry args={[0.09, 0.45, 5]} />
                  <meshStandardMaterial color="#c9a227" metalness={0.62} roughness={0.32} />
                </mesh>
                <mesh position={[0, -0.10, 0.14]}>
                  <cylinderGeometry args={[0.035, 0.06, 0.12, 6]} />
                  <meshStandardMaterial color="#d4af37" metalness={0.75} roughness={0.28} />
                </mesh>
              </group>
            );
          })}
        </group>
      ))}

      {/* Đỉnh Bảo Tháp: Bệ sen vàng + Tướng luân Cửu Phẩm + Bầu Hồ Lô Vàng (y = 14.1 .. 19.2m) */}
      <group position={[0, 14.1, 0]}>
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.48, 0.72, 0.5, 12]} />
          <meshStandardMaterial color="#d4af37" metalness={0.78} roughness={0.25} />
        </mesh>
        <mesh castShadow position={[0, 1.85, 0]}>
          <cylinderGeometry args={[0.08, 0.18, 3.2, 12]} />
          <meshStandardMaterial color="#ffd75e" metalness={0.85} roughness={0.2} />
        </mesh>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((rIdx) => (
          <mesh key={`ring-${rIdx}`} position={[0, 0.65 + rIdx * 0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.38 - rIdx * 0.024, 0.03, 8, 18]} />
            <meshStandardMaterial color="#ffe070" metalness={0.85} roughness={0.2} />
          </mesh>
        ))}
        <mesh position={[0, 3.55, 0]}>
          <sphereGeometry args={[0.26, 12, 12]} />
          <meshStandardMaterial color="#ffd75e" metalness={0.88} roughness={0.18} emissive="#c98a18" emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[0, 3.92, 0]}>
          <sphereGeometry args={[0.17, 12, 12]} />
          <meshStandardMaterial color="#fff099" metalness={0.92} roughness={0.15} emissive="#ffae2b" emissiveIntensity={0.4} />
        </mesh>
      </group>
    </group>
  );
});
