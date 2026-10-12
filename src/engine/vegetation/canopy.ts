/**
 * Bản đồ độ che tán (DV-079): ô 2D phủ vùng rừng, mỗi texel = phần trời bị tán cây che (0 trống … 1 kín). Dựng một lần trên CPU
 * từ chính vị trí cây của scatter (tán tròn bán kính theo chiều cao cây × scale, cộng dồn có bão hoà, làm mịn box 2 lượt).
 *
 * Dùng trong material terrain + thực vật tầng thấp:
 *  - che ánh trời gián tiếp (aoNode): dưới tán kín nền rừng tối, khoảng trống sáng — chiều sâu như ảnh thật;
 *  - thay bóng nắng ở xa ngoài tầm CSM (`maxFar`): xa hơn tầm bóng thì nền dưới tán vẫn tối thay vì sáng phẳng;
 *  - giảm ánh nắng xuyên lá của cây bụi đứng dưới tán kín.
 * Texture cấp sẵn kích thước cố định (material dựng trước rừng), đổ dữ liệu sau qua `fill` (needsUpdate).
 */
import { DataTexture, RedFormat, UnsignedByteType, LinearFilter, ClampToEdgeWrapping, Vector4 } from 'three/webgpu';
import { texture, uniform, vec2, positionWorld, float } from 'three/tsl';
import type { Node } from 'three/webgpu';

export const CANOPY_RES = 512;

export interface CanopyTree {
  x: number;
  z: number;
  /** bán kính tán (m) */
  r: number;
  /** độ đặc tán 0..1 */
  k: number;
}

export class CanopyMap {
  readonly data = new Uint8Array(CANOPY_RES * CANOPY_RES);
  readonly texture: DataTexture;
  /** x0, z0, 1/w, 1/h (vùng phủ, hệ level) */
  readonly rect = uniform(new Vector4(0, 0, 1e-6, 1e-6));
  readonly stats = { trees: 0, mean: 0, closed: 0 };

  constructor() {
    this.texture = new DataTexture(this.data, CANOPY_RES, CANOPY_RES, RedFormat, UnsignedByteType);
    this.texture.magFilter = this.texture.minFilter = LinearFilter;
    this.texture.wrapS = this.texture.wrapT = ClampToEdgeWrapping;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
  }

  /** độ che 0..1 tại world xz (node TSL) — ngoài vùng = 0 */
  sample(): Node<'float'> {
    const r = this.rect as unknown as Node<'vec4'>;
    const uvn = vec2(positionWorld.x.sub(r.x).mul(r.z), positionWorld.z.sub(r.y).mul(r.w));
    const inside = uvn.x.greaterThanEqual(0).and(uvn.x.lessThanEqual(1)).and(uvn.y.greaterThanEqual(0)).and(uvn.y.lessThanEqual(1));
    return inside.select(texture(this.texture, uvn).r, float(0)) as unknown as Node<'float'>;
  }

  /** DV-080: độ che 0..1 tại toạ độ xz bất kỳ (node TSL, dùng trong pass hậu kỳ: tia nắng thể tích) — ngoài vùng = 0 */
  sampleAt(xz: Node<'vec2'>): Node<'float'> {
    const r = this.rect as unknown as Node<'vec4'>;
    const uvn = vec2(xz.x.sub(r.x).mul(r.z), xz.y.sub(r.y).mul(r.w));
    const inside = uvn.x.greaterThanEqual(0).and(uvn.x.lessThanEqual(1)).and(uvn.y.greaterThanEqual(0)).and(uvn.y.lessThanEqual(1));
    return inside.select(texture(this.texture, uvn).r, float(0)) as unknown as Node<'float'>;
  }

  /** dựng từ danh sách tán (xz tâm, bán kính, độ đặc) trong vùng rect (tâm + kích thước) */
  fill(rect: { x: number; z: number; w: number; h: number }, trees: readonly CanopyTree[]): void {
    const N = CANOPY_RES;
    const x0 = rect.x - rect.w / 2;
    const z0 = rect.z - rect.h / 2;
    const sx = N / rect.w;
    const sz = N / rect.h;
    const acc = new Float32Array(N * N);
    for (const t of trees) {
      const ci = (t.x - x0) * sx;
      const cj = (t.z - z0) * sz;
      const ri = t.r * sx;
      const rj = t.r * sz;
      const i0 = Math.max(0, Math.floor(ci - ri));
      const i1 = Math.min(N - 1, Math.ceil(ci + ri));
      const j0 = Math.max(0, Math.floor(cj - rj));
      const j1 = Math.min(N - 1, Math.ceil(cj + rj));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const dx = (i + 0.5 - ci) / ri;
          const dz = (j + 0.5 - cj) / rj;
          const q = dx * dx + dz * dz;
          if (q >= 1) continue;
          // tán dày ở giữa, thưa ở mép; cộng dồn kiểu xác suất trời lọt: 1 − Π(1 − k)
          const k = t.k * (1 - q * q);
          const o = j * N + i;
          acc[o] = 1 - (1 - acc[o]!) * (1 - k);
        }
      }
    }
    // làm mịn 2 lượt box 3×3 (mép tán mềm, không lộ texel)
    const tmp = new Float32Array(N * N);
    for (let pass = 0; pass < 2; pass++) {
      const src = pass === 0 ? acc : tmp;
      const dst = pass === 0 ? tmp : acc;
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          let s = 0;
          let c = 0;
          for (let dj = -1; dj <= 1; dj++) {
            const jj = j + dj;
            if (jj < 0 || jj >= N) continue;
            for (let di = -1; di <= 1; di++) {
              const ii = i + di;
              if (ii < 0 || ii >= N) continue;
              s += src[jj * N + ii]!;
              c++;
            }
          }
          dst[j * N + i] = s / c;
        }
      }
    }
    let sum = 0;
    let closed = 0;
    for (let o = 0; o < N * N; o++) {
      const v = Math.min(1, acc[o]!);
      this.data[o] = Math.round(v * 255);
      sum += v;
      if (v > 0.7) closed++;
    }
    (this.rect.value as Vector4).set(x0, z0, 1 / rect.w, 1 / rect.h);
    this.texture.needsUpdate = true;
    this.stats.trees = trees.length;
    this.stats.mean = sum / (N * N);
    this.stats.closed = closed / (N * N);
  }

  /** độ che tại (x, z) trên CPU (test/QA), lấy mẫu gần nhất */
  at(x: number, z: number): number {
    const r = this.rect.value as Vector4;
    const u = (x - r.x) * r.z;
    const v = (z - r.y) * r.w;
    if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
    const i = Math.min(CANOPY_RES - 1, Math.floor(u * CANOPY_RES));
    const j = Math.min(CANOPY_RES - 1, Math.floor(v * CANOPY_RES));
    return this.data[j * CANOPY_RES + i]! / 255;
  }
}

/** bản đồ dùng chung trong một phiên chơi (terrain dựng trước rừng → material đọc texture này, rừng đổ dữ liệu sau) */
export const canopyMap = new CanopyMap();
