/**
 * Vật liệu thực vật TSL (TIP-D05, PRD VEG-002/003): instancing bằng attribute riêng (`iPosScale` xyz+scale, `iRotTint`
 * cos/sin yaw + tint + pha gió) trên InstancedBufferGeometry; gió = uốn theo chiều cao (attribute `_wind`.x²) + rung lá
 * (`_wind`.y) theo thời gian và pha mỗi cây; lá alpha MASK hai mặt, tint sáng/tối ngẫu nhiên mỗi cây.
 * Binding (DV-023): map (+ CSM 3 + PMREM + DFG) = 6 texture — an toàn.
 */
import { MeshStandardNodeMaterial, DoubleSide, FrontSide, Color, type Texture, type Node } from 'three/webgpu';
import { attribute, positionGeometry, normalLocal, texture, uv, vec2, vec3, vec4, float, mix, sin, uniform, time, transformNormalToView, negateOnBackSide, normalize, smoothstep, positionWorld, cameraPosition, dot, saturate, pow } from 'three/tsl';
import { SUN } from '../render/sceneLight';
import { canopyMap } from './canopy';

export interface WindUniforms {
  /** hướng gió xz (đơn vị) */
  dir: { value: { x: number; y: number } };
  /** cường độ 0..1 (0,35 gió nhẹ rừng; tăng khi trực thăng/bom — VEG-002) */
  strength: { value: number };
  /** đè cỏ (VEG-006): tâm xz + bán kính (w) của tác nhân (người chơi); w = 0 → tắt. D12: ≤ 8 tác nhân */
  press: { value: { x: number; y: number; z: number; w: number } };
  /** DV-079 độ ướt lá 0..1 (mưa phùn/sương sớm): lá bóng hơn (roughness thấp) */
  wet: { value: number };
}

export interface VegMaterialOptions {
  map: Texture;
  normalMap?: Texture | null;
  leaf: boolean;
  alphaTest?: number;
  wind: WindUniforms;
  /** biên độ uốn thân ở đỉnh (m) khi strength = 1 */
  bendM?: number;
  /** biên độ rung lá (m) khi strength = 1 */
  flutterM?: number;
  /** tint tối/sáng mỗi cây: albedo × mix(1 − v, 1 + v, tint) */
  tintVar?: number;
  roughness?: number;
  /** hệ số đè (0 = không đè: cây thân; 1 = cỏ) */
  pressM?: number;
  /**
   * DV-079 che sáng theo chiều cao: ánh trời gián tiếp ở gốc còn `aoBase` (cỏ/bụi sát đất, thân cây trong tán tối hơn ngọn)
   * — 1 = tắt. Mặc định 0,5.
   */
  aoBase?: number;
  /** DV-079 nắng xuyên lá (lá mỏng sáng lên khi nhìn ngược nắng) 0..1 — 0 = tắt */
  translucency?: number;
  /** DV-079 cây tầng thấp: đọc bản đồ độ che tán (tối dưới tán kín, bóng tán ngoài tầm CSM, bớt nắng xuyên) */
  canopyShade?: boolean;
  /**
   * DV-079 pháp tuyến tán tròn: lá dạng thẻ lấy pháp tuyến pha với hướng từ tâm tán (độ cao `crownY` m của mô hình, nhân scale)
   * → tán cây sáng/tối theo khối như một vòm lá thay vì từng thẻ phẳng. `crownBlend` 0..1 (0 = tắt).
   */
  crownY?: number;
  crownBlend?: number;
  /** DV-079 rêu chân thân: tỉ lệ chiều cao dải rêu (0 = tắt) */
  mossBand?: number;
  /** DV-080 lớp phủ nằm đất: cắt (shear) theo độ dốc terrain của instance (attribute `iSlope`) — cụm ôm sườn, pháp tuyến theo sườn */
  alignSlope?: boolean;
}

export function createWindUniforms(): WindUniforms {
  return { dir: uniform(vec2(0.8, 0.6)) as unknown as WindUniforms['dir'], strength: uniform(0.35) as unknown as WindUniforms['strength'], press: uniform(vec4(0, 0, 0, 0)) as unknown as WindUniforms['press'], wet: uniform(0) as unknown as WindUniforms['wet'] };
}

/** Vị trí instance (local mesh = world vì mesh ở gốc) sau xoay yaw + scale + gió; dùng chung cho mesh và bóng. */
export function instancedWindPosition(wind: WindUniforms, bendM: number, flutterM: number, pressM = 0, alignSlope = false): Node<'vec3'> {
  const ps = attribute('iPosScale', 'vec4') as unknown as Node<'vec4'>;
  const rt = attribute('iRotTint', 'vec4') as unknown as Node<'vec4'>;
  const w = attribute('_wind', 'vec2') as unknown as Node<'vec2'>;
  const c = rt.x;
  const s = rt.y;
  const phase = rt.w;
  const p = positionGeometry.mul(ps.w);
  const rx = c.mul(p.x).add(s.mul(p.z));
  const rz = s.negate().mul(p.x).add(c.mul(p.z));
  const t = time;
  const dir = wind.dir as unknown as Node<'vec2'>;
  const st = wind.strength as unknown as Node<'float'>;
  // uốn thân: h² × (sóng chậm + gust), rung lá: theo độ mềm và tần số cao, lệch pha theo chiều cao
  const h2 = w.x.mul(w.x);
  const sway = sin(t.mul(1.1).add(phase)).mul(0.7).add(sin(t.mul(2.3).add(phase.mul(1.7))).mul(0.3)).mul(0.5).add(0.5);
  const bend = h2.mul(st).mul(float(bendM)).mul(sway);
  const flutter = w.y.mul(st).mul(float(flutterM)).mul(sin(t.mul(5.7).add(phase.mul(3.0)).add(p.y.mul(1.3))));
  const ox = dir.x.mul(bend).add(dir.x.mul(flutter));
  const oz = dir.y.mul(bend).add(dir.y.mul(flutter));
  const oy = flutter.mul(0.3).sub(bend.mul(0.15)); // thân uốn hạ đỉnh một chút (giữ chiều dài xấp xỉ)
  let out = vec3(ps.x.add(rx).add(ox), ps.y.add(p.y).add(oy), ps.z.add(rz).add(oz));
  if (alignSlope) {
    const sl = attribute('iSlope', 'vec2') as unknown as Node<'vec2'>;
    out = vec3(out.x, out.y.add(sl.x.mul(rx)).add(sl.y.mul(rz)), out.z);
  }
  if (pressM > 0) {
    // đè cỏ (VEG-006): trong bán kính press.w quanh tâm xz, đỉnh (theo h) ngả ra xa tâm và hạ xuống — không đè gốc
    const pr = wind.press as unknown as Node<'vec4'>;
    const dxz = vec2(ps.x.sub(pr.x), ps.z.sub(pr.z));
    const len = dxz.length().max(0.001);
    const k = smoothstep(pr.w, pr.w.mul(0.15), len).mul(w.x).mul(float(pressM));
    const dirP = dxz.div(len);
    out = vec3(out.x.add(dirP.x.mul(k).mul(0.45)), out.y.sub(k.mul(0.5).mul(p.y)), out.z.add(dirP.y.mul(k).mul(0.45)));
  }
  return out;
}

export function createVegetationMaterial(o: VegMaterialOptions): MeshStandardNodeMaterial {
  const mat = new MeshStandardNodeMaterial();
  const rt = attribute('iRotTint', 'vec4') as unknown as Node<'vec4'>;
  mat.positionNode = instancedWindPosition(o.wind, o.bendM ?? 0.6, o.flutterM ?? 0.06, o.pressM ?? 0, o.alignSlope ?? false);
  // normal: xoay yaw theo instance; lá hai mặt → lật theo mặt
  const c = rt.x;
  const s = rt.y;
  const n = normalLocal;
  let nr = normalize(vec3(c.mul(n.x).add(s.mul(n.z)), n.y, s.negate().mul(n.x).add(c.mul(n.z))));
  if (o.alignSlope) {
    // pháp tuyến qua phép cắt y' = y + gx·x + gz·z: (nx − gx·ny, ny, nz − gz·ny)
    const sl = attribute('iSlope', 'vec2') as unknown as Node<'vec2'>;
    nr = normalize(vec3(nr.x.sub(sl.x.mul(nr.y)), nr.y, nr.z.sub(sl.y.mul(nr.y))));
  }
  let nv = transformNormalToView(nr) as Node<'vec3'>;
  if (o.leaf) nv = negateOnBackSide(nv) as Node<'vec3'>;
  if (o.leaf && (o.crownBlend ?? 0) > 0 && o.crownY) {
    const ps = attribute('iPosScale', 'vec4') as unknown as Node<'vec4'>;
    const crown = vec3(ps.x, ps.y.add(ps.w.mul(o.crownY)), ps.z);
    const radial = transformNormalToView(normalize(positionWorld.sub(crown))) as Node<'vec3'>;
    nv = normalize(mix(nv, radial, float(o.crownBlend))) as Node<'vec3'>;
  }
  mat.normalNode = nv;
  const tex = texture(o.map, uv());
  const tv = o.tintVar ?? 0.18;
  const tint = mix(float(1 - tv), float(1 + tv), rt.z);
  // lá: hơi ngả vàng ở cây sáng, xanh sẫm ở cây tối (biến thiên tự nhiên)
  const tintC = o.leaf ? vec3(tint, tint.mul(mix(float(0.96), float(1.02), rt.z)), tint.mul(mix(float(1.02), float(0.92), rt.z))) : vec3(tint, tint, tint);
  // DV-079 che sáng theo chiều cao (_wind.x = cao độ chuẩn hoá 0..1 của mô hình)
  const hgt = (attribute('_wind', 'vec2') as unknown as Node<'vec2'>).x;
  const aoH = mix(float(o.aoBase ?? 0.5), float(1), smoothstep(0.0, 0.7, hgt));
  let ao: Node<'float'> = aoH as unknown as Node<'float'>;
  let albedo = tex.rgb.mul(tintC).mul(mix(float(0.84), float(1), aoH));
  let shade: Node<'float'> = float(1) as unknown as Node<'float'>;
  if (o.canopyShade) {
    const c = canopyMap.sample();
    ao = ao.mul(mix(float(1), float(0.42), c)) as unknown as Node<'float'>;
    // ngoài tầm bóng CSM: tán che thay bóng nắng
    const dist = positionWorld.sub(cameraPosition).length();
    const far = smoothstep(SUN.shadowFar.mul(0.7), SUN.shadowFar, dist);
    albedo = albedo.mul(mix(float(1), mix(float(1), float(0.5), c), far));
    shade = float(1).sub(c.mul(0.75)) as unknown as Node<'float'>;
  }
  if (!o.leaf && (o.mossBand ?? 0) > 0) {
    // DV-079 rêu chân thân cây rừng ẩm: dải rêu xanh xám ở gốc, loang theo noise thô theo hướng thân
    const band = float(1).sub(smoothstep(0.0, float(o.mossBand ?? 0.2), hgt));
    albedo = mix(albedo, vec3(0.16, 0.2, 0.09), band.mul(0.55));
  }
  mat.aoNode = ao;
  mat.colorNode = vec4(albedo, tex.a);
  if (o.leaf) {
    mat.alphaTest = o.alphaTest ?? 0.5;
    mat.side = DoubleSide;
    // trong mờ (VEG-003): nền nhẹ + nắng xuyên khi nhìn về phía mặt trời (DV-079), ngọn sáng hơn gốc, dưới tán kín yếu đi
    const tr = o.translucency ?? 0;
    if (tr > 0) {
      const v = normalize(positionWorld.sub(cameraPosition));
      const back = pow(saturate(dot(v, SUN.dir)), float(4));
      const glow = back.mul(float(tr)).mul(mix(float(0.35), float(1), hgt)).mul(shade);
      mat.emissiveNode = albedo.mul(0.05).add(albedo.mul(SUN.color as unknown as Node<'vec3'>).mul(glow));
    } else mat.emissiveNode = tex.rgb.mul(0.06);
  } else mat.side = FrontSide;
  const wet = o.wind.wet as unknown as Node<'float'>;
  mat.roughnessNode = o.leaf ? mix(float(o.roughness ?? 0.75), float(0.42), wet) : mix(float(o.roughness ?? 0.9), float(0.7), wet);
  mat.metalnessNode = float(0);
  // normal map: bỏ ở D05 (normalNode tuỳ biến thay materialNormal; lá dạng thẻ không cần; thân → D12 nếu thấy phẳng)
  mat.color = new Color(0xffffff);
  mat.shadowSide = DoubleSide;
  return mat;
}
