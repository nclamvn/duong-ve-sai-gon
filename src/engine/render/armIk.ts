/**
 * IK 2 khớp cho cánh tay (TIP-017, tách từ fpArms TIP-016): vai → khuỷu → cổ tay bám một ma trận world mục tiêu
 * (vị trí + hướng bàn tay), khuỷu nằm trong mặt phẳng (hướng, pole). Dùng cho tay FP và tay trái lính (ôm ốp lót).
 * Thuần three math, không biết game.
 */
import { Bone, Object3D, Vector3, Quaternion, Matrix4 } from 'three/webgpu';

export interface ArmChain {
  shoulder: Object3D;
  upper: Bone;
  fore: Bone;
  hand: Bone;
  lenUpper: number;
  lenFore: number;
}

const _q = new Quaternion();
const _q2 = new Quaternion();
const _qp = new Quaternion();
const _qT = new Quaternion();
const _vS = new Vector3();
const _vE = new Vector3();
const _vW = new Vector3();
const _vT = new Vector3();
const _dir = new Vector3();
const _perp = new Vector3();
const _cur = new Vector3();
const _des = new Vector3();
const _sc = new Vector3();
const _ax = new Vector3();
const _bx = new Vector3();
const _cx = new Vector3();
const _vT0 = new Vector3();

function findBone(root: Object3D, ...names: string[]): Bone | null {
  for (const n of names) {
    const o = root.getObjectByName(n);
    if (o && (o as Bone).isBone) return o as Bone;
  }
  return null;
}

/** Tìm chuỗi Mixamo `<side>Shoulder/Arm/ForeArm/Hand` (có/không dấu ':'); đo chiều dài đốt từ world position hiện tại. */
export function findArmChain(root: Object3D, side: 'Left' | 'Right'): ArmChain | null {
  const shoulder = findBone(root, `mixamorig${side}Shoulder`, `mixamorig:${side}Shoulder`);
  const upper = findBone(root, `mixamorig${side}Arm`, `mixamorig:${side}Arm`);
  const fore = findBone(root, `mixamorig${side}ForeArm`, `mixamorig:${side}ForeArm`);
  const hand = findBone(root, `mixamorig${side}Hand`, `mixamorig:${side}Hand`);
  if (!upper || !fore || !hand) return null;
  // độ dài đốt đo trong hệ của `root` (kể cả scale của root, KHÔNG kể tổ tiên phía trên — ví dụ viewmodel_space ép FOV (k,k,1))
  posInRoot(root, upper, _vS);
  posInRoot(root, fore, _vE);
  posInRoot(root, hand, _vW);
  return { shoulder: shoulder ?? upper.parent ?? upper, upper, fore, hand, lenUpper: _vS.distanceTo(_vE), lenFore: _vE.distanceTo(_vW) };
}

const _mm = new Matrix4();
/** vị trí của `obj` trong hệ cha của `root` (root.matrix · … · obj.matrix), không phụ thuộc tổ tiên phía trên root */
function posInRoot(root: Object3D, obj: Object3D, out: Vector3): Vector3 {
  const chain: Object3D[] = [];
  for (let o: Object3D | null = obj; o; o = o.parent) {
    chain.push(o);
    if (o === root) break;
  }
  _mm.identity();
  for (let i = chain.length - 1; i >= 0; i--) {
    const o = chain[i]!;
    o.updateMatrix();
    _mm.multiply(o.matrix);
  }
  return out.setFromMatrixPosition(_mm);
}

/** Xoay bone (world) sao cho con `child` hướng tới điểm `target` (giữ xoắn). */
function aimBone(bone: Bone, child: Bone, target: Vector3): void {
  bone.getWorldPosition(_vW);
  child.getWorldPosition(_cur).sub(_vW).normalize();
  _des.copy(target).sub(_vW).normalize();
  _q.setFromUnitVectors(_cur, _des);
  bone.getWorldQuaternion(_qp);
  _qp.premultiply(_q);
  const parent = bone.parent;
  if (parent) {
    parent.getWorldQuaternion(_q2).invert();
    bone.quaternion.copy(_q2).multiply(_qp);
  } else bone.quaternion.copy(_qp);
}

/** Xoay cẳng tay quanh trục của nó tới nửa góc lệch trục x so với bàn tay (ống tay áo không vặn). */
function untwist(fore: Bone, hand: Bone): void {
  fore.getWorldPosition(_vW);
  hand.getWorldPosition(_cur).sub(_vW).normalize();
  fore.getWorldQuaternion(_qp);
  _ax.set(1, 0, 0).applyQuaternion(_qp).addScaledVector(_cur, -_ax.dot(_cur)).normalize();
  hand.getWorldQuaternion(_q2);
  _bx.set(1, 0, 0).applyQuaternion(_q2).addScaledVector(_cur, -_bx.dot(_cur)).normalize();
  const cosT = Math.max(-1, Math.min(1, _ax.dot(_bx)));
  const sign = _cx.copy(_ax).cross(_bx).dot(_cur) < 0 ? -1 : 1;
  const angle = Math.acos(cosT) * 0.5 * sign;
  if (Math.abs(angle) < 1e-4) return;
  _q.setFromAxisAngle(_cur, angle);
  _qp.premultiply(_q);
  const parent = fore.parent;
  if (parent) {
    parent.getWorldQuaternion(_q2).invert();
    fore.quaternion.copy(_q2).multiply(_qp);
  }
}

/**
 * Giải IK: đặt cổ tay tại `target` (ma trận world: vị trí + hướng bàn tay), khuỷu về phía `poleWorld` (đơn vị, world).
 * Yêu cầu matrixWorld của vai đã cập nhật. Trả về khoảng cách còn lại cổ tay ↔ đích (m).
 */
export function solveTwoBone(arm: ArmChain, target: Matrix4, poleWorld: Vector3): number {
  target.decompose(_vT, _qT, _sc); // _vT cổ tay mong muốn, _qT hướng bàn tay (world) — scratch riêng, aimBone/untwist dùng _q2
  _vT0.copy(_vT);
  arm.shoulder.updateWorldMatrix(true, true);
  arm.upper.getWorldPosition(_vS);
  const a = arm.lenUpper;
  const b = arm.lenFore;
  _dir.copy(_vT).sub(_vS);
  let d = _dir.length();
  if (d < 1e-5) return 0;
  _dir.divideScalar(d);
  if (d > (a + b) * 0.995) {
    d = (a + b) * 0.995;
    _vT.copy(_vS).addScaledVector(_dir, d); // ngoài tầm: cổ tay dừng ở điểm với xa nhất
  }
  _perp.copy(poleWorld).addScaledVector(_dir, -poleWorld.dot(_dir));
  if (_perp.lengthSq() < 1e-6) _perp.set(0, -1, 0).addScaledVector(_dir, _dir.y);
  _perp.normalize();
  const cosA = Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d)));
  const sinA = Math.sqrt(1 - cosA * cosA);
  _vE.copy(_vS).addScaledVector(_dir, a * cosA).addScaledVector(_perp, a * sinA);
  aimBone(arm.upper, arm.fore, _vE);
  arm.upper.updateWorldMatrix(false, true);
  aimBone(arm.fore, arm.hand, _vT);
  arm.fore.updateWorldMatrix(false, true);
  arm.fore.getWorldQuaternion(_qp);
  arm.hand.quaternion.copy(_qp.invert()).multiply(_qT);
  untwist(arm.fore, arm.hand);
  arm.fore.updateWorldMatrix(false, true);
  arm.fore.getWorldQuaternion(_qp);
  arm.hand.quaternion.copy(_qp.invert()).multiply(_qT);
  arm.hand.updateWorldMatrix(false, true);
  arm.hand.getWorldPosition(_vW);
  return _vW.distanceTo(_vT0);
}
