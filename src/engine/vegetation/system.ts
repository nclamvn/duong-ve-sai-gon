/**
 * VegetationSystem (TIP-D05, PRD VEG-001/002/004/006): rừng instanced theo ô 64 m trên terrain.
 *  - Scatter seeded (scatter.ts) → mỗi loài: instance gom theo ô; mỗi ô chọn LOD theo khoảng cách tới camera (hysteresis)
 *    và frustum-cull AABB ô; mỗi frame chép instance của các ô nhìn thấy vào batch (species × biến thể × LOD × material) —
 *    một draw mỗi batch (InstancedBufferGeometry, attribute iPosScale/iRotTint), gió TSL (material.ts).
 *  - Ngoài LOD2: impostor 8 hướng (impostor.ts) tới lod[3], xa hơn cull.
 *  - Collider thân cây (capsule → cylinder Rapier) cho loài có `collider` (VEG-006); bụi/dương xỉ không collider.
 * Engine không import game/*; không Math.random (seed từ level).
 */
import { Box3, Frustum, Group, InstancedBufferAttribute, InstancedBufferGeometry, Matrix4, Mesh, Sphere, Vector3, type BufferGeometry, type Camera, type Material } from 'three/webgpu';
import type { TerrainTile } from '../terrain/tile';
import type { ColliderDef } from '../render/arena';
import { scatterSpecies, type ScatterRule, type ScatterRect, type SpeciesPlacement } from './scatter';
import type { SpeciesAsset } from './species';
import { createVegetationMaterial, createWindUniforms, type WindUniforms } from './material';
import { createImpostorBatch, type ImpostorAtlas, type ImpostorBatch } from './impostor';

export interface VegetationDef {
  seed: number;
  /** cạnh ô (m) — nên = 64 (CHUNK_M terrain) */
  cellM?: number;
  rect: ScatterRect;
  species: ScatterRule[];
  /** gió mặc định 0..1 */
  wind?: number;
}

export interface VegetationQuality {
  /** nhân mật độ (0,4 low · 0,7 medium · 1 high) */
  density: number;
  /** nhân ngưỡng LOD (0,6 low · 0,85 medium · 1 high) */
  lodScale: number;
  /** đổ bóng cây tán/tre */
  shadows: boolean;
}

interface Batch {
  mesh: Mesh;
  geometry: InstancedBufferGeometry;
  posScale: InstancedBufferAttribute;
  rotTint: InstancedBufferAttribute;
  count: number;
  triangles: number;
  capacity: number;
}

interface SpeciesRuntime {
  placement: SpeciesPlacement;
  asset: SpeciesAsset;
  rule: ScatterRule;
  /** batch[variant][lod] = danh sách batch (một mỗi part) */
  batches: Batch[][][];
  cellLod: Map<string, number>;
  impostor: ImpostorBatch | null;
  /** cos/sin yaw, tint, phase cache */
  rot: Float32Array;
  maxScale: number;
}

export interface VegetationStats {
  species: number;
  placed: number;
  visible: number;
  draws: number;
  triangles: number;
  impostors: number;
  lod: [number, number, number];
  cpuMs: number;
  colliders: number;
}

const _proj = new Matrix4();
const _frustum = new Frustum();
const _cam = new Vector3();
const _box = new Box3();

export class VegetationSystem {
  readonly group = new Group();
  readonly wind: WindUniforms;
  readonly stats: VegetationStats = { species: 0, placed: 0, visible: 0, draws: 0, triangles: 0, impostors: 0, lod: [0, 0, 0], cpuMs: 0, colliders: 0 };
  private readonly species: SpeciesRuntime[] = [];
  private readonly cellM: number;
  private readonly materials = new Map<string, Material>();
  readonly colliders: ColliderDef[] = [];

  constructor(
    readonly tile: TerrainTile,
    readonly def: VegetationDef,
    assets: Record<string, SpeciesAsset>,
    readonly quality: VegetationQuality,
    atlases: Record<string, ImpostorAtlas | null> = {},
  ) {
    this.group.name = 'vegetation';
    this.cellM = def.cellM ?? 64;
    this.wind = createWindUniforms();
    this.wind.strength.value = def.wind ?? 0.35;
    let placed = 0;
    for (const rule0 of def.species) {
      const asset = assets[rule0.id];
      if (!asset) continue;
      const rule: ScatterRule = { ...rule0, perHa: rule0.perHa * quality.density, variants: asset.variants.length, lod: rule0.lod.map((d) => d * quality.lodScale) as ScatterRule['lod'] };
      const placement = scatterSpecies(tile, rule.rect ?? def.rect, rule, def.seed, this.cellM);
      placed += placement.count;
      const n = placement.count;
      const rot = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        const yaw = placement.yaw[i]!;
        rot[i * 4] = Math.cos(yaw);
        rot[i * 4 + 1] = Math.sin(yaw);
        // tint/pha từ vị trí (ổn định, không thêm PRNG)
        const hx = Math.sin(placement.pos[i * 3]! * 12.9898 + placement.pos[i * 3 + 2]! * 78.233) * 43758.5453;
        rot[i * 4 + 2] = hx - Math.floor(hx);
        rot[i * 4 + 3] = (yaw + placement.pos[i * 3]! * 0.37 + placement.pos[i * 3 + 2]! * 0.23) % (Math.PI * 2);
      }
      const perVariant = new Uint32Array(asset.variants.length);
      for (let i = 0; i < n; i++) perVariant[placement.variant[i]!]!++;
      const batches: Batch[][][] = [];
      const sc = rule.scale ?? [0.85, 1.15];
      for (let vi = 0; vi < asset.variants.length; vi++) {
        const v = asset.variants[vi]!;
        const cap = perVariant[vi]!;
        batches.push(
          v.lods.map((lod, k) =>
            lod.parts.map((part) => {
              const md = asset.materials.get(part.material);
              const mat = this.material(asset.id, part.material, md?.map ?? null, md?.leaf ?? true, md?.alphaTest ?? 0.5, rule);
              // bóng: chỉ LOD0/1 (gần) — CSM maxFar 180 m, LOD2 xa mờ bóng không đáng chi phí 3 cascade
              return this.makeBatch(part.geometry, mat, cap, part.triangles, rule.cast === true && quality.shadows && k <= 1, `veg_${asset.id}_v${vi}_lod${k}_${part.material}`);
            }),
          ),
        );
      }
      const atlas = atlases[rule.id] ?? null;
      const impostor = atlas && rule.lod[3] > rule.lod[2] ? createImpostorBatch(atlas, n, this.wind, asset) : null;
      if (impostor) this.group.add(impostor.mesh);
      this.species.push({ placement, asset, rule, batches, cellLod: new Map(), impostor, rot, maxScale: sc[1] });
      // collider thân
      if (rule.collider) {
        for (let i = 0; i < n; i++) {
          const s = placement.scale[i]!;
          const r = rule.collider.radius * s;
          const h = rule.collider.height * s;
          this.colliders.push({ id: `veg_${rule.id}_${i}`, kind: 'cylinder', position: [placement.pos[i * 3]!, placement.pos[i * 3 + 1]! + h / 2, placement.pos[i * 3 + 2]!], size: [r, h / 2, 0], yaw: 0, material: 'wood' });
        }
      }
    }
    this.stats.species = this.species.length;
    this.stats.placed = placed;
    this.stats.colliders = this.colliders.length;
  }

  private material(species: string, key: string, map: import('three/webgpu').Texture | null, leaf: boolean, alphaTest: number, rule: ScatterRule): Material {
    const k = `${species}:${key}`;
    let m = this.materials.get(k);
    if (!m) {
      if (!map) throw new Error(`vegetation ${species}: material ${key} has no map`);
      // cây to uốn ít hơn (biên độ tuyệt đối tương tự nhưng theo chiều cao → lá rung nhiều hơn thân)
      const bendM = leaf ? 0.5 : 0.35;
      m = createVegetationMaterial({ map, leaf, alphaTest, wind: this.wind, bendM, flutterM: leaf ? 0.05 : 0.01 });
      m.name = k;
      this.materials.set(k, m);
      void rule;
    }
    return m;
  }

  private makeBatch(src: BufferGeometry, material: Material, capacity: number, triangles: number, cast: boolean, name: string): Batch {
    const g = new InstancedBufferGeometry();
    for (const [n, a] of Object.entries(src.attributes)) g.setAttribute(n, a);
    if (src.index) g.setIndex(src.index);
    const cap = Math.max(1, capacity);
    const posScale = new InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    posScale.setUsage(35048);
    const rotTint = new InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    rotTint.setUsage(35048);
    g.setAttribute('iPosScale', posScale);
    g.setAttribute('iRotTint', rotTint);
    g.instanceCount = 0;
    const half = this.tile.half;
    g.boundingSphere = new Sphere(new Vector3(0, (this.tile.minY + this.tile.maxY) / 2, 0), Math.hypot(half, half, this.tile.maxY - this.tile.minY) + 50);
    g.boundingBox = new Box3(new Vector3(-half, this.tile.minY - 10, -half), new Vector3(half, this.tile.maxY + 60, half));
    const mesh = new Mesh(g, material);
    mesh.name = name;
    mesh.frustumCulled = false;
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.visible = false;
    this.group.add(mesh);
    return { mesh, geometry: g, posScale, rotTint, count: 0, triangles, capacity: cap };
  }

  /** cull + LOD theo ô, chép instance vào batch — gọi mỗi frame trước render (sau khi camera cập nhật) */
  update(camera: Camera): void {
    const t0 = performance.now();
    camera.updateMatrixWorld();
    _proj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_proj);
    _cam.setFromMatrixPosition(camera.matrixWorld);
    const half = this.tile.half;
    let visible = 0;
    let draws = 0;
    let tris = 0;
    let impostors = 0;
    const lodCount: [number, number, number] = [0, 0, 0];
    for (const sp of this.species) {
      for (const vb of sp.batches) for (const lb of vb) for (const b of lb) b.count = 0;
      if (sp.impostor) sp.impostor.count = 0;
      const pl = sp.placement;
      const lodD = sp.rule.lod;
      const hMax = sp.asset.height * sp.maxScale;
      const lodOf = (d: number): number => (d < lodD[0] ? 0 : d < lodD[1] ? 1 : d < lodD[2] ? 2 : d < lodD[3] ? 3 : 4);
      const halfDiag = this.cellM * 0.7071;
      for (const cell of pl.cells.values()) {
        const dx = cell.cx - _cam.x;
        const dz = cell.cz - _cam.z;
        const dc = Math.hypot(dx, dz);
        const dist = Math.max(0, dc - halfDiag);
        // LOD theo ô với hysteresis 6 m; ô nằm vắt qua ngưỡng (gần) → LOD từng cây (jitter ±3 m theo hash để không đổi đồng loạt)
        const key = `${cell.ix},${cell.jz}`;
        const prev = sp.cellLod.get(key) ?? -1;
        let lod = lodOf(dist);
        const lodFar = lodOf(dc + halfDiag);
        const perInstance = lod !== lodFar && lod <= 2;
        // chỉ giữ LOD cũ khi đổi đúng một bậc và đang sát ngưỡng giữa hai bậc đó (teleport/xoay nhanh đổi nhiều bậc → không giữ)
        if (!perInstance && prev >= 0 && Math.abs(lod - prev) === 1) {
          const edge = lodD[Math.min(lod, prev)]!;
          if (Math.abs(dist - edge) < 6) lod = prev;
        }
        sp.cellLod.set(key, lod);
        if (lod === 4) continue;
        _box.min.set(-half + cell.ix * this.cellM, cell.minY, -half + cell.jz * this.cellM);
        _box.max.set(-half + (cell.ix + 1) * this.cellM, cell.maxY + hMax, -half + (cell.jz + 1) * this.cellM);
        if (!_frustum.intersectsBox(_box)) continue;
        if (lod === 3) {
          const imp = sp.impostor;
          if (!imp) continue;
          for (let i = cell.offset; i < cell.offset + cell.count; i++) imp.push(pl.pos, pl.scale, sp.rot, i, pl.variant[i]!);
          impostors += cell.count;
          continue;
        }
        for (let i = cell.offset; i < cell.offset + cell.count; i++) {
          let li = lod;
          if (perInstance) {
            const di = Math.hypot(pl.pos[i * 3]! - _cam.x, pl.pos[i * 3 + 2]! - _cam.z) + (sp.rot[i * 4 + 2]! - 0.5) * 6;
            li = lodOf(di);
            if (li === 4) continue;
            if (li === 3) {
              if (sp.impostor) {
                sp.impostor.push(pl.pos, pl.scale, sp.rot, i, pl.variant[i]!);
                impostors++;
              }
              continue;
            }
          }
          lodCount[li]!++;
          visible++;
          const vi = pl.variant[i]!;
          const lb = sp.batches[vi]![Math.min(li, sp.batches[vi]!.length - 1)]!;
          for (const b of lb) {
            const k = b.count;
            if (k >= b.capacity) continue;
            const ps = b.posScale.array as Float32Array;
            ps[k * 4] = pl.pos[i * 3]!;
            ps[k * 4 + 1] = pl.pos[i * 3 + 1]!;
            ps[k * 4 + 2] = pl.pos[i * 3 + 2]!;
            ps[k * 4 + 3] = pl.scale[i]!;
            const rt = b.rotTint.array as Float32Array;
            rt[k * 4] = sp.rot[i * 4]!;
            rt[k * 4 + 1] = sp.rot[i * 4 + 1]!;
            rt[k * 4 + 2] = sp.rot[i * 4 + 2]!;
            rt[k * 4 + 3] = sp.rot[i * 4 + 3]!;
            b.count = k + 1;
          }
        }
      }
      for (const vb of sp.batches) for (const lb of vb) for (const b of lb) {
        b.geometry.instanceCount = b.count;
        b.mesh.visible = b.count > 0;
        if (b.count > 0) {
          draws++;
          tris += b.count * b.triangles;
          b.posScale.clearUpdateRanges();
          b.posScale.addUpdateRange(0, b.count * 4);
          b.posScale.needsUpdate = true;
          b.rotTint.clearUpdateRanges();
          b.rotTint.addUpdateRange(0, b.count * 4);
          b.rotTint.needsUpdate = true;
        }
      }
      if (sp.impostor) {
        sp.impostor.commit();
        if (sp.impostor.count > 0) {
          draws++;
          tris += sp.impostor.count * 2;
        }
      }
    }
    this.stats.visible = visible;
    this.stats.draws = draws;
    this.stats.triangles = tris;
    this.stats.impostors = impostors;
    this.stats.lod = lodCount;
    this.stats.cpuMs = performance.now() - t0;
  }

  /** số instance đã đặt theo loài (debug/E2E) */
  placedPerSpecies(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const sp of this.species) out[sp.rule.id] = (out[sp.rule.id] ?? 0) + sp.placement.count;
    return out;
  }

  /** gió mạnh lên (trực thăng/bom — VEG-002): strength 0..1 */
  setWind(strength: number, dirX?: number, dirZ?: number): void {
    this.wind.strength.value = strength;
    if (dirX !== undefined && dirZ !== undefined) {
      const l = Math.hypot(dirX, dirZ) || 1;
      this.wind.dir.value.x = dirX / l;
      this.wind.dir.value.y = dirZ / l;
    }
  }

  dispose(): void {
    for (const sp of this.species) {
      for (const vb of sp.batches) for (const lb of vb) for (const b of lb) b.geometry.dispose();
      sp.impostor?.dispose();
    }
    for (const m of this.materials.values()) m.dispose();
    this.group.removeFromParent();
  }
}
