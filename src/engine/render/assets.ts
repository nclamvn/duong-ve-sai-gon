/**
 * Asset loader (ADR-005): texture PBR (diff/nor_gl/arm), HDRI → PMREM, glTF props (meshopt).
 * Mọi file trong content/assets/manifest.json (CC0). Không có network fallback: thiếu file → lỗi rõ ràng (không im lặng).
 */
import { TextureLoader, SRGBColorSpace, LinearSRGBColorSpace, RepeatWrapping, LinearMipmapLinearFilter, Texture, PMREMGenerator, WebGPURenderer, EquirectangularReflectionMapping, type Object3D, type Group } from 'three/webgpu';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { loadCharacter, type CharacterAsset } from './characters';

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
  /** nhân vật glTF (TIP-012, Mixamo → glb); null → Dummy procedural */
  character: CharacterAsset | null;
  bytesHint: number;
}

const TEXTURE_IDS = ['asphalt_02', 'concrete_wall_001', 'factory_wall', 'corrugated_iron_02', 'rusty_metal_02', 'rusty_painted_metal', 'plywood', 'metal_plate'] as const;
const MODEL_IDS = ['wooden_military_crate', 'old_military_crate', 'plastic_crate_01', 'cardboard_box_01', 'concrete_road_barrier', 'propane_tank', 'metal_trash_can', 'utility_box_01', 'portable_generator'] as const;
const HDRI_ID = 'blue_lagoon_night';
export const CHARACTER_URL = 'characters/soldier.glb';

export type TextureId = (typeof TEXTURE_IDS)[number];
export type ModelId = (typeof MODEL_IDS)[number];

function base(): string {
  return `${import.meta.env.BASE_URL ?? '/'}assets/`;
}

async function loadTex(loader: TextureLoader, url: string, srgb: boolean, anisotropy: number): Promise<Texture> {
  const t = await loader.loadAsync(url);
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
  onProgress?: (done: number, total: number, label: string) => void;
}

export async function loadAssets(opts: LoadOptions): Promise<LoadedAssets> {
  const b = base();
  const aniso = Math.min(8, opts.renderer.getMaxAnisotropy());
  const texLoader = new TextureLoader();
  const total = TEXTURE_IDS.length + (opts.lite ? 0 : MODEL_IDS.length + 1);
  let done = 0;
  const tick = (label: string): void => {
    done++;
    opts.onProgress?.(done, total, label);
  };

  const textures: Record<string, PbrTextureSet> = {};
  await Promise.all(
    TEXTURE_IDS.map(async (id) => {
      const dir = `${b}textures/${id}/${id}`;
      const [map, normalMap, armMap] = await Promise.all([
        loadTex(texLoader, `${dir}_diff_1k.jpg`, true, aniso),
        loadTex(texLoader, `${dir}_nor_gl_1k.jpg`, false, aniso),
        loadTex(texLoader, `${dir}_arm_1k.jpg`, false, aniso),
      ]);
      textures[id] = { id, map, normalMap, armMap };
      tick(id);
    }),
  );

  const models: Record<string, Group> = {};
  let environment: Texture | null = null;
  let character: CharacterAsset | null = null;
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
    const gltf = new GLTFLoader();
    gltf.setMeshoptDecoder(MeshoptDecoder);
    await Promise.all(
      MODEL_IDS.map(async (id) => {
        const g = await gltf.loadAsync(`${b}models/${id}.glb`);
        g.scene.traverse((o: Object3D) => {
          const m = o as { isMesh?: boolean; castShadow: boolean; receiveShadow: boolean; material?: { map?: Texture | null; anisotropy?: number } };
          if (m.isMesh) {
            m.castShadow = true;
            m.receiveShadow = true;
            if (m.material?.map) m.material.map.anisotropy = aniso;
          }
        });
        models[id] = g.scene;
        tick(id);
      }),
    );
    const hdr = await new HDRLoader().loadAsync(`${b}hdris/${HDRI_ID}/${HDRI_ID}_1k.hdr`);
    hdr.mapping = EquirectangularReflectionMapping;
    const pmrem = new PMREMGenerator(opts.renderer);
    const rt = await pmrem.fromEquirectangularAsync(hdr);
    environment = rt.texture;
    hdr.dispose();
    pmrem.dispose();
    tick(HDRI_ID);
  }
  return { textures, models, environment, character, bytesHint: 0 };
}

export function assetIds(): { textures: readonly string[]; models: readonly string[]; hdri: string } {
  return { textures: TEXTURE_IDS, models: MODEL_IDS, hdri: HDRI_ID };
}
