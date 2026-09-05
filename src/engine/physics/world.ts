/**
 * PhysicsWorld — Rapier (ADR-002): fixed timestep 1/60, static colliders từ ArenaData, kinematic actor bodies,
 * ray query có layer mask + userData. Không điều khiển camera feel (PRD §3.2).
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { LAYER, colliderGroups, rayGroups } from './layers';

export type SurfaceMaterial = 'concrete' | 'steel' | 'wood' | 'tarp' | 'flesh' | 'earth';

export interface ColliderUserData {
  id: string;
  kind: 'world' | 'actor' | 'player' | 'trigger';
  material: SurfaceMaterial;
  /** actor: zone của collider (head/body) */
  zone?: 'head' | 'body';
  /** actor: id của actor sở hữu */
  actorId?: string;
  /** độ dày ước tính (m) cho penetration */
  thickness?: number;
}

export interface RayHit {
  toi: number;
  point: [number, number, number];
  normal: [number, number, number];
  colliderHandle: number;
  data: ColliderUserData | null;
}

export interface StaticShape {
  kind: 'box' | 'cylinder' | 'heightfield';
  position: [number, number, number];
  /** box: half extents; cylinder: [radius, halfHeight, 0]; heightfield: [sizeX, 1, sizeZ] (m, toàn chiều) */
  size: [number, number, number];
  yaw: number;
  /** heightfield (TIP-D04): cao độ n×n theo hàng (j = z, i = x; index j·n + i) — được chuyển sang column-major của Rapier */
  heights?: Float32Array;
  n?: number;
}

let initPromise: Promise<void> | null = null;
export function initPhysics(): Promise<void> {
  if (!initPromise) initPromise = RAPIER.init();
  return initPromise;
}

const V = (x: number, y: number, z: number): RAPIER.Vector3 => new RAPIER.Vector3(x, y, z);

export class PhysicsWorld {
  readonly world: RAPIER.World;
  private readonly userData = new Map<number, ColliderUserData>();
  private readonly scratchRay = new RAPIER.Ray(V(0, 0, 0), V(0, 0, -1));
  private readonly hitOut: RayHit = { toi: 0, point: [0, 0, 0], normal: [0, 1, 0], colliderHandle: -1, data: null };
  stepCount = 0;

  constructor(gravity = -9.81, timestep = 1 / 60) {
    this.world = new RAPIER.World(V(0, gravity, 0));
    this.world.timestep = timestep;
  }

  get R(): typeof RAPIER {
    return RAPIER;
  }

  addStatic(shape: StaticShape, data: ColliderUserData, layer: number = LAYER.WORLD): RAPIER.Collider {
    let desc: RAPIER.ColliderDesc;
    if (shape.kind === 'box') desc = RAPIER.ColliderDesc.cuboid(shape.size[0], shape.size[1], shape.size[2]);
    else if (shape.kind === 'heightfield') {
      // Rapier: ma trận (nrows+1)×(ncols+1) column-major; hàng ↔ z (từ −sizeZ/2), cột ↔ x (từ −sizeX/2) — kiểm bằng tests/unit/terrain.test.ts
      const n = shape.n ?? 0;
      const src = shape.heights;
      if (!src || n < 2 || src.length !== n * n) throw new Error(`heightfield ${data.id}: heights ${src?.length} ≠ n² (${n})`);
      const cm = new Float32Array(n * n);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) cm[i * n + j] = src[j * n + i]!;
      desc = RAPIER.ColliderDesc.heightfield(n - 1, n - 1, cm, V(shape.size[0], 1, shape.size[2]));
      if (data.thickness === undefined) data.thickness = 100;
    } else desc = RAPIER.ColliderDesc.cylinder(shape.size[1], shape.size[0]);
    desc.setTranslation(shape.position[0], shape.position[1], shape.position[2]);
    const half = shape.yaw / 2;
    desc.setRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) });
    desc.setCollisionGroups(colliderGroups(layer));
    const c = this.world.createCollider(desc);
    if (data.thickness === undefined) data.thickness = shape.kind === 'box' ? Math.min(shape.size[0], shape.size[2]) * 2 : shape.size[0] * 2;
    this.userData.set(c.handle, data);
    return c;
  }

  /** Kinematic position-based capsule (player/actor). Trả body + collider; caller đặt translation mỗi tick. */
  addKinematicCapsule(position: [number, number, number], halfHeight: number, radius: number, data: ColliderUserData, layer: number): { body: RAPIER.RigidBody; collider: RAPIER.Collider } {
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(position[0], position[1], position[2]);
    const body = this.world.createRigidBody(bodyDesc);
    const colDesc = RAPIER.ColliderDesc.capsule(halfHeight, radius).setCollisionGroups(colliderGroups(layer));
    const collider = this.world.createCollider(colDesc, body);
    this.userData.set(collider.handle, data);
    return { body, collider };
  }

  /** Sphere/ball collider gắn body (head zone). */
  addBallOnBody(body: RAPIER.RigidBody, offset: [number, number, number], radius: number, data: ColliderUserData, layer: number): RAPIER.Collider {
    const desc = RAPIER.ColliderDesc.ball(radius).setTranslation(offset[0], offset[1], offset[2]).setCollisionGroups(colliderGroups(layer));
    const c = this.world.createCollider(desc, body);
    this.userData.set(c.handle, data);
    return c;
  }

  removeCollider(c: RAPIER.Collider): void {
    this.userData.delete(c.handle);
    this.world.removeCollider(c, true);
  }

  removeBody(b: RAPIER.RigidBody): void {
    for (let i = 0; i < b.numColliders(); i++) this.userData.delete(b.collider(i).handle);
    this.world.removeRigidBody(b);
  }

  dataOf(handle: number): ColliderUserData | null {
    return this.userData.get(handle) ?? null;
  }

  step(): void {
    this.world.step();
    this.stepCount++;
  }

  /**
   * Ray cast với layer mask. `exclude` bỏ qua một collider (vd: chính người bắn).
   * Kết quả ghi vào object dùng lại — copy nếu cần giữ.
   */
  castRay(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxToi: number, hitMask: number, exclude?: RAPIER.Collider): RayHit | null {
    const r = this.scratchRay;
    r.origin.x = ox;
    r.origin.y = oy;
    r.origin.z = oz;
    r.dir.x = dx;
    r.dir.y = dy;
    r.dir.z = dz;
    const hit = this.world.castRayAndGetNormal(r, maxToi, true, undefined, rayGroups(hitMask), exclude);
    if (!hit) return null;
    const o = this.hitOut;
    o.toi = hit.timeOfImpact;
    o.point[0] = ox + dx * hit.timeOfImpact;
    o.point[1] = oy + dy * hit.timeOfImpact;
    o.point[2] = oz + dz * hit.timeOfImpact;
    o.normal[0] = hit.normal.x;
    o.normal[1] = hit.normal.y;
    o.normal[2] = hit.normal.z;
    o.colliderHandle = hit.collider.handle;
    o.data = this.userData.get(hit.collider.handle) ?? null;
    return o;
  }

  /** Line of sight: true nếu không có WORLD collider chắn giữa a và b. */
  hasLineOfSight(ax: number, ay: number, az: number, bx: number, by: number, bz: number, blockMask: number = LAYER.WORLD): boolean {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return true;
    const hit = this.castRay(ax, ay, az, dx / len, dy / len, dz / len, len, blockMask);
    return hit === null;
  }

  free(): void {
    this.world.free();
    this.userData.clear();
  }
}
