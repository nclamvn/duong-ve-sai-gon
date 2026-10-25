import { describe, it, expect } from 'vitest';
import { CameraTrack, CueTimeline, type CinematicDef } from '@engine/cinematics/track';
import intro from '@content/cinematics/intro.cine.json';
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
  it('intro.cine.json: 60 s, shot nối liền, sự kiện đã biết, chữ có trong locale, thoại có cue', () => {
    const d = intro as unknown as CinematicDef & { actors: Array<{ keys: Array<{ t: number }> }> };
    expect(d.duration).toBe(60);
    const shots = [...d.shots].sort((a, b) => a.t - b.t);
    for (let i = 1; i < shots.length; i++) expect(shots[i]!.t).toBeCloseTo(shots[i - 1]!.t + shots[i - 1]!.dur, 5);
    expect(shots[shots.length - 1]!.t + shots[shots.length - 1]!.dur).toBeCloseTo(60, 5);
    const L = vi as Record<string, string>;
    const cues = new Set((introDialogue as { cues: Array<{ cueId: string }> }).cues.map((c) => c.cueId));
    for (const e of d.events) {
      expect(KNOWN.has(e.type), e.type).toBe(true);
      if (e.type === 'title') expect(L[e['key'] as string], String(e['key'])).toBeTruthy();
      if (e.type === 'say') {
        expect(L[e['sub'] as string], String(e['sub'])).toBeTruthy();
        if (String(e['cue']).startsWith('C')) expect(cues.has(String(e['cue']))).toBe(true);
      }
    }
    for (const a of d.actors) for (let i = 1; i < a.keys.length; i++) expect(a.keys[i]!.t).toBeGreaterThanOrEqual(a.keys[i - 1]!.t);
  });
});
