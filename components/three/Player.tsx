'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { controls, LAYOUT, moveWithCollision, floorYAt, sweepState, bathState } from './controls';

type Props = {
  name: string;
  visible: boolean;
  canMove: boolean;
  onZone: (zone: 'burner' | 'chant' | 'pond' | 'altar' | 'none') => void;
};

const SPEED = 3.4;

/**
 * Phật tử trong trang phục Bộ đồ lam đi chùa truyền thống (Áo lam cổ tàu vạt chéo
 * cài nút vải, quần lam ống suông, giày vải, chuỗi hạt gỗ trầm, đầu trần tóc búi gọn).
 * Walk: legs/arms swing, body bobs. Idle: gentle breathing.
 * Sit: lowered, legs folded, hands together. Pray: standing, hands together.
 */
export default function Player({ name, visible, canMove, onZone }: Props) {
  const group = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const vel = useRef({ x: 0, z: 0 });
  const phase = useRef(0);
  const zoneRef = useRef<'burner' | 'chant' | 'pond' | 'altar' | 'none'>('none');
  const pos = useRef({ x: LAYOUT.spawn.x, z: LAYOUT.spawn.z });
  const facing = useRef(Math.PI); // facing north (towards the hall)
  // Smooth pose + floor transitions (no snap-down when kneeling/sitting,
  // no sinking into the hall floor when stepping up the platform).
  const floorY = useRef(0);
  const poseBlend = useRef(0); // 0 = standing, 1 = fully seated/kneeling
  const sweepBlend = useRef(0); // 0 = normal, 1 = sweeping (arms/body)
  const bathBlend = useRef(0); // 0 = normal, 1 = scooping/pouring (right arm raised)

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const g = group.current;
    if (!g) return;

    const effSpeed = SPEED;
    let mx = 0;
    let mz = 0;
    // Sweep guard: movement is locked while sweeping, even if the
    // page's canMove prop is a poll tick behind the phase change.
    const sweepingNow = sweepState.phase !== 'idle';
    // Bath guard (Request E): same rule as the sweep — movement
    // is locked while bathing, except the pending auto-walk.
    const bathingNow = bathState.phase !== 'idle' && bathState.phase !== 'done';
    // Sweep pending walk: canMove is false (movement locked for
    // the user), but the sweep auto-walk must still run — otherwise
    // the player never reaches the sweep spot and the sweep never
    // starts (bug found by the C sweep test, 2026-11-04).
    const sweepWalkOnly = controls.sweepAutoWalk && visible && !sweepingNow;
    // Bath pending walk: same rule for the Lumbini ritual spot.
    const bathWalkOnly = controls.bathAutoWalk && visible && !bathingNow;
    if ((canMove && visible && !sweepingNow && !bathingNow) || sweepWalkOnly || bathWalkOnly) {
      const k = controls.keys;
      const fwd = k.has('w') || k.has('arrowup') ? 1 : 0;
      const back = k.has('s') || k.has('arrowdown') ? 1 : 0;
      const left = k.has('a') || k.has('arrowleft') ? 1 : 0;
      const right = k.has('d') || k.has('arrowright') ? 1 : 0;
      // Camera-relative movement
      const fx = -Math.sin(controls.yaw);
      const fz = -Math.cos(controls.yaw);
      const rx = -fz;
      const rz = fx;
      mx = fx * (fwd - back) + rx * (right - left);
      mz = fz * (fwd - back) + rz * (right - left);
      // Joystick (screen y down = forward)
      mx += rx * controls.joystick.x + fx * -controls.joystick.y;
      mz += rz * controls.joystick.x + fz * -controls.joystick.y;
      // During sweep pending walk, ignore manual keys/joystick
      // entirely — only the auto-walk direction below moves.
      if (sweepWalkOnly || bathWalkOnly) { mx = 0; mz = 0; }
      // Click-to-move / auto-move target, via waypoints if any.
      // Local avoidance: per-axis sliding stalls when a pillar or
      // lantern sits almost head-on in the path (both axis moves
      // deepen the penetration, so the player freezes at the
      // collider edge — seen with the tam quan pillar on the way to
      // the hall). If the direct direction cannot move, try
      // directions rotated away from the target until one does;
      // the next frame the direct direction usually frees up again,
      // so the player slides around the obstacle instead of stalling.
      const target = controls.waypoints.length > 0 ? controls.waypoints[0] : controls.moveTarget;
      if (target) {
        const dx = target.x - pos.current.x;
        const dz = target.z - pos.current.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.25) {
          if (controls.waypoints.length > 0) controls.waypoints.shift();
          else controls.moveTarget = null;
        } else {
          const base = Math.atan2(dx, dz);
          const step = effSpeed * dt;
          let chosen: [number, number] | null = null;
          let bestTaken = 0;
          let bestDir: [number, number] | null = null;
          for (const off of [0, 0.5, -0.5, 1.0, -1.0, 1.57, -1.57]) {
            const a = base + off;
            const dirX = Math.sin(a);
            const dirZ = Math.cos(a);
            const next = moveWithCollision(pos.current.x, pos.current.z, dirX * step, dirZ * step);
            // A direction counts only if nearly the whole step is
            // actually taken. Per-axis sliding alone would pass a
            // looser test (moving sideways while the forward axis is
            // blocked) and then loop forever at a lantern/pillar edge.
            const taken = Math.hypot(next.x - pos.current.x, next.z - pos.current.z);
            if (taken > step * 0.8) {
              chosen = [dirX, dirZ];
              break;
            }
            if (taken > bestTaken) { bestTaken = taken; bestDir = [dirX, dirZ]; }
          }
          if (chosen) {
            mx += chosen[0];
            mz += chosen[1];
          } else if (bestDir && bestTaken > 0) {
            // Wedge fallback (2026-11-04): no direction takes a
            // near-full step — e.g. wedged between the hall front
            // wall and a door post on the hall -> garden route, where
            // the player froze at (7.33,-6.46) for 40 min. Creep along
            // the best partial direction instead of freezing forever;
            // the final displacement is collision-clamped again below,
            // so this slides along the obstacle until a full step
            // frees up. Manual input still cancels auto-move.
            mx += bestDir[0];
            mz += bestDir[1];
          }
        }
      }
      // Manual input cancels auto-move (map / click-to-move):
      // the guest taking control must stop the auto-walk at once.
      const manual = !sweepWalkOnly && !bathWalkOnly && (fwd || back || left || right || Math.abs(controls.joystick.x) > 0.1 || Math.abs(controls.joystick.y) > 0.1);
      if (manual) { controls.moveTarget = null; controls.waypoints = []; }
      const len = Math.hypot(mx, mz);
      if (len > 1) {
        mx /= len;
        mz /= len;
      }
    } else {
      controls.moveTarget = null;
      controls.waypoints = [];
    }

    // Smooth acceleration / deceleration
    const accel = 1 - Math.exp(-10 * dt);
    vel.current.x += (mx * effSpeed - vel.current.x) * accel;
    vel.current.z += (mz * effSpeed - vel.current.z) * accel;
    const speed = Math.hypot(vel.current.x, vel.current.z);
    controls.playerMoving = speed > 0.4;

    if (speed > 0.4) {
      const next = moveWithCollision(pos.current.x, pos.current.z, vel.current.x * dt, vel.current.z * dt);
      pos.current = next;
      facing.current = Math.atan2(vel.current.x, vel.current.z);
      phase.current += speed * dt * 2.6;
    }
    // Sweep: turn gently to face the pile (east), like the
    // seated facing lerp — no snap. During preparing (1.5s) the
    // turn settles before the first stroke.
    if (sweepState.phase !== 'idle') {
      const targetFacing = Math.atan2(LAYOUT.sweepPile.x - LAYOUT.sweepSpot.x, LAYOUT.sweepPile.z - LAYOUT.sweepSpot.z);
      let diff = targetFacing - facing.current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      facing.current += diff * (1 - Math.exp(-5 * dt));
    }
    // Bath ritual (Request E): face north, toward the basin and
    // the statue, for the whole ritual (the auto-walk already
    // arrives facing north, but this holds it through every phase).
    if (bathState.phase !== 'idle' && bathState.phase !== 'done') {
      const targetFacing = Math.PI;
      let diff = targetFacing - facing.current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      facing.current += diff * (1 - Math.exp(-5 * dt));
    }
    // Sit / pray / kneel turn smoothly to face the seat's facing
    // (hall seats: north to the statue; lake: west to the water),
    // instead of snapping. Shortest-angle lerp.
    const seated = controls.pose === 'sit' || controls.pose === 'kneel';
    if (seated || controls.pose === 'pray') {
      const targetFacing = seated ? controls.sitFacing : Math.PI;
      let diff = targetFacing - facing.current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      facing.current += diff * (1 - Math.exp(-5 * dt));
    }
    // Pose blend: 0 standing -> 1 seated/kneeling, eased over ~0.6s.
    const poseTarget = seated ? 1 : 0;
    poseBlend.current += (poseTarget - poseBlend.current) * (1 - Math.exp(-5 * dt));
    const blend = poseBlend.current;
    // Floor height: lerp so stepping onto the platform/hall floor
    // rises gradually instead of teleporting up a step.
    const targetFloor = floorYAt(pos.current.x, pos.current.z);
    floorY.current += (targetFloor - floorY.current) * (1 - Math.exp(-6 * dt));
    if (Math.abs(targetFloor - floorY.current) < 0.01) floorY.current = targetFloor;

    const kneel = controls.pose === 'kneel';
    // Hall-only grounded pose (fixed 2026-11-03: sit/kneel used to
    // FLOAT — sit raised the group by +0.35 while the folded legs
    // sit at local y 0.37..0.59, so the legs hung 0.72..0.94m above
    // the floor, and kneel left them 0.12..0.34m up, with the torso
    // still near standing height). Inside the hall (x ±9.5,
    // z -26..-5.8) the group now drops so the folded legs rest on
    // the floor/mat, and the torso scales down so seated height is
    // ~1.37m and kneeling height ~1.57m instead of ~2.4m. Outdoor
    // bench/chair seats keep the old pose for now — sitting ON a
    // bench needs seat-height data, not a ground pose.
    const inHall =
      pos.current.x >= -9.5 &&
      pos.current.x <= 9.5 &&
      pos.current.z >= -26 &&
      pos.current.z <= -5.8;
    const hallPose = seated && inHall;
    const poseDrop = kneel ? -0.25 : hallPose ? -0.2 : 0.35;
    const poseScale = hallPose ? (kneel ? 0.75 : 0.65) : 1;
    const bodyY =
      floorY.current +
      blend * poseDrop +
      (1 - blend) * Math.abs(Math.sin(phase.current)) * 0.05 * Math.min(1, speed / SPEED);
    g.position.set(pos.current.x, bodyY, pos.current.z);
    g.rotation.y = facing.current;
    controls.playerFacing = facing.current;
    controls.playerPos = { x: pos.current.x, y: floorY.current, z: pos.current.z };

    const swing = Math.sin(phase.current) * 0.65 * Math.min(1, speed / SPEED);
    const idle = Math.sin(clock.getElapsedTime() * 1.8) * 0.02;
    const legAngle = blend * -1.45 + (1 - blend) * swing;
    const legAngleR = blend * -1.45 + (1 - blend) * -swing;
    const armAngle = blend * (kneel ? -1.1 : -0.9) + (1 - blend) * (-swing * 0.7 + idle);
    const armAngleR = blend * (kneel ? -1.1 : -0.9) + (1 - blend) * (swing * 0.7 - idle);
    // Sweep arms/body (Request C): both arms move together with
    // the broom stroke (strokePhase comes from Grounds, same frame
    // base, so arms and broom stay in sync; frozen while paused).
    // sweepBlend eases in/out over ~1s, so arms never snap when
    // the sweep starts or ends. Body leans slightly forward.
    const sweepTarget = (sweepState.phase === 'sweeping' || sweepState.phase === 'gathering') && !sweepState.paused ? 1 : 0;
    sweepBlend.current += (sweepTarget - sweepBlend.current) * (1 - Math.exp(-3 * dt));
    const sb = sweepBlend.current;
    const stroke = Math.sin(sweepState.strokePhase * Math.PI * 2);
    const armAngleSweep = -0.45 + stroke * 0.35;
    const armAngleL = armAngle * (1 - sb) + armAngleSweep * sb;
    const armAngleRSweep = armAngleR * (1 - sb) + armAngleSweep * sb;
    if (body.current && sb > 0.01) body.current.rotation.x = 0.08 * sb + stroke * 0.03 * sb;
    else if (body.current) body.current.rotation.x = 0;
    if (legL.current) legL.current.rotation.x = legAngle;
    if (legR.current) legR.current.rotation.x = legAngleR;
    // Bath arms (Request E): right arm raises forward to hold the
    // ladle while scooping/pouring, left arm stays low; eased like
    // the sweep blend so nothing snaps. Pray pose (hall ritual and
    // bath pray/finish): both arms come forward together, the
    // hands-together approximation this avatar's single-axis arms
    // can show — previously pray only turned the body north.
    const bathTarget = (bathState.phase === 'scoop' || bathState.phase === 'pour') ? 1 : 0;
    bathBlend.current += (bathTarget - bathBlend.current) * (1 - Math.exp(-3 * dt));
    const bb = bathBlend.current;
    const armAngleBathR = -1.35 + Math.sin(bathState.pourT * Math.PI * 2) * 0.08;
    let armAngleFinalL = armAngleL * (1 - bb) + (-0.5) * bb;
    let armAngleFinalR = armAngleRSweep * (1 - bb) + armAngleBathR * bb;
    if (controls.pose === 'pray' && bathState.phase !== 'scoop' && bathState.phase !== 'pour') {
      armAngleFinalL = armAngleFinalL * 0.4 + (-0.6) * 0.6;
      armAngleFinalR = armAngleFinalR * 0.4 + (-0.6) * 0.6;
    }
    if (armL.current) armL.current.rotation.x = armAngleFinalL;
    if (armR.current) armR.current.rotation.x = armAngleFinalR;
    if (body.current)
      body.current.scale.y =
        (1 - blend * (1 - poseScale)) * (1 + (canMove && speed < 0.4 ? idle : 0));

    // Interaction zones
    const db = Math.hypot(pos.current.x - LAYOUT.burner.x, pos.current.z - LAYOUT.burner.z);
    const dc = Math.hypot(pos.current.x - LAYOUT.chantPavilion.x, pos.current.z - LAYOUT.chantPavilion.z);
    const dp = Math.hypot(pos.current.x - LAYOUT.pond.x, pos.current.z - LAYOUT.pond.z);
    const da = Math.hypot(pos.current.x - LAYOUT.altarSpot.x, pos.current.z - LAYOUT.altarSpot.z);
    const zone: 'burner' | 'chant' | 'pond' | 'altar' | 'none' =
      db < 2.9 ? 'burner' : dc < 3.4 ? 'chant' : dp < 5.0 ? 'pond' : da < 2.4 ? 'altar' : 'none';
    if (zone !== zoneRef.current) {
      zoneRef.current = zone;
      onZone(zone);
    }
  });

  if (!visible) return null;

  return (
    <group ref={group} position={[LAYOUT.spawn.x, 0, LAYOUT.spawn.z]}>
      {/* Name label — DOM text, so Vietnamese diacritics render perfectly */}
      <Html center position={[0, 2.32, 0]} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="whitespace-nowrap rounded-full border border-white/40 bg-black/45 px-3 py-1 font-sans text-xs font-medium text-amber-50 shadow">
          {name}
        </div>
      </Html>
      <group ref={body}>
        {/* Quần lam ống suông + Giày vải đi chùa (Trousers & Cloth Shoes) */}
        {[-0.135, 0.135].map((x, i) => (
          <group
            key={i}
            ref={i === 0 ? legL : legR}
            position={[x, 0.48, 0]}
          >
            {/* Ống quần lam suông rộng vừa phải */}
            <mesh position={[0, 0.04, 0]} castShadow>
              <cylinderGeometry args={[0.105, 0.122, 0.82, 14]} />
              <meshStandardMaterial color="#5c738a" roughness={0.86} />
            </mesh>
            {/* Gấu quần lam (Trouser hem cuff) */}
            <mesh position={[0, -0.355, 0]} castShadow>
              <cylinderGeometry args={[0.123, 0.124, 0.045, 14]} />
              <meshStandardMaterial color="#4b6075" roughness={0.88} />
            </mesh>
            {/* Cổ chân / tất vải (Ankle sock) */}
            <mesh position={[0, -0.40, 0]}>
              <cylinderGeometry args={[0.072, 0.075, 0.08, 12]} />
              <meshStandardMaterial color="#e8e2d5" roughness={0.85} />
            </mesh>
            {/* Thân giày vải đi chùa (Cloth temple shoe upper) */}
            <mesh position={[0, -0.435, 0.028]} castShadow>
              <boxGeometry args={[0.145, 0.065, 0.24]} />
              <meshStandardMaterial color="#382e28" roughness={0.88} />
            </mesh>
            {/* Mũi giày bo tròn (Rounded shoe toe) */}
            <mesh position={[0, -0.438, 0.135]} scale={[1, 0.55, 1]} castShadow>
              <sphereGeometry args={[0.071, 12, 10]} />
              <meshStandardMaterial color="#382e28" roughness={0.88} />
            </mesh>
            {/* Đế giày vải trắng ngà (Cloth shoe sole) */}
            <mesh position={[0, -0.47, 0.032]}>
              <boxGeometry args={[0.152, 0.022, 0.255]} />
              <meshStandardMaterial color="#dfd7c8" roughness={0.9} />
            </mesh>
          </group>
        ))}

        {/* Áo lam Phật tử — Thân áo trên (Upper tunic torso) */}
        <mesh castShadow position={[0, 1.44, 0]}>
          <cylinderGeometry args={[0.245, 0.265, 0.44, 18]} />
          <meshStandardMaterial color="#6e859c" roughness={0.84} />
        </mesh>
        {/* Cầu vai bo tròn tự nhiên (Rounded shoulder yoke) */}
        <mesh castShadow position={[0, 1.63, 0]} scale={[1.28, 0.42, 0.9]}>
          <sphereGeometry args={[0.255, 16, 12]} />
          <meshStandardMaterial color="#6e859c" roughness={0.84} />
        </mesh>
        {/* Đường chiết eo nhẹ (Subtle waist seam) */}
        <mesh position={[0, 1.23, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.26, 0.012, 8, 20]} />
          <meshStandardMaterial color="#586f86" roughness={0.86} />
        </mesh>
        {/* Tà áo lam vạt hò xẻ tà (Flared lower tunic skirt) */}
        <mesh castShadow position={[0, 1.01, 0]}>
          <cylinderGeometry args={[0.262, 0.345, 0.46, 18]} />
          <meshStandardMaterial color="#6e859c" roughness={0.84} />
        </mesh>
        {/* Viền gấu tà áo lam (Lower tunic hem trim) */}
        <mesh position={[0, 0.79, 0]}>
          <cylinderGeometry args={[0.344, 0.348, 0.03, 18]} />
          <meshStandardMaterial color="#4b6075" roughness={0.86} />
        </mesh>
        {/* Đường xẻ tà hai bên hông (Traditional side slits) */}
        {[-0.31, 0.31].map((sx, idx) => (
          <mesh key={`slit-${idx}`} position={[sx, 0.91, 0]}>
            <boxGeometry args={[0.018, 0.26, 0.055]} />
            <meshStandardMaterial color="#435668" roughness={0.9} />
          </mesh>
        ))}

        {/* Cổ tàu truyền thống (Mandarin standing collar) */}
        <mesh position={[0, 1.675, 0]}>
          <cylinderGeometry args={[0.135, 0.145, 0.075, 16]} />
          <meshStandardMaterial color="#4b6075" roughness={0.84} />
        </mesh>
        {/* Cổ (Neck) */}
        <mesh position={[0, 1.725, 0]}>
          <cylinderGeometry args={[0.112, 0.122, 0.11, 14]} />
          <meshStandardMaterial color="#ecc39e" roughness={0.72} />
        </mesh>

        {/* Nẹp áo vạt chéo cài cúc vải phía trước (Front diagonal placket + cloth knot buttons on +Z) */}
        <mesh position={[0.08, 1.54, 0.252]} rotation={[0, 0, -0.62]}>
          <boxGeometry args={[0.032, 0.28, 0.018]} />
          <meshStandardMaterial color="#4b6075" roughness={0.85} />
        </mesh>
        <mesh position={[0.165, 1.13, 0.285]} rotation={[-0.14, 0, 0]}>
          <boxGeometry args={[0.03, 0.62, 0.018]} />
          <meshStandardMaterial color="#4b6075" roughness={0.85} />
        </mesh>
        {/* 5 nút vải trắng ngà (5 traditional ivory silk knot buttons) */}
        {[
          [0.03, 1.61, 0.262],
          [0.095, 1.525, 0.262],
          [0.16, 1.435, 0.262],
          [0.168, 1.28, 0.282],
          [0.172, 1.12, 0.304],
        ].map(([bx, by, bz], idx) => (
          <mesh key={`btn-${idx}`} position={[bx, by, bz]}>
            <sphereGeometry args={[0.016, 8, 8]} />
            <meshStandardMaterial color="#f2ead8" roughness={0.65} />
          </mesh>
        ))}

        {/* Huy hiệu hoa sen thêu ngực trái (Embroidered lotus badge on front left chest) */}
        <group position={[-0.105, 1.48, 0.258]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.034, 0.034, 0.008, 12]} />
            <meshStandardMaterial color="#4b6075" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0, 0.006]}>
            <sphereGeometry args={[0.018, 10, 8]} />
            <meshStandardMaterial color="#f0a8be" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.004, 0.014]}>
            <sphereGeometry args={[0.009, 8, 8]} />
            <meshStandardMaterial color="#e8c266" roughness={0.5} />
          </mesh>
        </group>

        {/* Chi tiết mặt sau lưng áo lam (Back seam + subtle embroidered lotus motif seen by follow camera on -Z) */}
        <mesh position={[0, 1.22, -0.285]} rotation={[0.13, 0, 0]}>
          <boxGeometry args={[0.016, 0.82, 0.012]} />
          <meshStandardMaterial color="#586f86" roughness={0.88} />
        </mesh>
        {/* Hoa sen thêu trang nhã giữa lưng áo trên (Back lotus emblem) */}
        <group position={[0, 1.47, -0.256]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.052, 0.052, 0.006, 16]} />
            <meshStandardMaterial color="#556b82" roughness={0.82} />
          </mesh>
          {[0, -0.48, 0.48, -0.92, 0.92].map((ang, idx) => (
            <mesh
              key={`back-petal-${idx}`}
              position={[Math.sin(ang) * 0.018, Math.cos(ang) * 0.012 - 0.006, -0.004]}
              rotation={[0, 0, -ang]}
              scale={[0.55, 1.15, 0.35]}
            >
              <sphereGeometry args={[0.018, 8, 8]} />
              <meshStandardMaterial color="#e8b4c4" roughness={0.65} />
            </mesh>
          ))}
          <mesh position={[0, -0.016, -0.005]}>
            <sphereGeometry args={[0.011, 8, 8]} />
            <meshStandardMaterial color="#e6c36a" roughness={0.55} />
          </mesh>
        </group>

        {/* Tay áo lam dài + Vòng hạt gỗ trầm + Bàn tay (Sleeves, prayer beads & hands pivoting from shoulder) */}
        {[-0.34, 0.34].map((x, i) => (
          <group
            key={i}
            ref={i === 0 ? armL : armR}
            position={[x, 1.58, 0]}
          >
            {/* Đầu vai áo bo tròn (Rounded shoulder cap at pivot) */}
            <mesh position={[0, 0, 0]} castShadow>
              <sphereGeometry args={[0.092, 12, 10]} />
              <meshStandardMaterial color="#6e859c" roughness={0.84} />
            </mesh>
            {/* Ống tay áo lam dài (Long lam sleeve) */}
            <mesh position={[0, -0.22, 0]} castShadow>
              <cylinderGeometry args={[0.088, 0.098, 0.44, 14]} />
              <meshStandardMaterial color="#6e859c" roughness={0.84} />
            </mesh>
            {/* Viền cổ tay áo lam (Sleeve cuff trim) */}
            <mesh position={[0, -0.425, 0]} castShadow>
              <cylinderGeometry args={[0.099, 0.101, 0.045, 14]} />
              <meshStandardMaterial color="#4b6075" roughness={0.86} />
            </mesh>
            {/* Vòng chuỗi hạt gỗ trầm đeo cổ tay (Wooden prayer bead bracelet) */}
            <mesh position={[0, -0.452, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.068, 0.016, 8, 14]} />
              <meshStandardMaterial color="#5c3820" roughness={0.65} />
            </mesh>
            {/* Bàn tay (Sculpted hand) */}
            <mesh position={[0, -0.495, 0.01]} scale={[0.85, 1.15, 0.95]} castShadow>
              <sphereGeometry args={[0.064, 12, 10]} />
              <meshStandardMaterial color="#ecc39e" roughness={0.72} />
            </mesh>
          </group>
        ))}

        {/* Đầu + Khuôn mặt hiền hòa + Tóc búi gọn gàng (Head, serene face & neat hair bun — no conical hat indoors) */}
        <mesh castShadow position={[0, 1.96, 0]}>
          <sphereGeometry args={[0.235, 22, 22]} />
          <meshStandardMaterial color="#ecc39e" roughness={0.7} />
        </mesh>
        {/* Đôi tai (Ears) */}
        {[-0.228, 0.228].map((ex, idx) => (
          <mesh key={`ear-${idx}`} position={[ex, 1.95, 0]} scale={[0.45, 0.85, 0.65]}>
            <sphereGeometry args={[0.055, 10, 10]} />
            <meshStandardMaterial color="#e6ba94" roughness={0.72} />
          </mesh>
        ))}
        {/* Nét mặt hiền hòa hướng về phía trước (+Z) */}
        {/* Chân mày (Eyebrows) */}
        {[-0.075, 0.075].map((fx, idx) => (
          <mesh key={`brow-${idx}`} position={[fx, 2.015, 0.218]} rotation={[0, 0, idx === 0 ? 0.08 : -0.08]}>
            <boxGeometry args={[0.052, 0.01, 0.01]} />
            <meshStandardMaterial color="#241812" roughness={0.85} />
          </mesh>
        ))}
        {/* Đôi mắt an tĩnh (Gentle eyes) */}
        {[-0.075, 0.075].map((fx, idx) => (
          <mesh key={`eye-${idx}`} position={[fx, 1.975, 0.224]}>
            <sphereGeometry args={[0.018, 10, 10]} />
            <meshStandardMaterial color="#1f1510" roughness={0.4} />
          </mesh>
        ))}
        {/* Nụ cười nhẹ (Subtle serene smile) */}
        <mesh position={[0, 1.895, 0.222]} rotation={[0.2, 0, 0]}>
          <torusGeometry args={[0.032, 0.006, 6, 12, Math.PI]} />
          <meshStandardMaterial color="#b86b5a" roughness={0.7} />
        </mesh>

        {/* Mái tóc đen mượt ôm gọn đầu (Neat dark hair cap) */}
        <mesh castShadow position={[0, 1.99, -0.018]}>
          <sphereGeometry args={[0.244, 22, 20, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          <meshStandardMaterial color="#1f1612" roughness={0.82} />
        </mesh>
        {/* Phần tóc sau gáy ôm trọn đầu (Back hair coverage so neck/back of head looks natural from follow camera) */}
        <mesh castShadow position={[0, 1.93, -0.09]} scale={[0.96, 0.88, 0.82]}>
          <sphereGeometry args={[0.22, 18, 16]} />
          <meshStandardMaterial color="#1f1612" roughness={0.82} />
        </mesh>
        {/* Búi tóc truyền thống gọn gàng sau đầu (Neat back hair bun + cloth tie + wooden hairpin) */}
        <group position={[0, 1.94, -0.25]}>
          {/* Dải vải lam buộc búi tóc (Matching slate-blue hair tie ring) */}
          <mesh position={[0, 0, 0.025]} rotation={[0.15, 0, 0]}>
            <torusGeometry args={[0.072, 0.016, 8, 16]} />
            <meshStandardMaterial color="#4b6075" roughness={0.8} />
          </mesh>
          {/* Búi tóc tròn (Hair bun) */}
          <mesh castShadow position={[0, 0, -0.015]} scale={[1.05, 0.95, 0.88]}>
            <sphereGeometry args={[0.088, 16, 14]} />
            <meshStandardMaterial color="#1f1612" roughness={0.82} />
          </mesh>
          {/* Trâm gỗ trầm cài tóc (Wooden hairpin) */}
          <mesh position={[0, 0.005, -0.01]} rotation={[0, 0, Math.PI / 2 - 0.18]}>
            <cylinderGeometry args={[0.009, 0.006, 0.24, 8]} />
            <meshStandardMaterial color="#5c3820" roughness={0.55} />
          </mesh>
          <mesh position={[0.115, 0.026, -0.01]}>
            <sphereGeometry args={[0.016, 8, 8]} />
            <meshStandardMaterial color="#d6b265" roughness={0.45} metalness={0.3} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
