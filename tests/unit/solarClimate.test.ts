import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { solarPosition, parseClock } from '@engine/sky/solar';
import { resolveClimate, parseClimatePresets, fogDensityForVisibility } from '@engine/sky/climate';
import climateJson from '../../content/ecology/climate.truong-son.json';
import levelJson from '../../content/levels/truong-son-a.level.json';
import type { LevelSky } from '@engine/level/types';

const HUE = { lat: 16.4637, lon: 107.5909 };

describe('mặt trời thiên văn (DV-057, PRD REN-001)', () => {
  it('Huế giữa tháng 1, 2, 3 khớp giờ mọc/lặn registry (solarwatch, UTC+7) trong ±6 phút', () => {
    // registry: T1 mọc 6:22 lặn 17:37 · T2 6:17 / 17:53 · T3 5:59 / 18:00 (giá trị đại diện của tháng, tier C)
    const want: Array<[number, number, number]> = [
      [1, 6 * 60 + 22, 17 * 60 + 37],
      [2, 6 * 60 + 17, 17 * 60 + 53],
      [3, 5 * 60 + 59, 18 * 60],
    ];
    for (const [month, rise, set] of want) {
      const s = solarPosition({ ...HUE, year: 2026, month, day: 15, localMin: 720, utcOffsetH: 7 });
      expect(Math.abs(s.sunriseMin! - rise)).toBeLessThanOrEqual(6);
      expect(Math.abs(s.sunsetMin! - set)).toBeLessThanOrEqual(6);
    }
  });

  it('trưa thật: phương vị la bàn ≈ 180° (nam), cao độ ≈ 90 − vĩ độ + xích vĩ', () => {
    const s0 = solarPosition({ ...HUE, year: 1971, month: 1, day: 20, localMin: 720, utcOffsetH: 7 });
    const s = solarPosition({ ...HUE, year: 1971, month: 1, day: 20, localMin: s0.solarNoonMin, utcOffsetH: 7 });
    expect(Math.abs(s.azimuthCompassDeg - 180)).toBeLessThan(1);
    // xích vĩ 20/1 ≈ −20,1° → cao độ ≈ 90 − 16,46 − 20,1 = 53,4°
    expect(s.elevationDeg).toBeGreaterThan(52.5);
    expect(s.elevationDeg).toBeLessThan(54.5);
    // quy ước engine: az = 180 − A
    expect(Math.abs(((s.azimuthEngineDeg + 540) % 360) - 180)).toBeLessThan(1.5);
  });

  it('buổi sáng mặt trời ở phía đông nam (tháng 1), cao độ tăng theo giờ', () => {
    const a = solarPosition({ lat: 17.55, lon: 106.1, year: 1971, month: 1, day: 20, localMin: parseClock('07:00'), utcOffsetH: 7 });
    const b = solarPosition({ lat: 17.55, lon: 106.1, year: 1971, month: 1, day: 20, localMin: parseClock('09:00'), utcOffsetH: 7 });
    expect(a.azimuthCompassDeg).toBeGreaterThan(105);
    expect(a.azimuthCompassDeg).toBeLessThan(125);
    expect(b.elevationDeg).toBeGreaterThan(a.elevationDeg + 20);
  });
});

describe('preset trời theo registry', () => {
  const presets = parseClimatePresets(climateJson);
  const base = (levelJson as { sky: LevelSky }).sky;

  it('tầm nhìn → mật độ FogExp2 ở ngưỡng tương phản 2 %', () => {
    const rho = fogDensityForVisibility(600);
    expect(Math.exp(-((600 * rho) ** 2))).toBeCloseTo(0.02, 5);
  });

  it('ô Trường Sơn M1: preset tháng 1, mặt trời tính từ ngày/giờ/toạ độ, đèn không thấp hơn ngưỡng', () => {
    const lv = levelJson as unknown as { climate: { preset: string; date: string; localTime: string; utcOffsetH: number; lat: number; lon: number } };
    expect(lv.climate).toBeDefined();
    const r = resolveClimate(base, lv.climate, presets);
    expect(r.month).toBe(1);
    expect(r.sky.hdri).toBe('kloofendal_misty_morning_puresky');
    expect(r.sky.sun.elevationDeg).toBeGreaterThanOrEqual(r.preset.minLightElevationDeg);
    expect(r.sky.fog.density).toBeGreaterThan(base.fog.density);
    // vào màn trong cửa sổ vượn hót: [sunrise − 12, sunrise + 13] (registry, tier A)
    expect(r.localMin).toBeGreaterThanOrEqual(r.sunriseMin - 12);
    expect(r.localMin).toBeLessThanOrEqual(r.sunriseMin + 13);
  });

  it('toạ độ climate khớp tâm DEM của ô (meta.json)', () => {
    const meta = JSON.parse(readFileSync('public/assets/terrain/truong-son-a/meta.json', 'utf8')) as { center: { lat: number; lon: number } };
    const lv = levelJson as unknown as { climate: { lat: number; lon: number } };
    expect(lv.climate.lat).toBeCloseTo(meta.center.lat, 3);
    expect(lv.climate.lon).toBeCloseTo(meta.center.lon, 3);
  });

  it('preset sai tháng thì báo lỗi, không lặng lẽ dùng', () => {
    expect(() => resolveClimate(base, { preset: 'm1-jan-dawn', date: '1971-03-01', localTime: '06:30', utcOffsetH: 7, lat: 17.55, lon: 106.1 }, presets)).toThrow();
  });
});

describe('dữ liệu sinh thái có nguồn (DV-057)', () => {
  it('mọi con số của climate và soundscape nằm trong refs (có claim registry) hoặc design', async () => {
    const { checkSoundscapeRefs } = await import('../../scripts/check-soundscape-refs.mjs');
    for (const f of ['content/ecology/climate.truong-son.json', 'content/ecology/soundscape.truong-son.json']) {
      const r = checkSoundscapeRefs(f) as { errors: string[] };
      expect(r.errors, f).toEqual([]);
    }
  });
});
