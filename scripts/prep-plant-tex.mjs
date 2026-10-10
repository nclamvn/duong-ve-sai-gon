#!/usr/bin/env node
/**
 * Chuẩn bị mô hình mua (DV-064) mà FBX2glTF không nối được ảnh (Megascans, anydrafts: ảnh để rời cạnh FBX): gộp các glb
 * đầu vào thành một file, mỗi đầu vào một node, MỘT material dùng ảnh màu cho trước (và ghép ảnh opacity vào kênh alpha
 * nếu có — lá/tàu cọ, alpha MASK hai mặt). Ảnh thu nhỏ về `--size` trước khi nhúng (convert-vegetation còn nén tiếp).
 *
 * Dùng: node scripts/prep-plant-tex.mjs --out <out.glb> --base <ảnh màu> [--opacity <ảnh alpha>] [--size 2048]
 *        [--material Leaf|Bark] [--gain 1.8] <in1.glb>:<tên node> [...]
 */
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld } from '@gltf-transform/functions';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  if (i < 0) return d;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const OUT = opt('out');
const BASE = opt('base');
const OPACITY = opt('opacity', null);
const SIZE = Number(opt('size', '2048'));
const MAT = opt('material', OPACITY ? 'Leaf' : 'Bark');
// albedo scan Megascans rất tối (đúng vật lý) trong khi lá Sketchfab/Poly Haven sáng hơn: nâng độ sáng cho đồng bộ cả rừng
const GAIN = Number(opt('gain', '1'));
const inputs = args.map((a) => {
  const k = a.lastIndexOf(':');
  return { path: a.slice(0, k), name: a.slice(k + 1) };
});
if (!OUT || !BASE || !inputs.length) throw new Error('thiếu --out, --base hoặc đầu vào');

let img;
if (OPACITY) {
  const rgb = await sharp(BASE).resize(SIZE, SIZE, { fit: 'fill' }).modulate({ brightness: GAIN }).removeAlpha().raw().toBuffer();
  const a = await sharp(OPACITY).resize(SIZE, SIZE, { fit: 'fill' }).greyscale().raw().toBuffer();
  // "alpha bleed": vùng trong suốt của ảnh Megascans là màu ĐEN → mip xa trộn đen vào tàu lá (cọ đen kịt ở 15 m).
  // Lấp màu vùng trong suốt bằng màu lá lân cận: blur(rgb·α) / blur(α), giữ nguyên pixel đặc.
  const N = SIZE * SIZE;
  const pre = Buffer.alloc(N * 3);
  for (let i = 0; i < N; i++) for (let c = 0; c < 3; c++) pre[i * 3 + c] = Math.round((rgb[i * 3 + c] * a[i]) / 255);
  // hai tầng blur: gần mép lá lấy màu lá sát bên (σ nhỏ), xa hơn lấy màu vùng (σ lớn), xa hẳn lấy màu trung bình lá
  const blurPair = async (sg) => [
    await sharp(pre, { raw: { width: SIZE, height: SIZE, channels: 3 } }).blur(sg).raw().toBuffer(),
    await sharp(a, { raw: { width: SIZE, height: SIZE, channels: 1 } }).blur(sg).raw().toBuffer(),
  ];
  const [preB, aB] = await blurPair(Math.max(4, SIZE / 128));
  const [preB2, aB2] = await blurPair(Math.max(16, SIZE / 32));
  let sum = [0, 0, 0], cnt = 0;
  for (let i = 0; i < N; i++) if (a[i] > 128) { sum[0] += rgb[i * 3]; sum[1] += rgb[i * 3 + 1]; sum[2] += rgb[i * 3 + 2]; cnt++; }
  const avg = sum.map((v) => v / Math.max(1, cnt));
  const rgba = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    const w = a[i] / 255;
    for (let c = 0; c < 3; c++) {
      const fill = aB[i] > 40 ? (preB[i * 3 + c] * 255) / aB[i] : aB2[i] > 24 ? (preB2[i * 3 + c] * 255) / aB2[i] : avg[c];
      rgba[i * 4 + c] = Math.round(rgb[i * 3 + c] * w + Math.min(255, fill) * (1 - w));
    }
    rgba[i * 4 + 3] = a[i];
  }
  img = { buf: await sharp(rgba, { raw: { width: SIZE, height: SIZE, channels: 4 } }).png().toBuffer(), mime: 'image/png' };
} else img = { buf: await sharp(BASE).resize(SIZE, SIZE, { fit: 'inside' }).modulate({ brightness: GAIN }).jpeg({ quality: 92 }).toBuffer(), mime: 'image/jpeg' };

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const out = new Document();
const buffer = out.createBuffer();
const scene = out.createScene('plants');
const tex = out.createTexture(MAT.toLowerCase()).setImage(new Uint8Array(img.buf)).setMimeType(img.mime);
const mat = out.createMaterial(MAT).setBaseColorTexture(tex).setMetallicFactor(0).setRoughnessFactor(MAT === 'Leaf' ? 0.75 : 0.9);
if (OPACITY) mat.setAlphaMode('MASK').setAlphaCutoff(0.5).setDoubleSided(true);

for (const inp of inputs) {
  const d = await io.read(inp.path);
  const g = { pos: [], nor: [], uv: [], idx: [] };
  const visit = (node) => {
    const mesh = node.getMesh();
    if (mesh) {
      const M = node.getWorldMatrix();
      for (const p of mesh.listPrimitives()) {
        const P = p.getAttribute('POSITION').getArray();
        const N = p.getAttribute('NORMAL')?.getArray();
        const U = p.getAttribute('TEXCOORD_0')?.getArray();
        const I = p.getIndices()?.getArray();
        const base = g.pos.length / 3;
        const nv = P.length / 3;
        for (let v = 0; v < nv; v++) {
          const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
          g.pos.push(M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]);
          if (N) {
            const a = N[v * 3], b = N[v * 3 + 1], c = N[v * 3 + 2];
            const nx = M[0] * a + M[4] * b + M[8] * c, ny = M[1] * a + M[5] * b + M[9] * c, nz = M[2] * a + M[6] * b + M[10] * c;
            const l = Math.hypot(nx, ny, nz) || 1;
            g.nor.push(nx / l, ny / l, nz / l);
          } else g.nor.push(0, 1, 0);
          g.uv.push(U ? U[v * 2] : 0, U ? U[v * 2 + 1] : 0);
        }
        if (I) for (let i = 0; i < I.length; i++) g.idx.push(base + I[i]);
        else for (let i = 0; i < nv; i++) g.idx.push(base + i);
      }
    }
    for (const c of node.listChildren()) visit(c);
  };
  for (const n of d.getRoot().listScenes()[0].listChildren()) visit(n);
  const prim = out.createPrimitive().setMaterial(mat);
  prim.setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(new Float32Array(g.pos)).setBuffer(buffer));
  prim.setAttribute('NORMAL', out.createAccessor().setType('VEC3').setArray(new Float32Array(g.nor)).setBuffer(buffer));
  prim.setAttribute('TEXCOORD_0', out.createAccessor().setType('VEC2').setArray(new Float32Array(g.uv)).setBuffer(buffer));
  prim.setIndices(out.createAccessor().setType('SCALAR').setArray(new Uint32Array(g.idx)).setBuffer(buffer));
  scene.addChild(out.createNode(inp.name).setMesh(out.createMesh(inp.name).addPrimitive(prim)));
  console.log(`[prep] ${inp.name}: ${g.idx.length / 3} tam giác`);
}
await out.transform(weld({ tolerance: 0.00001 }));
await io.write(OUT, out);
console.log(`[prep] → ${OUT} (${MAT}, ảnh ${SIZE}px${OPACITY ? ' RGBA' : ''})`);
