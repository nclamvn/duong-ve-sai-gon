/**
 * DV-093 ghép intro: luồng H.264 dựng offline (recordings/<id>.h264) + tiếng thu thời gian thực (recordings/<id>-audio.webm)
 *   → recordings/<id>-master.mp4   (giữ nguyên hình 4K, AAC 320 kb/s — bản trình chiếu)
 *   → public/assets/video/<id>.mp4 (1920×1080 H.264 CRF 19, AAC 192 kb/s, faststart — bản phát trong game)
 * Cần ffmpeg. node scripts/cine-mux.mjs [--id intro] [--fps 30] [--no-game]
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const id = opt('id', 'intro');
const fps = opt('fps', '30');
const vid = `recordings/${id}.h264`;
const aud = `recordings/${id}-audio.webm`;
if (!fs.existsSync(vid)) throw new Error(`missing ${vid} (run ?cine=${id}&rec=video first)`);
const hasAudio = fs.existsSync(aud);
const run = (a) => {
  console.log(`[mux] ffmpeg ${a.join(' ')}`);
  execFileSync('ffmpeg', a, { stdio: 'inherit' });
};
const master = `recordings/${id}-master.mp4`;
run(['-y', '-f', 'h264', '-framerate', fps, '-i', vid, ...(hasAudio ? ['-i', aud] : []), '-map', '0:v', ...(hasAudio ? ['-map', '1:a', '-c:a', 'aac', '-b:a', '320k', '-af', 'apad', '-shortest'] : []), '-c:v', 'copy', '-movflags', '+faststart', master]);
if (!args.includes('--no-game')) {
  fs.mkdirSync('public/assets/video', { recursive: true });
  const game = `public/assets/video/${id}.mp4`;
  run(['-y', '-i', master, '-vf', 'scale=1920:1080:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-profile:v', 'high', ...(hasAudio ? ['-c:a', 'aac', '-b:a', '192k'] : []), '-movflags', '+faststart', game]);
  console.log(`[mux] ${game} ${(fs.statSync(game).size / 1e6).toFixed(1)} MB`);
}
console.log(`[mux] ${master} ${(fs.statSync(master).size / 1e6).toFixed(1)} MB${hasAudio ? '' : ' (no audio track: run ?cine=' + id + '&rec=audio)'}`);
