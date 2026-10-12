#!/usr/bin/env node
/**
 * DV-076 tạo giọng bằng ElevenLabs (gói trả phí của Chủ nhà). Đọc khoá từ `.env.local` (ELEVENLABS_API_KEY, không in ra),
 * vai trong `content/voice/cast.json`, câu từ `scripts/voice/lines.mjs`. Ghi `public/assets/voice/<lang>/*.mp3` + manifest.
 * Chỉ tạo câu mới/đổi (băm: model + giọng + cài đặt + thẻ + chữ + lần đọc); `--force` tạo lại hết.
 *
 *   node scripts/voice/generate.mjs                 tạo phần còn thiếu
 *   node scripts/voice/generate.mjs --only '^M0'    chỉ khoá khớp regex
 *   node scripts/voice/generate.mjs --dry           liệt kê, không gọi API
 *   node scripts/voice/generate.mjs --verify        nghe lại bằng speech-to-text, báo câu đọc sai
 *   node scripts/voice/generate.mjs --fix           tạo lại các câu trong verify-report có độ khớp thấp
 *
 * Kiểm chất lượng tự động (mặc định bật, `--no-qa` tắt): mỗi file mới được nghe lại bằng speech-to-text; khớp < QA_MIN thì đọc
 * lại với hạt giống khác, bỏ thẻ diễn, cuối cùng dùng eleven_flash_v2_5 (rõ chữ hơn với câu hô tiếng Việt rất ngắn); giữ bản
 * khớp nhất.
 *
 * Hậu kỳ (khi có ffmpeg): cắt lặng đầu/cuối, chuẩn độ to −16 LUFS (hô −14), mp3 96 kbps.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { registerVoice } from './register.mjs';
import { buildLines, fileOf, hashOf as hashOfCast, settingsOf as settingsOfCast } from './lines.mjs';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};
const DRY = flag('--dry');
const FORCE = flag('--force');
const VERIFY = flag('--verify');
const ONLY = opt('--only') ? new RegExp(opt('--only')) : null;
const LIMIT = Number(opt('--limit') ?? Infinity);
const CONC = Number(opt('--concurrency') ?? 3);
const QA = !flag('--no-qa');
const FIX = flag('--fix');
const QA_MIN = 0.8;
const FALLBACK_MODEL = 'eleven_flash_v2_5';

const OUT = path.join(ROOT, 'public/assets/voice');
const MANIFEST = path.join(OUT, 'manifest.json');
const cast = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/voice/cast.json'), 'utf8'));

function apiKey() {
  const f = path.join(ROOT, '.env.local');
  const m = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').match(/^ELEVENLABS_API_KEY=(.+)$/m) : null;
  const k = (m?.[1] ?? process.env.ELEVENLABS_API_KEY ?? '').trim();
  if (!k) throw new Error('thiếu ELEVENLABS_API_KEY trong .env.local');
  return k;
}

const has = (bin) => {
  try {
    execFileSync(bin, ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};
const FFMPEG = has('ffmpeg');
const FFPROBE = has('ffprobe');

function durationMs(file) {
  if (FFPROBE) {
    const s = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim();
    return Math.round(Number(s) * 1000);
  }
  return Math.round((fs.statSync(file).size * 8) / 96); // ước lượng 96 kbps
}

function post(raw, out, loud) {
  if (!FFMPEG) {
    fs.copyFileSync(raw, out);
    return;
  }
  const trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse';
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-af', `${trim},loudnorm=I=${loud}:TP=-1.5:LRA=11`, '-ar', '44100', '-ac', '1', '-b:a', '96k', out]);
}

const settingsOf = (voice) => settingsOfCast(cast, voice);
const hashOf = (l, take) => hashOfCast(cast, l, take);
const seedOf = (h) => parseInt(h.slice(0, 8), 16) % 4294967295;

async function tts(key, l, take, h, o = {}) {
  const v = cast.voices[l.voice];
  const model = o.model ?? cast.model;
  // thẻ diễn chỉ eleven_v3 hiểu
  const text = `${l.tag && !o.noTag && model === 'eleven_v3' ? `${l.tag} ` : ''}${l.text}`;
  const body = { text, model_id: model, voice_settings: settingsOf(l.voice), seed: (seedOf(h) + (o.seedOffset ?? 0)) % 4294967295 };
  if (model !== 'eleven_v3') body.language_code = l.lang;
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${v.voiceId}?output_format=${cast.outputFormat}`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify(body),
    });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    const errText = await r.text();
    if (r.status === 429 || r.status === 409 || r.status >= 500) {
      await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
      continue;
    }
    throw new Error(`TTS ${l.key}#${take} ${r.status}: ${errText.slice(0, 240)}`);
  }
  throw new Error(`TTS ${l.key}#${take}: hết lượt thử`);
}

const norm = (s) =>
  s
    .normalize('NFC')
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
function similarity(a, b) {
  const x = norm(a);
  const y = norm(b);
  const m = x.length;
  const n = y.length;
  if (!m || !n) return m === n ? 1 : 0;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}

async function stt(key, file, lang) {
  const fd = new FormData();
  fd.append('model_id', 'scribe_v1');
  fd.append('language_code', lang === 'vi' ? 'vie' : 'eng');
  fd.append('tag_audio_events', 'true');
  fd.append('file', new Blob([fs.readFileSync(file)], { type: 'audio/mpeg' }), path.basename(file));
  const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': key }, body: fd });
  if (!r.ok) throw new Error(`STT ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).text ?? '';
}

/** khớp với chữ gốc: lấy lần nghe tốt hơn trong 2 lần (speech-to-text dao động với câu hô rất ngắn) */
async function heardSim(key, file, l) {
  let best = { sim: -1, heard: '' };
  for (let i = 0; i < 2; i++) {
    const heard = await stt(key, file, l.lang);
    const sim = similarity(l.text, heard);
    if (sim > best.sim) best = { sim, heard };
    if (sim >= QA_MIN) break;
  }
  return best;
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

async function main() {
  const lines = buildLines(ROOT).filter((l) => !ONLY || ONLY.test(l.key));
  for (const l of lines) if (!cast.voices[l.voice]) throw new Error(`thiếu vai ${l.voice} trong cast.json (${l.key})`);
  const old = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : { lines: {} };
  const oldFiles = new Map();
  for (const e of Object.values(old.lines ?? {})) e.files.forEach((f, i) => oldFiles.set(f, { hash: e.hash[i], ms: e.ms[i], qa: e.qa?.[i] ?? null, model: e.model?.[i] }));
  // --fix: các file verify-report chấm thấp → coi như chưa có
  const fixSet = new Set();
  if (FIX) {
    const rep = JSON.parse(fs.readFileSync(path.join(OUT, 'verify-report.json'), 'utf8'));
    for (const b of rep.bad) {
      const l = lines.find((x) => x.key === b.key);
      if (l) fixSet.add(fileOf(l, b.take - 1));
    }
    console.log(`--fix: ${fixSet.size} file`);
  }

  if (VERIFY) {
    const key = apiKey();
    const bad = [];
    const all = [];
    let n = 0;
    await pool(lines.flatMap((l) => Array.from({ length: l.takes }, (_, t) => ({ l, t }))).slice(0, LIMIT), CONC, async ({ l, t }) => {
      const f = path.join(OUT, fileOf(l, t));
      if (!fs.existsSync(f)) return;
      const { sim: s, heard } = await heardSim(key, f, l);
      const leak = /\b(whisper|shout|laugh|sigh|quietly|urgent|pained|calm|tired)\w*\b/i.test(norm(heard)) && !/\b(whisper|shout|laugh|quiet|urgent|calm|tired)/i.test(norm(l.text));
      n++;
      all.push({ key: l.key, take: t + 1, sim: Number(s.toFixed(2)), heard });
      if (s < 0.75 || leak) bad.push({ key: l.key, take: t + 1, sim: Number(s.toFixed(2)), leak, want: l.text, heard });
    });
    fs.writeFileSync(path.join(OUT, 'verify-report.json'), `${JSON.stringify({ checked: n, bad, all: all.sort((a, b) => a.key.localeCompare(b.key)) }, null, 1)}\n`);
    console.log(`kiểm ${n} file, ${bad.length} nghi đọc sai → public/assets/voice/verify-report.json`);
    for (const b of bad) console.log(`  ${b.key}#${b.take} sim=${b.sim}${b.leak ? ' THẺ-BỊ-ĐỌC' : ''} | ${b.want} | nghe: ${b.heard}`);
    return;
  }

  const jobs = [];
  for (const l of lines) for (let t = 0; t < l.takes; t++) {
    const rel = fileOf(l, t);
    const h = hashOf(l, t);
    const prevE = oldFiles.get(rel);
    if (!FORCE && !fixSet.has(rel) && prevE?.hash === h && fs.existsSync(path.join(OUT, rel))) continue;
    jobs.push({ l, t, rel, h });
  }
  const todo = jobs.slice(0, LIMIT);
  const chars = todo.reduce((a, j) => a + j.l.text.length + j.l.tag.length + 1, 0);
  console.log(`${lines.length} câu, cần tạo ${todo.length} file (~${chars} ký tự)${DRY ? ' [dry]' : ''}; ffmpeg ${FFMPEG ? 'có' : 'không'}`);
  if (DRY) {
    for (const j of todo) console.log(`  ${j.rel}  ${j.l.voice}  ${j.l.tag} ${j.l.text}`);
    return;
  }
  const key = apiKey();
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dvsg-voice-'));
  const fresh = new Map();
  let done = 0;
  const errors = [];
  try {
    await pool(todo, CONC, async (j) => {
      try {
        const out = path.join(OUT, j.rel);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        const loud = j.l.tag.includes('shouting') ? -14 : -16;
        const tries = QA ? [{}, { seedOffset: 1 }, { seedOffset: 2, noTag: true }, { model: FALLBACK_MODEL }] : [{}];
        let best = null;
        for (let i = 0; i < tries.length; i++) {
          const buf = await tts(key, j.l, j.t, j.h, tries[i]);
          const raw = path.join(tmp, `${j.h}_${i}.mp3`);
          const cooked = path.join(tmp, `${j.h}_${i}_p.mp3`);
          fs.writeFileSync(raw, buf);
          post(raw, cooked, loud);
          const sim = QA ? (await heardSim(key, cooked, j.l)).sim : 1;
          if (!best || sim > best.sim) best = { file: cooked, sim, model: tries[i].model ?? cast.model };
          if (sim >= QA_MIN) break;
        }
        fs.copyFileSync(best.file, out);
        fresh.set(j.rel, { hash: j.h, ms: durationMs(out), qa: Number(best.sim.toFixed(2)), model: best.model });
        done++;
        if (done % 20 === 0) console.log(`  ${done}/${todo.length}`);
      } catch (e) {
        errors.push(String(e.message ?? e));
      }
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  // manifest: theo khoá phát (group cho câu địch), giữ thứ tự lần đọc
  const all = buildLines(ROOT);
  const manifest = { version: 1, model: cast.model, generated: new Date().toISOString(), lines: {} };
  for (const l of all) for (let t = 0; t < l.takes; t++) {
    const rel = fileOf(l, t);
    const info = fresh.get(rel) ?? oldFiles.get(rel);
    if (!info || !fs.existsSync(path.join(OUT, rel))) continue;
    const k = l.group ?? l.key;
    const e = (manifest.lines[k] ??= { voice: l.voice, files: [], ms: [], hash: [], qa: [], model: [] });
    e.files.push(rel);
    e.ms.push(info.ms);
    e.hash.push(info.hash);
    e.qa.push(info.qa ?? null);
    e.model.push(info.model ?? cast.model);
  }
  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 1)}\n`);
  console.log(`đăng ký ${registerVoice(ROOT)} file vào content/assets/manifest.json`);
  console.log(`xong ${done}/${todo.length}; manifest ${Object.keys(manifest.lines).length} khoá`);
  if (errors.length) {
    console.log(`${errors.length} lỗi:`);
    for (const e of errors.slice(0, 20)) console.log(`  ${e}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(String(e.message ?? e));
  process.exit(1);
});
