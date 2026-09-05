/**
 * Cánh tay góc nhìn thứ nhất (TIP-016): mesh tay của nhân vật Mixamo (scripts/extract-arms.mjs → soldier_arms.glb, cùng skeleton)
 * gắn vào camera; hai tay bám anchor của súng (gripR/gripL) bằng IK 2 khớp (vai → khuỷu → cổ tay) + hướng bàn tay theo offset
 * đã calibrate → tự đúng ở mọi pose (hip/ADS/sprint/reload vì tay trái theo băng đạn). Ngón tay co theo góc cố định.
 * Không animation clip; không AI. Engine thuần (không import game/*).
 */
import { Group, Object3D, Bone, Vector3, Quaternion, Matrix4, Euler, Mesh, SkinnedMesh, Color } from 'three/webgpu';
import { findArmChain, solveTwoBone, type ArmChain } from './armIk';
import { createGltfLoader } from './loaders';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import type { WeaponPose } from './weaponModel';

export interface FpArmsAsset {
  template: Group;
  triangles: number;
}

export async function loadFpArms(url: string): Promise<FpArmsAsset> {
  const loader = createGltfLoader();
  const gltf = await loader.loadAsync(url);
  let triangles = 0;
  gltf.scene.traverse((o: Object3D) => {
    const m = o as Mesh;
    if (m.isMesh) triangles += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes['position']!.count) / 3;
  });
  return { template: gltf.scene, triangles: Math.round(triangles) };
}

/**
 * Vị trí rig (gốc = chân nhân vật, kích thước thật) trong hệ camera: mắt ≈ camera, vai ≈ 0.2 m dưới, rig Mixamo nhìn +z → xoay π.
 * TIP-017: rig ở kích thước thật trong `viewmodel_space` (scale k,k,1 = FOV viewmodel) → tầm với thật 0.5 m tới ốp lót.
 */
export const FP_RIG_POSE = { pos: new Vector3(0, -1.62, 0.02), yaw: Math.PI };
/** hướng khuỷu tay (hệ camera): phải = xuống-phải-ra sau, trái = xuống-trái */
const POLE_R = new Vector3(0.9, -1, 0.35);
const POLE_L = new Vector3(-0.8, -1, 0.1);
/** góc co ngón tay (rad) theo đốt: [đốt 1, đốt 2, đốt 3]; ngón cái riêng */
const FINGER_CURL = { index: [0.9, 1.1, 0.7], middle: [1.1, 1.2, 0.8], ring: [1.2, 1.25, 0.8], pinky: [1.25, 1.3, 0.8], thumb: [0.3, 0.5, 0.3] };
/**
 * Ngón cái TRÁI (TIP-D11a, Chủ nhà: "ngón cái không sát súng"): co quanh x [0,55, 0,8, 0,45] rồi **khép** quanh −z local đốt 1–2 [0,6, 0,6]
 * — đo bằng thử 6 trục trong hệ anchor gripL: −z đưa đầu ngón từ x −0,065 (giơ thẳng lên cạnh súng) về (−0,015, +0,055) = mép trái-trên ốp lót.
 * Ngón cái phải giữ x (tay cầm, phần lớn ngoài khung hình).
 */
const THUMB_L_CURL = [0.55, 0.8, 0.45];
const THUMB_L_CLOSE = [0.6, 0.6, 0];

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

interface FpChain extends ArmChain {
  pole: Vector3;
  /** debug/calib: vai, đích (world), tầm với, sai số lần giải cuối */
  dbg: { shoulder: Vector3; target: Vector3; reach: number; err: number };
}

const _m = new Matrix4();
const _m2 = new Matrix4();
const _q = new Quaternion();
const _qp = new Quaternion();
const _e = new Euler();
const _pole = new Vector3();
const _pos = new Vector3();
const _sc = new Vector3();

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
  private readonly armR: FpChain | null;
  private readonly armL: FpChain | null;
  private readonly fingerBones: Array<{ bone: Bone; curl: number; rest: Quaternion; index: boolean; close: number }> = [];
  readonly triangles: number;

  constructor(asset: FpArmsAsset, parent: Object3D, opts: { tint?: number; scale?: number } = {}) {
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
    parent.add(this.root);
    this.root.updateMatrixWorld(true);
    this.armR = this.chain('Right', POLE_R);
    this.armL = this.chain('Left', POLE_L);
    this.collectFingers('Right');
    this.collectFingers('Left');
  }

  private chain(side: 'Left' | 'Right', pole: Vector3): FpChain | null {
    const c = findArmChain(this.model, side);
    return c ? { ...c, pole, dbg: { shoulder: new Vector3(), target: new Vector3(), reach: c.lenUpper + c.lenFore, err: 0 } } : null;
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
      const thumbL = key === 'thumb' && side === 'Left';
      const curls = thumbL ? THUMB_L_CURL : FINGER_CURL[key];
      for (let i = 0; i < 3; i++) {
        const b = findBone(this.model, `mixamorig${side}Hand${label}${i + 1}`, `mixamorig:${side}Hand${label}${i + 1}`);
        if (b) this.fingerBones.push({ bone: b, curl: curls[i]!, rest: b.quaternion.clone(), index: key === 'index' && side === 'Right', close: thumbL ? THUMB_L_CLOSE[i]! : 0 });
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
      if (f.close) {
        _e.set(0, 0, -f.close); // ngón cái trái: khép thêm quanh −z local
        _q.setFromEuler(_e);
        f.bone.quaternion.multiply(_q);
      }
    }
    if (this.armR) this.solve(this.armR, t.gripR, t.handR);
    if (this.armL) this.solve(this.armL, t.gripL, t.handL);
  }

  private solve(arm: FpChain, anchor: Object3D, off: WeaponPose): void {
    // bàn tay mong muốn (world) = anchor · offset
    anchor.updateWorldMatrix(true, false);
    _e.set(off.rot[0], off.rot[1], off.rot[2]);
    _q.setFromEuler(_e);
    _pos.set(off.pos[0], off.pos[1], off.pos[2]);
    _m2.compose(_pos, _q, _sc.set(1, 1, 1));
    _m.copy(anchor.matrixWorld).multiply(_m2);
    // pole trong hệ camera → world
    _pole.copy(arm.pole).applyQuaternion(this.root.getWorldQuaternion(_qp)).normalize();
    arm.dbg.err = solveTwoBone(arm, _m, _pole);
    arm.upper.getWorldPosition(arm.dbg.shoulder);
    arm.dbg.target.setFromMatrixPosition(_m);
  }

  /** debug/calib: vai, đích, tầm với (world) của hai tay */
  debugInfo(): { R: FpChain['dbg'] | null; L: FpChain['dbg'] | null } {
    return { R: this.armR?.dbg ?? null, L: this.armL?.dbg ?? null };
  }

  set visible(v: boolean) {
    this.root.visible = v;
  }

  dispose(): void {
    this.root.parent?.remove(this.root);
  }
}
