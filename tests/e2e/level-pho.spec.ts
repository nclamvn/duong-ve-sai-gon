import { test, expect } from '@playwright/test';
import { pauseLoop, expectNoErrors } from './helpers';

/**
 * TIP-019/021 — Phố Vạn Hải: level mặc định phải chơi được về vật lý (hồi quy: builder thiếu collider mặt đất → người chơi rơi
 * xuyên đất, chỉ thấy trời; bot đi navmesh nên probe 2 frame không lộ). Chạy nhẹ: assets=0 (procedural), không nhân vật/súng.
 */
const QUERY = 'backend=webgl&level=pho&autostart=1&debug=1&quality=low&post=off&shadow=512&assets=0&character=0&weapons=0&arms=0';

test.describe('Phố Vạn Hải — vật lý level (TIP-019/021)', () => {
  test('người chơi đứng trên đất, chạy tới chốt A bị bao cát chặn, lên vỉa hè 15 cm; collider floor + vỉa hè có mặt', async ({ page }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text());
    });
    await page.goto(`/?${QUERY}`);
    await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 60_000 });
    await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 2, null, { timeout: 120_000 });
    await pauseLoop(page);
    const r = await page.evaluate(() => {
      const H = window.__ht!;
      const g = H.game;
      g.aiPaused = true;
      const c = g.player.controller;
      const idle = (): void => {
        g.input = { kind: 'replay', snapshot: (_t, o) => { o.fwd = 0; o.right = 0; o.sprint = false; o.crouch = false; o.jump = false; o.reload = false; o.interact = false; o.dx = 0; o.dy = 0; o.ads = false; o.fire = false; } };
      };
      const move = (fwd: number, right: number, sprint: boolean): void => {
        g.input = { kind: 'replay', snapshot: (_t, o) => { o.fwd = fwd; o.right = right; o.sprint = sprint; o.crouch = false; o.jump = false; o.reload = false; o.interact = false; o.dx = 0; o.dy = 0; o.ads = false; o.fire = false; } };
      };
      const snap = (): { feet: number[]; grounded: boolean } => ({ feet: [...c.feet].map((v) => +v.toFixed(3)), grounded: c.grounded });
      idle();
      H.stepSim(180);
      const a = snap();
      move(1, 0, true);
      H.stepSim(360);
      const b = snap();
      move(0, -1, false);
      H.stepSim(240);
      const d = snap();
      return {
        level: g.levelId,
        floor: g.arena.colliders.some((x) => x.id === 'floor'),
        walks: g.arena.colliders.filter((x) => x.id.startsWith('walk')).length,
        a,
        b,
        d,
        bots: H.bots().length,
        navPolys: g.nav.polyCount,
      };
    });
    expect(r.level).toBe('pho');
    expect(r.floor).toBe(true);
    expect(r.walks).toBeGreaterThanOrEqual(6);
    // đứng yên 3 s: không rơi
    expect(r.a.grounded).toBe(true);
    expect(Math.abs(r.a.feet[1]!)).toBeLessThan(0.1);
    // chạy 6 s về bắc: tới trước chốt A (bao cát z ≈ 40), vẫn trên đất
    expect(r.b.grounded).toBe(true);
    expect(r.b.feet[2]!).toBeLessThan(50);
    expect(r.b.feet[2]!).toBeGreaterThan(38);
    expect(Math.abs(r.b.feet[1]!)).toBeLessThan(0.1);
    // sang trái 4 s: lên vỉa hè tây (x ≤ −6), cao 0,15 m
    expect(r.d.grounded).toBe(true);
    expect(r.d.feet[0]!).toBeLessThan(-6);
    expect(r.d.feet[1]!).toBeGreaterThan(0.1);
    expect(r.d.feet[1]!).toBeLessThan(0.3);
    expect(r.navPolys).toBeGreaterThan(0);
    await expectNoErrors(errors);
  });
});
