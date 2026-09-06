/**
 * Scatter thực vật (TIP-D05, PRD VEG-001): đặt cây theo lưới jitter seeded trên ô terrain, lọc theo độ dốc/độ cao/noise
 * (không ngẫu nhiên tự do — cùng seed → cùng rừng). Không phụ thuộc DOM/three: chạy trong Node (unit test).
 * Kết quả gom theo ô (cell) vuông `cellM` để cull/LOD theo ô: mỗi loài một `SpeciesPlacement` với mảng phẳng
 * pos (xyz), yaw, scale, variant và bảng `cells` (offset/count) — instance trong cùng ô nằm liền nhau.
 */
import { mulberry32, hashString, type Prng } from '../core/prng';
import type { TerrainTile } from '../terrain/tile';
import type { ColliderDef } from '../render/arena';

export interface ScatterRule {
  /** id loài (khớp file public/assets/vegetation/<id>.glb) */
  id: string;
  /** mật độ (cây/ha = 100 × 100 m); với clump = số bụi/ha */
  perHa: number;
  /** khoảng độ dốc chấp nhận (1 − normal.y): [min, max] */
  slope?: [number, number];
  /** khoảng cao độ chuẩn hoá trong ô [0..1] */
  height?: [number, number];
  /** tỉ lệ scale ngẫu nhiên [min, max] */
  scale?: [number, number];
  /** mặt nạ noise: tần số (1/m) và ngưỡng 0..1 — noise < min → bỏ (tạo mảng/khoảng trống) */
  noise?: { scale: number; min: number; offset?: number };
  /** bụi (tre): mỗi điểm lưới sinh count culm trong bán kính radius */
  clump?: { count: [number, number]; radius: number };
  /** số biến thể trong GLB (chọn ngẫu nhiên đều) */
  variants?: number;
  /** ngưỡng LOD (m): [lod0→1, lod1→2, lod2→impostor/cull, impostor→cull] */
  lod: [number, number, number, number];
  /** đổ bóng */
  cast?: boolean;
  /** collider capsule thân (bán kính, cao) — không có → không va chạm (bụi, dương xỉ) */
  collider?: { radius: number; height: number };
  /** vùng đặt riêng (tầng thấp chỉ cần quanh vùng chơi) — mặc định rect của level */
  rect?: ScatterRect;
  /** dùng chung trường noise với loài khác (id) — vd. dây leo mọc trong cụm cây tán */
  noiseId?: string;
  /** chôn gốc (m): [cố định, × tan(độ dốc)] — rễ bạnh không "trồi" trên sườn (mặt dốc: mép rễ phía dưới dốc hở R·tanθ) */
  sink?: [number, number];
  /** hệ số đè khi tác nhân đi qua (VEG-006): mặc định theo chiều cao loài (cỏ 1, bụi 0,35, cây 0) */
  press?: number;
}

export interface ScatterRect {
  x: number;
  z: number;
  w: number;
  h: number;
}

export interface SpeciesPlacement {
  id: string;
  rule: ScatterRule;
  count: number;
  /** xyz liền nhau theo ô */
  pos: Float32Array;
  yaw: Float32Array;
  scale: Float32Array;
  variant: Uint8Array;
  /** ô: key "ix,jz" → [offset, count] trong các mảng trên */
  cells: Map<string, { ix: number; jz: number; offset: number; count: number; cx: number; cz: number; minY: number; maxY: number }>;
}

/** value noise 2D mượt, seeded (đủ cho mặt nạ mảng cây; không cần chất lượng simplex) */
export function valueNoise2(x: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fz = z - zi;
  const h = (i: number, j: number): number => {
    let n = (i * 374761393 + j * 668265263 + seed * 1442695041) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177) | 0;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = h(xi, zi);
  const b = h(xi + 1, zi);
  const c = h(xi, zi + 1);
  const d = h(xi + 1, zi + 1);
  return (a * (1 - sx) + b * sx) * (1 - sz) + (c * (1 - sx) + d * sx) * sz;
}

/** fBm 3 octave của valueNoise2, 0..1 */
export function fbm2(x: number, z: number, seed: number): number {
  return valueNoise2(x, z, seed) * 0.5 + valueNoise2(x * 2.1 + 7.3, z * 2.1 + 3.1, seed + 1) * 0.3 + valueNoise2(x * 4.3 + 1.7, z * 4.3 + 9.2, seed + 2) * 0.2;
}

/**
 * Đặt một loài. Lưới jitter: bước s = 100/√perHa (m); mỗi điểm lệch ±0,45 s; kiểm rect/ô/dốc/cao/noise.
 * Bụi: điểm lưới = tâm bụi, culm rải trong bán kính (scale/yaw riêng).
 */
/**
 * `density` (0..1, tier chất lượng) là **tập con** của placement đầy đủ (giữ điểm lưới có hash(jitter) < density), không đổi bước lưới —
 * cây ở tier thấp ⊂ tier cao → navmesh bake với density 1 (obstacle thân) vẫn đúng ở mọi tier; cùng seed → cùng rừng.
 */
export function scatterSpecies(tile: TerrainTile, rect: ScatterRect, rule: ScatterRule, seed: number, cellM: number, density = 1): SpeciesPlacement {
  const prng: Prng = mulberry32((seed ^ hashString(rule.id)) >>> 0);
  const nseed = (hashString(rule.noiseId ?? rule.id, seed) & 0xffff) >>> 0;
  const step = 100 / Math.sqrt(Math.max(0.01, rule.perHa));
  const nx = Math.max(1, Math.floor(rect.w / step));
  const nz = Math.max(1, Math.floor(rect.h / step));
  const x0 = rect.x - rect.w / 2;
  const z0 = rect.z - rect.h / 2;
  const slope = rule.slope ?? [0, 0.6];
  const hgt = rule.height ?? [0, 1];
  const sc = rule.scale ?? [0.85, 1.15];
  const nVar = Math.max(1, rule.variants ?? 1);
  const range = tile.maxY - tile.minY || 1;
  const half = tile.half;
  // gom tạm theo ô rồi ép phẳng
  const byCell = new Map<string, number[]>(); // key → [x,y,z,yaw,scale,variant,...]
  const normal: [number, number, number] = [0, 1, 0];
  const push = (x: number, z: number, yaw: number, s: number, v: number): void => {
    if (x < -half || x > half || z < -half || z > half) return;
    let y = tile.sample(x, z);
    tile.normalAt(x, z, normal);
    const sl = 1 - normal[1];
    if (sl < slope[0] || sl > slope[1]) return;
    if (rule.sink) y -= rule.sink[0] + (rule.sink[1] * Math.sqrt(Math.max(0, 1 - normal[1] * normal[1]))) / Math.max(0.2, normal[1]);
    const hN = Math.min(1, Math.max(0, (y - tile.minY) / range));
    if (hN < hgt[0] || hN > hgt[1]) return;
    const ix = Math.floor((x + half) / cellM);
    const jz = Math.floor((z + half) / cellM);
    const key = `${ix},${jz}`;
    let arr = byCell.get(key);
    if (!arr) {
      arr = [];
      byCell.set(key, arr);
    }
    arr.push(x, y, z, yaw, s, v);
  };
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      // 6 số ngẫu nhiên mỗi điểm lưới — cố định để thêm/bớt rule không đổi vị trí điểm khác
      const jx = prng.next();
      const jz = prng.next();
      const rn = prng.next();
      const ryaw = prng.next();
      const rsc = prng.next();
      const rvar = prng.next();
      const x = x0 + (i + 0.05 + jx * 0.9) * step;
      const z = z0 + (j + 0.05 + jz * 0.9) * step;
      if (density < 1 && (jx * 7.0 + jz * 13.0) % 1 >= density) continue;
      if (rule.noise) {
        const n = fbm2(x * rule.noise.scale + (rule.noise.offset ?? 0), z * rule.noise.scale, nseed);
        if (n < rule.noise.min) continue;
        // mật độ mềm: gần ngưỡng thưa dần
        if (rn > (n - rule.noise.min) / Math.max(0.05, 1 - rule.noise.min) + 0.35) continue;
      }
      const yaw = ryaw * Math.PI * 2;
      const s = sc[0] + (sc[1] - sc[0]) * rsc;
      const v = Math.min(nVar - 1, Math.floor(rvar * nVar));
      if (rule.clump) {
        const c = rule.clump;
        const n = c.count[0] + Math.floor(prng.next() * (c.count[1] - c.count[0] + 1));
        for (let k = 0; k < n; k++) {
          const a = prng.next() * Math.PI * 2;
          const r = Math.sqrt(prng.next()) * c.radius;
          push(x + Math.cos(a) * r, z + Math.sin(a) * r, prng.next() * Math.PI * 2, s * (0.8 + prng.next() * 0.4), Math.min(nVar - 1, Math.floor(prng.next() * nVar)));
        }
      } else push(x, z, yaw, s, v);
    }
  }
  // ép phẳng theo thứ tự ô ổn định (sort key)
  const keys = [...byCell.keys()].sort();
  let total = 0;
  for (const k of keys) total += byCell.get(k)!.length / 6;
  const pos = new Float32Array(total * 3);
  const yawA = new Float32Array(total);
  const scaleA = new Float32Array(total);
  const variantA = new Uint8Array(total);
  const cells: SpeciesPlacement['cells'] = new Map();
  let off = 0;
  for (const k of keys) {
    const arr = byCell.get(k)!;
    const n = arr.length / 6;
    const [ix, jz] = k.split(',').map(Number) as [number, number];
    let minY = Infinity;
    let maxY = -Infinity;
    for (let t = 0; t < n; t++) {
      const o = off + t;
      pos[o * 3] = arr[t * 6]!;
      pos[o * 3 + 1] = arr[t * 6 + 1]!;
      pos[o * 3 + 2] = arr[t * 6 + 2]!;
      yawA[o] = arr[t * 6 + 3]!;
      scaleA[o] = arr[t * 6 + 4]!;
      variantA[o] = arr[t * 6 + 5]!;
      if (pos[o * 3 + 1]! < minY) minY = pos[o * 3 + 1]!;
      if (pos[o * 3 + 1]! > maxY) maxY = pos[o * 3 + 1]!;
    }
    cells.set(k, { ix, jz, offset: off, count: n, cx: -half + (ix + 0.5) * cellM, cz: -half + (jz + 0.5) * cellM, minY, maxY });
    off += n;
  }
  return { id: rule.id, rule, count: total, pos, yaw: yawA, scale: scaleA, variant: variantA, cells };
}

/** Collider thân (cylinder Rapier) của một placement — dùng chung cho game (physics) và bake navmesh (obstacle) */
export function placementColliders(pl: SpeciesPlacement, rule: ScatterRule): ColliderDef[] {
  const out: ColliderDef[] = [];
  if (!rule.collider) return out;
  for (let i = 0; i < pl.count; i++) {
    const s = pl.scale[i]!;
    const r = rule.collider.radius * s;
    const h = rule.collider.height * s;
    out.push({ id: `veg_${rule.id}_${i}`, kind: 'cylinder', position: [pl.pos[i * 3]!, pl.pos[i * 3 + 1]! + h / 2, pl.pos[i * 3 + 2]!], size: [r, h / 2, 0], yaw: 0, material: 'wood' });
  }
  return out;
}
