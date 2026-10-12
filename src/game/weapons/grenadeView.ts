/**
 * Hình lựu đạn (DV-074): pool mesh nhỏ, tự dựng (không asset). Phe ta: lựu đạn chày (đầu trụ + cán gỗ); phe địch: quả "chanh"
 * ô liu. Xoay theo vận tốc khi bay, nằm yên khi đã dừng. Thuần trình bày; vị trí lấy từ GrenadeSystem.live().
 */
import { Group, Mesh, CylinderGeometry, SphereGeometry, MeshStandardNodeMaterial, type Scene } from 'three/webgpu';
import type { Grenade } from './grenades';

const POOL = 6;

export class GrenadeView {
  private readonly sticks: Group[] = [];
  private readonly eggs: Mesh[] = [];
  private readonly spin = new Map<number, number>();

  constructor(private readonly scene: Scene) {
    const metal = new MeshStandardNodeMaterial({ color: 0x3d4030, roughness: 0.6, metalness: 0.35 });
    const wood = new MeshStandardNodeMaterial({ color: 0x6b4a2a, roughness: 0.85, metalness: 0 });
    const olive = new MeshStandardNodeMaterial({ color: 0x4a5230, roughness: 0.55, metalness: 0.25 });
    const head = new CylinderGeometry(0.026, 0.026, 0.09, 10);
    const handle = new CylinderGeometry(0.013, 0.015, 0.16, 8);
    const egg = new SphereGeometry(0.033, 12, 10);
    for (let i = 0; i < POOL; i++) {
      const g = new Group();
      const h = new Mesh(head, metal);
      h.position.y = 0.08;
      const w = new Mesh(handle, wood);
      w.position.y = -0.045;
      g.add(h, w);
      g.visible = false;
      scene.add(g);
      this.sticks.push(g);
      const e = new Mesh(egg, olive);
      e.scale.set(1, 1.3, 1);
      e.visible = false;
      scene.add(e);
      this.eggs.push(e);
    }
  }

  sync(list: readonly Grenade[], dt: number): void {
    let si = 0;
    let ei = 0;
    for (const g of list) {
      const enemy = g.faction === 'enemy';
      const o = enemy ? this.eggs[ei++] : this.sticks[si++];
      if (!o) continue;
      o.visible = true;
      o.position.set(g.pos[0], g.pos[1] + (enemy ? 0 : 0.03), g.pos[2]);
      const sp = Math.hypot(g.vel[0], g.vel[1], g.vel[2]);
      const a = (this.spin.get(g.id) ?? 0) + sp * dt * 2.2;
      this.spin.set(g.id, a);
      if (g.resting) o.rotation.set(Math.PI / 2, a * 0.15, 0);
      else o.rotation.set(a, Math.atan2(g.vel[0], g.vel[2]), 0);
    }
    for (; si < this.sticks.length; si++) this.sticks[si]!.visible = false;
    for (; ei < this.eggs.length; ei++) this.eggs[ei]!.visible = false;
    if (this.spin.size > 32) this.spin.clear();
  }

  dispose(): void {
    for (const o of [...this.sticks, ...this.eggs]) this.scene.remove(o);
  }
}
