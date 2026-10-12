/**
 * Thu (DV-077 dựng MPFB/MakeHuman CC0, rig Mixamo) đứng mép ngầm cầm đèn bão chỉ đường (DV-078). Không có clip: tư thế dựng
 * bằng code — xoay xương tay theo hướng mong muốn trong hệ thân (đứng thẳng, tay trái buông, tay phải giơ đèn), khi cho xe qua
 * thì đưa đèn qua lại. Đèn dầu (Poly Haven CC0) treo dưới bàn tay, nón lá (NNgan CC-BY) trên đầu; một PointLight ấm tại đèn.
 * Thuần trình bày.
 */
import { Group, Object3D, PointLight, Quaternion, Vector3, type Bone } from 'three/webgpu';

const _a = new Vector3();
const _b = new Vector3();
const _d = new Vector3();
const _t = new Vector3();
const _q = new Quaternion();
const _qp = new Quaternion();
const _qw = new Quaternion();

interface Limb {
  bone: Bone;
  child: Object3D;
  rest: Quaternion;
}

export class ThuView {
  readonly group = new Group();
  readonly light: PointLight;
  private readonly bones = new Map<string, Limb>();
  private readonly head: Object3D | null;
  private readonly handR: Object3D | null;
  private readonly spine: Bone | null;
  private readonly spineRest = new Quaternion();
  /** 0..1: đang vẫy đèn cho xe qua */
  wave = 0;
  private t = 0;
  readonly lamp: Object3D | null;
  readonly hat: Object3D | null;

  constructor(body: Object3D, lamp: Object3D | null, hat: Object3D | null, position: readonly number[], yaw: number) {
    this.group.name = 'thu';
    this.group.add(body);
    this.group.position.set(position[0]!, position[1]!, position[2]!);
    this.group.rotation.y = yaw;
    const find = (n: string): Object3D | null => body.getObjectByName(n) ?? null;
    const limb = (name: string, child: string): void => {
      const b = find(name) as Bone | null;
      const c = find(child);
      if (b && c) this.bones.set(name, { bone: b, child: c, rest: b.quaternion.clone() });
    };
    limb('mixamorigRightArm', 'mixamorigRightForeArm');
    limb('mixamorigRightForeArm', 'mixamorigRightHand');
    limb('mixamorigLeftArm', 'mixamorigLeftForeArm');
    limb('mixamorigLeftForeArm', 'mixamorigLeftHand');
    this.head = find('mixamorigHead');
    this.handR = find('mixamorigRightHand');
    this.spine = find('mixamorigSpine2') as Bone | null;
    if (this.spine) this.spineRest.copy(this.spine.quaternion);
    body.traverse((o) => {
      const m = o as { isMesh?: boolean; castShadow: boolean; frustumCulled: boolean };
      if (m.isMesh) {
        m.castShadow = true;
        m.frustumCulled = false; // skinned: bbox theo bind pose
      }
    });
    this.lamp = lamp;
    if (lamp) {
      // đèn Poly Haven cao 0,8 m (thang sai) → đèn bão ~0,3 m
      lamp.scale.setScalar(0.38);
    }
    this.hat = hat;
    this.light = new PointLight(0xffb45a, 5, 16, 1.7);
    this.light.castShadow = false;
  }

  /** gắn đèn/nón/ánh sáng vào scene (cùng cha với group) */
  attach(parent: Object3D): void {
    parent.add(this.group, this.light);
    if (this.lamp) parent.add(this.lamp);
    if (this.hat) parent.add(this.hat);
  }

  /** hướng trong hệ thân (x trái của Thu → +x model, y lên, z trước mặt) → world */
  private bodyDir(x: number, y: number, z: number, out: Vector3): Vector3 {
    return out.set(x, y, z).normalize().applyQuaternion(this.group.quaternion);
  }

  /** xoay xương sao cho hướng xương → con trỏ theo `dir` (world) */
  private aim(name: string, dir: Vector3): void {
    const l = this.bones.get(name);
    if (!l) return;
    l.bone.updateWorldMatrix(true, false);
    l.child.updateWorldMatrix(false, false);
    l.bone.getWorldPosition(_a);
    l.child.getWorldPosition(_b);
    _d.subVectors(_b, _a).normalize();
    _q.setFromUnitVectors(_d, dir);
    l.bone.getWorldQuaternion(_qw);
    _qw.premultiply(_q);
    if (l.bone.parent) {
      l.bone.parent.getWorldQuaternion(_qp);
      _qw.premultiply(_qp.invert());
    }
    l.bone.quaternion.copy(_qw);
  }

  update(dt: number): void {
    this.t += dt;
    for (const l of this.bones.values()) l.bone.quaternion.copy(l.rest);
    // thở nhẹ
    if (this.spine) {
      this.spine.quaternion.copy(this.spineRest);
      _q.setFromAxisAngle(_t.set(1, 0, 0), Math.sin(this.t * 1.6) * 0.012);
      this.spine.quaternion.multiply(_q);
    }
    this.group.updateMatrixWorld(true);
    // tay trái buông dọc thân, khuỷu hơi gập
    this.aim('mixamorigLeftArm', this.bodyDir(0.2, -1, 0.06, _t));
    this.aim('mixamorigLeftForeArm', this.bodyDir(0.12, -0.85, 0.5, _t));
    // tay phải giơ đèn trước mặt, khi cho xe qua thì đưa đèn sang ngang theo nhịp
    const sway = Math.sin(this.t * 2.6) * 0.55 * this.wave;
    this.aim('mixamorigRightArm', this.bodyDir(-0.45 + sway * 0.4, 0.1 + 0.25 * this.wave, 0.85, _t));
    this.aim('mixamorigRightForeArm', this.bodyDir(-0.2 + sway, 0.75, 0.55, _t));
    this.group.updateMatrixWorld(true);
    if (this.handR && this.lamp) {
      this.handR.getWorldPosition(_a);
      // đèn bão treo dưới tay theo quai, lắc nhẹ
      this.lamp.position.set(_a.x, _a.y - 0.31, _a.z);
      this.lamp.rotation.set(Math.sin(this.t * 3.1) * 0.08 * (0.3 + this.wave), this.group.rotation.y, Math.sin(this.t * 2.3) * 0.06);
      this.light.position.set(_a.x, _a.y - 0.18, _a.z);
      // ngọn lửa đèn chập chờn
      this.light.intensity = 5 * (0.88 + 0.08 * Math.sin(this.t * 11.3) + 0.05 * Math.sin(this.t * 23.7));
    }
    if (this.head && this.hat) {
      this.head.getWorldPosition(_a);
      this.hat.position.set(_a.x, _a.y + 0.105, _a.z);
      this.hat.rotation.set(-0.12, this.group.rotation.y, 0, 'YXZ');
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    this.light.removeFromParent();
    this.lamp?.removeFromParent();
    this.hat?.removeFromParent();
  }
}
