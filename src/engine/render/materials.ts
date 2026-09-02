/**
 * TSL materials (PRD §3: TSL dùng chung WGSL/GLSL; không ShaderMaterial/onBeforeCompile).
 */
import { MeshStandardNodeMaterial, Color } from 'three/webgpu';
import { uniform, positionWorld, mix, float, mx_noise_float, smoothstep, vec3, saturate, color } from 'three/tsl';

export interface WetGroundMaterial {
  material: MeshStandardNodeMaterial;
  /** 0 = khô, 1 = ướt đẫm */
  wetness: { value: number };
}

/** Mặt bê tông cảng ướt: roughness giảm theo wetness + vũng nước theo noise thế giới. */
export function createWetGround(): WetGroundMaterial {
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

export function createPropMaterial(hex: number, roughness = 0.75): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ color: hex, roughness, metalness: 0.15 });
  return m;
}

export function createActorMaterial(hex: number): MeshStandardNodeMaterial {
  return new MeshStandardNodeMaterial({ color: hex, roughness: 0.6, metalness: 0.05 });
}
