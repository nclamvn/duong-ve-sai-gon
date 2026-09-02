/**
 * Texture FX sinh procedural bằng canvas (TIP-013): flipbook muzzle flash 4×4, khói mềm, lỗ đạn.
 * Seeded (mulberry32) → deterministic; không asset ngoài; không Math.random.
 */
import { CanvasTexture, SRGBColorSpace, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, ClampToEdgeWrapping } from 'three/webgpu';
import { mulberry32 } from '@engine/core';

function canvas(size: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

function finish(c: HTMLCanvasElement, srgb = true): CanvasTexture {
  const t = new CanvasTexture(c);
  t.colorSpace = srgb ? SRGBColorSpace : 'srgb-linear';
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.wrapS = ClampToEdgeWrapping;
  t.wrapT = ClampToEdgeWrapping;
  t.generateMipmaps = true;
  return t;
}

/** Flipbook 4×4 (mỗi ô 128 px): lõi sáng + 6–10 tia + đốm; alpha trong kênh A. */
export function makeFlashFlipbook(seed = 11): CanvasTexture {
  const N = 4;
  const cell = 128;
  const { c, ctx } = canvas(N * cell);
  const prng = mulberry32(seed);
  ctx.clearRect(0, 0, c.width, c.height);
  for (let i = 0; i < N * N; i++) {
    const cx = (i % N) * cell + cell / 2;
    const cy = Math.floor(i / N) * cell + cell / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalCompositeOperation = 'lighter';
    // tia
    const spikes = 6 + prng.int(0, 4);
    for (let s = 0; s < spikes; s++) {
      const a = prng.range(0, Math.PI * 2);
      const len = cell * prng.range(0.22, 0.48);
      const w = prng.range(2, 6);
      const g = ctx.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
      g.addColorStop(0, 'rgba(255,230,180,0.9)');
      g.addColorStop(0.5, 'rgba(255,170,70,0.45)');
      g.addColorStop(1, 'rgba(255,120,30,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      ctx.stroke();
    }
    // đốm
    for (let b = 0; b < 5; b++) {
      const a = prng.range(0, Math.PI * 2);
      const d = cell * prng.range(0.1, 0.3);
      const r = prng.range(3, 9);
      const g = ctx.createRadialGradient(Math.cos(a) * d, Math.sin(a) * d, 0, Math.cos(a) * d, Math.sin(a) * d, r);
      g.addColorStop(0, 'rgba(255,200,120,0.8)');
      g.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // lõi
    const core = cell * prng.range(0.14, 0.22);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, core);
    g.addColorStop(0, 'rgba(255,255,240,1)');
    g.addColorStop(0.35, 'rgba(255,220,150,0.9)');
    g.addColorStop(1, 'rgba(255,150,50,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, core, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return finish(c);
}

/** Khói/bụi mềm: đĩa noise mờ, alpha trong A, RGB trắng (tint bằng material). */
export function makeSoftPuff(seed = 5): CanvasTexture {
  const size = 128;
  const { c, ctx } = canvas(size);
  const prng = mulberry32(seed);
  ctx.clearRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'lighter';
  for (let b = 0; b < 26; b++) {
    const a = prng.range(0, Math.PI * 2);
    const d = prng.range(0, size * 0.28);
    const r = prng.range(size * 0.12, size * 0.3);
    const x = size / 2 + Math.cos(a) * d;
    const y = size / 2 + Math.sin(a) * d;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // mép ngoài về 0 chắc chắn
  ctx.globalCompositeOperation = 'destination-in';
  const edge = ctx.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size * 0.5);
  edge.addColorStop(0, 'rgba(0,0,0,1)');
  edge.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, size, size);
  return finish(c);
}

/** Lỗ đạn: tâm đen, vành xám ráp, vết nứt; alpha rìa mềm. */
export function makeBulletHole(seed = 3): CanvasTexture {
  const size = 96;
  const { c, ctx } = canvas(size);
  const prng = mulberry32(seed);
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, size * 0.5);
  g.addColorStop(0, 'rgba(8,8,8,1)');
  g.addColorStop(0.22, 'rgba(20,18,16,0.95)');
  g.addColorStop(0.42, 'rgba(70,66,60,0.55)');
  g.addColorStop(0.7, 'rgba(90,86,80,0.18)');
  g.addColorStop(1, 'rgba(90,86,80,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(30,28,26,0.7)';
  ctx.lineWidth = 1.5;
  for (let k = 0; k < 7; k++) {
    const a = prng.range(0, Math.PI * 2);
    const l = prng.range(size * 0.18, size * 0.42);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * size * 0.1, cx + Math.sin(a) * size * 0.1);
    ctx.lineTo(cx + Math.cos(a + prng.range(-0.2, 0.2)) * l, cx + Math.sin(a + prng.range(-0.2, 0.2)) * l);
    ctx.stroke();
  }
  return finish(c);
}

export const FLIPBOOK_N = 4;
export { RepeatWrapping };
