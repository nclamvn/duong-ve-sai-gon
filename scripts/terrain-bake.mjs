#!/usr/bin/env node
/**
 * Terrain bake (TIP-D04, PRD TER-001): DEM SRTM 1" (.hgt, 3601×3601, int16 big-endian, 1 tile = 1°×1°) → ô heightmap cho engine.
 *  Chế độ --nav: bake navmesh (xem bên dưới).
 *  Đầu vào: --hgt assets-src/dem/N17E106.hgt --lat 17.55 --lon 106.10 --size 2048 (m) --res 2 (m/điểm) --id truong-son-a
 *  Đầu ra:  public/assets/terrain/<id>/height.r16 (Uint16 little-endian, hàng từ bắc xuống nam, cột tây → đông),
 *           public/assets/terrain/<id>/meta.json (n, sizeM, resM, zMin, zMax, origin lat/lon, nguồn), preview.png (8-bit).
 *  Nội suy song tuyến từ lưới 1" (≈ 30,9 m bắc–nam, ≈ 29,5 m đông–tây ở 17,5°) + nhiễu fBm nhỏ (seeded) cho chi tiết < 30 m
 *  (ghi rõ trong meta là "chi tiết procedural", không phải đo đạc).
 * Nguồn DEM: Terrain Tiles on AWS (Mapzen/Nextzen skadi) — SRTM 1" NASA/USGS public domain [KC điều khoản] — ghi manifest.
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};

/**
 * Chế độ --nav (TIP-D04, TER-003): bake navmesh recast trên lưới 4 m của navRect từ ô đã có (height.r16 + meta.json)
 *   node scripts/terrain-bake.mjs --nav --id truong-son-a --yOffset 691.2 --navRect -192 512 512 512 [--cs 0.5 --ch 0.25] [--level content/levels/truong-son-a.level.json]
 * → public/assets/terrain/<id>/nav.bin (exportNavMesh) + cập nhật manifest (files[] của entry terrain_<id>).
 *   --level: thêm obstacle thân cây (TIP-D05 vòng 2): chạy scatter của engine (bundle rolldown từ src/engine/vegetation/scatter.ts + terrain/tile.ts,
 *   density 1 = tier cao; tier thấp là tập con) → lăng trụ thấp quanh thân (navObstacleMesh) vào lưới đầu vào recast → bot đi vòng cây.
 */
if (args.includes('--nav')) {
  const { init, exportNavMesh } = await import('recast-navigation');
  const { generateSoloNavMesh } = await import('@recast-navigation/generators');
  const ID = opt('id', 'truong-son-a');
  const dir = `public/assets/terrain/${ID}`;
  const meta = JSON.parse(readFileSync(`${dir}/meta.json`, 'utf8'));
  const buf = readFileSync(`${dir}/height.r16`);
  const u16 = new Uint16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const yOff = Number(opt('yOffset', '0'));
  const ri = args.indexOf('--navRect');
  const rect = ri >= 0 ? args.slice(ri + 1, ri + 5).map(Number) : [0, 0, 512, 512];
  const cs = Number(opt('cs', '0.5'));
  const ch = Number(opt('ch', '0.25'));
  const n = meta.n, res = meta.resM, half = meta.sizeM / 2;
  const at = (i, j) => meta.zMin + (u16[Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i))] / 65535) * (meta.zMax - meta.zMin) - yOff;
  const step = Math.max(1, Math.round(4 / res));
  const i0 = Math.max(0, Math.floor((rect[0] - rect[2] / 2 + half) / res)), i1 = Math.min(n - 1, Math.ceil((rect[0] + rect[2] / 2 + half) / res));
  const j0 = Math.max(0, Math.floor((rect[1] - rect[3] / 2 + half) / res)), j1 = Math.min(n - 1, Math.ceil((rect[1] + rect[3] / 2 + half) / res));
  const cols = Math.floor((i1 - i0) / step) + 1, rows = Math.floor((j1 - j0) / step) + 1;
  const pos = new Float32Array(cols * rows * 3);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = i0 + c * step, j = j0 + r * step, k = (r * cols + c) * 3;
    pos[k] = -half + i * res; pos[k + 1] = at(i, j); pos[k + 2] = -half + j * res;
  }
  const idx0 = new Uint32Array((cols - 1) * (rows - 1) * 6);
  let q = 0;
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
    const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
    idx0[q++] = a; idx0[q++] = d; idx0[q++] = b; idx0[q++] = b; idx0[q++] = d; idx0[q++] = e;
  }
  // obstacle thân cây (--level): bundle scatter/tile của engine bằng rolldown rồi chạy cùng luật level (density 1)
  let posAll = pos, idxAll = idx0, obstacles = 0;
  const levelPath = opt('level', null);
  if (levelPath) {
    const { rolldown } = await import('rolldown');
    const { mkdirSync, writeFileSync: wf } = await import('node:fs');
    mkdirSync('.sync', { recursive: true });
    wf('.sync/_nav-veg-entry.ts', "export { scatterSpecies, placementColliders } from '../src/engine/vegetation/scatter';\nexport { navObstacleMesh, navPadFor } from '../src/engine/vegetation/navObstacles';\nexport { TerrainTile } from '../src/engine/terrain/tile';\n");
    const b = await rolldown({ input: './.sync/_nav-veg-entry.ts', resolve: { tsconfigFilename: 'tsconfig.json' } });
    const { output } = await b.generate({ format: 'esm' });
    wf('.sync/_nav-veg.mjs', output[0].code);
    const eng = await import(`${process.cwd()}/.sync/_nav-veg.mjs?t=${Date.now()}`);
    const level = JSON.parse(readFileSync(levelPath, 'utf8'));
    const veg = level.vegetation;
    if (veg) {
      const tile = new eng.TerrainTile(meta, u16, yOff);
      const colliders = [];
      for (const rule of veg.species) {
        if (!rule.collider) continue;
        // biến thể: lấy từ GLB? bake không cần (variant chỉ ảnh hưởng hình); dùng 1
        const pl = eng.scatterSpecies(tile, rule.rect ?? veg.rect, { ...rule, variants: 1 }, veg.seed, veg.cellM ?? 64, 1);
        colliders.push(...eng.placementColliders(pl, rule));
      }
      // chỉ obstacle trong navRect + 4 m
      const inRect = colliders.filter((c) => Math.abs(c.position[0] - rect[0]) <= rect[2] / 2 + 4 && Math.abs(c.position[2] - rect[1]) <= rect[3] / 2 + 4);
      const ob = eng.navObstacleMesh(inRect, { capH: 1.2, sides: 8, radiusPad: (c) => eng.navPadFor(c.id, 0), groundAt: (x, z) => tile.sampleGrid(x, z, step) }); // đệm theo loài (rễ bạnh Tree GN 1 m) // mặt navmesh (lưới 4 m), không phải terrain thật
      obstacles = ob.count;
      posAll = new Float32Array(pos.length + ob.positions.length);
      posAll.set(pos, 0); posAll.set(ob.positions, pos.length);
      idxAll = new Uint32Array(idx0.length + ob.indices.length);
      idxAll.set(idx0, 0);
      const base = pos.length / 3;
      for (let i = 0; i < ob.indices.length; i++) idxAll[idx0.length + i] = ob.indices[i] + base;
    }
  }
  await init();
  const t0 = Date.now();
  // cùng tham số DEFAULT_NAV của engine (walkableRadius 0.4, climb 0.35, slope 50°, height 1.8)
  const r = generateSoloNavMesh(posAll, idxAll, {
    cs, ch,
    walkableRadius: Math.ceil(0.4 / cs), walkableClimb: Math.ceil(0.35 / ch), walkableSlopeAngle: 50, walkableHeight: Math.ceil(1.8 / ch),
    minRegionArea: 8, mergeRegionArea: 20, maxEdgeLen: 12, maxSimplificationError: 1.3, detailSampleDist: 6, detailSampleMaxError: 1,
  });
  if (!r.success) throw new Error(`navmesh: ${r.error}`);
  const data = exportNavMesh(r.navMesh);
  const out = `${dir}/nav.bin`;
  writeFileSync(out, data);
  let polys = 0;
  for (let i = 0; i < r.navMesh.getMaxTiles(); i++) { const hd = r.navMesh.getTile(i).header(); if (hd) polys += hd.polyCount(); }
  const MANIFEST = 'content/assets/manifest.json';
  const m = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const entry = m.assets.find((a) => a.type === 'terrain' && a.files.some((f) => f.path.startsWith(`assets/terrain/${ID}/`)));
  if (entry) {
    const rel = `assets/terrain/${ID}/nav.bin`;
    const f = entry.files.find((x) => x.path === rel) ?? (entry.files.push({ path: rel }), entry.files[entry.files.length - 1]);
    f.bytes = statSync(out).size;
    f.sha256 = createHash('sha256').update(readFileSync(out)).digest('hex');
    m.totalBytes = m.assets.reduce((s, a) => s + a.files.reduce((x, y) => x + y.bytes, 0), 0);
    m.generatedAt = new Date().toISOString();
    writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n');
  } else console.warn(`[terrain] manifest: không thấy entry terrain cho ${ID} — chưa ghi nav.bin vào manifest`);
  console.log(`[terrain] nav ${ID}: rect ${rect.join(' ')} → ${cols}×${rows} đỉnh + ${obstacles} obstacle thân cây, ${polys} poly, ${(data.byteLength / 1024).toFixed(0)} KB, ${((Date.now() - t0) / 1000).toFixed(1)} s → ${out}`);
  process.exit(0);
}

/**
 * Chế độ --map (TIP-UX02): bản đồ giấy 1971 cho minimap/bản đồ chiến thuật từ height.r16 (+ rừng scatter của level)
 *   node scripts/terrain-bake.mjs --map --id truong-son-a [--level content/levels/truong-son-a.level.json] [--px 1024] [--yOffset 691.2]
 * → public/assets/terrain/<id>/map.png: giấy + hillshade + đường đồng mức 20 m (100 m đậm) + màu rừng theo mật độ cây tán; bắc = mép trên.
 */
if (args.includes('--map')) {
  const ID = opt('id', 'truong-son-a');
  const dir = `public/assets/terrain/${ID}`;
  const meta = JSON.parse(readFileSync(`${dir}/meta.json`, 'utf8'));
  const buf = readFileSync(`${dir}/height.r16`);
  const u16 = new Uint16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const n = meta.n, res = meta.resM, size = meta.sizeM, half = size / 2;
  const PX = Number(opt('px', '1024'));
  const hAt = (i, j) => meta.zMin + (u16[Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i))] / 65535) * (meta.zMax - meta.zMin);
  // rừng: mật độ cây tán trên lưới 8 m (scatter engine, density 1)
  const forest = new Float32Array(PX * PX);
  const levelPath = opt('level', null);
  if (levelPath) {
    const { rolldown } = await import('rolldown');
    mkdirSync('.sync', { recursive: true });
    writeFileSync('.sync/_nav-veg-entry.ts', "export { scatterSpecies, placementColliders } from '../src/engine/vegetation/scatter';\nexport { navObstacleMesh } from '../src/engine/vegetation/navObstacles';\nexport { TerrainTile } from '../src/engine/terrain/tile';\n");
    const b = await rolldown({ input: './.sync/_nav-veg-entry.ts', resolve: { tsconfigFilename: 'tsconfig.json' } });
    const { output } = await b.generate({ format: 'esm' });
    writeFileSync('.sync/_nav-veg.mjs', output[0].code);
    const eng = await import(`${process.cwd()}/.sync/_nav-veg.mjs?t=${Date.now()}`);
    const level = JSON.parse(readFileSync(levelPath, 'utf8'));
    const veg = level.vegetation;
    if (veg) {
      const tile = new eng.TerrainTile(meta, u16, 0);
      const tmp = new Float32Array(PX * PX);
      for (const rule of veg.species) {
        if (!rule.collider) continue; // cây thân (tán, cọ, tre)
        const pl = eng.scatterSpecies(tile, rule.rect ?? veg.rect, { ...rule, variants: 1 }, veg.seed, veg.cellM ?? 64, 1);
        const w = /tree/.test(rule.id) ? 1 : 0.5;
        for (let i = 0; i < pl.count; i++) {
          const px = Math.floor(((pl.pos[i * 3] + half) / size) * PX);
          const py = Math.floor(((pl.pos[i * 3 + 2] + half) / size) * PX);
          if (px >= 0 && py >= 0 && px < PX && py < PX) tmp[py * PX + px] += w;
        }
      }
      // làm mờ hộp 9 px hai lần → mảng rừng mềm
      const blur = (src, dst, r) => {
        for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) {
          let s = 0, c = 0;
          for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= PX || yy >= PX) continue;
            s += src[yy * PX + xx]; c++;
          }
          dst[y * PX + x] = s / c;
        }
      };
      const t2 = new Float32Array(PX * PX);
      blur(tmp, t2, 4);
      blur(t2, forest, 4);
      let mx = 0;
      for (let i = 0; i < forest.length; i++) mx = Math.max(mx, forest[i]);
      for (let i = 0; i < forest.length; i++) forest[i] = Math.min(1, (forest[i] / (mx || 1)) * 1.6);
    }
  }
  // hillshade + đồng mức trên lưới PX
  const img = Buffer.alloc(PX * PX * 3);
  const paper = [233, 224, 205];
  const ink = [44, 52, 46];
  const sample = (x, y) => hAt(Math.round((x / PX) * (n - 1)), Math.round((y / PX) * (n - 1)));
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const mPerPx = size / PX;
  for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) {
    const h = sample(x, y);
    const hx = sample(Math.min(PX - 1, x + 1), y) - sample(Math.max(0, x - 1), y);
    const hy = sample(x, Math.min(PX - 1, y + 1)) - sample(x, Math.max(0, y - 1));
    // pháp tuyến (ánh sáng từ tây-bắc, cao 45°)
    const nx = -hx / (2 * mPerPx), ny = -hy / (2 * mPerPx);
    const l = Math.hypot(nx, ny, 1);
    const shade = Math.max(0, (nx * -0.5 + ny * -0.5 + 1 * 0.7071) / l);
    let r = paper[0], g = paper[1], b = paper[2];
    // rừng: tông xanh lục nhạt
    const f = forest[y * PX + x];
    r = r * (1 - f * 0.35) + 150 * f * 0.35;
    g = g * (1 - f * 0.25) + 175 * f * 0.25;
    b = b * (1 - f * 0.45) + 120 * f * 0.45;
    // hillshade nhẹ
    const sh = 0.72 + 0.28 * shade;
    r *= sh; g *= sh; b *= sh;
    // đồng mức: đổi bậc 20 m so với lân cận
    const lvl = Math.floor(h / 20);
    const lx = Math.floor(sample(Math.min(PX - 1, x + 1), y) / 20);
    const ly = Math.floor(sample(x, Math.min(PX - 1, y + 1)) / 20);
    if (lvl !== lx || lvl !== ly) {
      const major = Math.max(lvl, lx, ly) % 5 === 0;
      const k = major ? 0.85 : 0.45;
      r = r * (1 - k) + ink[0] * k; g = g * (1 - k) + ink[1] * k; b = b * (1 - k) + ink[2] * k;
    }
    // hạt giấy
    const gr = (hash(x, y) - 0.5) * 10;
    r += gr; g += gr; b += gr;
    const o = (y * PX + x) * 3;
    img[o] = Math.max(0, Math.min(255, r)); img[o + 1] = Math.max(0, Math.min(255, g)); img[o + 2] = Math.max(0, Math.min(255, b));
  }
  const out = `${dir}/map.png`;
  await sharp(img, { raw: { width: PX, height: PX, channels: 3 } }).png({ compressionLevel: 9, palette: true, colours: 128 }).toFile(out);
  const MANIFEST = 'content/assets/manifest.json';
  const m = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const entry = m.assets.find((a) => a.type === 'terrain' && a.files.some((f) => f.path.startsWith(`assets/terrain/${ID}/`)));
  if (entry) {
    const rel = `assets/terrain/${ID}/map.png`;
    const f = entry.files.find((x) => x.path === rel) ?? (entry.files.push({ path: rel }), entry.files[entry.files.length - 1]);
    f.bytes = statSync(out).size;
    f.sha256 = createHash('sha256').update(readFileSync(out)).digest('hex');
    m.totalBytes = m.assets.reduce((s, a) => s + a.files.reduce((x, y) => x + y.bytes, 0), 0);
    m.generatedAt = new Date().toISOString();
    writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n');
  } else console.warn(`[terrain] manifest: không thấy entry terrain cho ${ID}`);
  console.log(`[terrain] map ${ID}: ${PX}×${PX} (${mPerPx} m/px), rừng ${levelPath ? 'có' : 'không'} → ${out} ${(statSync(out).size / 1024).toFixed(0)} KB`);
  process.exit(0);
}

const HGT = opt('hgt', null);
const LAT = Number(opt('lat', '17.55'));
const LON = Number(opt('lon', '106.10'));
const SIZE = Number(opt('size', '2048'));
const RES = Number(opt('res', '2'));
const ID = opt('id', 'truong-son-a');
const DETAIL = Number(opt('detail', '1.5')); // biên độ nhiễu chi tiết (m)
const SEED = Number(opt('seed', '7'));
if (!HGT) {
  console.error('cần --hgt <file .hgt>');
  process.exit(2);
}
const raw = readFileSync(HGT);
const N = 3601;
if (raw.length !== N * N * 2) throw new Error(`hgt phải là ${N}×${N} int16 (SRTM 1")`);
const tileLat = Math.floor(LAT);
const tileLon = Math.floor(LON);
const h = (r, c) => {
  r = Math.max(0, Math.min(N - 1, r));
  c = Math.max(0, Math.min(N - 1, c));
  const v = raw.readInt16BE((r * N + c) * 2);
  return v === -32768 ? 0 : v; // void → 0 (SRTM void)
};
// mét/độ tại vĩ độ
const mPerDegLat = 111132.92 - 559.82 * Math.cos(2 * (LAT * Math.PI) / 180) + 1.175 * Math.cos(4 * (LAT * Math.PI) / 180);
const mPerDegLon = 111412.84 * Math.cos((LAT * Math.PI) / 180) - 93.5 * Math.cos(3 * (LAT * Math.PI) / 180);
const sample = (lat, lon) => {
  const fr = (tileLat + 1 - lat) * 3600;
  const fc = (lon - tileLon) * 3600;
  const r0 = Math.floor(fr);
  const c0 = Math.floor(fc);
  const tr = fr - r0;
  const tc = fc - c0;
  return (1 - tr) * ((1 - tc) * h(r0, c0) + tc * h(r0, c0 + 1)) + tr * ((1 - tc) * h(r0 + 1, c0) + tc * h(r0 + 1, c0 + 1));
};
// fBm seeded (value noise) — chi tiết procedural, không phải đo đạc
let s = SEED >>> 0 || 1;
const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const G = 256;
const grid = new Float32Array(G * G);
for (let i = 0; i < G * G; i++) grid[i] = rnd() * 2 - 1;
const vnoise = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y);
  const tx = x - xi, ty = y - yi;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const g = (a, b) => grid[(((b % G) + G) % G) * G + (((a % G) + G) % G)];
  return (1 - sy) * ((1 - sx) * g(xi, yi) + sx * g(xi + 1, yi)) + sy * ((1 - sx) * g(xi, yi + 1) + sx * g(xi + 1, yi + 1));
};
const fbm = (x, y) => {
  let a = 0, amp = 1, f = 1, norm = 0;
  for (let o = 0; o < 4; o++) {
    a += amp * vnoise(x * f, y * f);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return a / norm;
};

const n = Math.round(SIZE / RES) + 1;
const out = new Float32Array(n * n);
let zMin = Infinity, zMax = -Infinity;
for (let j = 0; j < n; j++) {
  const dy = (j - (n - 1) / 2) * RES; // +j = nam
  for (let i = 0; i < n; i++) {
    const dx = (i - (n - 1) / 2) * RES; // +i = đông
    const lat = LAT - dy / mPerDegLat;
    const lon = LON + dx / mPerDegLon;
    let z = sample(lat, lon);
    if (DETAIL > 0) z += DETAIL * fbm(i / 24, j / 24) + DETAIL * 0.4 * fbm(i / 6 + 100, j / 6 + 100);
    out[j * n + i] = z;
    if (z < zMin) zMin = z;
    if (z > zMax) zMax = z;
  }
}
const dir = `public/assets/terrain/${ID}`;
mkdirSync(dir, { recursive: true });
const u16 = new Uint16Array(n * n);
const range = zMax - zMin || 1;
for (let i = 0; i < n * n; i++) u16[i] = Math.round(((out[i] - zMin) / range) * 65535);
writeFileSync(`${dir}/height.r16`, Buffer.from(u16.buffer));
const png = Buffer.alloc(n * n);
for (let i = 0; i < n * n; i++) png[i] = u16[i] >> 8;
await sharp(png, { raw: { width: n, height: n, channels: 1 } }).png().toFile(`${dir}/preview.png`);
const meta = {
  id: ID,
  n,
  sizeM: SIZE,
  resM: RES,
  zMin: +zMin.toFixed(2),
  zMax: +zMax.toFixed(2),
  center: { lat: LAT, lon: LON },
  layout: 'row-major, hàng 0 = bắc, cột 0 = tây; height = zMin + u16/65535 × (zMax − zMin)',
  source: { dataset: 'SRTM 1 arc-second (NASA/USGS, public domain) via Terrain Tiles on AWS (skadi)', tile: HGT.split('/').pop(), url: 'https://registry.opendata.aws/terrain-tiles/' },
  detailNoise: DETAIL > 0 ? { amplitudeM: DETAIL, seed: SEED, note: 'chi tiết < 30 m là procedural, không phải đo đạc' } : null,
  sha256: createHash('sha256').update(Buffer.from(u16.buffer)).digest('hex'),
};
writeFileSync(`${dir}/meta.json`, JSON.stringify(meta, null, 2) + '\n');
console.log(`[terrain] ${ID}: ${n}×${n} @ ${RES} m (${SIZE} m), z ${zMin.toFixed(1)}..${zMax.toFixed(1)} m, ${(u16.byteLength / 1048576).toFixed(1)} MB → ${dir}`);
