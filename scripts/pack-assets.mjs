#!/usr/bin/env node
/**
 * Đóng gói asset bảo vệ (DV-062): mọi asset manifest có license thuộc PROTECT_LICENSES (hoặc `protect: true`)
 * → mã hoá thành `public/assets/pak/<hash>.dvpak`, file trần chuyển về `assets-src/pak-src/` (gitignore),
 * cập nhật manifest (files[].path = gói, files[].logical = đường cũ) + `content/assets/pak.json` cho runtime.
 *
 * Tất định và chạy lại được: nếu file trần lại xuất hiện trong public/ (vd chạy lại convert-ab3dx-vm.mjs)
 * thì đóng gói lại từ bản mới; nếu không thì giữ gói hiện có.
 * Dùng: node scripts/pack-assets.mjs [--check]   (Node ≥ 22.18: nạp thẳng src/engine/render/pakCrypto.ts)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, copyFileSync, unlinkSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { packBytes, unpackBytes, pakName, isPak } from '../src/engine/render/pakCrypto.ts';

export const PROTECT_LICENSES = new Set(['Fab-Standard', 'CGTrader-RF', 'Unity-EULA']);
const MANIFEST = 'content/assets/manifest.json';
const INDEX = 'content/assets/pak.json';
const SRC = 'assets-src/pak-src';
const check = process.argv.includes('--check');

const sha256 = (b) => createHash('sha256').update(b).digest('hex');

function glbImageMimes(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) return null;
  const len = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
  return (json.images ?? []).map((i) => i.mimeType ?? 'uri');
}

const m = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const index = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, 'utf8')) : { files: {} };
const files = {};
let changed = 0;
const problems = [];

for (const a of m.assets) {
  if (!(a.protect || PROTECT_LICENSES.has(a.license))) continue;
  a.protect = true;
  for (const f of a.files) {
    const logicalFull = f.logical ?? f.path; // "assets/weapons/ak47_vm.glb"
    const logical = logicalFull.replace(/^assets\//, '');
    const name = await pakName(logical);
    const pakPath = `assets/pak/${name}`;
    const plainPub = join('public', logicalFull);
    const plainSrc = join(SRC, logical);
    const pakPub = join('public', pakPath);
    let plain = null;
    if (existsSync(plainPub)) plain = readFileSync(plainPub);
    if (check) {
      if (plain) problems.push(`${a.id}: file trần còn trong public: ${logicalFull}`);
      if (!existsSync(pakPub)) problems.push(`${a.id}: thiếu gói ${pakPath}`);
      files[logical] = `pak/${name}`;
      continue;
    }
    if (plain) {
      const mimes = glbImageMimes(plain);
      if (mimes && mimes.some((x) => x !== 'image/ktx2')) throw new Error(`${a.id}: còn texture không phải KTX2, chạy ktx2 trước khi đóng gói`);
      const out = Buffer.from(await packBytes(new Uint8Array(plain), logical));
      // tự kiểm: giải mã lại phải ra đúng bản rõ
      const back = Buffer.from(await unpackBytes(out, logical));
      if (sha256(back) !== sha256(plain)) throw new Error(`${a.id}: giải mã thử không khớp`);
      mkdirSync(dirname(pakPub), { recursive: true });
      writeFileSync(pakPub, out);
      mkdirSync(dirname(plainSrc), { recursive: true });
      try {
        renameSync(plainPub, plainSrc);
      } catch {
        copyFileSync(plainPub, plainSrc);
        unlinkSync(plainPub);
      }
      changed++;
      console.log(`đóng gói ${a.id}: ${logicalFull} (${plain.length} B) → ${pakPath}`);
    } else if (!existsSync(pakPub)) {
      throw new Error(`${a.id}: không có ${plainPub} để đóng gói và cũng chưa có ${pakPath}`);
    }
    const buf = readFileSync(pakPub);
    if (!isPak(new Uint8Array(buf))) throw new Error(`${pakPath} sai định dạng`);
    f.logical = logicalFull;
    f.path = pakPath;
    f.bytes = statSync(pakPub).size;
    f.sha256 = sha256(buf);
    files[logical] = `pak/${name}`;
  }
}

if (check) {
  const want = JSON.stringify(files);
  if (JSON.stringify(index.files) !== want) problems.push('content/assets/pak.json lệch manifest');
  if (problems.length) {
    for (const p of problems) console.error('FAIL', p);
    process.exit(1);
  }
  console.log(`pack-assets --check OK (${Object.keys(files).length} file bảo vệ)`);
} else {
  m.totalBytes = m.assets.reduce((s, a) => s + a.files.reduce((t, f) => t + f.bytes, 0), 0);
  writeFileSync(MANIFEST, `${JSON.stringify(m, null, 2)}\n`);
  writeFileSync(INDEX, `${JSON.stringify({ note: index.note, files }, null, 2)}\n`);
  console.log(`xong: ${changed} gói mới, ${Object.keys(files).length} file bảo vệ`);
}
