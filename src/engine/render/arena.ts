/**
 * Benchmark arena (PRD §15) — TIP-011: hình đại diện cảng Vạn Hải (container, crate, cuộn cáp, thùng phuy, cột đèn, prop CC0)
 * trên CÙNG bộ collider/waypoint/spawn của G0. ArenaData là nguồn sự thật duy nhất cho physics, navmesh và AI;
 * tests/unit/arena.test.ts khoá hash phần "sự thật" — visual đổi thoải mái, collider không.
 */
import {
  Scene, Mesh, BoxGeometry, CylinderGeometry, PlaneGeometry, InstancedMesh, Matrix4, Vector3, Euler, Quaternion, Group, Object3D,
  MeshStandardNodeMaterial, BufferGeometry, CanvasTexture, SRGBColorSpace, Color,
} from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createWetGround, createWetGroundProcedural, createPropMaterial, createTexturedMaterial, createEmissiveMaterial, type WetGroundMaterial } from './materials';
import { metricBox, containerParts, crate, palletStack, cableSpool, drum, lampPost } from './geometry';
import { mulberry32, type Prng } from '@engine/core';
import type { LoadedAssets } from './assets';

export type ColliderKind = 'box' | 'cylinder' | 'heightfield';

export interface ColliderDef {
  id: string;
  kind: ColliderKind;
  position: [number, number, number];
  /** box: half extents [hx,hy,hz]; cylinder: [radius, halfHeight, 0] */
  size: [number, number, number];
  yaw: number;
  material: 'concrete' | 'steel' | 'wood' | 'tarp' | 'earth';
  /** heightfield (TIP-D04): cao độ n×n (index j·n + i) — size = [sizeX, 1, sizeZ] */
  heights?: Float32Array;
  n?: number;
}

export interface CoverMarker {
  id: string;
  position: [number, number, number];
  /** hướng mặt che (normal của tấm chắn), đơn vị */
  facing: [number, number, number];
}

export interface LampDef {
  /** vị trí đầu đèn (world) */
  position: [number, number, number];
  /** hướng chiếu (đơn vị) */
  direction: [number, number, number];
  color: number;
  /** cd (SpotLight) — mặc định 2200 */
  intensity?: number;
  /** nửa góc nón (rad) — mặc định 0.7 */
  angle?: number;
}

export interface ArenaData {
  size: number;
  colliders: ColliderDef[];
  /** mesh dùng để bake navmesh (sàn + props lớn) */
  navGeometry: Mesh[];
  waypoints: [number, number, number][];
  coverMarkers: CoverMarker[];
  playerSpawn: [number, number, number];
  botSpawns: Record<string, [number, number, number]>;
  dummySpawns: [number, number, number][];
  zones: Record<string, { center: [number, number, number]; radius: number }>;
  root: Group;
  wetness: { value: number };
  /** đèn pha cảng (visual + SpotLight do lighting.ts tạo) */
  lamps: LampDef[];
  stats: { props: number; batchedDrawEstimate: number; decor: number };
}

export interface ArenaOptions {
  /** texture/model CC0 — null → material phẳng (unit test, sandbox lite) */
  assets?: LoadedAssets | null;
  /** chữ trên biển hiệu emissive (đã i18n ở lớp game) */
  signText?: string;
}

const SIZE = 120;
const WALL_H = 6;

function hashYaw(p: Prng): number {
  return p.int(0, 3) * (Math.PI / 2) + p.range(-0.05, 0.05);
}

const _m = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion();
const _s = new Vector3(1, 1, 1);

function worldGeo(g: BufferGeometry, x: number, y: number, z: number, yaw: number, scale = 1): BufferGeometry {
  _p.set(x, y, z);
  _q.setFromEuler(new Euler(0, yaw, 0));
  _s.setScalar(scale);
  _m.compose(_p, _q, _s);
  g.applyMatrix4(_m);
  return g;
}

function mergedMesh(parts: BufferGeometry[], material: MeshStandardNodeMaterial, name: string): Mesh | null {
  if (parts.length === 0) return null;
  const g = mergeGeometries(parts, false);
  if (!g) throw new Error(`merge failed: ${name}`);
  for (const p of parts) p.dispose();
  const m = new Mesh(g, material);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Biển hiệu: canvas → texture emissive (không literal VI ở đây — text đến từ i18n qua options). */
function makeSign(text: string, w: number, h: number): Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = Math.round((1024 * h) / w);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#07090c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#ffb454';
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
  ctx.fillStyle = '#ffc46a';
  ctx.font = `bold ${Math.round(canvas.height * 0.52)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  const mat = new MeshStandardNodeMaterial({ color: 0x000000, roughness: 0.6, emissiveMap: tex, emissive: new Color(0xffffff), emissiveIntensity: 2.6 });
  const m = new Mesh(new BoxGeometry(w, h, 0.08), mat);
  m.name = 'sign';
  return m;
}

export function buildArena(scene: Scene, seed = 7, opts: ArenaOptions = {}): ArenaData {
  const assets = opts.assets ?? null;
  const tex = assets?.textures ?? null;
  const prng = mulberry32(seed).fork('arena');
  const root = new Group();
  root.name = 'arena';
  scene.add(root);
  const colliders: ColliderDef[] = [];
  const navGeometry: Mesh[] = [];
  let decor = 0;

  // ---------- Vật liệu (texture CC0 nếu có; fallback phẳng cho test/lite)
  const ground: WetGroundMaterial = tex ? createWetGround(tex['asphalt_02']!, SIZE) : createWetGroundProcedural();
  const wallMat = tex ? createTexturedMaterial(tex['corrugated_iron_02']!, { tileMeters: 1.6, tint: 0x5a6570, roughnessScale: 0.95, metalness: 0.3, rust: { tex: tex['rusty_metal_02']!, amount: 0.3 } }) : createPropMaterial(0x59606a, 0.85);
  const steelMat = tex ? createTexturedMaterial(tex['metal_plate']!, { tileMeters: 1.0, tint: 0x2a2d31, roughnessScale: 0.9, metalness: 0.6 }) : createPropMaterial(0x24272b, 0.5);
  const containerTints = [0x8a3a2a, 0x2f4f7a, 0x3f5a3a, 0x6e6a5a];
  const containerMats = containerTints.map((t) =>
    tex ? createTexturedMaterial(tex['corrugated_iron_02']!, { tileMeters: 1.2, tint: t, roughnessScale: 0.95, metalness: 0.35, rust: { tex: tex['rusty_metal_02']!, amount: 0.4 } }) : createPropMaterial(t, 0.7),
  );
  const woodMat = tex ? createTexturedMaterial(tex['plywood']!, { tileMeters: 1.6, tint: 0xb9a98a, roughnessScale: 1.0 }) : createPropMaterial(0x7d848d, 0.8);
  const cableMat = createPropMaterial(0x141516, 0.85);
  const drumMat = tex ? createTexturedMaterial(tex['rusty_painted_metal']!, { tileMeters: 1.0, roughnessScale: 0.9, metalness: 0.3, rust: { tex: tex['rusty_metal_02']!, amount: 0.5 } }) : createPropMaterial(0x8a3b2f, 0.55);
  const poleMat = tex ? createTexturedMaterial(tex['metal_plate']!, { tileMeters: 1.0, tint: 0x3a3d40, roughnessScale: 0.8, metalness: 0.7 }) : createPropMaterial(0x33363a, 0.5);

  // ---------- Sàn ướt
  const floor = new Mesh(new PlaneGeometry(SIZE, SIZE, 1, 1), ground.material);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.name = 'floor';
  root.add(floor);
  navGeometry.push(floor);
  colliders.push({ id: 'floor', kind: 'box', position: [0, -0.5, 0], size: [SIZE / 2, 0.5, SIZE / 2], yaw: 0, material: 'concrete' });

  // ---------- 4 tường bao (tôn nhà xưởng) — nav proxy giữ box đơn giản
  const wallDefs: Array<[number, number, number, number]> = [
    [0, WALL_H / 2, -SIZE / 2, 0],
    [0, WALL_H / 2, SIZE / 2, 0],
    [-SIZE / 2, WALL_H / 2, 0, Math.PI / 2],
    [SIZE / 2, WALL_H / 2, 0, Math.PI / 2],
  ];
  const wallParts: BufferGeometry[] = [];
  wallDefs.forEach(([x, y, z, yaw], i) => {
    wallParts.push(worldGeo(metricBox(SIZE, WALL_H, 1), x, y, z, yaw));
    // gờ bê tông chân tường
    wallParts.push(worldGeo(metricBox(SIZE, 0.5, 1.3), x, 0.25, z, yaw));
    const proxy = new Mesh(new BoxGeometry(SIZE, WALL_H, 1));
    proxy.position.set(x, y, z);
    proxy.rotation.y = yaw;
    proxy.visible = false;
    proxy.updateMatrixWorld(true);
    navGeometry.push(proxy);
    colliders.push({ id: `wall_${i}`, kind: 'box', position: [x, y, z], size: [SIZE / 2, WALL_H / 2, 0.5], yaw, material: 'concrete' });
  });
  const walls = mergedMesh(wallParts, wallMat, 'walls')!;
  root.add(walls);

  // ---------- Cover blocks (8) → container 20 ft; collider box 6×2.6×2.4 giữ nguyên
  const coverMarkers: CoverMarker[] = [];
  const coverPositions: [number, number][] = [
    [-14, -10], [12, -14], [-20, 8], [18, 10], [0, -24], [-6, 18], [26, -4], [-28, -22],
  ];
  const shellParts: BufferGeometry[][] = containerTints.map(() => []);
  const frameParts: BufferGeometry[] = [];
  const containerPoses: { x: number; z: number; yaw: number }[] = [];
  coverPositions.forEach(([x, z], i) => {
    const yaw = hashYaw(prng);
    const parts = containerParts(6, 2.6, 2.4);
    shellParts[i % containerTints.length]!.push(worldGeo(parts.shell, x, 1.3, z, yaw));
    frameParts.push(worldGeo(parts.frame, x, 1.3, z, yaw));
    containerPoses.push({ x, z, yaw });
    const proxy = new Mesh(new BoxGeometry(6, 2.6, 2.4));
    proxy.position.set(x, 1.3, z);
    proxy.rotation.y = yaw;
    proxy.visible = false;
    proxy.updateMatrixWorld(true);
    navGeometry.push(proxy);
    colliders.push({ id: `cover_${i}`, kind: 'box', position: [x, 1.3, z], size: [3, 1.3, 1.2], yaw, material: 'steel' });
    const q = new Quaternion().setFromEuler(new Euler(0, yaw, 0));
    for (const side of [1, -1]) {
      const n = new Vector3(0, 0, side).applyQuaternion(q);
      coverMarkers.push({
        id: `cm_${i}_${side > 0 ? 'a' : 'b'}`,
        position: [x + n.x * 2.4, 0, z + n.z * 2.4],
        facing: [-n.x, 0, -n.z],
      });
    }
  });
  shellParts.forEach((parts, k) => {
    const m = mergedMesh(parts, containerMats[k]!, `containers_${k}`);
    if (m) root.add(m);
  });
  root.add(mergedMesh(frameParts, steelMat, 'container_frames')!);

  // ---------- Props (200): crate / pallet+crate / cuộn cáp — collider y hệt G0 (cùng chuỗi prng)
  const PROPS = 200;
  const woodParts: BufferGeometry[] = [];
  const cableParts: BufferGeometry[] = [];
  let placed = 0;
  let attempts = 0;
  while (placed < PROPS && attempts < PROPS * 20) {
    attempts++;
    const x = prng.range(-SIZE / 2 + 4, SIZE / 2 - 4);
    const z = prng.range(-SIZE / 2 + 4, SIZE / 2 - 4);
    if (Math.abs(x) < 4 && Math.abs(z) < 4) continue;
    if (Math.hypot(x - 0, z - 40) < 5) continue;
    if (Math.hypot(x - 0, z + 40) < 5) continue;
    const gi = prng.int(0, 2);
    const yaw = prng.range(0, Math.PI * 2);
    const s = prng.range(0.8, 1.6);
    const y = (gi === 2 ? 0.6 : gi === 1 ? 0.4 : 0.5) * s;
    if (gi === 2) {
      const sp = cableSpool(0.5 * s, 1.2 * s);
      woodParts.push(worldGeo(sp.wood, x, y, z, yaw));
      cableParts.push(worldGeo(sp.cable, x, y, z, yaw));
      colliders.push({ id: `prop_${placed}`, kind: 'cylinder', position: [x, 0.6 * s, z], size: [0.5 * s, 0.6 * s, 0], yaw: 0, material: 'steel' });
    } else if (gi === 1) {
      woodParts.push(worldGeo(palletStack(1.6 * s, 0.8 * s, 1.2 * s), x, y, z, yaw));
      colliders.push({ id: `prop_${placed}`, kind: 'box', position: [x, 0.4 * s, z], size: [0.8 * s, 0.4 * s, 0.6 * s], yaw, material: 'wood' });
    } else {
      woodParts.push(worldGeo(crate(s, s, s), x, y, z, yaw));
      colliders.push({ id: `prop_${placed}`, kind: 'box', position: [x, 0.5 * s, z], size: [0.5 * s, 0.5 * s, 0.5 * s], yaw, material: 'wood' });
    }
    placed++;
  }
  root.add(mergedMesh(woodParts, woodMat, 'props_wood')!);
  root.add(mergedMesh(cableParts, cableMat, 'props_cable')!);
  // Navmesh proxy cho props (box/cylinder đơn giản, không render) — như G0
  for (const c of colliders) {
    if (!c.id.startsWith('prop_')) continue;
    const g = c.kind === 'box' ? new BoxGeometry(c.size[0] * 2, c.size[1] * 2, c.size[2] * 2) : new CylinderGeometry(c.size[0], c.size[0], c.size[1] * 2, 8);
    const m = new Mesh(g);
    m.position.set(c.position[0], c.position[1], c.position[2]);
    m.rotation.y = c.yaw;
    m.visible = false;
    m.updateMatrixWorld(true);
    navGeometry.push(m);
  }

  // ---------- Thùng phuy instanced (60) — cùng chuỗi prng như G0
  const drums = new InstancedMesh(drum(0.3, 0.9), drumMat, 60);
  drums.castShadow = true;
  drums.receiveShadow = true;
  drums.name = 'drums';
  const mat4 = new Matrix4();
  const pos = new Vector3();
  const quat = new Quaternion();
  const scl = new Vector3(1, 1, 1);
  for (let i = 0; i < 60; i++) {
    const x = prng.range(-50, 50);
    const z = prng.range(-50, 50);
    if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;
    pos.set(x, 0.45, z);
    quat.setFromEuler(new Euler(0, (i * 0.7) % Math.PI, 0));
    scl.set(1, 1, 1);
    mat4.compose(pos, quat, scl);
    drums.setMatrixAt(i, mat4);
    colliders.push({ id: `drum_${i}`, kind: 'cylinder', position: [x, 0.45, z], size: [0.3, 0.45, 0], yaw: 0, material: 'steel' });
  }
  drums.instanceMatrix.needsUpdate = true;
  root.add(drums);

  // ---------- Trang trí không collider (prng riêng — không đụng chuỗi G0)
  const deco = mulberry32(seed).fork('arena-deco');
  // Cột đèn pha natri: 6 cột sát tường, tay đèn hướng vào trong
  const lamps: LampDef[] = [];
  const lampSpots: [number, number, number][] = [
    [-58.6, -38, 0], [-58.6, 22, 0], [58.6, -18, Math.PI], [58.6, 42, Math.PI], [-22, -58.6, -Math.PI / 2], [30, 58.6, Math.PI / 2],
  ];
  const poleParts: BufferGeometry[] = [];
  const headParts: BufferGeometry[] = [];
  const lampHead = createEmissiveMaterial(0xffb060, 14.0);
  for (const [x, z, yaw] of lampSpots) {
    const lp = lampPost(8, 2.6);
    poleParts.push(worldGeo(lp.pole, x, 0, z, yaw));
    headParts.push(worldGeo(lp.head, x, 0, z, yaw));
    const hx = x + Math.cos(yaw) * lp.headLocal[0];
    const hz = z - Math.sin(yaw) * lp.headLocal[0];
    lamps.push({ position: [hx, lp.headLocal[1], hz], direction: [Math.cos(yaw) * 0.25, -1, -Math.sin(yaw) * 0.25], color: 0xffb060 });
    decor++;
  }
  // Đèn pha gắn nóc container (4 cái, chiếu vào giữa bãi) — không collider (trên nóc)
  for (let k = 0; k < containerPoses.length; k += 2) {
    const c = containerPoses[k]!;
    const toCenter = Math.atan2(-c.x, -c.z);
    const bx = c.x + Math.sin(toCenter) * 0.6;
    const bz = c.z + Math.cos(toCenter) * 0.6;
    poleParts.push(worldGeo(new BoxGeometry(0.12, 0.9, 0.12), bx, 2.6 + 0.45, bz, 0));
    headParts.push(worldGeo(new BoxGeometry(0.5, 0.28, 0.3), bx, 3.55, bz, -toCenter));
    lamps.push({ position: [bx, 3.45, bz], direction: [Math.sin(toCenter) * 0.9, -0.45, Math.cos(toCenter) * 0.9], color: 0xfff1d0, intensity: 260, angle: 0.5 });
    decor++;
  }
  root.add(mergedMesh(poleParts, poleMat, 'lamp_poles')!);
  root.add(mergedMesh(headParts, lampHead, 'lamp_heads')!);

  // Biển hiệu cảng trên tường bắc (z = −60) — text từ game (i18n)
  if (opts.signText && typeof document !== 'undefined') {
    const sign = makeSign(opts.signText, 14, 1.8);
    sign.position.set(6, 4.4, -SIZE / 2 + 0.55);
    root.add(sign);
    decor++;
  }

  // Prop CC0 (glTF): trên nóc container + sát chân tường (không collider — ngoài tầm đi lại)
  if (assets?.models) {
    const M = assets.models;
    const pick = (ids: string[]): Object3D | null => {
      const id = ids[deco.int(0, ids.length - 1)]!;
      const src = M[id];
      return src ? src.clone(true) : null;
    };
    const put = (o: Object3D | null, x: number, y: number, z: number, yaw: number, scale = 1): void => {
      if (!o) return;
      o.position.set(x, y, z);
      o.rotation.y = yaw;
      o.scale.setScalar(scale);
      root.add(o);
      decor++;
    };
    // nóc container: 1–2 crate/box/bình gas
    for (const c of containerPoses) {
      const n = 1 + deco.int(0, 1);
      for (let k = 0; k < n; k++) {
        const along = deco.range(-2.2, 2.2);
        const across = deco.range(-0.6, 0.6);
        const x = c.x + Math.cos(c.yaw) * along + Math.sin(c.yaw) * across;
        const z = c.z - Math.sin(c.yaw) * along + Math.cos(c.yaw) * across;
        put(pick(['wooden_military_crate', 'old_military_crate', 'cardboard_box_01', 'propane_tank', 'plastic_crate_01']), x, 2.6, z, c.yaw + deco.range(-0.4, 0.4));
      }
    }
    // chân tường: jersey barrier, tủ điện, máy phát, thùng rác (tâm lún vào tường ~0.3 m → không cản lối)
    const wallLine: Array<{ x: number; z: number; yaw: number }> = [];
    for (let i = 0; i < 14; i++) wallLine.push({ x: -52 + i * 8, z: -59.15, yaw: 0 });
    for (let i = 0; i < 14; i++) wallLine.push({ x: -52 + i * 8, z: 59.15, yaw: Math.PI });
    for (let i = 0; i < 12; i++) wallLine.push({ x: -59.15, z: -48 + i * 8, yaw: Math.PI / 2 });
    for (let i = 0; i < 12; i++) wallLine.push({ x: 59.15, z: -48 + i * 8, yaw: -Math.PI / 2 });
    for (const w of wallLine) {
      const r = deco.next();
      if (r < 0.45) put(pick(['concrete_road_barrier']), w.x, 0, w.z, w.yaw);
      else if (r < 0.6) put(pick(['utility_box_01']), w.x, 0, w.z, w.yaw);
      else if (r < 0.7) put(pick(['portable_generator']), w.x, 0, w.z, w.yaw + Math.PI / 2);
      else if (r < 0.85) put(pick(['metal_trash_can']), w.x, 0, w.z, w.yaw);
      // còn lại: để trống cho nhịp thị giác
    }
  }

  // ---------- Waypoints tuần tra (12) vòng quanh arena
  const waypoints: [number, number, number][] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    waypoints.push([Math.cos(a) * 34, 0, Math.sin(a) * 34]);
  }

  const dummySpawns: [number, number, number][] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    dummySpawns.push([Math.cos(a) * 12, 0, Math.sin(a) * 12]);
  }

  return {
    size: SIZE,
    colliders,
    navGeometry,
    waypoints,
    coverMarkers,
    playerSpawn: [0, 0, 40],
    botSpawns: { bot_a: [0, 0, -40], bot_b: [24, 0, -30] },
    dummySpawns,
    zones: { relay_zone: { center: [0, 0, -20], radius: 8 } },
    root,
    wetness: ground.wetness,
    lamps,
    stats: { props: placed + 60, batchedDrawEstimate: 8, decor },
  };
}
