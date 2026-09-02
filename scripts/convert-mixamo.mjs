#!/usr/bin/env node
/**
 * Mixamo FBX → public/assets/characters/soldier.glb (TIP-012, ADR-005).
 * Vào: assets-src/mixamo/<character>.fbx (With Skin) + *.fbx animation (Without Skin, cùng rig).
 * Bước: FBX2glTF từng file → gộp clip vào document nhân vật theo TÊN node (rig Mixamo trùng tên)
 *       → đổi tên clip theo tên file (rifle_idle.fbx → "rifle_idle") → resample/dedup/prune/quantize/meshopt → .glb
 *       → ghi manifest entry (source mixamo, license Mixamo, sha256 nguồn + đích).
 * Dùng: node scripts/convert-mixamo.mjs [--character swat.fbx] [--src assets-src/mixamo] [--out public/assets/characters/soldier.glb]
 *       [--height 1.82]  (--dry: chỉ liệt kê)
 */
import { readdirSync, existsSync, mkdirSync, statSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { resample, dedup, prune, quantize, reorder } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

const require = createRequire(import.meta.url);
const convert = require('fbx2gltf');

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const SRC = opt('src', 'assets-src/mixamo');
const OUT = opt('out', 'public/assets/characters/soldier.glb');
const HEIGHT = Number(opt('height', '1.82'));
const DRY = args.includes('--dry');
const TMP = join(SRC, '_glb');
const MANIFEST = 'content/assets/manifest.json';

function sha256(p) {
  return createHash('sha256').update(readFileSync(p)).digest('hex');
}

const stem = (f) => f.replace(/\.(fbx|glb)$/i, '');
const fbxFiles = existsSync(SRC) ? readdirSync(SRC).filter((f) => /\.(fbx|glb)$/i.test(f)) : [];
if (fbxFiles.length === 0) {
  console.error(`[mixamo] không có .fbx trong ${SRC} — Chủ nhà tải theo docs/tips/TIP-012.md`);
  process.exit(2);
}
// nhân vật: --character hoặc file lớn nhất (có skin + texture)
let charFile = opt('character', null);
if (!charFile) charFile = fbxFiles.map((f) => ({ f, s: statSync(join(SRC, f)).size })).sort((a, b) => b.s - a.s)[0].f;
const animFiles = fbxFiles.filter((f) => f !== charFile);
console.log(`[mixamo] nhân vật: ${charFile} · ${animFiles.length} animation: ${animFiles.map((f) => stem(f)).join(', ')}`);
if (DRY) process.exit(0);

mkdirSync(TMP, { recursive: true });
async function fbxToGlb(f) {
  if (/\.glb$/i.test(f)) return join(SRC, f); // đã là glTF (CC0 hoặc test) → dùng thẳng
  const out = join(TMP, `${stem(f)}.glb`);
  if (existsSync(out) && statSync(out).mtimeMs > statSync(join(SRC, f)).mtimeMs) return out;
  process.stdout.write(`[mixamo] FBX2glTF ${f} … `);
  await convert(join(SRC, f), out, []);
  console.log('ok');
  return out;
}

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const charGlb = await fbxToGlb(charFile);
const doc = await io.read(charGlb);
const root = doc.getRoot();
// bỏ clip có sẵn trong file nhân vật (Mixamo T-pose thường không có; nếu có → giữ tên file)
for (const a of root.listAnimations()) a.dispose(); // clip trong file nhân vật (T-pose/Idle mẫu) bỏ — clip thật đến từ file animation
const nodeByName = new Map(root.listNodes().map((n) => [n.getName(), n]));

/** Sao chép accessor sang doc đích. */
function copyAccessor(src) {
  const a = doc.createAccessor(src.getName()).setType(src.getType()).setArray(src.getArray().slice()).setNormalized(src.getNormalized());
  return a;
}

let copied = 0;
let missing = 0;
for (const f of animFiles) {
  const glb = await fbxToGlb(f);
  const adoc = await io.read(glb);
  const clipName = stem(f).toLowerCase().replace(/[^a-z0-9]+/g, '_');
  for (const anim of adoc.getRoot().listAnimations()) {
    const dst = doc.createAnimation(clipName);
    const samplerMap = new Map();
    for (const ch of anim.listChannels()) {
      const targetNode = ch.getTargetNode();
      if (!targetNode) continue;
      const local = nodeByName.get(targetNode.getName());
      if (!local) {
        missing++;
        continue;
      }
      const s = ch.getSampler();
      let ds = samplerMap.get(s);
      if (!ds) {
        ds = doc.createAnimationSampler().setInput(copyAccessor(s.getInput())).setOutput(copyAccessor(s.getOutput())).setInterpolation(s.getInterpolation());
        samplerMap.set(s, ds);
        dst.addSampler(ds);
      }
      dst.addChannel(doc.createAnimationChannel().setTargetNode(local).setTargetPath(ch.getTargetPath()).setSampler(ds));
      copied++;
    }
    // Mixamo "In Place" đã tick → root motion bằng 0; nếu không, khoá translation Hips theo XZ để không trôi
    break; // mỗi file 1 clip
  }
}
console.log(`[mixamo] gộp ${animFiles.length} clip, ${copied} channel, ${missing} channel không khớp node`);

// chuẩn hoá chiều cao: scale node gốc (Mixamo cm → m)
const bbox = (() => {
  // ước lượng qua accessor POSITION lớn nhất
  let maxY = -Infinity;
  let minY = Infinity;
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    if (!pos) continue;
    const mn = pos.getMin([]);
    const mx = pos.getMax([]);
    minY = Math.min(minY, mn[1]);
    maxY = Math.max(maxY, mx[1]);
  }
  return { minY, maxY };
})();
const h = bbox.maxY - bbox.minY;
console.log(`[mixamo] chiều cao mesh gốc ${h.toFixed(3)} (đơn vị file) → runtime scale ${(HEIGHT / h).toFixed(4)} (loader tự chuẩn hoá về ${HEIGHT} m)`);

await doc.transform(
  resample(),
  dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE] }), // KHÔNG gộp material (visor/body cùng tham số khác tên)
  prune({ keepAttributes: false, keepLeaves: true }),
  quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, pattern: /^(?!JOINTS_|WEIGHTS_)/ }),
  reorder({ encoder: MeshoptEncoder }),
);
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: 'quantize' });
mkdirSync(dirname(OUT), { recursive: true });
await io.write(OUT, doc);
const bytes = statSync(OUT).size;
console.log(`[mixamo] → ${OUT} (${(bytes / 1048576).toFixed(2)} MB), clip: ${root.listAnimations().map((a) => a.getName()).join(', ')}`);

// manifest: thay/thêm entry character (chỉ khi xuất vào public/)
if (!OUT.startsWith('public/')) {
  console.log('[mixamo] --out ngoài public/ → không ghi manifest (chế độ test)');
  rmSync(TMP, { recursive: true, force: true });
  process.exit(0);
}
const m = JSON.parse(readFileSync(MANIFEST, 'utf8'));
m.assets = m.assets.filter((a) => a.id !== 'soldier_mixamo');
m.assets.push({
  id: 'soldier_mixamo',
  type: 'character',
  use: 'lính (dummy + bot) — mesh + animation Mixamo, Chủ nhà tải, convert bằng scripts/convert-mixamo.mjs',
  source: 'mixamo',
  url: 'https://www.mixamo.com/',
  authors: ['Adobe Mixamo'],
  license: 'Mixamo',
  files: [{ path: OUT.replace(/^public\//, ''), bytes, sha256: sha256(OUT) }],
  sourceFiles: fbxFiles.map((f) => ({ path: join(SRC, f), bytes: statSync(join(SRC, f)).size, sha256: sha256(join(SRC, f)) })),
});
m.totalBytes = m.assets.reduce((s, a) => s + a.files.reduce((t, f) => t + f.bytes, 0), 0);
m.generatedAt = new Date().toISOString();
writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n');
console.log(`[mixamo] manifest cập nhật: tổng ${(m.totalBytes / 1048576).toFixed(1)} MB`);
rmSync(TMP, { recursive: true, force: true });
