/**
 * Post stack (PRD §4 Post FX: node stack; bloom/grade/vignette nhẹ; SSAO/SSR theo quality flag) — TIP-011.
 * Tier: off = renderer.render · low = bloom + FXAA · medium = + GTAO · high = + SSR (sàn ướt, chỉ WebGPU) (+ TRAA khi ?taa=1).
 * Tone mapping (AgX) + sRGB làm ở cuối (renderOutput) rồi AA/grain/vignette trên LDR.
 * TSL only (không ShaderMaterial). Mọi pass là node của RenderPipeline → 1 lệnh render()/frame.
 */
import { RenderPipeline, type WebGPURenderer, type Scene, type PerspectiveCamera, type Node, AgXToneMapping, Color } from 'three/webgpu';
import { pass, mrt, output, normalView, metalness, roughness, velocity, renderOutput, vec3, vec4, float, mix } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { film } from 'three/addons/tsl/display/FilmNode.js';
import { vignette } from 'three/addons/tsl/display/CRT.js';

export type PostTier = 'off' | 'low' | 'medium' | 'high';

export interface PostStack {
  tier: PostTier;
  /** render 1 frame (thay renderer.render) */
  render(): void;
  /** các pass đang bật — cho evidence/overlay */
  passes: string[];
  bloomStrength: { value: number };
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
  vignette?: number;
  /**
   * Lớp viewmodel (TIP-017b): scene + camera riêng (FOV hẹp) render sau cảnh, đè lên theo alpha — như FPS thật, không méo hình.
   * Không có AO/SSR trên lớp này; bloom/tone map/AA áp chung.
   */
  overlay?: { scene: Scene; camera: PerspectiveCamera };
}

export function createPostStack(renderer: WebGPURenderer, scene: Scene, camera: PerspectiveCamera, opts: PostOptions): PostStack {
  const tier = opts.tier;
  const overlay = opts.overlay;
  if (tier === 'off') {
    return {
      tier,
      passes: overlay ? ['overlay'] : [],
      bloomStrength: { value: 0 },
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
  const useAO = tier === 'medium' || tier === 'high';
  const useSSR = tier === 'high' && opts.backend !== 'webgl2';
  const useTRAA = tier === 'high' && opts.taa === true;
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
    aoPass.resolutionScale = 0.5;
    aoPass.radius.value = 0.5;
    aoPass.distanceFallOff.value = 1.0;
    aoPass.samples.value = 8;
    color = color.mul(vec4(vec3(aoPass.getTextureNode().r), 1.0));
    passes.push('gtao');
  }
  if (useSSR) {
    const normal = scenePass.getTextureNode('normal') as unknown as Node<'vec3'>;
    // SSRNode r185 (mirror mode) nhân màu phản chiếu với metalness → dielectric (sàn ướt) = 0 → không thấy gì.
    // Sàn ướt cần mức tối thiểu SSR_WET (Fresnel góc thấp + suy giảm theo khoảng cách vẫn áp dụng trong node).
    const ssrPass = ssr(beauty, depth, normal, {
      metalnessNode: scenePass.getTextureNode('metalness').r.max(float(opts.ssrWetFloor ?? 0.22)),
      roughnessNode: scenePass.getTextureNode('roughness').r,
      reflectNonMetals: true, // sàn ướt/vũng nước là dielectric
      camera,
    });
    ssrPass.resolutionScale = 0.5;
    ssrPass.maxDistance.value = 12;
    ssrPass.thickness.value = 0.25;
    ssrPass.quality.value = 0.4;
    // r185: rgb đã nhân metalness·suy giảm·Fresnel; **alpha = khoảng cách hit** (chọn mip blur), KHÔNG phải độ tin cậy.
    // TIP-011 trộn theo alpha → alpha > 1 nhân ngược màu nền thành đen (vệt đen loang lổ trên Mac, D-051). Cộng thẳng như ví dụ three.
    const s4 = ssrPass as unknown as V4;
    color = vec4(color.rgb.add(s4.rgb), 1.0);
    passes.push('ssr');
  }
  if (overlay) {
    // pass riêng, nền trong suốt (clear alpha 0) → mix theo alpha; đặt sau AO/SSR (không áp lên súng), trước bloom (lửa nòng vẫn bloom)
    renderer.setClearColor(new Color(0x000000), 0);
    const vmPass = pass(overlay.scene, overlay.camera);
    const vm = vmPass.getTextureNode('output') as unknown as V4;
    color = vec4(mix(color.rgb, vm.rgb, vm.a), 1.0);
    passes.push('overlay');
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
  const grained = film(ldr, float(opts.grain ?? 0.08)) as unknown as V4;
  const graded: V4 = vec4(vignette(grained.rgb, float(opts.vignette ?? 0.32), float(0.55)), 1.0);
  passes.push('film', 'vignette');
  pipeline.outputNode = graded;

  return {
    tier,
    passes,
    bloomStrength: bloomPass.strength as unknown as { value: number },
    render: () => pipeline.render(),
  };
}
