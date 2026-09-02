import { describe, it, expect, beforeAll } from 'vitest';
import { WeaponStateMachine, type WeaponState } from '@game/weapons/stateMachine';
import { RecoilTracker } from '@game/weapons/recoil';
import { resolveShot, applySpread, type HitResult } from '@game/weapons/hitscan';
import { Weapon, getWeaponDef, type WeaponEvents } from '@game/weapons/weapon';
import { initPhysics, PhysicsWorld } from '@engine/physics/world';
import { attachActorBody } from '@game/actors/actorPhysics';
import { EventBus, mulberry32, Pool } from '@engine/core';
import { emptySnapshot } from '@engine/input/input';

const def = getWeaponDef('ar_v1');
const smSpec = { rpm: def.rpm, magSize: def.magSize, reserve: def.reserve, reloadMs: def.reloadMs, adsMs: def.adsMs, swapMs: def.swapMs, maxStateMs: def.maxStateMs };
const VALID: WeaponState[] = ['IDLE', 'FIRING', 'RELOADING', 'EMPTY', 'SWAPPING'];

beforeAll(async () => {
  await initPhysics();
});

describe('TIP-006 WeaponStateMachine (WPN-001)', () => {
  it('spam 1000 input ngẫu nhiên (seeded), tick 1 ms → state hợp lệ, không kẹt quá maxDurationMs, ammo trong biên', () => {
    const sm = new WeaponStateMachine(smSpec);
    const p = mulberry32(11);
    let maxStateMs = 0;
    for (let i = 0; i < 1000; i++) {
      const r = p.next();
      if (r < 0.3) sm.pressFire();
      else if (r < 0.5) sm.releaseFire();
      else if (r < 0.65) sm.pressReload();
      else if (r < 0.8) sm.setAds(true);
      else if (r < 0.9) sm.setAds(false);
      else sm.startSwap();
      for (let k = 0; k < 5; k++) sm.tick(1);
      expect(VALID).toContain(sm.state);
      expect(sm.mag).toBeGreaterThanOrEqual(0);
      expect(sm.mag).toBeLessThanOrEqual(def.magSize);
      expect(sm.reserve).toBeGreaterThanOrEqual(0);
      if (sm.state !== 'IDLE' && sm.state !== 'EMPTY') maxStateMs = Math.max(maxStateMs, sm.stateMs);
    }
    expect(maxStateMs).toBeLessThanOrEqual(Math.max(def.maxStateMs.RELOADING, def.maxStateMs.SWAPPING, def.maxStateMs.FIRING) + 5);
    expect(sm.fallbacks).toBe(0);
  });

  it('giữ fire: 30 viên → EMPTY (≈2.5 s) → auto reload → sau 1900 ms mag 30, reserve 90', () => {
    const sm = new WeaponStateMachine(smSpec);
    let shotsAtEmpty = -1;
    let msAtEmpty = -1;
    let reloadEnd: { mag: number; reserve: number; ms: number } | null = null;
    let ms = 0;
    sm.events.onStateChange = (_f, t) => {
      if (t === 'EMPTY' && shotsAtEmpty < 0) {
        shotsAtEmpty = sm.totalShots;
        msAtEmpty = ms;
      }
    };
    sm.events.onReloadEnd = () => {
      if (!reloadEnd) reloadEnd = { mag: sm.mag, reserve: sm.reserve, ms };
    };
    sm.pressFire();
    for (; ms < 5000; ms += 1000 / 60) sm.tick(1000 / 60);
    expect(shotsAtEmpty).toBe(30);
    expect(msAtEmpty).toBeGreaterThan(2300);
    expect(msAtEmpty).toBeLessThan(2700);
    expect(reloadEnd).not.toBeNull();
    expect(reloadEnd!.mag).toBe(30);
    expect(reloadEnd!.reserve).toBe(90);
    expect(reloadEnd!.ms - msAtEmpty).toBeGreaterThanOrEqual(def.reloadMs - 20);
    // vẫn giữ cò sau reload → tiếp tục bắn; ammo bảo toàn
    expect(sm.mag + sm.reserve + sm.totalShots).toBe(def.magSize + def.reserve);
  });

  it('EMPTY không có reserve → giữ EMPTY, không fallback lạ', () => {
    const sm = new WeaponStateMachine({ ...smSpec, reserve: 0 });
    sm.pressFire();
    for (let ms = 0; ms < 4000; ms += 16) sm.tick(16);
    expect(sm.state).toBe('EMPTY');
    expect(sm.totalShots).toBe(30);
  });

  it('ADS lerp 0→1 trong adsMs, độc lập với state', () => {
    const sm = new WeaponStateMachine(smSpec);
    sm.setAds(true);
    sm.tick(90);
    expect(sm.ads).toBeCloseTo(0.5, 2);
    sm.tick(90);
    expect(sm.ads).toBe(1);
    sm.pressReload();
    sm.tick(10);
    expect(sm.state).toBe('IDLE'); // mag đầy → reload bị bỏ
  });
});

describe('TIP-006 RecoilTracker (WPN-003)', () => {
  it('seed 1: chuỗi kick giống nhau ở 2 lần chạy; tổng pitch ≤ 8°; reset shotIndex sau 250 ms', () => {
    const run = (): number[] => {
      const r = new RecoilTracker(def, mulberry32(1));
      const out: [number, number] = [0, 0];
      const seq: number[] = [];
      for (let i = 0; i < 10; i++) {
        r.kick(out);
        seq.push(out[0], out[1]);
        r.recover(1 / 60);
      }
      return seq;
    };
    expect(run()).toEqual(run());
    const r = new RecoilTracker(def, mulberry32(1));
    const out: [number, number] = [0, 0];
    for (let i = 0; i < 40; i++) r.kick(out);
    expect(r.pitch).toBeLessThanOrEqual((def.maxPitchDeg * Math.PI) / 180 + 1e-9);
    expect(r.shotIndex).toBe(40);
    for (let i = 0; i < 16; i++) r.recover(1 / 60); // 267 ms
    expect(r.shotIndex).toBe(0);
  });
});

describe('TIP-006 Hitscan (WPN-002)', () => {
  function arenaWorld(): { w: PhysicsWorld; body: ReturnType<typeof attachActorBody> } {
    const w = new PhysicsWorld();
    w.addStatic({ kind: 'box', position: [0, -0.5, 0], size: [40, 0.5, 40], yaw: 0 }, { id: 'floor', kind: 'world', material: 'concrete' });
    const body = attachActorBody(w, 'target', [0, 0, -10]);
    w.step();
    return { w, body };
  }

  it('ADS 0.25° nhắm đầu ở 10 m → ≥ 95/100 trúng head; hip moving 3.2° → < 60', () => {
    const { w } = arenaWorld();
    const results: HitResult[] = [];
    const headY = 1.62;
    const origin: [number, number, number] = [0, headY, 0];
    const aim: [number, number, number] = [0, 0, -1];
    const count = (spread: number, seed: number): number => {
      const p = mulberry32(seed);
      let heads = 0;
      for (let i = 0; i < 100; i++) {
        resolveShot(w, origin, aim, spread, def, p, undefined, results);
        if (results[0]?.kind === 'actor' && results[0].zone === 'head') heads++;
      }
      return heads;
    };
    expect(count(def.spread.ads, 5)).toBeGreaterThanOrEqual(95);
    expect(count(def.spread.hipMove, 5)).toBeLessThan(60);
  });

  it('damage zones: head 60, body 24; miss → world/concrete', () => {
    const { w } = arenaWorld();
    const results: HitResult[] = [];
    resolveShot(w, [0, 1.62, 0], [0, 0, -1], 0, def, mulberry32(1), undefined, results);
    expect(results[0]!.zone).toBe('head');
    expect(results[0]!.damage).toBe(60);
    resolveShot(w, [0, 1.0, 0], [0, 0, -1], 0, def, mulberry32(1), undefined, results);
    expect(results[0]!.zone).toBe('body');
    expect(results[0]!.damage).toBe(24);
    resolveShot(w, [5, 1.0, 0], [0, -0.3, -1], 0, def, mulberry32(1), undefined, results);
    expect(results[0]!.kind).toBe('world');
    expect(results[0]!.material).toBe('concrete');
  });

  it('penetration: tấm gỗ 0.2 m xuyên (damage ×0.6), thép không xuyên', () => {
    const w = new PhysicsWorld();
    w.addStatic({ kind: 'box', position: [0, 1, -5], size: [2, 2, 0.1], yaw: 0 }, { id: 'wood', kind: 'world', material: 'wood' });
    attachActorBody(w, 'target', [0, 0, -10]);
    w.step();
    const results: HitResult[] = [];
    resolveShot(w, [0, 1.0, 0], [0, 0, -1], 0, def, mulberry32(1), undefined, results);
    expect(results.length).toBe(2);
    expect(results[0]!.material).toBe('wood');
    expect(results[1]!.kind).toBe('actor');
    expect(results[1]!.penetrated).toBe(true);
    expect(results[1]!.damage).toBeCloseTo(24 * 0.6, 6);

    const w2 = new PhysicsWorld();
    w2.addStatic({ kind: 'box', position: [0, 1, -5], size: [2, 2, 0.1], yaw: 0 }, { id: 'steel', kind: 'world', material: 'steel' });
    attachActorBody(w2, 'target', [0, 0, -10]);
    w2.step();
    resolveShot(w2, [0, 1.0, 0], [0, 0, -1], 0, def, mulberry32(1), undefined, results);
    expect(results.length).toBe(1);
    expect(results[0]!.material).toBe('steel');
  });

  it('applySpread deterministic và giữ đơn vị', () => {
    const out: [number, number, number] = [0, 0, 0];
    const a = applySpread([0, 0, -1], 2, mulberry32(3), out).slice();
    const b = applySpread([0, 0, -1], 2, mulberry32(3), out).slice();
    expect(a).toEqual(b);
    expect(Math.hypot(a[0]!, a[1]!, a[2]!)).toBeCloseTo(1, 9);
    expect(-a[2]!).toBeGreaterThan(Math.cos((2 * Math.PI) / 180) - 1e-9);
  });
});

describe('TIP-006 Weapon + pools (WPN-004)', () => {
  it('5 phút bắn liên tục (18 000 tick): event ring cố định, ammo bảo toàn, factory pool không tăng', () => {
    const w = new PhysicsWorld();
    w.addStatic({ kind: 'box', position: [0, -0.5, 0], size: [40, 0.5, 40], yaw: 0 }, { id: 'floor', kind: 'world', material: 'concrete' });
    w.addStatic({ kind: 'box', position: [0, 2, -20], size: [10, 2, 0.5], yaw: 0 }, { id: 'wall', kind: 'world', material: 'concrete' });
    w.step();
    const events = new EventBus<WeaponEvents>(512);
    const weapon = new Weapon('ar_v1', w, events, mulberry32(7));
    let kicks = 0;
    weapon.onViewKick = () => kicks++;
    let impacts = 0;
    events.on('IMPACT', () => impacts++);
    let fired = 0;
    events.on('WEAPON_FIRED', () => fired++);
    // pool decal giả lập với Pool core để kiểm created cố định
    let created = 0;
    const decals = new Pool(() => { created++; return { alive: false }; }, (d) => { d.alive = false; }, 256);
    events.on('IMPACT', () => { const d = decals.acquire(); if (!d) { decals.releaseAll(); decals.acquire(); } });
    const input = emptySnapshot();
    input.fire = true;
    const ctx = { origin: [0, 1.6, 0] as [number, number, number], aim: [0, 0, -1] as [number, number, number], stance: 'stand' as const, moving: false, grounded: true, exclude: undefined };
    for (let t = 0; t < 18000; t++) {
      // reload thủ công khi hết dự trữ → reset để tiếp tục bắn (mô phỏng nhặt đạn)
      if (weapon.sm.reserve === 0 && weapon.sm.mag === 0) weapon.restore({ mag: 30, reserve: 120 });
      weapon.step(input, ctx, 1 / 60);
      w.step();
    }
    expect(fired).toBeGreaterThan(1000);
    expect(impacts).toBe(fired);
    expect(kicks).toBe(fired);
    expect(events.size).toBe(512);
    expect(created).toBe(256);
    expect(decals.stats.created).toBe(256);
  });

  it('cùng seed → cùng chuỗi hướng bắn (WEAPON_FIRED.dir)', () => {
    const run = (): number[] => {
      const w = new PhysicsWorld();
      w.addStatic({ kind: 'box', position: [0, 2, -20], size: [10, 2, 0.5], yaw: 0 }, { id: 'wall', kind: 'world', material: 'concrete' });
      w.step();
      const events = new EventBus<WeaponEvents>(64);
      const weapon = new Weapon('ar_v1', w, events, mulberry32(21));
      const dirs: number[] = [];
      events.on('WEAPON_FIRED', (e) => dirs.push(e.dir[0], e.dir[1]));
      const input = emptySnapshot();
      input.fire = true;
      const ctx = { origin: [0, 1.6, 0] as [number, number, number], aim: [0, 0, -1] as [number, number, number], stance: 'stand' as const, moving: true, grounded: true, exclude: undefined };
      for (let t = 0; t < 120; t++) {
        weapon.step(input, ctx, 1 / 60);
        w.step();
      }
      return dirs;
    };
    const a = run();
    expect(a.length).toBeGreaterThan(10);
    expect(run()).toEqual(a);
  });
});
