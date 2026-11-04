import { useMemo } from 'react';
import * as THREE from 'three';

function canvasTexture(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, s: number) => void,
  repeat: [number, number] = [1, 1],
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Procedural canvas textures — no downloaded images, no heavy GLB,
 * but far from flat colours: wood grain, roof tiles, stone, brick,
 * grass and door panels. Generated once per page load.
 */
export function useTextures() {
  return useMemo(() => {
    const wood = canvasTexture(256, (c, s) => {
      c.fillStyle = '#6d4526';
      c.fillRect(0, 0, s, s);
      for (let i = 0; i < 60; i++) {
        c.strokeStyle = `rgba(${30 + Math.random() * 40},${18 + Math.random() * 20},8,${0.15 + Math.random() * 0.25})`;
        c.lineWidth = 1 + Math.random() * 2;
        c.beginPath();
        const x = Math.random() * s;
        c.moveTo(x, 0);
        c.bezierCurveTo(x + 6, s * 0.3, x - 6, s * 0.6, x + 3, s);
        c.stroke();
      }
    }, [2, 2]);

    const roofTile = canvasTexture(256, (c, s) => {
      c.fillStyle = '#8a3b28';
      c.fillRect(0, 0, s, s);
      const rows = 8;
      const rh = s / rows;
      for (let r = 0; r < rows; r++) {
        for (let x = 0; x < s; x += 32) {
          const shade = 0.85 + Math.random() * 0.3;
          c.fillStyle = `rgb(${Math.round(138 * shade)},${Math.round(59 * shade)},${Math.round(40 * shade)})`;
          c.beginPath();
          c.roundRect(x + 1, r * rh + 1, 30, rh, 6);
          c.fill();
          c.fillStyle = 'rgba(0,0,0,0.25)';
          c.fillRect(x + 1, r * rh + rh - 3, 30, 3);
        }
      }
    }, [4, 2]);

    const stone = canvasTexture(256, (c, s) => {
      c.fillStyle = '#8d8a82';
      c.fillRect(0, 0, s, s);
      for (let i = 0; i < 900; i++) {
        c.fillStyle = `rgba(${40 + Math.random() * 80},${40 + Math.random() * 70},${35 + Math.random() * 60},0.25)`;
        c.fillRect(Math.random() * s, Math.random() * s, 2, 2);
      }
      c.strokeStyle = 'rgba(0,0,0,0.2)';
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.moveTo(0, (i * s) / 4);
        c.lineTo(s, (i * s) / 4);
        c.stroke();
      }
    }, [3, 3]);

    const brick = canvasTexture(256, (c, s) => {
      c.fillStyle = '#9a6b52';
      c.fillRect(0, 0, s, s);
      const bh = 32;
      const bw = 64;
      for (let r = 0; r < s / bh; r++) {
        const off = r % 2 ? bw / 2 : 0;
        for (let x = -bw; x < s + bw; x += bw) {
          const shade = 0.9 + Math.random() * 0.2;
          c.fillStyle = `rgb(${Math.round(154 * shade)},${Math.round(107 * shade)},${Math.round(82 * shade)})`;
          c.fillRect(x + off + 2, r * bh + 2, bw - 4, bh - 4);
        }
      }
    }, [8, 8]);

    const grass = canvasTexture(256, (c, s) => {
      c.fillStyle = '#5d8a3c';
      c.fillRect(0, 0, s, s);
      for (let i = 0; i < 1400; i++) {
        c.strokeStyle = `rgba(${60 + Math.random() * 60},${120 + Math.random() * 60},40,0.5)`;
        c.lineWidth = 1;
        const x = Math.random() * s;
        const y = Math.random() * s;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + 2, y - 5);
        c.stroke();
      }
    }, [10, 10]);

    const door = canvasTexture(256, (c, s) => {
      c.fillStyle = '#5a3418';
      c.fillRect(0, 0, s, s);
      c.strokeStyle = '#d4af37';
      c.lineWidth = 4;
      c.strokeRect(18, 18, s - 36, s - 36);
      c.strokeRect(52, 52, s - 104, s - 104);
      c.fillStyle = '#d4af37';
      c.beginPath();
      c.arc(s / 2, s / 2, 14, 0, Math.PI * 2);
      c.fill();
    }, [1, 1]);

    return { wood, roofTile, stone, brick, grass, door };
  }, []);
}
