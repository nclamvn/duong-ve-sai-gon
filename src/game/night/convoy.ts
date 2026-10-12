/**
 * Đoàn xe qua ngầm (DV-078, hồi đêm Ngầm Ta Lê): logic thuần (không three/DOM) — chạy trong Node/Vitest.
 *
 * Xe chạy theo một đường (polyline x/z) tính bằng quãng đường `s`; ngầm ở `fordS`. Xe xếp hàng dưới tán rừng bờ gần, qua ngầm
 * từng chiếc một (cô TNXP cầm đèn cho qua: chiếc sau chỉ vào ngầm khi chiếc trước đã ra khỏi ngầm `departDelayS` giây), qua bờ
 * xa thì tăng tốc rồi mất hút. Máy bay chỉ thấy xe trong "đoạn trống" quanh ngầm (`openBefore`/`openAfter`).
 *
 * Sự cố:
 *  - xe số `stuckIndex` chết máy giữa ngầm (nước ngập) → phải ĐẨY (người chơi giữ F + đồng đội đứng cạnh nhân tốc độ);
 *  - xe trúng đạn hết máu → CHÁY; cháy giữa ngầm = chắn ngầm, phải đẩy xác sang bên (lâu hơn); cháy chỗ khác thì xe sau lách;
 *  - lái xe xe cháy: bị thương nằm cạnh cabin (`injuredChance`) — giữ F cứu trong `bleedS` giây, không thì hy sinh.
 * Không thua theo xe: điểm = số xe qua ngầm (`crossed`) / `count`.
 */
import type { Prng } from '@engine/core';

export type TruckState = 'waiting' | 'moving' | 'stuck' | 'burning' | 'crossed' | 'gone';
export type DriverState = 'ok' | 'injured' | 'rescued' | 'dead';

export interface ConvoyConfig {
  count: number;
  fordS: number;
  queueFirst: number;
  spacing: number;
  gap: number;
  speed: { approach: number; ford: number; away: number; damagedMul: number };
  accel: number;
  fordHalf: number;
  stopLine: number;
  departDelayS: number;
  openBefore: number;
  openAfter: number;
  crossedAfter: number;
  exitAfter: number;
  hazardHoldS: number;
  stuckIndex: number;
  push: { waterS: number; wreckS: number; helperMul: number; maxHelpers: number; radius: number };
  driver: { injuredChance: number; bleedS: number; rescueS: number; radius: number; side: number };
  hp: number;
  bypassLateral: number;
  wreckAside: number;
  length: number;
}

export interface Truck {
  id: number;
  /** quãng đường dọc đường (m) — tâm xe */
  s: number;
  v: number;
  /** lệch ngang khỏi tâm đường (m, + = bên trái theo chiều chạy) */
  lateral: number;
  state: TruckState;
  hp: number;
  hits: number;
  /** tiến trình đẩy 0..1 (xe kẹt nước / xác chắn ngầm) */
  push: number;
  /** kẹt vì nước (chết máy) hay vì là xác cháy chắn ngầm; null = không chắn */
  block: 'water' | 'wreck' | null;
  driver: DriverState;
  /** chỗ lái xe nằm (x, z) khi bị thương */
  driverAt: [number, number] | null;
  driverLeft: number;
  rescue: number;
  /** đã từng kẹt (chỉ kẹt một lần) */
  stalled: boolean;
}

export type ConvoyEventType = 'depart' | 'stuck' | 'freed' | 'damaged' | 'destroyed' | 'wreck_blocks' | 'wreck_cleared' | 'driver_injured' | 'driver_rescued' | 'driver_dead' | 'crossed' | 'gone' | 'hold' | 'done';
export interface ConvoyEvent {
  type: ConvoyEventType;
  truck: number;
}

/** đường xe: polyline x/z → vị trí + hướng theo s */
export class RoadPath {
  readonly cum: number[] = [0];
  readonly length: number;

  constructor(readonly pts: ReadonlyArray<readonly [number, number]>) {
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
    this.length = this.cum[this.cum.length - 1]!;
  }

  /** điểm + hướng (đơn vị) tại s (kẹp ngoài hai đầu theo đoạn đầu/cuối — ngoại suy thẳng) */
  at(s: number, lateral = 0, out: { x: number; z: number; dx: number; dz: number } = { x: 0, z: 0, dx: 0, dz: 1 }): { x: number; z: number; dx: number; dz: number } {
    let i = 0;
    while (i < this.pts.length - 2 && s > this.cum[i + 1]!) i++;
    const a = this.pts[i]!;
    const b = this.pts[i + 1]!;
    const l = this.cum[i + 1]! - this.cum[i]! || 1;
    const dx = (b[0] - a[0]) / l;
    const dz = (b[1] - a[1]) / l;
    const t = s - this.cum[i]!;
    out.dx = dx;
    out.dz = dz;
    // trái theo chiều chạy = (−dz, dx)
    out.x = a[0] + dx * t - dz * lateral;
    out.z = a[1] + dz * t + dx * lateral;
    return out;
  }

  /** s của điểm gần nhất trên đường tới (x, z) + khoảng cách ngang */
  project(x: number, z: number): { s: number; d: number } {
    let best = { s: 0, d: Infinity };
    for (let i = 0; i + 1 < this.pts.length; i++) {
      const a = this.pts[i]!;
      const b = this.pts[i + 1]!;
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
      const d = Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z);
      if (d < best.d) best = { s: this.cum[i]! + t * Math.sqrt(l2), d };
    }
    return best;
  }
}

/** ai đang đẩy/cứu (night act tính mỗi tick từ vị trí người chơi + đồng đội và phím giữ) */
export interface ConvoyInput {
  /** xe được đẩy: id → số người đẩy (người chơi giữ F = 1 + đồng đội đứng cạnh) — 0/không có = không ai đẩy */
  pushing?: ReadonlyMap<number, number>;
  /** xe có lái xe đang được cứu (người chơi giữ F cạnh lái xe) */
  rescuing?: number | null;
  /** máy bay đang bắn vào đoạn trống (vừa có đạn 40 ly rơi) → xe đang chờ không vào */
  hazard?: boolean;
  /** người đứng trên đường (s dọc đường, d lệch ngang) — xe phía sau dừng cách 2,5 m, không cán */
  walkers?: ReadonlyArray<{ s: number; d: number }>;
}

export interface ConvoySnapshot {
  trucks: Truck[];
  go: boolean;
  t: number;
  fordFreeAt: number;
  holdUntil: number;
}

const _p = { x: 0, z: 0, dx: 0, dz: 1 };

export class Convoy {
  readonly trucks: Truck[] = [];
  /** cho xe chạy (Thu "xe một, đi!") */
  go = false;
  private t = 0;
  /** thời điểm ngầm trống (chiếc trước ra khỏi ngầm) */
  private fordFreeAt = 0;
  /** chờ máy bay (hazard) tới thời điểm này */
  private holdUntil = 0;
  private doneFired = false;
  readonly stats = { crossed: 0, destroyed: 0, rescued: 0, driversLost: 0, stuck: 0, pushedFree: 0, wrecksCleared: 0 };

  constructor(
    readonly cfg: ConvoyConfig,
    readonly road: RoadPath,
    private readonly prng: Prng,
    private readonly emit: (e: ConvoyEvent) => void = () => undefined,
  ) {
    this.reset();
  }

  reset(): void {
    this.trucks.length = 0;
    for (let i = 0; i < this.cfg.count; i++) {
      this.trucks.push({ id: i, s: this.cfg.fordS - this.cfg.queueFirst - i * this.cfg.spacing, v: 0, lateral: 0, state: 'waiting', hp: this.cfg.hp, hits: 0, push: 0, block: null, driver: 'ok', driverAt: null, driverLeft: 0, rescue: 0, stalled: false });
    }
    this.go = false;
    this.t = 0;
    this.fordFreeAt = 0;
    this.holdUntil = 0;
    this.doneFired = false;
    for (const k of Object.keys(this.stats) as Array<keyof Convoy['stats']>) this.stats[k] = 0;
  }

  /** vị trí xe (x, z) + hướng chạy */
  pose(tr: Truck, out: { x: number; z: number; dx: number; dz: number } = { x: 0, z: 0, dx: 0, dz: 1 }): { x: number; z: number; dx: number; dz: number } {
    return this.road.at(tr.s, tr.lateral, out);
  }

  /** xe chắn ngầm (kẹt nước hoặc xác cháy chưa đẩy) */
  fordBlocker(): Truck | null {
    for (const tr of this.trucks) if (tr.block && Math.abs(tr.s - this.cfg.fordS) <= this.cfg.fordHalf + 1) return tr;
    return null;
  }

  /** xe máy bay nhìn thấy được (đoạn trống quanh ngầm, còn chạy/kẹt/chờ) */
  exposed(): Truck[] {
    const c = this.cfg;
    return this.trucks.filter((tr) => (tr.state === 'moving' || tr.state === 'stuck' || tr.state === 'waiting') && tr.s >= c.fordS - c.openBefore && tr.s <= c.fordS + c.openAfter);
  }

  /** vận tốc thế giới (m/s) của xe — máy bay ngắm đón */
  velocity(tr: Truck): [number, number] {
    const p = this.road.at(tr.s, tr.lateral, _p);
    return [p.dx * tr.v, p.dz * tr.v];
  }

  get crossed(): number {
    return this.stats.crossed;
  }

  /** mọi xe đã qua hoặc cháy */
  get done(): boolean {
    return this.trucks.every((tr) => tr.state === 'crossed' || tr.state === 'gone' || tr.state === 'burning');
  }

  /** sát thương nổ tại (x, z) bán kính r (xe = đoạn dài `length` dọc đường) — trả số xe trúng */
  damageAt(x: number, z: number, r: number, dmg: number): number {
    let n = 0;
    for (const tr of this.trucks) {
      if (tr.state === 'burning' || tr.state === 'gone') continue;
      const p = this.road.at(tr.s, tr.lateral, _p);
      // khoảng cách tới đoạn thân xe (±length/2 dọc hướng chạy), coi xe rộng 2,4 m
      const ax = x - p.x;
      const az = z - p.z;
      const along = Math.max(-this.cfg.length / 2, Math.min(this.cfg.length / 2, ax * p.dx + az * p.dz));
      const d = Math.max(0, Math.hypot(ax - p.dx * along, az - p.dz * along) - 1.2);
      if (d > r) continue;
      const k = 1 - (d / Math.max(0.01, r)) * 0.5;
      this.hurt(tr, dmg * k);
      n++;
    }
    return n;
  }

  private hurt(tr: Truck, dmg: number): void {
    if (tr.state === 'burning' || tr.state === 'gone') return;
    tr.hits++;
    tr.hp = Math.max(0, tr.hp - dmg);
    if (tr.hp > 0) {
      this.emit({ type: 'damaged', truck: tr.id });
      return;
    }
    // cháy
    const wasCrossed = tr.state === 'crossed';
    tr.state = 'burning';
    tr.v = 0;
    this.stats.destroyed++;
    if (wasCrossed) this.stats.crossed--; // cháy ngay sau mốc qua (hiếm: mốc qua nằm ngoài đoạn trống)
    const inFord = Math.abs(tr.s - this.cfg.fordS) <= this.cfg.fordHalf + 1;
    tr.block = inFord ? 'wreck' : null;
    tr.push = 0;
    this.emit({ type: 'destroyed', truck: tr.id });
    if (inFord) this.emit({ type: 'wreck_blocks', truck: tr.id });
    if (this.prng.next() < this.cfg.driver.injuredChance) {
      const p = this.road.at(tr.s - this.cfg.length * 0.3, tr.lateral, _p);
      // cabin phía trước; lái xe bò ra bên trái (−dz, dx) cách thân xe `side`
      const ahead = this.cfg.length * 0.6;
      tr.driverAt = [p.x + p.dx * ahead - p.dz * this.cfg.driver.side, p.z + p.dz * ahead + p.dx * this.cfg.driver.side];
      tr.driver = 'injured';
      tr.driverLeft = this.cfg.driver.bleedS;
      tr.rescue = 0;
      this.emit({ type: 'driver_injured', truck: tr.id });
    } else {
      tr.driver = 'dead';
      this.stats.driversLost++;
    }
  }

  step(dt: number, inp: ConvoyInput = {}): void {
    const c = this.cfg;
    this.t += dt;
    if (inp.hazard && this.t >= this.holdUntil - c.hazardHoldS + 0.5) {
      if (this.t >= this.holdUntil) this.emit({ type: 'hold', truck: -1 });
      this.holdUntil = this.t + c.hazardHoldS;
    }
    const blocker = this.fordBlocker();
    const stop = c.fordS - c.fordHalf - c.stopLine;
    const exitS = c.fordS + c.fordHalf + 2;
    // xe đã qua vạch dừng mà chưa ra khỏi ngầm (đang được cho qua) — mỗi lúc một chiếc
    let occupant: Truck | null = null;
    for (const tr of this.trucks) if ((tr.state === 'moving' || tr.state === 'stuck') && tr.s > stop + 0.5 && tr.s <= exitS) occupant = tr;
    // thứ tự: xe đầu (s lớn) trước
    const order = [...this.trucks].sort((a, b) => b.s - a.s);
    for (let k = 0; k < order.length; k++) {
      const tr = order[k]!;
      if (tr.state === 'burning') {
        this.stepWreck(tr, dt, inp);
        continue;
      }
      if (tr.state === 'gone') continue;
      if (tr.state === 'stuck') {
        this.stepStuck(tr, dt, inp);
        continue;
      }
      // giới hạn theo xe trước (bỏ qua xác đã đẩy sang bên / xác ngoài ngầm: lách)
      let limit = Infinity;
      for (let j = k - 1; j >= 0; j--) {
        const a = order[j]!;
        if (a.state === 'gone') continue;
        if (a.state === 'burning' && !a.block) continue;
        limit = a.s - c.gap;
        break;
      }
      for (const w of inp.walkers ?? []) if (w.d < 2.1 && w.s > tr.s) limit = Math.min(limit, w.s - c.length / 2 - 2.5);
      if (!this.go && tr.state === 'waiting') limit = Math.min(limit, tr.s);
      else if (tr.s <= stop + 0.5) {
        // vạch dừng: ngầm có xe/chắn, vừa có xe ra chưa đủ `departDelayS`, hoặc đang chờ máy bay → đứng ở vạch
        const wait = (occupant !== null && occupant !== tr) || (blocker !== null && blocker !== tr) || this.t < this.fordFreeAt + c.departDelayS || this.t < this.holdUntil;
        if (wait) limit = Math.min(limit, stop);
        // máy bay đang bắn vào đoạn trống: xe dưới tán không ra (đứng ở mép tán)
        const openEdge = c.fordS - c.openBefore - 2;
        if (this.t < this.holdUntil && tr.s <= openEdge) limit = Math.min(limit, openEdge);
      }
    let vt = tr.s > c.fordS + c.fordHalf + 2 ? c.speed.away : tr.s >= c.fordS - c.fordHalf - 2 ? c.speed.ford : c.speed.approach;
      if (tr.hp < c.hp) vt *= c.speed.damagedMul;
      // phanh trước giới hạn: v ≤ sqrt(2·a·quãng còn lại)
      const room = limit - tr.s;
      if (room <= 0.05) vt = 0;
      else vt = Math.min(vt, Math.sqrt(2 * c.accel * room));
      const prevV = tr.v;
      tr.v = vt > tr.v ? Math.min(vt, tr.v + c.accel * dt) : Math.max(vt, tr.v - c.accel * 2.5 * dt);
      tr.s = Math.min(tr.s + tr.v * dt, Number.isFinite(limit) ? Math.max(tr.s, limit) : Infinity);
      if (tr.state === 'waiting' && tr.v > 0.2 && prevV <= 0.2) {
        tr.state = 'moving';
        this.emit({ type: 'depart', truck: tr.id });
      }
      // lách xác cháy ngoài ngầm (± 12 m dọc đường)
      let lat = 0;
      for (const w of this.trucks) if (w.state === 'burning' && !w.block && Math.abs(w.s - tr.s) < 12 && w.lateral <= 1) lat = c.bypassLateral;
      tr.lateral += (lat - tr.lateral) * Math.min(1, dt * 0.8);
      // chết máy giữa ngầm (một lần, xe chỉ định)
      if (tr.id === c.stuckIndex && !tr.stalled && tr.s >= c.fordS - 0.5 && tr.state === 'moving') {
        tr.stalled = true;
        tr.state = 'stuck';
        tr.block = 'water';
        tr.v = 0;
        tr.push = 0;
        this.stats.stuck++;
        this.emit({ type: 'stuck', truck: tr.id });
        continue;
      }
      if (tr === occupant && tr.s > exitS) this.fordFreeAt = this.t;
      if (tr.state === 'moving' && tr.s >= c.fordS + c.crossedAfter) {
        tr.state = 'crossed';
        this.stats.crossed++;
        this.emit({ type: 'crossed', truck: tr.id });
      }
      if (tr.state === 'crossed' && tr.s >= c.fordS + c.exitAfter) {
        tr.state = 'gone';
        tr.v = 0;
        this.emit({ type: 'gone', truck: tr.id });
      }
    }
    if (!this.doneFired && this.done) {
      this.doneFired = true;
      this.emit({ type: 'done', truck: -1 });
    }
  }

  private pushRate(tr: Truck, inp: ConvoyInput): number {
    const n = Math.min(this.cfg.push.maxHelpers + 1, inp.pushing?.get(tr.id) ?? 0);
    if (n <= 0) return 0;
    // người chơi = 1, mỗi đồng đội thêm helperMul
    return 1 + (n - 1) * this.cfg.push.helperMul;
  }

  private stepStuck(tr: Truck, dt: number, inp: ConvoyInput): void {
    const r = this.pushRate(tr, inp);
    if (r > 0) tr.push = Math.min(1, tr.push + (dt * r) / this.cfg.push.waterS);
    else tr.push = Math.max(0, tr.push - dt * 0.05);
    if (tr.push >= 1) {
      tr.state = 'moving';
      tr.block = null;
      tr.push = 0;
      tr.v = 0.6;
      this.stats.pushedFree++;
      this.emit({ type: 'freed', truck: tr.id });
    }
  }

  private stepWreck(tr: Truck, dt: number, inp: ConvoyInput): void {
    const d = this.cfg.driver;
    if (tr.driver === 'injured') {
      if (inp.rescuing === tr.id) tr.rescue = Math.min(1, tr.rescue + dt / d.rescueS);
      else tr.rescue = Math.max(0, tr.rescue - dt * 0.5);
      tr.driverLeft -= dt;
      if (tr.rescue >= 1) {
        tr.driver = 'rescued';
        this.stats.rescued++;
        this.emit({ type: 'driver_rescued', truck: tr.id });
      } else if (tr.driverLeft <= 0) {
        tr.driver = 'dead';
        this.stats.driversLost++;
        this.emit({ type: 'driver_dead', truck: tr.id });
      }
    }
    if (tr.block === 'wreck') {
      const r = this.pushRate(tr, inp);
      if (r > 0) tr.push = Math.min(1, tr.push + (dt * r) / this.cfg.push.wreckS);
      if (tr.push >= 1) {
        tr.block = null;
        tr.lateral = this.cfg.wreckAside;
        this.stats.wrecksCleared++;
        this.fordFreeAt = this.t;
        this.emit({ type: 'wreck_cleared', truck: tr.id });
      }
    }
  }

  /** điểm đứng đẩy: đuôi xe (phía sau theo chiều chạy) */
  pushPoint(tr: Truck): [number, number] {
    const p = this.road.at(tr.s - this.cfg.length / 2 - 0.9, tr.lateral, _p);
    return [p.x, p.z];
  }

  snapshot(): ConvoySnapshot {
    return { trucks: this.trucks.map((tr) => ({ ...tr, driverAt: tr.driverAt ? [tr.driverAt[0], tr.driverAt[1]] : null })), go: this.go, t: this.t, fordFreeAt: this.fordFreeAt, holdUntil: this.holdUntil };
  }

  restore(s: ConvoySnapshot): void {
    this.trucks.length = 0;
    for (const tr of s.trucks) this.trucks.push({ ...tr, driverAt: tr.driverAt ? [tr.driverAt[0], tr.driverAt[1]] : null });
    this.go = s.go;
    this.t = s.t;
    this.fordFreeAt = s.fordFreeAt;
    this.holdUntil = s.holdUntil;
    this.doneFired = this.done;
    this.stats.crossed = this.trucks.filter((t) => t.state === 'crossed' || t.state === 'gone').length;
    this.stats.destroyed = this.trucks.filter((t) => t.state === 'burning').length;
    this.stats.rescued = this.trucks.filter((t) => t.driver === 'rescued').length;
    this.stats.driversLost = this.trucks.filter((t) => t.driver === 'dead').length;
  }
}
