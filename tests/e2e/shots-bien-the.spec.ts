/**
 * Ảnh đội hình kiểm biến thể ngoại hình (DV-070): 5 lính phe A và 5 lính phe B đứng hai hàng nhìn camera.
 * Không chạy trong CI: `DV_SHOTS=<thư mục> npx playwright test tests/e2e/shots-bien-the.spec.ts`.
 */
import { test } from '@playwright/test';
import { renderFramesRaf } from './helpers';

const OUT = process.env.DV_SHOTS;

test.describe('ảnh biến thể lính', () => {
  test.skip(!OUT, 'chỉ chạy khi đặt DV_SHOTS');
  test('hai hàng', async ({ page }) => {
    test.setTimeout(600_000);
    await page.goto(`/?backend=webgl&level=arena&autostart=1&debug=1&quality=low&shadow=1024&rain=0${process.env.DV_SHOTS_Q ?? ''}`);
    await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 300_000 });
    await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 2, null, { timeout: 300_000 });
    await page.evaluate(() => {
      const H = window.__ht!;
      type Vis = { motion: { speed: number; aiming: boolean; yaw?: number }; setPose(t: number): void; char?: { controller: { reset(y: number): void } } };
      const g = H.game as unknown as {
        stop(): void;
        aiPaused: boolean;
        player: { baseFov: number; rig: { yaw: number; pitch: number }; controller: { feet: number[] } };
        vmScene: { visible: boolean };
        dummies: Array<{ group: { visible: boolean } }>;
        bots: Map<string, unknown>;
        spawnBot(id: string, grp: string, p: [number, number, number], o: { faction: 'friend' | 'enemy'; archetype?: 'grunt' | 'squad' }): { dummy: Vis };
      };
      g.stop();
      g.aiPaused = true;
      document.getElementById('hud')!.hidden = true;
      document.getElementById('subtitles')!.style.display = 'none';
      g.vmScene.visible = false;
      g.player.baseFov = 40;
      for (const d of g.dummies) d.group.visible = false;
      const f = g.player.controller.feet;
      const all: Vis[] = [];
      for (let i = 0; i < 5; i++) {
        for (const [row, faction] of [[0, 'friend'], [1, 'enemy']] as const) {
          const id = `${faction}_${i + 1}`;
          const b = g.spawnBot(id, 'probe', [f[0]! + (i - 2) * 0.9 + row * 0.45, f[1]!, f[2]! - 4.2 - row * 1.4], { faction, archetype: faction === 'friend' ? 'squad' : 'grunt' });
          g.bots.delete(id);
          all.push(b.dummy);
        }
      }
      let t = 700;
      for (const s of all) {
        s.motion.yaw = Math.PI;
        s.motion.speed = 0;
        s.char?.controller.reset(Math.PI);
        for (let k = 0; k < 40; k++) s.setPose((t += 1 / 30));
      }
      g.player.rig.yaw = 0;
      g.player.rig.pitch = -0.02;
    });
    await renderFramesRaf(page, 3);
    await page.screenshot({ path: `${OUT}/doi-hinh.png` });
  });
});
