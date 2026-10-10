// Gộp gói AB3DX "Ak47 Assault Rifle (Fps - Tps)" (Fab, Standard License, DV-055) thành MỘT glb viewmodel.
//
// Đầu vào là các glb đã đổi từ FBX bằng FBX2glTF (x86-64 Linux, chạy ở sandbox):
//   <in>/arms.glb          SK_Mannequin.fbx: tay + bộ xương UE5 (160 khớp)
//   <in>/gun.glb           SK_Ak4.fbx: súng có xương (Grip, Trigger, Magazine, charging_handle...)
//   <in>/arms/A_Ak4_*.glb  clip tay (mỗi file một clip)
//   <in>/gun/A_*_weapon.glb clip súng đi cặp với clip tay
//   <in>/mag.glb           SM_Mag_Ak.fbx: băng đạn (lưới tĩnh), gắn vào xương Magazine
// Đầu ra: glb gồm tay, súng gắn vào xương `weapon_r`, và mỗi động tác là MỘT clip chứa kênh của cả tay lẫn súng.
//
// Luật DV-054: KHÔNG sửa hình học. Script chỉ ghép, đặt tên clip và gắn texture của nghệ sĩ.
//
//   node scripts/convert-ab3dx-vm.mjs <in> <texDir> <out.glb>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, prune, dedup, unpartition, resample } from '@gltf-transform/functions';
import { readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import sharp from 'sharp';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const [IN, TEX, OUT] = process.argv.slice(2);
if (!IN || !TEX || !OUT) throw new Error('usage: convert-ab3dx-vm.mjs <in> <texDir> <out.glb>');

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const base = await io.read(join(IN, 'arms.glb'));
const root = base.getRoot();

// ---- súng: gộp vào, gắn dưới weapon_r ---------------------------------------------------------------
const gunDoc = await io.read(join(IN, 'gun.glb'));
mergeDocuments(base, gunDoc);
const scenes = root.listScenes();
const armsScene = scenes[0];
const gunScene = scenes[1];
const byName = (name, under) => {
  const hits = root.listNodes().filter((n) => n.getName() === name);
  if (!under) return hits[0];
  return hits.find((n) => isUnder(n, under));
};
function isUnder(n, anc) {
  for (let p = n; p; p = p.getParentNode()) if (p === anc) return true;
  return false;
}
const weaponR = byName('weapon_r');
if (!weaponR) throw new Error('weapon_r not found');
// gốc súng trong file là "RootNode" (con: AK47*, Root). Gắn RootNode của súng vào weapon_r.
const gunRootNode = gunScene.listChildren()[0];
gunRootNode.setName('gun');
gunScene.removeChild(gunRootNode);
weaponR.addChild(gunRootNode);
// Bỏ phép xoay đổi trục Z-up → Y-up mà FBX2glTF gắn ở gốc file súng: phía tay đã có phép đổi trục này ở `root`,
// và bên dưới weapon_r mọi thứ đã ở hệ của Unreal. Giữ nguyên thì súng bị xoay hai lần.
for (const c of gunRootNode.listChildren()) c.setRotation([0, 0, 0, 1]);
// Gắn súng thẳng vào weapon_r, không thêm phép xoay nào: chỗ gắn (vị trí + hướng) do nghệ sĩ đặt trong chính
// kênh hằng của xương weapon_r ở mỗi clip — xem fillConstantChannels.
gunScene.dispose();
const gunTop = gunRootNode;

// ---- băng đạn: lưới tĩnh riêng (SM_Mag_Ak), gắn vào xương Magazine của súng ---------------------------
{
  const magDoc = await io.read(join(IN, 'mag.glb'));
  mergeDocuments(base, magDoc);
  const magScene = root.listScenes()[1];
  const magRoot = magScene.listChildren()[0];
  magScene.removeChild(magRoot);
  for (const c of magRoot.listChildren()) c.setRotation([0, 0, 0, 1]);
  magRoot.setName('magazine_mesh');
  const magBone = root.listNodes().find((n) => n.getName() === 'Magazine' && isUnder(n, gunTop));
  if (!magBone) throw new Error('Magazine bone not found');
  magBone.addChild(magRoot);
  magScene.dispose();
}

// ---- clip -----------------------------------------------------------------------------------------------
// tên clip trong game ← file clip tay, file clip súng đi cặp (nếu có)
const PAIRS = {
  Ads_Fire: 'A_Ads_Fire_weapon',
  Ads_Fire_Auto: 'A_Ads_Fire_Auto_weapon',
  Fire_Auto_Loop: 'A_Fire_Auto_Loop_Weapon',
  Fire_Hip: 'A_Fire_Hip_Weapon',
  Reload: 'A_Reload_weapon',
  Reload_From_dry: 'A_Reload_from_dry_weapon',
  chamber_round: 'A_chamber_round_Weapon',
};

const accCache = new Map();
function copyAccessor(src) {
  const a = base.createAccessor()
    .setType(src.getType())
    .setArray(src.getArray().slice())
    .setNormalized(src.getNormalized())
    .setBuffer(root.listBuffers()[0]);
  return a;
}

/** chép mọi kênh của clip nguồn sang `anim`, dò node đích theo tên bên trong cây `scope` */
function copyChannels(srcDoc, anim, scope) {
  for (const srcAnim of srcDoc.getRoot().listAnimations()) {
    for (const ch of srcAnim.listChannels()) {
      const tn = ch.getTargetNode();
      if (!tn) continue;
      const dst = byName(tn.getName(), scope);
      if (!dst) continue;
      // Kênh của khớp gốc bị bỏ: `root` mang phép đổi trục, `RootNode` của súng là gốc gắn. Clip ghi lại
      // các giá trị gốc ấy thì sẽ đè phép đổi trục và xoay cả bộ đi 90 độ.
      if (dst === gunTop || /^(RootNode|root|Root)$/.test(dst.getName())) continue;
      const s = ch.getSampler();
      const sampler = base.createAnimationSampler()
        .setInput(copyAccessor(s.getInput()))
        .setOutput(copyAccessor(s.getOutput()))
        .setInterpolation(s.getInterpolation());
      anim.addSampler(sampler);
      anim.addChannel(base.createAnimationChannel().setTargetNode(dst).setTargetPath(ch.getTargetPath()).setSampler(sampler));
    }
  }
}

const armsTop = byName('root');

/**
 * FBX2glTF BỎ các kênh không đổi trong suốt clip. Với gói này đó là lỗi gốc của mọi thứ trông sai:
 *  - tư thế nắm của ngón tay (trái ôm ốp lót, phải ôm báng cầm) là hằng số trong idle, ngắm, đi... nên bị bỏ,
 *    ngón tay rơi về tư thế gốc của lưới: xoè thẳng, bàn tay trái giơ lên không đỡ súng;
 *  - xương `weapon_r` (chỗ gắn súng) có vị trí và hướng HẰNG do nghệ sĩ đặt (lệch 88° và 7 cm so với tư thế gốc),
 *    cũng bị bỏ, nên súng không nằm đúng trong tay.
 * Lấp lại: đọc chính file FBX bằng FBXLoader (giữ đủ 161 xương × 3 kênh; giá trị xoay trùng FBX2glTF tới 4 chữ
 * số, vị trí tính bằng cm nên × 0,01), với mỗi xương trong rig mà clip chưa có kênh, thêm kênh hằng bằng giá trị
 * của nghệ sĩ.
 */
const CM = 0.01;
function fillConstantChannels(anim, fbxPath) {
  const buf = readFileSync(fbxPath);
  const clip = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '').animations[0];
  if (!clip) return 0;
  const have = new Set(anim.listChannels().map((c) => c.getTargetNode().getName() + '.' + c.getTargetPath()));
  const dur = Math.max(clip.duration, 1 / 30);
  let n = 0;
  for (const t of clip.tracks) {
    const [bone, prop] = t.name.split('.');
    if (/^(root|RootNode)$/.test(bone)) continue;
    const path = prop === 'quaternion' ? 'rotation' : prop === 'position' ? 'translation' : null;
    if (!path) continue;
    const node = byName(bone, armsTop);
    if (!node || have.has(bone + '.' + path)) continue;
    let v = Array.from(t.values.slice(0, t.getValueSize()));
    if (path === 'translation') {
      v = v.map((x) => x * CM);
      const r = node.getTranslation();
      if (Math.hypot(v[0] - r[0], v[1] - r[1], v[2] - r[2]) < 1e-4) continue; // trùng tư thế gốc: không cần kênh
    }
    const sampler = base.createAnimationSampler()
      .setInput(base.createAccessor().setType('SCALAR').setArray(new Float32Array([0, dur])).setBuffer(root.listBuffers()[0]))
      .setOutput(base.createAccessor().setType(path === 'rotation' ? 'VEC4' : 'VEC3').setArray(new Float32Array([...v, ...v])).setBuffer(root.listBuffers()[0]))
      .setInterpolation('LINEAR');
    anim.addSampler(sampler);
    anim.addChannel(base.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(sampler));
    n++;
  }
  return n;
}
const armFiles = readdirSync(join(IN, 'arms')).filter((f) => f.endsWith('.glb')).sort();
const report = [];
for (const f of armFiles) {
  const clip = basename(f, '.glb').replace(/^A_Ak4_/, '');
  const anim = base.createAnimation(clip);
  const armDoc = await io.read(join(IN, 'arms', f));
  copyChannels(armDoc, anim, armsTop);
  const filled = fillConstantChannels(anim, join(TEX, 'Animations', 'Arms', basename(f, '.glb') + '.fbx'));
  let gunCh = 0;
  const gf = PAIRS[clip];
  if (gf) {
    const before = anim.listChannels().length;
    copyChannels(await io.read(join(IN, 'gun', gf + '.glb')), anim, gunTop);
    gunCh = anim.listChannels().length - before;
  }
  report.push(`${clip.padEnd(22)} ${String(anim.listChannels().length).padStart(4)} ch${gunCh ? `  (súng ${gunCh})` : ''}  (+${filled} kênh hằng)`);
}
// tư thế nghỉ của súng (bolt/băng đạn về chỗ) — một clip riêng, game phát ở trọng số nhỏ làm nền
{
  const anim = base.createAnimation('Weapon_Pose');
  copyChannels(await io.read(join(IN, 'gun', 'A_Weapon_Pose.glb')), anim, gunTop);
  report.push(`${'Weapon_Pose'.padEnd(22)} ${String(anim.listChannels().length).padStart(4)} ch`);
}

// ---- texture của nghệ sĩ -------------------------------------------------------------------------------
// Unity: MetallicSmoothness (R = metallic, A = smoothness) → glTF metallicRoughness (G = roughness, B = metallic)
const SIZE = 2048;
async function png(path) {
  return sharp(path).resize(SIZE, SIZE).png({ compressionLevel: 9 }).toBuffer();
}
async function ormFromUnity(path) {
  const { data, info } = await sharp(path).resize(SIZE, SIZE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    out[j] = 255;
    out[j + 1] = 255 - data[i + 3];
    out[j + 2] = data[i];
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } }).png({ compressionLevel: 9 }).toBuffer();
}
async function texture(name, buf) {
  return base.createTexture(name).setImage(buf).setMimeType('image/png');
}
const SETS = {
  MI_Manny_02: { dir: 'Character/Textures', stem: 'T_AB3DX_02' },
  MI_Manny_01: { dir: 'Character/Textures', stem: 'T_AB3DX_01' },
  M_Ak4: { dir: 'Textures', stem: 'T_Ak', albedo: 'T_Ak_BaseColor_no47' },
};
for (const mat of root.listMaterials()) {
  const set = SETS[mat.getName()];
  if (!set) {
    report.push(`material ${mat.getName()}: không có texture`);
    continue;
  }
  const d = join(TEX, set.dir);
  const albedo = join(d, (set.albedo ?? set.stem + '_AlbedoTransparency') + '.png');
  mat.setBaseColorTexture(await texture(set.stem + '_albedo', await png(albedo)));
  mat.setBaseColorFactor([1, 1, 1, 1]);
  mat.setNormalTexture(await texture(set.stem + '_normal', await png(join(d, set.stem + '_Normal.png'))));
  mat.setMetallicRoughnessTexture(await texture(set.stem + '_mr', await ormFromUnity(join(d, set.stem + '_MetallicSmoothness.png'))));
  mat.setMetallicFactor(1).setRoughnessFactor(1);
  mat.setAlphaMode('OPAQUE');
  mat.setDoubleSided(false);
}

console.log(report.join('\n'));
// resample: bỏ khoá thừa (khoá nằm thẳng hàng giữa hai khoá kề) — không đổi chuyển động, chỉ bớt dữ liệu
await base.transform(unpartition(), resample({ tolerance: 1e-4 }), dedup(), prune({ keepLeaves: true, keepAttributes: true }));
await io.write(OUT, base);
console.log('anims', root.listAnimations().length, 'nodes', root.listNodes().length, 'materials', root.listMaterials().map((m) => m.getName()).join(','));
void readFileSync;
// DV-062: asset Fab Standard không để trần trong public/ → đóng gói lại ngay (manifest + pak.json cập nhật)
console.log('đóng gói bảo vệ: node scripts/pack-assets.mjs');
const { execFileSync } = await import('node:child_process');
execFileSync(process.execPath, ['scripts/pack-assets.mjs'], { stdio: 'inherit' });
