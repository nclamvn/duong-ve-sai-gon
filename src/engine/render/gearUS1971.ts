/**
 * Trang bị lính Mỹ / lính Sài Gòn 1971 dựng procedural (TIP-D11c, DV-046 "trang phục địch chuẩn rằn ri Mỹ"): mũ sắt M1 bọc
 * vải rằn ri ERDL + dây mũ (helmet band) + quai cằm thả, dây đeo M1956 (dây vai gắn bone ngực; thắt lưng súng lục + 2 túi đạn
 * + bi đông gắn bone hông). Cùng quy ước với gear1971: geometry cache dùng chung, offset bone theo rig Mixamo (+y dọc xương,
 * nhân vật nhìn +z), kích thước theo sọ Swat (rộng ±0,11 / dài 0,27 m — to hơn đầu thật ~1,35×).
 * Kích thước thật: M1 dài 28 × rộng 24 × cao 17 cm; thắt lưng M1956 rộng 5,7 cm; túi đạn M1956 8 × 14 × 7 cm; bi đông 1 qt
 * trong bao 9 × 19 × 6 cm. Registry: `uni.us.1971.erdl`, `uni.us.1956.web_gear` (tier H → `approved: false` tới khi cố vấn duyệt).
 */
import { Mesh, Group, LatheGeometry, BoxGeometry, CylinderGeometry, MeshStandardNodeMaterial, DoubleSide, Vector2, Vector3, Euler, Quaternion, Matrix4, type BufferGeometry, type Object3D } from 'three/webgpu';
import { uv, vec2 } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { erdlPatternNode } from './camo';

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

/** OG-107 (vải trang bị Mỹ) — xanh ô-liu xám, tối hơn mũ cối QGP */
export const US_WEB_COLOR = 0x4a5140;
/** dây mũ / quai cằm — vải đen-ô-liu */
export const US_STRAP_COLOR = 0x2e3128;

let m1Geo: BufferGeometry | null = null;
let m1TrimGeo: BufferGeometry | null = null;
let beltGeo: BufferGeometry | null = null;
let suspGeo: BufferGeometry | null = null;
let coverMat: MeshStandardNodeMaterial | null = null;
let webMat: MeshStandardNodeMaterial | null = null;
let strapMat: MeshStandardNodeMaterial | null = null;

function coverMaterial(): MeshStandardNodeMaterial {
  if (!coverMat) {
    coverMat = new MeshStandardNodeMaterial({ roughness: 0.93, metalness: 0, side: DoubleSide });
    // UV lathe: u quanh mũ (~1 m chu vi), v dọc mặt cắt (~0,35 m) → tần số thấp hơn atlas thân (26 ≈ 3,6 m/UV)
    coverMat.colorNode = erdlPatternNode(uv().mul(vec2(1, 0.35)) as never, 7);
  }
  return coverMat;
}

function webMaterial(): MeshStandardNodeMaterial {
  webMat ??= new MeshStandardNodeMaterial({ color: US_WEB_COLOR, roughness: 0.92, metalness: 0 });
  return webMat;
}

function strapMaterial(): MeshStandardNodeMaterial {
  strapMat ??= new MeshStandardNodeMaterial({ color: US_STRAP_COLOR, roughness: 0.85, metalness: 0, side: DoubleSide });
  return strapMat;
}

/**
 * Mũ sắt M1 (vỏ + bọc vải): chỏm tròn cao ~15 cm, thành gần thẳng, vành loe nhẹ và cụp xuống ~1,5 cm (che gáy/tai), mép cuộn.
 * Gốc = mặt phẳng vành, +y lên, +z trước. Kéo dài theo z ×1,12 (M1 dài hơn rộng ~15 %).
 */
export function m1HelmetGeometry(): BufferGeometry {
  if (m1Geo) return m1Geo;
  const pts: Vector2[] = [
    new Vector2(0, 0.152),
    new Vector2(0.045, 0.149),
    new Vector2(0.085, 0.137),
    new Vector2(0.115, 0.113),
    new Vector2(0.133, 0.083),
    new Vector2(0.142, 0.052),
    new Vector2(0.146, 0.022),
    new Vector2(0.147, 0.0), // chân thành
    new Vector2(0.154, -0.012), // vành loe + cụp
    new Vector2(0.158, -0.02), // mép ngoài
    new Vector2(0.152, -0.025),
    new Vector2(0.142, -0.014), // mặt dưới vành → lòng mũ
    new Vector2(0.135, 0.004),
    new Vector2(0.128, 0.04),
  ];
  const lathe = new LatheGeometry(pts, 32);
  const g = part(lathe, 0, 0, 0, 0, 0, 0, 1.05, 1.0, 1.16);
  g.computeVertexNormals();
  m1Geo = g;
  return g;
}

/** Dây mũ (helmet band) quanh thân mũ + 2 quai cằm thả xuống má (lính 1971 hay không cài). Gốc như mũ. */
export function m1TrimGeometry(): BufferGeometry {
  if (m1TrimGeo) return m1TrimGeo;
  const band = new LatheGeometry([new Vector2(0.149, 0.03), new Vector2(0.151, 0.03), new Vector2(0.151, 0.052), new Vector2(0.149, 0.052)], 32);
  const parts: BufferGeometry[] = [
    part(band, 0, 0, 0, 0, 0, 0, 1.05, 1.0, 1.16),
    part(new BoxGeometry(0.018, 0.075, 0.004), -0.146, -0.05, 0.035, 0.1, 0, 0.12), // quai trái
    part(new BoxGeometry(0.018, 0.075, 0.004), 0.146, -0.05, 0.035, 0.1, 0, -0.12), // quai phải
  ];
  const g = mergeGeometries(parts, false);
  if (!g) throw new Error('m1 trim merge failed');
  for (const p of parts) p.dispose();
  g.computeVertexNormals();
  m1TrimGeo = g;
  return g;
}

/**
 * Thắt lưng súng lục M1956 (vòng elip quanh hông) + 2 túi đạn trước hai bên + bi đông bao vải sau hông phải + xẻng gấp trái
 * (khối gọn). Gốc = tâm hông ngang thắt lưng, +y lên, +z trước.
 */
export function m1956BeltGeometry(): BufferGeometry {
  if (beltGeo) return beltGeo;
  const belt = new CylinderGeometry(1, 1, 0.057, 24, 1, true);
  const parts: BufferGeometry[] = [part(belt, 0, 0, -0.01, 0, 0, 0, 0.2, 1, 0.16)];
  // túi đạn M1956 (8 × 14 × 7 cm) treo dưới thắt lưng, hai bên trước
  for (const [x, ry] of [[-0.135, 0.5], [0.135, -0.5]] as Array<[number, number]>) {
    parts.push(part(new BoxGeometry(0.082, 0.14, 0.07), x, -0.085, 0.105, 0.06, ry, 0));
    parts.push(part(new BoxGeometry(0.09, 0.045, 0.078), x, -0.03, 0.107, 0.1, ry, 0)); // nắp
  }
  // bi đông 1 qt trong bao: khối bo (hộp + trụ) sau hông phải
  parts.push(part(new BoxGeometry(0.085, 0.16, 0.06), 0.17, -0.1, -0.1, 0, 0.9, 0));
  parts.push(part(new CylinderGeometry(0.03, 0.03, 0.035, 10), 0.17, -0.005, -0.1)); // cổ bao/nắp
  // xẻng gấp trong bao sau hông trái
  parts.push(part(new BoxGeometry(0.11, 0.15, 0.045), -0.17, -0.09, -0.1, 0, -0.9, 0));
  const g = mergeGeometries(parts, false);
  if (!g) throw new Error('m1956 belt merge failed');
  for (const p of parts) p.dispose();
  g.computeVertexNormals();
  beltGeo = g;
  return g;
}

/** Dây vai M1956 (2 dải qua vai, nối trước – sau) gắn bone ngực trên. Gốc = giữa ngực trên, +z trước. */
export function m1956SuspenderGeometry(): BufferGeometry {
  if (suspGeo) return suspGeo;
  const parts: BufferGeometry[] = [
    part(new BoxGeometry(0.045, 0.3, 0.008), -0.095, 0.02, 0.12, -0.5, 0, 0.18), // trước trái
    part(new BoxGeometry(0.045, 0.3, 0.008), 0.095, 0.02, 0.12, -0.5, 0, -0.18), // trước phải
    part(new BoxGeometry(0.045, 0.26, 0.008), -0.085, 0.06, -0.1, 0.45, 0, 0.1), // sau trái
    part(new BoxGeometry(0.045, 0.26, 0.008), 0.085, 0.06, -0.1, 0.45, 0, -0.1), // sau phải
    part(new BoxGeometry(0.05, 0.04, 0.02), -0.1, -0.11, 0.155), // khoá/túi băng nhỏ trước
    part(new BoxGeometry(0.05, 0.04, 0.02), 0.1, -0.11, 0.155),
  ];
  const g = mergeGeometries(parts, false);
  if (!g) throw new Error('suspender merge failed');
  for (const p of parts) p.dispose();
  g.computeVertexNormals();
  suspGeo = g;
  return g;
}

export interface GearUS1971 {
  helmet: Group | null;
  belt: Mesh | null;
  suspenders: Mesh | null;
  dispose(): void;
}

/** Head bone (Swat, bind) y 1,558 m → vành M1 ~1,66 m (trên lông mày, che nửa tai), chỏm ~1,81 m. */
export const M1_HEAD_OFFSET = { pos: new Vector3(0, 0.112, 0.012), rot: new Euler(-0.02, 0, 0) };
/** Hips bone (y ~0,98 m): thắt lưng ở eo, cao hơn gốc bone ~7 cm. */
export const BELT_HIPS_OFFSET = { pos: new Vector3(0, 0.07, 0.0), rot: new Euler(0, 0, 0) };
/** Spine2: dây vai bám sát áo (ra trước 12 cm, hạ 2 cm). */
export const SUSP_CHEST_OFFSET = { pos: new Vector3(0, -0.02, 0.06), rot: new Euler(0.06, 0, 0) };

function mesh(g: BufferGeometry, mat: MeshStandardNodeMaterial, name: string): Mesh {
  const m = new Mesh(g, mat);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  m.frustumCulled = false;
  return m;
}

/** Gắn mũ sắt M1 (bone đầu), dây vai (bone ngực), thắt lưng + túi + bi đông (bone hông). Bone null → bỏ qua. */
export function attachGearUS1971(bones: { head: Object3D | null; chest: Object3D | null; hips: Object3D | null }, opts: { helmet?: boolean; belt?: boolean; suspenders?: boolean } = {}): GearUS1971 {
  let helmet: Group | null = null;
  let belt: Mesh | null = null;
  let suspenders: Mesh | null = null;
  if (opts.helmet !== false && bones.head) {
    helmet = new Group();
    helmet.name = 'gear_m1_helmet';
    helmet.add(mesh(m1HelmetGeometry(), coverMaterial(), 'gear_m1_cover'));
    helmet.add(mesh(m1TrimGeometry(), strapMaterial(), 'gear_m1_band'));
    helmet.position.copy(M1_HEAD_OFFSET.pos);
    helmet.rotation.copy(M1_HEAD_OFFSET.rot);
    bones.head.add(helmet);
  }
  if (opts.belt !== false && bones.hips) {
    belt = mesh(m1956BeltGeometry(), webMaterial(), 'gear_m1956_belt');
    belt.position.copy(BELT_HIPS_OFFSET.pos);
    belt.rotation.copy(BELT_HIPS_OFFSET.rot);
    bones.hips.add(belt);
  }
  if (opts.suspenders !== false && bones.chest) {
    suspenders = mesh(m1956SuspenderGeometry(), webMaterial(), 'gear_m1956_suspenders');
    suspenders.position.copy(SUSP_CHEST_OFFSET.pos);
    suspenders.rotation.copy(SUSP_CHEST_OFFSET.rot);
    bones.chest.add(suspenders);
  }
  return {
    helmet,
    belt,
    suspenders,
    dispose: () => {
      helmet?.removeFromParent();
      belt?.removeFromParent();
      suspenders?.removeFromParent();
    },
  };
}

export const GEAR_US_TRIANGLES = (): { helmet: number; belt: number; suspenders: number } => ({
  helmet: (m1HelmetGeometry().attributes['position']!.count + m1TrimGeometry().attributes['position']!.count) / 3,
  belt: m1956BeltGeometry().attributes['position']!.count / 3,
  suspenders: m1956SuspenderGeometry().attributes['position']!.count / 3,
});
