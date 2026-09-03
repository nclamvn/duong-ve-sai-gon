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

  test('PROD build không ?debug=1 → window.__ht undefined (qa/debug không ship)', async ({ page }) => {
    await page.goto('/?backend=webgl&level=arena&autostart=1&quality=low&rain=500&shadow=512');
    await page.waitForFunction(() => document.getElementById('capability')!.hidden === true, null, { timeout: 60_000 });
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => typeof window.__ht)).toBe('undefined');
    expect(await page.evaluate(() => document.getElementById('overlay')!.hidden)).toBe(true);
  });
});
