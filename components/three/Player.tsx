'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  controls,
  LAYOUT,
  moveWithCollision,
  floorYAt,
  isInHall,
  sweepState,
  bathState,
  waterState,
  releaseState,
  boatState,
  type PlayerGender,
} from './controls';

type Props = {
  name: string;
  gender?: PlayerGender;
  rankBadge?: string;
  rankTitle?: string;
  visible: boolean;
  canMove: boolean;
  carryingWater?: boolean;
  waterStream?: boolean;
  onZone: (zone: 'burner' | 'chant' | 'pond' | 'altar' | 'none') => void;
};

const SPEED = 3.4;
const bowlWorldVec = new THREE.Vector3();

/**
 * Phật tử đi chùa với 2 hình mẫu lựa chọn:
 * - Nữ Phật tử ('female'): Bộ đồ lam nữ cổ tàu vạt chéo cài nút vải, tà áo xẻ tà nhẹ,
 *   tóc búi gọn cài trâm gỗ trầm, chuỗi hạt đeo tay, giày vải.
 * - Nam Phật tử ('male'): Bộ đồ lam cư sĩ nam màu lam xám trầm, vai rộng, cổ tàu nẹp thẳng
 *   cài nút vải chính giữa, 2 túi áo cư sĩ phía trước, tóc nam cắt ngắn gọn gàng, giày vải.
 *
 * Hỗ trợ đầy đủ hoạt cảnh:
 * - Đi bộ ngoài sân & bước chậm rãi tĩnh lặng khi vào trong Chính điện (~52% tốc độ).
 * - Khớp chân 2 đoạn (đùi + cẳng chân) giúp ngồi ghế đá/ghế trà chạm đúng mặt ghế và sàn,
 *   ngồi thiền kiết già trên tọa cụ, quỳ lễ & vái Phật nhịp nhàng không làm bẹp thân người.
 * - Quét lá đa đưa chổi ngang tự nhiên bằng hai tay.
 * - Cầm gáo nước gỗ đi tưới cây & nghiêng gáo tưới rau Vườn Lộc Uyển.
 * - Hai tay nâng bát sành thả cá phóng sinh xuống Tâm Liên Hồ.
 */
export default function Player({
  name,
  gender = 'female',
  rankBadge,
  rankTitle,
  visible,
  canMove,
  carryingWater = false,
  waterStream = false,
  onZone,
}: Props) {
  const group = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const shinL = useRef<THREE.Group>(null);
  const shinR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const ladleRef = useRef<THREE.Group>(null);
  const releaseBowlRef = useRef<THREE.Group>(null);
  const bowlFishRefs = useRef<Array<THREE.Group | null>>([null, null, null]);
  const vel = useRef({ x: 0, z: 0 });
  const phase = useRef(0);
  const zoneRef = useRef<'burner' | 'chant' | 'pond' | 'altar' | 'none'>('none');
  const pos = useRef({ x: LAYOUT.spawn.x, z: LAYOUT.spawn.z });
  const facing = useRef(Math.PI); // facing north (towards the hall)
  const floorY = useRef(0);
  const poseBlend = useRef(0); // 0 = standing, 1 = fully seated/kneeling
  const sweepBlend = useRef(0); // 0 = normal, 1 = sweeping (arms/body)
  const bathBlend = useRef(0); // 0 = normal, 1 = scooping/pouring (right arm raised)
  const waterPourBlend = useRef(0); // 0 = normal, 1 = pouring water on vegetables
  const releaseBlend = useRef(0); // 0 = normal, 1 = releasing fish at pond
  const wasOnBoat = useRef(false);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const g = group.current;
    if (!g) return;

    const inHallNow = isInHall(pos.current.x, pos.current.z);
    // Đi chậm rãi, nhẹ nhàng khi vào trong Chính điện để giữ sự tôn nghiêm
    const effSpeed = inHallNow ? SPEED * 0.52 : SPEED;

    let mx = 0;
    let mz = 0;
    const sweepingNow = sweepState.phase !== 'idle';
    const bathingNow = bathState.phase !== 'idle' && bathState.phase !== 'done';
    const releasingNow = releaseState.phase === 'releasing';
    const wateringNow = waterStream || waterState.phase === 'watering';
    const onBoatNow = boatState.phase !== 'idle';
    const sweepWalkOnly = controls.sweepAutoWalk && visible && !sweepingNow;
    const bathWalkOnly = controls.bathAutoWalk && visible && !bathingNow;
    const boatWalkOnly = controls.boatAutoWalk && visible && !onBoatNow;

    if (
      (canMove && visible && !sweepingNow && !bathingNow && !releasingNow && !wateringNow && !onBoatNow) ||
      sweepWalkOnly ||
      bathWalkOnly ||
      boatWalkOnly
    ) {
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
      if (sweepWalkOnly || bathWalkOnly || boatWalkOnly) {
        mx = 0;
        mz = 0;
      }

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
            const taken = Math.hypot(next.x - pos.current.x, next.z - pos.current.z);
            if (taken > step * 0.8) {
              chosen = [dirX, dirZ];
              break;
            }
            if (taken > bestTaken) {
              bestTaken = taken;
              bestDir = [dirX, dirZ];
            }
          }
          if (chosen) {
            mx += chosen[0];
            mz += chosen[1];
          } else if (bestDir && bestTaken > 0) {
            mx += bestDir[0];
            mz += bestDir[1];
          }
        }
      }
      const manual =
        !sweepWalkOnly &&
        !bathWalkOnly &&
        !boatWalkOnly &&
        (fwd ||
          back ||
          left ||
          right ||
          Math.abs(controls.joystick.x) > 0.1 ||
          Math.abs(controls.joystick.y) > 0.1);
      if (manual) {
        controls.moveTarget = null;
        controls.waypoints = [];
      }
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
    controls.playerMoving = speed > 0.35;

    if (speed > 0.35) {
      const next = moveWithCollision(pos.current.x, pos.current.z, vel.current.x * dt, vel.current.z * dt);
      pos.current = next;
      facing.current = Math.atan2(vel.current.x, vel.current.z);
      phase.current += speed * dt * (inHallNow ? 2.2 : 2.6);
    }

    // Turn smoothly for rituals and interactions
    const lerpFacing = (targetFacing: number) => {
      let diff = targetFacing - facing.current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      facing.current += diff * (1 - Math.exp(-6 * dt));
    };

    if (sweepState.phase !== 'idle') {
      lerpFacing(Math.atan2(LAYOUT.sweepPile.x - LAYOUT.sweepSpot.x, LAYOUT.sweepPile.z - LAYOUT.sweepSpot.z));
    }
    if (bathState.phase !== 'idle' && bathState.phase !== 'done') {
      lerpFacing(Math.PI);
    }
    if (wateringNow) {
      // Face the vegetable beds (south-west toward the 4 garden beds)
      const gardenFacing = Math.atan2(LAYOUT.garden.x - pos.current.x, LAYOUT.garden.z - pos.current.z);
      lerpFacing(gardenFacing);
    }
    if (releasingNow) {
      // Turn directly toward Tâm Liên Hồ center from wherever the player stands on the bank
      const pondFacing = Math.atan2(LAYOUT.pond.x - pos.current.x, LAYOUT.pond.z - pos.current.z);
      lerpFacing(pondFacing);
    }

    const seated = controls.pose === 'sit' || controls.pose === 'kneel';
    if (seated || controls.pose === 'pray') {
      const targetFacing = seated ? controls.sitFacing : Math.PI;
      lerpFacing(targetFacing);
    }

    // Pose blend: 0 standing -> 1 seated/kneeling
    const poseTarget = seated ? 1 : 0;
    poseBlend.current += (poseTarget - poseBlend.current) * (1 - Math.exp(-6 * dt));
    const blend = poseBlend.current;

    // Floor height lerp & Boat deck positioning
    if (onBoatNow) {
      wasOnBoat.current = true;
      pos.current.x = boatState.boatX;
      pos.current.z = boatState.boatZ + (boatState.phase === 'sailing_back' ? -0.35 : 0.35);
      floorY.current = 0.36 + Math.sin(clock.getElapsedTime() * 2.1) * 0.025;
      lerpFacing(boatState.phase === 'sailing_back' ? Math.PI : 0);
    } else {
      if (wasOnBoat.current) {
        wasOnBoat.current = false;
        pos.current.x = LAYOUT.pier.x;
        pos.current.z = LAYOUT.pier.z;
        facing.current = Math.PI;
      }
      const targetFloor = floorYAt(pos.current.x, pos.current.z);
      floorY.current += (targetFloor - floorY.current) * (1 - Math.exp(-7 * dt));
      if (Math.abs(targetFloor - floorY.current) < 0.01) floorY.current = targetFloor;
    }

    const kneel = controls.pose === 'kneel';
    const inHall = isInHall(pos.current.x, pos.current.z);
    const isLotusMatSeat =
      inHall ||
      controls.seatId.startsWith('west-chant') ||
      controls.seatId.startsWith('stupa-chant') ||
      controls.seatId.includes('mat');

    // Release & Watering blends
    const releaseTarget = releasingNow ? 1 : 0;
    releaseBlend.current += (releaseTarget - releaseBlend.current) * (1 - Math.exp(-5 * dt));
    const rb = releaseBlend.current;

    const waterPourTarget = wateringNow ? 1 : 0;
    waterPourBlend.current += (waterPourTarget - waterPourBlend.current) * (1 - Math.exp(-5 * dt));
    const wb = waterPourBlend.current;

    // Accurate grounded drop without squashing body scale:
    // - Kneeling in hall: -0.42m so knees rest on cushion
    // - Cross-legged sitting on any meditation mat (hall, Niệm Phật Đường Tây, Đài Bảo Tháp, etc.): -0.68m
    // - Sitting on tea-seat (higher chair at 0.50m above tea platform): -0.30m
    // - Sitting on outdoor stone/wood benches (0.38m-0.42m): -0.40m so hips sit on bench and feet touch floor
    let targetPoseDrop = -0.40;
    if (kneel) {
      targetPoseDrop = -0.42;
    } else if (isLotusMatSeat) {
      targetPoseDrop = -0.68;
    } else if (controls.seatId === 'tea-seat') {
      targetPoseDrop = -0.30;
    }

    const walkBob =
      (1 - blend) *
      Math.abs(Math.sin(phase.current)) *
      (inHall ? 0.025 : 0.048) *
      Math.min(1, speed / SPEED);

    const bodyY = floorY.current + blend * targetPoseDrop - rb * 0.16 + walkBob;
    g.position.set(pos.current.x, bodyY, pos.current.z);
    g.rotation.y = facing.current;
    controls.playerFacing = facing.current;
    controls.playerPos = { x: pos.current.x, y: floorY.current, z: pos.current.z };

    const t = clock.getElapsedTime();
    const strideRatio = Math.min(1, speed / SPEED);
    const swing = Math.sin(phase.current) * (inHall ? 0.42 : 0.62) * strideRatio;
    const idle = Math.sin(t * 1.8) * 0.02;

    // --- 2-Segment Leg Articulation (Hip + Knee) ---
    let hipPitchL = (1 - blend) * swing;
    let hipPitchR = (1 - blend) * -swing;
    let hipYawL = 0;
    let hipYawR = 0;
    let kneePitchL = (1 - blend) * Math.max(0, -swing * 0.45);
    let kneePitchR = (1 - blend) * Math.max(0, swing * 0.45);
    let kneeRollL = 0;
    let kneeRollR = 0;

    if (blend > 0.001) {
      if (kneel) {
        // Quỳ lễ trên tọa cụ: đùi hướng nhẹ về trước-dưới, cẳng chân gập ra sau áp sát chiếu
        hipPitchL = hipPitchL * (1 - blend) + -0.28 * blend;
        hipPitchR = hipPitchR * (1 - blend) + -0.28 * blend;
        kneePitchL = kneePitchL * (1 - blend) + 1.82 * blend;
        kneePitchR = kneePitchR * (1 - blend) + 1.82 * blend;
      } else if (isLotusMatSeat) {
        // Ngồi thiền kiết già / bán già trên tọa cụ (Chính điện, Niệm Phật Đường, Đài Bảo Tháp, Hồ sen, Cây đa)
        hipPitchL = hipPitchL * (1 - blend) + -1.48 * blend;
        hipPitchR = hipPitchR * (1 - blend) + -1.48 * blend;
        hipYawL = 0.48 * blend;
        hipYawR = -0.48 * blend;
        kneePitchL = kneePitchL * (1 - blend) + 1.38 * blend;
        kneePitchR = kneePitchR * (1 - blend) + 1.38 * blend;
        kneeRollL = -0.48 * blend;
        kneeRollR = 0.48 * blend;
      } else {
        // Ngồi ghế đá / ghế gỗ hành lang / bàn trà: đùi ngang trên mặt ghế, cẳng chân buông vuông góc chạm đất
        hipPitchL = hipPitchL * (1 - blend) + -1.42 * blend;
        hipPitchR = hipPitchR * (1 - blend) + -1.42 * blend;
        kneePitchL = kneePitchL * (1 - blend) + 1.42 * blend;
        kneePitchR = kneePitchR * (1 - blend) + 1.42 * blend;
      }
    }

    if (rb > 0.01) {
      // Hơi khuỵu gối nhẹ khi cúi thả cá bên bờ hồ
      hipPitchL = hipPitchL * (1 - rb) + -0.32 * rb;
      hipPitchR = hipPitchR * (1 - rb) + -0.32 * rb;
      kneePitchL = kneePitchL * (1 - rb) + 0.52 * rb;
      kneePitchR = kneePitchR * (1 - rb) + 0.52 * rb;
    }

    if (legL.current) {
      legL.current.rotation.set(hipPitchL, hipYawL, 0);
    }
    if (legR.current) {
      legR.current.rotation.set(hipPitchR, hipYawR, 0);
    }
    if (shinL.current) {
      shinL.current.rotation.set(kneePitchL, 0, kneeRollL);
    }
    if (shinR.current) {
      shinR.current.rotation.set(kneePitchR, 0, kneeRollR);
    }

    // --- Rhythmic Bowing (Lễ Phật / Khấu lễ) in Pray or Kneel ---
    const isPrayingOrKneeling =
      (controls.pose === 'pray' || controls.pose === 'kneel') &&
      bathState.phase !== 'scoop' &&
      bathState.phase !== 'pour';
    // Nhịp vái lễ êm dịu mỗi ~4.2 giây
    const bowWave = isPrayingOrKneeling
      ? Math.pow(Math.max(0, Math.sin(t * 1.5)), 1.6)
      : 0;
    const bowAngle =
      controls.pose === 'kneel'
        ? bowWave * 0.46
        : controls.pose === 'pray'
          ? bowWave * 0.28
          : 0;

    // --- Arms & Torso Animation ---
    let armPitchL = (1 - blend) * (-swing * 0.65 + idle) + blend * (kneel || inHall ? -0.92 : -0.62);
    let armPitchR = (1 - blend) * (swing * 0.65 - idle) + blend * (kneel || inHall ? -0.92 : -0.62);
    let armRollL = blend * (kneel || inHall ? -0.36 : -0.14);
    let armRollR = blend * (kneel || inHall ? 0.36 : 0.14);
    let bodyPitch = bowAngle;
    let bodyYaw = 0;

    // Chắp tay búp sen khi đứng lễ / quỳ lễ và nâng tay lên trán theo nhịp vái
    if (isPrayingOrKneeling) {
      const prayLift = bowWave * 0.28;
      armPitchL = -0.96 - prayLift;
      armPitchR = -0.96 - prayLift;
      armRollL = -0.38;
      armRollR = 0.38;
    }

    // Quét lá đa (Lateral side-to-side sweeping arc)
    const sweepTarget =
      (sweepState.phase === 'sweeping' || sweepState.phase === 'gathering') && !sweepState.paused
        ? 1
        : sweepState.phase === 'preparing'
          ? 0.6
          : 0;
    sweepBlend.current += (sweepTarget - sweepBlend.current) * (1 - Math.exp(-4 * dt));
    const sb = sweepBlend.current;
    if (sb > 0.01) {
      const latArc = Math.sin(sweepState.strokePhase * Math.PI * 2);
      const lift = Math.max(0, -Math.cos(sweepState.strokePhase * Math.PI * 2)) * 0.08;
      // Hai tay nắm cán chổi đưa ngang từ phải sang trái
      const sweepPitchL = -0.72 + lift;
      const sweepPitchR = -0.82 + lift;
      const sweepRollL = -0.22 + latArc * 0.38;
      const sweepRollR = 0.18 + latArc * 0.38;
      armPitchL = armPitchL * (1 - sb) + sweepPitchL * sb;
      armPitchR = armPitchR * (1 - sb) + sweepPitchR * sb;
      armRollL = armRollL * (1 - sb) + sweepRollL * sb;
      armRollR = armRollR * (1 - sb) + sweepRollR * sb;
      bodyPitch = bodyPitch * (1 - sb) + (0.18 + Math.abs(latArc) * 0.04) * sb;
      bodyYaw = bodyYaw * (1 - sb) + latArc * 0.24 * sb;
    }

    // Tắm Phật (Lumbini ladle scoop & pour)
    const bathTarget = bathState.phase === 'scoop' || bathState.phase === 'pour' ? 1 : 0;
    bathBlend.current += (bathTarget - bathBlend.current) * (1 - Math.exp(-4 * dt));
    const bb = bathBlend.current;
    if (bb > 0.01) {
      const armAngleBathR = -1.35 + Math.sin(bathState.pourT * Math.PI * 2) * 0.08;
      armPitchL = armPitchL * (1 - bb) + -0.5 * bb;
      armPitchR = armPitchR * (1 - bb) + armAngleBathR * bb;
      armRollR = armRollR * (1 - bb) + 0.15 * bb;
    }

    // Cầm gáo nước đi tưới & Đang tưới rau Vườn Lộc Uyển
    if (carryingWater && wb < 0.5) {
      // Tay phải cầm gáo nước ngang hông / trước bụng khi đi bộ
      armPitchR = -0.78 + Math.sin(phase.current) * 0.06;
      armRollR = 0.14;
    }
    if (wb > 0.01) {
      const pourSwing = Math.sin(t * 2.6);
      const pourDip = Math.sin(t * 5.2) * 0.12;
      armPitchL = armPitchL * (1 - wb) + -0.42 * wb;
      armPitchR = armPitchR * (1 - wb) + (-1.04 + pourDip) * wb;
      armRollR = armRollR * (1 - wb) + (0.12 + pourSwing * 0.26) * wb;
      bodyPitch = bodyPitch * (1 - wb) + 0.16 * wb;
      bodyYaw = bodyYaw * (1 - wb) + pourSwing * 0.25 * wb;
    }
    if (ladleRef.current) {
      // Nghiêng gáo gỗ đổ nước khi đang tưới
      ladleRef.current.rotation.z = wb * -0.58;
      ladleRef.current.rotation.x = wb * 0.35;
    }

    // Thả cá phóng sinh (Hai tay nâng bát sành nghiêng nhẹ xuống hồ)
    if (rb > 0.01) {
      const tiltProgress = Math.min(1, releaseState.progress * 1.4);
      armPitchL = armPitchL * (1 - rb) + (-0.92 - tiltProgress * 0.16) * rb;
      armPitchR = armPitchR * (1 - rb) + (-0.92 - tiltProgress * 0.16) * rb;
      armRollL = armRollL * (1 - rb) + -0.35 * rb;
      armRollR = armRollR * (1 - rb) + 0.35 * rb;
      bodyPitch = bodyPitch * (1 - rb) + (0.24 + tiltProgress * 0.10) * rb;
    }

    if (armL.current) {
      armL.current.rotation.set(armPitchL, 0, armRollL);
    }
    if (armR.current) {
      armR.current.rotation.set(armPitchR, 0, armRollR);
    }
    if (body.current) {
      body.current.rotation.set(bodyPitch, bodyYaw, 0);
      // Không bao giờ làm bẹp chiều cao nhân vật khi ngồi/quỳ; chỉ thở nhẹ khi đứng yên
      body.current.scale.y = 1 + (canMove && speed < 0.35 ? idle * 0.45 : 0);
    }

    // Cập nhật tọa độ thế giới chính xác của chiếc bát trên hai bàn tay người chơi khi đang thả cá
    if (releasingNow && releaseBowlRef.current) {
      const tiltProgress = Math.min(1, releaseState.progress * 1.3);
      releaseBowlRef.current.position.set(0, 1.28 - tiltProgress * 0.08, 0.43 + tiltProgress * 0.05);
      releaseBowlRef.current.rotation.set(0.32 + tiltProgress * 0.52, 0, 0);
      releaseBowlRef.current.updateWorldMatrix(true, false);
      releaseBowlRef.current.getWorldPosition(bowlWorldVec);
      releaseState.handPos.x = bowlWorldVec.x;
      releaseState.handPos.y = bowlWorldVec.y + 0.03;
      releaseState.handPos.z = bowlWorldVec.z;

      // Điểm rơi của cá trên mặt nước hồ ngay phía trước bàn tay người chơi
      const dirX = LAYOUT.pond.x - pos.current.x;
      const dirZ = LAYOUT.pond.z - pos.current.z;
      const dist = Math.hypot(dirX, dirZ) || 1;
      const ux = dirX / dist;
      const uz = dirZ / dist;
      const landDist = Math.min(2.2, Math.max(1.2, dist - 1.0));
      releaseState.waterTarget.x = pos.current.x + ux * landDist;
      releaseState.waterTarget.y = 0.06;
      releaseState.waterTarget.z = pos.current.z + uz * landDist;
      releaseState.facing = Math.atan2(ux, uz);

      // Hiển thị từng chú cá bơi trong bát trên tay cho đến đúng khoảnh khắc chú cá đó nhảy ra khỏi tay
      for (let i = 0; i < 3; i++) {
        const bf = bowlFishRefs.current[i];
        if (!bf) continue;
        const jumpTime = 0.14 + i * 0.22;
        const stillInBowl = i < releaseState.count && releaseState.progress < jumpTime;
        bf.visible = stillInBowl;
        if (stillInBowl) {
          bf.rotation.y = Math.sin(t * 10 + i * 2) * 0.25;
        }
      }
    }

    // Interaction zones (bao gồm cả Niệm Phật Đường Tây & Đài Niệm Kinh Bảo Tháp)
    const db = Math.hypot(pos.current.x - LAYOUT.burner.x, pos.current.z - LAYOUT.burner.z);
    const dc1 = Math.hypot(pos.current.x - LAYOUT.chantPavilion.x, pos.current.z - LAYOUT.chantPavilion.z);
    const dc2 = Math.hypot(pos.current.x - LAYOUT.westChantHall.x, pos.current.z - LAYOUT.westChantHall.z);
    const dc3 = Math.hypot(pos.current.x - LAYOUT.eastChantPavilion.x, pos.current.z - LAYOUT.eastChantPavilion.z);
    const dc = Math.min(dc1, dc2, dc3);
    const dp = Math.hypot(pos.current.x - LAYOUT.pond.x, pos.current.z - LAYOUT.pond.z);
    const da = Math.hypot(pos.current.x - LAYOUT.altarSpot.x, pos.current.z - LAYOUT.altarSpot.z);
    const zone: 'burner' | 'chant' | 'pond' | 'altar' | 'none' =
      db < 2.9 ? 'burner' : dc < 4.2 ? 'chant' : dp < 5.0 ? 'pond' : da < 2.4 ? 'altar' : 'none';
    if (zone !== zoneRef.current) {
      zoneRef.current = zone;
      onZone(zone);
    }
  });

  if (!visible) return null;

  const isMale = gender === 'male';
  // Bảng màu trang phục đồ lam Phật tử theo giới tính
  const tunicColor = isMale ? '#4d6276' : '#6e859c';
  const pantsColor = isMale ? '#3e5062' : '#5c738a';
  const trimColor = isMale ? '#364758' : '#4b6075';
  const seamColor = isMale ? '#425568' : '#586f86';
  const armX = isMale ? 0.362 : 0.34;
  const showLadle = carryingWater || waterStream || waterState.phase === 'carrying' || waterState.phase === 'watering';
  const showReleaseBowl = releaseState.phase === 'releasing';

  return (
    <group ref={group} position={[LAYOUT.spawn.x, 0, LAYOUT.spawn.z]}>
      {/* Name & Merit Rank label — DOM text, so Vietnamese diacritics render perfectly */}
      <Html center position={[0, 2.38, 0]} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="flex flex-col items-center gap-0.5">
          {rankTitle && (
            <div className="whitespace-nowrap rounded-full border border-amber-300/60 bg-amber-950/75 px-2 py-0.5 font-sans text-[10px] font-medium text-amber-200 shadow-sm">
              {rankBadge} {rankTitle}
            </div>
          )}
          <div className="whitespace-nowrap rounded-full border border-white/40 bg-black/45 px-3 py-1 font-sans text-xs font-medium text-amber-50 shadow">
            {name}
          </div>
        </div>
      </Html>

      <group ref={body}>
        {/* Quần lam ống suông 2 khớp (Đùi + Cẳng chân) & Giày vải đi chùa */}
        {[-0.135, 0.135].map((x, i) => (
          <group
            key={i}
            ref={i === 0 ? legL : legR}
            position={[x, 0.86, 0]}
          >
            {/* Đùi (Upper thigh pivoting from hip y=0.86 down to knee y=0.46) */}
            <mesh position={[0, -0.20, 0]} castShadow>
              <cylinderGeometry args={[0.108, 0.114, 0.42, 14]} />
              <meshStandardMaterial color={pantsColor} roughness={0.86} />
            </mesh>
            {/* Khớp gối mềm (Rounded knee joint) */}
            <mesh position={[0, -0.40, 0]}>
              <sphereGeometry args={[0.106, 12, 10]} />
              <meshStandardMaterial color={pantsColor} roughness={0.86} />
            </mesh>

            {/* Cẳng chân + Bàn chân (Lower shin pivoting at knee y=-0.40) */}
            <group ref={i === 0 ? shinL : shinR} position={[0, -0.40, 0]}>
              {/* Ống quần dưới (Lower trouser leg) */}
              <mesh position={[0, -0.19, 0]} castShadow>
                <cylinderGeometry args={[0.112, 0.122, 0.40, 14]} />
                <meshStandardMaterial color={pantsColor} roughness={0.86} />
              </mesh>
              {/* Gấu quần lam (Trouser hem cuff) */}
              <mesh position={[0, -0.375, 0]} castShadow>
                <cylinderGeometry args={[0.123, 0.124, 0.045, 14]} />
                <meshStandardMaterial color={trimColor} roughness={0.88} />
              </mesh>
              {/* Cổ chân / tất vải (Ankle sock) */}
              <mesh position={[0, -0.41, 0]}>
                <cylinderGeometry args={[0.072, 0.075, 0.07, 12]} />
                <meshStandardMaterial color="#e8e2d5" roughness={0.85} />
              </mesh>
              {/* Thân giày vải đi chùa (Cloth temple shoe upper) */}
              <mesh position={[0, -0.432, 0.028]} castShadow>
                <boxGeometry args={[0.145, 0.062, 0.24]} />
                <meshStandardMaterial color="#382e28" roughness={0.88} />
              </mesh>
              {/* Mũi giày bo tròn (Rounded shoe toe) */}
              <mesh position={[0, -0.435, 0.135]} scale={[1, 0.55, 1]} castShadow>
                <sphereGeometry args={[0.071, 12, 10]} />
                <meshStandardMaterial color="#382e28" roughness={0.88} />
              </mesh>
              {/* Đế giày vải trắng ngà (Cloth shoe sole resting at y=-0.46 -> world y=0.00) */}
              <mesh position={[0, -0.456, 0.032]}>
                <boxGeometry args={[0.152, 0.022, 0.255]} />
                <meshStandardMaterial color="#dfd7c8" roughness={0.9} />
              </mesh>
            </group>
          </group>
        ))}

        {/* Áo lam Phật tử — Thân áo trên (Upper tunic torso) */}
        <mesh castShadow position={[0, 1.44, 0]}>
          <cylinderGeometry args={[isMale ? 0.268 : 0.245, isMale ? 0.278 : 0.265, 0.44, 18]} />
          <meshStandardMaterial color={tunicColor} roughness={0.84} />
        </mesh>
        {/* Cầu vai bo tròn tự nhiên (Rounded shoulder yoke — broader for male devotee) */}
        <mesh castShadow position={[0, 1.63, 0]} scale={[isMale ? 1.38 : 1.28, 0.42, isMale ? 0.96 : 0.9]}>
          <sphereGeometry args={[0.255, 16, 12]} />
          <meshStandardMaterial color={tunicColor} roughness={0.84} />
        </mesh>
        {/* Đường eo áo (Waist seam) */}
        <mesh position={[0, 1.23, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[isMale ? 0.274 : 0.26, 0.011, 8, 20]} />
          <meshStandardMaterial color={seamColor} roughness={0.86} />
        </mesh>
        {/* Vạt áo lam dưới (Lower tunic: straight cut for male cư sĩ, gently flared for female) */}
        <mesh castShadow position={[0, 1.01, 0]}>
          <cylinderGeometry args={[isMale ? 0.276 : 0.262, isMale ? 0.305 : 0.345, 0.46, 18]} />
          <meshStandardMaterial color={tunicColor} roughness={0.84} />
        </mesh>
        {/* Viền gấu áo lam (Lower tunic hem trim) */}
        <mesh position={[0, 0.79, 0]}>
          <cylinderGeometry args={[isMale ? 0.304 : 0.344, isMale ? 0.308 : 0.348, 0.03, 18]} />
          <meshStandardMaterial color={trimColor} roughness={0.86} />
        </mesh>
        {/* Đường xẻ tà hai bên hông (Traditional side slits) */}
        {[isMale ? -0.285 : -0.31, isMale ? 0.285 : 0.31].map((sx, idx) => (
          <mesh key={`slit-${idx}`} position={[sx, 0.91, 0]}>
            <boxGeometry args={[0.018, 0.26, 0.055]} />
            <meshStandardMaterial color={trimColor} roughness={0.9} />
          </mesh>
        ))}

        {/* Cổ tàu truyền thống (Mandarin standing collar) */}
        <mesh position={[0, 1.675, 0]}>
          <cylinderGeometry args={[0.138, 0.148, 0.075, 16]} />
          <meshStandardMaterial color={trimColor} roughness={0.84} />
        </mesh>
        {/* Cổ (Neck) */}
        <mesh position={[0, 1.725, 0]}>
          <cylinderGeometry args={[0.114, 0.124, 0.11, 14]} />
          <meshStandardMaterial color="#ecc39e" roughness={0.72} />
        </mesh>

        {isMale ? (
          /* === NAM PHẬT TỬ: Nẹp thẳng giữa ngực cài nút vải + 2 túi áo cư sĩ === */
          <group>
            {/* Nẹp áo thẳng chính giữa (Center vertical placket) */}
            <mesh position={[0, 1.22, 0.282]} rotation={[-0.06, 0, 0]}>
              <boxGeometry args={[0.036, 0.86, 0.018]} />
              <meshStandardMaterial color={trimColor} roughness={0.85} />
            </mesh>
            {/* 5 nút vải trắng ngà dọc giữa ngực */}
            {[1.59, 1.45, 1.31, 1.17, 1.03].map((by, idx) => (
              <mesh key={`m-btn-${idx}`} position={[0, by, 0.292 + (1.6 - by) * 0.03]}>
                <sphereGeometry args={[0.016, 8, 8]} />
                <meshStandardMaterial color="#f2ead8" roughness={0.65} />
              </mesh>
            ))}
            {/* 2 túi áo cư sĩ đắp nổi phía dưới vạt trước */}
            {[-0.135, 0.135].map((px, idx) => (
              <group key={`pocket-${idx}`} position={[px, 0.97, 0.278]} rotation={[-0.06, idx === 0 ? -0.35 : 0.35, 0]}>
                <mesh>
                  <boxGeometry args={[0.115, 0.13, 0.016]} />
                  <meshStandardMaterial color={seamColor} roughness={0.86} />
                </mesh>
                <mesh position={[0, 0.055, 0.004]}>
                  <boxGeometry args={[0.118, 0.022, 0.018]} />
                  <meshStandardMaterial color={trimColor} roughness={0.85} />
                </mesh>
              </group>
            ))}
          </group>
        ) : (
          /* === NỮ PHẬT TỬ: Nẹp áo vạt chéo truyền thống cài 5 nút vải === */
          <group>
            <mesh position={[0.08, 1.54, 0.252]} rotation={[0, 0, -0.62]}>
              <boxGeometry args={[0.032, 0.28, 0.018]} />
              <meshStandardMaterial color={trimColor} roughness={0.85} />
            </mesh>
            <mesh position={[0.165, 1.13, 0.285]} rotation={[-0.14, 0, 0]}>
              <boxGeometry args={[0.03, 0.62, 0.018]} />
              <meshStandardMaterial color={trimColor} roughness={0.85} />
            </mesh>
            {[
              [0.03, 1.61, 0.262],
              [0.095, 1.525, 0.262],
              [0.16, 1.435, 0.262],
              [0.168, 1.28, 0.282],
              [0.172, 1.12, 0.304],
            ].map(([bx, by, bz], idx) => (
              <mesh key={`f-btn-${idx}`} position={[bx, by, bz]}>
                <sphereGeometry args={[0.016, 8, 8]} />
                <meshStandardMaterial color="#f2ead8" roughness={0.65} />
              </mesh>
            ))}
          </group>
        )}

        {/* Huy hiệu hoa sen thêu ngực trái (Embroidered lotus badge on front left chest) */}
        <group position={[-0.115, 1.48, isMale ? 0.275 : 0.258]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.034, 0.034, 0.008, 12]} />
            <meshStandardMaterial color={trimColor} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0, 0.006]}>
            <sphereGeometry args={[0.018, 10, 8]} />
            <meshStandardMaterial color={isMale ? '#e8c872' : '#f0a8be'} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.004, 0.014]}>
            <sphereGeometry args={[0.009, 8, 8]} />
            <meshStandardMaterial color="#e8c266" roughness={0.5} />
          </mesh>
        </group>

        {/* Chi tiết mặt sau lưng áo lam (Back seam + subtle embroidered lotus motif) */}
        <mesh position={[0, 1.22, isMale ? -0.292 : -0.285]} rotation={[isMale ? 0.07 : 0.13, 0, 0]}>
          <boxGeometry args={[0.016, 0.82, 0.012]} />
          <meshStandardMaterial color={seamColor} roughness={0.88} />
        </mesh>
        <group position={[0, 1.47, isMale ? -0.272 : -0.256]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.052, 0.052, 0.006, 16]} />
            <meshStandardMaterial color={seamColor} roughness={0.82} />
          </mesh>
          {[0, -0.48, 0.48, -0.92, 0.92].map((ang, idx) => (
            <mesh
              key={`back-petal-${idx}`}
              position={[Math.sin(ang) * 0.018, Math.cos(ang) * 0.012 - 0.006, -0.004]}
              rotation={[0, 0, -ang]}
              scale={[0.55, 1.15, 0.35]}
            >
              <sphereGeometry args={[0.018, 8, 8]} />
              <meshStandardMaterial color={isMale ? '#d9c59a' : '#e8b4c4'} roughness={0.65} />
            </mesh>
          ))}
          <mesh position={[0, -0.016, -0.005]}>
            <sphereGeometry args={[0.011, 8, 8]} />
            <meshStandardMaterial color="#e6c36a" roughness={0.55} />
          </mesh>
        </group>

        {/* Tay áo lam dài + Vòng hạt gỗ trầm + Bàn tay (+ Gáo nước gỗ ở tay phải khi tưới cây) */}
        {[-armX, armX].map((x, i) => (
          <group
            key={i}
            ref={i === 0 ? armL : armR}
            position={[x, 1.58, 0]}
          >
            {/* Đầu vai áo bo tròn */}
            <mesh position={[0, 0, 0]} castShadow>
              <sphereGeometry args={[isMale ? 0.098 : 0.092, 12, 10]} />
              <meshStandardMaterial color={tunicColor} roughness={0.84} />
            </mesh>
            {/* Ống tay áo lam dài */}
            <mesh position={[0, -0.22, 0]} castShadow>
              <cylinderGeometry args={[isMale ? 0.094 : 0.088, isMale ? 0.104 : 0.098, 0.44, 14]} />
              <meshStandardMaterial color={tunicColor} roughness={0.84} />
            </mesh>
            {/* Viền cổ tay áo lam */}
            <mesh position={[0, -0.425, 0]} castShadow>
              <cylinderGeometry args={[isMale ? 0.105 : 0.099, isMale ? 0.107 : 0.101, 0.045, 14]} />
              <meshStandardMaterial color={trimColor} roughness={0.86} />
            </mesh>
            {/* Vòng chuỗi hạt gỗ trầm đeo cổ tay */}
            <mesh position={[0, -0.452, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.068, 0.016, 8, 14]} />
              <meshStandardMaterial color="#5c3820" roughness={0.65} />
            </mesh>
            {/* Bàn tay */}
            <mesh position={[0, -0.495, 0.01]} scale={[0.85, 1.15, 0.95]} castShadow>
              <sphereGeometry args={[0.064, 12, 10]} />
              <meshStandardMaterial color="#ecc39e" roughness={0.72} />
            </mesh>

            {/* Gáo nước gỗ cầm ở bàn tay phải khi đi múc nước / tưới cây */}
            {i === 1 && showLadle && (
              <group ref={ladleRef} position={[0, -0.51, 0.08]}>
                {/* Cán gáo tre/gỗ */}
                <mesh position={[0, 0.02, 0.12]} rotation={[Math.PI / 2 - 0.15, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.016, 0.018, 0.34, 8]} />
                  <meshStandardMaterial color="#6e4726" roughness={0.82} />
                </mesh>
                {/* Bầu gáo gỗ múc đầy nước */}
                <group position={[0, 0.04, 0.28]}>
                  <mesh castShadow>
                    <cylinderGeometry args={[0.105, 0.078, 0.13, 14]} />
                    <meshStandardMaterial color="#8a5a32" roughness={0.85} />
                  </mesh>
                  {/* Mặt nước xanh mát trong gáo */}
                  <mesh position={[0, 0.052, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <circleGeometry args={[0.094, 14]} />
                    <meshStandardMaterial color="#5eb5d6" roughness={0.2} transparent opacity={0.88} />
                  </mesh>
                  {/* Dòng nước chảy vồng ra từ gáo khi đang tưới cây */}
                  {(waterStream || waterState.phase === 'watering') && (
                    <group position={[0, 0.02, 0.08]} rotation={[0.65, 0, 0]}>
                      <mesh position={[0, -0.26, 0.14]}>
                        <cylinderGeometry args={[0.024, 0.065, 0.58, 10]} />
                        <meshStandardMaterial color="#8cd3f0" transparent opacity={0.62} roughness={0.15} />
                      </mesh>
                      <mesh position={[-0.03, -0.52, 0.28]}>
                        <sphereGeometry args={[0.038, 8, 8]} />
                        <meshStandardMaterial color="#bae8fa" transparent opacity={0.7} />
                      </mesh>
                      <mesh position={[0.04, -0.58, 0.32]}>
                        <sphereGeometry args={[0.032, 8, 8]} />
                        <meshStandardMaterial color="#bae8fa" transparent opacity={0.65} />
                      </mesh>
                    </group>
                  )}
                </group>
              </group>
            )}
          </group>
        ))}

        {/* Bát sành đựng cá phóng sinh nâng bằng hai bàn tay trước ngực khi thả cá */}
        {showReleaseBowl && (
          <group
            ref={releaseBowlRef}
            position={[0, 1.28, 0.43]}
            rotation={[0.35, 0, 0]}
          >
            {/* Thân bát sành nung */}
            <mesh castShadow>
              <cylinderGeometry args={[0.17, 0.105, 0.12, 18]} />
              <meshStandardMaterial color="#9c5a3c" roughness={0.78} />
            </mesh>
            {/* Vành miệng bát */}
            <mesh position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.168, 0.014, 8, 18]} />
              <meshStandardMaterial color="#7d442b" roughness={0.75} />
            </mesh>
            {/* Mặt nước trong bát */}
            <mesh position={[0, 0.042, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.154, 16]} />
              <meshStandardMaterial color="#67bddb" roughness={0.2} transparent opacity={0.85} />
            </mesh>
            {/* Các chú cá chép Koi nhỏ bơi trong bát trên tay trước khi nhảy ra khỏi bát xuống hồ */}
            {[
              { x: 0, z: 0.03, col: '#d95d2e' },
              { x: -0.055, z: -0.025, col: '#e8a83a' },
              { x: 0.055, z: -0.025, col: '#f2ede2' },
            ].map((cf, ci) => (
              <group
                key={`bowl-fish-${ci}`}
                ref={(el) => { bowlFishRefs.current[ci] = el; }}
                position={[cf.x, 0.055, cf.z]}
              >
                <mesh scale={[0.7, 0.55, 1.4]}>
                  <sphereGeometry args={[0.042, 10, 8]} />
                  <meshStandardMaterial color={cf.col} roughness={0.35} />
                </mesh>
                <mesh position={[0, 0.005, -0.055]} scale={[0.3, 0.65, 1.1]}>
                  <sphereGeometry args={[0.026, 8, 6]} />
                  <meshStandardMaterial color="#d95d2e" roughness={0.4} />
                </mesh>
              </group>
            ))}
          </group>
        )}

        {/* Đầu + Khuôn mặt hiền hòa */}
        <mesh castShadow position={[0, 1.96, 0]}>
          <sphereGeometry args={[0.235, 22, 22]} />
          <meshStandardMaterial color="#ecc39e" roughness={0.7} />
        </mesh>
        {/* Đôi tai */}
        {[-0.228, 0.228].map((ex, idx) => (
          <mesh key={`ear-${idx}`} position={[ex, 1.95, 0]} scale={[0.45, 0.85, 0.65]}>
            <sphereGeometry args={[0.055, 10, 10]} />
            <meshStandardMaterial color="#e6ba94" roughness={0.72} />
          </mesh>
        ))}
        {/* Chân mày (dày hơn một chút cho nam Phật tử) */}
        {[-0.075, 0.075].map((fx, idx) => (
          <mesh
            key={`brow-${idx}`}
            position={[fx, 2.015, 0.218]}
            rotation={[0, 0, idx === 0 ? (isMale ? 0.04 : 0.08) : isMale ? -0.04 : -0.08]}
          >
            <boxGeometry args={[isMale ? 0.058 : 0.052, isMale ? 0.014 : 0.01, 0.01]} />
            <meshStandardMaterial color="#241812" roughness={0.85} />
          </mesh>
        ))}
        {/* Đôi mắt an tĩnh */}
        {[-0.075, 0.075].map((fx, idx) => (
          <mesh key={`eye-${idx}`} position={[fx, 1.975, 0.224]}>
            <sphereGeometry args={[0.018, 10, 10]} />
            <meshStandardMaterial color="#1f1510" roughness={0.4} />
          </mesh>
        ))}
        {/* Nụ cười nhẹ */}
        <mesh position={[0, 1.895, 0.222]} rotation={[0.2, 0, 0]}>
          <torusGeometry args={[0.032, 0.006, 6, 12, Math.PI]} />
          <meshStandardMaterial color="#b86b5a" roughness={0.7} />
        </mesh>

        {/* Mái tóc theo giới tính */}
        {isMale ? (
          /* === TÓC NAM PHẬT TỬ: Cắt ngắn gọn gàng, ôm sát gáy & hai bên mai === */
          <group>
            <mesh castShadow position={[0, 1.995, -0.012]}>
              <sphereGeometry args={[0.244, 22, 18, 0, Math.PI * 2, 0, Math.PI * 0.56]} />
              <meshStandardMaterial color="#1d1511" roughness={0.84} />
            </mesh>
            {/* Phần tóc sau gáy cắt ngắn gọn */}
            <mesh castShadow position={[0, 1.945, -0.075]} scale={[0.95, 0.82, 0.78]}>
              <sphereGeometry args={[0.218, 18, 14]} />
              <meshStandardMaterial color="#1d1511" roughness={0.84} />
            </mesh>
            {/* Mái tóc trước trán rẽ gọn */}
            <mesh position={[0.02, 2.095, 0.185]} rotation={[0.32, 0, -0.12]} scale={[1.35, 0.42, 0.55]}>
              <sphereGeometry args={[0.11, 12, 10]} />
              <meshStandardMaterial color="#1d1511" roughness={0.84} />
            </mesh>
            {/* Hai mai tóc gọn bên thái dương */}
            {[-0.218, 0.218].map((sx, idx) => (
              <mesh key={`sideburn-${idx}`} position={[sx, 1.985, 0.06]} scale={[0.25, 0.75, 0.45]}>
                <boxGeometry args={[0.06, 0.11, 0.08]} />
                <meshStandardMaterial color="#1d1511" roughness={0.85} />
              </mesh>
            ))}
          </group>
        ) : (
          /* === TÓC NỮ PHẬT TỬ: Mái tóc đen mượt búi gọn sau đầu cài trâm gỗ trầm === */
          <group>
            <mesh castShadow position={[0, 1.99, -0.018]}>
              <sphereGeometry args={[0.244, 22, 20, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
              <meshStandardMaterial color="#1f1612" roughness={0.82} />
            </mesh>
            <mesh castShadow position={[0, 1.93, -0.09]} scale={[0.96, 0.88, 0.82]}>
              <sphereGeometry args={[0.22, 18, 16]} />
              <meshStandardMaterial color="#1f1612" roughness={0.82} />
            </mesh>
            {/* Búi tóc truyền thống gọn gàng sau đầu */}
            <group position={[0, 1.94, -0.25]}>
              <mesh position={[0, 0, 0.025]} rotation={[0.15, 0, 0]}>
                <torusGeometry args={[0.072, 0.016, 8, 16]} />
                <meshStandardMaterial color="#4b6075" roughness={0.8} />
              </mesh>
              <mesh castShadow position={[0, 0, -0.015]} scale={[1.05, 0.95, 0.88]}>
                <sphereGeometry args={[0.088, 16, 14]} />
                <meshStandardMaterial color="#1f1612" roughness={0.82} />
              </mesh>
              {/* Trâm gỗ trầm cài tóc */}
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
        )}
      </group>
    </group>
  );
}
