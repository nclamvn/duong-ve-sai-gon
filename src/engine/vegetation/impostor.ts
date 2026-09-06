/**
 * Impostor 8 hướng (TIP-D05, PRD VEG-001 "impostor octahedral" — G0′ dùng trụ 8 góc phương vị, nâng octahedral ở D12):
 *  - bake lúc nạp: mỗi biến thể LOD0 render unlit (albedo × alpha) từ 8 phương vị (nghiêng xuống 15°) vào atlas
 *    RenderTarget 8 × nVariant ô vuông (mỗi ô cạnh S = max(rộng, cao) m của loài);
 *  - render: quad billboard quanh trục y, chọn ô theo góc nhìn trong hệ cây (yaw instance), alpha MASK, normal
 *    = trộn lên + hướng camera để ăn nắng như tán; gió: đung đưa nhẹ theo pha.
 */
import { BufferAttribute, BufferGeometry, Box3, Color, DoubleSide, InstancedBufferAttribute, InstancedBufferGeometry, LinearFilter, LinearMipmapLinearFilter, Mesh, MeshBasicNodeMaterial, MeshStandardNodeMaterial, OrthographicCamera, RenderTarget, RGBAFormat, Scene, Sphere, UnsignedByteType, Vector3, type Node, type Renderer, type Texture } from 'three/webgpu';
import { attribute, cameraPosition, float, floor, fract, normalize, positionGeometry, texture, uv, vec2, vec3, vec4, mix, sin, time, transformNormalToView, atan, mod } from 'three/tsl';
import type { SpeciesAsset } from './species';
import type { WindUniforms } from './material';

export interface ImpostorAtlas {
  texture: Texture;
  tiles: number;
  variants: number;
  /** cạnh ô (m) ở scale 1 */
  sizeM: number;
  /** render target (debug: đọc lại atlas) */
  target: RenderTarget;
  /** giải phóng render target */
  dispose(): void;
}

const TILE_PX = 256;
const TILES = 8;
const ELEV = (15 * Math.PI) / 180;

/** Bake atlas impostor cho một loài (gọi lúc nạp, trước vòng lặp chính). Thất bại → null (không impostor, cull ở lod[2]). */
export async function bakeImpostorAtlas(renderer: Renderer, asset: SpeciesAsset): Promise<ImpostorAtlas | null> {
  const nVar = asset.variants.length;
  let sizeM = 0;
  for (const v of asset.variants) sizeM = Math.max(sizeM, v.width, v.height);
  sizeM *= 1.04;
  const rt = new RenderTarget(TILES * TILE_PX, nVar * TILE_PX, { format: RGBAFormat, type: UnsignedByteType, depthBuffer: true, generateMipmaps: true, minFilter: LinearMipmapLinearFilter, magFilter: LinearFilter });
  rt.texture.name = `impostor_${asset.id}`;
  const scene = new Scene();
  const mats = new Map<string, MeshBasicNodeMaterial>();
  const meshes: Mesh[][] = [];
  for (const v of asset.variants) {
    const lod = v.lods[0]!;
    const list: Mesh[] = [];
    for (const part of lod.parts) {
      const md = asset.materials.get(part.material);
      if (!md) continue;
      let m = mats.get(part.material);
      if (!m) {
        // alphaTest thấp khi bake: ô 256 px (≈ 10 cm/px cho cây 26 m) lấy mip thô của lá → alpha trung bình < 0,5 sẽ xoá gần hết tán
        m = new MeshBasicNodeMaterial({ map: md.map, alphaTest: md.leaf ? Math.min(0.5, md.alphaTest) * 0.4 : 0, side: DoubleSide });
        mats.set(part.material, m);
      }
      const mesh = new Mesh(part.geometry, m);
      mesh.frustumCulled = false;
      mesh.visible = false;
      scene.add(mesh);
      list.push(mesh);
    }
    meshes.push(list);
  }
  const cam = new OrthographicCamera(-sizeM / 2, sizeM / 2, sizeM, 0, 0.1, sizeM * 4);
  const prevRT = renderer.getRenderTarget();
  const prevClear = renderer.autoClear;
  const prevAlpha = renderer.getClearAlpha();
  const prevColor = renderer.getClearColor(new Color());
  const prevScissorTest = renderer.getScissorTest();
  try {
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = true;
    renderer.setScissorTest(false);
    // viewport/scissor của render target lấy từ rt.viewport/rt.scissor (Renderer._renderScene), không phải setViewport của canvas
    rt.viewport.set(0, 0, rt.width, rt.height);
    rt.scissor.set(0, 0, rt.width, rt.height);
    renderer.clear();
    renderer.autoClear = false;
    renderer.setScissorTest(true);
    for (let vi = 0; vi < nVar; vi++) {
      for (const list of meshes) for (const m of list) m.visible = false;
      for (const m of meshes[vi]!) m.visible = true;
      for (let k = 0; k < TILES; k++) {
        const az = (k / TILES) * Math.PI * 2;
        const d = sizeM * 2;
        // camera nhìn từ phương vị az (hướng cây → camera = (sin az, ·, cos az)), nghiêng xuống ELEV, ortho phủ ô vuông S từ chân
        cam.position.set(Math.sin(az) * Math.cos(ELEV) * d, sizeM / 2 + Math.sin(ELEV) * d, Math.cos(az) * Math.cos(ELEV) * d);
        cam.up.set(0, 1, 0);
        cam.lookAt(0, sizeM / 2, 0);
        cam.top = sizeM / 2;
        cam.bottom = -sizeM / 2;
        cam.updateProjectionMatrix();
        cam.updateMatrixWorld();
        rt.viewport.set(k * TILE_PX, vi * TILE_PX, TILE_PX, TILE_PX);
        rt.scissor.set(k * TILE_PX, vi * TILE_PX, TILE_PX, TILE_PX);
        await renderer.renderAsync(scene, cam);
      }
    }
  } catch (e) {
    rt.dispose();
    console.warn(`[vegetation] impostor bake failed for ${asset.id}: ${(e as Error).message}`);
    return null;
  } finally {
    renderer.setRenderTarget(prevRT);
    renderer.autoClear = prevClear;
    renderer.setClearColor(prevColor, prevAlpha);
    renderer.setScissorTest(prevScissorTest);
    rt.viewport.set(0, 0, rt.width, rt.height);
    rt.scissor.set(0, 0, rt.width, rt.height);
    for (const m of mats.values()) m.dispose();
  }
  return { texture: rt.texture, tiles: TILES, variants: nVar, sizeM, target: rt, dispose: () => rt.dispose() };
}

export interface ImpostorBatch {
  mesh: Mesh;
  count: number;
  push(pos: Float32Array, scale: Float32Array, rot: Float32Array, i: number, variant: number): void;
  commit(): void;
  dispose(): void;
}

let quadGeo: BufferGeometry | null = null;
function quad(): BufferGeometry {
  if (quadGeo) return quadGeo;
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  quadGeo = g;
  return g;
}

export function createImpostorBatch(atlas: ImpostorAtlas, capacity: number, wind: WindUniforms, asset: SpeciesAsset): ImpostorBatch {
  const g = new InstancedBufferGeometry();
  const q = quad();
  g.setAttribute('position', q.getAttribute('position'));
  g.setAttribute('normal', q.getAttribute('normal'));
  g.setAttribute('uv', q.getAttribute('uv'));
  g.setIndex(q.getIndex());
  const cap = Math.max(1, capacity);
  const posScale = new InstancedBufferAttribute(new Float32Array(cap * 4), 4);
  posScale.setUsage(35048);
  const rotTint = new InstancedBufferAttribute(new Float32Array(cap * 4), 4);
  rotTint.setUsage(35048);
  g.setAttribute('iPosScale', posScale);
  g.setAttribute('iRotTint', rotTint);
  g.instanceCount = 0;
  g.boundingSphere = new Sphere(new Vector3(0, 0, 0), 4000);
  g.boundingBox = new Box3(new Vector3(-2000, -500, -2000), new Vector3(2000, 1000, 2000));

  const mat = new MeshStandardNodeMaterial();
  const ps = attribute('iPosScale', 'vec4') as unknown as Node<'vec4'>;
  const rt = attribute('iRotTint', 'vec4') as unknown as Node<'vec4'>;
  const S = float(atlas.sizeM);
  const center = vec3(ps.x, ps.y, ps.z);
  const toCam = cameraPosition.sub(center);
  const d = normalize(vec2(toCam.x, toCam.z));
  // hướng camera trong hệ cây (xoay −yaw): dx = c·x − s·z, dz = s·x + c·z
  const lx = rt.x.mul(d.x).sub(rt.y.mul(d.y));
  const lz = rt.y.mul(d.x).add(rt.x.mul(d.y));
  const a = atan(lx, lz); // −π..π, 0 = +z
  const tileF = mod(floor(fract(a.div(Math.PI * 2)).mul(atlas.tiles).add(0.5)), float(atlas.tiles));
  const right = vec3(d.y, 0, d.x.negate());
  const size = S.mul(ps.w);
  const sway = sin(time.mul(0.9).add(rt.x.mul(3.0)).add(ps.x.mul(0.1))).mul(wind.strength as unknown as Node<'float'>).mul(0.3);
  const q0 = positionGeometry;
  const world = center.add(right.mul(q0.x.mul(size))).add(vec3(0, q0.y.mul(size), 0)).add(vec3(sway.mul(q0.y), 0, sway.mul(q0.y).mul(0.6)));
  mat.positionNode = world;
  const u = uv();
  const uvAtlas = vec2(tileF.add(u.x).div(atlas.tiles), rt.w.add(u.y).div(atlas.variants));
  const tex = texture(atlas.texture, uvAtlas);
  const tv = 0.18;
  const tint = mix(float(1 - tv), float(1 + tv), rt.z);
  // tán thật tự che bóng (tối) — impostor unlit hoàn toàn nên nhân AO dọc (gốc tối 0,55 → ngọn 1) và giảm 15 % cho khớp cây LOD2 kề bên
  const ao = mix(float(0.55), float(1.0), u.y).mul(0.85);
  mat.colorNode = vec4(tex.rgb.mul(tint).mul(ao), tex.a);
  mat.alphaTest = 0.5;
  mat.side = DoubleSide;
  // normal: lên + về camera (tán cây nhận nắng từ trên)
  const nW = normalize(vec3(toCam.x, 0, toCam.z).normalize().mul(0.7).add(vec3(0, 0.75, 0)));
  mat.normalNode = transformNormalToView(nW);
  mat.roughnessNode = float(0.85);
  mat.metalnessNode = float(0);
  mat.name = `impostor_${asset.id}`;
  const mesh = new Mesh(g, mat);
  mesh.name = `veg_${asset.id}_impostor`;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.matrixAutoUpdate = false;
  mesh.visible = false;
  const batch: ImpostorBatch = {
    mesh,
    count: 0,
    push(pos, scale, rot, i, variant) {
      const k = batch.count;
      if (k >= cap) return;
      const a4 = posScale.array as Float32Array;
      a4[k * 4] = pos[i * 3]!;
      a4[k * 4 + 1] = pos[i * 3 + 1]!;
      a4[k * 4 + 2] = pos[i * 3 + 2]!;
      a4[k * 4 + 3] = scale[i]!;
      const b4 = rotTint.array as Float32Array;
      b4[k * 4] = rot[i * 4]!;
      b4[k * 4 + 1] = rot[i * 4 + 1]!;
      b4[k * 4 + 2] = rot[i * 4 + 2]!;
      b4[k * 4 + 3] = variant;
      batch.count = k + 1;
    },
    commit() {
      g.instanceCount = batch.count;
      mesh.visible = batch.count > 0;
      if (batch.count > 0) {
        posScale.clearUpdateRanges();
        posScale.addUpdateRange(0, batch.count * 4);
        posScale.needsUpdate = true;
        rotTint.clearUpdateRanges();
        rotTint.addUpdateRange(0, batch.count * 4);
        rotTint.needsUpdate = true;
      }
    },
    dispose() {
      g.dispose();
      mat.dispose();
      atlas.dispose();
    },
  };
  return batch;
}
