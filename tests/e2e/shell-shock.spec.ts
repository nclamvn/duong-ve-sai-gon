import { test, expect } from '@playwright/test';
import { pauseLoop, expectNoErrors } from './helpers';

/**
 * DV-088 gói A "tàn khốc điện ảnh": nổ sát người → choáng (ù tai, nhìn đôi, loạng choạng, chân nặng), mưa đất, bùn lên ống kính,
 * vết cháy xém; đạn sượt → đất văng quanh chân. Nổ xa không choáng. Choáng tắt hết sau vài giây. Post low (shader choáng biên dịch).
 */
const QUERY = 'backend=webgl&level=truong-son&autostart=1&debug=1&quality=low&post=low&shadow=512&assets=0&character=0&weapons=0&arms=0&calm=1';

test.describe('DV-088 choáng nổ + đất văng', () => {
  test.setTimeout(240_000);
  test('nổ sát: choáng, mưa đất, bùn ống kính, cháy xém; nổ xa: không; đạn sượt: đất văng chân', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text());
    });
    await page.goto(`/?${QUERY}`);
    await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 120_000 });
    await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 2, null, { timeout: 120_000 });
    await pauseLoop(page);

    const r = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window.__ht as any).raw;
      const f = g.player.controller.feet as number[];
      const groundAt = (x: number, z: number): number => g.terrain.heightAt(x, z);
      const snap = () => ({
        shock: g.shockLevel as number,
        post: g.post.shock.value as number,
        speedMul: g.player.controller.speedMul as number,
        roll: Math.abs(g.player.rig.stumbleRoll) + Math.abs(g.player.rig.stumblePitch),
        lens: g.lensDirt?.opacity ?? -1,
        splats: g.lensDirt?.splats ?? -1,
        scorch: g.scorch?.stats.placed ?? -1,
        rains: g.blast.stats.rains as number,
        count: g.shockStats.count as number,
      });
      const before = snap();
      // nổ xa 70 m: không choáng
      const fx = f[0]! + 70;
      g.explode([fx, groundAt(fx, f[2]!), f[2]!], { radius: 6, damage: 0 });
      for (let i = 0; i < 3; i++) g.frame(1 / 60);
      const far = snap();
      // nổ sát 3 m
      const nx = f[0]! + 3;
      g.explode([nx, groundAt(nx, f[2]!), f[2]!], { radius: 6, damage: 0 });
      for (let i = 0; i < 12; i++) g.frame(1 / 60);
      const near = snap();
      // đạn sượt: 8 viên từ 12 m bay sát đầu
      const eye = [f[0]!, f[1]! + 1.6, f[2]!];
      let kicks0 = g.shockStats.dirtKicks as number;
      for (let i = 0; i < 8; i++) {
        const o = [eye[0]! + 1.0, eye[1]! + 0.3, eye[2]! - 12];
        const d = [eye[0]! + 0.6 - o[0]!, eye[1]! - o[1]!, eye[2]! - o[2]!];
        const L = Math.hypot(d[0]!, d[1]!, d[2]!);
        g.playerNearMiss(o, [d[0]! / L, d[1]! / L, d[2]! / L], 'enemy');
      }
      const kicks = (g.shockStats.dirtKicks as number) - kicks0;
      kicks0 = g.nearMissStats.count;
      // 7 s sau: hết choáng, hết bùn, chân nhẹ lại
      for (let i = 0; i < 70; i++) g.frame(0.1);
      const after = snap();
      return { before, far, near, kicks, nearMisses: kicks0, after };
    });
    console.log(JSON.stringify(r));
    expect(r.before.shock).toBe(0);
    expect(r.far.count).toBe(r.before.count);
    expect(r.far.shock).toBe(0);
    expect(r.far.scorch).toBe(r.before.scorch + 1);
    expect(r.near.count).toBe(r.before.count + 1);
    expect(r.near.shock).toBeGreaterThan(0.6);
    expect(r.near.post).toBeGreaterThan(0.5);
    expect(r.near.speedMul).toBeLessThan(0.75);
    expect(r.near.roll).toBeGreaterThan(0.01);
    expect(r.near.lens).toBeGreaterThan(0.5);
    expect(r.near.splats).toBe(r.before.splats + 1);
    expect(r.near.rains).toBe(r.before.rains + 1);
    expect(r.near.scorch).toBe(r.before.scorch + 2);
    expect(r.nearMisses).toBeGreaterThan(0);
    expect(r.kicks).toBeGreaterThan(0);
    expect(r.after.shock).toBe(0);
    expect(r.after.post).toBe(0);
    expect(r.after.speedMul).toBe(1);
    expect(r.after.lens).toBe(0);
    expectNoErrors(errors);
  });
});
