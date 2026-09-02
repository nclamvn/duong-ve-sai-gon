/**
 * Viewmodel AR góc nhìn thứ nhất (TIP-010 → TIP-013 PBR): procedural, gắn camera. Không asset ngoài trừ texture CC0 (metal_plate).
 * hip ↔ ADS lerp theo weapon.ads, bob/sway theo CameraRig + chuột, kick khi bắn, dip khi reload.
 * Xuất `muzzleWorld` + `ejectWorld` cho FX. Chỉ render-side.
 * TIP-013: RoundedBox vát cạnh, rail có rãnh, ốp lót có lỗ tản nhiệt, cửa thoát vỏ, cò/vòng cò, cần khoá, băng đạn cong,
 *          thép có texture + roughness thật, polymer nhám, bao tay vải.
 */
import { Group, Mesh, BoxGeometry, CylinderGeometry, TorusGeometry, MeshStandardNodeMaterial, Vector3, Color, Matrix4, Euler, Quaternion, type PerspectiveCamera, type BufferGeometry } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { texture, uv, vec2, vec4, float, mx_noise_float, positionLocal, saturate, normalMap, mix, color } from 'three/tsl';
import type { PbrTextureSet } from '@engine/render/assets';

const SCALE = 0.62; // súng thu nhỏ để vừa FOV 90 và không che tâm ngắm
const HIP = { pos: new Vector3(0.2, -0.175, -0.34), rot: new Vector3(0.03, 0.08, 0.03) };
const ADS = { pos: new Vector3(0.0, -0.062, -0.3), rot: new Vector3(0, 0, 0) };
const RELOAD_DIP = new Vector3(0.05, -0.16, 0.06);

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

export class WeaponViewModel {
  readonly root = new Group();
  private readonly muzzleAnchor = new Group();
  private readonly ejectAnchor = new Group();
  readonly muzzleWorld = new Vector3();
  readonly ejectWorld = new Vector3();
  private kick = 0;
  private kickSide = 0;
  private shotIndex = 0;
  private swayX = 0;
  private swayY = 0;
  private reloadT = 0;
  private reloadDur = 1;
  private readonly tmp = new Vector3();
  private readonly bobBase = new Vector3();
  visible = true;
  /** số mesh (evidence) */
  readonly partCount: number;

  constructor(camera: PerspectiveCamera, mats: ViewModelMaterials = { steel: null }) {
    const gunmetal = steelMaterial(mats.steel, 0x2a2e33, 0.45, 0.85);
    const barrelSteel = steelMaterial(mats.steel, 0x1e2226, 0.35, 0.9);
    const rail = steelMaterial(mats.steel, 0x15181b, 0.55, 0.7);
    const polymer = polymerMaterial(0x24282c);
    const polymerDark = polymerMaterial(0x1a1d20);
    const glove = fabricMaterial(0x2f2a25);
    const brass = new MeshStandardNodeMaterial({ color: 0xc9a24a, roughness: 0.3, metalness: 0.95 });
    let parts = 0;
    // gộp geometry theo material → ~7 draw thay vì ~60 (TIP-013)
    const buckets = new Map<MeshStandardNodeMaterial, BufferGeometry[]>();
    const _m4 = new Matrix4();
    const _q = new Quaternion();
    const add = (geo: BufferGeometry, mat: MeshStandardNodeMaterial, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): void => {
      _q.setFromEuler(new Euler(rx, ry, rz));
      _m4.compose(new Vector3(x, y, z), _q, new Vector3(1, 1, 1));
      geo.applyMatrix4(_m4);
      if (geo.index) geo = geo.toNonIndexed();
      const list = buckets.get(mat) ?? [];
      list.push(geo);
      buckets.set(mat, list);
      parts++;
    };
    const rbox = (w: number, h: number, d: number, r = 0.004): RoundedBoxGeometry => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) / 2.2));
    // --- Súng nằm dọc trục −z của root (nòng ở −z). Kích thước theo AR thật, rút ngắn cho FOV 90.
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
    // --- Tay: bao tay vải, ngón tay
    add(rbox(0.07, 0.06, 0.09, 0.012), glove, 0.005, -0.06, 0.1, -0.3); // tay phải (bao tay)
    add(rbox(0.075, 0.055, 0.1, 0.012), glove, -0.01, -0.045, -0.3, 0.2, 0, -0.35); // tay trái đỡ ốp lót
    for (let i = 0; i < 4; i++) add(rbox(0.016, 0.016, 0.05, 0.006), glove, -0.04 + i * 0.019, -0.012, -0.29 - i * 0.004, 0.35, 0, -0.2); // ngón tay trái ôm ốp
    add(rbox(0.018, 0.02, 0.05, 0.007), glove, 0.03, -0.038, 0.04, -0.4, 0, 0.1); // ngón trỏ phải trên cò
    for (const [mat, geos] of buckets) {
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      for (const g of geos) g.dispose();
      const m = new Mesh(merged, mat);
      m.castShadow = false;
      m.receiveShadow = false;
      m.frustumCulled = false;
      this.root.add(m);
    }
    this.muzzleAnchor.position.set(0, 0.012, -0.655);
    this.ejectAnchor.position.set(0.05, 0.02, -0.03);
    this.root.add(this.muzzleAnchor, this.ejectAnchor);
    this.root.scale.setScalar(SCALE);
    this.root.position.copy(HIP.pos);
    camera.add(this.root);
    this.partCount = parts;
  }

  onShot(): void {
    this.kick = 1;
    // lệch ngang giả-ngẫu nhiên deterministic (AGENTS: không Math.random) — chỉ hình ảnh, không ảnh hưởng gameplay
    this.shotIndex++;
    this.kickSide = (((this.shotIndex * 0.6180339887) % 1) - 0.5) * 0.5;
  }

  onReload(durationMs: number): void {
    this.reloadT = durationMs / 1000;
    this.reloadDur = Math.max(0.2, durationMs / 1000);
  }

  /**
   * @param dt giây · ads 0..1 · dx delta chuột (px) frame này · bob offset từ CameraRig · speed m/s
   */
  update(dt: number, ads: number, dx: number, dy: number, bobX: number, bobY: number, speed: number): void {
    this.root.visible = this.visible;
    const swayK = 1 - ads * 0.8;
    this.swayX += (Math.max(-30, Math.min(30, -dx)) * 0.0009 * swayK - this.swayX) * Math.min(1, dt * 12);
    this.swayY += (Math.max(-30, Math.min(30, dy)) * 0.0007 * swayK - this.swayY) * Math.min(1, dt * 12);
    this.kick = Math.max(0, this.kick - dt * 9);
    const k = this.kick * this.kick;
    let dip = 0;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      const u = 1 - Math.max(0, this.reloadT) / this.reloadDur;
      dip = Math.sin(Math.min(1, u) * Math.PI);
    }
    const p = this.root.position;
    this.bobBase.copy(HIP.pos).lerp(ADS.pos, ads);
    p.copy(this.bobBase);
    const bobK = (1 - ads * 0.85) * Math.min(1, speed / 4);
    p.x += bobX * 0.9 * bobK + this.swayX;
    p.y += bobY * 1.2 * bobK + this.swayY * 0.6 - dip * 0.16 * RELOAD_DIP.length();
    p.z += k * 0.045 + dip * 0.03;
    const r = this.root.rotation;
    this.tmp.copy(HIP.rot).lerp(ADS.rot, ads);
    r.x = this.tmp.x - k * 0.06 + dip * 0.35 + this.swayY * 0.8;
    r.y = this.tmp.y + this.swayX * 1.2 + k * this.kickSide * 0.03;
    r.z = this.tmp.z + this.swayX * 0.6 - dip * 0.25 + k * this.kickSide * 0.05;
    this.muzzleAnchor.getWorldPosition(this.muzzleWorld);
    this.ejectAnchor.getWorldPosition(this.ejectWorld);
  }

  reset(): void {
    this.kick = 0;
    this.shotIndex = 0;
    this.reloadT = 0;
    this.swayX = this.swayY = 0;
  }
}
