#!/usr/bin/env node
/**
 * Sinh content/levels/diem-cao-31.level.json (M2 R1 — "Điểm cao 31" đêm 24/2/1971, Blueprint G2 / DV-047).
 * Bố trí FSB theo mẫu căn cứ hoả lực Mỹ-VNCH chuẩn (rào 3 lớp cung SW, hào bao cát, hầm M60, hầm chỉ huy trên đỉnh, bãi
 * trực thăng NE, 2 vị trí 105 mm) — KHÔNG theo sơ đồ thật (kịch bản §1). Đỉnh 541 m tại (18, −146) hệ ô diem-cao-31; người chơi
 * xuất phát ở yên ngựa SW (−402, 274). Chạy: node scripts/gen-level-diem-cao-31.mjs  (sau đó terrain-bake --map/--nav)
 */
import { writeFileSync } from 'node:fs';

const P = [18, -146]; // đỉnh
const SPAWN = [-402, 274];
const Y_OFFSET = 396.7; // cao độ yên ngựa SW → spawn ≈ 0; đỉnh ≈ +144,6
const dir = [P[0] - SPAWN[0], P[1] - SPAWN[1]];
const dl = Math.hypot(dir[0], dir[1]);
const u = [dir[0] / dl, dir[1] / dl]; // đơn vị spawn → đỉnh (≈ NE)
const angSW = Math.atan2(u[0], u[1]); // yaw có forward = −u (từ đỉnh về spawn; forward(yaw) = (−sin, −cos))
const r2 = (v) => Math.round(v * 10) / 10;
const polar = (r, ang) => [r2(P[0] - Math.sin(ang) * r), r2(P[1] - Math.cos(ang) * r)]; // điểm cách đỉnh r theo hướng yaw ang

const props = [];
let pid = 0;
const add = (kind, pos, yaw, extra = {}) => props.push({ id: `${kind}_${pid++}`, kind, position: pos, yaw: r2(yaw), ...extra });

// 3 lớp rào concertina — cung ±52° quanh hướng SW, đoạn 6 m; id theo lớp để bộc phá gỡ đoạn giữa (w1/w2/w3 = đoạn trên trục)
const wireIds = {};
for (const [li, r] of [[1, 100], [2, 88], [3, 76]]) {
  const span = (52 * Math.PI) / 180;
  let n = Math.round((2 * span * r) / 6);
  if (n % 2) n++; // chẵn → đúng một đoạn nằm trên trục (i = n/2) = đoạn bộc phá gỡ
  for (let i = 0; i <= n; i++) {
    const a = angSW - span + (2 * span * i) / n;
    const pos = polar(r, a);
    const yaw = a; // trục dài (x local) của đoạn rào theo tiếp tuyến cung: x' = (cos θ, −sin θ) ∥ (−cos a, sin a) ↔ θ = a
    const onAxis = i === n / 2;
    const id = onAxis ? `wire_${li}_gap` : `wire_${li}_${i}`;
    props.push({ id, kind: 'wire', position: pos, yaw: r2(yaw), len: 6.4 });
    if (onAxis) wireIds[`w${li}`] = id;
  }
}
// hào bao cát cung r 58 ±45°, tường 2,94 m mỗi 3,1 m
{
  const r = 58;
  const span = (45 * Math.PI) / 180;
  const n = Math.round((2 * span * r) / 3.1);
  for (let i = 0; i <= n; i++) {
    const a = angSW - span + (2 * span * i) / n;
    add('sandbag', polar(r, a), a);
  }
}
// hầm M60 (trái, −24°): vòng bao cát 8 đoạn r 3,2
const mgC = polar(64, angSW - (24 * Math.PI) / 180);
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2;
  if (i === 6) continue; // cửa sau
  add('sandbag', [r2(mgC[0] - Math.sin(a) * 3.2), r2(mgC[1] - Math.cos(a) * 3.2)], a);
}
add('crate', [r2(mgC[0] + 1.2), r2(mgC[1] + 0.8)], 0.4);
// hầm cối (phải, +28°)
const moC = polar(60, angSW + (28 * Math.PI) / 180);
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2;
  if (i === 5) continue;
  add('sandbag', [r2(moC[0] - Math.sin(a) * 3.0), r2(moC[1] - Math.cos(a) * 3.0)], a);
}
add('ammo', [r2(moC[0]), r2(moC[1] + 0.6)], 1.1);
add('ammo', [r2(moC[0] + 0.9), r2(moC[1] - 0.4)], 2.0);
// hầm chỉ huy trên đỉnh: vòng bao cát r 5 (12 đoạn, cửa về NE) + thùng + ăng-ten (utility box)
for (let i = 0; i < 12; i++) {
  const a = (i / 12) * Math.PI * 2;
  if (i === 1 || i === 2) continue;
  add('sandbag', [r2(P[0] - Math.sin(a) * 5), r2(P[1] - Math.cos(a) * 5)], a);
}
add('crate', [r2(P[0] - 1.5), r2(P[1] + 1.2)], 0.3);
add('crate', [r2(P[0] + 1.8), r2(P[1] + 1.6)], 1.9);
add('radio', [r2(P[0] + 0.5), r2(P[1] - 2.2)], 0);
add('barrel', [r2(P[0] - 2.8), r2(P[1] - 1.5)], 0);
// 2 vị trí 105 mm (thùng + bao cát vòng r 4) hai bên đỉnh
for (const [dx, dz] of [[-34, 18], [34, 22]]) {
  const c = [P[0] + dx, P[1] + dz];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    if (i === 0) continue;
    add('sandbag', [r2(c[0] - Math.sin(a) * 4), r2(c[1] - Math.cos(a) * 4)], a);
  }
  add('crate', [r2(c[0] + 1), r2(c[1] - 1)], 0.7);
  add('ammo', [r2(c[0] - 1.4), r2(c[1] + 0.8)], 2.4);
  add('ammo', [r2(c[0] - 0.4), r2(c[1] + 1.6)], 0.9);
}
// bãi trực thăng NE (thùng, phuy)
const lz = [P[0] + 46, P[1] - 40];
add('barrel', [lz[0] + 6, lz[1] + 5], 0);
add('barrel', [lz[0] + 7.2, lz[1] + 5.6], 0);
add('crate', [lz[0] - 6, lz[1] + 4], 0.5);
add('crate', [lz[0] - 5, lz[1] + 6.2], 2.2);
// bao cát rải trong hào phía sau (đỉnh) — vài ụ
for (const [dx, dz, y] of [[-12, 4, 0.3], [14, 6, 2.6], [-4, 14, 1.2], [8, -12, 0.8]]) add('sandbag', [P[0] + dx, P[1] + dz], y);

// spawn bot
const botSpawns = {};
botSpawns['sq_quyet'] = [r2(SPAWN[0] + u[0] * 4), r2(SPAWN[1] + u[1] * 4)];
botSpawns['sq_hai'] = [r2(SPAWN[0] - u[1] * 3 - u[0] * 2), r2(SPAWN[1] + u[0] * 3 - u[1] * 2)];
botSpawns['sq_sang'] = [r2(SPAWN[0] + u[1] * 3 - u[0] * 2), r2(SPAWN[1] - u[0] * 3 - u[1] * 2)];
botSpawns['mg_a'] = [r2(mgC[0] - 0.8), r2(mgC[1] - 0.6)];
botSpawns['mg_b'] = [r2(mgC[0] + 1.0), r2(mgC[1] + 0.9)];
for (let i = 0; i < 6; i++) {
  const a = angSW - (38 * Math.PI) / 180 + ((76 * Math.PI) / 180) * (i / 5);
  botSpawns[`tr_${i}`] = polar(53, a); // sau hào 5 m
}
for (let i = 0; i < 5; i++) {
  const a = angSW - (60 * Math.PI) / 180 + ((120 * Math.PI) / 180) * (i / 4);
  botSpawns[`top_${i}`] = polar(16, a);
}
botSpawns['cp_a'] = [r2(P[0] + 2), r2(P[1] - 3)];
botSpawns['cp_b'] = [r2(P[0] - 3), r2(P[1] + 2)];

// waypoints tuần tra địch (cung hào)
const waypoints = [];
for (let i = 0; i < 7; i++) {
  const a = angSW - (40 * Math.PI) / 180 + ((80 * Math.PI) / 180) * (i / 6);
  waypoints.push(polar(50, a));
}
const cover = [];
for (let i = 0; i < 6; i++) {
  const a = angSW - (38 * Math.PI) / 180 + ((76 * Math.PI) / 180) * (i / 5);
  const p = polar(55, a);
  cover.push({ id: `tr_c${i}`, position: p, facing: [r2(-Math.sin(a)), 0, r2(-Math.cos(a))] });
}

const zones = {
  spawn: { center: SPAWN, radius: 14 },
  foot_31: { center: [r2(SPAWN[0] + u[0] * 60), r2(SPAWN[1] + u[1] * 60)], radius: 22 },
  w1: { center: polar(103, angSW), radius: 9 },
  w2: { center: polar(91, angSW), radius: 8 },
  w3: { center: polar(79, angSW), radius: 8 },
  mg: { center: mgC, radius: 7 },
  trench: { center: polar(56, angSW), radius: 16 },
  cp: { center: P, radius: 9 },
  top: { center: P, radius: 32 },
  lz: { center: lz, radius: 18 },
};

const level = {
  $schema: '../schemas/terrain-level.schema.json',
  id: 'diem-cao-31',
  name: 'Điểm cao 31 — Đường 9, đêm 24/2/1971',
  terrain: { id: 'diem-cao-31', yOffset: Y_OFFSET, navRect: { x: -160, z: 60, w: 700, h: 700 }, wetness: 0.05, tileMeters: 4, tint: 0x9a8a62 },
  camera: { near: 0.25, far: 2600 },
  sky: {
    $comment:
      'Đêm 24/2/1971, trăng hạ tuần (KC pha trăng — nếu không trăng: hạ sun xuống 0,08). HDRI dikhololo_night (CC0 Poly Haven — đồng cỏ, sao, không đèn; blue_lagoon_night có đèn cảng nên bỏ). Sương thung lũng dày; CSM ngắn. Pháo sáng của địch = engine/render/flares (đèn trắng-vàng rơi chậm, đung đưa) — mission bật bằng flag `flares`.',
    hdri: 'dikhololo_night',
    res: '2k',
    envIntensity: 0.12,
    skyIntensity: 0.22,
    sun: { azimuthDeg: 250, elevationDeg: 34, color: 0xa9bddf, intensity: 0.28 },
    hemi: { sky: 0x1a2438, ground: 0x0c0d0a, intensity: 0.26 },
    fog: { color: 0x090d13, density: 0.0028 },
    csm: { cascades: 3, maxFar: 120, mapSize: 2048 },
  },
  layers: { leaves: 'brown_mud_leaves_01', mud: 'brown_mud_03', rock: 'aerial_rocks_02', grass: 'aerial_grass_rock' },
  textures: ['brown_mud_leaves_01', 'brown_mud_03', 'aerial_rocks_02', 'aerial_grass_rock'],
  models: ['prop_sandbag_05', 'prop_sandbag_02', 'old_military_crate', 'ammo_box', 'Barrel_01', 'utility_box_01'],
  props,
  vegetation: {
    $comment:
      'Đồi 31 = đồi trọc cỏ tranh + cây bụi thưa, yên ngựa (hồi ức [H]) — không phải rừng già. Cỏ tranh (grass_tall 1,5–2,2 m, đè theo người) phủ dày dưới cao độ 0,93 (đỉnh đã phát quang r ≈ 90 m); cây tán (khộp) 6/ha, tre 4/ha, bụi dương xỉ.',
    seed: 1971,
    cellM: 64,
    wind: 0.22,
    rect: { x: -160, z: 60, w: 1024, h: 1024 },
    species: [
      { id: 'tree_gn', perHa: 6, slope: [0, 0.6], height: [0, 0.9], scale: [0.7, 1.1], noise: { scale: 0.005, min: 0.3 }, lod: [32, 100, 170, 600], cast: true, collider: { radius: 0.45, height: 6 }, sink: [0.35, 2.0] },
      { id: 'bamboo', perHa: 4, slope: [0, 0.5], height: [0, 0.85], scale: [0.85, 1.15], noise: { scale: 0.008, min: 0.5, offset: 120 }, clump: { count: [2, 4], radius: 2.5 }, lod: [35, 90, 200, 400], cast: true, collider: { radius: 0.35, height: 4 }, sink: [0.15, 1.2] },
      { id: 'grass_tall', perHa: 9000, slope: [0, 0.65], height: [0, 0.93], scale: [0.8, 1.2], noise: { scale: 0.02, min: 0.05, offset: 1700 }, lod: [18, 34, 60, 60], rect: { x: -160, z: 60, w: 760, h: 760 }, sink: [0.05, 0.4], press: 1 },
      { id: 'fern_grass', perHa: 300, slope: [0, 0.6], scale: [0.8, 1.4], noise: { scale: 0.025, min: 0.35, offset: 1300 }, lod: [12, 26, 55, 55], rect: { x: -160, z: 60, w: 760, h: 760 }, sink: [0.03, 0.6] },
    ],
  },
  fx: [
    { $comment: 'gốc cây/xe cháy sau pháo chuẩn bị, sườn SW', kind: 'fire', position: polar(70, angSW - 0.9), dy: 0, scale: 1.4 },
    { kind: 'fire', position: polar(30, angSW + 1.3), dy: 0, scale: 1.1 },
    { kind: 'smoke', position: polar(20, angSW + 0.4), dy: 0, scale: 3, height: 60, color: 0x1c1a17 },
    { kind: 'smoke', position: [P[0] + 120, P[1] + 60], dy: 0, scale: 4, height: 90, color: 0x171614 },
    { kind: 'embers', position: polar(70, angSW - 0.9), dy: 1, scale: 1 },
  ],
  airTraffic: {
    $comment: 'Đêm: C-130 thả pháo sáng bay cao xa (Flareship) — KC; trực thăng không bay đêm sương (Sáng nói đúng). R2 thêm Cobra/Huey lúc bình minh qua sky_trigger.',
    seed: 1971,
    center: [-160, 60],
    flights: [{ id: 'c130_flare', model: 'air_c130', kind: 'prop', count: 1, agl: [700, 900], speed: 120, period: [240, 400], first: 90, radius: 2200, sound: 'prop' }],
  },
  playerSpawn: SPAWN,
  playerYaw: r2(Math.atan2(-u[0], -u[1])),
  botSpawns,
  waypoints,
  zones,
  coverMarkers: cover,
};
writeFileSync('content/levels/diem-cao-31.level.json', JSON.stringify(level, null, 2) + '\n');
console.log(`level: ${props.length} props, zones ${Object.keys(zones).join(' ')}, wire gaps ${JSON.stringify(wireIds)}, yaw ${level.playerYaw}`);
