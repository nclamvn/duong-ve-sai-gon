/**
 * Pháo sáng (M2 R1, kịch bản C2 "ánh sáng đung đưa, bóng quay"): đèn trắng-vàng treo dù rơi chậm (~2,5 m/s), đung đưa theo
 * con lắc, sáng nhấp nháy nhẹ, để lại vệt khói; tối đa `max` quả cùng lúc (PointLight rẻ, không đổ bóng — CSM chỉ từ mặt trời).
 * Engine thuần three; game/mission quyết định khi nào bắn (flag `flares`).
 */
import { Group, Mesh, PointLight, SphereGeometry, MeshBasicNodeMaterial, Color, type Scene } from 'three/webgpu';

export interface FlareOptions {
  max?: number;
  /** cường độ đèn (cd, decay 1,6) — pháo sáng cối 81 mm thật ~ 350 000 cd; game nén 9 000 để không cháy sáng ở tầm 100 m */
  intensity?: number;
  distance?: number;
  /** tốc độ rơi m/s */
  fall?: number;
  /** tuổi thọ giây */
  life?: number;
}

interface Flare {
  light: PointLight;
  bulb: Mesh;
  x: number;
  y: number;
  z: number;
  phase: number;
  age: number;
  life: number;
  /** cao độ mặt đất tại x/z (tắt khi chạm) */
  ground: number;
}

export class Flares {
  readonly group = new Group();
  readonly pool: Flare[] = [];
  private readonly opts: Required<FlareOptions>;
  private head = 0;
  readonly stats = { fired: 0, active: 0 };
  private static geo: SphereGeometry | null = null;
  private static mat: MeshBasicNodeMaterial | null = null;

  constructor(scene: Scene, opts: FlareOptions = {}) {
    this.opts = { max: opts.max ?? 3, intensity: opts.intensity ?? 9000, distance: opts.distance ?? 420, fall: opts.fall ?? 2.4, life: opts.life ?? 34 };
    this.group.name = 'flares';
    Flares.geo ??= new SphereGeometry(0.9, 10, 8);
    if (!Flares.mat) {
      Flares.mat = new MeshBasicNodeMaterial({ color: 0xfff1c8 });
      Flares.mat.toneMapped = false;
    }
    for (let i = 0; i < this.opts.max; i++) {
      const light = new PointLight(new Color(0xffe6b0), 0, this.opts.distance, 1.6);
      light.castShadow = false;
      light.visible = false;
      const bulb = new Mesh(Flares.geo, Flares.mat);
      bulb.visible = false;
      bulb.frustumCulled = false;
      this.group.add(light, bulb);
      this.pool.push({ light, bulb, x: 0, y: 0, z: 0, phase: 0, age: 0, life: 0, ground: 0 });
    }
    scene.add(this.group);
  }

  /** Bắn một quả tại (x, y, z) (y = cao độ nổ, ~120–150 m trên đất); `ground` = mặt đất để tắt khi chạm. */
  fire(x: number, y: number, z: number, ground: number, phase = 0): void {
    const f = this.pool[this.head]!;
    this.head = (this.head + 1) % this.pool.length;
    f.x = x;
    f.y = y;
    f.z = z;
    f.phase = phase;
    f.age = 0;
    f.life = this.opts.life;
    f.ground = ground;
    f.light.visible = true;
    f.bulb.visible = true;
    this.stats.fired++;
  }

  update(dt: number): void {
    let active = 0;
    for (const f of this.pool) {
      if (f.life <= 0) continue;
      f.age += dt;
      f.life -= dt;
      f.y -= this.opts.fall * dt;
      if (f.life <= 0 || f.y <= f.ground + 1.5) {
        f.life = 0;
        f.light.visible = false;
        f.bulb.visible = false;
        f.light.intensity = 0;
        continue;
      }
      active++;
      // con lắc dù: biên độ 6 m, chu kỳ ~5 s, giảm dần; nhấp nháy 0,85–1,0
      const sw = 6 * Math.exp(-f.age * 0.03);
      const px = f.x + Math.sin(f.age * 1.25 + f.phase) * sw;
      const pz = f.z + Math.cos(f.age * 0.9 + f.phase * 1.7) * sw * 0.6;
      const fadeIn = Math.min(1, f.age / 1.2);
      const fadeOut = Math.min(1, f.life / 5);
      const flick = 0.85 + 0.15 * Math.sin(f.age * 23 + f.phase) * Math.sin(f.age * 7.3);
      f.light.position.set(px, f.y, pz);
      f.light.intensity = this.opts.intensity * fadeIn * fadeOut * flick;
      f.bulb.position.set(px, f.y, pz);
      const sc = 0.8 + 0.6 * fadeIn * fadeOut;
      f.bulb.scale.setScalar(sc);
    }
    this.stats.active = active;
  }

  dispose(): void {
    this.group.removeFromParent();
  }
}
