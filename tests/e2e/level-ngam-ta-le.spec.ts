import { test, expect } from '@playwright/test';
import { pauseLoop, renderFrames } from './helpers';

/**
 * DV-078 hồi đêm "Ngầm Ta Lê" (M1, đêm): level terrain mới trên ô truong-son-a → E2E vật lý người chơi (D-075: đứng, đi, lội
 * nước ở ngầm) + nav bake riêng + rừng chừa đường; rồi chơi cả đêm trên sim: gặp Thu → ngồi 12,7 (F) → đoàn xe chạy → AC-130 tới,
 * bắn đón trúng → bỏ vòng; xe kẹt giữa ngầm → rời súng, giữ F đẩy (phụ xạ ngồi súng thay); lái xe bị thương → giữ F cứu; đoàn
 * xe xong → Quyết nói kết quả, Thu chào → hoàn thành, bảng điểm "qua ngầm n/8".
 */
const QUERY = 'backend=webgl&level=ngam-ta-le&autostart=1&debug=1&quality=low&post=off&shadow=512&assets=0&character=0&weapons=0&arms=0&sky=0';

test.describe('Ngầm Ta Lê — hồi đêm M1', () => {
  test('vật lý: đứng, đi theo đường xe xuống ngầm, lội nước; nav riêng; rừng chừa đường và ụ súng', async ({ page }) => {
    test.setTimeout(300_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text());
    });
    await page.goto(`/?${QUERY}&veg=1`);
    await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 180_000 });
    await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 2, null, { timeout: 120_000 });
    await pauseLoop(page);
    const r = await page.evaluate(() => {
      const H = window.__ht!;
      const g = H.game;
      g.aiPaused = true;
      const c = g.player.controller;
      const hAt = (x: number, z: number): number => H.terrainHeight(x, z) ?? NaN;
      const set = (fwd: number): void => {
        g.input = { kind: 'replay', snapshot: (_t, o) => { o.fwd = fwd; o.right = 0; o.sprint = false; o.crouch = false; o.jump = false; o.reload = false; o.interact = false; o.interactHeld = false; o.dx = 0; o.dy = 0; o.ads = false; o.fire = false; } };
      };
      set(0);
      H.stepSim(120);
      const gap = (): number => c.feet[1]! - hAt(c.feet[0]!, c.feet[2]!);
      const stand = { gap: gap(), grounded: c.grounded };
      // đi theo đường xe từ bờ gần xuống ngầm và sang bờ xa (hướng chạy của xe)
      const ford = H.mission.zones()['ford']!;
      const sx = ford.center[0] - 0.7071 * 22;
      const sz = ford.center[2] - 0.7071 * 22;
      c.teleport(sx, hAt(sx, sz) + 0.1, sz);
      g.player.rig.reset(Math.atan2(-0.7071, -0.7071), 0);
      set(0);
      H.stepSim(30);
      set(1);
      let wet = 0;
      let minGap = Infinity;
      let maxGap = -Infinity;
      for (let i = 0; i < 16; i++) {
        H.stepSim(30);
        const F = g.terrain!.tile.features!;
        if (F.distance('water', c.feet[0]!, c.feet[2]!) < 0.3) wet++;
        minGap = Math.min(minGap, gap());
        maxGap = Math.max(maxGap, gap());
      }
      const crossed = (c.feet[0]! - ford.center[0]) * 0.7071 + (c.feet[2]! - ford.center[2]) * 0.7071;
      // rừng: không thân cây nào trong dải đường / quanh ụ súng
      const lv = g.terrainLevelDef!;
      const road = lv.roads![0]!;
      const dSeg = (x: number, z: number): number => {
        let best = Infinity;
        for (let k = 0; k + 1 < road.pts.length; k++) {
          const a = road.pts[k]!;
          const b = road.pts[k + 1]!;
          const dx = b[0] - a[0];
          const dz = b[1] - a[1];
          const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
          best = Math.min(best, Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z));
        }
        return best;
      };
      const gunZ = H.mission.zones()['gun']!;
      let onRoad = 0;
      let onGun = 0;
      let trees = 0;
      for (const col of g.forest?.system.colliders ?? []) {
        trees++;
        if (dSeg(col.position[0], col.position[2]) < road.halfWidth + 1.7) onRoad++;
        if (Math.hypot(col.position[0] - gunZ.center[0], col.position[2] - gunZ.center[2]) < 10.5) onGun++;
      }
      // xe có hộp va chạm: đứng cạnh xe đang chờ (4 m bên trái), đi ngang vào thân xe 2 s → không xuyên qua
      const N = g.nightAct!;
      const tr = N.logic.convoy.trucks[3]!;
      const p = N.logic.convoy.pose(tr);
      const lx = -p.dz;
      const lz = p.dx;
      c.teleport(p.x + lx * 4, hAt(p.x + lx * 4, p.z + lz * 4) + 0.1, p.z + lz * 4);
      g.player.rig.reset(Math.atan2(lx, lz), 0); // nhìn về phía xe (−trái)
      set(0);
      H.stepSim(10);
      set(1);
      H.stepSim(120);
      const side = (c.feet[0]! - p.x) * lx + (c.feet[2]! - p.z) * lz;
      set(0);
      const ts = H.terrainStats();
      return { truckSide: side, level: g.levelId, stand, wet, minGap, maxGap, crossed, trees, onRoad, onGun, navPolys: g.nav.polyCount, navPrebuilt: ts?.navPrebuilt ?? false, props: g.terrain!.props.count, night: !!g.nightAct };
    });
    console.log('[ngam physics]', JSON.stringify(r));
    expect(r.level).toBe('ngam-ta-le');
    expect(r.night).toBe(true);
    expect(r.stand.grounded).toBe(true);
    expect(Math.abs(r.stand.gap)).toBeLessThan(0.3);
    expect(r.wet).toBeGreaterThanOrEqual(1);
    expect(r.crossed).toBeGreaterThan(10);
    expect(r.minGap).toBeGreaterThan(-0.4);
    expect(r.maxGap).toBeLessThan(0.6);
    expect(r.navPrebuilt).toBe(true);
    expect(r.navPolys).toBeGreaterThan(1000);
    expect(r.props).toBe(17);
    expect(r.trees).toBeGreaterThan(50);
    expect(r.onRoad).toBe(0);
    expect(r.onGun).toBe(0);
    expect(r.truckSide).toBeGreaterThan(1.1);
    expect(errors).toEqual([]);
  });

  test('cả đêm: gặp Thu → ngồi 12,7 → AC-130 bị bắn đón phải bỏ vòng → đẩy xe kẹt (phụ xạ ngồi thay) → cứu lái xe → điểm n/8', async ({ page }) => {
    test.setTimeout(600_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text());
    });
    await page.goto(`/?${QUERY}&veg=0`);
    await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 180_000 });
    await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 2, null, { timeout: 120_000 });
    await pauseLoop(page);
    const r = await page.evaluate(() => {
      const H = window.__ht!;
      const g = H.game;
      const N = g.nightAct!;
      const L = N.logic;
      const c = g.player.controller;
      const hAt = (x: number, z: number): number => H.terrainHeight(x, z) ?? NaN;
      const inp = { fire: false, interact: false, held: false };
      g.input = { kind: 'replay', snapshot: (_t, o) => { o.fwd = 0; o.right = 0; o.sprint = false; o.crouch = false; o.jump = false; o.reload = false; o.dx = 0; o.dy = 0; o.ads = false; o.fire = inp.fire; o.interact = inp.interact; o.interactHeld = inp.held; inp.interact = false; } };
      const out: Record<string, unknown> = {};
      const tp = (x: number, z: number): void => c.teleport(x, hAt(x, z) + 0.05, z);
      // 1) gặp Thu
      const thu = H.mission.zones()['thu']!;
      tp(thu.center[0] + 1, thu.center[2]);
      H.stepSim(60);
      out.objAfterThu = g.hud.state.objectiveKey;
      // 2) lên ụ súng, F
      const gunZ = H.mission.zones()['gun']!;
      tp(gunZ.center[0] + 0.8, gunZ.center[2] + 0.8);
      H.stepSim(10);
      out.promptAtGun = g.hud.state.promptKey;
      inp.interact = true;
      H.stepSim(5);
      out.mounted = N.mounted;
      out.aaSight = g.hud.state.aaSight;
      out.weaponKey = g.hud.state.weaponKey;
      out.flagGun = g.mission.runtime.state.flags['gun_manned'] === true;
      // 3) đoàn xe chạy, máy bay tới: ngắm đón bằng hướng nhìn người chơi (như chuột), bắn
      const lead = (): void => {
        const gs = L.gunship;
        const m = L.gun.toWorld(L.cfg.dshk.muzzle);
        let px = gs.pos[0];
        let py = gs.pos[1];
        let pz = gs.pos[2];
        for (let i = 0; i < 4; i++) {
          const tof = Math.hypot(px - m[0], py - m[1], pz - m[2]) / L.cfg.dshk.muzzleVelocity;
          px = gs.pos[0] + gs.vel[0] * tof;
          py = gs.pos[1] + 0.5 * 9.81 * tof * tof;
          pz = gs.pos[2] + gs.vel[2] * tof;
        }
        g.player.rig.yaw = Math.atan2(-(px - m[0]), -(pz - m[2]));
        g.player.rig.pitch = Math.atan2(py - m[1], Math.hypot(px - m[0], pz - m[2]));
      };
      let t = 0;
      while (L.gunship.phase !== 'attack' && t < 60 * 70) {
        H.stepSim(30);
        t += 30;
      }
      out.convoyGo = L.convoy.go;
      out.phaseAtAttack = L.gunship.phase;
      const fired0 = L.gun.stats.fired;
      for (let i = 0; i < 60 * 25 && L.gunship.stats.breaks === 0; i++) {
        lead();
        inp.fire = true;
        H.stepSim(1);
      }
      inp.fire = false;
      out.playerFired = L.gun.stats.fired - fired0;
      out.hits = L.gun.stats.hits;
      out.breaks = L.gunship.stats.breaks;
      out.hudHits = g.hud.stats.hits;
      g.frame(1 / 60);
      out.hudAmmo = (document.querySelector('[data-testid="ammo"] .wname') as HTMLElement | null)?.textContent ?? null;
      out.aaSightDom = !(document.querySelector('[data-testid="aa-sight"]') as HTMLElement).hidden;
      // 4) chơi tiếp: xe chắn ngầm → rời súng đẩy; lái xe bị thương → cứu; còn lại ngồi súng bắn đón
      const subs0 = H.mission.subtitlesShown().length;
      let pushedWhileCrew = 0;
      let crewFired = 0;
      let rescues = 0;
      let forced = 0;
      let crewSeen = false;
      let injuredSeen = 0;
      for (let step = 0; step < 60 * 60 * 9 && !g.hud.state.missionComplete; step += 1) {
        const block = L.convoy.fordBlocker();
        const inj = L.convoy.trucks.find((x) => x.driver === 'injured');
        if (inj) injuredSeen = Math.max(injuredSeen, 1);
        if (block || inj) {
          if (N.mounted) {
            inp.interact = true;
            H.stepSim(1);
          }
          if (block) {
            const pp = L.convoy.pushPoint(block);
            tp(pp[0], pp[1]);
          } else tp(inj!.driverAt![0] + 0.4, inj!.driverAt![1]);
          inp.held = true;
          const f0 = L.gun.stats.fired;
          H.stepSim(30);
          crewFired += L.gun.stats.fired - f0;
          if (L.crewOnGun) crewSeen = true;
          if (block) pushedWhileCrew++;
          continue;
        }
        inp.held = false;
        // chắc chắn có một xe cháy để thử cứu lái xe (đốt một xe đang ở đoạn trống)
        if (injuredSeen === 0 && forced < 3 && L.convoy.crossed >= 2 + forced) {
          // không đốt xe sẽ kẹt (giữ sự kiện kẹt ngầm), đốt xe sau nó đang ở đoạn trống trước vạch dừng
          const tr = L.convoy.exposed().find((x) => x.id > L.cfg.convoy.stuckIndex && x.s < L.cfg.convoy.fordS - 12);
          if (tr) {
            forced++;
            for (let k = 0; k < 20 && tr.driver !== 'injured' && tr.state !== 'burning'; k++) {
              const p = L.convoy.pose(tr);
              L.convoy.damageAt(p.x, p.z, 2, 60);
            }
          }
        }
        if (!N.mounted && !g.hud.state.missionComplete) {
          tp(gunZ.center[0] + 0.8, gunZ.center[2] + 0.8);
          H.stepSim(2);
          inp.interact = true;
          H.stepSim(2);
        }
        lead();
        inp.fire = L.gunship.phase === 'attack' || L.gunship.phase === 'returning';
        H.stepSim(10);
        rescues = L.convoy.stats.rescued;
      }
      inp.fire = false;
      g.frame(1 / 60);
      const shown = H.mission.subtitlesShown();
      out.lines = shown.slice(subs0);
      out.allLines = shown;
      out.crossed = L.convoy.crossed;
      out.destroyed = L.convoy.stats.destroyed;
      out.rescued = rescues;
      out.injuredSeen = injuredSeen;
      out.stuck = L.convoy.stats.stuck;
      out.pushedFree = L.convoy.stats.pushedFree;
      out.pushedWhileCrew = pushedWhileCrew;
      out.crewFired = crewFired;
      out.crewSeen = crewSeen;
      out.forced = forced;
      out.complete = g.hud.state.missionComplete;
      out.banner = (document.querySelector('[data-testid="banner"] .sub') as HTMLElement | null)?.textContent ?? null;
      out.convoyHud = (document.querySelector('[data-testid="convoy"]') as HTMLElement | null)?.textContent ?? null;
      out.flags = { ...g.mission.runtime.state.flags };
      out.stats = { ...N.stats };
      out.gunship = { ...L.gunship.stats, phase: L.gunship.phase };
      out.playerAlive = g.player.alive;
      return out;
    });
    console.log('[ngam night]', JSON.stringify({ ...r, allLines: undefined }));
    expect(r.objAfterThu).toBe('obj_n_gun');
    expect(r.promptAtGun).toBe('mount');
    expect(r.mounted).toBe(true);
    expect(r.aaSight).toBe(true);
    expect(r.weaponKey).toBe('weapon.dshk');
    expect(r.flagGun).toBe(true);
    expect(r.hudAmmo).toBe('12,7 ly DShK');
    expect(r.aaSightDom).toBe(true);
    expect(r.convoyGo).toBe(true);
    expect(r.phaseAtAttack).toBe('attack');
    expect(r.playerFired as number).toBeGreaterThan(20);
    expect(r.hits as number).toBeGreaterThan(5);
    expect(r.breaks as number).toBeGreaterThanOrEqual(1);
    expect(r.hudHits as number).toBeGreaterThan(0);
    expect(r.stuck).toBe(1);
    expect(r.pushedFree).toBe(1);
    expect(r.crewSeen).toBe(true);
    expect(r.injuredSeen).toBe(1);
    expect(r.rescued as number).toBeGreaterThanOrEqual(1);
    expect(r.allLines as string[]).toContain('N17');
    expect(r.complete).toBe(true);
    expect(r.crossed as number).toBeGreaterThanOrEqual(1);
    expect(r.banner).toMatch(/qua ngầm \d\/8 xe · cứu \d lái xe/);
    const all = r.allLines as string[];
    for (const cue of ['N01', 'N03', 'N05', 'N06', 'N07', 'N08', 'N15', 'N16', 'N33']) expect(all, cue).toContain(cue);
    expect(all.some((x) => x === 'N30' || x === 'N31' || x === 'N32')).toBe(true);
    if ((r.destroyed as number) > 0) expect(all).toContain('N13');
    await renderFrames(page, 2);
    expect(errors).toEqual([]);
  });
});
