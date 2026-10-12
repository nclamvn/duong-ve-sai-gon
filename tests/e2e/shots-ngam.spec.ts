/**
 * Ảnh kiểm hồi đêm Ngầm Ta Lê (DV-078): đủ asset (xe ZIL-157, DShKM, AC-130, Thu, đèn, nón lá). Không chạy trong CI:
 * `DV_SHOTS=<thư mục> npx playwright test tests/e2e/shots-ngam.spec.ts`.
 *  1 ford.png  — xe qua ngầm, Thu cầm đèn (camera bờ gần, ngang tầm người)
 *  2 gun.png   — ngồi 12,7 nhìn lên AC-130 đang lượn (thước ngắm vòng, vệt đạn xanh)
 *  3 thu.png   — Thu cận trung (đèn, nón lá, tư thế tay)
 *  4 queue.png — hàng xe dưới tán, ụ súng trên gò
 */
import { test } from '@playwright/test';
import { renderFramesRaf } from './helpers';

const OUT = process.env.DV_SHOTS;

test.describe('ảnh hồi đêm Ngầm Ta Lê', () => {
  test.skip(!OUT, 'chỉ chạy khi đặt DV_SHOTS');
  test('ngầm, ụ súng, Thu, hàng xe', async ({ page }) => {
    test.setTimeout(1_500_000);
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    await page.goto('/?backend=webgl&level=ngam-ta-le&autostart=1&debug=1&quality=low&shadow=1024&veg=1&vegDensity=0.5&amb=0');
    await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 600_000 });
    await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 2, null, { timeout: 600_000 });
    const shot = async (name: string, setup: () => void | Promise<void>): Promise<void> => {
      await page.evaluate(setup);
      await renderFramesRaf(page, 4);
      await page.screenshot({ path: `${OUT}/${name}.png` });
      const info = await page.evaluate(() => {
        const g = window.__ht!.game;
        const N = g.nightAct! as unknown as { streaks: { count: number }; gunship: { visible: boolean; position: { x: number; y: number; z: number; clone(): { project(c: unknown): { x: number; y: number; z: number } } } } | null; logic: { gun: { rounds: Array<{ live: boolean; tracer: boolean }> }; gunship: { phase: string } } };
        const ndc = N.gunship ? N.gunship.position.clone().project(g.camera) : null;
        return { streaks: N.streaks.count, live: N.logic.gun.rounds.filter((r) => r.live).length, tracers: N.logic.gun.rounds.filter((r) => r.live && r.tracer).length, gsVisible: N.gunship?.visible, ndc, phase: N.logic.gunship.phase };
      });
      console.log('[shot]', name, JSON.stringify(info));
    };
    await page.evaluate(() => {
      const H = window.__ht!;
      const g = H.game;
      g.stop();
      g.aiPaused = true;
      document.getElementById('subtitles')!.style.display = 'none';
      const L = g.nightAct!.logic;
      L.convoy.go = true;
      // cho xe chạy tới khi xe đầu ở giữa ngầm
      for (let i = 0; i < 60 * 60 && L.convoy.trucks[0]!.s < L.cfg.convoy.fordS - 1; i++) H.stepSim(1);
    });
    await page.evaluate(() => {
      (window as unknown as { __cam: unknown }).__cam = (x: number, z: number, dy: number, yaw: number, pitch: number, fov: number, hud: boolean): void => {
        const H = window.__ht!;
        const g = H.game;
        document.getElementById('hud')!.hidden = !hud;
        g.viewModelHidden = true;
        g.player.baseFov = fov;
        g.player.controller.teleport(x, (H.terrainHeight(x, z) ?? 0) + dy, z);
        g.player.rig.reset(yaw, pitch);
        H.stepSim(1);
      };
    });
    await shot('1-ford', () => {
      const f = window.__ht!.mission.zones()['ford']!;
      (window as unknown as { __cam: (...a: unknown[]) => void }).__cam(f.center[0] - 12, f.center[2] + 2, 0, Math.atan2(-12, 2), 0.03, 55, false);
    });
    await shot('3-thu', () => {
      const t = window.__ht!.mission.zones()['thu']!;
      (window as unknown as { __cam: (...a: unknown[]) => void }).__cam(t.center[0] - 3.2, t.center[2] - 3.2, 0, Math.atan2(-3.2, -3.2), 0.05, 40, false);
    });
    await shot('4-queue', () => {
      const s = window.__ht!.mission.zones()['spawn']!;
      (window as unknown as { __cam: (...a: unknown[]) => void }).__cam(s.center[0] - 4, s.center[2] + 4, 1.2, Math.atan2(-0.7071, -0.7071), 0.08, 70, false);
    });
    await shot('5-truck', () => {
      const H = window.__ht!;
      const L = H.game.nightAct!.logic;
      const tr = L.convoy.trucks[1]!;
      const p = L.convoy.pose(tr);
      // đứng bên trái xe 9 m, nhìn ngang vào thân (đầu xe phải hướng về phía ngầm = bên phải ảnh)
      const x = p.x - p.dz * 9;
      const z = p.z + p.dx * 9;
      (window as unknown as { __cam: (...a: unknown[]) => void }).__cam(x, z, 0.4, Math.atan2(-p.dz, p.dx), 0.05, 55, false);
    });
    await page.evaluate(() => {
      const H = window.__ht!;
      const g = H.game;
      const N = g.nightAct!;
      const L = N.logic;
      L.gunship.arrive();
      for (let i = 0; i < 60 * 30 && L.gunship.phase !== 'attack'; i++) H.stepSim(1);
      const gz = H.mission.zones()['gun']!;
      g.player.controller.teleport(gz.center[0] + 0.5, (H.terrainHeight(gz.center[0], gz.center[2]) ?? 0) + 0.05, gz.center[2] + 0.5);
      let edge = true;
      g.input = { kind: 'replay', snapshot: (_t, o) => { o.fwd = 0; o.right = 0; o.sprint = false; o.crouch = false; o.jump = false; o.reload = false; o.dx = 0; o.dy = 0; o.ads = false; o.fire = !edge; o.interact = edge; o.interactHeld = false; edge = false; } };
      H.stepSim(2);
    });
    await shot('2-gun', () => {
      const H = window.__ht!;
      const g = H.game;
      const L = g.nightAct!.logic;
      document.getElementById('hud')!.hidden = false;
      g.player.baseFov = 75;
      for (let k = 0; k < 40; k++) {
        const gs = L.gunship;
        const m = L.gun.toWorld(L.cfg.dshk.muzzle);
        const tof = Math.hypot(gs.pos[0] - m[0], gs.pos[1] - m[1], gs.pos[2] - m[2]) / 840;
        const px = gs.pos[0] + gs.vel[0] * tof - m[0];
        const py = gs.pos[1] + 4.9 * tof * tof - m[1];
        const pz = gs.pos[2] + gs.vel[2] * tof - m[2];
        g.player.rig.yaw = Math.atan2(-px, -pz) + 0.06;
        g.player.rig.pitch = Math.atan2(py, Math.hypot(px, pz)) - 0.02;
        H.stepSim(1);
      }
      // chờ máy bay khai hoả 40 ly (lửa đầu nòng trong khung)
      for (let k = 0; k < 600 && !L.gunship.shells.some((s) => s.kind === 'bofors' && L.gunship.time - s.t0 < 0.03); k++) {
        const gs = L.gunship;
        const m = L.gun.toWorld(L.cfg.dshk.muzzle);
        g.player.rig.yaw = Math.atan2(-(gs.pos[0] - m[0]), -(gs.pos[2] - m[2]));
        g.player.rig.pitch = Math.atan2(gs.pos[1] - m[1], Math.hypot(gs.pos[0] - m[0], gs.pos[2] - m[2])) - 0.05;
        H.stepSim(1);
      }
    });
  });
});
