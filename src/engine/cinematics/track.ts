/**
 * DV-093 cinematics: camera track + timeline (engine layer — knows nothing of missions or game state).
 *
 * A cinematic is a list of shots (hard cuts between shots). Each shot has camera keys (time relative to the shot start);
 * position and look-at points are interpolated with a centripetal-free uniform Catmull-Rom spline, field of view linearly.
 * Points can be given above the terrain (`agl`) so the data stays valid if the ground is re-baked. A shot can scale sim
 * time (slow motion) and add hand-held noise. Events are absolute-time cues executed by the owner (narrative layer).
 */

export type Vec3 = [number, number, number];

export interface CameraKey {
  /** seconds from the shot start */
  t: number;
  pos: Vec3;
  look: Vec3;
  /** vertical field of view (deg); default: previous key or the shot's fov */
  fov?: number;
}

export interface ShotDef {
  id: string;
  /** shot start (s, absolute) */
  t: number;
  dur: number;
  /** y of pos/look is metres above the terrain (default true) */
  agl?: boolean;
  fov?: number;
  keys: CameraKey[];
  /** hand-held noise 0..1 (pitch/yaw/roll wobble, metres of drift) */
  shake?: number;
  /** sim time scale for the shot (1 = real time, 0.3 = slow motion) */
  timeScale?: number;
  /** ease the whole key timeline in/out (smoothstep on the shot clock) */
  ease?: boolean;
}

export interface CineEvent {
  t: number;
  type: string;
  [k: string]: unknown;
}

export interface CinematicDef {
  id: string;
  duration: number;
  fps?: number;
  shots: ShotDef[];
  events: CineEvent[];
}

export interface CameraSample {
  shot: ShotDef;
  /** time inside the shot (s) */
  local: number;
  pos: Vec3;
  look: Vec3;
  fov: number;
  roll: number;
  timeScale: number;
}

function cr(p0: number, p1: number, p2: number, p3: number, u: number): number {
  const u2 = u * u;
  const u3 = u2 * u;
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}

function splineAt(keys: readonly CameraKey[], pick: (k: CameraKey) => Vec3, t: number, out: Vec3): Vec3 {
  const n = keys.length;
  if (n === 1 || t <= keys[0]!.t) {
    const v = pick(keys[0]!);
    out[0] = v[0];
    out[1] = v[1];
    out[2] = v[2];
    return out;
  }
  if (t >= keys[n - 1]!.t) {
    const v = pick(keys[n - 1]!);
    out[0] = v[0];
    out[1] = v[1];
    out[2] = v[2];
    return out;
  }
  let i = 0;
  while (i < n - 2 && t > keys[i + 1]!.t) i++;
  const k1 = keys[i]!;
  const k2 = keys[i + 1]!;
  const k0 = keys[Math.max(0, i - 1)]!;
  const k3 = keys[Math.min(n - 1, i + 2)]!;
  const u = (t - k1.t) / Math.max(1e-6, k2.t - k1.t);
  const a = pick(k0);
  const b = pick(k1);
  const c = pick(k2);
  const d = pick(k3);
  for (let j = 0; j < 3; j++) out[j] = cr(a[j]!, b[j]!, c[j]!, d[j]!, u);
  return out;
}

/** smooth deterministic noise (sum of sines with irrational ratios) — no Math.random */
function wobble(t: number, seed: number): number {
  return Math.sin(t * 1.31 + seed) * 0.5 + Math.sin(t * 2.97 + seed * 1.7) * 0.3 + Math.sin(t * 6.53 + seed * 2.3) * 0.2;
}

export class CameraTrack {
  private readonly shots: ShotDef[];
  private readonly sample: CameraSample;

  constructor(readonly def: CinematicDef) {
    this.shots = [...def.shots].sort((a, b) => a.t - b.t);
    for (const s of this.shots) s.keys.sort((a, b) => a.t - b.t);
    const s0 = this.shots[0];
    if (!s0) throw new Error(`cinematic ${def.id}: no shots`);
    this.sample = { shot: s0, local: 0, pos: [0, 0, 0], look: [0, 0, 1], fov: 50, roll: 0, timeScale: 1 };
  }

  shotAt(t: number): ShotDef {
    let s = this.shots[0]!;
    for (const x of this.shots) if (x.t <= t) s = x;
    return s;
  }

  /** camera at absolute time t; `ground(x, z)` resolves above-ground heights. The returned object is reused. */
  at(t: number, ground: (x: number, z: number) => number): CameraSample {
    const s = this.shotAt(t);
    const out = this.sample;
    out.shot = s;
    let local = Math.max(0, Math.min(s.dur, t - s.t));
    out.local = local;
    if (s.ease) {
      const u = local / Math.max(1e-6, s.dur);
      local = u * u * (3 - 2 * u) * s.dur;
    }
    splineAt(s.keys, (k) => k.pos, local, out.pos);
    splineAt(s.keys, (k) => k.look, local, out.look);
    if (s.agl !== false) {
      out.pos[1] += ground(out.pos[0], out.pos[2]);
      out.look[1] += ground(out.look[0], out.look[2]);
    }
    // fov: linear between keys that set it; the shot fov acts as a key at t = 0
    let fov = s.fov ?? 50;
    let pt = 0;
    let pf = fov;
    for (const k of s.keys) {
      if (k.fov === undefined) continue;
      if (k.t <= local) {
        fov = k.fov;
        pt = k.t;
        pf = k.fov;
      } else {
        fov = pf + (k.fov - pf) * ((local - pt) / Math.max(1e-6, k.t - pt));
        break;
      }
    }
    out.fov = fov;
    const sh = s.shake ?? 0;
    out.roll = 0;
    if (sh > 0) {
      const tt = t * 1.0;
      out.pos[0] += wobble(tt, 1.1) * 0.05 * sh;
      out.pos[1] += wobble(tt, 2.7) * 0.04 * sh;
      out.look[0] += wobble(tt * 1.2, 4.2) * 0.35 * sh;
      out.look[1] += wobble(tt * 1.1, 5.9) * 0.25 * sh;
      out.roll = wobble(tt * 0.9, 7.3) * 0.02 * sh;
    }
    out.timeScale = s.timeScale ?? 1;
    return out;
  }
}

/** Fires each event once when the clock passes its time (in order); `seek` back resets. */
export class CueTimeline {
  private readonly events: CineEvent[];
  private next = 0;

  constructor(events: readonly CineEvent[]) {
    this.events = [...events].sort((a, b) => a.t - b.t);
  }

  /** events with t in (prev, now] — call once per frame with the cinematic clock */
  advance(now: number, fire: (e: CineEvent) => void): void {
    while (this.next < this.events.length && this.events[this.next]!.t <= now) fire(this.events[this.next++]!);
  }

  reset(): void {
    this.next = 0;
  }

  get done(): boolean {
    return this.next >= this.events.length;
  }
}
