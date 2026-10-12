/**
 * Hồi đêm Ngầm Ta Lê (DV-078) — phần logic thuần ghép đoàn xe + AC-130 + đại liên: đạn máy bay chạm đất → sát thương xe/người
 * chơi; đạn 12,7 trúng/sượt máy bay → áp lực; máy bay bắn vào đoạn trống → xe chờ dưới tán. Không three/DOM: night act (hình,
 * âm, HUD) lắng nghe qua `NightHooks`; unit test chạy cả đêm bằng người chơi giả lập.
 */
import type { Prng } from '@engine/core';
import { Convoy, RoadPath, type ConvoyConfig, type ConvoyEvent } from './convoy';
import { Gunship, type GunshipConfig, type GunshipPhase, type Shell } from './gunship';
import { MountedGun, type DshkConfig } from './mountedGun';

export interface NightConfig {
  convoy: ConvoyConfig & { road: string };
  gunship: GunshipConfig;
  dshk: DshkConfig & { crew: { sigmaDeg: number; burstS: number; pauseS: number; reloadMul: number } };
}

export interface NightHooks {
  convoy(e: ConvoyEvent): void;
  shellFired(s: Shell): void;
  shellImpact(s: Shell): void;
  gunshipPhase(p: GunshipPhase, prev: GunshipPhase): void;
  gunshipWarn(): void;
  gunshipHit(): void;
  gunFire(muzzle: readonly number[], dir: readonly number[], tracer: boolean): void;
  gunHitAir(at: readonly number[]): void;
  gunGround(at: readonly number[]): void;
  gunReload(): void;
  /** người chơi trúng đạn máy bay */
  playerHit(damage: number, at: readonly number[]): void;
}

export interface NightInput {
  /** người chơi đang ngồi súng */
  mounted: boolean;
  trigger: boolean;
  reload: boolean;
  yaw: number;
  pitch: number;
  player: readonly number[];
  crouched: boolean;
  alive: boolean;
  pushing?: ReadonlyMap<number, number>;
  rescuing?: number | null;
  /** người chơi rời súng: đồng đội (Đạt, phụ xạ) ngồi thay, ngắm kém hơn (`dshk.crew`) */
  crewGun?: boolean;
}

export class NightLogic {
  readonly road: RoadPath;
  readonly convoy: Convoy;
  readonly gunship: Gunship;
  readonly gun: MountedGun;
  /** lần cuối đạn 40 ly rơi vào đoạn trống (s) */
  private lastOpenShellAt = -1e9;
  private t = 0;
  private leaveAt = -1;
  readonly stats = { playerHits: 0, playerDamage: 0 };

  constructor(
    readonly cfg: NightConfig,
    roadPts: ReadonlyArray<readonly [number, number]>,
    gunBase: readonly number[],
    private readonly groundY: (x: number, z: number) => number,
    prng: Prng,
    private readonly hooks: Partial<NightHooks> = {},
  ) {
    this.road = new RoadPath(roadPts);
    this.convoy = new Convoy(cfg.convoy, this.road, prng.fork('convoy'), (e) => this.onConvoy(e));
    const ford = this.road.at(cfg.convoy.fordS);
    this.gunship = new Gunship(
      cfg.gunship,
      [ford.x, groundY(ford.x, ford.z), ford.z],
      {
        groundY,
        targets: () =>
          this.convoy.exposed().map((tr) => {
            const p = this.convoy.pose(tr);
            const v = this.convoy.velocity(tr);
            return { id: tr.id, x: p.x, z: p.z, vx: v[0], vz: v[1] };
          }),
        gunPos: () => [this.gun.base[0], this.gun.base[2]],
      },
      prng.fork('gunship'),
      {
        fire: (s) => this.hooks.shellFired?.(s),
        impact: (s) => this.onImpact(s),
        phase: (p, prev) => this.hooks.gunshipPhase?.(p, prev),
        warn: () => this.hooks.gunshipWarn?.(),
        hit: () => this.hooks.gunshipHit?.(),
      },
    );
    this.crewNoise = prng.fork('crew');
    this.gun = new MountedGun(cfg.dshk, gunBase, prng.fork('dshk'), {
      fire: (m, d, tr) => this.hooks.gunFire?.(m, d, tr),
      hitAir: (at) => {
        this.gunship.onHit();
        this.hooks.gunHitAir?.(at);
      },
      nearMiss: () => this.gunship.onNearMiss(),
      ground: (at) => this.hooks.gunGround?.(at),
      reload: () => this.hooks.gunReload?.(),
    });
  }

  private player: readonly number[] = [0, 0, 0];
  private crouched = false;
  private alive = true;

  private onConvoy(e: ConvoyEvent): void {
    if (e.type === 'done' && this.leaveAt < 0) this.leaveAt = this.t + this.cfg.gunship.leaveAfterConvoyS;
    this.hooks.convoy?.(e);
  }

  private onImpact(s: Shell): void {
    const g = this.cfg.gunship;
    const [x, , z] = s.at;
    if (s.kind === 'bofors') {
      this.convoy.damageAt(x, z, g.bofors.blastR, g.bofors.truckDamage);
      const c = this.cfg.convoy;
      const pr = this.road.project(x, z);
      if (pr.d < 25 && pr.s >= c.fordS - c.openBefore - 10 && pr.s <= c.fordS + c.openAfter) this.lastOpenShellAt = this.t;
      this.playerSplash(s, g.bofors.blastR * 1.6, g.bofors.playerDamage, 0.4);
    } else if (s.kind === 'vulcan') {
      this.convoy.damageAt(x, z, g.vulcan.hitR, g.vulcan.truckDamage);
      this.playerSplash(s, g.vulcan.hitR, g.vulcan.playerDamage, 0.5);
    } else {
      this.playerSplash(s, g.minigun.hitR, g.minigun.playerDamage, g.minigun.crouchMul);
    }
    this.hooks.shellImpact?.(s);
  }

  private playerSplash(s: Shell, r: number, dmg: number, crouchMul: number): void {
    if (!this.alive) return;
    const d = Math.hypot(this.player[0]! - s.at[0], this.player[2]! - s.at[2]);
    if (d > r) return;
    const v = Math.round(dmg * (1 - (d / r) * 0.5) * (this.crouched ? crouchMul : 1));
    if (v <= 0) return;
    this.stats.playerHits++;
    this.stats.playerDamage += v;
    this.hooks.playerHit?.(v, s.at);
  }

  /** máy bay đang bắn vào đoạn trống (40 ly rơi trong 4 s qua) */
  get hazard(): boolean {
    return this.gunship.attacking && this.t - this.lastOpenShellAt < 4;
  }

  /** phụ xạ đang ngồi súng (người chơi rời súng) */
  crewOnGun = false;
  private crewBurst = 0;
  private readonly crewNoise: Prng;

  /** phụ xạ: bắn đón kém (sai số σ đổi chậm, không giật cục), loạt `burstS` nghỉ `pauseS`, chỉ khi máy bay đang lượn bắn */
  private crewAim(dt: number): boolean {
    const c = this.cfg.dshk.crew;
    const g = this.gunship;
    if (g.phase !== 'attack' && g.phase !== 'returning') {
      this.crewBurst = 0;
      return false;
    }
    const m = this.gun.toWorld(this.cfg.dshk.muzzle);
    const a = leadAngles(m, g.pos, g.vel, this.cfg.dshk.muzzleVelocity, this.cfg.dshk.gravity);
    const e = (c.sigmaDeg * Math.PI) / 180;
    // sai số trôi chậm (ngắm theo vệt đạn), mỗi loạt một độ lệch mới
    if (this.crewBurst <= 0) {
      this.crewErr[0] = this.crewNoise.gaussian() * e;
      this.crewErr[1] = this.crewNoise.gaussian() * e;
      this.crewBurst = c.burstS + c.pauseS;
    }
    this.crewBurst -= dt;
    this.gun.aim(a.yaw + this.crewErr[0], a.pitch + this.crewErr[1]);
    return this.crewBurst > c.pauseS;
  }

  private readonly crewErr: [number, number] = [0, 0];
  private readonly walkers: Array<{ s: number; d: number }> = [{ s: -1e9, d: 1e9 }];

  step(dt: number, inp: NightInput): void {
    this.t += dt;
    this.player = inp.player;
    this.crouched = inp.crouched;
    this.alive = inp.alive;
    this.crewOnGun = !inp.mounted && !!inp.crewGun;
    let trigger = inp.mounted && inp.trigger && inp.alive;
    if (inp.mounted) this.gun.aim(inp.yaw, inp.pitch);
    else if (this.crewOnGun) trigger = this.crewAim(dt);
    this.gun.step(dt, trigger, inp.mounted && inp.reload, (a, b) => this.gunship.testSegment(a, b), this.groundY, this.cfg.gunship.harass.nearMissR);
    this.gunship.step(dt);
    // người chơi đứng trên đường trước mũi xe → xe chờ (không cán)
    const pr = inp.alive ? this.road.project(inp.player[0]!, inp.player[2]!) : null;
    this.walkers[0] = pr ? { s: pr.s, d: pr.d } : { s: -1e9, d: 1e9 };
    this.convoy.step(dt, { pushing: inp.pushing, rescuing: inp.rescuing, hazard: this.hazard, walkers: this.walkers });
    if (this.leaveAt >= 0 && this.t >= this.leaveAt) {
      this.leaveAt = Infinity;
      this.gunship.leave();
    }
  }

  get time(): number {
    return this.t;
  }

  reset(): void {
    this.t = 0;
    this.lastOpenShellAt = -1e9;
    this.leaveAt = -1;
    this.convoy.reset();
    this.gunship.reset();
    this.gun.reset();
    this.stats.playerHits = 0;
    this.stats.playerDamage = 0;
  }
}

/**
 * Góc bắn đón (yaw, pitch) để đạn 12,7 (sơ tốc v, trọng lực g) gặp mục tiêu bay thẳng đều từ `muzzle` — lặp điểm gặp 4 lần.
 * Dùng cho test cân bằng và gợi ý vòng ngắm; người chơi tự ngắm.
 */
export function leadAngles(muzzle: readonly number[], target: readonly number[], vel: readonly number[], v: number, g: number): { yaw: number; pitch: number; tof: number } {
  let tof = 0;
  let px = target[0]!;
  let py = target[1]!;
  let pz = target[2]!;
  for (let i = 0; i < 5; i++) {
    const d = Math.hypot(px - muzzle[0]!, py - muzzle[1]!, pz - muzzle[2]!);
    tof = d / v;
    px = target[0]! + vel[0]! * tof;
    py = target[1]! + vel[1]! * tof + 0.5 * g * tof * tof; // bù rơi
    pz = target[2]! + vel[2]! * tof;
  }
  const dx = px - muzzle[0]!;
  const dy = py - muzzle[1]!;
  const dz = pz - muzzle[2]!;
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)), tof };
}
