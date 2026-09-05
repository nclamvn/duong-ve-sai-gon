/**
 * Trang bị lính Quân Giải phóng 1971 dựng procedural (TIP-D11a, DV-025 "procedural trước"): mũ cối (pith helmet) gắn bone đầu,
 * bao xe AK 3 túi (chest rig) gắn bone ngực. Geometry dùng chung (cache), material màu vải olive; kích thước theo registry ART01
 * (mũ cối đường kính ~29 × 33 cm, vành 3,5–4 cm; bao xe túi 7,5 × 19 × 4,5 cm). Dép cao su cần mesh bàn chân → D11b.
 * Offset bone theo rig Mixamo (bone +y dọc xương, nhân vật nhìn +z) — calibrate bằng ảnh (evidence/TIP-D11a).
 */
import { Mesh, LatheGeometry, BoxGeometry, MeshStandardNodeMaterial, DoubleSide, Vector2, Vector3, Euler, Quaternion, Matrix4, type BufferGeometry, type Object3D } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3(1, 1, 1);

function part(g: BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): BufferGeometry {
  _p.set(x, y, z);
  _q.setFromEuler(new Euler(rx, ry, rz));
  _s.set(sx, sy, sz);
  _m.compose(_p, _q, _s);
  _s.set(1, 1, 1);
  g.applyMatrix4(_m);
  return g.index ? g.toNonIndexed() : g;
}

/** màu vải mũ/bao xe (sRGB) — xanh olive bạc nắng, hơi khác áo để đọc được hình khối */
export const GEAR_CLOTH_COLOR = 0x55634a;

let helmetGeo: BufferGeometry | null = null;
let rigGeo: BufferGeometry | null = null;
let clothMat: MeshStandardNodeMaterial | null = null;

function material(): MeshStandardNodeMaterial {
  clothMat ??= new MeshStandardNodeMaterial({ color: GEAR_CLOTH_COLOR, roughness: 0.92, metalness: 0, side: DoubleSide }); // hai mặt: nhìn từ dưới vành thấy lòng mũ
  return clothMat;
}

/**
 * Mũ cối: chỏm hình bầu dục cao ~11 cm, vành nghiêng xuống ~12°, mép cuộn. Gốc = tâm vành (mặt phẳng vành), +y lên, +z trước.
 * Lathe theo mặt cắt (r, y) rồi kéo dài theo z (×1,12) cho đúng dáng trước–sau.
 */
export function pithHelmetGeometry(): BufferGeometry {
  if (helmetGeo) return helmetGeo;
  const pts: Vector2[] = [
    new Vector2(0, 0.112),
    new Vector2(0.04, 0.109),
    new Vector2(0.075, 0.098),
    new Vector2(0.105, 0.078),
    new Vector2(0.125, 0.052),
    new Vector2(0.136, 0.028),
    new Vector2(0.14, 0.008),
    new Vector2(0.141, 0.0), // chân chỏm / trong vành
    new Vector2(0.175, -0.01),
    new Vector2(0.183, -0.016), // mép ngoài vành
    new Vector2(0.178, -0.024),
    new Vector2(0.14, -0.014),
    new Vector2(0.134, -0.012), // mặt dưới vành → lỗ đội
    new Vector2(0.13, 0.02),
  ];
  const lathe = new LatheGeometry(pts, 28);
  const g = part(lathe, 0, 0, 0, 0, 0, 0, 1.0, 1.12, 1.14); // sọ Swat rộng ±0,11 / dài 0,27 / đỉnh 1,82 m → chỏm phải trùm
  g.computeVertexNormals();
  helmetGeo = g;
  return g;
}

/** Bao xe AK: 3 túi băng đạn trước ngực + dây đeo vai + dây lưng mỏng. Gốc = giữa ngực, +y lên, +z trước (mặt túi). */
export function chestRigGeometry(): BufferGeometry {
  if (rigGeo) return rigGeo;
  const parts: BufferGeometry[] = [];
  const pouchW = 0.072;
  const pouchH = 0.185;
  const pouchD = 0.05;
  // 3 túi ôm theo vòng ngực: túi ngoài lùi về sau và xoay ±23° (đọc được từng túi, không thành một tấm)
  const lay: Array<[number, number, number]> = [[-0.088, -0.018, -0.4], [0, 0, 0], [0.088, -0.018, 0.4]];
  for (const [x, dz, ry] of lay) {
    parts.push(part(new BoxGeometry(pouchW, pouchH, pouchD), x, 0, dz, 0, ry, 0));
    parts.push(part(new BoxGeometry(pouchW + 0.008, 0.052, pouchD + 0.012), x, pouchH / 2 - 0.02, dz + 0.002, 0.08, ry, 0)); // nắp
    parts.push(part(new BoxGeometry(0.02, 0.03, 0.006), x, -0.005, dz + pouchD / 2 + 0.003, 0, ry, 0)); // khuy dây buộc
  }
  parts.push(part(new BoxGeometry(0.29, 0.03, 0.02), 0, pouchH / 2 + 0.008, -0.012)); // dây ngang trên
  parts.push(part(new BoxGeometry(0.03, 0.27, 0.01), -0.105, pouchH / 2 + 0.115, -0.05, -0.55, 0, 0.22)); // dây vai trái
  parts.push(part(new BoxGeometry(0.03, 0.27, 0.01), 0.105, pouchH / 2 + 0.115, -0.05, -0.55, 0, -0.22)); // dây vai phải
  const g = mergeGeometries(parts, false);
  if (!g) throw new Error('chest rig merge failed');
  for (const p of parts) p.dispose();
  rigGeo = g;
  return g;
}

export interface Gear1971 {
  helmet: Mesh | null;
  rig: Mesh | null;
  /** gỡ khỏi bone */
  dispose(): void;
}

/** Offset bone Mixamo mặc định (m, rad) — calibrate bằng ảnh evidence/TIP-D11a. Head bone y 1,558 m (Swat, bind) → vành mũ ~1,68 m (trên lông mày), chỏm tới ~1,80 m. */
export const HELMET_HEAD_OFFSET = { pos: new Vector3(0, 0.135, 0.01), rot: new Euler(-0.05, 0, 0) };
/** Spine2 (ngực trên, y 1,334 m): túi ra trước ~19 cm (ngoài áo giáp Swat tái sơn), hạ 3 cm. */
export const RIG_CHEST_OFFSET = { pos: new Vector3(0, -0.03, 0.19), rot: new Euler(0.08, 0, 0) };

/**
 * Gắn mũ cối vào bone đầu và bao xe vào bone ngực (bone nào null → bỏ qua). Mesh không cast/receive riêng khác nhân vật.
 * `bones.chest` ưu tiên Spine2, fallback spine.
 */
export function attachGear1971(bones: { head: Object3D | null; chest: Object3D | null }, opts: { helmet?: boolean; rig?: boolean } = {}): Gear1971 {
  const mat = material();
  let helmet: Mesh | null = null;
  let rig: Mesh | null = null;
  if (opts.helmet !== false && bones.head) {
    helmet = new Mesh(pithHelmetGeometry(), mat);
    helmet.name = 'gear_pith_helmet';
    helmet.position.copy(HELMET_HEAD_OFFSET.pos);
    helmet.rotation.copy(HELMET_HEAD_OFFSET.rot);
    helmet.castShadow = true;
    helmet.receiveShadow = true;
    helmet.frustumCulled = false;
    bones.head.add(helmet);
  }
  if (opts.rig !== false && bones.chest) {
    rig = new Mesh(chestRigGeometry(), mat);
    rig.name = 'gear_chest_rig';
    rig.position.copy(RIG_CHEST_OFFSET.pos);
    rig.rotation.copy(RIG_CHEST_OFFSET.rot);
    rig.castShadow = true;
    rig.receiveShadow = true;
    rig.frustumCulled = false;
    bones.chest.add(rig);
  }
  return {
    helmet,
    rig,
    dispose: () => {
      helmet?.removeFromParent();
      rig?.removeFromParent();
    },
  };
}

/** Tìm bone ngực trên Mixamo (Spine2) trong model. */
export function findChestBone(model: Object3D): Object3D | null {
  for (const n of ['mixamorig:Spine2', 'mixamorigSpine2', 'Spine2', 'mixamorig:Spine1', 'mixamorigSpine1', 'Spine1']) {
    const o = model.getObjectByName(n);
    if (o) return o;
  }
  return null;
}

export const GEAR_TRIANGLES = (): { helmet: number; rig: number } => ({
  helmet: pithHelmetGeometry().attributes['position']!.count / 3,
  rig: chestRigGeometry().attributes['position']!.count / 3,
});
