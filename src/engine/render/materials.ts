/**
 * TSL materials (PRD §3: TSL dùng chung WGSL/GLSL; không ShaderMaterial/onBeforeCompile).
 * TIP-011: PBR từ texture CC0 (diff/nor_gl/arm) + lớp procedural: vũng nước, gợn mưa, rỉ sét, biến thiên macro.
 */
import { MeshStandardNodeMaterial, MeshBasicNodeMaterial, Color, AdditiveBlending, Vector3 } from 'three/webgpu';
import {
  uniform, positionWorld, mix, float, mx_noise_float, smoothstep, vec2, vec3, vec4, saturate, color, texture, uv, normalMap, time, fract, sin, length, normalize,
  positionLocal, positionView, normalView, uniformArray,
} from 'three/tsl';
import type { PbrTextureSet } from './assets';
import type { Node } from 'three/webgpu';

export interface WetGroundMaterial {
  material: MeshStandardNodeMaterial;
  /** 0 = khô, 1 = ướt đẫm */
  wetness: { value: number };
}

/**
 * Sàn bê tông/asphalt cảng ướt: texture 1K lặp 4 m, biến thiên macro (bẩn/dầu), vũng nước theo noise thế giới
 * (roughness → gương, normal → phẳng + gợn mưa động), AO từ arm.
 */
export function createWetGround(tex: PbrTextureSet, sizeMeters: number): WetGroundMaterial {
  const wetness = uniform(0.85);
  const mat = new MeshStandardNodeMaterial();
  const tile = 4.0;
  const tuv = uv().mul(sizeMeters / tile);
  const diff = texture(tex.map, tuv);
  const arm = texture(tex.armMap, tuv);
  const nrm = texture(tex.normalMap, tuv).rgb;
  // macro: vết dầu/bẩn tần số thấp + vũng nước
  const macro = mx_noise_float(positionWorld.xz.mul(0.08)).mul(0.5).add(0.5);
  const puddleN = mx_noise_float(positionWorld.xz.mul(0.35).add(vec2(13.1, 7.7)));
  const puddle = smoothstep(0.12, 0.5, puddleN).mul(wetness);
  const dirt = mix(float(0.45), float(0.8), macro);
  // gợn mưa trong vũng: 2 lớp noise trôi + vòng tròn nhỏ
  const rip1 = mx_noise_float(positionWorld.xz.mul(6.0).add(time.mul(0.9)));
  const rip2 = mx_noise_float(positionWorld.xz.mul(9.0).sub(time.mul(1.3)));
  const ripple = vec3(rip1.mul(0.12), rip2.mul(0.12), float(1.0));
  const tangentN = mix(nrm.mul(2.0).sub(1.0), ripple, puddle);
  mat.normalNode = normalMap(tangentN.mul(0.5).add(0.5), vec2(1.0));
  const wetDarken = mix(float(1.0), float(0.5), wetness); // mặt ướt sẫm màu
  const base = diff.rgb.mul(dirt).mul(wetDarken);
  mat.colorNode = vec4(mix(base, base.mul(0.35), puddle), 1.0);
  const roughDry = arm.g.mul(0.95).add(0.05);
  mat.roughnessNode = saturate(mix(roughDry.sub(wetness.mul(0.35)), float(0.04), puddle));
  mat.metalnessNode = float(0.0);
  mat.aoNode = arm.r;
  return { material: mat, wetness };
}

/** Fallback không texture (unit test / lite): sàn bê tông procedural của G0. */
export function createWetGroundProcedural(): WetGroundMaterial {
  const wetness = uniform(0.85);
  const mat = new MeshStandardNodeMaterial();
  const n = mx_noise_float(positionWorld.xz.mul(0.35));
  const puddle = smoothstep(0.15, 0.55, n).mul(wetness);
  const grain = mx_noise_float(positionWorld.xz.mul(6.0)).mul(0.06);
  const base = color(new Color(0x2a2d31));
  mat.colorNode = mix(base, color(new Color(0x14171a)), puddle).add(vec3(grain));
  mat.roughnessNode = saturate(mix(float(0.92), float(0.12), puddle).sub(wetness.mul(0.25)));
  mat.metalnessNode = float(0.0);
  return { material: mat, wetness };
}

export interface TexturedOptions {
  tileMeters?: number;
  tint?: number;
  roughnessScale?: number;
  metalness?: number;
  /** trộn rỉ sét theo noise thế giới (0..1 = mức) */
  rust?: { tex: PbrTextureSet; amount: number };
  normalScale?: number;
  emissive?: { color: number; intensity: number };
}

/** Material PBR texture chuẩn; UV của geometry đã theo mét (xem geometry.ts) → tileMeters là kích thước 1 tile. */
export function createTexturedMaterial(tex: PbrTextureSet, opts: TexturedOptions = {}): MeshStandardNodeMaterial {
  const tile = opts.tileMeters ?? 2.0;
  const tuv = uv().mul(1.0 / tile);
  const mat = new MeshStandardNodeMaterial();
  const diff = texture(tex.map, tuv);
  const arm = texture(tex.armMap, tuv);
  let albedo = diff.rgb;
  if (opts.tint !== undefined) albedo = albedo.mul(color(new Color(opts.tint)));
  let rough = arm.g.mul(opts.roughnessScale ?? 1.0);
  let tangentN = texture(tex.normalMap, tuv).rgb;
  let metal = float(opts.metalness ?? 0.0).add(arm.b.mul(0.5));
  if (opts.rust) {
    const ruv = uv().mul(1.0 / (tile * 1.7));
    const rd = texture(opts.rust.tex.map, ruv);
    const rn = texture(opts.rust.tex.normalMap, ruv).rgb;
    const ra = texture(opts.rust.tex.armMap, ruv);
    // mask: noise thế giới + đậm ở đáy (positionLocal.y thấp) + theo rìa (arm.r AO)
    const n = mx_noise_float(positionWorld.mul(vec3(2.2, 3.0, 2.2))).mul(0.5).add(0.5);
    const n2 = mx_noise_float(positionWorld.mul(vec3(0.5, 0.8, 0.5)).add(vec3(3.1, 0, 7.7))).mul(0.5).add(0.5);
    const low = smoothstep(-0.2, 1.2, positionLocal.y).oneMinus().mul(0.25); // đậm ở đáy
    const mask = saturate(smoothstep(0.66, 0.86, n.mul(0.6).add(n2.mul(0.4)).add(low).add(arm.r.oneMinus().mul(0.25))).mul(opts.rust.amount));
    albedo = mix(albedo, rd.rgb, mask);
    rough = mix(rough, ra.g, mask);
    tangentN = mix(tangentN, rn, mask);
    metal = mix(metal, float(0.05), mask);
  }
  mat.colorNode = vec4(albedo, 1.0);
  mat.roughnessNode = saturate(rough);
  mat.metalnessNode = saturate(metal);
  mat.normalNode = normalMap(tangentN, vec2(opts.normalScale ?? 1.0));
  mat.aoNode = arm.r;
  if (opts.emissive) mat.emissiveNode = color(new Color(opts.emissive.color)).mul(opts.emissive.intensity);
  return mat;
}

export function createPropMaterial(hex: number, roughness = 0.75): MeshStandardNodeMaterial {
  return new MeshStandardNodeMaterial({ color: hex, roughness, metalness: 0.15 });
}

export function createActorMaterial(hex: number): MeshStandardNodeMaterial {
  return new MeshStandardNodeMaterial({ color: hex, roughness: 0.6, metalness: 0.05 });
}

/** Đèn: mặt phát sáng HDR (bloom) — intensity > 1 để post stack "nở". */
export function createEmissiveMaterial(hex: number, intensity: number): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.0 });
  m.emissiveNode = color(new Color(hex)).mul(intensity);
  return m;
}

/**
 * Nón sáng volumetric giả cho đèn pha (ConeGeometry, additive): mờ dần theo trục + rìa + noise "bụi mưa".
 * Geometry: ConeGeometry đỉnh ở gốc, mở về −y (lighting.ts dịch/quay).
 */
export function createLightConeMaterial(hex: number, strength = 0.12): MeshBasicNodeMaterial {
  const m = new MeshBasicNodeMaterial({ color: new Color(hex), transparent: true, depthWrite: false, blending: AdditiveBlending });
  const along = uv().y.oneMinus(); // ConeGeometry: v = 1 ở đỉnh → along 0 đỉnh → 1 đáy
  const edge = smoothstep(0.0, 0.6, normalView.z.abs()); // rìa nón (pháp tuyến vuông góc hướng nhìn) mỏng → mờ
  const dust = mx_noise_float(positionWorld.mul(vec3(1.5, 3.0, 1.5)).add(vec3(0, time.mul(-1.2), 0))).mul(0.5).add(0.5);
  const fade = smoothstep(0.05, 1.0, along).oneMinus().mul(smoothstep(0.0, 0.12, along)); // mờ dần về đáy nón
  // gần camera → mờ (tránh mảng sáng phẳng khi đi xuyên nón)
  const near = smoothstep(0.5, 4.0, positionView.z.negate());
  m.opacityNode = fade.mul(edge.mul(0.6).add(0.4)).mul(dust.mul(0.6).add(0.4)).mul(near).mul(strength);
  return m;
}

/** Vị trí đèn (world) cho mưa/spark sáng khi đi qua nón đèn — tối đa 12 (slot trống: y = -1000). */
export const LAMP_SLOTS = 12;
export interface LampArray {
  node: ReturnType<typeof uniformArray>;
  positions: Vector3[];
}
export function createLampArrayNode(): LampArray {
  const positions = Array.from({ length: LAMP_SLOTS }, () => new Vector3(0, -1000, 0));
  const node = uniformArray(positions, 'vec3');
  return { node, positions };
}

/** Hệ số sáng (0..1) tại điểm world do các đèn — unroll 12 slot, dùng cho mưa/splash. */
export function lampGlowAt(pWorld: Node<'vec3'>, lamps: LampArray): Node<'float'> {
  let glow: Node<'float'> = float(0.0);
  for (let i = 0; i < LAMP_SLOTS; i++) {
    const lp = vec3(lamps.node.element(i) as unknown as Node<'vec3'>);
    const d = length(pWorld.sub(lp));
    const below = smoothstep(0.0, 2.0, lp.y.sub(pWorld.y)); // dưới đèn
    glow = glow.add(smoothstep(2.0, 14.0, d).oneMinus().mul(below));
  }
  return saturate(glow);
}

// re-export tiện cho rain.ts
export { fract, sin, normalize };
