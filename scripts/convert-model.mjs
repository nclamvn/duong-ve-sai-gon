#!/usr/bin/env node
/**
 * Model prop/xe (Sketchfab CC-BY, D-060) → public/assets/models/<id>.glb + manifest (TIP-021).
 * Chuẩn hoá: trục dài nhất (ngang) → +x, lên +y, đáy chạm y=0, tâm xz = 0, scale theo --length (m) hoặc --scale.
 * Tối ưu: [--keep/--drop node] → dedup/prune → [simplify] → texture WebP ≤ --texture → quantize → meshopt.
 * Mặc định flatten + join primitive cùng material (1 draw/material khi instanced); `--no-join` giữ cây node để node có tên
 * (cánh quạt, bánh) còn pivot xoay được lúc chạy (trực thăng TIP-023).
 * Dùng: node scripts/convert-model.mjs --src assets-src/sketchfab/btr70 --id veh_btr70 --length 7.3 \
 *         --title "Low-poly BTR-70" --author veightyfive --url https://sketchfab.com/3d-models/... --use "xác APC chốt A"
 *       [--scale 0.01] [--flip] [--yaw90] [--no-align] [--no-join] [--merge-mats] [--basecolor hex --rough r --metal m] [--keep sub,sub] [--drop sub,sub] [--simplify 0.6] [--texture 1024] [--dry]
 */
import { readdirSync, mkdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join as pjoin, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { simplify, dedup, prune, quantize, reorder, textureCompress, weld, flatten, join } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const SRC = opt('src', null);
const ID = opt('id', null);
const OUT = opt('out', ID ? `public/assets/models/${ID}.glb` : null);
const LENGTH = opt('length', null) ? Number(opt('length')) : null;
const SCALE = opt('scale', null) ? Number(opt('scale')) : null;
const TITLE = opt('title', ID);
const AUTHOR = opt('author', 'unknown');
const URL = opt('url', 'https://sketchfab.com/');
const LICENSE = opt('license', 'CC-BY-4.0');
const USE = opt('use', 'prop level (TIP-021)');
const SIMPLIFY = Number(opt('simplify', '1'));
const TEX = Number(opt('texture', '1024'));
const FLIP = args.includes('--flip');
const YAW90 = args.includes('--yaw90');
const NOALIGN = args.includes('--no-align');
/** --no-join: giữ node riêng (cánh quạt/bánh xe cần pivot xoay lúc chạy); mặc định flatten + join primitive cùng material → ít draw */
const NOJOIN = args.includes('--no-join');
const DRY = args.includes('--dry');
const KEEP = (opt('keep', '') || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const DROP = (opt('drop', '') || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const MANIFEST = 'content/assets/manifest.json';
if (!SRC || !ID) {
  console.error('cần --src <thư mục glTF> --id <id>');
  process.exit(2);
}
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const gltfFile = readdirSync(SRC).find((f) => /\.(gltf|glb)$/i.test(f));
if (!gltfFile) {
  console.error(`[model] không có .gltf/.glb trong ${SRC}`);
  process.exit(2);
}

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptSimplifier });
const doc = await io.read(pjoin(SRC, gltfFile));
const root = doc.getRoot();
const scene = root.listScenes()[0];

// ---- lọc node
if (KEEP.length || DROP.length) {
  const gone = [];
  scene.traverse((node) => {
    if (!node.getMesh()) return;
    const nm = (node.getName() || node.getMesh().getName() || '').toLowerCase();
    const keep = KEEP.length ? KEEP.some((k) => nm.includes(k)) : true;
    const drop = DROP.some((d) => nm.includes(d));
    if (!keep || drop) gone.push(node);
  });
  for (const n of gone) n.dispose();
  console.log(`[model] bỏ node: ${gone.length} (keep=${KEEP.join(',') || '*'} drop=${DROP.join(',') || '-'})`);
}

// ---- nướng skin (xe buýt Sketchfab có skin tầm thường: mỗi mesh buộc 1 joint) → vị trí = Σ w·(J·IBM)·p, bỏ JOINTS/WEIGHTS,
// node về gốc scene với ma trận đơn vị (glTF: mesh có skin bỏ qua transform node của chính nó)
{
  const mat4mul = (a, b) => {
    const o = new Array(16).fill(0);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
    return o;
  };
  const skinned = [];
  scene.traverse((node) => {
    if (node.getSkin() && node.getMesh()) skinned.push(node);
  });
  for (const node of skinned) {
    const skin = node.getSkin();
    const joints = skin.listJoints();
    const ibm = skin.getInverseBindMatrices()?.getArray();
    const jm = joints.map((j, i) => {
      const w = j.getWorldMatrix();
      if (!ibm) return w;
      return mat4mul(w, Array.from(ibm.slice(i * 16, i * 16 + 16)));
    });
    for (const prim of node.getMesh().listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const nor = prim.getAttribute('NORMAL');
      const jnt = prim.getAttribute('JOINTS_0');
      const wgt = prim.getAttribute('WEIGHTS_0');
      if (!pos || !jnt || !wgt) continue;
      const pa = pos.getArray();
      const na = nor?.getArray();
      const ja = jnt.getArray();
      const wa = wgt.getArray();
      const outP = new Float32Array(pa.length);
      const outN = na ? new Float32Array(na.length) : null;
      const n = pos.getCount();
      for (let v = 0; v < n; v++) {
        const px = pa[v * 3], py = pa[v * 3 + 1], pz = pa[v * 3 + 2];
        let x = 0, y = 0, z = 0, nx = 0, ny = 0, nz = 0;
        for (let k = 0; k < 4; k++) {
          const w = wa[v * 4 + k];
          if (!w) continue;
          const m = jm[ja[v * 4 + k]];
          if (!m) continue;
          x += w * (m[0] * px + m[4] * py + m[8] * pz + m[12]);
          y += w * (m[1] * px + m[5] * py + m[9] * pz + m[13]);
          z += w * (m[2] * px + m[6] * py + m[10] * pz + m[14]);
          if (na) {
            const qx = na[v * 3], qy = na[v * 3 + 1], qz = na[v * 3 + 2];
            nx += w * (m[0] * qx + m[4] * qy + m[8] * qz);
            ny += w * (m[1] * qx + m[5] * qy + m[9] * qz);
            nz += w * (m[2] * qx + m[6] * qy + m[10] * qz);
          }
        }
        outP[v * 3] = x;
        outP[v * 3 + 1] = y;
        outP[v * 3 + 2] = z;
        if (outN) {
          const l = Math.hypot(nx, ny, nz) || 1;
          outN[v * 3] = nx / l;
          outN[v * 3 + 1] = ny / l;
          outN[v * 3 + 2] = nz / l;
        }
      }
      pos.setArray(outP);
      if (nor && outN) nor.setArray(outN);
      prim.setAttribute('JOINTS_0', null);
      prim.setAttribute('WEIGHTS_0', null);
      const tan = prim.getAttribute('TANGENT');
      if (tan) prim.setAttribute('TANGENT', null);
    }
    node.setSkin(null);
    const parent = node.getParentNode();
    if (parent) parent.removeChild(node);
    scene.addChild(node);
    node.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }
  if (skinned.length) console.log(`[model] nướng skin: ${skinned.length} node`);
}

// ---- bbox world của file gốc
const mul = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
const bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
let triTotal = 0;
const nodeInfo = [];
scene.traverse((node) => {
  const mesh = node.getMesh();
  if (!mesh) return;
  const m = node.getWorldMatrix();
  const nb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  let nt = 0;
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const arr = pos.getArray();
    const idx = prim.getIndices();
    nt += (idx ? idx.getCount() : pos.getCount()) / 3;
    for (let i = 0; i < arr.length; i += 3) {
      const p = mul(m, arr[i], arr[i + 1], arr[i + 2]);
      for (let k = 0; k < 3; k++) {
        if (p[k] < nb[k]) nb[k] = p[k];
        if (p[k] > nb[k + 3]) nb[k + 3] = p[k];
      }
    }
  }
  for (let k = 0; k < 3; k++) {
    if (nb[k] < bb[k]) bb[k] = nb[k];
    if (nb[k + 3] > bb[k + 3]) bb[k + 3] = nb[k + 3];
  }
  triTotal += nt;
  nodeInfo.push({ name: node.getName() || mesh.getName() || '(unnamed)', tris: Math.round(nt), box: nb });
});
const ext = [bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]];
// xoay quanh y: trục ngang dài nhất → x
let yaw = 0;
if (!NOALIGN && ext[2] > ext[0]) yaw = Math.PI / 2;
if (YAW90) yaw += Math.PI / 2;
if (FLIP) yaw += Math.PI;
const cy = Math.cos(yaw);
const sy = Math.sin(yaw);
// p' = Ry(yaw)·p: x' = c·x + s·z ; z' = −s·x + c·z
const rot = (p) => [cy * p[0] + sy * p[2], p[1], -sy * p[0] + cy * p[2]];
const rb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
for (const x of [bb[0], bb[3]]) for (const y of [bb[1], bb[4]]) for (const z of [bb[2], bb[5]]) {
  const p = rot([x, y, z]);
  for (let k = 0; k < 3; k++) {
    if (p[k] < rb[k]) rb[k] = p[k];
    if (p[k] > rb[k + 3]) rb[k + 3] = p[k];
  }
}
const rext = [rb[3] - rb[0], rb[4] - rb[1], rb[5] - rb[2]];
const scale = SCALE ?? (LENGTH ? LENGTH / rext[0] : 1);
const size = rext.map((v) => v * scale);
const origin = [(rb[0] + rb[3]) / 2, rb[1], (rb[2] + rb[5]) / 2];
const fmt = (v) => v.map((x) => x.toFixed(3)).join(', ');
console.log(`[model] ${gltfFile}: ${Math.round(triTotal)} tri, ${nodeInfo.length} mesh node, bbox gốc [${fmt(ext)}], yaw ${((yaw * 180) / Math.PI).toFixed(0)}°, scale ${scale.toFixed(5)}`);
console.log(`[model] kích thước chuẩn hoá (m): dài x ${size[0].toFixed(2)} × cao y ${size[1].toFixed(2)} × rộng z ${size[2].toFixed(2)} — đáy y=0, tâm xz=0`);
for (const n of nodeInfo.sort((a, b) => b.tris - a.tris).slice(0, 14)) {
  const c = rot([(n.box[0] + n.box[3]) / 2, (n.box[1] + n.box[4]) / 2, (n.box[2] + n.box[5]) / 2]);
  console.log(`   ${n.name.padEnd(36)} | tâm ${fmt([(c[0] - origin[0]) * scale, (c[1] - origin[1]) * scale, (c[2] - origin[2]) * scale])} | ${n.tris} tri`);
}
if (DRY) process.exit(0);

// ---- root node: xoay yaw, scale, dịch gốc — p_final = scale·(Ry p − origin)
const rootNode = doc.createNode('model_root');
for (const child of scene.listChildren()) {
  scene.removeChild(child);
  rootNode.addChild(child);
}
scene.addChild(rootNode);
rootNode.setRotation([0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)]);
rootNode.setScale([scale, scale, scale]);
rootNode.setTranslation([-origin[0] * scale, -origin[1] * scale, -origin[2] * scale]);

// ghi đè material (model không có texture màu: bao cát Pypunk = trắng kim loại) — --basecolor 0x8b7a55 --rough 0.95 --metal 0
{
  const bc = opt('basecolor', null);
  const rg = opt('rough', null);
  const mt = opt('metal', null);
  if (bc || rg || mt) {
    for (const mat of root.listMaterials()) {
      if (bc) {
        const v = parseInt(bc, 16);
        const srgb = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
        mat.setBaseColorFactor([srgb(((v >> 16) & 255) / 255), srgb(((v >> 8) & 255) / 255), srgb((v & 255) / 255), 1]);
      }
      if (rg) mat.setRoughnessFactor(Number(rg));
      if (mt) mat.setMetallicFactor(Number(mt));
    }
    console.log(`[model] material: basecolor=${bc ?? '-'} rough=${rg ?? '-'} metal=${mt ?? '-'} (${root.listMaterials().length} material)`);
  }
}
// gộp material trùng tên (Door_0..Door_4 = bản sao của Door) → join được → ít draw
if (args.includes('--merge-mats')) {
  const byBase = new Map();
  let merged = 0;
  for (const mat of root.listMaterials()) {
    const base = (mat.getName() || '').replace(/_\d+$/, '');
    const first = byBase.get(base);
    if (!first) {
      byBase.set(base, mat);
      continue;
    }
    for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) if (prim.getMaterial() === mat) prim.setMaterial(first);
    mat.dispose();
    merged++;
  }
  console.log(`[model] --merge-mats: gộp ${merged} material trùng tên`);
}
const tfs = [dedup(), prune({ keepAttributes: false, keepLeaves: false })];
if (!NOJOIN) tfs.push(flatten(), join({ keepNamed: false }), prune({ keepAttributes: false, keepLeaves: false }));
if (SIMPLIFY < 1) tfs.push(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: SIMPLIFY, error: 0.001, lockBorder: true }));
tfs.push(
  textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /normalTexture/, quality: 96, nearLossless: true, resize: [TEX, TEX] }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^(?!normalTexture)/, quality: 86, resize: [TEX, TEX] }),
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
let prims = 0;
for (const mesh of root.listMeshes()) prims += mesh.listPrimitives().length;
console.log(`[model] → ${OUT}: ${(bytes / 1048576).toFixed(2)} MB, ${Math.round(triOut)} tri, ${prims} primitive, texture ${root.listTextures().length} × ≤${TEX} WebP`);

if (!OUT.startsWith('public/')) {
  console.log('[model] --out ngoài public/ → không ghi manifest');
  process.exit(0);
}
const m = JSON.parse(readFileSync(MANIFEST, 'utf8'));
m.assets = m.assets.filter((a) => a.id !== ID);
const srcFiles = readdirSync(SRC).filter((f) => /\.(gltf|glb|bin|txt)$/i.test(f));
m.assets.push({
  id: ID,
  type: 'model',
  use: `${USE} — ${TITLE}`,
  source: 'sketchfab',
  url: URL,
  authors: [AUTHOR],
  license: LICENSE,
  attribution: `"${TITLE}" (${URL}) by ${AUTHOR} is licensed under ${LICENSE === 'CC-BY-4.0' ? 'CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)' : LICENSE}`,
  files: [{ path: OUT.replace(/^public\//, ''), bytes, sha256: sha256(OUT) }],
  sourceFiles: srcFiles.map((f) => ({ path: pjoin(SRC, f), bytes: statSync(pjoin(SRC, f)).size, sha256: sha256(pjoin(SRC, f)) })),
  triangles: { source: Math.round(triTotal), output: Math.round(triOut) },
  size: size.map((v) => Number(v.toFixed(3))),
});
m.totalBytes = m.assets.reduce((s, a) => s + a.files.reduce((t, f) => t + f.bytes, 0), 0);
m.generatedAt = new Date().toISOString();
writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n');
console.log(`[model] manifest cập nhật: tổng ${(m.totalBytes / 1048576).toFixed(1)} MB`);
