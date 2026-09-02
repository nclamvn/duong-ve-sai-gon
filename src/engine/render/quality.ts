/**
 * Quality tiers (PRD REN-002: preset Low/Medium/High không đổi gameplay). Chỉ ảnh hưởng render.
 * ?quality=low|medium|high; tham số rời ?rain= ?shadow= ghi đè preset (CI).
 */
export type QualityTier = 'low' | 'medium' | 'high';

export interface QualityPreset {
  tier: QualityTier;
  rainCount: number;
  shadowMapSize: number;
  maxPixelRatio: number;
  /** trần chiều rộng render nội bộ (px) — PRD §4.1 default 1920×1200, không render DPR=2 toàn màn hình */
  maxRenderWidth: number;
  dynamicResolution: boolean;
  shadows: boolean;
}

export const QUALITY: Record<QualityTier, QualityPreset> = {
  low: { tier: 'low', rainCount: 4000, shadowMapSize: 1024, maxPixelRatio: 1, maxRenderWidth: 1280, dynamicResolution: true, shadows: true },
  medium: { tier: 'medium', rainCount: 12000, shadowMapSize: 2048, maxPixelRatio: 1.5, maxRenderWidth: 1600, dynamicResolution: true, shadows: true },
  high: { tier: 'high', rainCount: 20000, shadowMapSize: 2048, maxPixelRatio: 2, maxRenderWidth: 1920, dynamicResolution: true, shadows: true },
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
  return base;
}
