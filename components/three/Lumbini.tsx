'use client';

import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { bathState, LAYOUT } from './controls';
import TextSign from './TextSign';

/**
 * Vườn Lâm Tỳ Ni – Lễ đài Tắm Phật (Request E, 2026-11-04).
 * Behind the bell tower, left of the main hall, in the empty
 * north-west quadrant — no bounds expansion, nothing moved.
 * Group origin = pavilion centre (-17, 0, -20); local coords below
 * are (worldX + 17, worldZ + 20).
 *
 * Architecture (copies the proven BellTower 4-sided roof, scaled):
 * - stone platform 5x5m, top y 0.4, + 2 south steps (tops 0.27/0.13,
 *   matching controls.ts floorYAt — same lesson as the tea house)
 * - 4 square wood columns on stone bases, beams at y 3.5
 * - 4-sided sloped tile roof: eaves 6.5m square at y 3.5, apex cap
 *   at y 4.8, gold finial ~5.0m — NEVER a flat red plane
 * - bathing basin (r 0.6, real wall thickness, water surface,
 *   floating petals) with a lotus pedestal rising from it
 * - STATUE SLOT IS EMPTY: no placeholder statue is rendered here.
 *   The lotus pedestal waits for a properly licensed infant
 *   Prince Siddhartha model (left hand up, right hand down);
 *   deploying a poor script statue would fail the quality gate.
 * - ladle on a rest stand east of the basin; the bath timeline
 *   (this file's useFrame, like Grounds owns the sweep) moves it
 *   rest -> dip -> ready -> pour (x3) -> rest, 24s total
 * - water stream (thin cylinder, pour window only) + 2 expanding
 *   ripple rings on the basin water; no per-frame geometry
 * - garden: 3 trees, shrubs, flower bushes, lotus pots, rocks,
 *   2 stone lamps (form only, no light), path stones bell->yard
 * - festival mode (prop): 5-colour flags + a Vesak sign + extra
 *   lotus flowers; NO festival music (no licensed source, and the
 *   spec makes music optional and non-autoplay)
 *
 * The ritual is personal/local in phase 1 (like the sweep): the
 * page sends the whitelisted 'praying' state, so remote players
 * see a praying figure at Lumbini, not the ladle detail.
 */

const PRAY_T = 2;
const SCOOP_T = 4;
const POUR_T = 5;
const FINISH_T = 3;
// pray 2 + scoop 4 + 3x5 + finish 3 = 24s, inside the 20-35s spec.

const REST = { x: 0.8, y: 0.58, z: 0.5 }; // ladle rest (local)
const DIP = { x: 0.15, y: 0.92, z: 0.5 }; // ladle dipped in the basin
const READY = { x: 0.35, y: 1.35, z: 0.9 }; // ladle ready, south of basin
const POUR = { x: 0, y: 2.0, z: 0.5 }; // ladle above the statue

const smooth = (k: number) => k * k * (3 - 2 * k);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerp3 = (a: typeof REST, b: typeof REST, k: number) => ({
  x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: lerp(a.z, b.z, k),
});

export default function Lumbini({ festivalOn }: { festivalOn: boolean }) {
  const ladleRef = useRef<THREE.Group>(null);
  const streamRef = useRef<THREE.Mesh>(null);
  const ripple1 = useRef<THREE.Mesh>(null);
  const ripple2 = useRef<THREE.Mesh>(null);
  const tl = useRef({ phase: 'idle' as string, t: 0, poursDone: 0 });

  // Test hook only (not user-visible): Playwright reads the bath
  // phase / pour round to verify the full ritual cycle.
  (globalThis as unknown as { __lumbini?: typeof bathState }).__lumbini = bathState;

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const phase = bathState.phase;
    // Phase change: (re)start the timeline clock. Cancelling to
    // idle (stop button / leaving) returns the ladle to its exact
    // rest spot and hides the stream — no stuck animation.
    if (tl.current.phase !== phase) {
      if (phase !== 'idle') tl.current.t = 0;
      if (phase === 'pour') tl.current.poursDone = 0;
      tl.current.phase = phase;
      if (phase === 'idle') {
        const l = ladleRef.current;
        if (l) { l.position.set(REST.x, REST.y, REST.z); l.rotation.set(0, 0, 0); }
        if (streamRef.current) streamRef.current.visible = false;
        if (ripple1.current) ripple1.current.visible = false;
        if (ripple2.current) ripple2.current.visible = false;
        bathState.pourRound = 0;
        bathState.pourT = 0;
        bathState.progress = 0;
      }
    }
    if (phase === 'idle' || phase === 'done') return;
    tl.current.t += dt;
    const tt = tl.current.t;
    const l = ladleRef.current;
    if (!l) return;
    let pos = REST;
    let rot: [number, number, number] = [0, 0, 0];
    let stream = false;
    let ripple = 0;
    if (phase === 'pray') {
      bathState.progress = (tt / PRAY_T) * 0.1;
      if (tt >= PRAY_T) { bathState.phase = 'scoop'; tl.current.t = 0; }
    } else if (phase === 'scoop') {
      bathState.progress = 0.1 + (tt / SCOOP_T) * 0.15;
      if (tt < 1.5) {
        const k = smooth(tt / 1.5);
        pos = lerp3(REST, DIP, k);
        rot = [lerp(0, -0.5, k), 0, 0];
      } else if (tt < 2.5) {
        pos = { ...DIP, y: DIP.y + Math.sin((tt - 1.5) * Math.PI * 2) * 0.02 };
        rot = [-0.5, 0, 0];
      } else {
        const k = smooth((tt - 2.5) / 1.5);
        pos = lerp3(DIP, READY, k);
        rot = [lerp(-0.5, -0.2, k), 0, 0];
      }
      if (tt >= SCOOP_T) { bathState.phase = 'pour'; bathState.pourRound = 1; tl.current.t = 0; }
    } else if (phase === 'pour') {
      const round = bathState.pourRound || 1;
      bathState.progress = 0.25 + ((round - 1) + tt / POUR_T) * 0.2;
      bathState.pourT = Math.min(1, tt / POUR_T);
      if (tt < 1) {
        const k = smooth(tt);
        pos = lerp3(READY, POUR, k);
        rot = [lerp(-0.2, -0.3, k), 0, lerp(0, -0.7, k)];
      } else if (tt < 4) {
        pos = POUR;
        rot = [-0.3, 0, -0.7];
        stream = true;
        ripple = (tt - 1) / 3;
      } else {
        const k = smooth((tt - 4) / 1);
        pos = lerp3(POUR, READY, k);
        rot = [lerp(-0.3, -0.2, k), 0, lerp(-0.7, 0, k)];
      }
      if (tt >= POUR_T) {
        if (round < 3) { bathState.pourRound = round + 1; tl.current.t = 0; }
        else { bathState.phase = 'finish'; bathState.pourRound = 0; bathState.pourT = 0; tl.current.t = 0; }
      }
    } else if (phase === 'finish') {
      bathState.progress = 0.85 + (tt / FINISH_T) * 0.15;
      if (tt < 1) {
        const k = smooth(tt);
        pos = lerp3(READY, REST, k);
        rot = [lerp(-0.2, 0, k), 0, 0];
      } else {
        pos = REST;
      }
      if (tt >= FINISH_T) { bathState.phase = 'done'; bathState.progress = 1; }
    }
    l.position.set(pos.x, pos.y, pos.z);
    l.rotation.set(rot[0], rot[1], rot[2]);
    if (streamRef.current) streamRef.current.visible = stream;
    // Ripples: two rings expanding on the basin water while the
    // stream runs, then fading — the basin, not the statue, ripples.
    const r1 = ripple1.current;
    const r2 = ripple2.current;
    if (r1 && r2) {
      if (stream) {
        const k = ripple % 1;
        r1.visible = true;
        r1.scale.setScalar(0.3 + k * 0.7);
        (r1.material as THREE.MeshStandardMaterial).opacity = 0.7 * (1 - k);
        const k2 = (ripple + 0.5) % 1;
        r2.visible = true;
        r2.scale.setScalar(0.3 + k2 * 0.7);
        (r2.material as THREE.MeshStandardMaterial).opacity = 0.7 * (1 - k2);
      } else {
        r1.visible = false;
        r2.visible = false;
      }
    }
  });

  const stone = '#8d8a82';
  const stoneLight = '#a39e92';
  const wood = '#4a2e1a';
  const roofRed = '#a8432a';
  const roofDark = '#7a2f1e';
  const bronze = '#A77B37';
  const leaf = '#3f7a2e';
  const leafLight = '#5a9440';

  // Roof panels (scaled BellTower pattern): eaves 6.5m square at
  // y 3.5, apex cap 0.6m at y 4.8, slope angle 0.415 rad.
  const roofPanels: Array<{ pos: [number, number, number]; rot: [number, number, number] }> = [
    { pos: [0, 4.15, 1.775], rot: [0.415, 0, 0] },
    { pos: [0, 4.15, -1.775], rot: [-0.415, 0, 0] },
    { pos: [1.775, 4.15, 0], rot: [0, 0, -0.415] },
    { pos: [-1.775, 4.15, 0], rot: [0, 0, 0.415] },
  ];

  return (
    <group position={[LAYOUT.lumbini.x, 0, LAYOUT.lumbini.z]}>
      {/* Yard ground: dry earth + stone path, bell -> yard entrance */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 1]}>
        <planeGeometry args={[12, 10]} />
        <meshStandardMaterial color="#b0a184" roughness={1} />
      </mesh>
      {/* Stone path (1.8m stones): bell standing area -> west ->
          north -> yard entrance -> pavilion steps. Local coords:
          world = local + (-17, -20). All stones sit clear of the
          bell platform's expanded collider (x -15.08) and of the
          garden trees. */}
      {[
        [3, 14.5], [1.5, 13], [1.5, 11], [1, 9], [0, 7], [0, 5], [0, 3.2],
      ].map(([x, z], i) => (
        <mesh key={i} receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.04, z]}>
          <planeGeometry args={[1.8, 1.8]} />
          <meshStandardMaterial color={stoneLight} roughness={0.95} />
        </mesh>
      ))}

      {/* Pavilion platform + base slab + south steps */}
      <mesh receiveShadow position={[0, 0.2, 0]}>
        <boxGeometry args={[5, 0.4, 5]} />
        <meshStandardMaterial color={stone} roughness={0.95} />
      </mesh>
      <mesh receiveShadow position={[0, 0.075, 0]}>
        <boxGeometry args={[5.3, 0.15, 5.3]} />
        <meshStandardMaterial color={stoneLight} roughness={0.95} />
      </mesh>
      <mesh receiveShadow position={[0, 0.135, 2.75]}>
        <boxGeometry args={[2, 0.27, 0.5]} />
        <meshStandardMaterial color={stone} roughness={0.95} />
      </mesh>
      <mesh receiveShadow position={[0, 0.065, 3.25]}>
        <boxGeometry args={[2, 0.13, 0.5]} />
        <meshStandardMaterial color={stone} roughness={0.95} />
      </mesh>

      {/* 4 square wood columns on stone bases (corners inset 0.4m) */}
      {[[-2.1, -2.1], [2.1, -2.1], [-2.1, 2.1], [2.1, 2.1]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh castShadow position={[0, 0.575, 0]}>
            <boxGeometry args={[0.36, 0.35, 0.36]} />
            <meshStandardMaterial color={stone} roughness={0.95} />
          </mesh>
          <mesh castShadow position={[0, 2.05, 0]}>
            <boxGeometry args={[0.22, 2.6, 0.22]} />
            <meshStandardMaterial color={wood} roughness={0.8} />
          </mesh>
        </group>
      ))}
      {/* Beams at y 3.5 + centre cross beams */}
      <mesh castShadow position={[0, 3.5, 2.1]}>
        <boxGeometry args={[4.6, 0.18, 0.18]} />
        <meshStandardMaterial color={wood} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 3.5, -2.1]}>
        <boxGeometry args={[4.6, 0.18, 0.18]} />
        <meshStandardMaterial color={wood} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[2.1, 3.5, 0]}>
        <boxGeometry args={[0.18, 0.18, 4.6]} />
        <meshStandardMaterial color={wood} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[-2.1, 3.5, 0]}>
        <boxGeometry args={[0.18, 0.18, 4.6]} />
        <meshStandardMaterial color={wood} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 3.42, 0]}>
        <boxGeometry args={[4.6, 0.15, 0.15]} />
        <meshStandardMaterial color={wood} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 3.42, 0]}>
        <boxGeometry args={[0.15, 0.15, 4.6]} />
        <meshStandardMaterial color={wood} roughness={0.8} />
      </mesh>

      {/* 4-sided sloped tile roof */}
      {roofPanels.map((p, i) => (
        <mesh key={i} castShadow position={p.pos} rotation={p.rot}>
          <boxGeometry args={[6.5, 0.12, 3.2]} />
          <meshStandardMaterial color={roofRed} roughness={0.85} />
        </mesh>
      ))}
      {/* Tile rows on the south + north slopes */}
      {[2.6, 1.8, 1.0].map((z, i) => (
        <mesh key={`t${i}`} position={[0, 3.5 + (3.25 - z) * 0.441, z]} rotation={[0.415, 0, 0]}>
          <boxGeometry args={[6.4, 0.03, 0.08]} />
          <meshStandardMaterial color={roofDark} roughness={0.9} />
        </mesh>
      ))}
      {[2.6, 1.8, 1.0].map((z, i) => (
        <mesh key={`tn${i}`} position={[0, 3.5 + (3.25 - z) * 0.441, -z]} rotation={[-0.415, 0, 0]}>
          <boxGeometry args={[6.4, 0.03, 0.08]} />
          <meshStandardMaterial color={roofDark} roughness={0.9} />
        </mesh>
      ))}
      {/* Eaves boards + restrained upturned corners */}
      <mesh castShadow position={[0, 3.52, 3.25]}>
        <boxGeometry args={[6.5, 0.1, 0.12]} />
        <meshStandardMaterial color={wood} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 3.52, -3.25]}>
        <boxGeometry args={[6.5, 0.1, 0.12]} />
        <meshStandardMaterial color={wood} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[3.25, 3.52, 0]}>
        <boxGeometry args={[0.12, 0.1, 6.5]} />
        <meshStandardMaterial color={wood} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[-3.25, 3.52, 0]}>
        <boxGeometry args={[0.12, 0.1, 6.5]} />
        <meshStandardMaterial color={wood} roughness={0.8} />
      </mesh>
      {[[-3.25, 3.25], [3.25, 3.25], [-3.25, -3.25], [3.25, -3.25]].map(([x, z], i) => (
        <mesh key={`c${i}`} castShadow position={[x, 3.65, z]} rotation={[z > 0 ? -0.35 : 0.35, 0, x > 0 ? 0.35 : -0.35]}>
          <boxGeometry args={[0.35, 0.08, 0.35]} />
          <meshStandardMaterial color={roofDark} roughness={0.85} />
        </mesh>
      ))}
      {/* Apex cap + gold finial */}
      <mesh castShadow position={[0, 4.8, 0]}>
        <boxGeometry args={[0.6, 0.18, 0.6]} />
        <meshStandardMaterial color={roofDark} roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0, 4.95, 0]}>
        <sphereGeometry args={[0.12, 16, 12]} />
        <meshStandardMaterial color="#c9a227" roughness={0.4} metalness={0.5} />
      </mesh>

      {/* Bathing basin: outer wall with real thickness, inner bowl,
          water surface, decorative rim, floating petals. The basin
          sits on the platform (top 0.4); rim at y 0.9. */}
      <group position={[0, 0, 0.5]}>
        <mesh castShadow position={[0, 0.65, 0]}>
          <cylinderGeometry args={[0.62, 0.55, 0.5, 32]} />
          <meshStandardMaterial color={bronze} roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0.62, 0]}>
          <cylinderGeometry args={[0.5, 0.45, 0.42, 32]} />
          <meshStandardMaterial color="#6e5220" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.82, 0]}>
          <cylinderGeometry args={[0.48, 0.48, 0.02, 32]} />
          <meshStandardMaterial color="#7fb3c8" roughness={0.15} metalness={0.1} transparent opacity={0.9} />
        </mesh>
        <mesh position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.6, 0.04, 12, 32]} />
          <meshStandardMaterial color={bronze} roughness={0.5} metalness={0.4} />
        </mesh>
        {/* Floating petals on the water */}
        {[[0.2, 0.1], [-0.25, -0.15], [0.05, -0.3]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.84, z]} rotation={[-Math.PI / 2, 0, i]}>
            <circleGeometry args={[0.05, 8]} />
            <meshStandardMaterial color="#e8a0b4" roughness={0.7} />
          </mesh>
        ))}
        {/* Ripple rings (animated in useFrame, hidden otherwise) */}
        <mesh ref={ripple1} position={[0, 0.84, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <ringGeometry args={[0.42, 0.48, 32]} />
          <meshStandardMaterial color="#dff0f5" roughness={0.2} transparent opacity={0.7} />
        </mesh>
        <mesh ref={ripple2} position={[0, 0.84, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <ringGeometry args={[0.42, 0.48, 32]} />
          <meshStandardMaterial color="#dff0f5" roughness={0.2} transparent opacity={0.7} />
        </mesh>
        {/* Lotus pedestal rising from the water: stem + 2 staggered
            rings of curved petals + centre disc. The statue slot
            sits on the centre disc at local y 1.12 — EMPTY for now
            (see the file header: no placeholder statue). */}
        <mesh castShadow position={[0, 0.95, 0]}>
          <cylinderGeometry args={[0.07, 0.09, 0.3, 16]} />
          <meshStandardMaterial color={bronze} roughness={0.5} metalness={0.4} />
        </mesh>
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <mesh key={`p1-${i}`} position={[Math.sin(a) * 0.16, 1.08, Math.cos(a) * 0.16]} rotation={[Math.cos(a) * 0.5, a, -Math.sin(a) * 0.5]}>
              <sphereGeometry args={[0.09, 12, 8]} />
              <meshStandardMaterial color="#c98a9e" roughness={0.6} />
            </mesh>
          );
        })}
        {Array.from({ length: 8 }).map((_, i) => {
          const a = ((i + 0.5) / 8) * Math.PI * 2;
          return (
            <mesh key={`p2-${i}`} position={[Math.sin(a) * 0.11, 1.1, Math.cos(a) * 0.11]} rotation={[Math.cos(a) * 0.35, a, -Math.sin(a) * 0.35]}>
              <sphereGeometry args={[0.07, 12, 8]} />
              <meshStandardMaterial color="#e8a0b4" roughness={0.6} />
            </mesh>
          );
        })}
        <mesh position={[0, 1.12, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.03, 24]} />
          <meshStandardMaterial color={bronze} roughness={0.5} metalness={0.4} />
        </mesh>
        {/* Water stream: ladle mouth -> statue top, pour window only.
            Vertical, so it never starts mid-air or passes through
            the statue: it ends just above the pedestal (y 1.15). */}
        <mesh ref={streamRef} position={[0, 1.55, 0]} visible={false}>
          <cylinderGeometry args={[0.012, 0.016, 0.8, 8]} />
          <meshStandardMaterial color="#a8d4e6" roughness={0.1} transparent opacity={0.85} />
        </mesh>
      </group>

      {/* Ladle + rest stand (east of the basin, on the platform) */}
      <mesh receiveShadow position={[0.8, 0.43, 0.5]}>
        <boxGeometry args={[0.34, 0.06, 0.14]} />
        <meshStandardMaterial color={wood} roughness={0.8} />
      </mesh>
      <group ref={ladleRef} position={[REST.x, REST.y, REST.z]}>
        <mesh castShadow position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.45, 10]} />
          <meshStandardMaterial color={wood} roughness={0.7} />
        </mesh>
        <mesh castShadow position={[0.26, -0.02, 0]}>
          <cylinderGeometry args={[0.07, 0.05, 0.08, 16]} />
          <meshStandardMaterial color={bronze} roughness={0.5} metalness={0.4} />
        </mesh>
      </group>

      {/* Yard sign: "Vườn Lâm Tỳ Ni" (east of the path, facing south) */}
      <group position={[1.8, 0, 5.8]}>
        <mesh castShadow position={[-0.5, 0.6, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 1.2, 10]} />
          <meshStandardMaterial color={wood} roughness={0.8} />
        </mesh>
        <mesh castShadow position={[0.5, 0.6, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 1.2, 10]} />
          <meshStandardMaterial color={wood} roughness={0.8} />
        </mesh>
        <TextSign text="Vườn Lâm Tỳ Ni" position={[0, 1.35, 0]} width={1.6} height={0.4} />
      </group>

      {/* Garden: slender trees, shrubs, flower bushes, lotus pots,
          landscape rocks, stone lamps (form only, no light). No
          tree is claimed to be a vô ưu or sa la tree — these are
          ordinary garden trees, and none blocks the altar front. */}
      {[[-4.5, -1.5, 1.0], [4.2, -2, 0.9], [-4, 3.2, 0.85]].map(([x, z, s], i) => (
        <group key={`tree${i}`} position={[x, 0, z]}>
          <mesh castShadow position={[0, 0.9 * s, 0]}>
            <cylinderGeometry args={[0.14 * s, 0.2 * s, 1.8 * s, 10]} />
            <meshStandardMaterial color={wood} roughness={0.9} />
          </mesh>
          <mesh castShadow position={[0, 2.2 * s, 0]}>
            <icosahedronGeometry args={[0.9 * s, 1]} />
            <meshStandardMaterial color={leaf} roughness={0.9} />
          </mesh>
          <mesh castShadow position={[0.5 * s, 1.8 * s, 0.3 * s]}>
            <icosahedronGeometry args={[0.6 * s, 1]} />
            <meshStandardMaterial color={leafLight} roughness={0.9} />
          </mesh>
          <mesh castShadow position={[-0.5 * s, 1.9 * s, -0.2 * s]}>
            <icosahedronGeometry args={[0.55 * s, 1]} />
            <meshStandardMaterial color={leaf} roughness={0.9} />
          </mesh>
        </group>
      ))}
      {[[-3, 0.5], [3.5, 1.5], [-5, 4.5], [4.5, 4.8], [-2.5, -3.5], [3, -3.8]].map(([x, z], i) => (
        <mesh key={`shrub${i}`} castShadow position={[x, 0.25, z]}>
          <icosahedronGeometry args={[0.35, 1]} />
          <meshStandardMaterial color={i % 2 ? leafLight : leaf} roughness={0.9} />
        </mesh>
      ))}
      {[[-2, 4.2], [2.5, -4.2], [-5.2, -0.5]].map(([x, z], i) => (
        <group key={`flower${i}`} position={[x, 0, z]}>
          <mesh position={[0, 0.08, 0]}>
            <boxGeometry args={[0.9, 0.15, 0.6]} />
            <meshStandardMaterial color="#6b4a2f" roughness={1} />
          </mesh>
          {[-0.3, 0, 0.3].map((dx, j) => (
            <group key={j} position={[dx, 0.15, 0]}>
              <mesh position={[0, 0.15, 0]}>
                <cylinderGeometry args={[0.015, 0.015, 0.3, 6]} />
                <meshStandardMaterial color={leaf} roughness={0.9} />
              </mesh>
              <mesh position={[0, 0.32, 0]}>
                <sphereGeometry args={[0.06, 10, 8]} />
                <meshStandardMaterial color={j === 1 ? '#e8a0b4' : '#f2d06b'} roughness={0.7} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
      {/* Lotus pots */}
      {[[-3.2, 2.2], [3.2, 2.4]].map(([x, z], i) => (
        <group key={`pot${i}`} position={[x, 0, z]}>
          <mesh castShadow position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.3, 0.22, 0.4, 16]} />
            <meshStandardMaterial color="#9a6a4a" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.26, 16]} />
            <meshStandardMaterial color="#7fb3c8" roughness={0.2} />
          </mesh>
          <mesh position={[0.1, 0.5, 0.05]}>
            <sphereGeometry args={[0.09, 10, 8]} />
            <meshStandardMaterial color="#e8a0b4" roughness={0.7} />
          </mesh>
        </group>
      ))}
      {/* Landscape rocks */}
      {[[-4.8, 1.5], [5, 0.5], [0.5, -4.5]].map(([x, z], i) => (
        <mesh key={`rock${i}`} castShadow position={[x, 0.18, z]} rotation={[0, i, 0]}>
          <dodecahedronGeometry args={[0.35, 0]} />
          <meshStandardMaterial color={stone} roughness={1} />
        </mesh>
      ))}
      {/* Stone lamps (form only, no light) flanking the entrance */}
      {[[-3, 4.5], [3, 4.5]].map(([x, z], i) => (
        <group key={`lamp${i}`} position={[x, 0, z]}>
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[0.4, 0.2, 0.4]} />
            <meshStandardMaterial color={stone} roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[0.16, 0.6, 0.16]} />
            <meshStandardMaterial color={stone} roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.9, 0]}>
            <boxGeometry args={[0.34, 0.3, 0.34]} />
            <meshStandardMaterial color={stoneLight} roughness={0.95} />
          </mesh>
          <mesh position={[0, 1.1, 0]}>
            <boxGeometry args={[0.42, 0.1, 0.42]} />
            <meshStandardMaterial color={stone} roughness={0.95} />
          </mesh>
        </group>
      ))}

      {/* Festival mode: 5-colour flags, Vesak sign, extra lotus.
          Toggled from the education dialog; no festival music. */}
      {festivalOn && (
        <group>
          {/* 5-colour flags flanking the entrance path (the path
              itself, local x 0, stays clear — no pole on it). */}
          {[
            ['#e53935', -3.5, 3.8], ['#fb8c00', -3.5, 4.8], ['#fdd835', -3.5, 5.8],
            ['#43a047', 3.5, 4.3], ['#1e88e5', 3.5, 5.3],
          ].map(([c, x, z], i) => (
            <group key={i} position={[x as number, 0, z as number]}>
              <mesh position={[0, 0.8, 0]}>
                <cylinderGeometry args={[0.02, 0.02, 1.6, 6]} />
                <meshStandardMaterial color={wood} roughness={0.8} />
              </mesh>
              <mesh position={[0.22, 1.35, 0]}>
                <planeGeometry args={[0.44, 0.3]} />
                <meshStandardMaterial color={c} roughness={0.8} side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}
          <group position={[2.5, 0, 5.0]}>
            <mesh castShadow position={[-0.6, 0.6, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 1.2, 10]} />
              <meshStandardMaterial color={wood} roughness={0.8} />
            </mesh>
            <mesh castShadow position={[0.6, 0.6, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 1.2, 10]} />
              <meshStandardMaterial color={wood} roughness={0.8} />
            </mesh>
            <TextSign text="Kính mừng Đại lễ Phật đản" position={[0, 1.35, 0]} width={2.0} height={0.4} />
          </group>
          {[[-3.8, 3.6], [4.2, 3.4]].map(([x, z], i) => (
            <group key={`fpot${i}`} position={[x, 0, z]}>
              <mesh castShadow position={[0, 0.2, 0]}>
                <cylinderGeometry args={[0.3, 0.22, 0.4, 16]} />
                <meshStandardMaterial color="#9a6a4a" roughness={0.9} />
              </mesh>
              <mesh position={[0.1, 0.5, 0.05]}>
                <sphereGeometry args={[0.09, 10, 8]} />
                <meshStandardMaterial color="#e8a0b4" roughness={0.7} />
              </mesh>
            </group>
          ))}
        </group>
      )}
    </group>
  );
}
