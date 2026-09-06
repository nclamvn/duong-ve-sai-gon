/**
 * Weapon (PRD WPN-001..004): SM + recoil + hitscan + ammo. Không spawn VFX/SFX — phát event qua EventBus:
 * WEAPON_FIRED, HIT, IMPACT, RELOAD_START, RELOAD_END, WEAPON_EMPTY. Snapshot/restore cho checkpoint.
 */
import type { EventBus } from '@engine/core';
import type { Prng } from '@engine/core';
import type { PhysicsWorld } from '@engine/physics/world';
import type { InputSnapshot } from '@engine/input/input';
import type RAPIER from '@dimforge/rapier3d-compat';
import { WeaponStateMachine, type WeaponState } from './stateMachine';
import { RecoilTracker } from './recoil';
import { resolveShot, type HitResult } from './hitscan';
import weaponsJson from '@content/tuning/weapons.json';

export type WeaponId = keyof typeof weaponsJson extends infer K ? Exclude<K, '$comment'> : never;
export type WeaponDef = (typeof weaponsJson)['ar_v1'];

export interface WeaponEvents extends Record<string, unknown> {
  WEAPON_FIRED: { weapon: string; origin: [number, number, number]; dir: [number, number, number]; shotIndex: number; ads: number };
  HIT: { actorId: string; zone: 'head' | 'body'; damage: number; point: [number, number, number]; penetrated: boolean; shooter?: string };
  IMPACT: { point: [number, number, number]; normal: [number, number, number]; material: string; penetrated: boolean };
  RELOAD_START: { weapon: string };
  RELOAD_END: { weapon: string; mag: number; reserve: number };
  WEAPON_EMPTY: { weapon: string };
  [k: string]: unknown;
}

export interface ShooterContext {
  /** vị trí mắt/nòng (world) */
  origin: [number, number, number];
  /** hướng ngắm gốc (đơn vị) */
  aim: [number, number, number];
  stance: 'stand' | 'crouch';
  moving: boolean;
  grounded: boolean;
  /** collider của người bắn để loại trừ */
  exclude: RAPIER.Collider | undefined;
}

export function getWeaponDef(id: string): WeaponDef {
  const d = (weaponsJson as Record<string, unknown>)[id] as WeaponDef | undefined;
  if (!d) throw new Error(`weapon def not found: ${id}`);
  return d;
}

export class Weapon {
  readonly id: string;
  readonly def: WeaponDef;
  readonly sm: WeaponStateMachine;
  readonly recoil: RecoilTracker;
  private prng: Prng;
  private readonly hits: HitResult[] = [];
  private readonly kickOut: [number, number] = [0, 0];
  private readonly aimWithRecoil: [number, number, number] = [0, 0, 0];
  /** callback view kick → CameraRig (không import player) */
  onViewKick: ((yawRad: number, pitchRad: number) => void) | null = null;
  private pendingShots = 0;
  private lastShotIndex = 0;
  private prevReload = false;
  spreadDeg = 0;

  constructor(
    id: string,
    private readonly world: PhysicsWorld,
    private readonly events: EventBus<WeaponEvents>,
    prng: Prng,
  ) {
    this.id = id;
    this.def = getWeaponDef(id);
    this.prng = prng.fork(`weapon:${id}`);
    this.sm = new WeaponStateMachine(
      { rpm: this.def.rpm, magSize: this.def.magSize, reserve: this.def.reserve, reloadMs: this.def.reloadMs, adsMs: this.def.adsMs, swapMs: this.def.swapMs, maxStateMs: this.def.maxStateMs },
      {
        onShot: (i) => {
          this.pendingShots++;
          this.lastShotIndex = i;
        },
        onReloadStart: () => this.events.emit('RELOAD_START', { weapon: this.id }),
        onReloadEnd: () => this.events.emit('RELOAD_END', { weapon: this.id, mag: this.sm.mag, reserve: this.sm.reserve }),
        onEmpty: () => this.events.emit('WEAPON_EMPTY', { weapon: this.id }),
      },
    );
    this.recoil = new RecoilTracker(this.def, this.prng.fork('recoil'));
  }

  get state(): WeaponState {
    return this.sm.state;
  }

  get ads(): number {
    return this.sm.ads;
  }

  computeSpread(ctx: ShooterContext): number {
    const s = this.def.spread;
    let base = ctx.moving ? s.hipMove : s.hipStand;
    base = base + (s.ads - base) * this.sm.ads;
    if (ctx.stance === 'crouch') base *= s.crouchMul;
    if (!ctx.grounded) base *= s.airMul;
    return base;
  }

  /** Gọi ở sim tick 60 Hz. */
  step(input: InputSnapshot, ctx: ShooterContext, dt: number): void {
    if (input.fire) this.sm.pressFire();
    else this.sm.releaseFire();
    this.sm.setAds(input.ads);
    if (input.reload && !this.prevReload) this.sm.pressReload();
    this.prevReload = input.reload;
    this.pendingShots = 0;
    this.sm.tick(dt * 1000);
    this.recoil.recover(dt);
    this.spreadDeg = this.computeSpread(ctx);
    while (this.pendingShots > 0) {
      this.pendingShots--;
      this.fire(ctx);
    }
  }

  private fire(ctx: ShooterContext): void {
    const k = this.recoil.kick(this.kickOut);
    this.onViewKick?.(k[0], k[1]);
    // hướng bắn = aim gốc + offset recoil tích lũy (yaw/pitch nhỏ → xấp xỉ xoay)
    const a = ctx.aim;
    const ry = this.recoil.yaw;
    const rp = this.recoil.pitch;
    const cy = Math.cos(ry);
    const sy = Math.sin(ry);
    // xoay quanh trục y (yaw) rồi nâng pitch
    const x1 = a[0] * cy + a[2] * sy;
    const z1 = -a[0] * sy + a[2] * cy;
    const horiz = Math.hypot(x1, z1) || 1;
    const pitch0 = Math.atan2(a[1], horiz);
    const pitch1 = pitch0 + rp;
    const hl = Math.cos(pitch1);
    this.aimWithRecoil[0] = (x1 / horiz) * hl;
    this.aimWithRecoil[1] = Math.sin(pitch1);
    this.aimWithRecoil[2] = (z1 / horiz) * hl;

    this.events.emit('WEAPON_FIRED', { weapon: this.id, origin: [ctx.origin[0], ctx.origin[1], ctx.origin[2]], dir: [this.aimWithRecoil[0], this.aimWithRecoil[1], this.aimWithRecoil[2]], shotIndex: this.lastShotIndex, ads: this.sm.ads });
    resolveShot(this.world, ctx.origin, this.aimWithRecoil, this.spreadDeg, this.def, this.prng, ctx.exclude, this.hits);
    for (let i = 0; i < this.hits.length; i++) {
      const h = this.hits[i]!;
      if (h.kind === 'actor' && h.actorId) this.events.emit('HIT', { actorId: h.actorId, zone: h.zone ?? 'body', damage: h.damage, point: h.point, penetrated: h.penetrated, shooter: 'player' });
      else this.events.emit('IMPACT', { point: h.point, normal: h.normal, material: h.material, penetrated: h.penetrated });
    }
  }

  snapshot(): { id: string; mag: number; reserve: number } {
    return { id: this.id, mag: this.sm.mag, reserve: this.sm.reserve };
  }

  restore(s: { mag: number; reserve: number }): void {
    this.sm.restore(s);
    this.recoil.reset();
  }

  reset(prng: Prng): void {
    this.prng = prng.fork(`weapon:${this.id}`);
    this.recoil.setPrng(this.prng.fork('recoil'));
    this.sm.reset();
    this.recoil.reset();
    this.prevReload = false;
  }
}
