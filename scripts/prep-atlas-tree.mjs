#!/usr/bin/env node
/**
 * Chuẩn bị cây mua (DV-064, Fab) cho convert-vegetation: gói cây archviz (3DGardenPlants) có 5 material lá (mỗi cái một ảnh
 * lá đơn, UV 0..1) + 3 material thân (vỏ lặp UV) → mỗi primitive là một batch → quá nhiều draw call. Script này gộp mỗi cây
 * thành ĐÚNG 2 primitive: lá (atlas ngang N ô, UV lá dời vào ô của nó) và thân (một ảnh vỏ, giữ UV lặp).
 * Bỏ hoa (BLEND trắng, không cần ở rừng tháng 1). Đầu vào: glb đã đổi từ FBX bằng FBX2glTF (sandbox x86-64).
 *
 * Dùng: node scripts/prep-atlas-tree.mjs --out <out.glb> --leaf <regex material lá> --bark <regex material thân>
 *        --barkTex <regex tên ảnh vỏ dùng chung> --drop <regex material bỏ> <in1.glb>:<tên node> [<in2.glb>:<tên node> ...]
 */
import { NodeIO, Document } from '@gltf-transform/core';
import { weld } from '@gltf-transform/functions';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
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
const LEAF = new RegExp(opt('leaf', '^Leaves'), 'i');
const BARK = new RegExp(opt('bark', 'Bark|Twig|Branch'), 'i');
const BARK_TEX = new RegExp(opt('barkTex', 'Bark_Diffuse'), 'i');
const DROP = new RegExp(opt('drop', 'Flower'), 'i');
const CELL_H = Number(opt('cellH', '512'));
const inputs = args.map((a) => {
  const k = a.lastIndexOf(':');
  return { path: a.slice(0, k), name: a.slice(k + 1) };
});
if (!OUT || !inputs.length) throw new Error('thiếu --out hoặc đầu vào');

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const docs = await Promise.all(inputs.map((i) => io.read(i.path)));

// ---- atlas lá: gom ảnh lá theo tên material (cùng tên ở mọi cây → cùng ô)
const leafImgs = new Map(); // matName → {buf, w, h}
let barkImg = null;
for (const d of docs) {
  for (const m of d.getRoot().listMaterials()) {
    const t = m.getBaseColorTexture();
    if (!t) continue;
    if (LEAF.test(m.getName()) && !DROP.test(m.getName()) && !leafImgs.has(m.getName())) {
      const meta = await sharp(Buffer.from(t.getImage())).metadata();
      leafImgs.set(m.getName(), { buf: Buffer.from(t.getImage()), w: meta.width, h: meta.height });
    }
    // ảnh vỏ về 512×1024 (KTX2/Basis cần cạnh bội 4; vỏ lặp UV nên méo nhẹ tỉ lệ không thấy)
    if (!barkImg && BARK.test(m.getName()) && BARK_TEX.test(t.getURI() || t.getName() || '')) barkImg = { buf: await sharp(Buffer.from(t.getImage())).resize(512, 1024, { fit: 'fill' }).jpeg({ quality: 92 }).toBuffer(), mime: 'image/jpeg' };
  }
}
if (!leafImgs.size) throw new Error('không thấy material lá');
if (!barkImg) throw new Error('không thấy ảnh vỏ khớp --barkTex');
const names = [...leafImgs.keys()].sort();
// ô rộng = 1024 / số ô, bội của 4 (KTX2/Basis cần cạnh chia hết 4); méo tỉ lệ ảnh lá vài % không thấy được
const cellW = Math.floor(1024 / names.length / 4) * 4;
const W = cellW * names.length;
const composites = [];
for (const [i, n] of names.entries()) {
  const png = await sharp(leafImgs.get(n).buf).resize(cellW, CELL_H, { fit: 'fill' }).ensureAlpha().png().toBuffer();
  composites.push({ input: png, left: i * cellW, top: 0 });
}
const atlas = await sharp({ create: { width: W, height: CELL_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(composites).png().toBuffer();
const cellOf = new Map(names.map((n, i) => [n, i]));
// lề nửa texel chống lem sang ô kề khi lọc tuyến tính/mip
const pad = 1.5 / W;

const out = new Document();
const buffer = out.createBuffer();
const scene = out.createScene('trees');
const leafTex = out.createTexture('leaf_atlas').setImage(new Uint8Array(atlas)).setMimeType('image/png');
const barkTex = out.createTexture('bark').setImage(new Uint8Array(barkImg.buf)).setMimeType(barkImg.mime);
const leafMat = out.createMaterial('Leaf').setBaseColorTexture(leafTex).setAlphaMode('MASK').setAlphaCutoff(0.5).setDoubleSided(true).setMetallicFactor(0).setRoughnessFactor(0.75);
const barkMat = out.createMaterial('Bark').setBaseColorTexture(barkTex).setMetallicFactor(0).setRoughnessFactor(0.9);

const report = [];
for (const [di, d] of docs.entries()) {
  const acc = { leaf: { pos: [], nor: [], uv: [], idx: [] }, bark: { pos: [], nor: [], uv: [], idx: [] } };
  const visit = (node) => {
    const mesh = node.getMesh();
    if (mesh) {
      const M = node.getWorldMatrix();
      for (const p of mesh.listPrimitives()) {
        const mn = p.getMaterial()?.getName() ?? '';
        if (DROP.test(mn)) continue;
        const cls = LEAF.test(mn) ? 'leaf' : BARK.test(mn) ? 'bark' : null;
        if (!cls) continue;
        const g = acc[cls];
        const P = p.getAttribute('POSITION').getArray();
        const N = p.getAttribute('NORMAL')?.getArray();
        const U = p.getAttribute('TEXCOORD_0')?.getArray();
        const I = p.getIndices()?.getArray();
        const base = g.pos.length / 3;
        const nv = P.length / 3;
        const cell = cls === 'leaf' ? cellOf.get(mn) ?? 0 : 0;
        for (let v = 0; v < nv; v++) {
          const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
          g.pos.push(M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]);
          if (N) {
            const a = N[v * 3], b = N[v * 3 + 1], c = N[v * 3 + 2];
            const nx = M[0] * a + M[4] * b + M[8] * c, ny = M[1] * a + M[5] * b + M[9] * c, nz = M[2] * a + M[6] * b + M[10] * c;
            const l = Math.hypot(nx, ny, nz) || 1;
            g.nor.push(nx / l, ny / l, nz / l);
          } else g.nor.push(0, 1, 0);
          let u = U ? U[v * 2] : 0;
          const w = U ? U[v * 2 + 1] : 0;
          if (cls === 'leaf') u = (cell + pad * names.length + Math.min(1, Math.max(0, u)) * (1 - 2 * pad * names.length)) / names.length;
          g.uv.push(u, w);
        }
        if (I) for (let i = 0; i < I.length; i++) g.idx.push(base + I[i]);
        else for (let i = 0; i < nv; i++) g.idx.push(base + i);
      }
    }
    for (const c of node.listChildren()) visit(c);
  };
  for (const n of d.getRoot().listScenes()[0].listChildren()) visit(n);
  const mesh = out.createMesh(inputs[di].name);
  for (const [cls, mat] of [['leaf', leafMat], ['bark', barkMat]]) {
    const g = acc[cls];
    if (!g.idx.length) continue;
    const prim = out.createPrimitive().setMaterial(mat);
    prim.setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(new Float32Array(g.pos)).setBuffer(buffer));
    prim.setAttribute('NORMAL', out.createAccessor().setType('VEC3').setArray(new Float32Array(g.nor)).setBuffer(buffer));
    prim.setAttribute('TEXCOORD_0', out.createAccessor().setType('VEC2').setArray(new Float32Array(g.uv)).setBuffer(buffer));
    prim.setIndices(out.createAccessor().setType('SCALAR').setArray(new Uint32Array(g.idx)).setBuffer(buffer));
    mesh.addPrimitive(prim);
  }
  scene.addChild(out.createNode(inputs[di].name).setMesh(mesh));
  report.push(`${inputs[di].name}: lá ${acc.leaf.idx.length / 3} tam giác, thân ${acc.bark.idx.length / 3}`);
}
// gộp đỉnh trùng (FBX2glTF xuất tam giác rời) → mỗi lá là một thành phần liên thông, convert-vegetation tỉa nguyên lá
await out.transform(weld({ tolerance: 0.00001 }));
await io.write(OUT, out);
console.log(`[prep] atlas lá ${W}×${CELL_H} (${names.length} ô: ${names.join(', ')})\n[prep] ${report.join('\n[prep] ')}\n[prep] → ${OUT}`);
