/**
 * DV-080 đồ hoạ AAA lượt 2: lá rụng (asset + luật đặt), mức Ultra, tia nắng thể tích (số mẫu theo tier, σ sương theo độ cao).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { Scene } from 'three/webgpu';
import { resolveQuality, QUALITY } from '@engine/render/quality';
import { VOLUMETRIC_STEPS } from '@engine/render/post';
import { createAtmosphere } from '@engine/render/atmosphere';
import { VEG_QUALITY } from '@engine/vegetation/forest';
import { FLAT_SPECIES_H } from '@engine/vegetation/system';

describe('DV-080 lá rụng', () => {
  const manifest = JSON.parse(readFileSync('content/assets/manifest.json', 'utf8')) as { assets: Array<{ id: string; license: string; source: string; files: Array<{ path: string }> }> };
  it('asset veg_litter CC0 ambientCG có file', () => {
    const a = manifest.assets.find((x) => x.id === 'veg_litter');
    expect(a).toBeTruthy();
    expect(a!.license).toBe('CC0-1.0');
    expect(a!.source).toBe('ambientcg');
    expect(existsSync(`public/${a!.files[0]!.path}`)).toBe(true);
  });
  it('M1 có luật lá rụng dưới tán (cùng mặt nạ tree_canopy), LOD gần, không đổ bóng;', () => {
    const lvl = JSON.parse(readFileSync('content/levels/truong-son-a.level.json', 'utf8'));
    const r = lvl.vegetation.species.find((s: { id: string }) => s.id === 'litter');
    expect(r).toBeTruthy();
    expect(r.noiseId).toBe('tree_canopy');
    expect(r.noise.min).toBeLessThan(0.3);
    expect(r.lod[2]).toBeLessThanOrEqual(40);
    expect(r.cast).not.toBe(true);
    const roots = lvl.vegetation.species.find((s: { id: string }) => s.id === 'ph_roots');
    expect(roots.perHa).toBeGreaterThanOrEqual(10);
    expect(lvl.post.volumetric.intensity).toBeGreaterThan(0);
  });
  it('ngưỡng loài nằm đất thấp hơn cỏ (0,35 m) — cỏ/dương xỉ không bị ép phẳng', () => {
    expect(FLAT_SPECIES_H).toBeLessThan(0.35);
  });
});

describe('DV-080 mức Ultra', () => {
  it('?quality=ultra: bóng 4096 tầm 1,5×, render 2560, post ultra; High nhẹ hơn (DV-086)', () => {
    const u = resolveQuality(new URLSearchParams('quality=ultra'));
    expect(u.tier).toBe('ultra');
    expect(u.shadowMapSize).toBe(4096);
    expect(u.shadowFarScale).toBeGreaterThan(1);
    expect(u.maxRenderWidth).toBe(2560);
    expect(u.post).toBe('ultra');
    expect(QUALITY.high.shadowMapSize).toBe(2048);
    // DV-086: High 2 cascade, tầm 0,7× (mỗi cascade vẽ lại mọi caster; sương rừng che bóng xa); Ultra giữ 3 cascade của level
    expect(QUALITY.high.shadowFarScale).toBe(0.7);
    expect(QUALITY.high.shadowCascades).toBe(2);
    expect(u.shadowCascades).toBeNull();
    expect(u.ssr).toBe(true);
    expect(QUALITY.high.ssr).toBe(false);
    expect(resolveQuality(new URLSearchParams('quality=high&post=ultra')).post).toBe('ultra');
  });
  it('rừng ultra giữ chi tiết xa hơn, mật độ như high', () => {
    expect(VEG_QUALITY.ultra.lodScale).toBeGreaterThan(VEG_QUALITY.high.lodScale);
    expect(VEG_QUALITY.ultra.density).toBe(VEG_QUALITY.high.density);
  });
  it('tia nắng thể tích: số mẫu tăng dần medium < high < ultra', () => {
    expect(VOLUMETRIC_STEPS.medium).toBeLessThan(VOLUMETRIC_STEPS.high);
    expect(VOLUMETRIC_STEPS.high).toBeLessThan(VOLUMETRIC_STEPS.ultra);
  });
});

describe('DV-080 σ sương cho tia nắng thể tích', () => {
  it('σ ở thung lũng > ở độ cao chuẩn > ở đỉnh; khớp tầm nhìn preset', () => {
    const atm = createAtmosphere(new Scene(), { color: 0x9fb09d, density: 0.0033 });
    const s0 = atm.sigmaAt(0);
    expect(atm.sigmaAt(-100)).toBeGreaterThan(s0);
    expect(atm.sigmaAt(200)).toBeLessThan(s0);
    // σ₀ ≈ −ln(0,1)/(V − 14) với V ≈ 600 m
    expect(s0).toBeGreaterThan(0.003);
    expect(s0).toBeLessThan(0.006);
  });
});
