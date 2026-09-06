/**
 * Nạp GLB loài (scripts/convert-vegetation.mjs): node `v<i>_lod<k>` → geometry theo (biến thể, LOD, lớp material).
 * Texture KTX2 qua createGltfLoader; material glTF chỉ dùng để lấy map/alphaMode — vật liệu render là TSL (material.ts).
 */
import { Box3, BufferAttribute, BufferGeometry, Vector3, type BufferAttribute as BA, type InterleavedBufferAttribute, type Mesh, type MeshStandardMaterial, type Texture } from 'three/webgpu';
import { createGltfLoader } from '../render/loaders';

/**
 * Geometry ở hệ loài (m): quantize (KHR_mesh_quantization) đặt POSITION int16 chuẩn hoá + node T/S — instancing dùng
 * positionGeometry trực tiếp nên phải nướng ma trận node vào vị trí (Float32). Normal/uv/_wind giữ nguyên (node không xoay).
 */
function bakeNodeTransform(src: BufferGeometry, mesh: Mesh): BufferGeometry {
  const g = new BufferGeometry();
  const pos = src.getAttribute('position') as BA | InterleavedBufferAttribute;
  const n = pos.count;
  const out = new Float32Array(n * 3);
  const v = new Vector3();
  const m = mesh.matrixWorld;
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(m);
    out[i * 3] = v.x;
    out[i * 3 + 1] = v.y;
    out[i * 3 + 2] = v.z;
  }
  g.setAttribute('position', new BufferAttribute(out, 3));
  for (const [name, attr] of Object.entries(src.attributes)) if (name !== 'position') g.setAttribute(name, attr as BA);
  if (src.index) g.setIndex(src.index);
  g.name = src.name;
  return g;
}

export interface SpeciesPart {
  geometry: BufferGeometry;
  /** key material (dùng chung giữa biến thể/LOD) */
  material: string;
  triangles: number;
}

export interface SpeciesLod {
  parts: SpeciesPart[];
  triangles: number;
}

export interface SpeciesVariant {
  lods: SpeciesLod[];
  /** kích thước (m) ở scale 1: rộng (max xz), cao */
  width: number;
  height: number;
}

export interface SpeciesMaterialDef {
  key: string;
  map: Texture;
  leaf: boolean;
  alphaTest: number;
}

export interface SpeciesAsset {
  id: string;
  variants: SpeciesVariant[];
  materials: Map<string, SpeciesMaterialDef>;
  height: number;
  triangles: number;
}

export async function loadSpecies(url: string, id: string): Promise<SpeciesAsset> {
  const gltf = await createGltfLoader().loadAsync(url);
  const variants: SpeciesVariant[] = [];
  const materials = new Map<string, SpeciesMaterialDef>();
  let maxH = 0;
  let tri0 = 0;
  const box = new Box3();
  const size = new Vector3();
  gltf.scene.updateMatrixWorld(true);
  for (const node of gltf.scene.children) {
    const m = /^v(\d+)_lod(\d)$/.exec(node.name);
    if (!m) continue;
    const vi = Number(m[1]);
    const k = Number(m[2]);
    while (variants.length <= vi) variants.push({ lods: [], width: 0, height: 0 });
    const v = variants[vi]!;
    while (v.lods.length <= k) v.lods.push({ parts: [], triangles: 0 });
    const lod = v.lods[k]!;
    const meshes: Mesh[] = [];
    node.traverse((o) => {
      if ((o as Mesh).isMesh) meshes.push(o as Mesh);
    });
    for (const mesh of meshes) {
      const mat = mesh.material as MeshStandardMaterial;
      const key = mat.name || `mat_${materials.size}`;
      if (!materials.has(key) && mat.map) materials.set(key, { key, map: mat.map, leaf: mat.alphaTest > 0 || mat.transparent || key.startsWith('leaf'), alphaTest: mat.alphaTest > 0 ? mat.alphaTest : 0.5 });
      if (!mesh.geometry.getAttribute('_wind')) throw new Error(`vegetation ${id}: missing _WIND attribute (reconvert)`);
      const g = bakeNodeTransform(mesh.geometry, mesh);
      const tris = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
      lod.parts.push({ geometry: g, material: key, triangles: tris });
      lod.triangles += tris;
      if (k === 0) {
        g.computeBoundingBox();
        box.copy(g.boundingBox!);
        box.getSize(size);
        v.width = Math.max(v.width, Math.max(size.x, size.z));
        v.height = Math.max(v.height, box.max.y);
      }
    }
    if (k === 0) tri0 += lod.triangles;
    maxH = Math.max(maxH, v.height);
  }
  if (!variants.length) throw new Error(`vegetation ${id}: no v<i>_lod<k> nodes`);
  return { id, variants, materials, height: maxH, triangles: Math.round(tri0 / variants.length) };
}
