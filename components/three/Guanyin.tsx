'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * Quan Âm Thiên Thủ Thiên Nhãn — rebuilt from scratch, replacing the
 * earlier standing placeholder. This version is SEATED (an vị) on a
 * multi-layer lotus pedestal, with:
 *
 * - A face, not a ball: oval head, closed serene eyes (thin arcs),
 *   soft eyebrows, a subtle nose, a small smile, long ears, hair bun
 *   and a crown — all in statue gold / dark brown, never cartoon black.
 * - A robe with folds: a draped lower robe with fold ridges, a sash,
 *   a necklace, and a scarf falling to the knees — not a plain cone.
 * - A structured arm fan: two layers, symmetric left/right, arms in
 *   arcs (not random sticks), each arm a tapered capsule with a
 *   flattened hand; outer-layer palms carry a small eye dot.
 * - A multi-layer lotus pedestal and a raised altar platform (the
 *   platform itself lives in Temple.tsx, this file is the statue).
 *
 * Materials are shared (one gold, one cream, etc.) across all parts
 * instead of one material per mesh, and the arm count is capped at
 * 40 (24 outer + 16 inner) so the silhouette reads as "thousand arms"
 * without hundreds of meshes.
 *
 * Local origin: the floor under the pedestal. Parent places it at
 * [0, hallFloorY, -13.5] in World.tsx.
 */

function useStatueMaterials() {
  return useMemo(
    () => ({
      gold: new THREE.MeshStandardMaterial({ color: '#c5a028', metalness: 0.55, roughness: 0.38 }),
      goldDark: new THREE.MeshStandardMaterial({ color: '#9a7a18', metalness: 0.55, roughness: 0.45 }),
      goldSoft: new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 0.5, roughness: 0.35, emissive: '#c5a028', emissiveIntensity: 0.08 }),
      cream: new THREE.MeshStandardMaterial({ color: '#efe6cf', roughness: 0.72 }),
      creamDark: new THREE.MeshStandardMaterial({ color: '#ddd0ac', roughness: 0.75 }),
      red: new THREE.MeshStandardMaterial({ color: '#7a1f1f', roughness: 0.7 }),
      dark: new THREE.MeshStandardMaterial({ color: '#2a1a12', roughness: 0.6 }),
      hair: new THREE.MeshStandardMaterial({ color: '#241812', roughness: 0.85 }),
      lotus: new THREE.MeshStandardMaterial({ color: '#e8a0b8', roughness: 0.65 }),
      lotusDark: new THREE.MeshStandardMaterial({ color: '#c97a96', roughness: 0.65 }),
      stone: new THREE.MeshStandardMaterial({ color: '#8d8a82', roughness: 0.9 }),
    }),
    [],
  );
}

type Mats = ReturnType<typeof useStatueMaterials>;

/** One arm: tapered capsule + flattened hand, optionally with an eye dot. */
function Arm({
  mats,
  angle,
  length,
  radius,
  eye,
  z,
}: {
  mats: Mats;
  angle: number;
  length: number;
  radius: number;
  eye: boolean;
  z: number;
}) {
  return (
    <group position={[0, 2.0, z]} rotation={[0, 0, angle]}>
      <mesh position={[0, length / 2, 0]} material={mats.gold} castShadow>
        <cylinderGeometry args={[radius * 0.6, radius, length, 10]} />
      </mesh>
      <mesh position={[0, length + 0.08, 0]} scale={[0.8, 1.3, 0.45]} material={mats.gold} castShadow>
        <sphereGeometry args={[radius * 1.6, 12, 12]} />
      </mesh>
      {eye && (
        <mesh position={[0, length + 0.08, 0.07]} material={mats.dark}>
          <sphereGeometry args={[0.028, 8, 8]} />
        </mesh>
      )}
    </group>
  );
}

/** One lotus petal: a flattened, outward-tilted shape, not a cone. */
function Petal({
  mats,
  angle,
  radius,
  size,
  tilt,
  y,
  dark,
}: {
  mats: Mats;
  angle: number;
  radius: number;
  size: number;
  tilt: number;
  y: number;
  dark: boolean;
}) {
  return (
    <mesh
      position={[Math.cos(angle) * radius, y, Math.sin(angle) * radius]}
      rotation={[tilt * Math.sin(angle), 0, -tilt * Math.cos(angle)]}
      scale={[1, 0.35, 1.6]}
      material={dark ? mats.lotusDark : mats.lotus}
      castShadow
    >
      <sphereGeometry args={[size, 12, 12]} />
    </mesh>
  );
}

export default function Guanyin() {
  const mats = useStatueMaterials();

  const outer: Array<{ angle: number; length: number; eye: boolean }> = [];
  for (let i = 1; i <= 12; i++) {
    const edge = i / 12;
    for (const s of [-1, 1]) {
      outer.push({ angle: s * edge * 1.3, length: 1.7 - edge * 0.5, eye: i % 3 === 0 });
    }
  }
  const inner: Array<{ angle: number; length: number }> = [];
  for (let i = 1; i <= 8; i++) {
    const edge = i / 8;
    for (const s of [-1, 1]) {
      inner.push({ angle: s * edge * 1.05, length: 1.35 - edge * 0.35 });
    }
  }

  return (
    <group>
      {/* Halo: outer disc + ring + inner disc, muted gold, not glowing
          neon. Radius capped at 1.6 so the top (base 1.335 + 2.2 + 1.6
          ≈ 5.14) stays under the hall roof at the back (≈5.37). */}
      <mesh position={[0, 2.2, -0.55]} material={mats.goldSoft}>
        <circleGeometry args={[1.6, 40]} />
      </mesh>
      <mesh position={[0, 2.2, -0.54]} material={mats.goldDark}>
        <torusGeometry args={[1.6, 0.05, 10, 48]} />
      </mesh>
      <mesh position={[0, 2.2, -0.53]} material={mats.cream}>
        <circleGeometry args={[1.35, 40]} />
      </mesh>
      <mesh position={[0, 2.2, -0.52]} material={mats.goldDark}>
        <torusGeometry args={[1.35, 0.035, 10, 48]} />
      </mesh>

      {/* Arm fans behind the body */}
      {outer.map((a, i) => (
        <Arm key={`o${i}`} mats={mats} angle={a.angle} length={a.length} radius={0.055} eye={a.eye} z={-0.22} />
      ))}
      {inner.map((a, i) => (
        <Arm key={`i${i}`} mats={mats} angle={a.angle} length={a.length} radius={0.05} eye={false} z={-0.12} />
      ))}

      {/* Lotus pedestal: stone base, gold tier, two petal layers, seat */}
      <mesh position={[0, 0.15, 0]} material={mats.stone} castShadow receiveShadow>
        <cylinderGeometry args={[1.35, 1.45, 0.3, 8]} />
      </mesh>
      <mesh position={[0, 0.35, 0]} material={mats.goldDark} castShadow>
        <cylinderGeometry args={[1.2, 1.3, 0.18, 24]} />
      </mesh>
      {Array.from({ length: 16 }).map((_, i) => (
        <Petal key={`p${i}`} mats={mats} angle={(i / 16) * Math.PI * 2} radius={1.12} size={0.3} tilt={0.65} y={0.5} dark={i % 2 === 1} />
      ))}
      {Array.from({ length: 12 }).map((_, i) => (
        <Petal key={`q${i}`} mats={mats} angle={(i / 12) * Math.PI * 2 + 0.26} radius={0.92} size={0.26} tilt={0.95} y={0.62} dark={i % 2 === 0} />
      ))}
      <mesh position={[0, 0.72, 0]} material={mats.gold} castShadow>
        <cylinderGeometry args={[0.95, 1.0, 0.16, 24]} />
      </mesh>

      {/* Seated body: lower robe draped over crossed legs */}
      <mesh position={[0, 0.95, 0.1]} scale={[1.15, 0.55, 1.0]} material={mats.cream} castShadow>
        <sphereGeometry args={[0.95, 24, 24]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.55, 0.95, 0.25]} rotation={[0, 0, s * 0.35]} scale={[1, 0.45, 1.4]} material={mats.creamDark} castShadow>
            <sphereGeometry args={[0.42, 16, 16]} />
          </mesh>
          <mesh position={[s * 0.85, 0.9, 0.35]} material={mats.creamDark} castShadow>
            <sphereGeometry args={[0.22, 14, 14]} />
          </mesh>
        </group>
      ))}
      {/* Robe folds: thin ridges down the front of the lower robe */}
      {[-0.55, -0.28, 0, 0.28, 0.55].map((x, i) => (
        <mesh key={i} position={[x, 1.05, 0.92]} rotation={[0.15, 0, x * 0.15]} scale={[0.35, 1, 0.4]} material={mats.creamDark} castShadow>
          <sphereGeometry args={[0.14, 10, 10]} />
        </mesh>
      ))}
      {/* Torso + shoulders */}
      <mesh position={[0, 1.65, 0]} scale={[1, 1.25, 0.85]} material={mats.gold} castShadow>
        <sphereGeometry args={[0.5, 24, 24]} />
      </mesh>
      {/* Sash across the chest + scarf falling to the knees */}
      <mesh position={[0, 1.7, 0.42]} rotation={[0, 0, 0.6]} material={mats.red} castShadow>
        <boxGeometry args={[0.18, 1.1, 0.05]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.38, 1.25, 0.45]} rotation={[0.1, 0, s * -0.08]} scale={[0.6, 1, 0.3]} material={mats.cream} castShadow>
          <sphereGeometry args={[0.16, 12, 12]} />
        </mesh>
      ))}
      {/* Necklace: two bead strands */}
      <mesh position={[0, 1.95, 0.38]} rotation={[Math.PI / 2 - 0.3, 0, 0]} material={mats.goldDark}>
        <torusGeometry args={[0.32, 0.03, 8, 24]} />
      </mesh>
      <mesh position={[0, 1.85, 0.42]} rotation={[Math.PI / 2 - 0.3, 0, 0]} material={mats.red}>
        <torusGeometry args={[0.28, 0.025, 8, 24]} />
      </mesh>

      {/* Head: oval, not a ball — taller than wide */}
      <mesh position={[0, 2.45, 0.05]} scale={[0.88, 1.12, 0.92]} material={mats.gold} castShadow>
        <sphereGeometry args={[0.34, 28, 28]} />
      </mesh>
      {/* Hair cap + bun + crown */}
      <mesh position={[0, 2.58, -0.02]} scale={[0.92, 0.85, 0.95]} material={mats.hair} castShadow>
        <sphereGeometry args={[0.35, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
      </mesh>
      <mesh position={[0, 2.82, 0]} material={mats.hair} castShadow>
        <sphereGeometry args={[0.13, 16, 16]} />
      </mesh>
      <mesh position={[0, 2.66, 0.05]} material={mats.goldDark} castShadow>
        <cylinderGeometry args={[0.36, 0.38, 0.12, 24]} />
      </mesh>
      {[-0.24, -0.12, 0, 0.12, 0.24].map((x, i) => (
        <mesh key={i} position={[x, 2.78, 0.12]} material={mats.gold} castShadow>
          <coneGeometry args={[0.04, 0.14, 8]} />
        </mesh>
      ))}
      {/* Long ears + earrings */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.32, 2.38, 0.05]} scale={[0.35, 1, 0.6]} material={mats.gold} castShadow>
            <sphereGeometry args={[0.09, 12, 12]} />
          </mesh>
          <mesh position={[s * 0.34, 2.22, 0.05]} material={mats.goldDark}>
            <sphereGeometry args={[0.035, 8, 8]} />
          </mesh>
        </group>
      ))}
      {/* Face: closed serene eyes (thin arcs), soft brows, subtle nose,
          small smile — dark brown / soft red, never black cartoon. */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.14, 2.52, 0.33]} rotation={[0, 0, s * -0.25]} material={mats.dark}>
            <torusGeometry args={[0.09, 0.012, 8, 16, Math.PI * 0.9]} />
          </mesh>
          <mesh position={[s * 0.14, 2.44, 0.34]} rotation={[0, 0, Math.PI]} material={mats.dark}>
            <torusGeometry args={[0.07, 0.014, 8, 16, Math.PI * 0.9]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 2.38, 0.36]} scale={[0.5, 1.2, 0.6]} material={mats.gold}>
        <sphereGeometry args={[0.045, 12, 12]} />
      </mesh>
      <mesh position={[0, 2.28, 0.35]} rotation={[0, 0, 0]} material={mats.red}>
        <torusGeometry args={[0.06, 0.012, 8, 16, Math.PI * 0.8]} />
      </mesh>
      <mesh position={[0, 2.54, 0.35]} material={mats.red}>
        <sphereGeometry args={[0.025, 8, 8]} />
      </mesh>
      <mesh position={[0, 2.45, -0.12]} material={mats.goldSoft}>
        <torusGeometry args={[0.5, 0.04, 10, 32]} />
      </mesh>

      {/* Central arms + hands together in the lap, holding a small lotus */}
      <group position={[-0.32, 1.55, 0.35]} rotation={[0, 0, 0.55]}>
        <mesh position={[0, -0.3, 0]} material={mats.gold} castShadow>
          <cylinderGeometry args={[0.045, 0.06, 0.6, 10]} />
        </mesh>
        <mesh position={[0, -0.62, 0]} scale={[0.8, 1.2, 0.45]} material={mats.gold} castShadow>
          <sphereGeometry args={[0.09, 12, 12]} />
        </mesh>
      </group>
      <group position={[0.32, 1.55, 0.35]} rotation={[0, 0, -0.55]}>
        <mesh position={[0, -0.3, 0]} material={mats.gold} castShadow>
          <cylinderGeometry args={[0.045, 0.06, 0.6, 10]} />
        </mesh>
        <mesh position={[0, -0.62, 0]} scale={[0.8, 1.2, 0.45]} material={mats.gold} castShadow>
          <sphereGeometry args={[0.09, 12, 12]} />
        </mesh>
      </group>
      <mesh position={[0, 1.05, 0.55]} scale={[1.2, 0.6, 0.7]} material={mats.gold} castShadow>
        <sphereGeometry args={[0.16, 14, 14]} />
      </mesh>
      <mesh position={[0, 1.18, 0.55]} material={mats.lotus} castShadow>
        <sphereGeometry args={[0.12, 12, 12]} />
      </mesh>
    </group>
  );
}
