#!/usr/bin/env node
/**
 * Bản đồ dàn cảnh M1 (DV-085): bóng đổ địa hình trong navRect + khe suối (xanh), hố bom (nâu), vùng nhiệm vụ (vòng trắng có tên),
 * điểm ra quân (chấm: đỏ địch, xanh tổ ta), điểm xuất phát người chơi (vàng). Dùng để đặt điểm khi viết kịch bản.
 * Dùng: node scripts/m1-map.mjs [out.png] [--scale 2] [--rect x0,z0,x1,z1]
 */
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const args = process.argv.slice(2);
const out = args.find((a) => a.endsWith('.png')) ?? 'm1-map.png';
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const DIR = 'public/assets/terrain/truong-son-a';
const meta = JSON.parse(readFileSync(`${DIR}/meta.json`, 'utf8'));
const buf = readFileSync(`${DIR}/height.r16`);
const u16 = new Uint16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const level = JSON.parse(readFileSync('content/levels/truong-son-a.level.json', 'utf8'));
const mission = JSON.parse(readFileSync('content/missions/truong-son-a.mission.json', 'utf8'));
const feats = JSON.parse(readFileSync(`${DIR}/features.json`, 'utf8'));
const nr = level.terrain.navRect;
const [rx0, rz0, rx1, rz1] = (opt('rect', null) ?? `${nr.x - nr.w / 2},${nr.z - nr.h / 2},${nr.x + nr.w / 2},${nr.z + nr.h / 2}`).split(',').map(Number);
const S = Number(opt('scale', 2)); // px / m
const W = Math.round((rx1 - rx0) * S);
const H = Math.round((rz1 - rz0) * S);
const n = meta.n;
const half = meta.sizeM / 2;
const h = (x, z) => {
  const i = Math.min(n - 1, Math.max(0, Math.round((x + half) / meta.resM)));
  const j = Math.min(n - 1, Math.max(0, Math.round((z + half) / meta.resM)));
  return meta.zMin + (u16[j * n + i] / 65535) * (meta.zMax - meta.zMin);
};
const img = Buffer.alloc(W * H * 3);
for (let py = 0; py < H; py++) {
  for (let px = 0; px < W; px++) {
    const x = rx0 + px / S;
    const z = rz0 + py / S;
    const dx = h(x + 2, z) - h(x - 2, z);
    const dz = h(x, z + 2) - h(x, z - 2);
    const shade = Math.max(0, Math.min(1, 0.6 + (-dx * 0.7 - dz * 0.7) / 8));
    const e = (h(x, z) - 600) / 200;
    const o = (py * W + px) * 3;
    img[o] = Math.round(70 + 120 * shade + 30 * e);
    img[o + 1] = Math.round(90 + 120 * shade + 20 * e);
    img[o + 2] = Math.round(60 + 90 * shade);
  }
}
const yo = level.terrain.yOffset ?? 0;
const svg = [];
const X = (x) => ((x - rx0) * S).toFixed(1);
const Z = (z) => ((z - rz0) * S).toFixed(1);
for (const s of feats.streams) {
  if (!s.pts?.length) continue;
  svg.push(`<polyline fill="none" stroke="${s.water ? '#3aa0ff' : '#7a9ab0'}" stroke-width="${s.water ? 3 : 1.5}" points="${s.pts.map((p) => `${X(p[0])},${Z(p[1])}`).join(' ')}"/>`);
}
for (const c of feats.craters) svg.push(`<circle cx="${X(c.x)}" cy="${Z(c.z)}" r="${(c.r * S).toFixed(1)}" fill="${c.waterY !== null ? '#2a6fb0' : '#6a4a2a'}" fill-opacity="0.6"/>`);
for (const zn of mission.zones ?? []) {
  svg.push(`<circle cx="${X(zn.center[0])}" cy="${Z(zn.center[2])}" r="${(zn.radius * S).toFixed(1)}" fill="none" stroke="#fff" stroke-width="1.5" stroke-dasharray="4 3"/>`);
  svg.push(`<text x="${X(zn.center[0])}" y="${Z(zn.center[2])}" font-size="13" fill="#fff" font-family="sans-serif" text-anchor="middle">${zn.id}</text>`);
}
const groups = new Map();
for (const g of mission.spawnGroups ?? []) for (const s of [...(g.spawns ?? []), g.spawn]) groups.set(s, g.faction === 'friend' || g.archetype === 'squad' ? 'friend' : 'enemy');
for (const [k, p] of Object.entries(level.botSpawns)) {
  const f = groups.get(k);
  svg.push(`<circle cx="${X(p[0])}" cy="${Z(p[p.length - 1])}" r="3.5" fill="${f === 'friend' ? '#3cff6a' : f === 'enemy' ? '#ff3b3b' : '#bbbbbb'}"/>`);
  if (f) svg.push(`<text x="${(+X(p[0]) + 5).toFixed(1)}" y="${(+Z(p[p.length - 1]) - 4).toFixed(1)}" font-size="9" fill="#ffd" font-family="sans-serif">${k}</text>`);
}
const ps = level.playerSpawn;
svg.push(`<circle cx="${X(ps[0])}" cy="${Z(ps[ps.length - 1])}" r="6" fill="#ffd400" stroke="#000"/>`);
// lưới 50 m
for (let x = Math.ceil(rx0 / 50) * 50; x <= rx1; x += 50) svg.push(`<line x1="${X(x)}" y1="0" x2="${X(x)}" y2="${H}" stroke="#000" stroke-opacity="0.25"/><text x="${(+X(x) + 2).toFixed(1)}" y="12" font-size="10" fill="#000">${x}</text>`);
for (let z = Math.ceil(rz0 / 50) * 50; z <= rz1; z += 50) svg.push(`<line x1="0" y1="${Z(z)}" x2="${W}" y2="${Z(z)}" stroke="#000" stroke-opacity="0.25"/><text x="2" y="${(+Z(z) - 2).toFixed(1)}" font-size="10" fill="#000">${z}</text>`);
const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${svg.join('')}</svg>`);
await sharp(img, { raw: { width: W, height: H, channels: 3 } }).composite([{ input: overlay }]).png().toFile(out);
console.log(`[m1-map] ${out} ${W}×${H} (${rx0},${rz0})→(${rx1},${rz1}) yOffset ${yo}`);
