import { test, expect } from '@playwright/test';
import { pauseLoop, expectNoErrors, renderFrames } from './helpers';

/**
 * AI-T1 (DV-071) trên level thật Trường Sơn (rừng + hố bom): chỗ nấp tự sinh, trận chặn thám báo đợt 1 với tổ ta 5 người,
 * lệnh tổ bằng phím 1–4 + HUD, báo hướng địch. Người chơi đứng yên không bắn (bất tử) để đo riêng hai tổ AI.
 */
const QUERY = 'backend=webgl&level=truong-son&autostart=1&debug=1&quality=low&post=off&shadow=512&assets=0&character=0&weapons=0&arms=0';

test('AI-T1: chỗ nấp tự sinh từ cây + hố; tổ địch lao xen kẽ không bắn khi chạy; tổ ta 5 người nghe lệnh, báo hướng', async ({ page }) => {
  test.setTimeout(420_000);
  const errors: string[] = [];
  const info: string[] = [];
  page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text());
    if (/\[ai\]/.test(m.text())) info.push(m.text());
  });
  await page.goto(`/?${QUERY}&veg=1`);
  await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 120_000 });
  await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 2, null, { timeout: 120_000 });
  await pauseLoop(page);
  expect(info.join(' ')).toMatch(/cover field: \d+ trees, \d+ craters/);

  const field = await page.evaluate(() => {
    const g = window.__ht!.game;
    const s = g.tactics!.field.stats;
    return { trees: s.trees, craters: s.craters, markers: s.markers };
  });
  console.log('[ai-t1 field]', JSON.stringify(field));
  expect(field.trees).toBeGreaterThan(300);
  expect(field.craters).toBeGreaterThan(20);

  // trận dốc của M1 (M1-T2): 4 giữ dốc + 4 vòng sườn, tổ ta 5 người, người chơi đứng dưới dốc
  const fight = await page.evaluate(() => {
    const H = window.__ht!;
    const g = H.game;
    const z = H.mission.zones()['doc']!;
    H.teleport(z.center[0] + 45, (H.terrainHeight(z.center[0] + 45, z.center[2] + 20) ?? 0) + 0.5, z.center[2] + 20);
    g.mission.spawnGroup('f3_hold', 4, 'f3a');
    g.mission.spawnGroup('f3_flank', 4, 'f3e');
    g.squadmates.pace = 'normal';
    // tổ ta theo kịp (teleport cùng)
    for (const b of g.squadmates.list()) {
      const f = g.player.controller.feet;
      const n = g.nav.nearest({ x: f[0]! + 3, y: f[1]!, z: f[2]! + 3 });
      if (n) b.bot.position.splice(0, 3, n.x, n.y, n.z);
    }
    H.stepSim(10);
    g.player.health = 1e9; // đo hai tổ AI, người chơi không chết
    const t0 = performance.now();
    H.stepSim(60 * 45);
    const ms = performance.now() - t0;
    const enemies = [...g.bots.values()].filter((b) => b.faction === 'enemy');
    const friends = [...g.bots.values()].filter((b) => b.faction === 'friend');
    const sum = (arr: typeof enemies, k: string): number => arr.reduce((a, b) => a + ((b.bot.stats as Record<string, number>)[k] ?? 0), 0);
    return {
      node: H.mission.state().currentNode,
      enemies: enemies.length,
      enemiesDead: enemies.filter((b) => !b.bot.alive).length,
      friendHits: sum(friends, 'hits'),
      enemyHits: sum(enemies, 'hits'),
      enemyHp: enemies.map((b) => Math.round(b.bot.health)),
      friendHp: friends.map((b) => Math.round(b.bot.health)),
      enemyShots: sum(enemies, 'shots'),
      enemyBounds: sum(enemies, 'bounds'),
      enemyCoverPicks: sum(enemies, 'coverPicks'),
      shotsWhileBounding: sum(enemies, 'shotsWhileBounding') + sum(friends, 'shotsWhileBounding'),
      friendShots: sum(friends, 'shots'),
      friendCoverPicks: sum(friends, 'coverPicks'),
      team: { ...g.squad!.stats },
      callouts: g.squadmates.stats.callouts,
      shown: H.mission.subtitlesShown(),
      msPerTick: ms / (60 * 45),
      evalStats: { ...g.tactics!.stats },
      friendsDbg: friends.map((b) => ({ id: b.id, st: b.bot.state, per: b.bot.perception.state, vis: b.bot.perception.visible, lod: b.bot.lod, alive: b.bot.alive, d: Math.round(Math.min(...enemies.filter((e) => e.bot.alive).map((e) => Math.hypot(e.bot.position[0] - b.bot.position[0], e.bot.position[2] - b.bot.position[2])))), dp: Math.round(Math.hypot(b.bot.position[0] - g.player.controller.feet[0]!, b.bot.position[2] - g.player.controller.feet[2]!)) })),
      enemiesDbg: enemies.map((b) => ({ id: b.id, st: b.bot.state, alive: b.bot.alive, role: b.bot.role, dp: Math.round(Math.hypot(b.bot.position[0] - g.player.controller.feet[0]!, b.bot.position[2] - g.player.controller.feet[2]!)) })),
    };
  });
  console.log('[ai-t1]', JSON.stringify(fight));
  expect(fight.enemies).toBeGreaterThanOrEqual(3);
  expect(fight.enemyShots + fight.friendShots).toBeGreaterThan(20);
  expect(fight.enemyCoverPicks + fight.friendCoverPicks).toBeGreaterThan(3);
  expect(fight.shotsWhileBounding).toBe(0);
  expect(fight.team.shares + fight.team.organized).toBeGreaterThan(0);
  expect(fight.callouts).toBeGreaterThanOrEqual(1);
  expect(fight.shown).toContain('M20');

  // lệnh tổ: phím 2 giữ, 4 tiến, 1 theo; HUD hiện lệnh
  await page.keyboard.press('Digit2');
  await renderFrames(page, 1);
  const hold = await page.evaluate(() => ({ order: window.__ht!.squad().order, label: document.querySelector('[data-testid="squad-order"] .order')?.textContent ?? '', hidden: (document.querySelector('[data-testid="squad-order"]') as HTMLElement).hidden }));
  expect(hold.order).toBe('hold');
  expect(hold.hidden).toBe(false);
  expect(hold.label.length).toBeGreaterThan(3);
  await page.keyboard.press('Digit4');
  expect(await page.evaluate(() => window.__ht!.squad().order)).toBe('advance');
  await page.keyboard.press('Digit1');
  expect(await page.evaluate(() => window.__ht!.squad().order)).toBe('follow');
  await expectNoErrors(errors);
});
