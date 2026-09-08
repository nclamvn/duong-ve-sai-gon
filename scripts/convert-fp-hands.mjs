#!/usr/bin/env node
/**
 * Tay góc nhìn thứ nhất (TIP-D11b): David Fischer "First Person hands rigged" (Sketchfab CC-BY-4.0)
 * → public/assets/characters/fp_hands.glb (rigged, 63 joint, không texture — vật liệu da trong engine).
 * Làm ở tầng glTF (gltf-transform) để KHÔNG vỡ bind mesh/skeleton như re-export Blender:
 *   - bỏ rác (Icosphere + mesh kim nhỏ) + node trỏ nó;
 *   - vá rig: reparent forearm.{R,L}.001 (chuỗi bàn tay treo ở root) về dưới forearm.{R,L} (xương biến dạng cẳng tay)
 *     giữ nguyên world transform → cẳng tay + bàn tay thành MỘT chuỗi (xoay khuỷu kéo cả bàn tay);
 *   - prune(keepLeaves) giữ xương đầu ngón, quantize chừa JOINTS_/WEIGHTS_, meshopt.
 * Không chuẩn hoá mét ở đây — viewmodel trong game co theo scale group (fp bbox in ra để lấy hệ số).
 * Ghi manifest (CC-BY + attribution David Fischer + sha256), registry uniforms, CREDITS.
 * Dùng: node scripts/convert-fp-hands.mjs [--src ...] [--out public/assets/characters/fp_hands.glb] [--dry]
 */
import { readFileSync, writeFileSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, quantize, reorder } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

// --- minimal column-major mat4 helpers (glTF convention) ---
const M = {
  mul(a, b) { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
  invert(m) {
    const a = m, o = new Array(16);
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11,
      b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30,
      b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    det = 1.0 / det;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return o;
  },
  decompose(m) {
    const t = [m[12], m[13], m[14]];
    let sx = Math.hypot(m[0], m[1], m[2]), sy = Math.hypot(m[4], m[5], m[6]), sz = Math.hypot(m[8], m[9], m[10]);
    const det = m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]);
    if (det < 0) sx = -sx;
    const r = [m[0] / sx, m[1] / sx, m[2] / sx, m[4] / sy, m[5] / sy, m[6] / sy, m[8] / sz, m[9] / sz, m[10] / sz];
    const tr = r[0] + r[4] + r[8]; let q;
    if (tr > 0) { const S = Math.sqrt(tr + 1) * 2; q = [(r[5] - r[7]) / S, (r[6] - r[2]) / S, (r[1] - r[3]) / S, 0.25 * S]; }
    else if (r[0] > r[4] && r[0] > r[8]) { const S = Math.sqrt(1 + r[0] - r[4] - r[8]) * 2; q = [0.25 * S, (r[3] + r[1]) / S, (r[6] + r[2]) / S, (r[5] - r[7]) / S]; }
    else if (r[4] > r[8]) { const S = Math.sqrt(1 + r[4] - r[0] - r[8]) * 2; q = [(r[3] + r[1]) / S, 0.25 * S, (r[7] + r[5]) / S, (r[6] - r[2]) / S]; }
    else { const S = Math.sqrt(1 + r[8] - r[0] - r[4]) * 2; q = [(r[6] + r[2]) / S, (r[7] + r[5]) / S, 0.25 * S, (r[1] - r[3]) / S]; }
    return { t, r: q, s: [sx, sy, sz] };
  },
};

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const SRC = opt('src', 'assets-src/sketchfab/fp-hands-davidfischer/fp_hands.glb');
const OUT = opt('out', 'public/assets/characters/fp_hands.glb');
const DRY = args.includes('--dry');
const MANIFEST = 'content/assets/manifest.json';
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(SRC);
const root = doc.getRoot();

// --- world matrix helper (walk parents) ---
function parentOf(node) {
  for (const n of root.listNodes()) if (n.listChildren().includes(node)) return n;
  for (const s of root.listScenes()) if (s.listChildren().includes(node)) return null; // scene root
  return null;
}
function worldMatrix(node) {
  let m = [...node.getMatrix()];
  let p = parentOf(node);
  while (p) { m = M.mul([...p.getMatrix()], m); p = parentOf(p); }
  return m;
}

// --- 1) drop junk meshes (< 1000 verts) + detach their nodes ---
let dropped = 0;
for (const mesh of root.listMeshes()) {
  let verts = 0;
  for (const prim of mesh.listPrimitives()) verts = Math.max(verts, prim.getAttribute('POSITION')?.getCount() ?? 0);
  if (verts < 1000) {
    for (const node of root.listNodes()) if (node.getMesh() === mesh) node.setMesh(null);
    mesh.dispose(); dropped++;
  }
}
console.log(`[fp] bỏ ${dropped} mesh rác (Icosphere + kim)`);

// --- 2) repair rig: reparent forearm.*.001 → forearm.* keeping world transform ---
const nodeByPrefix = (pre) => root.listNodes().find((n) => n.getName().startsWith(pre));
for (const side of ['R', 'L']) {
  const child = nodeByPrefix(`forearm.${side}.001`);
  const newParent = nodeByPrefix(`forearm.${side}_0`);
  if (!child || !newParent) { console.log(`[fp] cảnh báo: thiếu forearm.${side}.001/forearm.${side}_0`); continue; }
  const world = worldMatrix(child);
  const oldParent = parentOf(child);
  // local = inv(newParent.world) * child.world
  const npWorld = worldMatrix(newParent);
  const local = M.mul(M.invert(npWorld), world);
  if (oldParent) oldParent.removeChild(child); else for (const s of root.listScenes()) s.removeChild(child);
  newParent.addChild(child);
  const { t, r, s } = M.decompose(local);
  child.setTranslation(t); child.setRotation(r); child.setScale(s);
  console.log(`[fp] vá rig: forearm.${side}.001 → forearm.${side}_0`);
}

// --- report bbox + tris (for in-game scale factor) ---
let mn = [1e18, 1e18, 1e18], mx = [-1e18, -1e18, -1e18], tris = 0;
for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
  const a = prim.getAttribute('POSITION').getArray();
  for (let i = 0; i < a.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], a[i + k]); mx[k] = Math.max(mx[k], a[i + k]); }
  const idx = prim.getIndices(); tris += idx ? idx.getCount() / 3 : prim.getAttribute('POSITION').getCount() / 3;
}
const size = mx.map((v, i) => v - mn[i]);
console.log(`[fp] bbox nguồn size=(${size.map((v) => v.toFixed(1)).join(',')}) center=(${mx.map((v, i) => ((v + mn[i]) / 2).toFixed(1)).join(',')}) tris=${Math.round(tris)}`);
console.log(`[fp] joints=${root.listSkins()[0]?.listJoints().length} anims=${root.listAnimations().length}`);

// --- 3) optimize (skin-safe) ---
await doc.transform(
  dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH] }),
  prune({ keepAttributes: false, keepLeaves: true }),
  quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, pattern: /^(?!JOINTS_|WEIGHTS_)/ }),
  reorder({ encoder: MeshoptEncoder }),
);
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: 'quantize' });

if (DRY) { console.log('[fp] --dry: không ghi'); process.exit(0); }
mkdirSync(dirname(OUT), { recursive: true });
await io.write(OUT, doc);
const bytes = statSync(OUT).size;
console.log(`[fp] → ${OUT} (${(bytes / 1024).toFixed(0)} KB)`);

// --- 4) manifest ---
const m = JSON.parse(readFileSync(MANIFEST, 'utf8'));
m.assets = m.assets.filter((a) => a.id !== 'fp_hands');
m.assets.push({
  id: 'fp_hands',
  type: 'character',
  use: 'tay góc nhìn thứ nhất người chơi (TIP-D11b) — rig 63 joint đủ đốt ngón, pose nắm súng authored + clip idle/aim/reload trong game; thay tay Mixamo cũ (soldier_arms)',
  source: 'sketchfab',
  url: 'https://sketchfab.com/3d-models/first-person-hands-rigged-547a45535f0c4fe787948f7a7a6a88db',
  authors: ['David Fischer (davidfischer)'],
  license: 'CC-BY-4.0',
  attribution: '"First Person hands rigged" (https://sketchfab.com/3d-models/first-person-hands-rigged-547a45535f0c4fe787948f7a7a6a88db) by David Fischer (davidfischer) is licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)',
  files: [{ path: OUT.replace(/^public\//, ''), bytes, sha256: sha256(OUT) }],
  sourceFiles: [{ path: SRC, bytes: statSync(SRC).size, sha256: sha256(SRC) }],
  triangles: { output: Math.round(tris) },
});
m.totalBytes = m.assets.reduce((s, a) => s + a.files.reduce((t, f) => t + f.bytes, 0), 0);
m.generatedAt = new Date().toISOString();
writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n');
console.log(`[fp] manifest cập nhật (tổng ${(m.totalBytes / 1048576).toFixed(1)} MB)`);
