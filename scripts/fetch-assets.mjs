#!/usr/bin/env node
/**
 * Tải asset CC0 từ Poly Haven (ADR-005) → public/assets/, ghi content/assets/manifest.json (id, nguồn, license, file, bytes, sha256).
 * Chỉ CC0-1.0. Mixamo (TIP-012) KHÔNG đi qua script này — Chủ nhà tải tay, convert-mixamo ghi manifest riêng.
 * Dùng: node scripts/fetch-assets.mjs [--verify]  (--verify: không tải, chỉ kiểm file + hash khớp manifest)
 */
import { mkdirSync, existsSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { optimizeModel, SRC_ROOT } from './optimize-models.mjs';

const API = 'https://api.polyhaven.com';
const OUT = 'public/assets';
const MANIFEST = 'content/assets/manifest.json';

/** Danh sách asset của slice G0.5 (TIP-011). Texture: maps diff/nor_gl/arm 1K. */
const ASSETS = [
  // HDRI đêm cảng (đèn pha, mặt nước) → IBL/phản chiếu
  { id: 'blue_lagoon_night', type: 'hdri', res: '1k', use: 'environment IBL' },
  // HDRI đêm đồng cỏ (sao, dải Ngân Hà, không đèn thành phố) — M2 Điểm cao 31 đêm 24/2/1971 (Blueprint G2 R1)
  { id: 'dikhololo_night', type: 'hdri', res: '2k', use: 'trời đêm Đường 9 – Nam Lào (IBL + nền), thay blue_lagoon_night có đèn cảng' },
  // Texture PBR
  { id: 'asphalt_02', type: 'texture', res: '1k', use: 'sàn cảng ướt' },
  { id: 'concrete_wall_001', type: 'texture', res: '1k', use: 'tường bê tông, jersey' },
  { id: 'factory_wall', type: 'texture', res: '1k', use: 'tường bao tôn xanh' },
  { id: 'corrugated_iron_02', type: 'texture', res: '1k', use: 'container (tint theo màu)' },
  { id: 'rusty_metal_02', type: 'texture', res: '1k', use: 'rỉ sét overlay' },
  { id: 'rusty_painted_metal', type: 'texture', res: '1k', use: 'thùng phuy' },
  { id: 'plywood', type: 'texture', res: '1k', use: 'pallet/crate gỗ' },
  { id: 'metal_plate', type: 'texture', res: '1k', use: 'súng/viewmodel (TIP-013), sàn kim loại' },
  // Props glTF 1K
  { id: 'wooden_military_crate', type: 'model', res: '1k', use: 'prop crate' },
  { id: 'old_military_crate', type: 'model', res: '1k', use: 'prop crate' },
  { id: 'plastic_crate_01', type: 'model', res: '1k', use: 'prop crate nhựa' },
  { id: 'cardboard_box_01', type: 'model', res: '1k', use: 'prop hộp' },
  { id: 'concrete_road_barrier', type: 'model', res: '1k', use: 'jersey barrier' },
  { id: 'propane_tank', type: 'model', res: '1k', use: 'prop bình gas' },
  { id: 'metal_trash_can', type: 'model', res: '1k', use: 'prop thùng rác' },
  { id: 'utility_box_01', type: 'model', res: '1k', use: 'prop tủ điện' },
  { id: 'portable_generator', type: 'model', res: '1k', use: 'prop máy phát' },
  // ---- G0.6 (ADR-007, TIP-019): Phố Vạn Hải sáng sau bão ----
  { id: 'kloofendal_48d_partly_cloudy_puresky', type: 'hdri', res: '2k', use: 'trời ban ngày sau bão (IBL + nền)' },
  { id: 'road_damaged', type: 'texture', res: '1k', use: 'đường nhựa nứt' },
  { id: 'patterned_concrete_pavers', type: 'texture', res: '1k', use: 'vỉa hè' },
  { id: 'painted_plaster_wall', type: 'texture', res: '1k', use: 'tường nhà ống (tint màu)' },
  { id: 'damaged_plaster', type: 'texture', res: '1k', use: 'tường nhà ống hư hại' },
  { id: 'peeling_painted_wall', type: 'texture', res: '1k', use: 'tường bong sơn' },
  { id: 'plastered_wall_02', type: 'texture', res: '1k', use: 'tường trát' },
  { id: 'painted_worn_brick', type: 'texture', res: '1k', use: 'tường gạch sơn' },
  { id: 'clay_roof_tiles', type: 'texture', res: '1k', use: 'mái ngói' },
  { id: 'burned_ground_01', type: 'texture', res: '1k', use: 'nền cháy quanh lửa' },
  { id: 'brown_mud_dry', type: 'texture', res: '1k', use: 'bùn sau bão' },
  { id: 'rubble', type: 'texture', res: '1k', use: 'đống đổ nát' },
  { id: 'painted_metal_shutter', type: 'texture', res: '1k', use: 'cửa cuốn nhà ống' },
  { id: 'rusty_metal_shutter', type: 'texture', res: '1k', use: 'cửa cuốn rỉ' },
  { id: 'old_tyre', type: 'model', res: '1k', use: 'lốp xe' },
  { id: 'rusted_wheel_rim_01', type: 'model', res: '1k', use: 'vành xe' },
  { id: 'concrete_road_barrier_02', type: 'model', res: '1k', use: 'rào bê tông' },
  { id: 'street_lamp_01', type: 'model', res: '1k', use: 'cột đèn đường' },
  { id: 'fire_hydrant', type: 'model', res: '1k', use: 'trụ cứu hoả' },
  { id: 'trashbag', type: 'model', res: '1k', use: 'túi rác' },
  { id: 'cement_bag', type: 'model', res: '1k', use: 'bao cát/xi măng (chốt)' },
  { id: 'plastic_monobloc_chair_01', type: 'model', res: '1k', use: 'ghế nhựa quán' },
  { id: 'wooden_crate_01', type: 'model', res: '1k', use: 'thùng gỗ chợ' },
  { id: 'plastic_crate_02', type: 'model', res: '1k', use: 'sọt nhựa chợ' },
  { id: 'wicker_basket_01', type: 'model', res: '1k', use: 'rổ mây chợ' },
  { id: 'bananas', type: 'model', res: '1k', use: 'hàng chợ' },
  { id: 'metal_jerrycan', type: 'model', res: '1k', use: 'can xăng' },
  { id: 'Barrel_01', type: 'model', res: '1k', use: 'thùng phuy cháy' },
  { id: 'ammo_box', type: 'model', res: '1k', use: 'hòm đạn chốt' },
  { id: 'hand_truck', type: 'model', res: '1k', use: 'xe đẩy chợ' },
  { id: 'CoffeeCart_01', type: 'model', res: '1k', use: 'xe cà phê' },
  { id: 'wooden_ladder', type: 'model', res: '1k', use: 'thang' },
  { id: 'rock_07', type: 'model', res: '1k', use: 'đá đổ nát' },
  { id: 'dead_tree_trunk', type: 'model', res: '1k', use: 'thân cây gãy sau bão' },
  { id: 'island_tree_01', type: 'model', res: '1k', use: 'cây đường phố' },
  { id: 'shrub_02', type: 'model', res: '1k', use: 'bụi cây' },
  { id: 'potted_plant_02', type: 'model', res: '1k', use: 'chậu cây trước nhà' },
  { id: 'water_manhole_cover', type: 'model', res: '1k', use: 'nắp cống' },
  { id: 'modular_chainlink_fence', type: 'model', res: '1k', use: 'hàng rào lưới' },
  // ---- DVSG G0′ (TIP-D04): 4 lớp splat terrain Trường Sơn (TER-002) ----
  { id: 'brown_mud_leaves_01', type: 'texture', res: '1k', use: 'terrain lớp mùn lá rừng (mặc định)' },
  { id: 'brown_mud_03', type: 'texture', res: '1k', use: 'terrain lớp đất ướt đường mòn' },
  { id: 'aerial_rocks_02', type: 'texture', res: '1k', use: 'terrain lớp đá dốc (triplanar)' },
  { id: 'aerial_grass_rock', type: 'texture', res: '1k', use: 'terrain lớp cỏ tranh/rêu đồi cao' },
  // ---- DV-057: rừng Trường Sơn theo registry refinery (docs/research/rung-truong-son) ----
  // HDRI sáng sớm sương mù, trời u ám, không mặt đất: M1 tháng 1 (mây thấp, mưa phùn, sương tới gần trưa; USMC, Frontier BHH)
  { id: 'kloofendal_misty_morning_puresky', type: 'hdri', res: '2k', use: 'trời sáng sớm sương mù tháng 1 (M1 Trường Sơn)' },
  // nền rừng: lá rụng, rêu, cành nhỏ (thay mùn lá chung chung)
  { id: 'forest_leaves_02', type: 'texture', res: '1k', use: 'terrain lớp lá rụng nền rừng già' },
  // sườn dốc: đá nứt có địa y và mảng rêu (rừng ẩm, mây phủ)
  { id: 'mossy_rock', type: 'texture', res: '1k', use: 'terrain lớp đá dốc phủ rêu (triplanar)' },
  // chỗ trũng, đường mòn: đất feralit đỏ lẫn sỏi (đất đỏ vàng Trường Sơn, đất đỏ Khe Sanh)
  { id: 'red_laterite_soil_stones', type: 'texture', res: '1k', use: 'terrain lớp đất đỏ feralit lẫn sỏi (đường mòn, chỗ trũng)' },
  // ---- DV-059: nguồn thực vật/nền rừng CC0 (type vegsrc: chỉ tải nguồn glTF vào assets-src/polyhaven/models, GLB loài do
  //      scripts/convert-vegetation.mjs làm và ghi manifest; registry asset docs/research/rung-truong-son mũi K) ----
  { id: 'fern_02', type: 'vegsrc', res: '1k', use: 'dương xỉ photoscan (thảm tươi)' },
  { id: 'calathea_orbifolia_01', type: 'vegsrc', res: '1k', use: 'lá rộng thay tạm lá dong (thảm tươi)' },
  { id: 'dead_tree_trunk_02', type: 'vegsrc', res: '1k', use: 'thân cây đổ phủ rêu (nền rừng)' },
  { id: 'tree_stump_01', type: 'vegsrc', res: '1k', use: 'gốc cây có rêu (nền rừng)' },
  { id: 'rock_moss_set_01', type: 'vegsrc', res: '1k', use: 'đá phủ rêu (sườn, ven suối)' },
  { id: 'dry_branches_medium_01', type: 'vegsrc', res: '1k', use: 'cành khô rụng (nền rừng)' },
  { id: 'root_cluster_01', type: 'vegsrc', res: '1k', use: 'cụm rễ trồi (nền rừng)' },
  // DV-060: đá tảng, vách đá, sỏi đá lòng khe, thêm gốc gãy cho nền rừng ngổn ngang
  { id: 'rock_face_01', type: 'vegsrc', res: '1k', use: 'khối đá lớn/vách đá lộ trên sườn và bờ khe' },
  { id: 'rock_moss_set_02', type: 'vegsrc', res: '1k', use: 'đá cuội, đá hộc lòng khe' },
  { id: 'tree_stump_02', type: 'vegsrc', res: '1k', use: 'gốc cây gãy (nền rừng)' },
  // ---- DV-077 hồi đêm Ngầm Ta Lê: đạo cụ đêm (CC0) ----
  { id: 'vintage_oil_lamp', type: 'model', res: '1k', use: 'đèn dầu chỉ đường ở ngầm' },
  { id: 'barrel_03', type: 'model', res: '1k', use: 'phuy xăng bờ ngầm' },
  { id: 'metal_jerrycan_green', type: 'model', res: '1k', use: 'can xăng trên xe' },
];
const TEXTURE_MAPS = { Diffuse: 'diff', nor_gl: 'nor_gl', arm: 'arm' };

const verifyOnly = process.argv.includes('--verify');

async function getJson(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'duong-ve-sai-gon-asset-fetch/1.0 (CC0 assets; contact: nclamvn@gmail.com)' } });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

async function download(url, dest, expectedBytes) {
  if (existsSync(dest) && (expectedBytes === undefined || statSync(dest).size === expectedBytes)) return false;
  mkdirSync(dirname(dest), { recursive: true });
  const r = await fetch(url, { headers: { 'user-agent': 'duong-ve-sai-gon-asset-fetch/1.0' } });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  writeFileSync(dest, buf);
  return true;
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

async function fetchAsset(a) {
  const files = [];
  const info = await getJson(`${API}/info/${a.id}`);
  const f = await getJson(`${API}/files/${a.id}`);
  const dir = a.type === 'model' ? join(SRC_ROOT, a.id) : join(OUT, a.type === 'hdri' ? 'hdris' : 'textures', a.id);
  const sourceFiles = [];
  if (a.type === 'hdri') {
    const e = f.hdri[a.res].hdr;
    const dest = join(dir, `${a.id}_${a.res}.hdr`);
    await download(e.url, dest, e.size);
    files.push(dest);
  } else if (a.type === 'texture') {
    for (const [key, suffix] of Object.entries(TEXTURE_MAPS)) {
      const e = f[key]?.[a.res]?.jpg;
      if (!e) {
        console.warn(`[assets] ${a.id}: thiếu map ${key}`);
        continue;
      }
      const dest = join(dir, `${a.id}_${suffix}_${a.res}.jpg`);
      await download(e.url, dest, e.size);
      files.push(dest);
    }
  } else {
    const g = f.gltf[a.res].gltf;
    const dest = join(dir, `${a.id}_${a.res}.gltf`);
    await download(g.url, dest, g.size);
    sourceFiles.push(dest);
    for (const [rel, e] of Object.entries(g.include)) {
      const d = join(dir, rel);
      await download(e.url, d, e.size);
      sourceFiles.push(d);
    }
    // nguồn → glb tối ưu (simplify + meshopt) trong public/
    const r = await optimizeModel(a.id, a.simplify ?? 0.25);
    files.push(r.out);
    a.tris = { before: r.before, after: r.after };
  }
  return {
    id: a.id,
    type: a.type,
    resolution: a.res,
    use: a.use,
    source: 'polyhaven',
    url: `https://polyhaven.com/a/${a.id}`,
    authors: Object.keys(info.authors ?? {}),
    license: 'CC0-1.0',
    files: files.map((p) => ({ path: p.replace(/^public\//, ''), bytes: statSync(p).size, sha256: sha256(p) })),
    ...(sourceFiles.length ? { sourceFiles: sourceFiles.map((p) => ({ path: p, bytes: statSync(p).size, sha256: sha256(p) })), triangles: a.tris } : {}),
  };
}

function verify() {
  const m = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  let bad = 0;
  for (const a of m.assets) {
    for (const f of a.files) {
      const p = join('public', f.path);
      if (!existsSync(p)) {
        console.error(`[assets] thiếu ${p}`);
        bad++;
        continue;
      }
      if (sha256(p) !== f.sha256) {
        console.error(`[assets] hash lệch ${p}`);
        bad++;
      }
    }
  }
  console.log(`[assets] verify: ${m.assets.length} asset, ${bad} lỗi, tổng ${(m.totalBytes / 1048576).toFixed(1)} MB`);
  process.exit(bad ? 1 : 0);
}

if (verifyOnly) verify();
else {
  // TIP-D04: entry Poly Haven đã có trong manifest (đã KTX2 — ADR-D04) được GIỮ NGUYÊN, chỉ tải id mới (hoặc --force id1,id2);
  // tải lại toàn bộ sẽ ghi đè .ktx2 bằng .jpg và phá pipeline.
  const prevAssets = existsSync(MANIFEST) ? (JSON.parse(readFileSync(MANIFEST, 'utf8')).assets ?? []) : [];
  const forceArg = process.argv.find((x) => x.startsWith('--force'));
  const force = new Set(forceArg ? (process.argv[process.argv.indexOf(forceArg) + 1] ?? '').split(',').filter(Boolean) : []);
  const assets = [];
  for (const a of ASSETS) {
    const prev = prevAssets.find((x) => x.id === a.id && x.source === 'polyhaven');
    if (prev && !force.has(a.id)) {
      assets.push(prev);
      continue;
    }
    if (a.type === 'vegsrc') {
      // chỉ nguồn: GLB loài + entry manifest do convert-vegetation.mjs làm (source 'polyhaven-vegetation')
      const f = await getJson(`${API}/files/${a.id}`);
      const g = f.gltf[a.res].gltf;
      const dir = join(SRC_ROOT, a.id);
      let n = (await download(g.url, join(dir, `${a.id}_${a.res}.gltf`), g.size)) ? 1 : 0;
      for (const [rel, e] of Object.entries(g.include)) n += (await download(e.url, join(dir, rel), e.size)) ? 1 : 0;
      console.log(`[assets] vegsrc ${a.id} ${a.res}: ${n} file mới → ${dir}`);
      continue;
    }
    process.stdout.write(`[assets] ${a.type} ${a.id} ${a.res} … `);
    const entry = await fetchAsset(a);
    const mb = entry.files.reduce((s, f) => s + f.bytes, 0) / 1048576;
    console.log(`${entry.files.length} file, ${mb.toFixed(2)} MB`);
    assets.push(entry);
  }
  // giữ entry không phải Poly Haven (Mixamo, Sketchfab CC-BY, terrain) đã có trong manifest — TIP-019 sửa lỗi ghi đè
  for (const a of prevAssets) if (a.source !== 'polyhaven' && !assets.some((x) => x.id === a.id)) assets.push(a);
  const totalBytes = assets.reduce((s, a) => s + a.files.reduce((t, f) => t + f.bytes, 0), 0);
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    policy: 'ADR-005/006/007: CC0 Poly Haven qua fetch-assets; Mixamo (convert-mixamo/extract-arms); Sketchfab CC-BY (convert-weapon/convert-model) — entry không phải polyhaven được giữ khi chạy lại fetch',
    totalBytes,
    assets,
  };
  mkdirSync(dirname(MANIFEST), { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`[assets] ${assets.length} asset, tổng ${(totalBytes / 1048576).toFixed(1)} MB → ${MANIFEST}`);
}
