'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { controls, floorYAt, monksState, type MonkId } from './controls';

type Props = {
  entered: boolean;
  onSelectMonk: (id: MonkId) => void;
};

const PATROL_ROUTES: Record<MonkId, Array<{ x: number; z: number; pauseSec: number }>> = {
  // Chú tiểu Tâm An: Đi kinh hành quanh sân trước, Tâm Liên Hồ, Gác chuông và Vườn Lâm Tỳ Ni
  taman: [
    { x: -6.5, z: 3.5, pauseSec: 4.5 },
    { x: -11.5, z: 3.2, pauseSec: 5.0 },
    { x: -17.5, z: -4.2, pauseSec: 4.5 },
    { x: -24.0, z: -18.0, pauseSec: 5.5 },
    { x: -17.5, z: -5.0, pauseSec: 4.0 },
    { x: -4.8, z: -1.8, pauseSec: 5.0 },
  ],
  // Chú tiểu Tâm Minh: Đi kinh hành quanh sân Đông, Cây đa Bách Linh, Vườn Lộc Uyển và Nhà Trà
  tamminh: [
    { x: 7.5, z: 5.5, pauseSec: 4.5 },
    { x: 18.2, z: 8.2, pauseSec: 5.5 },
    { x: 14.5, z: 1.5, pauseSec: 4.0 },
    { x: 14.8, z: -10.0, pauseSec: 4.0 },
    { x: 25.5, z: -11.5, pauseSec: 5.5 },
    { x: 33.8, z: -14.5, pauseSec: 5.0 },
    { x: 14.8, z: -10.0, pauseSec: 3.5 },
  ],
};

function SingleNoviceMonk({
  id,
  name,
  robeColor,
  innerCollarColor,
  sashColor,
  entered,
  onSelectMonk,
}: {
  id: MonkId;
  name: string;
  robeColor: string;
  innerCollarColor: string;
  sashColor: string;
  entered: boolean;
  onSelectMonk: (id: MonkId) => void;
}) {
  const route = PATROL_ROUTES[id];
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);

  const pos = useRef({ x: route[0].x, z: route[0].z });
  const wpIdx = useRef(1);
  const pauseTimer = useRef(1.5);
  const facing = useRef(0);
  const walkPhase = useRef(id === 'taman' ? 0 : 1.7);
  const greetBlend = useRef(0);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const g = group.current;
    if (!g) return;

    const mState = monksState[id];
    const distToPlayer = Math.hypot(
      controls.playerPos.x - pos.current.x,
      controls.playerPos.z - pos.current.z,
    );
    const nearPlayer = entered && distToPlayer < 3.2;
    const isGreeting = nearPlayer || mState.talking;

    let moving = false;
    if (isGreeting) {
      // Dừng bước, xoay người hướng về phía người Phật tử và chắp tay xá chào
      const targetAngle = Math.atan2(
        controls.playerPos.x - pos.current.x,
        controls.playerPos.z - pos.current.z,
      );
      let diff = targetAngle - facing.current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      facing.current += diff * (1 - Math.exp(-6 * dt));
    } else if (pauseTimer.current > 0) {
      pauseTimer.current -= dt;
    } else {
      const target = route[wpIdx.current];
      const dx = target.x - pos.current.x;
      const dz = target.z - pos.current.z;
      const dist = Math.hypot(dx, dz);
      const monkSpeed = 1.35; // Bước kinh hành khoan thai
      if (dist < 0.2) {
        pauseTimer.current = target.pauseSec;
        wpIdx.current = (wpIdx.current + 1) % route.length;
      } else {
        moving = true;
        const step = Math.min(dist, monkSpeed * dt);
        pos.current.x += (dx / dist) * step;
        pos.current.z += (dz / dist) * step;
        const targetAngle = Math.atan2(dx, dz);
        let diff = targetAngle - facing.current;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        facing.current += diff * (1 - Math.exp(-6 * dt));
        walkPhase.current += monkSpeed * dt * 3.1;
      }
    }

    const groundY = floorYAt(pos.current.x, pos.current.z);
    const bob = moving ? Math.abs(Math.sin(walkPhase.current)) * 0.032 : 0;
    g.position.set(pos.current.x, groundY + bob, pos.current.z);
    g.rotation.y = facing.current;

    // Cập nhật tọa độ thực tế vào monksState để UI nhận diện khoảng cách
    mState.x = pos.current.x;
    mState.z = pos.current.z;
    mState.facing = facing.current;

    const greetTarget = isGreeting || !moving ? 1 : 0;
    greetBlend.current += (greetTarget - greetBlend.current) * (1 - Math.exp(-5 * dt));
    const gb = greetBlend.current;

    const swing = moving ? Math.sin(walkPhase.current) * 0.46 : 0;
    const t = clock.getElapsedTime();
    const bowNod = isGreeting ? Math.pow(Math.max(0, Math.sin(t * 1.8)), 1.5) * 0.18 : 0;

    if (legL.current) legL.current.rotation.x = swing * (1 - gb);
    if (legR.current) legR.current.rotation.x = -swing * (1 - gb);

    if (armL.current) {
      // Khi đứng yên hoặc gặp Phật tử: hai tay chắp búp sen trước ngực
      armL.current.rotation.x = (-swing * 0.45) * (1 - gb) + (-0.95 - bowNod * 0.25) * gb;
      armL.current.rotation.z = -0.38 * gb;
    }
    if (armR.current) {
      armR.current.rotation.x = (swing * 0.45) * (1 - gb) + (-0.95 - bowNod * 0.25) * gb;
      armR.current.rotation.z = 0.38 * gb;
    }
    if (body.current) {
      body.current.rotation.x = bowNod;
    }
  });

  return (
    <group
      ref={group}
      position={[route[0].x, 0, route[0].z]}
      scale={[0.86, 0.86, 0.86]}
      onClick={(e) => {
        e.stopPropagation();
        if (entered) onSelectMonk(id);
      }}
    >
      {/* Nhãn tên Chú tiểu & gợi ý trò chuyện */}
      {entered && (
        <Html center position={[0, 2.38, 0]} zIndexRange={[5, 0]}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectMonk(id);
            }}
            className="cursor-pointer whitespace-nowrap rounded-full border border-amber-300/60 bg-stone-900/75 px-3 py-1 font-sans text-[11px] font-medium text-amber-100 shadow-md transition hover:border-amber-200 hover:bg-stone-800/90"
          >
            🙏 {name}
          </button>
        </Html>
      )}

      <group ref={body}>
        {/* Quần nâu sồng & Giày vải của chú tiểu */}
        {[-0.13, 0.13].map((lx, idx) => (
          <group key={`m-leg-${idx}`} ref={idx === 0 ? legL : legR} position={[lx, 0.48, 0]}>
            <mesh position={[0, 0.04, 0]} castShadow>
              <cylinderGeometry args={[0.105, 0.118, 0.82, 12]} />
              <meshStandardMaterial color={robeColor} roughness={0.88} />
            </mesh>
            {/* Tất vải ngà */}
            <mesh position={[0, -0.40, 0]}>
              <cylinderGeometry args={[0.072, 0.075, 0.08, 10]} />
              <meshStandardMaterial color="#e6dfd1" roughness={0.85} />
            </mesh>
            {/* Giày vải nâu */}
            <mesh position={[0, -0.435, 0.028]} castShadow>
              <boxGeometry args={[0.142, 0.065, 0.235]} />
              <meshStandardMaterial color="#3b2c22" roughness={0.88} />
            </mesh>
            <mesh position={[0, -0.47, 0.032]}>
              <boxGeometry args={[0.148, 0.022, 0.25]} />
              <meshStandardMaterial color="#dfd7c8" roughness={0.9} />
            </mesh>
          </group>
        ))}

        {/* Thân áo nhật bình / vạt hò nâu sồng của chú tiểu */}
        <mesh castShadow position={[0, 1.42, 0]}>
          <cylinderGeometry args={[0.25, 0.27, 0.44, 16]} />
          <meshStandardMaterial color={robeColor} roughness={0.86} />
        </mesh>
        <mesh castShadow position={[0, 1.61, 0]} scale={[1.28, 0.42, 0.92]}>
          <sphereGeometry args={[0.25, 14, 10]} />
          <meshStandardMaterial color={robeColor} roughness={0.86} />
        </mesh>
        {/* Vạt áo dưới rộng rãi */}
        <mesh castShadow position={[0, 0.99, 0]}>
          <cylinderGeometry args={[0.268, 0.34, 0.48, 16]} />
          <meshStandardMaterial color={robeColor} roughness={0.86} />
        </mesh>

        {/* Đai vải buộc bụng gọn gàng (Cloth waist sash) */}
        <mesh position={[0, 1.21, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.268, 0.024, 8, 18]} />
          <meshStandardMaterial color={sashColor} roughness={0.82} />
        </mesh>
        {/* Hai dải đai rủ nhẹ phía trước */}
        {[-0.035, 0.035].map((sx, idx) => (
          <mesh
            key={`sash-tail-${idx}`}
            position={[sx, 1.04, 0.285]}
            rotation={[-0.08, 0, idx === 0 ? -0.06 : 0.06]}
          >
            <boxGeometry args={[0.038, 0.32, 0.014]} />
            <meshStandardMaterial color={sashColor} roughness={0.82} />
          </mesh>
        ))}

        {/* Cổ giao lĩnh chữ Y truyền thống (Crossed inner & outer collar) */}
        <mesh position={[-0.045, 1.54, 0.246]} rotation={[0, 0, -0.52]}>
          <boxGeometry args={[0.042, 0.28, 0.018]} />
          <meshStandardMaterial color={innerCollarColor} roughness={0.84} />
        </mesh>
        <mesh position={[0.045, 1.54, 0.252]} rotation={[0, 0, 0.52]}>
          <boxGeometry args={[0.046, 0.30, 0.018]} />
          <meshStandardMaterial color={sashColor} roughness={0.84} />
        </mesh>

        {/* Cổ */}
        <mesh position={[0, 1.71, 0]}>
          <cylinderGeometry args={[0.112, 0.122, 0.10, 12]} />
          <meshStandardMaterial color="#eec6a2" roughness={0.72} />
        </mesh>

        {/* Hai cánh tay áo rộng của chú tiểu + tràng hạt gỗ */}
        {[-0.335, 0.335].map((ax, idx) => (
          <group key={`m-arm-${idx}`} ref={idx === 0 ? armL : armR} position={[ax, 1.56, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.092, 10, 10]} />
              <meshStandardMaterial color={robeColor} roughness={0.86} />
            </mesh>
            <mesh position={[0, -0.22, 0]} castShadow>
              <cylinderGeometry args={[0.09, 0.112, 0.44, 12]} />
              <meshStandardMaterial color={robeColor} roughness={0.86} />
            </mesh>
            <mesh position={[0, -0.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.066, 0.015, 8, 12]} />
              <meshStandardMaterial color="#54331b" roughness={0.65} />
            </mesh>
            <mesh position={[0, -0.49, 0.01]} scale={[0.85, 1.15, 0.95]} castShadow>
              <sphereGeometry args={[0.064, 10, 10]} />
              <meshStandardMaterial color="#eec6a2" roughness={0.72} />
            </mesh>
          </group>
        ))}

        {/* Đầu chú tiểu tròn trịa, cạo sạch hiền hòa */}
        <mesh castShadow position={[0, 1.96, 0]}>
          <sphereGeometry args={[0.242, 22, 22]} />
          <meshStandardMaterial color="#eec6a2" roughness={0.68} />
        </mesh>
        {/* Ánh da đầu cạo xanh mờ nhẹ trên đỉnh đầu */}
        <mesh position={[0, 2.00, -0.01]}>
          <sphereGeometry args={[0.238, 18, 16, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
          <meshStandardMaterial color="#d8b494" roughness={0.75} />
        </mesh>
        {/* Đôi tai */}
        {[-0.235, 0.235].map((ex, idx) => (
          <mesh key={`m-ear-${idx}`} position={[ex, 1.95, 0]} scale={[0.48, 0.88, 0.65]}>
            <sphereGeometry args={[0.058, 10, 10]} />
            <meshStandardMaterial color="#e6ba94" roughness={0.72} />
          </mesh>
        ))}
        {/* Chân mày thanh tú */}
        {[-0.075, 0.075].map((fx, idx) => (
          <mesh key={`m-brow-${idx}`} position={[fx, 2.02, 0.224]} rotation={[0, 0, idx === 0 ? 0.1 : -0.1]}>
            <boxGeometry args={[0.048, 0.011, 0.01]} />
            <meshStandardMaterial color="#2b1e16" roughness={0.85} />
          </mesh>
        ))}
        {/* Đôi mắt sáng trong veo */}
        {[-0.075, 0.075].map((fx, idx) => (
          <mesh key={`m-eye-${idx}`} position={[fx, 1.975, 0.23]}>
            <sphereGeometry args={[0.02, 10, 10]} />
            <meshStandardMaterial color="#1f1510" roughness={0.35} />
          </mesh>
        ))}
        {/* Má hồng hào nhẹ của chú tiểu nhỏ */}
        {[-0.125, 0.125].map((cx, idx) => (
          <mesh key={`m-cheek-${idx}`} position={[cx, 1.93, 0.21]} scale={[1, 0.65, 0.4]}>
            <sphereGeometry args={[0.026, 8, 8]} />
            <meshStandardMaterial color="#e59a87" roughness={0.8} transparent opacity={0.55} />
          </mesh>
        ))}
        {/* Nụ cười hoan hỷ */}
        <mesh position={[0, 1.895, 0.228]} rotation={[0.2, 0, 0]}>
          <torusGeometry args={[0.035, 0.007, 6, 12, Math.PI]} />
          <meshStandardMaterial color="#b56553" roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

export default function NoviceMonks({ entered, onSelectMonk }: Props) {
  return (
    <group>
      <SingleNoviceMonk
        id="taman"
        name="Chú tiểu Tâm An"
        robeColor="#7a5234"
        innerCollarColor="#d9ceb8"
        sashColor="#593a22"
        entered={entered}
        onSelectMonk={onSelectMonk}
      />
      <SingleNoviceMonk
        id="tamminh"
        name="Chú tiểu Tâm Minh"
        robeColor="#635346"
        innerCollarColor="#d9ceb8"
        sashColor="#473a30"
        entered={entered}
        onSelectMonk={onSelectMonk}
      />
    </group>
  );
}
