import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

/**
 * Bell tower (Request B, 2026-11-03): a small traditional Vietnamese
 * bell tower at (-13, -8), replacing the old flat red slab on four
 * plain pillars with a cone bell.
 *
 * Architecture (total height ~4.3m, platform 3.4m square):
 * - stone platform (top y 0.4) + brick base slab + 2 steps on the
 *   south side (visual; colliders in controls.ts block the platform
 *   and the steps, the guest rings from the ground south of them).
 * - 4 SQUARE wooden columns on stone bases, horizontal beams at the
 *   top, a centre cross beam that carries the bell.
 * - 4-sided sloped tile roof (red-brown panels, eaves boards, small
 *   upturned corners, finial), eaves overhang 0.3m past the columns.
 * - Bronze bell (LatheGeometry, NEVER a cone): tapered body, round
 *   shoulders, slight mouth flare, thick rim, hollow interior with
 *   wall thickness, hanging lug, raised rings, lotus panels, a
 *   striking boss on the south face. Height 1.2m, mouth at y 1.3.
 * - Wooden mallet hung by rope from the centre beam, head at boss
 *   height (y ~1.75), resting ~0.25m south of the bell face, never
 *   through the bell, never floating (rope is drawn to the beam).
 *
 * Animation (procedural, deltaTime, no geometry created per frame):
 * when `ringSeq` increments, the mallet swings in a short arc around
 * its rope pivot (rest 0 -> contact 0.15 rad at t=0.4s -> rest at
 * t=1.0s) and the bell sways only a tiny decaying amount
 * (<2 degrees, t=0.4s..3s). The strike SOUND is the page's bell.mp3
 * (3.5s, as before B), played on click, not by this component.
 * No explosion, flash or particles.
 * Ringing is personal: no WebSocket message is sent, so one guest's
 * ring never blasts sound on anyone else's machine.
 */
export default function BellTower({ ringSeq }: { ringSeq: number }) {
  const malletRef = useRef<THREE.Group>(null);
  const bellRef = useRef<THREE.Group>(null);
  const lastSeq = useRef(ringSeq);
  const animT = useRef(99);

  useEffect(() => {
    if (ringSeq !== lastSeq.current) {
      lastSeq.current = ringSeq;
      animT.current = 0;
    }
  }, [ringSeq]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    if (animT.current > 3) return;
    animT.current += dt;
    const t = animT.current;
    const mallet = malletRef.current;
    const bell = bellRef.current;
    if (mallet) {
      // Swing: ease out to contact at 0.4s, ease back to rest by 1.0s.
      let r = 0;
      if (t < 0.4) {
        const k = t / 0.4;
        r = 0.15 * (1 - Math.pow(1 - k, 2));
      } else if (t < 1.0) {
        const k = (t - 0.4) / 0.6;
        r = 0.15 * (1 - k * k * (3 - 2 * k));
      }
      mallet.rotation.x = r; // head moves north, just touching the boss
    }
    if (bell) {
      // Tiny decaying sway after contact, never a big pendulum.
      if (t >= 0.4) {
        const s = t - 0.4;
        bell.rotation.z = 0.03 * Math.sin(s * Math.PI * 2 * 1.2) * Math.exp(-s * 1.5);
      } else {
        bell.rotation.z = 0;
      }
    }
  });

  // Bell profile (radius, height), bell base (mouth) at local y 0.
  // Outer: mouth flare -> body -> round shoulders -> crown.
  // Inner: crown -> body -> mouth, leaving a 0.04m wall + open mouth.
  const bellGeometry = useMemo(() => {
    const pts: THREE.Vector2[] = [
      new THREE.Vector2(0.38, 0.0),
      new THREE.Vector2(0.36, 0.08),
      new THREE.Vector2(0.32, 0.3),
      new THREE.Vector2(0.3, 0.6),
      new THREE.Vector2(0.28, 0.85),
      new THREE.Vector2(0.22, 1.05),
      new THREE.Vector2(0.12, 1.15),
      new THREE.Vector2(0.08, 1.2),
      new THREE.Vector2(0.04, 1.2),
      new THREE.Vector2(0.08, 1.12),
      new THREE.Vector2(0.18, 1.02),
      new THREE.Vector2(0.24, 0.82),
      new THREE.Vector2(0.26, 0.58),
      new THREE.Vector2(0.28, 0.28),
      new THREE.Vector2(0.32, 0.06),
      new THREE.Vector2(0.34, 0.0),
    ];
    return new THREE.LatheGeometry(pts, 32);
  }, []);

  const bronze = '#A77B37';
  const bronzeDark = '#8a6a2f';
  const wood = '#4a2e1a';
  const roofRed = '#a8432a';
  const roofDark = '#7a2f1e';
  const stone = '#8d8a82';

  // Roof: 4 sloped panels meeting at a small apex cap. Each panel is
  // a box rotated about one axis; panels overlap at the apex so no
  // gap shows from below. Panel size: eaves 4.0m square, apex 0.5m
  // square at y 4.2, base y 2.6 -> slope length ~2.25m, slope ~38deg.
  const roofPanels: Array<{ pos: [number, number, number]; rot: [number, number, number] }> = [
    { pos: [0, 3.4, 1.05], rot: [0.62, 0, 0] }, // south slope
    { pos: [0, 3.4, -1.05], rot: [-0.62, 0, 0] }, // north slope
    { pos: [1.05, 3.4, 0], rot: [0, 0, -0.62] }, // east slope
    { pos: [-1.05, 3.4, 0], rot: [0, 0, 0.62] }, // west slope
  ];

  return (
    <group position={[-22, 0, -9.0]}>
      {/* Platform + base slab + south steps */}
      <mesh receiveShadow position={[0, 0.2, 0]}>
        <boxGeometry args={[3.4, 0.4, 3.4]} />
        <meshStandardMaterial color={stone} roughness={0.95} />
      </mesh>
      <mesh receiveShadow position={[0, 0.075, 0]}>
        <boxGeometry args={[3.6, 0.15, 3.6]} />
        <meshStandardMaterial color="#a39e92" roughness={0.95} />
      </mesh>
      <mesh receiveShadow position={[0, 0.075, 1.9]}>
        <boxGeometry args={[1.2, 0.15, 0.4]} />
        <meshStandardMaterial color={stone} roughness={0.95} />
      </mesh>
      <mesh receiveShadow position={[0, 0.225, 1.7]}>
        <boxGeometry args={[1.2, 0.15, 0.4]} />
        <meshStandardMaterial color={stone} roughness={0.95} />
      </mesh>

      {/* 4 square wooden columns on stone bases */}
      {[
        [-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh castShadow position={[0, 0.575, 0]}>
            <boxGeometry args={[0.36, 0.35, 0.36]} />
            <meshStandardMaterial color={stone} roughness={0.95} />
          </mesh>
          <mesh castShadow position={[0, 1.675, 0]}>
            <boxGeometry args={[0.22, 1.85, 0.22]} />
            <meshStandardMaterial color={wood} roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Horizontal beams at the top of the columns + centre cross beam */}
      <mesh castShadow position={[0, 2.6, 1.3]}>
        <boxGeometry args={[2.82, 0.18, 0.18]} />
        <meshStandardMaterial color={wood} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 2.6, -1.3]}>
        <boxGeometry args={[2.82, 0.18, 0.18]} />
        <meshStandardMaterial color={wood} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[1.3, 2.6, 0]}>
        <boxGeometry args={[0.18, 0.18, 2.82]} />
        <meshStandardMaterial color={wood} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[-1.3, 2.6, 0]}>
        <boxGeometry args={[0.18, 0.18, 2.82]} />
        <meshStandardMaterial color={wood} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 2.52, 0]}>
        <boxGeometry args={[2.82, 0.15, 0.15]} />
        <meshStandardMaterial color={wood} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 2.52, 0]}>
        <boxGeometry args={[0.15, 0.15, 2.82]} />
        <meshStandardMaterial color={wood} roughness={0.8} />
      </mesh>

      {/* 4-sided sloped tile roof */}
      {roofPanels.map((p, i) => (
        <mesh key={i} castShadow position={p.pos} rotation={p.rot}>
          <boxGeometry args={[4.0, 0.12, 2.25]} />
          <meshStandardMaterial color={roofRed} roughness={0.85} />
        </mesh>
      ))}
      {/* Tile rows (thin darker lines across the south + north slopes) */}
      {[0.6, 1.1, 1.6].map((z, i) => (
        <mesh key={`t${i}`} position={[0, 2.6 + (1.9 - z) * 0.62, z]} rotation={[0.62, 0, 0]}>
          <boxGeometry args={[3.9, 0.03, 0.08]} />
          <meshStandardMaterial color={roofDark} roughness={0.9} />
        </mesh>
      ))}
      {/* Eaves boards + restrained upturned corners */}
      {[
        [0, 2.62, 2.0, 0], [0, 2.62, -2.0, 0],
      ].map(([x, y, z], i) => (
        <mesh key={`e${i}`} castShadow position={[x, y, z]}>
          <boxGeometry args={[4.0, 0.1, 0.12]} />
          <meshStandardMaterial color={wood} roughness={0.8} />
        </mesh>
      ))}
      {[
        [-2.0, 2.0], [2.0, 2.0], [-2.0, -2.0], [2.0, -2.0],
      ].map(([x, z], i) => (
        <mesh key={`c${i}`} castShadow position={[x, 2.75, z]} rotation={[z > 0 ? -0.35 : 0.35, 0, x > 0 ? 0.35 : -0.35]}>
          <boxGeometry args={[0.35, 0.08, 0.35]} />
          <meshStandardMaterial color={roofDark} roughness={0.85} />
        </mesh>
      ))}
      {/* Apex cap + finial */}
      <mesh castShadow position={[0, 4.2, 0]}>
        <boxGeometry args={[0.5, 0.15, 0.5]} />
        <meshStandardMaterial color={roofDark} roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0, 4.35, 0]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial color="#c9a227" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Bronze bell (Lathe, hollow, mouth at y 1.3, top lug at y 2.5) */}
      <group ref={bellRef} position={[0, 1.3, 0]}>
        <mesh castShadow geometry={bellGeometry}>
          <meshStandardMaterial color={bronze} metalness={0.65} roughness={0.45} side={THREE.DoubleSide} />
        </mesh>
        {/* Hanging lug + short link to the centre beam */}
        <mesh castShadow position={[0, 1.28, 0]}>
          <torusGeometry args={[0.09, 0.03, 8, 16]} />
          <meshStandardMaterial color={bronzeDark} metalness={0.65} roughness={0.45} />
        </mesh>
        <mesh castShadow position={[0, 1.18, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.12, 8]} />
          <meshStandardMaterial color={bronzeDark} metalness={0.65} roughness={0.45} />
        </mesh>
        {/* Raised rings around the body */}
        {[
          [0.365, 0.12], [0.325, 0.42], [0.305, 0.72], [0.26, 0.95],
        ].map(([r, y], i) => (
          <mesh key={i} castShadow position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[r, 0.015, 8, 32]} />
            <meshStandardMaterial color={bronzeDark} metalness={0.65} roughness={0.45} />
          </mesh>
        ))}
        {/* Lotus panels around the mid body (8, restrained) */}
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <mesh
              key={i}
              castShadow
              position={[Math.sin(a) * 0.315, 0.6, Math.cos(a) * 0.315]}
              rotation={[0, a, 0]}
            >
              <sphereGeometry args={[0.05, 10, 10]} />
              <meshStandardMaterial color={bronzeDark} metalness={0.65} roughness={0.45} />
            </mesh>
          );
        })}
        {/* Striking boss on the SOUTH face (mallet strikes here) */}
        <mesh castShadow position={[0, 0.45, 0.31]} rotation={[Math.PI / 2, 0, 0]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color={bronzeDark} metalness={0.65} roughness={0.45} />
        </mesh>
      </group>

      {/* Wooden mallet, hung by rope from the centre Z beam.
          Pivot at the rope top (y 2.52, z 0.56); rope + handle hang
          down, head at y ~1.75 (boss height), head face resting
          ~0.11m south of the boss face (boss face z 0.36, head face
          z 0.47). Swing rotates about X, max 0.15 rad, so the head
          moves north 0.11m and just touches the boss, never through
          the bell. */}
      <group ref={malletRef} position={[0, 2.52, 0.56]}>
        <mesh castShadow position={[0, -0.35, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.7, 8]} />
          <meshStandardMaterial color="#6b4a2a" roughness={0.85} />
        </mesh>
        <mesh castShadow position={[0, -0.52, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.7, 10]} />
          <meshStandardMaterial color={wood} roughness={0.8} />
        </mesh>
        <mesh castShadow position={[0, -0.77, 0]}>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshStandardMaterial color="#5a3a1e" roughness={0.85} />
        </mesh>
      </group>
    </group>
  );
}
