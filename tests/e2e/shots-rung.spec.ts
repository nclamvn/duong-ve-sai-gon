/**
 * Ảnh so sánh trước/sau cho cảnh rừng (DV-063): 4 góc cố định ở M1 (chỗ xuất phát, bờ suối, hố bom đọng nước, đường mòn).
 * Không chạy trong CI: `DV_SHOTS=<thư mục> npx playwright test tests/e2e/shots-rung.spec.ts`.
 * Sandbox là SwiftShader chất lượng thấp, chỉ để so trước/sau; chấm hình thật trên Mac.
 */
import { test } from '@playwright/test';
import { renderFramesRaf } from './helpers';

const OUT = process.env.DV_SHOTS;
const VIEWS: Array<{ name: string; x: number; z: number; yaw: number; pitch: number }> = [
  { name: '1-xuat-phat', x: -134, z: 580, yaw: 0.6, pitch: -0.05 },
  { name: '2-bo-suoi', x: -60, z: 580, yaw: -Math.PI / 2, pitch: -0.18 },
  { name: '3-ho-bom', x: -153.8, z: 609.4, yaw: Math.PI / 2, pitch: -0.25 },
  { name: '4-duong-mon', x: -186, z: 524, yaw: Math.PI / 4, pitch: -0.04 },
  // nhìn về phía mặt trời bình minh (phương vị ~112° la bàn → engine 68°): tia nắng xuyên tán
  { name: '5-nguoc-nang', x: -134, z: 580, yaw: -1.95, pitch: 0.1 },
];

test.describe('ảnh rừng trước/sau', () => {
  test.skip(!OUT, 'chỉ chạy khi đặt DV_SHOTS');
  test('4 góc cố định', async ({ page }) => {
    test.setTimeout(900_000);
    await page.goto(`/?backend=webgl&level=truong-son&autostart=1&debug=1&quality=low&shadow=1024${process.env.DV_SHOTS_Q ?? ''}`);
    await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 300_000 });
    await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 2, null, { timeout: 300_000 });
    await page.evaluate(() => {
      window.__ht!.game.stop();
      document.getElementById('hud')!.hidden = true;
    });
    for (const v of VIEWS) {
      await page.evaluate((v) => {
        const g = window.__ht!.game as unknown as { player: { rig: { yaw: number; pitch: number } } };
        const y = window.__ht!.terrainHeight(v.x, v.z) ?? 0;
        window.__ht!.teleport(v.x, y + 0.05, v.z);
        g.player.rig.yaw = v.yaw;
        g.player.rig.pitch = v.pitch;
      }, v);
      await renderFramesRaf(page, 5);
      await page.screenshot({ path: `${OUT}/${v.name}.png` });
    }
  });
});
