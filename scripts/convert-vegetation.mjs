#!/usr/bin/env node
/**
 * Thực vật rừng (TIP-D05, PRD VEG-001/003): từ GLB Sketchfab CC-BY (assets-src/sketchfab/<slug>/) → một GLB mỗi loài
 * `public/assets/vegetation/<species>.glb` gồm N biến thể × 3 LOD, mỗi mesh ≤ 2 primitive: lớp LÁ (alpha MASK, hai mặt)
 * và lớp THÂN (opaque). Spec-gloss → metal-rough; BLEND → MASK 0,5; chuẩn hoá: gốc ở chân (minY = 0, tâm x/z), cao theo `height`.
 * LOD: lá = tỉa thẻ (thành phần liên thông) giữ tỉ lệ r rồi phóng thẻ còn lại 1/√r (giữ độ phủ); thân = meshopt simplify.
 * Texture: resize theo lớp, WebP (KTX2 sau bằng scripts/ktx2.mjs). Manifest: entry CC-BY có attribution/url/authors + sha256.
 * Cấu hình: content/vegetation/species.json (không TS trong content). Dùng: node scripts/convert-vegetation.mjs [--only id,id] [--dry]
 */
import { readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { NodeIO, Document, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { metalRough, dedup, prune, quantize, reorder, textureCompress, weld, simplify, unweld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const ONLY = (opt('only', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const DRY = args.includes('--dry');
const SPEC = JSON.parse(readFileSync('content/vegetation/species.json', 'utf8'));
const MANIFEST = 'content/assets/manifest.json';
const OUT_DIR = 'public/assets/vegetation';
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const log = (s) => console.log(`[veg] ${s}`);

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptSimplifier });

/** PRNG nhỏ (mulberry32) — tỉa thẻ lá xác định theo seed */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Nhân ma trận 4×4 (cột) với điểm */
const xf = (M, p) => [M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12], M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13], M[2] * p[0] + M[6] * p[1] + M[10] * p[2] + M[14]];
const xfN = (M, n) => {
  const v = [M[0] * n[0] + M[4] * n[1] + M[8] * n[2], M[1] * n[0] + M[5] * n[1] + M[9] * n[2], M[2] * n[0] + M[6] * n[1] + M[10] * n[2]];
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/**
 * Gom tam giác của các node khớp regex (kể cả con) theo lớp (leaf/bark) → { positions, normals, uvs, indices, material } mỗi lớp,
 * toạ độ world của scene nguồn (đã áp world matrix + transform biến thể).
 */
function collect(srcDoc, nodeRe, dropRe, leafRe, part) {
  const scene = srcDoc.getRoot().listScenes()[0];
  const groups = new Map(); // key material name → {cls, mat, pos:[], nor:[], uv:[], idx:[]}
  const T = part?.transform ?? null; // ma trận thêm (composite)
  const visit = (node, inMatch) => {
    const name = node.getName() || '';
    const match = inMatch || nodeRe.test(name);
    const mesh = node.getMesh();
    if (mesh && match) {
      const M = node.getWorldMatrix();
      for (const p of mesh.listPrimitives()) {
        const mat = p.getMaterial();
        const mname = mat?.getName() || 'mat';
        const pname = `${name}|${mname}`;
        if (dropRe && dropRe.test(pname)) continue;
        const cls = leafRe.test(mname) || (dropRe === null && false) ? 'leaf' : 'bark';
        const key = `${cls}:${mname}`;
        let g = groups.get(key);
        if (!g) {
          g = { cls, mat, name: mname, pos: [], nor: [], uv: [], idx: [] };
          groups.set(key, g);
        }
        const P = p.getAttribute('POSITION').getArray();
        const N = p.getAttribute('NORMAL')?.getArray();
        const U = p.getAttribute('TEXCOORD_0')?.getArray();
        const I = p.getIndices()?.getArray();
        const base = g.pos.length / 3;
        const nv = P.length / 3;
        for (let v = 0; v < nv; v++) {
          let q = xf(M, [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]);
          if (T) q = xf(T, q);
          g.pos.push(q[0], q[1], q[2]);
          let n = N ? xfN(M, [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]]) : [0, 1, 0];
          if (T) n = xfN(T, n);
          g.nor.push(n[0], n[1], n[2]);
          g.uv.push(U ? U[v * 2] : 0, U ? U[v * 2 + 1] : 0);
        }
        if (I) for (let i = 0; i < I.length; i++) g.idx.push(base + I[i]);
        else for (let i = 0; i < nv; i++) g.idx.push(base + i);
      }
    }
    for (const c of node.listChildren()) visit(c, match);
  };
  for (const n of scene.listChildren()) visit(n, false);
  return [...groups.values()];
}

/** Thành phần liên thông (thẻ lá) theo đỉnh chia sẻ; trả mảng componentId theo tam giác */
function components(idx, nv) {
  const parent = new Int32Array(nv);
  for (let i = 0; i < nv; i++) parent[i] = i;
  const find = (a) => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  for (let t = 0; t < idx.length; t += 3) {
    const a = find(idx[t]), b = find(idx[t + 1]), c = find(idx[t + 2]);
    if (a !== b) parent[a] = b;
    if (find(a) !== find(c)) parent[find(a)] = find(c);
  }
  const out = new Int32Array(idx.length / 3);
  for (let t = 0; t < idx.length; t += 3) out[t / 3] = find(idx[t]);
  return out;
}

/** Tỉa thẻ lá: giữ tỉ lệ `keep` thành phần (seeded), phóng thẻ còn lại quanh tâm thẻ 1/√keep (không quá scaleMax — giữ độ phủ tán ≈ keep·scale²) */
function pruneCards(g, keep, seed, scaleMax = 2.2) {
  if (keep >= 0.999) return g;
  const nv = g.pos.length / 3;
  const comp = components(g.idx, nv);
  const ids = [...new Set(comp)];
  // thẻ quá to (vd. thân lá liền khối) không tỉa: ngưỡng > 5 % tam giác
  const triCount = new Map();
  for (const c of comp) triCount.set(c, (triCount.get(c) ?? 0) + 1);
  const big = new Set(ids.filter((c) => triCount.get(c) > comp.length * 0.05));
  const rnd = prng(seed);
  const kept = new Set(ids.filter((c) => big.has(c) || rnd() < keep));
  const scale = Math.min(scaleMax, 1 / Math.sqrt(keep));
  // tâm thẻ
  const cx = new Map();
  for (let t = 0; t < g.idx.length; t += 3) {
    const c = comp[t / 3];
    if (!kept.has(c) || big.has(c)) continue;
    let e = cx.get(c);
    if (!e) {
      e = { x: 0, y: 0, z: 0, n: 0, verts: new Set() };
      cx.set(c, e);
    }
    for (let k = 0; k < 3; k++) e.verts.add(g.idx[t + k]);
  }
  for (const e of cx.values()) {
    for (const v of e.verts) {
      e.x += g.pos[v * 3];
      e.y += g.pos[v * 3 + 1];
      e.z += g.pos[v * 3 + 2];
      e.n++;
    }
    e.x /= e.n;
    e.y /= e.n;
    e.z /= e.n;
  }
  const pos = g.pos.slice();
  for (const e of cx.values()) for (const v of e.verts) {
    pos[v * 3] = e.x + (pos[v * 3] - e.x) * scale;
    pos[v * 3 + 1] = e.y + (pos[v * 3 + 1] - e.y) * scale;
    pos[v * 3 + 2] = e.z + (pos[v * 3 + 2] - e.z) * scale;
  }
  const idx = [];
  for (let t = 0; t < g.idx.length; t += 3) if (kept.has(comp[t / 3])) idx.push(g.idx[t], g.idx[t + 1], g.idx[t + 2]);
  return { ...g, pos, idx };
}

/** Ghi một primitive vào doc đích (đỉnh chưa gộp — weld sau) */
function addPrimitive(doc, buffer, mesh, g, material, wind) {
  const pos = new Float32Array(g.pos);
  const nor = new Float32Array(g.nor);
  const uv = new Float32Array(g.uv);
  const idx = new Uint32Array(g.idx);
  const prim = doc.createPrimitive().setMaterial(material);
  prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer));
  prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nor).setBuffer(buffer));
  prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(uv).setBuffer(buffer));
  // _WIND (VEG-002): x = cao độ chuẩn hoá 0..1 (uốn theo chiều cao), y = "độ mềm" 0..1 (lá 1; thân theo khoảng cách tới trục)
  const w = new Float32Array((pos.length / 3) * 2);
  for (let v = 0; v < pos.length / 3; v++) {
    const h = Math.min(1, Math.max(0, pos[v * 3 + 1] / wind.height));
    const r = Math.hypot(pos[v * 3], pos[v * 3 + 2]) / Math.max(0.01, wind.radius);
    w[v * 2] = h;
    w[v * 2 + 1] = wind.leaf ? 1 : Math.min(1, r);
  }
  prim.setAttribute('_WIND', doc.createAccessor().setType('VEC2').setArray(w).setBuffer(buffer));
  prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(idx).setBuffer(buffer));
  mesh.addPrimitive(prim);
  return prim;
}

/** Sao chép texture (ảnh + mime) sang doc đích, cache theo texture nguồn */
function cloneTexture(dst, src, cache, name) {
  if (!src) return null;
  let t = cache.get(src);
  if (!t) {
    t = dst.createTexture(name).setImage(src.getImage()).setMimeType(src.getMimeType());
    cache.set(src, t);
  }
  return t;
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
mkdirSync(OUT_DIR, { recursive: true });
const summary = [];

for (const [id, sp] of Object.entries(SPEC.species)) {
  if (ONLY.length && !ONLY.includes(id)) continue;
  const srcDoc = await io.read(sp.src);
  // spec-gloss → metal-rough trước khi lấy texture
  await srcDoc.transform(metalRough());
  const leafRe = new RegExp(sp.leaf ?? '$^', 'i');
  const out = new Document();
  out.createScene('vegetation');
  const buffer = out.createBuffer();
  const texCache = new Map();
  const matCache = new Map();
  const heights = [];
  const variantsRaw = [];
  for (const [vi, v] of sp.variants.entries()) {
    const nodeRe = new RegExp(v.nodes);
    const dropRe = v.drop ? new RegExp(v.drop) : null;
    let groups = [];
    if (v.parts) {
      for (const part of v.parts) {
        const c = Math.cos(part.rotY ?? 0), s = Math.sin(part.rotY ?? 0), sc = part.scale ?? 1;
        const tilt = part.tilt ?? 0;
        const ct = Math.cos(tilt), st = Math.sin(tilt);
        // T = translate · rotY · rotX(tilt) · scale
        const R = [c * sc, 0, -s * sc, 0, s * st * sc, ct * sc, c * st * sc, 0, s * ct * sc, -st * sc, c * ct * sc, 0, part.pos?.[0] ?? 0, part.pos?.[1] ?? 0, part.pos?.[2] ?? 0, 1];
        const gs = collect(srcDoc, new RegExp(part.nodes ?? v.nodes), dropRe, leafRe, { transform: R });
        for (const g of gs) {
          const key = `${g.cls}:${g.name}`;
          const ex = groups.find((x) => `${x.cls}:${x.name}` === key);
          if (ex) {
            const base = ex.pos.length / 3;
            ex.pos.push(...g.pos);
            ex.nor.push(...g.nor);
            ex.uv.push(...g.uv);
            for (const i of g.idx) ex.idx.push(base + i);
          } else groups.push(g);
        }
      }
    } else groups = collect(srcDoc, nodeRe, dropRe, leafRe, null);
    if (!groups.length) throw new Error(`${id} v${vi}: không khớp node /${v.nodes}/`);
    // bbox biến thể
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const g of groups) for (let i = 0; i < g.pos.length; i += 3) {
      minX = Math.min(minX, g.pos[i]); maxX = Math.max(maxX, g.pos[i]);
      minY = Math.min(minY, g.pos[i + 1]); maxY = Math.max(maxY, g.pos[i + 1]);
      minZ = Math.min(minZ, g.pos[i + 2]); maxZ = Math.max(maxZ, g.pos[i + 2]);
    }
    heights.push(maxY - minY);
    variantsRaw.push({ v, vi, groups, bbox: { minX, maxX, minY, maxY, minZ, maxZ } });
  }
  // tỉ lệ chung cả loài: biến thể cao nhất → sp.height (giữ tương quan các biến thể)
  const scale = sp.height / Math.max(...heights);
  const tris = { lod: [0, 0, 0] };
  for (const { v, vi, groups, bbox } of variantsRaw) {
    const cx = (bbox.minX + bbox.maxX) / 2, cz = (bbox.minZ + bbox.maxZ) / 2;
    const ratios = sp.lod ?? { leaf: [1, 0.4, 0.15], bark: [1, 0.35, 0.12] };
    for (let k = 0; k < 3; k++) {
      const node = out.createNode(`v${vi}_lod${k}`);
      const mesh = out.createMesh(`v${vi}_lod${k}`);
      node.setMesh(mesh);
      out.getRoot().listScenes()[0].addChild(node);
      for (const g0 of groups) {
        // chuẩn hoá: gốc chân, tâm x/z, scale
        const g = { ...g0, pos: g0.pos.map((p, i) => (i % 3 === 0 ? (p - cx) * scale : i % 3 === 1 ? (p - bbox.minY) * scale : (p - cz) * scale)) };
        const cls = g.cls;
        const r = ratios[cls][k];
        let gk = g;
        let simplifyLater = 0;
        if (cls === 'leaf') {
          const nComp = new Set(components(g.idx, g.pos.length / 3)).size;
          if (nComp >= 20) gk = pruneCards(g, r, 1000 * vi + k, sp.cardScaleMax ?? 2.2); // lá dạng thẻ → tỉa
          else simplifyLater = r; // lá liền khối (chuối, ráy) → simplify như thân
        } else simplifyLater = r;
        // material chung theo (lớp, material nguồn)
        const mkey = `${cls}:${g.name}`;
        let mat = matCache.get(mkey);
        if (!mat) {
          const sm = g.mat;
          mat = out.createMaterial(`${cls}_${matCache.size}`);
          mat.setBaseColorTexture(cloneTexture(out, sm?.getBaseColorTexture(), texCache, `${id}_${cls}_${matCache.size}_base`));
          if (sm?.getBaseColorTexture()) mat.getBaseColorTextureInfo()?.setTexCoord(sm.getBaseColorTextureInfo()?.getTexCoord() ?? 0);
          const nt = sp.normals === true ? sm?.getNormalTexture() : null; // D05: material TSL không dùng normal map (D12 bật `normals: true` nếu thân phẳng)
          if (nt) mat.setNormalTexture(cloneTexture(out, nt, texCache, `${id}_${cls}_${matCache.size}_nor`));
          mat.setBaseColorFactor(sm?.getBaseColorFactor() ?? [1, 1, 1, 1]);
          mat.setMetallicFactor(0);
          mat.setRoughnessFactor(cls === 'leaf' ? 0.75 : 0.9);
          if (cls === 'leaf') {
            mat.setAlphaMode('MASK').setAlphaCutoff(sp.alphaCutoff ?? 0.5).setDoubleSided(true);
          } else mat.setAlphaMode('OPAQUE').setDoubleSided(false);
          matCache.set(mkey, mat);
        }
        const prim = addPrimitive(out, buffer, mesh, gk, mat, { height: (bbox.maxY - bbox.minY) * scale, radius: (Math.max(bbox.maxX - bbox.minX, bbox.maxZ - bbox.minZ) * scale) / 2, leaf: cls === 'leaf' });
        if (k > 0 && simplifyLater > 0 && simplifyLater < 0.999) prim.setName(`simplify:${simplifyLater}`);
        tris.lod[k] += gk.idx.length / 3;
      }
    }
  }
  // gộp đỉnh; simplify thân theo LOD (lá đã tỉa)
  await out.transform(weld({ tolerance: 0.0001 }));
  for (const mesh of out.getRoot().listMeshes()) {
    const k = Number(mesh.getName().slice(-1));
    if (k === 0) continue;
    for (const p of mesh.listPrimitives()) {
      const tag = /^simplify:([0-9.]+)$/.exec(p.getName() || '');
      const ratio = tag ? Number(tag[1]) : 1;
      p.setName('');
      if (ratio < 0.999) {
        // simplifyPrimitive không export ổn định — dùng simplify toàn doc theo filter mesh? đơn giản: simplify từng primitive qua MeshoptSimplifier
        const idx = p.getIndices();
        const pos = p.getAttribute('POSITION');
        const target = Math.max(3, Math.floor((idx.getCount() * ratio) / 3) * 3);
        const [res, err] = MeshoptSimplifier.simplify(new Uint32Array(idx.getArray()), pos.getArray(), 3, target, 0.1, []);
        p.setIndices(out.createAccessor().setType('SCALAR').setArray(new Uint32Array(res)).setBuffer(buffer)); // accessor mới — không đụng LOD khác
        void err;
      }
    }
  }
  const texLeaf = sp.texture?.leaf ?? 1024;
  const texBark = sp.texture?.bark ?? 1024;
  await out.transform(
    dedup(),
    prune({ keepAttributes: false, keepLeaves: true }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', pattern: /_leaf_/, quality: 90, resize: [texLeaf, texLeaf] }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', pattern: /_bark_/, quality: 86, resize: [texBark, texBark] }),
    quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, pattern: /^(POSITION|NORMAL|TEXCOORD_0)$/ }),
    reorder({ encoder: MeshoptEncoder }),
  );
  out.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: 'quantize' });
  const outPath = `${OUT_DIR}/${id}.glb`;
  // thống kê lại sau simplify
  const triOut = [0, 0, 0];
  for (const mesh of out.getRoot().listMeshes()) {
    const k = Number(mesh.getName().slice(-1));
    for (const p of mesh.listPrimitives()) triOut[k] += p.getIndices().getCount() / 3;
  }
  const nVar = sp.variants.length;
  log(`${id}: ${nVar} biến thể, cao ${sp.height} m (scale ${scale.toFixed(3)}), tam giác/biến thể LOD0 ${Math.round(triOut[0] / nVar)} · LOD1 ${Math.round(triOut[1] / nVar)} · LOD2 ${Math.round(triOut[2] / nVar)}; material ${matCache.size}, texture ${texCache.size}`);
  if (DRY) continue;
  await io.write(outPath, out);
  const bytes = statSync(outPath).size;
  log(`  → ${outPath} ${(bytes / 1048576).toFixed(2)} MB`);
  const sf = sp.sketchfab;
  const entry = {
    id: sp.asset,
    type: 'model',
    use: `thực vật rừng (TIP-D05, VEG-001) — ${sp.label}: ${nVar} biến thể × 3 LOD, lá MASK hai mặt; scripts/convert-vegetation.mjs`,
    source: 'sketchfab',
    url: sf.url,
    authors: [sf.author],
    license: 'CC-BY-4.0',
    attribution: `"${sf.name}" (${sf.url}) by ${sf.author} is licensed under CC-BY-4.0 (https://creativecommons.org/licenses/by/4.0/)`,
    files: [{ path: outPath.replace(/^public\//, ''), bytes, sha256: sha256(outPath) }],
    sourceFiles: [{ path: sp.src, bytes: statSync(sp.src).size, sha256: sha256(sp.src) }],
    triangles: { source: sf.faces ?? 0, output: Math.round(triOut[0] / nVar) },
  };
  if (sp.registryId) {
    entry.historical = true;
    entry.registryId = sp.registryId;
    entry.approved = false;
  }
  manifest.assets = manifest.assets.filter((a) => a.id !== sp.asset);
  manifest.assets.push(entry);
  summary.push({ id, tri: triOut.map((t) => Math.round(t / nVar)), bytes });
}
if (!DRY) {
  manifest.totalBytes = manifest.assets.reduce((s, a) => s + a.files.reduce((t, f) => t + f.bytes, 0), 0);
  manifest.generatedAt = new Date().toISOString();
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  log(`manifest: ${manifest.assets.length} asset, ${(manifest.totalBytes / 1048576).toFixed(1)} MB`);
}
