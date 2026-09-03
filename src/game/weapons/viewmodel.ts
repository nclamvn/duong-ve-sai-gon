/**
 * Viewmodel góc nhìn thứ nhất (TIP-010 → TIP-013 PBR procedural → TIP-014 glTF data-driven).
 * - Có model glTF (content/weapons/<id>.json, ADR-006): AK-74M PBR, pose hip/ADS/sprint từ JSON, **ADS căn đường ngắm** (anchor `sight`
 *   đưa về trục camera cách `sightDistance`), băng đạn tháo/lắp khi reload, bolt giật khi bắn, bao tay vải tại gripR/gripL.
 * - Không có model → AR procedural TIP-013 (CI `?assets=0`, `?weapons=0`).
 * hip ↔ ADS lerp theo weapon.ads, sprint lerp theo tốc độ, bob/sway theo CameraRig + chuột, kick khi bắn, dip khi reload.
 * Xuất `muzzleWorld` + `ejectWorld` cho FX. Chỉ render-side. Không Math.random (kick lệch theo dãy vàng).
 */
import { Group, Mesh, Object3D, BoxGeometry, CylinderGeometry, TorusGeometry, MeshStandardNodeMaterial, PointLight, Vector3, Color, Matrix4, Euler, Quaternion, type PerspectiveCamera, type BufferGeometry } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { texture, uv, vec2, vec4, float, mx_noise_float, positionLocal, saturate, normalMap, mix, color } from 'three/tsl';
import type { PbrTextureSet } from '@engine/render/assets';
import { instantiateWeapon, poseToVectors, type WeaponAsset, type WeaponInstance } from '@engine/render/weaponModel';

const SCALE = 0.62; // súng procedural thu nhỏ để vừa FOV 90 và không che tâm ngắm
const HIP = { pos: new Vector3(0.2, -0.175, -0.34), rot: new Euler(0.03, 0.08, 0.03) };
const ADS = { pos: new Vector3(0.0, -0.062, -0.3), rot: new Euler(0, 0, 0) };
const SPRINT = { pos: new Vector3(0.16, -0.24, -0.26), rot: new Euler(0.35, 0.55, 0.15) };
/** reload: đưa súng lên-giữa và nghiêng trái để thấy băng đạn tháo/lắp (TIP-014) */
const RELOAD_DIP = new Vector3(-0.05, 0.02, 0.05);
const BOLT_TIME = 0.09;

export interface ViewModelMaterials {
  steel: PbrTextureSet | null;
}

function steelMaterial(tex: PbrTextureSet | null, tint: number, rough: number, metal: number): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ color: tint, roughness: rough, metalness: metal });
  if (tex) {
    const tuv = uv().mul(3.2); // 1 tile ≈ 0.3 m trên súng
    const diff = texture(tex.map, tuv);
    const arm = texture(tex.armMap, tuv);
    m.colorNode = vec4(diff.rgb.mul(color(new Color(tint))).mul(1.6), 1.0);
    m.roughnessNode = saturate(arm.g.mul(0.6).add(rough * 0.5));
    m.metalnessNode = float(metal);
    m.normalNode = normalMap(texture(tex.normalMap, tuv).rgb, vec2(0.6));
    m.aoNode = arm.r;
  }
  return m;
}

function polymerMaterial(tint: number): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ color: tint, roughness: 0.85, metalness: 0.02 });
  // nhám hạt mịn + vết mòn ở cạnh (noise theo positionLocal)
  const n = mx_noise_float(positionLocal.mul(180.0)).mul(0.5).add(0.5);
  const wear = mx_noise_float(positionLocal.mul(22.0)).mul(0.5).add(0.5);
  m.roughnessNode = saturate(float(0.72).add(n.mul(0.2)).sub(wear.mul(0.15)));
  m.colorNode = vec4(mix(color(new Color(tint)), color(new Color(tint).multiplyScalar(1.35)), wear.mul(0.35)), 1.0);
  return m;
}

function fabricMaterial(tint: number): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ color: tint, roughness: 0.97, metalness: 0.0 });
  const weave = mx_noise_float(positionLocal.mul(420.0)).mul(0.5).add(0.5);
  m.colorNode = vec4(color(new Color(tint)).mul(weave.mul(0.35).add(0.8)), 1.0);
  return m;
}

/** Gộp geometry theo material → 1 mesh/material (ít draw). */
class GeoBuilder {
  readonly buckets = new Map<MeshStandardNodeMaterial, BufferGeometry[]>();
  private readonly m4 = new Matrix4();
  private readonly q = new Quaternion();
  parts = 0;
  add(geo: BufferGeometry, mat: MeshStandardNodeMaterial, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): void {
    this.q.setFromEuler(new Euler(rx, ry, rz));
    this.m4.compose(new Vector3(x, y, z), this.q, new Vector3(1, 1, 1));
    geo.applyMatrix4(this.m4);
    if (geo.index) geo = geo.toNonIndexed();
    const list = this.buckets.get(mat) ?? [];
    list.push(geo);
    this.buckets.set(mat, list);
    this.parts++;
  }
  build(parent: Object3D): Mesh[] {
    const out: Mesh[] = [];
    for (const [mat, geos] of this.buckets) {
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      for (const g of geos) g.dispose();
      const m = new Mesh(merged, mat);
      m.castShadow = false;
      m.receiveShadow = false;
      m.frustumCulled = false;
      parent.add(m);
      out.push(m);
    }
    return out;
  }
}

const rbox = (w: number, h: number, d: number, r = 0.004): RoundedBoxGeometry => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) / 2.2));

/** Bao tay vải phải (tay cầm) + trái (ốp lót), tại anchor; hệ model (m). Trả về group tay trái (theo băng đạn khi reload). */
function addGloves(b: GeoBuilder, glove: MeshStandardNodeMaterial, gripR: Vector3, gripL: Vector3, leftGroup: Group): void {
  b.add(rbox(0.07, 0.06, 0.09, 0.012), glove, gripR.x + 0.005, gripR.y + 0.02, gripR.z - 0.02, -0.3); // tay phải ôm tay cầm
  b.add(rbox(0.018, 0.02, 0.05, 0.007), glove, gripR.x + 0.03, gripR.y + 0.045, gripR.z - 0.075, -0.4, 0, 0.1); // ngón trỏ trên cò
  const lb = new GeoBuilder();
  lb.add(rbox(0.075, 0.055, 0.1, 0.012), glove, gripL.x - 0.01, gripL.y - 0.015, gripL.z, 0.2, 0, -0.35); // tay trái đỡ ốp lót
  for (let i = 0; i < 4; i++) lb.add(rbox(0.016, 0.016, 0.05, 0.006), glove, gripL.x - 0.04 + i * 0.019, gripL.y + 0.02, gripL.z + 0.01 - i * 0.004, 0.35, 0, -0.2);
  lb.build(leftGroup);
}

/** AR procedural TIP-013 (fallback). Gốc = receiver, nòng −z. */
function buildProceduralGun(mats: ViewModelMaterials, parent: Object3D, leftHand: Group): { muzzle: Vector3; eject: Vector3; parts: number } {
  const gunmetal = steelMaterial(mats.steel, 0x2a2e33, 0.45, 0.85);
  const barrelSteel = steelMaterial(mats.steel, 0x1e2226, 0.35, 0.9);
  const rail = steelMaterial(mats.steel, 0x15181b, 0.55, 0.7);
  const polymer = polymerMaterial(0x24282c);
  const polymerDark = polymerMaterial(0x1a1d20);
  const glove = fabricMaterial(0x2f2a25);
  const brass = new MeshStandardNodeMaterial({ color: 0xc9a24a, roughness: 0.3, metalness: 0.95 });
  const b = new GeoBuilder();
  const add = b.add.bind(b);
  add(rbox(0.052, 0.07, 0.26, 0.006), gunmetal, 0, 0, -0.02); // upper + lower receiver
  add(rbox(0.056, 0.03, 0.12, 0.004), gunmetal, 0, -0.045, 0.02); // lower receiver bụng
  add(new BoxGeometry(0.02, 0.028, 0.06), polymerDark, 0.027, 0.012, -0.03); // cửa thoát vỏ (inset tối)
  add(rbox(0.058, 0.02, 0.24, 0.003), rail, 0, 0.045, -0.06); // rail trên
  for (let i = 0; i < 12; i++) add(new BoxGeometry(0.06, 0.006, 0.006), polymerDark, 0, 0.056, -0.17 + i * 0.019); // rãnh picatinny
  add(rbox(0.056, 0.066, 0.24, 0.006), polymer, 0, -0.004, -0.29); // handguard
  for (let i = 0; i < 6; i++) {
    add(new BoxGeometry(0.06, 0.012, 0.018), polymerDark, 0, 0.012, -0.2 - i * 0.034); // lỗ tản nhiệt (trên)
    add(new BoxGeometry(0.018, 0.012, 0.06), polymerDark, 0.03, 0.006, -0.2 - i * 0.034); // lỗ bên
  }
  add(new CylinderGeometry(0.011, 0.011, 0.24, 12), barrelSteel, 0, 0.012, -0.5, Math.PI / 2); // nòng
  add(new CylinderGeometry(0.0155, 0.0155, 0.05, 12), barrelSteel, 0, 0.012, -0.61, Math.PI / 2); // giảm giật
  for (let i = 0; i < 3; i++) add(new BoxGeometry(0.036, 0.004, 0.006), polymerDark, 0, 0.012, -0.595 - i * 0.012); // khe giảm giật
  add(new CylinderGeometry(0.006, 0.006, 0.045, 8), barrelSteel, 0, 0.012, -0.632, Math.PI / 2); // lỗ nòng (ống trong)
  add(rbox(0.04, 0.17, 0.06, 0.005), polymer, 0, -0.115, 0.0, 0.08); // băng đạn (cong nhẹ)
  add(rbox(0.042, 0.02, 0.064, 0.004), polymerDark, 0, -0.205, -0.014, 0.08); // đế băng
  add(rbox(0.03, 0.09, 0.05, 0.006), polymer, 0, -0.07, 0.11, -0.35); // tay cầm
  add(new TorusGeometry(0.03, 0.004, 6, 14, Math.PI), gunmetal, 0, -0.05, 0.055, 0, Math.PI / 2, Math.PI); // vòng cò
  add(new BoxGeometry(0.006, 0.026, 0.008), gunmetal, 0, -0.045, 0.05, 0.25); // cò
  add(rbox(0.048, 0.06, 0.2, 0.006), polymer, 0, 0.0, 0.22); // báng
  add(rbox(0.05, 0.07, 0.03, 0.004), polymerDark, 0, 0.0, 0.325); // đế báng cao su
  add(new CylinderGeometry(0.013, 0.013, 0.16, 10), gunmetal, 0, 0.012, 0.16, Math.PI / 2); // ống báng
  add(rbox(0.03, 0.035, 0.03, 0.003), rail, 0, 0.075, -0.16); // đầu ruồi (đế)
  add(new BoxGeometry(0.008, 0.012, 0.004), rail, 0, 0.096, -0.16); // cột ruồi
  add(rbox(0.036, 0.03, 0.04, 0.003), rail, 0, 0.072, 0.03); // thước ngắm sau
  add(new BoxGeometry(0.02, 0.05, 0.02), gunmetal, 0.03, 0.02, 0.02); // tay kéo
  add(new BoxGeometry(0.012, 0.006, 0.03), gunmetal, -0.032, 0.0, 0.06, 0, 0, 0.5); // cần khoá an toàn
  add(new CylinderGeometry(0.007, 0.007, 0.012, 8), gunmetal, 0.032, -0.02, -0.02, 0, 0, Math.PI / 2); // nút tháo băng
  add(new CylinderGeometry(0.004, 0.004, 0.012, 6), brass, 0.028, 0.012, -0.03, 0, 0, Math.PI / 2); // viên đạn lộ ở cửa thoát (đồng)
  addGloves(b, glove, new Vector3(0, -0.08, 0.12), new Vector3(0, -0.03, -0.3), leftHand);
  b.build(parent);
  return { muzzle: new Vector3(0, 0.012, -0.655), eject: new Vector3(0.05, 0.02, -0.03), parts: b.parts };
}

export class WeaponViewModel {
  /**
   * "FOV viewmodel" (TIP-017): nhóm con của camera scale (k, k, 1) — chiếu màn hình y hệt camera FOV hẹp hơn (tan nửa góc × k)
   * nhưng súng và cánh tay giữ **kích thước thật, khoảng cách thật** → tay với tới ốp lót như đời thật. root/tay FP là con của space.
   */
  readonly space = new Group();
  readonly root = new Group();
  /** 'gltf' = model CC-BY (TIP-014), 'procedural' = AR TIP-013 */
  readonly kind: 'procedural' | 'gltf';
  private readonly muzzleAnchor: Object3D;
  private readonly ejectAnchor: Object3D;
  private readonly leftHand = new Group();
  private readonly leftHandRest = new Vector3();
  /** anchor cho cánh tay FP (TIP-016): gripR (hệ súng) và gripL đi theo tay trái (băng đạn khi reload) */
  readonly fpAnchors: { gripR: Object3D; gripL: Object3D } | null = null;
  private readonly gloveMeshes: Mesh[] = [];
  private readonly inst: WeaponInstance | null = null;
  private readonly hip: { pos: Vector3; rot: Euler };
  private readonly ads: { pos: Vector3; rot: Euler };
  private readonly sprint: { pos: Vector3; rot: Euler };
  private readonly boltTravel: number;
  readonly muzzleWorld = new Vector3();
  readonly ejectWorld = new Vector3();
  private kick = 0;
  private kickSide = 0;
  private shotIndex = 0;
  private swayX = 0;
  private swayY = 0;
  private reloadT = 0;
  private reloadDur = 1;
  private boltT = 0;
  private sprintBlend = 0;
  private readonly tmp = new Vector3();
  private readonly tmpE = new Euler();
  private readonly bobBase = new Vector3();
  visible = true;
  /** đèn fill nhỏ gắn camera: súng đen (AK/HK PBR) không chìm vào đêm; luôn trong scene (số đèn cố định) */
  readonly fillLight: PointLight;
  /** số mesh/part (evidence) */
  readonly partCount: number;
  /** tri của model (evidence) */
  readonly triangles: number;

  constructor(camera: PerspectiveCamera, mats: ViewModelMaterials = { steel: null }, weapon: WeaponAsset | null = null) {
    const gun = new Group();
    gun.name = 'viewmodel_gun';
    if (weapon) {
      this.kind = 'gltf';
      const inst = instantiateWeapon(weapon, { castShadow: false, receiveShadow: false });
      this.inst = inst;
      gun.add(inst.root);
      this.muzzleAnchor = inst.anchors.muzzle;
      this.ejectAnchor = inst.anchors.eject;
      const v = weapon.cfg.view;
      this.space.scale.set(v.scale, v.scale, 1);
      this.hip = poseToVectors(v.hip);
      this.ads = poseToVectors(v.ads);
      this.sprint = poseToVectors(v.sprint);
      if (v.alignSight !== false) {
        // ADS: anchor sight (model, kích thước thật) về trục camera tại (0, 0, −sightDistance) khi rot = ads.rot (≈ 0)
        const s = weapon.cfg.anchors.sight;
        this.ads.pos.set(-s[0], -s[1], -v.sightDistance - s[2]);
      }
      this.boltTravel = weapon.cfg.parts.boltTravel ?? 0.06;
      // bao tay vải tại anchor (hệ model, con của inst.root → theo scale)
      const gb = new GeoBuilder();
      const a = weapon.cfg.anchors;
      addGloves(gb, fabricMaterial(0x23211c), new Vector3(a.gripR[0], a.gripR[1], a.gripR[2]), new Vector3(a.gripL[0], a.gripL[1], a.gripL[2]), this.leftHand);
      this.gloveMeshes.push(...gb.build(inst.root));
      inst.root.add(this.leftHand);
      this.leftHand.traverse((o: Object3D) => {
        if ((o as Mesh).isMesh) this.gloveMeshes.push(o as Mesh);
      });
      // anchor gripL là con của leftHand (đi theo băng đạn khi reload) tại vị trí gripL
      const gripL = new Object3D();
      gripL.name = 'gripL_fp';
      gripL.position.set(a.gripL[0], a.gripL[1], a.gripL[2]);
      this.leftHand.add(gripL);
      this.fpAnchors = { gripR: inst.anchors.gripR, gripL };
      this.partCount = weapon.meshes + gb.parts;
      this.triangles = weapon.triangles;
      // PBR tối (base ~0.17, metal ~0.6) chìm vào đêm → bản material riêng cho viewmodel: sáng hơn, bớt kim loại, IBL mạnh hơn
      inst.model.traverse((o: Object3D) => {
        const m = o as Object3D & { material?: { clone(): unknown } };
        if (!m.material) return;
        const c = m.material.clone() as { color?: Color; metalness?: number; envMapIntensity?: number };
        if (c.color) c.color.multiplyScalar(1.25);
        if (typeof c.metalness === 'number') c.metalness = 0.6;
        if ('envMapIntensity' in c) c.envMapIntensity = 2.0;
        m.material = c as unknown as { clone(): unknown };
      });
    } else {
      this.kind = 'procedural';
      this.hip = { pos: HIP.pos.clone(), rot: HIP.rot.clone() };
      this.ads = { pos: ADS.pos.clone(), rot: ADS.rot.clone() };
      this.sprint = { pos: SPRINT.pos.clone(), rot: SPRINT.rot.clone() };
      this.boltTravel = 0;
      const r = buildProceduralGun(mats, gun, this.leftHand);
      gun.add(this.leftHand);
      this.muzzleAnchor = new Object3D();
      this.muzzleAnchor.position.copy(r.muzzle);
      this.ejectAnchor = new Object3D();
      this.ejectAnchor.position.copy(r.eject);
      gun.add(this.muzzleAnchor, this.ejectAnchor);
      this.partCount = r.parts;
      this.triangles = 0;
      gun.scale.setScalar(SCALE);
    }
    this.leftHandRest.copy(this.leftHand.position);
    this.root.add(gun);
    this.space.name = 'viewmodel_space';
    this.space.add(this.root);
    this.root.position.copy(this.hip.pos);
    // đèn fill là con của root (theo pose hip/ADS/sprint) → khoảng cách tới súng ổn định, không cháy trắng khi ADS
    // TIP-017: súng kích thước thật gần đèn hơn → 0.45 cd, lùi lên trên-trước (đo ADS không cháy trắng)
    this.fillLight = new PointLight(0xdfe6f2, 0.45, 1.4, 2);
    this.fillLight.position.set(0.04, 0.22, -0.3);
    this.fillLight.castShadow = false;
    this.root.add(this.fillLight);
    camera.add(this.space);
  }

  /** ẩn bao tay procedural khi có cánh tay FP thật */
  setGlovesVisible(v: boolean): void {
    for (const m of this.gloveMeshes) m.visible = v;
  }

  onShot(): void {
    this.kick = 1;
    this.boltT = BOLT_TIME;
    // lệch ngang giả-ngẫu nhiên deterministic (AGENTS: không Math.random) — chỉ hình ảnh, không ảnh hưởng gameplay
    this.shotIndex++;
    this.kickSide = (((this.shotIndex * 0.6180339887) % 1) - 0.5) * 0.5;
  }

  onReload(durationMs: number): void {
    this.reloadT = durationMs / 1000;
    this.reloadDur = Math.max(0.2, durationMs / 1000);
  }

  /**
   * @param dt giây · ads 0..1 · dx delta chuột (px) frame này · bob offset từ CameraRig · speed m/s · sprinting (chạy, hạ súng)
   */
  update(dt: number, ads: number, dx: number, dy: number, bobX: number, bobY: number, speed: number, sprinting = false): void {
    this.root.visible = this.visible;
    const swayK = 1 - ads * 0.8;
    this.swayX += (Math.max(-30, Math.min(30, -dx)) * 0.0009 * swayK - this.swayX) * Math.min(1, dt * 12);
    this.swayY += (Math.max(-30, Math.min(30, dy)) * 0.0007 * swayK - this.swayY) * Math.min(1, dt * 12);
    this.kick = Math.max(0, this.kick - dt * 9);
    const k = this.kick * this.kick;
    const sprintTarget = sprinting && ads < 0.05 && this.reloadT <= 0 && speed > 3.5 ? 1 : 0;
    this.sprintBlend += (sprintTarget - this.sprintBlend) * Math.min(1, dt * 7);
    let dip = 0;
    let u = 1;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      u = 1 - Math.max(0, this.reloadT) / this.reloadDur;
      dip = Math.sin(Math.min(1, u) * Math.PI);
    }
    this.animateParts(dt, u);
    const p = this.root.position;
    this.bobBase.copy(this.hip.pos).lerp(this.ads.pos, ads).lerp(this.sprint.pos, this.sprintBlend);
    p.copy(this.bobBase);
    const bobK = (1 - ads * 0.85) * Math.min(1, speed / 4) * (1 + this.sprintBlend * 0.6);
    p.x += bobX * 0.9 * bobK + this.swayX + dip * RELOAD_DIP.x;
    p.y += bobY * 1.2 * bobK + this.swayY * 0.6 + dip * RELOAD_DIP.y;
    p.z += k * 0.045 + dip * RELOAD_DIP.z;
    const r = this.root.rotation;
    this.tmp.set(this.hip.rot.x, this.hip.rot.y, this.hip.rot.z);
    this.tmpE.copy(this.ads.rot);
    this.tmp.lerp(new Vector3(this.tmpE.x, this.tmpE.y, this.tmpE.z), ads);
    this.tmp.lerp(new Vector3(this.sprint.rot.x, this.sprint.rot.y, this.sprint.rot.z), this.sprintBlend);
    r.x = this.tmp.x - k * 0.06 + dip * 0.42 + this.swayY * 0.8;
    r.y = this.tmp.y + this.swayX * 1.2 + k * this.kickSide * 0.03 + dip * 0.18;
    r.z = this.tmp.z + this.swayX * 0.6 - dip * 0.5 + k * this.kickSide * 0.05;
    this.muzzleAnchor.getWorldPosition(this.muzzleWorld);
    this.ejectAnchor.getWorldPosition(this.ejectWorld);
  }

  /** Băng đạn tháo (0–0.35) → ẩn/thay (0.35–0.6) → lắp (0.6–0.8) → bolt kéo (0.8–1); bolt giật mỗi phát. */
  private animateParts(dt: number, u: number): void {
    const inst = this.inst;
    if (!inst) return;
    const mag = inst.parts.magazine;
    const bolt = inst.parts.bolt;
    if (mag) {
      const rest = inst.rest.magazine;
      let off = 0;
      let tilt = 0;
      let vis = true;
      if (u < 1) {
        if (u < 0.35) {
          const t = u / 0.35;
          off = t * t * 0.14;
          tilt = t * 0.5;
        } else if (u < 0.6) {
          vis = false;
          off = 0.14;
        } else if (u < 0.8) {
          const t = 1 - (u - 0.6) / 0.2;
          off = t * t * 0.14;
          tilt = t * 0.35;
        }
      }
      mag.visible = vis;
      mag.position.set(rest.x, rest.y - off, rest.z + off * 0.3);
      mag.rotation.x = tilt;
      // tay trái theo băng đạn
      this.leftHand.position.copy(this.leftHandRest);
      if (u < 0.8 && u < 1) {
        const a = this.inst!.anchors;
        const target = a.magazine.position;
        const w = u < 0.35 ? u / 0.35 : u < 0.6 ? 1 : 1 - (u - 0.6) / 0.2;
        this.leftHand.position.lerpVectors(this.leftHandRest, this.tmp.set(target.x - a.gripL.position.x, target.y - off - a.gripL.position.y - 0.02, target.z - a.gripL.position.z + 0.04), w);
      }
    }
    if (bolt) {
      const rest = inst.rest.bolt;
      let z = 0;
      if (this.boltT > 0) {
        this.boltT -= dt;
        z = Math.sin(Math.max(0, this.boltT / BOLT_TIME) * Math.PI) * this.boltTravel;
      }
      if (u >= 0.8 && u < 1) {
        const t = (u - 0.8) / 0.2;
        z = Math.max(z, Math.sin(t * Math.PI) * this.boltTravel);
      }
      bolt.position.set(rest.x, rest.y, rest.z + z);
    }
  }

  reset(): void {
    this.kick = 0;
    this.shotIndex = 0;
    this.reloadT = 0;
    this.boltT = 0;
    this.sprintBlend = 0;
    this.swayX = this.swayY = 0;
    this.animateParts(0, 1);
  }
}
