import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import raw from '@content/ecology/soundscape.truong-son.json';
import { SoundscapePlan, parseSoundscapeConfig, greatCallNote, rainTerm, windowWeight, type AmbientState, type SoundEvent, type SoundscapeConfig } from '@engine/audio/soundscapePlan';
import { checkSoundscapeRefs } from '../../scripts/check-soundscape-refs.mjs';

const cfg: SoundscapeConfig = parseSoundscapeConfig(raw as unknown);

// Huế tháng 1: mọc 6:22, lặn 17:37 (registry: Giờ mặt trời mọc lặn Huế tháng 1–3)
const SUNRISE = 6 * 60 + 22;
const SUNSET = 17 * 60 + 37;

interface Rec {
  t: number;
  ev: SoundEvent;
}

function simulate(seed: number, fromMin: number, toMin: number, env: Partial<AmbientState> = {}, dt = 1): Rec[] {
  const plan = new SoundscapePlan(cfg, seed);
  const st: AmbientState = { localMin: fromMin, sunriseMin: SUNRISE, sunsetMin: SUNSET, month: 1, rain: 0, wind: 0, ...env };
  const out: Rec[] = [];
  let t = fromMin;
  plan.update(dt, st);
  const steps = Math.round(((toMin - fromMin) * 60) / dt);
  for (let i = 0; i < steps; i++) {
    const t0 = t;
    t += dt / 60;
    st.localMin = t % 1440;
    const o = plan.update(dt, st);
    for (const ev of o.events) out.push({ t: t0 + ev.startOffset / 60, ev: { ...ev, params: { ...ev.params } } });
  }
  return out;
}

const of = (recs: Rec[], kind: string): Rec[] => recs.filter((r) => r.ev.kind === kind);

describe('soundscape config (registry refinery rung-truong-son)', () => {
  it('mọi entity/field có claim; mọi con số có ref hoặc khai design', () => {
    const { errors, stats } = checkSoundscapeRefs();
    expect(errors).toEqual([]);
    expect(stats.quantitative).toBeGreaterThanOrEqual(5);
  });

  it('kiểm có răng: entity sai tên và số không khai đều bị bắt', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dvsg-sc-'));
    const bad = JSON.parse(readFileSync('content/ecology/soundscape.truong-son.json', 'utf8'));
    bad.voices[0].refs[0].entity = 'Vuon khong ton tai';
    bad.voices[1].secretNumber = 42;
    const p = join(dir, 'bad.json');
    writeFileSync(p, JSON.stringify(bad));
    const { errors } = checkSoundscapeRefs(p);
    expect(errors.some((e) => e.includes('entity not in claims'))).toBe(true);
    expect(errors.some((e) => e.includes('secretNumber'))).toBe(true);
  });

  it('parse fail-loud khi thiếu ref', () => {
    const bad = JSON.parse(JSON.stringify(raw));
    bad.voices[0].refs = [];
    expect(() => parseSoundscapeConfig(bad)).toThrow(/refs/);
  });

  it('số vượn khớp claim A (−12 / +13 / 16 phút)', () => {
    const g = cfg.voices.find((v) => v.id === 'gibbon-nomascus')!;
    expect(g.windows![0]!.start).toEqual({ anchor: 'sunrise', min: -12 });
    expect(g.windows![0]!.end).toEqual({ anchor: 'sunrise', min: 13 });
    expect(g.bout!.meanMin).toBe(16);
  });
});

describe('SoundscapePlan', () => {
  it('vượn chỉ hót trong cửa sổ sunrise−12 … sunrise+13 (lệch ngày ≤ vài phút)', () => {
    let total = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const g = of(simulate(seed, 5 * 60 + 30, 7 * 60 + 30), 'gibbon');
      total += g.length;
      for (const r of g) {
        expect(r.t).toBeGreaterThanOrEqual(SUNRISE - 12 - 5);
        expect(r.t).toBeLessThanOrEqual(SUNRISE + 13 + 5);
        // trần lỏng theo TIP: không sau sunrise + 13 + bout
        expect(r.t).toBeLessThanOrEqual(SUNRISE + 13 + 16);
      }
    }
    expect(total).toBeGreaterThan(100);
  });

  it('cấu trúc hồi hót: intro → great → coda; great call kế sau 1–2 phút; 1–3 nhóm ở phương khác nhau', () => {
    let groupsSeen = 0;
    let multiAz = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const g = of(simulate(seed, 5 * 60 + 50, 7 * 60), 'gibbon');
      const byGroup = new Map<number, Rec[]>();
      for (const r of g) {
        const a = byGroup.get(r.ev.params.group) ?? [];
        a.push(r);
        byGroup.set(r.ev.params.group, a);
      }
      expect(byGroup.size).toBeLessThanOrEqual(3);
      const az = new Set<number>();
      for (const recs of byGroup.values()) {
        groupsSeen++;
        az.add(Math.round(recs[0]!.ev.azimuthRad * 100));
        expect(recs[0]!.ev.variant).toBe('intro');
        expect(recs[1]?.ev.variant ?? 'great').toBe('great');
        for (let i = 0; i + 1 < recs.length; i++) if (recs[i]!.ev.variant === 'great' && recs[i + 1]) expect(recs[i + 1]!.ev.variant).toBe('coda');
        const greats = recs.filter((r) => r.ev.variant === 'great');
        for (let i = 1; i < greats.length; i++) {
          const gap = greats[i]!.t - greats[i - 1]!.t;
          expect(gap).toBeGreaterThanOrEqual(1 - 0.01);
          expect(gap).toBeLessThanOrEqual(2 + 0.4);
        }
        for (const r of greats) {
          expect(r.ev.params.count).toBeGreaterThanOrEqual(8);
          expect(r.ev.params.durationS).toBeGreaterThan(2);
        }
      }
      if (byGroup.size > 1) {
        multiAz++;
        expect(az.size).toBe(byGroup.size);
      }
    }
    expect(groupsSeen).toBeGreaterThan(20);
    expect(multiAz).toBeGreaterThan(0);
  });

  it('great call cao dần và nhanh dần', () => {
    const a = greatCallNote(0, 10);
    const b = greatCallNote(9, 10);
    expect(a.hz).toBeCloseTo(600);
    expect(b.hz).toBeCloseTo(1600);
    expect(b.durS).toBeLessThan(a.durS);
    expect(b.gapS).toBeLessThan(a.gapS);
  });

  it('gió làm hồi hót ngắn lại', () => {
    const span = (wind: number): number => {
      let s = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const g = of(simulate(seed, 6 * 60, 6 * 60 + 50, { wind }), 'gibbon');
        const by = new Map<number, number[]>();
        for (const r of g) by.set(r.ev.params.group, [...(by.get(r.ev.params.group) ?? []), r.t]);
        for (const ts of by.values()) s += ts[ts.length - 1]! - ts[0]!;
      }
      return s;
    };
    expect(span(1)).toBeLessThan(span(0));
  });

  it('tháng 1 không có ve sầu; tháng 6 trưa nắng có', () => {
    const plan = new SoundscapePlan(cfg, 7);
    const st: AmbientState = { localMin: 0, sunriseMin: SUNRISE, sunsetMin: SUNSET, month: 1, rain: 0, wind: 0 };
    let maxJan = 0;
    for (let m = 0; m < 1440; m += 5) {
      st.localMin = m;
      const o = plan.update(300, st);
      for (const b of o.beds) if (b.kind === 'cicada') maxJan = Math.max(maxJan, b.intensity);
      expect(o.events.some((e) => e.kind === 'cicada')).toBe(false);
    }
    expect(maxJan).toBe(0);
    const june = new SoundscapePlan(cfg, 7);
    const o = june.update(1, { localMin: 13 * 60, sunriseMin: 5 * 60 + 15, sunsetMin: 18 * 60 + 45, month: 6, rain: 0, wind: 0 });
    expect(o.beds.find((b) => b.kind === 'cicada')!.intensity).toBeGreaterThan(0.5);
    const juneRain = new SoundscapePlan(cfg, 7).update(1, { localMin: 13 * 60, sunriseMin: 5 * 60 + 15, sunsetMin: 18 * 60 + 45, month: 6, rain: 0.8, wind: 0 });
    expect(juneRain.beds.find((b) => b.kind === 'cicada')!.intensity).toBe(0);
  });

  it('mưa: có ếch nhái ban đêm và mưa phùn; vượn hót ít hơn', () => {
    const wetNight = of(simulate(3, 19 * 60, 21 * 60, { rain: 0.8 }, 2), 'frogs');
    const dryNight = of(simulate(3, 19 * 60, 21 * 60, { rain: 0 }, 2), 'frogs');
    expect(wetNight.length).toBeGreaterThan(50);
    expect(dryNight.length).toBe(0);
    const day = of(simulate(3, 12 * 60, 13 * 60, { rain: 0.8 }, 2), 'frogs');
    expect(day.length).toBe(0);

    const drizzle = new SoundscapePlan(cfg, 3).update(1, { localMin: 600, sunriseMin: SUNRISE, sunsetMin: SUNSET, month: 1, rain: 0.4, wind: 0 });
    expect(drizzle.beds.find((b) => b.kind === 'drizzle')!.intensity).toBeCloseTo(0.4);
    const noDrizzle = new SoundscapePlan(cfg, 3).update(1, { localMin: 600, sunriseMin: SUNRISE, sunsetMin: SUNSET, month: 1, rain: 0, wind: 0 });
    expect(noDrizzle.beds.find((b) => b.kind === 'drizzle')!.intensity).toBe(0);

    let dry = 0;
    let wet = 0;
    for (let seed = 1; seed <= 30; seed++) {
      dry += of(simulate(seed, 6 * 60, 6 * 60 + 45, { rain: 0 }, 2), 'gibbon').length;
      wet += of(simulate(seed, 6 * 60, 6 * 60 + 45, { rain: 1 }, 2), 'gibbon').length;
    }
    expect(wet).toBeLessThan(dry * 0.6);
  });

  it('mang/voọc chỉ phát qua alarm()', () => {
    const recs = simulate(11, 0, 1440, { rain: 0.3 }, 20);
    expect(recs.some((r) => r.ev.kind === 'muntjac' || r.ev.kind === 'douc')).toBe(false);
    const plan = new SoundscapePlan(cfg, 11);
    const m = plan.alarm('muntjac', 1, 60)!;
    const d = plan.alarm('douc', 2, 40)!;
    expect(m.kind).toBe('muntjac');
    expect(d.kind).toBe('douc');
    expect(m.params.count).toBeGreaterThanOrEqual(1);
    expect(d.params.count).toBeGreaterThanOrEqual(2);
  });

  it('tất định cùng seed; khác seed khác lịch', () => {
    const a = simulate(42, 5 * 60 + 30, 8 * 60, { rain: 0.2, wind: 0.3 });
    const b = simulate(42, 5 * 60 + 30, 8 * 60, { rain: 0.2, wind: 0.3 });
    const c = simulate(43, 5 * 60 + 30, 8 * 60, { rain: 0.2, wind: 0.3 });
    expect(a.length).toBeGreaterThan(0);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });

  it('nhảy giờ không phát dồn; qua nửa đêm sang ngày mới vẫn có vượn', () => {
    const plan = new SoundscapePlan(cfg, 5);
    const st: AmbientState = { localMin: 5 * 60, sunriseMin: SUNRISE, sunsetMin: SUNSET, month: 1, rain: 0, wind: 0 };
    plan.update(1, st);
    st.localMin = 6 * 60 + 25;
    expect(plan.update(1, st).events.length).toBe(0);
    // chạy 2 ngày với bước 10 s
    const recs = simulate(5, 22 * 60, 22 * 60 + 2 * 1440, {}, 10);
    const days = new Set(of(recs, 'gibbon').map((r) => Math.floor(r.t / 1440)));
    expect(days.size).toBe(2);
  });

  it('helper cửa sổ vắt qua nửa đêm và cổng mưa', () => {
    const st: AmbientState = { localMin: 0, sunriseMin: SUNRISE, sunsetMin: SUNSET, month: 1, rain: 0, wind: 0 };
    const night = { start: { anchor: 'sunset' as const, min: 0 }, end: { anchor: 'sunrise' as const, min: 0 }, weight: 1 };
    expect(windowWeight(night, 23 * 60, st)).toBe(1);
    expect(windowWeight(night, 3 * 60, st)).toBe(1);
    expect(windowWeight(night, 12 * 60, st)).toBe(0);
    const frogs = cfg.voices.find((v) => v.kind === 'frogs')!;
    expect(rainTerm(frogs, 0.1)).toBe(0);
    expect(rainTerm(frogs, 0.5)).toBe(0.5);
  });
});
