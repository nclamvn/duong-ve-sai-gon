/**
 * Chiến trường trong kịch bản (DV-084, M1-T3): lửa/khói động, đòn đánh một điểm, napalm có máy bay bay đúng đường, cối/pháo rơi
 * quanh người chơi có tiếng rít báo trước, vùng an toàn (ngoài vùng khi hết giờ là chịu sát thương), đồng đội hy sinh theo kịch
 * bản. Mọi ngẫu nhiên qua Prng fork (tất định), chạy theo sim time.
 *
 * Lửa/khói (DV-086): trường hạt engine/render/fireField — 4 draw call cho mọi đám cháy, lửa bùng lên rồi lụi dần theo thời gian
 * của trận, đèn cố định số lượng gán cho đám gần camera (không biên dịch lại shader). Nổ lớn (bom, napalm, đòn đánh) để lại hố
 * cháy âm ỉ + khói.
 */
import type { Group } from 'three/webgpu';
import type { Prng } from '@engine/core';
import { createFireField, SMOKE_BLACK, SMOKE_GREY, type FireField } from '@engine/render/fireField';
import type { Game } from '@game/game';
import type { MissionAction, MissionZone } from './types';

type V3 = [number, number, number];

/** số chỗ trong bể (đám lửa / cột khói) — napalm 120 m rải ~14 đám; DV-087 chiến trường dày khói lửa hơn */
const POOL = { fire: 40, smoke: 32 };
const FIRE_LIGHTS = 4;

interface Slot {
  idx: number;
  until: number;
  busy: boolean;
}

interface Heat {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  halfW: number;
  until: number;
  dps: number;
}

interface Shell {
  t: number;
  x: number;
  z: number;
  radius: number;
  damage: number;
  whistled: boolean;
  kind: 'mortar' | 'artillery' | 'napalm' | 'strike';
}

interface MortarRun {
  zone: MissionZone | null;
  until: number;
  next: number;
  perMin: number;
  radius: number;
  damage: number;
  spare: number;
  kind: 'mortar' | 'artillery';
}

interface SafeZone {
  zone: MissionZone;
  from: number;
  until: number;
  dps: number;
}

export class Battle {
  readonly group: Group;
  readonly fx: FireField;
  private readonly fires: Slot[] = [];
  private readonly smokes: Slot[] = [];
  private readonly shells: Shell[] = [];
  private readonly heats: Heat[] = [];
  private readonly mortars: MortarRun[] = [];
  private readonly safes: SafeZone[] = [];
  private t = 0;
  private heatAcc = 0;
  readonly stats = { fires: 0, smokes: 0, shells: 0, napalm: 0, kills: 0, heatHits: 0, safeHits: 0 };

  constructor(
    private readonly game: Game,
    private readonly zones: readonly MissionZone[],
    private readonly rng: Prng,
  ) {
    this.fx = createFireField({ fires: POOL.fire, smokes: POOL.smoke, lights: FIRE_LIGHTS });
    this.group = this.fx.group;
    this.group.name = 'battle_fx';
    for (let i = 0; i < POOL.fire; i++) this.fires.push({ idx: i, until: 0, busy: false });
    for (let i = 0; i < POOL.smoke; i++) this.smokes.push({ idx: i, until: 0, busy: false });
  }

  // ---------------------------------------------------------------- mission actions

  handle(a: MissionAction): void {
    switch (a.type) {
      case 'fx': {
        // DV-087 khói chiến trường (sương thể tích): mức 0..1 trong `scale`
        if (a.kind === 'haze') {
          this.game.setBattleSmoke(a.scale ?? 0.5);
          return;
        }
        const p = this.pointOf(a);
        if (!p) return;
        const dur = (a.durationMs ?? 60000) / 1000;
        const s = a.scale ?? 1;
        if (a.kind === 'smoke') this.smoke(p, dur, s, false);
        else if (a.kind === 'black') this.smoke(p, dur, s, true);
        else {
          this.fire(p, dur, s);
          this.smoke(p, dur * 1.3, s, true);
        }
        break;
      }
      case 'strike': {
        const p = this.pointOf(a);
        if (!p) return;
        this.shells.push({ t: this.t + (a.delayMs ?? 0) / 1000, x: p[0], z: p[2], radius: a.radius ?? 8, damage: a.damage ?? 120, whistled: (a.delayMs ?? 0) < 1200, kind: 'strike' });
        break;
      }
      case 'napalm':
        this.napalm(a);
        break;
      case 'mortar': {
        const zone = a.zone ? (this.zones.find((z) => z.id === a.zone) ?? null) : null;
        this.mortars.push({
          zone,
          until: this.t + (a.delayMs ?? 0) / 1000 + (a.durationMs ?? 30000) / 1000,
          next: this.t + (a.delayMs ?? 0) / 1000,
          perMin: a.rate ?? 20,
          radius: a.radius ?? 7,
          damage: a.damage ?? 60,
          spare: a.spare ?? 5,
          kind: a.kind === 'artillery' ? 'artillery' : 'mortar',
        });
        break;
      }
      case 'safe_zone': {
        const zone = this.zones.find((z) => z.id === a.zone);
        if (!zone) return;
        const from = this.t + (a.delayMs ?? 0) / 1000;
        this.safes.push({ zone, from, until: from + (a.durationMs ?? 15000) / 1000, dps: a.damage ?? 40 });
        break;
      }
      case 'squad_kill':
        this.squadKill(a);
        break;
    }
  }

  /** nổ lớn (bom, đòn đánh) để lại hố cháy âm ỉ + khói xám/đen (DV-087: luôn có khói, cháy nhiều hơn, cháy lâu hơn) */
  afterBlast(p: V3, size: number): void {
    const r = this.rng.next();
    if (r < 0.7) this.fire(p, 25 + this.rng.next() * 30, 0.5 + size * 0.3);
    this.smoke(p, 45 + this.rng.next() * 35, 0.6 + size * 0.35, r < 0.35);
  }

  /** dừng mọi đòn đang chờ (checkpoint/hồi sinh) — lửa đang cháy giữ nguyên, hết hạn tự tắt */
  clearPending(): void {
    this.shells.length = 0;
    this.mortars.length = 0;
    this.safes.length = 0;
    this.heats.length = 0;
  }

  // ---------------------------------------------------------------- per tick

  update(dt: number): void {
    this.t += dt;
    this.fx.update(this.t, this.game.camera.position);
    // chỗ hết hạn thì rảnh (lửa tự lụi trong shader theo thời điểm tắt)
    for (const list of [this.fires, this.smokes]) for (const s of list) if (s.busy && this.t >= s.until) s.busy = false;
    // cối/pháo
    for (let i = this.mortars.length - 1; i >= 0; i--) {
      const m = this.mortars[i]!;
      if (this.t >= m.until) {
        this.mortars.splice(i, 1);
        continue;
      }
      if (this.t < m.next) continue;
      m.next = this.t + (60 / m.perMin) * (0.6 + this.rng.next() * 0.8);
      const at = this.mortarPoint(m);
      if (at) this.shells.push({ t: this.t + 1.3, x: at[0], z: at[1], radius: m.radius, damage: m.damage, whistled: false, kind: m.kind });
    }
    // đạn đang bay: rít trước 1,1 s, rồi nổ
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i]!;
      if (!s.whistled && this.t >= s.t - 1.1) {
        s.whistled = true;
        if (s.kind === 'mortar' || s.kind === 'artillery' || s.kind === 'strike') this.game.audio.incoming([s.x, this.groundY(s.x, s.z), s.z], 1100);
      }
      if (this.t < s.t) continue;
      this.shells.splice(i, 1);
      const p: V3 = [s.x, this.groundY(s.x, s.z), s.z];
      if (s.kind === 'napalm') {
        this.game.explode(p, { radius: s.radius, damage: s.damage, shooter: 'air', kind: 'napalm' });
        this.game.audio.whoosh(p, 1.2);
        this.fire(p, 55 + this.rng.next() * 25, 1.5 + this.rng.next() * 0.6);
        if (this.rng.next() < 0.8) this.smoke(p, 90, 2.4, true);
      } else {
        this.game.explode(p, { radius: s.radius, damage: s.damage, shooter: 'shell' });
        this.afterBlast(p, s.kind === 'artillery' || s.kind === 'strike' ? 1.4 : 0.8);
      }
      this.stats.shells++;
    }
    // vùng cháy (napalm): người chơi/lính trong dải nóng mất máu mỗi 0,5 s
    this.heatAcc += dt;
    if (this.heatAcc >= 0.5) {
      const step = this.heatAcc;
      this.heatAcc = 0;
      for (let i = this.heats.length - 1; i >= 0; i--) {
        const h = this.heats[i]!;
        if (this.t >= h.until) {
          this.heats.splice(i, 1);
          continue;
        }
        this.burnIn(h, step);
      }
      for (const s of this.safes) {
        if (this.t < s.from || this.t > s.until || !this.game.player.alive) continue;
        const f = this.game.player.controller.feet;
        if (Math.hypot(f[0] - s.zone.center[0], f[2] - s.zone.center[2]) <= s.zone.radius) continue;
        this.stats.safeHits++;
        this.hurtPlayer(s.dps * step, [f[0] + 3, f[1], f[2]]);
      }
      for (let i = this.safes.length - 1; i >= 0; i--) if (this.t > this.safes[i]!.until) this.safes.splice(i, 1);
    }
  }

  /** đếm ngược đang chạy của vùng an toàn gần nhất (s) — HUD */
  safeCountdown(): number | null {
    let best: number | null = null;
    for (const s of this.safes) if (this.t < s.from) best = best === null ? s.from - this.t : Math.min(best, s.from - this.t);
    return best;
  }

  // ---------------------------------------------------------------- internals

  private napalm(a: MissionAction): void {
    const from = a.from;
    const to = a.to;
    if (!from || !to) return;
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const L = Math.hypot(dx, dz) || 1;
    const mid: [number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    const heading = Math.atan2(dx, dz);
    const delay = (a.delayMs ?? 0) / 1000;
    // máy bay: qua điểm giữa theo đúng hướng dải; không có sky thì vẫn ném theo giờ
    const speed = 190;
    let eta = 9.5;
    if (this.game.sky) {
      const e = this.game.sky.triggerThrough(a.flight ?? 'f4_pair', mid, heading, a.height ?? 70);
      if (e !== null) eta = e;
    }
    const tFrom = this.t + delay + eta - L / 2 / speed + 0.6; // bom rơi ~0,6 s sau khi máy bay qua
    const n = Math.max(4, a.count ?? Math.round(L / 9));
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      const side = (this.rng.next() - 0.5) * 10;
      const x = from[0] + dx * k + (-dz / L) * side;
      const z = from[1] + dz * k + (dx / L) * side;
      this.shells.push({ t: tFrom + (k * L) / speed, x, z, radius: a.radius ?? 9, damage: a.damage ?? 70, whistled: true, kind: 'napalm' });
    }
    this.heats.push({ ax: from[0], az: from[1], bx: to[0], bz: to[1], halfW: (a.radius ?? 9) * 0.9, until: tFrom + L / speed + (a.durationMs ?? 40000) / 1000, dps: 30 });
    this.stats.napalm++;
  }

  private burnIn(h: Heat, step: number): void {
    // chỉ cháy phần dải bom đã rơi tới (lửa lan theo đường bay)
    const vx = h.bx - h.ax;
    const vz = h.bz - h.az;
    const L2 = vx * vx + vz * vz || 1;
    const inside = (x: number, z: number): boolean => {
      const u = ((x - h.ax) * vx + (z - h.az) * vz) / L2;
      if (u < 0 || u > 1) return false;
      const px = h.ax + vx * u;
      const pz = h.az + vz * u;
      return Math.hypot(x - px, z - pz) <= h.halfW;
    };
    const f = this.game.player.controller.feet;
    if (this.game.player.alive && inside(f[0], f[2])) {
      this.stats.heatHits++;
      this.hurtPlayer(h.dps * step, [f[0] + 1, f[1] + 1, f[2]]);
    }
    for (const b of this.game.bots.values()) {
      if (!b.bot.alive || b.faction === 'friend') continue;
      if (inside(b.bot.position[0], b.bot.position[2])) this.game.events.emit('HIT', { actorId: b.id, zone: 'body', damage: Math.round(h.dps * step * 2), point: [b.bot.position[0], b.bot.position[1], b.bot.position[2]], penetrated: false, shooter: 'fire', blast: true });
    }
  }

  private hurtPlayer(dmg: number, from: V3): void {
    const d = Math.max(1, Math.round(dmg));
    this.game.events.emit('HIT', { actorId: 'player', zone: 'body', damage: d, point: from, penetrated: false, shooter: 'fire', blast: true });
  }

  /** điểm rơi: quanh người chơi trong vùng (hoặc quanh người chơi nếu không có vùng), không sát hơn `spare` m */
  private mortarPoint(m: MortarRun): [number, number] | null {
    const f = this.game.player.controller.feet;
    for (let k = 0; k < 6; k++) {
      const a = this.rng.next() * Math.PI * 2;
      const r = m.spare + this.rng.next() * 26;
      const x = f[0] + Math.sin(a) * r;
      const z = f[2] + Math.cos(a) * r;
      if (m.zone && Math.hypot(x - m.zone.center[0], z - m.zone.center[2]) > m.zone.radius + 20) continue;
      return [x, z];
    }
    return null;
  }

  private squadKill(a: MissionAction): void {
    const key = a.name ?? '';
    for (const b of this.game.bots.values()) {
      if (b.faction !== 'friend' || !b.bot.alive || b.nameKey !== key) continue;
      const p: V3 = [b.bot.position[0], b.bot.position[1], b.bot.position[2]];
      if (a.kind === 'napalm' || a.kind === 'fire') {
        this.game.audio.whoosh(p, 1);
        this.fire(p, 35, 1.3);
        this.smoke(p, 50, 1.6, true);
      } else if (a.kind === 'blast') {
        this.game.fx.explosion(p, 5);
        this.game.audio.explosion(p, 1.4);
        this.afterBlast(p, 1);
      }
      this.game.killSquadmate(b.id);
      this.stats.kills++;
      return;
    }
  }

  private pointOf(a: MissionAction): V3 | null {
    if (a.at) return [a.at[0], this.groundY(a.at[0], a.at[1]), a.at[1]];
    const z = a.zone ? this.zones.find((zz) => zz.id === a.zone) : undefined;
    if (!z) return null;
    return [z.center[0], this.groundY(z.center[0], z.center[2]), z.center[2]];
  }

  private groundY(x: number, z: number): number {
    return this.game.terrain ? this.game.terrain.heightAt(x, z) : 0;
  }

  private take(list: Slot[]): Slot {
    let s = list.find((x) => !x.busy);
    if (!s) s = list.reduce((m, x) => (x.until < m.until ? x : m), list[0]!);
    return s;
  }

  private fire(p: V3, durS: number, scale: number): void {
    const s = this.take(this.fires);
    s.busy = true;
    s.until = this.t + durS;
    this.fx.setFire(s.idx, p, this.t, this.t + durS, scale * 1.2);
    this.stats.fires++;
  }

  private smoke(p: V3, durS: number, scale: number, black: boolean): void {
    const s = this.take(this.smokes);
    s.busy = true;
    s.until = this.t + durS + 11;
    this.fx.setSmoke(s.idx, p, this.t, this.t + durS, scale * (black ? 1.25 : 0.9), black ? SMOKE_BLACK : SMOKE_GREY);
    this.stats.smokes++;
  }
}
