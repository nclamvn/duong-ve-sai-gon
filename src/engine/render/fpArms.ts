/**
 * Cánh tay góc nhìn thứ nhất (TIP-016): mesh tay của nhân vật Mixamo (scripts/extract-arms.mjs → soldier_arms.glb, cùng skeleton)
 * gắn vào camera; hai tay bám anchor của súng (gripR/gripL) bằng IK 2 khớp (vai → khuỷu → cổ tay) + hướng bàn tay theo offset
 * đã calibrate → tự đúng ở mọi pose (hip/ADS/sprint/reload vì tay trái theo băng đạn). Ngón tay co theo góc cố định.
 * Không animation clip; không AI. Engine thuần (không import game/*).
 */
import { Group, Object3D, Bone, Vector3, Quaternion, Matrix4, Euler, Mesh, SkinnedMesh, Color, type Camera } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import type { WeaponPose } from './weaponModel';

export interface FpArmsAsset {
  template: Group;
  triangles: number;
}

export async function loadFpArms(url: string): Promise<FpArmsAsset> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url);
  let triangles = 0;
  gltf.scene.traverse((o: Object3D) => {
    const m = o as Mesh;
    if (m.isMesh) triangles += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes['position']!.count) / 3;
  });
  return { template: gltf.scene, triangles: Math.round(triangles) };
}

/** Vị trí rig (gốc = chân nhân vật) trong hệ camera: mắt ≈ camera, rig Mixamo nhìn +z → xoay π. */
export const FP_RIG_POSE = { pos: new Vector3(0, -1.62, 0.1), yaw: Math.PI };
/** hướng khuỷu tay (hệ camera): phải = xuống-phải-ra sau, trái = xuống-trái */
const POLE_R = new Vector3(0.9, -1, 0.35);
const POLE_L = new Vector3(-0.8, -1, 0.1);
/** góc co ngón tay (rad) theo đốt: [đốt 1, đốt 2, đốt 3]; ngón cái riêng */
const FINGER_CURL = { index: [0.9, 1.1, 0.7], middle: [1.1, 1.2, 0.8], ring: [1.2, 1.25, 0.8], pinky: [1.25, 1.3, 0.8], thumb: [0.3, 0.5, 0.3] };

export interface FpArmTargets {
  /** anchor tay cầm (hệ súng) — world matrix dùng trực tiếp */
  gripR: Object3D;
  gripL: Object3D;
  /** offset bone bàn tay trong hệ anchor (pos m, rot Euler) */
  handR: WeaponPose;
  handL: WeaponPose;
  /** ngón trỏ phải duỗi (trên cò) 0..1 */
  triggerFinger?: number;
}

interface ArmChain {
  shoulder: Bone;
  upper: Bone;
  fore: Bone;
  hand: Bone;
  lenUpper: number;
  lenFore: number;
  pole: Vector3;
}

const _m = new Matrix4();
const _m2 = new Matrix4();
const _q = new Quaternion();
const _q2 = new Quaternion();
const _qp = new Quaternion();
const _e = new Euler();
const _vS = new Vector3();
const _vE = new Vector3();
const _vW = new Vector3();
const _vT = new Vector3();
const _dir = new Vector3();
const _pole = new Vector3();
const _perp = new Vector3();
const _cur = new Vector3();
const _des = new Vector3();
const _pos = new Vector3();
const _sc = new Vector3();
const _ax = new Vector3();
const _bx = new Vector3();
const _cx = new Vector3();

function findBone(root: Object3D, ...names: string[]): Bone | null {
  for (const n of names) {
    const o = root.getObjectByName(n);
    if (o && (o as Bone).isBone) return o as Bone;
  }
  return null;
}

export class FpArms {
  readonly root = new Group();
  readonly model: Group;
  readonly skinned: SkinnedMesh[] = [];
  private readonly armR: ArmChain | null;
  private readonly armL: ArmChain | null;
  private readonly fingerBones: Array<{ bone: Bone; curl: number; rest: Quaternion; index: boolean }> = [];
  readonly triangles: number;

  constructor(asset: FpArmsAsset, camera: Camera, opts: { tint?: number; scale?: number } = {}) {
    this.model = skeletonClone(asset.template) as Group;
    this.model.traverse((o: Object3D) => {
      const m = o as SkinnedMesh;
      if (m.isSkinnedMesh) {
        m.castShadow = false;
        m.receiveShadow = false;
        m.frustumCulled = false;
        this.skinned.push(m);
        if (opts.tint !== undefined && !Array.isArray(m.material)) {
          const c = m.material.clone() as typeof m.material & { color?: Color };
          if (c.color) c.color.multiply(new Color(opts.tint));
          m.material = c;
        }
      }
    });
    this.triangles = asset.triangles;
    const s = opts.scale ?? 1;
    this.model.scale.setScalar(s);
    this.model.position.copy(FP_RIG_POSE.pos).multiplyScalar(s); // rig thu theo scale viewmodel (mắt ≈ camera)
    this.model.rotation.y = FP_RIG_POSE.yaw;
    this.root.add(this.model);
    this.root.name = 'fp_arms';
    camera.add(this.root);
    this.root.updateMatrixWorld(true);
    this.armR = this.chain('Right', POLE_R);
    this.armL = this.chain('Left', POLE_L);
    this.collectFingers('Right');
    this.collectFingers('Left');
  }

  private chain(side: 'Left' | 'Right', pole: Vector3): ArmChain | null {
    const m = this.model;
    const shoulder = findBone(m, `mixamorig${side}Shoulder`, `mixamorig:${side}Shoulder`);
    const upper = findBone(m, `mixamorig${side}Arm`, `mixamorig:${side}Arm`);
    const fore = findBone(m, `mixamorig${side}ForeArm`, `mixamorig:${side}ForeArm`);
    const hand = findBone(m, `mixamorig${side}Hand`, `mixamorig:${side}Hand`);
    if (!shoulder || !upper || !fore || !hand) return null;
    upper.getWorldPosition(_vS);
    fore.getWorldPosition(_vE);
    hand.getWorldPosition(_vW);
    return { shoulder, upper, fore, hand, lenUpper: _vS.distanceTo(_vE), lenFore: _vE.distanceTo(_vW), pole };
  }

  private collectFingers(side: 'Left' | 'Right'): void {
    const names: Array<[keyof typeof FINGER_CURL, string]> = [
      ['index', 'Index'],
      ['middle', 'Middle'],
      ['ring', 'Ring'],
      ['pinky', 'Pinky'],
      ['thumb', 'Thumb'],
    ];
    for (const [key, label] of names) {
      const curls = FINGER_CURL[key];
      for (let i = 0; i < 3; i++) {
        const b = findBone(this.model, `mixamorig${side}Hand${label}${i + 1}`, `mixamorig:${side}Hand${label}${i + 1}`);
        if (b) this.fingerBones.push({ bone: b, curl: curls[i]!, rest: b.quaternion.clone(), index: key === 'index' && side === 'Right' });
      }
    }
  }

  /** Gọi mỗi frame sau khi viewmodel đã đặt anchor (camera matrixWorld phải mới). */
  update(t: FpArmTargets): void {
    this.root.updateMatrixWorld(true);
    // ngón tay: co cố định (ngón trỏ phải duỗi khi triggerFinger → 1)
    for (const f of this.fingerBones) {
      const k = f.index ? f.curl * (1 - (t.triggerFinger ?? 0.6)) : f.curl;
      _e.set(k, 0, 0); // Mixamo: đốt ngón co quanh trục x local (kiểm bằng viewer)
      _q.setFromEuler(_e);
      f.bone.quaternion.copy(f.rest).multiply(_q);
    }
    if (this.armR) this.solve(this.armR, t.gripR, t.handR);
    if (this.armL) this.solve(this.armL, t.gripL, t.handL);
  }

  private solve(arm: ArmChain, anchor: Object3D, off: WeaponPose): void {
    // bàn tay mong muốn (world) = anchor · offset
    anchor.updateWorldMatrix(true, false);
    _e.set(off.rot[0], off.rot[1], off.rot[2]);
    _q.setFromEuler(_e);
    _pos.set(off.pos[0], off.pos[1], off.pos[2]);
    _m2.compose(_pos, _q, _sc.set(1, 1, 1));
    _m.copy(anchor.matrixWorld).multiply(_m2);
    _m.decompose(_vT, _q2, _sc); // _vT = cổ tay mong muốn, _q2 = hướng bàn tay (world)

    arm.shoulder.updateWorldMatrix(true, true);
    arm.upper.getWorldPosition(_vS);
    const a = arm.lenUpper;
    const b = arm.lenFore;
    _dir.copy(_vT).sub(_vS);
    let d = _dir.length();
    if (d < 1e-5) return;
    _dir.divideScalar(d);
    d = Math.min(d, (a + b) * 0.995);
    // khuỷu: mặt phẳng (dir, pole) — pole trong hệ camera → world
    _pole.copy(arm.pole).applyQuaternion(this.root.getWorldQuaternion(_qp)).normalize();
    _perp.copy(_pole).addScaledVector(_dir, -_pole.dot(_dir));
    if (_perp.lengthSq() < 1e-6) _perp.set(0, -1, 0).addScaledVector(_dir, _dir.y);
    _perp.normalize();
    const cosA = Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d)));
    const sinA = Math.sqrt(1 - cosA * cosA);
    _vE.copy(_vS).addScaledVector(_dir, a * cosA).addScaledVector(_perp, a * sinA);
    // cánh tay trên: xoay để khuỷu hiện tại → khuỷu mong muốn
    this.aimBone(arm.upper, arm.fore, _vE);
    arm.upper.updateWorldMatrix(false, true);
    // cẳng tay: khuỷu → cổ tay mong muốn
    this.aimBone(arm.fore, arm.hand, _vT);
    arm.fore.updateWorldMatrix(false, true);
    // bàn tay: hướng world = _q2 → local
    arm.fore.getWorldQuaternion(_qp);
    arm.hand.quaternion.copy(_qp.invert()).multiply(_q2);
    // xoắn cẳng tay theo bàn tay (giảm vặn ống tay áo): xoay cẳng tay quanh trục của nó tới nửa góc lệch trục x
    this.untwist(arm.fore, arm.hand);
    arm.fore.updateWorldMatrix(false, true);
    arm.fore.getWorldQuaternion(_qp);
    arm.hand.quaternion.copy(_qp.invert()).multiply(_q2);
  }

  /** Xoay bone (world) sao cho con `child` hướng tới điểm `target` (giữ xoắn). */
  private aimBone(bone: Bone, child: Bone, target: Vector3): void {
    bone.getWorldPosition(_vW);
    child.getWorldPosition(_cur).sub(_vW).normalize();
    _des.copy(target).sub(_vW).normalize();
    _q.setFromUnitVectors(_cur, _des);
    bone.getWorldQuaternion(_qp);
    _qp.premultiply(_q); // world mới
    const parent = bone.parent;
    if (parent) {
      parent.getWorldQuaternion(_q2).invert();
      bone.quaternion.copy(_q2).multiply(_qp);
    } else bone.quaternion.copy(_qp);
  }

  private untwist(fore: Bone, hand: Bone): void {
    // trục cẳng tay = hướng tới bàn tay; so trục x của cẳng tay và bàn tay chiếu lên mặt phẳng ⟂ trục → xoay nửa góc
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

  set visible(v: boolean) {
    this.root.visible = v;
  }

  dispose(): void {
    this.root.parent?.remove(this.root);
  }
}
