/**
 * DV-093 nhạc nền intro bằng ElevenLabs Music (gói trả phí của Chủ nhà, quyền thương mại theo điều khoản gói).
 * Đọc khoá từ `.env.local` (ELEVENLABS_API_KEY, không in ra). Nhạc nguyên tác theo mô tả (không nêu tên nghệ sĩ, bài hát, game).
 * Bố cục khớp nhịp intro (content/cinematics/intro.cine.json): mỗi đoạn đúng thời lượng của cảnh.
 *   node scripts/cine-music.mjs [--id intro|intro-60] [--out public/assets/audio/cine/<id>-score.mp3]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const outArg = args.indexOf('--out');
const idArg = args.indexOf('--id');

function key() {
  const f = path.join(ROOT, '.env.local');
  const m = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').match(/^ELEVENLABS_API_KEY=(.+)$/m) : null;
  const k = (m?.[1] ?? process.env.ELEVENLABS_API_KEY ?? '').trim();
  if (!k) throw new Error('missing ELEVENLABS_API_KEY in .env.local');
  return k;
}

const BASE = ['cinematic orchestral war film score', 'instrumental', 'dark', 'tense', 'low strings', 'taiko-like war drums', 'jungle atmosphere'];
const NO = ['vocals', 'singing', 'choir lyrics', 'electronic dance beat', 'pop', 'cheerful'];

const sec = (name, s, pos, neg = []) => ({ section_name: name, duration_ms: Math.round(s * 1000), positive_local_styles: pos, negative_local_styles: neg, lines: [] });
const COLD = ['near silence', 'distant low rumble', 'single sustained cello note', 'sparse'];
const BRIEF = ['ticking muted percussion pulse', 'low string ostinato', 'restrained tension', 'slow build'];
const AIR = ['rising string swell', 'wide and epic', 'heavy low brass pad', 'crescendo'];
const BOMB = ['massive percussion impacts', 'thunderous low drums', 'dissonant strings', 'chaos', 'slow motion feel in the middle'];
const ELEGY = ['sorrowful solo bamboo flute melody', 'soft low strings', 'mournful', 'quiet', 'heartbeat-like soft pulse'];
const AMBUSH = ['sudden urgent percussion surge', 'staccato strings', 'driving rhythm', 'intense'];
const DAZE = ['muffled underwater feel', 'high thin ringing tone', 'slow heavy heartbeat', 'music almost gone', 'then strings swelling back'];
const CHARGE = ['heroic rising brass', 'pounding war drums', 'full orchestra', 'defiant and driving'];
const TITLE = ['one huge low boom hit', 'then sustained dark chord', 'ringing out'];
/** mỗi bản cắt một bố cục, khớp thời lượng từng cảnh trong content/cinematics/<id>.cine.json */
const CUTS = {
  intro: [
    sec('cold open', 6, COLD, ['drums']),
    sec('briefing', 13, BRIEF, ['big hits']),
    sec('aerial', 8, AIR),
    sec('bombardment', 9, BOMB),
    sec('elegy', 14, ELEGY, ['loud drums']),
    sec('ambush', 7.5, AMBUSH),
    sec('concussion', 9, DAZE, ['drums']),
    sec('charge', 6, CHARGE),
    sec('title', 4.5, TITLE),
  ],
  'intro-60': [
    sec('cold open', 4.5, COLD, ['drums']),
    sec('briefing', 10.5, BRIEF, ['big hits']),
    sec('aerial', 6, AIR),
    sec('bombardment', 8, BOMB),
    sec('elegy', 11.5, ELEGY, ['loud drums']),
    sec('ambush', 6, AMBUSH),
    sec('concussion', 9, DAZE, ['drums']),
    sec('title', 4.5, TITLE),
  ],
};
const ID = idArg >= 0 ? args[idArg + 1] : 'intro';
const sections = CUTS[ID];
if (!sections) throw new Error(`unknown cut ${ID} (${Object.keys(CUTS).join(', ')})`);
const TOTAL = sections.reduce((n, x) => n + x.duration_ms, 0);
const OUT = outArg >= 0 ? args[outArg + 1] : `public/assets/audio/cine/${ID}-score.mp3`;
const plan = { positive_global_styles: BASE, negative_global_styles: NO, sections };

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
  let at = 0;
  const parts = sections.map((x) => {
    const p = `${(at / 1000).toFixed(1)}-${((at + x.duration_ms) / 1000).toFixed(1)}s ${x.positive_local_styles.join(', ')}.`;
    at += x.duration_ms;
    return p;
  });
  const prompt = `Original instrumental cinematic war film score, exactly ${TOTAL / 1000} seconds, no vocals. ${parts.join(' ')}`;
  r = await compose({ prompt, music_length_ms: TOTAL });
}
if (!r.ok) {
  console.error(`[music] ${r.status} ${(await r.text()).slice(0, 800)}`);
  process.exit(1);
}
const buf = Buffer.from(await r.arrayBuffer());
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, buf);
console.log(`[music] ${OUT} ${(buf.length / 1e6).toFixed(2)} MB`);
