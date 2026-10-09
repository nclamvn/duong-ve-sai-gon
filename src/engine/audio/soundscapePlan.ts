/**
 * Kế hoạch cảnh âm rừng (TIP soundscape Trường Sơn) — THUẦN TS: không three, không WebAudio, không DOM.
 * Nhận cấu hình voice (content/ecology/soundscape.*.json, số liệu có ref tới registry refinery
 * docs/research/rung-truong-son) + trạng thái môi trường mỗi frame, trả danh sách sự kiện cần phát và mức các lớp nền.
 *
 * Tất định: cùng seed + cùng chuỗi (dt, state) → cùng sự kiện. PRNG mulberry32, mỗi voice một stream fork theo id;
 * nhóm vượn dựng lịch theo ngày bằng stream hash(id:ngày) để đổi voice khác không làm lệch lịch vượn.
 *
 * Mô hình thời gian:
 *  - Đồng hồ là `state.localMin` (phút từ 0h, giờ địa phương); phải tăng dần theo thời gian chơi
 *    (vd startMin + elapsedS/60). Quay vòng qua nửa đêm (giảm > 720 phút) → sang ngày mới.
 *  - Nhảy giờ (lùi hoặc tiến > 30 phút trong một frame) → không phát dồn backlog, chỉ đồng bộ lại.
 *  - `startOffset` (giây) đặt sự kiện trong frame: tỉ lệ (tEvent − tPrev)/(tCur − tPrev) × dt.
 *
 * Mô hình voice:
 *  - bout (vượn): mỗi ngày 1–3 nhóm ở các phương khác nhau; nhóm đầu bắt đầu quanh sunrise−12, mọi nhóm tắt
 *    quanh sunrise+13 (lệch ngày ±windowJitterMin); hồi hót trung bình 16 phút, ngắn lại theo gió; trong hồi:
 *    intro (cả hai) → great call (cái) → coda (đực) → interlude (đực) … → great call kế sau 1–2 phút.
 *  - poisson: tần suất ratePerHour × trọng số cửa sổ × mưa × mùa.
 *  - bed: lớp nền liên tục (mưa phùn, ve sầu), trả mức 0..1 mỗi frame.
 *  - alarm: chỉ phát khi gọi alarm() (mang sủa, voọc sủa + đập cành).
 */
import { hashString, mulberry32, type Prng } from '@engine/core/prng';

export type VoiceKind = 'gibbon' | 'hornbill' | 'coucal' | 'junglefowl' | 'gecko' | 'frogs' | 'muntjac' | 'douc' | 'cicada' | 'drizzle';
export type VoiceModel = 'bout' | 'poisson' | 'bed' | 'alarm';
export type TimeAnchor = 'sunrise' | 'sunset' | 'local';
export type RainGate = 'any' | 'dry' | 'wet';
export type Range2 = readonly [number, number];

export interface TimePoint {
  anchor: TimeAnchor;
  /** phút lệch so với anchor (local: phút từ 0h) */
  min: number;
}

export interface VoiceWindow {
  start: TimePoint;
  end: TimePoint;
  weight: number;
  /** dốc vào/ra (phút) cho lớp nền; 0 = vuông */
  rampMin?: number;
}

export interface VoiceRef {
  entity: string;
  field: string;
  basis: 'quantitative' | 'qualitative';
  supports: string[];
  note?: string;
}

export interface VoiceConfig {
  id: string;
  kind: VoiceKind;
  model: VoiceModel;
  variant?: string;
  windows?: VoiceWindow[];
  windowJitterMin?: number;
  months: number[];
  seasonWeight?: { months: number[]; inSeason: number; offSeason: number };
  rain: RainGate;
  /** wet: chỉ hoạt động khi rain > rainMin */
  rainMin?: number;
  /** dry: tắt hẳn khi rain ≥ dryMax */
  dryMax?: number;
  /** any: hệ số khi rain = 1 (nội suy tuyến tính từ 1 ở rain = 0) */
  rainFactor?: number;
  ratePerHour?: number;
  bout?: { meanMin: number; sdMin: number; minMin: number; windShorten: number };
  groups?: Range2;
  greatCallEveryMin?: Range2;
  distance?: Range2;
  elevationM?: Range2;
  gainDb: number;
  wet?: number;
  alarmOnly?: boolean;
  sourceDbSpl?: number;
  synth?: Record<string, number | Range2>;
  refs: VoiceRef[];
  design: string[];
}

export interface SoundscapeConfig {
  id: string;
  version: number;
  voices: VoiceConfig[];
}

export interface AmbientState {
  /** phút từ 0h giờ địa phương [0, 1440) */
  localMin: number;
  sunriseMin: number;
  sunsetMin: number;
  /** 1..12 */
  month: number;
  /** 0..1 */
  rain: number;
  /** 0..1 */
  wind: number;
}

export interface EventParams {
  /** seed cho chi tiết tổng hợp (cao độ, nhịp từng nốt) — synth tự fork, không cần mảng */
  seed: number;
  /** số nốt/tiếng/cụm theo kind */
  count: number;
  /** chỉ số nhóm vượn (−1 nếu không phải) */
  group: number;
  /** thời lượng dự kiến (giây) — great call dùng để đặt coda */
  durationS: number;
}

export interface SoundEvent {
  voiceId: string;
  kind: VoiceKind;
  /** intro|great|coda|interlude (vượn), duet|wingbeat, crow|roost, call, chorus, bark, alarm */
  variant: string;
  /** giây kể từ đầu frame hiện tại */
  startOffset: number;
  /** phương vị quanh người nghe, 0 = −Z (bắc), tăng theo chiều kim đồng hồ nhìn từ trên */
  azimuthRad: number;
  distanceM: number;
  elevationM: number;
  /** 0..1, nhân với gainDb */
  intensity: number;
  gainDb: number;
  wet: number;
  params: EventParams;
}

export interface BedLevel {
  voiceId: string;
  kind: VoiceKind;
  /** 0..1 */
  intensity: number;
  gainDb: number;
}

export interface PlanOutput {
  /** sự kiện mới trong frame này (mảng tái dùng — copy nếu cần giữ) */
  events: SoundEvent[];
  /** mức mọi lớp nền theo thứ tự cấu hình (đối tượng tái dùng) */
  beds: BedLevel[];
}

const DAY = 1440;
const TAU = Math.PI * 2;
/** nhảy giờ quá ngưỡng này trong một frame → đồng bộ lại, không phát dồn */
const MAX_STEP_MIN = 30;

const KINDS: readonly VoiceKind[] = ['gibbon', 'hornbill', 'coucal', 'junglefowl', 'gecko', 'frogs', 'muntjac', 'douc', 'cicada', 'drizzle'];
const MODELS: readonly VoiceModel[] = ['bout', 'poisson', 'bed', 'alarm'];
const ANCHORS: readonly TimeAnchor[] = ['sunrise', 'sunset', 'local'];
const GATES: readonly RainGate[] = ['any', 'dry', 'wet'];

// ---------------------------------------------------------------- helpers thuần (dùng chung với synth)

export const dbToGain = (db: number): number => Math.pow(10, db / 20);

/** Suy hao theo khoảng cách cho nền rừng: mềm hơn inverse (mũ 0,6) để tiếng vượn 1 km vẫn nghe được. */
export function distanceGain(distanceM: number, refM = 25): number {
  if (!(distanceM > refM)) return 1;
  return Math.pow(refM / distanceM, 0.6);
}

/** Hấp thụ không khí + tán lá: cắt cao dần theo khoảng cách. */
export function airLowpassHz(distanceM: number): number {
  const hz = 16000 / (1 + Math.max(0, distanceM) / 120);
  return Math.min(16000, Math.max(900, hz));
}

const mod = (a: number, n: number): number => ((a % n) + n) % n;
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export function resolveTime(p: TimePoint, s: AmbientState): number {
  return p.anchor === 'sunrise' ? s.sunriseMin + p.min : p.anchor === 'sunset' ? s.sunsetMin + p.min : p.min;
}

/** Trọng số cửa sổ tại giờ `tod` (có thể vắt qua nửa đêm). 0 ngoài cửa sổ. */
export function windowWeight(w: VoiceWindow, tod: number, s: AmbientState): number {
  const a = resolveTime(w.start, s);
  const b = resolveTime(w.end, s);
  let len = b - a;
  if (len <= 0) len += DAY;
  if (len > DAY) len = DAY;
  const d = mod(tod - a, DAY);
  if (d > len) return 0;
  const ramp = w.rampMin ?? 0;
  if (ramp > 0) return w.weight * clamp(Math.min(d, len - d) / ramp, 0, 1);
  return w.weight;
}

/** Trọng số lớn nhất trên các cửa sổ; voice không khai cửa sổ = cả ngày (1). */
export function voiceWindowWeight(v: VoiceConfig, tod: number, s: AmbientState): number {
  if (!v.windows || v.windows.length === 0) return 1;
  let w = 0;
  for (const win of v.windows) w = Math.max(w, windowWeight(win, tod, s));
  return w;
}

export function seasonFactor(v: VoiceConfig, month: number): number {
  if (!v.months.includes(month)) return 0;
  const sw = v.seasonWeight;
  if (!sw) return 1;
  return sw.months.includes(month) ? sw.inSeason : sw.offSeason;
}

/** Hệ số mưa theo cổng: any → nội suy tới rainFactor; dry → giảm tới 0 ở dryMax; wet → tỉ lệ rain khi > rainMin. */
export function rainTerm(v: VoiceConfig, rain: number): number {
  const r = clamp(rain, 0, 1);
  if (v.rain === 'wet') return r > (v.rainMin ?? 0) ? r : 0;
  if (v.rain === 'dry') {
    const m = v.dryMax ?? 0.15;
    return r >= m ? 0 : 1 - r / m;
  }
  return 1 - r * (1 - (v.rainFactor ?? 1));
}

function range2(x: number | Range2 | undefined, fallback: Range2): Range2 {
  if (Array.isArray(x)) return x as Range2;
  if (typeof x === 'number') return [x, x];
  return fallback;
}

/** Nốt thứ i của great call (cái): cao dần 600 → 1600 Hz, nốt ngắn dần, khoảng nghỉ ngắn dần (nhanh dần). */
export function greatCallNote(i: number, n: number, hz: Range2 = [600, 1600]): { hz: number; durS: number; gapS: number } {
  const u = n <= 1 ? 1 : i / (n - 1);
  return {
    hz: hz[0] + (hz[1] - hz[0]) * Math.pow(u, 0.8),
    durS: 0.55 - 0.37 * u,
    gapS: 0.5 - 0.42 * u,
  };
}

export function greatCallDurationS(n: number, hz?: Range2): number {
  let t = 0;
  for (let i = 0; i < n; i++) {
    const nt = greatCallNote(i, n, hz);
    t += nt.durS + (i < n - 1 ? nt.gapS : 0);
  }
  return t;
}

// ---------------------------------------------------------------- validate cấu hình (fail-loud)

function fail(msg: string): never {
  throw new Error(`soundscape config: ${msg}`);
}

function isNum(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

function checkRange(id: string, name: string, x: unknown): void {
  if (x === undefined) return;
  if (!Array.isArray(x) || x.length !== 2 || !isNum(x[0]) || !isNum(x[1]) || x[0] > x[1]) fail(`${id}.${name} must be [min,max]`);
}

export function parseSoundscapeConfig(raw: unknown): SoundscapeConfig {
  if (!raw || typeof raw !== 'object') fail('not an object');
  const c = raw as Partial<SoundscapeConfig>;
  if (typeof c.id !== 'string') fail('id missing');
  if (!Array.isArray(c.voices) || c.voices.length === 0) fail('voices missing');
  const ids = new Set<string>();
  for (const v of c.voices) {
    const id = typeof v?.id === 'string' ? v.id : fail('voice id missing');
    if (ids.has(id)) fail(`duplicate voice ${id}`);
    ids.add(id);
    if (!KINDS.includes(v.kind)) fail(`${id}.kind invalid`);
    if (!MODELS.includes(v.model)) fail(`${id}.model invalid`);
    if (!GATES.includes(v.rain)) fail(`${id}.rain invalid`);
    if (!Array.isArray(v.months) || v.months.some((m) => !Number.isInteger(m) || m < 1 || m > 12)) fail(`${id}.months invalid`);
    if (!isNum(v.gainDb)) fail(`${id}.gainDb missing`);
    if (!Array.isArray(v.refs) || v.refs.length === 0) fail(`${id}.refs missing`);
    for (const r of v.refs) if (typeof r.entity !== 'string' || typeof r.field !== 'string' || !Array.isArray(r.supports)) fail(`${id}.refs entry invalid`);
    if ((v.alarmOnly === true) !== (v.model === 'alarm')) fail(`${id}: alarmOnly must match model alarm`);
    for (const w of v.windows ?? []) {
      if (!ANCHORS.includes(w.start?.anchor) || !ANCHORS.includes(w.end?.anchor) || !isNum(w.start.min) || !isNum(w.end.min) || !isNum(w.weight)) fail(`${id}.windows invalid`);
    }
    checkRange(id, 'groups', v.groups);
    checkRange(id, 'greatCallEveryMin', v.greatCallEveryMin);
    checkRange(id, 'distance', v.distance);
    checkRange(id, 'elevationM', v.elevationM);
    if (v.model === 'bout') {
      if (!v.bout || !isNum(v.bout.meanMin) || !v.windows || v.windows.length === 0 || !v.groups || !v.greatCallEveryMin) fail(`${id}: bout model needs bout, windows, groups, greatCallEveryMin`);
    }
    if (v.model === 'poisson' && !isNum(v.ratePerHour)) fail(`${id}: poisson model needs ratePerHour`);
  }
  return c as SoundscapeConfig;
}

// ---------------------------------------------------------------- lịch vượn theo ngày

type GibbonPhase = 'intro' | 'great' | 'coda' | 'interlude';

interface GroupBout {
  group: number;
  azimuthRad: number;
  distanceM: number;
  elevationM: number;
  start: number;
  end: number;
  /** thời điểm (phút tuyệt đối) của phrase kế */
  next: number;
  phase: GibbonPhase;
  nextGreat: number;
  /** số nốt + thời lượng great call đang chờ (để đặt coda ngay sau) */
  pendingCount: number;
  pendingDurS: number;
  prng: Prng;
}

interface DayPlan {
  day: number;
  groups: GroupBout[];
}

interface VoiceRuntime {
  cfg: VoiceConfig;
  prng: Prng;
  days: DayPlan[];
}

function emptyEvent(): SoundEvent {
  return {
    voiceId: '',
    kind: 'gibbon',
    variant: '',
    startOffset: 0,
    azimuthRad: 0,
    distanceM: 0,
    elevationM: 0,
    intensity: 0,
    gainDb: 0,
    wet: 0,
    params: { seed: 0, count: 0, group: -1, durationS: 0 },
  };
}

export class SoundscapePlan {
  readonly cfg: SoundscapeConfig;
  readonly seed: number;
  private readonly rt: VoiceRuntime[];
  private readonly out: PlanOutput;
  private readonly bedIndex: number[] = [];
  private readonly alarmPrng: Prng;
  private prevLocal: number | null = null;
  private prevAbs = 0;
  private day = 0;
  /** tổng số sự kiện đã phát theo voice id (debug/QA) */
  readonly counts = new Map<string, number>();

  constructor(cfg: SoundscapeConfig, seed: number) {
    this.cfg = parseSoundscapeConfig(cfg);
    this.seed = seed >>> 0;
    const root = mulberry32(this.seed);
    this.alarmPrng = root.fork('alarm');
    this.rt = this.cfg.voices.map((v) => ({ cfg: v, prng: root.fork(v.id), days: [] }));
    this.out = { events: [], beds: [] };
    this.cfg.voices.forEach((v, i) => {
      if (v.model === 'bed') {
        this.bedIndex.push(i);
        this.out.beds.push({ voiceId: v.id, kind: v.kind, intensity: 0, gainDb: v.gainDb });
      }
      this.counts.set(v.id, 0);
    });
  }

  /** phút tuyệt đối (ngày × 1440 + localMin) của frame gần nhất */
  get absMin(): number {
    return this.prevAbs;
  }

  voice(id: string): VoiceConfig | undefined {
    return this.cfg.voices.find((v) => v.id === id);
  }

  update(dt: number, s: AmbientState): PlanOutput {
    const out = this.out;
    out.events.length = 0;
    if (!Number.isFinite(s.localMin) || !Number.isFinite(dt)) return out;
    const local = mod(s.localMin, DAY);
    if (this.prevLocal === null) {
      this.prevLocal = local;
      this.prevAbs = this.day * DAY + local;
      this.updateBeds(s, local);
      return out;
    }
    if (local < this.prevLocal - DAY / 2) this.day++;
    else if (local > this.prevLocal + DAY / 2) this.day = Math.max(0, this.day - 1);
    const abs = this.day * DAY + local;
    const dMin = abs - this.prevAbs;
    this.prevLocal = local;
    if (dMin < 0 || dMin > MAX_STEP_MIN) {
      // nhảy giờ: bỏ lịch cũ, không phát dồn
      for (const r of this.rt) r.days.length = 0;
      this.prevAbs = abs;
      this.updateBeds(s, local);
      return out;
    }
    const t0 = this.prevAbs;
    this.prevAbs = abs;
    this.updateBeds(s, local);
    if (dMin === 0) return out;
    const dtS = dt > 0 ? dt : dMin * 60;
    for (const r of this.rt) {
      if (r.cfg.model === 'bout') this.updateBout(r, t0, abs, dtS, s);
      else if (r.cfg.model === 'poisson') this.updatePoisson(r, t0, abs, dtS, s, local);
    }
    return out;
  }

  /** Sự kiện báo động (mang/voọc) — không theo lịch. Trả event mới (không tái dùng). */
  alarm(kind: 'muntjac' | 'douc', azimuthRad: number, distanceM: number): SoundEvent | null {
    const v = this.cfg.voices.find((x) => x.kind === kind && x.model === 'alarm');
    if (!v) return null;
    const p = this.alarmPrng;
    const ev = emptyEvent();
    const cnt = range2(v.synth?.['count'], [1, 1]);
    ev.voiceId = v.id;
    ev.kind = v.kind;
    ev.variant = 'alarm';
    ev.azimuthRad = azimuthRad;
    ev.distanceM = distanceM;
    const el = v.elevationM ?? [0, 0];
    ev.elevationM = p.range(el[0], el[1]);
    ev.intensity = 1;
    ev.gainDb = v.gainDb;
    ev.wet = v.wet ?? 0.3;
    ev.params.seed = p.int(0, 0x7fffffff);
    ev.params.count = p.int(cnt[0], cnt[1]);
    this.counts.set(v.id, (this.counts.get(v.id) ?? 0) + 1);
    return ev;
  }

  // ------------------------------------------------------------ beds

  private updateBeds(s: AmbientState, local: number): void {
    for (let k = 0; k < this.bedIndex.length; k++) {
      const v = this.cfg.voices[this.bedIndex[k]!]!;
      const bed = this.out.beds[k]!;
      const lvl = voiceWindowWeight(v, local, s) * seasonFactor(v, s.month) * rainTerm(v, s.rain);
      bed.intensity = clamp(lvl, 0, 1);
    }
  }

  // ------------------------------------------------------------ poisson

  private updatePoisson(r: VoiceRuntime, t0: number, t1: number, dtS: number, s: AmbientState, local: number): void {
    const v = r.cfg;
    const sw = seasonFactor(v, s.month);
    if (sw <= 0) return;
    const w = voiceWindowWeight(v, local, s);
    if (w <= 0) return;
    const rt = rainTerm(v, s.rain);
    if (rt <= 0) return;
    const rate = (v.ratePerHour ?? 0) * w * sw * rt;
    const expected = (rate * (t1 - t0)) / 60;
    const p = r.prng;
    if (p.next() >= 1 - Math.exp(-expected)) return;
    const ev = this.push(v);
    ev.variant = v.variant ?? (v.kind === 'frogs' ? 'chorus' : 'call');
    ev.startOffset = p.next() * dtS;
    ev.azimuthRad = p.next() * TAU;
    const d = v.distance ?? [20, 100];
    ev.distanceM = p.range(d[0], d[1]);
    const el = v.elevationM ?? [0, 0];
    ev.elevationM = p.range(el[0], el[1]);
    ev.intensity = clamp(w * sw * (v.rain === 'wet' ? 0.5 + 0.5 * rt : 1), 0, 1);
    const cnt = range2(v.synth?.['count'], [1, 1]);
    ev.params.seed = p.int(0, 0x7fffffff);
    ev.params.count = p.int(cnt[0], cnt[1]);
    ev.params.group = -1;
    ev.params.durationS = 0;
  }

  // ------------------------------------------------------------ bout (vượn)

  private buildDay(r: VoiceRuntime, day: number, s: AmbientState): DayPlan {
    const v = r.cfg;
    const p = mulberry32(hashString(`${v.id}:${day}`, this.seed));
    const plan: DayPlan = { day, groups: [] };
    const win = v.windows![0]!;
    const jit = v.windowJitterMin ?? 0;
    const j1 = clamp(p.gaussian() * jit * 0.5, -jit, jit);
    const j2 = clamp(p.gaussian() * jit * 0.5, -jit, jit);
    const first = day * DAY + resolveTime(win.start, s) + j1;
    const cease = Math.max(first + 1, day * DAY + resolveTime(win.end, s) + j2);
    const sw = seasonFactor(v, s.month);
    const singP = sw * rainTerm(v, s.rain);
    const g = v.groups!;
    const n = p.int(g[0], g[1]);
    const baseAz = p.next() * TAU;
    const bout = v.bout!;
    const wind = clamp(s.wind, 0, 1);
    const d = v.distance ?? [300, 1200];
    const el = v.elevationM ?? [0, 0];
    for (let i = 0; i < n; i++) {
      // rút đủ số ngẫu nhiên cho mọi nhóm để lịch không phụ thuộc nhánh
      const roll = p.next();
      const az = mod(baseAz + (i * TAU) / n + (p.next() - 0.5) * (Math.PI / n), TAU);
      const dist = p.range(d[0], d[1]);
      const elev = p.range(el[0], el[1]);
      const span = Math.max(0, (cease - first) * 0.6);
      const start = i === 0 ? first + p.range(0, Math.min(2, span)) : first + p.range(0, span);
      const durRaw = Math.max(bout.minMin, bout.meanMin + p.gaussian() * bout.sdMin);
      const dur = durRaw * (1 - bout.windShorten * wind);
      const end = Math.min(start + dur, cease);
      const gp = mulberry32(hashString(`${v.id}:${day}:${i}`, this.seed));
      if (roll >= singP || end - start < 1) continue;
      plan.groups.push({
        group: i,
        azimuthRad: az,
        distanceM: dist,
        elevationM: elev,
        start,
        end,
        next: start,
        phase: 'intro',
        nextGreat: start,
        pendingCount: 0,
        pendingDurS: 0,
        prng: gp,
      });
    }
    return plan;
  }

  private updateBout(r: VoiceRuntime, t0: number, t1: number, dtS: number, s: AmbientState): void {
    const v = r.cfg;
    const day = Math.floor(t1 / DAY);
    // dựng lịch ngày khi tới gần cửa sổ (để mưa/gió lúc bình minh quyết định, không phải lúc 0h)
    let have = false;
    for (const d of r.days) if (d.day === day) have = true;
    if (!have) {
      const winStart = day * DAY + resolveTime(v.windows![0]!.start, s) - (v.windowJitterMin ?? 0) - 1;
      if (t1 >= winStart) {
        r.days.push(this.buildDay(r, day, s));
        while (r.days.length > 2) r.days.shift();
      }
    }
    const span = t1 - t0;
    for (const plan of r.days) {
      for (const g of plan.groups) {
        let guard = 0;
        while (g.next <= t1 && g.next <= g.end && guard++ < 64) {
          const at = g.next;
          const phase = g.phase;
          const count = this.advanceGroup(v, g);
          if (at > t0) {
            const ev = this.push(v);
            ev.variant = phase;
            ev.startOffset = span > 0 ? ((at - t0) / span) * dtS : 0;
            ev.azimuthRad = g.azimuthRad;
            ev.distanceM = g.distanceM;
            ev.elevationM = g.elevationM;
            ev.intensity = phase === 'great' ? 1 : phase === 'intro' ? 0.8 : 0.7;
            ev.params.seed = g.prng.int(0, 0x7fffffff);
            ev.params.count = count;
            ev.params.group = g.group;
            ev.params.durationS = phase === 'great' ? g.pendingDurS : 0;
          }
        }
      }
    }
  }

  /** Tính phrase hiện tại (trả số nốt) và đặt thời điểm/phrase kế cho nhóm. */
  private advanceGroup(v: VoiceConfig, g: GroupBout): number {
    const p = g.prng;
    const sy = v.synth ?? {};
    const every = v.greatCallEveryMin!;
    const hz = range2(sy['greatHz'], [600, 1600]);
    let count = 1;
    switch (g.phase) {
      case 'intro': {
        const r = range2(sy['introNotes'], [3, 6]);
        count = p.int(r[0], r[1]);
        // vài nốt mở đầu ~ count × 0,75 s rồi great call
        g.phase = 'great';
        g.next = g.next + (count * 0.75 + 1) / 60;
        g.nextGreat = g.next;
        break;
      }
      case 'great': {
        const r = range2(sy['greatNotes'], [8, 14]);
        count = p.int(r[0], r[1]);
        g.pendingCount = count;
        g.pendingDurS = greatCallDurationS(count, hz);
        g.phase = 'coda';
        // coda của con đực chèn ngay sau great call
        g.next = g.next + (g.pendingDurS + 0.3) / 60;
        g.nextGreat = g.nextGreat + p.range(every[0], every[1]);
        break;
      }
      case 'coda':
      case 'interlude': {
        const key = g.phase === 'coda' ? 'codaNotes' : 'interludeNotes';
        const r = range2(sy[key], g.phase === 'coda' ? [3, 6] : [2, 4]);
        count = p.int(r[0], r[1]);
        const gap = range2(sy['interludeEveryMin'], [0.2, 0.35]);
        const nx = g.next + p.range(gap[0], gap[1]);
        if (nx >= g.nextGreat - 0.05) {
          g.phase = 'great';
          g.next = Math.max(g.nextGreat, g.next + 0.05);
        } else {
          g.phase = 'interlude';
          g.next = nx;
        }
        break;
      }
    }
    return count;
  }

  private push(v: VoiceConfig): SoundEvent {
    const ev = emptyEvent();
    ev.voiceId = v.id;
    ev.kind = v.kind;
    ev.gainDb = v.gainDb;
    ev.wet = v.wet ?? 0.3;
    this.out.events.push(ev);
    this.counts.set(v.id, (this.counts.get(v.id) ?? 0) + 1);
    return ev;
  }
}
