import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { FeatureField, type TerrainFeaturesData } from '@engine/terrain/features';
import { TerrainTile, type TerrainMeta } from '@engine/terrain/tile';
import { scatterSpecies } from '@engine/vegetation/scatter';

const DIR = 'public/assets/terrain/truong-son-a';
const meta = JSON.parse(readFileSync(`${DIR}/meta.json`, 'utf8')) as TerrainMeta;
const feat = JSON.parse(readFileSync(`${DIR}/features.json`, 'utf8')) as TerrainFeaturesData;
const level = JSON.parse(readFileSync('content/levels/truong-son-a.level.json', 'utf8')) as {
  playerSpawn: [number, number];
  zones: Record<string, { center: [number, number]; radius: number }>;
  waypoints: Array<[number, number]>;
  terrain: { yOffset: number };
};

function loadTile(): TerrainTile {
  const buf = readFileSync(`${DIR}/height.r16`);
  const t = new TerrainTile(meta, new Uint16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), level.terrain.yOffset);
  t.setFeatures(feat);
  return t;
}

describe('DV-060 khe suối và hố bom', () => {
  it('features.json có khe (một phần có nước) và hố bom; meta trỏ đúng file và bản gốc', () => {
    expect(meta.features?.file).toBe('features.json');
    expect(feat.streams.length).toBeGreaterThan(10);
    expect(feat.streams.some((s) => s.water)).toBe(true);
    expect(feat.craters.length).toBeGreaterThan(50);
    expect(feat.craters.some((c) => c.waterY !== null)).toBe(true);
    // registry: hố bom đường kính ~9 m, sâu > 1,5 m
    for (const c of feat.craters) {
      expect(c.r * 2).toBeGreaterThan(7);
      expect(c.r * 2).toBeLessThan(11);
      expect(c.depth).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('heightmap đã khoét: đáy hố thấp hơn miệng ≥ 1,2 m; đáy khe nằm dưới mặt đất hai bờ', () => {
    const t = loadTile();
    for (const c of feat.craters.slice(0, 30)) {
      const mid = t.sample(c.x, c.z);
      const rim = Math.max(t.sample(c.x + c.r, c.z), t.sample(c.x - c.r, c.z), t.sample(c.x, c.z + c.r), t.sample(c.x, c.z - c.r));
      expect(rim - mid).toBeGreaterThan(1.2);
    }
    // mặt nước suối (đáy + 0,28 m, src/engine/terrain/water.ts) phải nổi trên đất giữa lòng và nằm dưới bờ cao ít nhất một phía
    let checked = 0;
    let visible = 0;
    let banked = 0;
    const yo = level.terrain.yOffset;
    for (const s of feat.streams.filter((q) => q.water)) {
      for (let q = 1; q + 1 < s.pts.length; q += 2) {
        const [x, z, bed, w] = s.pts[q]!;
        const [bx, bz] = s.pts[q + 1]!;
        const L = Math.hypot(bx - x, bz - z) || 1;
        const nx = -(bz - z) / L;
        const nz = (bx - x) / L;
        const wy = bed + 0.28 - yo;
        if (t.sample(x, z) <= wy + 0.05) visible++;
        const off = w / 2 + 4;
        if (Math.max(t.sample(x + nx * off, z + nz * off), t.sample(x - nx * off, z - nz * off)) > wy + 0.3) banked++;
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(10);
    expect(visible / checked).toBeGreaterThanOrEqual(0.9);
    expect(banked / checked).toBeGreaterThanOrEqual(0.9);
  });

  it('không hố bom trong vùng spawn, zone, hành lang waypoint (nhiệm vụ và test vật lý giữ nguyên)', () => {
    for (const c of feat.craters) {
      expect(Math.hypot(c.x - level.playerSpawn[0], c.z - level.playerSpawn[1])).toBeGreaterThan(24);
      for (const zn of Object.values(level.zones)) expect(Math.hypot(c.x - zn.center[0], c.z - zn.center[1])).toBeGreaterThan(zn.radius + 6);
    }
  });

  it('trường khoảng cách: âm trong lòng hố, dương ngoài; luật near/avoid lọc đúng', () => {
    const t = loadTile();
    const c = feat.craters[0]!;
    expect(t.features!.distance('crater', c.x, c.z)).toBeLessThan(0);
    expect(t.features!.distance('crater', c.x + c.r + 20, c.z + c.r + 20)).toBeGreaterThan(0);
    const rect = { x: c.x, z: c.z, w: 80, h: 80 };
    const near = scatterSpecies(t, rect, { id: 'test_near', perHa: 3000, slope: [0, 1], near: { feature: 'crater', min: -3, max: 6 }, lod: [10, 20, 30, 40] }, 7, 64);
    expect(near.count).toBeGreaterThan(10);
    for (let k = 0; k < near.count; k++) {
      const d = t.features!.distance('crater', near.pos[k * 3]!, near.pos[k * 3 + 2]!);
      expect(d).toBeGreaterThanOrEqual(-3);
      expect(d).toBeLessThanOrEqual(6);
    }
    const avoid = scatterSpecies(t, rect, { id: 'test_avoid', perHa: 3000, slope: [0, 1], avoid: [{ feature: 'crater', within: 4 }], lod: [10, 20, 30, 40] }, 7, 64);
    for (let k = 0; k < avoid.count; k++) expect(t.features!.distance('crater', avoid.pos[k * 3]!, avoid.pos[k * 3 + 2]!)).toBeGreaterThanOrEqual(4);
  });

  it('FeatureField thuần: khoảng cách tới dải khe tính từ mép đáy', () => {
    const data: TerrainFeaturesData = { id: 't', streams: [{ w: 4, areaHa: 50, water: true, pts: [[-20, 0, 0, 4], [20, 0, 0, 4]] }], craters: [] };
    const f = new FeatureField(data, 200, 1, 30);
    expect(f.distance('stream', 0, 0)).toBeCloseTo(-2, 1);
    expect(f.distance('stream', 0, 10)).toBeCloseTo(8, 1);
    expect(f.distance('water', 0, 10)).toBeCloseTo(8, 1);
    expect(f.distance('crater', 0, 0)).toBe(30);
  });
});
