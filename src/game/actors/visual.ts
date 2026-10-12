/**
 * ActorVisual (TIP-012): giao diện chung cho hình đại diện actor — Dummy (procedural, fallback/CI) và SoldierVisual (glTF Mixamo).
 * Game/BotActor/MissionHost chỉ dùng giao diện này. hitZones tĩnh (DUMMY_HIT_ZONES) — physics không đổi.
 */
import { applyEnvShading } from '@engine/render/envShade';
import { Group, Object3D, SkinnedMesh, Vector3, Matrix4, Quaternion } from 'three/webgpu';
import { Dummy, DUMMY_HIT_ZONES, type HitZones, type DummyOptions } from './dummy';
import { CharacterInstance, type CharacterAsset, type HitDir } from '@engine/render/characters';
import { attachRifle, type AttachedRifle } from '@engine/render/rifleProp';
import { attachGear1971, findChestBone, type Gear1971 } from '@engine/render/gear1971';
import { attachGearUS1971, type GearUS1971 } from '@engine/render/gearUS1971';
import { attachGearFactionA, type GearFactionA } from '@engine/render/gearFactionA';
import { CAMO_B_PALETTE } from '@engine/render/camo';
import { findArmChain, solveTwoBone, type ArmChain } from '@engine/render/armIk';
import { FootPlanter, type GroundFn } from '@engine/render/footIk';
import { poseToMatrix, type WeaponAsset } from '@engine/render/weaponModel';

/** DV-070: deterministic per-actor variation (mulberry32 on the actor seed; no Math.random) */
export function lookVariant(seed: number): { skinTone: number; fabricGain: number; height: number; head: number; bareHead: number; tiltX: number; tiltZ: number } {
  let a = seed >>> 0 || 0x9e3779b9;
  const r = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { skinTone: 0.12 + r() * 0.62, fabricGain: 0.9 + r() * 0.16, height: 1 + (r() - 0.5) * 0.05, head: 1 + (r() - 0.5) * 0.06, bareHead: r(), tiltX: (r() - 0.5) * 0.09, tiltZ: (r() - 0.5) * 0.07 };
}

/** share of faction A soldiers without a helmet (real-head bodies only) */
export const BARE_HEAD_SHARE = 0.3;

/** procedural helmet fit on a real-head body (DV-069) */
export const REAL_HEAD_HELMET = { scale: 0.8, dy: 0.0 };

/** pole khuỷu trái trong hệ nhân vật (Mixamo nhìn +z): xuống, ra trái (+x của rig), hơi ra trước */
const POLE_L_CHAR = new Vector3(0.9, -1, 0.3);
const _ikM = new Matrix4();
const _ikOff = new Matrix4();
const _ikPole = new Vector3();
const _ikQ = new Quaternion();

/**
 * Motion input written by the owner (BotActor) before `setPose`. `speed`/`aiming` are the legacy minimum (Dummy);
 * glTF soldiers also use aim yaw, world velocity, crouch and aim pitch (DV-066) when present.
 */
export interface ActorMotion {
  speed: number;
  aiming: boolean;
  /** world yaw the actor looks/aims at (Bot.yaw convention) */
  yaw?: number;
  /** world velocity (m/s) */
  vx?: number;
  vz?: number;
  crouch?: boolean;
  /** aim pitch, + = up (rad) */
  pitch?: number;
}

/** Where a hit came from (world position of the shooter) and the zone, to pick hit/death variants. */
export interface HitInfo {
  from?: readonly [number, number, number];
  zone?: string;
}

export interface ActorVisual {
  readonly group: Group;
  /** SkinnedMesh chính (test/debug) */
  readonly mesh: SkinnedMesh;
  readonly hitZones: HitZones;
  /** bone chuẩn cho test/hit (spine bắt buộc) */
  readonly bones: { spine: Object3D; head: Object3D; hips: Object3D };
  health: number;
  alive: boolean;
  motion: ActorMotion;
  setPose(t: number): void;
  applyDamage(amount: number, hit?: HitInfo): boolean;
  reset(): void;
  onFire(): void;
  onReload(): void;
  /** vị trí đầu nòng súng (world) nếu có súng → true; FX địch (TIP-014) */
  muzzleWorld(out: Vector3): boolean;
  /** true nếu là nhân vật glTF (không phải procedural) */
  readonly kind: 'procedural' | 'gltf';
  /** DV-070: terrain height under a point (feet planted on slopes); null = flat ground */
  ground?: GroundFn | null;
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
  /** trang bị procedural theo thời kỳ (TIP-D11a) — null nếu opts.gear không đặt */
  readonly gear: Gear1971 | GearUS1971 | GearFactionA | null;
  /** chuỗi IK tay trái (TIP-017) — null nếu không có súng glTF hoặc thiếu bone */
  readonly armL: ArmChain | null;
  /** khoảng cách còn lại cổ tay trái ↔ đích IK (m) — debug/calib */
  ikErrorL = 0;
  /** tắt IK tay trái (calib đo pose animation gốc) */
  ikEnabled = true;
  /** DV-070 look variation applied (null = none) */
  readonly variant: ReturnType<typeof lookVariant> | null;
  /** DV-070 terrain under the feet (set by the owner when the level has a heightfield) */
  ground: GroundFn | null = null;
  /** DV-070 foot planting on slopes */
  readonly feet: FootPlanter;
  private readonly muzzle: Object3D | null;
  health = 100;
  alive = true;
  motion: ActorMotion = { speed: 0, aiming: false };
  private lastT = 0;

  constructor(asset: CharacterAsset, opts: DummyOptions = {}, weapon: WeaponAsset | null = null) {
    const v = opts.seed !== undefined && asset.profile === 'ref' ? lookVariant(opts.seed) : null;
    this.variant = v;
    this.char = new CharacterInstance(asset, { tint: opts.color, visor: opts.visor, skin: opts.skin, variant: v ? { skinTone: v.skinTone, fabricGain: v.fabricGain } : undefined });
    if (v) this.char.model.scale.multiplyScalar(v.height);
    this.feet = new FootPlanter(this.char.model, this.char.root);
    // Mixamo rig nhìn về +z; hệ actor (Dummy, bot.yaw) quy ước mặt trước là −z → xoay 180°
    this.char.root.rotation.y = Math.PI;
    this.group.add(this.char.root);
    // the locomotion controller owns the visual body yaw (legs lag the aim, turn in place; DV-066)
    this.char.yawTarget = this.group;
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
    // DV-069: a body with a real head (profile 'ref') has its own webbing/belt pouches and a human-size skull
    const realHead = asset.profile === 'ref';
    const gb = { head: b.head, chest: findChestBone(this.char.model), hips: b.hips };
    this.gear =
      opts.gear === 'pavn1971'
        ? attachGear1971(gb, { rig: !realHead })
        : opts.gear === 'us1971'
          ? attachGearUS1971(gb, { belt: !realHead, suspenders: !realHead })
          : opts.gear === 'faction_a'
            ? attachGearFactionA(gb, { helmet: asset.props?.helmetA ?? null, realHead })
            : opts.gear === 'faction_b'
              ? attachGearUS1971(gb, { palette: CAMO_B_PALETTE, belt: !realHead, suspenders: !realHead })
              : null;
    if (realHead && this.gear?.helmet && opts.gear !== 'faction_a') {
      // procedural helmets were sized for the Swat skull (~1.35× a real head)
      this.gear.helmet.scale.multiplyScalar(REAL_HEAD_HELMET.scale);
      this.gear.helmet.position.y += REAL_HEAD_HELMET.dy;
    }
    if (v) {
      // head size (the bone is not scale-animated), helmet worn at a slightly different angle, some faction A bareheaded
      const headBone = this.char.model.getObjectByName('mixamorigHead');
      headBone?.scale.setScalar(v.head);
      const helmet = this.gear?.helmet;
      if (helmet) {
        helmet.rotation.x += v.tiltX;
        helmet.rotation.z += v.tiltZ;
        if (opts.gear === 'faction_a' && v.bareHead < BARE_HEAD_SHARE) helmet.visible = false;
      }
    }
    // DV-081: che sáng theo tán, viền nắng ngược sáng, ướt theo trời (người + mũ + túi + súng)
    applyEnvShading(this.group);
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
    if (this.alive) {
      const m = this.motion;
      // aim yaw: owner's value, else whatever the group was given (legacy owners set group.rotation.y)
      const aimYaw = m.yaw ?? this.group.rotation.y;
      let vx = m.vx;
      let vz = m.vz;
      if (vx === undefined || vz === undefined) {
        vx = -Math.sin(aimYaw) * m.speed;
        vz = -Math.cos(aimYaw) * m.speed;
      }
      this.char.drive(aimYaw, vx, vz, m.aiming, m.crouch ?? false, m.pitch ?? 0);
    }
    this.char.update(dt);
    if (this.alive && this.ground) {
      this.group.updateWorldMatrix(true, false);
      this.feet.update(dt, this.ground, this.group.position.y);
    }
    if (this.alive && this.ikEnabled) this.solveLeftHand();
  }

  /** Áp lại pose animation hiện tại không IK (calib): mixer ghi lại bone rồi cập nhật matrixWorld. */
  applyRawPose(): void {
    this.char.rawPose();
    this.char.root.updateMatrixWorld(true);
  }

  /** side of the body the shot came from ('f' = front), from the shooter's world position */
  private hitDir(hit?: HitInfo): HitDir {
    if (!hit?.from) return 'f';
    const g = this.group.position;
    const yawTo = Math.atan2(-(hit.from[0] - g.x), -(hit.from[2] - g.z));
    let rel = yawTo - this.group.rotation.y;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    const a = Math.abs(rel);
    return a <= Math.PI / 4 ? 'f' : a >= (3 * Math.PI) / 4 ? 'b' : rel > 0 ? 'l' : 'r';
  }

  applyDamage(amount: number, hit?: HitInfo): boolean {
    if (!this.alive) return false;
    this.health = Math.max(0, this.health - amount);
    const dir = this.hitDir(hit);
    if (this.health === 0) {
      this.alive = false;
      this.feet.reset();
      if (!this.char.playOnce('death', { dir, head: hit?.zone === 'head' })) {
        // không có clip death → ngã bằng code như Dummy
        this.group.rotation.x = -Math.PI / 2;
        this.group.position.y += 0.25;
      }
      return true;
    }
    this.char.hitFlash();
    this.char.playOnce('hit', { dir });
    return false;
  }

  onFire(): void {
    if (this.alive) this.char.playOnce('fire');
  }

  onReload(): void {
    if (this.alive) this.char.playOnce('reload');
  }

  reset(): void {
    this.health = 100;
    this.alive = true;
    this.motion.speed = 0;
    this.motion.aiming = false;
    this.motion.vx = 0;
    this.motion.vz = 0;
    this.group.rotation.set(0, 0, 0);
    this.group.position.y = 0;
    this.lastT = 0;
    this.feet.reset();
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
