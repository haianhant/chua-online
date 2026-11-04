'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { lanternState, LAYOUT, releaseState } from './controls';

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
  const midRef = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const pectL = useRef<THREE.Mesh>(null);
  const pectR = useRef<THREE.Mesh>(null);
  const state = useRef({
    x: spawn.x, z: spawn.z,
    heading: Math.atan2(POND_CENTER.x - spawn.x, POND_CENTER.z - spawn.z),
    target: { x: POND_CENTER.x, z: POND_CENTER.z },
    speed: 0.55 + (fish.seed % 5) * 0.06,
    depth: -0.12,
  });
  const pal = PALETTE[fish.colorIdx % PALETTE.length];

  const pickTarget = () => {
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
    const age = (Date.now() - fish.born) / 1000;
    const depth = age < 1 ? 0.05 - age * 0.17 : -0.12 + Math.sin(t * 1.6 + fish.seed) * 0.02;
    s.depth = depth;
    g.position.set(s.x, depth, s.z);
    g.rotation.y = s.heading;
    g.rotation.z = Math.sin(t * 1.6 + fish.seed) * 0.04;
    const wave = Math.sin(t * 7.2 + fish.seed * 2);
    if (midRef.current) midRef.current.rotation.y = wave * 0.22;
    if (tail.current) tail.current.rotation.y = Math.sin(t * 7.2 + fish.seed * 2 - 0.8) * 0.48;
    if (pectL.current) pectL.current.rotation.z = -0.45 + Math.sin(t * 4.5 + fish.seed) * 0.15;
    if (pectR.current) pectR.current.rotation.z = 0.45 - Math.sin(t * 4.5 + fish.seed) * 0.15;
  });

  return (
    <group ref={group} position={[spawn.x, 0.05, spawn.z]} scale={0.78}>
      {/* Đầu & mình trước cá chép Koi thuôn mượt (Fore-body & rounded head) */}
      <mesh castShadow position={[0, 0, 0.12]} scale={[0.82, 0.62, 1.55]}>
        <sphereGeometry args={[0.28, 20, 16]} />
        <meshStandardMaterial color={pal.body} roughness={0.32} metalness={0.08} />
      </mesh>
      {/* Mõm cá tròn đầy & đôi râu cá chép (Snout & Koi barbels) */}
      <mesh position={[0, -0.02, 0.48]} scale={[0.68, 0.48, 0.72]}>
        <sphereGeometry args={[0.17, 14, 12]} />
        <meshStandardMaterial color={pal.body} roughness={0.35} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={`barbel-${side}`} position={[side * 0.09, -0.05, 0.56]} rotation={[0.5, 0, side * 0.45]}>
          <cylinderGeometry args={[0.006, 0.012, 0.11, 6]} />
          <meshStandardMaterial color={pal.tail} roughness={0.5} />
        </mesh>
      ))}
      {/* Đốm đỏ Kohaku trên đỉnh đầu & lưng (Koi markings) */}
      {pal.patch && (
        <>
          <mesh position={[0, 0.11, 0.28]} scale={[0.95, 0.48, 1.15]}>
            <sphereGeometry args={[0.15, 14, 12]} />
            <meshStandardMaterial color="#d94826" roughness={0.35} />
          </mesh>
          <mesh position={[0.03, 0.12, -0.04]} scale={[0.85, 0.45, 1.25]}>
            <sphereGeometry args={[0.14, 14, 12]} />
            <meshStandardMaterial color="#d94826" roughness={0.35} />
          </mesh>
        </>
      )}
      {/* Vây lưng uốn lượn mềm mại (Sculpted dorsal fin) */}
      <mesh position={[0, 0.19, -0.02]} rotation={[-0.28, 0, 0]} scale={[0.14, 0.75, 1.35]}>
        <sphereGeometry args={[0.15, 12, 10]} />
        <meshStandardMaterial color={pal.tail} roughness={0.45} transparent opacity={0.92} />
      </mesh>
      {/* Đôi vây ngực xòe quạt hai bên (Fan-shaped pectoral fins) */}
      {[-1, 1].map((side) => (
        <mesh
          key={`pect-${side}`}
          ref={side < 0 ? pectL : pectR}
          position={[side * 0.22, -0.05, 0.20]}
          rotation={[0.2, side * -0.35, side * 0.45]}
          scale={[1.15, 0.12, 0.78]}
        >
          <sphereGeometry args={[0.16, 12, 10]} />
          <meshStandardMaterial color={pal.tail} roughness={0.45} transparent opacity={0.9} />
        </mesh>
      ))}
      {/* Đôi mắt cá chép sáng có viền ánh kim */}
      {[-1, 1].map((side) => (
        <group key={`eye-${side}`} position={[side * 0.185, 0.055, 0.40]}>
          <mesh>
            <sphereGeometry args={[0.038, 10, 10]} />
            <meshStandardMaterial color="#f5d77f" roughness={0.3} />
          </mesh>
          <mesh position={[side * 0.012, 0, 0.01]}>
            <sphereGeometry args={[0.026, 8, 8]} />
            <meshStandardMaterial color="#151515" roughness={0.2} />
          </mesh>
        </group>
      ))}
      {/* Phần thân sau & cuống đuôi uốn lượn chữ S (Mid-body & caudal peduncle) */}
      <group ref={midRef} position={[0, 0, -0.18]}>
        <mesh castShadow position={[0, 0, -0.12]} scale={[0.62, 0.50, 1.15]}>
          <sphereGeometry args={[0.22, 16, 14]} />
          <meshStandardMaterial color={pal.body} roughness={0.34} />
        </mesh>
        {/* Vây bụng nhỏ */}
        {[-1, 1].map((side) => (
          <mesh
            key={`pelv-${side}`}
            position={[side * 0.11, -0.09, -0.06]}
            rotation={[0.3, 0, side * 0.5]}
            scale={[0.7, 0.1, 0.55]}
          >
            <sphereGeometry args={[0.12, 10, 8]} />
            <meshStandardMaterial color={pal.tail} roughness={0.5} transparent opacity={0.88} />
          </mesh>
        ))}
        {/* Vây đuôi chẻ đôi xòe rộng lượn sóng (Bilobed fan tail fin) */}
        <group ref={tail} position={[0, 0, -0.32]}>
          {/* Thùy đuôi trên */}
          <mesh position={[0, 0.07, -0.18]} rotation={[0.38, 0, 0]} scale={[0.14, 0.68, 1.35]}>
            <sphereGeometry args={[0.17, 12, 10]} />
            <meshStandardMaterial color={pal.tail} roughness={0.42} transparent opacity={0.9} />
          </mesh>
          {/* Thùy đuôi dưới */}
          <mesh position={[0, -0.06, -0.17]} rotation={[-0.36, 0, 0]} scale={[0.14, 0.62, 1.25]}>
            <sphereGeometry args={[0.16, 12, 10]} />
            <meshStandardMaterial color={pal.tail} roughness={0.42} transparent opacity={0.9} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/**
 * Hiệu ứng thả từng chú cá chép từ bát nước trên tay Phật tử nhảy nhẹ xuống Tâm Liên Hồ
 * đúng với số lượng cá đã chọn (1, 2 hoặc 3 chú cá).
 */
function ReleasingFishArc() {
  const arcGroup = useRef<THREE.Group>(null);
  const fishRefs = useRef<Array<THREE.Group | null>>([null, null, null]);
  const streamRef = useRef<THREE.Mesh>(null);
  const splashRefs = useRef<Array<THREE.Mesh | null>>([null, null, null]);

  useFrame(({ clock }) => {
    const active = releaseState.phase === 'releasing';
    if (arcGroup.current) arcGroup.current.visible = active;
    if (!active) return;

    const p = releaseState.progress; // 0..1 over ~3.2s
    const count = releaseState.count;
    const t = clock.getElapsedTime();

    // Tọa độ chính xác của chiếc bát trên hai bàn tay người chơi (cập nhật mỗi frame từ Player.tsx)
    const startX = releaseState.handPos.x;
    const startY = releaseState.handPos.y;
    const startZ = releaseState.handPos.z;
    const endX = releaseState.waterTarget.x;
    const endY = releaseState.waterTarget.y;
    const endZ = releaseState.waterTarget.z;
    const facing = releaseState.facing;

    // Dòng nước nghiêng chảy trực tiếp từ miệng bát trên tay xuống mặt hồ (p = 0.08..0.92)
    if (streamRef.current) {
      const showStream = p > 0.08 && p < 0.92;
      streamRef.current.visible = showStream;
      if (showStream) {
        const midX = (startX + endX) * 0.5;
        const midY = (startY + endY) * 0.5;
        const midZ = (startZ + endZ) * 0.5;
        streamRef.current.position.set(midX, midY, midZ);
        streamRef.current.rotation.set(0.75, facing, 0);
        const sOp = p < 0.2 ? (p - 0.08) / 0.12 : p > 0.78 ? (0.92 - p) / 0.14 : 1;
        (streamRef.current.material as THREE.MeshStandardMaterial).opacity = 0.58 * Math.max(0, Math.min(1, sOp));
      }
    }

    // Vector vuông góc với hướng nhìn để tách nhẹ các chú cá khi thả 2-3 con
    const perpX = Math.cos(facing);
    const perpZ = -Math.sin(facing);

    for (let i = 0; i < 3; i++) {
      const fg = fishRefs.current[i];
      const sp = splashRefs.current[i];
      if (!fg || !sp) continue;
      if (i >= count) {
        fg.visible = false;
        sp.visible = false;
        continue;
      }
      // Stagger mỗi chú cá phóng sinh nhảy trực tiếp từ bát trên tay ra hồ
      const windowStart = 0.14 + i * 0.22;
      const windowEnd = windowStart + 0.38;
      const latOff = count === 1 ? 0 : (i - (count - 1) / 2) * 0.24;
      const targetX = endX + perpX * latOff;
      const targetZ = endZ + perpZ * latOff;

      if (p >= windowStart && p <= windowEnd) {
        fg.visible = true;
        const k = (p - windowStart) / (windowEnd - windowStart);
        const fx = startX + (targetX - startX) * k;
        // Quỹ đạo parabol vọt nhẹ từ miệng bát trên tay người chơi rồi đáp xuống mặt nước hồ
        const fy = startY * (1 - k) + endY * k + Math.sin(k * Math.PI) * 0.34;
        const fz = startZ + (targetZ - startZ) * k;
        fg.position.set(fx, fy, fz);
        // Hướng đầu cá theo đúng hướng tay người chơi thả xuống mặt hồ + quẫy nhẹ đuôi
        fg.rotation.set(0.32 - k * 0.95, facing, Math.sin(t * 16 + i) * 0.14);
      } else {
        fg.visible = false;
      }

      // Vòng sóng nước lan tỏa ngay tại điểm từng chú cá chạm mặt hồ
      const splashStart = windowEnd - 0.05;
      const splashEnd = splashStart + 0.28;
      if (p >= splashStart && p <= splashEnd) {
        sp.visible = true;
        const sk = (p - splashStart) / (splashEnd - splashStart);
        sp.position.set(targetX, 0.09, targetZ);
        sp.scale.setScalar(0.35 + sk * 1.15);
        (sp.material as THREE.MeshBasicMaterial).opacity = 0.65 * (1 - sk);
      } else {
        sp.visible = false;
      }
    }
  });

  return (
    <group ref={arcGroup} visible={false}>
      {/* Dòng nước trong chảy từ bát trên tay người chơi xuống hồ */}
      <mesh ref={streamRef}>
        <cylinderGeometry args={[0.032, 0.072, 1.25, 10]} />
        <meshStandardMaterial color="#8ecae6" transparent opacity={0.55} roughness={0.2} />
      </mesh>
      {/* Tối đa 3 chú cá chép phóng sinh bay ra trực tiếp từ bát nước trên tay đúng theo số lượng chọn */}
      {[0, 1, 2].map((i) => {
        const pal = PALETTE[i % PALETTE.length];
        return (
          <group key={`rel-fish-${i}`}>
            <group ref={(el) => { fishRefs.current[i] = el; }} scale={0.62}>
              <mesh position={[0, 0, 0.1]} scale={[0.8, 0.6, 1.5]}>
                <sphereGeometry args={[0.26, 14, 10]} />
                <meshStandardMaterial color={pal.body} roughness={0.32} />
              </mesh>
              <mesh position={[0, 0.16, -0.02]} rotation={[-0.28, 0, 0]} scale={[0.14, 0.7, 1.2]}>
                <sphereGeometry args={[0.14, 8, 8]} />
                <meshStandardMaterial color={pal.tail} roughness={0.45} />
              </mesh>
              <mesh position={[0, 0.04, -0.38]} rotation={[0.32, 0, 0]} scale={[0.14, 0.7, 1.3]}>
                <sphereGeometry args={[0.16, 8, 8]} />
                <meshStandardMaterial color={pal.tail} roughness={0.45} />
              </mesh>
              <mesh position={[0, -0.04, -0.38]} rotation={[-0.32, 0, 0]} scale={[0.14, 0.65, 1.2]}>
                <sphereGeometry args={[0.15, 8, 8]} />
                <meshStandardMaterial color={pal.tail} roughness={0.45} />
              </mesh>
            </group>
            <mesh
              ref={(el) => { splashRefs.current[i] = el; }}
              rotation={[-Math.PI / 2, 0, 0]}
              visible={false}
            >
              <ringGeometry args={[0.18, 0.28, 20]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.65} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
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

function LotusPondInner({ spawnTick, spawnCount, remoteTick, onFishCount }: Props) {
  const [fish, setFish] = useState<Fish[]>([]);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const nextId = useRef(1);
  const shape = useMemo(() => pondShape(), []);
  const spawnPoint = useMemo(() => ({ x: POND_CENTER.x + POND_RX - 0.6, z: POND_CENTER.z }), []);
  const ambientRippleRef = useRef<THREE.Mesh>(null);
  const ambientPadIdx = useRef(0);

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
    setRipples((prev) => [...prev.slice(-4), { id: nextId.current++, x: at.x, z: at.z, born: Date.now() }]);
  };

  useEffect(() => {
    if (spawnTick <= 0) return;
    // Clamp landing point inside pond ellipse so fish swim naturally from where they hit the water
    const rawX = releaseState.waterTarget.x;
    const rawZ = releaseState.waterTarget.z;
    const dx = rawX - POND_CENTER.x;
    const dz = rawZ - POND_CENTER.z;
    const norm = Math.hypot(dx / (POND_RX * 0.8), dz / (POND_RZ * 0.8));
    const at =
      norm > 1
        ? { x: POND_CENTER.x + (dx / norm), z: POND_CENTER.z + (dz / norm) }
        : { x: rawX, z: rawZ };
    addFish(Math.max(1, spawnCount), at);
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

  // Ref-driven ambient ripple (zero React state churn / zero re-renders in useFrame!)
  useFrame(({ clock }) => {
    const m = ambientRippleRef.current;
    if (!m) return;
    const t = clock.getElapsedTime();
    const cycle = t % 5.0;
    if (cycle < 1.6) {
      const k = cycle / 1.6;
      if (k < 0.05) {
        ambientPadIdx.current = Math.floor(t / 5.0) % PADS.length;
      }
      const pad = PADS[ambientPadIdx.current];
      m.visible = true;
      m.position.set(POND_CENTER.x + pad[0], 0.1, POND_CENTER.z + pad[1]);
      const s = 0.25 + k * 1.1;
      m.scale.set(s, s, 1);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - k);
    } else {
      m.visible = false;
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
      <mesh ref={ambientRippleRef} rotation={[-Math.PI / 2, 0, 0]} position={[POND_CENTER.x, 0.1, POND_CENTER.z]} visible={false}>
        <ringGeometry args={[0.28, 0.36, 20]} />
        <meshBasicMaterial color="#e8f4f4" transparent opacity={0.5} depthWrite={false} />
      </mesh>
      {ripples.map((r) => (
        <Ripple key={r.id} x={r.x} z={r.z} onDone={() => setRipples((prev) => prev.filter((p) => p.id !== r.id))} />
      ))}
      {/* Fish */}
      {fish.map((f) => (
        <Koi key={f.id} fish={f} spawn={spawnPoint} />
      ))}
      {/* Parabolic release arc when the devotee releases 1..3 Koi into Tâm Liên Hồ */}
      <ReleasingFishArc />
      {/* Đèn Hoa Đăng trôi nhẹ trên mặt Tâm Liên Hồ */}
      <PondFloatingLanterns />
    </group>
  );
}

const LotusPond = React.memo(LotusPondInner);
export default LotusPond;

const POND_LANTERN_SPOTS: Array<{ x: number; z: number; phase: number; color: string }> = [
  { x: -0.6, z: -0.8, phase: 0.3, color: '#ff8da1' },
  { x: 1.1, z: -0.2, phase: 1.7, color: '#ffd166' },
  { x: -1.4, z: 0.5, phase: 3.1, color: '#ffb3c6' },
  { x: 0.4, z: 0.7, phase: 4.5, color: '#ff8da1' },
  { x: -0.2, z: 0.1, phase: 2.2, color: '#ffd166' },
  { x: 1.5, z: 0.6, phase: 5.4, color: '#ffb3c6' },
];

function PondFloatingLanterns() {
  const refs = useRef<Array<THREE.Group | null>>([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    for (let i = 0; i < POND_LANTERN_SPOTS.length; i++) {
      const g = refs.current[i];
      if (!g) continue;
      const visible = i < lanternState.pondCount;
      g.visible = visible;
      if (!visible) continue;
      const cfg = POND_LANTERN_SPOTS[i];
      const dx = Math.sin(t * 0.35 + cfg.phase) * 0.32;
      const dz = Math.cos(t * 0.28 + cfg.phase) * 0.26;
      g.position.set(
        POND_CENTER.x + cfg.x + dx,
        0.095 + Math.sin(t * 2.1 + cfg.phase) * 0.008,
        POND_CENTER.z + cfg.z + dz,
      );
      g.rotation.y = t * 0.22 + cfg.phase;
    }
  });

  return (
    <group>
      {POND_LANTERN_SPOTS.map((cfg, idx) => (
        <group
          key={`pond-lan-${idx}`}
          ref={(el) => { refs.current[idx] = el; }}
          position={[POND_CENTER.x + cfg.x, 0.095, POND_CENTER.z + cfg.z]}
        >
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.18, 12]} />
            <meshStandardMaterial color="#386641" roughness={0.8} />
          </mesh>
          {[0, 1, 2, 3, 4, 5].map((p) => {
            const a = (p / 6) * Math.PI * 2;
            return (
              <mesh key={p} position={[Math.cos(a) * 0.085, 0.045, Math.sin(a) * 0.085]} rotation={[0.45, 0, a]}>
                <sphereGeometry args={[0.068, 8, 8]} />
                <meshStandardMaterial color={cfg.color} emissive={cfg.color} emissiveIntensity={0.35} roughness={0.5} />
              </mesh>
            );
          })}
          <mesh position={[0, 0.085, 0]}>
            <sphereGeometry args={[0.042, 8, 8]} />
            <meshStandardMaterial color="#fff3b0" emissive="#ff9f1c" emissiveIntensity={1.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
