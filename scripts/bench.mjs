#!/usr/bin/env node
/**
 * npm run bench [-- --runs 3 --seconds 90 --quick]
 * Khởi động Vite (mode bench), mở Chrome (macOS: Google Chrome; khác: trình duyệt mặc định) với ?bench=1,
 * chờ plugin ghi evidence rồi in verdict + evidence_status và thoát. PRD §4.1, §15 (64–72h).
 */
import { spawn, execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const get = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const quick = args.includes('--quick');
const runs = Number(get('--runs', quick ? 1 : 3));
const seconds = Number(get('--seconds', quick ? 10 : 90));
const seed = Number(get('--seed', 7));
const port = Number(get('--port', 5173));
const backend = get('--backend', '');
const url = `http://127.0.0.1:${port}/?bench=1&autostart=1&overlay=1&runs=${runs}&seconds=${seconds}&seed=${seed}${backend ? `&backend=${backend}` : ''}`;

const vite = spawn('npx', ['vite', '--mode', 'bench', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
let opened = false;
let done = false;

function openBrowser() {
  if (opened) return;
  opened = true;
  console.log(`[bench] mở ${url}`);
  try {
    if (process.platform === 'darwin') execSync(`open -a "Google Chrome" "${url}"`);
    else if (process.platform === 'win32') execSync(`start "" "${url}"`, { shell: true });
    else execSync(`xdg-open "${url}"`);
  } catch {
    console.log('[bench] không mở được Chrome tự động — hãy mở URL trên bằng Chrome Stable.');
  }
}

function onData(chunk) {
  const s = chunk.toString();
  process.stdout.write(s);
  if (!opened && /(localhost|127\.0\.0\.1):\d+/.test(s)) setTimeout(openBrowser, 800);
  const m = s.match(/\[bench\] saved (\S+) verdict=(\S+)/);
  if (m && !done) {
    done = true;
    const file = m[1];
    try {
      const rep = JSON.parse(readFileSync(file, 'utf8'));
      const md = rep.median;
      console.log('\n══════════ HT-MB G0 BENCH ══════════');
      console.log(`file            ${file}`);
      console.log(`evidence_status ${rep.evidence_status}`);
      console.log(`backend         ${rep.backend} · ${rep.browser} · ${rep.device.adapter ? rep.device.adapter.description || rep.device.adapter.vendor : 'n/a'}`);
      console.log(`viewport        ${rep.device.viewport.join('×')} css · dpr ${rep.device.dpr} · render_width_avg ${md.render_width_avg.toFixed(0)}`);
      console.log(`fps_avg         ${md.fps_avg.toFixed(1)}   1%low ${md.fps_1pct_low.toFixed(1)}   frame_p95 ${md.frame_p95.toFixed(2)} ms   p99 ${md.frame_p99.toFixed(2)} ms`);
      console.log(`cpu_sim_p95     ${md.cpu_sim_p95.toFixed(2)} ms   cpu_render_p95 ${md.cpu_render_p95.toFixed(2)} ms   gpu_p95 ${md.gpu_ms_p95 === null ? 'NA' : md.gpu_ms_p95.toFixed(2) + ' ms'} (${md.gpu_method})`);
      console.log(`draw_calls_avg  ${md.draw_calls_avg.toFixed(0)}   tris_avg ${(md.triangles_avg / 1000).toFixed(0)}k   heap ${md.heap_start_mb ?? 'NA'}→${md.heap_end_mb ?? 'NA'} MB   scale_avg ${md.scale_avg.toFixed(2)}   hitches ${md.shader_hitches}`);
      console.log(`budget          ${Object.entries(rep.budgetCheck).filter(([, v]) => v.status !== 'NA').map(([k, v]) => `${k}:${v.status}`).join(' ')}`);
      console.log(`VERDICT         ${rep.verdict}`);
      if (rep.notes.length) console.log(`notes           ${rep.notes.join(' | ')}`);
      console.log('════════════════════════════════════\n');
    } catch (e) {
      console.log('[bench] không đọc được report:', e.message);
    }
    setTimeout(() => {
      vite.kill();
      process.exit(0);
    }, 1500);
  }
}
vite.stdout.on('data', onData);
vite.stderr.on('data', onData);
vite.on('exit', (code) => {
  if (!done) process.exit(code ?? 1);
});
process.on('SIGINT', () => {
  vite.kill();
  process.exit(130);
});
