#!/usr/bin/env node
/**
 * Khe suối + hố bom trên ô địa hình (DV-060). Tất định, chạy offline, ghi đè height.r16 từ bản gốc DEM.
 *
 *   node scripts/terrain-features.mjs --level content/levels/truong-son-a.level.json [--preview .work/features.png]
 *
 * Đầu vào: content/terrain/<id>.base.r16 (bản sao height.r16 gốc từ terrain-bake; tạo ở lần chạy đầu) + meta.json + khối
 * `terrainFeatures` trong level JSON. Đầu ra: public/assets/terrain/<id>/height.r16 (đã khoét), meta.json (zMin/zMax mới),
 * features.json (lòng suối dạng polyline, hố bom), cập nhật manifest entry terrain_<id>.
 *
 * Khe suối: lấp trũng (priority-flood) → hướng chảy D8 → diện tích lưu vực; ô có lưu vực ≥ minAreaHa là lòng khe.
 * Lòng khe khoét hình chữ U: đáy rộng w, bờ dốc `bank`, đáy không bao giờ đi lên theo chiều nước chảy. Khe có lưu vực
 * ≥ waterAreaHa có nước (tháng 1 mùa khô sườn đông: khe nhỏ cạn, suối lớn còn nước; registry: suối mùa khô lội được).
 * Hố bom: đường kính ~9 m, sâu > 1,5 m (registry: Time 1972 qua kho CIA, tier B), miệng gờ đất; xếp vệt thảm bom B-52
 * (registry: một phi đội rải kín vùng cỡ 1 × 2 km, tier C) và hố lẻ. Hố gần khe hoặc ở chỗ trũng đọng nước (registry:
 * nước ngầm nông → hố đầy nước rất nhanh, tier B).
 * Vùng bảo vệ (spawn, zone, đường waypoint) không khoét sâu để nhiệm vụ và test vật lý không đổi.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d;
};
const LEVEL = opt('level', 'content/levels/truong-son-a.level.json');
const level = JSON.parse(readFileSync(LEVEL, 'utf8'));
const F = level.terrainFeatures;
if (!F) throw new Error(`${LEVEL}: thiếu khối terrainFeatures`);
const ID = level.terrain.id;
const DIR = `public/assets/terrain/${ID}`;
const BASE = `content/terrain/${ID}.base.r16`;
const metaPath = `${DIR}/meta.json`;
const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

// bản gốc: lần đầu chụp lại height.r16 hiện có (chưa khoét) + dải cao độ gốc
if (!existsSync(BASE)) {
  if (meta.features) throw new Error(`${BASE} không có nhưng meta đã khoét — chạy lại terrain-bake trước`);
  mkdirSync(dirname(BASE), { recursive: true });
  writeFileSync(BASE, readFileSync(`${DIR}/height.r16`));
  writeFileSync(`${BASE}.json`, JSON.stringify({ zMin: meta.zMin, zMax: meta.zMax, sha256: sha(BASE), note: 'height.r16 gốc từ terrain-bake (DEM SRTM + nhiễu chi tiết), trước khi khoét khe suối/hố bom' }, null, 2) + '\n');
}
const baseMeta = JSON.parse(readFileSync(`${BASE}.json`, 'utf8'));
const buf = readFileSync(BASE);
const u16 = new Uint16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const n = meta.n, res = meta.resM, half = meta.sizeM / 2;
const N = n * n;
const H = new Float64Array(N);
for (let k = 0; k < N; k++) H[k] = baseMeta.zMin + (u16[k] / 65535) * (baseMeta.zMax - baseMeta.zMin);
// làm mượt nếp gấp lưới 30 m của SRTM nội suy song tuyến (mặt địa hình thành từng tấm phẳng) nhưng giữ chi tiết < smoothDetailM
function gauss(src, sigmaM) {
  const r = Math.max(1, Math.round((3 * sigmaM) / res)), w = [];
  let ws = 0;
  for (let t = -r; t <= r; t++) { const v = Math.exp(-((t * res) ** 2) / (2 * sigmaM * sigmaM)); w.push(v); ws += v; }
  const tmp = new Float64Array(N), dst = new Float64Array(N);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { let a = 0; for (let t = -r; t <= r; t++) a += w[t + r] * src[j * n + Math.min(n - 1, Math.max(0, i + t))]; tmp[j * n + i] = a / ws; }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { let a = 0; for (let t = -r; t <= r; t++) a += w[t + r] * tmp[Math.min(n - 1, Math.max(0, j + t)) * n + i]; dst[j * n + i] = a / ws; }
  return dst;
}
if (F.smoothM) {
  const big = gauss(H, F.smoothM), small = gauss(H, F.smoothDetailM ?? 3);
  for (let k = 0; k < N; k++) H[k] = big[k] + (H[k] - small[k]);
}
const X = (i) => -half + i * res;
const Z = (j) => -half + j * res;

// ───────── PRNG tất định (mulberry32) ─────────
let seedState = (F.seed ?? 1971) >>> 0;
const rnd = () => {
  seedState = (seedState + 0x6d2b79f5) >>> 0;
  let t = seedState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ───────── vùng bảo vệ ─────────
const protect = [];
const P = F.protect ?? {};
protect.push({ x: level.playerSpawn[0], z: level.playerSpawn[1], r: P.spawnM ?? 24 });
for (const v of Object.values(level.botSpawns ?? {})) protect.push({ x: v[0], z: v[1], r: P.botM ?? 8 });
for (const zn of Object.values(level.zones ?? {})) protect.push({ x: zn.center[0], z: zn.center[1], r: zn.radius + (P.zonePadM ?? 6) });
const wps = level.waypoints ?? [];
const corridor = P.corridorM ?? 5;
function segDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const L2 = vx * vx + vz * vz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / L2));
  return Math.hypot(px - (ax + t * vx), pz - (az + t * vz));
}
/** 0 = trong vùng bảo vệ (không khoét), 1 = tự do; mềm dần trên 10 m */
function freedom(x, z) {
  let f = 1;
  for (const p of protect) f = Math.min(f, Math.max(0, Math.min(1, (Math.hypot(x - p.x, z - p.z) - p.r) / 10)));
  for (let k = 0; k + 1 < wps.length; k++) f = Math.min(f, Math.max(0, Math.min(1, (segDist(x, z, wps[k][0], wps[k][1], wps[k + 1][0], wps[k + 1][1]) - corridor) / 10)));
  return f;
}

// ───────── 1. lấp trũng: priority-flood (Barnes 2014) với epsilon ─────────
const filled = Float64Array.from(H);
{
  const closed = new Uint8Array(N);
  const heap = new Int32Array(N);
  let hn = 0;
  const less = (a, b) => filled[a] < filled[b];
  const push = (k) => {
    let i = hn++;
    heap[i] = k;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!less(heap[i], heap[p])) break;
      [heap[i], heap[p]] = [heap[p], heap[i]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    heap[0] = heap[--hn];
    let i = 0;
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let m = i;
      if (l < hn && less(heap[l], heap[m])) m = l;
      if (r < hn && less(heap[r], heap[m])) m = r;
      if (m === i) break;
      [heap[i], heap[m]] = [heap[m], heap[i]];
      i = m;
    }
    return top;
  };
  for (let i = 0; i < n; i++) for (const j of [0, n - 1]) { const k = j * n + i; if (!closed[k]) { closed[k] = 1; push(k); } }
  for (let j = 0; j < n; j++) for (const i of [0, n - 1]) { const k = j * n + i; if (!closed[k]) { closed[k] = 1; push(k); } }
  while (hn) {
    const c = pop();
    const ci = c % n, cj = (c / n) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= n || j >= n) continue;
      const k = j * n + i;
      if (closed[k]) continue;
      closed[k] = 1;
      if (filled[k] <= filled[c]) filled[k] = filled[c] + 1e-4;
      push(k);
    }
  }
}

// ───────── 2. hướng chảy D8 + diện tích lưu vực ─────────
const down = new Int32Array(N).fill(-1);
for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
  const k = j * n + i;
  let best = 0, bk = -1;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    if (!di && !dj) continue;
    const ii = i + di, jj = j + dj;
    if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
    const kk = jj * n + ii;
    const s = (filled[k] - filled[kk]) / (di && dj ? Math.SQRT2 : 1);
    if (s > best) { best = s; bk = kk; }
  }
  down[k] = bk;
}
const order = Array.from({ length: N }, (_, k) => k).sort((a, b) => filled[b] - filled[a]);
const acc = new Float64Array(N).fill(res * res);
for (const k of order) if (down[k] >= 0) acc[down[k]] += acc[k];
const ha = (k) => acc[k] / 10000;

// ───────── 3. lòng khe: vết từ nguồn xuôi dòng ─────────
const S = F.streams ?? {};
const minHa = S.minAreaHa ?? 6;
const waterHa = S.waterAreaHa ?? 40;
const border = 8;
const isStream = (k) => ha(k) >= minHa;
const visited = new Uint8Array(N);
const streams = [];
const nUp = new Uint16Array(N);
for (let k = 0; k < N; k++) if (isStream(k) && down[k] >= 0 && isStream(down[k])) nUp[down[k]]++;
for (const k0 of order) {
  if (!isStream(k0) || nUp[k0] !== 0 || visited[k0]) continue;
  const pts = [];
  let k = k0;
  for (;;) {
    const i = k % n, j = (k / n) | 0;
    if (i < border || j < border || i >= n - border || j >= n - border) break;
    pts.push(k);
    if (visited[k]) break; // nhập vào dòng đã vẽ: giữ điểm hợp lưu rồi dừng
    visited[k] = 1;
    if (down[k] < 0 || !isStream(down[k])) break;
    k = down[k];
  }
  if (pts.length >= 4) streams.push(pts);
}
// hình học từng khe: rộng/sâu theo lưu vực; đáy không đi lên xuôi dòng
const widthOf = (A) => Math.min(S.maxWidthM ?? 7, (S.minWidthM ?? 1.4) + (S.widthPerLogHa ?? 1.6) * Math.log10(Math.max(1, A / minHa)) * 2);
const depthOf = (A) => Math.min(S.maxDepthM ?? 2.4, (S.minDepthM ?? 0.7) + (S.depthPerLogHa ?? 0.55) * Math.log10(Math.max(1, A / minHa)) * 2);
const outStreams = [];
const target = Float64Array.from(H); // cao độ sau khoét = min(H, mặt cắt khe)
const bank = S.bankSlope ?? 0.7;
for (const pts of streams) {
  let bed = Infinity;
  const nodes = [];
  for (const k of pts) {
    const i = k % n, j = (k / n) | 0, A = ha(k);
    const x = X(i), z = Z(j);
    const f = freedom(x, z);
    const d = depthOf(A) * (0.25 + 0.75 * f); // trong vùng bảo vệ chỉ còn rãnh nông (ngầm lội qua)
    // đáy không đi lên xuôi dòng, nhưng không xẻ quá sâu qua yên ngựa của DEM đã lấp trũng (tối đa d + maxExtraCutM dưới mặt đất)
    bed = Math.max(Math.min(bed, H[k] - d), H[k] - d - (S.maxExtraCutM ?? 0.8));
    nodes.push({ x, z, bed, w: widthOf(A), A, d });
  }
  // thưa điểm (mỗi ~4 ô) cho polyline nhẹ, giữ điểm cuối
  const keep = nodes.filter((_, q) => q % 4 === 0 || q === nodes.length - 1);
  outStreams.push({
    w: +Math.max(...nodes.map((v) => v.w)).toFixed(2),
    areaHa: +Math.max(...nodes.map((v) => v.A)).toFixed(1),
    water: Math.max(...nodes.map((v) => v.A)) >= waterHa,
    pts: keep.map((v) => [+v.x.toFixed(2), +v.z.toFixed(2), +v.bed.toFixed(3), +v.w.toFixed(2)]),
  });
  // khoét: mỗi đoạn, quét ô trong bán kính ảnh hưởng
  for (let q = 0; q + 1 < nodes.length; q++) {
    const a = nodes[q], b = nodes[q + 1];
    const R = Math.max(a.w, b.w) / 2 + (Math.max(a.d, b.d) + 1.5) / bank;
    const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - R + half) / res)), i1 = Math.min(n - 1, Math.ceil((Math.max(a.x, b.x) + R + half) / res));
    const j0 = Math.max(0, Math.floor((Math.min(a.z, b.z) - R + half) / res)), j1 = Math.min(n - 1, Math.ceil((Math.max(a.z, b.z) + R + half) / res));
    const vx = b.x - a.x, vz = b.z - a.z, L2 = vx * vx + vz * vz || 1;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = X(i), z = Z(j);
      const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / L2));
      const dist = Math.hypot(x - (a.x + t * vx), z - (a.z + t * vz));
      const w = a.w + (b.w - a.w) * t, bedY = a.bed + (b.bed - a.bed) * t;
      // đáy chữ U có lòng hơi lõm (đá cuội giữa dòng sâu hơn mép)
      const hw = w / 2;
      const prof = dist <= hw ? bedY + 0.15 * (dist / hw) ** 2 : bedY + 0.15 + (dist - hw) * bank;
      const k = j * n + i;
      if (prof < target[k]) target[k] = prof;
    }
  }
}

// ───────── 4. hố bom ─────────
const C = F.craters ?? {};
const craters = [];
const rR = C.radiusM ?? [3.8, 5.2];
const rD = C.depthM ?? [1.6, 2.4];
const tooClose = (x, z, r) => craters.some((c) => Math.hypot(c.x - x, c.z - z) < (c.r + r) * 0.9);
const tryAdd = (x, z, kind) => {
  if (Math.abs(x) > half - 20 || Math.abs(z) > half - 20) return;
  const r = rR[0] + (rR[1] - rR[0]) * rnd();
  if (freedom(x, z) < 1 || freedom(x + r * 1.8, z) < 1 || freedom(x - r * 1.8, z) < 1 || freedom(x, z + r * 1.8) < 1 || freedom(x, z - r * 1.8) < 1) return;
  if (tooClose(x, z, r)) return;
  const depth = rD[0] + (rD[1] - rD[0]) * rnd();
  craters.push({ x, z, r, depth, kind });
};
for (const s of C.strips ?? []) {
  const [ax, az] = s.from, [bx, bz] = s.to;
  const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
  for (let q = 0; q < s.count * 3 && craters.filter((c) => c.kind === s.id).length < s.count; q++) {
    const t = rnd() * L, o = (rnd() - 0.5) * s.widthM;
    tryAdd(ax + ux * t - uz * o, az + uz * t + ux * o, s.id);
  }
}
for (const s of C.scattered ?? []) {
  const [cx, cz, w, h] = [s.rect.x, s.rect.z, s.rect.w, s.rect.h];
  for (let q = 0; q < s.count * 4 && craters.filter((c) => c.kind === s.id).length < s.count; q++) tryAdd(cx + (rnd() - 0.5) * w, cz + (rnd() - 0.5) * h, s.id);
}
// khoảng cách tới khe gần nhất (để quyết hố đọng nước)
const streamPts = outStreams.flatMap((s) => s.pts.map((p) => [p[0], p[1]]));
const nearStream = (x, z) => streamPts.reduce((m, p) => Math.min(m, Math.hypot(p[0] - x, p[1] - z)), Infinity);
const rim = C.rimM ?? 0.45;
for (const c of craters) {
  const R = c.r * 1.8;
  const i0 = Math.max(0, Math.floor((c.x - R + half) / res)), i1 = Math.min(n - 1, Math.ceil((c.x + R + half) / res));
  const j0 = Math.max(0, Math.floor((c.z - R + half) / res)), j1 = Math.min(n - 1, Math.ceil((c.z + R + half) / res));
  let rimSum = 0, rimN = 0;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const d = Math.hypot(X(i) - c.x, Z(j) - c.z) / c.r;
    let dh = 0;
    if (d < 1) dh = -c.depth * (1 - d * d) + rim * d * d; // bát, liền mạch với gờ tại mép
    else if (d < 1.8) dh = rim * Math.cos(((d - 1) / 0.8) * (Math.PI / 2)) ** 2;
    const k = j * n + i;
    target[k] += dh;
    H[k] += dh;
    if (d > 0.95 && d < 1.1) { rimSum += target[k]; rimN++; }
  }
  // đáy hố (sau khi khoét) và mặt nước
  const ci = Math.round((c.x + half) / res), cj = Math.round((c.z + half) / res);
  c.bottom = target[cj * n + ci];
  const wet = nearStream(c.x, c.z) < (C.waterNearStreamM ?? 70) || rnd() < (C.waterChance ?? 0.25);
  const rimMin = rimN ? rimSum / rimN : c.bottom + c.depth;
  c.waterY = wet ? Math.min(c.bottom + Math.min(0.7, c.depth * 0.4), rimMin - 0.3) : null;
}

// ───────── 5. ghi height.r16 + meta + features.json ─────────
let zMin = Infinity, zMax = -Infinity;
for (let k = 0; k < N; k++) { zMin = Math.min(zMin, target[k]); zMax = Math.max(zMax, target[k]); }
zMin = Math.floor(zMin * 100) / 100;
zMax = Math.ceil(zMax * 100) / 100;
const out = new Uint16Array(N);
for (let k = 0; k < N; k++) out[k] = Math.max(0, Math.min(65535, Math.round(((target[k] - zMin) / (zMax - zMin)) * 65535)));
writeFileSync(`${DIR}/height.r16`, Buffer.from(out.buffer));
// đường mòn nhiệm vụ (spawn → waypoint): thực vật có collider tránh để đội hình đi được (đường mòn bộ đội được phát quang)
const trail = [[level.playerSpawn[0], level.playerSpawn[1]], ...wps.map((w) => [w[0], w[1]])];
const features = {
  id: ID,
  trail,
  note: 'DV-060: khe suối dò từ DEM (priority-flood + D8) và hố bom; toạ độ x/z engine (m, +x đông, −z bắc), y tuyệt đối (m, engine trừ yOffset)',
  streams: outStreams,
  craters: craters.map((c) => ({ x: +c.x.toFixed(2), z: +c.z.toFixed(2), r: +c.r.toFixed(2), depth: +c.depth.toFixed(2), bottom: +c.bottom.toFixed(3), waterY: c.waterY === null ? null : +c.waterY.toFixed(3), kind: c.kind })),
};
writeFileSync(`${DIR}/features.json`, JSON.stringify(features) + '\n');
meta.zMin = zMin;
meta.zMax = zMax;
meta.features = { file: 'features.json', base: BASE, baseSha256: baseMeta.sha256, streams: outStreams.length, craters: craters.length, script: 'scripts/terrain-features.mjs' };
meta.sha256 = sha(`${DIR}/height.r16`);
writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');

// manifest entry terrain_<id>
const MANIFEST = 'content/assets/manifest.json';
const m = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const e = m.assets.find((a) => a.id === `terrain_${ID.replace(/-/g, '_')}`);
if (e) {
  for (const rel of ['height.r16', 'meta.json', 'features.json']) {
    const p = `${DIR}/${rel}`, path = p.replace(/^public\//, '');
    const f = { path, bytes: statSync(p).size, sha256: sha(p) };
    const i = e.files.findIndex((x) => x.path === path);
    if (i >= 0) e.files[i] = f; else e.files.push(f);
  }
  e.sourceFiles = (e.sourceFiles ?? []).filter((s) => s.path !== BASE);
  e.sourceFiles.push({ path: BASE, bytes: statSync(BASE).size, sha256: sha(BASE) });
  m.totalBytes = m.assets.reduce((s, a) => s + a.files.reduce((t, f) => t + f.bytes, 0), 0);
  m.generatedAt = new Date().toISOString();
  writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n');
}
const wet = outStreams.filter((s) => s.water);
console.log(`[features] ${ID}: ${outStreams.length} khe (${wet.length} có nước, lưu vực lớn nhất ${Math.max(...outStreams.map((s) => s.areaHa)).toFixed(0)} ha), ${craters.length} hố bom (${craters.filter((c) => c.waterY !== null).length} đọng nước); z ${zMin}…${zMax}`);

// ảnh xem nhanh (tuỳ chọn): hillshade + khe + hố
const prev = opt('preview', null);
if (prev) {
  const { default: sharp } = await import('sharp');
  const img = Buffer.alloc(n * n * 3);
  for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
    const k = j * n + i;
    const dx = (target[k + 1] - target[k - 1]) / (2 * res), dz = (target[k + n] - target[k - n]) / (2 * res);
    const l = Math.max(0, Math.min(1, 0.6 + (-dx * 0.6 - dz * 0.6) * 0.8));
    img[k * 3] = img[k * 3 + 1] = img[k * 3 + 2] = Math.round(l * 230);
  }
  const dot = (x, z, rgb, rad = 1) => {
    const ci = Math.round((x + half) / res), cj = Math.round((z + half) / res);
    for (let dj = -rad; dj <= rad; dj++) for (let di = -rad; di <= rad; di++) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= n || j >= n) continue;
      img.set(rgb, (j * n + i) * 3);
    }
  };
  for (const s of outStreams) for (let q = 0; q + 1 < s.pts.length; q++) {
    const [ax, az] = s.pts[q], [bx, bz] = s.pts[q + 1];
    for (let t = 0; t <= 1; t += 0.1) dot(ax + (bx - ax) * t, az + (bz - az) * t, s.water ? [40, 110, 230] : [120, 170, 230], s.water ? 1 : 0);
  }
  for (const c of craters) dot(c.x, c.z, c.waterY !== null ? [30, 60, 200] : [200, 60, 40], 2);
  for (const p of protect) dot(p.x, p.z, [40, 200, 60], 2);
  await sharp(img, { raw: { width: n, height: n, channels: 3 } }).png().toFile(prev);
  console.log(`[features] preview → ${prev}`);
}
