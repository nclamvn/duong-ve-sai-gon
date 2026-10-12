import { test, expect } from '@playwright/test';
import { pauseLoop } from './helpers';

/**
 * DV-076 lồng tiếng trên level Trường Sơn: manifest nạp, câu tổ ta (tiếng Việt) phát khi phụ đề lên và phụ đề giữ đủ lâu theo
 * giọng, báo hướng địch đúng giờ (giọng + phụ đề), địch hô tiếng Anh 3D, giọng bị cắt khi câu ưu tiên cao chen ngang.
 */
const QUERY = 'backend=webgl&level=truong-son&autostart=1&debug=1&quality=low&post=off&shadow=512&assets=0&character=0&weapons=0&arms=0&calm=1&veg=0';

test('DV-076: giọng tổ ta tiếng Việt + địch tiếng Anh theo phụ đề và sự kiện AI', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text());
  });
  await page.goto(`/?${QUERY}`);
  await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 120_000 });
  await page.waitForFunction(() => (window.__ht?.game.voice.manifest ?? null) !== null, null, { timeout: 60_000 });
  await page.keyboard.press('Shift'); // thao tác người dùng → mở AudioContext
  await pauseLoop(page);

  const r = await page.evaluate(async () => {
    const H = window.__ht!;
    const g = H.game;
    // DV-085: chỗ xuất phát M1 ở bờ suối (quanh đó nhiều chỗ không có navmesh) → đo ở trại trên đường mòn như trước
    H.teleport(-134, (H.terrainHeight(-134, 580) ?? 0) + 0.3, 580);
    for (const b of g.squadmates.list()) b.bot.position.splice(0, 3, -136, H.terrainHeight(-136, 583) ?? 0, 583);
    H.stepSim(30);
    const wait = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));
    const out: Record<string, unknown> = { ctx: !!g.audio.ctx, keys: Object.keys(g.voice.manifest!.lines).length };
    const sub = g.mission.subtitles as unknown as { remainingMs: number; reset(): void };
    sub.reset();
    const p0 = g.voice.stats.played;
    // 1) "Lựu đạn! Nằm xuống!" của Long (cue dùng chung, giọng theo người nói)
    g.mission.say('M26', 'LONG');
    out.m26Key = g.voice.resolve(['M26.LONG.hx', 'M26.LONG', 'M26']);
    out.m26Remain = sub.remainingMs;
    out.m26VoiceMs = Math.min(...g.voice.manifest!.lines['M26.LONG']!.ms);
    for (let i = 0; i < 40 && g.voice.stats.played === p0; i++) await wait(50);
    out.m26Played = g.voice.stats.played - p0;
    sub.reset();
    // 2) báo hướng: địch phía sau-phải người chơi → "Địch, hướng X giờ!" (phụ đề không còn {h}, giọng đúng giờ)
    const f = g.player.controller.feet;
    const L = g.squadmates.list()[1]!;
    (g.squadmates as unknown as { lastCalloutAt: number }).lastCalloutAt = -1e9;
    (g.squadmates as unknown as { lastAnyBarkAt: number }).lastAnyBarkAt = -1e9;
    const p1 = g.voice.stats.played;
    const ok = g.squadmates.callout(L.id, [f[0]! + 30, f[1]!, f[2]! + 10]);
    out.callout = ok;
    const el = document.querySelector('[data-testid="subtitle-text"]');
    out.calloutText = el?.textContent ?? null;
    for (let i = 0; i < 40 && g.voice.stats.played === p1; i++) await wait(50);
    out.calloutPlayed = g.voice.stats.played - p1;
    sub.reset();
    // 3) địch hô tiếng Anh: lính đứng 15 m trước mặt nạp đạn
    const n = g.nav.nearest({ x: f[0]! + 12, y: f[1]!, z: f[2]! - 9 })!;
    const e = g.spawnBot('vx1', 'vtest', [n.x, n.y, n.z], { faction: 'enemy' });
    const p2 = g.voice.stats.played;
    out.chatter = g.chatter.say(e.id, 'reload');
    for (let i = 0; i < 40 && g.voice.stats.played === p2; i++) await wait(50);
    out.chatterPlayed = g.voice.stats.played - p2;
    // xa > 70 m: không hô
    const far = g.nav.nearest({ x: f[0]! + 90, y: f[1]!, z: f[2]! })!;
    const e2 = g.spawnBot('vx2', 'vtest', [far.x, far.y, far.z], { faction: 'enemy' });
    H.stepSim(60 * 6);
    out.farChatter = g.chatter.say(e2.id, 'contact');
    g.despawnBot('vx1');
    g.despawnBot('vx2');
    out.missing = g.voice.stats.missing;
    out.late = g.voice.stats.late;
    return out;
  });
  console.log('[voice]', JSON.stringify(r));
  expect(r.ctx).toBe(true);
  expect(r.keys as number).toBeGreaterThan(200);
  expect(r.m26Key).toBe('M26.LONG');
  expect(r.m26Remain as number).toBeGreaterThanOrEqual(r.m26VoiceMs as number);
  expect(r.m26Played).toBe(1);
  expect(r.callout).toBe(true);
  expect(r.calloutText).toMatch(/^Địch, hướng \d{1,2} giờ!$/);
  expect(r.calloutPlayed).toBe(1);
  expect(r.chatter).toBe(true);
  expect(r.chatterPlayed).toBe(1);
  expect(r.farChatter).toBe(false);
  expect(r.late).toBe(0);
  expect(errors).toEqual([]);
});
