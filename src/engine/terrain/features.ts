/**
 * Đặc điểm địa hình đã khoét vào heightmap (DV-060, scripts/terrain-features.mjs): lòng khe suối (polyline) và hố bom.
 * Thuần số (Node test được). Cung cấp trường khoảng cách thô (lưới `cellM`) cho luật mọc thực vật (`near`/`avoid`)
 * và dữ liệu để dựng mặt nước.
 */

export interface StreamFeature {
  /** bề rộng đáy lớn nhất (m) */
  w: number;
  areaHa: number;
  /** còn nước (lưu vực đủ lớn) */
  water: boolean;
  /** [x, z, cao độ đáy tuyệt đối (m), bề rộng đáy (m)] theo chiều nước chảy */
  pts: Array<[number, number, number, number]>;
}

export interface CraterFeature {
  x: number;
  z: number;
  r: number;
  depth: number;
  /** cao độ đáy tuyệt đối (m) */
  bottom: number;
  /** mặt nước tuyệt đối (m) hoặc null nếu hố khô */
  waterY: number | null;
  kind: string;
}

export interface TerrainFeaturesData {
  id: string;
  /** đường mòn nhiệm vụ (spawn → waypoint), polyline x/z */
  trail?: Array<[number, number]>;
  streams: StreamFeature[];
  craters: CraterFeature[];
}

export type FeatureKind = 'stream' | 'water' | 'crater' | 'trail';

/** trường khoảng cách (m) tới mép đặc điểm: < 0 là bên trong (lòng khe, lòng hố) */
export class FeatureField {
  readonly n: number;
  private readonly fields = new Map<FeatureKind, Float32Array>();

  constructor(
    readonly data: TerrainFeaturesData,
    readonly sizeM: number,
    readonly cellM = 2,
    readonly maxM = 60,
  ) {
    this.n = Math.ceil(sizeM / cellM) + 1;
  }

  /** khoảng cách tới mép đặc điểm gần nhất (m), kẹp ở maxM */
  distance(kind: FeatureKind, x: number, z: number): number {
    const f = this.field(kind);
    const half = this.sizeM / 2;
    const i = Math.round((x + half) / this.cellM);
    const j = Math.round((z + half) / this.cellM);
    if (i < 0 || j < 0 || i >= this.n || j >= this.n) return this.maxM;
    return f[j * this.n + i]!;
  }

  private field(kind: FeatureKind): Float32Array {
    let f = this.fields.get(kind);
    if (f) return f;
    const n = this.n;
    const half = this.sizeM / 2;
    const c = this.cellM;
    const M = this.maxM;
    f = new Float32Array(n * n).fill(M);
    const stamp = (x0: number, z0: number, x1: number, z1: number, rad: number, dist: (x: number, z: number) => number): void => {
      const i0 = Math.max(0, Math.floor((Math.min(x0, x1) - rad - M + half) / c));
      const i1 = Math.min(n - 1, Math.ceil((Math.max(x0, x1) + rad + M + half) / c));
      const j0 = Math.max(0, Math.floor((Math.min(z0, z1) - rad - M + half) / c));
      const j1 = Math.min(n - 1, Math.ceil((Math.max(z0, z1) + rad + M + half) / c));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const d = dist(-half + i * c, -half + j * c);
          const k = j * n + i;
          if (d < f![k]!) f![k] = d;
        }
      }
    };
    if (kind === 'water') {
      // hố bom đọng nước: đĩa mặt nước (bán kính theo lòng bát, như water.ts)
      for (const cr of this.data.craters) {
        if (cr.waterY === null) continue;
        const rr = cr.r * Math.min(0.98, Math.sqrt(Math.max(0, cr.waterY - cr.bottom) / (cr.depth + 0.45)));
        stamp(cr.x, cr.z, cr.x, cr.z, rr, (x, z) => Math.hypot(x - cr.x, z - cr.z) - rr);
      }
    }
    if (kind === 'stream' || kind === 'water') {
      for (const s of this.data.streams) {
        if (kind === 'water' && !s.water) continue;
        for (let q = 0; q + 1 < s.pts.length; q++) {
          const a = s.pts[q]!;
          const b = s.pts[q + 1]!;
          const vx = b[0] - a[0];
          const vz = b[1] - a[1];
          const L2 = vx * vx + vz * vz || 1;
          const hw = Math.max(a[3], b[3]) / 2;
          stamp(a[0], a[1], b[0], b[1], hw, (x, z) => {
            const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / L2));
            return Math.hypot(x - (a[0] + t * vx), z - (a[1] + t * vz)) - (a[3] + (b[3] - a[3]) * t) / 2;
          });
        }
      }
    } else if (kind === 'trail') {
      const t = this.data.trail ?? [];
      for (let q = 0; q + 1 < t.length; q++) {
        const a = t[q]!;
        const b = t[q + 1]!;
        const vx = b[0] - a[0];
        const vz = b[1] - a[1];
        const L2 = vx * vx + vz * vz || 1;
        stamp(a[0], a[1], b[0], b[1], 0, (x, z) => {
          const u = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / L2));
          return Math.hypot(x - (a[0] + u * vx), z - (a[1] + u * vz));
        });
      }
    } else {
      for (const cr of this.data.craters) stamp(cr.x, cr.z, cr.x, cr.z, cr.r, (x, z) => Math.hypot(x - cr.x, z - cr.z) - cr.r);
    }
    this.fields.set(kind, f);
    return f;
  }
}
