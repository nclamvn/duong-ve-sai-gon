/**
 * Dựng rừng cho một level terrain (TIP-D05): nạp GLB loài (song song), bake impostor, tạo VegetationSystem.
 * Game chỉ gọi buildForest() sau khi terrain + loader sẵn sàng; collider thân trả về qua system.colliders (game đưa vào physics).
 */
import type { Renderer } from 'three/webgpu';
import type { TerrainTile } from '../terrain/tile';
import { loadSpecies, type SpeciesAsset } from './species';
import { bakeImpostorAtlas, type ImpostorAtlas } from './impostor';
import { VegetationSystem, type VegetationDef, type VegetationQuality } from './system';

export interface ForestOptions {
  baseUrl: string;
  quality: VegetationQuality;
  /** bỏ bake impostor (CI SwiftShader chậm / debug) */
  noImpostor?: boolean;
  onProgress?: (done: number, total: number) => void;
}

export interface ForestBuild {
  system: VegetationSystem;
  assets: Record<string, SpeciesAsset>;
  atlases: Record<string, ImpostorAtlas | null>;
  loadMs: number;
  bakeMs: number;
}

/** tiers mặc định (QualityTier → VegetationQuality); `?vegDensity=`/`?vegLod=`/`?vegShadow=0` ghi đè ở game */
export const VEG_QUALITY: Record<'low' | 'medium' | 'high', VegetationQuality> = {
  low: { density: 0.5, lodScale: 0.6, shadows: false },
  medium: { density: 0.75, lodScale: 0.85, shadows: true },
  high: { density: 1, lodScale: 1, shadows: true },
};

export async function buildForest(renderer: Renderer, tile: TerrainTile, def: VegetationDef, opts: ForestOptions): Promise<ForestBuild> {
  const ids = [...new Set(def.species.map((s) => s.id))];
  const t0 = performance.now();
  let done = 0;
  const assets: Record<string, SpeciesAsset> = {};
  await Promise.all(
    ids.map(async (id) => {
      try {
        assets[id] = await loadSpecies(`${opts.baseUrl}assets/vegetation/${id}.glb`, id);
      } catch (e) {
        console.warn(`[vegetation] species ${id} failed: ${(e as Error).message}`);
      }
      done++;
      opts.onProgress?.(done, ids.length);
    }),
  );
  const loadMs = performance.now() - t0;
  const t1 = performance.now();
  const atlases: Record<string, ImpostorAtlas | null> = {};
  if (!opts.noImpostor) {
    for (const rule of def.species) {
      const a = assets[rule.id];
      if (!a || atlases[rule.id] !== undefined) continue;
      atlases[rule.id] = rule.lod[3] > rule.lod[2] ? await bakeImpostorAtlas(renderer, a) : null;
    }
  }
  const bakeMs = performance.now() - t1;
  const system = new VegetationSystem(tile, def, assets, opts.quality, atlases);
  return { system, assets, atlases, loadMs, bakeMs };
}
