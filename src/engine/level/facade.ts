/**
 * Nhà ống procedural (TIP-019): mỗi lot = khối tường (texture trát/gạch, màu theo vertex color), sàn/ban công + lan can,
 * cửa sổ kính tối, tầng trệt cửa cuốn / cửa hàng mở (hốc tối + mái hiên) / đổ nát, mái bằng có lan can + bồn nước,
 * hoặc mái tôn/ngói, biển hiệu canvas (text từ content JSON). Gộp geometry theo material → ~7 draw cho cả dãy.
 * Collider: khối nhà 1:1 (builder). Hệ: mặt tiền quay về phố (west: +x, east: −x).
 */
import { BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Mesh, MeshStandardNodeMaterial, Group, CanvasTexture, SRGBColorSpace, Vector3, Euler, Quaternion, Matrix4, PlaneGeometry, CylinderGeometry, DoubleSide } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createTexturedMaterial, createPropMaterial } from '@engine/render/materials';
import type { PbrTextureSet } from '@engine/render/assets';
import type { LotDef } from './types';

export interface FacadeMaterials {
  walls: Record<LotDef['wall'], MeshStandardNodeMaterial>;
  trim: MeshStandardNodeMaterial;
  glass: MeshStandardNodeMaterial;
  shutter: MeshStandardNodeMaterial;
  shutterRust: MeshStandardNodeMaterial;
  tin: MeshStandardNodeMaterial;
  tile: MeshStandardNodeMaterial;
  concrete: MeshStandardNodeMaterial;
  dark: MeshStandardNodeMaterial;
  metal: MeshStandardNodeMaterial;
  awning: MeshStandardNodeMaterial;
}

const _m = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion();
const _s = new Vector3(1, 1, 1);
const _c = new Color();

function place(g: BufferGeometry, x: number, y: number, z: number, yaw = 0, sx = 1, sy = 1, sz = 1): BufferGeometry {
  _p.set(x, y, z);
  _q.setFromEuler(new Euler(0, yaw, 0));
  _s.set(sx, sy, sz);
  _m.compose(_p, _q, _s);
  g.applyMatrix4(_m);
  return g.index ? g.toNonIndexed() : g;
}

/** gán vertex color (nhân albedo) cho geometry */
function tint(g: BufferGeometry, hex: number, mul = 1): BufferGeometry {
  _c.set(hex).multiplyScalar(mul);
  const n = g.attributes['position']!.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = _c.r;
    arr[i * 3 + 1] = _c.g;
    arr[i * 3 + 2] = _c.b;
  }
  g.setAttribute('color', new Float32BufferAttribute(arr, 3));
  return g;
}

/** box với UV theo mét (tile texture đúng kích thước thật) */
function mbox(w: number, h: number, d: number): BoxGeometry {
  const g = new BoxGeometry(w, h, d);
  const uv = g.attributes['uv']!;
  const pos = g.attributes['position']!;
  const nor = g.attributes['normal']!;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (nx > 0.5) uv.setXY(i, z, y);
    else if (ny > 0.5) uv.setXY(i, x, z);
    else uv.setXY(i, x, y);
  }
  return g;
}

export function createFacadeMaterials(tex: Record<string, PbrTextureSet> | null): FacadeMaterials {
  const wall = (id: string, tile: number, grime: number): MeshStandardNodeMaterial =>
    tex?.[id] ? createTexturedMaterial(tex[id]!, { tileMeters: tile, vertexTint: true, roughnessScale: 1.0, grime }) : createPropMaterial(0xd8ccb4, 0.9);
  const flat = (hex: number, rough: number, metal = 0.0): MeshStandardNodeMaterial => new MeshStandardNodeMaterial({ color: hex, roughness: rough, metalness: metal });
  const mats: FacadeMaterials = {
    walls: {
      plaster: wall('painted_plaster_wall', 2.4, 0.5),
      damaged: wall('damaged_plaster', 2.6, 0.7),
      peeling: wall('peeling_painted_wall', 2.2, 0.6),
      plastered: wall('plastered_wall_02', 2.5, 0.45),
      brick: wall('painted_worn_brick', 2.0, 0.5),
    },
    trim: flat(0xf2efe6, 0.7),
    glass: new MeshStandardNodeMaterial({ color: 0x0d1a26, roughness: 0.08, metalness: 0.6, envMapIntensity: 1.5 }),
    shutter: tex?.['painted_metal_shutter'] ? createTexturedMaterial(tex['painted_metal_shutter']!, { tileMeters: 1.5, vertexTint: true, metalness: 0.4, roughnessScale: 0.9 }) : flat(0x7b8791, 0.6, 0.4),
    shutterRust: tex?.['rusty_metal_shutter'] ? createTexturedMaterial(tex['rusty_metal_shutter']!, { tileMeters: 1.5, metalness: 0.4, roughnessScale: 0.95 }) : flat(0x6b5a4a, 0.8, 0.3),
    tin: tex?.['corrugated_iron_02'] ? createTexturedMaterial(tex['corrugated_iron_02']!, { tileMeters: 1.2, vertexTint: true, metalness: 0.5, roughnessScale: 0.9, rust: tex['rusty_metal_02'] ? { tex: tex['rusty_metal_02']!, amount: 0.45 } : undefined }) : flat(0x8a8f93, 0.6, 0.5),
    tile: tex?.['clay_roof_tiles'] ? createTexturedMaterial(tex['clay_roof_tiles']!, { tileMeters: 1.6, roughnessScale: 1.0 }) : flat(0x9a4a35, 0.9),
    concrete: tex?.['concrete_wall_001'] ? createTexturedMaterial(tex['concrete_wall_001']!, { tileMeters: 2.0, tint: 0xb8b4ac, roughnessScale: 1.0, grime: 0.4 }) : flat(0x9a978f, 0.9),
    dark: flat(0x07080a, 0.95),
    metal: flat(0x2b2f33, 0.55, 0.7),
    awning: new MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.85, vertexColors: true, side: DoubleSide }),
  };
  mats.trim.vertexColors = true;
  mats.trim.color = new Color(0xffffff);
  return mats;
}

/** Biển hiệu: canvas text (font đậm), nền màu, viền — 1 texture / biển */
export function makeSignTexture(text: string, bg: number, w: number, h: number): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = Math.max(64, Math.round((1024 * h) / w));
  const ctx = canvas.getContext('2d')!;
  const bgc = new Color(bg);
  ctx.fillStyle = `rgb(${Math.round(bgc.r * 255)},${Math.round(bgc.g * 255)},${Math.round(bgc.b * 255)})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const lum = 0.299 * bgc.r + 0.587 * bgc.g + 0.114 * bgc.b;
  const fg = lum > 0.5 ? '#1a1a1a' : '#fffdf5';
  ctx.strokeStyle = fg;
  ctx.lineWidth = 8;
  ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = Math.round(canvas.height * 0.55);
  ctx.font = `bold ${size}px "Helvetica Neue", Arial, sans-serif`;
  while (ctx.measureText(text).width > canvas.width - 80 && size > 24) {
    size -= 4;
    ctx.font = `bold ${size}px "Helvetica Neue", Arial, sans-serif`;
  }
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  // vệt bẩn/mòn nhẹ (hash deterministic theo text — không Math.random)
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#000';
  let hsh = 2166136261;
  for (let i = 0; i < text.length; i++) hsh = Math.imul(hsh ^ text.charCodeAt(i), 16777619);
  const hr = (): number => ((hsh = (Math.imul(hsh, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 40; i++) ctx.fillRect(hr() * canvas.width, hr() * canvas.height, 2 + hr() * 30, 1 + hr() * 3);
  ctx.globalAlpha = 1;
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export interface FacadeBuild {
  group: Group;
  /** collider khối nhà: [x, y, z, hx, hy, hz] */
  colliders: Array<{ id: string; position: [number, number, number]; size: [number, number, number]; yaw?: number }>;
  drawEstimate: number;
  signs: number;
}

interface Bins {
  [k: string]: BufferGeometry[];
}

const FLOOR_H = 3.3;
const GROUND_H = 3.9;
const DEPTH = 12;
const FRONT = 9; // mặt tiền tại |x| = 9 (mép vỉa hè)

/**
 * Dựng cả dãy nhà: lots → group (mesh gộp theo material) + collider từng lot.
 * Mặt tiền: west tại x = −FRONT (mặt về +x), east tại x = +FRONT (mặt về −x).
 */
export interface FacadeFrame {
  /** gốc và góc quay (quanh y) đặt dãy nhà: dãy dọc phố ngang (TIP-019) xây trong hệ ảo rồi quay */
  origin: [number, number];
  yaw: number;
}

export function buildFacades(lots: LotDef[], mats: FacadeMaterials, seed = 1, frame?: FacadeFrame): FacadeBuild {
  let s = seed >>> 0 || 1;
  const rnd = (): number => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const bins: Bins = { trim: [], glass: [], shutter: [], shutterRust: [], tin: [], tile: [], concrete: [], dark: [], metal: [], awning: [] };
  const wallBins: Record<string, BufferGeometry[]> = { plaster: [], damaged: [], peeling: [], plastered: [], brick: [] };
  const group = new Group();
  group.name = 'facades';
  const colliders: FacadeBuild['colliders'] = [];
  let signs = 0;
  const signMeshes: Mesh[] = [];

  for (let li = 0; li < lots.length; li++) {
    const lot = lots[li]!;
    const east = lot.side === 'east';
    const sign = east ? -1 : 1; // hướng mặt tiền (từ nhà ra phố) theo x
    const cx = east ? FRONT + DEPTH / 2 : -FRONT - DEPTH / 2;
    const fx = east ? FRONT : -FRONT; // mặt tiền
    const w = lot.width;
    const floors = Math.max(1, lot.floors);
    const h = GROUND_H + (floors - 1) * FLOOR_H;
    const dmg = lot.damage;
    const ruin = lot.ground === 'ruin';
    const hEff = ruin ? Math.max(GROUND_H * 0.9, h * 0.55) : h;
    const wallColor = ruin || dmg > 0.7 ? 0x6e675c : lot.color;
    const wallMul = 1 - dmg * 0.45;
    // khối tường chính (lùi 0.02 để không z-fight với chi tiết)
    wallBins[lot.wall]!.push(tint(place(mbox(DEPTH, hEff, w - 0.06), cx, hEff / 2, lot.z), wallColor, wallMul));
    colliders.push({ id: `lot_${li}`, position: [cx, hEff / 2, lot.z], size: [DEPTH / 2, hEff / 2, w / 2] });
    // vách ngăn giữa hai nhà (khe 6 cm) → trụ trim
    bins['trim']!.push(tint(place(mbox(0.25, hEff, 0.12), fx - sign * 0.05, hEff / 2, lot.z - w / 2), 0xd9d3c4));
    // tầng trệt
    const gy = GROUND_H;
    const doorW = Math.min(w - 0.9, 3.6);
    if (lot.ground === 'shutter' || (ruin && rnd() < 0.5)) {
      const g = tint(place(mbox(0.06, gy - 0.4, doorW), fx + sign * 0.02, (gy - 0.4) / 2, lot.z), dmg > 0.5 ? 0x8a8a8a : lot.color, 0.9);
      (dmg > 0.5 ? bins['shutterRust'] : bins['shutter'])!.push(g);
      bins['trim']!.push(tint(place(mbox(0.1, 0.35, doorW + 0.3), fx + sign * 0.06, gy - 0.2, lot.z), 0xd0c8b6));
    } else if (lot.ground === 'shop') {
      // hốc cửa hàng tối sâu 2.5 m + kệ
      bins['dark']!.push(place(mbox(2.6, gy - 0.5, doorW), fx - sign * 1.3, (gy - 0.5) / 2, lot.z));
      bins['trim']!.push(tint(place(mbox(0.12, gy, 0.16), fx + sign * 0.04, gy / 2, lot.z - doorW / 2), 0xe6e0d0));
      bins['trim']!.push(tint(place(mbox(0.12, gy, 0.16), fx + sign * 0.04, gy / 2, lot.z + doorW / 2), 0xe6e0d0));
      if (lot.awning !== undefined) {
        // mái hiên: tấm nghiêng ~20° nhô 1.8 m về phố (hai mặt)
        const pg = new PlaneGeometry(1.9, doorW + 0.4);
        pg.rotateY(Math.PI / 2); // pháp tuyến +x → mặt phẳng trong y–z
        pg.rotateZ(sign * -0.35); // nghiêng xuống phía phố
        bins['awning']!.push(tint(place(pg, fx + sign * 0.9, gy - 0.75, lot.z), lot.awning));
        // sọc: thêm dải trắng mỏng
        for (let k = -1; k <= 1; k += 2) {
          const st = new PlaneGeometry(1.9, 0.18);
          st.rotateY(Math.PI / 2);
          st.rotateZ(sign * -0.35);
          bins['awning']!.push(tint(place(st, fx + sign * 0.905, gy - 0.745, lot.z + (k * doorW) / 4), 0xf5f2ea));
        }
      }
    } else {
      // đổ nát: lỗ hổng lớn + gạch đổ
      bins['dark']!.push(place(mbox(2.0, gy - 0.2, doorW + 0.6), fx - sign * 0.9, (gy - 0.2) / 2, lot.z));
      bins['concrete']!.push(place(mbox(1.6, 0.9, doorW + 1.2), fx + sign * 0.8, 0.45, lot.z, rnd() * 0.4));
    }
    // các tầng trên: sàn/ban công, cửa sổ/cửa ban công, lan can
    for (let f = 1; f < floors; f++) {
      const y0 = GROUND_H + (f - 1) * FLOOR_H;
      if (ruin && y0 + 1 > hEff) break;
      const balcony = lot.balcony && !ruin;
      if (balcony) {
        bins['concrete']!.push(place(mbox(1.3, 0.18, w - 0.3), fx + sign * 0.6, y0 + 0.09, lot.z));
        // lan can: thanh dọc + tay vịn
        bins['metal']!.push(place(mbox(0.05, 0.05, w - 0.3), fx + sign * 1.22, y0 + 1.05, lot.z));
        const n = Math.max(4, Math.round((w - 0.3) / 0.14));
        for (let k = 0; k < n; k++) bins['metal']!.push(place(mbox(0.03, 1.0, 0.03), fx + sign * 1.22, y0 + 0.58, lot.z - (w - 0.4) / 2 + (k * (w - 0.4)) / (n - 1)));
        bins['metal']!.push(place(mbox(0.05, 0.05, 1.25), fx + sign * 0.62, y0 + 1.05, lot.z - (w - 0.3) / 2));
        bins['metal']!.push(place(mbox(0.05, 0.05, 1.25), fx + sign * 0.62, y0 + 1.05, lot.z + (w - 0.3) / 2));
        // cửa ban công (kính) + khung
        bins['glass']!.push(place(mbox(0.04, 2.1, Math.min(2.0, w - 1.6)), fx + sign * 0.03, y0 + 1.25, lot.z));
        bins['trim']!.push(tint(place(mbox(0.08, 2.3, Math.min(2.3, w - 1.3)), fx - sign * 0.01, y0 + 1.25, lot.z), 0xf4f1e8));
      } else {
        // hai cửa sổ
        for (let k = -1; k <= 1; k += 2) {
          bins['glass']!.push(place(mbox(0.04, 1.3, 1.0), fx + sign * 0.03, y0 + 1.7, lot.z + (k * w) / 4));
          bins['trim']!.push(tint(place(mbox(0.08, 1.5, 1.2), fx - sign * 0.01, y0 + 1.7, lot.z + (k * w) / 4), 0xf4f1e8));
        }
      }
      // gờ sàn mảnh
      bins['trim']!.push(tint(place(mbox(0.12, 0.12, w - 0.06), fx + sign * 0.05, y0, lot.z), 0xe8e2d2));
    }
    // mái
    if (!ruin) {
      if (lot.roof === 'flat') {
        bins['concrete']!.push(place(mbox(DEPTH + 0.2, 0.12, w), cx, h + 0.06, lot.z));
        bins['concrete']!.push(place(mbox(0.15, 0.7, w), fx + sign * 0.02, h + 0.35, lot.z));
        if (rnd() < 0.6) bins['metal']!.push(place(new CylinderGeometry(0.55, 0.55, 1.2, 12), cx - sign * 2.5, h + 0.75, lot.z + (rnd() - 0.5) * (w - 1.5)));
      } else if (lot.roof === 'tin') {
        const g = mbox(DEPTH + 0.6, 0.08, w + 0.3);
        g.rotateZ(sign * -0.12);
        bins['tin']!.push(tint(place(g, cx, h + 0.35, lot.z), dmg > 0.5 ? 0x7a6a58 : 0xb9bcc0));
      } else {
        const g = mbox(DEPTH + 0.6, 0.12, w + 0.3);
        g.rotateZ(sign * -0.22);
        bins['tile']!.push(place(g, cx, h + 0.7, lot.z));
      }
    } else {
      // đổ nát: gạch vụn trên đỉnh
      bins['concrete']!.push(place(mbox(DEPTH * 0.6, 0.6, w * 0.7), cx - sign * 1.5, hEff + 0.2, lot.z, rnd() * 0.5));
    }
    // biển hiệu (trên cửa tầng trệt)
    if (lot.sign && !ruin) {
      const sw = Math.min(w - 0.5, 4.6);
      const sh = 0.8;
      const texSign = makeSignTexture(lot.sign, lot.signColor ?? 0xd8322a, sw, sh);
      const m = new Mesh(new BoxGeometry(0.1, sh, sw), new MeshStandardNodeMaterial({ map: texSign, roughness: 0.7, metalness: 0.05 }));
      m.position.set(fx + sign * 0.08, GROUND_H + 0.5, lot.z);
      m.castShadow = true;
      m.name = 'sign';
      signMeshes.push(m);
      signs++;
    }
    // muội đen do cháy (tấm tối mờ trên tường) khi damage cao
    if (dmg > 0.6) {
      bins['dark']!.push(place(mbox(0.03, hEff * 0.5, w * 0.6), fx + sign * 0.03, hEff * 0.55, lot.z + (rnd() - 0.5) * w * 0.2));
    }
  }

  let draws = 0;
  const add = (parts: BufferGeometry[], mat: MeshStandardNodeMaterial, name: string): void => {
    if (parts.length === 0) return;
    const g = mergeGeometries(parts, false);
    if (!g) throw new Error(`facade merge failed: ${name}`);
    for (const p of parts) p.dispose();
    const mesh = new Mesh(g, mat);
    mesh.name = `facade_${name}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    group.add(mesh);
    draws++;
  };
  for (const k of Object.keys(wallBins)) add(wallBins[k]!, mats.walls[k as LotDef['wall']], `wall_${k}`);
  add(bins['trim']!, mats.trim, 'trim');
  add(bins['glass']!, mats.glass, 'glass');
  add(bins['shutter']!, mats.shutter, 'shutter');
  add(bins['shutterRust']!, mats.shutterRust, 'shutter_rust');
  add(bins['tin']!, mats.tin, 'tin');
  add(bins['tile']!, mats.tile, 'tile');
  add(bins['concrete']!, mats.concrete, 'concrete');
  add(bins['dark']!, mats.dark, 'dark');
  add(bins['metal']!, mats.metal, 'metal');
  add(bins['awning']!, mats.awning, 'awning');
  for (const m of signMeshes) group.add(m);
  if (frame) {
    group.position.set(frame.origin[0], 0, frame.origin[1]);
    group.rotation.y = frame.yaw;
    const c = Math.cos(frame.yaw);
    const sn = Math.sin(frame.yaw);
    for (const col of colliders) {
      const [x, y, z] = col.position;
      col.position = [frame.origin[0] + x * c + z * sn, y, frame.origin[1] - x * sn + z * c];
      col.yaw = frame.yaw;
    }
  }
  return { group, colliders, drawEstimate: draws + signs, signs };
}
