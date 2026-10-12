import { describe, it, expect } from 'vitest';
import { Bone, Group, Vector3 } from 'three/webgpu';
import { FootPlanter } from '@engine/render/footIk';

/** minimal Mixamo-like legs: Hips → UpLeg → Leg → Foot, thigh/shin 0.45 m, knees slightly bent forward */
function rig(): { root: Group; model: Group; foot: (s: 'Left' | 'Right') => Vector3 } {
  const root = new Group();
  const model = new Group();
  root.add(model);
  const b = (name: string, parent: { add(o: Bone): unknown }, x: number, y: number, z: number): Bone => {
    const o = new Bone();
    o.name = name;
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };
  const hips = b('mixamorigHips', model, 0, 0.95, 0);
  for (const s of ['Left', 'Right'] as const) {
    const up = b(`mixamorig${s}UpLeg`, hips, s === 'Left' ? 0.1 : -0.1, -0.05, 0);
    const leg = b(`mixamorig${s}Leg`, up, 0, -0.45, 0.03);
    b(`mixamorig${s}Foot`, leg, 0, -0.44, -0.03);
  }
  root.updateMatrixWorld(true);
  // stand-in for the mixer: every frame the animation rewrites the leg bones' local rotations
  const rest = new Map<Bone, [number, number, number, number]>();
  model.traverse((o) => rest.set(o as Bone, (o as Bone).quaternion.toArray() as [number, number, number, number]));
  (model as unknown as { pose: () => void }).pose = () => {
    for (const [o, q] of rest) o.quaternion.fromArray(q);
  };
  const foot = (s: 'Left' | 'Right'): Vector3 => model.getObjectByName(`mixamorig${s}Foot`)!.getWorldPosition(new Vector3());
  return { root, model, foot };
}

describe('DV-070 foot planting', () => {
  it('flat ground: nothing moves', () => {
    const r = rig();
    const before = r.foot('Left').clone();
    const fp = new FootPlanter(r.model, r.root);
    expect(fp.ready).toBe(true);
    for (let i = 0; i < 60; i++) {
      (r.model as unknown as { pose: () => void }).pose();
      fp.update(1 / 60, () => 0, 0);
    }
    expect(r.foot('Left').distanceTo(before)).toBeLessThan(1e-6);
    expect(fp.pelvis).toBeCloseTo(0, 6);
  });

  it('side slope: pelvis drops to the downhill foot, the uphill foot is raised by IK onto its ground', () => {
    const r = rig();
    const fp = new FootPlanter(r.model, r.root);
    const yL0 = r.foot('Left').y;
    const yR0 = r.foot('Right').y;
    // ground rises toward +x (left foot uphill): +0.08 at the left foot, −0.06 at the right foot, actor base at 0
    const ground = (x: number): number => x * 0.7;
    for (let i = 0; i < 120; i++) {
      (r.model as unknown as { pose: () => void }).pose();
      fp.update(1 / 60, ground, 0);
    }
    r.root.updateMatrixWorld(true);
    expect(fp.pelvis).toBeCloseTo(-0.07, 2);
    expect(r.foot('Right').y - yR0).toBeCloseTo(-0.07, 2);
    expect(r.foot('Left').y - yL0).toBeCloseTo(0.07, 2);
    // leg lengths preserved (no stretching)
    const up = r.model.getObjectByName('mixamorigLeftUpLeg')!.getWorldPosition(new Vector3());
    const knee = r.model.getObjectByName('mixamorigLeftLeg')!.getWorldPosition(new Vector3());
    expect(up.distanceTo(knee)).toBeCloseTo(Math.hypot(0.45, 0.03), 4);
  });

  it('steep step is clamped (no leg pulled into the air beyond maxRaise)', () => {
    const r = rig();
    const fp = new FootPlanter(r.model, r.root);
    for (let i = 0; i < 120; i++) {
      (r.model as unknown as { pose: () => void }).pose();
      fp.update(1 / 60, (x) => (x > 0 ? 2 : 0), 0);
    }
    expect(fp.pelvis).toBeCloseTo(0, 3);
    expect(Math.abs(fp.pelvis)).toBeLessThanOrEqual(fp.maxDrop + 1e-6);
  });
});
