import { test, expect } from '@playwright/test';
import { pauseLoop, expectNoErrors } from './helpers';

/**
 * DV-091 chống giật: sau khi màn sẵn sàng, lần đầu một hiệu ứng/lính/máy bay xuất hiện không được sinh chương trình shader mới
 * (mỗi chương trình mới = biên dịch giữa trận = đứng hình). Đo số chương trình fragment trước/sau từng sự kiện lần đầu.
 */
const QUERY = 'backend=webgl&level=truong-son-a&autostart=1&debug=1&quality=low&shadow=512&calm=1&veg=0';

test.describe('DV-091 làm nóng đủ trước khi vào chơi', () => {
  test.setTimeout(600_000);
  test('lần đầu nổ, lửa, napalm, máy bay, lựu đạn, bắn, lính hai phe: không chương trình shader mới', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text());
    });
    await page.goto(`/?${QUERY}`);
    await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 400_000 });
    await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 2, null, { timeout: 200_000 });
    await pauseLoop(page);
    const r = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window.__ht as any).raw;
      const pl = g.bundle.renderer._pipelines;
      const progs = (): number => pl.programs.fragment.size + pl.programs.vertex.size + pl.caches.size;
      const f = g.player.controller.feet as number[];
      const yaw = g.player.rig.yaw as number;
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      const ahead = (d: number, side = 0): [number, number, number] => {
        const x = f[0]! + fx * d + fz * side;
        const z = f[2]! + fz * d - fx * side;
        return [x, g.terrain.heightAt(x, z), z];
      };
      const steps: Array<{ name: string; added: number; worstMs: number }> = [];
      const run = (name: string, act: () => void, frames = 6, dt = 1 / 30): void => {
        const p0 = progs();
        act();
        let worst = 0;
        for (let i = 0; i < frames; i++) {
          const t = performance.now();
          g.frame(dt);
          worst = Math.max(worst, performance.now() - t);
        }
        steps.push({ name, added: progs() - p0, worstMs: Math.round(worst) });
      };
      const bots0 = [...g.bots.values()].map((b: { faction: string; bot: { alive: boolean } }) => b.faction);
      run('idle', () => {});
      const battle = g.mission?.battle;
      run('lua_khoi', () => {
        const p = ahead(14, 4);
        battle.fire(p, 20, 1);
        battle.smoke(p, 20, 1, true);
        battle.smoke(ahead(16, -5), 20, 1, false);
      });
      run('no', () => g.explode(ahead(12, -3), { radius: 6, damage: 0 }), 10);
      run('no_sat', () => g.explode(ahead(3), { radius: 6, damage: 0 }), 10);
      run('linh_dich', () => {
        g.spawnBot('zz_w1', 'probe', ahead(10, 2), { faction: 'enemy', archetype: 'grunt' });
        g.spawnBot('zz_w2', 'probe', ahead(11, -2), { faction: 'enemy', archetype: 'recon' });
      });
      run('linh_ta', () => g.spawnBot('zz_w3', 'probe', ahead(6, 2), { faction: 'friend', support: true }));
      run('bom_napalm', () => battle.handle({ type: 'napalm', from: [ahead(30, -20)[0], ahead(30, -20)[2]], to: [ahead(30, 20)[0], ahead(30, 20)[2]], delayMs: 0, damage: 0 }), 40, 0.1);
      run('may_bay', () => {
        for (const id of ['f4_pair', 'b52_cell', 'huey_insert']) g.sky?.trigger(id);
      }, 40, 0.25);
      run('luu_dan', () => g.throwGrenade(), 40, 0.1);
      run('dat_vut', () => g.blast.spray(ahead(3), [f[0]!, f[1]! + 1.6, f[2]!], 1), 6);
      run('phim', () => g.setFilm(1), 10, 0.2);
      return { steps, character: !!g.assets?.character, bots0: bots0.length, sky: !!g.sky };
    });
    console.log(JSON.stringify(r));
    const bad = r.steps.filter((s) => s.added > 0);
    expect(bad, `sự kiện lần đầu sinh chương trình shader mới: ${JSON.stringify(bad)}`).toEqual([]);
    expectNoErrors(errors);
  });
});
