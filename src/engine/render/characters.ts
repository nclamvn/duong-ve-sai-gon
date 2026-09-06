/**
 * Character rig (TIP-012): glTF skinned mesh + AnimationClip (Mixamo → glb qua scripts/convert-mixamo.mjs).
 * Engine chỉ biết: template, clone (SkeletonUtils), mixer, crossfade theo tên clip chuẩn. Không biết AI/mission.
 * Kích thước chuẩn hoá về chiều cao mét (Mixamo cm hay m đều được).
 */
import { AnimationMixer, AnimationClip, Group, Object3D, SkinnedMesh, Box3, Vector3, LoopOnce, LoopRepeat, Mesh, Bone, type AnimationAction, MeshStandardNodeMaterial, Color } from 'three/webgpu';
import { createGltfLoader } from './loaders';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { tigerStripeColorNode, erdlColorNode } from './camo';

/** Trạng thái animation chuẩn của lính; mỗi trạng thái map tới danh sách tên clip ưu tiên (Mixamo, fallback three Soldier.glb). */
export type CharState = 'idle' | 'walk' | 'run' | 'aim' | 'fire' | 'reload' | 'hit' | 'death' | 'crouch_idle' | 'crouch_walk';

export const CLIP_ALIASES: Record<CharState, string[]> = {
  idle: ['rifle_idle', 'Rifle Idle', 'idle', 'Idle'],
  walk: ['rifle_walk', 'Rifle Walk', 'walk', 'Walk', 'Walking'],
  run: ['rifle_run', 'Rifle Run', 'run', 'Run', 'Running'],
  aim: ['rifle_aim', 'Rifle Aiming Idle', 'rifle_idle', 'Rifle Idle', 'idle', 'Idle'],
  fire: ['rifle_fire', 'Firing Rifle', 'rifle_aim', 'Rifle Aiming Idle'],
  reload: ['rifle_reload', 'Reloading', 'rifle_idle', 'Rifle Idle'],
  hit: ['hit', 'Hit Reaction'],
  death: ['death_front', 'Death From The Front', 'death', 'Death'],
  crouch_idle: ['crouch_idle', 'Crouch Idle', 'rifle_idle', 'Rifle Idle'],
  crouch_walk: ['crouch_walk', 'Walk Crouching', 'rifle_walk', 'Rifle Walk'],
};

/** Bone chuẩn → tên Mixamo (có/không prefix "mixamorig:"/"mixamorig"). */
const BONE_ALIASES: Record<'hips' | 'spine' | 'head' | 'neck' | 'handR', string[]> = {
  hips: ['mixamorig:Hips', 'mixamorigHips', 'Hips', 'hips'],
  spine: ['mixamorig:Spine1', 'mixamorigSpine1', 'mixamorig:Spine', 'mixamorigSpine', 'Spine1', 'Spine', 'spine'],
  head: ['mixamorig:Head', 'mixamorigHead', 'Head', 'head'],
  neck: ['mixamorig:Neck', 'mixamorigNeck', 'Neck', 'neck'],
  handR: ['mixamorig:RightHand', 'mixamorigRightHand', 'RightHand'],
};

export interface CharacterAsset {
  template: Group;
  clips: AnimationClip[];
  /** chiều cao gốc (đơn vị file) → scale để đạt targetHeight */
  scale: number;
  triangles: number;
  hasClip(state: CharState): boolean;
}

export async function loadCharacter(url: string, targetHeight = 1.82): Promise<CharacterAsset> {
  const loader = createGltfLoader();
  const gltf = await loader.loadAsync(url);
  const template = gltf.scene;
  template.updateMatrixWorld(true);
  const box = new Box3().setFromObject(template);
  const size = new Vector3();
  box.getSize(size);
  const scale = size.y > 1e-4 ? targetHeight / size.y : 1;
  let triangles = 0;
  template.traverse((o: Object3D) => {
    const m = o as Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = true;
      const idx = m.geometry.index;
      triangles += (idx ? idx.count : m.geometry.attributes['position']!.count) / 3;
    }
  });
  const clips = gltf.animations;
  const names = new Set(clips.map((c) => c.name));
  return {
    template,
    clips,
    scale,
    triangles: Math.round(triangles),
    hasClip: (state) => CLIP_ALIASES[state].some((n) => names.has(n)),
  };
}

export interface CharacterInstanceOptions {
  /** màu phe: nhân emissive nhẹ lên material tên chứa "visor"/"light", tint nhẹ body */
  tint?: number;
  visor?: number;
  /** 'recon' = rằn ri hổ thay vải QGP trong shader (TIP-M1A) */
  skin?: 'recon' | 'erdl';
}

/**
 * Một nhân vật trong scene: clone skeleton riêng, mixer riêng, crossfade giữa state.
 * `update(dt)` gọi ở render tier. `bones` chuẩn để hit zone/test (spine/head/hips).
 */
export class CharacterInstance {
  readonly root = new Group();
  readonly model: Object3D;
  readonly mixer: AnimationMixer;
  readonly skinned: SkinnedMesh[] = [];
  readonly bones: { hips: Object3D | null; spine: Object3D | null; head: Object3D | null; neck: Object3D | null; handR: Object3D | null };
  private readonly actions = new Map<CharState, AnimationAction>();
  private current: CharState | null = null;
  private oneShot: CharState | null = null;
  private readonly materials: MeshStandardNodeMaterial[] = [];
  private readonly baseEmissive: Color[] = [];
  private flashUntil = 0;
  private timeNow = 0;

  constructor(readonly asset: CharacterAsset, opts: CharacterInstanceOptions = {}) {
    this.model = skeletonClone(asset.template);
    this.model.scale.setScalar(asset.scale);
    this.root.add(this.model);
    this.mixer = new AnimationMixer(this.model);
    this.model.traverse((o: Object3D) => {
      const m = o as SkinnedMesh;
      if ((m as SkinnedMesh).isSkinnedMesh) this.skinned.push(m);
      const mesh = o as Mesh;
      if (mesh.isMesh) {
        // material clone/instance: tint phe không lan sang instance khác
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const cloned = mats.map((mat) => {
          const c = (mat as MeshStandardNodeMaterial).clone() as MeshStandardNodeMaterial;
          const isVisor = /visor|light|lamp|glow/i.test(c.name ?? '') || /visor|light|lamp|glow/i.test(mesh.name);
          if (isVisor && opts.visor !== undefined) {
            c.emissive = new Color(opts.visor);
            c.emissiveIntensity = 2.5;
          } else if (opts.tint !== undefined && c.color) {
            c.color.lerp(new Color(opts.tint), 0.25);
          }
          if (opts.skin === 'recon' && c.map) c.colorNode = tigerStripeColorNode(c.map);
          else if (opts.skin === 'erdl' && c.map) c.colorNode = erdlColorNode(c.map);
          this.materials.push(c);
          this.baseEmissive.push(c.emissive ? c.emissive.clone() : new Color(0));
          return c;
        });
        mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]!;
      }
    });
    const find = (names: string[]): Object3D | null => {
      for (const n of names) {
        const o = this.model.getObjectByName(n);
        if (o) return o;
      }
      return null;
    };
    this.bones = { hips: find(BONE_ALIASES.hips), spine: find(BONE_ALIASES.spine), head: find(BONE_ALIASES.head), neck: find(BONE_ALIASES.neck), handR: find(BONE_ALIASES.handR) };
    for (const state of Object.keys(CLIP_ALIASES) as CharState[]) {
      const clip = this.pickClip(state);
      if (!clip) continue;
      const a = this.mixer.clipAction(clip);
      if (state === 'death' || state === 'fire' || state === 'hit' || state === 'reload') {
        a.setLoop(LoopOnce, 1);
        a.clampWhenFinished = true;
      } else a.setLoop(LoopRepeat, Infinity);
      this.actions.set(state, a);
    }
    this.mixer.addEventListener('finished', (e) => {
      const ev = e as unknown as { action: AnimationAction };
      if (this.oneShot && ev.action === this.actions.get(this.oneShot)) {
        const done = this.oneShot;
        this.oneShot = null;
        if (done !== 'death') {
          // clip kết thúc bị clamp frame cuối với weight 1 → phải mờ đi, nếu không nó trộn 50/50 mãi với nền (và với death sau này)
          ev.action.fadeOut(0.15);
          this.play(this.current ?? 'idle', 0.15, true);
        }
      }
    });
    this.play('idle', 0);
  }

  private pickClip(state: CharState): AnimationClip | null {
    for (const n of CLIP_ALIASES[state]) {
      const c = this.asset.clips.find((k) => k.name === n);
      if (c) return c;
    }
    return null;
  }

  has(state: CharState): boolean {
    return this.actions.has(state);
  }

  /** Chuyển trạng thái lặp (idle/walk/run/aim/crouch_*) với crossfade; không làm gì nếu đang cùng state. */
  play(state: CharState, fade = 0.2, force = false): void {
    const next = this.actions.get(state) ?? this.actions.get('idle');
    if (!next) return;
    const prevState = this.current;
    if (!force && prevState === state) return;
    const prev = prevState ? this.actions.get(prevState) : undefined;
    this.current = state;
    if (this.oneShot && this.oneShot !== 'death') return; // one-shot đang chạy → đổi nền sau khi xong
    next.enabled = true;
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fade).play();
    if (prev && prev !== next) prev.fadeOut(fade);
  }

  /** Clip chạy một lần (fire/reload/hit/death) đè lên nền rồi tự trả về. */
  playOnce(state: CharState, fade = 0.08): boolean {
    const a = this.actions.get(state);
    if (!a) return false;
    if (this.oneShot === 'death') return false;
    const base = this.current ? this.actions.get(this.current) : undefined;
    // one-shot đang chạy (hit/fire/reload) phải mờ đi — trước đây giữ nguyên weight 1 + clamp frame cuối → chết mà đứng nghiêng
    // (Chủ nhà Mac 2026-09-06): pose = trộn hit-reaction đứng với death
    const prevShot = this.oneShot ? this.actions.get(this.oneShot) : undefined;
    this.oneShot = state;
    a.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (base && base !== a) base.fadeOut(fade);
    if (prevShot && prevShot !== a) prevShot.fadeOut(fade);
    if (state === 'death') {
      // chết: mọi action khác (kể cả one-shot đã xong nhưng còn clamp/paused với weight 1) về 0 sau fade → frame cuối chỉ còn death
      for (const [st, act] of this.actions) if (st !== 'death' && act.isScheduled()) act.fadeOut(fade);
    }
    return true;
  }

  isDead(): boolean {
    return this.oneShot === 'death';
  }

  /** speed m/s + aiming → state nền */
  setLocomotion(speed: number, aiming: boolean, crouch = false): void {
    let s: CharState;
    if (crouch) s = speed > 0.3 ? 'crouch_walk' : 'crouch_idle';
    else if (speed > 3.6) s = 'run';
    else if (speed > 0.3) s = 'walk';
    else s = aiming ? 'aim' : 'idle';
    this.play(s);
  }

  hitFlash(seconds = 0.08): void {
    this.flashUntil = this.timeNow + seconds;
    for (let i = 0; i < this.materials.length; i++) {
      const m = this.materials[i]!;
      if (m.emissive) m.emissive.setRGB(0.9, 0.25, 0.15);
    }
  }

  update(dt: number): void {
    this.timeNow += dt;
    this.mixer.update(dt);
    if (this.flashUntil > 0 && this.timeNow >= this.flashUntil) {
      this.flashUntil = 0;
      for (let i = 0; i < this.materials.length; i++) this.materials[i]!.emissive?.copy(this.baseEmissive[i]!);
    }
  }

  reset(): void {
    this.oneShot = null;
    this.current = null;
    this.mixer.stopAllAction();
    this.flashUntil = 0;
    for (let i = 0; i < this.materials.length; i++) this.materials[i]!.emissive?.copy(this.baseEmissive[i]!);
    this.play('idle', 0);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    for (const m of this.materials) m.dispose();
  }
}

export function isBone(o: Object3D): o is Bone {
  return (o as Bone).isBone === true;
}
