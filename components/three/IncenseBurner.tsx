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
 * Đỉnh đồng / Lư hương truyền thống trước Chính điện (vị trí lùi nhẹ về sát
 * trước bậc thềm z = -2.65 để lối đi sân chùa thông thoáng, đúng bố cục chùa Việt).
 * Gồm: bệ đá xanh chạm sen 3 cấp, 3 chân đỉnh dáng hổ phù, bầu lư đồng cổ đúc nổi
 * hoa văn lưỡng long chầu nguyệt, đôi tai lư uốn vân mây, tro hương mịn và khói trầm.
 */
export default function IncenseBurner({ stage, insertT, onInteract }: Props) {
  const smokeRef = useRef<THREE.Points>(null);
  const glowRef = useRef<THREE.PointLight>(null);

  // Bầu lư đồng đúc nguyên khối bằng LatheGeometry (từ đáy bầu y=0 đến miệng lư y=0.68)
  const cauldronGeo = useMemo(() => {
    const pts: THREE.Vector2[] = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.42, 0.02),
      new THREE.Vector2(0.58, 0.10),
      new THREE.Vector2(0.72, 0.24),
      new THREE.Vector2(0.75, 0.36),
      new THREE.Vector2(0.68, 0.48),
      new THREE.Vector2(0.60, 0.56),
      new THREE.Vector2(0.66, 0.62),
      new THREE.Vector2(0.74, 0.66),
      new THREE.Vector2(0.74, 0.70),
      new THREE.Vector2(0.64, 0.70),
      new THREE.Vector2(0.60, 0.62),
    ];
    return new THREE.LatheGeometry(pts, 32);
  }, []);

  const { positions, speeds } = useMemo(() => {
    const positions = new Float32Array(SMOKE_COUNT * 3);
    const speeds = new Float32Array(SMOKE_COUNT);
    for (let i = 0; i < SMOKE_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 0.28;
      positions[i * 3 + 1] = Math.random() * 2.2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.28;
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
        arr[i * 3] += Math.sin(t * 1.1 + i) * 0.0012;
        if (arr[i * 3 + 1] > 2.4) {
          arr[i * 3 + 1] = 0;
          arr[i * 3] = (Math.random() - 0.5) * 0.28;
          arr[i * 3 + 2] = (Math.random() - 0.5) * 0.28;
        }
      }
      attr.needsUpdate = true;
      (pts.material as THREE.PointsMaterial).opacity = 0.3 + Math.sin(t) * 0.05;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onInteract();
  };

  const stickScale = stage === 'inserting' ? Math.max(0.05, insertT) : stage === 'lit' ? 1 : 0;
  const bronzeMain = '#7a5930';
  const bronzeDark = '#543c1e';
  const bronzeGold = '#c89e32';
  const stoneBase = '#858178';
  const stoneDark = '#6e6a62';

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
      {/* 1. Bệ đá xanh chạm hoa sen 3 cấp (3-tier carved bluestone pedestal) */}
      <mesh receiveShadow castShadow position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.92, 0.98, 0.12, 8]} />
        <meshStandardMaterial color={stoneBase} roughness={0.92} />
      </mesh>
      <mesh receiveShadow castShadow position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.72, 0.78, 0.10, 16]} />
        <meshStandardMaterial color={stoneDark} roughness={0.94} />
      </mesh>
      <mesh receiveShadow castShadow position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.80, 0.72, 0.10, 16]} />
        <meshStandardMaterial color={stoneBase} roughness={0.9} />
      </mesh>
      {/* Cánh sen đá chạm quanh bệ trên */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <mesh
            key={`spetal-${i}`}
            position={[Math.cos(a) * 0.76, 0.26, Math.sin(a) * 0.76]}
            rotation={[0, -a, 0]}
            scale={[0.8, 1, 1.2]}
          >
            <sphereGeometry args={[0.065, 8, 8]} />
            <meshStandardMaterial color="#969288" roughness={0.9} />
          </mesh>
        );
      })}

      {/* 2. Ba chân đỉnh dáng chân lân / hổ phù vững chãi (3 sculpted cabriole tripod legs) */}
      {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((ang, i) => {
        const lx = Math.sin(ang) * 0.48;
        const lz = Math.cos(ang) * 0.48;
        return (
          <group key={`leg-${i}`} position={[lx, 0.30, lz]} rotation={[0, ang, 0]}>
            {/* Bàn chân lân đặt trên bệ đá */}
            <mesh castShadow position={[0, 0.04, 0.05]} scale={[1.1, 0.65, 1.3]}>
              <sphereGeometry args={[0.105, 12, 10]} />
              <meshStandardMaterial color={bronzeDark} metalness={0.62} roughness={0.42} />
            </mesh>
            {/* Ống chân đỉnh hơi cong khỏe khoắn */}
            <mesh castShadow position={[0, 0.19, 0.02]} rotation={[-0.18, 0, 0]}>
              <cylinderGeometry args={[0.095, 0.08, 0.30, 12]} />
              <meshStandardMaterial color={bronzeMain} metalness={0.6} roughness={0.4} />
            </mesh>
            {/* Đầu hổ phù đắp nổi nơi gối chân đỉnh */}
            <mesh castShadow position={[0, 0.30, 0.06]} scale={[1.15, 1.0, 0.85]}>
              <sphereGeometry args={[0.11, 12, 10]} />
              <meshStandardMaterial color={bronzeGold} metalness={0.68} roughness={0.35} />
            </mesh>
          </group>
        );
      })}

      {/* 3. Bầu lư đồng trầm cổ (Bulbous bronze cauldron body, y = 0.54..1.24) */}
      <mesh castShadow geometry={cauldronGeo} position={[0, 0.54, 0]}>
        <meshStandardMaterial color={bronzeMain} metalness={0.62} roughness={0.38} side={THREE.DoubleSide} />
      </mesh>
      {/* Đai đồng chạm nổi hồi văn & viền miệng lư thếp vàng */}
      <mesh position={[0, 0.88, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.745, 0.026, 10, 32]} />
        <meshStandardMaterial color={bronzeGold} metalness={0.72} roughness={0.32} />
      </mesh>
      <mesh position={[0, 1.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.685, 0.02, 10, 32]} />
        <meshStandardMaterial color={bronzeGold} metalness={0.72} roughness={0.32} />
      </mesh>
      <mesh position={[0, 1.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.70, 0.042, 12, 32]} />
        <meshStandardMaterial color={bronzeGold} metalness={0.72} roughness={0.32} />
      </mesh>

      {/* Phù điêu Mặt Nguyệt / Hoa Sen đắp nổi mặt trước (+Z) và mặt sau (-Z) */}
      {[-1, 1].map((side) => (
        <group key={`relief-${side}`} position={[0, 0.90, side * 0.74]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.14, 0.14, 0.03, 16]} />
            <meshStandardMaterial color={bronzeGold} metalness={0.75} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0, side * 0.018]}>
            <sphereGeometry args={[0.075, 12, 12]} />
            <meshStandardMaterial color="#e0b848" metalness={0.78} roughness={0.25} />
          </mesh>
        </group>
      ))}

      {/* 4. Đôi tai lư dáng mây / rồng uốn cong hai bên (Sculpted cloud-scroll ear handles at ±X) */}
      {[-1, 1].map((s) => (
        <group key={`ear-${s}`} position={[s * 0.70, 0.98, 0]}>
          {/* Vòng tai lư uốn cong lên trên */}
          <mesh castShadow position={[s * 0.08, 0.06, 0]} rotation={[0, 0, s * -0.35]}>
            <torusGeometry args={[0.16, 0.038, 10, 20, Math.PI * 1.35]} />
            <meshStandardMaterial color={bronzeGold} metalness={0.68} roughness={0.35} />
          </mesh>
          {/* Đầu vân mây xoắn trên đỉnh tai lư */}
          <mesh castShadow position={[s * 0.16, 0.22, 0]}>
            <sphereGeometry args={[0.055, 10, 10]} />
            <meshStandardMaterial color={bronzeGold} metalness={0.72} roughness={0.32} />
          </mesh>
          {/* Thanh nối dưới tai lư vào bầu đồng */}
          <mesh castShadow position={[s * 0.04, -0.08, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.032, 0.036, 0.16, 8]} />
            <meshStandardMaterial color={bronzeMain} metalness={0.62} roughness={0.38} />
          </mesh>
        </group>
      ))}

      {/* 5. Lớp tro trầm mịn & chân nhang đỏ trong lòng lư (Fine incense ash bed & red stems) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1.19, 0]}>
        <circleGeometry args={[0.63, 28]} />
        <meshStandardMaterial color="#c8bca4" roughness={0.98} />
      </mesh>
      {/* Một vài chân hương đỏ cắm sẵn tạo vẻ ấm cúng nơi cửa Phật */}
      {[
        [-0.08, 0.06], [0.09, 0.05], [-0.04, -0.07], [0.05, -0.06], [0, 0.08],
      ].map(([sx, sz], i) => (
        <mesh key={`stem-${i}`} position={[sx, 1.28, sz]} rotation={[(i - 2) * 0.03, 0, (i % 2 ? 1 : -1) * 0.04]}>
          <cylinderGeometry args={[0.008, 0.008, 0.22, 6]} />
          <meshStandardMaterial color="#8f2424" roughness={0.75} />
        </mesh>
      ))}

      {/* 6. Ba nén hương trầm dâng lễ (Three incense sticks growing from the ash) */}
      {stage !== 'idle' &&
        [-0.16, 0, 0.16].map((x, i) => (
          <group key={i} position={[x, 1.19 + 0.42 * stickScale, 0]} rotation={[0, 0, (i - 1) * 0.05]}>
            {/* Chân hương đỏ */}
            <mesh position={[0, -0.18 * stickScale, 0]} scale={[1, stickScale, 1]}>
              <cylinderGeometry args={[0.014, 0.014, 0.36, 8]} />
              <meshStandardMaterial color="#8f1d1d" roughness={0.65} />
            </mesh>
            {/* Phần thịt hương trầm màu nâu vàng */}
            <mesh position={[0, 0.12 * stickScale, 0]} scale={[1, stickScale, 1]}>
              <cylinderGeometry args={[0.02, 0.02, 0.56, 8]} />
              <meshStandardMaterial color="#a67c46" roughness={0.75} />
            </mesh>
            {/* Đốm lửa hồng đầu nén nhang */}
            <mesh position={[0, 0.41 * stickScale, 0]}>
              <sphereGeometry args={[0.036, 10, 10]} />
              <meshStandardMaterial
                color="#ff5a1a"
                emissive="#ff6a00"
                emissiveIntensity={stage === 'lit' ? 2.6 : stage === 'inserting' ? insertT * 2 : 0}
              />
            </mesh>
          </group>
        ))}

      <pointLight ref={glowRef} position={[0, 1.9, 0]} color="#ffb347" intensity={0} distance={6} decay={2} />

      {stage === 'lit' && (
        <points ref={smokeRef} position={[0, 1.7, 0]}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          </bufferGeometry>
          <pointsMaterial size={0.14} color="#efe8d8" transparent opacity={0.3} sizeAttenuation depthWrite={false} />
        </points>
      )}
    </group>
  );
}
