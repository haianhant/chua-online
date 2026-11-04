'use client';
import { useGLTF } from '@react-three/drei';

// PREVIEW models (deployed 2026-11-03 for the user's own review;
// credit in Help 'Nguồn tượng'; remove if he rejects the previews).
// Optimized Sketchfab models (see ~/workspace/tools/statue-work/):
// - Shakyamuni: Cleveland Museum of Art, CC0, 150,384 tris, textures
//   4096 -> 2048, warm tint. Model height 0.575m, scale 2.599 (+15%,
//   2026-11-04) -> ~1.49m, width 0.469m -> ~1.22m (west plinth
//   enlarged to top r 0.60 to match).
//   ORIGIN BUG, measured 2026-11-03 in glTF coords (the file's root
//   node rotates -90° about X, so the model sits 1.0817m north, 0.1578m
//   below and 0.0442m west of its origin): without compensation the
//   statue lands ~2.4m behind its pedestal, sunk 0.41m at scale 2.599.
//   The offset group below cancels it exactly (offset = -scale *
//   origin offset), so the statue's base lands on the plinth top,
//   centred. MUST update the offset whenever the scale changes.
// - Ksitigarbha: Truong Kieu Van, CC BY 4.0, 126,450 tris after 16%
//   decimate + rocks removed, geometry recentered 2026-11-03 so its
//   glTF bbox is centred with base at Y=0 (no offset needed).
//   Figure height 1.588m, scale 1.1385 (+15%, 2026-11-04) -> ~1.81m,
//   staff top ~2.32m above base (world ~3.95m, clear of the hall
//   beams at 6.65m).
// Both front faces +Z (south in the hall).
export function ShakyamuniPreview() {
  const { scene } = useGLTF('/models/shakyamuni-preview.glb');
  // Offset = -2.599 * (-0.0442, -0.1578, -1.0817) = (0.115, 0.410, 2.811).
  return (
    <group position={[0.115, 0.410, 2.811]}>
      <primitive object={scene} scale={2.599} />
    </group>
  );
}
export function KsitigarbhaPreview() {
  const { scene } = useGLTF('/models/ksitigarbha-preview.glb');
  return <primitive object={scene} scale={1.1385} />;
}
// NO preload here, on purpose: these two GLBs must NOT download on
// the welcome screen (see the lazy-load note in Temple.tsx). They
// start fetching only after the guest enters, while walking to the
// hall. Guanyin keeps its own preload — the main altar must be ready.
