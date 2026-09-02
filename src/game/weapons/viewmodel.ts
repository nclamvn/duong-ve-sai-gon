/**
 * Viewmodel AR góc nhìn thứ nhất (TIP-010): procedural từ primitive, gắn camera. Không asset ngoài.
 * hip ↔ ADS lerp theo weapon.ads, bob/sway theo CameraRig + chuột, kick khi bắn, dip khi reload.
 * Xuất `muzzleWorld` cho FX (flash/spark/tracer bắt đầu đúng đầu nòng). Chỉ render-side.
 */
import { Group, Mesh, BoxGeometry, CylinderGeometry, MeshStandardNodeMaterial, Vector3, type PerspectiveCamera } from 'three/webgpu';

const SCALE = 0.62; // súng thu nhỏ để vừa FOV 90 và không che tâm ngắm
const HIP = { pos: new Vector3(0.2, -0.175, -0.34), rot: new Vector3(0.03, 0.08, 0.03) };
const ADS = { pos: new Vector3(0.0, -0.062, -0.3), rot: new Vector3(0, 0, 0) };
const RELOAD_DIP = new Vector3(0.05, -0.16, 0.06);

export class WeaponViewModel {
  readonly root = new Group();
  private readonly muzzleAnchor = new Group();
  readonly muzzleWorld = new Vector3();
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

  constructor(camera: PerspectiveCamera) {
    const gunmetal = new MeshStandardNodeMaterial({ color: 0x1b1e22, roughness: 0.42, metalness: 0.75 });
    const polymer = new MeshStandardNodeMaterial({ color: 0x24282c, roughness: 0.8, metalness: 0.1 });
    const rail = new MeshStandardNodeMaterial({ color: 0x0f1113, roughness: 0.5, metalness: 0.6 });
    const glove = new MeshStandardNodeMaterial({ color: 0x2f2a25, roughness: 0.95, metalness: 0.0 });
    const add = (geo: BoxGeometry | CylinderGeometry, mat: MeshStandardNodeMaterial, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): Mesh => {
      const m = new Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      m.castShadow = false;
      m.receiveShadow = false;
      m.frustumCulled = false;
      this.root.add(m);
      return m;
    };
    // Súng nằm dọc trục −z của root (nòng ở −z). Kích thước theo AR thật, rút ngắn cho FOV 90.
    add(new BoxGeometry(0.052, 0.07, 0.26), gunmetal, 0, 0, -0.02); // receiver
    add(new BoxGeometry(0.058, 0.02, 0.24), rail, 0, 0.045, -0.06); // rail trên
    add(new BoxGeometry(0.056, 0.066, 0.24), polymer, 0, -0.004, -0.29); // handguard
    add(new CylinderGeometry(0.011, 0.011, 0.24, 10), gunmetal, 0, 0.012, -0.5, Math.PI / 2); // nòng
    add(new CylinderGeometry(0.016, 0.016, 0.05, 10), gunmetal, 0, 0.012, -0.61, Math.PI / 2); // giảm giật đầu nòng
    add(new BoxGeometry(0.04, 0.17, 0.06), polymer, 0, -0.115, 0.0, 0.08); // băng đạn
    add(new BoxGeometry(0.03, 0.09, 0.05), polymer, 0, -0.07, 0.11, -0.35); // tay cầm
    add(new BoxGeometry(0.048, 0.06, 0.2), polymer, 0, 0.0, 0.22); // báng
    add(new BoxGeometry(0.03, 0.035, 0.03), rail, 0, 0.075, -0.16); // đầu ruồi
    add(new BoxGeometry(0.036, 0.03, 0.04), rail, 0, 0.072, 0.03); // thước ngắm sau
    add(new BoxGeometry(0.008, 0.012, 0.004), rail, 0, 0.096, -0.16); // cột ruồi
    add(new BoxGeometry(0.02, 0.05, 0.02), gunmetal, 0.03, 0.02, 0.02); // tay kéo
    add(new BoxGeometry(0.07, 0.06, 0.09), glove, 0.005, -0.06, 0.1, -0.3); // tay phải (bao tay)
    add(new BoxGeometry(0.075, 0.055, 0.1), glove, -0.01, -0.045, -0.3, 0.2, 0, -0.35); // tay trái đỡ ốp lót
    this.muzzleAnchor.position.set(0, 0.012, -0.64);
    this.root.add(this.muzzleAnchor);
    this.root.scale.setScalar(SCALE);
    this.root.position.copy(HIP.pos);
    camera.add(this.root);
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
    // sway theo chuột (lag) — nhỏ hơn khi ADS
    const swayK = 1 - ads * 0.8;
    this.swayX += (Math.max(-30, Math.min(30, -dx)) * 0.0009 * swayK - this.swayX) * Math.min(1, dt * 12);
    this.swayY += (Math.max(-30, Math.min(30, dy)) * 0.0007 * swayK - this.swayY) * Math.min(1, dt * 12);
    // kick hồi
    this.kick = Math.max(0, this.kick - dt * 9);
    const k = this.kick * this.kick;
    // reload dip
    let dip = 0;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      const u = 1 - Math.max(0, this.reloadT) / this.reloadDur; // 0→1
      dip = Math.sin(Math.min(1, u) * Math.PI); // lên–xuống mượt
    }
    // vị trí: lerp hip→ADS, cộng bob (giảm khi ADS), kick về sau, dip
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
  }

  reset(): void {
    this.kick = 0;
    this.shotIndex = 0;
    this.reloadT = 0;
    this.swayX = this.swayY = 0;
  }
}
