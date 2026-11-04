'use client';

import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { multiplayer, type RemotePlayer } from '@/lib/multiplayer';
import { floorYAt } from './controls';

/**
 * Renders other players in the same room.
 *
 * Movement is interpolated, never snapped (except on first appearance
 * or after a >8m gap, e.g. a reconnect): each frame the avatar moves
 * towards its latest server target at most 4.5 m/s, so lag shows as
 * a slightly delayed, smooth walk — never as teleporting or as a
 * backwards yank. Extrapolation is deliberately NOT used: if no new
 * update arrives, the avatar simply stops, rather than running
 * through a wall or a tree.
 *
 * The avatar's body faces its movement direction (server `facing`);
 * only the name label billboards to the camera, via drei Html.
 * Labels are staggered vertically by a stable hash so two people
 * standing close together don't get perfectly overlapping labels.
 * No shadows for remote avatars — that keeps 15 players cheap.
 */

function hashLabelOffset(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 3) * 0.18;
}

function RemoteAvatar({ player }: { player: RemotePlayer }) {
  const group = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const pos = useRef(new THREE.Vector3(player.target.x, 0, player.target.z));
  const labelY = 2.32 + hashLabelOffset(player.id);

  // Snap on first mount only.
  useEffect(() => {
    pos.current.set(player.target.x, 0, player.target.z);
    if (group.current) group.current.position.copy(pos.current);
  }, [player.id]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const t = multiplayer.players.get(player.id)?.target ?? player.target;
    const dx = t.x - pos.current.x;
    const dz = t.z - pos.current.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 8) {
      // Reconnect / long gap: a single snap is honest here.
      pos.current.set(t.x, 0, t.z);
    } else if (dist > 0.01) {
      // Interpolate, capped so lag never looks like sprinting.
      const step = Math.min(dist, 4.5 * Math.max(dt, 0.001));
      pos.current.x += (dx / dist) * step;
      pos.current.z += (dz / dist) * step;
    }
    g.position.copy(pos.current);
    g.rotation.y = t.facing;

    const walking = t.state === 'walking' && dist > 0.02;
    const time = performance.now() / 1000;
    const swing = walking ? Math.sin(time * 8) * 0.5 : 0;
    if (leftLeg.current) leftLeg.current.rotation.x = swing;
    if (rightLeg.current) rightLeg.current.rotation.x = -swing;
    if (leftArm.current) leftArm.current.rotation.x = walking ? -swing * 0.7 : 0;
    if (rightArm.current) rightArm.current.rotation.x = walking ? swing * 0.7 : 0;
    // Hall floor / platform height, so remote players do not sink
    // into the hall floor when they walk inside.
    const fy = floorYAt(pos.current.x, pos.current.z);
    if (t.state === 'sitting') {
      g.position.y = fy - 0.55;
      if (body.current) body.current.rotation.x = 0.08;
    } else {
      g.position.y = fy;
      if (body.current) body.current.rotation.x = 0;
    }
    if (t.state === 'praying' || t.state === 'offering_incense') {
      // Hands together in front of the chest.
      if (leftArm.current) {
        leftArm.current.rotation.x = -0.9;
        leftArm.current.rotation.z = 0.5;
      }
      if (rightArm.current) {
        rightArm.current.rotation.x = -0.9;
        rightArm.current.rotation.z = -0.5;
      }
    } else if (!walking) {
      if (leftArm.current) {
        leftArm.current.rotation.x = 0;
        leftArm.current.rotation.z = 0.12;
      }
      if (rightArm.current) {
        rightArm.current.rotation.x = 0;
        rightArm.current.rotation.z = -0.12;
      }
    }
    // Idle breathing.
    if (body.current && t.state === 'idle') {
      body.current.scale.y = 1 + Math.sin(time * 1.8) * 0.012;
    }
  });

  return (
    <group ref={group} position={[player.target.x, 0, player.target.z]}>
      {/* Name label — billboards via Html; the body does not. */}
      <Html position={[0, labelY, 0]} center distanceFactor={14} occlude={false} style={{ pointerEvents: 'none' }}>
        <div className="whitespace-nowrap rounded-full bg-stone-900/70 px-2 py-0.5 text-center text-[11px] font-medium text-white shadow">
          {player.name}
        </div>
      </Html>
      {/* Phật tử mặc bộ đồ lam đi chùa trang nhã, không đội nón trong khuôn viên chùa */}
      <group ref={body}>
        {/* Áo lam thân trên + tà áo dưới */}
        <mesh position={[0, 1.44, 0]}>
          <cylinderGeometry args={[0.24, 0.26, 0.44, 14]} />
          <meshStandardMaterial color="#6e859c" roughness={0.85} />
        </mesh>
        <mesh position={[0, 1.01, 0]}>
          <cylinderGeometry args={[0.255, 0.34, 0.46, 14]} />
          <meshStandardMaterial color="#6e859c" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.79, 0]}>
          <cylinderGeometry args={[0.338, 0.342, 0.03, 14]} />
          <meshStandardMaterial color={player.color || '#4b6075'} roughness={0.85} />
        </mesh>
        {/* Cổ tàu + nẹp vạt chéo */}
        <mesh position={[0, 1.67, 0]}>
          <cylinderGeometry args={[0.135, 0.145, 0.07, 12]} />
          <meshStandardMaterial color="#4b6075" roughness={0.85} />
        </mesh>
        <mesh position={[0.08, 1.54, 0.25]} rotation={[0, 0, -0.62]}>
          <boxGeometry args={[0.03, 0.28, 0.018]} />
          <meshStandardMaterial color="#4b6075" roughness={0.85} />
        </mesh>
        {/* Đầu + tóc búi gọn */}
        <mesh position={[0, 1.95, 0]}>
          <sphereGeometry args={[0.23, 16, 16]} />
          <meshStandardMaterial color="#ecc39e" roughness={0.72} />
        </mesh>
        <mesh position={[0, 1.98, -0.02]}>
          <sphereGeometry args={[0.24, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          <meshStandardMaterial color="#1f1612" roughness={0.85} />
        </mesh>
        <mesh position={[0, 1.93, -0.25]}>
          <sphereGeometry args={[0.082, 12, 10]} />
          <meshStandardMaterial color="#1f1612" roughness={0.85} />
        </mesh>
      </group>
      {/* Quần lam + giày vải */}
      <group ref={leftLeg} position={[-0.135, 0.48, 0]}>
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.105, 0.12, 0.82, 12]} />
          <meshStandardMaterial color="#5c738a" roughness={0.86} />
        </mesh>
        <mesh position={[0, -0.44, 0.025]}>
          <boxGeometry args={[0.14, 0.07, 0.24]} />
          <meshStandardMaterial color="#382e28" roughness={0.88} />
        </mesh>
      </group>
      <group ref={rightLeg} position={[0.135, 0.48, 0]}>
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.105, 0.12, 0.82, 12]} />
          <meshStandardMaterial color="#5c738a" roughness={0.86} />
        </mesh>
        <mesh position={[0, -0.44, 0.025]}>
          <boxGeometry args={[0.14, 0.07, 0.24]} />
          <meshStandardMaterial color="#382e28" roughness={0.88} />
        </mesh>
      </group>
      {/* Tay áo lam dài + bàn tay */}
      <group ref={leftArm} position={[-0.34, 1.58, 0]}>
        <mesh position={[0, -0.22, 0]}>
          <cylinderGeometry args={[0.085, 0.095, 0.44, 12]} />
          <meshStandardMaterial color="#6e859c" roughness={0.85} />
        </mesh>
        <mesh position={[0, -0.48, 0]}>
          <sphereGeometry args={[0.06, 10, 8]} />
          <meshStandardMaterial color="#ecc39e" roughness={0.72} />
        </mesh>
      </group>
      <group ref={rightArm} position={[0.34, 1.58, 0]}>
        <mesh position={[0, -0.22, 0]}>
          <cylinderGeometry args={[0.085, 0.095, 0.44, 12]} />
          <meshStandardMaterial color="#6e859c" roughness={0.85} />
        </mesh>
        <mesh position={[0, -0.48, 0]}>
          <sphereGeometry args={[0.06, 10, 8]} />
          <meshStandardMaterial color="#ecc39e" roughness={0.72} />
        </mesh>
      </group>
    </group>
  );
}

export default function RemotePlayers({ hidden }: { hidden: boolean }) {
  const [, setVersion] = useState(0);
  useEffect(() => multiplayer.subscribe(() => setVersion((v) => v + 1)), []);
  if (hidden) return null;
  const players = Array.from(multiplayer.players.values());
  return (
    <>
      {players.map((p) => (
        <RemoteAvatar key={p.id} player={p} />
      ))}
    </>
  );
}
