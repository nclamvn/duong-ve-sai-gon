import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { bootGame, pauseLoop, renderFrames, renderFramesRaf, expectNoErrors } from './helpers';

test.describe('G0-02/G0-03 boot (WebGL2 fallback, cùng content path)', () => {
  test('boot ?backend=webgl&level=arena → backend webgl2, capability đã ghi, 120 frame không lỗi, arena đúng số liệu', async ({ page }) => {
    const errors = await bootGame(page);
    const info = await page.evaluate(() => {
      const H = window.__ht!;
      const g = H.game;
      return {
        backend: H.backend,
        frames: H.metrics().frames,
        props: g.arena.stats.props,
        colliders: g.arena.colliders.length,
        dummies: g.dummies.length,
        bones: g.dummies.map((d) => d.mesh.skeleton.bones.length),
        kinds: g.dummies.map((d) => d.kind),
        viewModel: !!g.viewModel && g.viewModel.space.parent === g.vmCamera && g.vmCamera.parent === g.vmScene, // TIP-017b: lớp viewmodel riêng (vmScene/vmCamera)
        skinned: g.dummies.every((d) => d.mesh.isSkinnedMesh),
        navPolys: g.nav.polyCount,
        navMs: g.navBuildMs,
        bots: H.bots().length,
        hudHidden: document.getElementById('hud')!.hidden,
        capHidden: document.getElementById('capability')!.hidden,
      };
    });
    expect(info.backend).toBe('webgl2');
    expect(info.props).toBeGreaterThanOrEqual(200);
    expect(info.colliders).toBeGreaterThan(200);
    expect(info.dummies).toBe(8);
    // TIP-010 soldier procedural 12 bone; TIP-012 glTF Mixamo ≥ 40 bone khi có assets/characters/soldier.glb
    expect(info.bones.length).toBe(8);
    for (let i = 0; i < 8; i++) expect(info.kinds[i] === 'gltf' ? info.bones[i]! >= 40 : info.bones[i] === 12).toBe(true);
    expect(info.skinned).toBe(true);
    expect(info.viewModel).toBe(true);
    expect(info.navPolys).toBeGreaterThan(0);
    expect(info.bots).toBe(1);
    expect(info.hudHidden).toBe(false);
    expect(info.capHidden).toBe(true);

    // 120 frame: sim qua stepSim (nhanh) + render 3 frame; bone xoay theo simTime
    await pauseLoop(page);
    const rot0 = await page.evaluate(() => window.__ht!.game.dummies[0]!.bones.spine.rotation.x);
    await page.evaluate(() => window.__ht!.stepSim(120));
    await renderFrames(page, 3);
    const after = await page.evaluate(() => ({ tick: window.__ht!.metrics().tick, rot: window.__ht!.game.dummies[0]!.bones.spine.rotation.x, calls: window.__ht!.metrics().calls, tris: window.__ht!.metrics().triangles }));
    expect(after.tick).toBeGreaterThanOrEqual(120);
    expect(after.rot).not.toBe(rot0);
    expect(after.calls).toBeGreaterThan(0);
    expect(after.calls).toBeLessThan(650);
    await renderFramesRaf(page, 2); // skeleton cập nhật theo rAF trước khi chụp
    await page.screenshot({ path: 'evidence/TIP-009/boot-webgl.png' });
    await expectNoErrors(errors);
  });

  test('capability screen hiển thị backend khi không autostart; nút vào arena hoạt động', async ({ page }) => {
    await page.goto('/?backend=webgl&level=arena&debug=1&quality=low&rain=500&shadow=512');
    await expect(page.getByTestId('capability')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-cap="Backend render"]')).toContainText('webgl2');
    await page.getByTestId('enter').click();
    await expect(page.getByTestId('capability')).toBeHidden();
    await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 1, null, { timeout: 120_000 });
  });

  test('chết nằm hẳn (glTF, DV-045): one-shot hit xong phải mờ đi; chết giữa lúc hit → sau 3 s chỉ clip death còn weight, đầu sát đất', async ({ page }) => {
    const errors = await bootGame(page);
    await pauseLoop(page);
    const r = await page.evaluate(() => {
      const g = window.__ht!.game;
      const d = g.dummies[0]!;
      type Act = { _clip: { name: string }; getEffectiveWeight(): number; isScheduled(): boolean };
      type V3 = { x: number; y: number; z: number };
      const vis = d as unknown as {
        kind: string;
        char?: { mixer: { _actions: Act[] } };
        bones: { head: { getWorldPosition(v: V3): V3 } };
        group: { rotation: { x: number }; getWorldPosition(v: V3): V3 };
        setPose(t: number): void;
        applyDamage(n: number): boolean;
      };
      const V = g.camera.position.constructor as new () => V3;
      const weightsOf = (): Record<string, number> => (vis.char ? Object.fromEntries(vis.char.mixer._actions.filter((a) => a.isScheduled()).map((a) => [a._clip.name, +a.getEffectiveWeight().toFixed(3)])) : {});
      let t = 100;
      vis.setPose(t);
      const feetY = vis.group.getWorldPosition(new V()).y;
      const headUp = vis.bones.head.getWorldPosition(new V()).y - feetY;
      vis.applyDamage(8); // one-shot hit
      for (let i = 0; i < 60; i++) vis.setPose((t += 0.05)); // 3 s: clip hit (2,29 s) đã xong + clamp → phải đã fade về 0
      const afterHit = weightsOf();
      vis.applyDamage(8);
      vis.setPose((t += 0.05));
      vis.applyDamage(1000); // chết ngay khi hit đang chạy (kịch bản Chủ nhà thấy trên Mac)
      for (let i = 0; i < 60; i++) vis.setPose((t += 0.05));
      const head = vis.bones.head.getWorldPosition(new V());
      return { kind: vis.kind, headUp, afterHit, weights: weightsOf(), headAbove: head.y - feetY, rotX: vis.group.rotation.x };
    });
    expect(r.headUp).toBeGreaterThan(1.3); // đứng: đầu ≥ 1,3 m
    expect(r.headAbove, JSON.stringify(r)).toBeLessThan(0.9); // nằm: đầu < 0,9 m
    if (r.kind === 'gltf') {
      expect(Object.keys(r.weights).some((c) => /death/i.test(c))).toBe(true);
      for (const [clip, w] of Object.entries(r.afterHit)) if (/hit/i.test(clip)) expect(w, `hit còn weight ${w} sau khi xong`).toBeLessThan(0.01);
      // DV-066: nhiều biến thể chết; đúng MỘT clip death mang weight 1, mọi clip khác 0
      const deathW = Object.entries(r.weights).filter(([c]) => /death/i.test(c)).map(([, w]) => w);
      expect(deathW.filter((w) => w > 0.99).length, JSON.stringify(r.weights)).toBe(1);
      for (const [clip, w] of Object.entries(r.weights)) if (w <= 0.99) expect(w, `${clip} còn weight ${w} khi đã chết`).toBeLessThan(0.01);
    } else expect(r.rotX).toBeCloseTo(-Math.PI / 2, 2);
    await expectNoErrors(errors);
  });

  test('hệ chuyển động DV-066 trên clip Mixamo thật: đo tốc độ sải chân, lớp trên/dưới cộng đủ 1, nhắm xoay ngực về mục tiêu', async ({ page }) => {
    const errors = await bootGame(page);
    await pauseLoop(page);
    const r = await page.evaluate(() => {
      const g = window.__ht!.game;
      type Clip = { name: string };
      type Act = { getClip(): Clip; getEffectiveWeight(): number };
      type Q = { x: number; y: number; z: number; w: number };
      type V3 = { x: number; y: number; z: number; applyQuaternion(q: Q): V3 };
      const vis = g.dummies[0] as unknown as {
        kind: string;
        motion: { speed: number; aiming: boolean; yaw?: number; vx?: number; vz?: number; pitch?: number };
        group: { rotation: { y: number } };
        setPose(t: number): void;
        onFire(): void;
        char?: {
          mixer: { _actions: Act[] };
          rawPose(): void;
          model: { getObjectByName(n: string): { getWorldQuaternion(q: Q): Q } | undefined };
          asset: { motion: { loco: Array<{ name: string; measured: boolean; info: { speed: number; angle: number; duration: number; phaseOffset: number } }>; turns: unknown[]; deaths: Array<{ name: string }> } };
        };
      };
      if (!vis.char) return { kind: vis.kind };
      const sums = (): { lower: number; upper: number; full: number } => {
        const s = { lower: 0, upper: 0, full: 0 };
        for (const a of vis.char!.mixer._actions) {
          const n = a.getClip().name;
          const w = a.getEffectiveWeight();
          if (n.endsWith('#lower')) s.lower += w;
          else if (n.endsWith('#upper')) s.upper += w;
          else s.full += w;
        }
        return s;
      };
      let t = 200;
      let worst = 0;
      const step = (n: number): void => {
        for (let i = 0; i < n; i++) {
          vis.setPose((t += 1 / 30));
          const s = sums();
          worst = Math.max(worst, Math.abs(s.lower + s.full - 1), Math.abs(s.upper + s.full - 1));
        }
      };
      const m = vis.motion;
      // đi bộ thẳng 1,5 m/s → chạy 3,8 m/s → đứng ngắm lệch 30° (+ ngẩng 10°) → bắn
      Object.assign(m, { yaw: 0, vx: 0, vz: -1.5, speed: 1.5, aiming: false, pitch: 0 });
      step(45);
      Object.assign(m, { vz: -3.8, speed: 3.8 });
      step(45);
      Object.assign(m, { vx: 0, vz: 0, speed: 0, aiming: true, yaw: (30 * Math.PI) / 180, pitch: (10 * Math.PI) / 180 });
      step(60);
      vis.onFire();
      step(2);
      const fire = vis.char.mixer._actions.filter((a) => /fire/.test(a.getClip().name)).reduce((s, a) => s + a.getEffectiveWeight(), 0);
      const Q = (g.camera.quaternion.constructor as new () => Q);
      const V = g.camera.position.constructor as new (x: number, y: number, z: number) => V3;
      const chest = vis.char.model.getObjectByName('mixamorigSpine2')!;
      const yawOf = (): number => {
        const f = new V(0, 0, 1).applyQuaternion(chest.getWorldQuaternion(new Q()));
        return Math.atan2(-f.x, -f.z);
      };
      const aimed = yawOf();
      vis.char.rawPose(); // same clip blend without the aim offset
      let dYaw = aimed - yawOf();
      dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw));
      return {
        kind: vis.kind,
        loco: vis.char.asset.motion.loco.map((l) => ({ name: l.name, measured: l.measured, speed: +l.info.speed.toFixed(2), angleDeg: +((l.info.angle * 180) / Math.PI).toFixed(1), phase: +l.info.phaseOffset.toFixed(2) })),
        deaths: vis.char.asset.motion.deaths.map((d) => d.name),
        worst,
        fire,
        bodyYawDeg: +((vis.group.rotation.y * 180) / Math.PI).toFixed(1),
        chestYawDeg: +((dYaw * 180) / Math.PI).toFixed(1),
      };
    });
    if (r.kind === 'gltf') {
      mkdirSync('evidence/DV-066', { recursive: true });
      writeFileSync('evidence/DV-066/motion-probe.json', JSON.stringify(r, null, 2));
      const loco = r.loco!;
      // clip đi/chạy thẳng: bộ 8 hướng (walk_f/run_f) hoặc bộ cũ (rifle_walk/rifle_run)
      const walk = loco.find((l) => l.name === 'walk_f' || l.name === 'rifle_walk')!;
      const run = loco.find((l) => l.name === 'run_f' || l.name === 'rifle_run')!;
      // bộ 8 hướng: hướng đo được khớp tên file (±20°)
      const DIR: Record<string, number> = { f: 0, fl: 45, l: 90, bl: 135, b: 180, br: -135, r: -90, fr: -45 };
      for (const l of loco) {
        const m = /_(f|fl|l|bl|b|br|r|fr)$/.exec(l.name);
        if (!m) continue;
        const d = Math.abs(((((l.angleDeg - DIR[m[1]!]!) % 360) + 540) % 360) - 180);
        expect(d, `${l.name} đo ${l.angleDeg}°`).toBeLessThan(20);
      }
      // clip Mixamo in-place: tốc độ đo từ chân trượt lúc chạm đất (tay người đi bộ 1–2 m/s, chạy 2,5–6 m/s), hướng ≈ thẳng
      expect(walk.measured, JSON.stringify(r)).toBe(true);
      expect(run.measured, JSON.stringify(r)).toBe(true);
      expect(walk.speed).toBeGreaterThan(0.8);
      expect(walk.speed).toBeLessThan(2.3);
      expect(run.speed).toBeGreaterThan(2.5);
      expect(run.speed).toBeLessThan(6.5);
      expect(run.speed).toBeGreaterThan(walk.speed + 1);
      expect(Math.abs(walk.angleDeg)).toBeLessThan(20);
      expect(Math.abs(run.angleDeg)).toBeLessThan(20);
      expect(r.worst, 'tổng trọng số mỗi lớp phải = 1 (không lộ T-pose)').toBeLessThan(1e-3);
      expect(r.fire).toBeGreaterThan(0.3);
      // lệch 30° < ngưỡng xoay chân 40°: chân giữ nguyên, ngực xoay theo hướng ngắm
      expect(Math.abs(r.bodyYawDeg!)).toBeLessThan(1);
      expect(Math.abs(r.chestYawDeg! - 30), JSON.stringify(r)).toBeLessThan(12);
    }
    await expectNoErrors(errors);
  });

  test('gói phe hư cấu mặc định (DV-061): phe A AK-47 + mũ sắt ô liu (DV-068), phe B M16A1 + mũ sắt rằn ri cát-nâu (khi có asset glTF)', async ({ page }) => {
    const errors = await bootGame(page);
    await pauseLoop(page);
    const r = await page.evaluate(() => {
      const g = window.__ht!.game;
      type Vis = { kind: string; attached?: { weapon?: { cfg: { id: string } } } | null; gear?: { helmet?: { name: string } | null } | null };
      const friend = g.dummies[0] as unknown as Vis;
      const enemy = g.spawnBot('probe_enemy', 'probe', [g.player.controller.feet[0]! + 3, g.player.controller.feet[1]!, g.player.controller.feet[2]!], { faction: 'enemy', archetype: 'recon' }).dummy as unknown as Vis;
      return {
        kind: friend.kind,
        friendWeapon: friend.attached?.weapon?.cfg.id ?? null,
        friendHelmet: friend.gear?.helmet?.name ?? null,
        enemyWeapon: enemy.attached?.weapon?.cfg.id ?? null,
        enemyHelmet: enemy.gear?.helmet?.name ?? null,
        idFriend: g.weaponIdFor('friend'),
        idEnemy: g.weaponIdFor('enemy'),
      };
    });
    expect(r.idFriend).toBe('ak47');
    if (r.kind === 'gltf') {
      expect(r.friendWeapon).toBe('ak47');
      expect(r.friendHelmet).toBe('gear_helmet_a'); // DV-068: mũ sắt dựng sẵn thay mũ tai bèo
      expect(r.idEnemy).toBe('m16a1');
      expect(r.enemyWeapon).toBe('m16a1');
      expect(r.enemyHelmet).toBe('gear_m1_helmet');
    }
    await expectNoErrors(errors);
  });

  test('gói phe lịch sử ?factions=historical-1971 (DV-046 giữ nguyên): phe ta AK-47 + mũ cối, địch M16A1 + mũ sắt M1/M1956 (khi có asset glTF)', async ({ page }) => {
    const errors = await bootGame(page, 'factions=historical-1971');
    await pauseLoop(page);
    const r = await page.evaluate(() => {
      const g = window.__ht!.game;
      type Vis = { kind: string; attached?: { weapon?: { cfg: { id: string } } } | null; gear?: { helmet?: { name: string } | null } | null };
      const friend = g.dummies[0] as unknown as Vis;
      const enemy = g.spawnBot('probe_enemy', 'probe', [g.player.controller.feet[0]! + 3, g.player.controller.feet[1]!, g.player.controller.feet[2]!], { faction: 'enemy', archetype: 'recon' }).dummy as unknown as Vis;
      return {
        kind: friend.kind,
        friendWeapon: friend.attached?.weapon?.cfg.id ?? null,
        friendHelmet: friend.gear?.helmet?.name ?? null,
        enemyWeapon: enemy.attached?.weapon?.cfg.id ?? null,
        enemyHelmet: enemy.gear?.helmet?.name ?? null,
        idFriend: g.weaponIdFor('friend'),
        idEnemy: g.weaponIdFor('enemy'),
      };
    });
    expect(r.idFriend).toBe('ak47');
    if (r.kind === 'gltf') {
      expect(r.friendWeapon).toBe('ak47');
      expect(r.friendHelmet).toBe('gear_pith_helmet');
      expect(r.idEnemy).toBe('m16a1');
      expect(r.enemyWeapon).toBe('m16a1');
      expect(r.enemyHelmet).toBe('gear_m1_helmet');
    }
    await expectNoErrors(errors);
  });

  test('viewmodel FP (DV-055): dùng nguyên trạng rig nghệ sĩ AK-47+cánh tay (AB3DX, Fab) khi có asset — không IK/fit/procedural cho người chơi', async ({ page }) => {
    // DV-062: asset Fab Standard chỉ đi qua mạng dạng gói .dvpak mã hoá, không bao giờ là glb trần
    const urls: string[] = [];
    page.on('request', (q) => urls.push(q.url()));
    const errors = await bootGame(page);
    await pauseLoop(page);
    const r = await page.evaluate(() => {
      const g = window.__ht!.game as unknown as {
        fpHands: unknown | null;
        quality: { arms?: boolean };
        viewModel: { hasFpvm: () => boolean; armMeshCount: number; artist: { dyedMaterials: number } | null };
      };
      return { fpHandsNull: g.fpHands === null, hasFpvm: g.viewModel.hasFpvm(), arms: !!g.quality.arms, armMeshCount: g.viewModel.armMeshCount, dyed: g.viewModel.artist?.dyedMaterials ?? 0 };
    });
    // asset ak47_vm.glb được commit (bản tối ưu trong public/assets) → viewmodel rig sẵn phải bật
    expect(r.hasFpvm, 'viewmodel rig AK+tay (ak47_vm.glb) đã nạp').toBe(true);
    expect(urls.filter((u) => /ak47_vm\.glb/.test(u)), 'không tải glb trần của asset bảo vệ').toEqual([]);
    expect(urls.some((u) => /\/assets\/pak\/[0-9a-f]{16}\.dvpak/.test(u)), 'tải gói .dvpak').toBe(true);
    // không dùng FpHands (David Fischer) cho người chơi
    expect(r.fpHandsNull).toBe(true);
    // DV-065: tay áo nhuộm xanh lá quân đội theo gói phe hư cấu (2 material tay AB3DX)
    expect(r.dyed).toBe(2);
    await expectNoErrors(errors);
  });

  test('PROD build không ?debug=1 → window.__ht undefined (qa/debug không ship)', async ({ page }) => {
    await page.goto('/?backend=webgl&level=arena&autostart=1&quality=low&rain=500&shadow=512');
    await page.waitForFunction(() => document.getElementById('capability')!.hidden === true, null, { timeout: 60_000 });
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => typeof window.__ht)).toBe('undefined');
    expect(await page.evaluate(() => document.getElementById('overlay')!.hidden)).toBe(true);
  });
});
