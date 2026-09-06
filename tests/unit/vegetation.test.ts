import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TerrainTile, type TerrainMeta } from '@engine/terrain/tile';
import { scatterSpecies, valueNoise2, fbm2, type ScatterRule } from '@engine/vegetation/scatter';
import { hashString } from '@engine/core/prng';
import Ajv from 'ajv';

/**
 * TIP-D05 — scatter rừng (PRD VEG-001): seeded/deterministic, mặt nạ dốc/cao/noise, gom theo ô, bụi, rect riêng.
 * Chỉ scatter.ts (không three) — VegetationSystem/impostor kiểm ở E2E (level-truong-son.spec).
 */
const DIR = 'public/assets/terrain/truong-son-a';

function loadTile(yOffset = 691.2): TerrainTile {
  const meta = JSON.parse(readFileSync(`${DIR}/meta.json`, 'utf8')) as TerrainMeta;
  const buf = readFileSync(`${DIR}/height.r16`);
  const u16 = new Uint16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  return new TerrainTile(meta, u16, yOffset);
}

/** ô phẳng tổng hợp n×n (cao độ y0) — kiểm mật độ không phụ thuộc DEM */
function flatTile(n = 129, res = 2, y0 = 5): TerrainTile {
  const size = (n - 1) * res;
  const u16 = new Uint16Array(n * n).fill(32768);
  const meta: TerrainMeta = { id: 'flat', n, sizeM: size, resM: res, zMin: y0 - 1, zMax: y0 + 1 };
  return new TerrainTile(meta, u16, 0);
}

const RECT = { x: -192, z: 512, w: 512, h: 512 };
const RULE: ScatterRule = { id: 'tree_gn', perHa: 35, slope: [0, 0.55], scale: [0.8, 1.25], lod: [40, 110, 170, 600], cast: true, collider: { radius: 0.45, height: 6 } };

describe('TIP-D05 scatter (VEG-001)', () => {
  it('deterministic: cùng seed → cùng vị trí/yaw/scale/variant; seed khác → khác', () => {
    const t = loadTile();
    const a = scatterSpecies(t, RECT, RULE, 1971, 64);
    const b = scatterSpecies(t, RECT, RULE, 1971, 64);
    expect(a.count).toBeGreaterThan(200);
    expect(a.count).toBe(b.count);
    expect(Array.from(a.pos)).toEqual(Array.from(b.pos));
    expect(Array.from(a.yaw)).toEqual(Array.from(b.yaw));
    expect(Array.from(a.scale)).toEqual(Array.from(b.scale));
    expect(Array.from(a.variant)).toEqual(Array.from(b.variant));
    const c = scatterSpecies(t, RECT, RULE, 1972, 64);
    expect(Array.from(c.pos.slice(0, 30))).not.toEqual(Array.from(a.pos.slice(0, 30)));
  });

  it('mật độ ≈ perHa trên ô phẳng (không mặt nạ), y = cao độ terrain, scale trong khoảng', () => {
    const t = flatTile();
    const rect = { x: 0, z: 0, w: 200, h: 200 }; // 4 ha
    const p = scatterSpecies(t, rect, { id: 'fern', perHa: 900, lod: [10, 20, 40, 40], scale: [0.7, 1.3] }, 7, 64);
    expect(p.count).toBeGreaterThan(3600 * 0.9);
    expect(p.count).toBeLessThanOrEqual(3600);
    for (let i = 0; i < p.count; i++) {
      expect(p.pos[i * 3 + 1]).toBeCloseTo(5, 3);
      expect(p.scale[i]!).toBeGreaterThanOrEqual(0.7);
      expect(p.scale[i]!).toBeLessThanOrEqual(1.3);
      expect(Math.abs(p.pos[i * 3]!)).toBeLessThanOrEqual(100);
      expect(Math.abs(p.pos[i * 3 + 2]!)).toBeLessThanOrEqual(100);
    }
  });

  it('mặt nạ dốc: không cây trên dốc > max; mặt nạ cao độ: chỉ trong khoảng chuẩn hoá', () => {
    const t = loadTile();
    const p = scatterSpecies(t, RECT, { ...RULE, slope: [0, 0.3], height: [0, 0.5] }, 1971, 64);
    const range = t.maxY - t.minY;
    const n: [number, number, number] = [0, 1, 0];
    for (let i = 0; i < p.count; i++) {
      const x = p.pos[i * 3]!;
      const z = p.pos[i * 3 + 2]!;
      t.normalAt(x, z, n);
      expect(1 - n[1]).toBeLessThanOrEqual(0.3 + 1e-6);
      expect((p.pos[i * 3 + 1]! - t.minY) / range).toBeLessThanOrEqual(0.5 + 1e-6);
      expect(p.pos[i * 3 + 1]!).toBeCloseTo(t.sample(x, z), 4);
    }
    const all = scatterSpecies(t, RECT, RULE, 1971, 64);
    expect(p.count).toBeLessThan(all.count);
  });

  it('noise: mảng cây (min cao → ít cây hơn), fBm trong [0,1] và mượt', () => {
    const t = flatTile();
    const rect = { x: 0, z: 0, w: 256, h: 256 };
    const base = scatterSpecies(t, rect, { id: 'x', perHa: 100, lod: [1, 2, 3, 4] }, 3, 64);
    const masked = scatterSpecies(t, rect, { id: 'x', perHa: 100, lod: [1, 2, 3, 4], noise: { scale: 0.01, min: 0.5 } }, 3, 64);
    expect(masked.count).toBeLessThan(base.count * 0.7);
    expect(masked.count).toBeGreaterThan(0);
    let mn = 1;
    let mx = 0;
    for (let i = 0; i < 400; i++) {
      const v = fbm2(i * 0.37, i * 0.11, 5);
      mn = Math.min(mn, v);
      mx = Math.max(mx, v);
    }
    expect(mn).toBeGreaterThanOrEqual(0);
    expect(mx).toBeLessThanOrEqual(1);
    // liên tục: hai điểm cách 0,01 chênh < 0,05
    expect(Math.abs(valueNoise2(3.3, 4.4, 1) - valueNoise2(3.31, 4.4, 1))).toBeLessThan(0.05);
  });

  it('ô: instance của cùng ô liền nhau, offset/count phủ kín, cx/cz/minY/maxY đúng', () => {
    const t = loadTile();
    const cellM = 64;
    const p = scatterSpecies(t, RECT, RULE, 1971, cellM);
    let covered = 0;
    for (const c of p.cells.values()) {
      covered += c.count;
      expect(c.cx).toBeCloseTo(-t.half + (c.ix + 0.5) * cellM, 6);
      expect(c.cz).toBeCloseTo(-t.half + (c.jz + 0.5) * cellM, 6);
      let mn = Infinity;
      let mx = -Infinity;
      for (let i = c.offset; i < c.offset + c.count; i++) {
        const x = p.pos[i * 3]!;
        const y = p.pos[i * 3 + 1]!;
        const z = p.pos[i * 3 + 2]!;
        expect(Math.floor((x + t.half) / cellM)).toBe(c.ix);
        expect(Math.floor((z + t.half) / cellM)).toBe(c.jz);
        mn = Math.min(mn, y);
        mx = Math.max(mx, y);
      }
      expect(c.minY).toBeCloseTo(mn, 5);
      expect(c.maxY).toBeCloseTo(mx, 5);
    }
    expect(covered).toBe(p.count);
    expect(p.cells.size).toBeGreaterThan(30);
  });

  it('bụi (tre): mỗi điểm lưới sinh count culm trong bán kính; variants chọn trong [0, n)', () => {
    const t = flatTile();
    const rect = { x: 0, z: 0, w: 200, h: 200 };
    const rule: ScatterRule = { id: 'bamboo', perHa: 10, clump: { count: [2, 4], radius: 2.5 }, variants: 3, lod: [1, 2, 3, 4] };
    const p = scatterSpecies(t, rect, rule, 11, 64);
    // 4 ha × 10 bụi × 2..4 culm
    expect(p.count).toBeGreaterThanOrEqual(40 * 2 * 0.9);
    expect(p.count).toBeLessThanOrEqual(40 * 4);
    let maxV = 0;
    for (let i = 0; i < p.count; i++) maxV = Math.max(maxV, p.variant[i]!);
    expect(maxV).toBe(2);
    // có ít nhất một cặp culm cách nhau < 2·radius (cùng bụi)
    let near = 0;
    for (let i = 1; i < Math.min(p.count, 200); i++) {
      const d = Math.hypot(p.pos[i * 3]! - p.pos[(i - 1) * 3]!, p.pos[i * 3 + 2]! - p.pos[(i - 1) * 3 + 2]!);
      if (d < 5) near++;
    }
    expect(near).toBeGreaterThan(20);
  });

  it('sink: chôn gốc theo độ dốc (rễ bạnh không trồi); noiseId: mọc theo trường noise của loài khác', () => {
    const t = loadTile();
    const base = scatterSpecies(t, RECT, RULE, 1971, 64);
    const sunk = scatterSpecies(t, RECT, { ...RULE, sink: [0.35, 2] }, 1971, 64);
    expect(sunk.count).toBe(base.count);
    const n: [number, number, number] = [0, 1, 0];
    let maxDrop = 0;
    for (let i = 0; i < sunk.count; i++) {
      const x = sunk.pos[i * 3]!;
      const z = sunk.pos[i * 3 + 2]!;
      t.normalAt(x, z, n);
      const tan = Math.sqrt(Math.max(0, 1 - n[1] * n[1])) / Math.max(0.2, n[1]);
      const drop = base.pos[i * 3 + 1]! - sunk.pos[i * 3 + 1]!;
      expect(drop).toBeCloseTo(0.35 + 2 * tan, 4);
      maxDrop = Math.max(maxDrop, drop);
    }
    expect(maxDrop).toBeGreaterThan(0.6); // có sườn dốc trong rect
    // noiseId: mọi cây của 'vine' nằm trong mảng noise của 'tree_gn'
    const vine: ScatterRule = { id: 'vine', perHa: 70, noise: { scale: 0.006, min: 0.34 }, noiseId: 'tree_gn', lod: [1, 2, 3, 4] };
    const v = scatterSpecies(t, RECT, vine, 1971, 64);
    const nseed = (hashString('tree_gn', 1971) & 0xffff) >>> 0;
    for (let i = 0; i < v.count; i++) expect(fbm2(v.pos[i * 3]! * 0.006, v.pos[i * 3 + 2]! * 0.006, nseed)).toBeGreaterThanOrEqual(0.34);
    const own = scatterSpecies(t, RECT, { ...vine, noiseId: undefined }, 1971, 64);
    expect(Array.from(own.pos.slice(0, 30))).not.toEqual(Array.from(v.pos.slice(0, 30)));
  });

  it('level truong-son-a: khối vegetation hợp lệ theo schema, loài có GLB + manifest CC-BY có attribution', () => {
    const schema = JSON.parse(readFileSync('content/schemas/terrain-level.schema.json', 'utf8'));
    const level = JSON.parse(readFileSync('content/levels/truong-son-a.level.json', 'utf8'));
    const ajv = new Ajv({ allErrors: true, strict: false });
    expect(ajv.validate(schema, level), JSON.stringify(ajv.errors)).toBe(true);
    const manifest = JSON.parse(readFileSync('content/assets/manifest.json', 'utf8')) as { assets: Array<{ id: string; license?: string; attribution?: string; files: Array<{ path: string }> }> };
    for (const s of level.vegetation.species as Array<{ id: string; lod: number[] }>) {
      const a = manifest.assets.find((x) => x.id === `veg_${s.id}`);
      expect(a, `manifest veg_${s.id}`).toBeTruthy();
      expect(a!.files.some((f) => f.path === `assets/vegetation/${s.id}.glb`)).toBe(true);
      expect(readFileSync(`public/assets/vegetation/${s.id}.glb`).byteLength).toBeGreaterThan(1000);
      if (a!.license?.startsWith('CC-BY')) expect(a!.attribution ?? '').toMatch(/sketchfab|by/i);
      else expect(a!.license).toBe('CC0-1.0'); // cỏ procedural (gen-grass.mjs)
      expect(s.lod[0]!).toBeLessThan(s.lod[1]!);
      expect(s.lod[1]!).toBeLessThan(s.lod[2]!);
      expect(s.lod[2]!).toBeLessThanOrEqual(s.lod[3]!);
    }
  });
});
