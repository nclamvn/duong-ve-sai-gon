/**
 * TerrainMesh (TIP-D04): 4 LOD, mỗi LOD một Mesh với InstancedBufferGeometry (attribute `chunkOffset` xz mỗi ô 64 m)
 * → ≤ 4 draw cho ô 2 km. Cao độ lấy trong vertex shader từ texture cao độ (nearest; đỉnh lưới trùng texel).
 * Váy (skirt) quanh ô kéo xuống SKIRT_M che khe giữa LOD kề nhau. Chọn LOD + frustum cull ở CPU mỗi frame (`update(camera)`).
 */
import { BufferAttribute, BufferGeometry, Box3, DataTexture, Frustum, Group, InstancedBufferAttribute, InstancedBufferGeometry, LinearFilter, Matrix4, Mesh, NearestFilter, NoColorSpace, RGBAFormat, Sphere, UnsignedByteType, Vector3, type Camera, type Material } from 'three/webgpu';
import { CHUNK_M, LOD_RES, SKIRT_M, chooseLod, lodVerts } from './lod';
import type { TerrainTile } from './tile';

export interface TerrainStats {
  /** số ô hiển thị theo LOD */
  lod: [number, number, number, number];
  visible: number;
  chunks: number;
  /** tam giác ước tính đang vẽ */
  tris: number;
  draws: number;
}

/** lưới LOD cục bộ [0, CHUNK_M]² + váy; attribute `skirt` = 1 ở đỉnh váy (vertex shader kéo xuống) */
export function makeChunkGeometry(lod: number): BufferGeometry {
  const v = lodVerts(lod);
  const res = LOD_RES[lod]!;
  const gridVerts = v * v;
  const skirtVerts = 4 * v;
  const pos = new Float32Array((gridVerts + skirtVerts) * 3);
  const skirt = new Float32Array(gridVerts + skirtVerts);
  let k = 0;
  for (let j = 0; j < v; j++) {
    for (let i = 0; i < v; i++) {
      pos[k * 3] = i * res;
      pos[k * 3 + 2] = j * res;
      k++;
    }
  }
  // váy: 4 cạnh (bắc j=0, nam j=v−1, tây i=0, đông i=v−1) — đỉnh trùng xz với cạnh, skirt=1
  const edge = (i: number, j: number): void => {
    pos[k * 3] = i * res;
    pos[k * 3 + 2] = j * res;
    skirt[k] = 1;
    k++;
  };
  for (let i = 0; i < v; i++) edge(i, 0);
  for (let i = 0; i < v; i++) edge(i, v - 1);
  for (let j = 0; j < v; j++) edge(0, j);
  for (let j = 0; j < v; j++) edge(v - 1, j);
  const idx: number[] = [];
  for (let j = 0; j < v - 1; j++) {
    for (let i = 0; i < v - 1; i++) {
      const a = j * v + i;
      const b = a + 1;
      const c = a + v;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  // váy: quad giữa đỉnh cạnh (grid) và đỉnh váy tương ứng; chiều quay hướng ra ngoài ô
  const sN = gridVerts;
  const sS = sN + v;
  const sW = sS + v;
  const sE = sW + v;
  for (let i = 0; i < v - 1; i++) {
    // bắc (z = 0): grid a=i, b=i+1; váy sa, sb → mặt hướng −z
    const a = i;
    const b = i + 1;
    idx.push(a, b, sN + i, b, sN + i + 1, sN + i);
    // nam (z = max): grid a=(v−1)v+i
    const a2 = (v - 1) * v + i;
    const b2 = a2 + 1;
    idx.push(b2, a2, sS + i + 1, a2, sS + i, sS + i + 1);
  }
  for (let j = 0; j < v - 1; j++) {
    // tây (x = 0): grid a=j·v, b=(j+1)·v → mặt hướng −x
    const a = j * v;
    const b = (j + 1) * v;
    idx.push(b, a, sW + j + 1, a, sW + j, sW + j + 1);
    // đông (x = max)
    const a2 = j * v + (v - 1);
    const b2 = (j + 1) * v + (v - 1);
    idx.push(a2, b2, sE + j, b2, sE + j + 1, sE + j);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  // normal phẳng (0,1,0): normal thật tính trong shader từ texture; attribute có mặt để normalWorld/bias hợp lệ
  const nrm = new Float32Array(pos.length);
  for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
  g.setAttribute('normal', new BufferAttribute(nrm, 3));
  g.setAttribute('skirt', new BufferAttribute(skirt, 1));
  g.setIndex(idx);
  return g;
}

export function makeHeightTexture(tile: TerrainTile): DataTexture {
  const t = new DataTexture(tile.heightTexture(), tile.n, tile.n, RGBAFormat, UnsignedByteType);
  t.magFilter = t.minFilter = NearestFilter;
  t.generateMipmaps = false;
  t.flipY = false;
  t.colorSpace = NoColorSpace;
  t.needsUpdate = true;
  return t;
}

export function makeNormalTexture(tile: TerrainTile): DataTexture {
  const t = new DataTexture(tile.normalTexture(), tile.n, tile.n, RGBAFormat, UnsignedByteType);
  t.magFilter = t.minFilter = LinearFilter;
  t.generateMipmaps = false;
  t.flipY = false;
  t.colorSpace = NoColorSpace;
  t.needsUpdate = true;
  return t;
}

interface Chunk {
  cx: number;
  cz: number;
  box: Box3;
  lod: number;
}

export class TerrainMesh {
  readonly group = new Group();
  readonly meshes: Mesh[] = [];
  readonly offsets: InstancedBufferAttribute[] = [];
  readonly chunks: Chunk[] = [];
  readonly stats: TerrainStats = { lod: [0, 0, 0, 0], visible: 0, chunks: 0, tris: 0, draws: 0 };
  private readonly frustum = new Frustum();
  private readonly proj = new Matrix4();
  private readonly camPos = new Vector3();
  private readonly trisPerLod: number[];

  constructor(
    readonly tile: TerrainTile,
    material: Material,
  ) {
    this.group.name = `terrain_${tile.meta.id}`;
    const per = Math.round(tile.sizeM / CHUNK_M);
    const cells = CHUNK_M / tile.resM;
    for (let jz = 0; jz < per; jz++) {
      for (let ix = 0; ix < per; ix++) {
        const cx = -tile.half + ix * CHUNK_M;
        const cz = -tile.half + jz * CHUNK_M;
        const [mn, mx] = tile.minMax(ix * cells, jz * cells, (ix + 1) * cells, (jz + 1) * cells);
        this.chunks.push({ cx, cz, box: new Box3(new Vector3(cx, mn - SKIRT_M, cz), new Vector3(cx + CHUNK_M, mx, cz + CHUNK_M)), lod: -1 });
      }
    }
    this.stats.chunks = this.chunks.length;
    this.trisPerLod = [];
    for (let lod = 0; lod < LOD_RES.length; lod++) {
      const base = makeChunkGeometry(lod);
      const g = new InstancedBufferGeometry();
      g.setAttribute('position', base.getAttribute('position'));
      g.setAttribute('normal', base.getAttribute('normal'));
      g.setAttribute('skirt', base.getAttribute('skirt'));
      g.setIndex(base.getIndex());
      const off = new InstancedBufferAttribute(new Float32Array(this.chunks.length * 2), 2);
      off.setUsage(35048); // DynamicDrawUsage
      g.setAttribute('chunkOffset', off);
      g.instanceCount = 0;
      // bounding: toàn ô (cull thủ công theo ô nhỏ)
      g.boundingSphere = new Sphere(new Vector3(0, (tile.minY + tile.maxY) / 2, 0), Math.hypot(tile.half, tile.half, (tile.maxY - tile.minY) / 2 + SKIRT_M) + CHUNK_M);
      g.boundingBox = new Box3(new Vector3(-tile.half, tile.minY - SKIRT_M, -tile.half), new Vector3(tile.half + CHUNK_M, tile.maxY, tile.half + CHUNK_M));
      const m = new Mesh(g, material);
      m.name = `terrain_lod${lod}`;
      m.frustumCulled = false;
      m.castShadow = false;
      m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      this.meshes.push(m);
      this.offsets.push(off);
      this.group.add(m);
      this.trisPerLod.push((base.getIndex()?.count ?? 0) / 3);
    }
  }

  get id(): string {
    return this.tile.meta.id;
  }

  /** chọn LOD + cull theo camera; gọi mỗi frame trước render */
  update(camera: Camera): void {
    camera.updateMatrixWorld();
    this.proj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.proj);
    this.camPos.setFromMatrixPosition(camera.matrixWorld);
    const counts = [0, 0, 0, 0];
    const arrays = this.offsets.map((o) => o.array as Float32Array);
    let visible = 0;
    let tris = 0;
    for (const c of this.chunks) {
      // LOD theo khoảng cách xz tới tâm ô (giữ trạng thái để hysteresis ổn định cả khi ô bị cull)
      const dx = c.cx + CHUNK_M / 2 - this.camPos.x;
      const dz = c.cz + CHUNK_M / 2 - this.camPos.z;
      const dist = Math.max(0, Math.hypot(dx, dz) - CHUNK_M * 0.7071);
      c.lod = chooseLod(dist, c.lod);
      if (!this.frustum.intersectsBox(c.box)) continue;
      const k = counts[c.lod]!++;
      arrays[c.lod]![k * 2] = c.cx;
      arrays[c.lod]![k * 2 + 1] = c.cz;
      visible++;
      tris += this.trisPerLod[c.lod]!;
    }
    let draws = 0;
    for (let lod = 0; lod < 4; lod++) {
      const n = counts[lod]!;
      (this.meshes[lod]!.geometry as InstancedBufferGeometry).instanceCount = n;
      this.meshes[lod]!.visible = n > 0;
      if (n > 0) {
        draws++;
        const off = this.offsets[lod]!;
        off.clearUpdateRanges();
        off.addUpdateRange(0, n * 2);
        off.needsUpdate = true;
      }
    }
    this.stats.lod = counts as [number, number, number, number];
    this.stats.visible = visible;
    this.stats.tris = tris;
    this.stats.draws = draws;
  }
}
