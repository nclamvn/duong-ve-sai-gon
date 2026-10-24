import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { streamEmitters, groundSurface, type TerrainFeaturesData } from '@engine/terrain/features';
import { TerrainTile, type TerrainMeta } from '@engine/terrain/tile';
import { scatterSpecies, type ScatterRule } from '@engine/vegetation/scatter';

const DIR = 'public/assets/terrain/truong-son-a';
const meta = JSON.parse(readFileSync(`${DIR}/meta.json`, 'utf8')) as TerrainMeta;
const feat = JSON.parse(readFileSync(`${DIR}/features.json`, 'utf8')) as TerrainFeaturesData;
const level = JSON.parse(readFileSync('content/levels/truong-son-a.level.json', 'utf8')) as {
  playerSpawn: [number, number];
  terrain: { yOffset: number };
  vegetation: { seed: number; cellM: number; species: ScatterRule[] };
  post?: { shafts?: object; grade?: object };
};

function tile(): TerrainTile {
  const buf = readFileSync(`${DIR}/height.r16`);
  const t = new TerrainTile(meta, new Uint16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), level.terrain.yOffset);
  t.setFeatures(feat);
  return t;
}

/** điểm trên đường mòn — mốc đo cho mật độ rừng và đất mòn (DV-092: đường mòn = tuyến giao tranh M1, điểm dốc bờ đông) */
const TRAIL_CAMP: [number, number] = [-12, 540];

describe('DV-063 nền rừng dày quanh đường mòn, âm thanh mặt đất, nước chảy', () => {
  it('boost: dày thêm sát đường mòn, lưới chính giữ nguyên, không mọc trong nước, không thêm loài (draw)', () => {
    const t = tile();
    const rule = level.vegetation.species.find((r) => r.id === 'ph_fern')!;
    expect(rule.boost?.length).toBeGreaterThan(0);
    // điểm đo trên đường mòn
    const rect = { x: TRAIL_CAMP[0], z: TRAIL_CAMP[1], w: 120, h: 120 };
    const withB = scatterSpecies(t, rect, rule, level.vegetation.seed, level.vegetation.cellM);
    const { boost: _b, ...noBoost } = rule;
    const without = scatterSpecies(t, rect, noBoost, level.vegetation.seed, level.vegetation.cellM);
    expect(withB.count).toBeGreaterThan(without.count * 1.5);
    // điểm lưới chính vẫn có mặt (PRNG riêng cho lưới phụ)
    const key = (p: Float32Array, i: number): string => `${p[i * 3]!.toFixed(3)},${p[i * 3 + 2]!.toFixed(3)}`;
    const all = new Set(Array.from({ length: withB.count }, (_, i) => key(withB.pos, i)));
    for (let i = 0; i < without.count; i++) expect(all.has(key(without.pos, i))).toBe(true);
    let nearTrail = 0;
    for (let i = 0; i < withB.count; i++) {
      const x = withB.pos[i * 3]!;
      const z = withB.pos[i * 3 + 2]!;
      expect(t.features!.distance('water', x, z)).toBeGreaterThanOrEqual(0.15);
      if (t.features!.distance('trail', x, z) <= 24) nearTrail++;
    }
    expect(nearTrail).toBeGreaterThan(without.count);
    // collider boost vẫn tránh lòng đường mòn 3 m (đồng đội không bị chặn)
    for (const r of level.vegetation.species.filter((q) => q.boost && q.collider)) {
      expect(r.avoid?.some((a) => a.feature === 'trail' && a.within >= 3)).toBe(true);
      for (const b of r.boost!) expect(b.min ?? 0).toBeGreaterThanOrEqual(3);
    }
  });

  it('tiếng suối: tối đa 1 điểm mỗi khe có nước, sắp theo khoảng cách, đúng khoảng cách tới polyline', () => {
    const em = streamEmitters(feat, level.playerSpawn[0], level.playerSpawn[1], 3, 400);
    expect(em.length).toBeGreaterThan(0);
    for (let i = 1; i < em.length; i++) expect(em[i]!.dist).toBeGreaterThanOrEqual(em[i - 1]!.dist);
    for (const e of em) {
      expect(e.size).toBeGreaterThan(0);
      expect(e.size).toBeLessThanOrEqual(1);
    }
    const data: TerrainFeaturesData = { id: 't', streams: [{ w: 3, areaHa: 80, water: true, pts: [[0, 0, 100, 3], [40, 0, 98, 3]] }, { w: 2, areaHa: 5, water: false, pts: [[0, 5, 100, 2], [40, 5, 99, 2]] }], craters: [] };
    const e2 = streamEmitters(data, 10, 12, 3, 100);
    expect(e2.length).toBe(1);
    expect(e2[0]!.dist).toBeCloseTo(12, 5);
    expect(e2[0]!.x).toBeCloseTo(10, 5);
  });

  it('mặt đất dưới chân: nước, bùn, đất mòn, đá, lá mục', () => {
    const t = tile();
    const F = t.features!;
    const s = feat.streams.find((q) => q.water)!;
    const [wx, wz] = s.pts[Math.floor(s.pts.length / 2)]!;
    expect(groundSurface(F, wx, wz, 0)).toBe('water');
    const c = feat.craters.find((q) => q.waterY === null)!;
    expect(groundSurface(F, c.x, c.z, 0)).toBe('mud');
    expect(groundSurface(F, TRAIL_CAMP[0], TRAIL_CAMP[1], 0)).toBe('soil');
    expect(groundSurface(null, 0, 0, 0.5)).toBe('rock');
    expect(groundSurface(null, 0, 0, 0.05)).toBe('leaves');
  });

  it('level bật tia nắng và chỉnh màu phim', () => {
    expect(level.post?.shafts).toBeTruthy();
    expect(level.post?.grade).toBeTruthy();
  });
});
