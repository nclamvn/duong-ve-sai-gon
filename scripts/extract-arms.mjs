#!/usr/bin/env node
/**
 * Cánh tay góc nhìn thứ nhất (TIP-016): lọc tam giác thuộc hai cánh tay + bàn tay (theo trọng số skin) từ soldier.glb
 * → public/assets/characters/soldier_arms.glb (cùng skeleton, không animation, texture ≤ 1K). Manifest: dẫn xuất Mixamo.
 * Dùng: node scripts/extract-arms.mjs [--src public/assets/characters/soldier.glb] [--out public/assets/characters/soldier_arms.glb]
 *       [--min 0.35] [--texture 1024] [--shoulder 1]
 */
import { readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { unweld, weld, dedup, prune, quantize, reorder, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const SRC = opt('src', 'public/assets/characters/soldier.glb');
const OUT = opt('out', 'public/assets/characters/soldier_arms.glb');
const MIN = Number(opt('min', '0.35'));
const TEX = Number(opt('texture', '1024'));
const WITH_SHOULDER = opt('shoulder', '1') !== '0';
const MANIFEST = 'content/assets/manifest.json';
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(SRC);
const root = doc.getRoot();
const skin = root.listSkins()[0];
if (!skin) throw new Error('không có skin');
const joints = skin.listJoints();
const isArmJoint = (name) => {
  const n = name.replace(/^mixamorig:?/i, '');
  if (/^(Left|Right)(Arm|ForeArm|Hand)/.test(n)) return true;
  if (WITH_SHOULDER && /^(Left|Right)Shoulder$/.test(n)) return true;
  return false;
};
const armSet = new Set();
joints.forEach((j, i) => {
  if (isArmJoint(j.getName())) armSet.add(i);
});
console.log(`[arms] joint tay: ${armSet.size}/${joints.length}`);

let kept = 0;
let total = 0;
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const J = prim.getAttribute('JOINTS_0');
    const W = prim.getAttribute('WEIGHTS_0');
    if (!J || !W) continue;
    const jArr = J.getArray();
    const wArr = W.getArray();
    const wNorm = W.getNormalized();
    const wScale = wNorm ? (wArr instanceof Uint8Array ? 1 / 255 : wArr instanceof Uint16Array ? 1 / 65535 : 1) : 1;
    const nV = J.getCount();
    const armW = new Float32Array(nV);
    for (let v = 0; v < nV; v++) {
      let s = 0;
      for (let k = 0; k < 4; k++) if (armSet.has(jArr[v * 4 + k])) s += wArr[v * 4 + k] * wScale;
      armW[v] = s;
    }
    const idxAcc = prim.getIndices();
    const idx = idxAcc ? idxAcc.getArray() : Uint32Array.from({ length: nV }, (_, i) => i);
    const out = [];
    for (let i = 0; i < idx.length; i += 3) {
      total++;
      const a = idx[i], b = idx[i + 1], c = idx[i + 2];
      if (armW[a] >= MIN && armW[b] >= MIN && armW[c] >= MIN) {
        out.push(a, b, c);
        kept++;
      }
    }
    const acc = doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(out)).setBuffer(root.listBuffers()[0]);
    prim.setIndices(acc);
    if (idxAcc) idxAcc.dispose();
  }
}
console.log(`[arms] giữ ${kept}/${total} tam giác`);
for (const a of root.listAnimations()) a.dispose();
await doc.transform(
  unweld(),
  weld(),
  dedup(),
  prune({ keepAttributes: false, keepLeaves: true }),
  textureCompress({ encoder: sharp, targetFormat: 'jpeg', quality: 86, resize: [TEX, TEX] }),
  quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, pattern: /^(?!JOINTS_|WEIGHTS_)/ }),
  reorder({ encoder: MeshoptEncoder }),
);
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: 'quantize' });
mkdirSync(dirname(OUT), { recursive: true });
await io.write(OUT, doc);
const bytes = statSync(OUT).size;
console.log(`[arms] → ${OUT}: ${(bytes / 1048576).toFixed(2)} MB, joints còn ${root.listSkins()[0]?.listJoints().length}`);
if (!OUT.startsWith('public/')) process.exit(0);
const m = JSON.parse(readFileSync(MANIFEST, 'utf8'));
m.assets = m.assets.filter((a) => a.id !== 'soldier_arms');
m.assets.push({
  id: 'soldier_arms',
  type: 'character',
  use: 'cánh tay góc nhìn thứ nhất (TIP-016) — dẫn xuất từ soldier_mixamo bằng scripts/extract-arms.mjs',
  source: 'mixamo',
  url: 'https://www.mixamo.com/',
  authors: ['Adobe Mixamo'],
  license: 'Mixamo',
  files: [{ path: OUT.replace(/^public\//, ''), bytes, sha256: sha256(OUT) }],
  sourceFiles: [{ path: SRC, bytes: statSync(SRC).size, sha256: sha256(SRC) }],
  triangles: { source: total, output: kept },
});
m.totalBytes = m.assets.reduce((s, a) => s + a.files.reduce((t, f) => t + f.bytes, 0), 0);
m.generatedAt = new Date().toISOString();
writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n');
console.log(`[arms] manifest cập nhật: tổng ${(m.totalBytes / 1048576).toFixed(1)} MB`);
