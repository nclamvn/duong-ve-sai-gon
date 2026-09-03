/**
 * Súng trường prop cho nhân vật glTF (TIP-012): Mixamo không kèm vũ khí → gắn AR procedural vào bone tay phải.
 * Geometry gộp 1 mesh, trục nòng −z, gốc tại tay cầm. Offset/rotation calibrate theo rig Mixamo (RightHand).
 */
import { Mesh, BoxGeometry, CylinderGeometry, MeshStandardNodeMaterial, Matrix4, Euler, Quaternion, Vector3, Object3D, Group, type BufferGeometry } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { instantiateWeapon, type WeaponAsset } from './weaponModel';

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3(1, 1, 1);

function part(g: BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): BufferGeometry {
  _p.set(x, y, z);
  _q.setFromEuler(new Euler(rx, ry, rz));
  _m.compose(_p, _q, _s);
  g.applyMatrix4(_m);
  return g.index ? g.toNonIndexed() : g;
}

let cached: BufferGeometry | null = null;
function rifleGeometry(): BufferGeometry {
  if (cached) return cached;
  const parts: BufferGeometry[] = [
    part(new BoxGeometry(0.05, 0.075, 0.3), 0, 0.02, -0.06), // receiver
    part(new BoxGeometry(0.056, 0.02, 0.26), 0, 0.066, -0.1), // rail
    part(new BoxGeometry(0.052, 0.06, 0.26), 0, 0.01, -0.36), // handguard
    part(new CylinderGeometry(0.011, 0.011, 0.3, 10), 0, 0.03, -0.62, Math.PI / 2), // nòng
    part(new CylinderGeometry(0.016, 0.016, 0.05, 10), 0, 0.03, -0.76, Math.PI / 2), // giảm giật
    part(new BoxGeometry(0.036, 0.17, 0.06), 0, -0.1, -0.1, 0.12), // băng đạn
    part(new BoxGeometry(0.03, 0.09, 0.045), 0, -0.06, 0.03, -0.3), // tay cầm
    part(new BoxGeometry(0.045, 0.06, 0.22), 0, 0.015, 0.2), // báng
    part(new BoxGeometry(0.03, 0.035, 0.03), 0, 0.09, -0.3), // đầu ruồi
    part(new BoxGeometry(0.036, 0.03, 0.04), 0, 0.09, -0.02), // thước ngắm
  ];
  const g = mergeGeometries(parts, false);
  if (!g) throw new Error('rifle merge failed');
  for (const p of parts) p.dispose();
  cached = g;
  return g;
}

let mat: MeshStandardNodeMaterial | null = null;

/**
 * Offset mặc định cho bone Mixamo `mixamorigRightHand` (đơn vị m, rad) — calibrate bằng ảnh (evidence/TIP-012/rifle-*.png).
 * Bone: +y dọc bàn tay (cổ tay → ngón), −z hướng lên mu bàn tay khi cầm súng. Euler XYZ = Rx(π/2)·Rz(π):
 * nòng (−z súng) → +y bone (về phía trước), băng đạn (−y súng) → +z bone (xuống). pos: 5 cm ra trước, 7 cm lên để
 * tay cầm nằm trong lòng bàn tay, tay trái ôm ốp lót (Rifle Aiming/Idle/Run của Mixamo đều khớp).
 */
export const RIFLE_HAND_OFFSET = { pos: new Vector3(0.0, 0.05, -0.07), rot: new Euler(Math.PI / 2, 0, Math.PI) };

export function createRifleProp(): Mesh {
  mat ??= new MeshStandardNodeMaterial({ color: 0x24282c, roughness: 0.5, metalness: 0.7 });
  const m = new Mesh(rifleGeometry(), mat);
  m.castShadow = true;
  m.receiveShadow = false;
  m.frustumCulled = false;
  m.name = 'rifle_prop';
  return m;
}

/** Đầu nòng của súng procedural (local, trục −z) — FX địch (TIP-014) lấy world position từ node này. */
export const RIFLE_MUZZLE_LOCAL = new Vector3(0, 0.03, -0.785);

export interface AttachedRifle {
  /** pivot trong bone tay (position/rotation = offset calibrate) */
  pivot: Object3D;
  /** Object3D tại đầu nòng (world position cho FX) */
  muzzle: Object3D;
  kind: 'procedural' | 'gltf';
}

/**
 * Gắn súng vào bone tay phải. Có model glTF (TIP-014) → instance chia sẻ geometry, pivot = anchor gripR (tay cầm) với offset `cfg.hand`;
 * không có → AR procedural (pivot = gốc mesh, offset RIFLE_HAND_OFFSET).
 */
export function attachRifle(handBone: Object3D, weapon: WeaponAsset | null = null, offset = RIFLE_HAND_OFFSET): AttachedRifle {
  if (weapon) {
    const inst = instantiateWeapon(weapon, { castShadow: true });
    const pivot = new Group();
    pivot.name = 'rifle_pivot';
    const h = weapon.cfg.hand;
    pivot.position.set(h.pos[0], h.pos[1], h.pos[2]);
    pivot.rotation.set(h.rot[0], h.rot[1], h.rot[2]);
    const g = weapon.cfg.anchors.gripR;
    inst.root.position.set(-g[0], -g[1], -g[2]);
    pivot.add(inst.root);
    handBone.add(pivot);
    return { pivot, muzzle: inst.anchors.muzzle, kind: 'gltf' };
  }
  const rifle = createRifleProp();
  rifle.position.copy(offset.pos);
  rifle.rotation.copy(offset.rot);
  const muzzle = new Object3D();
  muzzle.name = 'muzzle';
  muzzle.position.copy(RIFLE_MUZZLE_LOCAL);
  rifle.add(muzzle);
  handBone.add(rifle);
  return { pivot: rifle, muzzle, kind: 'procedural' };
}
