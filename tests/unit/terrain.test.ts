import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { TerrainTile, type TerrainMeta } from '@engine/terrain/tile';
import { chooseLod, LOD_DISTANCES, CHUNK_M, LOD_RES } from '@engine/terrain/lod';
import { initPhysics, PhysicsWorld } from '@engine/physics/world';
import { LAYER } from '@engine/physics/layers';
import { mulberry32 } from '@engine/core';
import { initNav, NavService } from '@engine/nav/navmesh';

const DIR = 'public/assets/terrain/truong-son-a';

function loadTile(yOffset = 0): TerrainTile {
  const meta = JSON.parse(readFileSync(`${DIR}/meta.json`, 'utf8')) as TerrainMeta;
  const buf = readFileSync(`${DIR}/height.r16`);
  const u16 = new Uint16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  return new TerrainTile(meta, u16, yOffset);
}

/** ô nhỏ tổng hợp: mặt nghiêng y = 0.1·x + 0.05·z + 3 (kiểm hướng trục không phụ thuộc DEM) */
function slopeTile(n = 33, res = 2): TerrainTile {
  const size = (n - 1) * res;
  const half = size / 2;
  const zMin = -half * 0.15 + 3 - 1;
  const zMax = half * 0.15 + 3 + 1;
  const u16 = new Uint16Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -half + i * res;
      const z = -half + j * res;
      const y = 0.1 * x + 0.05 * z + 3;
      u16[j * n + i] = Math.round(((y - zMin) / (zMax - zMin)) * 65535);
    }
  }
  const meta: TerrainMeta = { id: 'slope', n, sizeM: size, resM: res, zMin, zMax };
  return new TerrainTile(meta, u16, 0);
}

beforeAll(async () => {
  await initPhysics();
  await initNav();
});

describe('TIP-D04 TerrainTile (TER-001)', () => {
  it('nạp ô truong-son-a: n, cao độ trong [zMin, zMax] − yOffset, sample tại đỉnh = at', () => {
    const t = loadTile(600);
    expect(t.n).toBe(1025);
    expect(t.sizeM).toBe(2048);
    expect(t.minY).toBeGreaterThanOrEqual(t.meta.zMin - 600 - 1e-3);
    expect(t.maxY).toBeLessThanOrEqual(t.meta.zMax - 600 + 1e-3);
    // đỉnh (i, j) ↔ x = −half + i·res, z = −half + j·res
    expect(t.sample(-t.half + 100 * t.resM, -t.half + 200 * t.resM)).toBeCloseTo(t.at(100, 200), 5);
    // giữa ô = trung bình 4 đỉnh
    const mid = (t.at(100, 200) + t.at(101, 200) + t.at(100, 201) + t.at(101, 201)) / 4;
    expect(t.sample(-t.half + 100.5 * t.resM, -t.half + 200.5 * t.resM)).toBeCloseTo(mid, 5);
  });

  it('trục: hàng 0 = bắc (−z), cột 0 = tây (−x); mặt nghiêng tổng hợp cho sample/normal đúng', () => {
    const t = slopeTile();
    expect(t.sample(10, -6)).toBeCloseTo(0.1 * 10 + 0.05 * -6 + 3, 2);
    expect(t.sample(-20, 20)).toBeCloseTo(0.1 * -20 + 0.05 * 20 + 3, 2);
    const nrm = t.normalAt(0, 0);
    const l = Math.hypot(0.1, 1, 0.05);
    expect(nrm[0]).toBeCloseTo(-0.1 / l, 2);
    expect(nrm[1]).toBeCloseTo(1 / l, 2);
    expect(nrm[2]).toBeCloseTo(-0.05 / l, 2);
    // gridMesh: đỉnh đầu ở góc tây-bắc của rect, y = cao độ
    const g = t.gridMesh({ x: 0, z: 0, w: 16, h: 16 }, 1);
    expect(g.positions[0]).toBeCloseTo(-8, 5);
    expect(g.positions[2]).toBeCloseTo(-8, 5);
    expect(g.positions[1]).toBeCloseTo(t.sample(-8, -8), 2);
    expect(g.indices.length).toBe(8 * 8 * 6);
  });

  it('texture cao độ RGBA8 giải mã lại đúng ±0,01 m; texture normal hướng lên', () => {
    const t = loadTile(600);
    const ht = t.heightTexture();
    const k = 512 * t.n + 512;
    const v = ht[k * 4]! * 256 + ht[k * 4 + 1]!;
    const y = t.minY + (v / 65535) * (t.maxY - t.minY);
    expect(Math.abs(y - t.heights[k]!)).toBeLessThan(0.01);
    const nt = t.normalTexture();
    expect(nt[k * 4 + 1]!).toBeGreaterThan(128); // ny > 0
  });
});

describe('TIP-D04 LOD', () => {
  it('chọn LOD theo khoảng cách với hysteresis 8 m', () => {
    expect(chooseLod(10, -1)).toBe(0);
    expect(chooseLod(LOD_DISTANCES[0]! + 1, -1)).toBe(1);
    expect(chooseLod(LOD_DISTANCES[2]! + 1, -1)).toBe(3);
    // đang ở LOD0, đi ra tới ngưỡng + 4 m → vẫn giữ LOD0 (hysteresis); + 12 m → LOD1
    expect(chooseLod(LOD_DISTANCES[0]! + 4, 0)).toBe(0);
    expect(chooseLod(LOD_DISTANCES[0]! + 12, 0)).toBe(1);
    // đang LOD1, quay lại ngưỡng − 4 m → giữ LOD1; − 12 m → LOD0
    expect(chooseLod(LOD_DISTANCES[0]! - 4, 1)).toBe(1);
    expect(chooseLod(LOD_DISTANCES[0]! - 12, 1)).toBe(0);
    expect(LOD_RES.length).toBe(4);
    expect(CHUNK_M % LOD_RES[3]!).toBe(0);
  });
});

describe('TIP-D04 heightfield Rapier (TER-003)', () => {
  it('mặt nghiêng tổng hợp: raycast xuống trùng sample (kiểm hướng hàng/cột column-major)', () => {
    const t = slopeTile();
    const w = new PhysicsWorld();
    w.addStatic({ kind: 'heightfield', position: [0, 0, 0], size: [t.sizeM, 1, t.sizeM], yaw: 0, heights: t.heights, n: t.n }, { id: 'terrain', kind: 'world', material: 'earth' });
    w.step(); // query pipeline cập nhật sau step (như game loop)
    for (const [x, z] of [
      [20, -10],
      [-25, 25],
      [0, 0],
      [30, 30],
      [-30, -30],
    ] as Array<[number, number]>) {
      const hit = w.castRay(x, 50, z, 0, -1, 0, 200, LAYER.WORLD);
      expect(hit, `(${x},${z})`).not.toBeNull();
      expect(Math.abs(hit!.point[1] - t.sample(x, z)), `(${x},${z})`).toBeLessThan(0.02);
    }
  });

  it('ô truong-son-a: 50 điểm seeded |raycast − sample| ≤ 0,15 m', () => {
    const t = loadTile(600);
    const w = new PhysicsWorld();
    w.addStatic({ kind: 'heightfield', position: [0, 0, 0], size: [t.sizeM, 1, t.sizeM], yaw: 0, heights: t.heights, n: t.n }, { id: 'terrain', kind: 'world', material: 'earth' });
    w.step();
    const p = mulberry32(42);
    let worst = 0;
    for (let k = 0; k < 50; k++) {
      const x = p.range(-t.half + 10, t.half - 10);
      const z = p.range(-t.half + 10, t.half - 10);
      const hit = w.castRay(x, t.maxY + 50, z, 0, -1, 0, t.maxY - t.minY + 100, LAYER.WORLD);
      expect(hit).not.toBeNull();
      expect(hit!.data?.material).toBe('earth');
      const d = Math.abs(hit!.point[1] - t.sample(x, z));
      if (d > worst) worst = d;
    }
    expect(worst).toBeLessThanOrEqual(0.15);
  });
});

describe('TIP-D04 navmesh trên terrain', () => {
  it('bake recast trên lưới 4 m của rect 64 m: poly > 0, findPath qua sườn', () => {
    const t = loadTile(600);
    const g = t.gridMesh({ x: 0, z: 0, w: 64, h: 64 }, 2);
    const nav = new NavService(g.positions, g.indices, { cs: 0.5, ch: 0.25 });
    expect(nav.polyCount).toBeGreaterThan(0);
    const a = { x: -20, y: t.sample(-20, -20), z: -20 };
    const b = { x: 20, y: t.sample(20, 20), z: 20 };
    const path = nav.findPath(a, b);
    expect(path.length).toBeGreaterThan(1);
  });
});

describe('TIP-D04 geometry ô LOD', () => {
  it('lưới + váy: số đỉnh/tam giác đúng, index trong phạm vi, váy chỉ ở đỉnh biên', async () => {
    const { makeChunkGeometry } = await import('@engine/terrain/mesh');
    for (let lod = 0; lod < 4; lod++) {
      const v = CHUNK_M / LOD_RES[lod]! + 1;
      const g = makeChunkGeometry(lod);
      const pos = g.getAttribute('position');
      const skirt = g.getAttribute('skirt');
      const idx = g.getIndex()!;
      expect(pos.count).toBe(v * v + 4 * v);
      expect(idx.count).toBe(((v - 1) * (v - 1) * 2 + 4 * (v - 1) * 2) * 3);
      let maxI = 0;
      for (let k = 0; k < idx.count; k++) maxI = Math.max(maxI, idx.getX(k));
      expect(maxI).toBeLessThan(pos.count);
      let skirtCount = 0;
      for (let k = 0; k < skirt.count; k++) if (skirt.getX(k) === 1) skirtCount++;
      expect(skirtCount).toBe(4 * v);
      // đỉnh lưới phủ [0, 64]
      expect(pos.getX(v - 1)).toBe(CHUNK_M);
      expect(pos.getZ(v * v - 1)).toBe(CHUNK_M);
    }
  });
});

describe('TIP-D04 level truong-son-a (content/levels)', () => {
  it('đúng schema terrain-level; texture/HDRI/ô terrain có trong manifest; spawn/waypoint trong ô và trong navRect', async () => {
    const Ajv = (await import('ajv')).default;
    const schema = JSON.parse(readFileSync('content/schemas/terrain-level.schema.json', 'utf8'));
    const def = JSON.parse(readFileSync('content/levels/truong-son-a.level.json', 'utf8'));
    const ajv = new Ajv({ strict: true, allErrors: true });
    const ok = ajv.validate(schema, def);
    expect(ok, JSON.stringify(ajv.errors)).toBe(true);
    const manifest = JSON.parse(readFileSync('content/assets/manifest.json', 'utf8')) as { assets: Array<{ id: string; type: string; files: Array<{ path: string }> }> };
    const ids = new Set(manifest.assets.map((a) => a.id));
    for (const t of def.textures) expect(ids.has(t), `texture ${t}`).toBe(true);
    for (const t of Object.values(def.layers) as string[]) expect(def.textures.includes(t), `layer ${t}`).toBe(true);
    expect(ids.has(def.sky.hdri)).toBe(true);
    const terrainAsset = manifest.assets.find((a) => a.type === 'terrain' && a.files.some((f) => f.path.startsWith(`assets/terrain/${def.terrain.id}/`)));
    expect(terrainAsset, 'ô terrain trong manifest').toBeDefined();
    expect(terrainAsset!.files.some((f) => f.path.endsWith('nav.bin')), 'nav.bin bake sẵn').toBe(true);
    const t = loadTile(def.terrain.yOffset);
    const r = def.terrain.navRect;
    const inRect = (p: [number, number]): boolean => Math.abs(p[0] - r.x) <= r.w / 2 && Math.abs(p[1] - r.z) <= r.h / 2;
    expect(inRect(def.playerSpawn)).toBe(true);
    for (const [k, p] of Object.entries(def.botSpawns) as Array<[string, [number, number]]>) expect(inRect(p), k).toBe(true);
    for (const w of def.waypoints as Array<[number, number]>) expect(inRect(w)).toBe(true);
    // yOffset đưa spawn về ≈ 0 (±2 m)
    expect(Math.abs(t.sample(def.playerSpawn[0], def.playerSpawn[1]))).toBeLessThan(2);
  });
});
