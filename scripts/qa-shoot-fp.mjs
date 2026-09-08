// TIP-D11b: chụp ảnh tay FP trong game (WebGL sandbox) để calib pose. Preview phải đang chạy (:4173).
// Dùng: HT_CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/qa-shoot-fp.mjs <label> [poseFile.json] [ads]
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const [label='base', poseFile=null, ads=null] = process.argv.slice(2);
const exe = process.env.HT_CHROME;
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
await page.route('**/*', r => { const u=r.request().url(); (u.includes('127.0.0.1')||u.startsWith('data:')||u.startsWith('blob:'))?r.continue():r.abort(); });
page.on('console', m => { const t=m.text(); if(/\[fp\]|error|Error|WARN/i.test(t)) console.log('  PAGE:',t.slice(0,200)); });
const url = 'http://127.0.0.1:4173/?backend=webgl&level=truong-son&autostart=1&debug=1&quality=low&post=off&veg=0&sky=0&character=0';
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ht && window.__ht.ready, { timeout: 45000 }).then(()=>console.log('  __ht.ready OK')).catch(()=>console.log('  (no __ht.ready)'));
await page.waitForTimeout(2500);
const info = await page.evaluate(() => ({ has: window.__ht?.fp?.has?.(), tris: window.__ht?.fp?.tris?.() }));
console.log('  fpHands:', JSON.stringify(info));
if (poseFile) {
  const pose = readFileSync(poseFile,'utf8');
  await page.evaluate((p)=>window.__ht.fp.setPose(p), pose);
}
if (ads !== null) {
  // ép ADS bằng cách giữ chuột phải? đơn giản: set weapon.ads nếu có API — bỏ qua nếu không
}
await page.waitForTimeout(400);
await page.screenshot({ path: `evidence/TIP-D11b/game_${label}.png`, timeout: 45000 });
console.log('  → evidence/TIP-D11b/game_'+label+'.png');
await browser.close();
