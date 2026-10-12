#!/usr/bin/env node
/**
 * DV-076: ghi giọng đã tạo vào `content/assets/manifest.json` (một asset `voice_elevenlabs`, license ElevenLabs-Paid: gói trả
 * phí của Chủ nhà có giấy phép thương mại cho audio tạo ra) để validator asset kiểm bytes/sha256 như mọi asset khác.
 * Chạy tự động cuối `generate.mjs`; chạy riêng: node scripts/voice/register.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function registerVoice(root) {
  const mPath = path.join(root, 'content/assets/manifest.json');
  const m = JSON.parse(fs.readFileSync(mPath, 'utf8'));
  const dir = path.join(root, 'public/assets/voice');
  const files = [];
  const walk = (d) => {
    for (const f of fs.readdirSync(d).sort()) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (/\.(mp3|json)$/.test(f)) {
        const buf = fs.readFileSync(p);
        files.push({ path: path.relative(path.join(root, 'public'), p).split(path.sep).join('/'), bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex') });
      }
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  const entry = {
    id: 'voice_elevenlabs',
    type: 'audio',
    use: 'lồng tiếng: phe ta tiếng Việt, phe địch tiếng Anh (DV-076)',
    source: 'elevenlabs',
    url: 'https://elevenlabs.io',
    authors: ['ElevenLabs (TTS, gói trả phí của chủ dự án)'],
    license: 'ElevenLabs-Paid',
    files,
  };
  const i = m.assets.findIndex((a) => a.id === entry.id);
  if (i >= 0) m.assets[i] = entry;
  else m.assets.push(entry);
  m.totalBytes = m.assets.reduce((a, x) => a + x.files.reduce((b, f) => b + f.bytes, 0), 0);
  fs.writeFileSync(mPath, `${JSON.stringify(m, null, 2)}\n`);
  return files.length;
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(`[voice] đăng ký ${registerVoice(process.cwd())} file vào content/assets/manifest.json`);
