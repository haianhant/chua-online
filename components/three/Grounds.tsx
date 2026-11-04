'use client';

import { memo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { controls, LAYOUT, sweepState, wishingRackState } from './controls';
import BellTower from './BellTower';
import { Roof } from './Temple';
import TextSign from './TextSign';
import { useTextures } from './textures';

/**
 * Biển hiệu gỗ truyền thống trong khuôn viên chùa (hai trụ gỗ lim đặt trên
 * chân tảng đá, bảng gỗ chạm khắc chữ vàng hai mặt và mái ngói nhỏ che mưa nắng).
 */
function TempleSignboard({
  text,
  position,
  rotationY = 0,
  width = 1.9,
}: {
  text: string;
  position: [number, number, number];
  rotationY?: number;
  width?: number;
}) {
  // Đặt 2 trụ gỗ hoàn toàn ra NGOÀI mép bảng chữ (width/2 + 0.14)
  // để không bao giờ che hay lấn vào chữ trên biển hiệu.
  const postX = width * 0.5 + 0.14;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Chân tảng đá & 2 trụ gỗ lim bên ngoài khung bảng */}
      {[-postX, postX].map((px, i) => (
        <group key={i} position={[px, 0, 0]}>
          <mesh receiveShadow castShadow position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.12, 0.15, 0.16, 12]} />
            <meshStandardMaterial color="#8d8a82" roughness={0.95} />
          </mesh>
          <mesh castShadow position={[0, 0.84, 0]}>
            <cylinderGeometry args={[0.058, 0.068, 1.56, 12]} />
            <meshStandardMaterial color="#4a2e1a" roughness={0.82} />
          </mesh>
        </group>
      ))}
      {/* Khung bảng gỗ chạm khắc nằm gọn giữa 2 trụ */}
      <mesh castShadow position={[0, 1.32, 0]}>
        <boxGeometry args={[width + 0.14, 0.52, 0.06]} />
        <meshStandardMaterial color="#3b2313" roughness={0.85} />
      </mesh>
      {/* Mặt chữ vàng phía trước (+Z) và phía sau (-Z), nổi hoàn toàn trước khung */}
      <TextSign text={text} width={width} height={0.44} position={[0, 1.32, 0.034]} rotationY={0} />
      <TextSign text={text} width={width} height={0.44} position={[0, 1.32, -0.034]} rotationY={Math.PI} />
      {/* Xà ngang đỡ mái & mái ngói che biển hiệu */}
      <mesh castShadow position={[0, 1.63, 0]}>
        <boxGeometry args={[width + 0.46, 0.08, 0.24]} />
        <meshStandardMaterial color="#4a2e1a" roughness={0.82} />
      </mesh>
      <mesh castShadow position={[0, 1.73, 0.11]} rotation={[0.42, 0, 0]}>
        <boxGeometry args={[width + 0.58, 0.06, 0.32]} />
        <meshStandardMaterial color="#a8432a" roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0, 1.73, -0.11]} rotation={[-0.42, 0, 0]}>
        <boxGeometry args={[width + 0.58, 0.06, 0.32]} />
        <meshStandardMaterial color="#a8432a" roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0, 1.80, 0]}>
        <boxGeometry args={[width + 0.6, 0.07, 0.09]} />
        <meshStandardMaterial color="#7a2d1e" roughness={0.85} />
      </mesh>
    </group>
  );
}

type Props = {
  soilWet: boolean;
  waterStream: boolean;
  carryingWater: boolean;
  bellRingSeq: number;
};

/**
 * Sweep leaves (Request C, 2026-11-04): 24 individual leaves, NOT
 * 3 clusters that vanish in 0.1s. Each leaf has its own position,
 * rotation, velocity and state, simulated in this useFrame with
 * deltaTime (FPS-independent). Meshes are created ONCE in JSX;
 * only positions/rotations/visibility change per frame — no new
 * geometry or material per frame, no physics engine, no heavy
 * per-leaf collision. Leaf state is PERSONAL and local only:
 * it is never sent over WebSocket and never stored, so one
 * guest sweeping never clears another guest's leaves.
 * No sound is added: there is no real broom recording, and a
 * synthesised rustle would sound fake (the user already rejected
 * a synthesised bell for the same reason). Visual only, restrained.
 */
type Leaf = {
  x: number; z: number; rot: number;
  vx: number; vz: number;
  state: 'ground' | 'sliding' | 'piled' | 'collecting' | 'collected';
  collectT: number;
};

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeLeaves(): Leaf[] {
  const rng = mulberry32(20261104);
  const leaves: Leaf[] = [];
  let tries = 0;
  while (leaves.length < 24 && tries < 2000) {
    tries++;
    const x = 20.8 + rng() * 2.2; // 20.8..23.0, in front of the sweep spot under Cây đa Bách Linh
    const z = 8.8 + rng() * 1.6; // 8.8..10.4, south of the banyan trunk (22, 8)
    // Keep out of the trunk (22,8) r 1.3, the basket (23.5,9) r 0.9,
    // and away from other leaves (min 0.30m apart).
    if (Math.hypot(x - 22, z - 8) < 1.3) continue;
    if (Math.hypot(x - 23.5, z - 9) < 0.9) continue;
    if (leaves.some((l) => Math.hypot(l.x - x, l.z - z) < 0.30)) continue;
    leaves.push({ x, z, rot: rng() * Math.PI * 2, vx: 0, vz: 0, state: 'ground', collectT: 0 });
  }
  return leaves;
}

const PREPARE_T = 1.5; // A: 1-2s
const SWEEP_T = 6; // B: 5-7s
const GATHER_T = 5; // C: 3-5s (was 4s: collection ran out of time, 7/24 leaves remained)
const COMPLETE_T = 1.5; // D: 1-2s (total 14s, inside 9-15s)

/**
 * Grounds loop v7: banyan courtyard (east) -> roofed corridor ->
 * garden gate -> back garden / tea house (north-east) -> north
 * path behind the hall -> lake bank (west) -> main courtyard.
 * Reuses the same dark-wood / terracotta / lime / grey-stone palette
 * as Temple.tsx. Positions MUST match LAYOUT in controls.ts.
 */
const Grounds = memo(function Grounds({ soilWet, waterStream, carryingWater, bellRingSeq }: Props) {
  const { roofTile } = useTextures();
  const broomRef = useRef<THREE.Group>(null);
  const leavesInitRef = useRef<Leaf[] | null>(null);
  if (!leavesInitRef.current) {
    leavesInitRef.current = makeLeaves();
  }
  const leavesRef = leavesInitRef as { current: Leaf[] };
  const leafMeshes = useRef<Array<THREE.Mesh | null>>([]);
  const tl = useRef({ phase: 'idle' as string, t: 0, collectTimer: 0 });
  // Test hook only (not user-visible): Playwright reads leaf counts
  // via window.__sweepLeaves to verify gradual clear / pile / collect.
  (globalThis as unknown as { __sweepLeaves?: Leaf[] }).__sweepLeaves = leavesRef.current;

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const b = broomRef.current;
    const phase = sweepState.phase;
    const paused = sweepState.paused;
    // Phase change: (re)start the timeline clock. Cancelling to
    // idle keeps leaf positions exactly as they are (swept leaves
    // stay swept, unswept stay put); collecting leaves stop
    // mid-way and become ground/piled again — nothing vanishes.
    if (tl.current.phase !== phase) {
      if (phase === 'preparing') tl.current.t = 0;
      if (phase === 'idle') {
        for (const l of leavesRef.current) {
          if (l.state === 'collecting') {
            l.state = Math.hypot(l.x - LAYOUT.sweepPile.x, l.z - LAYOUT.sweepPile.z) < 0.7 ? 'piled' : 'ground';
            l.vx = 0; l.vz = 0;
          }
          if (l.state === 'sliding') { l.state = 'ground'; l.vx = 0; l.vz = 0; }
        }
      }
      tl.current.phase = phase;
      if (phase === 'preparing') tl.current.t = 0;
      if (phase === 'sweeping' || phase === 'gathering' || phase === 'completed') tl.current.t = 0;
    }
    if (phase !== 'idle' && !paused) tl.current.t += dt;
    const tt = tl.current.t;
    // Progress across preparing+sweeping+gathering (completed = 1).
    if (phase === 'preparing') sweepState.progress = (tt / PREPARE_T) * 0.1;
    else if (phase === 'sweeping') sweepState.progress = 0.1 + (tt / SWEEP_T) * 0.6;
    else if (phase === 'gathering') sweepState.progress = 0.7 + (tt / GATHER_T) * 0.3;
    else if (phase === 'completed') sweepState.progress = 1;
    // Timeline transitions (Grounds owns the clock; the page only
    // reads phase/progress and writes pause/cancel).
    if (phase !== 'idle' && !paused) {
      if (phase === 'preparing' && tt >= PREPARE_T) { sweepState.phase = 'sweeping'; tl.current.t = 0; }
      else if (phase === 'sweeping' && tt >= SWEEP_T) { sweepState.phase = 'gathering'; tl.current.t = 0; }
      else if (phase === 'gathering' && tt >= GATHER_T) { sweepState.phase = 'completed'; tl.current.t = 0; }
      else if (phase === 'completed' && tt >= COMPLETE_T) { sweepState.phase = 'idle'; }
    }
    const cur = sweepState.phase;
    const p = controls.playerPos;
    const f = controls.playerFacing;
    const fx = Math.sin(f);
    const fz = Math.cos(f);
    const sx = Math.cos(f);
    const sz = -Math.sin(f);
    const pile = LAYOUT.sweepPile;
    const smooth = (x: number) => x * x * (3 - 2 * x);
    // --- Broom position/rotation + head position per phase ---
    // YXZ order (yaw THEN pitch) so the pitch tilts around the
    // player's lateral axis for every facing.
    let headX = LAYOUT.broom.x;
    let headZ = LAYOUT.broom.z;
    if (b) {
      b.rotation.order = 'YXZ';
      if (cur === 'idle') {
        // Resting FLAT on the ground, not leaning up.
        b.position.set(LAYOUT.broom.x, 0.08, LAYOUT.broom.z);
        b.rotation.set(0, 0.6, 0);
      } else if (cur === 'preparing') {
        // A (1.5s): broom rises smoothly into the player's two hands,
        // angled downward so the straw fan touches the ground in front
        // while the bamboo handle reaches up to the hands.
        const k = smooth(Math.min(1, tt / PREPARE_T));
        const hx = p.x + fx * 0.72 - sx * 0.28;
        const hz = p.z + fz * 0.72 - sz * 0.28;
        b.position.set(
          LAYOUT.broom.x + (hx - LAYOUT.broom.x) * k,
          0.08 + (0.21 - 0.08) * k,
          LAYOUT.broom.z + (hz - LAYOUT.broom.z) * k,
        );
        b.rotation.set(0.72 * k, 0.6 + (f - 0.32 - 0.6) * k, 0.18 * k);
        headX = hx; headZ = hz;
      } else if (cur === 'sweeping') {
        // B (6s, 6 lateral brush strokes of 1s): realistic side-to-side
        // sweeping arc across the front of the player (right-to-left
        // brush stroke 0..0.62 with fan brushing the ground, then lifted
        // return 0.62..1.0 back to the right).
        const strokePhase = (tt % 1) / 1;
        sweepState.strokePhase = strokePhase;
        const strokeIdx = Math.floor(tt / 1);
        const progressReach = (Math.min(strokeIdx, 5) / 5) * 0.55;
        const brushActive = strokePhase < 0.62;
        const arcK = brushActive
          ? smooth(strokePhase / 0.62)
          : 1 - smooth((strokePhase - 0.62) / 0.38);
        // arc goes from -0.52 (right side) to +0.52 (left/pile side)
        const latArc = -0.52 + arcK * 1.04;
        const fwdReach = 0.74 + progressReach * 0.45 + Math.cos(latArc * 1.4) * 0.12;
        headX = p.x + fx * fwdReach + sx * (latArc * 0.68);
        headZ = p.z + fz * fwdReach + sz * (latArc * 0.68);
        const lift = brushActive ? 0.19 : 0.28; // straw fan brushes ground on sweep, lifts on return
        b.position.set(headX - fx * 0.18, lift, headZ - fz * 0.18);
        b.rotation.set(0.72, f + latArc * 0.52, -latArc * 0.32);
        // Push leaves during the active lateral brush stroke
        if (brushActive) {
          for (const l of leavesRef.current) {
            if (l.state !== 'ground' && l.state !== 'sliding') continue;
            if (Math.hypot(l.x - headX, l.z - headZ) > 1.05) continue;
            const dx = pile.x - l.x;
            const dz = pile.z - l.z;
            const d = Math.hypot(dx, dz) || 1;
            l.vx = (dx / d) * 0.9 + (fx * 0.25 + sx * 0.35) + (Math.random() - 0.5) * 0.18;
            l.vz = (dz / d) * 0.9 + (fz * 0.25 + sz * 0.35) + (Math.random() - 0.5) * 0.18;
            l.state = 'sliding';
          }
        }
      } else if (cur === 'gathering') {
        // C (5s): first 1.5s gentle curved strokes gathering around the pile,
        // then leaves slide neatly into the basket at (23.5, 9.0).
        const strokePhase = (tt % 1) / 1;
        sweepState.strokePhase = strokePhase;
        const latArc = Math.sin(strokePhase * Math.PI * 2) * 0.42;
        headX = pile.x - fx * 0.25 + sx * (latArc * 0.55);
        headZ = pile.z - fz * 0.25 + sz * (latArc * 0.55);
        b.position.set(headX - fx * 0.22, 0.20, headZ - fz * 0.22);
        b.rotation.set(0.72, f + latArc * 0.45, -latArc * 0.28);
        if (tt < 1.5) {
          for (const l of leavesRef.current) {
            if (l.state !== 'ground' && l.state !== 'sliding') continue;
            if (Math.hypot(l.x - headX, l.z - headZ) > 1.5) continue;
            const dx = pile.x - l.x;
            const dz = pile.z - l.z;
            const d = Math.hypot(dx, dz) || 1;
            l.vx = (dx / d) * 1.0;
            l.vz = (dz / d) * 1.0;
            l.state = 'sliding';
          }
        } else {
          // Leaves already clustered near the pile count as piled
          // (no movement, no vanish) — collection is pile-first.
          for (const l of leavesRef.current) {
            if (l.state === 'ground' && Math.hypot(l.x - pile.x, l.z - pile.z) < 1.5) l.state = 'piled';
          }
          tl.current.collectTimer += dt;
          if (tl.current.collectTimer >= 0.12) {
            tl.current.collectTimer = 0;
            // Nearest piled leaf to the pile — never a ground leaf.
            const cands = leavesRef.current.filter((l) => l.state === 'piled');
            cands.sort((a, b2) => Math.hypot(a.x - pile.x, a.z - pile.z) - Math.hypot(b2.x - pile.x, b2.z - pile.z));
            const next = cands[0];
            if (next) { next.state = 'collecting'; next.collectT = 0; }
          }
        }
      } else if (cur === 'completed') {
        // D (1.5s): broom back to rest, arms ease back, camera
        // already lerping back to follow (page sets mode follow
        // when it sees 'completed').
        const k = smooth(Math.min(1, tt / COMPLETE_T));
        const hx = p.x + fx * 0.7;
        const hz = p.z + fz * 0.7;
        b.position.set(hx + (LAYOUT.broom.x - hx) * k, 0.2 + (0.08 - 0.2) * k, hz + (LAYOUT.broom.z - hz) * k);
        b.rotation.set(0.5 * (1 - k), f + (0.6 - f) * k, 0);
      }
    }
    sweepState.broomHead = { x: headX, z: headZ };
    // --- Leaf physics (all phases except idle/paused) ---
    if (cur !== 'idle' && !paused) {
      for (const l of leavesRef.current) {
        if (l.state === 'sliding') {
          l.x += l.vx * dt;
          l.z += l.vz * dt;
          const damp = Math.exp(-2.8 * dt);
          l.vx *= damp; l.vz *= damp;
          l.rot += (l.vx + l.vz) * dt * 1.2;
          if (Math.hypot(l.vx, l.vz) < 0.08) {
            l.vx = 0; l.vz = 0;
            l.state = Math.hypot(l.x - pile.x, l.z - pile.z) < 0.7 ? 'piled' : 'ground';
          }
        } else if (l.state === 'collecting') {
          l.collectT += dt / 0.5;
          const k = smooth(Math.min(1, l.collectT));
          // Slide from pile toward the basket; position is
          // interpolated, so the pile visibly shrinks leaf by leaf.
          const sx0 = pile.x + (l.x - pile.x) * (1 - k);
          const sz0 = pile.z + (l.z - pile.z) * (1 - k);
          l.x = sx0 + (23.5 - sx0) * k;
          l.z = sz0 + (9.0 - sz0) * k;
          if (l.collectT >= 1) l.state = 'collected';
        }
      }
    }
    // --- Write leaf meshes (refs only, no React re-render) ---
    leavesRef.current.forEach((l, i) => {
      const m = leafMeshes.current[i];
      if (!m) return;
      m.position.set(l.x, 0.05, l.z);
      m.rotation.y = l.rot;
      m.visible = l.state !== 'collected';
    });
  });

  return (
    <group>
      {/* --- Cây đa Bách Linh (east, moved out to (22, 8) for spaciousness) --- */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[22, 0.03, 8]}>
        <ringGeometry args={[1.3, 2.0, 24]} />
        <meshStandardMaterial color="#b0a894" roughness={0.95} />
      </mesh>
      {/* Stone path: main courtyard -> corridor (x 14.5, z 10) -> Cây đa Bách Linh (22, 8) */}
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={`bpath-s-${i}`} receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[4.6 + i * 2.2, 0.04, 10]}>
          <planeGeometry args={[1.6, 1.1]} />
          <meshStandardMaterial color="#b0a894" roughness={0.95} />
        </mesh>
      ))}
      {[16.4, 18.0, 19.4].map((x, i) => (
        <mesh key={`bpath-e-${i}`} receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.04, 8]}>
          <planeGeometry args={[1.4, 1.1]} />
          <meshStandardMaterial color="#b0a894" roughness={0.95} />
        </mesh>
      ))}
      {/* Biển hiệu "Cây đa Bách Linh" đặt cạnh lối vào sân đa */}
      <TempleSignboard text="Cây đa Bách Linh" position={[18.2, 0, 11.2]} rotationY={-0.25} width={2.1} />

      {/* Banyan (Cây đa Bách Linh) at (22, 0, 8) */}
      <group position={[22, 0, 8]}>
        {/* Main flared trunk + buttress roots */}
        <mesh castShadow position={[0, 1.75, 0]}>
          <cylinderGeometry args={[0.6, 1.15, 3.5, 12]} />
          <meshStandardMaterial color="#5a3a22" roughness={0.9} />
        </mesh>
        {[
          [0.9, 0.3, 0.4, 0.5],
          [-0.9, 0.3, -0.3, -0.5],
          [0.2, 0.3, 1.0, 1.2],
          [-0.3, 0.3, -1.0, -1.2],
        ].map(([x, z, dx, rz], i) => (
          <mesh key={i} castShadow position={[x, 0.35, z]} rotation={[0, 0, rz * 0.4]}>
            <boxGeometry args={[0.35, 0.9, 0.5]} />
            <meshStandardMaterial color="#4a2e1a" roughness={0.9} />
          </mesh>
        ))}
        {/* Thick radiating branches (visible under the canopy) */}
        {[
          [1.6, 4.0, 0, -0.7, 0],
          [-1.6, 4.0, 0, 0.7, 0],
          [0, 4.0, 1.6, 0, 0.7],
          [0, 4.0, -1.6, 0, -0.7],
        ].map(([x, y, z, rx, rz], i) => (
          <mesh key={i} castShadow position={[x, y, z]} rotation={[rx, 0, rz]}>
            <cylinderGeometry args={[0.12, 0.18, 3.2, 8]} />
            <meshStandardMaterial color="#5a3a22" roughness={0.9} />
          </mesh>
        ))}
        {/* Prop trunks: aerial roots that reached the ground */}
        {[
          [3.0, 0.5, 0],
          [1.8, -2.0, 0],
          [2.2, 2.0, 0],
        ].map(([x, z], i) => (
          <mesh key={i} castShadow position={[x, 2.25, z]}>
            <cylinderGeometry args={[0.18, 0.28, 4.5, 10]} />
            <meshStandardMaterial color="#5a3a22" roughness={0.9} />
          </mesh>
        ))}
        {/* Hanging aerial roots (stop mid-air, thin, pale) */}
        {[
          [1.8, 1.2, 1.8],
          [-1.5, 0.8, 1.5],
          [0.5, -1.8, 2.2],
          [-2.0, -1.5, 1.6],
          [2.5, -0.5, 2.0],
        ].map(([x, z, len], i) => (
          <mesh key={i} castShadow position={[x, 4.5 - len / 2, z]}>
            <cylinderGeometry args={[0.04, 0.06, len, 6]} />
            <meshStandardMaterial color="#8a6a44" roughness={0.9} />
          </mesh>
        ))}
        {/* Wide multi-blob canopy, deep green */}
        {[
          [0, 5.2, 0, 3.4],
          [-2.6, 4.6, 0.6, 2.2],
          [2.6, 4.6, -0.6, 2.2],
          [0.6, 6.0, 0.6, 2.0],
          [-1.2, 5.6, -1.2, 1.8],
          [1.8, 5.4, 1.8, 1.8],
          [-3.4, 4.2, -1.0, 1.6],
          [3.4, 4.2, 1.0, 1.6],
          [0, 4.4, -2.4, 1.7],
        ].map(([x, y, z, r], i) => (
          <mesh key={i} castShadow position={[x, y, z]}>
            <icosahedronGeometry args={[r, 1]} />
            <meshStandardMaterial color={i % 3 === 0 ? '#256b1e' : i % 3 === 1 ? '#2f6a24' : '#3a7a2a'} roughness={0.9} flatShading />
          </mesh>
        ))}
      </group>
      {/* Low bench around the south side of the trunk (seat: 22, 11.2) */}
      <mesh receiveShadow castShadow position={[22, 0.2, 11.2]}>
        <boxGeometry args={[3.2, 0.4, 0.7]} />
        <meshStandardMaterial color="#8d8a82" roughness={0.95} />
      </mesh>
      {/* 2 Bồ đoàn Hoa Sen dưới gốc đa Bách Linh (seats: banyan-mat-1 at 20.1,11.2 & banyan-mat-2 at 23.9,11.2) */}
      {[20.1, 23.9].map((mx, mi) => (
        <group key={`banyan-mat-${mi}`} position={[mx, 0, 11.2]}>
          <mesh receiveShadow position={[0, 0.025, 0]}>
            <cylinderGeometry args={[0.42, 0.46, 0.05, 16]} />
            <meshStandardMaterial color="#8a2420" roughness={0.88} />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.30, 0.34, 0.09, 14]} />
            <meshStandardMaterial color="#681818" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.13, 0]}>
            <cylinderGeometry args={[0.20, 0.24, 0.015, 12]} />
            <meshStandardMaterial color="#d4af37" metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {/* Basket for swept leaves */}
      <mesh castShadow position={[23.5, 0.35, 9]}>
        <cylinderGeometry args={[0.45, 0.35, 0.7, 12]} />
        <meshStandardMaterial color="#a8824a" roughness={0.9} />
      </mesh>
      {/* Bamboo broom (chổi tre), long axis along Z: handle
          back (-Z), fan forward (+Z) on the ground. */}
      <group ref={broomRef} position={[LAYOUT.broom.x, 0.08, LAYOUT.broom.z]}>
        {/* Handle (along Z, back) */}
        <mesh castShadow position={[0, 0, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 1.2, 8]} />
          <meshStandardMaterial color="#c8a86a" roughness={0.9} />
        </mesh>
        {/* Bamboo node rings */}
        {[-0.9, -0.3].map((z, i) => (
          <mesh key={i} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.04, 8]} />
            <meshStandardMaterial color="#8a6a44" roughness={0.9} />
          </mesh>
        ))}
        {/* Binding band */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.16, 0.1, 0.12]} />
          <meshStandardMaterial color="#7a1f1f" roughness={0.8} />
        </mesh>
        {/* Fan of straw strands, forward (+Z), touching the ground. */}
        {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((i) => {
          const a = i * 0.13;
          return (
            <mesh
              key={i}
              position={[Math.sin(a) * 0.22, 0, 0.2]}
              rotation={[Math.PI / 2, 0, -a]}
            >
              <cylinderGeometry args={[0.016, 0.02, 0.38, 6]} />
              <meshStandardMaterial color={i % 2 ? '#d8b86a' : '#c8a86a'} roughness={0.9} />
            </mesh>
          );
        })}
      </group>
      {/* Individual sweep leaves (Request C): 24 meshes, created
          once; positions/rotations/visibility updated in useFrame. */}
      {leavesRef.current.map((l, i) => (
        <mesh
          key={i}
          ref={(m) => { leafMeshes.current[i] = m; }}
          position={[l.x, 0.05, l.z]}
          rotation={[0, l.rot, 0]}
        >
          <boxGeometry args={[0.28, 0.02, 0.16]} />
          <meshStandardMaterial color={i % 2 ? '#a8b86a' : '#8a9a4a'} roughness={0.9} />
        </mesh>
      ))}

      {/* --- Roofed corridor --- */}
      {[
        [11.2, 2], [15.8, 2], [11.2, -2], [15.8, -2], [11.2, -6], [15.8, -6],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh castShadow position={[0, 0.125, 0]}>
            <cylinderGeometry args={[0.3, 0.32, 0.25, 10]} />
            <meshStandardMaterial color="#8d8a82" roughness={0.95} />
          </mesh>
          <mesh castShadow position={[0, 2.35, 0]}>
            <cylinderGeometry args={[0.2, 0.22, 4.2, 10]} />
            <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
          </mesh>
        </group>
      ))}
      {/* Longitudinal beams along the top, tying each pillar row */}
      {[11.2, 15.8].map((x, i) => (
        <mesh key={i} castShadow position={[x, 4.45, -2]}>
          <boxGeometry args={[0.22, 0.22, 10.5]} />
          <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
        </mesh>
      ))}
      {/* Cross beams at each pillar pair */}
      {[2, -2, -6].map((z, i) => (
        <mesh key={i} castShadow position={[13.5, 4.45, z]}>
          <boxGeometry args={[5.0, 0.22, 0.22]} />
          <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
        </mesh>
      ))}
      {/* Simple sloped rafters under the roof (east/west, at each pair) */}
      {[2, -2, -6].map((z, i) => (
        <group key={i}>
          <mesh castShadow position={[15.35, 5.15, z]} rotation={[0, 0, -0.314]}>
            <boxGeometry args={[3.9, 0.12, 0.12]} />
            <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
          </mesh>
          <mesh castShadow position={[11.65, 5.15, z]} rotation={[0, 0, 0.314]}>
            <boxGeometry args={[3.9, 0.12, 0.12]} />
            <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
          </mesh>
        </group>
      ))}
      {/* Pitched tile roof, ridge along the corridor (z) */}
      <group position={[13.5, 4.55, -2]} rotation={[0, Math.PI / 2, 0]}>
        <Roof width={10} depth={6} rise={1.2} y={0} tile={roofTile} />
      </group>
      {/* 3 Chairs along the roofed corridor (seats: corridor-chair at 13.5,-2,
          corridor-chair-2 at 13.5,0.5, corridor-chair-3 at 13.5,-4.5) */}
      {[-2, 0.5, -4.5].map((cz, ci) => (
        <group key={`corridor-chair-${ci}`} position={[13.5, 0, cz]}>
          {[-0.25, 0.25].map((dx) => [-0.25, 0.25].map((dz) => (
            <mesh key={`${dx}${dz}`} position={[dx, 0.175, dz]}>
              <boxGeometry args={[0.12, 0.35, 0.12]} />
              <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
            </mesh>
          )))}
          {[0.25, -0.25].map((dz, i) => (
            <mesh key={i} position={[0, 0.12, dz]}>
              <boxGeometry args={[0.5, 0.08, 0.08]} />
              <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
            </mesh>
          ))}
          <mesh castShadow position={[0, 0.35, 0]}>
            <boxGeometry args={[0.6, 0.08, 0.6]} />
            <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
          </mesh>
          <mesh castShadow position={[0, 0.75, 0.3]}>
            <boxGeometry args={[0.6, 0.8, 0.07]} />
            <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* --- Garden wall (lime) with an open gate at (20.0, -10) ---
          Placed along the west boundary of Vườn Lộc Uyển (x 20.0),
          well east of the corridor walkway (x 14.5) and main hall,
          giving generous breathing room between architectures. */}
      {[
        [20.0, -12.85, 3.3],
        [20.0, -7.8, 2.0],
      ].map(([x, z, len], i) => (
        <mesh key={i} castShadow position={[x, 0.9, z]}>
          <boxGeometry args={[0.4, 1.8, len]} />
          <meshStandardMaterial color="#e8d9b8" roughness={0.9} />
        </mesh>
      ))}
      {/* Gate posts + lintel + mini tiled roof (the gate itself
          stays open at z -11.2 .. -8.8). */}
      {[-11.2, -8.8].map((z, i) => (
        <mesh key={i} castShadow position={[20.0, 1.4, z]}>
          <boxGeometry args={[0.5, 2.8, 0.5]} />
          <meshStandardMaterial color="#8d8a82" roughness={0.95} />
        </mesh>
      ))}
      <mesh castShadow position={[20.0, 2.95, -10]}>
        <boxGeometry args={[0.6, 0.34, 3.2]} />
        <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[20.0, 3.25, -10]}>
        <boxGeometry args={[0.9, 0.25, 3.6]} />
        <meshStandardMaterial color="#a8432a" roughness={0.85} />
      </mesh>
      {/* Hoành phi tên cổng "Vườn Lộc Uyển" gắn trên xà cổng (2 mặt Tây & Đông) */}
      <TextSign text="Vườn Lộc Uyển" width={1.8} height={0.34} position={[19.68, 2.95, -10]} rotationY={-Math.PI / 2} />
      <TextSign text="Vườn Lộc Uyển" width={1.8} height={0.34} position={[20.32, 2.95, -10]} rotationY={Math.PI / 2} />
      {/* Biển hiệu đứng "Vườn Lộc Uyển" đặt cạnh lối vào cổng vườn */}
      <TempleSignboard text="Vườn Lộc Uyển" position={[18.4, 0, -7.6]} rotationY={-0.35} width={2.0} />

      {/* --- Vườn Lộc Uyển (Back garden): vegetable beds, water jar, dipper ---
          Green lawn [7.6, 13.2] at (27.2, 0.03, -18.4) -> x 23.4..31.0,
          z -25.0..-11.8, at y 0.03 with a stone border curb (y 0.045).
          Trimmed so it NEVER overlaps the z -10 stone path (y 0.04)
          and stays 2.0m clear of the tea house platform (x 33.0..40.0). */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[27.2, 0.03, -18.4]}>
        <planeGeometry args={[7.6, 13.2]} />
        <meshStandardMaterial color="#7a9a5a" roughness={1} />
      </mesh>
      {/* Stone edging curb around the garden lawn */}
      {[
        [27.2, -11.8, 7.8, 0.22],
        [27.2, -25.0, 7.8, 0.22],
        [23.4, -18.4, 0.22, 13.2],
        [31.0, -18.4, 0.22, 13.2],
      ].map(([x, z, w, d], i) => (
        <mesh key={`gcurb-${i}`} receiveShadow position={[x, 0.045, z]}>
          <boxGeometry args={[w, 0.05, d]} />
          <meshStandardMaterial color="#8d8a82" roughness={0.95} />
        </mesh>
      ))}
      {[0, 1, 2].map((i) => (
        <group key={i} position={[27.5, 0, -22 + i * 2]}>
          <mesh receiveShadow position={[0, 0.12, 0]}>
            <boxGeometry args={[5.0, 0.24, 1.2]} />
            <meshStandardMaterial color={soilWet ? '#3a2a1a' : '#6a4a2a'} roughness={1} />
          </mesh>
          {[-2.0, -0.7, 0.7, 2.0].map((lx, j) => (
            <mesh key={j} castShadow position={[lx, 0.35, 0]}>
              <icosahedronGeometry args={[0.22, 1]} />
              <meshStandardMaterial color="#3f7a2e" roughness={0.9} flatShading />
            </mesh>
          ))}
        </group>
      ))}
      {/* Water jar + water surface at (25.0, -12.8) */}
      <mesh castShadow position={[25.0, 0.45, -12.8]}>
        <cylinderGeometry args={[0.5, 0.4, 0.9, 14]} />
        <meshStandardMaterial color="#a8432a" roughness={0.85} />
      </mesh>
      <mesh position={[25.0, 0.92, -12.8]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.42, 14]} />
        <meshStandardMaterial color="#7aa8c8" roughness={0.3} />
      </mesh>
      {/* Dipper: rests at the jar only when the player is not holding it */}
      {!carryingWater && !waterStream && (
        <group position={[25.6, 0.7, -12.8]} rotation={[0, 0, 0.6]}>
          <mesh castShadow position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.6, 8]} />
            <meshStandardMaterial color="#a8824a" roughness={0.9} />
          </mesh>
          <mesh castShadow position={[0, 0, 0]}>
            <sphereGeometry args={[0.16, 12, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
            <meshStandardMaterial color="#a8824a" roughness={0.9} />
          </mesh>
        </group>
      )}
      {waterStream && (
        <group position={[27.5, 0.26, -20]}>
          {/* Gentle water splashes & wet shimmer spreading across the vegetable rows */}
          {[-1.4, -0.5, 0.4, 1.3].map((dx, idx) => (
            <mesh key={idx} rotation={[-Math.PI / 2, 0, 0]} position={[dx, 0.02, (idx % 2 === 0 ? -0.15 : 0.15)]}>
              <ringGeometry args={[0.12, 0.26, 16]} />
              <meshBasicMaterial color="#9ad0ec" transparent opacity={0.65} depthWrite={false} />
            </mesh>
          ))}
        </group>
      )}

      {/* --- Tea house: moved further east to (36.5, -18.5) so Vườn Lộc Uyển
          and Nhà trà sit as distinct, airy pavilions with 5.5m separation.
          Stone platform 7.0x6.5 (top 0.45, two south steps), 4 wood
          columns on stone bases, beams, pitched tile roof. */}
      <mesh receiveShadow position={[36.5, 0.225, -18.5]}>
        <boxGeometry args={[7.0, 0.45, 6.5]} />
        <meshStandardMaterial color="#8d8a82" roughness={0.95} />
      </mesh>
      {/* South steps: 0.15 then 0.30, then platform 0.45 */}
      <mesh receiveShadow position={[36.5, 0.225, -15.0]}>
        <boxGeometry args={[4.0, 0.15, 0.5]} />
        <meshStandardMaterial color="#8d8a82" roughness={0.95} />
      </mesh>
      <mesh receiveShadow position={[36.5, 0.075, -14.5]}>
        <boxGeometry args={[4.0, 0.15, 0.5]} />
        <meshStandardMaterial color="#a39e92" roughness={0.95} />
      </mesh>
      {[
        [33.6, -21.1], [39.4, -21.1], [33.6, -15.9], [39.4, -15.9],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh castShadow position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.3, 0.34, 0.3, 10]} />
            <meshStandardMaterial color="#8d8a82" roughness={0.95} />
          </mesh>
          <mesh castShadow position={[0, 2.25, 0]}>
            <cylinderGeometry args={[0.18, 0.2, 3.0, 10]} />
            <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
          </mesh>
        </group>
      ))}
      {[-21.1, -15.9].map((z, i) => (
        <mesh key={i} castShadow position={[36.5, 3.85, z]}>
          <boxGeometry args={[6.4, 0.2, 0.2]} />
          <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
        </mesh>
      ))}
      {[33.6, 39.4].map((x, i) => (
        <mesh key={i} castShadow position={[x, 3.85, -18.5]}>
          <boxGeometry args={[0.2, 0.2, 5.8]} />
          <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
        </mesh>
      ))}
      <group position={[36.5, 3.95, -18.5]}>
        <Roof width={7.0} depth={6.5} rise={1.2} y={0} z={0} tile={roofTile} />
      </group>
      {/* Low tea table + legs at (36.5, -18.5) */}
      <mesh castShadow position={[36.5, 0.98, -18.5]}>
        <boxGeometry args={[1.7, 0.08, 1.0]} />
        <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
      </mesh>
      {[-0.72, 0.72].map((dx) => [-0.4, 0.4].map((dz) => (
        <mesh key={`${dx}${dz}`} castShadow position={[36.5 + dx, 0.695, -18.5 + dz]}>
          <boxGeometry args={[0.1, 0.49, 0.1]} />
          <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
        </mesh>
      )))}
      {/* Tea set: tray, teapot, 3 cups */}
      <mesh castShadow position={[36.3, 1.035, -18.6]}>
        <boxGeometry args={[0.8, 0.03, 0.45]} />
        <meshStandardMaterial color="#a8824a" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[36.15, 1.13, -18.6]} scale={[1, 0.8, 1]}>
        <sphereGeometry args={[0.11, 14, 14]} />
        <meshStandardMaterial color="#d8e8f0" roughness={0.3} />
      </mesh>
      <mesh castShadow position={[36.15, 1.22, -18.6]}>
        <cylinderGeometry args={[0.05, 0.05, 0.03, 10]} />
        <meshStandardMaterial color="#d8e8f0" roughness={0.3} />
      </mesh>
      <mesh castShadow position={[36.28, 1.15, -18.6]} rotation={[0, 0, -0.7]}>
        <cylinderGeometry args={[0.015, 0.02, 0.16, 8]} />
        <meshStandardMaterial color="#d8e8f0" roughness={0.3} />
      </mesh>
      <mesh castShadow position={[36.02, 1.13, -18.6]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.06, 0.015, 8, 16]} />
        <meshStandardMaterial color="#d8e8f0" roughness={0.3} />
      </mesh>
      {[
        [36.55, -18.45, 1.08], [36.65, -18.65, 1.08], [36.95, -18.35, 1.05],
      ].map(([x, z, y], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.045, 0.035, 0.06, 10]} />
            <meshStandardMaterial color="#d8e8f0" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.038, 0.038, 0.01, 10]} />
            <meshStandardMaterial color="#6a4a2a" roughness={0.6} />
          </mesh>
        </group>
      ))}
      {/* Flower vase on the table corner */}
      <mesh castShadow position={[37.0, 1.11, -18.75]}>
        <cylinderGeometry args={[0.05, 0.07, 0.18, 10]} />
        <meshStandardMaterial color="#a8432a" roughness={0.7} />
      </mesh>
      {[-0.2, 0, 0.2].map((a, i) => (
        <group key={i} position={[37.0, 1.28, -18.75]} rotation={[a, 0, a]}>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.25, 6]} />
            <meshStandardMaterial color="#3a7a2a" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <icosahedronGeometry args={[0.05, 0]} />
            <meshStandardMaterial color={['#e8a8b8', '#f5f0e0', '#e8c86a'][i]} roughness={0.8} />
          </mesh>
        </group>
      ))}
      {/* Low chair = the tea seat, EAST of the table facing WEST at (38.3, -18.5) */}
      <group position={[38.3, 0.45, -18.5]}>
        {[-0.33, 0.33].map((dx) => [-0.33, 0.33].map((dz) => (
          <mesh key={`${dx}${dz}`} castShadow position={[dx, 0.21, dz]}>
            <boxGeometry args={[0.11, 0.42, 0.11]} />
            <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
          </mesh>
        )))}
        <mesh castShadow position={[0, 0.46, 0]}>
          <boxGeometry args={[0.8, 0.08, 0.8]} />
          <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
        </mesh>
        <mesh castShadow position={[0.4, 1.0, 0]}>
          <boxGeometry args={[0.08, 1.05, 0.8]} />
          <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
        </mesh>
      </group>
      {/* Cushions */}
      {[
        [36.5, -20.0, '#a8824a'], [36.5, -17.0, '#7a1f1f'],
        [34.8, -15.7, '#a8824a'], [37.0, -15.7, '#7a1f1f'],
      ].map(([x, z, c], i) => (
        <mesh key={i} castShadow position={[x as number, 0.53, z as number]}>
          <boxGeometry args={[0.75, 0.16, 0.75]} />
          <meshStandardMaterial color={c as string} roughness={0.9} />
        </mesh>
      ))}
      {/* Side table with two books */}
      <mesh castShadow position={[34.0, 0.98, -20.9]}>
        <boxGeometry args={[0.8, 0.06, 0.55]} />
        <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
      </mesh>
      {[-0.15, 0.15].map((dx) => [-0.1, 0.1].map((dz) => (
        <mesh key={`${dx}${dz}`} castShadow position={[34.0 + dx, 0.7, -20.9 + dz]}>
          <boxGeometry args={[0.07, 0.5, 0.07]} />
          <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
        </mesh>
      )))}
      <mesh castShadow position={[34.0, 1.03, -20.9]} rotation={[0, 0.1, 0]}>
        <boxGeometry args={[0.35, 0.04, 0.25]} />
        <meshStandardMaterial color="#7a1f1f" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[34.0, 1.07, -20.9]} rotation={[0, -0.15, 0]}>
        <boxGeometry args={[0.32, 0.035, 0.22]} />
        <meshStandardMaterial color="#2a4a6a" roughness={0.8} />
      </mesh>
      {/* Small stone lantern north-west of the tea house */}
      <group position={[33.0, 0, -23.5]}>
        <mesh castShadow position={[0, 0.075, 0]}>
          <boxGeometry args={[0.32, 0.15, 0.32]} />
          <meshStandardMaterial color="#8d8a82" roughness={0.95} />
        </mesh>
        <mesh castShadow position={[0, 0.3, 0]}>
          <boxGeometry args={[0.14, 0.3, 0.14]} />
          <meshStandardMaterial color="#8d8a82" roughness={0.95} />
        </mesh>
        <mesh castShadow position={[0, 0.5, 0]}>
          <boxGeometry args={[0.36, 0.1, 0.36]} />
          <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
        </mesh>
        <mesh castShadow position={[0, 0.58, 0]}>
          <boxGeometry args={[0.4, 0.08, 0.4]} />
          <meshStandardMaterial color="#a8432a" roughness={0.85} />
        </mesh>
      </group>
      {/* Pots flanking the south steps */}
      {[[33.8, -14.6], [39.2, -14.6]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh castShadow position={[0, 0.175, 0]}>
            <cylinderGeometry args={[0.28, 0.22, 0.35, 10]} />
            <meshStandardMaterial color="#a8432a" roughness={0.85} />
          </mesh>
          <mesh castShadow position={[0, 0.55, 0]}>
            <icosahedronGeometry args={[0.35, 1]} />
            <meshStandardMaterial color="#3a7a2a" roughness={0.9} flatShading />
          </mesh>
        </group>
      ))}

      {/* --- Garden & Tea path: ALL STRAIGHT axis-aligned lines on the
          brick courtyard (y 0.04) — N-S at x 14.5 from z 8 to z -10,
          then E-W at z -10 through the garden gate (20.0, -10) to the
          garden turn (26.5, -10) and tea porch turn (36.5, -10),
          then N-S at x 36.5 (z -12, -14) up to the tea steps. */}
      {[
        [14.5, 8], [14.5, 6], [14.5, 4],
        [14.5, 2], [14.5, 0], [14.5, -2], [14.5, -4], [14.5, -6], [14.5, -8], [14.5, -10],
        [16.4, -10], [18.2, -10], [20.0, -10], [22.0, -10], [24.2, -10], [26.5, -10],
        [28.5, -10], [30.5, -10], [32.5, -10], [34.5, -10], [36.5, -10],
        [36.5, -12], [36.5, -14],
      ].map(([x, z], i) => (
        <mesh key={i} receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.04, z]}>
          <planeGeometry args={[1.5, 1.5]} />
          <meshStandardMaterial color="#b0a894" roughness={0.95} />
        </mesh>
      ))}
      {/* Low shrubs (clear of paths and walls) */}
      {[[11.5, -7.5], [12.0, -13.5], [31.6, -13.2]].map(([x, z], i) => (
        <mesh key={i} castShadow position={[x, 0.4, z]}>
          <icosahedronGeometry args={[0.4, 1]} />
          <meshStandardMaterial color="#3a7a2a" roughness={0.9} flatShading />
        </mesh>
      ))}
      {/* Flower bed inside the south-east corner of the garden lawn */}
      <mesh receiveShadow position={[29.6, 0.09, -15.2]}>
        <boxGeometry args={[0.9, 0.15, 0.6]} />
        <meshStandardMaterial color="#6a4a2a" roughness={1} />
      </mesh>
      {[[29.4, -15.2], [29.6, -15.0], [29.8, -15.3], [29.6, -15.4]].map(([x, z], i) => (
        <group key={i} position={[x, 0.16, z]}>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.2, 6]} />
            <meshStandardMaterial color="#3a7a2a" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <icosahedronGeometry args={[0.06, 0]} />
            <meshStandardMaterial color={['#e8a8b8', '#f5f0e0', '#e8c86a', '#e8a8b8'][i]} roughness={0.8} />
          </mesh>
        </group>
      ))}
      {/* Stone lanterns flanking the garden entrance turn at x 26.5 */}
      {[[25.0, -10.8], [28.0, -10.8]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh castShadow position={[0, 0.1, 0]}>
            <boxGeometry args={[0.36, 0.2, 0.36]} />
            <meshStandardMaterial color="#8d8a82" roughness={0.95} />
          </mesh>
          <mesh castShadow position={[0, 0.45, 0]}>
            <boxGeometry args={[0.16, 0.5, 0.16]} />
            <meshStandardMaterial color="#8d8a82" roughness={0.95} />
          </mesh>
          <mesh castShadow position={[0, 0.78, 0]}>
            <boxGeometry args={[0.4, 0.12, 0.4]} />
            <meshStandardMaterial color="#8d8a82" roughness={0.95} />
          </mesh>
          <mesh castShadow position={[0, 0.88, 0]}>
            <boxGeometry args={[0.46, 0.1, 0.46]} />
            <meshStandardMaterial color="#a8432a" roughness={0.85} />
          </mesh>
        </group>
      ))}

      {/* --- North path behind the hall (z -32) --- */}
      {Array.from({ length: 21 }).map((_, i) => (
        <mesh key={i} receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[-24 + i * 2.4, 0.04, -32]}>
          <planeGeometry args={[2.0, 1.1]} />
          <meshStandardMaterial color="#b0a894" roughness={0.95} />
        </mesh>
      ))}
      {/* --- West stone paths: connecting main courtyard -> Tâm Liên Hồ (-16, 3)
          -> Gác chuông (-22, -9) -> Vườn Lâm Tỳ Ni (-28, -24) --- */}
      {[-21.5, -19.1, -16.7, -14.3, -11.9, -9.5, -7.1, -4.7].map((x, i) => (
        <mesh key={`wpath-ew-${i}`} receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.04, -5]}>
          <planeGeometry args={[2.1, 1.4]} />
          <meshStandardMaterial color="#b0a894" roughness={0.95} />
        </mesh>
      ))}
      {[-2.8, -0.6, 1.6, 3.8, 6.0, 8.2, 10.0].map((z, i) => (
        <mesh key={`wpath-ns-${i}`} receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[-11.1, 0.04, z]}>
          <planeGeometry args={[1.4, 1.8]} />
          <meshStandardMaterial color="#b0a894" roughness={0.95} />
        </mesh>
      ))}
      {[-9.0, -6.8, -4.6].map((x, i) => (
        <mesh key={`wpath-s-${i}`} receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.04, 10]}>
          <planeGeometry args={[1.8, 1.2]} />
          <meshStandardMaterial color="#b0a894" roughness={0.95} />
        </mesh>
      ))}

      {/* Biển hiệu "Tâm Liên Hồ" đặt tại bờ đông nam hồ sen */}
      <TempleSignboard text="Tâm Liên Hồ" position={[-13.2, 0, 7.8]} rotationY={0.25} width={1.9} />

      {/* Bell tower at (-22, 0, -9.0) */}
      <BellTower ringSeq={bellRingSeq} />

      {/* --- Lake bank steps at Tâm Liên Hồ (seat: -11.7, 4.7, facing west to water) ---
          Two abutting stone tiers (upper seat x -11.55 w 0.7; lower step x -12.1 w 0.4). */}
      <mesh receiveShadow castShadow position={[-11.55, 0.2, 4.7]}>
        <boxGeometry args={[0.7, 0.4, 1.1]} />
        <meshStandardMaterial color="#8d8a82" roughness={0.95} />
      </mesh>
      <mesh receiveShadow castShadow position={[-12.1, 0.1, 4.7]}>
        <boxGeometry args={[0.4, 0.2, 1.0]} />
        <meshStandardMaterial color="#a39e92" roughness={0.95} />
      </mesh>
      {/* 2 Bồ đoàn Hoa Sen bên bờ Tâm Liên Hồ (seats: lake-mat-1 at -11.7,0.4 & lake-mat-2 at -12.2,6.2) */}
      {[
        [-11.7, 0.4],
        [-12.2, 6.2],
      ].map(([lx, lz], li) => (
        <group key={`lake-mat-${li}`} position={[lx, 0, lz]}>
          <mesh receiveShadow position={[0, 0.025, 0]}>
            <cylinderGeometry args={[0.42, 0.46, 0.05, 16]} />
            <meshStandardMaterial color="#8a2420" roughness={0.88} />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.30, 0.34, 0.09, 14]} />
            <meshStandardMaterial color="#681818" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.13, 0]}>
            <cylinderGeometry args={[0.20, 0.24, 0.015, 12]} />
            <meshStandardMaterial color="#d4af37" metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
      ))}

      {/* Biển hiệu "Bảo Tháp Báo Ân" trước Bảo Tháp 7 tầng */}
      <TempleSignboard text="Bảo Tháp Báo Ân" position={[31.2, 0, -0.2]} rotationY={-0.65} width={2.05} />

      {/* Giá treo thẻ ước nguyện Bồ Đề cạnh Cây đa Bách Linh tại (18.5, 0, 5.2) */}
      <WishingPlaqueRack />
    </group>
  );
});

export default Grounds;

/**
 * Giá Treo Thẻ Ước Nguyện Bồ Đề (Wooden Wishing Plaque Rack) tại (18.5, 0, 5.2):
 * Hoạt động truyền thống tại các ngôi chùa Việt Nam — Phật tử viết lời cầu bình an,
 * cầu sức khỏe cha mẹ hoặc cầu học hành / thi đỗ HSK lên thẻ gỗ đỏ thếp vàng và treo
 * lên giá gỗ dưới bóng cây đa Bách Linh.
 */
function WishingPlaqueRack() {
  const plaquesGroup = useRef<THREE.Group>(null);
  const customGroup = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (plaquesGroup.current) {
      plaquesGroup.current.children.forEach((child, idx) => {
        child.rotation.x = Math.sin(t * 1.9 + idx * 0.7) * 0.08;
        child.rotation.z = Math.cos(t * 1.4 + idx * 0.5) * 0.04;
      });
    }
    if (customGroup.current) {
      customGroup.current.children.forEach((child, idx) => {
        child.visible = idx < wishingRackState.customCount;
        if (child.visible) {
          child.rotation.x = Math.sin(t * 2.3 + idx) * 0.12;
        }
      });
    }
  });

  return (
    <group position={[LAYOUT.wishingRack.x, 0, LAYOUT.wishingRack.z]} rotation={[0, -0.25, 0]}>
      {/* 2 trụ gỗ lim trên chân tảng đá xanh */}
      {[-1.15, 1.15].map((px, i) => (
        <group key={`wr-post-${i}`} position={[px, 0, 0]}>
          <mesh receiveShadow castShadow position={[0, 0.12, 0]}>
            <boxGeometry args={[0.28, 0.24, 0.28]} />
            <meshStandardMaterial color="#8d8a82" roughness={0.95} />
          </mesh>
          <mesh castShadow position={[0, 1.18, 0]}>
            <cylinderGeometry args={[0.075, 0.085, 2.15, 12]} />
            <meshStandardMaterial color="#5c2818" roughness={0.78} />
          </mesh>
        </group>
      ))}
      {/* Mái ngói đỏ che mưa nắng trên đỉnh giá treo */}
      <mesh castShadow position={[0, 2.22, 0]}>
        <boxGeometry args={[2.75, 0.12, 0.36]} />
        <meshStandardMaterial color="#4a2615" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 2.34, 0]}>
        <boxGeometry args={[2.95, 0.10, 0.52]} />
        <meshStandardMaterial color="#a83b24" roughness={0.78} />
      </mesh>
      {/* Biển nhỏ trên nóc giá: THẺ NGUYỆN ƯỚC */}
      <TextSign text="Thẻ Nguyện Ước" width={1.65} height={0.32} position={[0, 2.02, 0.06]} />

      {/* 3 thanh xà ngang treo thẻ gỗ */}
      {[1.68, 1.32, 0.96].map((ry, ri) => (
        <mesh key={`wr-bar-${ri}`} position={[0, ry, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.022, 0.022, 2.25, 8]} />
          <meshStandardMaterial color="#c9a227" metalness={0.55} roughness={0.4} />
        </mesh>
      ))}

      {/* Các thẻ gỗ cầu an đỏ-vàng đung đưa trong gió */}
      <group ref={plaquesGroup}>
        {[1.68, 1.32, 0.96].flatMap((ry, rowIdx) =>
          [-0.88, -0.62, -0.36, -0.10, 0.16, 0.42, 0.68, 0.92].map((rx, colIdx) => {
            const isGold = (rowIdx + colIdx) % 3 === 0;
            return (
              <group key={`plaque-${rowIdx}-${colIdx}`} position={[rx, ry - 0.02, 0]}>
                {/* Dây treo đỏ */}
                <mesh position={[0, -0.04, 0]}>
                  <cylinderGeometry args={[0.005, 0.005, 0.08, 6]} />
                  <meshStandardMaterial color="#d62828" />
                </mesh>
                {/* Thân thẻ gỗ */}
                <mesh position={[0, -0.14, 0]}>
                  <boxGeometry args={[0.14, 0.21, 0.018]} />
                  <meshStandardMaterial
                    color={isGold ? '#e9c46a' : '#b82921'}
                    roughness={0.55}
                    metalness={isGold ? 0.35 : 0.1}
                  />
                </mesh>
                {/* Viền vàng & tua rua dưới đáy thẻ */}
                <mesh position={[0, -0.14, 0.011]}>
                  <planeGeometry args={[0.09, 0.15]} />
                  <meshStandardMaterial color="#ffd166" metalness={0.5} roughness={0.35} />
                </mesh>
              </group>
            );
          }),
        )}
      </group>

      {/* Thẻ gỗ vàng phát sáng mới khi chính người chơi vừa treo thẻ ước nguyện */}
      <group ref={customGroup}>
        {[-0.75, -0.48, -0.22, 0.04, 0.30, 0.56, 0.80].map((rx, idx) => (
          <group key={`custom-plaque-${idx}`} position={[rx, 1.66, 0.035]} visible={false}>
            <mesh position={[0, -0.14, 0]}>
              <boxGeometry args={[0.16, 0.23, 0.022]} />
              <meshStandardMaterial
                color="#ffd75e"
                emissive="#ff9f1c"
                emissiveIntensity={0.55}
                metalness={0.75}
                roughness={0.25}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
