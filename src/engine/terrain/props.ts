/**
 * Props trên terrain level (M2 R1, Blueprint G2 §2): model manifest (bao cát, thùng, hòm đạn, phuy, tủ điện/máy) hoặc
 * procedural (`wire` = rào concertina) đặt theo x/z + yaw, chạm đất theo terrain. Mỗi prop có collider hộp (từ bbox model)
 * và obstacle navmesh (hộp); prop có thể **gỡ** theo id lúc chạy (bộc phá phá rào): ẩn instance + báo game gỡ collider.
 * Kích thước collider từ bbox đã đo (scripts: prop_sandbag_05 2,94×0,72×0,66; crate 1,8×0,3×1,0; barrel r 0,28 h 0,87…).
 */
import { Box3, BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardNodeMaterial, Object3D, Quaternion, Vector3, Euler, TubeGeometry, Curve, type BufferGeometry } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ColliderDef } from '../render/arena';

export type TerrainPropKind = 'wire' | 'sandbag' | 'crate' | 'ammo' | 'barrel' | 'radio';

export interface TerrainPropDef {
  id: string;
  kind: TerrainPropKind;
  /** x/z hệ level; y = terrain */
  position: [number, number];
  yaw?: number;
  /** wire: chiều dài đoạn (m) */
  len?: number;
  scale?: number;
}

/** kind → model manifest (bao cát: xen 2 mẫu theo hash id) */
export const PROP_MODEL: Record<Exclude<TerrainPropKind, 'wire'>, string[]> = {
  sandbag: ['prop_sandbag_05', 'prop_sandbag_02'],
  crate: ['old_military_crate'],
  ammo: ['ammo_box'],
  barrel: ['Barrel_01'],
  radio: ['utility_box_01'],
};

/** nửa kích thước collider theo kind khi không có model (lite) — cùng bảng với scripts/terrain-bake.mjs --nav (đo từ GLB) */
export const PROP_HALF: Record<Exclude<TerrainPropKind, 'wire'>, [number, number, number]> = {
  sandbag: [1.47, 0.36, 0.4],
  crate: [0.9, 0.15, 0.5],
  ammo: [0.04, 0.09, 0.13],
  barrel: [0.28, 0.44, 0.28],
  radio: [0.26, 0.56, 0.22],
};

/** chôn gốc (m) — bao cát/thùng đặt lún nhẹ cho khỏi hở chân trên dốc */
const SINK: Record<TerrainPropKind, number> = { wire: 0.05, sandbag: 0.08, crate: 0.03, ammo: 0.01, barrel: 0.02, radio: 0.02 };

const _p = new Vector3();
const _q = new Quaternion();
const _s = new Vector3(1, 1, 1);
const _m = new Matrix4();

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Đường xoắn ốc nằm ngang dọc +x (concertina): bán kính r, bước p, dài L */
class Helix extends Curve<Vector3> {
  constructor(
    private readonly r: number,
    private readonly turns: number,
    private readonly len: number,
  ) {
    super();
  }
  override getPoint(t: number, target = new Vector3()): Vector3 {
    const a = t * this.turns * Math.PI * 2;
    return target.set(-this.len / 2 + t * this.len, this.r + Math.sin(a) * this.r, Math.cos(a) * this.r);
  }
}

let wireMat: MeshStandardNodeMaterial | null = null;
let stakeMat: MeshStandardNodeMaterial | null = null;
const wireGeoCache = new Map<number, BufferGeometry>();

/** Rào concertina: ống xoắn (r 0,45 m, bước 0,26 m) + cọc sắt mỗi 2 m. Gốc = giữa đoạn, mặt đất y = 0, trục dài +x. */
export function concertinaGeometry(len = 6.4): BufferGeometry {
  const key = Math.round(len * 10);
  const c = wireGeoCache.get(key);
  if (c) return c;
  const turns = Math.max(4, Math.round(len / 0.26));
  const tube = new TubeGeometry(new Helix(0.45, turns, len), turns * 7, 0.009, 3, false);
  const parts: BufferGeometry[] = [tube];
  const nStake = Math.max(2, Math.round(len / 2) + 1);
  for (let i = 0; i < nStake; i++) {
    const x = -len / 2 + (i * len) / (nStake - 1);
    const g = new BoxGeometry(0.04, 1.05, 0.04);
    _p.set(x, 0.5, 0);
    _q.setFromEuler(new Euler(0.06, 0, (i % 2 ? 1 : -1) * 0.05));
    _m.compose(_p, _q, _s);
    g.applyMatrix4(_m);
    parts.push(g.toNonIndexed());
  }
  const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)), false);
  if (!merged) throw new Error('concertina merge failed');
  for (const p of parts) p.dispose();
  wireGeoCache.set(key, merged);
  return merged;
}

export interface TerrainPropsBuild {
  group: Group;
  colliders: ColliderDef[];
  /** hộp obstacle navmesh: [x, y, z], half [hx, hy, hz], yaw */
  navBoxes: Array<{ id: string; position: [number, number, number]; size: [number, number, number]; yaw: number }>;
  count: number;
  draws: number;
  /** gỡ prop (ẩn + trả collider id để game gỡ khỏi physics); false nếu không có */
  remove(id: string): boolean;
  has(id: string): boolean;
  removed: Set<string>;
}

export interface TerrainPropsOptions {
  models: Record<string, Group> | null;
  heightAt(x: number, z: number): number;
}

/**
 * Dựng props: model → 1 InstancedMesh mỗi primitive mỗi model (xoay/scale từng instance); wire → 1 mesh gộp cho đoạn cố định
 * + mesh riêng cho đoạn có thể gỡ (id chứa `_gap`). Collider hộp theo bbox model (xoay yaw), wire = hộp 0,9 × 0,95 × len.
 */
export function buildTerrainProps(defs: TerrainPropDef[], opts: TerrainPropsOptions): TerrainPropsBuild {
  const group = new Group();
  group.name = 'terrain_props';
  const colliders: ColliderDef[] = [];
  const navBoxes: TerrainPropsBuild['navBoxes'] = [];
  const removed = new Set<string>();
  const removable = new Map<string, { objects: Object3D[]; instanced: Array<{ mesh: InstancedMesh; index: number }> }>();
  let draws = 0;
  wireMat ??= new MeshStandardNodeMaterial({ color: 0x3a3a3a, roughness: 0.55, metalness: 0.85 });
  stakeMat ??= wireMat;

  // ---- wire
  const fixedWire: BufferGeometry[] = [];
  for (const d of defs) {
    if (d.kind !== 'wire') continue;
    const len = d.len ?? 6.4;
    const yaw = d.yaw ?? 0;
    const y = opts.heightAt(d.position[0], d.position[1]) - SINK.wire;
    const geo = concertinaGeometry(len);
    const isGap = /_gap$/.test(d.id);
    if (isGap) {
      const m = new Mesh(geo, wireMat);
      m.position.set(d.position[0], y, d.position[1]);
      m.rotation.y = yaw;
      m.name = `prop_${d.id}`;
      m.castShadow = false;
      m.receiveShadow = true;
      group.add(m);
      draws++;
      removable.set(d.id, { objects: [m], instanced: [] });
    } else {
      const g = geo.clone();
      _p.set(d.position[0], y, d.position[1]);
      _q.setFromEuler(new Euler(0, yaw, 0));
      _m.compose(_p, _q, _s);
      g.applyMatrix4(_m);
      fixedWire.push(g);
    }
    const p: [number, number, number] = [d.position[0], y + 0.48, d.position[1]];
    const size: [number, number, number] = [len / 2, 0.5, 0.5];
    colliders.push({ id: `prop_${d.id}`, kind: 'box', position: p, size, yaw, material: 'steel' });
    if (!isGap) navBoxes.push({ id: d.id, position: p, size, yaw });
  }
  if (fixedWire.length) {
    const merged = mergeGeometries(fixedWire, false);
    if (merged) {
      const m = new Mesh(merged, wireMat);
      m.name = 'prop_wire_fixed';
      m.castShadow = false;
      m.receiveShadow = true;
      m.frustumCulled = true;
      group.add(m);
      draws++;
    }
    for (const g of fixedWire) g.dispose();
  }

  // ---- model props
  const byModel = new Map<string, Array<{ def: TerrainPropDef; y: number }>>();
  for (const d of defs) {
    if (d.kind === 'wire') continue;
    const list = PROP_MODEL[d.kind];
    const model = list[hash(d.id) % list.length]!;
    let arr = byModel.get(model);
    if (!arr) byModel.set(model, (arr = []));
    arr.push({ def: d, y: opts.heightAt(d.position[0], d.position[1]) - SINK[d.kind] });
  }
  const bbox = new Box3();
  const size = new Vector3();
  const center = new Vector3();
  for (const [model, list] of byModel) {
    const src = opts.models?.[model];
    if (src) {
      src.updateMatrixWorld(true);
      bbox.setFromObject(src);
    } else {
      // không có model (lite/CI): collider theo bảng đo sẵn
      const kind = list[0]!.def.kind as Exclude<TerrainPropKind, 'wire'>;
      const hh = PROP_HALF[kind];
      bbox.set(new Vector3(-hh[0], 0, -hh[2]), new Vector3(hh[0], hh[1] * 2, hh[2]));
    }
    bbox.getSize(size);
    bbox.getCenter(center);
    for (const it of list) {
      const d = it.def;
      const sc = d.scale ?? 1;
      const yaw = d.yaw ?? 0;
      const p: [number, number, number] = [d.position[0] + center.x * sc, it.y + center.y * sc, d.position[1] + center.z * sc];
      const half: [number, number, number] = [(size.x / 2) * sc, (size.y / 2) * sc, (size.z / 2) * sc];
      colliders.push({ id: `prop_${d.id}`, kind: 'box', position: p, size: half, yaw, material: d.kind === 'barrel' || d.kind === 'radio' ? 'steel' : d.kind === 'sandbag' ? 'earth' : 'wood' });
      if (half[1] > 0.25) navBoxes.push({ id: d.id, position: p, size: half, yaw });
    }
    if (!src) continue;
    const meshes: Mesh[] = [];
    src.traverse((o: Object3D) => {
      if ((o as Mesh).isMesh) meshes.push(o as Mesh);
    });
    const tall = size.y > 0.8;
    const inst = new Matrix4();
    const tmp = new Matrix4();
    for (const m of meshes) {
      let geo = m.geometry;
      if (Object.keys(geo.morphAttributes).length > 0) {
        geo = geo.clone();
        geo.morphAttributes = {};
        geo.morphTargetsRelative = false;
      }
      const im = new InstancedMesh(geo, m.material, list.length);
      list.forEach((it, k) => {
        _p.set(it.def.position[0], it.y, it.def.position[1]);
        _q.setFromEuler(new Euler(0, it.def.yaw ?? 0, 0));
        _s.setScalar(it.def.scale ?? 1);
        inst.compose(_p, _q, _s);
        tmp.copy(inst).multiply(m.matrixWorld);
        im.setMatrixAt(k, tmp);
        if (/_gap$/.test(it.def.id)) {
          let r = removable.get(it.def.id);
          if (!r) removable.set(it.def.id, (r = { objects: [], instanced: [] }));
          r.instanced.push({ mesh: im, index: k });
        }
      });
      _s.set(1, 1, 1);
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = tall;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      im.frustumCulled = true;
      im.name = `props_${model}`;
      group.add(im);
      draws++;
    }
  }

  const zero = new Matrix4().makeScale(0, 0, 0);
  return {
    group,
    colliders,
    navBoxes,
    count: defs.length,
    draws,
    removed,
    has: (id) => defs.some((d) => d.id === id) && !removed.has(id),
    remove: (id) => {
      if (removed.has(id)) return false;
      const r = removable.get(id);
      if (!r) return false;
      for (const o of r.objects) o.removeFromParent();
      for (const { mesh, index } of r.instanced) {
        mesh.setMatrixAt(index, zero);
        mesh.instanceMatrix.needsUpdate = true;
      }
      removed.add(id);
      return true;
    },
  };
}

/** Hộp obstacle → lưới tam giác (12 tam giác) cho recast; dùng bởi bake offline và runtime. */
export function navBoxGeometry(b: { position: [number, number, number]; size: [number, number, number]; yaw: number }): { positions: Float32Array; indices: Uint32Array } {
  const g = new BoxGeometry(b.size[0] * 2, b.size[1] * 2 + 0.6, b.size[2] * 2);
  _p.set(b.position[0], b.position[1] + 0.3, b.position[2]);
  _q.setFromEuler(new Euler(0, b.yaw, 0));
  _m.compose(_p, _q, _s.set(1, 1, 1));
  g.applyMatrix4(_m);
  const pos = g.getAttribute('position');
  const positions = new Float32Array(pos.array as Float32Array);
  const indices = new Uint32Array(g.index!.array as Uint16Array | Uint32Array);
  g.dispose();
  return { positions, indices };
}
