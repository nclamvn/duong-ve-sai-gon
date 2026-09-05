#!/usr/bin/env node
/**
 * Terrain bake (TIP-D04, PRD TER-001): DEM SRTM 1" (.hgt, 3601×3601, int16 big-endian, 1 tile = 1°×1°) → ô heightmap cho engine.
 *  Đầu vào: --hgt assets-src/dem/N17E106.hgt --lat 17.55 --lon 106.10 --size 2048 (m) --res 2 (m/điểm) --id truong-son-a
 *  Đầu ra:  public/assets/terrain/<id>/height.r16 (Uint16 little-endian, hàng từ bắc xuống nam, cột tây → đông),
 *           public/assets/terrain/<id>/meta.json (n, sizeM, resM, zMin, zMax, origin lat/lon, nguồn), preview.png (8-bit).
 *  Nội suy song tuyến từ lưới 1" (≈ 30,9 m bắc–nam, ≈ 29,5 m đông–tây ở 17,5°) + nhiễu fBm nhỏ (seeded) cho chi tiết < 30 m
 *  (ghi rõ trong meta là "chi tiết procedural", không phải đo đạc).
 * Nguồn DEM: Terrain Tiles on AWS (Mapzen/Nextzen skadi) — SRTM 1" NASA/USGS public domain [KC điều khoản] — ghi manifest.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
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
