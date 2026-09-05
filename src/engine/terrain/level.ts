/**
 * Level terrain (TIP-D04): content/levels/<id>.level.json (schema terrain-level.schema.json) → ArenaData cho physics/AI/mission
 * + TerrainMesh (LOD) + material splat. Không biết mission/AI (engine thuần). Toạ độ level: x/z thế giới của ô, y lấy từ terrain.
 */
import { Group, Mesh, BufferGeometry, BufferAttribute, type Scene } from 'three/webgpu';
import type { ArenaData, ColliderDef, CoverMarker } from '../render/arena';
import type { LoadedAssets } from '../render/assets';
import type { LevelSky } from '../level/types';
import { TerrainTile } from './tile';
import { TerrainMesh, makeHeightTexture, makeNormalTexture } from './mesh';
import { createTerrainMaterial, type TerrainLayers } from './material';

export type V2 = [number, number];

export interface TerrainLevelDef {
  id: string;
  name: string;
  terrain: {
    id: string;
    /** trừ vào cao độ DEM để spawn ≈ 0 (m) */
    yOffset: number;
    /** hình chữ nhật chơi (navmesh, spawn) — tâm x/z, rộng/dài (m) */
    navRect: { x: number; z: number; w: number; h: number };
    wetness?: number;
    tileMeters?: number;
    tint?: number;
  };
  sky: LevelSky;
  /** near lớn hơn arena (0,05) để depth 24-bit đủ chính xác tới far 2–3 km (GTAO/SSR đọc depth: near nhỏ → vạch ngang/ô trên sườn xa) */
  camera: { near: number; far: number };
  /** id texture (manifest) cho 4 lớp splat */
  layers: { leaves: string; mud: string; rock: string; grass: string };
  textures: string[];
  models: string[];
  playerSpawn: V2;
  playerYaw: number;
  botSpawns: Record<string, V2>;
  waypoints: V2[];
  zones: Record<string, { center: V2; radius: number }>;
  coverMarkers: Array<{ id: string; position: V2; facing: [number, number, number] }>;
}

export interface TerrainLevelBuild extends ArenaData {
  def: TerrainLevelDef;
  tile: TerrainTile;
  mesh: TerrainMesh;
  /** navmesh bake sẵn (public/assets/terrain/<id>/nav.bin) — null → game bake runtime từ navGeometry */
  navPrebuilt: Uint8Array | null;
  /** cao độ mặt đất (m, hệ level) */
  heightAt(x: number, z: number): number;
}

export interface TerrainLevelOptions {
  assets?: LoadedAssets | null;
  baseUrl: string;
}

export async function loadTerrainLevel(scene: Scene, def: TerrainLevelDef, opts: TerrainLevelOptions): Promise<TerrainLevelBuild> {
  const tile = await TerrainTile.load(opts.baseUrl, def.terrain.id, def.terrain.yOffset);
  const tex = opts.assets?.textures ?? null;
  const pick = (id: string) => tex?.[id] ?? null;
  const L = def.layers;
  const layers: TerrainLayers | null = tex && pick(L.leaves) && pick(L.mud) && pick(L.rock) && pick(L.grass) ? { leaves: pick(L.leaves)!, mud: pick(L.mud)!, rock: pick(L.rock)!, grass: pick(L.grass)! } : null;
  const heightTex = makeHeightTexture(tile);
  const normalTex = makeNormalTexture(tile);
  const mat = createTerrainMaterial(tile, heightTex, normalTex, layers, { wetness: def.terrain.wetness ?? 0.2, tileMeters: def.terrain.tileMeters, tint: def.terrain.tint });
  const mesh = new TerrainMesh(tile, mat.material);
  const root = new Group();
  root.name = `level_${def.id}`;
  root.add(mesh.group);
  scene.add(root);

  const h = (x: number, z: number): number => tile.sample(x, z);
  const v3 = (p: V2, dy = 0): [number, number, number] => [p[0], h(p[0], p[1]) + dy, p[1]];
  const colliders: ColliderDef[] = [{ id: 'terrain', kind: 'heightfield', position: [0, 0, 0], size: [tile.sizeM, 1, tile.sizeM], yaw: 0, material: 'earth', heights: tile.heights, n: tile.n }];

  // navGeometry: lưới 4 m trong navRect (fallback runtime; bake sẵn ưu tiên)
  const g = tile.gridMesh(def.terrain.navRect, Math.max(1, Math.round(4 / tile.resM)));
  const navGeo = new BufferGeometry();
  navGeo.setAttribute('position', new BufferAttribute(g.positions, 3));
  navGeo.setIndex(new BufferAttribute(g.indices, 1));
  const navMesh = new Mesh(navGeo);
  navMesh.name = 'terrain_nav';
  navMesh.updateMatrixWorld(true);

  let navPrebuilt: Uint8Array | null = null;
  try {
    const r = await fetch(`${opts.baseUrl}assets/terrain/${def.terrain.id}/nav.bin`, { method: 'GET' });
    // vite preview/dev trả index.html (200, text/html) cho file thiếu → phải kiểm content-type, không chỉ r.ok
    const ct = r.headers.get('content-type') ?? '';
    if (r.ok && !/html|text/i.test(ct)) {
      const data = new Uint8Array(await r.arrayBuffer());
      if (data.byteLength > 64 && data[0] !== 0x3c) navPrebuilt = data; // không phải '<'
    }
  } catch {
    navPrebuilt = null;
  }

  const coverMarkers: CoverMarker[] = def.coverMarkers.map((c) => ({ id: c.id, position: v3(c.position), facing: c.facing }));
  const botSpawns: Record<string, [number, number, number]> = {};
  for (const [k, p] of Object.entries(def.botSpawns)) botSpawns[k] = v3(p, 0.05);
  const zones: Record<string, { center: [number, number, number]; radius: number }> = {};
  for (const [k, z] of Object.entries(def.zones)) zones[k] = { center: v3(z.center), radius: z.radius };

  return {
    def,
    tile,
    mesh,
    navPrebuilt,
    heightAt: h,
    size: tile.sizeM,
    colliders,
    navGeometry: [navMesh],
    waypoints: def.waypoints.map((p) => v3(p)),
    coverMarkers,
    playerSpawn: v3(def.playerSpawn, 0.1),
    botSpawns,
    dummySpawns: [],
    zones,
    root,
    wetness: mat.wetness,
    lamps: [],
    stats: { props: 0, batchedDrawEstimate: 4, decor: 0 },
  };
}
