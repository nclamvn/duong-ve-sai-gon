/**
 * ActorVisual (TIP-012): giao diện chung cho hình đại diện actor — Dummy (procedural, fallback/CI) và SoldierVisual (glTF Mixamo).
 * Game/BotActor/MissionHost chỉ dùng giao diện này. hitZones tĩnh (DUMMY_HIT_ZONES) — physics không đổi.
 */
import { Group, Object3D, SkinnedMesh, Vector3, Matrix4, Quaternion } from 'three/webgpu';
import { Dummy, DUMMY_HIT_ZONES, type HitZones, type DummyOptions } from './dummy';
import { CharacterInstance, type CharacterAsset } from '@engine/render/characters';
import { attachRifle, type AttachedRifle } from '@engine/render/rifleProp';
import { findArmChain, solveTwoBone, type ArmChain } from '@engine/render/armIk';
import { poseToMatrix, type WeaponAsset } from '@engine/render/weaponModel';

/** pole khuỷu trái trong hệ nhân vật (Mixamo nhìn +z): xuống, ra trái (+x của rig), hơi ra trước */
const POLE_L_CHAR = new Vector3(0.9, -1, 0.3);
const _ikM = new Matrix4();
const _ikOff = new Matrix4();
const _ikPole = new Vector3();
const _ikQ = new Quaternion();

export interface ActorVisual {
  readonly group: Group;
  /** SkinnedMesh chính (test/debug) */
  readonly mesh: SkinnedMesh;
  readonly hitZones: HitZones;
  /** bone chuẩn cho test/hit (spine bắt buộc) */
  readonly bones: { spine: Object3D; head: Object3D; hips: Object3D };
  health: number;
  alive: boolean;
  motion: { speed: number; aiming: boolean };
  setPose(t: number): void;
  applyDamage(amount: number): boolean;
  reset(): void;
  onFire(): void;
  onReload(): void;
  /** vị trí đầu nòng súng (world) nếu có súng → true; FX địch (TIP-014) */
  muzzleWorld(out: Vector3): boolean;
  /** true nếu là nhân vật glTF (không phải procedural) */
  readonly kind: 'procedural' | 'gltf';
}

/** Lính glTF Mixamo: mixer state machine đọc `motion` như Dummy; chết → clip death giữ frame cuối. */
export class SoldierVisual implements ActorVisual {
  readonly kind = 'gltf' as const;
  readonly group = new Group();
  readonly mesh: SkinnedMesh;
  readonly hitZones = DUMMY_HIT_ZONES;
  readonly bones: { spine: Object3D; head: Object3D; hips: Object3D };
  readonly char: CharacterInstance;
  /** pivot súng gắn tay phải (Mixamo không kèm vũ khí): glTF CC-BY (TIP-014) hoặc AR procedural */
  readonly rifle: Object3D | null;
  readonly rifleKind: 'procedural' | 'gltf' | 'none';
  /** súng đã gắn (anchor/weapon cho IK tay trái + calib) */
  readonly attached: AttachedRifle | null;
  /** chuỗi IK tay trái (TIP-017) — null nếu không có súng glTF hoặc thiếu bone */
  readonly armL: ArmChain | null;
  /** khoảng cách còn lại cổ tay trái ↔ đích IK (m) — debug/calib */
  ikErrorL = 0;
  /** tắt IK tay trái (calib đo pose animation gốc) */
  ikEnabled = true;
  private readonly muzzle: Object3D | null;
  health = 100;
  alive = true;
  motion = { speed: 0, aiming: false };
  private lastT = 0;

  constructor(asset: CharacterAsset, opts: DummyOptions = {}, weapon: WeaponAsset | null = null) {
    this.char = new CharacterInstance(asset, { tint: opts.color, visor: opts.visor });
    // Mixamo rig nhìn về +z; hệ actor (Dummy, bot.yaw) quy ước mặt trước là −z → xoay 180°
    this.char.root.rotation.y = Math.PI;
    this.group.add(this.char.root);
    this.group.name = 'soldier_gltf';
    const first = this.char.skinned[0];
    if (!first) throw new Error('character has no SkinnedMesh');
    this.mesh = first;
    const b = this.char.bones;
    const spine = b.spine ?? b.hips ?? this.char.model;
    this.bones = { spine, head: b.head ?? spine, hips: b.hips ?? spine };
    const att = b.handR ? attachRifle(b.handR, weapon) : null;
    this.attached = att;
    this.rifle = att?.pivot ?? null;
    this.muzzle = att?.muzzle ?? null;
    this.rifleKind = att?.kind ?? 'none';
    this.armL = att?.kind === 'gltf' ? findArmChain(this.char.model, 'Left') : null;
  }

  /** IK tay trái ôm ốp lót: cổ tay trái → gripL · fp.handL (world). Gọi sau mixer update, trước render. */
  private solveLeftHand(): void {
    const att = this.attached;
    if (!this.armL || !att?.anchors || !att.weapon) return;
    const gripL = att.anchors.gripL;
    gripL.updateWorldMatrix(true, false);
    poseToMatrix(att.weapon.cfg.fp.handL, _ikOff);
    _ikM.copy(gripL.matrixWorld).multiply(_ikOff);
    _ikPole.copy(POLE_L_CHAR).applyQuaternion(this.char.root.getWorldQuaternion(_ikQ)).normalize();
    this.ikErrorL = solveTwoBone(this.armL, _ikM, _ikPole);
  }

  muzzleWorld(out: Vector3): boolean {
    if (!this.muzzle) return false;
    this.muzzle.getWorldPosition(out);
    return true;
  }

  setPose(t: number): void {
    const dt = this.lastT > 0 ? Math.min(0.1, Math.max(0, t - this.lastT)) : 0;
    this.lastT = t;
    if (this.alive) this.char.setLocomotion(this.motion.speed, this.motion.aiming);
    this.char.update(dt);
    if (this.alive && this.ikEnabled) this.solveLeftHand();
  }

  /** Áp lại pose animation hiện tại không IK (calib): mixer ghi lại bone rồi cập nhật matrixWorld. */
  applyRawPose(): void {
    this.char.mixer.update(1e-6);
    this.char.root.updateMatrixWorld(true);
  }

  applyDamage(amount: number): boolean {
    if (!this.alive) return false;
    this.health = Math.max(0, this.health - amount);
    if (this.health === 0) {
      this.alive = false;
      if (!this.char.playOnce('death', 0.1)) {
        // không có clip death → ngã bằng code như Dummy
        this.group.rotation.x = -Math.PI / 2;
        this.group.position.y += 0.25;
      }
      return true;
    }
    this.char.hitFlash();
    this.char.playOnce('hit', 0.05);
    return false;
  }

  onFire(): void {
    if (this.alive) this.char.playOnce('fire', 0.04);
  }

  onReload(): void {
    if (this.alive) this.char.playOnce('reload', 0.1);
  }

  reset(): void {
    this.health = 100;
    this.alive = true;
    this.motion.speed = 0;
    this.motion.aiming = false;
    this.group.rotation.set(0, 0, 0);
    this.group.position.y = 0;
    this.lastT = 0;
    this.char.reset();
  }
}

/** Dummy procedural bọc giao diện (thêm onFire/onReload no-op, kind). */
export class DummyVisual extends Dummy implements ActorVisual {
  readonly kind = 'procedural' as const;
  onFire(): void {}
  onReload(): void {}
  muzzleWorld(): boolean {
    return false;
  }
}

export function createActorVisual(character: CharacterAsset | null, opts: DummyOptions, weapon: WeaponAsset | null = null): ActorVisual {
  return character ? new SoldierVisual(character, opts, weapon) : new DummyVisual(opts);
}
