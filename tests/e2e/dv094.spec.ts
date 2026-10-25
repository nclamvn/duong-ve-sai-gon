import { test, expect } from '@playwright/test';
import { expectNoErrors } from './helpers';

/**
 * DV-094 intro nối liền vào trận M1: vào màn → phim MP4 (sandbox không có file → DV-094b: cả intro chạy trong engine từ 0 s),
 * nhiệm vụ chưa chạy → tới `handoff.t` trao quyền tại chỗ: người chơi đứng dưới camera nhìn
 * đúng hướng, tổ thật ra đúng chỗ diễn viên, giữ bờ suối, nhiệm vụ bắt đầu và không lặp câu M71, HUD hiện dần, tựa phim hiện đè.
 */
// intro=1: trình duyệt tự động (navigator.webdriver) mặc định bỏ intro (DV-094b)
const QUERY = 'backend=webgl&level=truong-son-a&debug=1&quality=low&post=low&shadow=512&intro=1';

test.describe('DV-094 intro nối liền vào trận', () => {
  test.setTimeout(400_000);
  test('phim → engine → trao quyền tại chỗ, tổ đúng chỗ, nhiệm vụ không lặp câu', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text());
    });
    await page.goto(`/?${QUERY}`);
    await expect(page.getByTestId('capability')).toBeVisible({ timeout: 300_000 });
    await page.getByTestId('enter').click();
    await page.waitForFunction(() => (window as unknown as { __cine?: unknown }).__cine !== undefined, null, { timeout: 120_000 });
    const r = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window.__ht as any).raw;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cine = (window as any).__cine;
      g.stop();
      const radio: string[] = [];
      g.events.on('RADIO', (e: { cue: string }) => radio.push(e.cue));
      const h = cine.def.handoff;
      const t0 = cine.t;
      const missionBots0 = [...g.bots.values()].filter((b: { group: string }) => b.group !== 'cine').length;
      const cast0 = [...g.bots.values()].filter((b: { group: string }) => b.group === 'cine').length;
      const node0 = g.mission.runtime.state.currentNode;
      // tới sát điểm trao quyền
      cine.t = h.t - 0.05;
      g.frame(1 / 30);
      const cam = cine.track.at(cine.t, (x: number, z: number) => g.terrain.heightAt(x, z));
      const camPos = [...cam.pos];
      const look = [...cam.look];
      const castPos: Record<string, number[]> = {};
      for (const b of g.bots.values()) if (b.group === 'cine' && b.nameKey) castPos[b.nameKey] = [...b.bot.position];
      for (let i = 0; i < 4; i++) g.frame(1 / 30);
      const feet: number[] = [...g.player.controller.feet];
      const fwd = { x: -Math.sin(g.player.rig.yaw), z: -Math.cos(g.player.rig.yaw) };
      const want = { x: (look[0] ?? 0) - (camPos[0] ?? 0), z: (look[2] ?? 0) - (camPos[2] ?? 0) };
      const wl = Math.hypot(want.x, want.z) || 1;
      const yawDot = (fwd.x * want.x + fwd.z * want.z) / wl;
      const squad: Record<string, number> = {};
      for (const b of g.bots.values()) {
        if (b.group !== 'squad' || !b.nameKey || !castPos[b.nameKey]) continue;
        const c = castPos[b.nameKey]!;
        squad[b.nameKey] = Math.hypot(b.bot.position[0] - (c[0] ?? 0), b.bot.position[2] - (c[2] ?? 0));
      }
      return {
        t0,
        live: h.live,
        missionBots0,
        cast0,
        node0,
        done: cine.done,
        castAfter: [...g.bots.values()].filter((b: { group: string }) => b.group === 'cine').length,
        node: g.mission.runtime.state.currentNode,
        feetErr: Math.hypot((feet[0] ?? 0) - (camPos[0] ?? 0), (feet[2] ?? 0) - (camPos[2] ?? 0)),
        yawDot,
        squad,
        order: g.squadmates.order,
        holdPt: g.squadmates.orderPoint ? [g.squadmates.orderPoint[0], g.squadmates.orderPoint[2]] : null,
        holdWant: h.holdAt,
        radio,
        hudHidden: document.getElementById('hud')!.hidden,
        title: !!document.querySelector('[data-testid="title-card"]'),
        aiPaused: g.aiPaused,
        simScale: g.simScale,
        vmHidden: g.viewModelHidden,
      };
    });
    console.log(JSON.stringify(r));
    expect(r.t0, 'chưa có file phim: cả intro chạy trong engine từ đầu').toBeLessThan(2);
    expect(r.missionBots0, 'nhiệm vụ chờ trao quyền').toBe(0);
    expect(r.node0).toBeNull();
    expect(r.cast0).toBe(8);
    expect(r.done).toBe(true);
    expect(r.castAfter).toBe(0);
    expect(r.node, 'nhiệm vụ M1 bắt đầu').not.toBeNull();
    expect(r.feetErr, 'người chơi đứng dưới camera').toBeLessThan(0.6);
    expect(r.yawDot, 'nhìn đúng hướng camera').toBeGreaterThan(0.95);
    expect(Object.keys(r.squad).length, 'đủ 5 người tổ').toBe(5);
    for (const [k, d] of Object.entries(r.squad)) expect(d, `${k} ra đúng chỗ diễn viên`).toBeLessThan(1.5);
    expect(r.order).toBe('hold');
    expect(r.holdPt, 'tổ giữ bờ suối').not.toBeNull();
    expect(Math.hypot(r.holdPt![0]! - r.holdWant[0], r.holdPt![1]! - r.holdWant[1])).toBeLessThan(0.1);
    expect(r.radio).not.toContain('M71');
    expect(r.radio).toContain('M72');
    expect(r.hudHidden).toBe(false);
    expect(r.title).toBe(true);
    expect(r.aiPaused).toBe(false);
    expect(r.simScale).toBe(1);
    expect(r.vmHidden).toBe(false);
    expectNoErrors(errors);
  });

  test('DV-094b vào thẳng (autostart): màn bấm phím bất kỳ → cả intro chạy trong engine từ đầu, nhiệm vụ chờ', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
    await page.goto(`/?${QUERY}&autostart=1`);
    await expect(page.getByTestId('press-start')).toBeVisible({ timeout: 300_000 });
    await page.keyboard.press('KeyA');
    await expect(page.getByTestId('press-start')).toBeHidden();
    await page.waitForFunction(() => (window as unknown as { __cine?: unknown }).__cine !== undefined, null, { timeout: 120_000 });
    const r = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window.__ht as any).raw;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cine = (window as any).__cine;
      g.stop();
      return { t: cine.t, node: g.mission.runtime.state.currentNode, cast: [...g.bots.values()].filter((b: { group: string }) => b.group === 'cine').length, audio: !!g.audio.ctx };
    });
    console.log(JSON.stringify(r));
    expect(r.t).toBeLessThan(2);
    expect(r.node).toBeNull();
    expect(r.cast).toBe(8);
    expect(r.audio, 'cú bấm mở được tiếng').toBe(true);
    expectNoErrors(errors);
  });
});
