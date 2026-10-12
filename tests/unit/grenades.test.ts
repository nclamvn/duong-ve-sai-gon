/**
 * DV-074 lựu đạn: đạn đạo + nảy + nổ theo fuse; lời giải ném; AI ném vào mục tiêu nằm im, AI chạy khỏi vùng nổ.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initNav } from '@engine/nav/navmesh';
import { initPhysics } from '@engine/physics/world';
import { GrenadeSystem, solveLob, GRENADE, type Grenade } from '@game/weapons/grenades';
import { Bot, type GrenadeLink, type GrenadeDanger } from '@game/ai/bot';
import { EventBus, mulberry32 } from '@engine/core';
import { makeForest, AiHarness, type ForestWorld } from './aiWorld';

type V3 = [number, number, number];

let w: ForestWorld;
beforeAll(async () => {
  await initPhysics();
  await initNav();
  w = makeForest();
});

/** bay tự do (không va chạm) tới khi rơi qua độ cao `y` lúc đang xuống */
function landing(from: V3, v: V3, y: number): V3 {
  const p: V3 = [...from];
  const vel: V3 = [...v];
  const dt = 1 / 240;
  for (let i = 0; i < 240 * 10; i++) {
    vel[1] += GRENADE.gravity * dt;
    p[0] += vel[0] * dt;
    p[1] += vel[1] * dt;
    p[2] += vel[2] * dt;
    if (vel[1] < 0 && p[1] <= y) return p;
  }
  return p;
}

describe('DV-074 solveLob', () => {
  it('rơi đúng điểm (± 0,4 m) ở 8–30 m, cao/thấp hơn chỗ ném', () => {
    for (const d of [8, 15, 22, 30]) {
      for (const h of [-3, 0, 2]) {
        const from: V3 = [0, 1.7, 0];
        const to: V3 = [d * 0.6, h, -d * 0.8];
        const v = solveLob(from, to, 40, 22);
        expect(Math.hypot(v[0], v[1], v[2])).toBeLessThanOrEqual(22 + 1e-6);
        const p = landing(from, v, h);
        expect(Math.hypot(p[0] - to[0], p[2] - to[2])).toBeLessThan(0.4);
      }
    }
  });

  it('quá tầm: ném xa nhất theo hướng đó, không NaN', () => {
    const v = solveLob([0, 1.7, 0], [0, 0, -200], 40, 22);
    expect(v.every((x) => Number.isFinite(x))).toBe(true);
    expect(v[2]).toBeLessThan(0);
  });
});

describe('DV-074 GrenadeSystem', () => {
  it('ném trên sàn: chạm đất, nảy, nằm yên, không xuyên đất; nổ đúng fuse, một lần', () => {
    const blasts: Grenade[] = [];
    const sys = new GrenadeSystem({ physics: w.physics, explode: (g) => blasts.push(g) });
    // khoảng trống quanh (0, -40): ném dọc trục x
    const g = sys.spawn([0, 1.6, -40], [6, 4, 0], 'player', 'player')!;
    expect(g).not.toBeNull();
    let minY = Infinity;
    let ticks = 0;
    while (blasts.length === 0 && ticks < 600) {
      sys.tick(1 / 60);
      if (sys.live().length) minY = Math.min(minY, sys.live()[0]!.pos[1]);
      ticks++;
    }
    expect(blasts.length).toBe(1);
    expect(Math.abs(ticks - GRENADE.fuseMs / (1000 / 60))).toBeLessThanOrEqual(1.01);
    expect(minY).toBeGreaterThan(-0.05);
    expect(g.landed).toBe(true);
    expect(g.bounces).toBeGreaterThan(1);
    expect(g.resting).toBe(true);
    expect(g.pos[0]).toBeGreaterThan(3);
    expect(g.pos[0]).toBeLessThan(14);
    expect(sys.live().length).toBe(0);
  });

  it('ném vào thân cây: dội lại, không xuyên qua', () => {
    const t = w.trees.find((tr) => Math.abs(tr.z) < 30 && Math.abs(tr.x) < 30)!;
    const blasts: Grenade[] = [];
    const sys = new GrenadeSystem({ physics: w.physics, explode: (g) => blasts.push(g) });
    const g = sys.spawn([t.x - 3, 1.5, t.z], [12, 0.5, 0], 'player', 'player')!;
    for (let i = 0; i < 240; i++) sys.tick(1 / 60);
    expect(g.pos[0]).toBeLessThan(t.x - t.r + 0.05);
  });

  it('giới hạn số quả đang bay (maxLive)', () => {
    const sys = new GrenadeSystem({ physics: w.physics, explode: () => undefined });
    for (let i = 0; i < GRENADE.maxLive; i++) expect(sys.spawn([0, 2, -40], [0, 0, 0], 'player', 'player')).not.toBeNull();
    expect(sys.spawn([0, 2, -40], [0, 0, 0], 'player', 'player')).toBeNull();
    sys.clear();
    expect(sys.live().length).toBe(0);
  });
});

/** link giả: ghi lại lần ném, lựu đạn thật bay trong GrenadeSystem */
function makeLink(sys: GrenadeSystem, cooldownMs: number, clock: { ms: number }): { link: GrenadeLink; throws: Array<{ bot: string; from: V3; to: V3 }> } {
  const throws: Array<{ bot: string; from: V3; to: V3 }> = [];
  let last = -1e9;
  return {
    throws,
    link: {
      canThrow: () => clock.ms - last >= cooldownMs && sys.live().length === 0,
      throwAt: (bot, from, to) => {
        const g = sys.spawn(from, solveLob(from, to, GRENADE.ai.lobDeg, GRENADE.ai.maxSpeed), bot.id, 'enemy');
        if (!g) return false;
        last = clock.ms;
        throws.push({ bot: bot.id, from, to });
        return true;
      },
      dangers: () => sys.live(),
    },
  };
}

describe('DV-074 AI lựu đạn', () => {
  it('địch ném vào người chơi đứng yên (12–30 m), rơi gần người chơi, mỗi người tối đa perBot quả', () => {
    const clock = { ms: 0 };
    const sys = new GrenadeSystem({ physics: w.physics, explode: () => undefined });
    const { link, throws } = makeLink(sys, 6000, clock);
    const h = new AiHarness(w, { seed: 3, enemies: 4, grenades: link, hitChance: 0.05 });
    for (let i = 0; i < 90 * 60 && throws.length < 2; i++) {
      h.step();
      sys.tick(1 / 60);
      clock.ms += 1000 / 60;
    }
    h.dispose();
    expect(throws.length).toBeGreaterThanOrEqual(1);
    for (const t of throws) {
      const d = Math.hypot(t.from[0] - h.player[0], t.from[2] - h.player[2]);
      expect(d).toBeGreaterThanOrEqual(GRENADE.ai.minRange - 1);
      expect(d).toBeLessThanOrEqual(GRENADE.ai.maxRange + 1);
      expect(Math.hypot(t.to[0] - h.player[0], t.to[2] - h.player[2])).toBeLessThan(9);
    }
    // mỗi người tối đa perBot quả
    const per = new Map<string, number>();
    for (const t of throws) per.set(t.bot, (per.get(t.bot) ?? 0) + 1);
    for (const n of per.values()) expect(n).toBeLessThanOrEqual(GRENADE.ai.perBot);
  });

  it('bot chạy khỏi lựu đạn rơi cạnh (ra ngoài bán kính trước khi nổ), rồi đánh tiếp', () => {
    const live: GrenadeDanger[] = [];
    const link: GrenadeLink = { canThrow: () => false, throwAt: () => false, dangers: () => live };
    const h = new AiHarness(w, { seed: 5, enemies: 2, grenades: link, hitChance: 0 });
    h.run(8); // vào chiến đấu
    const b = h.bots[0]!;
    const g = { pos: [b.position[0] + 1.5, b.position[1] + 0.05, b.position[2]] as V3, vel: [0, 0, 0] as V3, fuseMs: 2600, landed: true };
    live.push(g);
    let left = Infinity;
    let sawRetreat = false;
    const n = Math.ceil((g.fuseMs / 1000) * 60);
    for (let i = 0; i < n; i++) {
      h.step();
      g.fuseMs -= 1000 / 60;
      if (b.state === 'RETREAT') sawRetreat = true;
      left = Math.hypot(b.position[0] - g.pos[0], b.position[2] - g.pos[2]);
    }
    live.length = 0;
    expect(b.stats.grenadeEvades).toBeGreaterThanOrEqual(1);
    expect(sawRetreat).toBe(true);
    expect(left).toBeGreaterThan(GRENADE.radius * 0.8);
    h.run(2);
    expect(b.state).not.toBe('RETREAT');
    h.dispose();
  });

  it('đồng đội không mang lựu đạn (factions)', () => {
    const b = new Bot('f0', [0, 0, 0], {
      physics: w.physics, nav: w.nav, events: new EventBus(64), prng: mulberry32(1), waypoints: w.waypoints, coverMarkers: [],
      target: () => ({ pos: [0, 0, 0], eye: [0, 1.6, 0], alive: false }), camera: () => ({ pos: [0, 1.6, 0], fwd: [0, 0, -1] }), exclude: () => undefined, faction: 'friend',
    });
    expect(b.grenades).toBe(0);
    const e = new Bot('e0', [0, 0, 0], {
      physics: w.physics, nav: w.nav, events: new EventBus(64), prng: mulberry32(1), waypoints: w.waypoints, coverMarkers: [],
      target: () => ({ pos: [0, 0, 0], eye: [0, 1.6, 0], alive: false }), camera: () => ({ pos: [0, 1.6, 0], fwd: [0, 0, -1] }), exclude: () => undefined,
    });
    expect(e.grenades).toBe(GRENADE.ai.perBot);
    b.dispose();
    e.dispose();
  });
});
