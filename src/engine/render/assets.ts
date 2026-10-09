/**
 * Asset loader (ADR-005): texture PBR (diff/nor_gl/arm), HDRI → PMREM, glTF props (meshopt).
 * Mọi file trong content/assets/manifest.json (CC0). Không có network fallback: thiếu file → lỗi rõ ràng (không im lặng).
 */
import { TextureLoader, SRGBColorSpace, LinearSRGBColorSpace, RepeatWrapping, LinearMipmapLinearFilter, Texture, PMREMGenerator, WebGPURenderer, EquirectangularReflectionMapping, type Object3D, type Group } from 'three/webgpu';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { createGltfLoader, initLoaders, ktx2Loader } from './loaders';
import { loadCharacter, type CharacterAsset } from './characters';
import { loadWeaponModel, type WeaponAsset, type WeaponModelConfig } from './weaponModel';
import { loadFpArms, type FpArmsAsset } from './fpArms';
import { loadFpHands, type FpHandsAsset } from './fpHands';
import type { AnimationClip } from 'three/webgpu';

/** Viewmodel người chơi rig sẵn AK + bàn tay + anim (TIP-D11b, DavidFalke CC-BY) — nghệ sĩ dựng cảnh cầm AK, tránh IK/fit. */
export interface FpViewmodelAsset {
  scene: Group;
  clips: AnimationClip[];
}

export interface PbrTextureSet {
  id: string;
  map: Texture;
  normalMap: Texture;
  /** r = AO, g = roughness, b = metalness (Poly Haven "arm") */
  armMap: Texture;
}

export interface LoadedAssets {
  textures: Record<string, PbrTextureSet>;
  models: Record<string, Group>;
  /** PMREM environment (đã prefilter) — gán scene.environment */
  environment: Texture | null;
  /** HDRI equirect gốc (nền trời ban ngày, TIP-019) — null khi lite */
  sky: Texture | null;
  /** nhân vật glTF (TIP-012, Mixamo → glb); null → Dummy procedural */
  character: CharacterAsset | null;
  /** vũ khí glTF (TIP-014, CC-BY) theo id cấu hình (content/weapons); thiếu → viewmodel/prop procedural */
  weapons: Record<string, WeaponAsset>;
  /** cánh tay góc nhìn thứ nhất (TIP-016, dẫn xuất Mixamo); null → bao tay procedural */
  arms: FpArmsAsset | null;
  /** tay FP v2 (TIP-D11b, David Fischer CC-BY, rig riêng); ưu tiên hơn `arms` khi có */
  fpHands: FpHandsAsset | null;
  /** viewmodel AK + tay rig sẵn (TIP-D11b, DavidFalke CC-BY) — dùng làm viewmodel người chơi khi có */
  fpViewmodel: FpViewmodelAsset | null;
  bytesHint: number;
}

/** Bộ asset mặc định của arena G0 (đêm cảng). Level khác truyền `textureIds/modelIds/hdri` (TIP-019). */
const TEXTURE_IDS = ['asphalt_02', 'concrete_wall_001', 'factory_wall', 'corrugated_iron_02', 'rusty_metal_02', 'rusty_painted_metal', 'plywood', 'metal_plate'] as const;
const MODEL_IDS = ['wooden_military_crate', 'old_military_crate', 'plastic_crate_01', 'cardboard_box_01', 'concrete_road_barrier', 'propane_tank', 'metal_trash_can', 'utility_box_01', 'portable_generator'] as const;
const HDRI_ID = 'blue_lagoon_night';
export const CHARACTER_URL = 'characters/soldier.glb';
export const ARMS_URL = 'characters/soldier_arms.glb';
export const FP_HANDS_URL = 'characters/fp_hands.glb';
export const FP_VIEWMODEL_URL = 'weapons/ak47_vm.glb';

export type TextureId = (typeof TEXTURE_IDS)[number];
export type ModelId = (typeof MODEL_IDS)[number];

function base(): string {
  return `${import.meta.env.BASE_URL ?? '/'}assets/`;
}

/**
 * Texture rời: `.ktx2` (Basis, ADR-D04) qua KTX2Loader — mipmap đã có trong file, colorSpace theo DFD (sRGB/linear);
 * `.jpg/.png` (fallback dev) qua TextureLoader.
 */
async function loadTex(loader: TextureLoader, url: string, srgb: boolean, anisotropy: number): Promise<Texture> {
  const k = ktx2Loader();
  if (url.endsWith('.ktx2') && k) {
    const t = await k.loadAsync(url);
    t.wrapS = t.wrapT = RepeatWrapping;
    t.colorSpace = srgb ? SRGBColorSpace : LinearSRGBColorSpace;
    t.anisotropy = anisotropy;
    t.needsUpdate = true;
    return t;
  }
  const t = await loader.loadAsync(url.replace(/\.ktx2$/, '.jpg'));
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = srgb ? SRGBColorSpace : LinearSRGBColorSpace;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = anisotropy;
  t.flipY = true;
  return t;
}

export interface LoadOptions {
  renderer: WebGPURenderer;
  /** bỏ qua model/HDRI (CI SwiftShader nhanh hơn) */
  lite?: boolean;
  /** bỏ qua nhân vật glTF dù có file (?character=0) */
  noCharacter?: boolean;
  /** cấu hình vũ khí cần nạp (content/weapons/*.json); rỗng/undefined → không nạp */
  weapons?: WeaponModelConfig[];
  /** bỏ qua vũ khí glTF (?weapons=0) */
  noWeapons?: boolean;
  /** bỏ qua cánh tay FP (?arms=0) */
  noArms?: boolean;
  /** danh sách asset theo level (mặc định: arena G0) */
  textureIds?: readonly string[];
  modelIds?: readonly string[];
  hdri?: { id: string; res: '1k' | '2k' | '4k' };
  /** giữ HDRI equirect làm nền trời (ban ngày) */
  keepSky?: boolean;
  onProgress?: (done: number, total: number, label: string) => void;
}

/** Model prop glTF (meshopt) — cast/receive shadow, anisotropy. Dùng bởi loadAssets và debug API (spawnModel). */
export async function loadModel(url: string, aniso = 4): Promise<Group> {
  const g = await createGltfLoader().loadAsync(url);
  g.scene.traverse((o: Object3D) => {
    const m = o as { isMesh?: boolean; castShadow: boolean; receiveShadow: boolean; material?: { map?: Texture | null; anisotropy?: number } };
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      if (m.material?.map) m.material.map.anisotropy = aniso;
    }
  });
  return g.scene;
}

export async function loadAssets(opts: LoadOptions): Promise<LoadedAssets> {
  const b = base();
  const aniso = Math.min(8, opts.renderer.getMaxAnisotropy());
  initLoaders(opts.renderer, import.meta.env.BASE_URL ?? '/');
  const texLoader = new TextureLoader();
  const weaponCfgs = opts.lite || opts.noWeapons ? [] : (opts.weapons ?? []);
  const textureIds = opts.textureIds ?? TEXTURE_IDS;
  const modelIds = opts.modelIds ?? MODEL_IDS;
  const hdri = opts.hdri ?? { id: HDRI_ID, res: '1k' as const };
  const total = textureIds.length + (opts.lite ? 0 : modelIds.length + 1) + weaponCfgs.length;
  let done = 0;
  const tick = (label: string): void => {
    done++;
    opts.onProgress?.(done, total, label);
  };

  const textures: Record<string, PbrTextureSet> = {};
  await Promise.all(
    textureIds.map(async (id) => {
      const dir = `${b}textures/${id}/${id}`;
      const [map, normalMap, armMap] = await Promise.all([
        loadTex(texLoader, `${dir}_diff_1k.ktx2`, true, aniso),
        loadTex(texLoader, `${dir}_nor_gl_1k.ktx2`, false, aniso),
        loadTex(texLoader, `${dir}_arm_1k.ktx2`, false, aniso),
      ]);
      textures[id] = { id, map, normalMap, armMap };
      tick(id);
    }),
  );

  const models: Record<string, Group> = {};
  const weapons: Record<string, WeaponAsset> = {};
  let environment: Texture | null = null;
  let sky: Texture | null = null;
  let character: CharacterAsset | null = null;
  let arms: FpArmsAsset | null = null;
  let fpHands: FpHandsAsset | null = null;
  if (!opts.lite && !opts.noWeapons && !opts.noArms) {
    // ưu tiên tay FP v2 (fp_hands.glb, D11b); giữ soldier_arms cũ làm fallback
    try {
      const head = await fetch(`${b}${FP_HANDS_URL}`, { method: 'HEAD' });
      if (head.ok) fpHands = await loadFpHands(`${b}${FP_HANDS_URL}`);
    } catch {
      fpHands = null;
    }
    if (!fpHands) {
      try {
        const head = await fetch(`${b}${ARMS_URL}`, { method: 'HEAD' });
        if (head.ok) arms = await loadFpArms(`${b}${ARMS_URL}`);
      } catch {
        arms = null;
      }
    }
  }
  await Promise.all(
    weaponCfgs.map(async (cfg) => {
      // vũ khí: tuỳ chọn — thiếu file (chưa convert) → bỏ qua, viewmodel/prop procedural
      try {
        const url = `${b}${cfg.model}`;
        const head = await fetch(url, { method: 'HEAD' });
        if (head.ok) weapons[cfg.id] = await loadWeaponModel(url, cfg, aniso);
      } catch {
        /* thiếu → procedural */
      }
      tick(cfg.id);
    }),
  );
  if (!opts.lite && !opts.noCharacter) {
    // nhân vật: tuỳ chọn — thiếu file (CI, chưa convert Mixamo) → null, không phải lỗi
    try {
      const head = await fetch(`${b}${CHARACTER_URL}`, { method: 'HEAD' });
      if (head.ok) character = await loadCharacter(`${b}${CHARACTER_URL}`);
    } catch {
      character = null;
    }
  }
  if (!opts.lite) {
    await Promise.all(
      modelIds.map(async (id) => {
        models[id] = await loadModel(`${b}models/${id}.glb`, aniso);
        tick(id);
      }),
    );
    const hdr = await new HDRLoader().loadAsync(`${b}hdris/${hdri.id}/${hdri.id}_${hdri.res}.hdr`);
    hdr.mapping = EquirectangularReflectionMapping;
    const pmrem = new PMREMGenerator(opts.renderer);
    const rt = await pmrem.fromEquirectangularAsync(hdr);
    environment = rt.texture;
    if (opts.keepSky) sky = hdr;
    else hdr.dispose();
    pmrem.dispose();
    tick(hdri.id);
  }
  let fpViewmodel: FpViewmodelAsset | null = null;
  if (!opts.lite && !opts.noWeapons && !opts.noArms) {
    try {
      const head = await fetch(`${b}${FP_VIEWMODEL_URL}`, { method: 'HEAD' });
      if (head.ok) {
        const g = await createGltfLoader().loadAsync(`${b}${FP_VIEWMODEL_URL}`);
        fpViewmodel = { scene: g.scene as unknown as Group, clips: g.animations };
      }
    } catch {
      fpViewmodel = null;
    }
  }
  return { textures, models, environment, sky, character, weapons, arms, fpHands, fpViewmodel, bytesHint: 0 };
}

export function assetIds(): { textures: readonly string[]; models: readonly string[]; hdri: string } {
  return { textures: TEXTURE_IDS, models: MODEL_IDS, hdri: HDRI_ID };
}
