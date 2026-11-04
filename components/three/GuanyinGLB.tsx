'use client';
import { Suspense } from 'react';
import { useGLTF } from '@react-three/drei';

// v6 Blender statue (user-approved 2026-11-03): Thousand-Armed Guanyin,
// But Thap-inspired, built by a Blender script, exported as GLB.
// Origin at floor under the base, front faces +Z in Three.js (Blender
// front -Y converted by glTF), height ~3.7m + base, static, no animation,
// no parent transform changes at runtime.
export default function GuanyinGLB() {
  const { scene } = useGLTF('/models/guanyin-but-thap.glb');
  return (
    <Suspense fallback={null}>
      <primitive object={scene} />
    </Suspense>
  );
}
useGLTF.preload('/models/guanyin-but-thap.glb');
