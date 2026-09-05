#!/usr/bin/env node
/**
 * KTX2/Basis cho toàn bộ texture (PRD DVSG PRF-004, ADR-D04, TIP-D02).
 *  - Texture rời `public/assets/textures/<id>/<id>_{diff,nor_gl,arm}_1k.jpg` → `.ktx2` cùng chỗ, xoá .jpg (nguồn còn ở assets-src/).
 *      diff: ETC1S q160 sRGB · arm: ETC1S q128 linear · nor_gl: UASTC (normal preset, RDO λ1) linear · mipmap.
 *  - GLB (`public/assets/{models,weapons,characters}/*.glb`): texture WebP/JPEG/PNG bên trong → KTX2 (KHR_texture_basisu):
 *      normalTexture: UASTC · còn lại ETC1S q160 (baseColor sRGB) / q128 (ORM linear).
 *  - Cập nhật `content/assets/manifest.json` (path/bytes/sha256, totalBytes).
 * Dùng: node scripts/ktx2.mjs [--only textures|models] [--filter <substring>] [--dry] [--keep-src]
 * Encoder: ktx2-encoder (WASM basis_universal) — chậm (UASTC 1k ≈ 20–40 s); chạy nền, log evidence/TIP-D02/ktx2.log.
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync, unlinkSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { encodeToKTX2 } from 'ktx2-encoder';
import { ktx2 } from 'ktx2-encoder/gltf-transform';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const ONLY = opt('only', null);
const FILTER = opt('filter', null);
const DRY = args.includes('--dry');
const KEEP = args.includes('--keep-src');
const MANIFEST = 'content/assets/manifest.json';
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const imageDecoder = async (buf) => {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};
const ETC1S = (q, srgb) => ({ isUASTC: false, generateMipmap: true, qualityLevel: q, compressionLevel: 2, isSetKTX2SRGBTransferFunc: srgb, isPerceptual: srgb, imageDecoder });
const UASTC_NORMAL = { isUASTC: true, generateMipmap: true, isNormalMap: true, isSetKTX2SRGBTransferFunc: false, needSupercompression: true, enableRDO: true, rdoQualityLevel: 1.0, uastcLDRQualityLevel: 1, imageDecoder };

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const byPath = new Map();
for (const a of manifest.assets) for (const f of a.files) byPath.set(f.path, f);
const log = (s) => console.log(`[ktx2] ${s}`);
let saved = 0;
let n = 0;
const t0 = Date.now();

// ---------- texture rời
if (!ONLY || ONLY === 'textures') {
  const dir = 'public/assets/textures';
  for (const id of readdirSync(dir).sort()) {
    if (FILTER && !id.includes(FILTER)) continue;
    const d = join(dir, id);
    if (!statSync(d).isDirectory()) continue;
    for (const f of readdirSync(d).sort()) {
      if (!/\.(jpg|jpeg|png)$/i.test(f)) continue;
      const src = join(d, f);
      const out = src.replace(/\.(jpg|jpeg|png)$/i, '.ktx2');
      const kind = /_nor_gl_/.test(f) ? 'normal' : /_arm_/.test(f) ? 'arm' : 'diff';
      const opts = kind === 'normal' ? UASTC_NORMAL : kind === 'arm' ? ETC1S(128, false) : ETC1S(160, true);
      if (DRY) {
        log(`DRY ${src} → ${out} (${kind})`);
        continue;
      }
      const t = Date.now();
      const data = await encodeToKTX2(new Uint8Array(readFileSync(src)), opts);
      writeFileSync(out, data);
      const before = statSync(src).size;
      const after = data.byteLength;
      saved += before - after;
      n++;
      const rel = src.replace(/^public\//, '');
      const entry = byPath.get(rel);
      if (entry) {
        entry.path = out.replace(/^public\//, '');
        entry.bytes = after;
        entry.sha256 = sha256(out);
      } else log(`  ! ${rel} không có trong manifest`);
      if (!KEEP) unlinkSync(src);
      log(`${rel} → ${basename(out)} ${kind} ${(before / 1024).toFixed(0)}→${(after / 1024).toFixed(0)} KB ${((Date.now() - t) / 1000).toFixed(1)} s`);
    }
  }
}

// ---------- GLB
if (!ONLY || ONLY === 'models') {
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  for (const sub of ['models', 'weapons', 'characters']) {
    const dir = `public/assets/${sub}`;
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).sort()) {
      if (!f.endsWith('.glb')) continue;
      if (FILTER && !f.includes(FILTER)) continue;
      const p = join(dir, f);
      const rel = p.replace(/^public\//, '');
      const doc = await io.read(p);
      const texs = doc.getRoot().listTextures();
      const todo = texs.filter((t) => t.getMimeType() !== 'image/ktx2');
      if (!todo.length) {
        log(`${rel}: đã KTX2`);
        continue;
      }
      if (DRY) {
        log(`DRY ${rel}: ${todo.length} texture`);
        continue;
      }
      const t = Date.now();
      const before = statSync(p).size;
      // normal → UASTC; phần còn lại ETC1S (baseColor sRGB q160, khác q128 linear)
      await doc.transform(
        ktx2({ ...UASTC_NORMAL, slots: /normalTexture/ }),
        ktx2({ ...ETC1S(160, true), slots: /baseColorTexture|emissiveTexture/ }),
        ktx2({ ...ETC1S(128, false), slots: /^(?!normalTexture|baseColorTexture|emissiveTexture)/ }),
      );
      await io.write(p, doc);
      const after = statSync(p).size;
      saved += before - after;
      n++;
      const entry = byPath.get(rel);
      if (entry) {
        entry.bytes = after;
        entry.sha256 = sha256(p);
      }
      log(`${rel}: ${todo.length} texture → KTX2, ${(before / 1048576).toFixed(2)}→${(after / 1048576).toFixed(2)} MB, ${((Date.now() - t) / 1000).toFixed(0)} s`);
    }
  }
}

if (!DRY) {
  manifest.totalBytes = manifest.assets.reduce((s, a) => s + a.files.reduce((x, f) => x + f.bytes, 0), 0);
  manifest.generatedAt = new Date().toISOString();
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
}
log(`xong: ${n} file, tiết kiệm ${(saved / 1048576).toFixed(1)} MB, tổng manifest ${(manifest.totalBytes / 1048576).toFixed(1)} MB, ${((Date.now() - t0) / 60000).toFixed(1)} phút`);
