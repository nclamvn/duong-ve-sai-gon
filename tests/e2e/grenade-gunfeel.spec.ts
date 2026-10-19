import { test, expect } from '@playwright/test';
import { pauseLoop, renderFrames } from './helpers';

/**
 * DV-074 lựu đạn + DV-075 cảm giác súng trên level thật Trường Sơn:
 *  - người chơi ném (G): lựu đạn bay, nảy, nằm yên, nổ sau fuse; địch đứng cạnh mất máu; địch còn AI thì chạy ra khỏi vùng nổ;
 *  - địch ném vào người chơi: tổ ta hô "Lựu đạn!" (M26), HUD chỉ hướng lựu đạn, nổ gần thì người chơi mất máu;
 *  - đạn địch sượt qua: tiếng chát + thanh áp chế tăng rồi hồi; HUD lựu đạn đếm số.
 */
const QUERY = 'backend=webgl&level=truong-son&autostart=1&debug=1&quality=low&post=off&shadow=512&assets=0&character=0&weapons=0&arms=0&calm=1';

test('DV-074/075: lựu đạn người chơi + địch, né lựu đạn, cảnh báo, đạn sượt áp chế', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text());
  });
  await page.goto(`/?${QUERY}&veg=1`);
  await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 120_000 });
  await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 2, null, { timeout: 120_000 });
  await pauseLoop(page);

  const r = await page.evaluate(() => {
    const H = window.__ht!;
    const g = H.game;
    const out: Record<string, unknown> = {};
    const feet = (): [number, number, number] => [g.player.controller.feet[0]!, g.player.controller.feet[1]!, g.player.controller.feet[2]!];
    g.player.rig.pitch = 0;
    g.aiPaused = true;
    // DV-085: chỗ xuất phát M1 ở bờ suối; đo ném/né lựu đạn ở trại trên đường mòn như trước (đất rộng, có navmesh quanh)
    H.teleport(-134, (H.terrainHeight(-134, 580) ?? 0) + 0.3, 580);
    H.stepSim(5);
    out.hudBefore = document.querySelector('[data-testid="grenades"]')?.textContent ?? null;
    // 1) người chơi ném: thử các hướng tới khi lựu đạn nằm yên cách ≥ 6 m
    let thrown = 0;
    let rest: [number, number, number] | null = null;
    for (let k = 0; k < 8 && !rest; k++) {
      g.player.rig.yaw = (k * Math.PI) / 4;
      g.playerGrenades = 2;
      if (!g.throwGrenade()) {
        H.stepSim(60);
        continue;
      }
      thrown++;
      for (let i = 0; i < 150; i++) {
        H.stepSim(1);
        const l = g.grenades.live()[0];
        if (l && l.resting) {
          const f = feet();
          if (Math.hypot(l.pos[0] - f[0], l.pos[2] - f[2]) >= 6) rest = [l.pos[0], l.pos[1], l.pos[2]];
          break;
        }
      }
      if (!rest) H.stepSim(300); // để quả này nổ hết
    }
    out.thrown = thrown;
    out.rest = rest;
    const blasts0 = g.blastStats.count;
    // địch đứng sát (AI dừng) → mất máu
    const n1 = g.nav.nearest({ x: rest![0] + 1.6, y: rest![1], z: rest![2] })!;
    const victim = g.spawnBot('gv1', 'test', [n1.x, n1.y, n1.z], { faction: 'enemy' });
    H.stepSim(240);
    out.blasts = g.blastStats.count - blasts0;
    out.victimHp = victim.bot.health;
    out.grenadesLeft = g.playerGrenades;

    // 2) AI chạy khỏi lựu đạn: ném lại cùng hướng, địch AI bật đứng cạnh chỗ rơi
    g.playerGrenades = 2;
    g.throwGrenade();
    let rest2: [number, number, number] | null = null;
    for (let i = 0; i < 150 && !rest2; i++) {
      H.stepSim(1);
      const l = g.grenades.live()[0];
      if (l && l.resting) rest2 = [l.pos[0], l.pos[1], l.pos[2]];
    }
    const n2 = g.nav.nearest({ x: rest2![0] - 1.8, y: rest2![1], z: rest2![2] + 0.6 })!;
    const runner = g.spawnBot('gv2', 'test2', [n2.x, n2.y, n2.z], { faction: 'enemy' });
    g.aiPaused = false;
    let left = 0;
    for (let i = 0; i < 260 && g.grenades.live().length; i++) {
      H.stepSim(1);
      left = Math.hypot(runner.bot.position[0] - rest2![0], runner.bot.position[2] - rest2![2]);
    }
    out.evades = runner.bot.stats.grenadeEvades;
    out.runnerLeft = left;
    g.aiPaused = true;
    g.despawnBot('gv1');
    g.despawnBot('gv2');

    // 3) địch ném vào người chơi: tổ ta hô, HUD chỉ hướng, mất máu
    const f = feet();
    const yaw = g.player.rig.yaw;
    const ex = f[0] - Math.sin(yaw) * 16;
    const ez = f[2] - Math.cos(yaw) * 16;
    const ne = g.nav.nearest({ x: ex, y: f[1], z: ez })!;
    const thrower = g.spawnBot('gt', 'test3', [ne.x, ne.y, ne.z], { faction: 'enemy' });
    g.player.health = 100;
    const sub0 = H.mission.subtitlesShown().length;
    const okThrow = g.grenadeLink.throwAt(thrower.bot, [ne.x, ne.y + 1.7, ne.z], [f[0] + 1.5, f[1], f[2]]);
    out.okThrow = okThrow;
    let warned = false;
    let warnVisible = false;
    for (let i = 0; i < 240 && g.grenades.live().length; i++) {
      H.stepSim(1);
      if (g.hud.state.grenadeWarnDeg !== null && g.hud.state.grenadeWarnDeg !== undefined) {
        warned = true;
        if (!warnVisible) {
          g.frame(1 / 60);
          warnVisible = !(document.querySelector('[data-testid="grenade-warn"]') as HTMLElement).hidden;
        }
      }
    }
    // DV-087: câu cảnh báo lựu đạn có nhiều biến thể (sq.grenade#i), M26 là đường cũ
    out.m26 = H.mission.subtitlesShown().slice(sub0).some((c: string) => c === 'M26' || c.startsWith('sq.grenade#'));
    out.warned = warned;
    out.warnVisible = warnVisible;
    out.playerHp = g.player.health;
    out.squadWarnings = g.squadmates.stats.grenadeWarnings;
    g.despawnBot('gt');

    // 4) đạn sượt: phát từ 10 m quanh người chơi, lệch 1 m khỏi mắt
    g.player.health = 100;
    g.playerSuppression = 0;
    const eye: [number, number, number] = [f[0], f[1] + 1.6, f[2]];
    let shots = 0;
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      const o: [number, number, number] = [eye[0] + Math.sin(ang) * 10, eye[1], eye[2] + Math.cos(ang) * 10];
      const tx = eye[0] + Math.cos(ang) * 1.0;
      const tz = eye[2] - Math.sin(ang) * 1.0;
      const dx = tx - o[0];
      const dy = eye[1] - o[1];
      const dz = tz - o[2];
      const l = Math.hypot(dx, dy, dz);
      g.events.emit('BOT_FIRED', { botId: 'nm', origin: o, dir: [dx / l, dy / l, dz / l], faction: 'enemy' } as never);
      shots++;
    }
    out.nearMiss = { ...g.nearMissStats };
    out.suppPeak = g.playerSuppression;
    g.frame(1 / 60);
    out.suppOpacity = Number((document.querySelector('[data-testid="suppression"]') as HTMLElement).style.opacity || 0);
    H.stepSim(60 * 4);
    out.suppAfter = g.playerSuppression;
    out.shots = shots;
    g.playerGrenades = 1;
    g.frame(1 / 60);
    out.hudAfter = document.querySelector('[data-testid="grenades"]')?.textContent ?? null;
    return out;
  });
  console.log('[grenade]', JSON.stringify(r));
  expect(r.hudBefore).toBe('Lựu đạn ×2');
  expect(r.thrown as number).toBeGreaterThanOrEqual(1);
  expect(r.rest).not.toBeNull();
  expect(r.blasts).toBe(1);
  expect(r.victimHp as number).toBeLessThan(100);
  expect(r.grenadesLeft).toBe(1);
  expect(r.evades as number).toBeGreaterThanOrEqual(1);
  expect(r.runnerLeft as number).toBeGreaterThan(4.5);
  expect(r.okThrow).toBe(true);
  expect(r.m26).toBe(true);
  expect(r.warned).toBe(true);
  expect(r.warnVisible).toBe(true);
  expect(r.playerHp as number).toBeLessThan(100);
  expect((r.nearMiss as { count: number }).count).toBeGreaterThanOrEqual(4);
  expect(r.suppPeak as number).toBeGreaterThan(0.5);
  expect(r.suppOpacity as number).toBeGreaterThan(0.3);
  expect(r.suppAfter as number).toBeLessThan(0.05);
  expect(r.hudAfter).toBe('Lựu đạn ×1');
  await renderFrames(page, 2);
  expect(errors).toEqual([]);
});
