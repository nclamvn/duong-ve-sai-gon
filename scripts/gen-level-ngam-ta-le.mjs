#!/usr/bin/env node
/**
 * Sinh content/levels/ngam-ta-le.level.json (DV-078, hồi đêm M1 "Ngầm Ta Lê"): cùng ô DEM truong-son-a với M1 (ban ngày), đêm
 * sau trận bãi bốc. Ngầm = chỗ đường xe cắt khe suối còn nước ở (−180, 704) — tìm bằng dò khe trong features.json: lòng 2,4 m,
 * hai bờ thoải (dốc 20 m ≤ 9 %), không hố bom trong 30 m. Đường xe thẳng góc với dòng chảy (hướng 45°: NW → SE): xe xếp hàng dưới tán
 * bờ NW (trong navRect), qua ngầm, mất hút bờ SE. Ụ 12,7 trên gò bờ gần, cách ngầm ~47 m, có vòng bao cát; Thu đứng mép nước cầm đèn.
 * Không theo sơ đồ thật của trọng điểm ATP (kịch bản §M1: "bối cảnh thật, địa hình game").
 * Chạy: node scripts/gen-level-ngam-ta-le.mjs  rồi  node scripts/terrain-bake.mjs --nav --id truong-son-a --yOffset 691.2
 *        --navRect -192 512 512 512 --level content/levels/ngam-ta-le.level.json --out nav-ngam-ta-le.bin
 */
import { readFileSync, writeFileSync } from 'node:fs';

const day = JSON.parse(readFileSync('content/levels/truong-son-a.level.json', 'utf8'));
const r1 = (v) => Math.round(v * 10) / 10;
const F = [-180, 704]; // ngầm
const U = [Math.SQRT1_2, Math.SQRT1_2]; // chiều xe chạy (NW → SE)
const N = [-U[1], U[0]]; // bên trái theo chiều chạy
const at = (back, left) => [r1(F[0] - U[0] * back + N[0] * left), r1(F[1] - U[1] * back + N[1] * left)];
const A = at(169.7, 0); // đầu đường (hàng xe)
const B = at(-169.7, 0); // cuối đường bờ xa
const GUN = at(45, 14);
const THU = at(6, -3.5);
const SPAWN = at(95, 7);
const DEPOT = at(22, 9);
const fwdYaw = r1(Math.atan2(-U[0], -U[1])); // forward(yaw) = (−sin, −cos) = U

const props = [];
let pid = 0;
const add = (kind, pos, yaw = 0) => props.push({ id: `${kind}_${pid++}`, kind, position: pos, yaw: r1(yaw) });
// vòng bao cát quanh ụ súng, hở phía sau (hướng hàng xe, −U)
const aOpen = Math.atan2(-U[0], -U[1]);
for (let k = 1; k <= 5; k++) {
  const a = aOpen + (k * Math.PI) / 3;
  add('sandbag', [r1(GUN[0] + Math.sin(a) * 2.8), r1(GUN[1] + Math.cos(a) * 2.8)], a);
}
// hòm đạn 12,7 cạnh ụ
add('ammo', [r1(GUN[0] - U[0] * 1.6 - N[0] * 1.2), r1(GUN[1] - U[1] * 1.6 - N[1] * 1.2)], 0.4);
add('ammo', [r1(GUN[0] - U[0] * 1.9 - N[0] * 0.9), r1(GUN[1] - U[1] * 1.9 - N[1] * 0.9)], 1.1);
// bãi tập kết bên trái đường trước ngầm: phuy xăng, can, hòm gạo/đạn
const depot = [
  ['drum', 0, 0], ['drum', 0.7, 0.2], ['drum', 1.4, -0.1], ['drum', 0.35, 0.75], ['jerrycan', 2.3, 0.4], ['jerrycan', 2.6, 0.1],
  ['chest', -1.6, 0.3], ['chest', -1.7, 1.0], ['chest', -3.2, 0.5], ['crate', -1.4, 2.4],
];
for (const [k, a, b] of depot) add(k, [r1(DEPOT[0] + U[0] * a + N[0] * b), r1(DEPOT[1] + U[1] * a + N[1] * b)], Math.atan2(U[0], U[1]) + a * 0.3);

const botSpawns = {
  bot_a: at(80, 8),
  sq_quyet: at(90, 5),
  sq_long: at(92, 9),
  sq_dat: at(97, 10),
  sq_hoan: at(99, 5.5),
  sq_khang: at(101, 8),
};

const level = {
  $schema: '../schemas/terrain-level.schema.json',
  id: 'ngam-ta-le',
  name: 'Ngầm Ta Lê — đêm 20 rạng 21/1/1971',
  terrain: { ...day.terrain, navFile: 'nav-ngam-ta-le.bin' },
  camera: { near: 0.25, far: 2600 },
  sky: {
    $comment:
      'Đêm 20 rạng 21/1/1971, ~01:30, trăng hạ tuần mọc sau nửa đêm thấp phía đông [KC pha trăng]. HDRI dikhololo_night (CC0, sao, không đèn) như M2 R1; sương thung lũng dày hơn đồi trọc. Không climate (preset m1-jan-dawn là rạng sáng): cảnh âm đêm dùng `ambience`.',
    hdri: 'dikhololo_night',
    res: '2k',
    envIntensity: 0.1,
    skyIntensity: 0.2,
    sun: { azimuthDeg: 112, elevationDeg: 24, color: 0x9fb4d8, intensity: 0.22 },
    hemi: { sky: 0x18223a, ground: 0x0b0c09, intensity: 0.22 },
    fog: { color: 0x080c12, density: 0.0034 },
    csm: { cascades: 3, maxFar: 110, mapSize: 2048 },
  },
  ambience: { localTime: '01:30', month: 1 },
  layers: day.layers,
  textures: day.textures,
  models: ['prop_sandbag_05', 'prop_sandbag_02', 'ammo_box', 'barrel_03', 'metal_jerrycan_green', 'wooden_military_crate', 'old_military_crate'],
  props,
  roads: [{ id: 'road20', $comment: 'đường xe Đường 20 qua ngầm (game) — đoàn xe chạy theo; rừng chừa dải trống, mặt đường đất xới', pts: [A, F, B], halfWidth: 2.6 }],
  vegetation: {
    ...day.vegetation,
    $comment: `${day.vegetation.$comment ?? ''} DV-078: cùng rừng M1 + dải trống dọc đường xe (level roads) và khoảng trống ụ 12,7 (bắn máy bay phải thấy trời).`,
    clear: [{ pts: [GUN, GUN], within: 11, withinLow: 3.5 }],
  },
  fx: [
    { $comment: 'xác xe cháy âm ỉ từ đêm trước, bờ xa', kind: 'fire', position: at(-48, -9), dy: 0.4, scale: 0.8 },
    { kind: 'smoke', position: at(-48, -9), dy: 0, scale: 2, height: 45, color: 0x141210, lit: 0.12 },
    { kind: 'embers', position: at(-48, -9), dy: 1, scale: 0.7 },
    { $comment: 'cột khói bom xa (B-52 rải chiều qua)', kind: 'smoke', position: [-560, 170], scale: 6, height: 300, color: 0x0e0e0e, lit: 0.1 },
  ],
  playerSpawn: SPAWN,
  playerYaw: fwdYaw,
  botSpawns,
  waypoints: [at(80, 6), at(60, 6), at(40, 8)],
  zones: {
    spawn: { center: SPAWN, radius: 10 },
    thu: { center: THU, radius: 5 },
    ford: { center: F, radius: 8 },
    gun: { center: GUN, radius: 3 },
    depot: { center: DEPOT, radius: 6 },
  },
  coverMarkers: [
    { id: 'bank_0', position: at(14, 6), facing: [U[0], 0, U[1]].map(r1) },
    { id: 'bank_1', position: at(16, -7), facing: [U[0], 0, U[1]].map(r1) },
    { id: 'gun_0', position: at(47, 12), facing: [U[0], 0, U[1]].map(r1) },
  ],
  nextLevel: 'diem-cao-31',
};
writeFileSync('content/levels/ngam-ta-le.level.json', JSON.stringify(level, null, 2) + '\n');
console.log(`level ngam-ta-le: ${props.length} props, gun ${GUN}, thu ${THU}, spawn ${SPAWN}, road ${A} → ${F} → ${B}, yaw ${fwdYaw}`);
