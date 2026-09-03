#!/usr/bin/env node
/**
 * glTF vũ khí (Sketchfab CC-BY, ADR-006) → public/assets/weapons/<id>.glb + manifest (TIP-014).
 * Bước: đọc scene.gltf → phân tích hướng (trục dài nhất = nòng; đầu nhỏ hơn = đầu nòng; tâm khối lệch xuống = dưới)
 *       → root node xoay/scale để nòng −z, lên +y, dài `--length` m, gốc = (tâm x, trục nòng ở đầu nòng, tâm z)
 *       → [simplify] → weld/dedup/prune/quantize → texture WebP (normal near-lossless) → meshopt → .glb
 *       → in bbox từng node (hệ chuẩn hoá) để điền content/weapons/<id>.json → ghi manifest (CC-BY + attribution).
 * Dùng: node scripts/convert-weapon.mjs --src assets-src/sketchfab/ak74m --id weapon_ak74m --out public/assets/weapons/ak74m.glb
 *       --length 0.943 --title "AK-74M Assault Rifle" --author FJH --url https://sketchfab.com/3d-models/... [--license CC-BY-4.0]
 *       [--simplify 0.6] [--texture 2048] [--fwd +x|-x|+y|-y|+z|-z] [--up ...] [--dry]
 */
import { readdirSync, existsSync, mkdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { weld, unweld, simplify, dedup, prune, quantize, reorder, textureCompress, flatten } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const SRC = opt('src', null);
const ID = opt('id', null);
const OUT = opt('out', ID ? `public/assets/weapons/${ID.replace(/^weapon_/, '')}.glb` : null);
const LENGTH = Number(opt('length', '0.9'));
const TITLE = opt('title', ID);
const AUTHOR = opt('author', 'unknown');
const URL = opt('url', 'https://sketchfab.com/');
const LICENSE = opt('license', 'CC-BY-4.0');
const SIMPLIFY = Number(opt('simplify', '1'));
const TEX = Number(opt('texture', '2048'));
const FWD = opt('fwd', null);
const UP = opt('up', null);
const DRY = args.includes('--dry');
const DROP = (opt('drop', '') || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
/** --cut "x>0.045" (hệ chuẩn hoá, m): bỏ tam giác có cả 3 đỉnh thoả điều kiện (prop trang trí dính trong mesh) */
const CUT = (opt('cut', '') || '').split(',').map((s) => s.trim()).filter(Boolean).map((e) => {
  const mm = /^([xyz])\s*([<>])\s*(-?[\d.]+)$/.exec(e);
  if (!mm) throw new Error(`--cut không hợp lệ: ${e}`);
  return { a: 'xyz'.indexOf(mm[1]), gt: mm[2] === '>', v: Number(mm[3]) };
});
const MANIFEST = 'content/assets/manifest.json';
if (!SRC || !ID) {
  console.error('cần --src <thư mục glTF> --id weapon_<slug>');
  process.exit(2);
}

const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const gltfFile = readdirSync(SRC).find((f) => /\.(gltf|glb)$/i.test(f));
if (!gltfFile) {
  console.error(`[weapon] không có .gltf/.glb trong ${SRC}`);
  process.exit(2);
}

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptSimplifier });
const doc = await io.read(join(SRC, gltfFile));
const root = doc.getRoot();
const scene = root.listScenes()[0];
if (DROP.length) {
  const dropped = [];
  scene.traverse((node) => {
    const nm = (node.getName() || node.getMesh()?.getName() || '').toLowerCase();
    if (node.getMesh() && DROP.some((d) => nm.includes(d))) dropped.push(node);
  });
  for (const n of dropped) n.dispose();
  console.log(`[weapon] bỏ node: ${dropped.length} (--drop ${DROP.join(',')})`);
}

// ---- phân tích hình học trong hệ world của file gốc
const mul = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
const pts = [];
const nodeInfo = [];
let triTotal = 0;
scene.traverse((node) => {
  const mesh = node.getMesh();
  if (!mesh) return;
  const m = node.getWorldMatrix();
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  let n = 0;
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const arr = pos.getArray();
    const idx = prim.getIndices();
    triTotal += (idx ? idx.getCount() : pos.getCount()) / 3;
    for (let i = 0; i < arr.length; i += 3) {
      const p = mul(m, arr[i], arr[i + 1], arr[i + 2]);
      pts.push(p);
      for (let k = 0; k < 3; k++) {
        if (p[k] < box[k]) box[k] = p[k];
        if (p[k] > box[k + 3]) box[k + 3] = p[k];
      }
      n++;
    }
  }
  nodeInfo.push({ name: node.getName() || mesh.getName() || '(unnamed)', box, verts: n });
});
const bbox = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
const centroid = [0, 0, 0];
for (const p of pts) {
  for (let k = 0; k < 3; k++) {
    if (p[k] < bbox[k]) bbox[k] = p[k];
    if (p[k] > bbox[k + 3]) bbox[k + 3] = p[k];
    centroid[k] += p[k];
  }
}
for (let k = 0; k < 3; k++) centroid[k] /= pts.length;
const ext = [bbox[3] - bbox[0], bbox[4] - bbox[1], bbox[5] - bbox[2]];
const center = [(bbox[0] + bbox[3]) / 2, (bbox[1] + bbox[4]) / 2, (bbox[2] + bbox[5]) / 2];
const order = [0, 1, 2].sort((a, b) => ext[b] - ext[a]);
const axisName = ['x', 'y', 'z'];
const parseAxis = (s) => {
  if (!s) return null;
  const sign = s.startsWith('-') ? -1 : 1;
  const a = axisName.indexOf(s.replace(/^[+-]/, ''));
  if (a < 0) throw new Error(`trục không hợp lệ: ${s}`);
  return { a, sign };
};
// trục nòng = dài nhất; đầu nòng = đầu có tiết diện (theo trục 2) nhỏ hơn
let fwd = parseAxis(FWD);
if (!fwd) {
  const a = order[0];
  const h = order[1];
  const slice = ext[a] * 0.08;
  const extAt = (lo, hi) => {
    let mn = Infinity;
    let mx = -Infinity;
    for (const p of pts) if (p[a] >= lo && p[a] <= hi) {
      if (p[h] < mn) mn = p[h];
      if (p[h] > mx) mx = p[h];
    }
    return mx - mn;
  };
  const front = extAt(bbox[a + 3] - slice, bbox[a + 3]);
  const back = extAt(bbox[a], bbox[a] + slice);
  fwd = { a, sign: front <= back ? 1 : -1 };
  console.log(`[weapon] trục nòng ${axisName[a]} (dài ${ext[a].toFixed(3)}), tiết diện +:${front.toFixed(3)} −:${back.toFixed(3)} → đầu nòng ${fwd.sign > 0 ? '+' : '-'}${axisName[a]}`);
}
// tâm lát 5% đầu nòng = trục nòng (tham chiếu cho "lên" và gốc)
const muzzleRef = [0, 0, 0];
{
  const a = fwd.a;
  const lim = fwd.sign > 0 ? bbox[a + 3] - ext[a] * 0.05 : bbox[a] + ext[a] * 0.05;
  let n = 0;
  for (const p of pts) if ((fwd.sign > 0 && p[a] >= lim) || (fwd.sign < 0 && p[a] <= lim)) {
    for (let k = 0; k < 3; k++) muzzleRef[k] += p[k];
    n++;
  }
  for (let k = 0; k < 3; k++) muzzleRef[k] = n ? muzzleRef[k] / n : center[k];
}
let up = parseAxis(UP);
if (!up) {
  const h = order[1] === fwd.a ? order[2] : order[1];
  // băng đạn/tay cầm/báng treo dưới trục nòng → tâm khối lệch xuống so với trục nòng → lên = ngược lại
  const d = centroid[h] - muzzleRef[h];
  up = { a: h, sign: d < 0 ? 1 : -1 };
  console.log(`[weapon] trục lên ${up.sign > 0 ? '+' : '-'}${axisName[h]} (tâm khối lệch ${d.toFixed(4)} so với trục nòng)`);
}
if (up.a === fwd.a) throw new Error('trục lên trùng trục nòng — chỉ định --fwd/--up');
const f = [0, 0, 0];
f[fwd.a] = fwd.sign;
const u = [0, 0, 0];
u[up.a] = up.sign;
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const xr = cross(f, u); // phải = nòng × lên
const back = [-f[0], -f[1], -f[2]];
// p' = [xr·p, u·p, back·p] → ma trận xoay R (hàng = trục mới). Root node cần quaternion của R.
const R = [xr, u, back];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const toNew = (p) => [dot(R[0], p), dot(R[1], p), dot(R[2], p)];
const scale = LENGTH / ext[fwd.a];
// gốc: tâm x, trục nòng ở đầu nòng (tâm lát 5% phía trước), tâm z — trong hệ mới, trước scale
const nb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
const newPts = pts.map(toNew);
for (const p of newPts) for (let k = 0; k < 3; k++) {
  if (p[k] < nb[k]) nb[k] = p[k];
  if (p[k] > nb[k + 3]) nb[k + 3] = p[k];
}
const mr = toNew(muzzleRef);
const origin = [mr[0], mr[1], (nb[2] + nb[5]) / 2];
const fmt = (v) => v.map((x) => x.toFixed(3)).join(', ');
console.log(`[weapon] ${gltfFile}: ${Math.round(triTotal)} tri, ${nodeInfo.length} mesh node, bbox gốc [${fmt(ext)}], scale ${scale.toFixed(4)} → dài ${LENGTH} m`);
console.log(`[weapon] bbox chuẩn hoá (m): x [${((nb[0] - origin[0]) * scale).toFixed(3)}, ${((nb[3] - origin[0]) * scale).toFixed(3)}] y [${((nb[1] - origin[1]) * scale).toFixed(3)}, ${((nb[4] - origin[1]) * scale).toFixed(3)}] z [${((nb[2] - origin[2]) * scale).toFixed(3)}, ${((nb[5] - origin[2]) * scale).toFixed(3)}]  (trục nòng = x 0, y 0; đầu nòng ≈ z min)`);
console.log('[weapon] node (bbox chuẩn hoá, m): tên | tâm | kích thước | verts');
for (const n of nodeInfo.sort((a, b) => b.verts - a.verts)) {
  const corners = [];
  for (const x of [n.box[0], n.box[3]]) for (const y of [n.box[1], n.box[4]]) for (const z of [n.box[2], n.box[5]]) corners.push(toNew([x, y, z]));
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const c of corners) for (let k = 0; k < 3; k++) {
    lo[k] = Math.min(lo[k], (c[k] - origin[k]) * scale);
    hi[k] = Math.max(hi[k], (c[k] - origin[k]) * scale);
  }
  console.log(`   ${n.name.padEnd(28)} | ${fmt([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2])} | ${fmt([hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]])} | ${n.verts}`);
}
if (DRY) process.exit(0);

// ---- cắt tam giác theo vùng (hệ chuẩn hoá) trước khi gắn root
if (CUT.length) {
  let removed = 0;
  scene.traverse((node) => {
    const mesh = node.getMesh();
    if (!mesh) return;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION').getArray();
      const idxAcc = prim.getIndices();
      const idx = idxAcc ? idxAcc.getArray() : Uint32Array.from({ length: pos.length / 3 }, (_, i) => i);
      const inCut = (vi) => {
        const q = toNew(mul(m, pos[vi * 3], pos[vi * 3 + 1], pos[vi * 3 + 2]));
        for (let k = 0; k < 3; k++) q[k] = (q[k] - origin[k]) * scale;
        return CUT.every((c) => (c.gt ? q[c.a] > c.v : q[c.a] < c.v));
      };
      const kept = [];
      for (let i = 0; i < idx.length; i += 3) {
        if (inCut(idx[i]) && inCut(idx[i + 1]) && inCut(idx[i + 2])) removed++;
        else kept.push(idx[i], idx[i + 1], idx[i + 2]);
      }
      const acc = doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(kept)).setBuffer(root.listBuffers()[0]);
      prim.setIndices(acc);
      if (idxAcc) idxAcc.dispose();
    }
  });
  console.log(`[weapon] --cut: bỏ ${removed} tam giác`);
}

// ---- root node: xoay R, scale, dịch gốc. Quaternion từ ma trận xoay (hàng = trục mới → cột của R^T)
function quatFromRows(r) {
  // ma trận M (cột-major cho glTF) với M·p = p' → M = R (hàng). m[col][row]
  const m00 = r[0][0], m01 = r[0][1], m02 = r[0][2];
  const m10 = r[1][0], m11 = r[1][1], m12 = r[1][2];
  const m20 = r[2][0], m21 = r[2][1], m22 = r[2][2];
  const tr = m00 + m11 + m22;
  let q;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s];
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
  }
  return q;
}
const rootNode = doc.createNode('weapon_root');
for (const child of scene.listChildren()) {
  scene.removeChild(child);
  rootNode.addChild(child);
}
scene.addChild(rootNode);
rootNode.setRotation(quatFromRows(R));
rootNode.setScale([scale, scale, scale]);
// dịch: p_final = scale·(R p) − scale·origin
rootNode.setTranslation([-origin[0] * scale, -origin[1] * scale, -origin[2] * scale]);
// làm phẳng cây node (giữ tên mesh cho anchor part), rồi tối ưu
const tfs = [flatten(), unweld(), weld()];
if (SIMPLIFY < 1) tfs.push(simplify({ simplifier: MeshoptSimplifier, ratio: SIMPLIFY, error: 0.001, lockBorder: true }));
tfs.push(
  dedup(),
  prune({ keepAttributes: false, keepLeaves: false }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /normalTexture/, quality: 96, nearLossless: true, resize: [TEX, TEX] }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^(?!normalTexture)/, quality: 88, resize: [TEX, TEX] }),
  quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
  reorder({ encoder: MeshoptEncoder }),
);
await doc.transform(...tfs);
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: 'quantize' });
mkdirSync(dirname(OUT), { recursive: true });
await io.write(OUT, doc);
const bytes = statSync(OUT).size;
let triOut = 0;
for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) triOut += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
console.log(`[weapon] → ${OUT}: ${(bytes / 1048576).toFixed(2)} MB, ${Math.round(triOut)} tri, texture ${root.listTextures().length} × ≤${TEX} WebP`);

if (!OUT.startsWith('public/')) {
  console.log('[weapon] --out ngoài public/ → không ghi manifest');
  process.exit(0);
}
const m = JSON.parse(readFileSync(MANIFEST, 'utf8'));
m.assets = m.assets.filter((a) => a.id !== ID);
const srcFiles = readdirSync(SRC).filter((f) => /\.(gltf|glb|bin|txt)$/i.test(f));
m.assets.push({
  id: ID,
  type: 'model',
  use: `vũ khí (TIP-014) — ${TITLE}`,
  source: 'sketchfab',
  url: URL,
  authors: [AUTHOR],
  license: LICENSE,
  attribution: `"${TITLE}" (${URL}) by ${AUTHOR} is licensed under ${LICENSE === 'CC-BY-4.0' ? 'CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)' : LICENSE}`,
  files: [{ path: OUT.replace(/^public\//, ''), bytes, sha256: sha256(OUT) }],
  sourceFiles: srcFiles.map((f) => ({ path: join(SRC, f), bytes: statSync(join(SRC, f)).size, sha256: sha256(join(SRC, f)) })),
  triangles: { source: Math.round(triTotal), output: Math.round(triOut) },
});
m.totalBytes = m.assets.reduce((s, a) => s + a.files.reduce((t, f) => t + f.bytes, 0), 0);
m.generatedAt = new Date().toISOString();
writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n');
console.log(`[weapon] manifest cập nhật: tổng ${(m.totalBytes / 1048576).toFixed(1)} MB`);
