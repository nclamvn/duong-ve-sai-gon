#!/usr/bin/env node
/**
 * Tải asset CC0 từ Poly Haven (ADR-005) → public/assets/, ghi content/assets/manifest.json (id, nguồn, license, file, bytes, sha256).
 * Chỉ CC0-1.0. Mixamo (TIP-012) KHÔNG đi qua script này — Chủ nhà tải tay, convert-mixamo ghi manifest riêng.
 * Dùng: node scripts/fetch-assets.mjs [--verify]  (--verify: không tải, chỉ kiểm file + hash khớp manifest)
 */
import { mkdirSync, existsSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { optimizeModel, SRC_ROOT } from './optimize-models.mjs';

const API = 'https://api.polyhaven.com';
const OUT = 'public/assets';
const MANIFEST = 'content/assets/manifest.json';

/** Danh sách asset của slice G0.5 (TIP-011). Texture: maps diff/nor_gl/arm 1K. */
const ASSETS = [
  // HDRI đêm cảng (đèn pha, mặt nước) → IBL/phản chiếu
  { id: 'blue_lagoon_night', type: 'hdri', res: '1k', use: 'environment IBL' },
  // Texture PBR
  { id: 'asphalt_02', type: 'texture', res: '1k', use: 'sàn cảng ướt' },
  { id: 'concrete_wall_001', type: 'texture', res: '1k', use: 'tường bê tông, jersey' },
  { id: 'factory_wall', type: 'texture', res: '1k', use: 'tường bao tôn xanh' },
  { id: 'corrugated_iron_02', type: 'texture', res: '1k', use: 'container (tint theo màu)' },
  { id: 'rusty_metal_02', type: 'texture', res: '1k', use: 'rỉ sét overlay' },
  { id: 'rusty_painted_metal', type: 'texture', res: '1k', use: 'thùng phuy' },
  { id: 'plywood', type: 'texture', res: '1k', use: 'pallet/crate gỗ' },
  { id: 'metal_plate', type: 'texture', res: '1k', use: 'súng/viewmodel (TIP-013), sàn kim loại' },
  // Props glTF 1K
  { id: 'wooden_military_crate', type: 'model', res: '1k', use: 'prop crate' },
  { id: 'old_military_crate', type: 'model', res: '1k', use: 'prop crate' },
  { id: 'plastic_crate_01', type: 'model', res: '1k', use: 'prop crate nhựa' },
  { id: 'cardboard_box_01', type: 'model', res: '1k', use: 'prop hộp' },
  { id: 'concrete_road_barrier', type: 'model', res: '1k', use: 'jersey barrier' },
  { id: 'propane_tank', type: 'model', res: '1k', use: 'prop bình gas' },
  { id: 'metal_trash_can', type: 'model', res: '1k', use: 'prop thùng rác' },
  { id: 'utility_box_01', type: 'model', res: '1k', use: 'prop tủ điện' },
  { id: 'portable_generator', type: 'model', res: '1k', use: 'prop máy phát' },
];
const TEXTURE_MAPS = { Diffuse: 'diff', nor_gl: 'nor_gl', arm: 'arm' };

const verifyOnly = process.argv.includes('--verify');

async function getJson(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'hai-tuyen-asset-fetch/1.0 (CC0 assets; contact: nclamvn@gmail.com)' } });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

async function download(url, dest, expectedBytes) {
  if (existsSync(dest) && (expectedBytes === undefined || statSync(dest).size === expectedBytes)) return false;
  mkdirSync(dirname(dest), { recursive: true });
  const r = await fetch(url, { headers: { 'user-agent': 'hai-tuyen-asset-fetch/1.0' } });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  writeFileSync(dest, buf);
  return true;
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

async function fetchAsset(a) {
  const files = [];
  const info = await getJson(`${API}/info/${a.id}`);
  const f = await getJson(`${API}/files/${a.id}`);
  const dir = a.type === 'model' ? join(SRC_ROOT, a.id) : join(OUT, a.type === 'hdri' ? 'hdris' : 'textures', a.id);
  const sourceFiles = [];
  if (a.type === 'hdri') {
    const e = f.hdri[a.res].hdr;
    const dest = join(dir, `${a.id}_${a.res}.hdr`);
    await download(e.url, dest, e.size);
    files.push(dest);
  } else if (a.type === 'texture') {
    for (const [key, suffix] of Object.entries(TEXTURE_MAPS)) {
      const e = f[key]?.[a.res]?.jpg;
      if (!e) {
        console.warn(`[assets] ${a.id}: thiếu map ${key}`);
        continue;
      }
      const dest = join(dir, `${a.id}_${suffix}_${a.res}.jpg`);
      await download(e.url, dest, e.size);
      files.push(dest);
    }
  } else {
    const g = f.gltf[a.res].gltf;
    const dest = join(dir, `${a.id}_${a.res}.gltf`);
    await download(g.url, dest, g.size);
    sourceFiles.push(dest);
    for (const [rel, e] of Object.entries(g.include)) {
      const d = join(dir, rel);
      await download(e.url, d, e.size);
      sourceFiles.push(d);
    }
    // nguồn → glb tối ưu (simplify + meshopt) trong public/
    const r = await optimizeModel(a.id, a.simplify ?? 0.25);
    files.push(r.out);
    a.tris = { before: r.before, after: r.after };
  }
  return {
    id: a.id,
    type: a.type,
    resolution: a.res,
    use: a.use,
    source: 'polyhaven',
    url: `https://polyhaven.com/a/${a.id}`,
    authors: Object.keys(info.authors ?? {}),
    license: 'CC0-1.0',
    files: files.map((p) => ({ path: p.replace(/^public\//, ''), bytes: statSync(p).size, sha256: sha256(p) })),
    ...(sourceFiles.length ? { sourceFiles: sourceFiles.map((p) => ({ path: p, bytes: statSync(p).size, sha256: sha256(p) })), triangles: a.tris } : {}),
  };
}

function verify() {
  const m = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  let bad = 0;
  for (const a of m.assets) {
    for (const f of a.files) {
      const p = join('public', f.path);
      if (!existsSync(p)) {
        console.error(`[assets] thiếu ${p}`);
        bad++;
        continue;
      }
      if (sha256(p) !== f.sha256) {
        console.error(`[assets] hash lệch ${p}`);
        bad++;
      }
    }
  }
  console.log(`[assets] verify: ${m.assets.length} asset, ${bad} lỗi, tổng ${(m.totalBytes / 1048576).toFixed(1)} MB`);
  process.exit(bad ? 1 : 0);
}

if (verifyOnly) verify();
else {
  const assets = [];
  for (const a of ASSETS) {
    process.stdout.write(`[assets] ${a.type} ${a.id} ${a.res} … `);
    const entry = await fetchAsset(a);
    const mb = entry.files.reduce((s, f) => s + f.bytes, 0) / 1048576;
    console.log(`${entry.files.length} file, ${mb.toFixed(2)} MB`);
    assets.push(entry);
  }
  const totalBytes = assets.reduce((s, a) => s + a.files.reduce((t, f) => t + f.bytes, 0), 0);
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    policy: 'ADR-005: chỉ CC0-1.0 qua script này; Mixamo ghi bởi scripts/convert-mixamo.mjs',
    totalBytes,
    assets,
  };
  mkdirSync(dirname(MANIFEST), { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`[assets] ${assets.length} asset, tổng ${(totalBytes / 1048576).toFixed(1)} MB → ${MANIFEST}`);
}
