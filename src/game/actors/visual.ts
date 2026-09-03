/**
 * ActorVisual (TIP-012): giao diện chung cho hình đại diện actor — Dummy (procedural, fallback/CI) và SoldierVisual (glTF Mixamo).
 * Game/BotActor/MissionHost chỉ dùng giao diện này. hitZones tĩnh (DUMMY_HIT_ZONES) — physics không đổi.
 */
import { Group, Object3D, SkinnedMesh } from 'three/webgpu';
import { Dummy, DUMMY_HIT_ZONES, type HitZones, type DummyOptions } from './dummy';
import { CharacterInstance, type CharacterAsset } from '@engine/render/characters';
import { attachRifle } from '@engine/render/rifleProp';
import type { Mesh } from 'three/webgpu';

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
  /** súng gắn tay phải (Mixamo không kèm vũ khí) */
  readonly rifle: Mesh | null;
  health = 100;
  alive = true;
  motion = { speed: 0, aiming: false };
  private lastT = 0;

  constructor(asset: CharacterAsset, opts: DummyOptions = {}) {
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
    this.rifle = b.handR ? attachRifle(b.handR) : null;
  }

  setPose(t: number): void {
    const dt = this.lastT > 0 ? Math.min(0.1, Math.max(0, t - this.lastT)) : 0;
    this.lastT = t;
    if (this.alive) this.char.setLocomotion(this.motion.speed, this.motion.aiming);
    this.char.update(dt);
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
}

export function createActorVisual(character: CharacterAsset | null, opts: DummyOptions): ActorVisual {
  return character ? new SoldierVisual(character, opts) : new DummyVisual(opts);
}
