#!/usr/bin/env node
/**
 * Lá rụng nền rừng (DV-080, đồ hoạ AAA lượt 2): từng chiếc lá thật cắt từ bộ ảnh quét ambientCG (CC0) → atlas 4×4, rồi dựng
 * cụm lá nằm trên đất (mỗi lá gập nhẹ dọc gân giữa, cong mép, chồng lớp) → `public/assets/vegetation/litter.glb` cùng quy
 * ước với gen-grass (node `v<i>_lod<k>`, material `leaf_0` MASK hai mặt, `_WIND` = 0: lá nằm đất không lay gió).
 *
 * Nguồn (CC0, tải tay về assets-src/ambientcg/<id>/ — không vào git):
 *   LeafSet011 (lá dài răng cưa nâu, 6 lá) · LeafSet008 (lá bầu dục vàng nâu, 6 lá) · LeafSet030 (lá sồi khô, lấy 4 lá)
 *   https://ambientcg.com/get?file=LeafSet011_2K-PNG.zip (tương tự 008, 030) — dùng *_Color.png + *_Opacity.png.
 * Biến thể: 0 thảm dày r 1 m (46 lá) · 1 vạt vừa r 0,7 m (28) · 2 lá lác đác r 0,5 m (14). LOD0 lá gập 8 tam giác · LOD1 lá phẳng 2 · LOD2 nửa số lá.
 * Dùng: node scripts/gen-litter.mjs [--seed 11] → node scripts/ktx2.mjs --only models --filter litter
 */
import { readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { quantize, reorder } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d;
};
const SEED = Number(opt('seed', 11));
const CELL = 256;
const GRID = 4;
const TEX = CELL * GRID;
const OUT = 'public/assets/vegetation/litter.glb';
const MANIFEST = 'content/assets/manifest.json';
const SRC = 'assets-src/ambientcg';
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const log = (s) => console.log(`[litter] ${s}`);

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bộ lá: `stem` = phía cuống trong ảnh gốc (down/left/right) → xoay để cuống luôn ở đáy ô, ngọn lên trên.
 * `take`: số lá lấy (theo thứ tự dòng), `sat`/`gain`: chỉnh màu cho nền rừng nhiệt đới mùa khô (bớt vàng chói, tối hơn).
 */
const SETS = [
  { id: 'LeafSet011', stem: 'down', take: 6, sat: 0.78, gain: 0.72 },
  { id: 'LeafSet008', stem: 'left', take: 6, sat: 0.6, gain: 0.62 },
  { id: 'LeafSet030', stem: 'right', take: 4, sat: 0.7, gain: 0.66 },
];

/** tìm từng lá trong ảnh opacity: gán nhãn thành phần liên thông trên ảnh thu nhỏ 1/4 → bbox ở độ phân giải gốc */
async function findLeaves(opacityPath) {
  const { data, info } = await sharp(opacityPath).greyscale().resize(512, 512, { kernel: 'nearest' }).raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const lab = new Int32Array(W * H).fill(-1);
  const boxes = [];
  const stack = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = y * W + x;
      if (data[o] < 128 || lab[o] >= 0) continue;
      const id = boxes.length;
      const b = { x0: x, y0: y, x1: x, y1: y, n: 0 };
      lab[o] = id;
      stack.push(o);
      while (stack.length) {
        const p = stack.pop();
        const px = p % W;
        const py = (p - px) / W;
        b.n++;
        if (px < b.x0) b.x0 = px;
        if (px > b.x1) b.x1 = px;
        if (py < b.y0) b.y0 = py;
        if (py > b.y1) b.y1 = py;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const qx = px + dx;
          const qy = py + dy;
          if (qx < 0 || qy < 0 || qx >= W || qy >= H) continue;
          const q = qy * W + qx;
          if (data[q] >= 128 && lab[q] < 0) {
            lab[q] = id;
            stack.push(q);
          }
        }
      }
      boxes.push(b);
    }
  }
  const big = boxes.filter((b) => b.n > 300);
  // thứ tự dòng (y theo hàng ~ 1/8 ảnh, rồi x)
  big.sort((a, b) => Math.round(a.y0 / 64) - Math.round(b.y0 / 64) || a.x0 - b.x0);
  const s = 2048 / W;
  return big.map((b) => ({ x: Math.max(0, (b.x0 - 2) * s), y: Math.max(0, (b.y0 - 2) * s), w: Math.min(2048, (b.x1 - b.x0 + 5) * s), h: Math.min(2048, (b.y1 - b.y0 + 5) * s) }));
}

/** cắt một lá → RGBA ô CELL×CELL (cuống ở đáy), trả kèm tỉ lệ rộng/dài thật của lá */
async function cutLeaf(set, box) {
  const color = sharp(`${SRC}/${set.id}/${set.id}_2K-PNG_Color.png`).removeAlpha().extract({ left: Math.round(box.x), top: Math.round(box.y), width: Math.round(Math.min(box.w, 2048 - box.x)), height: Math.round(Math.min(box.h, 2048 - box.y)) });
  const alpha = sharp(`${SRC}/${set.id}/${set.id}_2K-PNG_Opacity.png`).greyscale().extract({ left: Math.round(box.x), top: Math.round(box.y), width: Math.round(Math.min(box.w, 2048 - box.x)), height: Math.round(Math.min(box.h, 2048 - box.y)) });
  const rot = set.stem === 'left' ? -90 : set.stem === 'right' ? 90 : 0; // sharp: dương = xoay thuận chiều kim đồng hồ
  const c = await color.rotate(rot).modulate({ saturation: set.sat, brightness: set.gain }).raw().toBuffer({ resolveWithObject: true });
  const a = await alpha.rotate(rot).raw().toBuffer({ resolveWithObject: true });
  const w = c.info.width;
  const h = c.info.height;
  // vừa ô theo chiều dài (dọc), giữ tỉ lệ
  const pad = 6;
  const sc = Math.min((CELL - pad * 2) / h, (CELL - pad * 2) / w);
  const tw = Math.max(1, Math.round(w * sc));
  const th = Math.max(1, Math.round(h * sc));
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = c.data[i * 3];
    rgba[i * 4 + 1] = c.data[i * 3 + 1];
    rgba[i * 4 + 2] = c.data[i * 3 + 2];
    rgba[i * 4 + 3] = a.data[i];
  }
  const small = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).resize(tw, th, { kernel: 'lanczos3' }).raw().toBuffer();
  const cell = Buffer.alloc(CELL * CELL * 4);
  const ox = Math.floor((CELL - tw) / 2);
  const oy = Math.floor((CELL - th) / 2);
  for (let y = 0; y < th; y++) small.copy(cell, ((oy + y) * CELL + ox) * 4, y * tw * 4, (y + 1) * tw * 4);
  return { cell, aspect: tw / th, uv: { x0: ox / CELL, x1: (ox + tw) / CELL, y0: oy / CELL, y1: (oy + th) / CELL } };
}

/** lấp màu vùng trong suốt bằng màu lá lân cận (giãn 12 lượt) → mip không viền đen */
function dilate(img, size) {
  const a0 = new Uint8Array(size * size);
  for (let i = 0; i < size * size; i++) a0[i] = img[i * 4 + 3] > 8 ? 1 : 0;
  const filled = a0.slice();
  for (let pass = 0; pass < 12; pass++) {
    const next = filled.slice();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const o = y * size + x;
        if (filled[o]) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const qx = x + dx;
          const qy = y + dy;
          if (qx < 0 || qy < 0 || qx >= size || qy >= size) continue;
          const q = qy * size + qx;
          if (!filled[q]) continue;
          r += img[q * 4]; g += img[q * 4 + 1]; b += img[q * 4 + 2]; n++;
        }
        if (n) {
          img[o * 4] = r / n; img[o * 4 + 1] = g / n; img[o * 4 + 2] = b / n;
          next[o] = 1;
        }
      }
    }
    filled.set(next);
  }
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < size * size; i++) if (a0[i]) { r += img[i * 4]; g += img[i * 4 + 1]; b += img[i * 4 + 2]; n++; }
  for (let i = 0; i < size * size; i++) if (!filled[i]) { img[i * 4] = r / n; img[i * 4 + 1] = g / n; img[i * 4 + 2] = b / n; }
}

// ---------- atlas
const atlas = Buffer.alloc(TEX * TEX * 4);
const leaves = [];
for (const set of SETS) {
  const boxes = (await findLeaves(`${SRC}/${set.id}/${set.id}_2K-PNG_Opacity.png`)).slice(0, set.take);
  if (boxes.length < set.take) throw new Error(`${set.id}: chỉ tìm thấy ${boxes.length} lá`);
  for (const box of boxes) {
    const k = leaves.length;
    const { cell, aspect, uv } = await cutLeaf(set, box);
    const gx = k % GRID;
    const gy = Math.floor(k / GRID);
    for (let y = 0; y < CELL; y++) cell.copy(atlas, ((gy * CELL + y) * TEX + gx * CELL) * 4, y * CELL * 4, (y + 1) * CELL * 4);
    leaves.push({ set: set.id, aspect, u0: (gx + uv.x0) / GRID, u1: (gx + uv.x1) / GRID, v0: (gy + uv.y0) / GRID, v1: (gy + uv.y1) / GRID });
  }
}
dilate(atlas, TEX);
const texBuf = await sharp(atlas, { raw: { width: TEX, height: TEX, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
log(`atlas ${TEX}² ${leaves.length} lá (${SETS.map((s) => `${s.id}×${s.take}`).join(', ')})`);

// ---------- geometry
/**
 * Một lá nằm đất: lưới 3 cột (mép trái · gân giữa · mép phải) × 3 hàng (cuống · giữa · ngọn); gập dọc gân (mép nhấc `fold`),
 * ngọn + cuống cong lên (`curl`) — LOD0. Phẳng 2 tam giác ở LOD1/2.
 */
function addLeaf(g, leaf, cx, cz, yaw, len, y0, fold, curl, tilt, flat) {
  const wid = len * leaf.aspect;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const cols = flat ? [-0.5, 0.5] : [-0.5, 0, 0.5];
  const rows = flat ? [0, 1] : [0, 0.5, 1];
  const base = g.pos.length / 3;
  for (const t of rows) {
    for (const u of cols) {
      const lx = u * wid;
      const lz = (t - 0.5) * len;
      const edge = Math.abs(u) * 2; // 0 gân · 1 mép
      const bend = (t - 0.5) * 2; // −1 cuống · 1 ngọn
      const ly = flat ? 0 : edge * fold + bend * bend * curl;
      const yy = y0 + ly + lz * tilt;
      g.pos.push(cx + c * lx + s * lz, yy, cz - s * lx + c * lz);
      g.uv.push(leaf.u0 + (u + 0.5) * (leaf.u1 - leaf.u0), leaf.v1 - t * (leaf.v1 - leaf.v0));
      // pháp tuyến: ngửa lên, nghiêng theo mặt gập (ánh sáng hai nửa lá khác nhau)
      const nx = flat ? 0 : -Math.sign(u) * fold * 4;
      const nl = Math.hypot(nx, 1);
      g.nor.push((c * nx) / nl, 1 / nl, (-s * nx) / nl);
    }
  }
  const nc = cols.length;
  for (let r = 0; r < rows.length - 1; r++) {
    for (let k = 0; k < nc - 1; k++) {
      const i0 = base + r * nc + k;
      g.idx.push(i0, i0 + nc, i0 + 1, i0 + 1, i0 + nc, i0 + nc + 1);
    }
  }
}

function cluster(v, lod, seed) {
  const rnd = mulberry32(seed);
  const g = { pos: [], nor: [], uv: [], idx: [] };
  for (let i = 0; i < v.n; i++) {
    // phân bố dày ở giữa (r ∝ √u · u^0,3)
    const r = v.r * Math.pow(rnd(), 0.65);
    const a = rnd() * Math.PI * 2;
    const leaf = leaves[Math.floor(rnd() * leaves.length)];
    const len = 0.09 + rnd() * 0.12;
    const yaw = rnd() * Math.PI * 2;
    const y0 = 0.006 + (i / v.n) * 0.018; // lá sau nằm trên lá trước (không z-fight)
    const fold = len * (0.04 + rnd() * 0.09);
    const curl = len * (0.03 + rnd() * 0.12);
    const tilt = (rnd() - 0.5) * 0.12;
    const keep = lod < 2 || i % 2 === 0;
    if (keep) addLeaf(g, leaf, Math.cos(a) * r, Math.sin(a) * r, yaw, len, y0, fold, curl, tilt, lod > 0);
  }
  return g;
}

const VARIANTS = [
  { r: 1.0, n: 46 },
  { r: 0.7, n: 28 },
  { r: 0.5, n: 14 },
];

const doc = new Document();
doc.createScene('vegetation');
const buffer = doc.createBuffer();
const tex = doc.createTexture('litter_leaf_0_base').setImage(new Uint8Array(texBuf)).setMimeType('image/webp');
const mat = doc.createMaterial('leaf_0').setBaseColorTexture(tex).setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(0.85).setAlphaMode('MASK').setAlphaCutoff(0.5).setDoubleSided(true);
const tris = [0, 0, 0];
let maxY = 0;
for (const [vi, v] of VARIANTS.entries()) {
  for (let k = 0; k < 3; k++) {
    const g = cluster(v, k, SEED * 100 + vi);
    const node = doc.createNode(`v${vi}_lod${k}`);
    const mesh = doc.createMesh(`v${vi}_lod${k}`);
    node.setMesh(mesh);
    doc.getRoot().listScenes()[0].addChild(node);
    const pos = new Float32Array(g.pos);
    for (let i = 1; i < pos.length; i += 3) maxY = Math.max(maxY, pos[i]);
    const prim = doc.createPrimitive().setMaterial(mat);
    prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer));
    prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.nor)).setBuffer(buffer));
    prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(g.uv)).setBuffer(buffer));
    // lá nằm đất: không uốn, không rung
    prim.setAttribute('_WIND', doc.createAccessor().setType('VEC2').setArray(new Float32Array((pos.length / 3) * 2)).setBuffer(buffer));
    prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(g.idx)).setBuffer(buffer));
    mesh.addPrimitive(prim);
    tris[k] += g.idx.length / 3;
  }
}
await doc.transform(quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, pattern: /^(POSITION|NORMAL|TEXCOORD_0)$/ }), reorder({ encoder: MeshoptEncoder }));
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: 'quantize' });
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
mkdirSync('public/assets/vegetation', { recursive: true });
await io.write(OUT, doc);
const bytes = statSync(OUT).size;
const nVar = VARIANTS.length;
log(`litter.glb: ${nVar} biến thể, tam giác/biến thể LOD0 ${(tris[0] / nVar).toFixed(0)} · LOD1 ${(tris[1] / nVar).toFixed(0)} · LOD2 ${(tris[2] / nVar).toFixed(0)}; cao ${maxY.toFixed(3)} m; ${(bytes / 1024).toFixed(0)} KB`);

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
manifest.assets = manifest.assets.filter((a) => a.id !== 'veg_litter');
manifest.assets.push({
  id: 'veg_litter',
  type: 'model',
  use: 'lá rụng nền rừng (DV-080): cụm lá thật nằm đất 3 biến thể × 3 LOD, atlas 16 lá cắt từ ambientCG LeafSet011/008/030 (CC0) bằng scripts/gen-litter.mjs',
  source: 'ambientcg',
  url: 'https://ambientcg.com/list?q=LeafSet',
  authors: ['ambientCG'],
  license: 'CC0-1.0',
  files: [{ path: OUT.replace(/^public\//, ''), bytes, sha256: sha256(OUT) }],
  triangles: { source: Math.round(tris[0] / nVar), output: Math.round(tris[0] / nVar) },
});
manifest.totalBytes = manifest.assets.reduce((s, a) => s + a.files.reduce((t, f) => t + f.bytes, 0), 0);
manifest.generatedAt = new Date().toISOString();
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
log(`manifest: ${manifest.assets.length} asset, ${(manifest.totalBytes / 1048576).toFixed(1)} MB`);
