import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import Ajv from 'ajv';
const schema = JSON.parse(readFileSync('content/schemas/performance-replay.schema.json', 'utf8')) as object;

test.describe('G0-04/G0-16 bench harness (PRD §4.1, §8 PerformanceReplay)', () => {
  test('?bench=1&runs=1&seconds=3 → POST /__bench → file hợp lệ schema, evidence_status sandbox', async ({ page }) => {
    const posted = page.waitForRequest((r) => r.url().endsWith('/__bench') && r.method() === 'POST', { timeout: 120_000 });
    await page.goto('/?backend=webgl&autostart=1&debug=1&quality=low&rain=500&shadow=512&bench=1&runs=1&seconds=3&overlay=1');
    await posted;
    await page.waitForFunction(() => window.__ht?.benchSaved !== undefined, null, { timeout: 60_000 });
    const res = await page.evaluate(() => ({ saved: window.__ht!.benchSaved, report: window.__ht!.benchReport }));
    expect(res.saved?.saved).toMatch(/^evidence\/sandbox\/performance-report-.*\.json$/);
    expect(res.report?.evidence_status).toBe('sandbox_swiftshader_lifecycle_only');
    expect(['PASS', 'WARN', 'FAIL']).toContain(res.report?.verdict);
    expect(res.report?.median.frames).toBeGreaterThan(0);
    const file = res.saved!.saved!;
    expect(existsSync(file)).toBe(true);
    const json = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    const ajv = new Ajv({ allErrors: true });
    const ok = ajv.validate(schema, json);
    expect(ok, JSON.stringify(ajv.errors)).toBe(true);
    await expect(page.locator('#overlay')).toContainText('verdict');
    await page.screenshot({ path: 'evidence/TIP-009/bench-overlay.png' });
  });
});
