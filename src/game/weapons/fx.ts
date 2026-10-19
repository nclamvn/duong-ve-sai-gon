/**
 * Weapon FX (PRD WPN-004, VFX-001 · TIP-010): decal, casing, tracer mảnh bay, muzzle flash + spark + đèn nòng.
 * Tất cả pool/InstancedMesh — không `new` sau constructor. Lắng nghe event (weapons không spawn trực tiếp).
 * Đèn nòng LUÔN ở trong scene (intensity 0 khi nghỉ) để số đèn không đổi → không recompile shader (hitch).
 */
import {
  InstancedMesh, PlaneGeometry, BoxGeometry, MeshBasicNodeMaterial, MeshStandardNodeMaterial, Matrix4, Vector3, Quaternion, Object3D, Scene, DoubleSide,
  PointLight, AdditiveBlending, Color, BufferGeometry, Float32BufferAttribute, InstancedBufferAttribute, type PerspectiveCamera, type Node,
} from 'three/webgpu';
import { texture, uv, vec2, vec3, vec4, float, floor, attribute, mix, length, smoothstep } from 'three/tsl';
import type { EventBus, Prng } from '@engine/core';
import type { WeaponEvents } from './weapon';
import { makeMuzzleAtlas, makeSoftPuff, makeBulletHole } from './fxTextures';

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
  /** độ dày (×) */
  width: number;
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
/** đèn nòng: decay 1 (tuyến tính) để súng sát đèn không cháy trắng mà sàn 3–5 m vẫn ánh cam (TIP-011); DV-087 mạnh hơn, xa hơn */
const MUZZLE_LIGHT = 12; // DV-090: 7 → 12, soi sáng cây lá quanh mình mỗi phát
/** thời gian sống của một chớp lửa nòng (s): ~3 khung 60 Hz, khung đầu to nhất rồi co và nguội */
const FLASH_LIFE = 0.07; // DV-090: 0,055 → 0,07 (~4 khung ở 60 fps, mắt kịp thấy)
/** khói nòng (DV-087): nhiệt tích theo phát bắn, nguội theo giây; nóng quá ngưỡng thì nòng toả khói mảnh sau loạt bắn */
const HEAT_PER_SHOT = 1;
const HEAT_COOL = 0.9;
const HEAT_SMOKE = 3;
const TRACER_SPEED = 320; // m/s (hình ảnh)
const TRACER_LEN = 5;
/** màu bụi theo vật liệu (DV-075) */
const TINT = { smoke: [0.62, 0.6, 0.56], earth: [0.72, 0.4, 0.26], wood: [0.78, 0.62, 0.42], blast: [0.52, 0.4, 0.32], barrel: [0.7, 0.71, 0.74] } as const satisfies Record<string, readonly [number, number, number]>;
/** màu vệt đạn theo phe (HDR, additive) */
const TRACER = { player: [1.3, 0.95, 0.5], enemy: [1.9, 0.55, 0.25], friend: [0.55, 1.7, 0.5] } as const satisfies Record<string, readonly [number, number, number]>;

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
  private readonly puffTint: InstancedBufferAttribute;
  private readonly tracerTint: InstancedBufferAttribute;
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
  /** cường độ đỉnh của chớp đèn nòng hiện tại (đổi theo phát) */
  private lightPeak = MUZZLE_LIGHT;
  private readonly flashAge: InstancedBufferAttribute;
  private readonly flashSeed: InstancedBufferAttribute;
  private readonly flashScale: Float32Array;
  /** DV-090 quầng sáng quanh đầu nòng (sprite hướng camera, cùng chỉ số với chớp) */
  private readonly glows: InstancedMesh;
  private readonly glowAge: InstancedBufferAttribute;
  /** nhiệt nòng (DV-087) và thời điểm phát bắn gần nhất (giây, đồng hồ FX) */
  private heat = 0;
  private clock = 0;
  private lastShotAt = -1;
  private wispAcc = 0;
  /** ô chớp lửa của phát bắn gần nhất của người chơi (bám đầu nòng khi súng giật) */
  private playerFlash = -1;
  readonly stats: FxStats = { decalsPlaced: 0, decalWraps: 0, casingsActive: 0, tracersActive: 0, sparksActive: 0, puffsActive: 0, created: 0, shots: 0, explosions: 0 };
  private readonly gravity = new Vector3(0, -9.81, 0);
  /** màu bụi cho lần spawnPuffs kế tiếp */
  private tint: readonly [number, number, number] = TINT.smoke;
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
    readonly capacity = { decals: 256, casings: 64, tracers: 32, sparks: 128, flashes: 16, puffs: 128 },
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
    // màu theo phe (DV-075, điện ảnh): người chơi vàng ấm, địch đỏ cam, tổ ta xanh lục — đọc được hướng hoả lực
    const tracerMat = new MeshBasicNodeMaterial({ transparent: true, opacity: 0.7, depthWrite: false, blending: AdditiveBlending });
    tracerMat.colorNode = vec4(attribute('tracerTint', 'vec3') as unknown as Node<'vec3'>, 1.0);
    const tracerGeo = new BoxGeometry(0.006, 0.006, 1);
    this.tracerTint = new InstancedBufferAttribute(new Float32Array(capacity.tracers * 3).fill(1), 3);
    tracerGeo.setAttribute('tracerTint', this.tracerTint);
    this.tracers = new InstancedMesh(tracerGeo, tracerMat, capacity.tracers);
    this.tracers.frustumCulled = false;
    scene.add(this.tracers);
    for (let i = 0; i < capacity.tracers; i++) {
      this.tracerPool.push({ life: 0, origin: new Vector3(), dir: new Vector3(), maxDist: 0, width: 1 });
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

    // Lửa nòng (DV-087, thay flipbook TIP-013): atlas 4×4 ô 256 px — 8 dáng nhìn trước (sao nhiều cánh không đều, lõi trắng nóng)
    // + 8 dáng nhìn ngang (chùm lửa loe, đĩa sốc, luồng phụ của bộ hãm). Hình: 1 đĩa vuông góc nòng + 3 tấm dọc nòng xoay 60° quanh
    // trục nòng (nhìn từ góc nào cũng thấy chùm lửa có khối). Mỗi phát chọn dáng theo hạt giống instance; sống ~3 khung: khung đầu
    // to và trắng nhất, rồi co lại, nguội về cam đỏ (tuổi qua thuộc tính instance). Màu HDR để bloom loé.
    const atlas = makeMuzzleAtlas();
    const flashMat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
    const kind = attribute('flashKind', 'float') as unknown as Node<'float'>;
    const age = attribute('flashAge', 'float') as unknown as Node<'float'>;
    // dáng theo hạt giống của phát bắn (gán lúc sinh) — mỗi phát một dáng, không lặp theo thứ tự ô
    const variant = floor((attribute('flashSeed', 'float') as unknown as Node<'float'>).mul(7.999));
    const cellX = variant.mod(4);
    const cellY = floor(variant.div(4)).add(kind.mul(2));
    const fuv = uv().div(4).add(vec2(cellX, float(3).sub(cellY)).div(4));
    const flashSample = texture(atlas, fuv);
    const glow = float(1).sub(age).pow(1.6);
    // nguội: khung đầu trắng vàng, sau đó ngả cam đỏ
    // DV-090: sáng hơn ~1,6 lần để bloom loé thành quầng (Chủ nhà: lửa nòng chưa đã mắt)
    const warm = mix(vec3(4.2, 2.7, 1.2), vec3(2.6, 1.0, 0.3), age);
    flashMat.colorNode = vec4(flashSample.rgb.mul(warm).mul(glow), 1.0);
    flashMat.opacityNode = flashSample.a.mul(glow);
    flashMat.fog = false;
    const sideLen = 0.42;
    const sidePlane = (roll: number): PlaneGeometry => {
      const g = new PlaneGeometry(sideLen, 0.24).translate(sideLen / 2, 0, 0).rotateY(-Math.PI / 2).rotateZ(roll);
      return g;
    };
    const parts = [new PlaneGeometry(0.24, 0.24).translate(0, 0, 0.02), sidePlane(0), sidePlane(Math.PI / 3), sidePlane((2 * Math.PI) / 3)];
    const kinds = [0, 1, 1, 1];
    const star = mergePlanes(parts);
    const kindArr = new Float32Array(star.attributes.position!.count);
    let vo = 0;
    for (let k = 0; k < kinds.length; k++) {
      const n = 6; // mỗi tấm không chỉ số = 6 đỉnh
      kindArr.fill(kinds[k]!, vo, vo + n);
      vo += n;
    }
    star.setAttribute('flashKind', new Float32BufferAttribute(kindArr, 1));
    this.flashAge = new InstancedBufferAttribute(new Float32Array(capacity.flashes).fill(1), 1);
    star.setAttribute('flashAge', this.flashAge);
    this.flashSeed = new InstancedBufferAttribute(new Float32Array(capacity.flashes), 1);
    star.setAttribute('flashSeed', this.flashSeed);
    this.flashes = new InstancedMesh(star, flashMat, capacity.flashes);
    this.flashes.frustumCulled = false;
    this.flashes.renderOrder = 6;
    this.flashLife = new Float32Array(capacity.flashes);
    this.flashScale = new Float32Array(capacity.flashes);
    for (let i = 0; i < capacity.flashes; i++) this.flashes.setMatrixAt(i, HIDDEN);
    scene.add(this.flashes);
    // DV-090 quầng: không khí nóng sáng quanh đầu nòng (đĩa mềm to gấp ~4 chớp, cam ấm, tắt nhanh hơn chớp) — cho bloom ăn
    const glowMat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
    glowMat.fog = false;
    const gAge = attribute('glowAge', 'float') as unknown as Node<'float'>;
    const gr = length(uv().sub(0.5)).mul(2);
    const gFall = smoothstep(float(0), float(1), gr).oneMinus();
    const gCore = smoothstep(float(0), float(0.35), gr).oneMinus();
    const gK = float(1).sub(gAge).pow(2.2);
    glowMat.colorNode = vec4(mix(vec3(1.1, 0.45, 0.12), vec3(2.2, 1.3, 0.55), gCore).mul(gFall.mul(gFall).mul(0.35).add(gCore.mul(0.6))).mul(gK), 1.0);
    glowMat.opacityNode = gFall.mul(gK);
    const glowGeo = new PlaneGeometry(1, 1);
    this.glowAge = new InstancedBufferAttribute(new Float32Array(capacity.flashes).fill(1), 1);
    glowGeo.setAttribute('glowAge', this.glowAge);
    this.glows = new InstancedMesh(glowGeo, glowMat, capacity.flashes);
    this.glows.frustumCulled = false;
    this.glows.renderOrder = 7;
    for (let i = 0; i < capacity.flashes; i++) this.glows.setMatrixAt(i, HIDDEN);
    scene.add(this.glows);

    // Khói/bụi mềm (TIP-013): quad billboard (CPU xoay theo camera), alpha per-instance, texture puff procedural
    const puffTex = makeSoftPuff();
    const puffMat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide });
    const puffSample = texture(puffTex, uv());
    // màu bụi theo vật liệu (DV-075): đất đỏ bazan, dăm gỗ, khói xám
    puffMat.colorNode = vec4((attribute('puffTint', 'vec3') as unknown as Node<'vec3'>).mul(puffSample.rgb), 1.0);
    puffMat.opacityNode = puffSample.a.mul(attribute('puffAlpha', 'float') as unknown as Node<'float'>);
    const puffGeo = new PlaneGeometry(1, 1);
    this.puffAlpha = new InstancedBufferAttribute(new Float32Array(capacity.puffs), 1);
    puffGeo.setAttribute('puffAlpha', this.puffAlpha);
    this.puffTint = new InstancedBufferAttribute(new Float32Array(capacity.puffs * 3), 3);
    for (let i = 0; i < capacity.puffs; i++) this.puffTint.setXYZ(i, 0.62, 0.6, 0.56);
    puffGeo.setAttribute('puffTint', this.puffTint);
    this.puffs = new InstancedMesh(puffGeo, puffMat, capacity.puffs);
    this.puffs.frustumCulled = false;
    this.puffs.renderOrder = 4;
    for (let i = 0; i < capacity.puffs; i++) {
      this.puffPool.push({ pos: new Vector3(), vel: new Vector3(), life: 0, maxLife: 0.5, size0: 0.1, size1: 0.4, alpha: 0.3, spin: 0 });
      this.puffs.setMatrixAt(i, HIDDEN);
      this.stats.created++;
    }
    scene.add(this.puffs);

    this.muzzleLight = new PointLight(0xffb060, 0, 11, 1.0);
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
        // đất (terrain, TIP-D10): bụi đỏ nhiều, to + cột bụi bắn lên; gỗ: dăm nâu sáng; thép: tia lửa (DV-075 màu theo vật liệu)
        if (e.material === 'earth') {
          this.tint = TINT.earth;
          this.spawnPuffs(_p, _n, 5, 0.12, 0.6, 0.5, 0.7, 0.7);
          _tmp.set(_n.x * 0.3, 1, _n.z * 0.3).normalize();
          this.spawnPuffs(_p, _tmp, 2, 0.08, 0.35, 0.55, 0.45, 3.2);
        } else if (e.material === 'wood') {
          this.tint = TINT.wood;
          this.spawnPuffs(_p, _n, 4, 0.06, 0.3, 0.6, 0.45, 2.2);
        } else this.spawnPuffs(_p, _n, 3, 0.09, 0.42, 0.42, 0.55, 0.9);
        this.tint = TINT.smoke;
        if (e.material === 'steel' || e.material === 'metal') this.spawnSparks(_p, _n, 6);
      }),
    );
    this.unsub.push(events.on('WEAPON_FIRED', (e) => this.onPlayerShot(e.origin, e.dir)));
    this.unsub.push(events.on('HIT', (e) => this.placeDecal(e.point, [0, 1, 0], true)));
    this.unsub.push(events.on('RELOAD_START', () => undefined));
    this.unsub.push(
      (events as unknown as EventBus<{ BOT_FIRED: { botId: string; origin: [number, number, number]; dir: [number, number, number]; faction?: string } }>).on('BOT_FIRED', (e) => {
        _n.set(e.dir[0], e.dir[1], e.dir[2]);
        // đầu nòng thật từ súng của bot (TIP-014); không có → mắt + 0.6 m theo hướng bắn, thấp hơn 0.15 m
        if (!(this.botMuzzle && this.botMuzzle(e.botId, _p))) {
          _p.set(e.origin[0] + e.dir[0] * 0.6, e.origin[1] + e.dir[1] * 0.6 - 0.15, e.origin[2] + e.dir[2] * 0.6);
        }
        // DV-087: chớp lửa của lính ở xa phóng to theo khoảng cách (giữ cỡ góc tối thiểu) — đọc được chỗ địch bắn trong bóng rừng
        const dist = _p.distanceTo(this.camera.position);
        const far = Math.pow(Math.max(1, dist / 10), 0.7);
        this.spawnFlash(_p, _n, 0.9 * far);
        this.spawnSparks(_p, _n, 4);
        this.spawnTracer(_p, _n, 70, e.faction === 'friend' ? TRACER.friend : TRACER.enemy, 1.8);
        this.spawnPuffs(_p, _n, 2, 0.06, 0.4 * Math.min(2, far), 0.22, 0.9, 1.4);
        this.botLight.position.copy(_p);
        this.botLight.intensity = MUZZLE_LIGHT * 0.8 * (0.75 + this.prng.next() * 0.5);
        this.botLight.distance = 9;
        this.botLightLife = FLASH_LIFE;
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
    // DV-087: mỗi phát một dáng, cỡ đổi 0,8–1,2, thỉnh thoảng một chớp to (khí thuốc cháy không đều)
    // DV-090: chớp người chơi to hơn (× 1,45), một phần tư số phát bùng to (× 1,4); tia lửa nhiều hơn
    const big = this.prng.next() < 0.25 ? 1.4 : 1;
    this.playerFlash = this.spawnFlash(_p, _n, 1.45 * big);
    this.spawnSparks(_p, _n, 8);
    this.spawnTracer(_p, _n, 80, TRACER.player, 1);
    // khí thuốc phụt: một búi khói xám mỏng bay theo hướng bắn, tan nhanh
    this.spawnPuffs(_p, _n, 3, 0.06, 0.55, 0.26, 0.9, 2.4);
    this.muzzleLight.position.copy(_p);
    this.lightPeak = MUZZLE_LIGHT * (0.8 + this.prng.next() * 0.45) * big;
    this.muzzleLight.intensity = this.lightPeak;
    this.lightLife = FLASH_LIFE;
    this.heat = Math.min(14, this.heat + HEAT_PER_SHOT);
    this.lastShotAt = this.clock;
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

  /** chớp lửa nòng tại `pos` hướng `dir`; trả chỉ số ô (để bám theo đầu nòng của người chơi trong lúc còn sáng) */
  private spawnFlash(pos: Vector3, dir: Vector3, scale: number): number {
    const i = this.flashHead;
    this.flashHead = (this.flashHead + 1) % this.capacity.flashes;
    this.flashLife[i] = FLASH_LIFE;
    this.flashAge.setX(i, 0);
    this.flashAge.needsUpdate = true;
    this.flashSeed.setX(i, this.prng.next());
    this.flashSeed.needsUpdate = true;
    // +z của geometry ↔ hướng bắn, rồi xoay ngẫu nhiên quanh nòng
    _q.setFromUnitVectors(_fwd, dir);
    _q2.setFromAxisAngle(dir, this.prng.next() * Math.PI * 2);
    _q.premultiply(_q2);
    const sc = scale * (0.8 + this.prng.next() * 0.4);
    this.flashScale[i] = sc;
    _s.set(sc, sc, sc);
    _m.compose(pos, _q, _s);
    this.flashes.setMatrixAt(i, _m);
    this.flashes.instanceMatrix.needsUpdate = true;
    this.glowAge.setX(i, 0);
    this.glowAge.needsUpdate = true;
    this.placeGlow(i, pos, sc);
    return i;
  }

  /** DV-090 quầng sáng hướng camera tại `pos`, cỡ theo chớp */
  private placeGlow(i: number, pos: Vector3, sc: number): void {
    const g = sc * 0.75;
    _s.set(g, g, g);
    _m.compose(pos, this.camera.quaternion, _s);
    this.glows.setMatrixAt(i, _m);
    this.glows.instanceMatrix.needsUpdate = true;
  }

  /**
   * Nổ (bộc phá/lựu đạn — M2 R1): chớp lớn + tia lửa toả cầu + ánh sáng cam 0,25 s (dùng botLight — đèn thứ hai).
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
    // DV-087: bụi, khói, đất đá của vụ nổ do engine/render/blastFx vẽ (Game.explode); ở đây chỉ còn chớp, tia lửa, đèn
    this.botLight.position.copy(_p).addScaledVector(_up, 1.2);
    this.botLight.intensity = MUZZLE_LIGHT * 4;
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

  private spawnTracer(pos: Vector3, dir: Vector3, maxDist: number, tint: readonly [number, number, number], width: number): void {
    const i = this.tracerHead;
    const t = this.tracerPool[i]!;
    this.tracerHead = (this.tracerHead + 1) % this.capacity.tracers;
    t.origin.copy(pos);
    t.dir.copy(dir);
    t.maxDist = maxDist;
    t.life = 0;
    t.width = width;
    this.tracerTint.setXYZ(i, tint[0], tint[1], tint[2]);
    this.tracerTint.needsUpdate = true;
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
      const ti = this.puffHead === 0 ? this.capacity.puffs - 1 : this.puffHead - 1;
      const c = this.tint;
      this.puffTint.setXYZ(ti, c[0], c[1], c[2]);
      this.puffTint.needsUpdate = true;
    }
  }

  /** Render-side update (dt giây). */
  update(dt: number): void {
    this.clock += dt;
    // đèn nòng: tắt theo đường cong (sáng loé rồi rơi nhanh)
    if (this.lightLife > 0) {
      this.lightLife -= dt;
      const k = Math.max(0, this.lightLife / FLASH_LIFE);
      this.muzzleLight.intensity = this.lightPeak * k * k;
      if (this.muzzleWorld) this.muzzleLight.position.copy(this.muzzleWorld);
      if (this.lightLife <= 0) this.muzzleLight.intensity = 0;
    }
    if (this.botLightLife > 0) {
      const life0 = this.botLight.distance > 9 ? 0.25 : FLASH_LIFE;
      this.botLightLife -= dt;
      const k = Math.max(0, this.botLightLife / life0);
      this.botLight.intensity = Math.max(0, (life0 > FLASH_LIFE ? MUZZLE_LIGHT * 4 : MUZZLE_LIGHT * 0.8) * k);
      if (this.botLightLife <= 0) this.botLight.intensity = 0;
    }
    // flash: tuổi 0 → 1 trong FLASH_LIFE; chớp của người chơi bám đầu nòng hiện tại
    let anyFlash = false;
    for (let i = 0; i < this.capacity.flashes; i++) {
      if (this.flashLife[i]! <= 0) continue;
      this.flashLife[i] = this.flashLife[i]! - dt;
      anyFlash = true;
      if (this.flashLife[i]! <= 0) {
        this.flashes.setMatrixAt(i, HIDDEN);
        this.glows.setMatrixAt(i, HIDDEN);
        this.flashAge.setX(i, 1);
        this.glowAge.setX(i, 1);
        if (i === this.playerFlash) this.playerFlash = -1;
        continue;
      }
      const u = 1 - this.flashLife[i]! / FLASH_LIFE;
      this.flashAge.setX(i, u);
      this.glowAge.setX(i, Math.min(1, u * 1.25));
      // co lại khi nguội: khung đầu to nhất
      const sc = this.flashScale[i]! * (1 - 0.35 * u);
      this.flashes.getMatrixAt(i, _m);
      _m.decompose(_p, _q, _s);
      if (i === this.playerFlash && this.muzzleWorld) _p.copy(this.muzzleWorld);
      _s.set(sc, sc, sc);
      _m.compose(_p, _q, _s);
      this.flashes.setMatrixAt(i, _m);
      this.placeGlow(i, _p, this.flashScale[i]! * (1 + 0.3 * u));
    }
    if (anyFlash) {
      this.flashes.instanceMatrix.needsUpdate = true;
      this.flashAge.needsUpdate = true;
      this.glows.instanceMatrix.needsUpdate = true;
      this.glowAge.needsUpdate = true;
    }
    // khói nòng (DV-087): nòng nóng sau loạt bắn toả sợi khói mảnh bốc lên, lâu dần theo nhiệt
    this.heat = Math.max(0, this.heat - HEAT_COOL * dt);
    if (this.heat > HEAT_SMOKE && this.muzzleWorld && this.clock - this.lastShotAt > 0.12) {
      this.wispAcc += dt;
      const every = 0.11 - Math.min(0.05, (this.heat - HEAT_SMOKE) * 0.006);
      while (this.wispAcc >= every) {
        this.wispAcc -= every;
        _tmp.set((this.prng.next() - 0.5) * 0.15, 1, (this.prng.next() - 0.5) * 0.15).normalize();
        this.tint = TINT.barrel;
        this.spawnPuffs(this.muzzleWorld, _tmp, 1, 0.03, 0.32, Math.min(0.2, 0.06 + (this.heat - HEAT_SMOKE) * 0.02), 2.1, 0.35);
        this.tint = TINT.smoke;
      }
    } else this.wispAcc = 0;
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
      _s.set(t.width, t.width, len);
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
      this.flashAge.setX(i, 1);
      this.flashes.setMatrixAt(i, HIDDEN);
      this.glowAge.setX(i, 1);
      this.glows.setMatrixAt(i, HIDDEN);
    }
    this.flashAge.needsUpdate = true;
    this.glowAge.needsUpdate = true;
    this.glows.instanceMatrix.needsUpdate = true;
    this.playerFlash = -1;
    this.heat = 0;
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
