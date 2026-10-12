/**
 * AC-130A săn xe đêm (DV-078): logic thuần — quỹ đạo "pylon turn" quanh ngầm, chọn xe trong đoạn trống, bắn 40 ly (từng phát,
 * đạn đi theo tầm bay, phát đầu lệch rồi "dò" dần vào), Vulcan 20 ly (loạt), minigun 7,62 vào ụ súng khi bị bắn rát.
 * Vũ khí theo registry wpn.us.ac130a_armament_1971 (7,62 + 20 + 40 mm; không có 105 mm của bản 1972).
 *
 * Không rơi (quyết định của Chủ nhà): đạn 12,7 trúng (hoặc sượt gần) cộng "áp lực" `harass`; đủ 1 → bỏ vòng (`breaking`): leo
 * cao, nới vòng ra xa, không bắn `holdS` giây rồi quay lại. Áp lực làm 40 ly lệch hơn (phi công lắc tránh). Bắn rát (≥ minigun.harassMin)
 * → báo trước rồi quét minigun vào ụ súng.
 *
 * Toạ độ: thế giới (x, y, z) của level; `groundY(x, z)` do night act cấp. Thời gian = sim time (giây), PRNG seeded.
 */
import type { Prng } from '@engine/core';

export type GunshipPhase = 'idle' | 'inbound' | 'attack' | 'breaking' | 'away' | 'returning' | 'leaving' | 'gone';

export interface GunshipConfig {
  orbit: { radius: number; alt: number; speed: number; dir: number };
  inbound: { from: number; seconds: number };
  break: { radius: number; altAdd: number; rampS: number; holdS: number; returnS: number };
  harass: { perHit: number; nearMissR: number; perNearMiss: number; decayPerS: number; breakAt: number };
  hitRadius: number;
  bofors: { interval: [number, number]; shellSpeed: number; acquireS: number; errStart: number; errMul: number; errMin: number; harassErrMul: number; blastR: number; truckDamage: number; playerDamage: number };
  vulcan: { every: [number, number]; burstS: number; impacts: number; spread: number; speed: number; hitR: number; truckDamage: number; playerDamage: number };
  minigun: { harassMin: number; cooldownS: number; warnS: number; burstS: number; impacts: number; sweep: number; speed: number; hitR: number; playerDamage: number; crouchMul: number };
  leaveAfterConvoyS: number;
}

export type GunKind = 'bofors' | 'vulcan' | 'minigun';

/** một viên/quả đang bay: bắn lúc `t0` từ `from`, chạm `at` lúc `t1` */
export interface Shell {
  kind: GunKind;
  from: [number, number, number];
  at: [number, number, number];
  t0: number;
  t1: number;
  /** id xe nhắm (−1 = ụ súng/không) */
  target: number;
}

export interface GunshipTarget {
  id: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
}

export interface GunshipWorld {
  groundY(x: number, z: number): number;
  /** xe máy bay thấy được (đoạn trống) */
  targets(): GunshipTarget[];
  /** ụ súng 12,7 (x, z) */
  gunPos(): [number, number];
}

export interface GunshipEvents {
  /** bắn (lửa đầu nòng, vệt đạn) */
  fire(s: Shell): void;
  /** đạn chạm đất */
  impact(s: Shell): void;
  /** đổi pha (bỏ vòng, quay lại…) */
  phase(p: GunshipPhase, prev: GunshipPhase): void;
  /** báo trước minigun quét ụ súng */
  warn(): void;
  /** bị 12,7 trúng */
  hit(): void;
}

export interface GunshipSnapshot {
  phase: GunshipPhase;
  phaseT: number;
  theta: number;
  harass: number;
  hits: number;
  breaks: number;
  t: number;
}


export class Gunship {
  phase: GunshipPhase = 'idle';
  /** giây trong pha hiện tại */
  private phaseT = 0;
  /** góc trên vòng lượn (rad, 0 = +z) */
  private theta = 0;
  /** áp lực 0..1 */
  harass = 0;
  private t = 0;
  readonly pos: [number, number, number] = [0, 0, 0];
  readonly vel: [number, number, number] = [0, 0, 0];
  /** nghiêng cánh (rad, + = cánh trái thấp — vòng ngược chiều kim đồng hồ nhìn từ trên) */
  bank = 0;
  private radius: number;
  private alt: number;
  readonly shells: Shell[] = [];
  private nextBofors = 0;
  private nextVulcan = 0;
  private minigunReadyAt = 0;
  private warnAt = -1;
  private target = -1;
  private walkErr = 0;
  readonly stats = { bofors: 0, vulcan: 0, minigun: 0, hits: 0, nearMisses: 0, breaks: 0, warns: 0 };
  private readonly base: number;

  constructor(
    readonly cfg: GunshipConfig,
    /** tâm vòng lượn (ngầm) x, z và cao độ mặt đất ở tâm */
    readonly center: [number, number, number],
    private readonly world: GunshipWorld,
    private readonly prng: Prng,
    private readonly ev: Partial<GunshipEvents> = {},
  ) {
    this.base = center[1];
    this.radius = cfg.inbound.from;
    this.alt = cfg.orbit.alt + cfg.break.altAdd;
    this.place();
  }

  /** bắt đầu bay tới (mission bật flag) */
  arrive(): void {
    if (this.phase !== 'idle' && this.phase !== 'gone') return;
    this.setPhase('inbound');
    this.radius = this.cfg.inbound.from;
    this.alt = this.cfg.orbit.alt + this.cfg.break.altAdd;
    this.minigunReadyAt = this.t + 30;
  }

  /** đoàn xe xong → rời đi */
  leave(): void {
    if (this.phase === 'idle' || this.phase === 'gone' || this.phase === 'leaving') return;
    this.setPhase('leaving');
  }

  get attacking(): boolean {
    return this.phase === 'attack';
  }

  private setPhase(p: GunshipPhase): void {
    const prev = this.phase;
    if (prev === p) return;
    this.phase = p;
    this.phaseT = 0;
    if (p === 'attack') {
      this.nextBofors = this.t + this.cfg.bofors.acquireS;
      this.nextVulcan = this.t + this.prng.range(this.cfg.vulcan.every[0], this.cfg.vulcan.every[1]);
      this.target = -1;
    }
    if (p === 'breaking') {
      this.stats.breaks++;
      this.harass = 0;
      this.warnAt = -1;
    }
    this.ev.phase?.(p, prev);
  }

  private place(): void {
    const c = this.cfg.orbit;
    const x = this.center[0] + Math.sin(this.theta) * this.radius;
    const z = this.center[2] + Math.cos(this.theta) * this.radius;
    const y = this.base + this.alt;
    // vận tốc tiếp tuyến (dir +1 = θ tăng)
    const w = (c.dir * c.speed) / Math.max(200, this.radius);
    this.vel[0] = Math.cos(this.theta) * w * this.radius;
    this.vel[2] = -Math.sin(this.theta) * w * this.radius;
    this.vel[1] = 0;
    this.pos[0] = x;
    this.pos[1] = y;
    this.pos[2] = z;
    // pylon turn: tan(bank) = v² / (g·R)
    this.bank = Math.atan((c.speed * c.speed) / (9.81 * Math.max(200, this.radius)));
  }

  /** đổi bán kính/độ cao mượt về đích */
  private approach(r: number, a: number, rateS: number, dt: number): void {
    const k = Math.min(1, dt / Math.max(0.1, rateS));
    this.radius += (r - this.radius) * k * 3;
    this.alt += (a - this.alt) * k * 3;
  }

  step(dt: number): void {
    this.t += dt;
    this.phaseT += dt;
    const c = this.cfg;
    if (this.phase === 'idle' || this.phase === 'gone') {
      this.flushShells();
      return;
    }
    this.theta += (c.orbit.dir * c.orbit.speed * dt) / Math.max(200, this.radius);
    if (this.theta > Math.PI) this.theta -= Math.PI * 2;
    else if (this.theta < -Math.PI) this.theta += Math.PI * 2;
    switch (this.phase) {
      case 'inbound':
        this.approach(c.orbit.radius, c.orbit.alt, c.inbound.seconds, dt);
        if (this.phaseT >= c.inbound.seconds) this.setPhase('attack');
        break;
      case 'attack':
        this.approach(c.orbit.radius, c.orbit.alt, 2, dt);
        this.harass = Math.max(0, this.harass - c.harass.decayPerS * dt);
        this.fireControl();
        break;
      case 'breaking':
        this.approach(c.break.radius, c.orbit.alt + c.break.altAdd, c.break.rampS, dt);
        if (this.phaseT >= c.break.rampS) this.setPhase('away');
        break;
      case 'away':
        this.approach(c.break.radius, c.orbit.alt + c.break.altAdd, 2, dt);
        if (this.phaseT >= c.break.holdS) this.setPhase('returning');
        break;
      case 'returning':
        this.approach(c.orbit.radius, c.orbit.alt, c.break.returnS, dt);
        if (this.phaseT >= c.break.returnS) this.setPhase('attack');
        break;
      case 'leaving':
        this.approach(c.inbound.from * 1.3, c.orbit.alt + c.break.altAdd * 2, 10, dt);
        if (this.phaseT > 30) this.setPhase('gone');
        break;
    }
    this.place();
    this.flushPending();
    this.flushShells();
  }

  /** bắn đạn tới hạn: chạm đất → sự kiện impact */
  private flushShells(): void {
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i]!;
      if (this.t >= s.t1) {
        this.shells.splice(i, 1);
        this.ev.impact?.(s);
      }
    }
  }

  private fireControl(): void {
    const c = this.cfg;
    // minigun vào ụ súng khi bị bắn rát
    if (this.warnAt < 0 && this.harass >= c.minigun.harassMin && this.t >= this.minigunReadyAt) {
      this.warnAt = this.t + c.minigun.warnS;
      this.stats.warns++;
      this.ev.warn?.();
    }
    if (this.warnAt >= 0 && this.t >= this.warnAt) {
      this.warnAt = -1;
      this.minigunReadyAt = this.t + c.minigun.cooldownS;
      this.minigunBurst();
    }
    const list = this.world.targets();
    let tgt = list.find((x) => x.id === this.target);
    if (!tgt) {
      // xe mới: ưu tiên xe trong/gần ngầm (chậm nhất), rồi xe đang chạy
      tgt = list.slice().sort((a, b) => Math.hypot(a.x - this.center[0], a.z - this.center[2]) - Math.hypot(b.x - this.center[0], b.z - this.center[2]))[0];
      if (tgt) {
        this.target = tgt.id;
        this.walkErr = c.bofors.errStart;
        this.nextBofors = Math.max(this.nextBofors, this.t + c.bofors.acquireS);
      } else this.target = -1;
    }
    if (!tgt) return;
    if (this.t >= this.nextBofors) {
      this.nextBofors = this.t + this.prng.range(c.bofors.interval[0], c.bofors.interval[1]);
      const err = Math.max(c.bofors.errMin, this.walkErr) * (1 + this.harass * c.bofors.harassErrMul);
      this.walkErr *= c.bofors.errMul;
      this.shoot('bofors', tgt, err, c.bofors.shellSpeed);
      this.stats.bofors++;
    }
    if (this.t >= this.nextVulcan) {
      this.nextVulcan = this.t + this.prng.range(c.vulcan.every[0], c.vulcan.every[1]);
      this.vulcanBurst(tgt);
    }
  }

  /** đạn bắn đón: điểm dự đoán = vị trí + vận tốc × tầm bay, cộng lệch tròn `err` */
  private shoot(kind: GunKind, tgt: GunshipTarget, err: number, speed: number, delay = 0): void {
    const d0 = Math.hypot(tgt.x - this.pos[0], this.base - this.pos[1], tgt.z - this.pos[2]);
    const tof = d0 / speed;
    const a = this.prng.next() * Math.PI * 2;
    const r = err * Math.sqrt(this.prng.next());
    const x = tgt.x + tgt.vx * (tof + delay) + Math.sin(a) * r;
    const z = tgt.z + tgt.vz * (tof + delay) + Math.cos(a) * r;
    this.launch(kind, x, z, speed, delay, tgt.id);
  }

  private launch(kind: GunKind, x: number, z: number, speed: number, delay: number, target: number): void {
    const y = this.world.groundY(x, z);
    // đầu nòng ở sườn trái thân máy bay (súng bắn sang trái — vòng ngược chiều kim đồng hồ)
    const from: [number, number, number] = [this.pos[0] + this.vel[0] * delay, this.pos[1] - 2, this.pos[2] + this.vel[2] * delay];
    const d = Math.hypot(x - from[0], y - from[1], z - from[2]);
    const s: Shell = { kind, from, at: [x, y, z], t0: this.t + delay, t1: this.t + delay + d / speed, target };
    this.shells.push(s);
    if (delay <= 0) this.ev.fire?.(s);
    else this.pending.push(s);
  }

  /** đạn bắn trễ (loạt): phát sự kiện fire khi tới giờ */
  private readonly pending: Shell[] = [];
  /** phát fire cho đạn trong loạt đã tới giờ bắn */
  private flushPending(): void {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const s = this.pending[i]!;
      if (this.t >= s.t0) {
        this.pending.splice(i, 1);
        this.ev.fire?.(s);
      }
    }
  }

  private vulcanBurst(tgt: GunshipTarget): void {
    const c = this.cfg.vulcan;
    this.stats.vulcan++;
    // loạt rải dọc một đường ngang hướng bay qua mục tiêu (rèm đạn), lệch tâm theo áp lực
    const off = (this.prng.next() - 0.5) * c.spread * (0.6 + this.harass);
    const hx = this.vel[0];
    const hz = this.vel[2];
    const hl = Math.hypot(hx, hz) || 1;
    for (let i = 0; i < c.impacts; i++) {
      const k = i / Math.max(1, c.impacts - 1) - 0.5;
      const along = k * c.spread;
      const dl = (i / c.impacts) * c.burstS;
      const fake: GunshipTarget = { id: tgt.id, x: tgt.x + (hx / hl) * along + (-hz / hl) * off * 0.3, z: tgt.z + (hz / hl) * along + (hx / hl) * off * 0.3, vx: tgt.vx, vz: tgt.vz };
      this.shoot('vulcan', fake, 1.6, c.speed, dl);
    }
  }

  private minigunBurst(): void {
    const c = this.cfg.minigun;
    this.stats.minigun++;
    const [gx, gz] = this.world.gunPos();
    // quét một đường qua ụ súng (theo hướng bay)
    const hx = this.vel[0];
    const hz = this.vel[2];
    const hl = Math.hypot(hx, hz) || 1;
    const side = (this.prng.next() - 0.5) * 3;
    for (let i = 0; i < c.impacts; i++) {
      const k = i / Math.max(1, c.impacts - 1) - 0.5;
      const along = k * c.sweep;
      const dl = (i / c.impacts) * c.burstS;
      const x = gx + (hx / hl) * along + (-hz / hl) * (side + (this.prng.next() - 0.5) * 2.2);
      const z = gz + (hz / hl) * along + (hx / hl) * (side + (this.prng.next() - 0.5) * 2.2);
      this.launch('minigun', x, z, c.speed, dl, -1);
    }
  }

  /**
   * Đoạn đạn 12,7 [p0 → p1] so với máy bay (cầu bán kính hitRadius quanh thân): trúng → true (cộng áp lực). Trả khoảng cách gần
   * nhất của đoạn tới tâm (để tính sượt).
   */
  testSegment(p0: readonly number[], p1: readonly number[]): { hit: boolean; dist: number } {
    if (this.phase === 'idle' || this.phase === 'gone') return { hit: false, dist: Infinity };
    const dx = p1[0]! - p0[0]!;
    const dy = p1[1]! - p0[1]!;
    const dz = p1[2]! - p0[2]!;
    const l2 = dx * dx + dy * dy + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((this.pos[0] - p0[0]!) * dx + (this.pos[1] - p0[1]!) * dy + (this.pos[2] - p0[2]!) * dz) / l2));
    const d = Math.hypot(p0[0]! + dx * t - this.pos[0], p0[1]! + dy * t - this.pos[1], p0[2]! + dz * t - this.pos[2]);
    return { hit: d <= this.cfg.hitRadius, dist: d };
  }

  /** viên 12,7 trúng thân */
  onHit(): void {
    this.stats.hits++;
    this.ev.hit?.();
    this.pressure(this.cfg.harass.perHit);
  }

  /** viên 12,7 sượt gần (≤ nearMissR) */
  onNearMiss(): void {
    this.stats.nearMisses++;
    this.pressure(this.cfg.harass.perNearMiss);
  }

  private pressure(v: number): void {
    if (this.phase !== 'attack' && this.phase !== 'returning' && this.phase !== 'inbound') return;
    this.harass = Math.min(1, this.harass + v);
    if (this.harass >= this.cfg.harass.breakAt && this.phase === 'attack') this.setPhase('breaking');
  }

  /** đang chờ quét minigun (giây còn lại, −1 = không) */
  get warnLeft(): number {
    return this.warnAt < 0 ? -1 : Math.max(0, this.warnAt - this.t);
  }

  get time(): number {
    return this.t;
  }

  snapshot(): GunshipSnapshot {
    return { phase: this.phase, phaseT: this.phaseT, theta: this.theta, harass: this.harass, hits: this.stats.hits, breaks: this.stats.breaks, t: this.t };
  }

  restore(s: GunshipSnapshot): void {
    this.phase = s.phase;
    this.phaseT = s.phaseT;
    this.theta = s.theta;
    this.harass = s.harass;
    this.t = s.t;
    this.shells.length = 0;
    this.pending.length = 0;
    this.warnAt = -1;
    this.target = -1;
    const c = this.cfg;
    if (s.phase === 'attack' || s.phase === 'returning') {
      this.radius = c.orbit.radius;
      this.alt = c.orbit.alt;
      this.nextBofors = this.t + c.bofors.acquireS;
      this.nextVulcan = this.t + c.vulcan.every[0];
    } else if (s.phase === 'idle' || s.phase === 'inbound') {
      this.radius = c.inbound.from;
      this.alt = c.orbit.alt + c.break.altAdd;
    } else {
      this.radius = c.break.radius;
      this.alt = c.orbit.alt + c.break.altAdd;
    }
    this.minigunReadyAt = this.t + 10;
    this.place();
  }

  reset(): void {
    this.phase = 'idle';
    this.phaseT = 0;
    this.theta = 0;
    this.harass = 0;
    this.t = 0;
    this.shells.length = 0;
    this.pending.length = 0;
    this.warnAt = -1;
    this.target = -1;
    this.radius = this.cfg.inbound.from;
    this.alt = this.cfg.orbit.alt + this.cfg.break.altAdd;
    for (const k of Object.keys(this.stats) as Array<keyof Gunship['stats']>) this.stats[k] = 0;
    this.place();
  }
}

