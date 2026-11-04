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
  const leftLeg = useRef<THREE.Mesh>(null);
  const rightLeg = useRef<THREE.Mesh>(null);
  const leftArm = useRef<THREE.Mesh>(null);
  const rightArm = useRef<THREE.Mesh>(null);
  const body = useRef<THREE.Mesh>(null);
  const pos = useRef(new THREE.Vector3(player.target.x, 0, player.target.z));
  const labelY = 2.35 + hashLabelOffset(player.id);

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
      {/* Visitor: tunic colour differs per player, nón lá like the local player. */}
      <mesh position={[0, 0.85, 0]} ref={body}>
        <boxGeometry args={[0.55, 0.85, 0.32]} />
        <meshStandardMaterial color={player.color} />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color="#e8c9a8" />
      </mesh>
      <mesh position={[0, 1.72, 0]} rotation={[0.35, 0, 0]}>
        <coneGeometry args={[0.55, 0.28, 20]} />
        <meshStandardMaterial color="#d9b36a" />
      </mesh>
      <mesh ref={leftLeg} position={[-0.16, 0.4, 0]}>
        <boxGeometry args={[0.2, 0.8, 0.2]} />
        <meshStandardMaterial color="#3a3a3a" />
      </mesh>
      <mesh ref={rightLeg} position={[0.16, 0.4, 0]}>
        <boxGeometry args={[0.2, 0.8, 0.2]} />
        <meshStandardMaterial color="#3a3a3a" />
      </mesh>
      <mesh ref={leftArm} position={[-0.38, 1.15, 0]}>
        <boxGeometry args={[0.16, 0.7, 0.16]} />
        <meshStandardMaterial color={player.color} />
      </mesh>
      <mesh ref={rightArm} position={[0.38, 1.15, 0]}>
        <boxGeometry args={[0.16, 0.7, 0.16]} />
        <meshStandardMaterial color={player.color} />
      </mesh>
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
