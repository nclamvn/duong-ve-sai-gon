/**
 * TerrainTile (TIP-D04, PRD TER-001): ô heightmap từ scripts/terrain-bake.mjs — `height.r16` (u16 LE, n×n, hàng 0 = bắc,
 * cột 0 = tây) + `meta.json`. Trục engine: +x đông, −z bắc → hàng j ↔ z = −half + j·res, cột i ↔ x = −half + i·res.
 * Cao độ engine y = zMin + u16/65535·(zMax − zMin) − yOffset (yOffset đưa spawn về ≈ 0). Không phụ thuộc DOM/three — chạy trong Node.
 */
export interface TerrainMeta {
  id: string;
  n: number;
  sizeM: number;
  resM: number;
  zMin: number;
  zMax: number;
  center?: { lat: number; lon: number };
  layout?: string;
  source?: { dataset?: string; tile?: string; url?: string };
  detailNoise?: { amplitudeM: number; seed: number; note?: string } | null;
  sha256?: string;
}

export class TerrainTile {
  readonly n: number;
  readonly sizeM: number;
  readonly resM: number;
  readonly half: number;
  /** cao độ engine (m), n×n, index = j·n + i (j = hàng/z, i = cột/x) */
  readonly heights: Float32Array;
  readonly minY: number;
  readonly maxY: number;

  constructor(
    readonly meta: TerrainMeta,
    readonly u16: Uint16Array,
    readonly yOffset: number,
  ) {
    this.n = meta.n;
    this.sizeM = meta.sizeM;
    this.resM = meta.resM;
    this.half = meta.sizeM / 2;
    if (u16.length !== this.n * this.n) throw new Error(`terrain ${meta.id}: r16 ${u16.length} ≠ ${this.n}²`);
    const range = meta.zMax - meta.zMin;
    const h = new Float32Array(u16.length);
    let mn = Infinity;
    let mx = -Infinity;
    for (let k = 0; k < u16.length; k++) {
      const y = meta.zMin + (u16[k]! / 65535) * range - yOffset;
      h[k] = y;
      if (y < mn) mn = y;
      if (y > mx) mx = y;
    }
    this.heights = h;
    this.minY = mn;
    this.maxY = mx;
  }

  /** nạp từ URL (trình duyệt hoặc Node 18+ có fetch) */
  static async load(baseUrl: string, id: string, yOffset = 0): Promise<TerrainTile> {
    const dir = `${baseUrl}assets/terrain/${id}/`;
    const [metaRes, r16Res] = await Promise.all([fetch(`${dir}meta.json`), fetch(`${dir}height.r16`)]);
    if (!metaRes.ok || !r16Res.ok) throw new Error(`terrain ${id}: meta/height fetch failed (${metaRes.status}/${r16Res.status})`);
    const meta = (await metaRes.json()) as TerrainMeta;
    const buf = await r16Res.arrayBuffer();
    return new TerrainTile(meta, new Uint16Array(buf), yOffset);
  }

  /** cao độ tại đỉnh lưới (i cột, j hàng) — kẹp biên */
  at(i: number, j: number): number {
    const n = this.n;
    i = i < 0 ? 0 : i >= n ? n - 1 : i;
    j = j < 0 ? 0 : j >= n ? n - 1 : j;
    return this.heights[j * n + i]!;
  }

  /** cao độ song tuyến tại (x, z) thế giới; ngoài ô → kẹp biên */
  sample(x: number, z: number): number {
    const fi = (x + this.half) / this.resM;
    const fj = (z + this.half) / this.resM;
    const i0 = Math.floor(fi);
    const j0 = Math.floor(fj);
    const ti = fi - i0;
    const tj = fj - j0;
    const a = this.at(i0, j0);
    const b = this.at(i0 + 1, j0);
    const c = this.at(i0, j0 + 1);
    const d = this.at(i0 + 1, j0 + 1);
    return (1 - tj) * ((1 - ti) * a + ti * b) + tj * ((1 - ti) * c + ti * d);
  }

  /** normal (đơn vị, hướng lên) bằng sai phân trung tâm tại (x, z) */
  normalAt(x: number, z: number, out: [number, number, number] = [0, 1, 0]): [number, number, number] {
    const e = this.resM;
    const dx = (this.sample(x + e, z) - this.sample(x - e, z)) / (2 * e);
    const dz = (this.sample(x, z + e) - this.sample(x, z - e)) / (2 * e);
    const l = Math.hypot(dx, 1, dz);
    out[0] = -dx / l;
    out[1] = 1 / l;
    out[2] = -dz / l;
    return out;
  }

  /** min/max cao độ trong vùng đỉnh [i0, i1] × [j0, j1] (bao gồm) — AABB ô LOD */
  minMax(i0: number, j0: number, i1: number, j1: number): [number, number] {
    let mn = Infinity;
    let mx = -Infinity;
    const n = this.n;
    const ia = Math.max(0, i0);
    const ib = Math.min(n - 1, i1);
    const ja = Math.max(0, j0);
    const jb = Math.min(n - 1, j1);
    for (let j = ja; j <= jb; j++) {
      const row = j * n;
      for (let i = ia; i <= ib; i++) {
        const y = this.heights[row + i]!;
        if (y < mn) mn = y;
        if (y > mx) mx = y;
      }
    }
    return [mn, mx];
  }

  /**
   * Texture cao độ RGBA8 (n×n): R,G = u16 (hi, lo) → shader: h = minY + (R·65280 + G·255)/65535·(maxY − minY);
   * B,A = normal x,z ·0.5+0.5 (nearest ở vertex; texture normal riêng lọc linear cho fragment — xem normalTexture).
   */
  heightTexture(): Uint8Array {
    const n = this.n;
    const out = new Uint8Array(n * n * 4);
    const range = this.maxY - this.minY || 1;
    for (let k = 0; k < n * n; k++) {
      const v = Math.round(((this.heights[k]! - this.minY) / range) * 65535);
      out[k * 4] = v >> 8;
      out[k * 4 + 1] = v & 255;
      out[k * 4 + 2] = 128;
      out[k * 4 + 3] = 255;
    }
    return out;
  }

  /** Texture normal RGBA8 (n×n): xyz·0.5+0.5 (normal thế giới, hướng lên) */
  normalTexture(): Uint8Array {
    const n = this.n;
    const out = new Uint8Array(n * n * 4);
    const e2 = 2 * this.resM;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const dx = (this.at(i + 1, j) - this.at(i - 1, j)) / e2;
        const dz = (this.at(i, j + 1) - this.at(i, j - 1)) / e2;
        const l = Math.hypot(dx, 1, dz);
        const k = (j * n + i) * 4;
        out[k] = Math.round((-dx / l) * 0.5 * 255 + 127.5);
        out[k + 1] = Math.round((1 / l) * 0.5 * 255 + 127.5);
        out[k + 2] = Math.round((-dz / l) * 0.5 * 255 + 127.5);
        out[k + 3] = 255;
      }
    }
    return out;
  }

  /**
   * Lưới tam giác thưa (bước `step` đỉnh) trong hình chữ nhật thế giới — cho navmesh (recast) / debug.
   * Trả positions (xyz) + indices; đỉnh theo lưới đã kẹp vào ô.
   */
  gridMesh(rect: { x: number; z: number; w: number; h: number }, step = 2): { positions: Float32Array; indices: Uint32Array } {
    const i0 = Math.max(0, Math.floor((rect.x - rect.w / 2 + this.half) / this.resM));
    const j0 = Math.max(0, Math.floor((rect.z - rect.h / 2 + this.half) / this.resM));
    const i1 = Math.min(this.n - 1, Math.ceil((rect.x + rect.w / 2 + this.half) / this.resM));
    const j1 = Math.min(this.n - 1, Math.ceil((rect.z + rect.h / 2 + this.half) / this.resM));
    const cols = Math.floor((i1 - i0) / step) + 1;
    const rows = Math.floor((j1 - j0) / step) + 1;
    const positions = new Float32Array(cols * rows * 3);
    for (let r = 0; r < rows; r++) {
      const j = j0 + r * step;
      for (let c = 0; c < cols; c++) {
        const i = i0 + c * step;
        const k = (r * cols + c) * 3;
        positions[k] = -this.half + i * this.resM;
        positions[k + 1] = this.at(i, j);
        positions[k + 2] = -this.half + j * this.resM;
      }
    }
    const indices = new Uint32Array((cols - 1) * (rows - 1) * 6);
    let q = 0;
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c;
        const b = a + 1;
        const d = a + cols;
        const e = d + 1;
        // ngược chiều kim đồng hồ nhìn từ trên (+y): a, d, b / b, d, e
        indices[q++] = a;
        indices[q++] = d;
        indices[q++] = b;
        indices[q++] = b;
        indices[q++] = d;
        indices[q++] = e;
      }
    }
    return { positions, indices };
  }
}
