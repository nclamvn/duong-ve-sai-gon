import { describe, it, expect } from 'vitest';
import { Bone, Object3D, Matrix4, Vector3, Quaternion, Euler } from 'three';
import { solveTwoBone, findArmChain, type ArmChain } from '../../src/engine/render/armIk';

/** chuỗi tổng hợp tên Mixamo: vai (0,1.4,0) → cánh tay 0.3 → cẳng tay 0.28 → bàn tay, thẳng theo −y (T-pose xoay xuống) */
function makeArm(side: 'Left' | 'Right', scale = 1): { root: Object3D; chain: ArmChain } {
  const root = new Object3D();
  const shoulder = new Bone();
  shoulder.name = `mixamorig${side}Shoulder`;
  shoulder.position.set(side === 'Left' ? 0.15 : -0.15, 1.4, 0);
  const upper = new Bone();
  upper.name = `mixamorig${side}Arm`;
  upper.position.set(side === 'Left' ? 0.05 : -0.05, 0, 0);
  const fore = new Bone();
  fore.name = `mixamorig${side}ForeArm`;
  fore.position.set(0, -0.3, 0);
  const hand = new Bone();
  hand.name = `mixamorig${side}Hand`;
  hand.position.set(0, -0.28, 0);
  root.scale.setScalar(scale);
  root.add(shoulder);
  shoulder.add(upper);
  upper.add(fore);
  fore.add(hand);
  root.updateMatrixWorld(true);
  const chain = findArmChain(root, side);
  if (!chain) throw new Error('chain');
  return { root, chain };
}

const target = (x: number, y: number, z: number, rot = new Euler(0.3, -0.2, 0.1)): Matrix4 => new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(rot), new Vector3(1, 1, 1));

describe('TIP-017 armIk.solveTwoBone', () => {
  it('đo chiều dài đốt theo world (kể cả scale)', () => {
    const { chain } = makeArm('Right', 0.5);
    expect(chain.lenUpper).toBeCloseTo(0.15, 5);
    expect(chain.lenFore).toBeCloseTo(0.14, 5);
  });

  it('cổ tay tới đích trong tầm với sai số < 1 mm; bàn tay đúng hướng world', () => {
    const { chain } = makeArm('Right');
    const t = target(-0.25, 1.05, 0.3);
    const err = solveTwoBone(chain, t, new Vector3(0, -1, 0.2));
    expect(err).toBeLessThan(1e-3);
    const q = new Quaternion();
    chain.hand.getWorldQuaternion(q);
    const want = new Quaternion().setFromEuler(new Euler(0.3, -0.2, 0.1));
    expect(Math.abs(q.dot(want))).toBeGreaterThan(0.9999);
  });

  it('khuỷu lệch về phía pole', () => {
    const { chain } = makeArm('Left');
    solveTwoBone(chain, target(0.3, 1.1, 0.25), new Vector3(0, -1, 0));
    const s = chain.upper.getWorldPosition(new Vector3());
    const e = chain.fore.getWorldPosition(new Vector3());
    const w = chain.hand.getWorldPosition(new Vector3());
    // khuỷu thấp hơn đoạn thẳng vai–cổ tay tại cùng tham số
    const mid = s.clone().lerp(w, 0.5);
    expect(e.y).toBeLessThan(mid.y);
    expect(s.distanceTo(e)).toBeCloseTo(chain.lenUpper, 4);
    expect(e.distanceTo(w)).toBeCloseTo(chain.lenFore, 4);
  });

  it('đích ngoài tầm → duỗi gần thẳng, không NaN', () => {
    const { chain } = makeArm('Right');
    const err = solveTwoBone(chain, target(-2, 1.4, 0), new Vector3(0, -1, 0));
    const s = chain.upper.getWorldPosition(new Vector3());
    const w = chain.hand.getWorldPosition(new Vector3());
    expect(Number.isFinite(err)).toBe(true);
    expect(s.distanceTo(w)).toBeCloseTo((chain.lenUpper + chain.lenFore) * 0.995, 3);
  });
});
