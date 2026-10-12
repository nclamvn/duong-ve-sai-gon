/**
 * Clip analysis for the locomotion system (DV-066). Runs once per character asset at load.
 *
 * - `splitUpperLower`: per clip, an upper-body sub-clip (Spine and descendants) and a lower-body sub-clip (Hips + legs),
 *   so firing/reloading/aiming play on the torso while the legs keep walking.
 * - `analyzeLocoClip`: measures travel speed + direction + left-foot contact phase from the feet (in-place Mixamo clips
 *   carry no root motion: during ground contact a foot slides backward at exactly the travel speed). Clips WITH root
 *   motion are measured from the hips and made in-place.
 * - `analyzeTurnClip`: yaw curve of a turn-in-place clip; the hips yaw is stripped so code can drive the body yaw.
 */
import { AnimationClip, AnimationMixer, KeyframeTrack, Object3D, PropertyBinding, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from 'three/webgpu';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import type { LocoClipInfo, LocoGait, TurnClipInfo } from './locomotion';

const HIPS = ['mixamorigHips', 'mixamorig:Hips', 'Hips', 'hips'];
const SPINE = ['mixamorigSpine', 'mixamorig:Spine', 'Spine', 'spine'];
const FOOT_L = ['mixamorigLeftFoot', 'mixamorig:LeftFoot', 'LeftFoot'];
const TOE_L = ['mixamorigLeftToeBase', 'mixamorig:LeftToeBase', 'LeftToeBase'];
const FOOT_R = ['mixamorigRightFoot', 'mixamorig:RightFoot', 'RightFoot'];
const TOE_R = ['mixamorigRightToeBase', 'mixamorig:RightToeBase', 'RightToeBase'];

export function findByNames(root: Object3D, names: readonly string[]): Object3D | null {
  for (const n of names) {
    const o = root.getObjectByName(n);
    if (o) return o;
  }
  return null;
}

function trackNode(t: KeyframeTrack): string {
  return PropertyBinding.parseTrackName(t.name).nodeName ?? '';
}

/** Names of Spine and all its descendants (upper body). */
export function upperBodyNames(template: Object3D): Set<string> {
  const s = new Set<string>();
  const spine = findByNames(template, SPINE);
  spine?.traverse((o) => s.add(o.name));
  return s;
}

/** Private clone of the template for sampling (identity root transform). */
export function analysisRig(template: Object3D): Object3D {
  const rig = skeletonClone(template);
  rig.position.set(0, 0, 0);
  rig.rotation.set(0, 0, 0);
  rig.scale.setScalar(1);
  return rig;
}

export interface SplitClip {
  upper: AnimationClip;
  lower: AnimationClip;
}

export function splitUpperLower(clip: AnimationClip, upper: ReadonlySet<string>): SplitClip {
  const up: KeyframeTrack[] = [];
  const lo: KeyframeTrack[] = [];
  for (const t of clip.tracks) (upper.has(trackNode(t)) ? up : lo).push(t);
  return { upper: new AnimationClip(`${clip.name}#upper`, clip.duration, up), lower: new AnimationClip(`${clip.name}#lower`, clip.duration, lo) };
}

export interface LocoAnalysis extends Omit<LocoClipInfo, 'gait'> {
  /** true: measured from feet/hips; false: nominal fallback */
  measured: boolean;
  /** clip had root motion (hips XZ drift) that was removed */
  rootMotion: boolean;
}

const _a = new Vector3();
const _b = new Vector3();

/**
 * Sample a clip on `rig` (a private clone from `analysisRig`, it gets posed) and measure locomotion. `scale` converts file units to metres
 * (CharacterAsset.scale). Angles: rig forward is +z, rig left is +x (Mixamo) → angle = atan2(x, z), + = left.
 * May modify `clip` in place (root motion removed).
 */
export function analyzeLocoClip(rig: Object3D, clip: AnimationClip, scale: number, nominal: { speed: number; angle: number }, samples = 64): LocoAnalysis {
  const fallback: LocoAnalysis = { angle: nominal.angle, speed: nominal.speed, duration: clip.duration, phaseOffset: 0, measured: false, rootMotion: false };
  const hips = findByNames(rig, HIPS);
  const feet = [findByNames(rig, FOOT_L), findByNames(rig, TOE_L), findByNames(rig, FOOT_R), findByNames(rig, TOE_R)];
  if (!hips || feet.some((f) => !f) || clip.duration <= 0) return fallback;

  // ---- root motion: hips position track with a net XZ drift → measure, then remove the linear drift
  const hipsPos = clip.tracks.find((t) => trackNode(t) === hips.name && t.name.endsWith('.position')) as VectorKeyframeTrack | undefined;
  let rootMotion = false;
  let rmSpeed = 0;
  let rmAngle = 0;
  if (hipsPos && hipsPos.values.length >= 6) {
    const v = hipsPos.values;
    const n = v.length / 3;
    // hips local space = parent space; parent of hips is the armature root (scale/rotation handled via world deltas)
    const parent = hips.parent ?? rig;
    parent.updateWorldMatrix(true, false);
    _a.set(v[0]!, v[1]!, v[2]!).applyMatrix4(parent.matrixWorld);
    _b.set(v[(n - 1) * 3]!, v[(n - 1) * 3 + 1]!, v[(n - 1) * 3 + 2]!).applyMatrix4(parent.matrixWorld);
    const dx = _b.x - _a.x;
    const dz = _b.z - _a.z;
    const d = Math.hypot(dx, dz) * scale;
    if (d > 0.3) {
      rootMotion = true;
      rmSpeed = d / clip.duration;
      rmAngle = Math.atan2(dx, dz);
      // remove drift in local units (linear in time) on the two horizontal local axes
      const lx = v[(n - 1) * 3]! - v[0]!;
      const lz = v[(n - 1) * 3 + 2]! - v[2]!;
      const times = hipsPos.times;
      const t0 = times[0]!;
      const span = times[n - 1]! - t0 || 1;
      for (let i = 0; i < n; i++) {
        const f = (times[i]! - t0) / span;
        v[i * 3] = v[i * 3]! - lx * f;
        v[i * 3 + 2] = v[i * 3 + 2]! - lz * f;
      }
    }
  }

  // ---- foot sampling
  const mixer = new AnimationMixer(rig);
  const action = mixer.clipAction(clip);
  action.play();
  const N = samples;
  const footPts = [new Vector3(), new Vector3()];
  const L: Array<[number, number, number]> = [];
  const R: Array<[number, number, number]> = [];
  for (let i = 0; i < N; i++) {
    mixer.setTime((i / N) * clip.duration);
    rig.updateMatrixWorld(true);
    feet[0]!.getWorldPosition(footPts[0]!);
    feet[1]!.getWorldPosition(_a);
    footPts[0]!.add(_a).multiplyScalar(0.5);
    feet[2]!.getWorldPosition(footPts[1]!);
    feet[3]!.getWorldPosition(_b);
    footPts[1]!.add(_b).multiplyScalar(0.5);
    L.push([footPts[0]!.x * scale, footPts[0]!.y * scale, footPts[0]!.z * scale]);
    R.push([footPts[1]!.x * scale, footPts[1]!.y * scale, footPts[1]!.z * scale]);
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(rig);

  const dtS = clip.duration / N;
  const contactOf = (F: Array<[number, number, number]>): boolean[] => {
    let minY = Infinity;
    for (const p of F) minY = Math.min(minY, p[1]);
    return F.map((p) => p[1] < minY + 0.035);
  };
  const cL = contactOf(L);
  const cR = contactOf(R);
  const vxs: number[] = [];
  const vzs: number[] = [];
  const collect = (F: Array<[number, number, number]>, c: boolean[]): void => {
    for (let i = 0; i < N; i++) {
      const prev = (i - 1 + N) % N;
      const next = (i + 1) % N;
      if (!c[i] || !c[prev] || !c[next]) continue;
      vxs.push((F[next]![0] - F[prev]![0]) / (2 * dtS));
      vzs.push((F[next]![2] - F[prev]![2]) / (2 * dtS));
    }
  };
  collect(L, cL);
  collect(R, cR);
  const median = (a: number[]): number => {
    const s = [...a].sort((x, y) => x - y);
    return s.length ? s[Math.floor(s.length / 2)]! : 0;
  };
  // left-foot contact start (first contact frame after a swing frame, circular)
  let contactStart = 0;
  for (let i = 0; i < N; i++) {
    if (cL[i] && !cL[(i - 1 + N) % N]) {
      contactStart = i;
      break;
    }
  }
  const phaseOffset = contactStart / N;

  if (rootMotion) return { angle: rmAngle, speed: rmSpeed, duration: clip.duration, phaseOffset, measured: true, rootMotion };
  if (vxs.length < 4) return { ...fallback, phaseOffset };
  const vx = -median(vxs);
  const vz = -median(vzs);
  const speed = Math.hypot(vx, vz);
  if (speed < 0.2) return { ...fallback, phaseOffset };
  return { angle: Math.atan2(vx, vz), speed, duration: clip.duration, phaseOffset, measured: true, rootMotion: false };
}

const _q = new Quaternion();
const _q0i = new Quaternion();
const _r = new Quaternion();
const _tw = new Quaternion();
const _axis = new Vector3();

/** Signed twist angle of quaternion r around unit axis a (swing-twist decomposition). */
export function twistAngle(r: Quaternion, a: Vector3): number {
  const proj = r.x * a.x + r.y * a.y + r.z * a.z;
  return 2 * Math.atan2(proj, r.w);
}

/**
 * Turn-in-place clip: measure the hips yaw over time (around world up expressed in the hips' parent space), strip it from
 * the hips rotation track (in place) so the code-driven body yaw is the only rotation, and return the normalized curve.
 */
export function analyzeTurnClip(template: Object3D, clip: AnimationClip, samples = 32): TurnClipInfo | null {
  const hips = findByNames(template, HIPS);
  if (!hips) return null;
  const track = clip.tracks.find((t) => trackNode(t) === hips.name && t.name.endsWith('.quaternion')) as QuaternionKeyframeTrack | undefined;
  if (!track || track.values.length < 8) return null;
  const parent = hips.parent ?? template;
  parent.updateWorldMatrix(true, false);
  const pq = new Quaternion();
  parent.getWorldQuaternion(pq);
  _axis.set(0, 1, 0).applyQuaternion(pq.clone().invert()).normalize();
  const v = track.values;
  const n = v.length / 4;
  _q0i.fromArray(v, 0).invert();
  const yaw: number[] = [];
  let prev = 0;
  for (let i = 0; i < n; i++) {
    _q.fromArray(v, i * 4);
    _r.multiplyQuaternions(_q, _q0i);
    let a = twistAngle(_r, _axis);
    // unwrap
    while (a - prev > Math.PI) a -= Math.PI * 2;
    while (a - prev < -Math.PI) a += Math.PI * 2;
    yaw.push(a);
    prev = a;
  }
  const total = yaw[n - 1]!;
  if (Math.abs(total) < 0.35) return null; // < 20°: not a turn clip
  // strip: q' = twist(−yaw) · q
  for (let i = 0; i < n; i++) {
    _tw.setFromAxisAngle(_axis, -yaw[i]!);
    _q.fromArray(v, i * 4);
    _q.premultiply(_tw).toArray(v, i * 4);
  }
  // uniform progress table (monotone, normalized)
  const times = track.times;
  const progress: number[] = [];
  let j = 0;
  let best = 0;
  for (let s = 0; s <= samples; s++) {
    const t = times[0]! + ((times[n - 1]! - times[0]!) * s) / samples;
    while (j < n - 2 && times[j + 1]! < t) j++;
    const f = times[j + 1]! > times[j]! ? (t - times[j]!) / (times[j + 1]! - times[j]!) : 0;
    const y = (yaw[j]! * (1 - Math.min(1, Math.max(0, f))) + yaw[j + 1]! * Math.min(1, Math.max(0, f))) / total;
    best = Math.max(best, Math.min(1, Math.max(0, y)));
    progress.push(best);
  }
  progress[progress.length - 1] = 1;
  return { dir: total > 0 ? 1 : -1, yawTotal: Math.abs(total), duration: clip.duration, progress };
}

/** Gait + nominal direction from a clip name (`walk_f`, `run_bl`, `crouch_walk_r`, legacy `rifle_walk`/`rifle_run`/`crouch_walk`). */
export function parseLocoName(name: string): { gait: LocoGait; angle: number } | null {
  const legacy: Record<string, LocoGait> = { rifle_walk: 'walk', rifle_run: 'run', crouch_walk: 'crouch_walk' };
  if (legacy[name]) return { gait: legacy[name]!, angle: 0 };
  const m = /^(walk|run|crouch_walk)_(f|fl|l|bl|b|br|r|fr)$/.exec(name);
  if (!m) return null;
  const DIR: Record<string, number> = { f: 0, fl: 45, l: 90, bl: 135, b: 180, br: -135, r: -90, fr: -45 };
  return { gait: m[1] as LocoGait, angle: (DIR[m[2]!]! * Math.PI) / 180 };
}

export const NOMINAL_SPEED: Record<LocoGait, number> = { walk: 1.5, run: 3.8, crouch_walk: 1.0 };
