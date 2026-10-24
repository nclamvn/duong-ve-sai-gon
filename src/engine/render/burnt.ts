/**
 * DV-092 xác xe cháy: vật liệu "đã cháy" phủ lên mô hình xe nguyên trạng (không sửa hình, chỉ đổi cách bề mặt nhận sáng).
 *  - sơn cháy thành tro xám, loang gỉ cam nâu theo nhiễu bám vị trí, muội đen dày ở thấp và theo mảng;
 *  - than hồng âm ỉ: chỗ thấp, khe sâu (theo nhiễu) phát sáng cam vượt trắng (HDR) và chập chờn; tắt dần theo `dvHeat`;
 *  - độ nhám cao, kim loại giảm ở chỗ gỉ.
 * Một bộ node dùng chung cho mọi xác xe (đọc màu/texture gốc qua materialColor, cao độ mặt đất và độ nóng qua
 * materialReference) → một chương trình shader cho cả đoàn xe, không biên dịch thêm khi xác xe vào tầm nhìn (DV-091).
 */
import { MeshStandardNodeMaterial, type Material, type MeshStandardMaterial, type Node } from 'three/webgpu';
import { float, vec3, mix, smoothstep, sin, dot, clamp, mx_noise_float, positionWorld, materialColor, materialReference, time } from 'three/tsl';
import { toStandardNodeMaterial } from './characters';

interface BurntNodes {
  color: Node<'vec3'>;
  rough: Node<'float'>;
  metal: Node<'float'>;
  emissive: Node<'vec3'>;
}

let shared: BurntNodes | null = null;

function burntNodes(): BurntNodes {
  if (shared) return shared;
  const p = positionWorld;
  const ground = materialReference('dvGround', 'float') as unknown as Node<'float'>;
  const heat = materialReference('dvHeat', 'float') as unknown as Node<'float'>;
  const h = p.y.sub(ground);
  const n1 = mx_noise_float(p.mul(1.7));
  const n2 = mx_noise_float(p.mul(6.3).add(vec3(3.1, 1.7, 5.2)));
  const f = n1.mul(0.65).add(n2.mul(0.35));
  const base = (materialColor as unknown as Node<'vec4'>).rgb;
  const lum = dot(base, vec3(0.2126, 0.7152, 0.0722));
  // sơn cháy: tro xám giữ chút vân gốc (còn nhận ra hình xe, chữ, chi tiết)
  const ash = vec3(0.13, 0.125, 0.118).mul(float(0.55).add(lum.mul(1.6)));
  const c0 = mix(ash, base.mul(0.3), 0.22);
  const rust = vec3(0.14, 0.06, 0.03).mul(float(0.7).add(n2.mul(0.45)));
  const rustMask = smoothstep(-0.02, 0.5, f).mul(0.6);
  // muội: theo mảng + dày ở thấp (lửa liếm từ gầm lên)
  const low = smoothstep(0.2, 1.4, h).oneMinus();
  const sootMask = clamp(smoothstep(-0.05, 0.45, f.negate()).add(low.mul(0.6)), 0, 1);
  const soot = vec3(0.018, 0.016, 0.014);
  const color = mix(mix(c0, rust, rustMask), soot, sootMask) as unknown as Node<'vec3'>;
  const rough = mix(float(0.72), float(0.97), rustMask.max(sootMask)) as unknown as Node<'float'>;
  const metal = mix(float(0.35), float(0.04), rustMask.max(sootMask)) as unknown as Node<'float'>;
  // than hồng: khe thấp, chập chờn hai tần số lệch pha theo chỗ; HDR × 3 cho bloom
  const ember = smoothstep(0.62, 0.8, n2.mul(0.6).add(n1.mul(0.4))).mul(smoothstep(0.15, 1.0, h).oneMinus());
  const flick = sin(time.mul(7.1).add(n1.mul(20))).mul(0.22).add(sin(time.mul(2.3).add(n2.mul(9))).mul(0.22)).add(0.72);
  const emissive = vec3(1.0, 0.3, 0.05).mul(ember).mul(flick).mul(heat).mul(3) as unknown as Node<'vec3'>;
  shared = { color, rough, metal, emissive };
  return shared;
}

/** Bản "đã cháy" của một vật liệu xe. `ground` = cao độ mặt đất dưới xác (m), `heat` 0..1 than hồng còn âm ỉ. */
export function burntMaterial(src: Material, ground: number, heat: number): MeshStandardNodeMaterial {
  const m = toStandardNodeMaterial(src as MeshStandardMaterial);
  const n = burntNodes();
  const ud = m as unknown as { dvGround: number; dvHeat: number };
  ud.dvGround = ground;
  ud.dvHeat = heat;
  m.colorNode = n.color;
  m.roughnessNode = n.rough;
  m.metalnessNode = n.metal;
  m.emissiveNode = n.emissive;
  m.needsUpdate = true;
  return m;
}
