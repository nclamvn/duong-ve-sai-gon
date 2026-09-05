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
    expect(r.terrainDraws).toBeGreaterThan(0);
    expect(r.terrainDraws).toBeLessThanOrEqual(4);
    expect(r.bots).toBe(1);
    await expectNoErrors(errors);
  });
});
