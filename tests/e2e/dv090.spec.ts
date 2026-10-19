import { test, expect } from '@playwright/test';
import { pauseLoop, expectNoErrors, bootGame, renderFrames } from './helpers';

/**
 * DV-090 (Chủ nhà chơi M1): nằm bò toài, chạy thục mạng hạ súng chéo ngực, xin đạn đồng đội, tiểu đội bộ đội không tên đi cùng.
 * E2E vật lý người chơi cho tư thế mới (AGENTS §0): nằm thấp, bò chậm, không bắn khi bò, nằm yên bắn được, dậy được.
 */
const QUERY = 'backend=webgl&level=truong-son-a&autostart=1&debug=1&quality=low&post=off&shadow=512&assets=0&character=0&weapons=0&arms=0&calm=1&veg=0';

type Inp = { fwd?: number; sprint?: boolean; prone?: boolean; fire?: boolean; held?: boolean; crouch?: boolean };

test.describe('DV-090 nằm bò, xin đạn, tiểu đội đi cùng', () => {
  test.setTimeout(300_000);
  test('nằm bò toài + xin đạn đồng đội + 6 bộ đội không tên', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text());
    });
    await page.goto(`/?${QUERY}`);
    await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 120_000 });
    await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 2, null, { timeout: 120_000 });
    await pauseLoop(page);
    const r = await page.evaluate(() => {
      const H = window.__ht!;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = H.game as any;
      g.player.health = 1e9;
      const cur: Inp = {};
      g.input = {
        kind: 'replay',
        snapshot: (_t: number, o: Record<string, unknown>) => {
          o.fwd = cur.fwd ?? 0;
          o.right = 0;
          o.sprint = !!cur.sprint;
          o.crouch = !!cur.crouch;
          o.jump = false;
          o.reload = false;
          o.interact = false;
          o.interactHeld = !!cur.held;
          o.prone = !!cur.prone;
          o.dx = 0;
          o.dy = 0;
          o.ads = false;
          o.fire = !!cur.fire;
          cur.prone = false; // edge
        },
      };
      const set = (i: Inp): void => {
        Object.assign(cur, { fwd: 0, sprint: false, prone: false, fire: false, held: false, crouch: false }, i);
      };
      const c = g.player.controller;
      H.stepSim(30);
      const stand = { stance: c.stance, eye: c.eyeH };
      // Z: nằm
      set({ prone: true });
      H.stepSim(60);
      const prone = { stance: c.stance, eye: c.eyeH, height: c.height };
      // bò tới 2 s, bóp cò trong lúc bò: không có phát nào
      const f0 = [...c.feet];
      const shots0 = g.weapon.sm.totalShots;
      set({ fwd: 1, fire: true });
      H.stepSim(120);
      const crawl = { dist: Math.hypot(c.feet[0] - f0[0], c.feet[2] - f0[2]), shots: g.weapon.sm.totalShots - shots0, stance: c.stance };
      // nằm yên bắn được
      set({});
      H.stepSim(30);
      set({ fire: true });
      H.stepSim(30);
      const still = { shots: g.weapon.sm.totalShots - shots0 };
      // Z lần nữa: dậy (cúi rồi đứng khi có chỗ)
      set({ prone: true });
      H.stepSim(60);
      const up = { stance: c.stance, eye: c.eyeH };
      // tiểu đội bộ đội không tên
      const friends = [...g.bots.values()].filter((b: { faction: string }) => b.faction === 'friend');
      const unnamed = friends.filter((b: { nameKey: string | null }) => !b.nameKey);
      // xin đạn: cạn dự trữ, đứng cạnh một đồng đội, giữ F 1 s
      g.weapon.sm.reserve = 0;
      const mate = friends[1];
      const p = mate.bot.position;
      H.teleport(p[0] + 1.2, p[1] + 0.05, p[2]);
      set({});
      H.stepSim(10);
      const prompt = g.hud.state.promptKey;
      set({ held: true });
      H.stepSim(60);
      const ammo = { reserve: g.weapon.sm.reserve, count: g.resupplyStats.count };
      return { stand, prone, crawl, still, up, friends: friends.length, unnamed: unnamed.length, support: g.support.count, prompt, ammo, magSize: g.weapon.def.magSize, reserveDef: g.weapon.def.reserve };
    });
    console.log(JSON.stringify(r));
    expect(r.stand.stance).toBe('stand');
    expect(r.prone.stance).toBe('prone');
    expect(r.prone.eye).toBeLessThan(0.5);
    expect(r.prone.height).toBeLessThan(0.9);
    expect(r.crawl.stance).toBe('prone');
    expect(r.crawl.dist, 'bò ~0,9 m/s').toBeGreaterThan(1.2);
    expect(r.crawl.dist).toBeLessThan(2.2);
    expect(r.crawl.shots, 'đang bò không bắn được').toBe(0);
    expect(r.still.shots, 'nằm yên bắn được').toBeGreaterThan(0);
    expect(r.up.stance).not.toBe('prone');
    expect(r.up.eye).toBeGreaterThan(1.0);
    expect(r.unnamed).toBe(6);
    expect(r.support).toBe(6);
    expect(r.friends).toBe(11);
    expect(r.reserveDef, '8 băng dự trữ').toBe(8 * r.magSize);
    expect(r.prompt).toBe('ammo');
    expect(r.ammo.count).toBe(1);
    expect(r.ammo.reserve).toBe(2 * r.magSize);
    expectNoErrors(errors);
  });

  test('chạy thục mạng: khối tay + súng xoay chéo ngực (nòng không chĩa ra trước), dừng thì về tư thế hông', async ({ page }) => {
    const errors = await bootGame(page);
    await pauseLoop(page);
    const r = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = (window.__ht as any).raw.viewModel;
      if (!vm.artist) return { artist: false, port: 0, back: 0, yaw: 0 };
      for (let i = 0; i < 40; i++) vm.update(1 / 30, 0, 0, 0, 0, 0, 6, true);
      const port = vm.portBlend as number;
      const yaw = vm.root.rotation.y as number;
      for (let i = 0; i < 40; i++) vm.update(1 / 30, 0, 0, 0, 0, 0, 0, false);
      return { artist: true, port, back: vm.portBlend as number, yaw };
    });
    await renderFrames(page, 2);
    console.log(JSON.stringify(r));
    test.skip(!r.artist, 'không có gói tay súng của nghệ sĩ (assets=0)');
    expect(r.port).toBeGreaterThan(0.9);
    expect(r.yaw, 'nòng ngoặt sang trái chéo ngực').toBeGreaterThan(0.5);
    expect(r.back).toBeLessThan(0.05);
    expectNoErrors(errors);
  });
});
