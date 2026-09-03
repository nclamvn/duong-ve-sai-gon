#!/usr/bin/env node
/**
 * Sinh content/levels/pho-van-hai.level.json (TIP-019, ADR-007) — deterministic (seed cố định), chạy lại khi đổi layout.
 * Layout: phố chính dọc z (spawn +z nam, trạm dẫn đường −z bắc), nhà ống hai bên, hẻm đông (ép sườn), ngã tư z=−38,
 * 3 điểm giao tranh A (đầu phố z≈42) · B (chợ z≈5) · C (ngã tư z≈−38), trạm z=−70.
 */
import { writeFileSync } from 'node:fs';

let s = 20260903;
const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const r = (a, b) => a + rnd() * (b - a);
const round = (v) => Math.round(v * 100) / 100;

const palette = [0xe8d8a8, 0xf2c14e, 0x7fb7be, 0xd96c5f, 0x9bb46b, 0x6a8fc7, 0xf0a6c2, 0xe9e4d4, 0xc98c4a, 0x8fd3c0, 0xb56b8a, 0x5f9ea0, 0xf4e1b5, 0xbfd8e6];
const signPool = ['TẠP HOÁ VẠN HẢI', 'CÀ PHÊ SƠN CA', 'SỬA XE HÙNG', 'PHỞ BÀ TƯ', 'ĐIỆN LẠNH MINH', 'NHÀ THUỐC AN', 'HỚT TÓC NAM', 'BÚN CHẢ 36', 'VẬT LIỆU XÂY DỰNG', 'KARAOKE BIỂN XANH', 'VÀNG BẠC KIM THÀNH', 'PHOTOCOPY · IN ẤN', 'TRÀ SỮA HẢI ĐĂNG', 'NHÀ NGHỈ HẢI ÂU', 'XE MÁY THÀNH ĐẠT', 'BÁNH MÌ CÔ BA', 'ĐIỆN THOẠI · PHỤ KIỆN', 'SIÊU THỊ MINI', 'HẢI SẢN TƯƠI SỐNG', 'NƯỚC MÍA SIÊU SẠCH', 'CƠM TẤM SÀI GÒN', 'GIẶT ỦI 24H', 'THỜI TRANG HỒNG', 'INTERNET · GAME', 'CHÁO LÒNG', 'THÚ Y VẠN HẢI', 'SÁCH · VĂN PHÒNG PHẨM', 'GAS MINH TÂM'];

const lots = [];
const gaps = [
  { side: 'east', z0: -15, z1: -9 }, // hẻm ép sườn
  { side: 'east', z0: -46, z1: -30 }, // ngã tư
  { side: 'west', z0: -46, z1: -30 },
];
const inGap = (side, z0, z1) => gaps.some((g) => g.side === side && z1 > g.z0 && z0 < g.z1);
for (const side of ['west', 'east']) {
  let z = 68;
  while (z > -68) {
    const width = round(r(4.2, 5.6));
    const z0 = z - width;
    if (!inGap(side, z0, z)) {
      const nearC = z < -25 && z > -60;
      const damage = nearC ? r(0.3, 1) : z < 20 ? r(0, 0.6) : r(0, 0.25);
      const ground = damage > 0.85 ? 'ruin' : rnd() < 0.45 ? 'shop' : 'shutter';
      const floors = pick([2, 2, 3, 3, 3, 4]);
      lots.push({
        side,
        z: round(z0 + width / 2),
        width,
        floors,
        color: pick(palette),
        wall: pick(['plaster', 'plaster', 'plastered', 'peeling', 'damaged', 'brick']),
        ground,
        sign: ground === 'ruin' ? undefined : pick(signPool),
        signColor: pick([0xd8322a, 0x1b5fa8, 0xf2b705, 0x1f7a4d, 0xffffff, 0xe86a1c]),
        awning: ground === 'shop' && rnd() < 0.7 ? pick([0xd8322a, 0x1b5fa8, 0x2e8b57, 0xf2b705, 0xf0f0f0]) : undefined,
        balcony: rnd() < 0.85,
        roof: pick(['flat', 'flat', 'tin', 'tile']),
        damage: round(damage),
      });
    }
    z = z0 - round(r(0, 0.3));
  }
}

// Dãy nhà dọc đường ngang (ngã tư z=−38): hệ ảo quay π/2 quanh (0,−38): (vx,vz) → world (x = −38?)… quy ước: world x = vz, world z = −38 − vx
// → west ảo (vx<0, mặt +vx) = phía nam (z > −38) mặt về bắc; east ảo = phía bắc, mặt về nam. Chỉ |vz| > 24 (ngoài dãy phố chính).
const crossLotsList = [];
for (const side of ['west', 'east']) {
  for (const dir of [-1, 1]) {
    let z = dir > 0 ? 24 : -24;
    while (Math.abs(z) < 44) {
      const width = round(r(4.2, 5.6));
      const z0 = dir > 0 ? z + width : z - width;
      if (Math.abs(z0) > 45) break;
      const damage = r(0.2, 0.9);
      const ground = damage > 0.85 ? 'ruin' : rnd() < 0.4 ? 'shop' : 'shutter';
      crossLotsList.push({ side, z: round((z + z0) / 2), width, floors: pick([2, 3, 3, 4]), color: pick(palette), wall: pick(['plaster', 'plastered', 'peeling', 'damaged', 'brick']), ground, sign: ground === 'ruin' ? undefined : pick(signPool), signColor: pick([0xd8322a, 0x1b5fa8, 0xf2b705, 0x1f7a4d, 0xffffff]), awning: ground === 'shop' && rnd() < 0.6 ? pick([0xd8322a, 0x1b5fa8, 0x2e8b57]) : undefined, balcony: rnd() < 0.8, roof: pick(['flat', 'tin', 'tile']), damage: round(damage) });
      z = z0 + dir * round(r(0, 0.3));
    }
  }
}
const crossLots = [{ origin: [0, -38], yaw: -Math.PI / 2, lots: crossLotsList }];

const props = [];
const P = (model, x, z, yaw = 0, extra = {}) => props.push({ model, position: [round(x), 0, round(z)], yaw: round(yaw), ...extra });
// cây, cột điện, đèn đường (vỉa hè x = ±7.5..8.6)
P('island_tree_01', 8.4, 30, 0.4, { scale: 1.0 });
P('island_tree_01', -8.4, -16, 2.1, { scale: 0.9 });
P('dead_tree_trunk', -6.5, 60, 1.2, { scale: 1.1, collider: [3.2, 0.5, 0.6], cover: true });
for (const [x, z] of [[8.6, 55], [-8.6, 25], [8.6, -25], [-8.6, -58], [8.6, -66], [-8.6, 66]]) P('pole', x, z, 0);
for (const [x, z] of [[-8.6, 48], [8.6, 10], [-8.6, -45], [8.6, -62]]) P('street_lamp_01', x, z, x > 0 ? Math.PI / 2 : -Math.PI / 2);
P('fire_hydrant', 8.3, 20, 0);
for (const [x, z] of [[2, 30], [-3, 8], [1, -20], [-2, -50]]) P('water_manhole_cover', x, z, 0);
for (const [x, z] of [[-7.6, 35], [7.6, 3], [-7.4, -6], [7.8, 26]]) P('trashbag', x, z, r(0, 6));
// chốt A: bao xi măng, hòm đạn, can xăng, thùng phuy, rào bê tông
for (let i = 0; i < 6; i++) P('cement_bag', -6.8 + i * 0.75, 39.6, r(-0.3, 0.3), {});
P('ammo_box', 2.2, 38.6, 0.3);
P('ammo_box', 2.9, 38.9, 1.2);
P('metal_jerrycan', -4.4, 38.4, 0.5);
P('Barrel_01', 6.2, 44, 0, { collider: [0.35, 0.5, 0.35], cover: true });
P('Barrel_01', 6.9, 44.4, 0.7, {});
P('concrete_road_barrier_02', -7.2, 40, 0, { collider: [1.1, 0.5, 0.3], cover: true });
P('concrete_road_barrier_02', 7.2, 40, 0, { collider: [1.1, 0.5, 0.3], cover: true });
P('old_tyre', 5.4, 36.5, 0.6);
P('old_tyre', 5.9, 36.1, 1.9);
// chợ B: sọt, rổ, chuối, ghế nhựa, xe cà phê, xe đẩy, thùng gỗ
P('CoffeeCart_01', -7.4, 22, 1.4, { collider: [0.9, 0.9, 0.6], cover: true });
P('hand_truck', 7.3, 14, 2.8);
for (const [x, z, y] of [[6.6, 9.8, 0.2], [7.4, 9.4, 1.1], [-6.9, 2.3, 0.4], [-7.6, 1.7, 2.2], [6.8, -3.5, 0.9]]) P('plastic_crate_02', x, z, y);
for (const [x, z, y] of [[7.0, 12.2, 0.3], [-7.2, 5.5, 1.6], [-6.5, -2.2, 0.2]]) P('wicker_basket_01', x, z, y);
for (const [x, z] of [[7.2, 12.6], [-7.0, 5.9]]) P('bananas', x, z, r(0, 6), { scale: 1.2 });
for (const [x, z, y] of [[-7.3, 14, 0.4], [-6.8, 13.4, 2.5], [7.6, -1, 1.2], [7.1, -1.6, 4.4], [-7.5, 30, 0.6]]) P('plastic_monobloc_chair_01', x, z, y);
for (const [x, z, y] of [[7.4, 0.5, 0.2], [-7.6, -4.8, 0.9], [7.5, 17, 0.4]]) P('wooden_crate_01', x, z, y, { collider: [0.45, 0.4, 0.45] });
P('potted_plant_02', -8.3, 10, r(0, 6));
P('wooden_ladder', -8.7, 16, 0, { scale: 1.0 });
// C ngã tư: lốp, vành, đá, thùng phuy, hàng rào lưới, bao xi măng chốt trạm
for (const [x, z, y] of [[-6.2, -40.5, 0.2], [-5.5, -40.2, 1.3], [-6.0, -39.6, 2.6], [-5.2, -41, 0.7]]) P('old_tyre', x, z, y);
P('rusted_wheel_rim_01', -4.6, -40.8, 0.9);
for (const [x, z, sc] of [[-9.5, -33, 1.4], [-10.5, -34.5, 1.0], [-8.4, -31.5, 0.8], [10.2, -47, 1.2]]) P('rock_07', x, z, r(0, 6), { scale: sc });
P('Barrel_01', 7.4, -42, 0.4, { collider: [0.35, 0.5, 0.35], cover: true });
P('metal_jerrycan', 6.6, -41.2, 2.0);
P('modular_chainlink_fence', -12, -56, 0, { scale: 1.0 });
for (let i = 0; i < 8; i++) P('cement_bag', -3.2 + i * 0.8, -52.4, r(-0.3, 0.3), {});
P('ammo_box', 0.8, -53.2, 0.4);
P('concrete_road_barrier_02', -6.5, -52, 0.15, { collider: [1.1, 0.5, 0.3], cover: true });
P('concrete_road_barrier_02', 6.5, -52, -0.15, { collider: [1.1, 0.5, 0.3], cover: true });
P('shrub_02', -8.6, -20, 0.5, { scale: 1.2 });
P('shrub_02', 8.6, 62, 2.0, { scale: 1.0 });

const barricades = [
  // A — chốt đầu phố (mặt nam về spawn)
  { kind: 'sandbags', position: [-3.6, 0, 40], yaw: 0, length: 4.8 },
  { kind: 'sandbags', position: [3.6, 0, 40], yaw: 0, length: 4.8 },
  { kind: 'wreck_apc', position: [-1.2, 0, 47.5], yaw: 0.35, burning: true },
  { kind: 'sheet', position: [4.5, 0, 52], yaw: 0.9 },
  { kind: 'sheet', position: [-6.2, 0, 31], yaw: -0.4 },
  // B — chợ
  { kind: 'stall', position: [6.8, 0, 12], yaw: 0, color: 0x1b5fa8 },
  { kind: 'stall', position: [6.8, 0, 6], yaw: 0, color: 0xd8322a, burning: true },
  { kind: 'stall', position: [6.8, 0, 0], yaw: 0, color: 0xf2b705 },
  { kind: 'stall', position: [6.8, 0, -6], yaw: 0, color: 0x2e8b57 },
  { kind: 'stall', position: [-6.8, 0, 10], yaw: Math.PI, color: 0xd8322a },
  { kind: 'stall', position: [-6.8, 0, 3], yaw: Math.PI, color: 0x1b5fa8 },
  { kind: 'stall', position: [-6.8, 0, -4], yaw: Math.PI, color: 0xf0f0f0 },
  { kind: 'wreck_car', position: [2.2, 0, 18], yaw: -0.5 },
  { kind: 'wreck_car', position: [-3.0, 0, -20], yaw: 2.6, burning: true },
  { kind: 'tires', position: [-2.5, 0, 9], yaw: 0.3 },
  { kind: 'rubble', position: [-8.5, 0, -8], yaw: 0 },
  // C — ngã tư
  { kind: 'wreck_bus', position: [4.5, 0, -36], yaw: 0.45, burning: true },
  { kind: 'rubble', position: [-9.8, 0, -32], yaw: 0.4 },
  { kind: 'rubble', position: [11, 0, -46], yaw: 1.1 },
  { kind: 'barrier', position: [-3, 0, -30], yaw: 0.2 },
  { kind: 'sandbags', position: [1.5, 0, -52.5], yaw: Math.PI, length: 5 },
  { kind: 'wreck_car', position: [-14, 0, -38], yaw: 1.4, burning: true },
  { kind: 'tires', position: [-6, 0, -40], yaw: 0 },
];

const fx = [
  { kind: 'smoke', position: [-1.2, 0.8, 47.5], scale: 1.6, color: 0x151311 },
  { kind: 'fire', position: [-1.6, 0.6, 46.6], scale: 1.4 },
  { kind: 'smoke', position: [6.8, 1.2, 6], scale: 0.9, color: 0x5a5550 },
  { kind: 'fire', position: [6.8, 0.4, 6], scale: 0.9 },
  { kind: 'smoke', position: [-3.0, 0.7, -20], scale: 1.2, color: 0x1a1816 },
  { kind: 'fire', position: [-3.4, 0.5, -19.4], scale: 1.1 },
  { kind: 'smoke', position: [4.5, 1.8, -36], scale: 2.2, color: 0x12100e },
  { kind: 'fire', position: [3.2, 0.9, -37.5], scale: 1.6 },
  { kind: 'fire', position: [6.4, 0.9, -34.2], scale: 1.0 },
  { kind: 'smoke', position: [-14, 0.6, -38], scale: 1.0, color: 0x1f1c19 },
  { kind: 'fire', position: [-14, 0.4, -38], scale: 0.9 },
  { kind: 'smoke', position: [-18, 9, -66], scale: 2.6, color: 0x8a8580 },
  { kind: 'smoke', position: [26, 6, -20], scale: 2.0, color: 0x3a3733 },
  { kind: 'dust', position: [0, 1, -38], scale: 1 },
  { kind: 'embers', position: [4.5, 1.5, -36], scale: 1 },
  { kind: 'embers', position: [-1.2, 1.2, 47.5], scale: 1 },
];

const level = {
  id: 'pho-van-hai',
  name: 'Phố Vạn Hải — sáng sau bão',
  size: [90, 160],
  sky: {
    hdri: 'kloofendal_48d_partly_cloudy_puresky',
    res: '2k',
    envIntensity: 1.0,
    skyIntensity: 1.0,
    sun: { azimuthDeg: 62, elevationDeg: 34, color: 0xfff1d6, intensity: 3.2 },
    hemi: { sky: 0xbfd6f2, ground: 0x6b5d4a, intensity: 0.45 },
    fog: { color: 0xc9d3dc, density: 0.0035 },
    csm: { cascades: 2, maxFar: 110, mapSize: 2048 },
  },
  textures: ['road_damaged', 'asphalt_02', 'patterned_concrete_pavers', 'painted_plaster_wall', 'damaged_plaster', 'peeling_painted_wall', 'plastered_wall_02', 'painted_worn_brick', 'clay_roof_tiles', 'corrugated_iron_02', 'burned_ground_01', 'brown_mud_dry', 'rubble', 'painted_metal_shutter', 'rusty_metal_shutter', 'rusty_metal_02', 'concrete_wall_001', 'metal_plate', 'plywood'],
  models: ['island_tree_01', 'dead_tree_trunk', 'street_lamp_01', 'fire_hydrant', 'water_manhole_cover', 'trashbag', 'cement_bag', 'ammo_box', 'metal_jerrycan', 'Barrel_01', 'concrete_road_barrier_02', 'old_tyre', 'rusted_wheel_rim_01', 'CoffeeCart_01', 'hand_truck', 'plastic_crate_02', 'wicker_basket_01', 'bananas', 'plastic_monobloc_chair_01', 'wooden_crate_01', 'potted_plant_02', 'wooden_ladder', 'rock_07', 'modular_chainlink_fence', 'shrub_02'],
  ground: {
    road: { halfWidth: 6, z0: -80, z1: 80, texture: 'asphalt_02' },
    crossRoads: [{ z: -38, halfWidth: 6, x0: -45, x1: 45 }],
    sidewalk: { width: 3, height: 0.15, texture: 'patterned_concrete_pavers' },
    fill: { texture: 'brown_mud_dry', size: 220 },
    wetness: 0.35,
  },
  lots,
  crossLots,
  gaps,
  bounds: { xWest: -48, xEast: 48, zNorth: -78, zSouth: 78 },
  landmarks: [
    { id: 'station', position: [0, 0, -71], size: [13, 5.5, 5], color: 0x8c96a3, sign: 'TRẠM DẪN ĐƯỜNG VẠN HẢI' },
    { id: 'station_tower', position: [7, 0, -73], size: [1.2, 12, 1.2], color: 0x6f7885 },
    // khối chung cư/nhà kho phía sau dãy nhà ống (đường chân trời), chặn khu đất trống
    { id: 'blk_w1', position: [-33, 0, 40], size: [16, 18, 40], color: 0xb8b3a6 },
    { id: 'blk_w2', position: [-34, 0, -2], size: [14, 14, 30], color: 0xc2b59b },
    { id: 'blk_w3', position: [-36, 0, -66], size: [12, 21, 20], color: 0xa9adb5 },
    { id: 'blk_e1', position: [34, 0, 48], size: [16, 15, 44], color: 0xbfb8a8 },
    { id: 'blk_e2', position: [36, 0, 5], size: [12, 19, 34], color: 0xb0b7c0 },
    { id: 'blk_e3', position: [36, 0, -66], size: [14, 12, 20], color: 0xc4b79c },
    { id: 'lane_e_wall', position: [30, 0, -21], size: [1, 3, 20], color: 0x9d9a90 },
  ],
  props,
  barricades,
  fx,
  waypoints: [[0, 0, 62], [5, 0, 45], [-4, 0, 30], [4, 0, 15], [-4, 0, 0], [4, 0, -16], [-4, 0, -28], [0, 0, -44], [10, 0, -38], [24, 0, -30], [24, 0, -12], [12, 0, -12]],
  playerSpawn: [0, 0, 70],
  playerYaw: 0,
  botSpawns: {
    bot_a: [0, 0, -10],
    bot_b: [2, 0, 34],
    a1: [-3, 0, 36],
    a2: [3.5, 0, 37],
    a3: [-7, 0, 44],
    a4: [7, 0, 45],
    b1: [4, 0, 12],
    b2: [-4, 0, 8],
    b3: [5, 0, 2],
    b4: [-5, 0, -3],
    b5: [0, 0, -8],
    b6: [22, 0, -12],
    c1: [-2, 0, -44],
    c2: [6, 0, -46],
    c3: [-8, 0, -36],
    c4: [2, 0, -55],
    c5: [-4, 0, -56],
  },
  zones: {
    zone_a: { center: [0, 0, 42], radius: 11 },
    zone_b: { center: [0, 0, 5], radius: 13 },
    zone_c: { center: [0, 0, -38], radius: 13 },
    station_zone: { center: [0, 0, -63], radius: 6 },
    relay_zone: { center: [0, 0, 5], radius: 13 },
    exfil_zone: { center: [0, 0, -63], radius: 6 },
  },
  coverMarkers: [
    { id: 'alley_e', position: [9.8, 0, -12], facing: [-1, 0, 0] },
    { id: 'corner_w_c', position: [-8.5, 0, -28], facing: [0, 0, -1] },
    { id: 'corner_e_c', position: [8.5, 0, -28], facing: [0, 0, -1] },
    { id: 'corner_w_a', position: [-8.5, 0, 33], facing: [0, 0, 1] },
    { id: 'corner_e_a', position: [8.5, 0, 33], facing: [0, 0, 1] },
    { id: 'lane_e', position: [22, 0, -25], facing: [-1, 0, 0] },
  ],
  signPool,
  palette,
};
writeFileSync('content/levels/pho-van-hai.level.json', JSON.stringify(level, null, 2) + '\n');
console.log(`[level] ${lots.length} lot, ${props.length} prop, ${barricades.length} barricade, ${fx.length} fx`);
