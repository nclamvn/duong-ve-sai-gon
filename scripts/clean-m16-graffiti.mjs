#!/usr/bin/env node
/**
 * DV-070: strip the graffiti from the shipped M16A1 glb in place (the Sketchfab source is not kept locally).
 * KTX2 (ETC1S) albedos 0 and 3 → RGBA via three's Basis transcoder (WASM, run in Node) → scripts/clean-m16-graffiti.py →
 * re-encoded ETC1S q160 sRGB with mipmaps (same settings as scripts/ktx2.mjs) → glb rewritten, manifest updated.
 * Use: node scripts/clean-m16-graffiti.mjs [--glb public/assets/weapons/m16a1.glb]
 */
import { readFileSync, writeFileSync, mkdtempSync, copyFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { encodeToKTX2 } from 'ktx2-encoder';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const args = process.argv.slice(2);
const i = args.indexOf('--glb');
const GLB = i >= 0 ? args[i + 1] : 'public/assets/weapons/m16a1.glb';
const TARGETS = [0, 3];
const dir = mkdtempSync(join(tmpdir(), 'm16-'));
// three ships the transcoder as UMD in an ESM package: load a .cjs copy
copyFileSync('node_modules/three/examples/jsm/libs/basis/basis_transcoder.js', join(dir, 'basis.cjs'));
const BASIS = createRequire(import.meta.url)(join(dir, 'basis.cjs'));
const B = await BASIS({ wasmBinary: readFileSync('node_modules/three/examples/jsm/libs/basis/basis_transcoder.wasm') });
B.initializeBasis();

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(GLB);
const tex = doc.getRoot().listTextures();
for (const t of TARGETS) {
  const f = new B.KTX2File(new Uint8Array(tex[t].getImage()));
  const w = f.getWidth();
  const h = f.getHeight();
  f.startTranscoding();
  const dst = new Uint8Array(f.getImageTranscodedSizeInBytes(0, 0, 0, 13));
  f.transcodeImage(dst, 0, 0, 0, 13, 0, -1, -1); // 13 = RGBA32
  f.close();
  f.delete();
  await sharp(Buffer.from(dst), { raw: { width: w, height: h, channels: 4 } }).png().toFile(join(dir, `tex${t}.png`));
}
execFileSync('python3', ['scripts/clean-m16-graffiti.py', dir], { stdio: 'inherit' });
const imageDecoder = async (buf) => {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};
for (const t of TARGETS) {
  const png = readFileSync(join(dir, `tex${t}_clean.png`));
  const k = await encodeToKTX2(new Uint8Array(png), { isUASTC: false, generateMipmap: true, qualityLevel: 160, compressionLevel: 2, isSetKTX2SRGBTransferFunc: true, isPerceptual: true, imageDecoder });
  tex[t].setImage(k);
}
await io.write(GLB, doc);
const m = JSON.parse(readFileSync('content/assets/manifest.json', 'utf8'));
const rel = GLB.replace(/^public\//, '');
for (const a of m.assets) for (const fe of a.files) if (fe.path === rel) Object.assign(fe, { bytes: statSync(GLB).size, sha256: createHash('sha256').update(readFileSync(GLB)).digest('hex') });
m.totalBytes = m.assets.reduce((s, a) => s + a.files.reduce((u, f) => u + f.bytes, 0), 0);
writeFileSync('content/assets/manifest.json', JSON.stringify(m, null, 2) + '\n');
console.log(`[m16] ${GLB}: textures ${TARGETS.join(',')} cleaned (${(statSync(GLB).size / 1048576).toFixed(2)} MB)`);
