/**
 * Ảnh so sánh bám chân trên dốc (DV-070): hai lính đứng ngang dốc nhìn camera; trái tắt foot IK, phải bật.
 * Không chạy trong CI: `DV_SHOTS=<thư mục> npx playwright test tests/e2e/shots-doc.spec.ts`.
 */
import { test } from '@playwright/test';
import { renderFramesRaf } from './helpers';

const OUT = process.env.DV_SHOTS;

test.describe('ảnh bám chân trên dốc', () => {
  test.skip(!OUT, 'chỉ chạy khi đặt DV_SHOTS');
  test('dốc ngang', async ({ page }) => {
    test.setTimeout(900_000);
    await page.goto('/?backend=webgl&level=truong-son&autostart=1&debug=1&quality=low&shadow=1024&veg=0');
    await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 300_000 });
    await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 2, null, { timeout: 300_000 });
    const info = await page.evaluate(() => {
      const H = window.__ht!;
      type Vis = { motion: { speed: number; aiming: boolean; yaw?: number }; setPose(t: number): void; ground: unknown; group: { position: { set(x: number, y: number, z: number): void } }; char?: { controller: { reset(y: number): void } } };
      const g = H.game as unknown as {
        stop(): void;
        aiPaused: boolean;
        player: { baseFov: number; rig: { yaw: number; pitch: number } };
        vmScene: { visible: boolean };
        bots: Map<string, { bot: { position: number[] } }>;
        spawnBot(id: string, grp: string, p: [number, number, number], o: { faction: 'friend' | 'enemy'; archetype?: 'grunt' | 'squad' }): { dummy: Vis };
      };
      g.stop();
      g.aiPaused = true;
      document.getElementById('hud')!.hidden = true;
      document.getElementById('subtitles')!.style.display = 'none';
      g.vmScene.visible = false;
      g.player.baseFov = 35;
      for (const b of g.bots.values()) b.bot.position[2] = (b.bot.position[2] ?? 0) + 400;
      const hy = (x: number, z: number): number => H.terrainHeight(x, z) ?? 0;
      // steepest moderate slope near the start
      let best = { x: -134, z: 580, gx: 0, gz: 0, s: 0 };
      for (let x = -200; x <= -90; x += 2)
        for (let z = 500; z <= 620; z += 2) {
          const gx = (hy(x + 0.5, z) - hy(x - 0.5, z)) / 1;
          const gz = (hy(x, z + 0.5) - hy(x, z - 0.5)) / 1;
          const s = Math.hypot(gx, gz);
          // planar patch (no crater rim / ditch): heights 1 m around agree with the gradient
          const res = Math.abs(hy(x + 1, z) + hy(x - 1, z) + hy(x, z + 1) + hy(x, z - 1) - 4 * hy(x, z));
          if (s > best.s && s < 0.42 && res < 0.03) best = { x, z, gx, gz, s };
        }
      // soldiers face along the contour (slope runs left-right across their bodies)
      const dirUp = [best.gx / best.s, best.gz / best.s];
      const face = Math.atan2(-dirUp[1]!, dirUp[0]!); // facing vector ⟂ to the gradient
      const fx = -Math.sin(face), fz = -Math.cos(face);
      const rx = Math.cos(face), rz = -Math.sin(face);
      const mk = (id: string, side: number, feet: boolean): void => {
        const x = best.x + rx * side, z = best.z + rz * side;
        const b = g.spawnBot(id, 'probe', [x, hy(x, z), z], { faction: 'friend', archetype: 'squad' });
        g.bots.delete(id);
        const v = b.dummy;
        if (!feet) v.ground = null;
        v.group.position.set(x, hy(x, z), z);
        v.motion.yaw = face;
        v.motion.speed = 0;
        v.char?.controller.reset(face);
        let t = 900 + side;
        for (let k = 0; k < 60; k++) v.setPose((t += 1 / 30));
      };
      const gaps: Record<string, number[]> = {};
      const mk2 = (id: string, side: number, feet: boolean): void => {
        mk(id, side, feet);
      };
      mk2('feet_off', -0.7, false);
      mk2('feet_on', 0.7, true);
      // toe clearance above the terrain under each toe (m): planted feet ≈ the animation's own toe height on flat ground
      const gm = H.game as unknown as { bots: Map<string, unknown> };
      void gm;
      for (const id of ['feet_off', 'feet_on']) {
        const grp = (window as unknown as { __ht: { game: { scene: { getObjectByName(n: string): { getObjectByName(n: string): { getWorldPosition(v: { x: number; y: number; z: number }): { x: number; y: number; z: number } } | undefined } | undefined } } } }).__ht.game.scene.getObjectByName(id);
        const V = (H.game as unknown as { camera: { position: { constructor: new () => { x: number; y: number; z: number } } } }).camera.position.constructor;
        gaps[id] = ['mixamorigLeftToeBase', 'mixamorigRightToeBase'].map((n) => {
          const p = grp!.getObjectByName(n)!.getWorldPosition(new V());
          return +(p.y - hy(p.x, p.z)).toFixed(3);
        });
      }
      (best as unknown as { gaps: unknown }).gaps = gaps;
      // camera in front of them, looking back at them
      const cx = best.x + fx * 4.2, cz = best.z + fz * 4.2;
      H.teleport(cx, hy(cx, cz) + 0.05, cz);
      g.player.rig.yaw = face + Math.PI;
      g.player.rig.pitch = Math.atan2(hy(best.x, best.z) + 0.6 - (hy(cx, cz) + 1.65), 4.2);
      return best;
    });
    console.log(JSON.stringify(info));
    await renderFramesRaf(page, 3);
    await page.screenshot({ path: `${OUT}/doc.png` });
  });
});
