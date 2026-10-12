#!/usr/bin/env node
/**
 * DV-070: UV mask of the scalp of the Panzergrenadier body, from the mesh itself (bind pose): a vertex is "hair" by its height
 * above the Head joint, with the hairline higher at the forehead than at the nape. Per-vertex weights are rasterized over the
 * triangles' UVs (soft hairline). Output: 8-bit PNG mask at the albedo size, consumed by scripts/paint-pz-hair.py.
 * Use: node scripts/pz-hair-mask.mjs <src.glb> <out-mask.png> [size=2048]
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';

const [SRC, OUT, SIZE_ARG] = process.argv.slice(2);
const SIZE = Number(SIZE_ARG ?? 2048);
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(SRC);
const root = doc.getRoot();
const head = root.listNodes().find((n) => /Head_\d+$/.test(n.getName()) && /mixamorig/.test(n.getName()));
const hm = head.getWorldMatrix();
const H = [hm[12], hm[13], hm[14]];
const body = root.listNodes().find((n) => n.getMesh() && n.getMesh().listPrimitives().some((p) => p.getMaterial()?.getName() === 'Material.003'));
const M = body.getWorldMatrix();
const prim = body.getMesh().listPrimitives().find((p) => p.getMaterial()?.getName() === 'Material.003');
const P = prim.getAttribute('POSITION').getArray();
const UV = prim.getAttribute('TEXCOORD_0').getArray();
const I = prim.getIndices().getArray();
// head size from vertices near the head: use world units relative to the skull height (top − joint)
const nv = P.length / 3;
const wpos = new Float32Array(P.length);
let top = -Infinity;
for (let v = 0; v < nv; v++) {
  const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
  wpos[v * 3] = M[0] * x + M[4] * y + M[8] * z + M[12];
  wpos[v * 3 + 1] = M[1] * x + M[5] * y + M[9] * z + M[13];
  wpos[v * 3 + 2] = M[2] * x + M[6] * y + M[10] * z + M[14];
  const dx = wpos[v * 3] - H[0], dz = wpos[v * 3 + 2] - H[2];
  if (Math.hypot(dx, dz) < (top === -Infinity ? 1e9 : 1e9)) top = Math.max(top, wpos[v * 3 + 1]);
}
const skull = top - H[1]; // joint → crown
// hair weight: above the hairline; hairline height (fraction of skull) rises from the nape (0.32) to the forehead (0.62)
const wgt = new Float32Array(nv);
for (let v = 0; v < nv; v++) {
  const dx = wpos[v * 3] - H[0], dy = wpos[v * 3 + 1] - H[1], dz = wpos[v * 3 + 2] - H[2];
  if (Math.hypot(dx, dz) > skull * 1.1 || dy < 0) continue;
  const fwd = Math.max(-1, Math.min(1, dz / (skull * 0.75))); // +z = face side
  const line = 0.47 + 0.15 * fwd; // nape 0.32 .. forehead 0.62
  const side = Math.abs(dx) / (skull * 0.75);
  const lineSide = line + 0.08 * Math.max(0, side - 0.7); // above the ears
  const h = dy / skull;
  // ears stay skin
  const earCut = side > 0.78 ? Math.max(0, 1 - (side - 0.78) / 0.1) : 1;
  wgt[v] = Math.max(0, Math.min(1, (h - lineSide) / 0.06)) * earCut;
}
const buf = new Float32Array(SIZE * SIZE);
for (let t = 0; t < I.length; t += 3) {
  const a = I[t], b = I[t + 1], c = I[t + 2];
  if (wgt[a] + wgt[b] + wgt[c] <= 0) continue;
  const ax = UV[a * 2] * SIZE, ay = UV[a * 2 + 1] * SIZE, bx = UV[b * 2] * SIZE, by = UV[b * 2 + 1] * SIZE, cx = UV[c * 2] * SIZE, cy = UV[c * 2 + 1] * SIZE;
  const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(SIZE - 1, Math.ceil(Math.max(ax, bx, cx)));
  const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(SIZE - 1, Math.ceil(Math.max(ay, by, cy)));
  const d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
  if (Math.abs(d) < 1e-9) continue;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const l1 = ((bx - px) * (cy - py) - (cx - px) * (by - py)) / d;
      const l2 = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) / d;
      const l3 = 1 - l1 - l2;
      if (l1 < -0.01 || l2 < -0.01 || l3 < -0.01) continue;
      buf[y * SIZE + x] = Math.max(buf[y * SIZE + x], l1 * wgt[a] + l2 * wgt[b] + l3 * wgt[c]);
    }
}
const out = Buffer.alloc(SIZE * SIZE);
for (let i = 0; i < out.length; i++) out[i] = Math.round(Math.min(1, buf[i]) * 255);
await sharp(out, { raw: { width: SIZE, height: SIZE, channels: 1 } }).png().toFile(OUT);
console.log(`[hair] skull ${skull.toFixed(2)} units, mask ${OUT}`);
