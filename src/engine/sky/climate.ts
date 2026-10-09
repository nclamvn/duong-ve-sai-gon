/**
 * Trời theo registry (DV-057): preset trong content/ecology/climate.*.json + ngày/giờ/toạ độ của level →
 * LevelSky (mặt trời thiên văn, sương theo tầm nhìn, cường độ theo độ u ám) + trạng thái cho cảnh âm.
 * Thuần số (Node test được). Không đặt mặt trời bằng tay (PRD REN-001).
 */
import type { LevelSky } from '../level/types';
import { solarPosition, parseClock } from './solar';

export interface ClimatePreset {
  id: string;
  months: number[];
  hdri: string;
  res: LevelSky['res'];
  /** tầm nhìn (m) ở ngưỡng tương phản 2 % → mật độ FogExp2 */
  visibilityM: number;
  fogColor: number;
  sunScale: number;
  skyScale: number;
  envScale: number;
  hemiScale: number;
  sunColor: number;
  /** cao độ tối thiểu của đèn mặt trời (độ): mặt trời sát chân trời làm bóng CSM dài vô tận và răng cưa */
  minLightElevationDeg: number;
  /** mưa phùn 0..1 (hạt mưa + nền tiếng mưa) */
  drizzle: number;
  /** độ ướt mặt đất 0..1 */
  wetness: number;
}

export interface LevelClimate {
  preset: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM giờ địa phương lúc vào màn */
  localTime: string;
  utcOffsetH: number;
  lat: number;
  lon: number;
}

export interface ResolvedClimate {
  sky: LevelSky;
  preset: ClimatePreset;
  month: number;
  localMin: number;
  sunriseMin: number;
  sunsetMin: number;
  /** cao độ thật của mặt trời (độ), trước khi kẹp cho đèn */
  sunElevationTrueDeg: number;
  drizzle: number;
  wetness: number;
}

/** −ln(0,02) — ngưỡng tương phản 2 % (định nghĩa tầm nhìn khí tượng Koschmieder) */
const LN_CONTRAST = Math.log(50);

/** FogExp2: f = exp(−(d·ρ)²) → ρ = √(−ln 0,02) / V */
export function fogDensityForVisibility(visibilityM: number): number {
  return Math.sqrt(LN_CONTRAST) / Math.max(1, visibilityM);
}

export function parseClimatePresets(json: unknown): Record<string, ClimatePreset> {
  const items = (json as { items?: unknown[] }).items;
  if (!Array.isArray(items)) throw new Error('climate: items[] missing');
  const out: Record<string, ClimatePreset> = {};
  for (const raw of items) {
    const p = raw as ClimatePreset;
    for (const k of ['visibilityM', 'fogColor', 'sunScale', 'skyScale', 'envScale', 'hemiScale', 'sunColor', 'minLightElevationDeg', 'drizzle', 'wetness'] as const) {
      if (typeof p[k] !== 'number' || !Number.isFinite(p[k])) throw new Error(`climate ${p.id}: ${k} must be a number`);
    }
    if (typeof p.hdri !== 'string' || !Array.isArray(p.months)) throw new Error(`climate ${p.id}: hdri/months`);
    out[p.id] = p;
  }
  return out;
}

export function resolveClimate(base: LevelSky, c: LevelClimate, presets: Record<string, ClimatePreset>): ResolvedClimate {
  const preset = presets[c.preset];
  if (!preset) throw new Error(`climate preset ${c.preset} not found`);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(c.date);
  if (!m) throw new Error(`climate date must be YYYY-MM-DD, got ${c.date}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!preset.months.includes(month)) throw new Error(`climate preset ${preset.id} is for months ${preset.months.join(',')}, level date is month ${month}`);
  const localMin = parseClock(c.localTime);
  const sun = solarPosition({ lat: c.lat, lon: c.lon, year, month, day, localMin, utcOffsetH: c.utcOffsetH });
  const sky: LevelSky = {
    ...base,
    hdri: preset.hdri,
    res: preset.res,
    envIntensity: base.envIntensity * preset.envScale,
    skyIntensity: base.skyIntensity * preset.skyScale,
    sun: {
      azimuthDeg: sun.azimuthEngineDeg,
      elevationDeg: Math.max(preset.minLightElevationDeg, sun.elevationDeg),
      color: preset.sunColor,
      intensity: base.sun.intensity * preset.sunScale,
    },
    hemi: { ...base.hemi, intensity: base.hemi.intensity * preset.hemiScale },
    fog: { color: preset.fogColor, density: fogDensityForVisibility(preset.visibilityM) },
  };
  return {
    sky,
    preset,
    month,
    localMin,
    sunriseMin: sun.sunriseMin ?? 360,
    sunsetMin: sun.sunsetMin ?? 1080,
    sunElevationTrueDeg: sun.elevationDeg,
    drizzle: preset.drizzle,
    wetness: preset.wetness,
  };
}
