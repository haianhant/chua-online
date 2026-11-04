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
 * Stylized visitor in áo dài-inspired dress + nón lá, natural proportions.
 * Walk: legs/arms swing, body bobs. Idle: gentle breathing.
 * Sit: lowered, legs folded, hands together. Pray: standing, hands together.
 */
export default function Player({ name, visible, canMove, onZone }: Props) {
  const group = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);
  const armL = useRef<THREE.Mesh>(null);
  const armR = useRef<THREE.Mesh>(null);
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
      <Html center position={[0, 2.35, 0]} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="whitespace-nowrap rounded-full border border-white/40 bg-black/45 px-3 py-1 font-sans text-xs font-medium text-amber-50 shadow">
          {name}
        </div>
      </Html>
      <group ref={body}>
        {/* Legs (trousers) */}
        {[-0.14, 0.14].map((x, i) => (
          <mesh
            key={i}
            ref={i === 0 ? legL : legR}
            position={[x, 0.48, 0]}
            castShadow
          >
            <boxGeometry args={[0.2, 0.95, 0.22]} />
            <meshStandardMaterial color="#2e3a4a" roughness={0.85} />
          </mesh>
        ))}
        {/* Áo dài-inspired tunic */}
        <mesh castShadow position={[0, 1.28, 0]}>
          <cylinderGeometry args={[0.32, 0.42, 0.95, 12]} />
          <meshStandardMaterial color="#e8e0cc" roughness={0.85} />
        </mesh>
        {/* Arms */}
        {[-0.42, 0.42].map((x, i) => (
          <mesh
            key={i}
            ref={i === 0 ? armL : armR}
            position={[x, 1.55, 0]}
            castShadow
          >
            <boxGeometry args={[0.14, 0.8, 0.16]} />
            <meshStandardMaterial color="#e8e0cc" roughness={0.85} />
          </mesh>
        ))}
        {/* Head + hair */}
        <mesh castShadow position={[0, 1.98, 0]}>
          <sphereGeometry args={[0.26, 20, 20]} />
          <meshStandardMaterial color="#e8b88a" roughness={0.7} />
        </mesh>
        <mesh position={[0, 2.12, -0.04]}>
          <sphereGeometry args={[0.27, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color="#2a1a12" roughness={0.9} />
        </mesh>
        {/* Nón lá */}
        <mesh castShadow position={[0, 2.28, 0]}>
          <coneGeometry args={[0.48, 0.28, 20]} />
          <meshStandardMaterial color="#d8c48a" roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
}
