/**
 * Ảnh cận cảnh mũ phe A (DV-068) để căn vị trí trên đầu Swat: trước, nghiêng 3/4, ngang, sau; và địch phe B để so dáng.
 * Không chạy trong CI: `DV_SHOTS=<thư mục> npx playwright test tests/e2e/shots-mu.spec.ts`.
 * `DV_HELMET="y,z,rx,scale"` thử vị trí khác mà không build lại.
 */
import { test } from '@playwright/test';
import { renderFramesRaf } from './helpers';

const OUT = process.env.DV_SHOTS;

test.describe('ảnh mũ phe A', () => {
  test.skip(!OUT, 'chỉ chạy khi đặt DV_SHOTS');
  test('cận cảnh 4 góc', async ({ page }) => {
    test.setTimeout(600_000);
    await page.goto(`/?backend=webgl&level=arena&autostart=1&debug=1&quality=low&shadow=1024&rain=0${process.env.DV_SHOTS_Q ?? ''}`);
    await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 300_000 });
    await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 2, null, { timeout: 300_000 });
    const views = [
      // yaw π: facing the camera (camera looks −z)
      { name: 'a-truoc', yaw: Math.PI },
      { name: 'b-ba-phan-tu', yaw: Math.PI - 0.7 },
      { name: 'c-ngang', yaw: Math.PI / 2 },
      { name: 'd-sau', yaw: 0.3 },
    ];
    const override = process.env.DV_HELMET ?? '';
    await page.evaluate((override) => {
      const H = window.__ht!;
      const g = H.game as unknown as {
        stop(): void;
        aiPaused: boolean;
        player: { baseFov: number; rig: { yaw: number; pitch: number }; controller: { feet: number[] } };
        vmScene: { visible: boolean };
        bots: Map<string, unknown>;
        spawnBot(id: string, grp: string, p: [number, number, number], o: { faction: 'friend' | 'enemy'; archetype?: 'grunt' | 'squad' }): { dummy: unknown };
      };
      g.stop();
      g.aiPaused = true;
      document.getElementById('hud')!.hidden = true;
      document.getElementById('subtitles')!.style.display = 'none';
      g.vmScene.visible = false;
      g.player.baseFov = 20;
      const f = g.player.controller.feet;
      const mk = (id: string, faction: 'friend' | 'enemy', dx: number): unknown => {
        const b = g.spawnBot(id, 'probe', [f[0]! + dx, f[1]!, f[2]! - 3.4], { faction, archetype: faction === 'friend' ? 'squad' : 'grunt' });
        g.bots.delete(id);
        return b.dummy;
      };
      const W = window as unknown as { __mu: unknown[] };
      W.__mu = [mk('mu_a', 'friend', -0.45), mk('mu_b', 'enemy', 0.45)];
      if (override) {
        const [y, z, rx, sc] = override.split(',').map(Number);
        const h = (W.__mu[0] as { gear?: { helmet?: { position: { y: number; z: number }; rotation: { x: number }; scale: { setScalar(s: number): void } } } }).gear?.helmet;
        if (h) {
          h.position.y = y!;
          h.position.z = z!;
          h.rotation.x = rx!;
          h.scale.setScalar(sc!);
        }
      }
      g.player.rig.yaw = 0;
      g.player.rig.pitch = 0.02;
    }, override);
    for (const v of views) {
      await page.evaluate((yaw) => {
        type Vis = { group: { rotation: { y: number } }; motion: { speed: number; aiming: boolean; yaw?: number }; setPose(t: number): void };
        const W = window as unknown as { __mu: Vis[] };
        // soldiers face the camera (+z) then rotate by yaw; stand idle for a moment so the pose settles
        let t = 500;
        for (const s of W.__mu) {
          s.motion.yaw = yaw;
          s.motion.speed = 0;
          s.motion.aiming = false;
          (s as unknown as { char?: { controller: { reset(y: number): void } } }).char?.controller.reset(yaw);
          for (let i = 0; i < 40; i++) s.setPose((t += 1 / 30));
        }
      }, v.yaw);
      await renderFramesRaf(page, 3);
      await page.screenshot({ path: `${OUT}/${v.name}.png` });
    }
  });
});
