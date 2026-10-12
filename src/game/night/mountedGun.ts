/**
 * Đại liên 12,7 mm DShKM trên giá phòng không (DV-078): logic thuần. Xoay ngang tự do, ngẩng −6..80°, ~600 phát/phút, băng 50,
 * thay hộp đạn khi hết (hoặc R). Đạn bay thật (sơ tốc 840 m/s + trọng lực) để người chơi phải bắn đón máy bay; cứ `tracerEvery`
 * viên có một viên vạch đường (xanh). Mỗi tick kiểm đoạn bay của từng viên với máy bay (`test`) và mặt đất (`groundY`).
 *
 * Quy ước hướng như camera người chơi: yaw 0 nhìn −z, pitch dương ngẩng lên; hướng = (−sin yaw·cos pitch, sin pitch, −cos yaw·cos pitch).
 */
import type { Prng } from '@engine/core';

export interface DshkConfig {
  rpm: number;
  belt: number;
  reloadS: number;
  muzzleVelocity: number;
  gravity: number;
  spreadDeg: number;
  tracerEvery: number;
  lifeS: number;
  pitchMinDeg: number;
  pitchMaxDeg: number;
  /** trục ngẩng so với chân giá (m) */
  pivot: [number, number, number];
  /** đầu nòng so với trục ngẩng (hệ súng: −z = nòng) */
  muzzle: [number, number, number];
  /** mắt xạ thủ (thước ngắm vòng) so với trục ngẩng */
  eye: [number, number, number];
  /** chỗ xạ thủ đứng sau giá (m) */
  gunnerBack: number;
  kickPitch: number;
  shake: number;
  mountRadius: number;
}

export interface Round {
  pos: [number, number, number];
  vel: [number, number, number];
  prev: [number, number, number];
  age: number;
  tracer: boolean;
  live: boolean;
  /** khoảng cách gần nhất tới máy bay đã thấy (sượt) */
  minDist: number;
  near: boolean;
}

export interface SegmentTest {
  (p0: readonly number[], p1: readonly number[]): { hit: boolean; dist: number };
}

export interface DshkEvents {
  /** bắn một viên (lửa đầu nòng, âm, giật) */
  fire(muzzle: readonly number[], dir: readonly number[], tracer: boolean): void;
  /** viên trúng máy bay */
  hitAir(at: readonly number[]): void;
  /** viên sượt gần máy bay (một lần mỗi viên, khi bắt đầu xa ra) */
  nearMiss(dist: number): void;
  /** viên chạm đất */
  ground(at: readonly number[]): void;
  reload(): void;
}

const DEG = Math.PI / 180;

export class MountedGun {
  yaw = 0;
  pitch = 0.3;
  mag: number;
  reloading = 0;
  private cool = 0;
  private shot = 0;
  readonly rounds: Round[] = [];
  /** chân giá (world): x, y mặt đất, z */
  readonly base: [number, number, number];
  readonly stats = { fired: 0, hits: 0, nearMisses: 0, ground: 0, reloads: 0 };

  constructor(
    readonly cfg: DshkConfig,
    base: readonly number[],
    private readonly prng: Prng,
    private readonly ev: Partial<DshkEvents> = {},
  ) {
    this.base = [base[0]!, base[1]!, base[2]!];
    this.mag = cfg.belt;
    for (let i = 0; i < 64; i++) this.rounds.push({ pos: [0, 0, 0], vel: [0, 0, 0], prev: [0, 0, 0], age: 0, tracer: false, live: false, minDist: Infinity, near: false });
  }

  /** đặt hướng (kẹp ngẩng) */
  aim(yaw: number, pitch: number): void {
    this.yaw = yaw;
    this.pitch = Math.max(this.cfg.pitchMinDeg * DEG, Math.min(this.cfg.pitchMaxDeg * DEG, pitch));
  }

  /** điểm hệ súng (so với trục ngẩng) → world, theo yaw/pitch hiện tại */
  toWorld(local: readonly number[], out: [number, number, number] = [0, 0, 0]): [number, number, number] {
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    // ngẩng quanh x: y' = y·cp − z·sp ; z' = y·sp + z·cp
    const y1 = local[1]! * cp - local[2]! * sp;
    const z1 = local[1]! * sp + local[2]! * cp;
    const x1 = local[0]!;
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    // xoay ngang quanh y: x' = x·cy + z·sy ; z' = −x·sy + z·cy
    out[0] = this.base[0] + this.cfg.pivot[0] + x1 * cy + z1 * sy;
    out[1] = this.base[1] + this.cfg.pivot[1] + y1;
    out[2] = this.base[2] + this.cfg.pivot[2] - x1 * sy + z1 * cy;
    return out;
  }

  dir(out: [number, number, number] = [0, 0, 0]): [number, number, number] {
    out[0] = -Math.sin(this.yaw) * Math.cos(this.pitch);
    out[1] = Math.sin(this.pitch);
    out[2] = -Math.cos(this.yaw) * Math.cos(this.pitch);
    return out;
  }

  /** chỗ chân xạ thủ (sau giá theo yaw) */
  gunnerFeet(out: [number, number, number] = [0, 0, 0]): [number, number, number] {
    out[0] = this.base[0] + Math.sin(this.yaw) * this.cfg.gunnerBack;
    out[1] = this.base[1];
    out[2] = this.base[2] + Math.cos(this.yaw) * this.cfg.gunnerBack;
    return out;
  }

  startReload(): boolean {
    if (this.reloading > 0 || this.mag >= this.cfg.belt) return false;
    this.reloading = this.cfg.reloadS;
    this.stats.reloads++;
    this.ev.reload?.();
    return true;
  }

  private readonly _m: [number, number, number] = [0, 0, 0];
  private readonly _d: [number, number, number] = [0, 0, 0];

  /**
   * Một tick: nạp/bắn theo cò, rồi bay đạn và kiểm va chạm. `trigger` = đang giữ cò (chỉ khi đang ngồi súng).
   */
  step(dt: number, trigger: boolean, reload: boolean, test: SegmentTest, groundY: (x: number, z: number) => number, nearR = 45): void {
    const c = this.cfg;
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        this.reloading = 0;
        this.mag = c.belt;
      }
    } else if (reload) this.startReload();
    this.cool -= dt;
    const interval = 60 / c.rpm;
    while (trigger && this.reloading <= 0 && this.mag > 0 && this.cool <= 0) {
      this.cool += interval;
      this.fireOne();
      if (this.mag === 0) this.startReload();
    }
    if (this.cool < 0 && !trigger) this.cool = 0;
    // bay đạn
    for (const r of this.rounds) {
      if (!r.live) continue;
      r.prev[0] = r.pos[0];
      r.prev[1] = r.pos[1];
      r.prev[2] = r.pos[2];
      r.vel[1] -= c.gravity * dt;
      r.pos[0] += r.vel[0] * dt;
      r.pos[1] += r.vel[1] * dt;
      r.pos[2] += r.vel[2] * dt;
      r.age += dt;
      const h = test(r.prev, r.pos);
      if (h.hit) {
        r.live = false;
        this.stats.hits++;
        this.ev.hitAir?.(r.pos);
        continue;
      }
      if (h.dist < r.minDist) r.minDist = h.dist;
      else if (!r.near && r.minDist <= nearR && h.dist > r.minDist + 1) {
        r.near = true;
        this.stats.nearMisses++;
        this.ev.nearMiss?.(r.minDist);
      }
      if (r.pos[1] < groundY(r.pos[0], r.pos[2])) {
        r.live = false;
        this.stats.ground++;
        this.ev.ground?.(r.pos);
        continue;
      }
      if (r.age >= c.lifeS) r.live = false;
    }
  }

  private fireOne(): void {
    const c = this.cfg;
    this.mag--;
    this.shot++;
    this.stats.fired++;
    const m = this.toWorld(c.muzzle, this._m);
    const d = this.dir(this._d);
    // tản mát hình nón
    const s = c.spreadDeg * DEG;
    const a = this.prng.next() * Math.PI * 2;
    const r = s * Math.sqrt(this.prng.next());
    // hai trục vuông góc với d
    const ux = -Math.cos(this.yaw);
    const uz = Math.sin(this.yaw);
    const vx = Math.sin(this.yaw) * Math.sin(this.pitch);
    const vy = Math.cos(this.pitch);
    const vz = Math.cos(this.yaw) * Math.sin(this.pitch);
    const dx = d[0] + (ux * Math.cos(a) + vx * Math.sin(a)) * r;
    const dy = d[1] + vy * Math.sin(a) * r;
    const dz = d[2] + (uz * Math.cos(a) + vz * Math.sin(a)) * r;
    const l = Math.hypot(dx, dy, dz) || 1;
    let slot = this.rounds.find((x) => !x.live);
    if (!slot) {
      // pool đầy: tái dùng viên già nhất
      slot = this.rounds.reduce((o, x) => (x.age > o.age ? x : o), this.rounds[0]!);
    }
    slot.live = true;
    slot.age = 0;
    slot.tracer = this.shot % c.tracerEvery === 0;
    slot.minDist = Infinity;
    slot.near = false;
    slot.pos[0] = slot.prev[0] = m[0];
    slot.pos[1] = slot.prev[1] = m[1];
    slot.pos[2] = slot.prev[2] = m[2];
    slot.vel[0] = (dx / l) * c.muzzleVelocity;
    slot.vel[1] = (dy / l) * c.muzzleVelocity;
    slot.vel[2] = (dz / l) * c.muzzleVelocity;
    this.ev.fire?.(m, [dx / l, dy / l, dz / l], slot.tracer);
  }

  reset(): void {
    this.mag = this.cfg.belt;
    this.reloading = 0;
    this.cool = 0;
    this.shot = 0;
    this.yaw = 0;
    this.pitch = 0.3;
    for (const r of this.rounds) r.live = false;
    for (const k of Object.keys(this.stats) as Array<keyof MountedGun['stats']>) this.stats[k] = 0;
  }
}
