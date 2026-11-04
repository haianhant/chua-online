'use client';

import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { LAYOUT } from './controls';

const SMOKE_COUNT = 90;

type Props = {
  /** 'idle' | 'inserting' (sticks grow in) | 'lit' (smoke + ember) */
  stage: 'idle' | 'inserting' | 'lit';
  insertT: number; // 0..1 while inserting
  onInteract: () => void;
};

/**
 * Large bronze burner, correctly proportioned in front of the hall.
 * Sticks never pop in: during 'inserting' they scale up from the sand
 * over ~1.4s, then ember + smoke fade in. Clicking the burner (or the
 * on-screen button / E key when near) starts the ritual in the UI.
 */
export default function IncenseBurner({ stage, insertT, onInteract }: Props) {
  const smokeRef = useRef<THREE.Points>(null);
  const glowRef = useRef<THREE.PointLight>(null);

  const { positions, speeds } = useMemo(() => {
    const positions = new Float32Array(SMOKE_COUNT * 3);
    const speeds = new Float32Array(SMOKE_COUNT);
    for (let i = 0; i < SMOKE_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 0.3;
      positions[i * 3 + 1] = Math.random() * 2.2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
      speeds[i] = 0.25 + Math.random() * 0.35;
    }
    return { positions, speeds };
  }, []);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    if (glowRef.current) {
      glowRef.current.intensity = stage === 'lit' ? 6 + Math.sin(t * 2.5) * 1.2 : 0;
    }
    const pts = smokeRef.current;
    if (pts && stage === 'lit') {
      const attr = pts.geometry.attributes.position as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < SMOKE_COUNT; i++) {
        arr[i * 3 + 1] += speeds[i] * delta;
        arr[i * 3] += Math.sin(t * 1.1 + i) * 0.001;
        if (arr[i * 3 + 1] > 2.4) {
          arr[i * 3 + 1] = 0;
          arr[i * 3] = (Math.random() - 0.5) * 0.3;
          arr[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
        }
      }
      attr.needsUpdate = true;
      (pts.material as THREE.PointsMaterial).opacity = 0.28 + Math.sin(t) * 0.05;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onInteract();
  };

  const stickScale = stage === 'inserting' ? Math.max(0.05, insertT) : stage === 'lit' ? 1 : 0;

  return (
    <group
      position={[LAYOUT.burner.x, 0, LAYOUT.burner.z]}
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
      }}
    >
      {/* Three legs */}
      {[-0.5, 0.5, 0].map((x, i) => (
        <mesh key={i} castShadow position={[x, 0.15, i === 2 ? 0.55 : -0.4]}>
          <cylinderGeometry args={[0.09, 0.12, 0.3, 10]} />
          <meshStandardMaterial color="#5a4020" metalness={0.6} roughness={0.45} />
        </mesh>
      ))}
      {/* Body */}
      <mesh castShadow position={[0, 0.65, 0]}>
        <cylinderGeometry args={[0.85, 0.62, 0.7, 24]} />
        <meshStandardMaterial color="#8c6a3f" metalness={0.55} roughness={0.4} />
      </mesh>
      {/* Decorative band + rim */}
      <mesh position={[0, 0.82, 0]}>
        <cylinderGeometry args={[0.87, 0.87, 0.12, 24]} />
        <meshStandardMaterial color="#c9a227" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.02, 0]}>
        <torusGeometry args={[0.82, 0.05, 10, 28]} />
        <meshStandardMaterial color="#c9a227" metalness={0.7} roughness={0.35} />
      </mesh>
      {/* Sand */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1.0, 0]}>
        <circleGeometry args={[0.78, 24]} />
        <meshStandardMaterial color="#c8b490" roughness={1} />
      </mesh>

      {/* Three sticks, growing in from the sand while inserting */}
      {stage !== 'idle' &&
        [-0.22, 0, 0.22].map((x, i) => (
          <group key={i} position={[x, 1.0 + 0.45 * stickScale, 0]} rotation={[0, 0, (i - 1) * 0.05]}>
            <mesh scale={[1, stickScale, 1]}>
              <cylinderGeometry args={[0.022, 0.022, 0.9, 8]} />
              <meshStandardMaterial color="#7a1f1f" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.45 * stickScale, 0]}>
              <sphereGeometry args={[0.045, 10, 10]} />
              <meshStandardMaterial
                color="#ff5a1a"
                emissive="#ff6a00"
                emissiveIntensity={stage === 'lit' ? 2.5 : stage === 'inserting' ? insertT * 2 : 0}
              />
            </mesh>
          </group>
        ))}

      <pointLight ref={glowRef} position={[0, 1.8, 0]} color="#ffb347" intensity={0} distance={6} decay={2} />

      {stage === 'lit' && (
        <points ref={smokeRef} position={[0, 1.6, 0]}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          </bufferGeometry>
          <pointsMaterial size={0.14} color="#efe8d8" transparent opacity={0.28} sizeAttenuation depthWrite={false} />
        </points>
      )}
    </group>
  );
}
