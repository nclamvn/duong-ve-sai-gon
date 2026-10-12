/**
 * Lựu đạn (DV-074): đạn đạo có trọng lực, va chạm bằng tia WORLD theo từng đoạn + mặt đất heightfield, nảy (restitution/ma sát),
 * nằm yên khi chậm, nổ sau fuse qua callback `explode`. Thuần logic (không three/DOM), tất định theo bước 60 Hz.
 * `solveLob` tính vận tốc ném tới một điểm với góc cố định (AI); `live()` cho AI chạy khỏi vùng nổ và HUD cảnh báo.
 */
import G from '@content/tuning/grenade.json';
import { LAYER } from '@engine/physics/layers';
import type { PhysicsWorld } from '@engine/physics/world';

type V3 = [number, number, number];

export interface Grenade {
  readonly id: number;
  readonly pos: V3;
  readonly vel: V3;
  /** ms còn lại tới khi nổ */
  fuseMs: number;
  /** id người ném ('player' hoặc id bot) */
  readonly owner: string;
  readonly faction: 'player' | 'enemy' | 'friend';
  /** đã chạm đất ít nhất một lần */
  landed: boolean;
  resting: boolean;
  bounces: number;
}

export interface GrenadeDeps {
  physics: Pick<PhysicsWorld, 'castRay' | 'hasLineOfSight'>;
  groundHeight?: (x: number, z: number) => number | null;
  /** nổ: Game lo FX, âm, sát thương */
  explode: (g: Grenade) => void;
  /** tiếng nảy (tuỳ chọn) */
  onBounce?: (g: Grenade, speed: number) => void;
}

export const GRENADE = G;

/**
 * Vận tốc ném từ `from` tới `to` với góc nâng `deg` (độ); không với tới bằng `maxSpeed` → nâng góc tới 60°; vẫn không → ném xa nhất
 * có thể theo hướng đó. Trả về [vx, vy, vz].
 */
export function solveLob(from: Readonly<V3>, to: Readonly<V3>, deg: number, maxSpeed: number, g = -G.gravity): V3 {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const d = Math.max(0.5, Math.hypot(dx, dz));
  const h = to[1] - from[1];
  const ux = dx / d;
  const uz = dz / d;
  for (let a = deg; a <= 60; a += 5) {
    const t = (a * Math.PI) / 180;
    const c = Math.cos(t);
    const den = 2 * c * c * (d * Math.tan(t) - h);
    if (den <= 0) continue;
    const v = Math.sqrt((g * d * d) / den);
    if (v <= maxSpeed) return [ux * v * c, v * Math.sin(t), uz * v * c];
  }
  const t = (45 * Math.PI) / 180;
  return [ux * maxSpeed * Math.cos(t), maxSpeed * Math.sin(t), uz * maxSpeed * Math.cos(t)];
}

export class GrenadeSystem {
  private readonly list: Grenade[] = [];
  private seq = 0;
  readonly stats = { thrown: 0, exploded: 0, bounces: 0, playerThrown: 0, aiThrown: 0 };

  constructor(private readonly deps: GrenadeDeps) {}

  live(): readonly Grenade[] {
    return this.list;
  }

  /** ném: trả về quả lựu đạn, hoặc null nếu đã đủ maxLive */
  spawn(from: Readonly<V3>, vel: Readonly<V3>, owner: string, faction: Grenade['faction'], fuseMs = G.fuseMs): Grenade | null {
    if (this.list.length >= G.maxLive) return null;
    const g: Grenade = { id: ++this.seq, pos: [from[0], from[1], from[2]], vel: [vel[0], vel[1], vel[2]], fuseMs, owner, faction, landed: false, resting: false, bounces: 0 };
    this.list.push(g);
    this.stats.thrown++;
    if (owner === 'player') this.stats.playerThrown++;
    else this.stats.aiThrown++;
    return g;
  }

  tick(dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const g = this.list[i]!;
      g.fuseMs -= dt * 1000;
      if (g.fuseMs <= 0) {
        this.list.splice(i, 1);
        this.stats.exploded++;
        this.deps.explode(g);
        continue;
      }
      if (!g.resting) this.integrate(g, dt);
    }
  }

  clear(): void {
    this.list.length = 0;
  }

  private integrate(g: Grenade, dt: number): void {
    const p = g.pos;
    const v = g.vel;
    v[1] += G.gravity * dt;
    const sx = v[0] * dt;
    const sy = v[1] * dt;
    const sz = v[2] * dt;
    const len = Math.hypot(sx, sy, sz);
    let nx = 0;
    let ny = 1;
    let nz = 0;
    let hit = false;
    if (len > 1e-6) {
      const r = this.deps.physics.castRay(p[0], p[1], p[2], sx / len, sy / len, sz / len, len + G.bodyRadius, LAYER.WORLD);
      if (r) {
        const back = Math.max(0, r.toi - G.bodyRadius);
        p[0] += (sx / len) * back;
        p[1] += (sy / len) * back;
        p[2] += (sz / len) * back;
        nx = r.normal[0];
        ny = r.normal[1];
        nz = r.normal[2];
        hit = true;
      }
    }
    if (!hit) {
      p[0] += sx;
      p[1] += sy;
      p[2] += sz;
    }
    const gh = this.deps.groundHeight?.(p[0], p[2]);
    if (gh !== null && gh !== undefined && p[1] < gh + G.bodyRadius) {
      p[1] = gh + G.bodyRadius;
      if (!hit) {
        // pháp tuyến địa hình bằng sai phân
        const e = 0.5;
        const hx = (this.deps.groundHeight!(p[0] + e, p[2]) ?? gh) - (this.deps.groundHeight!(p[0] - e, p[2]) ?? gh);
        const hz = (this.deps.groundHeight!(p[0], p[2] + e) ?? gh) - (this.deps.groundHeight!(p[0], p[2] - e) ?? gh);
        const l = Math.hypot(hx, 2 * e, hz);
        nx = -hx / l;
        ny = (2 * e) / l;
        nz = -hz / l;
        hit = true;
      }
    }
    if (!hit) return;
    const vn = v[0] * nx + v[1] * ny + v[2] * nz;
    if (vn >= 0) return; // đang rời mặt
    // tách pháp tuyến / tiếp tuyến: pháp tuyến nảy ngược × restitution, tiếp tuyến × ma sát
    const tx = v[0] - vn * nx;
    const ty = v[1] - vn * ny;
    const tz = v[2] - vn * nz;
    const speed = Math.hypot(v[0], v[1], v[2]);
    v[0] = tx * G.friction - vn * G.restitution * nx;
    v[1] = ty * G.friction - vn * G.restitution * ny;
    v[2] = tz * G.friction - vn * G.restitution * nz;
    if (ny > 0.5) g.landed = true;
    g.bounces++;
    this.stats.bounces++;
    if (speed > 1.5) this.deps.onBounce?.(g, speed);
    if (ny > 0.5 && Math.hypot(v[0], v[1], v[2]) < G.restSpeed) {
      g.resting = true;
      v[0] = v[1] = v[2] = 0;
    }
  }
}
