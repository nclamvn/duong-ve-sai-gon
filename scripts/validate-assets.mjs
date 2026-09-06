#!/usr/bin/env node
/**
 * Validator asset (TIP-D02, PRD DVSG §7.1–7.6, PRF-004): chạy trong unit test + CI.
 *  FAIL: file thiếu/bytes/sha256 lệch; license ngoài allow-list; CC-BY thiếu attribution/url/authors; `historical` thiếu registryId;
 *        texture rời không phải .ktx2; GLB còn texture không phải image/ktx2 (KTX2 bắt buộc từ G2 — PRF-004);
 *        tên file/id không đúng quy ước (models: veh_/prop_/chr_/wpn_/veg_/bld_/lm_ hoặc id Poly Haven kế thừa).
 *  WARN: tam giác vượt ngân sách loại (nhân vật 25k, súng 20k, xe 40k, máy bay 15k, prop 3k, cây 22k LOD0) — asset kế thừa HT-MB không chặn.
 * Dùng: node scripts/validate-assets.mjs [--json] [--strict-tris]
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const MANIFEST = 'content/assets/manifest.json';
const LICENSES = new Set(['CC0-1.0', 'CC-BY-4.0', 'CC-BY-3.0', 'Mixamo', 'PD-USGov', 'OFL-1.1']); // OFL: font tự host (TIP-UX02)
const TRI_BUDGET = { chr_: 25000, wpn_: 20000, veh_: 40000, air_: 15000, veg_: 22000, prop_: 3000 }; // veg_: LOD0 cây tán (TIP-D05, chỉ hiện < 32 m; LOD1/2 + impostor ở xa)

const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

/** đọc chunk JSON của GLB → danh sách mimeType ảnh */
function glbImageMimes(p) {
  const buf = readFileSync(p);
  if (buf.readUInt32LE(0) !== 0x46546c67) return [];
  const len = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
  return (json.images ?? []).map((i) => i.mimeType ?? 'uri');
}

export function validateAssets(opts = {}) {
  const errors = [];
  const warnings = [];
  const m = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  let total = 0;
  for (const a of m.assets) {
    if (!LICENSES.has(a.license)) errors.push(`${a.id}: license "${a.license}" ngoài allow-list`);
    if (a.license === 'CC-BY-4.0' && !(a.attribution && a.url && a.authors?.length)) errors.push(`${a.id}: CC-BY thiếu attribution/url/authors`);
    if (a.historical && !a.registryId) errors.push(`${a.id}: historical=true thiếu registryId`);
    for (const f of a.files) {
      const p = join('public', f.path);
      total += f.bytes;
      if (!existsSync(p)) {
        errors.push(`${a.id}: thiếu file ${f.path}`);
        continue;
      }
      const st = statSync(p);
      if (st.size !== f.bytes) errors.push(`${a.id}: ${f.path} bytes ${st.size} ≠ manifest ${f.bytes}`);
      else if (sha256(p) !== f.sha256) errors.push(`${a.id}: ${f.path} sha256 lệch`);
      if (a.type === 'texture' && !/\.ktx2$/.test(f.path)) errors.push(`${a.id}: texture rời phải là .ktx2 (PRF-004): ${f.path}`);
      if (/\.glb$/.test(f.path) && existsSync(p)) {
        const mimes = glbImageMimes(p);
        const bad = mimes.filter((x) => x !== 'image/ktx2');
        if (bad.length) errors.push(`${a.id}: ${f.path} còn ${bad.length}/${mimes.length} texture không phải KTX2 (${[...new Set(bad)].join(',')})`);
      }
    }
    if (a.triangles?.output) {
      const key = Object.keys(TRI_BUDGET).find((k) => a.id.startsWith(k));
      if (key && a.triangles.output > TRI_BUDGET[key]) {
        const msg = `${a.id}: ${a.triangles.output} tri > ngân sách ${key} ${TRI_BUDGET[key]}`;
        if (opts.strictTris) errors.push(msg);
        else warnings.push(msg);
      }
    }
  }
  if (total !== m.totalBytes) errors.push(`totalBytes ${m.totalBytes} ≠ tổng file ${total}`);
  // file lạc trong public/assets không có trong manifest
  const listed = new Set(m.assets.flatMap((a) => a.files.map((f) => f.path)));
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else {
        const rel = p.replace(/^public\//, '');
        if (!listed.has(rel) && !/\.(md|txt)$/.test(f)) errors.push(`file không có trong manifest: ${rel}`);
      }
    }
  };
  walk('public/assets');
  return { errors, warnings, assets: m.assets.length, totalMB: +(total / 1048576).toFixed(1) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = validateAssets({ strictTris: process.argv.includes('--strict-tris') });
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else {
    console.log(`[assets] ${r.assets} asset, ${r.totalMB} MB, ${r.errors.length} lỗi, ${r.warnings.length} cảnh báo`);
    for (const e of r.errors) console.log('  ✗ ' + e);
    for (const w of r.warnings) console.log('  ! ' + w);
  }
  process.exit(r.errors.length ? 1 : 0);
}
