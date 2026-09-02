import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

// Sandbox/CI: Chromium pinned by HT_CHROME (Playwright 1.62 expects build 1234; sandbox ships 1194).
// Mac: leave HT_CHROME unset → Playwright's own Chromium (webgl-ci) or system Chrome (webgpu project).
const chromePath = process.env.HT_CHROME && existsSync(process.env.HT_CHROME) ? process.env.HT_CHROME : undefined;
const webgpu = process.env.HT_WEBGPU === '1';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    // build trước rồi preview: chạy `npm run e2e` / `e2e:webgpu` thẳng từ repo sạch, không cần nhớ `npm run build`
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: 'pipe', // hiện "Local: http://127.0.0.1:4173" để chẩn đoán khi server không lên
    stderr: 'pipe',
  },
  projects: [
    {
      name: 'webgl-ci',
      testIgnore: /webgpu\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        launchOptions: {
          executablePath: chromePath,
          args: ['--no-sandbox', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
        },
      },
    },
    {
      name: 'webgpu',
      testMatch: /webgpu\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        headless: !webgpu ? true : false,
        viewport: { width: 1920, height: 1200 },
        launchOptions: { args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] },
      },
    },
  ],
});
