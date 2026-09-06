import { test, expect } from '@playwright/test';
import { pauseLoop, expectNoErrors } from './helpers';

/**
 * M2 R1 — "Điểm cao 31" (Blueprint G2, DV-047): level terrain đêm mới → E2E vật lý người chơi bắt buộc (DV-009/D-075) +
 * props FSB (rào/bao cát có collider), bộc phá (giữ F → 3 s → nổ, đứng thì mất máu, cúi thì không; rào gỡ → đi qua được),
 * mission C1–C2 chạy hết trên sim: pháo chuẩn bị → 3 lớp rào → hầm M60 → hào → hầm chỉ huy (cpA) → đỉnh (cpB) → xong.
 */
const QUERY = 'backend=webgl&level=diem-cao-31&autostart=1&debug=1&quality=low&post=off&shadow=512&assets=0&character=0&weapons=0&arms=0';


test.describe('Điểm cao 31 — M2 R1 (đêm công đồn)', () => {
  test('vật lý terrain đêm: đứng/đi lên dốc/không leo dốc đứng; navmesh bake có props; props FSB có collider; bot bám đất', async ({ page }) => {
    test.setTimeout(300_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text());
    });
    await page.goto(`/?${QUERY}&veg=0&sky=0`);
    await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 120_000 });
    await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 2, null, { timeout: 120_000 });
    await pauseLoop(page);
    const r = await page.evaluate(() => {
      const H = window.__ht!;
      const g = H.game;
      g.aiPaused = true;
      const c = g.player.controller;
      const hAt = (x: number, z: number): number => H.terrainHeight(x, z) ?? NaN;
      const idle = (): void => {
        g.input = { kind: 'replay', snapshot: (_t, o) => { o.fwd = 0; o.right = 0; o.sprint = false; o.crouch = false; o.jump = false; o.reload = false; o.interact = false; o.dx = 0; o.dy = 0; o.ads = false; o.fire = false; } };
      };
      const move = (fwd: number, sprint: boolean): void => {
        g.input = { kind: 'replay', snapshot: (_t, o) => { o.fwd = fwd; o.right = 0; o.sprint = sprint; o.crouch = false; o.jump = false; o.reload = false; o.interact = false; o.dx = 0; o.dy = 0; o.ads = false; o.fire = false; } };
      };
      const feet = (): [number, number, number] => [c.feet[0]!, c.feet[1]!, c.feet[2]!];
      const gap = (): number => c.feet[1]! - hAt(c.feet[0]!, c.feet[2]!);
      const yawTo = (dx: number, dz: number): number => Math.atan2(-dx, -dz);
      idle();
      H.stepSim(180);
      const stand = { feet: feet(), gap: gap(), grounded: c.grounded };
      // đi thẳng lên đồi (hướng đỉnh) 8 s chạy
      const top = H.mission.zones()['top']!;
      const [x0, , z0] = feet();
      g.player.rig.reset(yawTo(top.center[0] - x0, top.center[2] - z0), 0);
      move(1, true);
      let minGap = Infinity;
      let maxGap = -Infinity;
      for (let k = 0; k < 8; k++) {
        H.stepSim(60);
        const gp = gap();
        if (gp < minGap) minGap = gp;
        if (gp > maxGap) maxGap = gp;
      }
      const [x1, y1, z1] = feet();
      const walk = { dist: Math.hypot(x1 - x0, z1 - z0), climb: y1 - stand.feet[1], minGap, maxGap };
      // dốc đứng quanh spawn
      let steep: { x: number; z: number; deg: number; dx: number; dz: number } | null = null;
      for (let rad = 30; rad <= 900 && !steep; rad += 8) {
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 24) {
          const sx = x0 + Math.cos(a) * rad;
          const sz = z0 + Math.sin(a) * rad;
          const dx = (hAt(sx + 2, sz) - hAt(sx - 2, sz)) / 4;
          const dz = (hAt(sx, sz + 2) - hAt(sx, sz - 2)) / 4;
          const deg = (Math.atan(Math.hypot(dx, dz)) * 180) / Math.PI;
          const l = Math.hypot(dx, dz) || 1;
          const ux = dx / l;
          const uz = dz / l;
          const d2 = (hAt(sx + ux * 6, sz + uz * 6) - hAt(sx, sz)) / 6;
          if (deg > 58 && (Math.atan(d2) * 180) / Math.PI > 52) {
            steep = { x: sx, z: sz, deg, dx: ux, dz: uz };
            break;
          }
        }
      }
      let steepRes: { climb: number; deg: number } | null = null;
      if (steep) {
        const bx = steep.x - steep.dx * 3;
        const bz = steep.z - steep.dz * 3;
        c.teleport(bx, hAt(bx, bz) + 0.1, bz);
        g.player.rig.reset(yawTo(steep.dx, steep.dz), 0);
        idle();
        H.stepSim(60);
        const y = c.feet[1]!;
        move(1, false);
        H.stepSim(240);
        steepRes = { climb: c.feet[1]! - y, deg: steep.deg };
      }
      // props: rào lớp 1 chặn người chơi — đứng trước rào 2 m, đi thẳng 3 s: không vượt qua tâm rào quá 0,3 m
      const w1 = H.mission.zones()['w1']!;
      const wire = g.terrain!.props.colliders.find((k) => k.id === 'prop_wire_1_gap')!;
      const dirx = w1.center[0] - top.center[0];
      const dirz = w1.center[2] - top.center[2];
      const dl = Math.hypot(dirx, dirz);
      const ux = dirx / dl;
      const uz = dirz / dl; // từ đỉnh ra ngoài (về spawn)
      const sx = wire.position[0] + ux * 2.5;
      const sz = wire.position[2] + uz * 2.5;
      c.teleport(sx, hAt(sx, sz) + 0.1, sz);
      g.player.rig.reset(yawTo(-ux, -uz), 0);
      idle();
      H.stepSim(30);
      move(1, false);
      H.stepSim(180);
      const f2 = feet();
      const along = (f2[0] - wire.position[0]) * -ux + (f2[2] - wire.position[2]) * -uz; // > 0 = đã qua rào về phía đỉnh
      const ts = H.terrainStats();
      return {
        level: g.levelId,
        stand,
        walk,
        steep: steepRes,
        navPolys: g.nav.polyCount,
        navPrebuilt: ts?.navPrebuilt ?? false,
        props: g.terrain!.props.count,
        propColliders: g.terrain!.props.colliders.length,
        wireBlocked: along,
        bots: H.bots().length,
        botGap: (() => {
          H.stepSim(120);
          return H.bots().map((b) => Math.abs(b.position[1] - hAt(b.position[0], b.position[2])));
        })(),
      };
    });
    expect(r.level).toBe('diem-cao-31');
    expect(r.stand.grounded).toBe(true);
    expect(Math.abs(r.stand.gap)).toBeLessThan(0.3);
    expect(r.walk.dist).toBeGreaterThan(15);
    expect(r.walk.minGap).toBeGreaterThan(-0.3);
    expect(r.walk.maxGap).toBeLessThan(0.6);
    expect(r.walk.climb).toBeGreaterThan(0); // lên đồi
    // đồi 31 là đồi lượn sóng (SRTM 30 m mượt): dốc > 58° hiếm — chỉ kiểm khi tìm thấy (M1 Trường Sơn đã phủ luật maxSlope)
    if (r.steep) expect(r.steep.climb).toBeLessThan(2.5);
    expect(r.navPolys).toBeGreaterThan(500);
    expect(r.navPrebuilt).toBe(true);
    expect(r.props).toBeGreaterThan(150);
    expect(r.propColliders).toBe(r.props);
    expect(r.wireBlocked, 'rào concertina phải chặn người chơi').toBeLessThan(0.3);
    expect(r.bots).toBe(3); // Quyết + Hải + Sáng
    for (const gap of r.botGap) expect(gap).toBeLessThan(0.5);
    await expectNoErrors(errors);
  });

  test('bộc phá + mission C1–C2: pháo chuẩn bị, 3 lớp rào (đứng → mất máu, cúi → không), hầm M60, hào, hầm chỉ huy cpA, đỉnh cpB, xong', async ({ page }) => {
    test.setTimeout(420_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text());
    });
    await page.goto(`/?${QUERY}&veg=0&sky=0`);
    await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 120_000 });
    await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 2, null, { timeout: 120_000 });
    await pauseLoop(page);
    const intro = await page.evaluate(() => {
      const H = window.__ht!;
      H.stepSim(10);
      const sq = H.squad();
      return { node: H.mission.state().currentNode, squad: sq.count, names: sq.members.map((m) => m.name), shown: H.mission.subtitlesShown(), marker: H.hud().marker };
    });
    expect(intro.node).toBe('n_approach');
    expect(intro.squad).toBe(3);
    expect(intro.names).toEqual(['name.quyet', 'name.hai', 'name.sang']);
    expect(intro.shown[0]).toBe('B01');
    expect(intro.marker).not.toBeNull();
    // C1: vào tuyến xuất phát → briefing + pháo 30 s (đạn rơi quanh đỉnh, đất rung), rồi "Đi."
    const c1 = await page.evaluate(() => {
      const H = window.__ht!;
      const g = H.game;
      const z = H.mission.zones()['foot_31']!;
      H.teleport(z.center[0], (H.terrainHeight(z.center[0], z.center[2]) ?? 0) + 0.5, z.center[2]);
      H.stepSim(60);
      const nodeA = H.mission.state().currentNode;
      const hp0 = g.player.health;
      H.stepSim(60 * 12);
      const shellsMid = g.mission.artyStats.shells;
      const blasts = g.blastStats.count;
      H.stepSim(60 * 20);
      return { nodeA, node: H.mission.state().currentNode, shellsMid, shells: g.mission.artyStats.shells, blasts, hp: g.player.health, hp0, shown: H.mission.subtitlesShown(), order: H.squad().order };
    });
    expect(c1.nodeA).toBe('n_approach');
    expect(c1.shellsMid).toBeGreaterThanOrEqual(6); // ~1 đạn/1,1 s
    expect(c1.blasts).toBe(c1.shellsMid);
    expect(c1.hp).toBe(c1.hp0); // ở xa 600 m: không sát thương
    expect(c1.node).toBe('n_go');
    expect(c1.shown).toEqual(expect.arrayContaining(['B02', 'B03', 'B04', 'B05', 'B06', 'B07']));
    expect(c1.order).toBe('follow');
    // C2a: rào 1 — đứng cách 2 m, giữ F 2,6 s → cờ → 3 s → nổ: mất máu (đứng), rào gỡ, đi qua được
    const charge = async (zoneId: string, crouch: boolean) =>
      page.evaluate(
        ({ zoneId, crouch }) => {
          const H = window.__ht!;
          const g = H.game;
          const z = H.mission.zones()[zoneId]!;
          const top = H.mission.zones()['top']!;
          const wireId = `wire_${zoneId.slice(1)}_gap`;
          const wire = g.terrain!.props.colliders.find((k) => k.id === `prop_${wireId}`)!;
          const ux0 = z.center[0] - top.center[0];
          const uz0 = z.center[2] - top.center[2];
          const l = Math.hypot(ux0, uz0);
          const ux = ux0 / l;
          const uz = uz0 / l;
          const sx = wire.position[0] + ux * 2.2;
          const sz = wire.position[2] + uz * 2.2;
          H.teleport(sx, (H.terrainHeight(sx, sz) ?? 0) + 0.3, sz);
          g.player.rig.reset(Math.atan2(ux, uz), 0);
          const hp0 = g.player.health;
          g.input = { kind: 'replay', snapshot: (_t, o) => { o.fwd = 0; o.right = 0; o.sprint = false; o.crouch = false; o.jump = false; o.reload = false; o.interact = true; o.dx = 0; o.dy = 0; o.ads = false; o.fire = false; } };
          H.stepSim(30);
          const promptMid = g.hud.state.promptKey;
          const progMid = g.hud.state.promptProgress;
          H.stepSim(60 * 2.6 + 10);
          const flagDone = H.mission.state().flags[`${zoneId}_charge`] === true;
          // ngòi 3 s: cúi hay đứng
          g.input = { kind: 'replay', snapshot: (_t, o) => { o.fwd = 0; o.right = 0; o.sprint = false; o.crouch = crouch; o.jump = false; o.reload = false; o.interact = false; o.dx = 0; o.dy = 0; o.ads = false; o.fire = false; } };
          H.stepSim(60 * 3.5);
          const blown = H.mission.state().flags[`${zoneId}_charge_blown`] === true;
          const removed = g.terrain!.props.removed.has(wireId);
          const hp1 = g.player.health;
          // đi qua chỗ rào 4 s
          g.input = { kind: 'replay', snapshot: (_t, o) => { o.fwd = 1; o.right = 0; o.sprint = false; o.crouch = false; o.jump = false; o.reload = false; o.interact = false; o.dx = 0; o.dy = 0; o.ads = false; o.fire = false; } };
          g.player.rig.reset(Math.atan2(ux, uz), 0);
          H.stepSim(60 * 4);
          const f = g.player.controller.feet;
          const along = (f[0]! - wire.position[0]) * -ux + (f[2]! - wire.position[2]) * -uz;
          return { promptMid, progMid, flagDone, blown, removed, dmg: hp0 - hp1, along, node: H.mission.state().currentNode, shake: g.player.rig.shakeAmp };
        },
        { zoneId, crouch },
      );
    const w1 = await charge('w1', false);
    expect(w1.promptMid).toBe('charge');
    expect(w1.progMid).toBeGreaterThan(0.1);
    expect(w1.flagDone).toBe(true);
    expect(w1.blown).toBe(true);
    expect(w1.removed).toBe(true);
    expect(w1.dmg, 'đứng cạnh bộc phá phải mất ≥ 25 máu').toBeGreaterThanOrEqual(25);
    expect(w1.along, 'rào đã gỡ → đi qua được').toBeGreaterThan(1.5);
    expect(w1.node).toBe('n_wire2');
    const mg = await page.evaluate(() => window.__ht!.bots().filter((b) => b.group === 'para_mg' && b.alive).length);
    expect(mg).toBe(2);
    const w2 = await charge('w2', true);
    expect(w2.blown).toBe(true);
    expect(w2.dmg, 'cúi → sát thương ≤ 10').toBeLessThanOrEqual(10);
    expect(w2.node).toBe('n_wire3');
    const w3 = await charge('w3', true);
    expect(w3.blown).toBe(true);
    expect(w3.node).toBe('n_mg');
    // C2b–d: hạ hầm M60 → hào (6 + 5 đỉnh đã spawn) → hầm chỉ huy cpA → đỉnh sạch → tiếng xích → xong
    const rest = await page.evaluate(() => {
      const H = window.__ht!;
      const g = H.game;
      const k1 = H.kill('para_mg');
      H.stepSim(10);
      const n1 = H.mission.state().currentNode;
      const trench = H.bots().filter((b) => b.group === 'para_trench' && b.alive).length;
      const topN = H.bots().filter((b) => b.group === 'para_top' && b.alive).length;
      const k2 = H.kill('para_trench');
      H.stepSim(10);
      const n2 = H.mission.state().currentNode;
      const cp = H.mission.zones()['cp']!;
      H.teleport(cp.center[0], (H.terrainHeight(cp.center[0], cp.center[2]) ?? 0) + 0.5, cp.center[2]);
      H.stepSim(20);
      const n3 = H.mission.state().currentNode;
      const cps = g.events.countOf('CHECKPOINT_SAVED');
      const k3 = H.kill('para_top');
      H.stepSim(10);
      const n4 = H.mission.state().currentNode;
      H.stepSim(60 * 15);
      return { k1, n1, trench, topN, k2, n2, n3, cps, k3, n4, node: H.mission.state().currentNode, complete: H.mission.state().complete, shown: H.mission.subtitlesShown(), blasts: g.blastStats, removed: [...g.terrain!.props.removed] };
    });
    expect(rest.k1).toBe(2);
    expect(rest.n1).toBe('n_trench');
    expect(rest.trench).toBe(6);
    expect(rest.topN).toBe(5);
    expect(rest.k2).toBe(6);
    expect(rest.n2).toBe('n_cp');
    expect(rest.n3).toBe('n_cp');
    expect(rest.cps).toBeGreaterThanOrEqual(2); // cp0 + cpA
    expect(rest.k3).toBe(5);
    expect(rest.n4).toBe('n_tanks');
    expect(rest.node).toBe('n_done');
    expect(rest.complete).toBe(true);
    expect(rest.shown).toEqual(expect.arrayContaining(['B08', 'B09', 'B10', 'B11', 'B12', 'B13', 'B14']));
    expect(rest.removed.sort()).toEqual(['wire_1_gap', 'wire_2_gap', 'wire_3_gap']);
    expect(rest.blasts.propsRemoved).toBe(3);
    await expectNoErrors(errors);
  });
});
