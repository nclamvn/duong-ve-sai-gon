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
export function erdlPatternNode(u: Node<'vec2'>, freq = 18): Node<'vec3'> {
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
    const lime = vec3(0.25, 0.3, 0.105);
    const green = vec3(0.052, 0.086, 0.032);
    const brown = vec3(0.105, 0.06, 0.026);
    const black = vec3(0.013, 0.014, 0.011);
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
export function erdlColorNode(map: Texture): Node<'vec3'> {
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
    const camo = erdlPatternNode(uv(), 18).mul(shade);
    return mix(rgb, camo, mask);
  })() as unknown as Node<'vec3'>;
}
