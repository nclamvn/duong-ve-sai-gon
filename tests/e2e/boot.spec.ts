import { test, expect } from '@playwright/test';
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
      for (const [clip, w] of Object.entries(r.weights)) {
        if (/death/i.test(clip)) expect(w, `death weight ${w}`).toBeGreaterThan(0.99);
        else expect(w, `${clip} còn weight ${w} khi đã chết`).toBeLessThan(0.01);
      }
    } else expect(r.rotX).toBeCloseTo(-Math.PI / 2, 2);
    await expectNoErrors(errors);
  });

  test('súng + trang phục theo phe (DV-046): phe ta AK-47 + mũ cối, địch M16A1 + mũ sắt M1/M1956 (khi có asset glTF)', async ({ page }) => {
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
      expect(r.friendHelmet).toBe('gear_pith_helmet');
      expect(r.idEnemy).toBe('m16a1');
      expect(r.enemyWeapon).toBe('m16a1');
      expect(r.enemyHelmet).toBe('gear_m1_helmet');
    }
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
