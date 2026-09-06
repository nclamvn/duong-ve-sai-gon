/**
 * "Máy bay là thời tiết" (TIP-D-SKY, PRD REN/AUD, Blueprint G1 bản sắc M1): lượt bay ambient seeded trên ô terrain —
 * tiêm kích cặp đôi bay thấp qua thung lũng, trực thăng theo tuyến/treo đổ quân, vận tải cao, dù (phi công nhảy khỏi máy bay
 * trúng đạn). Mỗi `FlightDef` = model (manifest `air_*`), cao độ AGL, tốc độ, chu kỳ; lịch/đường bay từ PRNG (seed level) →
 * cùng seed → cùng bầu trời. Không biết game/*: gió xoáy trực thăng và âm thanh đi qua callback (`onGust`, `sound`).
 * Đường bay: đường thẳng qua điểm `through` (ngẫu nhiên trong vùng chơi) dài 2R; cao độ = max địa hình dọc đường + AGL (không đâm núi);
 * treo (hover): giảm tốc tới điểm, treo `seconds`, bay tiếp. Dù: thả ở giữa đường bay của lượt `parachute`, rơi 5 m/s, trôi theo gió.
 */
import { Group, Object3D, Vector3, type Camera } from 'three/webgpu';
import { mulberry32, hashString, type Prng } from '../core/prng';
import type { TerrainTile } from '../terrain/tile';
import { createParachute, type Parachute } from './parachute';

export interface FlightDef {
  id: string;
  /** id model manifest (public/assets/models/<id>.glb) */
  model: string;
  kind: 'heli' | 'jet' | 'prop';
  /** đội hình 1–3 (so le phía sau-bên) */
  count?: number;
  /** cao độ trên địa hình dọc đường bay (m): [min, max] */
  agl: [number, number];
  /** m/s */
  speed: number;
  /** giây giữa hai lượt [min, max] */
  period: [number, number];
  /** giây trước lượt đầu (mặc định ngẫu nhiên trong period) */
  first?: number;
  /** bán kính đường bay quanh tâm (m) — vào/ra ngoài tầm nhìn */
  radius?: number;
  /** treo (đổ quân/cứu thương): điểm x/z, giây treo, AGL treo */
  hover?: { at: [number, number]; seconds: number; agl: number };
  /** thả dù ở giữa đường (phi công nhảy): số dù, AGL rơi */
  parachute?: { count: number };
  scale?: number;
  sound?: 'rotor' | 'jet' | 'prop' | 'none';
  /** bán kính gió xoáy xuống tán (m) — trực thăng */
  gust?: number;
  /** regex node quay (rotor/cánh quạt) quanh trục y local */
  spin?: string;
  /** rad/s quay */
  spinRate?: number;
  /** nghiêng cánh (rad) khi bay thẳng — tiêm kích bay "lắc" nhẹ */
  bank?: number;
}

export interface AirTrafficDef {
  seed: number;
  /** tâm vùng chơi x/z */
  center: [number, number];
  flights: FlightDef[];
  /** gió tầng cao (m/s, hướng x/z) cho dù trôi */
  wind?: [number, number];
}

export interface AircraftSound {
  set(pos: Vector3, vel: Vector3): void;
  stop(): void;
}

export interface SkyHooks {
  /** gió xoáy trực thăng: strength 0..1, hướng x/z (từ trực thăng tới người nghe); gọi mỗi frame khi có; strength 0 = hết */
  onGust?: (strength: number, dx: number, dz: number) => void;
  /** tạo nguồn âm 3D cho một lượt (null = không âm) */
  sound?: (kind: NonNullable<FlightDef['sound']>) => AircraftSound | null;
}

interface Run {
  def: FlightDef;
  a: Vector3;
  b: Vector3;
  /** điểm treo (world) hoặc null */
  hover: Vector3 | null;
  hoverT: number;
  /** thời điểm bắt đầu (s, đồng hồ sky) */
  t0: number;
  /** tổng dài đường (m) */
  length: number;
  /** tiến độ dọc đường (m) */
  s: number;
  phase: 'fly' | 'hover' | 'out' | 'done';
  hoverLeft: number;
  ships: Group[];
  spinNodes: Object3D[][];
  sounds: Array<AircraftSound | null>;
  paraDropped: boolean;
  bankPhase: number;
}

export interface SkyStats {
  flights: number;
  active: number;
  runs: number;
  parachutes: number;
  gust: number;
  nearestM: number;
}

const _dir = new Vector3();
const _pos = new Vector3();
const _vel = new Vector3();
const _tmp = new Vector3();

export class SkyTraffic {
  readonly group = new Group();
  readonly stats: SkyStats = { flights: 0, active: 0, runs: 0, parachutes: 0, gust: 0, nearestM: Infinity };
  /** đồng hồ riêng (s) — tua nhanh được (debug/E2E) */
  time = 0;
  private readonly prng: Prng;
  private readonly nextAt = new Map<string, number>();
  private readonly runs: Run[] = [];
  private readonly parachutes: Parachute[] = [];
  private readonly listener = new Vector3();
  private readonly wind: [number, number];

  constructor(
    readonly tile: TerrainTile,
    readonly def: AirTrafficDef,
    /** template model theo id (đã nạp); thiếu → bỏ lượt */
    private readonly models: Record<string, Object3D>,
    private readonly hooks: SkyHooks = {},
  ) {
    this.group.name = 'sky_traffic';
    this.prng = mulberry32(hashString('sky', def.seed));
    this.wind = def.wind ?? [3, 1];
    for (const f of def.flights) {
      if (!models[f.model]) {
        console.warn(`[sky] flight ${f.id}: model ${f.model} not loaded — skipped`);
        continue;
      }
      this.nextAt.set(f.id, f.first ?? this.prng.range(f.period[0] * 0.2, f.period[1] * 0.6));
      this.stats.flights++;
    }
  }

  /** tua nhanh lịch (s) — chỉ lịch và tiến độ, không render */
  advance(seconds: number): void {
    const step = 0.25;
    let left = seconds;
    while (left > 0) {
      const dt = Math.min(step, left);
      this.step(dt);
      left -= dt;
    }
  }

  /** gọi mỗi frame trước render; listener = vị trí người chơi/camera */
  update(dt: number, camera: Camera): void {
    this.listener.setFromMatrixPosition(camera.matrixWorld);
    this.step(dt);
  }

  private step(dt: number): void {
    this.time += dt;
    // lịch: bắt đầu lượt mới
    for (const f of this.def.flights) {
      const at = this.nextAt.get(f.id);
      if (at === undefined || this.time < at) continue;
      this.startRun(f);
      this.nextAt.set(f.id, this.time + this.prng.range(f.period[0], f.period[1]));
    }
    let gust = 0;
    let gdx = 0;
    let gdz = 0;
    let nearest = Infinity;
    for (const r of this.runs) {
      if (r.phase === 'done') continue;
      const d = r.def;
      // tốc độ: giảm tốc tới điểm treo, treo, tăng tốc rời
      let v = d.speed;
      if (r.hover) {
        const toHover = r.hoverT - r.s;
        if (r.phase === 'fly' && toHover < 250) v = Math.max(6, d.speed * Math.max(0.15, toHover / 250));
        if (r.phase === 'fly' && toHover <= 1) {
          r.phase = 'hover';
          r.hoverLeft = d.hover!.seconds;
        }
        if (r.phase === 'hover') {
          v = 0;
          r.hoverLeft -= dt;
          if (r.hoverLeft <= 0) r.phase = 'out';
        }
        if (r.phase === 'out') v = Math.min(d.speed, 6 + (r.s - r.hoverT) * 0.4);
      }
      r.s += v * dt;
      if (r.s >= r.length) {
        this.endRun(r);
        continue;
      }
      // vị trí dọc đường + cao độ (treo thấp hơn quanh điểm treo)
      _dir.subVectors(r.b, r.a).normalize();
      _pos.copy(r.a).addScaledVector(_dir, r.s);
      let y = _pos.y;
      if (r.hover) {
        const hoverY = this.tile.sample(r.hover.x, r.hover.z) + d.hover!.agl;
        const w = Math.max(0, 1 - Math.abs(r.s - r.hoverT) / 300);
        y = y + (hoverY - y) * (w * w * (3 - 2 * w));
      }
      // trực thăng: lắc nhẹ; phản lực: nghiêng cánh theo pha
      const bob = d.kind === 'heli' ? Math.sin(this.time * 1.3 + r.t0) * 1.5 : 0;
      r.bankPhase += dt * (d.kind === 'jet' ? 0.6 : 0.9);
      const bank = (d.bank ?? 0) * Math.sin(r.bankPhase);
      const yaw = Math.atan2(-_dir.x, -_dir.z); // model nhìn −z (quy ước convert-model: dài theo +x → xoay; xem align dưới)
      _vel.copy(_dir).multiplyScalar(v);
      for (let i = 0; i < r.ships.length; i++) {
        const ship = r.ships[i]!;
        // đội hình so le: lùi 40 m, lệch ngang ±25 m, thấp hơn 4 m mỗi chiếc
        const back = i * 40;
        const side = (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * 25;
        ship.position.set(_pos.x - _dir.x * back + _dir.z * side, y + bob - i * 4, _pos.z - _dir.z * back - _dir.x * side);
        ship.rotation.set(0, yaw, 0, 'YXZ');
        ship.rotateZ(bank);
        if (d.kind === 'jet' && r.phase === 'fly') ship.rotateX(0.02);
        for (const n of r.spinNodes[i] ?? []) n.rotation.y += (d.spinRate ?? 28) * dt;
        const snd = r.sounds[i];
        if (snd) snd.set(ship.position, _vel);
        const dist = ship.position.distanceTo(this.listener);
        if (dist < nearest) nearest = dist;
        // gió xoáy trực thăng lên tán (VEG-002): trong bán kính gust ngang và thấp hơn 150 m
        if (d.gust && d.kind === 'heli') {
          const dx = this.listener.x - ship.position.x;
          const dz = this.listener.z - ship.position.z;
          const dh = Math.hypot(dx, dz);
          const alt = ship.position.y - this.listener.y;
          if (dh < d.gust && alt < 150 && alt > -5) {
            const g = (1 - dh / d.gust) * (1 - Math.min(1, Math.max(0, (alt - 40) / 110)));
            if (g > gust) {
              gust = g;
              const l = dh || 1;
              gdx = dx / l;
              gdz = dz / l;
            }
          }
        }
      }
      // thả dù ở giữa đường (phi công nhảy) — cách người nghe ≥ 400 m
      if (d.parachute && !r.paraDropped && r.s > r.length * 0.5) {
        r.paraDropped = true;
        const lead = r.ships[0]!;
        if (lead.position.distanceTo(this.listener) > 400) {
          for (let k = 0; k < d.parachute.count; k++) {
            _tmp.copy(lead.position).addScaledVector(_dir, -30 - k * 25);
            this.dropParachute(_tmp.x, _tmp.y, _tmp.z);
          }
        }
      }
    }
    // dù: rơi + trôi + đung đưa; chạm đất → gấp lại (ẩn)
    for (const p of this.parachutes) {
      if (!p.alive) continue;
      const g = p.group;
      g.position.y -= p.descent * dt;
      g.position.x += this.wind[0] * dt;
      g.position.z += this.wind[1] * dt;
      p.swing += dt;
      g.rotation.set(Math.sin(p.swing * 0.9) * 0.08, p.yaw, Math.sin(p.swing * 0.7 + 1) * 0.08);
      const ground = this.tile.sample(g.position.x, g.position.z);
      if (g.position.y <= ground + 0.5) p.land(ground);
      const dist = g.position.distanceTo(this.listener);
      if (dist < nearest) nearest = dist;
    }
    // dọn dù đã xong
    for (let i = this.parachutes.length - 1; i >= 0; i--) {
      const p = this.parachutes[i]!;
      if (p.done(this.time)) {
        this.group.remove(p.group);
        p.dispose();
        this.parachutes.splice(i, 1);
      }
    }
    if (this.hooks.onGust) this.hooks.onGust(gust, gdx, gdz);
    this.stats.gust = gust;
    this.stats.nearestM = nearest;
    this.stats.active = this.runs.filter((r) => r.phase !== 'done').length;
    this.stats.parachutes = this.parachutes.filter((p) => p.alive).length;
  }

  /** kích hoạt một lượt bay ngay (mission `sky_trigger`, TIP-M1A) — không đụng lịch; false nếu không có flight/model */
  trigger(flightId: string): boolean {
    const f = this.def.flights.find((x) => x.id === flightId);
    if (!f || !this.models[f.model]) return false;
    this.startRun(f);
    return true;
  }

  private startRun(d: FlightDef): void {
    const tpl = this.models[d.model];
    if (!tpl) return;
    const R = d.radius ?? 1400;
    const c = this.def.center;
    // điểm đi qua: quanh tâm ±300 m (hoặc điểm treo)
    const through = d.hover ? new Vector3(d.hover.at[0], 0, d.hover.at[1]) : new Vector3(c[0] + this.prng.range(-300, 300), 0, c[1] + this.prng.range(-300, 300));
    const heading = this.prng.range(0, Math.PI * 2);
    _dir.set(Math.sin(heading), 0, Math.cos(heading));
    const a = through.clone().addScaledVector(_dir, -R);
    const b = through.clone().addScaledVector(_dir, R);
    // cao độ: max địa hình dọc đường (bước 50 m) + AGL
    let maxH = -Infinity;
    const steps = Math.ceil((2 * R) / 50);
    for (let i = 0; i <= steps; i++) {
      _tmp.lerpVectors(a, b, i / steps);
      const x = Math.max(-this.tile.half, Math.min(this.tile.half, _tmp.x));
      const z = Math.max(-this.tile.half, Math.min(this.tile.half, _tmp.z));
      maxH = Math.max(maxH, this.tile.sample(x, z));
    }
    const y = maxH + this.prng.range(d.agl[0], d.agl[1]);
    a.y = y;
    b.y = y;
    const n = Math.max(1, Math.min(3, d.count ?? 1));
    const ships: Group[] = [];
    const spinNodes: Object3D[][] = [];
    const sounds: Array<AircraftSound | null> = [];
    const spinRe = d.spin ? new RegExp(d.spin, 'i') : /rotor|blade|prop/i;
    for (let i = 0; i < n; i++) {
      const g = new Group();
      const m = tpl.clone(true);
      // convert-model: dài theo +x → mũi ở +x; hệ bay: mũi −z → xoay −90° quanh y (mũi +x → −z)
      m.rotation.y = Math.PI / 2;
      if (d.scale) m.scale.setScalar(d.scale);
      g.add(m);
      g.name = `sky_${d.id}_${i}`;
      g.position.copy(a);
      this.group.add(g);
      ships.push(g);
      const spins: Object3D[] = [];
      m.traverse((o) => {
        if (o !== m && spinRe.test(o.name)) spins.push(o);
      });
      spinNodes.push(spins);
      const kind = d.sound ?? (d.kind === 'heli' ? 'rotor' : d.kind === 'jet' ? 'jet' : 'prop');
      sounds.push(kind !== 'none' && this.hooks.sound ? this.hooks.sound(kind) : null);
    }
    const hover = d.hover ? new Vector3(d.hover.at[0], 0, d.hover.at[1]) : null;
    const run: Run = { def: d, a, b, hover, hoverT: hover ? R : 0, t0: this.time, length: 2 * R, s: 0, phase: 'fly', hoverLeft: 0, ships, spinNodes, sounds, paraDropped: false, bankPhase: this.prng.range(0, 6.28) };
    this.runs.push(run);
    this.stats.runs++;
  }

  private endRun(r: Run): void {
    r.phase = 'done';
    for (const s of r.ships) this.group.remove(s);
    for (const s of r.sounds) s?.stop();
    const i = this.runs.indexOf(r);
    if (i >= 0) this.runs.splice(i, 1);
  }

  /** thả một dù tại vị trí world (set piece/debug) */
  dropParachute(x: number, y: number, z: number): void {
    const p = createParachute(this.prng);
    p.group.position.set(x, y, z);
    this.group.add(p.group);
    this.parachutes.push(p);
  }

  /** dù đang rơi/đã đáp (debug) */
  parachutesNow(): Array<{ pos: [number, number, number]; alive: boolean }> {
    return this.parachutes.map((p) => ({ pos: [p.group.position.x, p.group.position.y, p.group.position.z], alive: p.alive }));
  }

  /** lượt đang bay (debug) */
  active(): Array<{ id: string; phase: string; pos: [number, number, number]; s: number; length: number }> {
    return this.runs.map((r) => ({ id: r.def.id, phase: r.phase, pos: [r.ships[0]!.position.x, r.ships[0]!.position.y, r.ships[0]!.position.z], s: r.s, length: r.length }));
  }

  dispose(): void {
    for (const r of [...this.runs]) this.endRun(r);
    for (const p of this.parachutes) p.dispose();
    this.parachutes.length = 0;
    this.group.removeFromParent();
  }
}
