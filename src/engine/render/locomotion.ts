/**
 * Locomotion controller (DV-066): pure animation logic, no three import (unit-testable in Node).
 *
 * Inputs each frame: aim yaw (where the actor wants to look/shoot), world velocity, aiming, crouch, aim pitch.
 * Outputs: visual body yaw (legs/pelvis), spine twist + pitch (upper body leads toward the aim), and blend weights:
 *   - stand weight (idle / aim / crouch idle pose),
 *   - per locomotion clip weight (2D polar blend space: direction × gait, phase-synced, speed-matched playback rate),
 *   - turn-in-place clip weight + normalized time.
 * The sum stand + Σ loco + turn is exactly 1 (so the mixer never leaks the bind pose).
 *
 * Angle convention (shared with the yaw of `Bot`): yaw increases turning LEFT (counter-clockwise seen from above).
 * A clip's `angle` is its travel direction relative to the body: 0 forward, +π/2 left, −π/2 right, ±π backward.
 */

export type LocoGait = 'walk' | 'run' | 'crouch_walk';

export interface LocoClipInfo {
  gait: LocoGait;
  /** travel direction relative to the body (rad, + = left) */
  angle: number;
  /** travel speed at playback rate 1 (m/s) */
  speed: number;
  /** clip duration (s) */
  duration: number;
  /** normalized phase of the left-foot contact start (aligns feet across clips) */
  phaseOffset: number;
}

export interface TurnClipInfo {
  /** +1 turns left, −1 turns right */
  dir: 1 | -1;
  /** |yaw| the clip turns (rad) */
  yawTotal: number;
  duration: number;
  /** normalized yaw progress 0..1 sampled uniformly over the clip (monotone) */
  progress: number[];
}

export interface LocoInput {
  aimYaw: number;
  vx: number;
  vz: number;
  aiming: boolean;
  crouch: boolean;
  /** + = aim up (rad) */
  aimPitch: number;
}

export interface LocoConfig {
  /** speed under which the actor counts as standing (m/s) */
  standSpeed: number;
  /** |aim − body| that triggers a turn in place while standing (rad) */
  turnThreshold: number;
  /** same, when not aiming (relaxed actors let the head/torso look further first) */
  turnThresholdRelaxed: number;
  /** max spine twist (rad) */
  maxTwist: number;
  /** max spine pitch (rad) */
  maxPitch: number;
  /** body yaw follow rate while moving (1/s, exponential) */
  bodyFollow: number;
  /** body yaw rate when no turn clip exists (rad/s) */
  shuffleRate: number;
  /** two direction samples further apart than this are not interpolated (rad) */
  maxGap: number;
}

export const DEFAULT_LOCO_CONFIG: LocoConfig = {
  standSpeed: 0.3,
  turnThreshold: (40 * Math.PI) / 180,
  turnThresholdRelaxed: (70 * Math.PI) / 180,
  maxTwist: (80 * Math.PI) / 180,
  maxPitch: (60 * Math.PI) / 180,
  bodyFollow: 7,
  shuffleRate: 3.2,
  maxGap: (100 * Math.PI) / 180,
};

const TAU = Math.PI * 2;

export function wrapAngle(a: number): number {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x);
const expK = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);

/**
 * Direction weights inside one gait: the two samples bracketing `rel` (circularly) share the weight by angular distance.
 * Writes into `out` (indexed like `clips`, only entries of `gait` touched; others untouched) and returns
 * { speed: blended speed, residual: angle the body must rotate so the chosen sample matches (0 if covered) }.
 */
export function directionWeights(clips: readonly LocoClipInfo[], gait: LocoGait, rel: number, maxGap: number, out: Float32Array, scale = 1): { speed: number; residual: number; found: boolean } {
  let left = -1;
  let right = -1;
  let dl = Infinity; // smallest positive (CCW) distance from rel to a sample
  let dr = Infinity; // smallest positive (CW) distance
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i]!;
    if (c.gait !== gait) continue;
    let d = wrapAngle(c.angle - rel);
    if (Math.abs(d) < 1e-6) d = 0;
    if (d >= 0 && d < dl) {
      dl = d;
      left = i;
    }
    if (d <= 0 && -d < dr) {
      dr = -d;
      right = i;
    }
  }
  if (left < 0 && right < 0) return { speed: 0, residual: 0, found: false };
  // only one sample of this gait in total: it covers every direction by rotating the body
  if (left === right || left < 0 || right < 0) {
    const i = left >= 0 ? left : right;
    out[i] = (out[i] ?? 0) + scale;
    return { speed: clips[i]!.speed, residual: wrapAngle(rel - clips[i]!.angle), found: true };
  }
  if (dl === 0) {
    out[left] = (out[left] ?? 0) + scale;
    return { speed: clips[left]!.speed, residual: 0, found: true };
  }
  if (dr === 0) {
    out[right] = (out[right] ?? 0) + scale;
    return { speed: clips[right]!.speed, residual: 0, found: true };
  }
  const gap = dl + dr;
  if (gap > maxGap) {
    // not interpolable (e.g. forward + left only, moving backward): take the nearer one, the body rotates the rest
    const i = dl <= dr ? left : right;
    out[i] = (out[i] ?? 0) + scale;
    return { speed: clips[i]!.speed, residual: wrapAngle(rel - clips[i]!.angle), found: true };
  }
  const wl = dr / gap;
  const wr = dl / gap;
  out[left] = (out[left] ?? 0) + scale * wl;
  out[right] = (out[right] ?? 0) + scale * wr;
  return { speed: clips[left]!.speed * wl + clips[right]!.speed * wr, residual: 0, found: true };
}

/** Linear lookup in a uniformly sampled progress table (t normalized 0..1). */
export function sampleProgress(progress: readonly number[], t: number): number {
  if (progress.length === 0) return clamp(t, 0, 1);
  if (progress.length === 1) return progress[0]!;
  const x = clamp(t, 0, 1) * (progress.length - 1);
  const i = Math.min(progress.length - 2, Math.floor(x));
  const f = x - i;
  return progress[i]! * (1 - f) + progress[i + 1]! * f;
}

export class LocomotionController {
  readonly cfg: LocoConfig;
  /** visual body (pelvis/legs) yaw, world */
  bodyYaw = 0;
  /** spine twist (aim − body, clamped, smoothed) */
  twist = 0;
  pitch = 0;
  /** upper-body aim pose weight 0..1 */
  aimBlend = 0;
  /** standing pose weight */
  standW = 1;
  /** per loco clip weight */
  readonly locoW: Float32Array;
  /** shared normalized gait phase */
  phase = 0;
  /** active turn clip index (into `turns`) or −1; its normalized time and weight */
  turnIdx = -1;
  turnT = 0;
  turnW = 0;
  /** weight of a turn clip that is fading out after finishing */
  turnOutIdx = -1;
  turnOutT = 0;
  turnOutW = 0;
  /** smoothed moving weight 0..1 */
  moveW = 0;
  /** playback rate applied to the gait phase */
  rate = 1;
  crouched = false;
  private started = false;
  private turnFrom = 0;
  private turnDelta = 0;
  private shuffling = false;
  private moving = false;
  private readonly tmpW: Float32Array;
  private readonly tmpRun: Float32Array;

  constructor(
    readonly clips: readonly LocoClipInfo[],
    readonly turns: readonly TurnClipInfo[] = [],
    cfg: Partial<LocoConfig> = {},
  ) {
    this.cfg = { ...DEFAULT_LOCO_CONFIG, ...cfg };
    this.locoW = new Float32Array(clips.length);
    this.tmpW = new Float32Array(clips.length);
    this.tmpRun = new Float32Array(clips.length);
  }

  hasGait(g: LocoGait): boolean {
    return this.clips.some((c) => c.gait === g);
  }

  /** Snap to a state (spawn/reset): body faces aim, standing. */
  reset(yaw: number): void {
    this.bodyYaw = yaw;
    this.twist = 0;
    this.pitch = 0;
    this.aimBlend = 0;
    this.standW = 1;
    this.locoW.fill(0);
    this.phase = 0;
    this.turnIdx = -1;
    this.turnW = 0;
    this.turnOutIdx = -1;
    this.turnOutW = 0;
    this.moveW = 0;
    this.rate = 1;
    this.shuffling = false;
    this.moving = false;
    this.turnActiveApplied = 0;
    this.turnOutApplied = 0;
    this.started = true;
  }

  update(dt: number, inp: LocoInput): void {
    const c = this.cfg;
    if (!this.started) this.reset(inp.aimYaw);
    const speed = Math.hypot(inp.vx, inp.vz);
    // hysteresis: start moving above standSpeed, stop under 0.6×
    this.moving = this.moving ? speed > c.standSpeed * 0.6 : speed > c.standSpeed;
    this.crouched = inp.crouch && this.hasGait('crouch_walk');
    const travelYaw = speed > 1e-4 ? Math.atan2(-inp.vx, -inp.vz) : inp.aimYaw;

    // ---- gait weights for the current travel direction relative to the CURRENT body yaw
    const relNow = wrapAngle(travelYaw - this.bodyYaw);
    const res = this.blendGaits(relNow, speed);

    // ---- body yaw
    if (this.moving) {
      this.cancelTurn();
      this.shuffling = false;
      // body faces the aim; when the clip set cannot cover the direction (e.g. no back-pedal clip), the body turns toward travel
      // just enough for the nearest sample, and the spine twist keeps the gun on target (clamped)
      const relAim = wrapAngle(travelYaw - inp.aimYaw);
      const probe = this.tmpW;
      probe.fill(0);
      const g: LocoGait = this.crouched ? 'crouch_walk' : res.runFrac > 0.5 && this.hasGait('run') ? 'run' : this.hasGait('walk') ? 'walk' : 'run';
      const pr = directionWeights(this.clips, g, relAim, c.maxGap, probe);
      let target = inp.aimYaw + (pr.found ? pr.residual : relAim);
      // never twist further than the spine allows: body leans toward the aim
      const tw = wrapAngle(inp.aimYaw - target);
      if (Math.abs(tw) > c.maxTwist) target = inp.aimYaw - Math.sign(tw) * c.maxTwist;
      this.bodyYaw = wrapAngle(this.bodyYaw + wrapAngle(target - this.bodyYaw) * expK(c.bodyFollow, dt));
    } else {
      const diff = wrapAngle(inp.aimYaw - this.bodyYaw);
      const thr = inp.aiming ? c.turnThreshold : c.turnThresholdRelaxed;
      if (this.turnIdx >= 0) {
        const tc = this.turns[this.turnIdx]!;
        this.turnT += dt / tc.duration;
        const p = sampleProgress(tc.progress, this.turnT);
        this.bodyYaw = wrapAngle(this.turnFrom + this.turnDelta * p);
        if (this.turnT >= 1) {
          this.turnOutIdx = this.turnIdx;
          this.turnOutT = 1;
          this.turnOutW = this.turnW;
          this.turnIdx = -1;
          this.turnW = 0;
        }
      } else if (this.shuffling || Math.abs(diff) > thr) {
        const dir: 1 | -1 = diff > 0 ? 1 : -1;
        const ti = this.pickTurn(dir);
        if (ti >= 0 && !this.shuffling) {
          const tc = this.turns[ti]!;
          this.turnIdx = ti;
          this.turnT = 0;
          this.turnW = this.turnOutIdx === ti ? this.turnOutW : 0;
          if (this.turnOutIdx === ti) this.turnOutIdx = -1;
          this.turnFrom = this.bodyYaw;
          // the clip turns `yawTotal`; scale to the actual need (60 %..140 % keeps the feet believable)
          this.turnDelta = dir * clamp(Math.abs(diff), tc.yawTotal * 0.6, tc.yawTotal * 1.4);
        } else {
          // no turn clip: rotate in place at a human rate (upper body already looks via twist)
          this.shuffling = Math.abs(diff) > 0.05;
          const step = Math.min(Math.abs(diff), c.shuffleRate * dt);
          this.bodyYaw = wrapAngle(this.bodyYaw + Math.sign(diff) * step);
        }
      }
    }

    // ---- turn clip weights (ramp in 0.12 s, out over the last 15 %)
    if (this.turnIdx >= 0) {
      const tail = this.turnT > 0.85 ? 1 - (this.turnT - 0.85) / 0.15 : 1;
      this.turnW = Math.min(tail, this.turnW + dt / 0.12);
    }
    if (this.turnOutIdx >= 0) {
      this.turnOutW = Math.max(0, this.turnOutW - dt / 0.12);
      if (this.turnOutW <= 0) this.turnOutIdx = -1;
    }

    // ---- moving weight + gait phase
    const wantMove = this.moving && res.cycle > 0 ? clamp((speed - c.standSpeed * 0.5) / 0.5, 0, 1) : 0;
    this.moveW += (wantMove - this.moveW) * expK(10, dt);
    if (this.moveW < 1e-3) this.moveW = 0;
    if (this.moveW > 0 && res.cycle > 0) {
      // speed matching: blended clip speed vs actual speed (clamped so the cadence stays human)
      this.rate = res.speed > 0.05 ? clamp(Math.max(speed, c.standSpeed) / res.speed, 0.55, 1.6) : 1;
      this.phase = (this.phase + (dt * this.rate) / res.cycle) % 1;
    }
    // turnW / turnOutW are ramp states; the weights actually applied share what moving leaves
    const ramp = this.turnW + this.turnOutW;
    const turnTotal = Math.min(1, ramp) * (1 - this.moveW);
    this.turnActiveApplied = ramp > 1e-6 ? (turnTotal * this.turnW) / ramp : 0;
    this.turnOutApplied = turnTotal - this.turnActiveApplied;
    for (let i = 0; i < this.locoW.length; i++) this.locoW[i] = this.tmpRun[i]! * this.moveW;
    this.standW = Math.max(0, 1 - this.moveW - turnTotal);

    // ---- upper body
    this.aimBlend += ((inp.aiming ? 1 : 0) - this.aimBlend) * expK(9, dt);
    let twTarget = clamp(wrapAngle(inp.aimYaw - this.bodyYaw), -c.maxTwist, c.maxTwist);
    if (!inp.aiming && this.moving) twTarget *= 0.35; // relaxed walk: torso mostly follows the legs
    this.twist += (twTarget - this.twist) * expK(14, dt);
    const pTarget = clamp(inp.aimPitch, -c.maxPitch, c.maxPitch) * (inp.aiming ? 1 : 0.25);
    this.pitch += (pTarget - this.pitch) * expK(10, dt);
  }

  /** weight applied this frame to the active turn clip (`turnIdx`, time `turnT`) */
  turnActiveApplied = 0;
  /** weight applied this frame to the fading-out turn clip (`turnOutIdx`, time `turnOutT`) */
  turnOutApplied = 0;

  /** normalized time of clip i under the shared phase */
  clipPhase(i: number): number {
    const p = this.phase + (this.clips[i]?.phaseOffset ?? 0);
    return p - Math.floor(p);
  }

  private pickTurn(dir: 1 | -1): number {
    for (let i = 0; i < this.turns.length; i++) if (this.turns[i]!.dir === dir) return i;
    return -1;
  }

  private cancelTurn(): void {
    if (this.turnIdx >= 0) {
      this.turnOutIdx = this.turnIdx;
      this.turnOutT = this.turnT;
      this.turnOutW = this.turnW;
      this.turnIdx = -1;
      this.turnW = 0;
    }
  }

  /**
   * Fill `tmpRun` with gait×direction weights summing to 1 (or all zero if no loco clip), and return the blended speed,
   * cycle duration and run fraction.
   */
  private blendGaits(rel: number, speed: number): { speed: number; cycle: number; runFrac: number } {
    const out = this.tmpRun;
    out.fill(0);
    const c = this.cfg;
    if (this.crouched) {
      const r = directionWeights(this.clips, 'crouch_walk', rel, c.maxGap, out);
      return { speed: r.speed, cycle: this.cycleOf(out), runFrac: 0 };
    }
    const hasW = this.hasGait('walk');
    const hasR = this.hasGait('run');
    if (!hasW && !hasR) return { speed: 0, cycle: 0, runFrac: 0 };
    if (!hasR || !hasW) {
      const r = directionWeights(this.clips, hasW ? 'walk' : 'run', rel, c.maxGap, out);
      return { speed: r.speed, cycle: this.cycleOf(out), runFrac: hasW ? 0 : 1 };
    }
    // probe both gaits for this direction, then mix by speed
    const w = this.tmpW;
    w.fill(0);
    const rw = directionWeights(this.clips, 'walk', rel, c.maxGap, w);
    const rr = directionWeights(this.clips, 'run', rel, c.maxGap, w);
    const a = rr.speed > rw.speed + 0.1 ? clamp((speed - rw.speed) / (rr.speed - rw.speed), 0, 1) : speed > 2.6 ? 1 : 0;
    for (let i = 0; i < out.length; i++) {
      const g = this.clips[i]!.gait;
      out[i] = g === 'walk' ? w[i]! * (1 - a) : g === 'run' ? w[i]! * a : 0;
    }
    return { speed: rw.speed * (1 - a) + rr.speed * a, cycle: this.cycleOf(out), runFrac: a };
  }

  private cycleOf(w: Float32Array): number {
    let s = 0;
    let d = 0;
    for (let i = 0; i < w.length; i++) {
      s += w[i]!;
      d += w[i]! * this.clips[i]!.duration;
    }
    return s > 1e-6 ? d / s : 0;
  }
}
