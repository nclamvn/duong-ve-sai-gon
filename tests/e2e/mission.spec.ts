import { test, expect } from '@playwright/test';
import { bootGame, pauseLoop, renderFrames, expectNoErrors } from './helpers';

test.describe('G0-11/G0-12 mission node + checkpoint (PRD §6.5, §8, §11 E2E)', () => {
  test('intro → teleport relay_zone → D03 + spawn → kill group → n_done; MISSION_COMPLETE ×1; checkpoint hash khớp', async ({ page }) => {
    const errors = await bootGame(page);
    await pauseLoop(page);
    const intro = await page.evaluate(() => {
      window.__ht!.stepSim(10);
      return { node: window.__ht!.mission.state().currentNode, shown: window.__ht!.mission.subtitlesShown() };
    });
    expect(intro.node).toBe('n_zone');
    expect(intro.shown).toEqual(['D01']);
    await renderFrames(page, 1);
    await expect(page.getByTestId('subtitle-text')).toHaveAttribute('data-cue', 'D01');
    await expect(page.getByTestId('objective')).toContainText('relay');

    // teleport vào zone → D03 (sau khi D01 hết 6.5 s) + spawn group
    const zone = await page.evaluate(() => {
      const H = window.__ht!;
      const z = H.mission.zones()['relay_zone']!;
      H.teleport(z.center[0], 0, z.center[2]);
      H.stepSim(10);
      const st = H.mission.state();
      H.stepSim(60 * 7); // D01 hết → D03 hiện
      return { node: st.currentNode, groups: st.groups, bots: H.bots().filter((b) => b.group === 'bot_group_a').length, cue: H.mission.subtitle(), shown: H.mission.subtitlesShown(), dups: H.events.duplicates() };
    });
    expect(zone.node).toBe('n_clear');
    expect(zone.groups['bot_group_a']).toHaveLength(2);
    expect(zone.bots).toBe(2);
    expect(zone.shown).toContain('D03');
    await renderFrames(page, 1);
    await expect(page.getByTestId('prompt')).toBeVisible();
    await expect(page.getByTestId('prompt')).toContainText('relay');

    // hạ group → n_saved → cp0 → n_done
    const done = await page.evaluate(() => {
      const H = window.__ht!;
      const killed = H.kill('bot_group_a');
      H.stepSim(10);
      return { killed, node: H.mission.state().currentNode, complete: H.mission.state().complete, flags: H.mission.state().flags, completeCount: H.events.countOf('MISSION_COMPLETE'), saves: H.checkpoint.saves(), hash: H.checkpoint.lastHash(), dups: H.events.duplicates() };
    });
    expect(done.killed).toBe(2);
    expect(done.node).toBe('n_done');
    expect(done.complete).toBe(true);
    expect(done.flags['relay_cut']).toBe(true);
    expect(done.completeCount).toBe(1);
    expect(done.saves).toBe(1);
    expect(done.hash).toMatch(/^[0-9a-f]{8}$/);
    await renderFrames(page, 3);
    await expect(page.getByTestId('banner')).toBeVisible();
    await page.screenshot({ path: 'evidence/TIP-009/mission-complete.png' });

    // chơi thêm 20 s rồi load → hash khớp; MISSION_COMPLETE không nhân đôi sau 5 s
    const restored = await page.evaluate(() => {
      const H = window.__ht!;
      H.game.input = { kind: 'replay', snapshot: (t, o) => { o.fwd = 1; o.right = 0; o.sprint = true; o.crouch = false; o.jump = false; o.reload = false; o.interact = false; o.dx = 2; o.dy = 0; o.ads = false; o.fire = t % 30 < 3; } };
      H.stepSim(1200);
      const before = H.stateHash();
      let ok = 0;
      for (let i = 0; i < 5; i++) {
        H.stepSim(60);
        const h = H.checkpoint.load('cp0');
        if (h === H.checkpoint.lastHash() && H.stateHash() === h) ok++;
      }
      H.stepSim(300);
      H.game.input = H.game.defaultInput;
      return { before, ok, completeCount: H.events.countOf('MISSION_COMPLETE'), node: H.mission.state().currentNode, dups: H.events.duplicates() };
    });
    expect(restored.before).not.toBe(done.hash);
    expect(restored.ok).toBe(5);
    expect(restored.node).toBe('n_done');
    expect(restored.completeCount).toBe(1);
    await expectNoErrors(errors);
  });

  test('player chết → Enter nạp checkpoint; không có checkpoint → reset mission', async ({ page }) => {
    const errors = await bootGame(page);
    await pauseLoop(page);
    const r = await page.evaluate(() => {
      const H = window.__ht!;
      H.stepSim(5);
      H.game.player.damage(1000);
      const dead = !H.game.player.alive;
      H.game.respawn(); // chưa có checkpoint → reset
      H.stepSim(5);
      return { dead, aliveAfter: H.game.player.alive, node: H.mission.state().currentNode, health: H.game.player.health, tick: H.metrics().tick };
    });
    expect(r.dead).toBe(true);
    expect(r.aliveAfter).toBe(true);
    expect(r.node).toBe('n_zone');
    expect(r.health).toBe(100);
    await expectNoErrors(errors);
  });
});
