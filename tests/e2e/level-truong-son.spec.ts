import { test, expect } from '@playwright/test';
import { pauseLoop, expectNoErrors } from './helpers';

/**
 * TIP-D04 — Trường Sơn (terrain DEM): E2E vật lý người chơi bắt buộc cho mọi level mới (DV-009/D-075).
 * Đứng trên terrain, đi lên dốc thoải không xuyên đất, dốc quá maxSlope (50°) không leo được; navmesh có poly; terrain ≤ 4 draw.
 * Chạy nhẹ: assets=0 (không model/HDRI; texture vẫn nạp), không nhân vật/súng.
 */
const QUERY = 'backend=webgl&level=truong-son&autostart=1&debug=1&quality=low&post=off&shadow=512&assets=0&character=0&weapons=0&arms=0';

test.describe('Trường Sơn — vật lý terrain (TIP-D04)', () => {
  test('đứng/đi lên dốc/không leo dốc đứng; heightfield + navmesh + LOD', async ({ page }) => {
    test.setTimeout(300_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text());
    });
    await page.goto(`/?${QUERY}`);
    await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 90_000 });
    await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 2, null, { timeout: 120_000 });
    await pauseLoop(page);
    const r = await page.evaluate(() => {
      const H = window.__ht!;
      const g = H.game;
      g.aiPaused = true;
      const c = g.player.controller;
      const hAt = (x: number, z: number): number => H.terrainHeight(x, z) ?? NaN;
      const idle = (): void => {
        g.input = { kind: 'replay', snapshot: (_t, o) => { o.fwd = 0; o.right = 0; o.sprint = false; o.crouch = false; o.jump = false; o.reload = false; o.interact = false; o.dx = 0; o.dy = 0; o.ads = false; o.fire = false; } };
      };
      const move = (fwd: number, sprint: boolean): void => {
        g.input = { kind: 'replay', snapshot: (_t, o) => { o.fwd = fwd; o.right = 0; o.sprint = sprint; o.crouch = false; o.jump = false; o.reload = false; o.interact = false; o.dx = 0; o.dy = 0; o.ads = false; o.fire = false; } };
      };
      const feet = (): [number, number, number] => [c.feet[0]!, c.feet[1]!, c.feet[2]!];
      const gap = (): number => c.feet[1]! - hAt(c.feet[0]!, c.feet[2]!);
      /** yaw để forward = hướng (dx, dz): forward = (−sin yaw, 0, −cos yaw) */
      const yawTo = (dx: number, dz: number): number => Math.atan2(-dx, -dz);
      // 1) đứng yên 3 s
      idle();
      H.stepSim(180);
      const stand = { feet: feet(), gap: gap(), grounded: c.grounded };
      // 2) hướng lên dốc thoải: gradient tại spawn
      const [x0, , z0] = feet();
      const e = 4;
      const gx = (hAt(x0 + e, z0) - hAt(x0 - e, z0)) / (2 * e);
      const gz = (hAt(x0, z0 + e) - hAt(x0, z0 - e)) / (2 * e);
      const gl = Math.hypot(gx, gz) || 1;
      g.player.rig.reset(yawTo(gx / gl, gz / gl), 0);
      move(1, true);
      let minGap = Infinity;
      let maxGap = -Infinity;
      let anyAir = 0;
      for (let k = 0; k < 8; k++) {
        H.stepSim(60);
        const gp = gap();
        if (gp < minGap) minGap = gp;
        if (gp > maxGap) maxGap = gp;
        if (!c.grounded) anyAir++;
      }
      const [x1, y1, z1] = feet();
      const walk = { dist: Math.hypot(x1 - x0, z1 - z0), climb: y1 - stand.feet[1], minGap, maxGap, anyAir, slopeDeg: (Math.atan(gl) * 180) / Math.PI };
      // 3) dốc đứng: quét quanh spawn (bán kính ≤ 300 m, bước 6 m) tìm ô dốc > 58°, đứng ở chân dốc và đi lên 4 s
      let steep: { x: number; z: number; deg: number; dx: number; dz: number } | null = null;
      for (let rad = 30; rad <= 300 && !steep; rad += 6) {
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 24) {
          const sx = x0 + Math.cos(a) * rad;
          const sz = z0 + Math.sin(a) * rad;
          const dx = (hAt(sx + 2, sz) - hAt(sx - 2, sz)) / 4;
          const dz = (hAt(sx, sz + 2) - hAt(sx, sz - 2)) / 4;
          const deg = (Math.atan(Math.hypot(dx, dz)) * 180) / Math.PI;
          // dốc đứng liên tục ≥ 6 m theo hướng lên
          const l = Math.hypot(dx, dz) || 1;
          const ux = dx / l;
          const uz = dz / l;
          const d2 = (hAt(sx + ux * 6, sz + uz * 6) - hAt(sx, sz)) / 6;
          if (deg > 58 && (Math.atan(d2) * 180) / Math.PI > 52) {
            steep = { x: sx, z: sz, deg, dx: ux, dz: uz };
            break;
          }
        }
      }
      let steepRes: { start: number; end: number; climb: number; deg: number } | null = null;
      if (steep) {
        // chân dốc: lùi 3 m theo hướng xuống
        const bx = steep.x - steep.dx * 3;
        const bz = steep.z - steep.dz * 3;
        c.teleport(bx, hAt(bx, bz) + 0.1, bz);
        g.player.rig.reset(yawTo(steep.dx, steep.dz), 0);
        idle();
        H.stepSim(60);
        const y0 = c.feet[1]!;
        move(1, false);
        H.stepSim(240);
        steepRes = { start: y0, end: c.feet[1]!, climb: c.feet[1]! - y0, deg: steep.deg };
      }
      const ts = H.terrainStats();
      return {
        level: g.levelId,
        collider: g.arena.colliders.find((x) => x.id === 'terrain')?.kind,
        stand,
        walk,
        steep: steepRes,
        navPolys: g.nav.polyCount,
        navPrebuilt: ts?.navPrebuilt ?? false,
        terrainDraws: ts?.draws ?? -1,
        bots: H.bots().length,
        // TIP-D11a: bot tuần tra bám mặt đất (không "bay" theo y góc kế của path) — đo sau 3 s sim
        botGap: (() => {
          H.stepSim(180);
          return H.bots().map((b) => Math.abs(b.position[1] - hAt(b.position[0], b.position[2])));
        })(),
      };
    });
    expect(r.level).toBe('truong-son');
    expect(r.collider).toBe('heightfield');
    // đứng 3 s: chân cách mặt đất ≤ 0,3 m, không rơi
    expect(r.stand.grounded).toBe(true);
    expect(Math.abs(r.stand.gap)).toBeLessThan(0.3);
    // đi lên dốc thoải 8 s: tiến ≥ 15 m, luôn ≥ mặt đất − 0,3 (không xuyên), không bay quá 0,6 m
    expect(r.walk.dist).toBeGreaterThan(15);
    expect(r.walk.minGap).toBeGreaterThan(-0.3);
    expect(r.walk.maxGap).toBeLessThan(0.6);
    expect(r.walk.climb).toBeGreaterThan(0);
    // dốc > 58°: đi 4 s leo < 2,5 m (maxSlopeDeg 50)
    expect(r.steep, 'không tìm thấy dốc đứng trong 300 m quanh spawn').not.toBeNull();
    expect(r.steep!.climb).toBeLessThan(2.5);
    expect(r.navPolys).toBeGreaterThan(0);
    expect(r.bots).toBeGreaterThan(0);
    for (const gap of r.botGap) expect(gap).toBeLessThan(0.5);
    expect(r.terrainDraws).toBeGreaterThan(0);
    expect(r.terrainDraws).toBeLessThanOrEqual(4);
    expect(r.bots).toBe(1);
    await expectNoErrors(errors);
  });

  /**
   * TIP-D05 — rừng loài thật (PRD VEG-001/004/006): scatter seeded → batch instanced theo ô + LOD + impostor; thân cây có collider.
   * `veg=1` bật rừng dù lite (assets=0). Ngưỡng ở quality=low (density 0,5 · lodScale 0,6): 9 loài, draw rừng ≤ 140, tam giác rừng ≤ 1,5 M,
   * tổng renderer ≤ 4 M (ngân sách đỏ PRD); người chơi đi thẳng vào thân cây 4 s không xuyên (khoảng cách tới trục ≥ r + bán kính capsule − 5 cm).
   */
  test('rừng: batch/LOD/impostor trong ngân sách; thân cây chặn người chơi; gió; không lỗi console', async ({ page }) => {
    test.setTimeout(300_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text());
    });
    await page.goto(`/?${QUERY}&veg=1`);
    await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 120_000 });
    await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 2, null, { timeout: 120_000 });
    await pauseLoop(page);
    const r = await page.evaluate(async () => {
      const H = window.__ht!;
      const g = H.game;
      g.aiPaused = true;
      const c = g.player.controller;
      const hAt = (x: number, z: number): number => H.terrainHeight(x, z) ?? NaN;
      const idle = (): void => {
        g.input = { kind: 'replay', snapshot: (_t, o) => { o.fwd = 0; o.right = 0; o.sprint = false; o.crouch = false; o.jump = false; o.reload = false; o.interact = false; o.dx = 0; o.dy = 0; o.ads = false; o.fire = false; } };
      };
      const move = (fwd: number, sprint: boolean): void => {
        g.input = { kind: 'replay', snapshot: (_t, o) => { o.fwd = fwd; o.right = 0; o.sprint = sprint; o.crouch = false; o.jump = false; o.reload = false; o.interact = false; o.dx = 0; o.dy = 0; o.ads = false; o.fire = false; } };
      };
      const yawTo = (dx: number, dz: number): number => Math.atan2(-dx, -dz);
      // renderer.info reset theo rAF frame → mỗi frame đo trong một tick rAF riêng (frame() liên tiếp trong 1 task sẽ cộng dồn)
      const frameRaf = (): Promise<void> => new Promise((res) => requestAnimationFrame(() => { g.frame(1 / 60); res(); }));
      // thống kê tại spawn, quét 4 hướng để lấy max
      const stats: Array<{ draws: number; tris: number; total: number; calls: number; visible: number; imp: number }> = [];
      for (let k = 0; k < 4; k++) {
        g.player.rig.reset((k * Math.PI) / 2, 0);
        for (let i = 0; i < (k === 0 ? 2 : 1); i++) await frameRaf();
        const v = H.vegetationStats()!;
        const m = H.metrics();
        stats.push({ draws: v.draws, tris: v.triangles, total: m.triangles, calls: m.calls, visible: v.visible, imp: v.impostors });
      }
      const v0 = H.vegetationStats()!;
      // collider thân cây gần spawn nhất (tree_gn) → đứng cách 3 m, đi thẳng vào 4 s
      const ps = g.arena.playerSpawn;
      const trunks = g.arena.colliders.filter((x) => x.id.startsWith('veg_tree_gn_'));
      let best = trunks[0]!;
      let bd = Infinity;
      for (const t of trunks) {
        const d = Math.hypot(t.position[0] - ps[0], t.position[2] - ps[2]);
        if (d < bd) { bd = d; best = t; }
      }
      const r = best.size[0];
      const tx = best.position[0];
      const tz = best.position[2];
      const ang = 0.7;
      const sx = tx + Math.sin(ang) * 3;
      const sz = tz + Math.cos(ang) * 3;
      c.teleport(sx, hAt(sx, sz) + 0.1, sz);
      g.player.rig.reset(yawTo(tx - sx, tz - sz), 0);
      idle();
      H.stepSim(30);
      move(1, false);
      let minD = Infinity;
      let maxD = 0;
      for (let k = 0; k < 8; k++) {
        H.stepSim(30);
        const d = Math.hypot(c.feet[0]! - tx, c.feet[2]! - tz);
        if (d < minD) minD = d;
        if (d > maxD) maxD = d;
      }
      idle();
      // gió: đổi strength không lỗi
      H.setWind(0.9, 1, 0);
      await frameRaf();
      H.setWind(0.35);
      const gap = c.feet[1]! - hAt(c.feet[0]!, c.feet[2]!);
      return {
        species: v0.species,
        placed: v0.placed,
        perSpecies: v0.perSpecies,
        colliders: v0.colliders,
        loadMs: v0.loadMs,
        bakeMs: v0.bakeMs,
        cpuMs: v0.cpuMs,
        stats,
        trunk: { r, distFromSpawn: bd, minD, maxD, capsule: c.cfg.radius, gap, grounded: c.grounded },
        atlasTree: !!g.forest?.atlases['tree_gn'],
      };
    });
    expect(r.species).toBe(9);
    expect(r.placed).toBeGreaterThan(10_000);
    expect(r.perSpecies['tree_gn']).toBeGreaterThan(500);
    expect(r.colliders).toBeGreaterThan(1000);
    expect(r.atlasTree).toBe(true);
    for (const s of r.stats) {
      expect(s.draws, JSON.stringify(r.stats)).toBeGreaterThan(10);
      expect(s.draws).toBeLessThanOrEqual(140);
      expect(s.tris).toBeLessThanOrEqual(1_500_000);
      expect(s.total).toBeLessThanOrEqual(4_000_000);
      expect(s.calls, JSON.stringify(r.stats)).toBeLessThanOrEqual(280);
    }
    expect(Math.max(...r.stats.map((s) => s.visible))).toBeGreaterThan(100);
    expect(Math.max(...r.stats.map((s) => s.imp))).toBeGreaterThan(20);
    expect(r.cpuMs).toBeLessThan(8);
    // thân cây: không xuyên (tâm capsule cách trục ≥ r + capsule − 5 cm), vẫn đứng trên đất
    expect(r.trunk.minD).toBeGreaterThanOrEqual(r.trunk.r + r.trunk.capsule - 0.05);
    expect(r.trunk.minD).toBeLessThan(3);
    expect(Math.abs(r.trunk.gap)).toBeLessThan(0.4);
    await expectNoErrors(errors);
  });
});
