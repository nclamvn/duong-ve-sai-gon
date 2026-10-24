/**
 * Character rig (TIP-012, motion system DV-066): glTF skinned mesh + AnimationClip (Mixamo → glb via scripts/convert-mixamo.mjs).
 * Engine only knows: template, clone (SkeletonUtils), mixer, a locomotion controller and standard clip names. No AI/mission.
 * Size normalized to metres (Mixamo cm or m both fine).
 *
 * Motion (DV-066): every clip is split into an upper body (Spine and below it) and a lower body (Hips + legs) sub-clip.
 *   lower = stand pose | directional gait blend (phase-synced, speed-matched) | turn in place
 *   upper = same base, then the aim pose and one-shots (fire / reload / hit) on top, legs keep walking
 *   full  = death (direction variants)
 * Weights are set by code each frame and always sum to 1 per layer (never leaks the bind pose); clip times are driven by
 * code (timeScale 0). After the mixer, the spine chain twists/pitches toward the aim so the rifle points at the target.
 */
import { AnimationMixer, AnimationClip, Group, Object3D, SkinnedMesh, Box3, Vector3, LoopRepeat, Mesh, Bone, DoubleSide, Quaternion, type AnimationAction, MeshStandardNodeMaterial, type MeshStandardMaterial, Color, type Node } from 'three/webgpu';
import { createGltfLoader } from './loaders';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { tigerStripeColorNode, erdlColorNode, camoGreyFabricNode, recolorGreyFabricNode, skinToneNode, CAMO_B_PALETTE, ERDL_PALETTE } from './camo';
import { texture as tslTexture, uv as tslUv, materialReference } from 'three/tsl';
import { LocomotionController, type LocoClipInfo, type LocoConfig, type TurnClipInfo, type LocoInput } from './locomotion';
import { analysisRig, analyzeLocoClip, analyzeTurnClip, findByNames, NOMINAL_SPEED, parseLocoName, splitUpperLower, upperBodyNames, type SplitClip } from './clipAnalysis';

/** Standard animation states of a soldier; each maps to a priority list of clip names (Mixamo stems, three Soldier.glb fallback). */
export type CharState = 'idle' | 'walk' | 'run' | 'aim' | 'fire' | 'reload' | 'hit' | 'death' | 'crouch_idle' | 'crouch_walk';

export const CLIP_ALIASES: Record<CharState, string[]> = {
  idle: ['rifle_idle', 'Rifle Idle', 'idle', 'Idle'],
  walk: ['walk_f', 'rifle_walk', 'Rifle Walk', 'walk', 'Walk', 'Walking'],
  run: ['run_f', 'rifle_run', 'Rifle Run', 'run', 'Run', 'Running'],
  aim: ['rifle_aim', 'Rifle Aiming Idle', 'rifle_idle', 'Rifle Idle', 'idle', 'Idle'],
  fire: ['rifle_fire', 'Firing Rifle', 'rifle_aim', 'Rifle Aiming Idle'],
  reload: ['rifle_reload', 'Reloading', 'rifle_idle', 'Rifle Idle'],
  hit: ['hit', 'hit_f', 'Hit Reaction'],
  death: ['death_front', 'death_f', 'Death From The Front', 'death', 'Death'],
  crouch_idle: ['crouch_idle', 'Crouch Idle'],
  crouch_walk: ['crouch_walk_f', 'crouch_walk', 'Walk Crouching'],
};

/** Standard bone → Mixamo names (with/without "mixamorig:" prefix). */
const BONE_ALIASES: Record<'hips' | 'spine' | 'head' | 'neck' | 'handR', string[]> = {
  // "_ref" frames (DV-069, bodies built by scripts/build-character-pz.mjs) reproduce the Swat bone frame: offsets calibrated
  // on the Swat rig (weapon grips, gear) keep working on a different skeleton
  hips: ['mixamorigHips_ref', 'mixamorig:Hips', 'mixamorigHips', 'Hips', 'hips'],
  spine: ['mixamorig:Spine1', 'mixamorigSpine1', 'mixamorig:Spine', 'mixamorigSpine', 'Spine1', 'Spine', 'spine'],
  head: ['mixamorigHead_ref', 'mixamorig:Head', 'mixamorigHead', 'Head', 'head'],
  neck: ['mixamorig:Neck', 'mixamorigNeck', 'Neck', 'neck'],
  handR: ['mixamorigRightHand_ref', 'mixamorig:RightHand', 'mixamorigRightHand', 'RightHand'],
};

/** Body profile: 'swat' = retextured Swat (olive fabric, oversized skull), 'ref' = body with _ref frames and grey fabric (DV-069). */
export type BodyProfile = 'swat' | 'ref';
/** faction A olive for grey fabric (linear) */
const OLIVE_FABRIC: [number, number, number] = [0.083, 0.098, 0.047];

/** Spine chain for the aim offset (root → chest) and the share of the rotation each bone takes. */
const AIM_CHAIN: Array<{ names: string[]; share: number }> = [
  { names: ['mixamorigSpine', 'mixamorig:Spine', 'Spine'], share: 0.3 },
  { names: ['mixamorigSpine1', 'mixamorig:Spine1', 'Spine1'], share: 0.3 },
  { names: ['mixamorigSpine2', 'mixamorig:Spine2', 'Spine2'], share: 0.4 },
];

/** Side the shot came from, relative to the body ('f' = from the front). */
export type HitDir = 'f' | 'b' | 'l' | 'r';
export type OneShot = 'fire' | 'reload' | 'hit' | 'death';

interface OverlayClip {
  name: string;
  kind: 'fire' | 'reload' | 'hit';
  dir: HitDir | null;
  upper: AnimationClip;
}
interface DeathClip {
  name: string;
  dir: HitDir | 'head' | null;
  clip: AnimationClip;
}

/** Per-asset motion data, analyzed once at load (DV-066). */
export interface MotionLibrary {
  stand: { idle: SplitClip | null; aim: SplitClip | null; crouch_idle: SplitClip | null };
  loco: Array<{ name: string; info: LocoClipInfo; split: SplitClip; measured: boolean; rootMotion: boolean }>;
  turns: Array<{ name: string; info: TurnClipInfo; split: SplitClip }>;
  overlays: OverlayClip[];
  deaths: DeathClip[];
}

export interface CharacterAsset {
  template: Group;
  clips: AnimationClip[];
  /** source height (file units) → scale to reach targetHeight */
  scale: number;
  triangles: number;
  hasClip(state: CharState): boolean;
  motion: MotionLibrary;
  /** optional head/body props loaded next to the character (DV-068: `helmetA`), cloned per instance by the gear code */
  props: { helmetA?: Object3D };
  profile: BodyProfile;
}

const firstClip = (clips: AnimationClip[], names: string[]): AnimationClip | null => {
  for (const n of names) {
    const c = clips.find((k) => k.name === n);
    if (c) return c;
  }
  return null;
};

const DIR_OF: Record<string, HitDir | 'head'> = { front: 'f', f: 'f', back: 'b', b: 'b', left: 'l', l: 'l', right: 'r', r: 'r', head: 'head' };

/** Build the motion library from a template + clips (exported for tests). Root-motion and turn clips are modified in place. */
export function buildMotionLibrary(template: Object3D, clips: AnimationClip[], scale: number): MotionLibrary {
  const upper = upperBodyNames(template);
  const split = (c: AnimationClip | null): SplitClip | null => (c ? splitUpperLower(c, upper) : null);
  const lib: MotionLibrary = {
    stand: {
      idle: split(firstClip(clips, ['rifle_idle', 'Rifle Idle', 'idle', 'Idle'])),
      aim: split(firstClip(clips, ['rifle_aim', 'Rifle Aiming Idle'])),
      crouch_idle: split(firstClip(clips, ['crouch_idle', 'Crouch Idle'])),
    },
    loco: [],
    turns: [],
    overlays: [],
    deaths: [],
  };
  let rig: Object3D | null = null;
  const names = new Set(clips.map((c) => c.name));
  for (const c of clips) {
    const parsed = parseLocoName(c.name);
    if (parsed) {
      // a legacy name (rifle_walk) is skipped when the 8-direction set provides the same forward clip
      if ((c.name === 'rifle_walk' && names.has('walk_f')) || (c.name === 'rifle_run' && names.has('run_f')) || (c.name === 'crouch_walk' && names.has('crouch_walk_f'))) continue;
      rig ??= analysisRig(template);
      const a = analyzeLocoClip(rig, c, scale, { speed: NOMINAL_SPEED[parsed.gait], angle: parsed.angle });
      // a measured direction far from the name is a mislabeled file (e.g. mirrored strafe): trust the measurement
      lib.loco.push({ name: c.name, info: { gait: parsed.gait, angle: a.angle, speed: a.speed, duration: a.duration, phaseOffset: a.phaseOffset }, split: splitUpperLower(c, upper), measured: a.measured, rootMotion: a.rootMotion });
      continue;
    }
    if (/^turn_(l|r|left|right)$/.test(c.name)) {
      const t = analyzeTurnClip(template, c);
      if (t) lib.turns.push({ name: c.name, info: t, split: splitUpperLower(c, upper) });
      continue;
    }
    if (c.name === 'rifle_fire' || c.name === 'fire') lib.overlays.push({ name: c.name, kind: 'fire', dir: null, upper: splitUpperLower(c, upper).upper });
    else if (c.name === 'rifle_reload' || c.name === 'reload') lib.overlays.push({ name: c.name, kind: 'reload', dir: null, upper: splitUpperLower(c, upper).upper });
    else {
      const h = /^hit(?:_(f|b|l|r|front|back|left|right))?\d*$/.exec(c.name);
      if (h) {
        lib.overlays.push({ name: c.name, kind: 'hit', dir: h[1] ? (DIR_OF[h[1]] as HitDir) : null, upper: splitUpperLower(c, upper).upper });
        continue;
      }
      const d = /^death(?:_(f|b|l|r|front|back|left|right|head))?\d*$/.exec(c.name);
      if (d) lib.deaths.push({ name: c.name, dir: d[1] ? DIR_OF[d[1]]! : null, clip: c });
    }
  }
  return lib;
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
    motion: buildMotionLibrary(template, clips, scale),
    props: {},
    profile: template.getObjectByName('mixamorigHead_ref') ? 'ref' : 'swat',
  };
}

export interface CharacterInstanceOptions {
  /** faction colour: emissive on materials named "visor"/"light", light tint on the body */
  tint?: number;
  visor?: number;
  /** 'recon' = tiger stripe instead of plain fabric in the shader (TIP-M1A) */
  skin?: 'recon' | 'erdl' | 'camo_b' | 'olive';
  /** locomotion tuning overrides */
  loco?: Partial<LocoConfig>;
  /** DV-070 per-actor look variation on 'ref' bodies: skin tone 0..1, fabric brightness gain (~0.88..1.08) */
  variant?: { skinTone: number; fabricGain: number };
}

interface Pair {
  lower: AnimationAction;
  upper: AnimationAction;
  duration: number;
}
interface Shot {
  idx: number;
  t: number;
  w: number;
  dur: number;
  fin: number;
  fout: number;
  peak: number;
  ending: boolean;
}

const UP = new Vector3(0, 1, 0);
const _rq = new Quaternion();
const _pq = new Quaternion();
const _pqi = new Quaternion();
const _dq = new Quaternion();
const _yq = new Quaternion();
const _right = new Vector3();
const _axis = new Vector3();

/** deterministic variant pick (no Math.random): Knuth multiplicative hash of a counter */
const STD_PROPS = ['name', 'color', 'roughness', 'metalness', 'map', 'lightMap', 'lightMapIntensity', 'aoMap', 'aoMapIntensity', 'emissive', 'emissiveIntensity', 'emissiveMap', 'bumpMap', 'bumpScale', 'normalMap', 'normalMapType', 'normalScale', 'roughnessMap', 'metalnessMap', 'alphaMap', 'envMap', 'envMapIntensity', 'flatShading', 'side', 'transparent', 'opacity', 'alphaTest', 'vertexColors', 'depthWrite'] as const;

/** Copy of a (classic or node) standard material as a MeshStandardNodeMaterial. */
export function toStandardNodeMaterial(src: MeshStandardMaterial): MeshStandardNodeMaterial {
  if ((src as unknown as { isNodeMaterial?: boolean }).isNodeMaterial) return (src as unknown as MeshStandardNodeMaterial).clone() as MeshStandardNodeMaterial;
  const m = new MeshStandardNodeMaterial();
  const from = src as unknown as Record<string, unknown>;
  const to = m as unknown as Record<string, unknown>;
  for (const k of STD_PROPS) {
    const v = from[k];
    if (v === undefined) continue;
    const cur = to[k] as { copy?: (x: unknown) => unknown } | undefined;
    if (cur && typeof cur === 'object' && typeof cur.copy === 'function' && v && typeof v === 'object' && !(v as { isTexture?: boolean }).isTexture) cur.copy(v);
    else to[k] = v;
  }
  return m;
}

const pickVariant = (n: number, counter: number): number => (n <= 1 ? 0 : ((Math.imul(counter + 1, 2654435761) >>> 0) % n));

/**
 * DV-091 anti-hitch: three's node cache key includes each node's id, so two soldiers with separately built (even identical)
 * colour graphs compile two shader programs; a soldier entering view mid-fight then stalls the frame while it compiles.
 * Colour graphs are built once per key and shared by every instance (variation goes through material properties).
 */
const colorNodeCache = new Map<string, Node<'vec3'> | null>();
function sharedColorNode(key: string, build: () => Node<'vec3'> | null): Node<'vec3'> | null {
  if (!colorNodeCache.has(key)) colorNodeCache.set(key, build());
  return colorNodeCache.get(key) ?? null;
}
/** number of distinct shared colour graphs (tests) */
export function sharedColorNodeCount(): number {
  return colorNodeCache.size;
}

/**
 * One character in the scene: own skeleton clone, own mixer, a LocomotionController, layered weights (DV-066).
 * Call `drive()` with the aim/velocity each frame, then `update(dt)` at render tier.
 */
export class CharacterInstance {
  readonly root = new Group();
  readonly model: Object3D;
  readonly mixer: AnimationMixer;
  readonly skinned: SkinnedMesh[] = [];
  readonly bones: { hips: Object3D | null; spine: Object3D | null; head: Object3D | null; neck: Object3D | null; handR: Object3D | null };
  readonly controller: LocomotionController;
  /** object whose rotation.y receives the visual body yaw (the actor group); null = not applied */
  yawTarget: Object3D | null = null;
  /** aim offset on/off (calibration measures raw clip poses) */
  aimOffset = true;
  private readonly materials: MeshStandardNodeMaterial[] = [];
  private readonly baseEmissive: Color[] = [];
  private readonly stand: { idle: Pair | null; aim: Pair | null; crouch_idle: Pair | null };
  private readonly loco: Pair[] = [];
  private readonly turns: Pair[] = [];
  private readonly overlays: Array<{ action: AnimationAction; def: OverlayClip }> = [];
  private readonly deaths: Array<{ action: AnimationAction; def: DeathClip }> = [];
  private readonly aimBones: Array<{ bone: Object3D; share: number; saved: Quaternion }> = [];
  private aimApplied = false;
  private readonly input: LocoInput = { aimYaw: 0, vx: 0, vz: 0, aiming: false, crouch: false, aimPitch: 0 };
  private shots: Shot[] = [];
  private deathIdx = -1;
  private deathT = 0;
  private deathW = 0;
  private standT = 0;
  private hitCounter = 0;
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
        // material clone/instance: faction tint does not leak to other instances
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const cloned = mats.map((mat) => {
          // GLTFLoader gives classic MeshStandardMaterial; a colorNode on it is not guaranteed to survive the renderer's
          // automatic node conversion (DV-069: the grey-fabric dye was silently dropped) → build a real node material
          const c = toStandardNodeMaterial(mat as MeshStandardMaterial);
          // double sided: Mixamo body/cloth are open shells (wrists, collar, armour gaps); FrontSide culls the inside → see-through
          // (owner Mac 2026-09-08). Few characters so the fragment cost is negligible.
          c.side = DoubleSide;
          const isVisor = /visor|light|lamp|glow/i.test(c.name ?? '') || /visor|light|lamp|glow/i.test(mesh.name);
          if (isVisor && opts.visor !== undefined) {
            c.emissive = new Color(opts.visor);
            c.emissiveIntensity = 2.5;
          } else if (opts.tint !== undefined && c.color) {
            c.color.lerp(new Color(opts.tint), 0.25);
          }
          if (asset.profile === 'ref' && c.map && c.name === 'Body') {
            // grey-green field fabric: dye/print by a low-saturation mask (skin, leather, boots keep their colours)
            // DV-091: the per-soldier variation lives in material properties read by materialReference → the node graph is
            // built once per (texture, skin) and shared, so every soldier of a look uses one shader program
            const map = c.map;
            const ud = c as unknown as { dvGain: number; dvTone: number };
            ud.dvGain = opts.variant?.fabricGain ?? 1;
            ud.dvTone = opts.variant?.skinTone ?? 0.35;
            c.colorNode = sharedColorNode(`${map.uuid}|${opts.skin ?? '-'}|${opts.variant ? 'v' : '-'}`, () => {
              const g = materialReference('dvGain', 'float') as unknown as Node<'float'>;
              let n: ReturnType<typeof skinToneNode> | null = null;
              if (opts.skin === 'camo_b') n = camoGreyFabricNode(map, CAMO_B_PALETTE, 0.125, g);
              else if (opts.skin === 'erdl' || opts.skin === 'recon') n = camoGreyFabricNode(map, ERDL_PALETTE, 0.125, g);
              else if (opts.skin === 'olive') n = recolorGreyFabricNode(map, OLIVE_FABRIC, 0.125, g);
              if (opts.variant) n = skinToneNode(n ?? (tslTexture(map, tslUv()).rgb as unknown as ReturnType<typeof skinToneNode>), map, materialReference('dvTone', 'float') as unknown as Node<'float'>);
              return n;
            });
          } else if (asset.profile === 'ref') {
            /* belt pouches, helmet props: keep their own colours */
          } else if (opts.skin === 'recon' && c.map) c.colorNode = sharedColorNode(`${c.map.uuid}|tiger`, () => tigerStripeColorNode(c.map!));
          else if (opts.skin === 'erdl' && c.map) c.colorNode = sharedColorNode(`${c.map.uuid}|erdl`, () => erdlColorNode(c.map!));
          else if (opts.skin === 'camo_b' && c.map) c.colorNode = sharedColorNode(`${c.map.uuid}|camo_b`, () => erdlColorNode(c.map!, CAMO_B_PALETTE));
          this.materials.push(c);
          this.baseEmissive.push(c.emissive ? c.emissive.clone() : new Color(0));
          return c;
        });
        mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]!;
      }
    });
    const find = (names: string[]): Object3D | null => findByNames(this.model, names);
    this.bones = { hips: find(BONE_ALIASES.hips), spine: find(BONE_ALIASES.spine), head: find(BONE_ALIASES.head), neck: find(BONE_ALIASES.neck), handR: find(BONE_ALIASES.handR) };
    for (const c of AIM_CHAIN) {
      const b = find(c.names);
      if (b) this.aimBones.push({ bone: b, share: c.share, saved: new Quaternion() });
    }
    const sum = this.aimBones.reduce((s, b) => s + b.share, 0) || 1;
    for (const b of this.aimBones) b.share /= sum;

    const lib = asset.motion;
    const mk = (clip: AnimationClip): AnimationAction => {
      const a = this.mixer.clipAction(clip);
      a.setLoop(LoopRepeat, Infinity);
      a.timeScale = 0; // time driven by code
      a.weight = 0;
      a.enabled = true;
      a.play();
      return a;
    };
    const pair = (s: SplitClip | null): Pair | null => (s ? { lower: mk(s.lower), upper: mk(s.upper), duration: s.lower.duration } : null);
    this.stand = { idle: pair(lib.stand.idle), aim: pair(lib.stand.aim), crouch_idle: pair(lib.stand.crouch_idle) };
    for (const l of lib.loco) this.loco.push(pair(l.split)!);
    for (const t of lib.turns) this.turns.push(pair(t.split)!);
    for (const o of lib.overlays) this.overlays.push({ action: mk(o.upper), def: o });
    for (const d of lib.deaths) this.deaths.push({ action: mk(d.clip), def: d });
    this.controller = new LocomotionController(
      lib.loco.map((l) => l.info),
      lib.turns.map((t) => t.info),
      opts.loco,
    );
    this.applyWeights();
    this.mixer.update(0);
  }

  has(state: CharState): boolean {
    switch (state) {
      case 'idle':
        return !!this.stand.idle;
      case 'aim':
        return !!this.stand.aim;
      case 'crouch_idle':
        return !!this.stand.crouch_idle;
      case 'walk':
      case 'run':
      case 'crouch_walk':
        return this.controller.hasGait(state);
      case 'death':
        return this.deaths.length > 0;
      default:
        return this.overlays.some((o) => o.def.kind === state);
    }
  }

  /** Locomotion input for the next update (world yaw/velocity, see LocomotionController). */
  drive(aimYaw: number, vx: number, vz: number, aiming: boolean, crouch = false, aimPitch = 0): void {
    const i = this.input;
    i.aimYaw = aimYaw;
    i.vx = vx;
    i.vz = vz;
    i.aiming = aiming;
    i.crouch = crouch;
    i.aimPitch = aimPitch;
  }

  /** Legacy input: speed forward along the current aim yaw. */
  setLocomotion(speed: number, aiming: boolean, crouch = false): void {
    const y = this.input.aimYaw;
    this.drive(y, -Math.sin(y) * speed, -Math.cos(y) * speed, aiming, crouch, this.input.aimPitch);
  }

  /** visual body yaw (world) */
  get bodyYaw(): number {
    return this.controller.bodyYaw;
  }

  /**
   * One-shot: fire/reload/hit play on the upper body over the current locomotion; death takes the full body.
   * `dir` (side the shot came from) and `head` pick a variant; ties broken deterministically.
   */
  playOnce(state: OneShot, opts: { dir?: HitDir; head?: boolean } = {}): boolean {
    if (this.deathIdx >= 0) return false;
    if (state === 'death') {
      if (!this.deaths.length) return false;
      const want = opts.head ? 'head' : (opts.dir ?? 'f');
      let pool = this.deaths.filter((d) => d.def.dir === want);
      if (!pool.length && want === 'head') pool = this.deaths.filter((d) => d.def.dir === (opts.dir ?? 'f'));
      if (!pool.length) pool = this.deaths.filter((d) => d.def.dir === 'f' || d.def.dir === null);
      if (!pool.length) pool = this.deaths;
      const pick = pool[pickVariant(pool.length, this.hitCounter++)]!;
      this.deathIdx = this.deaths.indexOf(pick);
      this.deathT = 0;
      this.deathW = 0;
      return true;
    }
    let pool = this.overlays.filter((o) => o.def.kind === state);
    if (!pool.length) return false;
    if (state === 'hit') {
      const dirPool = pool.filter((o) => o.def.dir === (opts.dir ?? 'f'));
      if (dirPool.length) pool = dirPool;
      else {
        const generic = pool.filter((o) => o.def.dir === null || o.def.dir === 'f');
        if (generic.length) pool = generic;
      }
    }
    const pick = pool[state === 'hit' ? pickVariant(pool.length, this.hitCounter++) : 0]!;
    const idx = this.overlays.indexOf(pick);
    const clipDur = pick.action.getClip().duration;
    const spec =
      state === 'fire'
        ? { dur: clipDur, fin: 0.04, fout: Math.min(0.1, clipDur * 0.4), peak: 1 }
        : state === 'reload'
          ? { dur: clipDur, fin: 0.15, fout: 0.3, peak: 1 }
          : { dur: Math.min(0.7, clipDur), fin: 0.05, fout: 0.3, peak: 0.85 };
    for (const s of this.shots) if (s.idx !== idx) s.ending = true;
    const same = this.shots.find((s) => s.idx === idx);
    if (same) Object.assign(same, { t: 0, ending: false, ...spec });
    else this.shots.push({ idx, t: 0, w: 0, ending: false, ...spec });
    return true;
  }

  isDead(): boolean {
    return this.deathIdx >= 0;
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
    if (this.deathIdx < 0) {
      this.controller.update(dt, this.input);
      if (this.yawTarget) this.yawTarget.rotation.y = this.controller.bodyYaw;
    } else {
      this.deathT += dt;
      this.deathW = Math.min(1, this.deathW + dt / 0.12);
    }
    this.standT += dt;
    this.updateShots(dt);
    this.applyWeights();
    this.restoreAimBones();
    this.mixer.update(dt);
    if (this.aimOffset && this.deathW < 1) {
      const k = 1 - this.deathW;
      this.applyAimOffset(this.controller.twist * k, this.controller.pitch * k);
    }
    if (this.flashUntil > 0 && this.timeNow >= this.flashUntil) {
      this.flashUntil = 0;
      for (let i = 0; i < this.materials.length; i++) this.materials[i]!.emissive?.copy(this.baseEmissive[i]!);
    }
  }

  private updateShots(dt: number): void {
    for (const s of this.shots) {
      s.t += dt;
      if (s.ending) s.w = Math.max(0, s.w - dt / 0.1);
      else if (s.t >= s.dur - s.fout) s.w = Math.max(0, Math.min(s.w, (s.peak * (s.dur - s.t)) / s.fout));
      else s.w = Math.min(s.peak, s.w + (dt / s.fin) * s.peak);
    }
    this.shots = this.shots.filter((s) => s.w > 0 || (!s.ending && s.t < s.dur));
  }

  private applyWeights(): void {
    const C = this.controller;
    const D = this.deathW;
    const base = 1 - D;
    let O = 0;
    for (const s of this.shots) O += s.w;
    const oNorm = O > 1 ? 1 / O : 1;
    O = Math.min(1, O);
    const st = this.stand;
    const crouchPose = C.crouched && st.crouch_idle;
    // aim pose: needs the clip; otherwise the idle carries the aim weight
    const A = st.aim ? C.aimBlend : 0;
    const keepU = (1 - A) * (1 - O);
    // all pairs to zero, then add
    for (const p of [st.idle, st.aim, st.crouch_idle, ...this.loco, ...this.turns]) {
      if (!p) continue;
      p.lower.weight = 0;
      p.upper.weight = 0;
    }
    // ---- stand
    const sw = C.standW * base;
    const idleP = crouchPose ? st.crouch_idle : (st.idle ?? st.aim);
    if (idleP) {
      idleP.lower.weight += crouchPose ? sw : sw * (st.idle ? 1 - A : 1);
      idleP.upper.weight += sw * keepU;
      idleP.lower.time = this.standT % idleP.duration;
      idleP.upper.time = idleP.lower.time;
    }
    if (st.aim) {
      if (!crouchPose && st.idle) st.aim.lower.weight += sw * A;
      st.aim.upper.weight += A * (1 - O) * base;
      st.aim.lower.time = this.standT % st.aim.duration;
      st.aim.upper.time = st.aim.lower.time;
    }
    // ---- gait
    for (let i = 0; i < this.loco.length; i++) {
      const p = this.loco[i]!;
      const w = C.locoW[i]! * base;
      p.lower.weight += w;
      p.upper.weight += w * keepU;
      const t = C.clipPhase(i) * p.duration;
      p.lower.time = t;
      p.upper.time = t;
    }
    // ---- turn in place
    const turnPairs: Array<[number, number, number]> = [
      [C.turnIdx, C.turnT, C.turnActiveApplied],
      [C.turnOutIdx, C.turnOutT, C.turnOutApplied],
    ];
    for (const [ti, tt, tw] of turnPairs) {
      if (ti < 0 || tw <= 0) continue;
      const p = this.turns[ti]!;
      p.lower.weight += tw * base;
      p.upper.weight += tw * base * keepU;
      const t = Math.min(1, tt) * p.duration * 0.999;
      p.lower.time = t;
      p.upper.time = t;
    }
    // ---- one-shots (upper)
    for (const o of this.overlays) o.action.weight = 0;
    for (const s of this.shots) {
      const o = this.overlays[s.idx]!;
      o.action.weight += s.w * oNorm * base;
      o.action.time = Math.min(s.t, o.action.getClip().duration * 0.999);
    }
    // ---- death (full)
    for (let i = 0; i < this.deaths.length; i++) {
      const d = this.deaths[i]!;
      d.action.weight = i === this.deathIdx ? D : 0;
      if (i === this.deathIdx) d.action.time = Math.min(this.deathT, d.action.getClip().duration * 0.999);
    }
    // a missing stand clip would leak the bind pose: give its share to the first gait clip
    if (!idleP && this.loco[0]) {
      this.loco[0].lower.weight += sw;
      this.loco[0].upper.weight += sw * keepU;
    }
  }

  /** Re-apply the current clip blend without the aim offset (calibration). */
  rawPose(): void {
    this.restoreAimBones();
    this.mixer.update(0);
  }

  /** Undo last frame's aim offset (bones without a track in the current clips are not rewritten by the mixer). */
  private restoreAimBones(): void {
    if (!this.aimApplied) return;
    for (const b of this.aimBones) b.bone.quaternion.copy(b.saved);
    this.aimApplied = false;
  }

  /** Twist/pitch the spine chain in world space toward the aim (after the mixer, before IK). */
  private applyAimOffset(yaw: number, pitch: number): void {
    if (!this.aimBones.length || (Math.abs(yaw) < 1e-4 && Math.abs(pitch) < 1e-4)) return;
    this.root.getWorldQuaternion(_rq);
    // rig right = −x (Mixamo: forward +z, left +x); aim up = positive rotation about the right axis
    _right.set(-1, 0, 0).applyQuaternion(_rq).normalize();
    _yq.setFromAxisAngle(UP, yaw);
    _dq.setFromAxisAngle(_right, pitch).premultiply(_yq); // pitch first, then yaw around world up
    // axis-angle of the total rotation; each bone takes a share of the angle around the same axis (shares commute)
    const w = Math.min(1, Math.max(-1, _dq.w));
    const angle = 2 * Math.acos(w);
    const s = Math.sqrt(1 - w * w);
    if (s < 1e-6) return;
    _axis.set(_dq.x / s, _dq.y / s, _dq.z / s);
    for (const b of this.aimBones) b.saved.copy(b.bone.quaternion);
    this.aimApplied = true;
    for (const { bone, share } of this.aimBones) {
      const parent = bone.parent;
      if (!parent) continue;
      parent.getWorldQuaternion(_pq);
      _pqi.copy(_pq).invert();
      _yq.setFromAxisAngle(_axis, angle * share);
      // local' = P⁻¹ · Δ · P · local
      bone.quaternion.premultiply(_pq).premultiply(_yq).premultiply(_pqi);
      bone.updateWorldMatrix(false, false);
    }
  }

  reset(): void {
    this.shots = [];
    this.deathIdx = -1;
    this.deathT = 0;
    this.deathW = 0;
    this.standT = 0;
    this.flashUntil = 0;
    this.controller.reset(this.input.aimYaw);
    for (let i = 0; i < this.materials.length; i++) this.materials[i]!.emissive?.copy(this.baseEmissive[i]!);
    this.applyWeights();
    this.restoreAimBones();
    this.mixer.update(0);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    for (const m of this.materials) m.dispose();
  }
}

export function isBone(o: Object3D): o is Bone {
  return (o as Bone).isBone === true;
}
