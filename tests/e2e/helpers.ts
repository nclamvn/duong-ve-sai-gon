import { type Page, expect } from '@playwright/test';

export const CI_QUERY = 'backend=webgl&autostart=1&debug=1&quality=low&rain=500&shadow=512';

export async function bootGame(page: Page, extra = ''): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text());
  });
  await page.goto(`/?${CI_QUERY}${extra ? `&${extra}` : ''}`);
  await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 60_000 });
  await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 2, null, { timeout: 120_000 });
  return errors;
}

/** Dừng render loop để thao tác sim nhanh (SwiftShader chậm), chụp ảnh sau khi render lại N frame. */
export async function pauseLoop(page: Page): Promise<void> {
  await page.evaluate(() => window.__ht!.game.stop());
}

/**
 * Render N frame đồng bộ trong 1 task JS. Đủ cho kiểm tra logic/số liệu; KHÔNG dùng cho ảnh có SkinnedMesh:
 * three cập nhật skeleton 1 lần mỗi frameId (rAF nội bộ của renderer) → bone matrices cũ. Dùng renderFramesRaf.
 */
export async function renderFrames(page: Page, n: number): Promise<void> {
  await page.evaluate((k) => {
    for (let i = 0; i < k; i++) window.__ht!.game.frame(1 / 60);
  }, n);
}

/** Render N frame, mỗi frame trong 1 tick rAF (skeleton/uniform theo frame cập nhật đúng) — dùng trước screenshot. */
export async function renderFramesRaf(page: Page, n: number): Promise<void> {
  await page.evaluate(async (k) => {
    for (let i = 0; i < k; i++) {
      await new Promise<void>((res) =>
        requestAnimationFrame(() => {
          window.__ht!.game.frame(1 / 60);
          res();
        }),
      );
    }
  }, n);
}

export async function expectNoErrors(errors: string[]): Promise<void> {
  expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
}
