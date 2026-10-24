import { test, expect } from '@playwright/test';
import { pauseLoop, expectNoErrors } from './helpers';

/**
 * DV-091 chống giật: lính cùng phe dùng chung chương trình shader. Lính thứ hai trở đi xuất hiện trong tầm nhìn
 * không được sinh thêm chương trình mới (mỗi chương trình mới = biên dịch giữa trận = đứng hình).
 */
const QUERY = 'backend=webgl&level=truong-son-a&autostart=1&debug=1&quality=low&post=off&shadow=512&calm=1&veg=0';

test.describe('DV-091 shader dùng chung', () => {
  test.setTimeout(300_000);
  test('lính cùng phe thứ 2..8 không sinh chương trình shader mới', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text());
    });
    await page.goto(`/?${QUERY}`);
    await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 180_000 });
    await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 2, null, { timeout: 180_000 });
    await pauseLoop(page);
    const r = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window.__ht as any).raw;
      const pl = g.bundle.renderer._pipelines;
      const count = (): { frag: number; vert: number; pipes: number } => ({ frag: pl.programs.fragment.size, vert: pl.programs.vertex.size, pipes: pl.caches.size });
      const f = g.player.controller.feet as number[];
      const yaw = g.player.rig.yaw as number;
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      const at = (k: number): [number, number, number] => {
        const x = f[0]! + fx * (8 + k * 1.5) + fz * (k % 2 ? 1.5 : -1.5);
        const z = f[2]! + fz * (8 + k * 1.5) - fx * (k % 2 ? 1.5 : -1.5);
        return [x, g.terrain.heightAt(x, z) + 0.1, z];
      };
      const t0 = performance.now();
      g.spawnBot('zz_e0', 'probe', at(0), { faction: 'enemy' });
      g.spawnBot('zz_f0', 'probe', at(1), { faction: 'friend' });
      for (let i = 0; i < 3; i++) g.frame(1 / 60);
      const first = count();
      const tFirst = performance.now() - t0;
      const t1 = performance.now();
      for (let i = 1; i < 8; i++) {
        g.spawnBot(`zz_e${i}`, 'probe', at(2 + i), { faction: 'enemy' });
        g.spawnBot(`zz_f${i}`, 'probe', at(10 + i), { faction: 'friend' });
      }
      for (let i = 0; i < 3; i++) g.frame(1 / 60);
      const more = count();
      const tMore = performance.now() - t1;
      return { first, more, tFirst, tMore, character: !!g.assets?.character };
    });
    console.log(JSON.stringify(r));
    test.skip(!r.character, 'không có asset nhân vật');
    expect(r.more.frag - r.first.frag, 'chương trình fragment mới khi thêm 14 lính cùng loại').toBeLessThanOrEqual(1);
    expect(r.more.pipes - r.first.pipes, 'pipeline mới khi thêm 14 lính cùng loại').toBeLessThanOrEqual(2);
    expectNoErrors(errors);
  });
});
