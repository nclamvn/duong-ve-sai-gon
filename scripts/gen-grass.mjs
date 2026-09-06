#!/usr/bin/env node
/**
 * Cỏ tranh/cỏ rừng procedural (TIP-D05 bổ sung, PRD VEG-001/006 "cỏ"): sinh texture bụi cỏ (lá thon cong, alpha) + geometry
 * thẻ chéo (3 quad × 60°, 3 đoạn dọc để uốn gió) → `public/assets/vegetation/grass.glb` cùng quy ước với convert-vegetation.mjs
 * (node `v<i>_lod<k>`, material `leaf_0` MASK hai mặt, `_WIND`), manifest `veg_grass` (procedural, CC0 — không asset ngoài).
 * Biến thể: 0 cao 0,75 m (3 quad) · 1 trung 0,55 m (3 quad) · 2 thấp rộng 0,35 m (2 quad). LOD1 bớt 1 quad, LOD2 1 quad + 1 đoạn.
 * Dùng: node scripts/gen-grass.mjs [--seed 7] [--tex 512] → rồi node scripts/ktx2.mjs --only models --filter grass
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
const SEED = Number(opt('seed', 7));
const TEX = Number(opt('tex', 512));
/** --tall: cỏ tranh (Imperata) 1,6–2,2 m cho Đường 9 – Nam Lào (M2, DV-047) — thẻ cao gấp ~2,7×, lá vàng khô mùa khô */
const TALL = args.includes('--tall');
const SPECIES_ID = TALL ? 'grass_tall' : 'grass';
const OUT = `public/assets/vegetation/${SPECIES_ID}.glb`;
const MANIFEST = 'content/assets/manifest.json';
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const log = (s) => console.log(`[grass] ${s}`);

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- texture: bụi cỏ (lá thon, cong, gốc tối ngọn sáng/vàng), alpha nhị phân + viền mềm 1 px
function paintGrass(size, seed) {
  const rnd = mulberry32(seed);
  const img = new Float32Array(size * size * 4);
  const put = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const k = (y * size + x) * 4;
    if (a > img[k + 3]) {
      img[k] = r;
      img[k + 1] = g;
      img[k + 2] = b;
      img[k + 3] = a;
    }
  };
  const blades = 34;
  for (let b = 0; b < blades; b++) {
    const x0 = size * (0.5 + (rnd() - 0.5) * 0.36); // gốc gần tâm đáy
    const h = size * (0.55 + rnd() * 0.43); // chiều cao
    const lean = (rnd() - 0.5) * 1.6; // nghiêng
    const curve = (rnd() - 0.5) * 1.2; // cong
    const wBase = size * (0.012 + rnd() * 0.014);
    // màu: xanh vàng, mỗi lá lệch; gốc tối
    // cỏ tranh mùa khô (--tall): vàng rơm ngả nâu, ít bão hoà; cỏ rừng: xanh lá ngả vàng
    const hue = (TALL ? 0.14 : 0.22) + (rnd() - 0.5) * 0.08;
    const sat = (TALL ? 0.32 : 0.45) + rnd() * 0.25;
    const light = (TALL ? 0.36 : 0.28) + rnd() * 0.16;
    const steps = Math.round(h * 2.2);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps; // 0 gốc → 1 ngọn
      const y = size - 1 - t * h;
      const x = x0 + lean * t * h * 0.5 + curve * t * t * h * 0.5;
      const w = wBase * (1 - t * 0.92) + 0.6;
      const shade = 0.55 + 0.45 * t; // gốc tối
      const yellow = t * t * 0.35;
      const [r, g, bb] = hsl(hue - yellow * 0.06, sat, light * shade + yellow * 0.12);
      for (let dx = -Math.ceil(w); dx <= Math.ceil(w); dx++) {
        const ax = Math.abs(dx) / w;
        if (ax > 1) continue;
        const edge = ax > 0.75 ? (1 - ax) / 0.25 : 1;
        // gân giữa hơi sáng
        const vein = ax < 0.2 ? 1.08 : 1;
        put(Math.round(x + dx), Math.round(y), r * vein, g * vein, bb * vein, edge);
      }
    }
  }
  const out = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const a = img[i * 4 + 3];
    out[i * 4] = Math.round(Math.min(1, img[i * 4]) * 255);
    out[i * 4 + 1] = Math.round(Math.min(1, img[i * 4 + 1]) * 255);
    out[i * 4 + 2] = Math.round(Math.min(1, img[i * 4 + 2]) * 255);
    out[i * 4 + 3] = Math.round(Math.min(1, a) * 255);
  }
  // màu ở vùng trong suốt = màu lá lân cận (tránh viền đen khi mip/lọc): lấp bằng blur màu
  return out;
}
function hsl(h, s, l) {
  const k = (n) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

/** lấp màu vùng alpha 0 bằng màu trung bình lá (mip không kéo về đen) */
async function fillTransparent(rgba, size) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < size * size; i++) if (rgba[i * 4 + 3] > 0) { r += rgba[i * 4]; g += rgba[i * 4 + 1]; b += rgba[i * 4 + 2]; n++; }
  r /= n; g /= n; b /= n;
  for (let i = 0; i < size * size; i++) if (rgba[i * 4 + 3] === 0) { rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; }
  return sharp(Buffer.from(rgba), { raw: { width: size, height: size, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
}

// ---------- geometry: quad chéo, `seg` đoạn dọc, uốn nhẹ sẵn (cong ra ngoài)
function clump(quads, height, width, seg, rnd) {
  const pos = [], nor = [], uv = [], idx = [];
  for (let q = 0; q < quads; q++) {
    const a = (q / quads) * Math.PI + (rnd() - 0.5) * 0.3;
    const c = Math.cos(a), s = Math.sin(a);
    const w = width * (0.9 + rnd() * 0.2);
    const h = height * (0.85 + rnd() * 0.3);
    const lean = (rnd() - 0.5) * 0.25;
    const base = pos.length / 3;
    for (let r = 0; r <= seg; r++) {
      const t = r / seg;
      const y = t * h;
      const off = lean * t * t * h; // nghiêng theo pháp tuyến quad
      for (let col = 0; col < 2; col++) {
        const u = col === 0 ? -0.5 : 0.5;
        pos.push(c * u * w - s * off, y, s * u * w + c * off);
        nor.push(-s, 0.35, c); // pháp tuyến hơi ngửa lên (lá cỏ ăn nắng từ trên)
        uv.push(col, 1 - t);
      }
    }
    for (let r = 0; r < seg; r++) {
      const i0 = base + r * 2;
      idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
    }
  }
  return { pos, nor, uv, idx, height };
}

const VARIANTS = TALL
  ? [
      { height: 2.1, width: 1.1, quads: 3 },
      { height: 1.75, width: 1.0, quads: 3 },
      { height: 1.45, width: 0.95, quads: 2 },
    ]
  : [
      { height: 0.75, width: 0.85, quads: 3 },
      { height: 0.55, width: 0.7, quads: 3 },
      { height: 0.35, width: 0.75, quads: 2 },
    ];
const LODS = [
  { quads: (q) => q, seg: 3 },
  { quads: (q) => Math.max(2, q - 1), seg: 2 },
  { quads: () => 1, seg: 1 },
];

const rnd = mulberry32(SEED);
const doc = new Document();
doc.createScene('vegetation');
const buffer = doc.createBuffer();
const texBuf = await fillTransparent(paintGrass(TEX, SEED), TEX);
const tex = doc.createTexture('grass_leaf_0_base').setImage(new Uint8Array(texBuf)).setMimeType('image/webp');
const mat = doc.createMaterial('leaf_0').setBaseColorTexture(tex).setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(0.8).setAlphaMode('MASK').setAlphaCutoff(0.5).setDoubleSided(true);
const tris = [0, 0, 0];
for (const [vi, v] of VARIANTS.entries()) {
  const seedV = mulberry32(SEED * 100 + vi);
  for (const [k, L] of LODS.entries()) {
    const r2 = mulberry32(SEED * 100 + vi); // cùng dáng giữa các LOD
    const g = clump(L.quads(v.quads), v.height, v.width, L.seg, r2);
    const node = doc.createNode(`v${vi}_lod${k}`);
    const mesh = doc.createMesh(`v${vi}_lod${k}`);
    node.setMesh(mesh);
    doc.getRoot().listScenes()[0].addChild(node);
    const pos = new Float32Array(g.pos);
    const prim = doc.createPrimitive().setMaterial(mat);
    prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer));
    prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.nor)).setBuffer(buffer));
    prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(g.uv)).setBuffer(buffer));
    const w = new Float32Array((pos.length / 3) * 2);
    for (let i = 0; i < pos.length / 3; i++) {
      w[i * 2] = Math.min(1, pos[i * 3 + 1] / v.height);
      w[i * 2 + 1] = 1;
    }
    prim.setAttribute('_WIND', doc.createAccessor().setType('VEC2').setArray(w).setBuffer(buffer));
    prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(g.idx)).setBuffer(buffer));
    mesh.addPrimitive(prim);
    tris[k] += g.idx.length / 3;
  }
  void seedV;
}
await doc.transform(quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, pattern: /^(POSITION|NORMAL|TEXCOORD_0)$/ }), reorder({ encoder: MeshoptEncoder }));
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: 'quantize' });
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
mkdirSync('public/assets/vegetation', { recursive: true });
await io.write(OUT, doc);
const bytes = statSync(OUT).size;
const nVar = VARIANTS.length;
log(`${SPECIES_ID}.glb: ${nVar} biến thể, tam giác/biến thể LOD0 ${tris[0] / nVar} · LOD1 ${tris[1] / nVar} · LOD2 ${tris[2] / nVar}; texture ${TEX}² WebP; ${(bytes / 1024).toFixed(0)} KB`);

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
manifest.assets = manifest.assets.filter((a) => a.id !== `veg_${SPECIES_ID}`);
manifest.assets.push({
  id: `veg_${SPECIES_ID}`,
  type: 'model',
  use: TALL ? 'cỏ tranh 1,5–2,2 m (M2 Đường 9, DV-047) procedural: bụi thẻ chéo 3 biến thể × 3 LOD, gen-grass --tall' : 'thực vật rừng (TIP-D05, VEG-001/006) — cỏ rừng/cỏ tranh procedural: bụi thẻ chéo 3 biến thể × 3 LOD, texture lá cỏ vẽ bằng scripts/gen-grass.mjs (không asset ngoài)',
  source: 'procedural',
  url: 'https://github.com/nclamvn/duong-ve-sai-gon',
  authors: ['DVSG (scripts/gen-grass.mjs)'],
  license: 'CC0-1.0',
  files: [{ path: OUT.replace(/^public\//, ''), bytes, sha256: sha256(OUT) }],
  triangles: { source: tris[0] / nVar, output: tris[0] / nVar },
});
manifest.totalBytes = manifest.assets.reduce((s, a) => s + a.files.reduce((t, f) => t + f.bytes, 0), 0);
manifest.generatedAt = new Date().toISOString();
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
log(`manifest: ${manifest.assets.length} asset, ${(manifest.totalBytes / 1048576).toFixed(1)} MB`);
