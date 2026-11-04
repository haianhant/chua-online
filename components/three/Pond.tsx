'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LAYOUT } from './controls';

/**
 * Lotus pond + koi release.
 *
 * The pond replaces the old small decorative pond at the same west
 * spot, so the courtyard balance is unchanged. Water is a natural,
 * irregular shape (not a flat disc), edged with stones, with lily
 * pads, lotus flowers and buds, and a stepping-stone path from the
 * courtyard to the bank where you stand to release fish.
 *
 * Fish are pooled, never database-backed, and never saved: at most
 * MAX_FISH swim at once. A new release reuses the oldest slot when
 * the pond is full, so repeated releases cannot slow the scene down.
 * Each fish steers smoothly towards a wander target inside the pond
 * ellipse — no snap turns, no teleporting, and fish swim below the
 * lily pads (y < pad height), so they pass under pads like real koi.
 */

export const POND_CENTER = { x: LAYOUT.pond.x, z: LAYOUT.pond.z };
const POND_RX = 3.3;
const POND_RZ = 2.6;
const MAX_FISH = 18;

const PALETTE = [
  { body: '#d95d2e', tail: '#b84a22', patch: false },
  { body: '#e8a83a', tail: '#c98a24', patch: false },
  { body: '#f2ede2', tail: '#d95d2e', patch: true },
  { body: '#f5d9d0', tail: '#e8a0b8', patch: false },
] as const;

type Fish = { id: number; colorIdx: number; seed: number; born: number };
type Ripple = { id: number; x: number; z: number; born: number };

/** Irregular pond outline: ellipse with a gentle, fixed wobble. */
function pondShape(): THREE.Shape {
  const shape = new THREE.Shape();
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const wobble = 1 + 0.12 * Math.sin(a * 3 + 0.7) + 0.06 * Math.sin(a * 5 + 2.1);
    const x = Math.cos(a) * POND_RX * wobble;
    const y = Math.sin(a) * POND_RZ * wobble;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
}

const PADS: Array<[number, number, number]> = [
  [-1.8, -0.8, 0.55], [-0.9, 0.7, 0.45], [0.4, -1.1, 0.5], [1.2, 0.4, 0.6],
  [1.9, -0.9, 0.42], [-2.2, 0.9, 0.48], [0.1, 1.3, 0.44], [-0.3, -0.2, 0.38],
  [2.3, 0.9, 0.4], [-1.4, 1.5, 0.4],
];

const LOTUS: Array<{ x: number; z: number; color: string; scale: number }> = [
  { x: -1.2, z: -0.3, color: '#e8a0b8', scale: 1 },
  { x: 0.8, z: 0.9, color: '#f5e8ee', scale: 0.9 },
  { x: 1.6, z: -0.4, color: '#e8a0b8', scale: 0.8 },
  { x: -0.5, z: 1.1, color: '#f5e8ee', scale: 0.75 },
];

const BUDS: Array<[number, number]> = [[-2.0, 0.2], [0.6, -1.5], [2.0, 1.2]];

function LotusFlower({ x, z, color, scale }: { x: number; z: number; color: string; scale: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    // Very gentle sway only — the flower must stay calm, not dance.
    ref.current.rotation.x = Math.sin(t * 0.7 + x) * 0.04;
    ref.current.rotation.z = Math.cos(t * 0.5 + z) * 0.04;
  });
  return (
    <group ref={ref} position={[x, 0.22, z]} scale={scale}>
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.02, 0.03, 0.3, 6]} />
        <meshStandardMaterial color="#3f7a2e" roughness={0.9} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.16, 0.08, Math.sin(a) * 0.16]} rotation={[0.5, 0, a]}>
            <sphereGeometry args={[0.14, 10, 10]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.09, 10, 10]} />
        <meshStandardMaterial color="#e8c83a" roughness={0.7} />
      </mesh>
    </group>
  );
}

function Ripple({ x, z, onDone }: { x: number; z: number; onDone: () => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const born = useRef(Date.now());
  const done = useRef(false);
  useFrame(() => {
    const el = (Date.now() - born.current) / 1600;
    if (el >= 1) {
      if (!done.current) { done.current = true; onDone(); }
      return;
    }
    if (ref.current) {
      const s = 0.25 + el * 1.1;
      ref.current.scale.set(s, s, 1);
      (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - el);
    }
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.1, z]}>
      <ringGeometry args={[0.28, 0.36, 24]} />
      <meshBasicMaterial color="#e8f4f4" transparent opacity={0.55} depthWrite={false} />
    </mesh>
  );
}

function Koi({ fish, spawn }: { fish: Fish; spawn: { x: number; z: number } }) {
  const group = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const state = useRef({
    x: spawn.x, z: spawn.z,
    heading: Math.atan2(POND_CENTER.x - spawn.x, POND_CENTER.z - spawn.z),
    target: { x: POND_CENTER.x, z: POND_CENTER.z },
    speed: 0.55 + (fish.seed % 5) * 0.06,
    depth: -0.14,
  });
  const pal = PALETTE[fish.colorIdx % PALETTE.length];

  const pickTarget = () => {
    // Random point inside the pond ellipse, with margin from the bank.
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 0.78;
    return { x: POND_CENTER.x + Math.cos(a) * POND_RX * r, z: POND_CENTER.z + Math.sin(a) * POND_RZ * r };
  };

  useFrame(({ clock }, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);
    const s = state.current;
    const dx = s.target.x - s.x;
    const dz = s.target.z - s.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.4) s.target = pickTarget();
    else {
      // Smooth steering: turn at most ~1.4 rad/s, so the fish never
      // snaps its head around.
      const want = Math.atan2(dx, dz);
      let diff = want - s.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turn = Math.max(-1.4 * dt, Math.min(1.4 * dt, diff));
      s.heading += turn;
      s.x += Math.sin(s.heading) * s.speed * dt;
      s.z += Math.cos(s.heading) * s.speed * dt;
    }
    const t = clock.getElapsedTime();
    // Dive from the surface after release, then stay just below it.
    const age = (Date.now() - fish.born) / 1000;
    const depth = age < 1 ? 0.05 - age * 0.19 : -0.14 + Math.sin(t * 1.6 + fish.seed) * 0.02;
    s.depth = depth;
    g.position.set(s.x, depth, s.z);
    g.rotation.y = s.heading;
    g.rotation.z = Math.sin(t * 1.6 + fish.seed) * 0.04;
    if (tail.current) tail.current.rotation.y = Math.sin(t * 7 + fish.seed * 2) * 0.5;
  });

  return (
    <group ref={group} position={[spawn.x, 0.05, spawn.z]}>
      {/* Body: elongated sphere, not a box — smooth koi silhouette. */}
      <mesh castShadow scale={[1, 0.65, 2.2]}>
        <sphereGeometry args={[0.32, 20, 16]} />
        <meshStandardMaterial color={pal.body} roughness={0.45} />
      </mesh>
      {/* Red head patch on the white variant only. */}
      {pal.patch && (
        <mesh position={[0, 0.1, 0.22]} rotation={[0.4, 0, 0]}>
          <sphereGeometry args={[0.14, 12, 12]} />
          <meshStandardMaterial color="#d95d2e" roughness={0.5} />
        </mesh>
      )}
      {/* Dorsal fin */}
      <mesh position={[0, 0.18, -0.05]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.04, 0.18, 0.3]} />
        <meshStandardMaterial color={pal.tail} roughness={0.6} />
      </mesh>
      {/* Pectoral fins */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.3, -0.05, 0.25]} rotation={[0, 0, side * 0.6]}>
          <boxGeometry args={[0.22, 0.03, 0.18]} />
          <meshStandardMaterial color={pal.tail} roughness={0.6} />
        </mesh>
      ))}
      {/* Tail, wagged in useFrame */}
      <group ref={tail} position={[0, 0, -0.55]}>
        <mesh position={[0, 0, -0.22]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.05, 0.3, 0.45]} />
          <meshStandardMaterial color={pal.tail} roughness={0.6} />
        </mesh>
      </group>
      {/* Eyes */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.24, 0.08, 0.55]}>
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

type Props = {
  /** Increments on every local release; spawnCount is the fish for that tick. */
  spawnTick: number;
  spawnCount: number;
  /** Increments on a remote player's release (1 fish + ripple, no message). */
  remoteTick: number;
  /** Current fish count, for the release panel (via onFishCount). */
  onFishCount?: (n: number) => void;
};

export default function LotusPond({ spawnTick, spawnCount, remoteTick, onFishCount }: Props) {
  const [fish, setFish] = useState<Fish[]>([]);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const nextId = useRef(1);
  const shape = useMemo(() => pondShape(), []);
  const spawnPoint = useMemo(() => ({ x: POND_CENTER.x + POND_RX - 0.6, z: POND_CENTER.z }), []);

  const addFish = (n: number, at: { x: number; z: number }) => {
    setFish((prev) => {
      let next = [...prev];
      for (let i = 0; i < n; i++) {
        const id = nextId.current++;
        const f: Fish = { id, colorIdx: (id - 1) % PALETTE.length, seed: id * 1.7, born: Date.now() };
        if (next.length >= MAX_FISH) next = [...next.slice(1), f];
        else next = [...next, f];
      }
      return next;
    });
    setRipples((prev) => [...prev.slice(-5), { id: nextId.current++, x: at.x, z: at.z, born: Date.now() }]);
  };

  useEffect(() => {
    if (spawnTick <= 0) return;
    addFish(Math.max(1, spawnCount), spawnPoint);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spawnTick]);

  useEffect(() => {
    if (remoteTick <= 0) return;
    addFish(1, { x: POND_CENTER.x, z: POND_CENTER.z });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteTick]);

  useEffect(() => {
    onFishCount?.(fish.length);
  }, [fish.length, onFishCount]);

  // Ambient ripple every ~5s, at a lily pad — gentle, never a storm.
  const lastAmbient = useRef(0);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (t - lastAmbient.current > 5) {
      lastAmbient.current = t;
      const pad = PADS[Math.floor(Math.random() * PADS.length)];
      setRipples((prev) => [...prev.slice(-5), { id: nextId.current++, x: POND_CENTER.x + pad[0], z: POND_CENTER.z + pad[1], born: Date.now() }]);
    }
  });

  // Bank stones around the pond outline.
  const stones = useMemo(() => {
    const out: Array<{ x: number; z: number; s: number; r: number }> = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const wobble = 1 + 0.12 * Math.sin(a * 3 + 0.7) + 0.06 * Math.sin(a * 5 + 2.1);
      out.push({
        x: POND_CENTER.x + Math.cos(a) * (POND_RX + 0.35) * wobble,
        z: POND_CENTER.z + Math.sin(a) * (POND_RZ + 0.35) * wobble,
        s: 0.32 + ((i * 37) % 10) * 0.03,
        r: (i * 0.7) % Math.PI,
      });
    }
    return out;
  }, []);

  return (
    <group position={[0, 0, 0]}>
      {/* Bank: soft grass ring under the stones + stone rim curb, so the
          pond edge has a clean border and never overlaps the east path. */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[POND_CENTER.x, 0.03, POND_CENTER.z]}>
        <circleGeometry args={[4.1, 28]} />
        <meshStandardMaterial color="#7a9a5a" roughness={1} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[POND_CENTER.x, 0.035, POND_CENTER.z]}>
        <ringGeometry args={[3.95, 4.2, 32]} />
        <meshStandardMaterial color="#8d8a82" roughness={0.95} />
      </mesh>
      {/* Water: deep centre + lighter surface, irregular shape. */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[POND_CENTER.x, 0.05, POND_CENTER.z]}>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial color="#3a6a72" roughness={0.35} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[POND_CENTER.x, 0.07, POND_CENTER.z]}>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial color="#5a8a92" roughness={0.2} transparent opacity={0.85} />
      </mesh>
      {/* Stones */}
      {stones.map((s, i) => (
        <mesh key={i} castShadow position={[s.x, 0.12, s.z]} rotation={[0, s.r, 0]} scale={[1, 0.55, 1]}>
          <dodecahedronGeometry args={[s.s, 0]} />
          <meshStandardMaterial color={i % 3 === 0 ? '#8a8578' : '#9a9484'} roughness={0.95} />
        </mesh>
      ))}
      {/* Lily pads */}
      {PADS.map(([x, z, r], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[POND_CENTER.x + x, 0.09, POND_CENTER.z + z]}>
          <circleGeometry args={[r, 16]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#3f7a2e' : '#4a8a38'} roughness={0.8} />
        </mesh>
      ))}
      {/* Lotus flowers + buds */}
      {LOTUS.map((f, i) => (
        <LotusFlower key={i} x={POND_CENTER.x + f.x} z={POND_CENTER.z + f.z} color={f.color} scale={f.scale} />
      ))}
      {BUDS.map(([x, z], i) => (
        <mesh key={i} position={[POND_CENTER.x + x, 0.32, POND_CENTER.z + z]}>
          <coneGeometry args={[0.14, 0.45, 8]} />
          <meshStandardMaterial color="#e8a0b8" roughness={0.7} />
        </mesh>
      ))}
      {/* Ripples */}
      {ripples.map((r) => (
        <Ripple key={r.id} x={r.x} z={r.z} onDone={() => setRipples((prev) => prev.filter((p) => p.id !== r.id))} />
      ))}
      {/* Fish */}
      {fish.map((f) => (
        <Koi key={f.id} fish={f} spawn={spawnPoint} />
      ))}
    </group>
  );
}
