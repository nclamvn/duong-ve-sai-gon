import { test, expect } from '@playwright/test';
import { pauseLoop } from './helpers';

/**
 * Đo thời lượng M1 (DV-085, trước là M1-T2) bằng một "người chơi giả" chơi hết nhiệm vụ trên level thật: giữ F ở điểm tương tác,
 * vừa tiến về marker vừa bắn địch thấy được ≤ 40 m (25 % trúng, loạt 3–5 phát, nạp đạn), đứng bắn khi địch ≤ 15 m, có đếm ngược thì
 * chạy thẳng, tới nơi còn địch thì áp sát. Không chết (máu
 * giữ đầy) nên đây là thời lượng của một người chơi khá, không tính chết/tải lại. Chỉ chạy khi DV_PLAYTIME=1 (chậm).
 */
const QUERY = 'backend=webgl&level=truong-son&autostart=1&debug=1&quality=low&post=off&shadow=512&assets=0&character=0&weapons=0&arms=0&veg=1';

test('M1 thời lượng (người chơi giả)', async ({ page }) => {
  test.skip(!process.env.DV_PLAYTIME, 'chỉ chạy khi DV_PLAYTIME=1');
  test.setTimeout(3_600_000);
  await page.goto(`/?${QUERY}`);
  await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 120_000 });
  await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 2, null, { timeout: 120_000 });
  await pauseLoop(page);
  if (process.env.DV_PLAYTIME_DBG) await page.evaluate(() => ((window as unknown as { __dbgPlay?: boolean }).__dbgPlay = true));
  const out = await page.evaluate(() => {
    const H = window.__ht!;
    const g = H.game;
    const log: Array<{ node: string; t: number; dbg?: string }> = [];
    let dbgN = 0;
    let last = '';
    let t = 0;
    let hold = false;
    let mag = 30;
    let burst = 0;
    let cool = 0;
    let shots = 0;
    let kills = 0;
    let seed = 12345;
    let maxAlive = 0;
    let quiet = 0;
    let maxQuiet = 0;
    let quietAt = '';
    let lastShells = 0;
    const rnd = (): number => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    g.input = { kind: 'replay', snapshot: (_t, o) => { o.fwd = 0; o.right = 0; o.sprint = false; o.crouch = false; o.jump = false; o.reload = false; o.interact = false; o.interactHeld = hold; o.dx = 0; o.dy = 0; o.ads = false; o.fire = false; } };
    const feet = (): [number, number, number] => [g.player.controller.feet[0]!, g.player.controller.feet[1]!, g.player.controller.feet[2]!];
    // đi theo đường navmesh (người chơi thật đi vòng chỗ dốc/nước; đi thẳng thì kẹt ở mép navmesh) — tính lại mỗi 2 s hoặc khi đổi đích
    let path: Array<{ x: number; y: number; z: number }> = [];
    let pathKey = '';
    let pathAt = -1e9;
    const moveToward = (x: number, z: number, speed: number, dt: number, stopAt: number): void => {
      const f = feet();
      const d = Math.hypot(x - f[0], z - f[2]);
      if (d <= stopAt) return;
      const key = `${Math.round(x / 4)},${Math.round(z / 4)}`;
      if (key !== pathKey || t - pathAt > 2) {
        const a = g.nav.nearest({ x: f[0], y: f[1], z: f[2] });
        const b = g.nav.nearest({ x, y: H.terrainHeight(x, z) ?? f[1], z });
        path = a && b ? g.nav.findPath(a, b) : [];
        pathKey = key;
        pathAt = t;
      }
      let budget = Math.min(d - stopAt, speed * dt);
      let px = f[0];
      let pz = f[2];
      while (budget > 0 && path.length) {
        const c = path[0]!;
        const l = Math.hypot(c.x - px, c.z - pz);
        if (l <= budget) {
          px = c.x;
          pz = c.z;
          budget -= l;
          path.shift();
        } else {
          px += ((c.x - px) / l) * budget;
          pz += ((c.z - pz) / l) * budget;
          budget = 0;
        }
      }
      if (!path.length && budget > 0) {
        // không có đường: đi thẳng, bám navmesh gần nhất
        const nx = px + ((x - px) / d) * budget;
        const nz = pz + ((z - pz) / d) * budget;
        const n = g.nav.nearest({ x: nx, y: f[1], z: nz });
        px = n ? n.x : nx;
        pz = n ? n.z : nz;
      }
      H.teleport(px, (H.terrainHeight(px, pz) ?? f[1]) + 0.3, pz);
    };
    const DT = 0.25;
    const process_dbg = !!(window as unknown as { __dbgPlay?: boolean }).__dbgPlay;
    while (t < 60 * 60 && !H.mission.state().complete) {
      g.player.health = 100;
      const node = H.mission.state().currentNode ?? '';
      if (node !== last) {
        log.push({ node, t: Math.round(t) });
        last = node;
      }
      hold = ['clean_ak', 'inspect', 'charge'].includes(g.hud.state.promptKey ?? '');
      // địch thấy được gần nhất
      const f = feet();
      const eye: [number, number, number] = [f[0], f[1] + 1.6, f[2]];
      let best: (typeof g.bots extends Map<string, infer B> ? B : never) | null = null;
      let bd = Infinity;
      let nearAny = Infinity;
      let aliveNow = 0;
      for (const b of g.bots.values()) {
        if (b.faction !== 'enemy' || !b.bot.alive) continue;
        aliveNow++;
        const p = b.bot.position;
        const d = Math.hypot(p[0] - f[0], p[2] - f[2]);
        nearAny = Math.min(nearAny, d);
        if (d > 40 || d >= bd) continue;
        if (!g.physics.hasLineOfSight(eye[0], eye[1], eye[2], p[0], p[1] + b.bot.eyeHeight, p[2])) continue;
        bd = d;
        best = b;
      }
      if (process_dbg && Math.round(t * 4) % 120 === 0 && dbgN++ < 80) {
        const L = g.squadmates.leader();
        log.push({ node, t: Math.round(t), dbg: `p ${feet().map((v) => v.toFixed(0))} L ${L?.bot.position.map((v) => v.toFixed(0))} ${L?.bot.state} m ${g.mission.objectiveMarker?.map((v) => v.toFixed(0))} pace ${g.squadmates.pace} prompt ${g.hud.state.promptKey} dest ${g.mission.squadDest?.map((v) => v.toFixed(0))} near ${nearAny.toFixed(0)} best ${best ? bd.toFixed(0) : '-'} alive ${aliveNow}` });
      }
      maxAlive = Math.max(maxAlive, aliveNow);
      // quãng lặng: không địch sống trong 80 m và không có tiếng nổ/đạn rơi gần (DV-085: không quá 90 s)
      const shellsNow = g.mission.battle?.stats.shells ?? 0;
      if (nearAny <= 80 || shellsNow !== lastShells) quiet = 0;
      else quiet += DT;
      lastShells = shellsNow;
      if (quiet > maxQuiet) {
        maxQuiet = quiet;
        quietAt = node;
      }
      cool -= DT;
      if (best && cool <= 0) {
        if (mag === 0) {
          mag = 30;
          cool = 2.5;
        } else {
          if (burst <= 0) burst = 3 + Math.floor(rnd() * 3);
          const p = best.bot.position;
          const hit = rnd() < 0.25;
          const off = hit ? 0 : 0.5 + rnd() * 1.2;
          const tx = p[0] + off;
          const ty = p[1] + best.bot.eyeHeight - 0.3;
          const dx = tx - eye[0];
          const dy = ty - eye[1];
          const dz = p[2] - eye[2];
          const l = Math.hypot(dx, dy, dz);
          g.events.emit('WEAPON_FIRED', { origin: eye, dir: [dx / l, dy / l, dz / l], weapon: 'ak47' } as never);
          shots++;
          mag--;
          burst--;
          if (hit) {
            const before = best.bot.alive;
            g.events.emit('HIT', { actorId: best.id, zone: 'body', damage: 34, point: [p[0], p[1] + 1, p[2]], penetrated: false, shooter: 'player' });
            if (before && !best.bot.alive) kills++;
          }
          cool = burst > 0 ? 0.11 : 0.6 + rnd() * 0.8;
        }
      }
      // di chuyển (DV-085, nhịp người chơi kiểu CoD): có đếm ngược thì chạy thẳng về marker; địch thấy được trong 15 m thì đứng bắn;
      // còn lại vừa tiến về marker vừa bắn; tới marker mà quanh đó còn địch (≤ 60 m) thì áp sát chậm tới 10 m
      const m = g.mission.objectiveMarker;
      const dMarker = m ? Math.hypot(m[0] - f[0], m[2] - f[2]) : Infinity;
      const urgent = (g.hud.state.objectiveTimer ?? null) !== null && (g.hud.state.objectiveTimer ?? 0) > 0;
      if (hold) {
        // đứng giữ phím
      } else if (urgent && m) moveToward(m[0], m[2], 5, DT, 2);
      else if (best && bd <= 15) {
        // đứng bắn
      } else if (m && dMarker > 6) moveToward(m[0], m[2], 3, DT, 3);
      else if (nearAny <= 60) {
        let tgt: [number, number, number] | null = null;
        let td = Infinity;
        for (const b of g.bots.values()) {
          if (b.faction !== 'enemy' || !b.bot.alive) continue;
          const d = Math.hypot(b.bot.position[0] - f[0], b.bot.position[2] - f[2]);
          if (d < td) {
            td = d;
            tgt = b.bot.position;
          }
        }
        if (tgt) moveToward(tgt[0], tgt[2], 1.5, DT, 10);
      }
      H.stepSim(Math.round(DT * 60));
      t += DT;
    }
    log.push({ node: 'END', t: Math.round(t) });
    return { log, t, shots, kills, maxAlive, maxQuiet, quietAt, enemies: [...g.bots.values()].filter((b) => b.faction === 'enemy').length, complete: H.mission.state().complete };
  });
  console.log('[playtime]', JSON.stringify(out));
  expect(out.complete).toBe(true);
  // DV-085 (BLUEPRINT-M1-T3 §6): ≤ 16 địch sống cùng lúc, không quãng lặng quá 90 s. Thời lượng: người chơi giả này không chết,
  // không nạp lại checkpoint, chạy nước rút khi có đếm ngược → đo 13,4 đến 14,8 phút (2026-10-12); mục tiêu 15–25 phút là của người chơi thật
  // (Chủ nhà chơi thử). Sàn 12 phút để bắt lỗi kịch bản bị rút ngắn (nút nhảy cóc, địch không ra).
  expect(out.t / 60).toBeGreaterThan(12);
  expect(out.t / 60).toBeLessThan(25);
  expect(out.maxAlive).toBeLessThanOrEqual(16);
  expect(out.maxQuiet).toBeLessThanOrEqual(90);
});
