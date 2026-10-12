/**
 * Rằn ri hổ (tiger stripe) procedural cho lính thám báo VNCH 1971 (TIP-M1A, DV-043): thay vùng vải "xanh Tô Châu" của atlas
 * lính QGP bằng sọc hổ (đen / xanh ô-liu / nâu vàng) ngay trong shader — mặt nạ vải = sắc độ gần màu vải tham chiếu (da, thắt lưng,
 * giày giữ nguyên); giữ độ sáng dệt gốc. Không thêm texture (DV-023 binding ≤ 16). Bản asset retexture riêng (D11c) thay sau
 * khi cố vấn duyệt registry `uni.arvn.1971.tiger_stripe`.
 */
import type { Texture, Node } from 'three/webgpu';
import { Fn, texture, uv, vec2, vec3, float, mix, smoothstep, length, mx_noise_float, clamp, abs } from 'three/tsl';

/** màu vải lính QGP trong atlas (sRGB 94,110,78 → linear) — `scripts/retexture-1971.mjs` COLORS.CLOTH */
const CLOTH_LINEAR = [0.113, 0.156, 0.077] as const;

export function tigerStripeColorNode(map: Texture): Node<'vec3'> {
  return Fn(() => {
    const base = texture(map, uv());
    const rgb = base.rgb;
    const lum = rgb.dot(vec3(0.299, 0.587, 0.114)).add(0.01);
    const chroma = rgb.div(lum);
    const ref = vec3(CLOTH_LINEAR[0], CLOTH_LINEAR[1], CLOTH_LINEAR[2]);
    const refLum = float(CLOTH_LINEAR[0] * 0.299 + CLOTH_LINEAR[1] * 0.587 + CLOTH_LINEAR[2] * 0.114 + 0.01);
    const refChroma = ref.div(refLum);
    const d = length(chroma.sub(refChroma));
    const mask = float(1).sub(smoothstep(0.22, 0.42, d));
    // sọc hổ: vệt ngang dài mỏng có uốn + mảng lớn
    const u = uv();
    const warp = mx_noise_float(u.mul(vec2(16, 16)).add(3.0)).mul(0.07);
    const uw = u.add(vec2(warp, warp.mul(0.5)));
    const streak = mx_noise_float(uw.mul(vec2(6, 56)));
    const blotch = mx_noise_float(u.mul(vec2(3, 12)).add(11.0));
    const dark = smoothstep(0.3, 0.44, streak);
    const light = smoothstep(0.52, 0.66, blotch);
    const olive = vec3(0.115, 0.15, 0.07);
    const tan = vec3(0.33, 0.26, 0.13);
    const black = vec3(0.028, 0.032, 0.026);
    const tone = mix(mix(olive, tan, light), black, dark);
    const shade = clamp(lum.div(refLum), 0.45, 1.6);
    const camo = tone.mul(shade);
    return mix(rgb, camo, mask);
  })() as unknown as Node<'vec3'>;
}

/**
 * Rằn ri hoa rừng ERDL (US M1948 "leaf", 1968–75; lính Mỹ, Dù/BĐQ Sài Gòn — DV-046 "chuẩn rằn ri Mỹ"): 4 màu trên nền xanh
 * chanh (lime-dominant): mảng lớn xanh ô-liu đậm + nâu, "nhánh" đen mảnh. Dựng bằng 3 trường nhiễu có warp (mảng hữu cơ
 * 3–10 cm ở tỉ lệ atlas thân người ≈ 3,6 m/UV); `freq` = tần số nhiễu cơ sở (thân 26; mũ/túi có UV riêng dùng nhỏ hơn).
 * Trả về màu linear chưa nhân bóng vải.
 */
/** bảng 4 màu linear cho mẫu rằn ri lá (nền, mảng 1, mảng 2, nhánh) */
export type CamoPalette = readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]];
export const ERDL_PALETTE: CamoPalette = [
  [0.25, 0.3, 0.105],
  [0.052, 0.086, 0.032],
  [0.105, 0.06, 0.026],
  [0.013, 0.014, 0.011],
];
/** Phe B hư cấu (DV-061): cùng hình mảng lá nhưng nền đất cát, mảng nâu gỉ và ô-liu sẫm; không trùng mẫu quân đội có thật nào */
export const CAMO_B_PALETTE: CamoPalette = [
  [0.27, 0.215, 0.12],
  [0.115, 0.058, 0.03],
  [0.06, 0.07, 0.035],
  [0.016, 0.014, 0.012],
];

export function erdlPatternNode(u: Node<'vec2'>, freq = 18, pal: CamoPalette = ERDL_PALETTE): Node<'vec3'> {
  return Fn(() => {
    const f = float(freq);
    const wx = mx_noise_float(u.mul(f.mul(1.5)).add(7.0));
    const wz = mx_noise_float(u.mul(f.mul(1.5)).add(19.0));
    const uw = u.add(vec2(wx, wz).mul(0.55).div(f));
    // mảng lá kéo dài chéo (ERDL in theo trục ~30°): nén nhiễu theo một hướng
    const rot = vec2(uw.x.mul(0.87).sub(uw.y.mul(0.5)), uw.x.mul(0.5).add(uw.y.mul(0.87)));
    const nG = mx_noise_float(rot.mul(vec2(f, f.mul(0.62))));
    const nB = mx_noise_float(rot.mul(vec2(f.mul(0.9), f.mul(0.55))).add(41.0));
    const nK = mx_noise_float(uw.mul(f.mul(2.3)).add(5.0));
    const lime = vec3(pal[0][0], pal[0][1], pal[0][2]);
    const green = vec3(pal[1][0], pal[1][1], pal[1][2]);
    const brown = vec3(pal[2][0], pal[2][1], pal[2][2]);
    const black = vec3(pal[3][0], pal[3][1], pal[3][2]);
    const g = smoothstep(0.06, 0.13, nG);
    const b = smoothstep(0.16, 0.23, nB);
    // nhánh đen: dải mỏng quanh đường 0 của nhiễu tần số cao, chỉ nơi có mảng (không rải khắp nền)
    const vein = float(1).sub(smoothstep(0.03, 0.075, abs(nK))).mul(smoothstep(-0.12, 0.05, nG.add(nB.mul(0.5))));
    const blob = smoothstep(0.5, 0.62, nK);
    const k = clamp(vein.add(blob), 0, 1);
    return mix(mix(mix(lime, green, g), brown, b), black, k);
  })() as unknown as Node<'vec3'>;
}

/** Áp ERDL lên vùng vải của atlas lính (mặt nạ sắc độ như tiger stripe), giữ bóng dệt gốc. */
export function erdlColorNode(map: Texture, pal: CamoPalette = ERDL_PALETTE): Node<'vec3'> {
  return Fn(() => {
    const base = texture(map, uv());
    const rgb = base.rgb;
    const lum = rgb.dot(vec3(0.299, 0.587, 0.114)).add(0.01);
    const chroma = rgb.div(lum);
    const ref = vec3(CLOTH_LINEAR[0], CLOTH_LINEAR[1], CLOTH_LINEAR[2]);
    const refLum = float(CLOTH_LINEAR[0] * 0.299 + CLOTH_LINEAR[1] * 0.587 + CLOTH_LINEAR[2] * 0.114 + 0.01);
    const refChroma = ref.div(refLum);
    const d = length(chroma.sub(refChroma));
    const mask = float(1).sub(smoothstep(0.22, 0.42, d));
    const shade = clamp(lum.div(refLum), 0.45, 1.6);
    const camo = erdlPatternNode(uv(), 18, pal).mul(shade);
    return mix(rgb, camo, mask);
  })() as unknown as Node<'vec3'>;
}

/**
 * DV-065: nhuộm lại vải xám/trắng của asset mua (tay áo viewmodel AB3DX) sang màu quân phục, GIỮ nguyên phần có màu
 * (găng da nâu, da tay): mặt nạ theo độ bão hoà thấp, bóng nếp vải giữ theo tỉ lệ độ sáng so với nền vải gốc.
 * Chỉ đổi màu (DV-054: không sửa hình học, không đổi rig). `target` là màu linear của vải mới ở độ sáng chuẩn.
 */
export function recolorGreyFabricNode(map: Texture, target: readonly [number, number, number], clothLum = 0.42): Node<'vec3'> {
  return Fn(() => {
    const rgb = texture(map, uv()).rgb;
    const mx = rgb.r.max(rgb.g).max(rgb.b);
    const mn = rgb.r.min(rgb.g).min(rgb.b);
    const sat = mx.sub(mn).div(mx.add(0.001));
    // xám/trắng (bão hoà < ~0,15) và không quá tối (đường viền đen, lỗ) → vải cần nhuộm
    const mask = float(1).sub(smoothstep(0.14, 0.26, sat)).mul(smoothstep(0.03, 0.08, mx));
    const lum = rgb.dot(vec3(0.2126, 0.7152, 0.0722));
    const shade = clamp(lum.div(clothLum), 0.35, 1.5);
    const dyed = vec3(target[0], target[1], target[2]).mul(shade);
    return mix(rgb, dyed, mask);
  })() as unknown as Node<'vec3'>;
}

/**
 * DV-069: camo on a grey/grey-green fabric albedo (Panzergrenadier body): same fabric mask as `recolorGreyFabricNode`
 * (low saturation, not near-black), pattern shaded by the fabric's luminance relative to `clothLum` (linear).
 */
export function camoGreyFabricNode(map: Texture, pal: CamoPalette, clothLum = 0.125, gain = 1): Node<'vec3'> {
  return Fn(() => {
    const rgb = texture(map, uv()).rgb;
    const mx = rgb.r.max(rgb.g).max(rgb.b);
    const mn = rgb.r.min(rgb.g).min(rgb.b);
    const sat = mx.sub(mn).div(mx.add(0.001));
    const mask = float(1).sub(smoothstep(0.16, 0.3, sat)).mul(smoothstep(0.025, 0.06, mx));
    const lum = rgb.dot(vec3(0.2126, 0.7152, 0.0722));
    const shade = clamp(lum.div(clothLum), 0.4, 1.5);
    const camo = erdlPatternNode(uv(), 18, pal).mul(shade).mul(float(gain));
    return mix(rgb, camo, mask);
  })() as unknown as Node<'vec3'>;
}

/**
 * DV-070 per-actor variation: re-tone the skin of a body albedo (saturated warm pixels: r > g > b, saturation > ~0.35)
 * on top of an existing colour node. `tone` 0 = lighter, 1 = deeper tan; 0.35 ≈ the source skin.
 */
export function skinToneNode(inner: Node<'vec3'>, map: Texture, tone: number): Node<'vec3'> {
  return Fn(() => {
    const rgb = texture(map, uv()).rgb;
    const mx = rgb.r.max(rgb.g).max(rgb.b);
    const mn = rgb.r.min(rgb.g).min(rgb.b);
    const sat = mx.sub(mn).div(mx.add(0.001));
    const warm = smoothstep(0.0, 0.02, rgb.r.sub(rgb.g)).mul(smoothstep(0.0, 0.015, rgb.g.sub(rgb.b)));
    const mask = smoothstep(0.32, 0.45, sat).mul(warm).mul(smoothstep(0.02, 0.06, mx));
    const t = Math.max(0, Math.min(1, tone));
    const light = [1.1, 1.06, 1.02];
    const deep = [0.68, 0.56, 0.46];
    const k = vec3(light[0]! + (deep[0]! - light[0]!) * t, light[1]! + (deep[1]! - light[1]!) * t, light[2]! + (deep[2]! - light[2]!) * t);
    return mix(inner, inner.mul(k), mask);
  })() as unknown as Node<'vec3'>;
}
