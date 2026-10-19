/**
 * Ảnh chuỗi choáng nổ (DV-088): trước nổ, 0,1 s (chớp trắng + cầu lửa + nhìn đôi), 0,6 s (mưa đất + bùn ống kính),
 * 2 s, 7 s (đã hồi) và nhìn xuống vết cháy xém. Không chạy trong CI: `DV_SHOTS=<thư mục> npx playwright test tests/e2e/shots-shock.spec.ts`.
 */
import { test } from '@playwright/test';
import { renderFramesRaf } from './helpers';

const OUT = process.env.DV_SHOTS;

test.describe('ảnh choáng nổ', () => {
  test.skip(!OUT, 'chỉ chạy khi đặt DV_SHOTS');
  test('chuỗi 6 ảnh', async ({ page }) => {
    test.setTimeout(1_800_000);
    await page.goto(`/?backend=webgl&level=truong-son&autostart=1&debug=1&quality=${process.env.DV_SHOTS_QUALITY ?? 'low'}&shadow=1024&calm=1${process.env.DV_SHOTS_Q ?? ''}`);
    await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 900_000 });
    await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 2, null, { timeout: 900_000 });
    await page.evaluate(() => {
      window.__ht!.game.stop();
      document.getElementById('hud')!.hidden = true;
      const sub = document.getElementById('subtitles');
      if (sub) sub.style.display = 'none';
      const y = window.__ht!.terrainHeight(-134, 580) ?? 0;
      window.__ht!.teleport(-134, y + 0.05, 580);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window.__ht as any).raw;
      g.player.rig.yaw = 0.6;
      g.player.rig.pitch = -0.04;
    });
    await renderFramesRaf(page, 20);
    await page.screenshot({ path: `${OUT}/01-truoc-no.png` });
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window.__ht as any).raw;
      const f = g.player.controller.feet as number[];
      const yaw = g.player.rig.yaw as number;
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      const x = f[0]! + fx * 6 + -fz * 2;
      const z = f[2]! + fz * 6 + fx * 2;
      g.explode([x, g.terrain.heightAt(x, z), z], { radius: 6, damage: 0 });
    });
    // bước lớn (SwiftShader chậm): 0,1 s → 0,6 s → 2 s → 7 s
    const shots: Array<[string, number, number]> = [['02-no-0.1s', 3, 1 / 30], ['03-no-0.6s', 15, 1 / 30], ['04-no-2s', 14, 0.1], ['05-no-7s', 25, 0.2]];
    for (const [name, n, dt] of shots) {
      await page.evaluate(
        async ([k, d]) => {
          for (let i = 0; i < k; i++) await new Promise<void>((res) => requestAnimationFrame(() => (window.__ht!.game.frame(d), res())));
        },
        [n, dt] as const,
      );
      await page.screenshot({ path: `${OUT}/${name}.png` });
    }
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window.__ht as any).raw;
      g.player.rig.pitch = -0.55;
    });
    await renderFramesRaf(page, 10);
    await page.screenshot({ path: `${OUT}/06-vet-chay-xem.png` });
  });
});
