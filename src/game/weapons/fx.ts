/**
 * Weapon FX (PRD WPN-004, VFX-001): decal, casing, muzzle, tracer — tất cả pool/InstancedMesh, không `new` sau warm-up.
 * Lắng nghe event từ EventBus (weapons không spawn trực tiếp). Cập nhật ở render (visual only).
 */
import { InstancedMesh, PlaneGeometry, BoxGeometry, MeshBasicNodeMaterial, Matrix4, Vector3, Quaternion, Object3D, Scene, DoubleSide, Mesh, type PerspectiveCamera } from 'three/webgpu';
import type { EventBus, Prng } from '@engine/core';
import type { WeaponEvents } from './weapon';

interface Casing {
  pos: Vector3;
  vel: Vector3;
  life: number;
  rot: number;
}

interface Tracer {
  life: number;
}

export interface FxStats {
  decalsPlaced: number;
  decalWraps: number;
  casingsActive: number;
  tracersActive: number;
  /** số object được tạo (phải cố định sau constructor) */
  created: number;
}

const _m = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion();
const _s = new Vector3(1, 1, 1);
const _n = new Vector3();
const _up = new Vector3(0, 1, 0);
const _dummy = new Object3D();
const _fwd = new Vector3(0, 0, 1);
const _tmp = new Vector3();

export class WeaponFx {
  readonly decals: InstancedMesh;
  readonly casings: InstancedMesh;
  readonly tracers: InstancedMesh;
  readonly muzzle: Mesh;
  private decalHead = 0;
  private readonly casingPool: Casing[] = [];
  private readonly tracerPool: Tracer[] = [];
  private casingHead = 0;
  private tracerHead = 0;
  private muzzleLife = 0;
  readonly stats: FxStats = { decalsPlaced: 0, decalWraps: 0, casingsActive: 0, tracersActive: 0, created: 0 };
  private readonly gravity = new Vector3(0, -9.81, 0);
  private readonly unsub: Array<() => void> = [];

  constructor(
    scene: Scene,
    private readonly camera: PerspectiveCamera,
    events: EventBus<WeaponEvents>,
    private readonly prng: Prng,
    readonly capacity = { decals: 256, casings: 64, tracers: 16 },
  ) {
    const decalMat = new MeshBasicNodeMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, side: DoubleSide });
    this.decals = new InstancedMesh(new PlaneGeometry(0.14, 0.14), decalMat, capacity.decals);
    this.decals.frustumCulled = false;
    this.decals.count = 0;
    scene.add(this.decals);

    const casingMat = new MeshBasicNodeMaterial({ color: 0xc9a24a });
    this.casings = new InstancedMesh(new BoxGeometry(0.012, 0.012, 0.03), casingMat, capacity.casings);
    this.casings.frustumCulled = false;
    this.casings.count = 0;
    scene.add(this.casings);
    for (let i = 0; i < capacity.casings; i++) {
      this.casingPool.push({ pos: new Vector3(), vel: new Vector3(), life: 0, rot: 0 });
      this.stats.created++;
    }

    const tracerMat = new MeshBasicNodeMaterial({ color: 0xffd28a, transparent: true, opacity: 0.6, depthWrite: false });
    this.tracers = new InstancedMesh(new BoxGeometry(0.02, 0.02, 1), tracerMat, capacity.tracers);
    this.tracers.frustumCulled = false;
    this.tracers.count = 0;
    scene.add(this.tracers);
    for (let i = 0; i < capacity.tracers; i++) {
      this.tracerPool.push({ life: 0 });
      this.stats.created++;
    }

    const muzzleMat = new MeshBasicNodeMaterial({ color: 0xffc36b, transparent: true, opacity: 0.9, depthWrite: false, side: DoubleSide });
    this.muzzle = new Mesh(new PlaneGeometry(0.18, 0.18), muzzleMat);
    this.muzzle.position.set(0.22, -0.16, -0.7);
    this.muzzle.visible = false;
    camera.add(this.muzzle);
    this.stats.created += 4;

    this.unsub.push(events.on('IMPACT', (e) => this.placeDecal(e.point, e.normal)));
    this.unsub.push(events.on('WEAPON_FIRED', (e) => this.onShot(e.origin, e.dir)));
    this.unsub.push(events.on('HIT', (e) => this.placeDecal(e.point, [0, 1, 0], true)));
  }

  private placeDecal(point: [number, number, number], normal: [number, number, number], blood = false): void {
    const i = this.decalHead;
    this.decalHead = (this.decalHead + 1) % this.capacity.decals;
    if (this.decals.count < this.capacity.decals) this.decals.count++;
    else if (i === 0) this.stats.decalWraps++;
    _n.set(normal[0], normal[1], normal[2]).normalize();
    _p.set(point[0], point[1], point[2]).addScaledVector(_n, 0.01);
    // plane mặc định hướng +z → xoay tới normal
    _q.setFromUnitVectors(_fwd, _n);
    const sc = blood ? 0.2 : 0.7 + this.prng.next() * 0.6;
    _s.set(sc, sc, sc);
    _m.compose(_p, _q, _s);
    this.decals.setMatrixAt(i, _m);
    this.decals.instanceMatrix.needsUpdate = true;
    this.stats.decalsPlaced++;
  }

  private onShot(origin: [number, number, number], dir: [number, number, number]): void {
    this.muzzleLife = 0.045;
    this.muzzle.visible = true;
    this.muzzle.rotation.z = this.prng.next() * Math.PI;
    const sc = 0.8 + this.prng.next() * 0.6;
    this.muzzle.scale.set(sc, sc, 1);
    // casing: từ bên phải camera, bay phải-lên rồi rơi
    const c = this.casingPool[this.casingHead]!;
    this.casingHead = (this.casingHead + 1) % this.capacity.casings;
    _p.set(origin[0], origin[1] - 0.1, origin[2]);
    c.pos.copy(_p);
    _n.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    c.vel.copy(_n).multiplyScalar(1.5 + this.prng.next()).add(_tmp.copy(_up).multiplyScalar(1.2 + this.prng.next() * 0.5));
    c.life = 1.4;
    c.rot = this.prng.next() * 6;
    // tracer
    const t = this.tracerPool[this.tracerHead]!;
    const ti = this.tracerHead;
    this.tracerHead = (this.tracerHead + 1) % this.capacity.tracers;
    t.life = 0.06;
    const len = 40;
    _p.set(origin[0] + dir[0] * (len / 2 + 1), origin[1] + dir[1] * (len / 2 + 1) - 0.12, origin[2] + dir[2] * (len / 2 + 1));
    _q.setFromUnitVectors(_fwd, _n.set(dir[0], dir[1], dir[2]));
    _s.set(1, 1, len);
    _m.compose(_p, _q, _s);
    this.tracers.setMatrixAt(ti, _m);
    this.tracers.count = this.capacity.tracers;
  }

  /** Render-side update (dt giây). */
  update(dt: number): void {
    if (this.muzzleLife > 0) {
      this.muzzleLife -= dt;
      if (this.muzzleLife <= 0) this.muzzle.visible = false;
    }
    let active = 0;
    for (let i = 0; i < this.casingPool.length; i++) {
      const c = this.casingPool[i]!;
      if (c.life <= 0) {
        _s.set(0, 0, 0);
        _m.compose(_p.set(0, -100, 0), _q.identity(), _s);
        this.casings.setMatrixAt(i, _m);
        continue;
      }
      c.life -= dt;
      c.vel.addScaledVector(this.gravity, dt);
      c.pos.addScaledVector(c.vel, dt);
      if (c.pos.y < 0.01) {
        c.pos.y = 0.01;
        c.vel.set(0, 0, 0);
      }
      c.rot += dt * 12;
      _dummy.position.copy(c.pos);
      _dummy.rotation.set(c.rot, c.rot * 0.7, 0);
      _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix();
      this.casings.setMatrixAt(i, _dummy.matrix);
      active++;
    }
    this.casings.count = this.capacity.casings;
    this.casings.instanceMatrix.needsUpdate = true;
    this.stats.casingsActive = active;
    let ta = 0;
    for (let i = 0; i < this.tracerPool.length; i++) {
      const t = this.tracerPool[i]!;
      if (t.life <= 0) continue;
      t.life -= dt;
      if (t.life <= 0) {
        _s.set(0, 0, 0);
        _m.compose(_p.set(0, -100, 0), _q.identity(), _s);
        this.tracers.setMatrixAt(i, _m);
      } else ta++;
    }
    this.tracers.instanceMatrix.needsUpdate = true;
    this.stats.tracersActive = ta;
  }

  reset(): void {
    this.decals.count = 0;
    this.decalHead = 0;
    for (const c of this.casingPool) c.life = 0;
    for (const t of this.tracerPool) t.life = 0;
    this.muzzle.visible = false;
    this.stats.decalsPlaced = 0;
    this.stats.decalWraps = 0;
  }

  dispose(): void {
    for (const u of this.unsub) u();
  }
}
