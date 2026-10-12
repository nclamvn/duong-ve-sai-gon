/**
 * CoverField (AI-T1.1, DV-071): điểm nấp TỰ SINH từ hình học level thay cho vài marker đặt tay.
 *
 * Nguồn ứng viên:
 *   - thân cây (collider trụ, bán kính ≥ minTreeRadius): điểm nấp được tính THEO HƯỚNG mối đe doạ (sau thân cây, cách mép
 *     `standoff`), nên một cây phục vụ mọi hướng;
 *   - hố bom (terrainFeatures.craters): điểm ở sườn trong phía mối đe doạ (vành hố chắn trước mặt, đứng lên là bắn qua vành);
 *   - marker đặt tay của level (giữ hợp đồng cũ);
 *   - vòng mẫu động quanh người hỏi (8 hướng × 2 bán kính): bắt nếp đất, gò, bờ khe mà không ai phải đánh dấu.
 *
 * Hình học chỉ đề xuất; che hay không do TIA quyết (`probe`): tia ở 1,05 m (đầu khi cúi) và 1,55 m (mắt khi đứng) tới mắt mối
 * đe doạ. Chặn cả hai = 'full' (nấp đứng, ló ngang), chặn 1,05 m mà không chặn 1,55 m = 'low' (cúi nấp, đứng lên bắn).
 * Thuần TS: không three/DOM; LOS, cao độ đất, điểm đi được đều inject.
 */

type V3 = [number, number, number];

export type CoverKind = 'tree' | 'crater' | 'marker' | 'ring';
export type CoverQuality = 'full' | 'low' | 'none';

/** cao độ (so với chân) của hai tia kiểm che */
export const PROBE_LOW_Y = 1.05;
export const PROBE_HIGH_Y = 1.55;

export interface CoverCandidate {
  /** khoá giữ chỗ (một nguồn = một người) */
  key: string;
  kind: CoverKind;
  x: number;
  y: number;
  z: number;
}

export interface CoverFieldDeps {
  /** true nếu đoạn thẳng KHÔNG bị địa hình/vật cản tĩnh chắn */
  los: (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => boolean;
  /** cao độ mặt đất tại x/z (null = ngoài địa hình) */
  ground: (x: number, z: number) => number | null;
  /** điểm đi được gần nhất (navmesh) hoặc null; không có → coi mọi điểm đi được */
  walkable?: (x: number, y: number, z: number) => V3 | null;
}

export interface TreeSource {
  x: number;
  z: number;
  r: number;
  /** khoảng lùi tối thiểu từ mép thân (đệm navmesh của loài + nửa người) */
  standoff: number;
}

export interface CraterSource {
  x: number;
  z: number;
  r: number;
}

export interface MarkerSource {
  x: number;
  y: number;
  z: number;
}

export interface CoverFieldStats {
  trees: number;
  craters: number;
  markers: number;
  probes: number;
  rays: number;
  candidates: number;
}

/** collider kiểu arena (chỉ các trường cần) */
interface ColliderLike {
  id: string;
  kind: string;
  position: [number, number, number];
  size: [number, number, number];
}

export class CoverField {
  readonly trees: TreeSource[] = [];
  readonly craters: CraterSource[] = [];
  readonly markers: MarkerSource[] = [];
  readonly stats: CoverFieldStats = { trees: 0, craters: 0, markers: 0, probes: 0, rays: 0, candidates: 0 };
  /** cell → chỉ số nguồn (mã hoá: tree i → i, crater i → −1 − i) */
  private readonly grid = new Map<number, number[]>();
  private readonly markerGrid = new Map<number, number[]>();
  private readonly pool: CoverCandidate[] = [];
  private poolUsed = 0;
  /** ứng viên nằm quá xa điểm đi được (m) thì bỏ */
  snapTolerance = 0.9;
  ringRadii: readonly number[] = [3, 6.5];
  /** lệch ngang thử khi tìm điểm ló (m): thân cây cần ~0,7; tảng đá/tường rộng cần xa hơn */
  peekOffsets: readonly number[] = [0.7, 1.2, 1.8, 2.6, 3.6];
  ringDirs = 8;

  constructor(
    private readonly deps: CoverFieldDeps,
    readonly cellM = 8,
  ) {}

  private cellKey(i: number, j: number): number {
    return (i + 32768) * 65536 + (j + 32768);
  }

  private insert(grid: Map<number, number[]>, x: number, z: number, idx: number): void {
    const k = this.cellKey(Math.floor(x / this.cellM), Math.floor(z / this.cellM));
    let a = grid.get(k);
    if (!a) grid.set(k, (a = []));
    a.push(idx);
  }

  /** thân cây từ collider trụ (`veg_<loài>_<i>`); `standoffFor` = đệm navmesh theo loài */
  addTreeColliders(colliders: readonly ColliderLike[], opts: { minRadius?: number; standoffFor?: (id: string) => number } = {}): number {
    const minR = opts.minRadius ?? 0.18;
    let n = 0;
    for (const c of colliders) {
      if (c.kind !== 'cylinder' || c.size[0] < minR) continue;
      this.addTree(c.position[0], c.position[2], c.size[0], 0.45 + (opts.standoffFor?.(c.id) ?? 0));
      n++;
    }
    return n;
  }

  addTree(x: number, z: number, r: number, standoff = 0.45): void {
    this.insert(this.grid, x, z, this.trees.length);
    this.trees.push({ x, z, r, standoff });
    this.stats.trees = this.trees.length;
  }

  addCrater(x: number, z: number, r: number): void {
    this.insert(this.grid, x, z, -1 - this.craters.length);
    this.craters.push({ x, z, r });
    this.stats.craters = this.craters.length;
  }

  addMarker(x: number, y: number, z: number): void {
    this.insert(this.markerGrid, x, z, this.markers.length);
    this.markers.push({ x, y, z });
    this.stats.markers = this.markers.length;
  }

  private take(key: string, kind: CoverKind, x: number, y: number, z: number, out: CoverCandidate[]): void {
    let c = this.pool[this.poolUsed];
    if (!c) this.pool.push((c = { key, kind, x, y, z }));
    this.poolUsed++;
    c.key = key;
    c.kind = kind;
    c.x = x;
    c.y = y;
    c.z = z;
    out.push(c);
  }

  /** đặt điểm vào mặt đi được; trả false nếu không đi tới được */
  private place(x: number, z: number, out: V3): boolean {
    const g = this.deps.ground(x, z);
    if (g === null) return false;
    out[0] = x;
    out[1] = g;
    out[2] = z;
    const w = this.deps.walkable;
    if (!w) return true;
    const p = w(x, g, z);
    if (!p || Math.hypot(p[0] - x, p[2] - z) > this.snapTolerance) return false;
    out[0] = p[0];
    out[1] = p[1];
    out[2] = p[2];
    return true;
  }

  /**
   * Ứng viên trong bán kính `radius` quanh (x, z), tính theo mối đe doạ `threat` (chân). Đối tượng trả về nằm trong pool nội bộ:
   * chỉ hợp lệ tới lần gọi `candidates` kế tiếp.
   */
  candidates(x: number, z: number, radius: number, threat: V3, out: CoverCandidate[], opts: { ring?: boolean } = {}): CoverCandidate[] {
    out.length = 0;
    this.poolUsed = 0;
    const p: V3 = [0, 0, 0];
    const i0 = Math.floor((x - radius) / this.cellM);
    const i1 = Math.floor((x + radius) / this.cellM);
    const j0 = Math.floor((z - radius) / this.cellM);
    const j1 = Math.floor((z + radius) / this.cellM);
    const r2 = radius * radius;
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const k = this.cellKey(i, j);
        const cell = this.grid.get(k);
        if (cell) {
          for (const idx of cell) {
            if (idx >= 0) {
              const t = this.trees[idx]!;
              // sau thân cây so với mối đe doạ
              const dx = t.x - threat[0];
              const dz = t.z - threat[2];
              const l = Math.hypot(dx, dz) || 1;
              const off = t.r + t.standoff;
              const cx = t.x + (dx / l) * off;
              const cz = t.z + (dz / l) * off;
              if ((cx - x) ** 2 + (cz - z) ** 2 > r2) continue;
              if (this.place(cx, cz, p)) this.take(`t${idx}`, 'tree', p[0], p[1], p[2], out);
            } else {
              const ci = -1 - idx;
              const c = this.craters[ci]!;
              // sườn trong phía mối đe doạ: vành hố gần mối đe doạ chắn trước mặt
              const dx = threat[0] - c.x;
              const dz = threat[2] - c.z;
              const l = Math.hypot(dx, dz) || 1;
              const cx = c.x + (dx / l) * c.r * 0.5;
              const cz = c.z + (dz / l) * c.r * 0.5;
              if ((cx - x) ** 2 + (cz - z) ** 2 > r2) continue;
              if (this.place(cx, cz, p)) this.take(`c${ci}`, 'crater', p[0], p[1], p[2], out);
              // điểm thứ hai: lòng hố (nấp toàn phần, không bắn được) cho người bị ghim
              if (this.place(c.x, c.z, p)) this.take(`c${ci}b`, 'crater', p[0], p[1], p[2], out);
            }
          }
        }
        const mc = this.markerGrid.get(k);
        if (mc) {
          for (const idx of mc) {
            const m = this.markers[idx]!;
            if ((m.x - x) ** 2 + (m.z - z) ** 2 > r2) continue;
            this.take(`m${idx}`, 'marker', m.x, m.y, m.z, out);
          }
        }
      }
    }
    if (opts.ring !== false) {
      for (const rr of this.ringRadii) {
        if (rr > radius) continue;
        for (let d = 0; d < this.ringDirs; d++) {
          const a = (d / this.ringDirs) * Math.PI * 2;
          const rx = x + Math.cos(a) * rr;
          const rz = z + Math.sin(a) * rr;
          if (this.place(rx, rz, p)) this.take(`r${Math.round(p[0] / 1.5)}_${Math.round(p[2] / 1.5)}`, 'ring', p[0], p[1], p[2], out);
        }
      }
    }
    this.stats.candidates += out.length;
    return out;
  }

  private ray(ax: number, ay: number, az: number, b: V3): boolean {
    this.stats.rays++;
    return this.deps.los(ax, ay, az, b[0], b[1], b[2]);
  }

  /** chất lượng che của điểm (x, y chân, z) trước mắt mối đe doạ `threatEye` */
  probe(x: number, y: number, z: number, threatEye: V3): CoverQuality {
    this.stats.probes++;
    if (this.ray(x, y + PROBE_LOW_Y, z, threatEye)) return 'none';
    return this.ray(x, y + PROBE_HIGH_Y, z, threatEye) ? 'low' : 'full';
  }

  /** người đứng ở (x, y, z) có bắn được tới `threatEye` không (mắt đứng) */
  canSee(x: number, y: number, z: number, threatEye: V3, eyeY = PROBE_HIGH_Y): boolean {
    return this.ray(x, y + eyeY, z, threatEye);
  }

  /**
   * Điểm ló ra của chỗ nấp 'full' (thân cây, tảng đá): lệch ngang `peekOffsets` vuông góc hướng mối đe doạ, bên `prefer` trước.
   * Trả bên đã chọn (±1) hoặc 0 nếu không có điểm nào thấy được mối đe doạ.
   */
  peekPoint(x: number, _y: number, z: number, threatEye: V3, out: V3, prefer = 1): number {
    const tx = threatEye[0] - x;
    const tz = threatEye[2] - z;
    const tl = Math.hypot(tx, tz) || 1;
    const px = -tz / tl;
    const pz = tx / tl;
    const p: V3 = [0, 0, 0];
    for (const off of this.peekOffsets) {
      for (const side of [prefer, -prefer]) {
        const sx = x + px * off * side;
        const sz = z + pz * off * side;
        if (!this.place(sx, sz, p)) continue;
        if (this.ray(p[0], p[1] + PROBE_HIGH_Y, p[2], threatEye)) {
          out[0] = p[0];
          out[1] = p[1];
          out[2] = p[2];
          return side;
        }
      }
    }
    return 0;
  }

  /** số mẫu lộ (thấy được mối đe doạ ở tầm ngực khi chạy) trên đoạn a → b, `samples` điểm giữa */
  exposure(a: V3, b: V3, threatEye: V3, samples = 2): number {
    let n = 0;
    for (let s = 1; s <= samples; s++) {
      const t = s / (samples + 1);
      const x = a[0] + (b[0] - a[0]) * t;
      const z = a[2] + (b[2] - a[2]) * t;
      const g = this.deps.ground(x, z);
      const y = g ?? a[1] + (b[1] - a[1]) * t;
      if (this.ray(x, y + 1.35, z, threatEye)) n++;
    }
    return n;
  }
}
