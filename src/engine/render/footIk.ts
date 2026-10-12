/**
 * Foot planting on uneven ground (DV-070): after the animation pose, each foot keeps its animated lift above the ground
 * *under that foot* instead of above the actor's base plane. The pelvis drops by the lower foot's offset (the leg on the
 * downhill side can reach), then a two-bone IK (thigh, shin) raises the uphill foot. Offsets are smoothed over time so steps
 * and terrain cell changes do not pop. Pure three math; the ground is a callback (world x, z → y | null).
 */
import { Bone, Matrix4, Object3D, Quaternion, Vector3 } from 'three/webgpu';
import { solveTwoBone, type ArmChain } from './armIk';

export type GroundFn = (x: number, z: number) => number | null;

const _f = new Vector3();
const _k = new Vector3();
const _h = new Vector3();
const _mid = new Vector3();
const _pole = new Vector3();
const _q = new Quaternion();
const _m = new Matrix4();
const _s = new Vector3(1, 1, 1);

interface Leg {
  chain: ArmChain;
  /** smoothed ground offset of this foot relative to the actor base (m, world) */
  off: number;
}

function legChain(model: Object3D, side: 'Left' | 'Right'): ArmChain | null {
  const get = (n: string): Bone | null => (model.getObjectByName(`mixamorig${side}${n}`) as Bone | undefined) ?? null;
  const upper = get('UpLeg');
  const fore = get('Leg');
  const hand = get('Foot');
  if (!upper || !fore || !hand) return null;
  model.updateWorldMatrix(true, true);
  const a = upper.getWorldPosition(new Vector3());
  const b = fore.getWorldPosition(new Vector3());
  const c = hand.getWorldPosition(new Vector3());
  return { shoulder: upper.parent ?? upper, upper, fore, hand, lenUpper: a.distanceTo(b), lenFore: b.distanceTo(c), handFrameInv: null };
}

export class FootPlanter {
  private readonly legs: Leg[] = [];
  /** smoothed pelvis drop (m, ≤ 0) */
  pelvis = 0;
  /** max pelvis drop / foot raise (m) */
  maxDrop = 0.3;
  maxRaise = 0.35;
  /** smoothing rate (1/s) */
  rate = 14;
  enabled = true;

  constructor(
    model: Object3D,
    /** object shifted vertically for the pelvis drop (the character root under the actor group) */
    private readonly shift: Object3D,
  ) {
    for (const s of ['Left', 'Right'] as const) {
      const c = legChain(model, s);
      if (c) this.legs.push({ chain: c, off: 0 });
    }
  }

  get ready(): boolean {
    return this.legs.length === 2;
  }

  /** Call after the mixer/aim offset, before hand IK. `baseY` = the actor's ground height (group world y). */
  update(dt: number, ground: GroundFn, baseY: number): void {
    if (!this.enabled || !this.ready) return;
    const k = 1 - Math.exp(-this.rate * Math.max(0, dt));
    this.shift.position.y = 0;
    this.shift.updateWorldMatrix(true, true);
    let lowest = 0;
    for (const leg of this.legs) {
      leg.chain.hand.getWorldPosition(_f);
      const gy = ground(_f.x, _f.z);
      const want = gy === null ? 0 : Math.max(-this.maxDrop, Math.min(this.maxRaise, gy - baseY));
      leg.off += (want - leg.off) * k;
      lowest = Math.min(lowest, leg.off);
    }
    this.pelvis += (lowest - this.pelvis) * k;
    this.shift.position.y = this.pelvis;
    this.shift.updateWorldMatrix(true, true);
    for (const leg of this.legs) {
      const raise = leg.off - this.pelvis;
      if (raise < 0.004) continue;
      const c = leg.chain;
      c.hand.getWorldPosition(_f);
      c.hand.getWorldQuaternion(_q);
      _f.y += raise;
      // knee keeps bending the way the animation bends it
      c.upper.getWorldPosition(_h);
      c.fore.getWorldPosition(_k);
      _mid.copy(_h).add(_f).multiplyScalar(0.5);
      _pole.copy(_k).sub(_mid);
      if (_pole.lengthSq() < 1e-8) _pole.set(0, 0, 1).applyQuaternion(_q);
      _pole.normalize();
      _m.compose(_f, _q, _s);
      solveTwoBone(c, _m, _pole, false); // legs: no forearm-style untwist
    }
  }

  reset(): void {
    for (const l of this.legs) l.off = 0;
    this.pelvis = 0;
    this.shift.position.y = 0;
  }
}
