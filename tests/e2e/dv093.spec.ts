import { test, expect } from '@playwright/test';
import { expectNoErrors } from './helpers';

/**
 * DV-093 intro trong engine: ?cine=intro giữ nhiệm vụ, camera theo track, tổ Quyết + địch là lính thật do kịch bản điều khiển,
 * lớp phủ (bản đồ, tựa, phụ đề) vẽ được; hết intro (&then=play) trả thế giới: xoá diễn viên, camera người chơi, nhiệm vụ M1 bắt đầu.
 */
const QUERY = 'backend=webgl&level=truong-son-a&autostart=1&debug=1&quality=low&post=low&shadow=512&cine=intro&then=play';

test.describe('DV-093 intro trong engine', () => {
  test.setTimeout(400_000);
  test('giữ nhiệm vụ, camera theo track, diễn viên, bàn giao vào M1', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text());
    });
    await page.goto(`/?${QUERY}`);
    await page.waitForFunction(() => (window as unknown as { __cine?: unknown }).__cine !== undefined, null, { timeout: 300_000 });
    const r = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window.__ht as any).raw;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cine = (window as any).__cine;
      g.stop();
      const node0 = g.mission.state ? g.mission.runtime?.state?.currentNode ?? null : null;
      const missionBots0 = [...g.bots.values()].filter((b: { group: string }) => b.group !== 'cine').length;
      const cast = [...g.bots.values()].filter((b: { group: string }) => b.group === 'cine').length;
      // nhảy tới cảnh đoàn xe, chạy vài khung
      cine.t = 31;
      for (let i = 0; i < 6; i++) g.frame(1 / 30);
      const c = cine.track.at(cine.t, (x: number, z: number) => g.terrain.heightAt(x, z));
      const cam = g.camera.position;
      const camErr = Math.hypot(cam.x - c.pos[0], cam.y - c.pos[1], cam.z - c.pos[2]);
      const shot = c.shot.id;
      const quyet = g.bots.get('cine_quyet');
      const qp = quyet ? [...quyet.bot.position] : null;
      // bản đồ tác chiến (đã dựng khi qua sự kiện map) vẽ được lên canvas 2D
      const cv = document.createElement('canvas');
      cv.width = 640;
      cv.height = 360;
      cine.overlay.map.paint(cv.getContext('2d'), 640, 360);
      const px = cv.getContext('2d')!.getImageData(320, 180, 1, 1).data;
      // tới cuối: bàn giao
      cine.t = 59.95;
      for (let i = 0; i < 4; i++) g.frame(1 / 30);
      const castAfter = [...g.bots.values()].filter((b: { group: string }) => b.group === 'cine').length;
      const friends = [...g.bots.values()].filter((b: { faction: string; group: string }) => b.faction === 'friend' && b.group !== 'cine').length;
      return { node0, missionBots0, cast, camErr, shot, qp, mapPx: [px[0], px[1], px[2]], done: cine.done, castAfter, friends, simScale: g.simScale, hudHidden: document.getElementById('hud')!.hidden };
    });
    console.log(JSON.stringify(r));
    expect(r.missionBots0, 'nhiệm vụ chưa ra quân khi intro chạy').toBe(0);
    expect(r.cast, '5 người tổ Quyết + 3 địch').toBe(8);
    expect(r.shot).toBe('s5_doan_xe');
    expect(r.camErr).toBeLessThan(0.5);
    expect(r.qp![2]).toBeLessThan(552);
    expect(r.mapPx[0], 'giấy bản đồ (sáng, ngả vàng)').toBeGreaterThan(90);
    expect(r.done).toBe(true);
    expect(r.castAfter).toBe(0);
    expect(r.friends, 'M1 ra quân sau intro').toBeGreaterThanOrEqual(5);
    expect(r.simScale).toBe(1);
    expect(r.hudHidden).toBe(false);
    expectNoErrors(errors);
  });
});
