'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { boatState, lanternState, LAYOUT } from './controls';
import { Roof } from './Temple';
import { useTextures } from './textures';
import TextSign from './TextSign';

type Props = {
  entered: boolean;
  onClickPierOrBoat: () => void;
  onOpenHSKModal: () => void;
};

const RIVER_LANTERNS: Array<{ baseX: number; baseZ: number; speed: number; phase: number; color: string }> = [
  { baseX: -8.5, baseZ: 28.5, speed: 0.35, phase: 0.2, color: '#ff8da1' },
  { baseX: -3.8, baseZ: 33.0, speed: 0.28, phase: 1.4, color: '#ffb3c6' },
  { baseX: 4.2, baseZ: 30.2, speed: 0.32, phase: 2.7, color: '#ffd166' },
  { baseX: 7.8, baseZ: 36.5, speed: 0.30, phase: 3.9, color: '#ff8da1' },
  { baseX: -5.2, baseZ: 40.8, speed: 0.26, phase: 5.1, color: '#ffb3c6' },
  { baseX: 3.4, baseZ: 42.2, speed: 0.34, phase: 0.9, color: '#ffd166' },
  { baseX: -2.4, baseZ: 27.2, speed: 0.31, phase: 2.1, color: '#ff8da1' },
  { baseX: 2.6, baseZ: 35.4, speed: 0.29, phase: 4.4, color: '#ffb3c6' },
];

/**
 * Sông Bát Nhã, Bến Thuyền Độ Sinh, Thuyền Gỗ Truyền Thống & Hòn Đảo HSK (https://hoc-hsk.vercel.app/).
 * Nằm ở phía Nam khuôn viên chùa (z = 20 .. 68):
 * - Lối đá từ sân ngoài Tam Quan (z = 20) dẫn ra cầu tàu gỗ Bến Thuyền Độ Sinh (z = 20 .. 24.6).
 * - Thuyền gỗ truyền thống có mui tre, đèn lồng đỏ ở mũi thuyền và đôi mái chèo động.
 * - Khi Phật tử lên thuyền, thuyền lướt nhẹ qua dòng Sông Bát Nhã (z = 25.0 -> 45.5) sang
 *   Hòn Đảo HSK — nơi có Lầu Văn Hiến 2 tầng, rừng hoa đào hồng và cổng kết nối trực tiếp
 *   tới trang học tiếng Trung HSK: https://hoc-hsk.vercel.app/
 */
export default function RiverAndHSKIsland({ entered, onClickPierOrBoat, onOpenHSKModal }: Props) {
  const { wood, roofTile, stone } = useTextures();
  const boatGroup = useRef<THREE.Group>(null);
  const oarL = useRef<THREE.Group>(null);
  const oarR = useRef<THREE.Group>(null);
  const wakeRef = useRef<THREE.Mesh>(null);
  const waterShimmerRef = useRef<THREE.Mesh>(null);
  const lanternRefs = useRef<Array<THREE.Group | null>>([]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.getElapsedTime();

    // Update boat timeline (sailing_to_hsk or sailing_back)
    if (boatState.phase === 'sailing_to_hsk') {
      boatState.progress = Math.min(1, boatState.progress + dt / 7.0);
      const p = boatState.progress;
      const smooth = p * p * (3 - 2 * p);
      boatState.boatX = 0;
      boatState.boatZ = LAYOUT.boatDock.z + (LAYOUT.hskDock.z - LAYOUT.boatDock.z) * smooth;
      boatState.oarPhase = t * 3.8;
      if (boatState.progress >= 1) {
        boatState.phase = 'at_hsk';
        boatState.boatZ = LAYOUT.hskDock.z;
      }
    } else if (boatState.phase === 'sailing_back') {
      boatState.progress = Math.min(1, boatState.progress + dt / 6.0);
      const p = boatState.progress;
      const smooth = p * p * (3 - 2 * p);
      boatState.boatX = 0;
      boatState.boatZ = LAYOUT.hskDock.z + (LAYOUT.boatDock.z - LAYOUT.hskDock.z) * smooth;
      boatState.oarPhase = t * 3.8;
      if (boatState.progress >= 1) {
        boatState.phase = 'idle';
        boatState.boatZ = LAYOUT.boatDock.z;
      }
    } else if (boatState.phase === 'at_hsk') {
      boatState.boatX = 0;
      boatState.boatZ = LAYOUT.hskDock.z;
      boatState.oarPhase = 0;
    } else {
      boatState.boatX = 0;
      boatState.boatZ = LAYOUT.boatDock.z;
      boatState.oarPhase = 0;
    }

    const sailing = boatState.phase === 'sailing_to_hsk' || boatState.phase === 'sailing_back';
    if (boatGroup.current) {
      const bobY = 0.08 + Math.sin(t * 2.1) * 0.025;
      const rollZ = Math.sin(t * 1.6) * (sailing ? 0.032 : 0.015);
      const pitchX = Math.cos(t * 1.9) * (sailing ? 0.022 : 0.008);
      boatGroup.current.position.set(boatState.boatX, bobY, boatState.boatZ);
      boatGroup.current.rotation.set(
        pitchX,
        boatState.phase === 'sailing_back' ? Math.PI : 0,
        rollZ,
      );
    }

    if (oarL.current && oarR.current) {
      if (sailing) {
        const stroke = Math.sin(boatState.oarPhase);
        const dip = Math.cos(boatState.oarPhase) * 0.22;
        oarL.current.rotation.set(stroke * 0.45, 0, -0.45 + dip);
        oarR.current.rotation.set(stroke * 0.45, 0, 0.45 - dip);
      } else {
        oarL.current.rotation.set(0, 0, -0.35);
        oarR.current.rotation.set(0, 0, 0.35);
      }
    }

    if (wakeRef.current) {
      wakeRef.current.visible = sailing;
      if (sailing) {
        const s = 0.85 + Math.sin(t * 5) * 0.15;
        wakeRef.current.scale.set(s, s, 1);
      }
    }

    if (waterShimmerRef.current) {
      waterShimmerRef.current.position.x = Math.sin(t * 0.35) * 1.2;
    }

    // Drift floating lotus lanterns on the river
    for (let i = 0; i < RIVER_LANTERNS.length; i++) {
      const g = lanternRefs.current[i];
      if (!g) continue;
      const visible = i < lanternState.riverCount;
      g.visible = visible;
      if (!visible) continue;
      const cfg = RIVER_LANTERNS[i];
      const dx = Math.sin(t * cfg.speed + cfg.phase) * 1.8;
      const dz = Math.cos(t * cfg.speed * 0.7 + cfg.phase) * 0.65;
      g.position.set(cfg.baseX + dx, 0.06 + Math.sin(t * 2.4 + cfg.phase) * 0.015, cfg.baseZ + dz);
      g.rotation.y = t * 0.25 + cfg.phase;
    }
  });

  return (
    <group>
      {/* =====================================================================
          1. BẾN THUYỀN ĐỘ SINH (Wooden Pier at z = 20.0 .. 24.6)
         ===================================================================== */}
      {/* Đường lát đá nối từ sân trước cổng Tam Quan (z = 20) ra Bến Thuyền */}
      {[20.4, 21.6].map((pz, idx) => (
        <mesh key={`pier-stone-${idx}`} receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, pz]}>
          <planeGeometry args={[2.6, 1.0]} />
          <meshStandardMaterial color="#b0a894" roughness={0.95} />
        </mesh>
      ))}

      {/* Bờ kè đá xanh dọc bờ Bắc Sông Bát Nhã (z = 23.2) */}
      <mesh receiveShadow castShadow position={[0, 0.12, 23.2]}>
        <boxGeometry args={[92, 0.36, 0.8]} />
        <meshStandardMaterial map={stone} roughness={0.92} />
      </mesh>

      {/* Cầu tàu gỗ Bến Thuyền Độ Sinh vươn ra mặt sông (z = 21.8 .. 24.8) */}
      <group
        position={[0, 0, 23.2]}
        onClick={(e) => {
          e.stopPropagation();
          onClickPierOrBoat();
        }}
      >
        {/* Sàn gỗ cầu tàu */}
        <mesh receiveShadow castShadow position={[0, 0.26, 0]}>
          <boxGeometry args={[3.2, 0.14, 3.4]} />
          <meshStandardMaterial map={wood} roughness={0.78} />
        </mesh>
        {/* Các cọc gỗ đỡ cầu tàu dưới nước */}
        {[
          [-1.35, -1.3], [1.35, -1.3],
          [-1.35, 0], [1.35, 0],
          [-1.35, 1.3], [1.35, 1.3],
        ].map(([px, pz], idx) => (
          <mesh key={`pier-post-${idx}`} castShadow position={[px, 0.35, pz]}>
            <cylinderGeometry args={[0.11, 0.12, 1.1, 10]} />
            <meshStandardMaterial color="#4a2e1b" roughness={0.85} />
          </mesh>
        ))}
        {/* Lan can gỗ & đèn lồng hai bên cầu tàu */}
        {[-1.35, 1.35].map((rx, idx) => (
          <group key={`pier-rail-${idx}`} position={[rx, 0.68, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.08, 0.08, 2.8]} />
              <meshStandardMaterial color="#7a241b" roughness={0.75} />
            </mesh>
            {/* Cột đèn lồng đầu bến thuyền */}
            <mesh castShadow position={[0, 0.55, 1.3]}>
              <cylinderGeometry args={[0.06, 0.07, 1.3, 8]} />
              <meshStandardMaterial color="#4a2e1b" roughness={0.8} />
            </mesh>
            <mesh position={[0, 1.12, 1.3]}>
              <sphereGeometry args={[0.18, 12, 12]} />
              <meshStandardMaterial color="#ff9f43" emissive="#ff6b1a" emissiveIntensity={0.65} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Biển hiệu gỗ "Bến Thuyền · Đảo HSK" tại (2.9, 0, 21.8) */}
      <group
        position={[2.9, 0, 21.8]}
        rotation={[0, -0.25, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onClickPierOrBoat();
        }}
      >
        {[-1.18, 1.18].map((px, i) => (
          <group key={i} position={[px, 0, 0]}>
            <mesh receiveShadow castShadow position={[0, 0.10, 0]}>
              <boxGeometry args={[0.24, 0.20, 0.24]} />
              <meshStandardMaterial color="#8d8a82" roughness={0.95} />
            </mesh>
            <mesh castShadow position={[0, 0.95, 0]}>
              <cylinderGeometry args={[0.065, 0.075, 1.85, 10]} />
              <meshStandardMaterial color="#4a2c18" roughness={0.85} />
            </mesh>
          </group>
        ))}
        <mesh castShadow position={[0, 1.84, 0]}>
          <boxGeometry args={[2.76, 0.10, 0.22]} />
          <meshStandardMaterial color="#4a2c18" roughness={0.85} />
        </mesh>
        <mesh castShadow position={[0, 1.93, 0]}>
          <boxGeometry args={[2.92, 0.08, 0.36]} />
          <meshStandardMaterial color="#8f3422" roughness={0.8} />
        </mesh>
        <TextSign text="Bến Thuyền · Đảo HSK" width={2.15} height={0.44} position={[0, 1.36, 0.02]} />
      </group>

      {/* =====================================================================
          2. DÒNG SÔNG BÁT NHÃ (z = 23.5 .. 47.5) & ĐÈN HOA ĐĂNG
         ===================================================================== */}
      {/* Lòng sông xanh ngọc bích */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 35.5]}>
        <planeGeometry args={[150, 24.5]} />
        <meshStandardMaterial color="#2b6777" roughness={0.32} metalness={0.08} />
      </mesh>
      {/* Lớp nước mặt sông óng ánh */}
      <mesh ref={waterShimmerRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 35.5]}>
        <planeGeometry args={[148, 24.0]} />
        <meshStandardMaterial color="#468faf" roughness={0.18} metalness={0.12} transparent opacity={0.82} />
      </mesh>

      {/* Những cụm lá sen & hoa sen điểm xuyết hai bên bờ Sông Bát Nhã */}
      {[
        [-12, 25.5], [-9.5, 26.2], [-6.5, 25.2], [6.2, 25.4], [9.8, 26.0], [13.5, 25.2],
        [-10.5, 44.5], [-6.8, 45.0], [6.8, 44.8], [10.2, 44.2],
      ].map(([lx, lz], idx) => (
        <group key={`river-lotus-${idx}`} position={[lx, 0.04, lz]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.55, 14]} />
            <meshStandardMaterial color="#3f7a2e" roughness={0.82} />
          </mesh>
          {idx % 2 === 0 && (
            <mesh position={[0.1, 0.14, 0.05]}>
              <sphereGeometry args={[0.15, 10, 10]} />
              <meshStandardMaterial color="#f4a2b8" roughness={0.6} />
            </mesh>
          )}
        </group>
      ))}

      {/* Đèn Hoa Đăng trôi lấp lánh trên Sông Bát Nhã */}
      {RIVER_LANTERNS.map((cfg, idx) => (
        <group
          key={`r-lantern-${idx}`}
          ref={(el) => { lanternRefs.current[idx] = el; }}
          position={[cfg.baseX, 0.06, cfg.baseZ]}
        >
          {/* Đế lá sen xanh */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.24, 12]} />
            <meshStandardMaterial color="#386641" roughness={0.8} />
          </mesh>
          {/* Cánh hoa đăng sen hồng/vàng */}
          {[0, 1, 2, 3, 4, 5].map((p) => {
            const a = (p / 6) * Math.PI * 2;
            return (
              <mesh key={p} position={[Math.cos(a) * 0.11, 0.06, Math.sin(a) * 0.11]} rotation={[0.45, 0, a]}>
                <sphereGeometry args={[0.09, 8, 8]} />
                <meshStandardMaterial color={cfg.color} emissive={cfg.color} emissiveIntensity={0.35} roughness={0.5} />
              </mesh>
            );
          })}
          {/* Ngọn nến lung linh giữa hoa đăng */}
          <mesh position={[0, 0.11, 0]}>
            <sphereGeometry args={[0.055, 8, 8]} />
            <meshStandardMaterial color="#fff3b0" emissive="#ff9f1c" emissiveIntensity={1.5} />
          </mesh>
        </group>
      ))}

      {/* =====================================================================
          3. THUYỀN GỖ TRUYỀN THỐNG ĐỘ SINH (Traditional Wooden Boat)
         ===================================================================== */}
      <group
        ref={boatGroup}
        position={[0, 0.08, LAYOUT.boatDock.z]}
        onClick={(e) => {
          e.stopPropagation();
          onClickPierOrBoat();
        }}
      >
        {/* Vòng sóng nước lan tỏa quanh thân thuyền khi đang chèo */}
        <mesh ref={wakeRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} visible={false}>
          <ringGeometry args={[1.45, 1.85, 24]} />
          <meshBasicMaterial color="#e0f4ff" transparent opacity={0.55} depthWrite={false} />
        </mesh>

        {/* Thân thuyền gỗ cong (Wooden boat hull) */}
        <mesh castShadow receiveShadow position={[0, 0.16, 0]}>
          <boxGeometry args={[1.55, 0.32, 3.6]} />
          <meshStandardMaterial color="#5c361e" roughness={0.78} />
        </mesh>
        {/* Mũi thuyền & Lái thuyền thon nhọn uốn cong */}
        {[-1, 1].map((end) => (
          <group key={`bow-${end}`} position={[0, 0.22, end * 2.15]}>
            <mesh castShadow rotation={[end * Math.PI / 2, 0, 0]} scale={[0.92, 1, 0.45]}>
              <coneGeometry args={[0.84, 0.95, 10]} />
              <meshStandardMaterial color="#4a2a16" roughness={0.8} />
            </mesh>
            <mesh castShadow position={[0, 0.22, end * 0.28]}>
              <boxGeometry args={[0.22, 0.35, 0.22]} />
              <meshStandardMaterial color="#7a241b" roughness={0.75} />
            </mesh>
          </group>
        ))}
        {/* Sàn thuyền lát ván gỗ & Băng ghế ngồi giữa thuyền */}
        <mesh receiveShadow position={[0, 0.28, 0]}>
          <boxGeometry args={[1.38, 0.06, 3.2]} />
          <meshStandardMaterial map={wood} roughness={0.75} />
        </mesh>
        {[-0.85, 0.85].map((bz, idx) => (
          <mesh key={`bench-${idx}`} castShadow position={[0, 0.38, bz]}>
            <boxGeometry args={[1.35, 0.08, 0.38]} />
            <meshStandardMaterial color="#7a4b2a" roughness={0.75} />
          </mesh>
        ))}
        {/* Mạn thuyền gỗ hai bên */}
        {[-0.76, 0.76].map((bx, idx) => (
          <mesh key={`gunwale-${idx}`} castShadow position={[bx, 0.36, 0]}>
            <boxGeometry args={[0.09, 0.18, 3.5]} />
            <meshStandardMaterial color="#4a2a16" roughness={0.8} />
          </mesh>
        ))}

        {/* Mui thuyền đan tre truyền thống (Arched woven bamboo canopy) */}
        <group position={[0, 0.38, -0.35]}>
          {[
            [-0.68, -0.75], [0.68, -0.75],
            [-0.68, 0.75], [0.68, 0.75],
          ].map(([cx, cz], idx) => (
            <mesh key={`canopy-post-${idx}`} castShadow position={[cx, 0.55, cz]}>
              <cylinderGeometry args={[0.035, 0.04, 1.1, 8]} />
              <meshStandardMaterial color="#6e4726" roughness={0.85} />
            </mesh>
          ))}
          <mesh castShadow position={[0, 1.05, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.55]}>
            <cylinderGeometry args={[0.82, 0.82, 1.75, 14, 1, false, -Math.PI / 2, Math.PI]} />
            <meshStandardMaterial color="#b88b4a" roughness={0.88} side={THREE.DoubleSide} />
          </mesh>
        </group>

        {/* Cọc treo đèn lồng đỏ ở mũi thuyền */}
        <group position={[0, 0.42, 1.95]}>
          <mesh castShadow position={[0, 0.45, 0]} rotation={[0.25, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.035, 0.95, 8]} />
            <meshStandardMaterial color="#4a2a16" />
          </mesh>
          <mesh position={[0, 0.78, 0.18]}>
            <sphereGeometry args={[0.15, 12, 12]} />
            <meshStandardMaterial color="#e63946" emissive="#ff6b2b" emissiveIntensity={0.8} />
          </mesh>
        </group>

        {/* Đôi mái chèo gỗ hai bên mạn thuyền (Animated wooden oars) */}
        <group ref={oarL} position={[-0.78, 0.42, 0.35]} rotation={[0, 0, -0.35]}>
          <mesh castShadow position={[-0.45, -0.18, 0]} rotation={[0, 0, 1.15]}>
            <cylinderGeometry args={[0.025, 0.03, 1.35, 8]} />
            <meshStandardMaterial color="#6e4726" roughness={0.8} />
          </mesh>
          <mesh castShadow position={[-0.98, -0.42, 0]} rotation={[0, 0, 1.15]}>
            <boxGeometry args={[0.14, 0.48, 0.03]} />
            <meshStandardMaterial color="#5c361e" roughness={0.8} />
          </mesh>
        </group>
        <group ref={oarR} position={[0.78, 0.42, 0.35]} rotation={[0, 0, 0.35]}>
          <mesh castShadow position={[0.45, -0.18, 0]} rotation={[0, 0, -1.15]}>
            <cylinderGeometry args={[0.025, 0.03, 1.35, 8]} />
            <meshStandardMaterial color="#6e4726" roughness={0.8} />
          </mesh>
          <mesh castShadow position={[0.98, -0.42, 0]} rotation={[0, 0, -1.15]}>
            <boxGeometry args={[0.14, 0.48, 0.03]} />
            <meshStandardMaterial color="#5c361e" roughness={0.8} />
          </mesh>
        </group>
      </group>

      {/* =====================================================================
          4. HÒN ĐẢO HSK — ĐẢO HÁN NGỮ TRÍ TUỆ (z = 46.5 .. 68.0)
             Kết nối trực tiếp tới https://hoc-hsk.vercel.app/
         ===================================================================== */}
      <group
        position={[0, 0, LAYOUT.hskIsland.z]}
        onClick={(e) => {
          e.stopPropagation();
          onOpenHSKModal();
        }}
      >
        {/* Nền đảo cát vàng & Thảm cỏ xanh tươi của Hòn Đảo HSK */}
        <mesh receiveShadow position={[0, 0.08, 0]} scale={[1.35, 0.18, 0.95]}>
          <cylinderGeometry args={[14.5, 16.2, 1.2, 28]} />
          <meshStandardMaterial color="#d4be8d" roughness={0.95} />
        </mesh>
        <mesh receiveShadow position={[0, 0.24, 0]} scale={[1.30, 0.22, 0.90]}>
          <cylinderGeometry args={[13.2, 14.4, 1.1, 28]} />
          <meshStandardMaterial color="#5f8d4e" roughness={0.92} />
        </mesh>

        {/* Đá cuội tự nhiên bao quanh bờ Hòn Đảo HSK */}
        {Array.from({ length: 16 }).map((_, i) => {
          const a = (i / 16) * Math.PI * 2;
          const rx = Math.cos(a) * 18.2;
          const rz = Math.sin(a) * 12.6;
          return (
            <mesh key={`isl-rock-${i}`} castShadow position={[rx, 0.22, rz]} scale={[1.2, 0.65, 1.0]}>
              <dodecahedronGeometry args={[0.85 + (i % 3) * 0.25, 0]} />
              <meshStandardMaterial color={i % 2 === 0 ? '#7d786e' : '#8d887d'} roughness={0.92} />
            </mesh>
          );
        })}

        {/* Cầu tàu gỗ đón thuyền phía Bắc Đảo HSK (world z = 45.8 .. 49.0 -> local z = -10.2 .. -7.0) */}
        <group position={[0, 0, -8.8]}>
          <mesh receiveShadow castShadow position={[0, 0.30, 0]}>
            <boxGeometry args={[3.4, 0.16, 4.2]} />
            <meshStandardMaterial map={wood} roughness={0.78} />
          </mesh>
          {[-1.4, 1.4].map((rx, idx) => (
            <group key={`hsk-pier-${idx}`} position={[rx, 0.72, 0]}>
              <mesh castShadow>
                <boxGeometry args={[0.08, 0.08, 3.8]} />
                <meshStandardMaterial color="#8a241b" roughness={0.75} />
              </mesh>
              <mesh position={[0, 0.85, -1.6]}>
                <sphereGeometry args={[0.20, 12, 12]} />
                <meshStandardMaterial color="#e63946" emissive="#ff6b2b" emissiveIntensity={0.7} />
              </mesh>
            </group>
          ))}
        </group>

        {/* Cổng chào Đảo HSK ("ĐẢO HSK · HÁN NGỮ") tại local z = -6.2 */}
        <group position={[0, 0.32, -6.2]}>
          {[-2.2, 2.2].map((px, idx) => (
            <mesh key={`hsk-gate-col-${idx}`} castShadow position={[px, 2.1, 0]}>
              <cylinderGeometry args={[0.22, 0.26, 4.2, 12]} />
              <meshStandardMaterial color="#8a241b" roughness={0.7} />
            </mesh>
          ))}
          <mesh castShadow position={[0, 3.85, 0]}>
            <boxGeometry args={[5.4, 0.68, 0.42]} />
            <meshStandardMaterial map={wood} roughness={0.7} />
          </mesh>
          {/* Biển chữ xoay về phía Bắc (rotation={[0, Math.PI, 0]}) để người từ bờ chùa và trên thuyền nhìn rõ */}
          <group position={[0, 3.85, -0.23]} rotation={[0, Math.PI, 0]}>
            <TextSign text="ĐẢO HSK · HÁN NGỮ" width={3.6} height={0.58} position={[0, 0, 0]} />
          </group>
          <TextSign text="ĐẢO HSK · HÁN NGỮ" width={3.6} height={0.58} position={[0, 3.85, 0.23]} />
          <Roof width={6.2} depth={2.4} rise={1.1} y={4.2} tile={roofTile} />
        </group>

        {/* Sân gạch & Lầu Văn Hiến HSK 2 tầng (2-Story HSK Study Pavilion at island center) */}
        <mesh receiveShadow position={[0, 0.42, 0.5]}>
          <boxGeometry args={[10.5, 0.28, 9.2]} />
          <meshStandardMaterial map={stone} roughness={0.9} />
        </mesh>
        <group position={[0, 0.56, 1.2]}>
          {/* Tầng 1 Lầu Văn Hiến HSK */}
          <mesh castShadow position={[0, 1.8, 0]}>
            <boxGeometry args={[7.2, 3.6, 5.8]} />
            <meshStandardMaterial color="#f2e6cf" roughness={0.85} />
          </mesh>
          {[
            [-3.4, -2.7], [-1.2, -2.7], [1.2, -2.7], [3.4, -2.7],
            [-3.4, 2.7], [3.4, 2.7],
          ].map(([cx, cz], idx) => (
            <mesh key={`hsk-pcol-${idx}`} castShadow position={[cx, 1.8, cz]}>
              <cylinderGeometry args={[0.18, 0.21, 3.6, 12]} />
              <meshStandardMaterial color="#8a241b" roughness={0.72} />
            </mesh>
          ))}
          <group position={[0, 3.15, -2.95]} rotation={[0, Math.PI, 0]}>
            <TextSign text="HỌC VIỆN HSK" width={3.0} height={0.52} position={[0, 0, 0]} />
          </group>
          <Roof width={8.8} depth={7.2} rise={1.65} y={3.65} tile={roofTile} />

          {/* Tầng 2 Lầu Văn Hiến HSK */}
          <mesh castShadow position={[0, 5.4, 0]}>
            <boxGeometry args={[4.8, 2.2, 3.8]} />
            <meshStandardMaterial color="#8a241b" roughness={0.75} />
          </mesh>
          <Roof width={6.4} depth={5.2} rise={1.45} y={6.5} tile={roofTile} />
          {/* Đỉnh tháp văn bút vàng */}
          <mesh castShadow position={[0, 8.35, 0]}>
            <coneGeometry args={[0.24, 0.85, 10]} />
            <meshStandardMaterial color="#ffd75e" metalness={0.85} roughness={0.2} />
          </mesh>
        </group>

        {/* 4 Cây Hoa Đào Hán Ngữ nở hồng rực rỡ trên Đảo HSK */}
        {[
          [-6.8, -3.2],
          [6.8, -3.2],
          [-7.8, 3.5],
          [7.8, 3.5],
        ].map(([tx, tz], idx) => (
          <group key={`peach-tree-${idx}`} position={[tx, 0.35, tz]}>
            <mesh castShadow position={[0, 1.3, 0]}>
              <cylinderGeometry args={[0.22, 0.34, 2.6, 10]} />
              <meshStandardMaterial color="#4a2c1d" roughness={0.9} />
            </mesh>
            {[
              [0, 2.8, 0, 1.45, '#f497b6'],
              [-0.85, 2.45, 0.4, 1.05, '#f7b2c4'],
              [0.85, 2.5, -0.3, 1.1, '#e87a9f'],
              [0.2, 3.35, 0.3, 1.0, '#fbd0de'],
            ].map(([bx, by, bz, br, col], bi) => (
              <mesh key={bi} castShadow position={[bx as number, by as number, bz as number]}>
                <sphereGeometry args={[br as number, 14, 12]} />
                <meshStandardMaterial color={col as string} roughness={0.75} />
              </mesh>
            ))}
          </group>
        ))}

        {/* Nhãn tương tác nổi trên Đảo HSK để bấm mở nhanh hoặc đi thuyền */}
        {entered && (
          <Html center position={[0, 10.2, -1.0]} zIndexRange={[8, 0]}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenHSKModal();
              }}
              className="whitespace-nowrap rounded-full border border-amber-300/80 bg-amber-900/90 px-3.5 py-1.5 font-sans text-xs font-semibold text-amber-50 shadow-xl transition hover:scale-105 hover:bg-amber-800"
            >
              🏝️ Đảo HSK · hoc-hsk.vercel.app
            </button>
          </Html>
        )}
      </group>
    </group>
  );
}
