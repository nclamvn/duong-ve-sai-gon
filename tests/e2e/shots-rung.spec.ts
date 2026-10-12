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
  // DV-082: bờ suối đoạn ghềnh (khe x = −48), nhìn xuống mặt nước xuôi dòng
  { name: '7-ghenh-suoi', x: -54, z: 598, yaw: -2.0344, pitch: -0.32 },
];

test.describe('ảnh rừng trước/sau', () => {
  test.skip(!OUT, 'chỉ chạy khi đặt DV_SHOTS');
  test('4 góc cố định', async ({ page }) => {
    test.setTimeout(1_800_000);
    await page.goto(`/?backend=webgl&level=truong-son&autostart=1&debug=1&quality=${process.env.DV_SHOTS_QUALITY ?? 'low'}&shadow=1024&calm=1${process.env.DV_SHOTS_Q ?? ''}`);
    await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 900_000 });
    await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 2, null, { timeout: 900_000 });
    await page.evaluate(() => {
      window.__ht!.game.stop();
      document.getElementById('hud')!.hidden = true;
      const sub = document.getElementById('subtitles');
      if (sub) sub.style.display = 'none';
    });
    const only = process.env.DV_SHOTS_ONLY?.split(',');
    for (const v of VIEWS.filter((x) => !only || only.some((o) => x.name.startsWith(o)))) {
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
    // DV-081: đồng đội gần nhất, camera 4,5 m phía trước người, nhìn về phía nắng (người ngược sáng → viền nắng, tán che)
    if (!only || only.some((o) => '6-dong-doi'.startsWith(o))) {
      const ok = await page.evaluate(() => {
        const H = window.__ht!;
        const g = H.game as unknown as { player: { rig: { yaw: number; pitch: number } }; lights: { sunDir?: number[] } };
        const sun = g.lights.sunDir ?? [0.5, 0.3, 0.5];
        const p0 = H.bots().filter((b) => b.alive)[0];
        if (!p0) return false;
        const l = Math.hypot(sun[0]!, sun[2]!) || 1;
        const sx = sun[0]! / l;
        const sz = sun[2]! / l;
        const x = p0.position[0] - sx * 4.5;
        const z = p0.position[2] - sz * 4.5;
        const y = H.terrainHeight(x, z) ?? p0.position[1];
        H.teleport(x, y + 0.05, z);
        g.player.rig.yaw = Math.atan2(-sx, -sz);
        g.player.rig.pitch = -0.02;
        return true;
      });
      if (ok) {
        await renderFramesRaf(page, 5);
        await page.screenshot({ path: `${OUT}/6-dong-doi.png` });
      }
    }
    // DV-082: cận cảnh chân đồng đội (bùn bám ủng, ống quần) — 2,2 m ngang, nhìn chếch xuống
    if (!only || only.some((o) => '8-bun-ung'.startsWith(o))) {
      const ok = await page.evaluate(() => {
        const H = window.__ht!;
        const g = H.game as unknown as { player: { rig: { yaw: number; pitch: number } } };
        const p0 = H.bots().filter((b) => b.alive)[0];
        if (!p0) return false;
        const x = p0.position[0] + 2.2;
        const z = p0.position[2] + 0.4;
        const y = H.terrainHeight(x, z) ?? p0.position[1];
        H.teleport(x, y + 0.05, z);
        g.player.rig.yaw = Math.atan2(2.2, 0.4);
        g.player.rig.pitch = -0.42;
        return true;
      });
      if (ok) {
        await renderFramesRaf(page, 5);
        await page.screenshot({ path: `${OUT}/8-bun-ung.png` });
      }
    }
  });
});
