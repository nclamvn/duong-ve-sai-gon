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

/** nhiễu giá trị 2D lặp ô (hash nguyên), fbm 4 tầng — chỉ dùng lúc sinh texture */
function makeNoise(seed: number): (x: number, y: number) => number {
  const h = (ix: number, iy: number): number => {
    let x = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 2246822519)) >>> 0;
    x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0;
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  };
  const vn = (x: number, y: number): number => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = h(ix, iy) + (h(ix + 1, iy) - h(ix, iy)) * sx;
    const b = h(ix, iy + 1) + (h(ix + 1, iy + 1) - h(ix, iy + 1)) * sx;
    return a + (b - a) * sy;
  };
  return (x, y) => vn(x, y) * 0.5 + vn(x * 2.03, y * 2.03) * 0.25 + vn(x * 4.1, y * 4.1) * 0.15 + vn(x * 8.3, y * 8.3) * 0.1;
}

/** dải màu theo nhiệt của lửa nòng (0..1): đỏ sẫm → cam → vàng → trắng nóng (sRGB 0..255) */
function flashRamp(t: number): [number, number, number] {
  const stops: Array<[number, number, number, number]> = [
    [0, 120, 22, 4],
    [0.3, 235, 92, 18],
    [0.55, 255, 168, 58],
    [0.8, 255, 226, 150],
    [1, 255, 252, 236],
  ];
  const k = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1]!;
    const b = stops[i]!;
    if (k <= b[0]) {
      const u = (k - a[0]) / (b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u];
    }
  }
  return [255, 252, 236];
}

/**
 * Atlas lửa nòng (DV-087): 4×4 ô 256 px. Hai hàng trên = 8 dáng nhìn từ trước (sao 3–5 cánh không đều do khí thoát lệch của bộ hãm,
 * lõi trắng nóng, mép bị nhiễu gặm, đốm hạt cháy dở); hai hàng dưới = 8 dáng nhìn ngang (u dọc nòng 0 → 1 hướng bắn: lõi sáng sát
 * đầu nòng, "đĩa sốc" sáng thứ hai, chùm lửa loe ra rồi vỡ thành lưỡi, hai luồng phụ xiên lên trên). Màu theo nhiệt, alpha trong A.
 */
export function makeMuzzleAtlas(seed = 29): CanvasTexture {
  const N = 4;
  const cell = 256;
  const { c, ctx } = canvas(N * cell);
  const img = ctx.createImageData(c.width, c.height);
  const px = img.data;
  const prng = mulberry32(seed);
  const noise = makeNoise(seed);
  const put = (x: number, y: number, t: number, a: number): void => {
    const i = (y * c.width + x) * 4;
    const [r, g, b] = flashRamp(t);
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = Math.max(0, Math.min(255, a * 255));
  };
  const sm = (e0: number, e1: number, x: number): number => {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  for (let f = 0; f < 16; f++) {
    const ox = (f % N) * cell;
    const oy = Math.floor(f / N) * cell;
    const side = f >= 8;
    const nOff = prng.range(0, 100);
    if (!side) {
      // ---- nhìn từ trước: bán kính theo góc = nền + các cánh rộng (2 cánh trội do khí thoát lệch của bộ hãm)
      const petals = 3 + prng.int(0, 2);
      const rot = prng.range(0, Math.PI * 2);
      const pa: number[] = [];
      const pl: number[] = [];
      const pw: number[] = [];
      for (let k = 0; k < petals; k++) {
        pa.push(rot + (k / petals) * Math.PI * 2 + prng.range(-0.45, 0.45));
        pl.push(k < 2 ? prng.range(0.55, 0.85) : prng.range(0.25, 0.55));
        pw.push(prng.range(0.32, 0.6));
      }
      const base = prng.range(0.24, 0.34);
      for (let y = 0; y < cell; y++) {
        for (let x = 0; x < cell; x++) {
          const dx = (x + 0.5) / cell - 0.5;
          const dy = (y + 0.5) / cell - 0.5;
          const r = Math.hypot(dx, dy) * 2;
          const th = Math.atan2(dy, dx);
          let R = base;
          for (let k = 0; k < petals; k++) {
            let d = th - pa[k]!;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            R = Math.max(R, base + pl[k]! * Math.exp(-((d / pw[k]!) ** 2)));
          }
          R = Math.min(0.96, R * (0.82 + noise(Math.cos(th) * 2.5 + nOff, Math.sin(th) * 2.5 + nOff) * 0.36));
          // ngoài vùng lửa: điểm ảnh trong suốt, khỏi tính nhiễu (sinh atlas nhanh gấp đôi lúc nạp)
          if (r > R * 1.25 && r > 0.5) continue;
          // nhiễu cuộn theo bán kính (lưỡi lửa tách ra ở mép), chỉ trong vùng lửa → nền sạch, không đốm lạc
          const n = noise(dx * 10 + nOff, dy * 10 - nOff);
          const n2 = noise(r * 6 - nOff + Math.cos(th) * 1.7, Math.sin(th) * 1.7 + nOff);
          const inside = 1 - r / R;
          const env = sm(-0.25, 0.15, inside);
          const body = (inside + (n - 0.5) * 0.7 + (n2 - 0.5) * 0.35) * env;
          const core = Math.exp(-((r / 0.2) ** 2));
          const heat = Math.min(1, Math.max(0, body) * 1.25 * (0.75 + n2 * 0.5) + core);
          const a = sm(0.04, 0.32, body) * sm(1.0, 0.9, r) + core;
          put(ox + x, oy + y, heat, Math.min(1, a));
        }
      }
    } else {
      // ---- nhìn ngang: u dọc nòng (0 = đầu nòng), v ngang (−1..1)
      const len = prng.range(0.66, 0.86);
      const flare = prng.range(0.34, 0.5);
      const disc = prng.range(0.18, 0.3);
      const jet = prng.range(0.5, 0.9);
      const u0 = 0.05; // đầu nòng nằm trong ô (không cắt mép)
      for (let y = 0; y < cell; y++) {
        for (let x = 0; x < cell; x++) {
          const u = (x + 0.5) / cell;
          const v = ((y + 0.5) / cell - 0.5) * 2;
          const uu = Math.max(0, u - u0);
          // chùm chính: hẹp sát nòng, loe ra, ngọn vỡ thành lưỡi
          const w = (0.09 + flare * Math.pow(uu / len, 0.6)) * (1 - sm(len * 0.7, len, uu) * 0.5);
          // ngoài chùm, ngoài luồng phụ, xa lõi: trong suốt, khỏi tính nhiễu
          if (Math.abs(v) > w * 1.45 + 0.02 && !(uu < 0.26 && Math.abs(v + uu * 2.4) < 0.16) && Math.abs(u - u0) > 0.2) continue;
          const n = noise(uu * 6 - nOff, v * 3 + nOff);
          const n2 = noise(uu * 15 + nOff, v * 7.5 - nOff * 0.5);
          const across = 1 - Math.abs(v) / Math.max(0.02, w);
          const along = sm(0, 0.03, uu) * (1 - sm(len * 0.45, len, uu));
          const env = sm(-0.4, 0.1, across) * (u > u0 ? 1 : 0) * (1 - sm(0.88, 0.98, u));
          let body = (across * along + (n - 0.5) * 0.75 + (n2 - 0.5) * 0.35) * env;
          // luồng phụ của bộ hãm: hai lưỡi ngắn xiên lên sát đầu nòng
          const jv = v + uu * 2.4;
          const jIn = Math.max(0, 1 - Math.abs(jv) / 0.13) * Math.max(0, 1 - uu / (0.24 * jet)) * (uu > 0 ? 1 : 0);
          body = Math.max(body, jIn * (0.85 + (n2 - 0.5) * 0.5));
          const core = Math.exp(-(((u - u0 - 0.03) / 0.06) ** 2) - (v / 0.15) ** 2);
          const shock = Math.exp(-(((uu - disc) / 0.05) ** 2) - (v / 0.12) ** 2) * 0.85;
          // nhiệt: sát nòng trắng nóng, xa dần nguội; nhiễu tạo vệt nóng/nguội xen kẽ trong chùm
          const heat = Math.min(1, Math.max(0, body) * (1.15 - uu * 0.7) * (0.6 + n2 * 0.8) + core + shock);
          const a = sm(0.04, 0.34, body) + core + shock * 0.8;
          put(ox + x, oy + y, heat, Math.min(1, a));
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
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
