/**
 * Quality tiers (PRD REN-002: preset Low/Medium/High không đổi gameplay). Chỉ ảnh hưởng render.
 * ?quality=low|medium|high; tham số rời ?rain= ?shadow= ghi đè preset (CI).
 */
export type QualityTier = 'low' | 'medium' | 'high';
export type PostTier = 'off' | 'low' | 'medium' | 'high';

export interface QualityPreset {
  tier: QualityTier;
  rainCount: number;
  shadowMapSize: number;
  maxPixelRatio: number;
  /** trần chiều rộng render nội bộ (px) — PRD §4.1 default 1920×1200, không render DPR=2 toàn màn hình */
  maxRenderWidth: number;
  dynamicResolution: boolean;
  shadows: boolean;
  /** post stack (TIP-011): off | low (bloom+FXAA) | medium (+GTAO) | high (+SSR+TRAA) */
  post: PostTier;
  /** tải model glTF + HDRI (false = lite: chỉ texture — CI SwiftShader) */
  assets: boolean;
  /** số splash ring mưa (GPU) */
  splashCount: number;
  /** nón volumetric đèn pha */
  lightCones: boolean;
  /** TRAA thử nghiệm (?taa=1) */
  taa: boolean;
}

export const QUALITY: Record<QualityTier, QualityPreset> = {
  low: { tier: 'low', rainCount: 4000, shadowMapSize: 1024, maxPixelRatio: 1, maxRenderWidth: 1280, dynamicResolution: true, shadows: true, post: 'low', assets: true, splashCount: 128, lightCones: true, taa: false },
  medium: { tier: 'medium', rainCount: 12000, shadowMapSize: 2048, maxPixelRatio: 1.5, maxRenderWidth: 1600, dynamicResolution: true, shadows: true, post: 'medium', assets: true, splashCount: 256, lightCones: true, taa: false },
  high: { tier: 'high', rainCount: 20000, shadowMapSize: 2048, maxPixelRatio: 2, maxRenderWidth: 1920, dynamicResolution: true, shadows: true, post: 'high', assets: true, splashCount: 512, lightCones: true, taa: false },
};

export function resolveQuality(params: URLSearchParams): QualityPreset {
  const q = params.get('quality');
  const base = { ...(QUALITY[(q as QualityTier) ?? 'high'] ?? QUALITY.high) };
  const rain = params.get('rain');
  const shadow = params.get('shadow');
  if (rain !== null) base.rainCount = Math.max(0, Number(rain));
  if (shadow !== null) base.shadowMapSize = Math.max(256, Number(shadow));
  if (params.get('dynres') === '0') base.dynamicResolution = false;
  const rw = params.get('renderWidth');
  if (rw !== null) base.maxRenderWidth = Math.max(640, Number(rw));
  const post = params.get('post');
  if (post === 'off' || post === 'low' || post === 'medium' || post === 'high') base.post = post;
  if (params.get('assets') === '0') base.assets = false; // lite: CI SwiftShader
  const splash = params.get('splash');
  if (splash !== null) base.splashCount = Math.max(0, Number(splash));
  if (params.get('cones') === '0') base.lightCones = false;
  if (params.get('taa') === '1') base.taa = true;
  return base;
}
