/**
 * DV-093 nhạc nền intro bằng ElevenLabs Music (gói trả phí của Chủ nhà, quyền thương mại theo điều khoản gói).
 * Đọc khoá từ `.env.local` (ELEVENLABS_API_KEY, không in ra). Nhạc nguyên tác theo mô tả (không nêu tên nghệ sĩ, bài hát, game).
 * Bố cục khớp nhịp intro (content/cinematics/intro.cine.json): mỗi đoạn đúng thời lượng của cảnh.
 *   node scripts/cine-music.mjs [--out public/assets/audio/cine/intro-score.mp3]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const outArg = args.indexOf('--out');
const OUT = outArg >= 0 ? args[outArg + 1] : 'public/assets/audio/cine/intro-score.mp3';

function key() {
  const f = path.join(ROOT, '.env.local');
  const m = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').match(/^ELEVENLABS_API_KEY=(.+)$/m) : null;
  const k = (m?.[1] ?? process.env.ELEVENLABS_API_KEY ?? '').trim();
  if (!k) throw new Error('missing ELEVENLABS_API_KEY in .env.local');
  return k;
}

const BASE = ['cinematic orchestral war film score', 'instrumental', 'dark', 'tense', 'low strings', 'taiko-like war drums', 'jungle atmosphere'];
const NO = ['vocals', 'singing', 'choir lyrics', 'electronic dance beat', 'pop', 'cheerful'];

const plan = {
  positive_global_styles: BASE,
  negative_global_styles: NO,
  sections: [
    { section_name: 'cold open', duration_ms: 6000, positive_local_styles: ['near silence', 'distant low rumble', 'single sustained cello note', 'sparse'], negative_local_styles: ['drums'], lines: [] },
    { section_name: 'briefing', duration_ms: 13000, positive_local_styles: ['ticking muted percussion pulse', 'low string ostinato', 'restrained tension', 'slow build'], negative_local_styles: ['big hits'], lines: [] },
    { section_name: 'aerial', duration_ms: 8000, positive_local_styles: ['rising string swell', 'wide and epic', 'heavy low brass pad', 'crescendo'], negative_local_styles: [], lines: [] },
    { section_name: 'bombardment', duration_ms: 9000, positive_local_styles: ['massive percussion impacts', 'thunderous low drums', 'dissonant strings', 'chaos', 'slow motion feel in the middle'], negative_local_styles: [], lines: [] },
    { section_name: 'elegy', duration_ms: 14000, positive_local_styles: ['sorrowful solo bamboo flute melody', 'soft low strings', 'mournful', 'quiet', 'heartbeat-like soft pulse'], negative_local_styles: ['loud drums'], lines: [] },
    { section_name: 'ambush', duration_ms: 6000, positive_local_styles: ['sudden urgent percussion surge', 'staccato strings', 'driving rhythm', 'intense'], negative_local_styles: [], lines: [] },
    { section_name: 'title', duration_ms: 4000, positive_local_styles: ['one huge low boom hit', 'then sustained dark chord', 'ringing out'], negative_local_styles: [], lines: [] },
  ],
};

async function compose(body) {
  return fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192', {
    method: 'POST',
    headers: { 'xi-api-key': key(), 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify(body),
  });
}
let r = await compose({ composition_plan: plan, respect_sections_durations: true });
if (!r.ok) {
  console.error(`[music] plan rejected ${r.status}: ${(await r.text()).slice(0, 600)} -> retry with a text prompt`);
  const prompt =
    'Original instrumental cinematic war film score, exactly 60 seconds, no vocals. 0-6s near silence with distant low rumble and one sustained cello note. ' +
    '6-19s ticking muted percussion pulse and low string ostinato, restrained tension. 19-27s rising string swell with heavy low brass pad, wide crescendo. ' +
    '27-36s massive thunderous drum impacts and dissonant strings, chaos. 36-50s sorrowful solo bamboo flute melody over soft low strings, mournful and quiet. ' +
    '50-56s sudden urgent percussion surge with staccato strings. 56-60s one huge low boom hit then a sustained dark chord ringing out.';
  r = await compose({ prompt, music_length_ms: 60000 });
}
if (!r.ok) {
  console.error(`[music] ${r.status} ${(await r.text()).slice(0, 800)}`);
  process.exit(1);
}
const buf = Buffer.from(await r.arrayBuffer());
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, buf);
console.log(`[music] ${OUT} ${(buf.length / 1e6).toFixed(2)} MB`);
