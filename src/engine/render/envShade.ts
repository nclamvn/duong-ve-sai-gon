/**
 * Nhân vật và đồ mang theo dưới ánh rừng (DV-081). Áp lên mọi material đứng chuẩn (node) trong cây đối tượng:
 *  - che ánh trời theo bản đồ độ che tán tại chỗ đứng (như nền rừng, DV-079): dưới tán kín người không còn sáng như dán vào;
 *  - viền nắng ngược sáng: khi mặt trời ở sau lưng người (so với camera) và chỗ đứng có nắng lọt qua khe tán, mép áo/da/mũ
 *    sáng lên (Fresnel × pha thuận) → người đứng trong cột nắng tách khỏi nền như ảnh phim;
 *  - ướt theo trời (WEATHER.wet): vải/da sẫm hơn 15 %, bóng hơn (roughness × 0,62) — sương sớm, mưa phùn;
 *  - DV-082 bùn đất đỏ bám ủng và ống quần (chỉ thân có xương): dưới đường bùn ~0,15–0,5 m trên gót, mép loang theo nhiễu bám
 *    theo thân (không trôi khi đi), vệt bắn lấm tấm phía trên; bùn ướt bóng, khô thì nhám; quỳ/ngồi thì gối dính bùn.
 * Chỉ đổi cách bề mặt nhận sáng; không đổi hình, texture hay rig (asset mua dùng nguyên trạng, DV-054). Material dùng chung
 * (đồ procedural) chỉ được áp một lần (đánh dấu userData). Material cổ điển (GLTFLoader) đổi sang bản node cùng thuộc tính.
 */
import { Mesh, type Material, type MeshStandardMaterial, type MeshStandardNodeMaterial, type Node, type Object3D } from 'three/webgpu';
import { float, vec3, vec4, mix, pow, max, dot, abs, normalize, smoothstep, mx_noise_float, positionWorld, positionGeometry, modelPosition, cameraPosition, normalWorld, materialColor, materialEmissive, materialRoughness, materialAO } from 'three/tsl';
import { canopyMap } from '../vegetation/canopy';
import { SUN, WEATHER } from './sceneLight';
import { canopySunLight } from './volumetric';
import { toStandardNodeMaterial } from './characters';

const converted = new WeakMap<Material, MeshStandardNodeMaterial>();

export interface EnvShadeOptions {
  /** độ mạnh viền nắng ngược sáng */
  rim?: number;
  /** độ cao mặt tán trên chỗ đứng (m) */
  canopyHeight?: number;
  /** DV-082 bùn bám chân: hệ số đổi đơn vị lưới gốc → mét (null = không bùn: đồ rời như mũ, túi, súng) */
  mudGeomScale?: number | null;
  /** độ bùn 0..1 */
  mud?: number;
}

/** màu bùn đất đỏ laterit ướt (linear) */
export const MUD_COLOR: [number, number, number] = [0.13, 0.065, 0.035];

function isStandard(m: Material): boolean {
  return (m as unknown as { isMeshStandardMaterial?: boolean }).isMeshStandardMaterial === true;
}

/** gắn node môi trường vào một material node chuẩn (idempotent) */
export function shadeMaterial(m: MeshStandardNodeMaterial, o: EnvShadeOptions = {}): MeshStandardNodeMaterial {
  const ud = m.userData as { envShade?: boolean };
  if (ud.envShade) return m;
  ud.envShade = true;
  // DV-091: one node set per (colour graph, ao map, mud scale, options) shared by every material → one shader program for
  // N soldiers of a look instead of one per soldier (each new program compiles mid-fight = a frame stall). The nodes only read
  // the material through materialColor/Roughness/Emissive/AO, so per-instance colour/emissive (hit flash) stay per material.
  const key = `${m.colorNode ? nodeKey(m.colorNode) : 'mat'}|${m.aoMap ? 1 : 0}|${o.mudGeomScale ? o.mudGeomScale.toFixed(4) : '-'}|${o.rim ?? '-'}|${o.canopyHeight ?? '-'}|${o.mud ?? '-'}`;
  let set = shadeCache.get(key);
  if (!set) {
    set = buildShade(m, o);
    shadeCache.set(key, set);
  }
  m.aoNode = set.ao;
  m.colorNode = set.color;
  m.roughnessNode = set.rough;
  m.emissiveNode = set.emissive;
  m.needsUpdate = true;
  return m;
}

interface ShadeSet {
  ao: Node<'float'>;
  color: Node<'vec4'>;
  rough: Node<'float'>;
  emissive: Node<'vec3'>;
}
const shadeCache = new Map<string, ShadeSet>();
const nodeIds = new WeakMap<object, number>();
let nextNodeId = 1;
function nodeKey(n: object): number {
  let id = nodeIds.get(n);
  if (id === undefined) {
    id = nextNodeId++;
    nodeIds.set(n, id);
  }
  return id;
}
/** number of distinct shared env-shade node sets (tests) */
export function envShadeSetCount(): number {
  return shadeCache.size;
}

function buildShade(m: MeshStandardNodeMaterial, o: EnvShadeOptions): ShadeSet {
  const c = canopyMap.sample();
  const on = WEATHER.forest as unknown as Node<'float'>;
  const canopyAO = mix(float(1), float(0.45), c.mul(on));
  const wet = WEATHER.wet as unknown as Node<'float'>;
  const base = m.colorNode ? vec4(m.colorNode as unknown as Node<'vec4'>) : vec4(materialColor as unknown as Node<'vec4'>); // màu × map (rgba khi có map)
  const rgb0 = base.rgb.mul(mix(float(1), float(0.85), wet));
  const rough0 = materialRoughness.mul(mix(float(1), float(0.62), wet));
  let rgb: Node<'vec3'> = rgb0 as unknown as Node<'vec3'>;
  let rough: Node<'float'> = rough0 as unknown as Node<'float'>;
  if (o.mudGeomScale) {
    // cao trên gót (m): gốc mô hình nhân vật đặt ở gót chân
    const hAbove = positionWorld.y.sub(modelPosition.y);
    const g = positionGeometry.mul(o.mudGeomScale);
    const n = mx_noise_float(g.mul(3.5)).mul(0.65).add(mx_noise_float(g.mul(17.0).add(vec3(4.1, 2.3, 7.7))).mul(0.35));
    const line = float(0.24).add(n.mul(0.16));
    const band = smoothstep(line.sub(0.06), line, hAbove).oneMinus();
    // dày, sẫm sát đế; lên cao mỏng dần (lộ màu ủng/vải)
    const thick = mix(float(0.5), float(1), smoothstep(float(0.02), float(0.22), hAbove).oneMinus());
    // vệt bắn lấm tấm: dùng lại nhiễu, ngưỡng cao
    const splat = smoothstep(float(0.62), float(0.78), n.mul(0.5).add(0.5)).mul(smoothstep(line, line.add(0.5), hAbove).oneMinus());
    const w = band.mul(thick).max(splat.mul(0.75)).mul(float(o.mud ?? 0.9)).mul(on);
    // màu bùn loang: sẫm ướt ↔ đỏ khô theo nhiễu; giữ chút vân vải dưới lớp bùn mỏng
    const tint = n.mul(0.5).add(0.5);
    const mudWet = vec3(0.06, 0.03, 0.017);
    const mudDry = vec3(MUD_COLOR[0] * 1.5, MUD_COLOR[1] * 1.45, MUD_COLOR[2] * 1.4);
    const mudC = mix(mudDry, mudWet, tint.mul(0.6).add(wet.mul(0.4))).add(rgb0.mul(0.12));
    rgb = mix(rgb0, mudC, w) as unknown as Node<'vec3'>;
    rough = mix(rough0, mix(float(0.88), float(0.42), wet), w) as unknown as Node<'float'>;
  }
  // viền nắng ngược sáng
  const V = normalize(cameraPosition.sub(positionWorld));
  const fres = pow(float(1).sub(abs(dot(normalWorld, V))), float(3));
  const back = pow(max(dot(V.negate(), SUN.dir as unknown as Node<'vec3'>), float(0)), float(2));
  const lit = canopySunLight(positionWorld, SUN.dir as unknown as Node<'vec3'>, positionWorld.y.add(o.canopyHeight ?? 16));
  const rim = (SUN.color as unknown as Node<'vec3'>).mul(fres.mul(back).mul(lit).mul(on).mul(o.rim ?? 0.45));
  return {
    ao: (m.aoMap ? materialAO.mul(canopyAO) : canopyAO) as unknown as Node<'float'>,
    color: vec4(rgb, base.a) as unknown as Node<'vec4'>,
    rough,
    emissive: materialEmissive.add(rim) as unknown as Node<'vec3'>,
  };
}

/** áp cho cả cây đối tượng (nhân vật + mũ + túi + súng); trả số material đã áp */
export function applyEnvShading(root: Object3D, o: EnvShadeOptions = {}): number {
  // không ở cảnh rừng (arena, level không tán): không thêm gì — tránh shader nặng vô ích (đặt WEATHER.forest trước khi tạo người)
  if ((WEATHER.forest.value as number) < 0.5) return 0;
  let n = 0;
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const out = list.map((mat) => {
      if (!isStandard(mat)) return mat;
      let nm: MeshStandardNodeMaterial;
      if ((mat as unknown as { isNodeMaterial?: boolean }).isNodeMaterial) nm = mat as unknown as MeshStandardNodeMaterial;
      else {
        nm = converted.get(mat) ?? toStandardNodeMaterial(mat as MeshStandardMaterial);
        converted.set(mat, nm);
      }
      // bùn chỉ cho thân có xương (ủng, quần); đồ rời gắn bone (mũ, túi, súng) thì không
      const skinned = (mesh as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh === true;
      let mudGeomScale: number | null = null;
      if (skinned) {
        const g = mesh.geometry;
        if (!g.boundingBox) g.computeBoundingBox();
        const bb = g.boundingBox!;
        const ext = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z);
        mudGeomScale = ext > 1e-6 ? 1.8 / ext : null;
      }
      shadeMaterial(nm, { ...o, mudGeomScale });
      n++;
      return nm;
    });
    mesh.material = Array.isArray(mesh.material) ? out : out[0]!;
  });
  return n;
}
