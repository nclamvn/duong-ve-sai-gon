import { describe, it, expect } from 'vitest';
import { FixedClock, EventBus, Scheduler, mulberry32, Pool, makeIdFactory } from '@engine/core';

describe('TIP-002 FixedClock', () => {
  it('advance 1.0 s qua 37 dt ngẫu nhiên → 60 step, simTime ≈ 1.0', () => {
    const clock = new FixedClock(60, 12); // maxSubSteps đủ lớn để gap ngẫu nhiên (≤ ~0.15 s) không bị clamp
    const rng = mulberry32(3);
    const cuts: number[] = [];
    for (let i = 0; i < 36; i++) cuts.push(rng.next());
    cuts.sort((a, b) => a - b);
    let prev = 0;
    let steps = 0;
    for (const c of [...cuts, 1]) {
      steps += clock.advance(c - prev).steps;
      prev = c;
    }
    expect(steps).toBe(60);
    expect(Math.abs(clock.simTime - 1.0)).toBeLessThanOrEqual(1 / 60 + 1e-9);
    expect(clock.tick).toBe(60);
  });

  it('dt = 5 s (tab ẩn) → clamp, steps ≤ maxSubSteps, không loop', () => {
    const clock = new FixedClock(60, 5);
    const r = clock.advance(5);
    expect(r.steps).toBeLessThanOrEqual(5);
    expect(clock.clampCount).toBeGreaterThan(0);
    expect(r.alpha).toBeGreaterThanOrEqual(0);
    expect(r.alpha).toBeLessThan(1);
  });

  it('alpha luôn ∈ [0,1) và không allocation (cùng object result)', () => {
    const clock = new FixedClock(60);
    const a = clock.advance(0.01);
    const b = clock.advance(0.02);
    expect(a).toBe(b);
    for (let i = 0; i < 100; i++) {
      const r = clock.advance(0.013);
      expect(r.alpha).toBeGreaterThanOrEqual(0);
      expect(r.alpha).toBeLessThan(1);
    }
  });
});

describe('TIP-002 EventBus', () => {
  it('emit cùng id hai lần → handler chạy 1 lần, duplicates = 1', () => {
    const bus = new EventBus<{ RADIO: { cue: string } }>();
    let runs = 0;
    bus.on('RADIO', () => runs++);
    expect(bus.emit('RADIO', { cue: 'D01' }, { id: 'RADIO_D01' })).toBe(true);
    expect(bus.emit('RADIO', { cue: 'D01' }, { id: 'RADIO_D01' })).toBe(false);
    expect(runs).toBe(1);
    expect(bus.duplicates).toBe(1);
    expect(bus.hasSeen('RADIO_D01')).toBe(true);
  });

  it('ring buffer giữ đúng capacity, recent() mới nhất ở cuối', () => {
    const bus = new EventBus<{ T: number }>(8);
    for (let i = 0; i < 20; i++) bus.emit('T', i);
    expect(bus.size).toBe(8);
    const r = bus.recent();
    expect(r.map((x) => x.payload)).toEqual([12, 13, 14, 15, 16, 17, 18, 19]);
    expect(bus.recent(2).map((x) => x.payload)).toEqual([18, 19]);
  });

  it('reset() xóa seenIds; restoreSeen() phục hồi', () => {
    const bus = new EventBus<{ X: null }>();
    bus.emit('X', null, { id: 'once' });
    bus.reset();
    expect(bus.hasSeen('once')).toBe(false);
    bus.restoreSeen(['once']);
    expect(bus.emit('X', null, { id: 'once' })).toBe(false);
  });
});

describe('TIP-002 Scheduler', () => {
  it('ai10 chạy 10 lần trong 60 tick; sim60 chạy 60 lần', () => {
    const s = new Scheduler();
    let sim = 0;
    let ai = 0;
    s.add('sim60', () => sim++);
    s.add('ai10', () => ai++);
    for (let t = 0; t < 60; t++) s.runSim(t, 1 / 60);
    expect(sim).toBe(60);
    expect(ai).toBe(10);
    expect(s.lastCostMs.sim60).toBeGreaterThanOrEqual(0);
  });

  it('remove task qua unsubscribe', () => {
    const s = new Scheduler();
    let n = 0;
    const off = s.add('render', () => n++);
    s.runRender(0.5, 0.016);
    off();
    s.runRender(0.5, 0.016);
    expect(n).toBe(1);
  });
});

describe('TIP-002 PRNG', () => {
  it('mulberry32(42) deterministic; fork khác stream', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a.next(), a.next(), a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
    const r1 = mulberry32(42).fork('recoil');
    const r2 = mulberry32(42).fork('ai');
    expect(r1.next()).not.toBe(r2.next());
    expect(mulberry32(42).fork('recoil').next()).toBe(mulberry32(42).fork('recoil').next());
  });

  it('range/int trong biên; gaussian có mean ~0', () => {
    const p = mulberry32(9);
    for (let i = 0; i < 1000; i++) {
      const v = p.range(-2, 3);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThan(3);
      const k = p.int(1, 6);
      expect(k).toBeGreaterThanOrEqual(1);
      expect(k).toBeLessThanOrEqual(6);
    }
    let sum = 0;
    for (let i = 0; i < 5000; i++) sum += p.gaussian();
    expect(Math.abs(sum / 5000)).toBeLessThan(0.1);
  });
});

describe('TIP-002 Pool', () => {
  it('capacity 4: acquire lần 5 → null, exhausted 1; release rồi acquire lại được', () => {
    let created = 0;
    const pool = new Pool<{ v: number }>(
      () => {
        created++;
        return { v: 0 };
      },
      (it) => {
        it.v = 0;
      },
      4,
    );
    const got = [pool.acquire(), pool.acquire(), pool.acquire(), pool.acquire()];
    expect(got.every((g) => g !== null)).toBe(true);
    expect(pool.acquire()).toBeNull();
    expect(pool.stats.exhausted).toBe(1);
    expect(pool.stats.inUse).toBe(4);
    got[0]!.v = 7;
    pool.release(got[0]!);
    const again = pool.acquire();
    expect(again).not.toBeNull();
    expect(again!.v).toBe(0);
    expect(created).toBe(4);
    expect(pool.stats.created).toBe(4);
  });

  it('release hai lần không làm hỏng đếm', () => {
    const pool = new Pool<{ v: number }>(() => ({ v: 0 }), () => undefined, 2);
    const a = pool.acquire()!;
    pool.release(a);
    pool.release(a);
    expect(pool.stats.inUse).toBe(0);
    expect(pool.acquire()).not.toBeNull();
    expect(pool.acquire()).not.toBeNull();
    expect(pool.acquire()).toBeNull();
  });
});

describe('TIP-002 ids', () => {
  it('tăng dần, reset được', () => {
    const f = makeIdFactory('bot');
    expect(f.next()).toBe('bot_0');
    expect(f.next()).toBe('bot_1');
    f.reset();
    expect(f.next()).toBe('bot_0');
  });
});
