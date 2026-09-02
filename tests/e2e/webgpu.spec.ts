import { test, expect } from '@playwright/test';

/**
 * Chỉ chạy trên Mac có Chrome (HT_WEBGPU=1): npm run e2e:webgpu
 * Kiểm REN-001 nhánh primary: backend webgpu, adapter info, 300 frame không device lost.
 */
test.describe('G0-02 WebGPU primary (thiết bị chuẩn)', () => {
  test.skip(process.env['HT_WEBGPU'] !== '1', 'HT_WEBGPU=1 chỉ trên Mac có Chrome Stable — sandbox không có WebGPU (ADR-004)');

  test('boot mặc định → webgpu, adapter không rỗng, 300 frame không RENDER_DEVICE_LOST', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?autostart=1&debug=1&overlay=1');
    await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 60_000 });
    await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 300, null, { timeout: 120_000 });
    const info = await page.evaluate(() => ({
      backend: window.__ht!.backend,
      adapter: window.__ht!.game.bundle.adapterInfo,
      lost: window.__ht!.events.countOf('RENDER_DEVICE_LOST'),
      summary: window.__ht!.summary(),
    }));
    expect(info.backend).toBe('webgpu');
    expect(info.adapter).not.toBeNull();
    expect(info.lost).toBe(0);
    expect(info.summary.frames).toBeGreaterThan(200);
    await page.screenshot({ path: 'evidence/G0/webgpu-boot.png' });
    expect(errors).toEqual([]);
  });
});
