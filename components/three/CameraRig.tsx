'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { controls, LAYOUT, isInHall } from './controls';

/**
 * Third-person camera, smoothed every frame (no snapping):
 * - menu: slow orbit around the temple for the welcome screen
 * - intro: gentle sweep from the gate view down to behind the player
 * - follow: behind + above the player, yaw/pitch from drag, wheel zoom
 * - burner: close, quiet view of the burner during the ritual
 * - chant: quiet view from the player towards the hall
 * - bath: slow east-side arc around the infant statue during the bath ritual, so the player (south of the basin) never blocks the statue
 */
export default function CameraRig() {
  const { camera } = useThree();
  const smooth = useRef(new THREE.Vector3(0, 5, 20));
  const lookSmooth = useRef(new THREE.Vector3(0, 2, -9));
  const started = useRef(false);
  const prevMode = useRef(controls.mode);
  const bathT0 = useRef(0);

  useFrame(({ clock, scene }, delta) => {
    const dt = Math.min(delta, 0.05);
    const p = controls.playerPos;
    const t = clock.getElapsedTime();
    const ease = 1 - Math.exp(-3.2 * dt);
    let target = new THREE.Vector3();
    let look = new THREE.Vector3(p.x, p.y + 1.6, p.z);
    // Indoor adaptation: inside the hall the follow camera pulls
    // closer and is clamped inside the hall, so it never punches
    // through a wall, the roof or the altar. Outside, the normal
    // follow camera returns (the lerp smooths the transition).
    const indoor = controls.mode === 'follow' && isInHall(p.x, p.z);
    const effDistance = indoor ? Math.min(controls.distance, 4.2) : controls.distance;

    if (controls.mode === 'menu') {
      // Front arc ONLY (fixed 2026-11-03): the old full 360° orbit
      // (radius 17 around (0,-2)) drove the camera straight
      // THROUGH the enlarged hall (x ±10, z -26..-5.8, roof ~11m)
      // whenever it swung north. Now the camera swings gently
      // left-right in front of the gate (z 19.8..24, south of the
      // gate at z 13, height 7.5 above all trees) and looks north
      // at the gate + hall — it never enters a building.
      const a = Math.sin(t * 0.08) * 0.7;
      target.set(Math.sin(a) * 18, 7.5 + Math.sin(t * 0.2) * 0.5, 6 + Math.cos(a) * 18);
      look.set(0, 3, 0);
    } else if (controls.mode === 'intro') {
      controls.introT = Math.min(1, controls.introT + dt / 3);
      // Hold the gate view for the first ~1.2s (introT < 0.4) so
      // the very first clear frame already shows the institute
      // sign, the passage through the gate and the hall roof
      // behind — then sweep down to behind the player.
      const rawK = controls.introT < 0.4 ? 0 : (controls.introT - 0.4) / 0.6;
      const smoothK = rawK * rawK * (3 - 2 * rawK);
      const follow = new THREE.Vector3(
        p.x + Math.sin(controls.yaw) * controls.distance,
        p.y + 1.6 + Math.sin(controls.pitch) * controls.distance,
        p.z + Math.cos(controls.yaw) * controls.distance,
      );
      const start = new THREE.Vector3(0, 2.8, 27);
      target.lerpVectors(start, follow, smoothK);
      look.lerpVectors(new THREE.Vector3(0, 4.0, 13), new THREE.Vector3(p.x, p.y + 1.6, p.z), smoothK);
      if (controls.introT >= 1) controls.mode = 'follow';
    } else if (controls.mode === 'burner') {
      target.set(LAYOUT.burner.x + 1.4, 1.9, LAYOUT.burner.z + 2.6);
      look.set(LAYOUT.burner.x, 1.0, LAYOUT.burner.z);
    } else if (controls.mode === 'sweep') {
      // Sweep view (Request C): a FIXED side/behind view, not a
      // rotating orbit. Camera sits south-west of the player
      // (player faces east toward the pile), 4.5m back, 3.2m up,
      // looking at the player + broom + ground leaves, with the
      // banyan behind them in frame. The existing lerp smooths
      // the shift in (~1s, during preparing) and back out to
      // follow when the sweep ends — no snap, no close zoom,
      // no continuous rotation, buildings never leave frame.
      target.set(p.x - 2.0, p.y + 3.2, p.z + 4.5);
      look.set(p.x + 0.8, p.y + 0.7, p.z);
    } else if (controls.mode === 'chant') {
      // Quiet angle: a little behind/side of the player, looking to the hall
      target.set(p.x + 1.8, 2.2, p.z + 2.4);
      look.set(0, 2.5, -9);
    } else if (controls.mode === 'bath') {
      // Bath view (user request 2026-11-04): a slow east-side arc
      // around the infant statue, so the statue stays in frame and
      // the player (standing south of the basin, facing north) never
      // blocks it. The follow camera sits due south of the player
      // and looks straight through the player at the statue — this
      // arc stays 34..74 degrees east of south, outside the pavilion
      // platform, and sways gently instead of spinning, so the
      // pour stays readable. Radius 3.6m, height 2.1m, looking at
      // the statue mid-height (~1.5m).
      if (prevMode.current !== 'bath') bathT0.current = t;
      const tau = Math.max(0, t - bathT0.current);
      const th = 0.95 + 0.35 * Math.sin(0.25 * tau);
      target.set(
        LAYOUT.lumbiniBasin.x + Math.sin(th) * 3.6,
        2.1,
        LAYOUT.lumbiniBasin.z + Math.cos(th) * 3.6,
      );
      look.set(LAYOUT.lumbiniBasin.x, 1.5, LAYOUT.lumbiniBasin.z);
    } else {
      const h = Math.cos(controls.pitch) * effDistance;
      target.set(
        p.x + Math.sin(controls.yaw) * h,
        p.y + 1.6 + Math.sin(controls.pitch) * effDistance,
        p.z + Math.cos(controls.yaw) * h,
      );
      if (indoor) {
        // Clamp inside the enlarged hall, below the raised roof beams
        // (y 5.65) and above the floor, so the camera never leaves the
        // room even when the player stands near the doorway. The
        // south clamp is just inside the front wall (-5.8), not in
        // the porch; the north clamp stays south of the altar
        // platform (-21.8).
        target.x = Math.max(-9.0, Math.min(9.0, target.x));
        target.z = Math.max(-25.0, Math.min(-5.9, target.z));
        target.y = Math.max(p.y + 1.2, Math.min(6.4, target.y));
      }
    }

    // Snap on mode change into intro: the first frame after
    // entering must already be the gate view (sign centred, passage
    // and hall roof behind), not a smeared transition from the
    // menu orbit position that happened to be near the gate.
    if (prevMode.current !== controls.mode && controls.mode === 'intro') {
      smooth.current.set(0, 2.8, 27);
      lookSmooth.current.set(0, 4.0, 13);
      started.current = true;
    }
    prevMode.current = controls.mode;
    if (!started.current) {
      smooth.current.copy(target);
      lookSmooth.current.copy(look);
      started.current = true;
    }
    smooth.current.lerp(target, ease);
    lookSmooth.current.lerp(look, ease);
    camera.position.copy(smooth.current);
    camera.lookAt(lookSmooth.current);
  });

  return null;
}
