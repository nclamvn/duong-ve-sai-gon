/**
 * Weapon FX (PRD WPN-004, VFX-001 · TIP-010): decal, casing, tracer mảnh bay, muzzle flash + spark + đèn nòng.
 * Tất cả pool/InstancedMesh — không `new` sau constructor. Lắng nghe event (weapons không spawn trực tiếp).
 * Đèn nòng LUÔN ở trong scene (intensity 0 khi nghỉ) để số đèn không đổi → không recompile shader (hitch).
 */
import {
  InstancedMesh, PlaneGeometry, BoxGeometry, MeshBasicNodeMaterial, MeshStandardNodeMaterial, Matrix4, Vector3, Quaternion, Object3D, Scene, DoubleSide,
  PointLight, AdditiveBlending, Color, BufferGeometry, Float32BufferAttribute, InstancedBufferAttribute, type PerspectiveCamera, type Node,
} from 'three/webgpu';
import { texture, uv, vec2, vec3, vec4, float, floor, hash, instanceIndex, time, attribute, mix } from 'three/tsl';
import type { EventBus, Prng } from '@engine/core';
import type { WeaponEvents } from './weapon';
import { makeFlashFlipbook, makeSoftPuff, makeBulletHole, FLIPBOOK_N } from './fxTextures';

interface Casing {
  pos: Vector3;
  vel: Vector3;
  life: number;
  rot: number;
}
interface Tracer {
  life: number;
  origin: Vector3;
  dir: Vector3;
  maxDist: number;
}
interface Spark {
  pos: Vector3;
  vel: Vector3;
  life: number;
  maxLife: number;
}
interface Puff {
  pos: Vector3;
  vel: Vector3;
  life: number;
  maxLife: number;
  size0: number;
  size1: number;
  alpha: number;
  spin: number;
}

export interface FxStats {
  decalsPlaced: number;
  decalWraps: number;
  casingsActive: number;
  tracersActive: number;
  sparksActive: number;
  puffsActive: number;
  /** số object được tạo (phải cố định sau constructor) */
  created: number;
  shots: number;
  explosions: number;
}

const _m = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion();
const _q2 = new Quaternion();
const _s = new Vector3(1, 1, 1);
const _n = new Vector3();
const _up = new Vector3(0, 1, 0);
const _dummy = new Object3D();
const _fwd = new Vector3(0, 0, 1);
const _tmp = new Vector3();
const HIDDEN = new Matrix4().makeScale(0, 0, 0);
/** đèn nòng: decay 1 (tuyến tính) để súng sát đèn không cháy trắng mà sàn 3–5 m vẫn ánh cam (TIP-011) */
const MUZZLE_LIGHT = 3.5;
const TRACER_SPEED = 320; // m/s (hình ảnh)
const TRACER_LEN = 5;

export class WeaponFx {
  readonly decals: InstancedMesh;
  readonly casings: InstancedMesh;
  readonly tracers: InstancedMesh;
  readonly sparks: InstancedMesh;
  readonly flashes: InstancedMesh;
  readonly puffs: InstancedMesh;
  readonly muzzleLight: PointLight;
  /** đèn nòng cho phát bắn của địch (TIP-014) — 1 đèn dùng chung, luôn trong scene */
  readonly botLight: PointLight;
  private readonly puffPool: Puff[] = [];
  private readonly puffAlpha: InstancedBufferAttribute;
  private readonly decalKind: InstancedBufferAttribute;
  private puffHead = 0;
  private decalHead = 0;
  private readonly casingPool: Casing[] = [];
  private readonly tracerPool: Tracer[] = [];
  private readonly sparkPool: Spark[] = [];
  private readonly flashLife: Float32Array;
  private casingHead = 0;
  private tracerHead = 0;
  private sparkHead = 0;
  private flashHead = 0;
  private lightLife = 0;
  private botLightLife = 0;
  readonly stats: FxStats = { decalsPlaced: 0, decalWraps: 0, casingsActive: 0, tracersActive: 0, sparksActive: 0, puffsActive: 0, created: 0, shots: 0, explosions: 0 };
  private readonly gravity = new Vector3(0, -9.81, 0);
  private readonly unsub: Array<() => void> = [];
  /** vị trí đầu nòng của player (viewmodel) — Game gán */
  muzzleWorld: Vector3 | null = null;
  /** cửa thoát vỏ đạn (viewmodel) — Game gán */
  ejectWorld: Vector3 | null = null;
  /** đầu nòng súng của bot (world) — Game gán (TIP-014); false → ước lượng từ mắt */
  botMuzzle: ((botId: string, out: Vector3) => boolean) | null = null;

  constructor(
    scene: Scene,
    private readonly camera: PerspectiveCamera,
    events: EventBus<WeaponEvents>,
    private readonly prng: Prng,
    readonly capacity = { decals: 256, casings: 64, tracers: 24, sparks: 96, flashes: 6, puffs: 40 },
  ) {
    // Decal: lỗ đạn procedural (texture canvas) · kind 1 = máu (tint đỏ thẫm)
    const holeTex = makeBulletHole();
    const decalMat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, side: DoubleSide });
    const kindNode = attribute('decalKind', 'float') as unknown as Node<'float'>;
    const holeSample = texture(holeTex, uv());
    decalMat.colorNode = vec4(mix(holeSample.rgb, vec3(0.16, 0.02, 0.02), kindNode), 1.0);
    decalMat.opacityNode = holeSample.a.mul(mix(float(0.92), float(0.75), kindNode));
    const decalGeo = new PlaneGeometry(0.14, 0.14);
    this.decals = new InstancedMesh(decalGeo, decalMat, capacity.decals);
    this.decalKind = new InstancedBufferAttribute(new Float32Array(capacity.decals), 1);
    decalGeo.setAttribute('decalKind', this.decalKind);
    this.decals.frustumCulled = false;
    this.decals.count = 0;
    scene.add(this.decals);

    const casingMat = new MeshStandardNodeMaterial({ color: 0xc9a24a, roughness: 0.32, metalness: 0.95 });
    this.casings = new InstancedMesh(new BoxGeometry(0.007, 0.007, 0.02), casingMat, capacity.casings);
    this.casings.frustumCulled = false;
    scene.add(this.casings);
    for (let i = 0; i < capacity.casings; i++) {
      this.casingPool.push({ pos: new Vector3(), vel: new Vector3(), life: 0, rot: 0 });
      this.casings.setMatrixAt(i, HIDDEN);
      this.stats.created++;
    }

    // Tracer: vệt mảnh 0.006 m, dài 5 m, additive, bay 320 m/s và mờ dần
    const tracerMat = new MeshBasicNodeMaterial({ color: new Color(1.3, 0.95, 0.5), transparent: true, opacity: 0.55, depthWrite: false, blending: AdditiveBlending });
    this.tracers = new InstancedMesh(new BoxGeometry(0.006, 0.006, 1), tracerMat, capacity.tracers);
    this.tracers.frustumCulled = false;
    scene.add(this.tracers);
    for (let i = 0; i < capacity.tracers; i++) {
      this.tracerPool.push({ life: 0, origin: new Vector3(), dir: new Vector3(), maxDist: 0 });
      this.tracers.setMatrixAt(i, HIDDEN);
      this.stats.created++;
    }

    // Spark: hạt lửa nhỏ, additive, gravity, life 0.12–0.22 s
    const sparkMat = new MeshBasicNodeMaterial({ color: new Color(1.5, 0.85, 0.3), transparent: true, opacity: 0.9, depthWrite: false, blending: AdditiveBlending });
    this.sparks = new InstancedMesh(new BoxGeometry(0.008, 0.008, 0.05), sparkMat, capacity.sparks);
    this.sparks.frustumCulled = false;
    scene.add(this.sparks);
    for (let i = 0; i < capacity.sparks; i++) {
      this.sparkPool.push({ pos: new Vector3(), vel: new Vector3(), life: 0, maxLife: 0.15 });
      this.sparks.setMatrixAt(i, HIDDEN);
      this.stats.created++;
    }

    // Muzzle flash (TIP-013): flipbook 4×4 procedural — 1 đĩa vuông góc nòng + 1 cánh dọc nòng; frame ngẫu nhiên mỗi frame (nhấp nháy)
    const flip = makeFlashFlipbook();
    const flashMat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
    const frame = floor(hash(float(instanceIndex).add(floor(time.mul(90.0)).mul(7.0))).mul(FLIPBOOK_N * FLIPBOOK_N));
    const fx = frame.mod(FLIPBOOK_N);
    const fy = floor(frame.div(FLIPBOOK_N));
    const fuv = uv().div(FLIPBOOK_N).add(vec2(fx, fy).div(FLIPBOOK_N));
    const flipSample = texture(flip, fuv);
    flashMat.colorNode = vec4(flipSample.rgb.mul(vec3(1.5, 1.2, 0.9)), 1.0);
    flashMat.opacityNode = flipSample.a.mul(0.85);
    const star = mergePlanes([
      new PlaneGeometry(0.26, 0.26).translate(0, 0, 0.04), // đĩa (nhìn từ phía sau nòng vẫn thấy)
      new PlaneGeometry(0.3, 0.2).rotateY(Math.PI / 2).translate(0, 0.02, 0.1), // cánh dọc nòng (nhìn ngang)
    ]);
    this.flashes = new InstancedMesh(star, flashMat, capacity.flashes);
    this.flashes.frustumCulled = false;
    this.flashLife = new Float32Array(capacity.flashes);
    for (let i = 0; i < capacity.flashes; i++) this.flashes.setMatrixAt(i, HIDDEN);
    scene.add(this.flashes);

    // Khói/bụi mềm (TIP-013): quad billboard (CPU xoay theo camera), alpha per-instance, texture puff procedural
    const puffTex = makeSoftPuff();
    const puffMat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide });
    const puffSample = texture(puffTex, uv());
    puffMat.colorNode = vec4(vec3(0.62, 0.6, 0.56).mul(puffSample.rgb), 1.0);
    puffMat.opacityNode = puffSample.a.mul(attribute('puffAlpha', 'float') as unknown as Node<'float'>);
    const puffGeo = new PlaneGeometry(1, 1);
    this.puffAlpha = new InstancedBufferAttribute(new Float32Array(capacity.puffs), 1);
    puffGeo.setAttribute('puffAlpha', this.puffAlpha);
    this.puffs = new InstancedMesh(puffGeo, puffMat, capacity.puffs);
    this.puffs.frustumCulled = false;
    this.puffs.renderOrder = 4;
    for (let i = 0; i < capacity.puffs; i++) {
      this.puffPool.push({ pos: new Vector3(), vel: new Vector3(), life: 0, maxLife: 0.5, size0: 0.1, size1: 0.4, alpha: 0.3, spin: 0 });
      this.puffs.setMatrixAt(i, HIDDEN);
      this.stats.created++;
    }
    scene.add(this.puffs);

    this.muzzleLight = new PointLight(0xffb060, 0, 7, 1.0);
    this.muzzleLight.castShadow = false;
    scene.add(this.muzzleLight);
    this.botLight = new PointLight(0xffb060, 0, 6, 1.0);
    this.botLight.castShadow = false;
    scene.add(this.botLight);
    this.stats.created += 6;

    this.unsub.push(
      events.on('IMPACT', (e) => {
        this.placeDecal(e.point, e.normal);
        _p.set(e.point[0], e.point[1], e.point[2]);
        _n.set(e.normal[0], e.normal[1], e.normal[2]);
        // đất (terrain, TIP-D10): bụi nhiều, to, tối hơn, không tia lửa; thép: tia lửa
        if (e.material === 'earth') this.spawnPuffs(_p, _n, 5, 0.12, 0.6, 0.5, 0.7, 0.7);
        else this.spawnPuffs(_p, _n, 3, 0.09, 0.42, 0.42, 0.55, 0.9);
        if (e.material === 'steel' || e.material === 'metal') this.spawnSparks(_p, _n, 6);
      }),
    );
    this.unsub.push(events.on('WEAPON_FIRED', (e) => this.onPlayerShot(e.origin, e.dir)));
    this.unsub.push(events.on('HIT', (e) => this.placeDecal(e.point, [0, 1, 0], true)));
    this.unsub.push(events.on('RELOAD_START', () => undefined));
    this.unsub.push(
      (events as unknown as EventBus<{ BOT_FIRED: { botId: string; origin: [number, number, number]; dir: [number, number, number] } }>).on('BOT_FIRED', (e) => {
        _n.set(e.dir[0], e.dir[1], e.dir[2]);
        // đầu nòng thật từ súng của bot (TIP-014); không có → mắt + 0.6 m theo hướng bắn, thấp hơn 0.15 m
        if (!(this.botMuzzle && this.botMuzzle(e.botId, _p))) {
          _p.set(e.origin[0] + e.dir[0] * 0.6, e.origin[1] + e.dir[1] * 0.6 - 0.15, e.origin[2] + e.dir[2] * 0.6);
        }
        this.spawnFlash(_p, _n, 0.8);
        this.spawnSparks(_p, _n, 5);
        this.spawnTracer(_p, _n, 60);
        this.spawnPuffs(_p, _n, 1, 0.06, 0.28, 0.2, 0.6, 1.4);
        this.botLight.position.copy(_p);
        this.botLight.intensity = MUZZLE_LIGHT * 0.8;
        this.botLightLife = 0.05;
      }),
    );
  }

  private placeDecal(point: [number, number, number], normal: [number, number, number], blood = false): void {
    const i = this.decalHead;
    this.decalHead = (this.decalHead + 1) % this.capacity.decals;
    if (this.decals.count < this.capacity.decals) this.decals.count++;
    else if (i === 0) this.stats.decalWraps++;
    _n.set(normal[0], normal[1], normal[2]).normalize();
    _p.set(point[0], point[1], point[2]).addScaledVector(_n, 0.01);
    _q.setFromUnitVectors(_fwd, _n);
    const sc = blood ? 0.2 : 0.7 + this.prng.next() * 0.6;
    _s.set(sc, sc, sc);
    _m.compose(_p, _q, _s);
    this.decals.setMatrixAt(i, _m);
    this.decals.instanceMatrix.needsUpdate = true;
    this.decalKind.setX(i, blood ? 1 : 0);
    this.decalKind.needsUpdate = true;
    this.stats.decalsPlaced++;
  }

  private onPlayerShot(origin: [number, number, number], dir: [number, number, number]): void {
    this.stats.shots++;
    _n.set(dir[0], dir[1], dir[2]);
    // đầu nòng: từ viewmodel nếu có, không thì từ mắt + 0.5 m
    if (this.muzzleWorld) _p.copy(this.muzzleWorld);
    else _p.set(origin[0] + dir[0] * 0.5, origin[1] + dir[1] * 0.5 - 0.1, origin[2] + dir[2] * 0.5);
    this.spawnFlash(_p, _n, 0.7);
    this.spawnSparks(_p, _n, 8);
    this.spawnTracer(_p, _n, 80);
    this.spawnPuffs(_p, _n, 2, 0.06, 0.32, 0.22, 0.7, 1.6);
    this.muzzleLight.position.copy(_p);
    this.muzzleLight.intensity = MUZZLE_LIGHT;
    this.lightLife = 0.05;
    // casing: từ bên phải camera, bay phải-lên rồi rơi
    const c = this.casingPool[this.casingHead]!;
    this.casingHead = (this.casingHead + 1) % this.capacity.casings;
    // cửa thoát vỏ đạn: bên phải receiver của viewmodel (camera-local), bay phải-lên-hơi lùi
    if (this.ejectWorld) c.pos.copy(this.ejectWorld);
    else c.pos.copy(_tmp.set(0.24, -0.16, -0.36).applyQuaternion(this.camera.quaternion).add(this.camera.position));
    _tmp.set(1, 0.15, 0.25).applyQuaternion(this.camera.quaternion);
    c.vel.copy(_tmp).multiplyScalar(1.6 + this.prng.next()).addScaledVector(_up, 1.0 + this.prng.next() * 0.5);
    c.life = 1.4;
    c.rot = this.prng.next() * 6;
  }

  private spawnFlash(pos: Vector3, dir: Vector3, scale: number): void {
    const i = this.flashHead;
    this.flashHead = (this.flashHead + 1) % this.capacity.flashes;
    this.flashLife[i] = 0.035;
    // +z của geometry ↔ hướng bắn, rồi xoay ngẫu nhiên quanh nòng
    _q.setFromUnitVectors(_fwd, dir);
    _q2.setFromAxisAngle(dir, this.prng.next() * Math.PI * 2);
    _q.premultiply(_q2);
    const sc = scale * (0.8 + this.prng.next() * 0.5);
    _s.set(sc, sc, sc);
    _m.compose(pos, _q, _s);
    this.flashes.setMatrixAt(i, _m);
    this.flashes.instanceMatrix.needsUpdate = true;
  }

  /**
   * Nổ (bộc phá/lựu đạn — M2 R1): chớp lớn + tia lửa toả cầu + khói đen bốc lên + ánh sáng cam 0,25 s (dùng botLight — đèn thứ hai).
   * `radius` (m) chỉ đổi kích thước khói; sát thương do game tính.
   */
  explosion(position: [number, number, number], radius = 5): void {
    _p.set(position[0], position[1] + 0.3, position[2]);
    _n.set(0, 1, 0);
    this.spawnFlash(_p, _n, 3.5 + radius * 0.3);
    for (let k = 0; k < 5; k++) {
      _tmp.set(this.prng.next() - 0.5, 0.35 + this.prng.next() * 0.6, this.prng.next() - 0.5).normalize();
      this.spawnSparks(_p, _tmp, 9);
    }
    this.spawnPuffs(_p, _n, 14, 0.6 + radius * 0.12, 2.4 + radius * 0.45, 0.7, 2.6 + radius * 0.15, 3.5);
    _tmp.set(0.4, 0.35, 0.2).normalize();
    this.spawnPuffs(_p, _tmp, 6, 0.5, 1.6 + radius * 0.2, 0.45, 1.6, 4.5);
    _tmp.set(-0.4, 0.35, -0.2).normalize();
    this.spawnPuffs(_p, _tmp, 6, 0.5, 1.6 + radius * 0.2, 0.45, 1.6, 4.5);
    this.botLight.position.copy(_p).addScaledVector(_up, 1.2);
    this.botLight.intensity = MUZZLE_LIGHT * 6;
    this.botLight.distance = 10 + radius * 2;
    this.botLightLife = 0.25;
    this.stats.explosions++;
  }

  private spawnSparks(pos: Vector3, dir: Vector3, n: number): void {
    for (let k = 0; k < n; k++) {
      const s = this.sparkPool[this.sparkHead]!;
      this.sparkHead = (this.sparkHead + 1) % this.capacity.sparks;
      s.pos.copy(pos);
      // nón ±35° quanh hướng bắn + tỏa ngang
      s.vel.set((this.prng.next() - 0.5) * 2, (this.prng.next() - 0.5) * 2, (this.prng.next() - 0.5) * 2).normalize().multiplyScalar(0.7).add(dir).normalize().multiplyScalar(6 + this.prng.next() * 9);
      s.maxLife = 0.12 + this.prng.next() * 0.1;
      s.life = s.maxLife;
    }
  }

  private spawnTracer(pos: Vector3, dir: Vector3, maxDist: number): void {
    const t = this.tracerPool[this.tracerHead]!;
    this.tracerHead = (this.tracerHead + 1) % this.capacity.tracers;
    t.origin.copy(pos);
    t.dir.copy(dir);
    t.maxDist = maxDist;
    t.life = 0;
  }

  /** Khói/bụi: n quad tại pos, bay theo dir (+ tỏa), nở size0→size1, mờ dần. */
  private spawnPuffs(pos: Vector3, dir: Vector3, n: number, size0: number, size1: number, alpha: number, life: number, speed: number): void {
    for (let k = 0; k < n; k++) {
      const q = this.puffPool[this.puffHead]!;
      this.puffHead = (this.puffHead + 1) % this.capacity.puffs;
      q.pos.copy(pos).addScaledVector(dir, 0.02 + k * 0.04);
      q.vel.set((this.prng.next() - 0.5) * 0.8, 0.25 + this.prng.next() * 0.35, (this.prng.next() - 0.5) * 0.8).addScaledVector(dir, speed * (0.5 + this.prng.next() * 0.5));
      q.maxLife = life * (0.8 + this.prng.next() * 0.4);
      q.life = q.maxLife;
      q.size0 = size0 * (0.8 + this.prng.next() * 0.4);
      q.size1 = size1 * (0.8 + this.prng.next() * 0.5);
      q.alpha = alpha;
      q.spin = (this.prng.next() - 0.5) * 2.0;
    }
  }

  /** Render-side update (dt giây). */
  update(dt: number): void {
    // đèn nòng
    if (this.lightLife > 0) {
      this.lightLife -= dt;
      this.muzzleLight.intensity = Math.max(0, MUZZLE_LIGHT * (this.lightLife / 0.05));
      if (this.lightLife <= 0) this.muzzleLight.intensity = 0;
    }
    if (this.botLightLife > 0) {
      this.botLightLife -= dt;
      this.botLight.intensity = Math.max(0, MUZZLE_LIGHT * 0.8 * (this.botLightLife / 0.05));
      if (this.botLightLife <= 0) this.botLight.intensity = 0;
    }
    // flash
    let anyFlash = false;
    for (let i = 0; i < this.capacity.flashes; i++) {
      if (this.flashLife[i]! <= 0) continue;
      this.flashLife[i] = this.flashLife[i]! - dt;
      if (this.flashLife[i]! <= 0) {
        this.flashes.setMatrixAt(i, HIDDEN);
        anyFlash = true;
      }
    }
    if (anyFlash) this.flashes.instanceMatrix.needsUpdate = true;
    // casing
    let active = 0;
    for (let i = 0; i < this.casingPool.length; i++) {
      const c = this.casingPool[i]!;
      if (c.life <= 0) continue;
      c.life -= dt;
      if (c.life <= 0) {
        this.casings.setMatrixAt(i, HIDDEN);
        continue;
      }
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
    this.casings.instanceMatrix.needsUpdate = true;
    this.stats.casingsActive = active;
    // tracer: đoạn 5 m bay dọc dir, mờ dần theo quãng
    let ta = 0;
    for (let i = 0; i < this.tracerPool.length; i++) {
      const t = this.tracerPool[i]!;
      if (t.maxDist <= 0) continue;
      t.life += dt;
      const head = t.life * TRACER_SPEED;
      if (head - TRACER_LEN > t.maxDist) {
        t.maxDist = 0;
        this.tracers.setMatrixAt(i, HIDDEN);
        continue;
      }
      const tail = Math.max(0, head - TRACER_LEN);
      const len = Math.max(0.05, Math.min(head, t.maxDist) - tail);
      _p.copy(t.origin).addScaledVector(t.dir, tail + len / 2);
      _q.setFromUnitVectors(_fwd, t.dir);
      _s.set(1, 1, len);
      _m.compose(_p, _q, _s);
      this.tracers.setMatrixAt(i, _m);
      ta++;
    }
    this.tracers.instanceMatrix.needsUpdate = true;
    this.stats.tracersActive = ta;
    // sparks
    let sa = 0;
    for (let i = 0; i < this.sparkPool.length; i++) {
      const s = this.sparkPool[i]!;
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) {
        this.sparks.setMatrixAt(i, HIDDEN);
        continue;
      }
      s.vel.addScaledVector(this.gravity, dt * 1.5);
      s.vel.multiplyScalar(1 - dt * 3.5);
      s.pos.addScaledVector(s.vel, dt);
      const k = s.life / s.maxLife;
      _n.copy(s.vel).normalize();
      _q.setFromUnitVectors(_fwd, _n);
      _s.set(k, k, 0.6 + k);
      _m.compose(s.pos, _q, _s);
      this.sparks.setMatrixAt(i, _m);
      sa++;
    }
    this.sparks.instanceMatrix.needsUpdate = true;
    this.stats.sparksActive = sa;
    // puffs: billboard theo camera, nở + mờ, chậm dần
    let pa = 0;
    for (let i = 0; i < this.puffPool.length; i++) {
      const q = this.puffPool[i]!;
      if (q.life <= 0) continue;
      q.life -= dt;
      if (q.life <= 0) {
        this.puffs.setMatrixAt(i, HIDDEN);
        this.puffAlpha.setX(i, 0);
        continue;
      }
      const u = 1 - q.life / q.maxLife;
      q.vel.multiplyScalar(1 - dt * 2.2);
      q.pos.addScaledVector(q.vel, dt);
      const size = q.size0 + (q.size1 - q.size0) * Math.sqrt(u);
      _q.copy(this.camera.quaternion);
      _q2.setFromAxisAngle(_fwd, q.spin * u);
      _q.multiply(_q2);
      _s.set(size, size, size);
      _m.compose(q.pos, _q, _s);
      this.puffs.setMatrixAt(i, _m);
      this.puffAlpha.setX(i, q.alpha * (1 - u) * Math.min(1, u * 6));
      pa++;
    }
    this.puffs.instanceMatrix.needsUpdate = true;
    this.puffAlpha.needsUpdate = true;
    this.stats.puffsActive = pa;
  }

  reset(): void {
    this.decals.count = 0;
    this.decalHead = 0;
    for (let i = 0; i < this.casingPool.length; i++) {
      this.casingPool[i]!.life = 0;
      this.casings.setMatrixAt(i, HIDDEN);
    }
    for (let i = 0; i < this.tracerPool.length; i++) {
      this.tracerPool[i]!.maxDist = 0;
      this.tracers.setMatrixAt(i, HIDDEN);
    }
    for (let i = 0; i < this.sparkPool.length; i++) {
      this.sparkPool[i]!.life = 0;
      this.sparks.setMatrixAt(i, HIDDEN);
    }
    for (let i = 0; i < this.capacity.flashes; i++) {
      this.flashLife[i] = 0;
      this.flashes.setMatrixAt(i, HIDDEN);
    }
    for (let i = 0; i < this.puffPool.length; i++) {
      this.puffPool[i]!.life = 0;
      this.puffs.setMatrixAt(i, HIDDEN);
      this.puffAlpha.setX(i, 0);
    }
    this.puffs.instanceMatrix.needsUpdate = true;
    this.puffAlpha.needsUpdate = true;
    this.casings.instanceMatrix.needsUpdate = true;
    this.tracers.instanceMatrix.needsUpdate = true;
    this.sparks.instanceMatrix.needsUpdate = true;
    this.flashes.instanceMatrix.needsUpdate = true;
    this.muzzleLight.intensity = 0;
    this.lightLife = 0;
    this.botLight.intensity = 0;
    this.botLightLife = 0;
    this.stats.decalsPlaced = 0;
    this.stats.decalWraps = 0;
    this.stats.shots = 0;
  }

  dispose(): void {
    for (const u of this.unsub) u();
  }
}

/** Gộp nhiều PlaneGeometry (non-indexed) thành một BufferGeometry — không kéo BufferGeometryUtils vào FX. */
function mergePlanes(planes: PlaneGeometry[]): BufferGeometry {
  const parts = planes.map((p) => p.toNonIndexed());
  const cat = (name: string, size: number): Float32BufferAttribute => {
    const arrays = parts.map((g) => g.attributes[name]!.array as Float32Array);
    const out = new Float32Array(arrays.reduce((a, b) => a + b.length, 0));
    let off = 0;
    for (const a of arrays) {
      out.set(a, off);
      off += a.length;
    }
    return new Float32BufferAttribute(out, size);
  };
  const out = new BufferGeometry();
  out.setAttribute('position', cat('position', 3));
  out.setAttribute('normal', cat('normal', 3));
  out.setAttribute('uv', cat('uv', 2));
  for (const g of parts) g.dispose();
  for (const p of planes) p.dispose();
  return out;
}
