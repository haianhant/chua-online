'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import { MainHall, TamQuan, Garden } from './Temple';
import GuanyinGLB from './GuanyinGLB';
import IncenseBurner from './IncenseBurner';
import LotusPond from './Pond';
import Player from './Player';
import RemotePlayers from './RemotePlayers';
import CameraRig from './CameraRig';
import { controls, isInHall } from './controls';
import Grounds from './Grounds';
import Lumbini from './Lumbini';

type Props = {
  name: string;
  entered: boolean;
  canMove: boolean;
  burnerStage: 'idle' | 'inserting' | 'lit';
  insertT: number;
  lowQuality: boolean;
  onZone: (zone: 'burner' | 'chant' | 'pond' | 'altar' | 'none') => void;
  onInteractBurner: () => void;
  onGroundClick: () => void;
  hideOthers: boolean;
  /** A remote player offered incense in the last few seconds. */
  remoteIncenseActive: boolean;
  /** Local fish release: increments per release, with its count. */
  spawnTick: number;
  spawnCount: number;
  /** Remote player's release: increments per remote release. */
  remoteTick: number;
  onFishCount?: (n: number) => void;
  soilWet: boolean;
  waterStream: boolean;
  carryingWater: boolean;
  /** Bell ring trigger: increments per local ring, drives the mallet. */
  bellRingSeq: number;
  /** Vesak festival decoration on/off (localStorage, default off). */
  festivalOn: boolean;
};

/**
 * Afternoon temple world: warm sun through the trees, soft shadows,
 * misty hills and a light sky — no dark empty background.
 * Clicking the ground (not a drag) sets a walk-to target.
 */
export default function World({
  name,
  entered,
  canMove,
  burnerStage,
  insertT,
  lowQuality,
  onZone,
  onInteractBurner,
  onGroundClick,
  hideOthers,
  remoteIncenseActive,
  spawnTick,
  spawnCount,
  remoteTick,
  onFishCount,
  soilWet,
  waterStream,
  carryingWater,
  bellRingSeq,
  festivalOn,
}: Props) {
  return (
    <Canvas
      shadows={!lowQuality}
      dpr={lowQuality ? [1, 1.5] : [1, 2]}
      camera={{ position: [0, 5, 20], fov: 50 }}
      gl={{ antialias: true }}
      onCreated={() => {
        controls.mode = 'menu';
      }}
    >
      {/* Warm afternoon sky + matching fog for depth */}
      <Sky sunPosition={[-30, 18, -20]} turbidity={6} rayleigh={1.2} />
      <fog attach="fog" args={['#e6d9b8', 28, 72]} />

      <hemisphereLight args={['#cfe8ff', '#7a5c3a', 0.75]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[-18, 16, 8]}
        intensity={2.2}
        color="#ffd9a0"
        castShadow={!lowQuality}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-far={60}
      />

      <Suspense fallback={null}>
        <Garden />
        <MainHall entered={entered} />
        <TamQuan />
        {/* Chant pavilion REMOVED 2026-11-03 at the user's order:
            it stood next to the banyan, cluttered that corner, and
            there was no Buddha there to chant to. Chanting now
            happens inside the main hall, facing the main altar. */}
      </Suspense>
      {/* Thousand-Armed Guanyin, seated on the raised altar platform
          (hall floor 0.975 + platform 0.36 = 1.335) at the altar end
          of the EXPANDED hall (world z -23.5, back wall -26) */}
      <group position={[0, 1.335, -23.5]}>
        <GuanyinGLB />
      </group>
      <Grounds
        soilWet={soilWet}
        waterStream={waterStream}
        carryingWater={carryingWater}
        bellRingSeq={bellRingSeq}
      />
      {/* Vườn Lâm Tỳ Ni – Lễ đài Tắm Phật (Request E): behind the
          bell tower, left of the hall. Statue slot is intentionally
          empty until a licensed infant model is approved. */}
      <Lumbini festivalOn={festivalOn} />
      <LotusPond spawnTick={spawnTick} spawnCount={spawnCount} remoteTick={remoteTick} onFishCount={onFishCount} />

      {/* The burner itself is NEVER moved, rotated or resized by
          multiplayer. Remote incense only adds a short, static smoke
          puff at the burner's fixed position, capped at one puff. */}
      <IncenseBurner stage={burnerStage} insertT={insertT} onInteract={onInteractBurner} />
      {remoteIncenseActive && (
        <group position={[0, 1.5, -2.2]}>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.12, 12, 12]} />
            <meshStandardMaterial color="#e8e8e8" transparent opacity={0.55} />
          </mesh>
          <mesh position={[0.05, 0.35, 0]}>
            <sphereGeometry args={[0.18, 12, 12]} />
            <meshStandardMaterial color="#e8e8e8" transparent opacity={0.35} />
          </mesh>
          <mesh position={[-0.05, 0.7, 0]}>
            <sphereGeometry args={[0.24, 12, 12]} />
            <meshStandardMaterial color="#e8e8e8" transparent opacity={0.2} />
          </mesh>
        </group>
      )}

      {/* Invisible ground click-plane for click-to-move */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.06, -4]}
        onClick={(e) => {
          if (e.delta < 8 && canMove && entered) {
            // Clicking inside the hall from the courtyard would walk
            // straight through the burner (x 0, z -2.2) and stall
            // head-on, so route around its west side first, then
            // through the centre doorway — same detour as the
            // "Vào chính điện" button.
            if (isInHall(e.point.x, e.point.z) && controls.playerPos.z > -2.2) {
              controls.waypoints = [
                { x: -2.5, z: 0.5 },
                { x: -2.5, z: -4 },
                { x: 0, z: -4 },
                { x: 0, z: -7 },
              ];
            } else {
              controls.waypoints = [];
            }
            controls.moveTarget = { x: e.point.x, z: e.point.z };
            onGroundClick();
          }
        }}
      >
        <planeGeometry args={[50, 62]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <Player name={name} visible={entered} canMove={canMove} onZone={onZone} />
      <RemotePlayers hidden={hideOthers || !entered} />
      <CameraRig />
    </Canvas>
  );
}
