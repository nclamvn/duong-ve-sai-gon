#!/usr/bin/env node
/**
 * Profile hình học súng đã convert (hệ chuẩn hoá: nòng −z, lên +y, m) theo lát cắt dọc trục nòng → điền anchor content/weapons/<id>.json (TIP-D10).
 * Dùng: node scripts/weapon-profile.mjs public/assets/weapons/ak47.glb [--step 0.02]
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const file = process.argv[2];
const si = process.argv.indexOf('--step');
const step = si >= 0 ? Number(process.argv[si + 1]) : 0.02;
const doc = await io.read(file);
await doc.transform(dequantize());
const pts = [];
for (const n of doc.getRoot().listNodes()) {
  const m = n.getMesh();
  if (!m) continue;
  const M = n.getWorldMatrix();
  for (const pr of m.listPrimitives()) {
    const a = pr.getAttribute('POSITION');
    const v = [0, 0, 0];
    for (let i = 0; i < a.getCount(); i++) {
      a.getElement(i, v);
      pts.push([M[0] * v[0] + M[4] * v[1] + M[8] * v[2] + M[12], M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13], M[2] * v[0] + M[6] * v[1] + M[10] * v[2] + M[14]]);
    }
  }
}
const buckets = new Map();
for (const [x, y, z] of pts) {
  const k = Math.round(z / step);
  const b = buckets.get(k) ?? { maxY: -1, minY: 1, maxX: -1, minX: 1, n: 0 };
  b.maxY = Math.max(b.maxY, y); b.minY = Math.min(b.minY, y); b.maxX = Math.max(b.maxX, x); b.minX = Math.min(b.minX, x); b.n++;
  buckets.set(k, b);
}
console.log(`${file}: ${pts.length} đỉnh (skin phải đã nướng — nếu chỉ vài lát/gom một chỗ là chưa nướng)`);
console.log('z      maxY    minY    maxX    minX   n');
for (const k of [...buckets.keys()].sort((a, b) => a - b)) {
  const b = buckets.get(k);
  console.log(`${(k * step).toFixed(2).padStart(6)} ${b.maxY.toFixed(3).padStart(7)} ${b.minY.toFixed(3).padStart(7)} ${b.maxX.toFixed(3).padStart(7)} ${b.minX.toFixed(3).padStart(7)} ${b.n}`);
}
