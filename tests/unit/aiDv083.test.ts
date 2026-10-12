/**
 * DV-083 AI dồn dập (M1-T3): lùm cây che tầm nhìn, nhóm săn bám người chơi, đạo diễn áp lực xông lên khi người chơi nấp lâu,
 * vé tấn công 4, đồng đội vào trận về tốc độ chiến đấu.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initNav } from '@engine/nav/navmesh';
import { initPhysics } from '@engine/physics/world';
import ai from '@content/tuning/ai.json';
import { makeSightOcclusion } from '@game/ai/sightOcclusion';
import { makeForest, AiHarness, type ForestWorld } from './aiWorld';

let w: ForestWorld;
beforeAll(async () => {
  await initPhysics();
  await initNav();
  w = makeForest(7);
});

describe('DV-083 lùm cây che tầm nhìn', () => {
  const n = 50;
  const cover = new Float32Array(n * n);
  const height = new Float32Array(n * n);
  // dải dương xỉ dày cao 1,2 m ở z ∈ [−10, −4]
  for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
    const z = -50 + iz * 2;
    if (z >= -10 && z < -4) {
      cover[iz * n + ix] = 1.2;
      height[iz * n + ix] = 1.2;
    }
  }
  const occ = makeSightOcclusion({ x0: -50, z0: -50, n, cell: 2, cover, height }, () => 0);
  it('nằm/cúi sau lùm dày: kín; đứng thẳng nhìn qua ngọn: thoáng; không có lùm: thoáng; sát (< 4,5 m): không che', () => {
    expect(occ([0, 0.6, 0], [0, 0.6, -20])).toBeGreaterThan(0.85);
    expect(occ([0, 1.7, 0], [0, 1.7, -20])).toBeLessThan(0.2);
    expect(occ([10, 0.6, 30], [10, 0.6, 10])).toBe(0);
    expect(occ([0, 0.6, -5], [0, 0.6, -9])).toBe(0);
  });
});

describe('DV-083 tổ địch', () => {
  it('vé tấn công 4, phát cảnh cáo 1, địch không vé vẫn bắn thật (lệch ≤ 0,3 m)', () => {
    expect(ai.cinematic.tokens).toBe(4);
    expect(ai.cinematic.warnShots).toBe(1);
    expect(ai.cinematic.noTokenAimOffsetM).toBeLessThanOrEqual(0.3);
  });

  it('nhóm săn tìm ra người chơi dù được báo sai chỗ; nhóm thường đi tới chỗ sai rồi bỏ (60 s)', () => {
    const run = (hunter: boolean): number => {
      const h = new AiHarness(w, { seed: 11, enemies: 4, playerSight: 0, spawn: [0, 0, -40] });
      for (const b of h.bots) {
        b.hunter = hunter;
        b.alertTo([-30, 1.6, -30]); // tin báo sai: lệch ~45 m
      }
      h.run(60);
      const live = h.bots.filter((b) => b.alive);
      const d = live.reduce((s, b) => s + Math.hypot(b.position[0] - h.player[0], b.position[2] - h.player[2]), 0) / Math.max(1, live.length);
      h.dispose();
      return d;
    };
    const dHunt = run(true);
    const dPlain = run(false);
    expect(dHunt).toBeLessThan(dPlain);
    expect(dHunt).toBeLessThan(30);
  });

  it('người chơi nấp lâu → địch xông lên (đạo diễn áp lực)', () => {
    const h = new AiHarness(w, { seed: 5, enemies: 4 });
    h.run(12);
    h.team.pressure = { pos: h.player, reloading: false, hiddenMs: 8000, alive: true };
    h.run(20);
    expect(h.team.stats.pushes).toBeGreaterThan(0);
    h.dispose();
  });
});
