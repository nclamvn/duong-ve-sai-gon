#!/usr/bin/env node
/**
 * DV-078 tìm giọng trong thư viện ElevenLabs cho vai mới (không in khoá): `node scripts/voice/find-voices.mjs [--lang vi] [--gender male|female] [--age old|middle_aged|young] [--search từ]`
 * In tên, voice_id, giọng vùng, tuổi, mô tả — Chủ nhà/Thầu chọn rồi ghi vào content/voice/cast.json.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : d;
};
const f = path.join(process.cwd(), '.env.local');
const m = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').match(/^ELEVENLABS_API_KEY=(.+)$/m) : null;
const key = (m?.[1] ?? process.env.ELEVENLABS_API_KEY ?? '').trim();
if (!key) throw new Error('thiếu ELEVENLABS_API_KEY trong .env.local');
const q = new URLSearchParams({ page_size: '40', language: opt('--lang', 'vi') });
if (opt('--gender')) q.set('gender', opt('--gender'));
if (opt('--age')) q.set('age', opt('--age'));
if (opt('--search')) q.set('search', opt('--search'));
const r = await fetch(`https://api.elevenlabs.io/v1/shared-voices?${q}`, { headers: { 'xi-api-key': key } });
if (!r.ok) throw new Error(`shared-voices ${r.status}: ${(await r.text()).slice(0, 200)}`);
const j = await r.json();
for (const v of j.voices ?? []) {
  console.log([v.voice_id, v.name, v.gender, v.age, v.accent, v.language, v.use_case, (v.description ?? '').replace(/\s+/g, ' ').slice(0, 110)].join(' | '));
}
console.log(`${(j.voices ?? []).length} giọng`);
