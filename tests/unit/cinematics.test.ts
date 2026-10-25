import { describe, it, expect } from 'vitest';
import { CameraTrack, CueTimeline, type CinematicDef } from '@engine/cinematics/track';
import intro from '@content/cinematics/intro.cine.json';
import intro60 from '@content/cinematics/intro-60.cine.json';
import vi from '@content/locale/vi.json';
import introDialogue from '@content/missions/intro.dialogue.json';

const KNOWN = new Set(['black', 'title', 'map', 'say', 'radio', 'music', 'film', 'haze', 'fog', 'hush', 'slowmo', 'sky', 'carpet', 'explode', 'burst', 'boom', 'birds', 'end']);

describe('DV-093 cinematics: camera track + timeline', () => {
  const def: CinematicDef = {
    id: 't',
    duration: 10,
    shots: [
      { id: 'a', t: 0, dur: 4, agl: false, fov: 40, keys: [{ t: 0, pos: [0, 0, 0], look: [0, 0, -1] }, { t: 4, pos: [4, 0, 0], look: [4, 0, -1], fov: 60 }] },
      { id: 'b', t: 4, dur: 6, agl: true, timeScale: 0.5, keys: [{ t: 0, pos: [10, 2, 0], look: [10, 2, -5] }] },
    ],
    events: [],
  };
  it('nội suy vị trí và fov trong shot, cắt cứng giữa shot, độ cao trên mặt đất, quay chậm', () => {
    const tr = new CameraTrack(def);
    const g = (): number => 100;
    const s0 = tr.at(2, g);
    expect(s0.shot.id).toBe('a');
    expect(s0.pos[0]).toBeCloseTo(2, 5);
    expect(s0.fov).toBeCloseTo(50, 5);
    const s1 = tr.at(5, g);
    expect(s1.shot.id).toBe('b');
    expect(s1.pos[1]).toBeCloseTo(102, 5);
    expect(s1.timeScale).toBe(0.5);
  });
  it('timeline bắn mỗi sự kiện đúng một lần, theo thứ tự', () => {
    const tl = new CueTimeline([
      { t: 2, type: 'b' },
      { t: 1, type: 'a' },
      { t: 5, type: 'c' },
    ]);
    const got: string[] = [];
    tl.advance(1.5, (e) => got.push(e.type));
    tl.advance(3, (e) => got.push(e.type));
    tl.advance(3, (e) => got.push(e.type));
    expect(got).toEqual(['a', 'b']);
    tl.advance(9, (e) => got.push(e.type));
    expect(got).toEqual(['a', 'b', 'c']);
    expect(tl.done).toBe(true);
  });
  for (const [name, json, dur] of [
    ['intro.cine.json (bản đầy đủ)', intro, 77],
    ['intro-60.cine.json (bản cắt 60 s)', intro60, 60],
  ] as const) {
    it(`${name}: ${dur} s, shot nối liền, sự kiện đã biết, chữ có trong locale, thoại có cue`, () => {
      const d = json as unknown as CinematicDef & { actors: Array<{ keys: Array<{ t: number }> }> };
      expect(d.duration).toBe(dur);
      const shots = [...d.shots].sort((a, b) => a.t - b.t);
      expect(shots[0]!.t).toBe(0);
      for (let i = 1; i < shots.length; i++) expect(shots[i]!.t).toBeCloseTo(shots[i - 1]!.t + shots[i - 1]!.dur, 5);
      expect(shots[shots.length - 1]!.t + shots[shots.length - 1]!.dur).toBeCloseTo(dur, 5);
      expect(new Set(shots.map((s) => s.id)).size).toBe(shots.length);
      const L = vi as Record<string, string>;
      const cues = new Set((introDialogue as { cues: Array<{ cueId: string }> }).cues.map((c) => c.cueId));
      for (const e of d.events) {
        expect(KNOWN.has(e.type), e.type).toBe(true);
        expect(e.t, `${e.type}@${e.t}`).toBeLessThanOrEqual(dur);
        if (e.type === 'title') expect(L[e['key'] as string], String(e['key'])).toBeTruthy();
        if (e.type === 'say') {
          expect(L[e['sub'] as string], String(e['sub'])).toBeTruthy();
          if (String(e['cue']).startsWith('C')) expect(cues.has(String(e['cue']))).toBe(true);
        }
      }
      expect(d.events.some((e) => e.type === 'end' && e.t === dur)).toBe(true);
      for (const a of d.actors) for (let i = 1; i < a.keys.length; i++) expect(a.keys[i]!.t).toBeGreaterThanOrEqual(a.keys[i - 1]!.t);
    });
  }
  it('DV-094 điểm nối phim → engine → trận: cắt trong khung đen, engine chạy tiếp, trao quyền trước khi hết', () => {
    const d = intro as unknown as CinematicDef & { handoff: { cut: number; live: number; t: number; holdAt: number[]; skipCues: string[]; title: string; sub: string } };
    const h = d.handoff;
    expect(h).toBeTruthy();
    expect(h.cut).toBeLessThan(h.live);
    expect(h.live).toBeLessThan(h.t);
    expect(h.t).toBeLessThan(d.duration);
    // màn đen đã kéo kín trước điểm cắt, mở lại không sớm hơn lúc engine chạy tiếp
    const blacks = d.events.filter((e) => e.type === 'black').sort((a, b) => a.t - b.t);
    const closing = blacks.filter((e) => e['to'] === 1 && e.t + Number(e['dur'] ?? 0) <= h.cut).pop();
    expect(closing, 'màn đen trước điểm cắt').toBeTruthy();
    const opening = blacks.find((e) => e['to'] === 0 && e.t > closing!.t);
    expect(opening!.t).toBeGreaterThanOrEqual(h.live);
    // trao quyền trong shot cảnh ngã (người chơi được kéo dậy)
    expect(new CameraTrack(d).shotAt(h.t).id).toBe('s8_nga');
    const L = vi as Record<string, string>;
    expect(L[h.title]).toBeTruthy();
    expect(L[h.sub]).toBeTruthy();
    expect(h.holdAt.length).toBe(2);
  });
  it('bản đầy đủ chứa mọi shot của bản 60 s (không bỏ cảnh nào) và dài hơn', () => {
    const full = new Set((intro as unknown as CinematicDef).shots.map((s) => s.id));
    for (const s of (intro60 as unknown as CinematicDef).shots) if (s.id !== 's9_tua') expect(full.has(s.id), s.id).toBe(true);
    expect((intro as unknown as CinematicDef).duration).toBeGreaterThan((intro60 as unknown as CinematicDef).duration);
  });
});
