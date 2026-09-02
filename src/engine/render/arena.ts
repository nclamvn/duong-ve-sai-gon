/**
 * Benchmark arena greybox (PRD §15 4–12h): ≥200 props batched, cover blocks, waypoints, spawn.
 * ArenaData là nguồn sự thật duy nhất cho physics colliders, navmesh geometry và AI markers.
 * "Xấu nhưng đo được."
 */
import {
  Scene, Mesh, BoxGeometry, CylinderGeometry, PlaneGeometry, BatchedMesh, InstancedMesh, Matrix4, Vector3, Euler, Quaternion,
  MeshStandardNodeMaterial, Group,
} from 'three/webgpu';
import { createWetGround, createPropMaterial } from './materials';
import { mulberry32, type Prng } from '@engine/core';

export type ColliderKind = 'box' | 'cylinder';

export interface ColliderDef {
  id: string;
  kind: ColliderKind;
  position: [number, number, number];
  /** box: half extents [hx,hy,hz]; cylinder: [radius, halfHeight, 0] */
  size: [number, number, number];
  yaw: number;
  material: 'concrete' | 'steel' | 'wood' | 'tarp';
}

export interface CoverMarker {
  id: string;
  position: [number, number, number];
  /** hướng mặt che (normal của tấm chắn), đơn vị */
  facing: [number, number, number];
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
  stats: { props: number; batchedDrawEstimate: number };
}

const SIZE = 120;
const WALL_H = 6;

function hashYaw(p: Prng): number {
  return p.int(0, 3) * (Math.PI / 2) + p.range(-0.05, 0.05);
}

export function buildArena(scene: Scene, seed = 7): ArenaData {
  const prng = mulberry32(seed).fork('arena');
  const root = new Group();
  root.name = 'arena';
  scene.add(root);
  const colliders: ColliderDef[] = [];
  const navGeometry: Mesh[] = [];

  // --- Sàn ướt
  const ground = createWetGround();
  const floor = new Mesh(new PlaneGeometry(SIZE, SIZE, 1, 1), ground.material);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.name = 'floor';
  root.add(floor);
  navGeometry.push(floor);
  colliders.push({ id: 'floor', kind: 'box', position: [0, -0.5, 0], size: [SIZE / 2, 0.5, SIZE / 2], yaw: 0, material: 'concrete' });

  // --- 4 tường
  const wallMat = createPropMaterial(0x59606a, 0.85);
  const wallDefs: Array<[number, number, number, number]> = [
    [0, WALL_H / 2, -SIZE / 2, 0],
    [0, WALL_H / 2, SIZE / 2, 0],
    [-SIZE / 2, WALL_H / 2, 0, Math.PI / 2],
    [SIZE / 2, WALL_H / 2, 0, Math.PI / 2],
  ];
  wallDefs.forEach(([x, y, z, yaw], i) => {
    const m = new Mesh(new BoxGeometry(SIZE, WALL_H, 1), wallMat);
    m.position.set(x, y, z);
    m.rotation.y = yaw;
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    navGeometry.push(m);
    colliders.push({ id: `wall_${i}`, kind: 'box', position: [x, y, z], size: [SIZE / 2, WALL_H / 2, 0.5], yaw, material: 'concrete' });
  });

  // --- Cover blocks (8) — container thấp, cũng là cover markers 4 mặt
  const coverMat = createPropMaterial(0x9c7440, 0.7);
  const coverMarkers: CoverMarker[] = [];
  const coverPositions: [number, number][] = [
    [-14, -10], [12, -14], [-20, 8], [18, 10], [0, -24], [-6, 18], [26, -4], [-28, -22],
  ];
  coverPositions.forEach(([x, z], i) => {
    const yaw = hashYaw(prng);
    const m = new Mesh(new BoxGeometry(6, 2.6, 2.4), coverMat);
    m.position.set(x, 1.3, z);
    m.rotation.y = yaw;
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    navGeometry.push(m);
    colliders.push({ id: `cover_${i}`, kind: 'box', position: [x, 1.3, z], size: [3, 1.3, 1.2], yaw, material: 'steel' });
    // 2 marker hai bên dài của container, lùi 1.2 m khỏi mặt
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

  // --- Props batched: 200 hộp/khối 3 kích thước, 1 material → BatchedMesh (draw call ≈ 1)
  const propMat = createPropMaterial(0x7d848d, 0.8);
  const geos = [new BoxGeometry(1, 1, 1), new BoxGeometry(1.6, 0.8, 1.2), new CylinderGeometry(0.5, 0.5, 1.2, 12)];
  const PROPS = 200;
  let maxV = 0;
  let maxI = 0;
  for (const g of geos) {
    maxV += g.attributes.position!.count;
    maxI += g.index ? g.index.count : g.attributes.position!.count;
  }
  const batched = new BatchedMesh(PROPS, maxV * 2, maxI * 2, propMat);
  batched.castShadow = true;
  batched.receiveShadow = true;
  batched.name = 'props_batched';
  const geoIds = geos.map((g) => batched.addGeometry(g));
  const mat4 = new Matrix4();
  const pos = new Vector3();
  const quat = new Quaternion();
  const scl = new Vector3(1, 1, 1);
  let placed = 0;
  let attempts = 0;
  while (placed < PROPS && attempts < PROPS * 20) {
    attempts++;
    const x = prng.range(-SIZE / 2 + 4, SIZE / 2 - 4);
    const z = prng.range(-SIZE / 2 + 4, SIZE / 2 - 4);
    // Chừa hành lang spawn và vùng giữa cho di chuyển
    if (Math.abs(x) < 4 && Math.abs(z) < 4) continue;
    if (Math.hypot(x - 0, z - 40) < 5) continue;
    if (Math.hypot(x - 0, z + 40) < 5) continue;
    const gi = prng.int(0, 2);
    const yaw = prng.range(0, Math.PI * 2);
    const s = prng.range(0.8, 1.6);
    pos.set(x, (gi === 2 ? 0.6 : gi === 1 ? 0.4 : 0.5) * s, z);
    quat.setFromEuler(new Euler(0, yaw, 0));
    scl.set(s, s, s);
    mat4.compose(pos, quat, scl);
    const id = batched.addInstance(geoIds[gi]!);
    batched.setMatrixAt(id, mat4);
    if (gi === 2) colliders.push({ id: `prop_${placed}`, kind: 'cylinder', position: [x, 0.6 * s, z], size: [0.5 * s, 0.6 * s, 0], yaw: 0, material: 'steel' });
    else if (gi === 1) colliders.push({ id: `prop_${placed}`, kind: 'box', position: [x, 0.4 * s, z], size: [0.8 * s, 0.4 * s, 0.6 * s], yaw, material: 'wood' });
    else colliders.push({ id: `prop_${placed}`, kind: 'box', position: [x, 0.5 * s, z], size: [0.5 * s, 0.5 * s, 0.5 * s], yaw, material: 'wood' });
    placed++;
  }
  root.add(batched);
  // Navmesh dùng mesh đơn giản thay cho batched: box collider → mesh thường (không render)
  // (BatchedMesh hiện chưa expose per-instance geometry tiện cho recast; dùng proxy)
  const proxyMat = new MeshStandardNodeMaterial({ visible: false });
  for (const c of colliders) {
    if (!c.id.startsWith('prop_')) continue;
    const g = c.kind === 'box' ? new BoxGeometry(c.size[0] * 2, c.size[1] * 2, c.size[2] * 2) : new CylinderGeometry(c.size[0], c.size[0], c.size[1] * 2, 8);
    const m = new Mesh(g, proxyMat);
    m.position.set(c.position[0], c.position[1], c.position[2]);
    m.rotation.y = c.yaw;
    m.visible = false;
    m.updateMatrixWorld(true);
    navGeometry.push(m);
  }

  // --- Thùng phuy instanced (60) — thêm 1 draw call, material riêng
  const drumGeo = new CylinderGeometry(0.3, 0.3, 0.9, 10);
  const drumMat = createPropMaterial(0x8a3b2f, 0.55);
  const drums = new InstancedMesh(drumGeo, drumMat, 60);
  drums.castShadow = true;
  drums.receiveShadow = true;
  for (let i = 0; i < 60; i++) {
    const x = prng.range(-50, 50);
    const z = prng.range(-50, 50);
    if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;
    pos.set(x, 0.45, z);
    quat.identity();
    scl.set(1, 1, 1);
    mat4.compose(pos, quat, scl);
    drums.setMatrixAt(i, mat4);
    colliders.push({ id: `drum_${i}`, kind: 'cylinder', position: [x, 0.45, z], size: [0.3, 0.45, 0], yaw: 0, material: 'steel' });
  }
  drums.instanceMatrix.needsUpdate = true;
  root.add(drums);

  // --- Waypoints tuần tra (12) vòng quanh arena
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
    stats: { props: placed + 60, batchedDrawEstimate: 2 },
  };
}
