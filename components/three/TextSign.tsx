'use client';

import { useEffect, useState } from 'react';
import * as THREE from 'three';

/**
 * A real 3D sign: the text is drawn once onto a canvas (dark brown
 * wood background, warm yellow carved-style letters, thin gold
 * border, matte finish) and applied as a texture to a plane mesh.
 * Canvas text keeps full Vietnamese diacritics exact — no font
 * file, no 3D-text loader, no external request at runtime.
 *
 * Diacritic headroom: the canvas is 1024x256, the text is drawn
 * at ~112px (shrunk to fit if needed), centred slightly low, so
 * the stacked marks of CHÙA (Ù) and HẢI (Ả) never clip at the
 * top edge.
 *
 * Font correctness: the texture is drawn with an EMBEDDED font,
 * not the device's default serif. Two Noto Serif Bold woff2
 * files (vietnamese + latin subsets, from Google Fonts, in
 * public/fonts/) are loaded under one family name via the
 * FontFace API, so every glyph — including the precomposed
 * Ề, Ệ, Ả — comes from the same font on every device. Drawing
 * with a name like 'Noto Serif' alone does NOT work: Next's
 * font loader serves it under a hashed family name, so canvas
 * fell back to the device serif, whose Vietnamese marks render
 * detached or misplaced — the "font error" look the user saw
 * twice. The texture is drawn once immediately (fallback font,
 * never blank), then re-drawn as soon as the embedded faces
 * load, so the final sign always uses the embedded font.
 */
function drawSign(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  // Dark brown wood background
  ctx.fillStyle = '#4a2e1a';
  ctx.fillRect(0, 0, 1024, 256);
  // Subtle wood grain lines
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 2;
  for (let y = 30; y < 256; y += 42) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(300, y + 6, 700, y - 6, 1024, y);
    ctx.stroke();
  }
  // Thin warm-gold border
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, 1024 - 28, 256 - 28);
  // Carved-style letters: sturdy serif with a light foot, warm yellow.
  // Fit the text to the canvas: measure first, then shrink the
  // font so the whole line (including T and N at the ends) stays
  // inside the border — never clipped at the edges.
  ctx.fillStyle = '#e8c86a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let fontSize = 112;
  ctx.font = `700 ${fontSize}px 'ChuaSignSerif', Georgia, 'Times New Roman', serif`;
  const measured = ctx.measureText(text).width;
  if (measured > 920) {
    fontSize = Math.floor((fontSize * 920) / measured);
    ctx.font = `700 ${fontSize}px 'ChuaSignSerif', Georgia, 'Times New Roman', serif`;
  }
  // Slightly low centre leaves headroom above for stacked diacritics
  ctx.fillText(text, 512, 140);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export default function TextSign({
  text,
  width,
  height,
  position,
  rotationY = 0,
}: {
  text: string;
  width: number;
  height: number;
  position: [number, number, number];
  rotationY?: number;
}) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    let cancelled = false;
    // Draw once immediately (so the sign is never blank), then
    // load the embedded faces and re-draw, so the final texture
    // uses Noto Serif's real precomposed diacritics.
    setTexture(drawSign(text));
    if (typeof document !== 'undefined' && document.fonts && typeof FontFace !== 'undefined') {
      const faces = [
        new FontFace('ChuaSignSerif', 'url(/fonts/noto-serif-vietnamese.woff2)', {
          weight: '700',
          unicodeRange:
            'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB',
        }),
        new FontFace('ChuaSignSerif', 'url(/fonts/noto-serif-latin.woff2)', {
          weight: '700',
          unicodeRange:
            'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
        }),
      ];
      Promise.all(
        faces.map((f) =>
          f
            .load()
            .then((loaded) => document.fonts.add(loaded))
            .catch(() => {}),
        ),
      )
        .then(() => document.fonts.load("700 112px 'ChuaSignSerif'"))
        .then(() => {
          if (!cancelled) setTexture(drawSign(text));
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [text]);

  if (!texture) return null;
  return (
    <mesh position={position} rotation={[0, rotationY, 0]}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={texture} roughness={0.9} metalness={0} />
    </mesh>
  );
}
