/**
 * Rằn ri hổ (tiger stripe) procedural cho lính thám báo VNCH 1971 (TIP-M1A, DV-043): thay vùng vải "xanh Tô Châu" của atlas
 * lính QGP bằng sọc hổ (đen / xanh ô-liu / nâu vàng) ngay trong shader — mặt nạ vải = sắc độ gần màu vải tham chiếu (da, thắt lưng,
 * giày giữ nguyên); giữ độ sáng dệt gốc. Không thêm texture (DV-023 binding ≤ 16). Bản asset retexture riêng (D11c) thay sau
 * khi cố vấn duyệt registry `uni.arvn.1971.tiger_stripe`.
 */
import type { Texture, Node } from 'three/webgpu';
import { Fn, texture, uv, vec2, vec3, float, mix, smoothstep, length, mx_noise_float, clamp } from 'three/tsl';

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
