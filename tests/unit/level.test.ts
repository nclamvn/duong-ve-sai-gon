import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import level from '../../content/levels/pho-van-hai.level.json';
import type { LevelDef } from '../../src/engine/level/types';

const def = level as unknown as LevelDef;
const manifest = JSON.parse(readFileSync('content/assets/manifest.json', 'utf8')) as { assets: Array<{ id: string; type: string; license: string }> };

describe('TIP-019 level Phố Vạn Hải (content/levels, ADR-007)', () => {
  it('asset của level có trong manifest (CC0/CC-BY) — texture, model, HDRI', () => {
    const ids = new Set(manifest.assets.map((a) => a.id));
    for (const t of def.textures) expect(ids.has(t), `texture ${t}`).toBe(true);
    for (const m of def.models) expect(ids.has(m), `model ${m}`).toBe(true);
    expect(ids.has(def.sky.hdri)).toBe(true);
  });

  it('prop chỉ dùng model đã khai báo (hoặc "pole" procedural); spawn/waypoint trong biên; zone A/B/C + station', () => {
    const models = new Set([...def.models, 'pole']);
    for (const p of def.props) expect(models.has(p.model), p.model).toBe(true);
    const b = def.bounds;
    const inside = (v: [number, number, number]): boolean => v[0] > b.xWest && v[0] < b.xEast && v[2] > b.zNorth && v[2] < b.zSouth;
    expect(inside(def.playerSpawn)).toBe(true);
    for (const [k, v] of Object.entries(def.botSpawns)) expect(inside(v), k).toBe(true);
    for (const w of def.waypoints) expect(inside(w)).toBe(true);
    for (const z of ['zone_a', 'zone_b', 'zone_c', 'station_zone', 'relay_zone', 'exfil_zone']) expect(def.zones[z], z).toBeDefined();
    expect(def.lots.length).toBeGreaterThan(30);
    expect(def.barricades.some((x) => x.kind === 'wreck_apc')).toBe(true);
    // TIP-021: model thật của barricade phải nằm trong `models` (được nạp) và có size (collider)
    for (const b of def.barricades) {
      if (!b.model) continue;
      expect(def.models.includes(b.model), b.model).toBe(true);
      expect(b.size?.length).toBe(3);
    }
    expect(def.barricades.filter((b) => b.model).length).toBeGreaterThanOrEqual(5);
    expect(def.props.filter((p) => p.model.startsWith('veh_')).length).toBeGreaterThanOrEqual(6);
    expect(def.fx.filter((f) => f.kind === 'fire').length).toBeLessThanOrEqual(8);
  });

  it('lot không chồng nhau trong cùng dãy và không rơi vào gap (hẻm/ngã tư)', () => {
    for (const side of ['west', 'east'] as const) {
      const lots = def.lots.filter((l) => l.side === side).sort((a, b) => a.z - b.z);
      for (let i = 1; i < lots.length; i++) {
        const prev = lots[i - 1]!;
        const cur = lots[i]!;
        expect(cur.z - cur.width / 2).toBeGreaterThanOrEqual(prev.z + prev.width / 2 - 0.01);
      }
      for (const l of lots) {
        for (const g of def.gaps.filter((x) => x.side === side)) {
          const overlap = l.z + l.width / 2 > g.z0 + 0.01 && l.z - l.width / 2 < g.z1 - 0.01;
          expect(overlap, `lot z=${l.z} trong gap ${g.z0}..${g.z1}`).toBe(false);
        }
      }
    }
  });

  it('mission Phố Vạn Hải: spawn group dùng spawn có trong level, zone có trong level', () => {
    const m = JSON.parse(readFileSync('content/missions/pho-van-hai.mission.json', 'utf8')) as { spawnGroups: Array<{ spawn: string }>; zones: Array<{ id: string }> };
    for (const g of m.spawnGroups) expect(def.botSpawns[g.spawn], g.spawn).toBeDefined();
    for (const z of m.zones) expect(def.zones[z.id], z.id).toBeDefined();
  });
});
