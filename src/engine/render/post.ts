/**
 * Post stack (PRD §4 Post FX: node stack; bloom/grade/vignette nhẹ; SSAO/SSR theo quality flag) — TIP-011.
 * Tier: off = renderer.render · low = bloom + FXAA · medium = + GTAO · high = + SSR (sàn ướt, chỉ WebGPU) (+ TRAA khi ?taa=1)
 * · ultra (DV-080) = high + GTAO đủ phân giải 12 mẫu, SSR chất lượng cao hơn, tia nắng thể tích nhiều mẫu.
 * Tia nắng thể tích xuyên tán (DV-080, volumetric.ts) ở medium/high/ultra khi level bật.
 * Tone mapping (AgX) + sRGB làm ở cuối (renderOutput) rồi AA/grain/vignette trên LDR.
 * TSL only (không ShaderMaterial). Mọi pass là node của RenderPipeline → 1 lệnh render()/frame.
 */
import { RenderPipeline, type WebGPURenderer, type Scene, type PerspectiveCamera, type Node, AgXToneMapping, Color } from 'three/webgpu';
import { pass, mrt, output, normalView, metalness, roughness, velocity, renderOutput, vec3, vec4, float, mix, smoothstep, uniform, dot } from 'three/tsl';

/** GTAO mờ dần theo khoảng cách nhìn (m): xa hơn AO_FADE_END không áp AO — terrain (TIP-D04) bị vạch/ô từ GTAO nửa phân giải trên sườn ≥ ~50 m (Mac WebGPU xác nhận: post=low sạch, medium có vạch), và AO bán kính 0,5 m ở > 30 m không nhìn thấy */
export const AO_FADE_START = 30;
export const AO_FADE_END = 70;
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { film } from 'three/addons/tsl/display/FilmNode.js';
import { denoise } from 'three/addons/tsl/display/DenoiseNode.js';
import { vignette } from 'three/addons/tsl/display/CRT.js';
import { lightShafts, filmGrade, type ShaftOptions, type FilmGrade, type LightShafts } from './cinematic';
import { volumetricShafts, type Volumetric, type VolumetricOptions, type VolumetricEnv, type VolumetricGround } from './volumetric';

export type PostTier = 'off' | 'low' | 'medium' | 'high' | 'ultra';

/** DV-080: số mẫu tia nắng thể tích theo tier */
export const VOLUMETRIC_STEPS: Record<'medium' | 'high' | 'ultra', number> = { medium: 10, high: 14, ultra: 24 }; // DV-086: có lọc khử nhiễu, bớt mẫu

export interface PostStack {
  tier: PostTier;
  /** render 1 frame (thay renderer.render) */
  render(): void;
  /** các pass đang bật — cho evidence/overlay */
  passes: string[];
  bloomStrength: { value: number };
  /** DV-063: tia nắng xuyên tán (null khi tắt) */
  shafts: LightShafts | null;
  /** DV-080: tia nắng thể tích xuyên tán qua sương (null khi tắt) */
  volumetric: Volumetric | null;
  /** căng thẳng 0..1 (DV-075 áp chế): mất màu + tối viền thêm; tier off = không tác dụng */
  stress: { value: number };
  /** gọi mỗi frame trước render (vị trí mặt trời màn hình cho tia nắng) */
  update(camera: PerspectiveCamera, sunDir: readonly [number, number, number] | null, env?: VolumetricEnv): void;
}

export interface PostOptions {
  tier: PostTier;
  /** backend thật: SSR chỉ WebGPU (SSRNode r185 sinh GLSL `max(int, float)` lỗi trên WebGL 2 — ghi known-issue) */
  backend?: 'webgpu' | 'webgl2';
  /** TRAA thay FXAA ở high (thử nghiệm: trên WebGL2 sandbox history làm tối ảnh — mặc định tắt, ?taa=1) */
  taa?: boolean;
  bloomStrength?: number;
  bloomThreshold?: number;
  /** metalness tối thiểu cho SSR trên dielectric (sàn ướt); 0 = chỉ kim loại */
  ssrWetFloor?: number;
  grain?: number;
  /** DV-086: SSR (quality.ssr — chỉ Ultra mặc định) */
  ssr?: boolean;
  /** DV-086: khử nhiễu GTAO nửa phân giải (hạt lấm tấm quanh lá/cỏ); false để so */
  aoDenoise?: boolean;
  vignette?: number;
  /**
   * Lớp viewmodel (TIP-017b): scene + camera riêng (FOV hẹp) render sau cảnh, đè lên theo alpha — như FPS thật, không méo hình.
   * Không có AO/SSR trên lớp này; bloom/tone map/AA áp chung.
   */
  overlay?: { scene: Scene; camera: PerspectiveCamera };
  /** DV-063: tia nắng xuyên tán (medium/high); cần màu mặt trời (linear) */
  shafts?: (ShaftOptions & { sunColor: [number, number, number] }) | null;
  /** DV-080: tia nắng thể tích (medium/high/ultra); cần màu mặt trời (linear) — số mẫu theo tier */
  volumetric?: (Omit<VolumetricOptions, 'steps'> & { sunColor: [number, number, number]; debug?: boolean; ground?: VolumetricGround | null; ambient?: [number, number, number] }) | null;
  /** DV-063: chỉnh màu phim (mọi tier trừ off); false = tắt */
  grade?: FilmGrade | false;
}

export function createPostStack(renderer: WebGPURenderer, scene: Scene, camera: PerspectiveCamera, opts: PostOptions): PostStack {
  const tier = opts.tier;
  const overlay = opts.overlay;
  if (tier === 'off') {
    return {
      tier,
      passes: overlay ? ['overlay'] : [],
      bloomStrength: { value: 0 },
      stress: { value: 0 },
      shafts: null,
      volumetric: null,
      update: () => undefined,
      render: () => {
        renderer.render(scene, camera);
        if (overlay) {
          renderer.autoClear = false;
          renderer.clearDepth();
          renderer.render(overlay.scene, overlay.camera);
          renderer.autoClear = true;
        }
      },
    };
  }
  renderer.toneMapping = AgXToneMapping;
  const passes: string[] = [];
  const pipeline = new RenderPipeline(renderer);
  pipeline.outputColorTransform = false; // tự renderOutput để AA/grain chạy trên LDR

  const scenePass = pass(scene, camera);
  const ultra = tier === 'ultra';
  const useAO = tier === 'medium' || tier === 'high' || ultra;
  const useSSR = (tier === 'high' || ultra) && opts.backend !== 'webgl2' && opts.ssr !== false;
  const useTRAA = (tier === 'high' || ultra) && opts.taa === true;
  if (useAO || useSSR || useTRAA) {
    const targets: Record<string, unknown> = { output, normal: normalView };
    if (useSSR) {
      targets['metalness'] = metalness;
      targets['roughness'] = roughness;
    }
    if (useTRAA) targets['velocity'] = velocity;
    scenePass.setMRT(mrt(targets as Parameters<typeof mrt>[0]));
  }
  type V4 = Node<'vec4'>;
  const beauty = scenePass.getTextureNode('output'); // SSR cần TextureNode (.sample)
  let color: V4 = beauty as unknown as V4;
  const depth = scenePass.getTextureNode('depth');

  if (useAO) {
    const normal = scenePass.getTextureNode('normal');
    const aoPass = ao(depth, normal, camera);
    // GTAO đo M1 Max 1920 px (D-052): 12 mẫu ≈ +3.8 ms → 8 mẫu, bán kính 0.5
    // ultra (DV-080): đủ phân giải 12 mẫu — bớt nhoè/ô AO quanh lá cỏ, chân cây
    aoPass.resolutionScale = ultra ? 1 : 0.5;
    aoPass.radius.value = 0.5;
    aoPass.distanceFallOff.value = 1.0;
    aoPass.samples.value = ultra ? 12 : 8;
    const aoFade = smoothstep(float(AO_FADE_START), float(AO_FADE_END), scenePass.getViewZNode('depth').negate());
    const aoRaw = aoPass.getTextureNode();
    // DV-086: GTAO nửa phân giải 8 mẫu để trần thì lấm tấm (Mac: "sạn kiểu noise hình") → lọc theo độ sâu + pháp tuyến
    const aoTex = opts.aoDenoise === false ? aoRaw : (denoise(aoRaw, depth, normal, camera) as unknown as typeof aoRaw);
    const aoTerm = mix(aoTex.r, float(1.0), aoFade);
    color = color.mul(vec4(vec3(aoTerm), 1.0));
    passes.push('gtao');
  }
  if (useSSR) {
    const normal = scenePass.getTextureNode('normal') as unknown as Node<'vec3'>;
    // SSRNode r185 (mirror mode) nhân màu phản chiếu với metalness → dielectric (sàn ướt) = 0 → không thấy gì.
    // Sàn ướt cần mức tối thiểu SSR_WET (Fresnel góc thấp + suy giảm theo khoảng cách vẫn áp dụng trong node).
    // Sàn SSR chỉ cho mặt nhẵn/ướt (roughness < ~0,5): mặt nhám (terrain 0,85–0,9, tường) không có phản chiếu gương → tránh vệt/ô SSR
    // nửa phân giải trên terrain (TIP-D04, WebGPU Mac, DV-024). Sàn ướt (roughness 0,1–0,3) giữ nguyên.
    const roughTex = scenePass.getTextureNode('roughness').r;
    const wetFloor = float(opts.ssrWetFloor ?? 0.22).mul(smoothstep(float(0.6), float(0.35), roughTex));
    const ssrPass = ssr(beauty, depth, normal, {
      metalnessNode: scenePass.getTextureNode('metalness').r.max(wetFloor),
      roughnessNode: roughTex,
      reflectNonMetals: true, // sàn ướt/vũng nước là dielectric
      camera,
    });
    ssrPass.resolutionScale = 0.5;
    ssrPass.maxDistance.value = 12;
    ssrPass.thickness.value = 0.25;
    ssrPass.quality.value = ultra ? 0.65 : 0.4;
    // r185: rgb đã nhân metalness·suy giảm·Fresnel; **alpha = khoảng cách hit** (chọn mip blur), KHÔNG phải độ tin cậy.
    // TIP-011 trộn theo alpha → alpha > 1 nhân ngược màu nền thành đen (vệt đen loang lổ trên Mac, D-051). Cộng thẳng như ví dụ three.
    const s4 = ssrPass as unknown as V4;
    color = vec4(color.rgb.add(s4.rgb), 1.0);
    passes.push('ssr');
  }
  // DV-080 tia nắng thể tích: trước lớp viewmodel (súng/tay không bị phủ sương sáng)
  let volumetric: Volumetric | null = null;
  if (opts.volumetric && (tier === 'medium' || tier === 'high' || ultra)) {
    const { sunColor, debug, ground, ambient, ...vo } = opts.volumetric;
    volumetric = volumetricShafts(depth, sunColor, { ...vo, steps: VOLUMETRIC_STEPS[tier as 'medium' | 'high' | 'ultra'] }, ground ?? null, ambient);
    const vn = volumetric.node;
    // DV-081: cảnh × độ truyền qua sương sát đất + ánh sáng tán xạ. ?vol=debug: chỉ phần tán xạ (× 6) để soi cột nắng/sương
    color = debug ? vec4(vn.rgb.mul(6), 1.0) : vec4(color.rgb.mul(vn.a).add(vn.rgb), 1.0);
    passes.push('volumetric');
  }
  if (overlay) {
    // pass riêng, nền trong suốt (clear alpha 0) → mix theo alpha; đặt sau AO/SSR (không áp lên súng), trước bloom (lửa nòng vẫn bloom)
    renderer.setClearColor(new Color(0x000000), 0);
    const vmPass = pass(overlay.scene, overlay.camera);
    const vm = vmPass.getTextureNode('output') as unknown as V4;
    color = vec4(mix(color.rgb, vm.rgb, vm.a), 1.0);
    passes.push('overlay');
  }
  let shafts: LightShafts | null = null;
  // DV-086: tia nắng màn hình (DV-063) chỉ khi không có tia thể tích — cộng chồng hai lớp sáng làm ảnh đục như phủ sữa
  if (opts.shafts && !volumetric && (tier === 'medium' || tier === 'high' || ultra)) {
    shafts = lightShafts(depth, opts.shafts.sunColor, opts.shafts);
    color = vec4(color.rgb.add(shafts.node), 1.0);
    passes.push('shafts');
  }
  const bloomStrength = { value: opts.bloomStrength ?? 0.3 };
  const bloomPass = bloom(color, bloomStrength.value, 0.25, opts.bloomThreshold ?? 1.0);
  color = color.add(bloomPass as unknown as V4);
  passes.push('bloom');

  // HDR → LDR (AgX + sRGB) rồi AA
  let ldr: V4 = renderOutput(color) as unknown as V4;
  if (useTRAA) {
    ldr = traa(ldr, depth, scenePass.getTextureNode('velocity'), camera) as unknown as V4;
    passes.push('traa');
  } else {
    ldr = fxaa(ldr) as unknown as V4;
    passes.push('fxaa');
  }
  // grain + vignette nhẹ (PRD: "nhẹ")
  if (opts.grade !== false && opts.grade !== undefined) {
    ldr = vec4(filmGrade(ldr.rgb, opts.grade), 1.0);
    passes.push('grade');
  }
  // áp chế (DV-075): kéo về xám theo stress (tới 65 %) + vignette mạnh dần
  const stress = uniform(0);
  const luma = dot(ldr.rgb, vec3(0.2126, 0.7152, 0.0722));
  ldr = vec4(mix(ldr.rgb, vec3(luma), stress.mul(0.65)), 1.0);
  // DV-086: hạt phim nhảy mỗi khung (Mac: màn hình "sạn") — mặc định tắt; level đặt grain > 0 mới bật
  const grainAmt = opts.grain ?? 0;
  const grained = grainAmt > 0 ? (film(ldr, float(grainAmt)) as unknown as V4) : ldr;
  const graded: V4 = vec4(vignette(grained.rgb, float(opts.vignette ?? 0.32).add(stress.mul(0.5)), float(0.55)), 1.0);
  passes.push(...(grainAmt > 0 ? ['film'] : []), 'vignette', 'stress');
  pipeline.outputNode = graded;

  return {
    tier,
    passes,
    bloomStrength: bloomPass.strength as unknown as { value: number },
    stress: stress as unknown as { value: number },
    shafts,
    volumetric,
    update: (cam, sunDir, env) => {
      if (shafts && sunDir) shafts.update(cam, sunDir);
      if (volumetric && sunDir && env) volumetric.update(cam, sunDir, env);
    },
    render: () => pipeline.render(),
  };
}
