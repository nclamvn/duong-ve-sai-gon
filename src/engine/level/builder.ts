/**
 * Level builder (TIP-019, ADR-007): LevelDef (content/levels/*.level.json) → scene (mặt đất, dãy nhà ống, công trình, prop glTF,
 * chướng ngại/xác xe, FX khói lửa) + ArenaData (collider, navGeometry, waypoint, cover, spawn, zone) cho physics/AI/mission.
 * Cùng hợp đồng với buildArena (G0) → game không đổi; ArenaData là nguồn sự thật duy nhất cho collider.
 */
import { Scene, Group, Mesh, InstancedMesh, BoxGeometry, PlaneGeometry, CylinderGeometry, MeshStandardNodeMaterial, Object3D, Matrix4, Vector3, Euler, Quaternion, Box3, Color, type BufferGeometry } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createWetGround, createWetGroundProcedural, createTexturedMaterial, createPropMaterial } from '@engine/render/materials';
import { createAmbientFx, type AmbientFx } from '@engine/render/ambientFx';
import type { LoadedAssets } from '@engine/render/assets';
import type { ArenaData, ColliderDef, CoverMarker } from '@engine/render/arena';
import { createFacadeMaterials, buildFacades, makeSignTexture } from './facade';
import { createBarricadeMaterials, buildBarricades } from './barricades';
import type { LevelDef, V3 } from './types';

export interface LevelBuild extends ArenaData {
  def: LevelDef;
  fx: AmbientFx;
  facadeDraws: number;
}

export interface LevelOptions {
  assets?: LoadedAssets | null;
  /** giới hạn đèn lửa */
  maxFxLights?: number;
}

const _m = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion();
const _s = new Vector3(1, 1, 1);

function navBox(position: V3, size: V3, yaw: number): Mesh {
  const m = new Mesh(new BoxGeometry(size[0] * 2, size[1] * 2, size[2] * 2));
  m.position.set(position[0], position[1], position[2]);
  m.rotation.y = yaw;
  m.updateMatrixWorld(true);
  return m;
}

function groundPlane(w: number, d: number, x: number, y: number, z: number, material: MeshStandardNodeMaterial, name: string): Mesh {
  const g = new PlaneGeometry(w, d, 1, 1);
  g.rotateX(-Math.PI / 2);
  const m = new Mesh(g, material);
  m.position.set(x, y, z);
  m.receiveShadow = true;
  m.castShadow = false;
  m.name = name;
  m.updateMatrixWorld(true);
  return m;
}

/** UV theo mét cho box (như facade.mbox) */
function mbox(w: number, h: number, d: number): BoxGeometry {
  const g = new BoxGeometry(w, h, d);
  const uv = g.attributes['uv']!;
  const pos = g.attributes['position']!;
  const nor = g.attributes['normal']!;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    if (nx > 0.5) uv.setXY(i, pos.getZ(i), pos.getY(i));
    else if (ny > 0.5) uv.setXY(i, pos.getX(i), pos.getZ(i));
    else uv.setXY(i, pos.getX(i), pos.getY(i));
  }
  return g;
}

interface ModelInstance {
  position: V3;
  yaw: number;
  pitch: number;
  roll: number;
  scale: number;
  /** nhân màu (instanceColor) 0..1 — ám khói */
  tint: number;
}

const _tint = new Color();

/**
 * Instance một model glTF tại nhiều transform: mỗi primitive → 1 InstancedMesh (draw = số primitive, không phải số instance).
 * Morph target bị bỏ (InstancedMesh + MorphNode lỗi). Prop thấp < 0.8 m không đổ bóng. Trả về số draw thêm.
 */
function instanceModel(root: Group, name: string, src: Group, list: ModelInstance[]): number {
  src.updateMatrixWorld(true);
  const bb = new Box3().setFromObject(src);
  const tall = bb.max.y - bb.min.y > 0.8;
  const meshes: Mesh[] = [];
  src.traverse((o: Object3D) => {
    if ((o as Mesh).isMesh) meshes.push(o as Mesh);
  });
  const tmpM = new Matrix4();
  const instM = new Matrix4();
  const tinted = list.some((it) => it.tint !== 1);
  let draws = 0;
  for (const m of meshes) {
    let geo = m.geometry;
    if (Object.keys(geo.morphAttributes).length > 0) {
      geo = geo.clone();
      geo.morphAttributes = {};
      geo.morphTargetsRelative = false;
    }
    const im = new InstancedMesh(geo, m.material, list.length);
    list.forEach((it, k) => {
      _p.set(it.position[0], it.position[1], it.position[2]);
      _q.setFromEuler(new Euler(it.pitch, it.yaw, it.roll));
      _s.setScalar(it.scale);
      instM.compose(_p, _q, _s);
      tmpM.copy(instM).multiply(m.matrixWorld);
      im.setMatrixAt(k, tmpM);
      if (tinted) im.setColorAt(k, _tint.setScalar(it.tint));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = tall;
    im.receiveShadow = true;
    // bounding sphere theo toàn bộ instance → culling theo cụm (TIP-D02); trước đây frustumCulled=false vẽ mọi cụm mọi frame
    im.computeBoundingSphere();
    im.frustumCulled = true;
    im.name = `props_${name}`;
    root.add(im);
    draws++;
  }
  return draws;
}

function placed(g: BufferGeometry, x: number, y: number, z: number, yaw = 0): BufferGeometry {
  _p.set(x, y, z);
  _q.setFromEuler(new Euler(0, yaw, 0));
  _m.compose(_p, _q, _s.set(1, 1, 1));
  g.applyMatrix4(_m);
  return g.index ? g.toNonIndexed() : g;
}

export function buildLevel(scene: Scene, def: LevelDef, opts: LevelOptions = {}): LevelBuild {
  const assets = opts.assets ?? null;
  const tex = assets?.textures ?? null;
  const root = new Group();
  root.name = `level_${def.id}`;
  scene.add(root);
  const colliders: ColliderDef[] = [];
  const navGeometry: Mesh[] = [];
  const coverMarkers: CoverMarker[] = [...def.coverMarkers];
  let props = 0;
  let decor = 0;
  let draws = 0;

  // ---------- Mặt đất
  const G = def.ground;
  const roadTex = tex?.[G.road.texture] ?? tex?.['asphalt_02'] ?? null;
  const road = roadTex ? createWetGround(roadTex, 1, { worldUv: true, tile: 5.0, wetness: G.wetness, dirt: [0.72, 1.0] }) : createWetGroundProcedural();
  road.wetness.value = G.wetness;
  const fillMat = tex?.[G.fill.texture] ? createTexturedMaterial(tex[G.fill.texture]!, { tileMeters: 6, worldUv: 'xz', roughnessScale: 1.0 }) : createPropMaterial(0x6d5c48, 0.95);
  const walkMat = tex?.[G.sidewalk.texture] ? createTexturedMaterial(tex[G.sidewalk.texture]!, { tileMeters: 2.0, worldUv: 'xz', roughnessScale: 1.0, grime: 0.35 }) : createPropMaterial(0x9b9891, 0.9);
  const fill = groundPlane(G.fill.size, G.fill.size, 0, -0.03, 0, fillMat, 'ground_fill');
  root.add(fill);
  navGeometry.push(fill);
  draws++;
  // collider mặt đất (nguồn collider duy nhất cho physics — thiếu là người chơi rơi xuyên đất; bot đi navmesh nên không lộ)
  colliders.push({ id: 'floor', kind: 'box', position: [0, -0.5, 0], size: [G.fill.size / 2, 0.5, G.fill.size / 2], yaw: 0, material: 'concrete' });
  const roadMesh = groundPlane(G.road.halfWidth * 2, G.road.z1 - G.road.z0, 0, 0.0, (G.road.z0 + G.road.z1) / 2, road.material, 'road');
  root.add(roadMesh);
  navGeometry.push(roadMesh);
  draws++;
  for (const c of G.crossRoads) {
    const cm = groundPlane(c.x1 - c.x0, c.halfWidth * 2, (c.x0 + c.x1) / 2, 0.005, c.z, road.material, 'crossroad');
    root.add(cm);
    navGeometry.push(cm);
    draws++;
  }
  // vỉa hè: hai dải, chừa ngã tư
  const walkParts: BufferGeometry[] = [];
  const hw = G.road.halfWidth;
  const sw = G.sidewalk.width;
  const sh = G.sidewalk.height;
  const segs: Array<[number, number]> = [];
  let zc = G.road.z0;
  const cuts = [...G.crossRoads].sort((a, b) => a.z - b.z);
  for (const c of cuts) {
    segs.push([zc, c.z - c.halfWidth]);
    zc = c.z + c.halfWidth;
  }
  segs.push([zc, G.road.z1]);
  for (const [z0, z1] of segs) {
    if (z1 - z0 < 1) continue;
    for (const sgn of [-1, 1]) {
      const x = sgn * (hw + sw / 2);
      walkParts.push(placed(mbox(sw, sh, z1 - z0), x, sh / 2, (z0 + z1) / 2));
      navGeometry.push(navBox([x, sh / 2, (z0 + z1) / 2], [sw / 2, sh / 2, (z1 - z0) / 2], 0));
      colliders.push({ id: `walk_${sgn > 0 ? 'e' : 'w'}_${Math.round(z0)}`, kind: 'box', position: [x, sh / 2, (z0 + z1) / 2], size: [sw / 2, sh / 2, (z1 - z0) / 2], yaw: 0, material: 'concrete' });
    }
  }
  // vỉa hè ngã tư (hai bên đường ngang, ngoài phạm vi nhà)
  for (const c of G.crossRoads) {
    for (const sgn of [-1, 1]) {
      const z = c.z + sgn * (c.halfWidth + sw / 2);
      for (const [x0, x1] of [
        [c.x0, -hw - sw],
        [hw + sw, c.x1],
      ] as Array<[number, number]>) {
        walkParts.push(placed(mbox(x1 - x0, sh, sw), (x0 + x1) / 2, sh / 2, z));
        navGeometry.push(navBox([(x0 + x1) / 2, sh / 2, z], [(x1 - x0) / 2, sh / 2, sw / 2], 0));
        colliders.push({ id: `walkx_${Math.round(z)}_${Math.round(x0)}`, kind: 'box', position: [(x0 + x1) / 2, sh / 2, z], size: [(x1 - x0) / 2, sh / 2, sw / 2], yaw: 0, material: 'concrete' });
      }
    }
  }
  const walkGeo = mergeGeometries(walkParts, false);
  if (walkGeo) {
    const wm = new Mesh(walkGeo, walkMat);
    wm.name = 'sidewalks';
    wm.receiveShadow = true;
    wm.castShadow = true;
    root.add(wm);
    draws++;
  }
  // bó vỉa 15 cm: collider khớp hình (autostep bước qua)

  // ---------- Dãy nhà ống
  const fmats = createFacadeMaterials(tex);
  const fac = buildFacades(def.lots, fmats, 11);
  root.add(fac.group);
  draws += fac.drawEstimate;
  for (const c of fac.colliders) {
    colliders.push({ id: c.id, kind: 'box', position: c.position, size: c.size, yaw: 0, material: 'concrete' });
    navGeometry.push(navBox(c.position, c.size, 0));
  }
  let facadeDraws = fac.drawEstimate;
  (def.crossLots ?? []).forEach((cl, ci) => {
    const f2 = buildFacades(cl.lots, fmats, 23 + ci, { origin: cl.origin, yaw: cl.yaw });
    root.add(f2.group);
    draws += f2.drawEstimate;
    facadeDraws += f2.drawEstimate;
    for (const c of f2.colliders) {
      colliders.push({ id: `x${ci}_${c.id}`, kind: 'box', position: c.position, size: c.size, yaw: c.yaw ?? 0, material: 'concrete' });
      navGeometry.push(navBox(c.position, c.size, c.yaw ?? 0));
    }
  });

  // ---------- Tường bao + công trình
  const wallMat = tex?.['concrete_wall_001'] ? createTexturedMaterial(tex['concrete_wall_001']!, { tileMeters: 2.4, tint: 0xa9a59c, grime: 0.7 }) : createPropMaterial(0x8f8b83, 0.9);
  const b = def.bounds;
  const boundParts: BufferGeometry[] = [];
  const boundDefs: Array<{ id: string; p: V3; s: V3 }> = [
    { id: 'bound_w', p: [b.xWest - 2, 5, (b.zNorth + b.zSouth) / 2], s: [2, 5, (b.zSouth - b.zNorth) / 2 + 4] },
    { id: 'bound_e', p: [b.xEast + 2, 5, (b.zNorth + b.zSouth) / 2], s: [2, 5, (b.zSouth - b.zNorth) / 2 + 4] },
    { id: 'bound_n', p: [(b.xWest + b.xEast) / 2, 5, b.zNorth - 2], s: [(b.xEast - b.xWest) / 2 + 4, 5, 2] },
    { id: 'bound_s', p: [(b.xWest + b.xEast) / 2, 5, b.zSouth + 2], s: [(b.xEast - b.xWest) / 2 + 4, 5, 2] },
  ];
  for (const bd of boundDefs) {
    boundParts.push(placed(mbox(bd.s[0] * 2, bd.s[1] * 2, bd.s[2] * 2), bd.p[0], bd.p[1], bd.p[2]));
    colliders.push({ id: bd.id, kind: 'box', position: bd.p, size: bd.s, yaw: 0, material: 'concrete' });
    navGeometry.push(navBox(bd.p, bd.s, 0));
  }
  for (const lm of def.landmarks) {
    const p: V3 = [lm.position[0], lm.position[1] + lm.size[1] / 2, lm.position[2]];
    const s: V3 = [lm.size[0] / 2, lm.size[1] / 2, lm.size[2] / 2];
    const g = mbox(lm.size[0], lm.size[1], lm.size[2]);
    const mesh = new Mesh(placed(g, p[0], p[1], p[2]), tex?.['plastered_wall_02'] ? createTexturedMaterial(tex['plastered_wall_02']!, { tileMeters: 2.6, tint: lm.color, grime: 0.6 }) : createPropMaterial(lm.color, 0.9));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `landmark_${lm.id}`;
    root.add(mesh);
    draws++;
    colliders.push({ id: `landmark_${lm.id}`, kind: 'box', position: p, size: s, yaw: 0, material: 'concrete' });
    navGeometry.push(navBox(p, s, 0));
    if (lm.sign) {
      const sw2 = Math.min(lm.size[0] * 0.8, 10);
      const sign = new Mesh(new BoxGeometry(sw2, 1.1, 0.12), new MeshStandardNodeMaterial({ map: makeSignTexture(lm.sign, 0x1b3a5c, sw2, 1.1), roughness: 0.7 }));
      sign.position.set(lm.position[0], lm.position[1] + lm.size[1] - 0.9, lm.position[2] + lm.size[2] / 2 + 0.07);
      root.add(sign);
      draws++;
    }
  }
  const boundGeo = mergeGeometries(boundParts, false);
  if (boundGeo) {
    const bm = new Mesh(boundGeo, wallMat);
    bm.name = 'bounds';
    bm.receiveShadow = true;
    bm.castShadow = true;
    root.add(bm);
    draws++;
  }

  // ---------- Prop glTF (CC0): instanced theo (model, primitive) → draw = số primitive của các model dùng, không phải số prop
  const poleParts: BufferGeometry[] = [];
  const byModel = new Map<string, Array<{ def: (typeof def.props)[number]; index: number }>>();
  def.props.forEach((pd, i) => {
    if (pd.model === 'pole') {
      // cột điện bê tông procedural: thân + xà ngang + sứ
      const yaw = pd.yaw ?? 0;
      poleParts.push(placed(new CylinderGeometry(0.11, 0.17, 8.2, 8), pd.position[0], 4.1, pd.position[2]));
      poleParts.push(placed(new BoxGeometry(1.6, 0.1, 0.1), pd.position[0], 7.4, pd.position[2], yaw));
      poleParts.push(placed(new BoxGeometry(1.2, 0.08, 0.08), pd.position[0], 6.9, pd.position[2], yaw));
      for (const k of [-0.65, 0, 0.65]) poleParts.push(placed(new CylinderGeometry(0.05, 0.06, 0.16, 6), pd.position[0] + Math.cos(yaw) * k, 7.55, pd.position[2] - Math.sin(yaw) * k));
      decor++;
      return;
    }
    let arr = byModel.get(pd.model);
    if (!arr) byModel.set(pd.model, (arr = []));
    arr.push({ def: pd, index: i });
  });
  if (poleParts.length) {
    const pg = mergeGeometries(poleParts, false);
    if (pg) {
      const pm = new Mesh(pg, createPropMaterial(0x8d8a82, 0.9));
      pm.name = 'poles';
      pm.castShadow = true;
      pm.receiveShadow = true;
      root.add(pm);
      draws++;
    }
  }
  if (assets?.models) {
    const M = assets.models;
    for (const [model, list] of byModel) {
      const src = M[model];
      if (!src) continue;
      draws += instanceModel(root, model, src, list.map((it) => ({ position: it.def.position, yaw: it.def.yaw ?? 0, pitch: it.def.pitch ?? 0, roll: it.def.roll ?? 0, scale: it.def.scale ?? 1, tint: it.def.tint ?? 1 })));
      props += list.length;
      for (const it of list) {
        const pd = it.def;
        if (!pd.collider) continue;
        const p: V3 = [pd.position[0], pd.position[1] + pd.collider[1], pd.position[2]];
        colliders.push({ id: `prop_${it.index}`, kind: 'box', position: p, size: pd.collider, yaw: pd.yaw ?? 0, material: 'wood' });
        navGeometry.push(navBox(p, pd.collider, pd.yaw ?? 0));
        if (pd.cover) {
          const yaw = pd.yaw ?? 0;
          const sn = Math.sin(yaw);
          const cs = Math.cos(yaw);
          const off = pd.collider[2] + 1.0;
          coverMarkers.push({ id: `prop_${it.index}_f`, position: [p[0] + sn * off, 0, p[2] + cs * off], facing: [-sn, 0, -cs] });
          coverMarkers.push({ id: `prop_${it.index}_b`, position: [p[0] - sn * off, 0, p[2] - cs * off], facing: [sn, 0, cs] });
        }
      }
    }
  }

  // ---------- Chướng ngại / xác xe (model thật khi có — TIP-021; collider/cover từ size)
  const bmats = createBarricadeMaterials(tex);
  const bar = buildBarricades(def.barricades, bmats, 5, { hasModel: (id) => !!assets?.models?.[id] });
  root.add(bar.group);
  draws += bar.draws;
  if (assets?.models) {
    const byBarModel = new Map<string, ModelInstance[]>();
    for (const mi of bar.modelInstances) {
      let arr = byBarModel.get(mi.model);
      if (!arr) byBarModel.set(mi.model, (arr = []));
      arr.push({ position: mi.position, yaw: mi.yaw, pitch: 0, roll: 0, scale: mi.scale, tint: mi.tint });
    }
    for (const [model, list] of byBarModel) {
      const src = assets.models[model];
      if (src) draws += instanceModel(root, `wreck_${model}`, src, list);
    }
    props += bar.modelInstances.length;
  }
  colliders.push(...bar.colliders);
  coverMarkers.push(...bar.coverMarkers);
  for (const nb of bar.navBoxes) navGeometry.push(navBox(nb.position, nb.size, nb.yaw));

  // ---------- FX khói lửa
  const fx = createAmbientFx(def.fx, { maxLights: opts.maxFxLights ?? 6 });
  root.add(fx.group);
  decor += def.fx.length;

  // dây điện chằng chịt giữa các cột (đường thẳng mỏng) — decor rẻ
  const wireMat = createPropMaterial(0x0c0c0c, 0.9);
  const wireParts: BufferGeometry[] = [];
  const poles = def.props.filter((p) => p.model === 'pole' || p.model === 'street_lamp_01').map((p) => p.position);
  for (let i = 0; i + 1 < poles.length; i++) {
    const a = poles[i]!;
    const c = poles[i + 1]!;
    const dx = c[0] - a[0];
    const dz = c[2] - a[2];
    const len = Math.hypot(dx, dz);
    if (len > 60) continue;
    for (let k = 0; k < 3; k++) {
      const g = new BoxGeometry(0.03, 0.03, len);
      const yaw = Math.atan2(dx, dz);
      wireParts.push(placed(g, (a[0] + c[0]) / 2, 7.2 - k * 0.35 - 0.4, (a[2] + c[2]) / 2, yaw));
    }
  }
  const wireGeo = wireParts.length ? mergeGeometries(wireParts, false) : null;
  if (wireGeo) {
    const wm = new Mesh(wireGeo, wireMat);
    wm.name = 'wires';
    wm.castShadow = false;
    root.add(wm);
    draws++;
    decor += wireParts.length;
  }

  const zones: ArenaData['zones'] = {};
  for (const [k, z] of Object.entries(def.zones)) zones[k] = { center: z.center, radius: z.radius };
  const data: LevelBuild = {
    size: Math.max(def.size[0], def.size[1]),
    colliders,
    navGeometry,
    waypoints: def.waypoints,
    coverMarkers,
    playerSpawn: def.playerSpawn,
    botSpawns: def.botSpawns,
    dummySpawns: [],
    zones,
    root,
    wetness: road.wetness,
    lamps: [],
    stats: { props, batchedDrawEstimate: draws, decor },
    def,
    fx,
    facadeDraws,
  };
  return data;
}
