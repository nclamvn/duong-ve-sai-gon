#!/usr/bin/env node
/**
 * Silhouette súng (TIP-D11a): vẽ mặt cắt nhìn ngang (y–z, nửa trái x ≤ 0 tô đậm) và từ trên (x–z, phần dưới trục y ≤ 0 tô đậm) từ GLB đã convert
 * (áp world matrix node — vị trí đỉnh đã quantize không dùng trực tiếp). Lưới 5 cm, đường đỏ = trục nòng y = 0. Dùng để đặt anchor gripL/gripR đúng ốp lót/tay cầm.
 * Dùng: node scripts/weapon-silhouette.mjs public/assets/weapons/ak47.glb out/ak47  → out/ak47-side.png, out/ak47-top.png
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const [file, out] = process.argv.slice(2);
const doc = await io.read(file); await doc.transform(dequantize());
const S = 2000; const Z0 = -0.46, Z1 = 0.26, Y0 = -0.19, Y1 = 0.07;
const W = Math.round((Z1 - Z0) * S), H = Math.round((Y1 - Y0) * S);
const side = Buffer.alloc(W * H * 3, 255); const topv = Buffer.alloc(W * 120 * 3, 255);
function fill(buf, h, ax, ay, bx, by, cx, cy, col) {
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))), maxX = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy))), maxY = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy)));
  const det = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay); if (Math.abs(det) < 1e-9) return;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const px = x + 0.5, py = y + 0.5;
    const w0 = ((bx - px) * (cy - py) - (cx - px) * (by - py)) / det, w1 = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) / det, w2 = 1 - w0 - w1;
    if (w0 >= -0.002 && w1 >= -0.002 && w2 >= -0.002) { const i = (y * W + x) * 3; buf[i] = col[0]; buf[i + 1] = col[1]; buf[i + 2] = col[2]; }
  }
}
const xf = (M, q) => [M[0]*q[0]+M[4]*q[1]+M[8]*q[2]+M[12], M[1]*q[0]+M[5]*q[1]+M[9]*q[2]+M[13], M[2]*q[0]+M[6]*q[1]+M[10]*q[2]+M[14]];
for (const node of doc.getRoot().listNodes()) { const m = node.getMesh(); if (!m) continue; const M = node.getWorldMatrix(); for (const p of m.listPrimitives()) {
  const pos = p.getAttribute('POSITION').getArray(); const idx = p.getIndices().getArray();
  for (let t = 0; t < idx.length; t += 3) {
    const v = [idx[t], idx[t + 1], idx[t + 2]].map((i) => xf(M, [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]));
    // side: chỉ nửa trái (x ≤ 0) tô xám đậm, nửa phải xám nhạt → thấy mặt cắt
    const left = v.every((q) => q[0] <= 0.001);
    fill(side, H, (v[0][2] - Z0) * S, (Y1 - v[0][1]) * S, (v[1][2] - Z0) * S, (Y1 - v[1][1]) * S, (v[2][2] - Z0) * S, (Y1 - v[2][1]) * S, left ? [60, 60, 60] : [170, 170, 170]);
    const below = v.every((q) => q[1] <= 0.0);
    fill(topv, 120, (v[0][2] - Z0) * S, (0.03 - v[0][0]) * S, (v[1][2] - Z0) * S, (0.03 - v[1][0]) * S, (v[2][2] - Z0) * S, (0.03 - v[2][0]) * S, below ? [60, 60, 60] : [170, 170, 170]);
  }
} }
const line = (buf, h, fn) => { for (let x = 0; x < W; x++) for (let y = 0; y < h; y++) if (fn(x, y)) { const i = (y * W + x) * 3; buf[i] = 230; buf[i + 1] = 40; buf[i + 2] = 40; } };
line(side, H, (x, y) => Math.abs(((x / S + Z0) * 20) % 1) < 0.004 || Math.abs((Y1 - y / S) * 20 % 1) < 0.004); // lưới 5 cm
line(side, H, (x, y) => y === Math.round(Y1 * S)); // y = 0
line(topv, 120, (x, y) => Math.abs(((x / S + Z0) * 20) % 1) < 0.004 || y === Math.round(0.03 * S));
await sharp(side, { raw: { width: W, height: H, channels: 3 } }).png().toFile(out + '-side.png');
await sharp(topv, { raw: { width: W, height: 120, channels: 3 } }).png().toFile(out + '-top.png');
console.log('ok', W, H);
