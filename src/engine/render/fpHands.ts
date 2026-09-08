/**
 * Cánh tay góc nhìn thứ nhất v2 (TIP-D11b): asset tay RIÊNG (David Fischer "First Person hands rigged", CC-BY-4.0,
 * public/assets/characters/fp_hands.glb — 63 joint đủ đốt ngón; convert-fp-hands.mjs vá rig cẳng tay↔bàn tay ở
 * tầng glTF nên deform đúng). Thay tay Mixamo cũ (soldier_arms, mesh xấu). Đặt CẢ HAI bàn tay lên anchor báng/ốp lót
 * bằng IK 2 khớp (vai→khuỷu→cổ tay) MỘT LẦN rồi ĐÓNG BĂNG (bake) — runtime KHÔNG giải IK per-frame (per-frame IK lật
 * khuỷu ở gần giới hạn với tới → tay "giật nháy loạn xạ", Chủ nhà báo trên Mac). Sau bake: áp pose xương tất định +
 * bám cứng root theo anchor báng (súng đung đưa/ADS kéo cả tay theo). NGÓN co theo pose authored. Engine thuần.
 */
import { Group, Object3D, Bone, Mesh, SkinnedMesh, Box3, Vector3, Quaternion, Euler, Color, Matrix4, MeshStandardNodeMaterial } from 'three/webgpu';
import { createGltfLoader } from './loaders';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { solveTwoBone, type ArmChain } from './armIk';

export interface FpHandsAsset {
  template: Group;
  triangles: number;
  size: Vector3;
}

export async function loadFpHands(url: string): Promise<FpHandsAsset> {
  const loader = createGltfLoader();
  const gltf = await loader.loadAsync(url);
  let triangles = 0;
  gltf.scene.traverse((o: Object3D) => {
    const m = o as Mesh;
    if (m.isMesh) triangles += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes['position']!.count) / 3;
  });
  gltf.scene.updateMatrixWorld(true);
  const box = new Box3().setFromObject(gltf.scene);
  const size = new Vector3();
  box.getSize(size);
  return { template: gltf.scene, triangles: Math.round(triangles), size };
}

/** offset bàn tay trong hệ anchor báng (pos m, rot Euler rad) + hướng khuỷu (pole, hệ rig root). */
export interface FpArmPose {
  pos: [number, number, number];
  rot: [number, number, number];
  pole: [number, number, number];
}

/** Pose authored nắm súng: IK 2 khớp đặt cổ tay + ngón co theo dữ liệu. */
export interface FpHandsPose {
  scale: number;
  /** đặt cả rig trong viewmodel space: vai lùi/xuống dưới camera để cánh tay với tới báng (pos m, euler rad) */
  place: { pos: [number, number, number]; euler: [number, number, number] };
  armR: FpArmPose;
  armL: FpArmPose;
  /** xoay local (Euler XYZ, rad) áp lên rest mỗi xương NGÓN (khớp tiền tố tên, ví dụ 'f_index01R'); ngón trỏ phải theo triggerFinger */
  fingers: Record<string, [number, number, number]>;
}

const _m = new Matrix4();
const _m2 = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _pos = new Vector3();
const _sc = new Vector3(1, 1, 1);
const _pole = new Vector3();
const _followScale = new Vector3();

export class FpHands {
  readonly root = new Group();
  readonly rig: Group;
  readonly skinned: SkinnedMesh[] = [];
  readonly triangles: number;
  private readonly boneByName = new Map<string, Bone>();
  private readonly rest = new Map<string, Quaternion>();
  private armR: ArmChain | null = null;
  private armL: ArmChain | null = null;
  private readonly fit: number;
  private pose: FpHandsPose | null = null;
  /** ngón trỏ phải: 0 = duỗi trên cò, 1 = co (bóp cò) */
  triggerFinger = 0.5;
  /** BAKE (DV-049 fix nháy): giải IK MỘT LẦN rồi đóng băng — runtime không giải IK (per-frame IK lật khuỷu → nháy) */
  private baked = false;
  private bakedBones: Array<{ bone: Bone; q: Quaternion }> = [];
  private readonly followOffset = new Matrix4();
  private followRef: Object3D | null = null;

  constructor(asset: FpHandsAsset, parent: Object3D, opts: { tint?: number; targetReach?: number } = {}) {
    this.rig = skeletonClone(asset.template) as Group;
    this.triangles = asset.triangles;
    const skin = new MeshStandardNodeMaterial();
    skin.color = new Color(opts.tint ?? 0xc9a07a);
    skin.roughness = 0.72;
    skin.metalness = 0.0;
    this.rig.traverse((o: Object3D) => {
      const sm = o as SkinnedMesh;
      if (sm.isSkinnedMesh) {
        sm.castShadow = false;
        sm.receiveShadow = false;
        sm.frustumCulled = false;
        this.skinned.push(sm);
        sm.material = skin;
      }
      const b = o as Bone;
      if (b.isBone) {
        this.boneByName.set(b.name, b);
        this.rest.set(b.name, b.quaternion.clone());
      }
    });
    this.fit = 1;
    this.rig.scale.setScalar(1);
    this.root.name = 'fp_hands';
    this.root.add(this.rig);
    parent.add(this.root);
    this.root.updateMatrixWorld(true);
    // three.js bỏ dấu chấm tên node: 'upper_arm.R_03' → 'upper_armR_03' (khớp tiền tố)
    this.armR = this.chain('upper_armR', 'forearmR_0', 'handR');
    this.armL = this.chain('upper_armL', 'forearmL_0', 'handL');
    // co theo CẲNG TAY (không theo sải hai tay) → cánh tay dài thật, IK với tới báng
    const wantFore = opts.targetReach ?? 0.27;
    if (this.armR && this.armR.lenFore > 1e-6) {
      this.fit = wantFore / this.armR.lenFore;
      this.rig.scale.setScalar(this.fit);
      this.root.updateMatrixWorld(true);
      this.armR = this.chain('upper_armR', 'forearmR_0', 'handR');
      this.armL = this.chain('upper_armL', 'forearmL_0', 'handL');
    }
  }

  private find(prefix: string): Bone | null {
    for (const [name, b] of this.boneByName) if (name.startsWith(prefix)) return b;
    return null;
  }

  private chain(upperP: string, foreP: string, handP: string): ArmChain | null {
    const upper = this.find(upperP);
    const fore = this.find(foreP);
    const hand = this.find(handP);
    if (!upper || !fore || !hand) return null;
    upper.updateWorldMatrix(true, true);
    const su = new Vector3(), se = new Vector3(), sw = new Vector3();
    upper.getWorldPosition(su);
    fore.getWorldPosition(se);
    hand.getWorldPosition(sw);
    return { shoulder: upper.parent ?? upper, upper, fore, hand, lenUpper: su.distanceTo(se), lenFore: se.distanceTo(sw) };
  }

  /** Áp pose: scale + ngón co (authored) + đặt lại chỗ rig. Đặt baked=false → update() kế nướng IK lại một lần. */
  applyPose(pose: FpHandsPose): void {
    this.pose = pose;
    this.rig.scale.setScalar(this.fit * (pose.scale ?? 1));
    if (pose.place) {
      // đặt CỐ ĐỊNH trong viewmodel space (camera-relative, ổn định khi ngắm lên/xuống): vai lùi + xuống dưới camera
      this.root.position.set(pose.place.pos[0], pose.place.pos[1], pose.place.pos[2]);
      this.root.rotation.set(pose.place.euler[0], pose.place.euler[1], pose.place.euler[2]);
    }
    this.baked = false; // đổi pose → nướng lại ở update kế
    this.applyFingers();
  }

  private applyFingers(): void {
    if (!this.pose) return;
    for (const k in this.pose.fingers) {
      const val = this.pose.fingers[k]!;
      for (const [name, b] of this.boneByName) {
        if (name.includes('_end')) continue;
        if (!name.startsWith(k)) continue;
        // ngón trỏ phải đốt gốc: mở theo triggerFinger
        const scale = k === 'f_index01R' ? 0.35 + 0.65 * this.triggerFinger : 1;
        _e.set(val[0] * scale, val[1], val[2]);
        b.quaternion.copy(this.rest.get(name)!).multiply(_q.setFromEuler(_e));
      }
    }
  }

  /**
   * Lần ĐẦU: giải IK 2 khớp đặt hai cổ tay lên gripR/gripL + ghi offset cứng root↔gripR, rồi ĐÓNG BĂNG.
   * Các frame sau: KHÔNG giải IK — áp lại pose xương đã nướng (tất định) + bám cứng root theo gripR (súng đung đưa/ADS
   * kéo cả tay theo, không lật khuỷu → hết nháy). Đổi pose (calib) → `applyPose` đặt baked=false → nướng lại.
   */
  update(gripR: Object3D, gripL: Object3D): void {
    if (!this.pose || !this.armR || !this.armL) return;
    if (!this.baked) {
      this.applyFingers();
      this.root.updateMatrixWorld(true);
      // đo lại chiều dài đốt ở scale hiện tại (constructor đo trước khi áp pose.scale)
      this.armR = this.chain('upper_armR', 'forearmR_0', 'handR') ?? this.armR;
      this.armL = this.chain('upper_armL', 'forearmL_0', 'handL') ?? this.armL;
      this.solve(this.armR, gripR, this.pose.armR);
      this.solve(this.armL, gripL, this.pose.armL);
      this.bakedBones = [];
      for (const [, b] of this.boneByName) this.bakedBones.push({ bone: b, q: b.quaternion.clone() });
      // offset cứng: root trong hệ gripR (bám súng)
      gripR.updateWorldMatrix(true, false);
      this.root.updateMatrixWorld(true);
      this.followOffset.copy(gripR.matrixWorld).invert().multiply(this.root.matrixWorld);
      this.followRef = gripR;
      this.baked = true;
    }
    for (const { bone, q } of this.bakedBones) bone.quaternion.copy(q);
    if (this.followRef) {
      this.followRef.updateWorldMatrix(true, false);
      _m.copy(this.followRef.matrixWorld).multiply(this.followOffset); // root world mong muốn
      const parent = this.root.parent;
      if (parent) {
        parent.updateWorldMatrix(true, false);
        _m2.copy(parent.matrixWorld).invert().multiply(_m);
      } else {
        _m2.copy(_m);
      }
      _m2.decompose(this.root.position, this.root.quaternion, _followScale);
      this.root.scale.set(1, 1, 1); // rig con giữ fit scale; root luôn 1 (chống rò scale từ anchor súng)
    }
  }

  private solve(arm: ArmChain, anchor: Object3D, off: FpArmPose): void {
    anchor.updateWorldMatrix(true, false);
    _e.set(off.rot[0], off.rot[1], off.rot[2]);
    _q.setFromEuler(_e);
    _pos.set(off.pos[0], off.pos[1], off.pos[2]);
    _m2.compose(_pos, _q, _sc);
    _m.copy(anchor.matrixWorld).multiply(_m2);
    _pole.set(off.pole[0], off.pole[1], off.pole[2]).applyQuaternion(this.root.getWorldQuaternion(new Quaternion())).normalize();
    solveTwoBone(arm, _m, _pole);
  }

  bone(prefix: string): Bone | null {
    return this.find(prefix);
  }

  set visible(v: boolean) {
    this.root.visible = v;
  }

  dispose(): void {
    this.root.parent?.remove(this.root);
  }
}

/**
 * Pose nắm AK mặc định (TIP-D11b) — KHỞI ĐẦU để calib bằng ảnh sandbox. offset/rot bàn tay & pole khuỷu tinh chỉnh runtime
 * qua `__ht.fp`. Bản canh xong ghi vào content/weapons/ak47.json#fp.handsPose.
 */
export const DEFAULT_AK_GRIP: FpHandsPose = {
  scale: 0.8,
  place: { pos: [-0.04, -1.32, 0.07], euler: [0, 0, 0] },
  armR: { pos: [0.02, -0.02, 0.02], rot: [-0.3, Math.PI, 0], pole: [1.1, -1.5, -0.2] },
  armL: { pos: [-0.02, 0.0, 0.0], rot: [-1.4, Math.PI, 0.2], pole: [-1.1, -1.5, -0.2] },
  fingers: {
    f_index01R: [0.55, 0, 0], f_index02R: [0.7, 0, 0], f_index03R: [0.5, 0, 0],
    f_middle01R: [0.85, 0, 0], f_middle02R: [0.95, 0, 0], f_middle03R: [0.7, 0, 0],
    f_ring01R: [0.9, 0, 0], f_ring02R: [1.0, 0, 0], f_ring03R: [0.72, 0, 0],
    f_pinky01R: [0.95, 0, 0], f_pinky02R: [1.05, 0, 0], f_pinky03R: [0.75, 0, 0],
    thumb01R: [0.4, 0.2, 0], thumb02R: [0.35, 0, 0], thumb03R: [0.3, 0, 0],
    f_index01L: [0.8, 0, 0], f_index02L: [0.9, 0, 0], f_index03L: [0.7, 0, 0],
    f_middle01L: [0.85, 0, 0], f_middle02L: [0.95, 0, 0], f_middle03L: [0.72, 0, 0],
    f_ring01L: [0.9, 0, 0], f_ring02L: [1.0, 0, 0], f_ring03L: [0.75, 0, 0],
    f_pinky01L: [0.95, 0, 0], f_pinky02L: [1.05, 0, 0], f_pinky03L: [0.78, 0, 0],
    thumb01L: [0.4, 0.2, 0], thumb02L: [0.35, 0, 0], thumb03L: [0.3, 0, 0],
  },
};
