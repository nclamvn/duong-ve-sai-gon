import { test, expect } from '@playwright/test';
import { pauseLoop, expectNoErrors, renderFrames } from './helpers';

/**
 * TIP-D04 — Trường Sơn (terrain DEM): E2E vật lý người chơi bắt buộc cho mọi level mới (DV-009/D-075).
 * Đứng trên terrain, đi lên dốc thoải không xuyên đất, dốc quá maxSlope (50°) không leo được; navmesh có poly; terrain ≤ 4 draw.
 * Chạy nhẹ: assets=0 (không model/HDRI; texture vẫn nạp), không nhân vật/súng.
 */
const QUERY = 'backend=webgl&level=truong-son&autostart=1&debug=1&quality=low&post=off&shadow=512&assets=0&character=0&weapons=0&arms=0';

test.describe('Trường Sơn — vật lý terrain (TIP-D04)', () => {
  test('đứng/đi lên dốc/không leo dốc đứng; heightfield + navmesh + LOD', async ({ page }) => {
    test.setTimeout(300_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text());
    });
    await page.goto(`/?${QUERY}&calm=1`); // DV-085: M1 mở màn bằng phục kích; test vật lý không cần địch
    await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 90_000 });
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
      /** yaw để forward = hướng (dx, dz): forward = (−sin yaw, 0, −cos yaw) */
      const yawTo = (dx: number, dz: number): number => Math.atan2(-dx, -dz);
      // 1) đứng yên 3 s
      idle();
      H.stepSim(180);
      const stand = { feet: feet(), gap: gap(), grounded: c.grounded };
      // 2) hướng lên dốc thoải: gradient tại trại trên đường mòn (chỗ xuất phát trước DV-085; chỗ mới ở đáy thung bên suối gần như phẳng)
      H.teleport(-134, hAt(-134, 580) + 0.3, 580);
      idle();
      H.stepSim(60);
      const [x0, , z0] = feet();
      const e = 4;
      const gx = (hAt(x0 + e, z0) - hAt(x0 - e, z0)) / (2 * e);
      const gz = (hAt(x0, z0 + e) - hAt(x0, z0 - e)) / (2 * e);
      const gl = Math.hypot(gx, gz) || 1;
      g.player.rig.reset(yawTo(gx / gl, gz / gl), 0);
      move(1, true);
      let minGap = Infinity;
      let maxGap = -Infinity;
      let anyAir = 0;
      for (let k = 0; k < 8; k++) {
        H.stepSim(60);
        const gp = gap();
        if (gp < minGap) minGap = gp;
        if (gp > maxGap) maxGap = gp;
        if (!c.grounded) anyAir++;
      }
      const [x1, y1, z1] = feet();
      const walk = { dist: Math.hypot(x1 - x0, z1 - z0), climb: y1 - hAt(x0, z0), minGap, maxGap, anyAir, slopeDeg: (Math.atan(gl) * 180) / Math.PI };
      // 3) dốc đứng: quét quanh spawn (bán kính ≤ 300 m, bước 6 m) tìm ô dốc > 58°, đứng ở chân dốc và đi lên 4 s
      let steep: { x: number; z: number; deg: number; dx: number; dz: number } | null = null;
      for (let rad = 30; rad <= 300 && !steep; rad += 6) {
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 24) {
          const sx = x0 + Math.cos(a) * rad;
          const sz = z0 + Math.sin(a) * rad;
          const dx = (hAt(sx + 2, sz) - hAt(sx - 2, sz)) / 4;
          const dz = (hAt(sx, sz + 2) - hAt(sx, sz - 2)) / 4;
          const deg = (Math.atan(Math.hypot(dx, dz)) * 180) / Math.PI;
          // dốc đứng liên tục ≥ 6 m theo hướng lên
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
      let steepRes: { start: number; end: number; climb: number; deg: number } | null = null;
      if (steep) {
        // chân dốc: lùi 3 m theo hướng xuống
        const bx = steep.x - steep.dx * 3;
        const bz = steep.z - steep.dz * 3;
        c.teleport(bx, hAt(bx, bz) + 0.1, bz);
        g.player.rig.reset(yawTo(steep.dx, steep.dz), 0);
        idle();
        H.stepSim(60);
        const y0 = c.feet[1]!;
        move(1, false);
        H.stepSim(240);
        steepRes = { start: y0, end: c.feet[1]!, climb: c.feet[1]! - y0, deg: steep.deg };
      }
      const ts = H.terrainStats();
      return {
        level: g.levelId,
        collider: g.arena.colliders.find((x) => x.id === 'terrain')?.kind,
        stand,
        walk,
        steep: steepRes,
        navPolys: g.nav.polyCount,
        navPrebuilt: ts?.navPrebuilt ?? false,
        terrainDraws: ts?.draws ?? -1,
        bots: H.bots().length,
        // TIP-D11a: bot tuần tra bám mặt đất (không "bay" theo y góc kế của path) — đo sau 3 s sim
        botGap: (() => {
          H.stepSim(180);
          return H.bots().map((b) => Math.abs(b.position[1] - hAt(b.position[0], b.position[2])));
        })(),
      };
    });
    expect(r.level).toBe('truong-son');
    expect(r.collider).toBe('heightfield');
    // đứng 3 s: chân cách mặt đất ≤ 0,3 m, không rơi
    expect(r.stand.grounded).toBe(true);
    expect(Math.abs(r.stand.gap)).toBeLessThan(0.3);
    // đi lên dốc thoải 8 s: tiến ≥ 15 m, luôn ≥ mặt đất − 0,3 (không xuyên), không bay quá 0,6 m
    expect(r.walk.dist).toBeGreaterThan(15);
    expect(r.walk.minGap).toBeGreaterThan(-0.3);
    expect(r.walk.maxGap).toBeLessThan(0.6);
    expect(r.walk.climb).toBeGreaterThan(0);
    // dốc > 58°: đi 4 s leo < 2,5 m (maxSlopeDeg 50)
    expect(r.steep, 'không tìm thấy dốc đứng trong 300 m quanh spawn').not.toBeNull();
    expect(r.steep!.climb).toBeLessThan(2.5);
    expect(r.navPolys).toBeGreaterThan(0);
    expect(r.bots).toBeGreaterThan(0);
    for (const gap of r.botGap) expect(gap).toBeLessThan(0.5);
    expect(r.terrainDraws).toBeGreaterThan(0);
    expect(r.terrainDraws).toBeLessThanOrEqual(4);
    expect(r.bots).toBe(5); // tổ ta Quyết, Hải, Sáng, Đức, Toàn (AI-T1.5) — không còn bot ambient
    await expectNoErrors(errors);
  });

  /**
   * TIP-D05 — rừng loài thật (PRD VEG-001/004/006): scatter seeded → batch instanced theo ô + LOD + impostor; thân cây có collider.
   * `veg=1` bật rừng dù lite (assets=0). Ngưỡng ở quality=low (density 0,5 · lodScale 0,6): 9 loài, draw rừng ≤ 140, tam giác rừng ≤ 1,5 M,
   * tổng renderer ≤ 4 M (ngân sách đỏ PRD); người chơi đi thẳng vào thân cây 4 s không xuyên (khoảng cách tới trục ≥ r + bán kính capsule − 5 cm).
   */
  test('rừng: batch/LOD/impostor trong ngân sách; thân cây chặn người chơi; gió; không lỗi console', async ({ page }) => {
    test.setTimeout(300_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text());
    });
    await page.goto(`/?${QUERY}&veg=1&calm=1`);
    await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 120_000 });
    await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 2, null, { timeout: 120_000 });
    await pauseLoop(page);
    const r = await page.evaluate(async () => {
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
      const yawTo = (dx: number, dz: number): number => Math.atan2(-dx, -dz);
      // renderer.info reset theo rAF frame → mỗi frame đo trong một tick rAF riêng (frame() liên tiếp trong 1 task sẽ cộng dồn)
      const frameRaf = (): Promise<void> => new Promise((res) => requestAnimationFrame(() => { g.frame(1 / 60); res(); }));
      // thống kê tại spawn, quét 4 hướng để lấy max
      const stats: Array<{ draws: number; tris: number; total: number; calls: number; visible: number; imp: number; by?: Record<string, number> }> = [];
      for (let k = 0; k < 4; k++) {
        g.player.rig.reset((k * Math.PI) / 2, 0);
        for (let i = 0; i < (k === 0 ? 2 : 1); i++) await frameRaf();
        const v = H.vegetationStats()!;
        const m = H.metrics();
        stats.push({ draws: v.draws, tris: v.triangles, total: m.triangles, calls: m.calls, visible: v.visible, imp: v.impostors, by: v.trisByAsset });
      }
      const v0 = H.vegetationStats()!;
      // collider thân cây gần spawn nhất (tree_gn) → đứng cách 3 m, đi thẳng vào 4 s
      const ps = g.arena.playerSpawn;
      const trunks = g.arena.colliders.filter((x) => x.id.startsWith('veg_tree_gn_'));
      let best = trunks[0]!;
      let bd = Infinity;
      for (const t of trunks) {
        const d = Math.hypot(t.position[0] - ps[0], t.position[2] - ps[2]);
        if (d < bd) { bd = d; best = t; }
      }
      const r = best.size[0];
      const tx = best.position[0];
      const tz = best.position[2];
      const ang = 0.7;
      const sx = tx + Math.sin(ang) * 3;
      const sz = tz + Math.cos(ang) * 3;
      c.teleport(sx, hAt(sx, sz) + 0.1, sz);
      g.player.rig.reset(yawTo(tx - sx, tz - sz), 0);
      idle();
      H.stepSim(30);
      move(1, false);
      let minD = Infinity;
      let maxD = 0;
      for (let k = 0; k < 8; k++) {
        H.stepSim(30);
        const d = Math.hypot(c.feet[0]! - tx, c.feet[2]! - tz);
        if (d < minD) minD = d;
        if (d > maxD) maxD = d;
      }
      idle();
      // gió: đổi strength không lỗi
      H.setWind(0.9, 1, 0);
      await frameRaf();
      H.setWind(0.35);
      const gap = c.feet[1]! - hAt(c.feet[0]!, c.feet[2]!);
      // navmesh có obstacle thân cây (bake --level / runtime): điểm navmesh gần nhất tới trục thân ≥ r − 0,3 m (cs 0,5)
      const nr = g.terrain!.def.terrain.navRect;
      const inRect = trunks.filter((t) => Math.abs(t.position[0] - nr.x) < nr.w / 2 - 8 && Math.abs(t.position[2] - nr.z) < nr.h / 2 - 8).slice(0, 60);
      let navOnTrunk = 0;
      let navChecked = 0;
      for (const t of inRect) {
        const n = g.nav.nearest({ x: t.position[0], y: t.position[1] - t.size[1], z: t.position[2] });
        if (!n) continue;
        navChecked++;
        if (Math.hypot(n.x - t.position[0], n.z - t.position[2]) < t.size[0] - 0.3) navOnTrunk++;
      }
      // đồng đội đi theo 15 s (người chơi chạy) — không thành viên nào lọt vào thân cây (Chủ nhà Mac: "đồng đội chạy xuyên qua cây");
      // bước di chuyển trượt trên navmesh (moveAlong) + obstacle đệm theo loài (Tree GN rễ bạnh 1 m)
      g.aiPaused = false;
      // đo đi theo người chơi ở nhịp thường (M1-T2: đầu nhiệm vụ là nhịp hành quân theo Quyết về suối, không theo người chơi)
      g.squadmates.pace = 'normal';
      g.mission.squadDest = null;
      // kéo đồng đội về gần rồi để họ tự đi theo (người chơi đã chạy xa trong các bước trên)
      for (const b of g.bots.values()) {
        const f = c.feet;
        b.bot.position[0] = f[0]! + (b.id.endsWith('0') ? -2 : 2);
        b.bot.position[2] = f[2]! + 2;
        b.bot.position[1] = hAt(b.bot.position[0], b.bot.position[2]);
      }
      move(1, true);
      let botInTrunk = 0;
      let botSamples = 0;
      for (let k = 0; k < 30; k++) {
        H.stepSim(30);
        for (const b of H.bots()) {
          if (!b.alive) continue;
          botSamples++;
          for (const t of trunks) {
            const dd = Math.hypot(b.position[0] - t.position[0], b.position[2] - t.position[2]);
            if (dd < t.size[0] - 0.05 && Math.abs(b.position[1] - (t.position[1] - t.size[1])) < 4) botInTrunk++;
          }
        }
      }
      idle();
      H.stepSim(60 * 5); // đứng lại 5 s cho đội hình khép
      g.aiPaused = true;
      const squadAfter = H.squad();
      return {
        squad: { samples: botSamples, inTrunk: botInTrunk, followerDist: squadAfter.followerDist, leaderDist: squadAfter.leaderDist, count: squadAfter.count },
        nav: { checked: navChecked, onTrunk: navOnTrunk, prebuilt: !!g.terrain!.navPrebuilt, polys: g.nav.polyCount },
        species: v0.species,
        placed: v0.placed,
        perSpecies: v0.perSpecies,
        colliders: v0.colliders,
        loadMs: v0.loadMs,
        bakeMs: v0.bakeMs,
        cpuMs: v0.cpuMs,
        stats,
        trunk: { r, distFromSpawn: bd, minD, maxD, capsule: c.cfg.radius, gap, grounded: c.grounded },
        atlasTree: !!g.forest?.atlases['shorea'],
      };
    });
    // DV-057: 11 luật (tree_gn vượt tán + tree_canopy tán chính cùng GLB; fern_gap cùng GLB fern); DV-059 +7 lớp nền rừng CC0
    expect(r.species).toBe(30); // DV-080 +1 luật lá rụng dưới tán (litter) // DV-064: thay asset, không thêm luật (cọ quạt Megascans tối đen dưới tán ở WebGL sandbox, tạm gỡ) // DV-060 +11 luật (bờ khe, lòng khe, đá tảng, vách đá, quanh hố bom), gỡ Monstera
    expect(r.placed).toBeGreaterThan(10_000);
    expect(r.perSpecies['tree_gn']).toBeGreaterThan(150);
    expect(r.perSpecies['litter'] ?? 0).toBeGreaterThan(1000); // DV-080
    expect(r.perSpecies['tree_canopy']).toBeGreaterThan(2 * (r.perSpecies['tree_gn'] ?? 0));
    expect(r.colliders).toBeGreaterThan(1000);
    expect(r.atlasTree).toBe(true);
    for (const s of r.stats) {
      expect(s.draws, JSON.stringify(r.stats)).toBeGreaterThan(10);
      expect(s.draws).toBeLessThanOrEqual(140);
      expect(s.tris, JSON.stringify(s.by)).toBeLessThanOrEqual(1_500_000);
      expect(s.total).toBeLessThanOrEqual(4_000_000);
      expect(s.calls, JSON.stringify(r.stats)).toBeLessThanOrEqual(280);
    }
    expect(Math.max(...r.stats.map((s) => s.visible))).toBeGreaterThan(100);
    expect(Math.max(...r.stats.map((s) => s.imp))).toBeGreaterThan(20);
    expect(r.cpuMs).toBeLessThan(8);
    // thân cây: không xuyên (tâm capsule cách trục ≥ r + capsule − 5 cm), vẫn đứng trên đất
    expect(r.trunk.minD).toBeGreaterThanOrEqual(r.trunk.r + r.trunk.capsule - 0.05);
    expect(r.trunk.minD).toBeLessThan(3);
    expect(Math.abs(r.trunk.gap)).toBeLessThan(0.4);
    // bot không đi xuyên cây: navmesh không có điểm trong thân
    expect(r.nav.checked).toBeGreaterThan(20);
    expect(r.nav.onTrunk, JSON.stringify(r.nav)).toBe(0);
    // đồng đội theo 15 s qua rừng: không mẫu nào trong thân cây, vẫn bám ≤ 12 m (theo) / ≤ 16 m (dẫn)
    console.log('[DV-057 forest]', JSON.stringify({ perSpecies: r.perSpecies, placed: r.placed, stats: r.stats, cpuMs: r.cpuMs }));
    expect(r.squad.samples).toBeGreaterThan(40);
    expect(r.squad.inTrunk, JSON.stringify(r.squad)).toBe(0);
    expect(r.squad.count).toBe(5);
    expect(r.squad.followerDist, JSON.stringify(r.squad)).toBeLessThanOrEqual(12);
    expect(r.squad.leaderDist, JSON.stringify(r.squad)).toBeLessThanOrEqual(16);
    await expectNoErrors(errors);
  });

  /**
   * TIP-D-SKY — máy bay là thời tiết: lịch bay seeded (F-4 cặp, F-4 trúng đạn → dù, UH-1 cặp + treo đổ quân, C-130, tổ 3 B-52), model thật
   * air_* (Sketchfab CC-BY, DV-042; `?skyModel=<id>` vẫn dùng được để thử stand-in); tua lịch bằng `skyAdvance`: có lượt bay, cao độ trên
   * địa hình, treo đúng điểm/AGL, dù thả ≥ 400 m, gió xoáy trực thăng đổi gió rừng (VEG-002), cánh quạt UH-1 quay, không lỗi console.
   */
  test('bầu trời: lượt bay theo lịch seeded, treo đổ quân, dù phi công, gió xoáy', async ({ page }) => {
    test.setTimeout(300_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text());
    });
    await page.goto(`/?${QUERY}&veg=1&vegDensity=0.2&sky=1&calm=1`);
    await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 120_000 });
    await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 2, null, { timeout: 120_000 });
    await pauseLoop(page);
    const r = await page.evaluate(async () => {
      const H = window.__ht!;
      const g = H.game;
      g.aiPaused = true;
      const hAt = (x: number, z: number): number => H.terrainHeight(x, z) ?? NaN;
      const frameRaf = (): Promise<void> => new Promise((res) => requestAnimationFrame(() => { g.frame(1 / 60); res(); }));
      const s0 = H.skyStats()!;
      // tới t = 60 s của lịch bay: F-4 cặp (first 40) + UH-1 cặp (first 20) đang bay. Đồng hồ trời đã chạy trong lúc nạp
      // (nạp rừng DV-064 lâu hơn → s0.time có thể > 20 s), nên tiến tới mốc tuyệt đối chứ không cộng 60 s
      H.skyAdvance(Math.max(0, 60 - s0.time));
      await frameRaf();
      const s1 = H.skyStats()!;
      const above = s1.runsNow.map((run) => ({ id: run.id, agl: run.pos[1] - hAt(Math.max(-1000, Math.min(1000, run.pos[0])), Math.max(-1000, Math.min(1000, run.pos[2]))) }));
      // mũi máy bay phải đi trước: bộ phận đầu mũi (buồng lái/kính/cánh quạt — material đặc trưng từng model) nằm phía trước
      // tâm thân theo hướng bay. Chủ nhà thấy UH-1 "bay giật lùi" khi GLB convert ngược chiều (DV-042) — engine chỉ xoay model +x theo
      // vận tốc nên phải kiểm bằng hình học asset, không kiểm được bằng trục.
      const NOSE_MAT: Record<string, string> = { air_uh1b: 'cockpit', air_f4: 'Mat2', air_b52: 'Glass', air_c130: 'DefaultWhite_propeller.png' };
      const noseDot: Array<{ id: string; model: string; ahead: number }> = [];
      type O3 = { position: { x: number; y: number; z: number }; children: O3[]; name: string; isMesh?: boolean; material?: { name: string }; geometry?: { computeBoundingBox(): void; boundingBox: { clone(): { applyMatrix4(m: unknown): { getCenter(v: { x: number; y: number; z: number }): { x: number; y: number; z: number } } } } }; matrixWorld: unknown; traverse(cb: (o: O3) => void): void; getWorldPosition(v: { x: number; y: number; z: number }): { x: number; y: number; z: number } };
      const sky = g.sky as unknown as { runs: Array<{ def: { id: string; model: string }; phase: string; ships: O3[] }> };
      for (const run of sky.runs) {
        if (run.phase !== 'fly') continue;
        const ship = run.ships[0]!;
        const p0 = { x: ship.position.x, y: ship.position.y, z: ship.position.z };
        await frameRaf();
        const vel = { x: ship.position.x - p0.x, y: ship.position.y - p0.y, z: ship.position.z - p0.z };
        const vl = Math.hypot(vel.x, vel.y, vel.z) || 1;
        let nose: O3 | null = null;
        ship.traverse((o) => { if (o.isMesh && o.material?.name === NOSE_MAT[run.def.model] && !nose) nose = o; });
        if (!nose) { noseDot.push({ id: run.def.id, model: run.def.model, ahead: NaN }); continue; }
        const n = nose as O3;
        n.geometry!.computeBoundingBox();
        const V = g.camera.position.constructor as new () => { x: number; y: number; z: number };
        const c = n.geometry!.boundingBox.clone().applyMatrix4(n.matrixWorld).getCenter(new V());
        const sp = ship.getWorldPosition(new V());
        noseDot.push({ id: run.def.id, model: run.def.model, ahead: ((c.x - sp.x) * vel.x + (c.z - sp.z) * vel.z) / vl });
      }
      // huey_insert không theo lịch (mission M1 kích hoạt bằng sky_trigger khi tới bãi bốc) → kích thủ công; 1500 m / 38 m/s ≈ 40 s + giảm tốc
      const triggered = H.skyTrigger('huey_insert');
      let hover: { id: string; phase: string; pos: [number, number, number] } | null = null;
      for (let k = 0; k < 40 && !hover; k++) {
        H.skyAdvance(5);
        const st = H.skyStats()!;
        const h = st.runsNow.find((run) => run.id === 'huey_insert' && run.phase === 'hover');
        if (h) hover = h;
      }
      const hoverAgl = hover ? hover.pos[1] - hAt(hover.pos[0], hover.pos[2]) : NaN;
      // gió xoáy: đặt người nghe (camera) ngay dưới trực thăng treo → gust > 0 và gió rừng tăng
      let gust = 0;
      let windAfter = 0;
      let rotorSpin = -1;
      if (hover) {
        const base = g.forest!.system.wind.strength.value;
        g.cameraDriver = () => { g.camera.position.set(hover!.pos[0] + 5, hAt(hover!.pos[0], hover!.pos[2]) + 1.7, hover!.pos[2] + 5); };
        await frameRaf();
        await frameRaf();
        gust = H.skyStats()!.gust;
        windAfter = g.forest!.system.wind.strength.value;
        void base;
        // cánh quạt: node rotor_01 (pivot tách từ skin — convert-model --split-joints) quay mỗi frame
        const rotor = g.scene.getObjectByName('sky_huey_insert_0')?.getObjectByName('rotor_01');
        if (rotor) {
          const a0 = rotor.rotation.y;
          await frameRaf();
          rotorSpin = Math.abs(rotor.rotation.y - a0);
        }
      }
      // dù: f4_hit first 240, thả ở giữa đường (~12 s sau) — tua tới 330 s tổng và kiểm có dù
      const before = H.skyStats()!.time;
      H.skyAdvance(Math.max(0, 330 - before));
      const s3 = H.skyStats()!;
      return { s0: { flights: s0.flights }, s1: { active: s1.active, runs: s1.runs, ids: s1.runsNow.map((x) => x.id) }, above, noseDot, triggered, hover, hoverAgl, gust, windAfter, rotorSpin, paras: s3.parasNow.length, parasStat: s3.parachutes, runsTotal: s3.runs };
    });
    expect(r.s0.flights).toBe(6);
    expect(r.s1.active).toBeGreaterThanOrEqual(1);
    expect(r.s1.ids).toContain('huey_pair');
    for (const a of r.above) expect(a.agl, JSON.stringify(r.above)).toBeGreaterThan(30);
    expect(r.noseDot.length).toBeGreaterThanOrEqual(1);
    for (const n of r.noseDot) expect(n.ahead, `mũi ${n.model} (${n.id}) không đi trước — bay giật lùi ${JSON.stringify(r.noseDot)}`).toBeGreaterThan(0.5);
    expect(r.triggered, 'skyTrigger huey_insert').toBe(true);
    expect(r.hover, 'huey_insert chưa vào pha treo trong 200 s').not.toBeNull();
    expect(Math.abs(r.hover!.pos[0] - -292)).toBeLessThan(3);
    expect(Math.abs(r.hover!.pos[2] - 306)).toBeLessThan(3);
    expect(r.hoverAgl).toBeGreaterThan(2);
    expect(r.hoverAgl).toBeLessThan(8);
    expect(r.gust).toBeGreaterThan(0.3);
    expect(r.windAfter).toBeGreaterThan(0.5);
    expect(r.rotorSpin, 'rotor_01 của UH-1 không quay').toBeGreaterThan(0.05);
    expect(r.paras + r.parasStat).toBeGreaterThanOrEqual(1);
    expect(r.runsTotal).toBeGreaterThanOrEqual(5);
    await expectNoErrors(errors);
  });

  /**
   * DV-085 (BLUEPRINT-M1-T3) — M1 bản dồn dập chạy hết bằng stepSim + teleport: phục kích bên suối ngay giây đầu (cối, đòn đánh),
   * đuổi qua suối với nhịp xung phong, napalm (Khang hy sinh), toán chặn, sườn đồi, B-52 (vào lòng suối thì sống), tàn quân, gài
   * bộc phá cây cảm biến + giữ chốt 90 s, tổ phục trong khe (im khi xa, khai hoả khi gần), dốc, bãi đáp 2 lượt trực thăng (Hoàn hy
   * sinh), pháo bắn chặn, rút → xong. Luật phe, hit marker, chết nằm hẳn; mọi điểm ra quân của M1 nằm trên navmesh; không lỗi console.
   */
  test('M1 Cổng Trời (DV-085): 7 hồi dồn dập, napalm, B-52, cảm biến, khe, dốc, bãi đáp; HUD cao cấp', async ({ page }) => {
    test.setTimeout(480_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text());
    });
    await page.goto(`/?${QUERY}&veg=0&sky=1`);
    await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 120_000 });
    await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 2, null, { timeout: 120_000 });
    await pauseLoop(page);
    // mọi điểm ra quân của M1 bám navmesh (≤ 1,5 m ngang)
    const nav = await page.evaluate(() => {
      const H = window.__ht!;
      const g = H.game;
      const used = new Set<string>();
      for (const sg of g.mission.def.spawnGroups ?? []) for (const s of sg.spawns ?? [sg.spawn]) used.add(s);
      const bad: string[] = [];
      for (const k of used) {
        const p = g.arena.botSpawns[k]!;
        const n = g.nav.nearest({ x: p[0], y: p[1], z: p[2] });
        const d = n ? Math.hypot(n.x - p[0], n.z - p[2]) : Infinity;
        if (d > 1.5) bad.push(`${k} ${d.toFixed(1)}`);
      }
      return { n: used.size, bad };
    });
    expect(nav.n).toBeGreaterThan(60);
    expect(nav.bad).toEqual([]);
    const intro = await page.evaluate(() => {
      const H = window.__ht!;
      const g = H.game;
      g.player.health = 1e9;
      H.stepSim(10);
      const sq = H.squad();
      return { node: H.mission.state().currentNode, squad: sq.count, names: sq.members.filter((m) => m.faction === 'friend').map((m) => m.name), a1: H.bots().filter((b) => b.group === 'a1_bo' && b.alive).length, shown: H.mission.subtitlesShown(), hud: H.hud() };
    });
    expect(intro.node).toBe('n_a1');
    expect(intro.squad).toBe(5);
    expect(intro.names).toEqual(['name.quyet', 'name.long', 'name.dat', 'name.hoan', 'name.khang']);
    expect(intro.a1).toBe(6);
    expect(intro.shown[0]).toBe('M71');
    expect(intro.hud.marker).not.toBeNull();
    await renderFrames(page, 2);
    await expect(page.getByTestId('objective')).toContainText('phục kích');
    await expect(page.getByTestId('compass')).toBeVisible();
    await expect(page.getByTestId('minimap')).toBeVisible();
    await expect(page.getByTestId('ammo')).toContainText('AK-47');
    expect(await page.locator('[data-testid="marker-obj"]').count()).toBe(1);
    // la bàn: quay 90° phải → số hướng đổi ~90
    const heading = await page.evaluate(async () => {
      const H = window.__ht!;
      const g = H.game;
      const h0 = H.hud().heading;
      g.player.rig.yaw -= Math.PI / 2;
      g.input = { kind: 'replay', snapshot: (_t, o) => { o.fwd = 0; o.right = 0; o.sprint = false; o.crouch = false; o.jump = false; o.reload = false; o.interact = false; o.dx = 0; o.dy = 0; o.ads = false; o.fire = false; } };
      H.stepSim(2);
      await new Promise((res) => requestAnimationFrame(() => { g.frame(1 / 60); res(null); }));
      return { h0, h1: H.hud().heading, text: document.querySelector('[data-testid="heading"]')?.textContent };
    });
    expect((((heading.h1 - heading.h0) % 360) + 360) % 360).toBeCloseTo(90, 0);
    expect(heading.text).toBe(String(Math.round(heading.h1)).padStart(3, '0'));
    // luật phe: người chơi/đồng đội không làm đồng đội mất máu; địch thì có; hit marker + vòng trúng đạn
    const rules = await page.evaluate(() => {
      const H = window.__ht!;
      const g = H.game;
      const sq = H.squad();
      const friend = sq.members.find((m) => m.faction === 'friend' && m.name === 'name.long')!;
      const enemy = sq.members.find((m) => m.faction === 'enemy' && m.alive)!;
      const hpBefore = friend.health;
      g.events.emit('HIT', { actorId: friend.id, zone: 'body', damage: 8, point: [0, 0, 0], penetrated: false, shooter: 'player' });
      g.events.emit('HIT', { actorId: friend.id, zone: 'body', damage: 8, point: [0, 0, 0], penetrated: false, shooter: sq.members.find((m) => m.faction === 'friend' && m.id !== friend.id)!.id });
      const hpMid = H.squad().members.find((m) => m.id === friend.id)!.health;
      g.events.emit('HIT', { actorId: friend.id, zone: 'body', damage: 8, point: [0, 0, 0], penetrated: false, shooter: enemy.id });
      const hpAfter = H.squad().members.find((m) => m.id === friend.id)!.health;
      const hud0 = H.hud();
      g.events.emit('HIT', { actorId: enemy.id, zone: 'body', damage: 1, point: [0, 0, 0], penetrated: false, shooter: 'player' });
      g.events.emit('HIT', { actorId: 'player', zone: 'body', damage: 1, point: [0, 0, 0], penetrated: false, shooter: enemy.id });
      const hud1 = H.hud();
      return { hpBefore, hpMid, hpAfter, hits: hud1.hits - hud0.hits, dmg: hud1.damageIndicators - hud0.damageIndicators };
    });
    expect(rules.hpMid).toBe(rules.hpBefore);
    expect(rules.hpAfter).toBe(rules.hpBefore - 8);
    expect(rules.hits).toBe(1);
    expect(rules.dmg).toBe(1);
    await renderFrames(page, 1);
    expect(await page.locator('[data-testid="hitmarker"].show').count()).toBe(1);
    expect(await page.locator('[data-testid="damage-dir"] .on').count()).toBe(1);
    // chết phải nằm hẳn
    const death = await page.evaluate(() => {
      const H = window.__ht!;
      const g = H.game;
      const b = [...g.bots.values()].find((x) => x.group === 'a1_bo' && x.bot.alive)!;
      type V3 = { x: number; y: number; z: number };
      const vis = b.dummy as unknown as { kind: string; char?: { mixer: { _actions: Array<{ _clip: { name: string }; getEffectiveWeight(): number; isScheduled(): boolean }> } }; bones: { head: { getWorldPosition(v: V3): V3 } }; setPose(t: number): void; group: { rotation: { x: number } } };
      let t = 100;
      vis.setPose(t);
      g.events.emit('HIT', { actorId: b.id, zone: 'head', damage: 1000, point: [0, 0, 0], penetrated: false, shooter: 'player' });
      for (let i = 0; i < 60; i++) vis.setPose((t += 0.05));
      const V = g.camera.position.constructor as new () => V3;
      const head = vis.bones.head.getWorldPosition(new V());
      const weights = vis.char ? Object.fromEntries(vis.char.mixer._actions.filter((a) => a.isScheduled()).map((a) => [a._clip.name, +a.getEffectiveWeight().toFixed(3)])) : {};
      return { kind: vis.kind, alive: b.bot.alive, headAbove: head.y - b.bot.position[1], weights, rotX: vis.group.rotation.x };
    });
    expect(death.alive).toBe(false);
    expect(death.headAbove, JSON.stringify(death)).toBeLessThan(0.9);
    if (death.kind === 'gltf') for (const [clip, w] of Object.entries(death.weights)) if (!/death/i.test(clip)) expect(w, `${clip} còn weight ${w}`).toBeLessThan(0.01);
    else expect(death.rotX).toBeCloseTo(-Math.PI / 2, 2);
    // HỒI 1: giao tranh trong 30 s đầu — tổ phục bờ bên kia bắn, cối rơi
    const act1 = await page.evaluate(() => {
      const H = window.__ht!;
      const g = H.game;
      const a1 = [...g.bots.values()].filter((b) => b.group === 'a1_bo');
      H.stepSim(60 * 18);
      const shots = a1.reduce((a, b) => a + b.bot.stats.shots, 0);
      const friendShots = [...g.bots.values()].filter((b) => b.faction === 'friend').reduce((a, b) => a + b.bot.stats.shots, 0);
      const battle = { ...g.mission.battle!.stats };
      H.kill('a1_bo');
      H.stepSim(60 * 30); // n_a1 22 s → n_a1b (vòng sườn) 25 s → n_a1c (tiếp viện vượt suối)
      const node0 = H.mission.state().currentNode;
      const a1suon = H.bots().filter((b) => b.group === 'a1_suon').length;
      const a1tiep = H.bots().filter((b) => b.group === 'a1_tiep').length;
      H.kill('a1_suon');
      H.kill('a1_tiep');
      H.stepSim(10);
      const node1 = H.mission.state().currentNode;
      const lead = g.squadmates.leader()!;
      const p0 = [...lead.bot.position];
      H.stepSim(60 * 3);
      const moved = Math.hypot(lead.bot.position[0] - p0[0]!, lead.bot.position[2] - p0[2]!);
      return { shots, friendShots, battle, node0, node1, pace: g.squadmates.pace, moved, marker: H.hud().marker, a1suon, a1tiep };
    });
    expect(act1.shots, 'địch bắn trong 30 s đầu').toBeGreaterThan(5);
    expect(act1.friendShots).toBeGreaterThan(5);
    expect(act1.battle.shells, 'đòn đánh + cối').toBeGreaterThanOrEqual(2);
    expect(act1.node0).toBe('n_a1c');
    expect(act1.a1tiep).toBe(3);
    expect(act1.node1).toBe('n_chase');
    expect(act1.pace).toBe('assault');
    expect(act1.moved / 3, 'Quyết xung phong (chạy)').toBeGreaterThan(2.5);
    expect(act1.a1suon).toBe(3);
    // HỒI 2–3: napalm (Khang), toán chặn, sườn đồi, B-52 (trong lòng suối không mất máu), tàn quân
    const act23 = await page.evaluate(() => {
      const H = window.__ht!;
      const g = H.game;
      const tp = (zone: string, dx = 0, dz = 0): void => {
        const z = H.mission.zones()[zone]!;
        const x = z.center[0] + dx;
        const zz = z.center[2] + dz;
        H.teleport(x, (H.terrainHeight(x, zz) ?? 0) + 0.5, zz);
      };
      tp('doc_dong');
      H.stepSim(10);
      const nNapalm = H.mission.state().currentNode;
      const timer = g.hud.state.objectiveTimer ?? null;
      const hp0 = g.player.health;
      // đứng lì giữa dải napalm (dải chạy sát nam đội hình, giữa dải ở (−16, 553))
      H.teleport(-16, (H.terrainHeight(-16, 553) ?? 0) + 0.5, 553);
      H.stepSim(60 * 15);
      const heat = g.mission.battle!.stats.heatHits;
      const napalm = g.mission.battle!.stats.napalm;
      const fires = g.mission.battle!.stats.fires;
      const squad = H.squad().members.filter((m) => m.faction === 'friend' && m.alive).map((m) => m.name);
      const khangDead = H.squad().members.some((m) => m.name === 'name.khang' && !m.alive);
      H.stepSim(60 * 5);
      const nChan = H.mission.state().currentNode;
      const chan = H.bots().filter((b) => (b.group === 'chan' || b.group === 'chan_san') && b.alive).length;
      H.kill('chan');
      H.kill('chan_san');
      H.stepSim(10);
      // DV-089 nhịp Normandy: nín thở 16 s → pháo dồn 7,8 s → xung phong
      const nLull = H.mission.state().currentNode;
      H.stepSim(60 * 16.2);
      const nBarrage = H.mission.state().currentNode;
      H.stepSim(60 * 8);
      const nDoi = H.mission.state().currentNode;
      H.kill('doi_giu');
      H.stepSim(60 * 5);
      const nB52 = H.mission.state().currentNode;
      tp('ham');
      g.player.health = 100;
      const safe0 = g.mission.battle!.stats.safeHits;
      H.stepSim(60 * 30.5); // bom rơi xong ở giây 30 (tàn quân ra ở giây 31)
      const hpB52 = g.player.health;
      H.stepSim(60 * 1.5);
      return { hpB52, nNapalm, timer, hp0, heat, napalm, fires, squad, khangDead, nChan, chan, nLull, nBarrage, nDoi, nB52, bombs: g.mission.bombStats.dropped, safeHits: g.mission.battle!.stats.safeHits - safe0, node: H.mission.state().currentNode, sot: H.bots().filter((b) => b.group === 'sot' && b.alive).length, saves: H.checkpoint.saves() };
    });
    expect(act23.nNapalm).toBe('n_napalm');
    expect(act23.timer).not.toBeNull();
    expect(act23.napalm).toBe(1);
    expect(act23.heat, 'đứng trong dải napalm thì bỏng').toBeGreaterThan(0);
    expect(act23.fires).toBeGreaterThan(5);
    expect(act23.khangDead).toBe(true);
    expect(act23.squad).toEqual(['name.quyet', 'name.long', 'name.dat', 'name.hoan']);
    expect(act23.nChan).toBe('n_chan');
    expect(act23.chan).toBe(9);
    expect(act23.nLull).toBe('n_doi_lull');
    expect(act23.nBarrage).toBe('n_doi_barrage');
    expect(act23.nDoi).toBe('n_doi');
    expect(act23.nB52).toBe('n_b52');
    expect(act23.bombs).toBeGreaterThanOrEqual(35);
    expect(act23.hpB52, 'trong lòng suối thì sống').toBe(100);
    expect(act23.safeHits).toBe(0);
    expect(act23.node).toBe('n_b52_after');
    expect(act23.sot).toBe(6);
    expect(act23.saves).toBeGreaterThanOrEqual(4);
    // HỒI 4: gài bộc phá (giữ F 3 s), giữ chốt 90 s có đếm ngược, hai mũi phản kích
    const act4 = await page.evaluate(() => {
      const H = window.__ht!;
      const g = H.game;
      const tp = (zone: string): void => {
        const z = H.mission.zones()[zone]!;
        H.teleport(z.center[0], (H.terrainHeight(z.center[0], z.center[2]) ?? 0) + 0.5, z.center[2]);
      };
      g.player.health = 1e9;
      H.kill('sot');
      H.stepSim(10);
      const nCb = H.mission.state().currentNode;
      tp('cam_bien');
      H.stepSim(10);
      const prompt = g.hud.state.promptKey;
      g.input = { kind: 'replay', snapshot: (_t, o) => { o.fwd = 0; o.right = 0; o.sprint = false; o.crouch = false; o.jump = false; o.reload = false; o.interact = false; o.interactHeld = true; o.dx = 0; o.dy = 0; o.ads = false; o.fire = false; } };
      H.stepSim(60 * 3.4);
      g.input = { kind: 'replay', snapshot: (_t, o) => { o.fwd = 0; o.right = 0; o.sprint = false; o.crouch = false; o.jump = false; o.reload = false; o.interact = false; o.interactHeld = false; o.dx = 0; o.dy = 0; o.ads = false; o.fire = false; } };
      H.stepSim(10);
      const nHold = H.mission.state().currentNode;
      const timer = g.hud.state.objectiveTimer ?? null;
      const bac = H.bots().filter((b) => b.group === 'cb_bac' && b.alive).length;
      H.stepSim(60 * 31);
      const dong = H.bots().filter((b) => b.group === 'cb_dong' && b.alive).length;
      for (let k = 0; k < 7; k++) {
        H.kill('cb_bac');
        H.kill('cb_dong');
        H.stepSim(60 * 9);
      }
      return { nCb, prompt, nHold, timer, bac, dong, blown: H.mission.state().flags['bo_pha_blown'] === true, node: H.mission.state().currentNode, f2: H.bots().filter((b) => b.group === 'f2' && b.alive).length };
    });
    expect(act4.nCb).toBe('n_cb');
    expect(act4.prompt).toBe('charge');
    expect(act4.nHold).toBe('n_cb_hold');
    expect(act4.timer).toBeGreaterThan(80);
    expect(act4.bac).toBe(5);
    expect(act4.dong).toBe(5);
    expect(act4.blown).toBe(true);
    expect(act4.node).toBe('n_khe_go');
    expect(act4.f2).toBe(6);
    // HỒI 5–7: tổ phục trong khe im khi ta còn xa, khai hoả khi ≤ 25 m; dốc; bãi đáp (Hoàn); pháo bắn chặn; rút → xong
    const act57 = await page.evaluate(() => {
      const H = window.__ht!;
      const g = H.game;
      const tp = (zone: string, dx = 0, dz = 0): void => {
        const z = H.mission.zones()[zone]!;
        const x = z.center[0] + dx;
        const zz = z.center[2] + dz;
        H.teleport(x, (H.terrainHeight(x, zz) ?? 0) + 0.5, zz);
      };
      const f2 = [...g.bots.values()].filter((b) => b.group === 'f2' && b.bot.alive);
      const ambush0 = f2.filter((b) => b.bot.ambush).length;
      tp('khe', 45, 0);
      const shots0 = f2.reduce((a, b) => a + b.bot.stats.shots, 0);
      H.stepSim(60 * 5);
      const shotsFar = f2.reduce((a, b) => a + b.bot.stats.shots, 0) - shots0;
      tp('khe', 4, 0);
      H.stepSim(60 * 4);
      const shotsNear = f2.reduce((a, b) => a + b.bot.stats.shots, 0) - shots0 - shotsFar;
      const nKhe = H.mission.state().currentNode;
      for (const gr of ['f2', 'khe_mg', 'khe_sau']) H.kill(gr);
      H.stepSim(10);
      const nHill = H.mission.state().currentNode;
      tp('doc', 30, 30);
      H.stepSim(10);
      const f3 = H.bots().filter((b) => (b.group === 'f3_hold' || b.group === 'f3_flank') && b.alive).length;
      H.kill('f3_hold');
      H.stepSim(60 * 36); // ổ súng đỉnh dốc đã câm; nút cối/vòng sườn kéo 35 s → giữ đỉnh 60 s
      const nHold = H.mission.state().currentNode;
      for (let k = 0; k < 7; k++) {
        H.kill('f3_rf');
        H.kill('f3_flank');
        H.stepSim(60 * 9);
      }
      const nLzGo = H.mission.state().currentNode;
      for (const gr of ['f3_flank', 'f3_rf']) H.kill(gr);
      const z = H.mission.zones()['lz']!;
      H.teleport(z.center[0] + 30, (H.terrainHeight(z.center[0] + 30, z.center[2]) ?? 0) + 0.5, z.center[2]);
      H.stepSim(10);
      const atLz = H.mission.state().currentNode;
      const lzA = H.bots().filter((b) => b.group === 'lz_a' && b.alive).length;
      H.stepSim(60 * 35);
      const nLz2 = H.mission.state().currentNode;
      const lzB = H.bots().filter((b) => b.group === 'lz_b' && b.alive).length;
      const runs = H.skyStats()!.runsNow.map((r) => r.id);
      for (let k = 0; k < 10; k++) {
        for (const gr of ['lz_a', 'lz_b', 'lz_c', 'f3_rf']) H.kill(gr);
        H.stepSim(60 * 9.2);
      }
      const nLzDone = H.mission.state().currentNode;
      const hoanDead = H.squad().members.some((m) => m.name === 'name.hoan' && !m.alive);
      const alive = H.squad().members.filter((m) => m.faction === 'friend' && m.alive).map((m) => m.name);
      tp('rut');
      H.stepSim(60 * 20);
      const enemies = [...g.bots.values()].filter((b) => b.faction === 'enemy').length;
      return { ambush0, shotsFar, shotsNear, nKhe, nHill, f3, nHold, nLzGo, atLz, lzA, nLz2, lzB, runs, nLzDone, hoanDead, alive, enemies, node: H.mission.state().currentNode, complete: H.mission.state().complete, completeCount: H.events.countOf('MISSION_COMPLETE'), saves: H.checkpoint.saves(), shown: H.mission.subtitlesShown(), arty: g.mission.battle!.stats.shells };
    });
    expect(act57.ambush0).toBe(6);
    expect(act57.shotsFar, 'tổ phục không bắn khi ta còn 45 m').toBe(0);
    expect(act57.shotsNear, 'tổ phục khai hoả khi ta vào ≤ 25 m').toBeGreaterThan(0);
    expect(act57.nKhe).toBe('n_khe');
    expect(act57.nHill).toBe('n_f3_go');
    expect(act57.f3).toBe(8);
    expect(act57.nHold).toBe('n_f3c');
    expect(act57.nLzGo).toBe('n_lz_go');
    expect(act57.atLz).toBe('n_lz');
    expect(act57.lzA).toBe(6);
    expect(act57.nLz2).toBe('n_lz2');
    expect(act57.lzB).toBe(4);
    expect(act57.runs).toContain('huey_insert');
    expect(act57.nLzDone).toBe('n_lz_done');
    expect(act57.hoanDead).toBe(true);
    expect(act57.alive).toEqual(['name.quyet', 'name.long', 'name.dat']);
    expect(act57.enemies, 'tổng địch 70–90').toBeGreaterThanOrEqual(70);
    expect(act57.enemies).toBeLessThanOrEqual(90);
    expect(act57.node).toBe('n_done');
    expect(act57.complete).toBe(true);
    expect(act57.completeCount).toBe(1);
    expect(act57.saves).toBeGreaterThanOrEqual(7);
    expect(act57.shown).toContain('M00');
    expect(act57.shown).toContain('M09');
    await renderFrames(page, 2);
    await expect(page.getByTestId('banner')).toBeVisible();
    await expectNoErrors(errors);
  });
});
