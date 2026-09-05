#!/usr/bin/env node
/**
 * Lính Quân Giải phóng 1971 từ Mixamo "Swat Guy" (TIP-D11a, DV-025 asset sprint, PRD §7.2/§8 ART01):
 *  - Bỏ gear hiện đại: material 1002 (`Ch15_body1`) chỉ giữ bàn tay (+ cổ tay) và giày (tạm — dép cao su procedural sau);
 *    material 1001 (`Ch15_body`) bỏ đệm gối, túi thắt lưng, tai nghe (island nhỏ ≤ 64 tam giác).
 *  - Sơn lại atlas: vải bộ đội "xanh Tô Châu" (albedo = màu × dệt Poly Haven CC0 `stretch_poplin` × sáng/tối gốc làm mờ),
 *    da tay/đầu (bóng gốc → da), thắt lưng nâu sẫm, giày đen. Normal: vùng da làm phẳng; ORM: AO sàn, metal = 0, roughness sàn.
 *  - Giữ skeleton/animation/skin (dùng chung với `extract-arms.mjs` → tay FP).
 *  Island = thành phần liên thông theo đỉnh (vị trí+uv); phân loại bằng bbox 3D (tỷ lệ theo bbox toàn mesh) — không phụ thuộc scale.
 * Dùng: node scripts/retexture-1971.mjs [--src assets-src/mixamo/soldier-swat.glb] [--out public/assets/characters/soldier.glb]
 *       [--fabric assets-src/polyhaven/stretch_poplin/stretch_poplin_diff_1k.jpg] [--tile 5] [--debug-masks <dir>]
 * Sau đó: node scripts/extract-arms.mjs && node scripts/ktx2.mjs --only models --filter soldier
 */
import { readFileSync, writeFileSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dequantize, unweld, weld, dedup, prune, quantize, reorder } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const SRC = opt('src', 'assets-src/mixamo/soldier-swat.glb');
const OUT = opt('out', 'public/assets/characters/soldier.glb');
const FABRIC = opt('fabric', 'assets-src/polyhaven/stretch_poplin/stretch_poplin_diff_1k.jpg');
const TILE = Number(opt('tile', '5'));
const DEBUG = opt('debug-masks', null);
const MANIFEST = 'content/assets/manifest.json';
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

/** màu sRGB 0..255 — tham chiếu ảnh tư liệu 1971 (registry ART01): vải Tô Châu xanh xám, da nâu sáng, thắt lưng da nâu, giày đen (tạm) */
const COLORS = {
  CLOTH: [94, 110, 78],
  SKIN: [186, 138, 98],
  BELT: [66, 52, 38],
  BOOT: [44, 40, 36],
};
/** hệ số sáng/tối gốc: blur (px ở 2048) và nén tương phản (0 = phẳng, 1 = giữ nguyên) */
const SHADE = { CLOTH: { blur: 22, k: 0.45, min: 0.78 }, SKIN: { blur: 2, k: 0.35, min: 0.6 }, BELT: { blur: 3, k: 0.6, min: 0.45 }, BOOT: { blur: 3, k: 0.6, min: 0.45 } };
/** island ≥ ngần này tam giác được chuẩn hoá sáng/tối riêng (bỏ chênh lệch sơn gốc: áo giáp đen vs rằn ri sáng) */
const ISLAND_NORM_MIN = 200;

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(SRC);
await doc.transform(dequantize());
const root = doc.getRoot();

// ---------- bbox toàn mesh (đơn vị float sau dequantize)
const bb = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
  const pos = prim.getAttribute('POSITION').getArray();
  for (let i = 0; i < pos.length; i += 3) {
    bb.x0 = Math.min(bb.x0, pos[i]); bb.x1 = Math.max(bb.x1, pos[i]);
    bb.y0 = Math.min(bb.y0, pos[i + 1]); bb.y1 = Math.max(bb.y1, pos[i + 1]);
  }
}
const H = bb.y1 - bb.y0;
const XH = Math.max(Math.abs(bb.x0), Math.abs(bb.x1));
const yF = (y) => (y - bb.y0) / H;
console.log(`[1971] bbox y ${bb.y0.toFixed(3)}..${bb.y1.toFixed(3)} (cao ${H.toFixed(3)}), |x| tới ${XH.toFixed(3)}`);

/**
 * Phân loại island theo material + bbox:
 *  1001: DROP nhỏ ≤ 64 tam giác (túi, tai nghe) · DROP đệm gối (uv u ≥ 0,85, v ≤ 0,6) · DROP kính/chụp tai (y ≥ 84,5 %, < 300 tam giác) ·
 *        SKIN sọ (vỏ mũ Swat) + mặt (y ≥ 84,5 % cao) ·
 *        BELT (y 53–61 %, ≤ 210 tam giác) · còn lại CLOTH.
 *  1002: SKIN bàn tay (|x| ≥ 90 % nửa rộng T-pose) · CLOTH đai cổ tay (73–90 %) · BOOT (y ≤ 10 %) · còn lại DROP.
 */
function classify(matName, e) {
  const isGear = /body1$/i.test(matName);
  const ax = Math.max(Math.abs(e.x0), Math.abs(e.x1)) / XH;
  if (isGear) {
    if (ax >= 0.9) return 'SKIN'; // bàn tay (găng → da)
    if (ax >= 0.73) return 'CLOTH'; // đai cổ tay găng → cổ tay áo (che khe ống tay 1001 – bàn tay 1002 ~2 cm)
    if (yF(e.y1) <= 0.1) return 'BOOT';
    return 'DROP';
  }
  if (e.tris <= 64) return 'DROP';
  if (e.u0 >= 0.85 && e.v1 <= 0.6) return 'DROP';
  if (yF(e.y0) >= 0.845 && e.tris < 300) return 'DROP'; // kính, chụp tai trên mũ
  if (yF(e.y0) >= 0.845) return 'SKIN'; // vỏ mũ Swat = sọ/trán (không có sọ riêng; mặt chỉ tới mũi) + mặt/balaclava → da; mũ cối procedural đội ngoài (gear1971.ts)
  if (yF(e.y0) >= 0.53 && yF(e.y1) <= 0.61 && e.tris <= 210) return 'BELT';
  return 'CLOTH';
}

/** island theo union-find đỉnh (vị trí + uv trùng = một) */
function islands(prim) {
  const idx = prim.getIndices().getArray();
  const pos = prim.getAttribute('POSITION').getArray();
  const uv = prim.getAttribute('TEXCOORD_0').getArray();
  const nv = prim.getAttribute('POSITION').getCount();
  const key = new Map();
  const parent = new Int32Array(nv);
  for (let v = 0; v < nv; v++) {
    const k = `${pos[v * 3].toFixed(4)},${pos[v * 3 + 1].toFixed(4)},${pos[v * 3 + 2].toFixed(4)},${uv[v * 2].toFixed(4)},${uv[v * 2 + 1].toFixed(4)}`;
    const r = key.get(k);
    if (r === undefined) { key.set(k, v); parent[v] = v; } else parent[v] = r;
  }
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  for (let t = 0; t < idx.length; t += 3) {
    const a = find(idx[t]), b = find(idx[t + 1]), c = find(idx[t + 2]);
    if (a !== b) parent[a] = b;
    if (find(a) !== find(c)) parent[find(a)] = find(c);
  }
  const comp = new Map();
  const triComp = new Int32Array(idx.length / 3);
  for (let t = 0; t < idx.length; t += 3) {
    const c = find(idx[t]);
    triComp[t / 3] = c;
    let e = comp.get(c);
    if (!e) { e = { tris: 0, u0: Infinity, u1: -Infinity, v0: Infinity, v1: -Infinity, x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity }; comp.set(c, e); }
    e.tris++;
    for (let k = 0; k < 3; k++) {
      const v = idx[t + k];
      e.u0 = Math.min(e.u0, uv[v * 2]); e.u1 = Math.max(e.u1, uv[v * 2]); e.v0 = Math.min(e.v0, uv[v * 2 + 1]); e.v1 = Math.max(e.v1, uv[v * 2 + 1]);
      e.x0 = Math.min(e.x0, pos[v * 3]); e.x1 = Math.max(e.x1, pos[v * 3]); e.y0 = Math.min(e.y0, pos[v * 3 + 1]); e.y1 = Math.max(e.y1, pos[v * 3 + 1]);
    }
  }
  return { idx, uv, comp, triComp };
}

/** rasterize tam giác (uv) vào mask W×H (Uint8, 255) */
function rasterTri(mask, W, Hh, u0, v0, u1, v1, u2, v2, value = 255) {
  const x0 = u0 * W, y0 = v0 * Hh, x1 = u1 * W, y1 = v1 * Hh, x2 = u2 * W, y2 = v2 * Hh;
  const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)) - 1), maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)) + 1);
  const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)) - 1), maxY = Math.min(Hh - 1, Math.ceil(Math.max(y0, y1, y2)) + 1);
  const det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (Math.abs(det) < 1e-9) return;
  const eps = -1.5; // nới 1,5 px chống viền
  for (let y = minY; y <= maxY; y++) {
    const py = y + 0.5;
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / det;
      const w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / det;
      const w2 = 1 - w0 - w1;
      // khoảng cách xấp xỉ tới cạnh theo trọng số × chiều cao tam giác (đủ cho nới viền)
      const s = Math.min(w0, w1, w2) * Math.sqrt(Math.abs(det));
      if (s >= eps) mask[y * W + x] = value;
    }
  }
}

// ---------- phân loại + lọc tam giác + mask theo material
const CLASSES = ['CLOTH', 'SKIN', 'BELT', 'BOOT'];
const perMat = new Map(); // matName → { masks: {CLASS: Uint8Array}, W, H, kept, total }
const stats = {};
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const mat = prim.getMaterial();
    const name = mat?.getName() ?? '';
    const base = mat?.getBaseColorTexture();
    const [W, Hh] = base ? base.getSize() : [2048, 2048];
    const { idx, uv, comp, triComp } = islands(prim);
    const cls = new Map();
    for (const [c, e] of comp) cls.set(c, classify(name, e));
    const masks = Object.fromEntries(CLASSES.map((k) => [k, new Uint8Array(W * Hh)]));
    const islandId = new Uint16Array(W * Hh); // 0 = không; id island (1..) cho chuẩn hoá riêng
    const islandIndex = new Map(); // comp → id (chỉ island ≥ ISLAND_NORM_MIN)
    for (const [c, e] of comp) if (e.tris >= ISLAND_NORM_MIN && cls.get(c) !== 'DROP') islandIndex.set(c, islandIndex.size + 1);
    const out = [];
    const st = (stats[name] ??= { total: 0, kept: 0, byClass: {} });
    for (let t = 0; t < idx.length; t += 3) {
      const k = cls.get(triComp[t / 3]);
      st.total++;
      st.byClass[k] = (st.byClass[k] ?? 0) + 1;
      if (k === 'DROP') continue;
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      out.push(a, b, c);
      st.kept++;
      rasterTri(masks[k], W, Hh, uv[a * 2], uv[a * 2 + 1], uv[b * 2], uv[b * 2 + 1], uv[c * 2], uv[c * 2 + 1]);
      const iid = islandIndex.get(triComp[t / 3]);
      if (iid) rasterTri(islandId, W, Hh, uv[a * 2], uv[a * 2 + 1], uv[b * 2], uv[b * 2 + 1], uv[c * 2], uv[c * 2 + 1], iid);
    }
    const old = prim.getIndices();
    prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(out)).setBuffer(root.listBuffers()[0]));
    old.dispose();
    perMat.set(name, { mat, masks, islandId, W, H: Hh });
    console.log(`[1971] ${name}: giữ ${st.kept}/${st.total} tam giác — ${Object.entries(st.byClass).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  }
}

// ---------- vải dệt (luminance chuẩn hoá, tile)
async function fabricTile(W, Hh) {
  if (!existsSync(FABRIC)) {
    console.warn(`[1971] không có ${FABRIC} — dệt = 1`);
    return new Float32Array(W * Hh).fill(1);
  }
  const { data, info } = await sharp(FABRIC).greyscale().raw().toBuffer({ resolveWithObject: true });
  const fw = info.width, fh = info.height;
  let mean = 0;
  for (let i = 0; i < data.length; i++) mean += data[i];
  mean /= data.length;
  const out = new Float32Array(W * Hh);
  for (let y = 0; y < Hh; y++) {
    const fy = Math.floor(((y * TILE) / Hh) * fh) % fh;
    for (let x = 0; x < W; x++) {
      const fx = Math.floor(((x * TILE) / W) * fw) % fw;
      out[y * W + x] = 1 + (data[fy * fw + fx] / mean - 1) * 1.4; // khuếch đại dệt nhẹ
    }
  }
  return out;
}

/** blur luminance (sharp) → Float32 0..1 */
async function blurredLum(buf, W, Hh, sigma) {
  const { data } = await sharp(buf, { raw: { width: W, height: Hh, channels: 4 } }).greyscale().blur(sigma).raw().toBuffer({ resolveWithObject: true });
  const out = new Float32Array(W * Hh);
  for (let i = 0; i < out.length; i++) out[i] = data[i] / 255;
  return out;
}

/** trung bình luminance trong mask */
function meanIn(lum, mask) {
  let s = 0, n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) { s += lum[i]; n++; }
  return n ? s / n : 0.5;
}

for (const [name, { mat, masks, islandId, W, H: Hh }] of perMat) {
  const base = mat.getBaseColorTexture();
  if (!base) continue;
  const { data: rgba } = await sharp(base.getImage()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(W * Hh * 4);
  // nền: xám trung tính (vùng ngoài mọi island — không được lấy mẫu, nhưng mip/bleed nên để gần màu vải)
  for (let i = 0; i < W * Hh; i++) { out[i * 4] = COLORS.CLOTH[0]; out[i * 4 + 1] = COLORS.CLOTH[1]; out[i * 4 + 2] = COLORS.CLOTH[2]; out[i * 4 + 3] = 255; }
  const weave = await fabricTile(W, Hh);
  const skinMask = masks.SKIN;
  for (const k of CLASSES) {
    const mask = masks[k];
    let any = false;
    for (let i = 0; i < mask.length && !any; i++) any = mask[i] > 0;
    if (!any) continue;
    const lum = await blurredLum(rgba, W, Hh, SHADE[k].blur);
    const mean = meanIn(lum, mask);
    // trung bình riêng từng island lớn trong lớp này
    const isum = new Map();
    for (let i = 0; i < mask.length; i++) if (mask[i] && islandId[i]) { const e = isum.get(islandId[i]) ?? { s: 0, n: 0 }; e.s += lum[i]; e.n++; isum.set(islandId[i], e); }
    const imean = new Map([...isum].map(([id, e]) => [id, e.s / e.n]));
    const col = COLORS[k];
    const kk = SHADE[k].k;
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) continue;
      const m = (islandId[i] && imean.get(islandId[i])) || mean;
      let shade = lum[i] / Math.max(0.05, m);
      shade = Math.min(1.6, Math.max(SHADE[k].min, shade));
      shade = 1 + (shade - 1) * kk;
      const wv = k === 'CLOTH' || k === 'BELT' ? weave[i] : 1;
      const f = shade * wv;
      out[i * 4] = Math.max(0, Math.min(255, Math.round(col[0] * f)));
      out[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(col[1] * f)));
      out[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(col[2] * f)));
    }
  }
  const jpg = await sharp(out, { raw: { width: W, height: Hh, channels: 4 } }).removeAlpha().jpeg({ quality: 90, chromaSubsampling: '4:4:4' }).toBuffer();
  base.setImage(jpg).setMimeType('image/jpeg').setName(`${name}_1971_diffuse.jpg`);
  // normal: vùng da làm phẳng (vải balaclava/găng không phải nếp da)
  const nor = mat.getNormalTexture();
  if (nor) {
    const { data: n } = await sharp(nor.getImage()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < W * Hh; i++) if (skinMask[i]) { n[i * 4] = 128; n[i * 4 + 1] = 128; n[i * 4 + 2] = 255; }
    const nj = await sharp(n, { raw: { width: W, height: Hh, channels: 4 } }).removeAlpha().jpeg({ quality: 90, chromaSubsampling: '4:4:4' }).toBuffer();
    nor.setImage(nj).setMimeType('image/jpeg').setName(`${name}_1971_normal.jpg`);
  }
  // ORM: R AO giữ · G roughness = max(gốc, sàn) (da 0,5 · vải 0,75 · giày 0,55) · B metal 0
  const mr = mat.getMetallicRoughnessTexture();
  if (mr) {
    const { data: m } = await sharp(mr.getImage()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < W * Hh; i++) {
      const floor = skinMask[i] ? 128 : masks.BOOT[i] ? 140 : 190;
      m[i * 4] = Math.max(m[i * 4], skinMask[i] ? 235 : 150); // AO gốc nướng cho gear (kính = 0 → đen) — sàn cao
      m[i * 4 + 1] = Math.max(m[i * 4 + 1], floor);
      m[i * 4 + 2] = 0;
    }
    const mj = await sharp(m, { raw: { width: W, height: Hh, channels: 4 } }).removeAlpha().jpeg({ quality: 88 }).toBuffer();
    mr.setImage(mj).setMimeType('image/jpeg').setName(`${name}_1971_orm.jpg`);
  }
  mat.setMetallicFactor(0).setRoughnessFactor(1);
  const em = mat.getEmissiveTexture();
  if (em) { mat.setEmissiveTexture(null); mat.setEmissiveFactor([0, 0, 0]); em.dispose(); }
  if (DEBUG) {
    mkdirSync(DEBUG, { recursive: true });
    for (const k of CLASSES) await sharp(Buffer.from(masks[k]), { raw: { width: W, height: Hh, channels: 1 } }).png().toFile(join(DEBUG, `mask_${name}_${k}.png`));
    await sharp(jpg).toFile(join(DEBUG, `diffuse_${name}.jpg`));
  }
}

// ---------- ghi
await doc.transform(
  unweld(),
  weld(),
  dedup(),
  prune({ keepAttributes: false, keepLeaves: true }),
  quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, pattern: /^(?!JOINTS_|WEIGHTS_)/ }),
  reorder({ encoder: MeshoptEncoder }),
);
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: 'quantize' });
mkdirSync(dirname(OUT), { recursive: true });
await io.write(OUT, doc);
const bytes = statSync(OUT).size;
console.log(`[1971] → ${OUT}: ${(bytes / 1048576).toFixed(2)} MB; animation ${root.listAnimations().length}, joint ${root.listSkins()[0]?.listJoints().length}`);
if (!OUT.startsWith('public/')) process.exit(0);

const man = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const a = man.assets.find((x) => x.id === 'soldier_mixamo');
if (a) {
  a.use = 'lính Quân Giải phóng 1971 (dummy + bot) — Mixamo Swat Guy, Chủ nhà tải, convert scripts/convert-mixamo.mjs → bỏ gear + sơn lại atlas bằng scripts/retexture-1971.mjs (vải Tô Châu, tay trần; đầu/giày tạm — D11b)';
  a.files = [{ path: OUT.replace(/^public\//, ''), bytes, sha256: sha256(OUT) }];
  a.sourceFiles = (a.sourceFiles ?? []).filter((f) => !/soldier-swat\.glb|stretch_poplin/.test(f.path));
  a.sourceFiles.push({ path: SRC, bytes: statSync(SRC).size, sha256: sha256(SRC) });
  if (existsSync(FABRIC)) a.sourceFiles.push({ path: FABRIC, bytes: statSync(FABRIC).size, sha256: sha256(FABRIC) });
  a.historical = true;
  a.registryId = 'uni.pavn.1971.field_uniform_green'; // registry lượt 1: tier H → approved false tới khi cố vấn có ảnh/hiện vật
  a.approved = false;
  a.triangles = { source: Object.values(stats).reduce((s, x) => s + x.total, 0), output: Object.values(stats).reduce((s, x) => s + x.kept, 0) };
  man.totalBytes = man.assets.reduce((s, x) => s + x.files.reduce((t, f) => t + f.bytes, 0), 0);
  man.generatedAt = new Date().toISOString();
  writeFileSync(MANIFEST, JSON.stringify(man, null, 2) + '\n');
  console.log(`[1971] manifest soldier_mixamo cập nhật (historical, registryId ${a.registryId}, approved false); tổng ${(man.totalBytes / 1048576).toFixed(1)} MB`);
}
