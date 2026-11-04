'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { controls, LAYOUT, sweepState } from './controls';
import BellTower from './BellTower';
import { Roof } from './Temple';
import { useTextures } from './textures';

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
    const x = 14.8 + rng() * 2.2; // 14.8..17.0, in front of the sweep spot
    const z = 10.8 + rng() * 1.6; // 10.8..12.4, south of the banyan trunk
    // Keep out of the trunk (16,10) r 1.3, the basket (17.5,11) r 0.9,
    // and away from other leaves (min 0.35m apart).
    if (Math.hypot(x - 16, z - 10) < 1.3) continue;
    if (Math.hypot(x - 17.5, z - 11) < 0.9) continue;
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
export default function Grounds({ soilWet, waterStream, carryingWater, bellRingSeq }: Props) {
  const { roofTile } = useTextures();
  const broomRef = useRef<THREE.Group>(null);
  const leavesRef = useRef<Leaf[]>(makeLeaves());
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
        // A (1.5s): broom travels gently from rest to the hand,
        // fan down to the ground — no snap, no sudden camera move
        // (the camera lerps to sweep mode in the same window).
        const k = smooth(Math.min(1, tt / PREPARE_T));
        const hx = p.x + fx * 0.7;
        const hz = p.z + fz * 0.7;
        b.position.set(
          LAYOUT.broom.x + (hx - LAYOUT.broom.x) * k,
          0.08 + (0.2 - 0.08) * k,
          LAYOUT.broom.z + (hz - LAYOUT.broom.z) * k,
        );
        b.rotation.set(0.5 * k, 0.6 + (f - 0.6) * k, 0);
        headX = hx; headZ = hz;
      } else if (cur === 'sweeping') {
        // B (6s, 6 strokes of 1s): triangular push/return. Phase
        // 0..0.5 pushes forward (leaves move), 0.5..1 returns
        // (leaves stay — they are NOT dragged back). Stroke centre
        // walks east from 15.8 to 16.6 so the swept area clears
        // gradually, west to east, toward the pile.
        const strokePhase = (tt % 1) / 1;
        sweepState.strokePhase = strokePhase;
        const strokeIdx = Math.floor(tt / 1);
        const cx = 15.4 + (Math.min(strokeIdx, 5) / 5) * 1.2;
        const cz = 11.5 + Math.sin(strokeIdx * 1.3) * 0.3;
        const pushT = strokePhase < 0.5 ? strokePhase * 2 : (1 - strokePhase) * 2;
        const off = -0.4 + pushT * 0.8;
        const sway = Math.sin(strokePhase * Math.PI * 2) * 0.12;
        headX = cx + fx * off + sx * sway;
        headZ = cz + fz * off + sz * sway;
        const lift = strokePhase < 0.5 ? 0.2 : 0.26; // head touches ground on push
        b.position.set(headX - fx * 0.4, lift, headZ - fz * 0.4);
        b.rotation.set(0.5, f, 0);
        // Push: only leaves near the head, only during the push
        // half-stroke, sliding toward the pile then decelerating.
        if (strokePhase < 0.5) {
          for (const l of leavesRef.current) {
            if (l.state !== 'ground' && l.state !== 'sliding') continue;
            if (Math.hypot(l.x - headX, l.z - headZ) > 0.9) continue;
            const dx = pile.x - l.x;
            const dz = pile.z - l.z;
            const d = Math.hypot(dx, dz) || 1;
            l.vx = (dx / d) * 0.85 + fx * 0.35 + (Math.random() - 0.5) * 0.2;
            l.vz = (dz / d) * 0.85 + fz * 0.35 + (Math.random() - 0.5) * 0.2;
            l.state = 'sliding';
          }
        }
      } else if (cur === 'gathering') {
        // C (4s): first 1.5s final strokes around the pile, then
        // 2.5s pile shrinking — one leaf at a time slides to the
        // basket (17.5,11), staggered, never a mass vanish.
        sweepState.strokePhase = (tt % 1) / 1;
        const ang = tt * Math.PI; // slow circle around the pile
        headX = pile.x + Math.cos(ang) * 0.6;
        headZ = pile.z + Math.sin(ang) * 0.6;
        b.position.set(headX - fx * 0.4, 0.2, headZ - fz * 0.4);
        b.rotation.set(0.5, f, 0);
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
          l.x = sx0 + (17.5 - sx0) * k;
          l.z = sz0 + (11 - sz0) * k;
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
      {/* --- Banyan courtyard (east): NO separate ground plane
          anymore (site plan v2, 2026-11-04) — the old 12x12 brown
          plane overlapped the brick courtyard (x 10..13) and left
          a grass strip (z 3..4) to the corridor floor: the "3
          patches" the user photographed. The banyan now stands on
          the single courtyard, with a flat stone ring around the
          trunk for definition (no collider, walkable). --- */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[16, 0.03, 10]}>
        <ringGeometry args={[1.3, 2.0, 24]} />
        <meshStandardMaterial color="#b0a894" roughness={0.95} />
      </mesh>
      {/* Stone path: main courtyard -> banyan (5 stones, ending at
          x 13.8 so the last stone stays 0.2m clear of the r 2.0
          banyan stone ring at x 14.0..18.0 — zero overlap). */}
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i} receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[4.6 + i * 2.1, 0.04, 10]}>
          <planeGeometry args={[1.6, 1.1]} />
          <meshStandardMaterial color="#b0a894" roughness={0.95} />
        </mesh>
      ))}
      {/* Banyan (cây đa) — unmistakably a banyan, unlike the other
          trees in the scene (single trunk + one round crown):
          a thick flared trunk with buttress roots, THICK branches
          radiating out, a very wide multi-blob canopy, PROP trunks
          grown from aerial roots (3, reaching the ground), plus
          HANGING aerial roots that stop mid-air. Deep green, not
          the lighter green of the garden trees. */}
      <group position={[16, 0, 10]}>
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
        {/* Prop trunks: aerial roots that reached the ground (moved off the west walkway) */}
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
      {/* Low bench around the south side of the trunk (seat: 16, 13.2) */}
      <mesh receiveShadow castShadow position={[16, 0.2, 13.2]}>
        <boxGeometry args={[3.2, 0.4, 0.7]} />
        <meshStandardMaterial color="#8d8a82" roughness={0.95} />
      </mesh>
      {/* Basket for swept leaves */}
      <mesh castShadow position={[17.5, 0.35, 11]}>
        <cylinderGeometry args={[0.45, 0.35, 0.7, 12]} />
        <meshStandardMaterial color="#a8824a" roughness={0.9} />
      </mesh>
      {/* Bamboo broom (chổi tre), long axis along Z: handle
          back (-Z), fan forward (+Z) on the ground. Fixed
          2026-11-03: the old Y-axis broom read upside-down
          (fan on top) from the handle side, and swept behind
          the player instead of in front. Resting it lies FLAT;
          sweeping it tilts fan-down in front (see useFrame). */}
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
        <mesh castShadow position={[0, 0, 0]}>
          <boxGeometry args={[0.16, 0.1, 0.12]} />
          <meshStandardMaterial color="#7a1f1f" roughness={0.8} />
        </mesh>
        {/* Fan of straw strands, forward (+Z), touching the ground.
            Fan spread comes from strand positions + slight Z
            tilts: a Y-cylinder rotated X=PI/2 points along Z, and
            a yaw before that rotation would not change its axis. */}
        {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((i) => {
          const a = i * 0.13;
          return (
            <mesh
              key={i}
              castShadow
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
          once; positions/rotations/visibility updated in useFrame.
          The basket at (17.5,11) is where collected leaves go. */}
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

      {/* --- Roofed corridor (Request D, 2026-11-04): rebuilt
          higher, wider, open. Old: 1.4m clear between pillar inner
          faces, flat red slab at 3.35m, head-pressed, camera clipped
          the slab. New: pillars at x 11.2/15.8 (4.6m apart, ~3.4m
          clear walkway), 4.2m tall with stone bases, longitudinal +
          cross beams at 4.45m, simple sloped rafters, and a REAL
          pitched tile roof (Temple Roof, ridge along the corridor,
          eaves 4.55m, ridge ~5.75m) instead of a flat slab. The
          corridor stays open-sided, so the third-person camera
          passes under the roof through the open sides/ends. Chair
          kept at the centre (13.5,-2) with legs added (it floated
          before); walkway is ~2m clear on either side of it.
          Site plan v2: NO separate floor plane — the old 6.2x10
          brown slab was the same material as the courtyard and its
          edge cut across the banyan approach. The corridor now
          stands on the single courtyard ground. */}
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
      {/* Pitched tile roof, ridge along the corridor (z): Roof's
          ridge runs along its width, so rotate Y 90 deg — width
          10 becomes the corridor length, depth 6 the width. */}
      <group position={[13.5, 4.55, -2]} rotation={[0, Math.PI / 2, 0]}>
        <Roof width={10} depth={6} rise={1.2} y={0} tile={roofTile} />
      </group>
      {/* Chair at the corridor centre, facing west to the hall roof
          (seat kept at 13.5,-2; legs added — it floated before;
          legs thickened + stretchers 2026-11-04: the thin dark
          legs vanished against the dark floor on phones and the
          seat read as floating) */}
      <group position={[13.5, 0, -2]}>
        {[-0.25, 0.25].map((dx) => [-0.25, 0.25].map((dz) => (
          <mesh key={`${dx}${dz}`} castShadow position={[dx, 0.175, dz]}>
            <boxGeometry args={[0.12, 0.35, 0.12]} />
            <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
          </mesh>
        )))}
        {[0.25, -0.25].map((dz, i) => (
          <mesh key={i} castShadow position={[0, 0.12, dz]}>
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

      {/* --- Garden wall (lime) with an open gate at (16.0, -10) ---
          Placed along the west boundary of the back garden (x 16.0),
          EAST of the corridor walkway (x 14.5), so walking north along
          the corridor and turning east at z -10 leads straight through
          the garden gate into the garden and tea house. */}
      {[
        [16.0, -12.85, 3.3],
        [16.0, -7.8, 2.0],
      ].map(([x, z, len], i) => (
        <mesh key={i} castShadow position={[x, 0.9, z]}>
          <boxGeometry args={[0.4, 1.8, len]} />
          <meshStandardMaterial color="#e8d9b8" roughness={0.9} />
        </mesh>
      ))}
      {/* Gate posts + lintel + mini tiled roof (the gate itself
          stays open at z -11.2 .. -8.8). */}
      {[-11.2, -8.8].map((z, i) => (
        <mesh key={i} castShadow position={[16.0, 1.4, z]}>
          <boxGeometry args={[0.5, 2.8, 0.5]} />
          <meshStandardMaterial color="#8d8a82" roughness={0.95} />
        </mesh>
      ))}
      <mesh castShadow position={[16.0, 2.95, -10]}>
        <boxGeometry args={[0.6, 0.3, 3.2]} />
        <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[16.0, 3.25, -10]}>
        <boxGeometry args={[0.9, 0.25, 3.6]} />
        <meshStandardMaterial color="#a8432a" roughness={0.85} />
      </mesh>

      {/* --- Back garden: vegetable beds, water jar, dipper ---
          Green lawn [6.4, 13.2] at (20.6, 0.03, -18.4) -> x 17.4..23.8,
          z -25.0..-11.8, at y 0.03 with a stone border curb (y 0.05).
          Trimmed so it NEVER overlaps the z -10 stone path (y 0.04)
          and NEVER runs under the tea house platform (x 24.0..31.0). */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[20.6, 0.03, -18.4]}>
        <planeGeometry args={[6.4, 13.2]} />
        <meshStandardMaterial color="#7a9a5a" roughness={1} />
      </mesh>
      {/* Stone edging curb around the garden lawn */}
      {[
        [20.6, -11.8, 6.6, 0.22],
        [20.6, -25.0, 6.6, 0.22],
        [17.4, -18.4, 0.22, 13.2],
        [23.8, -18.4, 0.22, 13.2],
      ].map(([x, z, w, d], i) => (
        <mesh key={`gcurb-${i}`} receiveShadow position={[x, 0.045, z]}>
          <boxGeometry args={[w, 0.05, d]} />
          <meshStandardMaterial color="#8d8a82" roughness={0.95} />
        </mesh>
      ))}
      {[0, 1, 2].map((i) => (
        <group key={i} position={[21, 0, -22 + i * 2]}>
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
      {/* Water jar + water surface (v2: south-west of the beds,
          clear of the E-W path at z -10 and the x 20 leg) */}
      <mesh castShadow position={[18.5, 0.45, -12.8]}>
        <cylinderGeometry args={[0.5, 0.4, 0.9, 14]} />
        <meshStandardMaterial color="#a8432a" roughness={0.85} />
      </mesh>
      <mesh position={[18.5, 0.92, -12.8]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.42, 14]} />
        <meshStandardMaterial color="#7aa8c8" roughness={0.3} />
      </mesh>
      {/* Dipper: at the jar, or tilted over the bed while watering */}
      {!carryingWater && !waterStream && (
        <group position={[19.1, 0.7, -12.8]} rotation={[0, 0, 0.6]}>
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
        <group position={[21, 0, -20]}>
          <mesh position={[0, 0.9, 0]} rotation={[0, 0, 0.9]}>
            <cylinderGeometry args={[0.03, 0.03, 0.6, 8]} />
            <meshStandardMaterial color="#a8824a" roughness={0.9} />
          </mesh>
          <mesh position={[0.25, 0.45, 0]}>
            <cylinderGeometry args={[0.04, 0.06, 0.8, 8]} />
            <meshStandardMaterial color="#7aa8c8" roughness={0.2} transparent opacity={0.8} />
          </mesh>
        </group>
      )}

      {/* --- Tea house (site plan v2, 2026-11-04): MOVED east +
          widened so the tea cluster no longer overlaps the beds.
          Stone platform 7.0x6.5 (top 0.45, two south steps), 4 wood
          columns on stone bases, beams, REAL pitched tile roof
          (eaves 3.95m, ridge ~5.15m), open on all sides. Gaps
          around the table: west 1.04m / east 1.04m / north 1.09m /
          south 1.59m — all passable for the 0.76m player (the old
          5.5-wide platform left 0.44m, which is why the far side
          was unreachable). Platform height is in floorYAt. */}
      <mesh receiveShadow position={[27.5, 0.225, -18.5]}>
        <boxGeometry args={[7.0, 0.45, 6.5]} />
        <meshStandardMaterial color="#8d8a82" roughness={0.95} />
      </mesh>
      {/* South steps: 0.15 then 0.30, then platform 0.45 */}
      <mesh receiveShadow position={[27.5, 0.225, -15.0]}>
        <boxGeometry args={[4.0, 0.15, 0.5]} />
        <meshStandardMaterial color="#8d8a82" roughness={0.95} />
      </mesh>
      <mesh receiveShadow position={[27.5, 0.075, -14.5]}>
        <boxGeometry args={[4.0, 0.15, 0.5]} />
        <meshStandardMaterial color="#a39e92" roughness={0.95} />
      </mesh>
      {[
        [24.6, -21.1], [30.4, -21.1], [24.6, -15.9], [30.4, -15.9],
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
      {/* Beams: x-beams at each pillar row, z-beams at each column.
          (The old code put BOTH z-beams at x 18.5, stacked on each
          other — fixed here: each beam uses its own x.) */}
      {[-21.1, -15.9].map((z, i) => (
        <mesh key={i} castShadow position={[27.5, 3.85, z]}>
          <boxGeometry args={[6.4, 0.2, 0.2]} />
          <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
        </mesh>
      ))}
      {[24.6, 30.4].map((x, i) => (
        <mesh key={i} castShadow position={[x, 3.85, -18.5]}>
          <boxGeometry args={[0.2, 0.2, 5.8]} />
          <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
        </mesh>
      ))}
      {/* Tea roof: Roof has no x prop (group [0,y,z]), so it MUST
          be wrapped in an outer group at the tea house position —
          the unwrapped version rendered at x=0, inside the hall,
          leaving the tea house roofless (caught by the D test). */}
      <group position={[27.5, 3.95, -18.5]}>
        <Roof width={7.0} depth={6.5} rise={1.2} y={0} z={0} tile={roofTile} />
      </group>
      {/* Low tea table + legs (platform top 0.45, table top 1.02 —
          sized to avatar scale, as in the morning pass) */}
      <mesh castShadow position={[27.5, 0.98, -18.5]}>
        <boxGeometry args={[1.7, 0.08, 1.0]} />
        <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
      </mesh>
      {[-0.72, 0.72].map((dx) => [-0.4, 0.4].map((dz) => (
        <mesh key={`${dx}${dz}`} castShadow position={[27.5 + dx, 0.695, -18.5 + dz]}>
          <boxGeometry args={[0.1, 0.49, 0.1]} />
          <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
        </mesh>
      )))}
      {/* Tea set: tray, teapot (body + lid + spout + handle), 3 cups */}
      <mesh castShadow position={[27.3, 1.035, -18.6]}>
        <boxGeometry args={[0.8, 0.03, 0.45]} />
        <meshStandardMaterial color="#a8824a" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[27.15, 1.13, -18.6]} scale={[1, 0.8, 1]}>
        <sphereGeometry args={[0.11, 14, 14]} />
        <meshStandardMaterial color="#d8e8f0" roughness={0.3} />
      </mesh>
      <mesh castShadow position={[27.15, 1.22, -18.6]}>
        <cylinderGeometry args={[0.05, 0.05, 0.03, 10]} />
        <meshStandardMaterial color="#d8e8f0" roughness={0.3} />
      </mesh>
      <mesh castShadow position={[27.28, 1.15, -18.6]} rotation={[0, 0, -0.7]}>
        <cylinderGeometry args={[0.015, 0.02, 0.16, 8]} />
        <meshStandardMaterial color="#d8e8f0" roughness={0.3} />
      </mesh>
      <mesh castShadow position={[27.02, 1.13, -18.6]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.06, 0.015, 8, 16]} />
        <meshStandardMaterial color="#d8e8f0" roughness={0.3} />
      </mesh>
      {[
        [27.55, -18.45, 1.08], [27.65, -18.65, 1.08], [27.95, -18.35, 1.05],
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
      <mesh castShadow position={[28.0, 1.11, -18.75]}>
        <cylinderGeometry args={[0.05, 0.07, 0.18, 10]} />
        <meshStandardMaterial color="#a8432a" roughness={0.7} />
      </mesh>
      {[-0.2, 0, 0.2].map((a, i) => (
        <group key={i} position={[28.0, 1.28, -18.75]} rotation={[a, 0, a]}>
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
      {/* Low chair = the tea seat, now EAST of the table facing
          WEST (site plan v2): the sitter has the table in front
          and the vegetable rows beyond it. The old south chair
          overlapped the table (seated body reached z -20.58 vs
          the table edge -20.5); the new seat clears the table's
          east edge by 0.57m, and its back panel is on the EAST
          side (behind a west-facing sitter). Group base on the
          platform top 0.45, seat top 0.95, back to ~1.98. */}
      <group position={[29.3, 0.45, -18.5]}>
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
      {/* Cushions: north + south of the table, 2 on the south
          porch strip — all clear of the east-gap route (x 29.3)
          and of the table collider. */}
      {[
        [27.5, -20.0, '#a8824a'], [27.5, -17.0, '#7a1f1f'],
        [25.8, -15.7, '#a8824a'], [28.0, -15.7, '#7a1f1f'],
      ].map(([x, z, c], i) => (
        <mesh key={i} castShadow position={[x as number, 0.53, z as number]}>
          <boxGeometry args={[0.75, 0.16, 0.75]} />
          <meshStandardMaterial color={c as string} roughness={0.9} />
        </mesh>
      ))}
      {/* Side table with two books (north-west interior, clear of
          the north gap passage and of the NW pillar base) */}
      <mesh castShadow position={[25.0, 0.98, -20.9]}>
        <boxGeometry args={[0.8, 0.06, 0.55]} />
        <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
      </mesh>
      {[-0.15, 0.15].map((dx) => [-0.1, 0.1].map((dz) => (
        <mesh key={`${dx}${dz}`} castShadow position={[25.0 + dx, 0.7, -20.9 + dz]}>
          <boxGeometry args={[0.07, 0.5, 0.07]} />
          <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
        </mesh>
      )))}
      <mesh castShadow position={[25.0, 1.03, -20.9]} rotation={[0, 0.1, 0]}>
        <boxGeometry args={[0.35, 0.04, 0.25]} />
        <meshStandardMaterial color="#7a1f1f" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[25.0, 1.07, -20.9]} rotation={[0, -0.15, 0]}>
        <boxGeometry args={[0.32, 0.035, 0.22]} />
        <meshStandardMaterial color="#2a4a6a" roughness={0.8} />
      </mesh>
      {/* Small stone lantern (no light, just form) on the lawn
          north-east of the tea house — NOT on the platform (the
          old NW-corner spot collided with the NW pillar base). */}
      <group position={[24.0, 0, -23.5]}>
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
      {/* Pots flanking the south steps (on the lawn, outside the
          platform, clear of the step width x 25.5..29.5) */}
      {[[24.8, -14.6], [30.2, -14.6]].map(([x, z], i) => (
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

      {/* --- Garden path: ALL STRAIGHT axis-aligned lines on the
          brick courtyard (y 0.04) — one straight N-S line at x 14.5
          from the banyan (z 8) through the corridor to z -10, then
          straight E-W at z -10 through the garden gate (16.0, -10)
          to the garden turn (20, -10) and tea porch turn (27.5, -10),
          then N-S at x 27.5 (z -12, -14) up to the tea steps. */}
      {[
        [14.5, 8], [14.5, 6], [14.5, 4],
        [14.5, 2], [14.5, 0], [14.5, -2], [14.5, -4], [14.5, -6], [14.5, -8], [14.5, -10],
        [16.2, -10], [18, -10], [20, -10], [22, -10], [24, -10], [26, -10],
        [27.5, -10], [27.5, -12], [27.5, -14],
      ].map(([x, z], i) => (
        <mesh key={i} receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.04, z]}>
          <planeGeometry args={[1.5, 1.5]} />
          <meshStandardMaterial color="#b0a894" roughness={0.95} />
        </mesh>
      ))}
      {/* Low shrubs (clear of paths and walls) */}
      {[[11.5, -7.5], [12.0, -13.5], [22.5, -13.2]].map(([x, z], i) => (
        <mesh key={i} castShadow position={[x, 0.4, z]}>
          <icosahedronGeometry args={[0.4, 1]} />
          <meshStandardMaterial color="#3a7a2a" roughness={0.9} flatShading />
        </mesh>
      ))}
      {/* Flower bed inside the south-east corner of the garden lawn */}
      <mesh receiveShadow position={[22.2, 0.09, -15.2]}>
        <boxGeometry args={[0.9, 0.15, 0.6]} />
        <meshStandardMaterial color="#6a4a2a" roughness={1} />
      </mesh>
      {[[22.0, -15.2], [22.2, -15.0], [22.4, -15.3], [22.2, -15.4]].map(([x, z], i) => (
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
      {/* Stone lanterns flanking the garden entrance (the x 20
          turn onto the lawn; 1.5m clear of the stone line) */}
      {[[18.5, -10.8], [21.5, -10.8]].map(([x, z], i) => (
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

      {/* --- North path behind the hall (garden -> lake) --- */}
      {Array.from({ length: 14 }).map((_, i) => (
        <mesh key={i} receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[-16 + i * 2.4, 0.04, -30]}>
          <planeGeometry args={[2.0, 1.1]} />
          <meshStandardMaterial color="#b0a894" roughness={0.95} />
        </mesh>
      ))}
      {/* Path around the pond, WIDENED and on dry land (fixed
          2026-11-03): the old straight path at x -11 ran
          straight THROUGH the pond water (pond spans x -12.4..
          -4.6 at z 0..3). Now an L around the pond's north and
          east sides: east-west along z -5 (north of the pond,
          bank edge -2.9) then south along x -3.5 (east of the
          pond, bank edge -4.1), widened to 1.4m, to the lake
          bank. Site plan v2: the west stone now ABUTS the
          bell<->Lumbini stone line at x -11.6 (shared edge, no
          overlap — the old -13 stone sat on top of it), and the
          corner stone at (-3.5,-5) is dropped (the E-W stone
          already paves the corner). */}
      {[-10.5, -8.3, -6.1, -3.9].map((x, i) => (
        <mesh key={i} receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.04, -5]}>
          <planeGeometry args={[2.2, 1.4]} />
          <meshStandardMaterial color="#b0a894" roughness={0.95} />
        </mesh>
      ))}
      {[-2.8, -0.6, 1.6].map((z, i) => (
        <mesh key={i} receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[-3.5, 0.04, z]}>
          <planeGeometry args={[1.4, 2.2]} />
          <meshStandardMaterial color="#b0a894" roughness={0.95} />
        </mesh>
      ))}

      {/* Bell tower (Request B): Vietnamese tower + Lathe bronze
          bell + hung mallet, in BellTower.tsx. Old flat slab + cone
          bell removed 2026-11-03. */}
      <BellTower ringSeq={bellRingSeq} />

      {/* --- Lake bank steps (seat: -4.2, 3.2, facing west to water) ---
          Two abutting stone tiers (upper seat x -4.05 w 0.7 -> -4.4..-3.7;
          lower step x -4.6 w 0.4 -> -4.8..-4.4), no overlap. */}
      <mesh receiveShadow castShadow position={[-4.05, 0.2, 3.2]}>
        <boxGeometry args={[0.7, 0.4, 1.1]} />
        <meshStandardMaterial color="#8d8a82" roughness={0.95} />
      </mesh>
      <mesh receiveShadow castShadow position={[-4.6, 0.1, 3.2]}>
        <boxGeometry args={[0.4, 0.2, 1.0]} />
        <meshStandardMaterial color="#a39e92" roughness={0.95} />
      </mesh>

      {/* Roadside signs removed at the user's request (2026-11-03):
          no posts, direction signs or info boards stand on the
          paths anymore. Wayfinding lives in the 2D map only.
          The gate sign, the CHÍNH ĐIỆN facade sign and the side
          altar name boards stay, as they belong to buildings. */}
    </group>
  );
}
