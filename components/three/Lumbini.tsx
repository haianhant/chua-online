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
 * - Tôn tượng Thái tử Tất Đạt Đa đản sinh (Infant Prince Siddhartha)
 *   standing atop the lotus pedestal in the traditional Vietnamese
 *   Buddhist posture: bare chest, ornate waist cloth (xiêm y),
 *   left hand raised pointing to heaven (chỉ thiên), right hand
 *   lowered pointing to earth (chỉ địa), serene face, elongated ears,
 *   ushnisha, and golden halo.
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
const DIP = { x: 0.22, y: 0.92, z: 0.5 }; // ladle dipped in the basin
const READY = { x: 0.35, y: 1.45, z: 0.9 }; // ladle ready, south of basin
const POUR = { x: 0, y: 2.12, z: 0.5 }; // ladle above the infant Buddha statue

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
      {/* Yard ground: raised to y 0.03 (above the y 0.02 courtyard so it
          NEVER z-fights) and framed by a 4-sided stone border curb
          with a south entrance opening for the stone path. */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0.5]}>
        <planeGeometry args={[12, 10]} />
        <meshStandardMaterial color="#b0a184" roughness={1} />
      </mesh>
      {[
        [-3.5, 5.5, 5.0, 0.24],
        [3.5, 5.5, 5.0, 0.24],
        [0, -4.5, 12.24, 0.24],
        [-6.0, 0.5, 0.24, 10.0],
        [6.0, 0.5, 0.24, 10.0],
      ].map(([x, z, w, d], i) => (
        <mesh key={`lcurb-${i}`} receiveShadow position={[x, 0.045, z]}>
          <boxGeometry args={[w, 0.05, d]} />
          <meshStandardMaterial color={stone} roughness={0.95} />
        </mesh>
      ))}
      {/* Stone path (straight L, uniform #b0a894 stone matching the
          rest of the temple): aligned with the pond/bell E-W path at
          world z -5.0 (local z 19.0) -> north along local x 0 (world
          x -28) -> landing stone abutting the pavilion south steps. */}
      {[
        [4.4, 19.0], [2.2, 19.0], [0, 19.0],
        [0, 16.8], [0, 14.6], [0, 12.4], [0, 10.2], [0, 8.0], [0, 5.8],
      ].map(([x, z], i) => (
        <mesh key={i} receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.042, z]}>
          <planeGeometry args={[1.6, 1.6]} />
          <meshStandardMaterial color="#b0a894" roughness={0.95} />
        </mesh>
      ))}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.042, 4.1]}>
        <planeGeometry args={[1.8, 1.0]} />
        <meshStandardMaterial color="#b0a894" roughness={0.95} />
      </mesh>

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

        {/* Tôn tượng Thái tử Tất Đạt Đa Đản Sinh (Đức Phật Thích Ca lúc sơ sinh):
            Đứng trang nghiêm trên gương sen (y 1.135), mặt hướng Nam (+Z).
            - Thân tượng đồng thếp vàng ấm (#d4a838 / #b88924), để trần phần ngực,
              quấn xiêm y / khố lụa chạm nổi ngang hông có đai và dải vạt trước.
            - Tay trái (+X) giơ cao chỉ thẳng lên trời ("Thiên thượng thiên hạ"),
              tay phải (-X) duỗi xuống chỉ đất ("Duy ngã độc tôn") — đúng truyền thống
              tượng Phật Đản Sinh Bắc tông Việt Nam.
            - Khuôn mặt từ hòa, mắt khép nhẹ, tai dài phúc tướng, tóc xoắn ốc có
              nhục kế (ushnisha) và hào quang tròn phía sau. */}
        <group position={[0, 1.135, 0]}>
          {/* Golden lotus receptacle pad under feet (gương sen vàng) */}
          <mesh castShadow position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.12, 0.14, 0.04, 20]} />
            <meshStandardMaterial color="#c99b2e" metalness={0.55} roughness={0.38} />
          </mesh>
          {/* Bare feet planted side by side */}
          {[-0.04, 0.04].map((x, i) => (
            <group key={`foot-${i}`} position={[x, 0.045, 0]}>
              <mesh castShadow position={[0, 0, 0.018]} scale={[0.9, 0.6, 1.45]}>
                <sphereGeometry args={[0.026, 10, 10]} />
                <meshStandardMaterial color="#d4a838" metalness={0.55} roughness={0.35} />
              </mesh>
              {/* Lower leg / calf */}
              <mesh castShadow position={[0, 0.08, 0]}>
                <cylinderGeometry args={[0.024, 0.021, 0.15, 12]} />
                <meshStandardMaterial color="#d4a838" metalness={0.55} roughness={0.35} />
              </mesh>
            </group>
          ))}
          {/* Draped waist skirt / dhoti (xiêm y / khố lụa Đản Sinh) */}
          <mesh castShadow position={[0, 0.23, 0]}>
            <cylinderGeometry args={[0.078, 0.092, 0.17, 20]} />
            <meshStandardMaterial color="#b88924" metalness={0.5} roughness={0.42} />
          </mesh>
          {/* Ornate waist belt (đai lưng chạm nổi) */}
          <mesh castShadow position={[0, 0.315, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.078, 0.014, 10, 24]} />
            <meshStandardMaterial color="#e6c35c" metalness={0.65} roughness={0.32} />
          </mesh>
          {/* Central front pleated sash (dải vạt lụa rủ trước bụng) */}
          <mesh castShadow position={[0, 0.22, 0.082]} rotation={[-0.06, 0, 0]}>
            <boxGeometry args={[0.042, 0.18, 0.016]} />
            <meshStandardMaterial color="#e6c35c" metalness={0.6} roughness={0.35} />
          </mesh>
          {/* Side drapery fold ridges */}
          {[-0.055, -0.028, 0.028, 0.055].map((x, i) => (
            <mesh key={`fold-${i}`} castShadow position={[x, 0.225, 0.072]} rotation={[0, 0, x * 0.4]}>
              <cylinderGeometry args={[0.008, 0.01, 0.16, 8]} />
              <meshStandardMaterial color="#9e731b" metalness={0.5} roughness={0.45} />
            </mesh>
          ))}
          {/* Bare upper torso & chest */}
          <mesh castShadow position={[0, 0.40, 0]} scale={[1.05, 1.15, 0.85]}>
            <sphereGeometry args={[0.082, 18, 16]} />
            <meshStandardMaterial color="#d4a838" metalness={0.55} roughness={0.35} />
          </mesh>
          {/* Golden neck torque (vòng anh lạc mảnh nơi cổ) */}
          <mesh position={[0, 0.485, 0.01]} rotation={[Math.PI / 2 + 0.2, 0, 0]}>
            <torusGeometry args={[0.058, 0.008, 8, 20]} />
            <meshStandardMaterial color="#e6c35c" metalness={0.65} roughness={0.3} />
          </mesh>
          {/* LEFT ARM (+X): Raised high, index finger pointing straight to heaven (Tay trái chỉ thiên) */}
          <group position={[0.095, 0.465, 0]}>
            {/* Shoulder */}
            <mesh castShadow position={[0, 0, 0]}>
              <sphereGeometry args={[0.028, 12, 12]} />
              <meshStandardMaterial color="#d4a838" metalness={0.55} roughness={0.35} />
            </mesh>
            {/* Raised upper arm & forearm */}
            <mesh castShadow position={[0.012, 0.10, 0.01]} rotation={[0, 0, -0.08]}>
              <cylinderGeometry args={[0.021, 0.025, 0.20, 12]} />
              <meshStandardMaterial color="#d4a838" metalness={0.55} roughness={0.35} />
            </mesh>
            {/* Wrist bangle */}
            <mesh position={[0.018, 0.195, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.022, 0.005, 8, 16]} />
              <meshStandardMaterial color="#e6c35c" metalness={0.65} roughness={0.3} />
            </mesh>
            {/* Left hand */}
            <mesh castShadow position={[0.018, 0.22, 0.01]} scale={[0.85, 1.1, 0.7]}>
              <sphereGeometry args={[0.022, 10, 10]} />
              <meshStandardMaterial color="#d4a838" metalness={0.55} roughness={0.35} />
            </mesh>
            {/* Index finger pointing straight UP to heaven */}
            <mesh castShadow position={[0.018, 0.268, 0.01]}>
              <cylinderGeometry args={[0.006, 0.008, 0.065, 8]} />
              <meshStandardMaterial color="#d4a838" metalness={0.55} roughness={0.35} />
            </mesh>
          </group>
          {/* RIGHT ARM (-X): Lowered alongside body, index finger pointing to earth (Tay phải chỉ địa) */}
          <group position={[-0.095, 0.465, 0]}>
            {/* Shoulder */}
            <mesh castShadow position={[0, 0, 0]}>
              <sphereGeometry args={[0.028, 12, 12]} />
              <meshStandardMaterial color="#d4a838" metalness={0.55} roughness={0.35} />
            </mesh>
            {/* Lowered upper arm & forearm */}
            <mesh castShadow position={[-0.012, -0.095, 0.01]} rotation={[0, 0, 0.08]}>
              <cylinderGeometry args={[0.025, 0.021, 0.19, 12]} />
              <meshStandardMaterial color="#d4a838" metalness={0.55} roughness={0.35} />
            </mesh>
            {/* Wrist bangle */}
            <mesh position={[-0.018, -0.185, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.022, 0.005, 8, 16]} />
              <meshStandardMaterial color="#e6c35c" metalness={0.65} roughness={0.3} />
            </mesh>
            {/* Right hand */}
            <mesh castShadow position={[-0.018, -0.21, 0.01]} scale={[0.85, 1.1, 0.7]}>
              <sphereGeometry args={[0.022, 10, 10]} />
              <meshStandardMaterial color="#d4a838" metalness={0.55} roughness={0.35} />
            </mesh>
            {/* Index finger pointing straight DOWN to earth */}
            <mesh castShadow position={[-0.018, -0.255, 0.01]}>
              <cylinderGeometry args={[0.008, 0.006, 0.06, 8]} />
              <meshStandardMaterial color="#d4a838" metalness={0.55} roughness={0.35} />
            </mesh>
          </group>
          {/* Neck & Head */}
          <mesh castShadow position={[0, 0.505, 0]}>
            <cylinderGeometry args={[0.032, 0.036, 0.045, 12]} />
            <meshStandardMaterial color="#d4a838" metalness={0.55} roughness={0.35} />
          </mesh>
          <mesh castShadow position={[0, 0.585, 0]} scale={[0.92, 1.06, 0.95]}>
            <sphereGeometry args={[0.074, 20, 20]} />
            <meshStandardMaterial color="#d4a838" metalness={0.55} roughness={0.35} />
          </mesh>
          {/* Elongated auspicious ears (tai dài phúc tướng) */}
          {[-1, 1].map((s) => (
            <mesh key={`ear-${s}`} castShadow position={[s * 0.072, 0.575, 0]} scale={[0.35, 1.15, 0.55]}>
              <sphereGeometry args={[0.026, 10, 10]} />
              <meshStandardMaterial color="#d4a838" metalness={0.55} roughness={0.35} />
            </mesh>
          ))}
          {/* Serene facial features (+Z front): brows, downcast eyes, nose, gentle smile, bạch hào */}
          {[-1, 1].map((s) => (
            <group key={`face-${s}`}>
              <mesh position={[s * 0.026, 0.60, 0.068]} rotation={[0, 0, s * -0.18]}>
                <boxGeometry args={[0.022, 0.004, 0.004]} />
                <meshStandardMaterial color="#5a3e10" roughness={0.7} />
              </mesh>
              <mesh position={[s * 0.026, 0.586, 0.070]}>
                <boxGeometry args={[0.020, 0.0035, 0.004]} />
                <meshStandardMaterial color="#5a3e10" roughness={0.7} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 0.608, 0.071]}>
            <sphereGeometry args={[0.006, 8, 8]} />
            <meshStandardMaterial color="#fff3c4" emissive="#ffd97d" emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[0, 0.576, 0.073]} scale={[0.55, 1.1, 0.7]}>
            <sphereGeometry args={[0.011, 8, 8]} />
            <meshStandardMaterial color="#d4a838" metalness={0.55} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.558, 0.070]}>
            <boxGeometry args={[0.022, 0.004, 0.004]} />
            <meshStandardMaterial color="#7a4e18" roughness={0.7} />
          </mesh>
          {/* Hair cap + Ushnisha (nhục kế trên đỉnh đầu) */}
          <mesh castShadow position={[0, 0.605, -0.006]} scale={[0.95, 0.92, 0.98]}>
            <sphereGeometry args={[0.076, 18, 16, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
            <meshStandardMaterial color="#7a5816" metalness={0.45} roughness={0.55} />
          </mesh>
          <mesh castShadow position={[0, 0.672, -0.004]}>
            <sphereGeometry args={[0.028, 14, 14]} />
            <meshStandardMaterial color="#7a5816" metalness={0.45} roughness={0.55} />
          </mesh>
          {/* Sacred Halo (Hào quang tròn phía sau đầu Thái tử) */}
          <mesh position={[0, 0.59, -0.055]}>
            <ringGeometry args={[0.105, 0.135, 32]} />
            <meshStandardMaterial color="#e6c35c" metalness={0.65} roughness={0.3} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.59, -0.057]}>
            <circleGeometry args={[0.105, 32]} />
            <meshStandardMaterial color="#f5e19c" transparent opacity={0.35} side={THREE.DoubleSide} />
          </mesh>
        </group>

        {/* Water stream: ladle mouth -> onto the Prince statue during the pour window */}
        <mesh ref={streamRef} position={[0, 1.84, 0]} visible={false}>
          <cylinderGeometry args={[0.012, 0.018, 0.48, 8]} />
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

      {/* Yard sign: "Vườn Lâm Tỳ Ni" (east of the entrance path, facing south,
          clear of the stone lamp and festival sign) */}
      <group position={[2.4, 0, 5.8]}>
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
          landscape rocks, stone lamps (form only, no light). */}
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
      {[[-3.6, 0.5], [3.6, 1.2], [-5, 4.5], [4.8, 4.5], [-2.5, -3.5], [3, -3.8]].map(([x, z], i) => (
        <mesh key={`shrub${i}`} castShadow position={[x, 0.25, z]}>
          <icosahedronGeometry args={[0.35, 1]} />
          <meshStandardMaterial color={i % 2 ? leafLight : leaf} roughness={0.9} />
        </mesh>
      ))}
      {[[-2, 4.2], [2.5, -3.9], [-5.0, -0.5]].map(([x, z], i) => (
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
      {/* Lotus pots (placed outside the ±3.25 roof eaves line) */}
      {[[-3.6, 2.5], [3.6, 2.5]].map(([x, z], i) => (
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
      {[[-4.8, 1.5], [5, 0.5], [0.5, -3.9]].map(([x, z], i) => (
        <mesh key={`rock${i}`} castShadow position={[x, 0.18, z]} rotation={[0, i, 0]}>
          <dodecahedronGeometry args={[0.35, 0]} />
          <meshStandardMaterial color={stone} roughness={1} />
        </mesh>
      ))}
      {/* Stone lamps (form only, no light) flanking the pavilion steps */}
      {[[-2.4, 3.6], [2.4, 3.6]].map(([x, z], i) => (
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

      {/* Festival mode: 5-colour flags, Vesak sign on the WEST side
          flanking the entrance opposite "Vườn Lâm Tỳ Ni", extra lotus. */}
      {festivalOn && (
        <group>
          {[
            ['#e53935', -4.2, 3.8], ['#fb8c00', -4.2, 4.8], ['#fdd835', -4.2, 5.8],
            ['#43a047', 4.2, 4.2], ['#1e88e5', 4.2, 5.2],
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
          <group position={[-2.6, 0, 5.8]}>
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
          {[[-1.4, 3.6], [1.4, 3.6]].map(([x, z], i) => (
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
