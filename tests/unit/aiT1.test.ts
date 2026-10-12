/**
 * AI-T1 (DV-071): chỗ nấp tự sinh, chấm vị trí theo vai, hành vi chiến đấu mới, tổ chiến đấu, vé tấn công, bộ đo AI.
 * Ngưỡng bộ đo = Blueprint AI-T1 §2.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initNav } from '@engine/nav/navmesh';
import { initPhysics } from '@engine/physics/world';
import { CoverField } from '@game/ai/coverField';
import { roleBand } from '@game/ai/tactics';
import ai from '@content/tuning/ai.json';
import { makeForest, AiHarness, type ForestWorld } from './aiWorld';

type V3 = [number, number, number];

let w: ForestWorld;
beforeAll(async () => {
  await initPhysics();
  await initNav();
  w = makeForest();
});

describe('T1.1 CoverField', () => {
  it('thân cây: điểm nấp nằm SAU thân so với mối đe doạ, cách mép đúng khoảng lùi', () => {
    const f = new CoverField({ los: () => true, ground: () => 0 });
    f.addTree(10, 10, 0.4, 0.5);
    const out: ReturnType<CoverField['candidates']> = [];
    const threat: V3 = [10, 0, 40];
    f.candidates(10, 5, 12, threat, out, { ring: false });
    expect(out.length).toBe(1);
    const c = out[0]!;
    expect(c.kind).toBe('tree');
    expect(c.z).toBeLessThan(10); // phía xa mối đe doạ
    expect(Math.hypot(c.x - 10, c.z - 10)).toBeCloseTo(0.9, 5);
    // đổi hướng mối đe doạ → điểm đổi theo
    f.candidates(10, 5, 12, [40, 0, 10], out, { ring: false });
    expect(out[0]!.x).toBeLessThan(10);
  });

  it('hố bom: sườn trong phía mối đe doạ + lòng hố; marker; vòng mẫu 2 × 8', () => {
    const f = new CoverField({ los: () => true, ground: () => 0 });
    f.addCrater(0, 0, 4);
    f.addMarker(3, 0, 3);
    const out: ReturnType<CoverField['candidates']> = [];
    f.candidates(0, 0, 10, [0, 0, 30], out);
    const crater = out.filter((c) => c.kind === 'crater');
    expect(crater.length).toBe(2);
    expect(crater[0]!.z).toBeCloseTo(2, 5); // 0,5 r về phía mối đe doạ
    expect(out.filter((c) => c.kind === 'marker').length).toBe(1);
    expect(out.filter((c) => c.kind === 'ring').length).toBe(16);
  });

  it('kiểm che bằng tia: sau tảng đá = full, sau khúc gỗ = low (đứng lên bắn được), chỗ trống = none', () => {
    const field = w.tactics.field;
    const eye: V3 = [16, 1.6, 40]; // mối đe doạ phía +z
    expect(field.probe(16, 0, 12 - 1.4 - 0.6, eye)).toBe('full'); // tảng đá (16, 12) cao 2,6 m
    expect(field.probe(9, 0, -4 - 0.35 - 0.5, [9, 1.6, 30])).toBe('low'); // khúc gỗ (9, −4) cao 1,2 m
    expect(field.probe(0, 0, 38, [0, 1.6, 45])).toBe('none');
    // điểm ló ngang của tảng đá rộng 2,8 m: có góc bắn
    const out: V3 = [0, 0, 0];
    expect(field.peekPoint(16, 0, 10, eye, out)).not.toBe(0);
    expect(Math.abs(out[0] - 16)).toBeGreaterThan(1.3);
  });

  it('rừng thử: mỗi cây hợp lệ sinh một điểm nấp đi được', () => {
    const out: ReturnType<CoverField['candidates']> = [];
    w.tactics.field.candidates(0, 0, 20, [0, 0, 40], out, { ring: false });
    expect(out.length).toBeGreaterThan(8);
    for (const c of out) expect(w.nav.nearest({ x: c.x, y: c.y, z: c.z })).not.toBeNull();
  });
});

describe('T1.2 Tactics theo vai', () => {
  const threat: V3 = [0, 0, 6];
  const threatEye: V3 = [0, 1.6, 6];

  it('assault: tiến gần ≥ 3 m tới chỗ có che; support: trong dải tầm và bắn được', () => {
    const self: V3 = [0, 0, -30];
    const a = w.tactics.pick({ self, threat, threatEye, role: 'assault', needCover: true })!;
    expect(a).not.toBeNull();
    expect(a.quality).not.toBe('none');
    const d0 = Math.hypot(self[0] - threat[0], self[2] - threat[2]);
    const d1 = Math.hypot(a.pos[0] - threat[0], a.pos[2] - threat[2]);
    expect(d0 - d1).toBeGreaterThanOrEqual(3);
    const s = w.tactics.pick({ self, threat, threatEye, role: 'support', needCover: true })!;
    expect(s).not.toBeNull();
    const ds = Math.hypot(s.pos[0] - threat[0], s.pos[2] - threat[2]);
    const [lo, hi] = roleBand('support');
    expect(ds).toBeGreaterThanOrEqual(lo);
    expect(ds).toBeLessThanOrEqual(hi + 2);
    expect(s.canFire).toBe(true);
  });

  it('giữ chỗ: khoá đã có người thì không chọn lại; giãn cách ≥ 4 m với đồng đội', () => {
    const self: V3 = [0, 0, -30];
    const a = w.tactics.pick({ self, threat, threatEye, role: 'assault', needCover: true })!;
    const b = w.tactics.pick({ self, threat, threatEye, role: 'assault', needCover: true, reserved: new Set([a.key]), allies: [a.pos] })!;
    expect(b.key).not.toBe(a.key);
    expect(Math.hypot(b.pos[0] - a.pos[0], b.pos[2] - a.pos[2])).toBeGreaterThanOrEqual(ai.tactics.spacing - 0.5);
  });

  it('flank: lệch góc quanh mục tiêu so với nhóm yểm trợ (một lần lao ≥ 25°)', () => {
    const self: V3 = [0, 0, -24];
    const support: V3[] = [[2, 0, -26]];
    const f = w.tactics.pick({ self, threat, threatEye, role: 'flank', support, needCover: true, maxMove: ai.tactics.flankMaxMove })!;
    expect(f).not.toBeNull();
    const ang = (p: readonly number[]): number => Math.atan2(p[2]! - threat[2], p[0]! - threat[0]);
    let d = Math.abs(ang(f.pos) - ang(support[0]!));
    if (d > Math.PI) d = Math.PI * 2 - d;
    expect((d * 180) / Math.PI).toBeGreaterThanOrEqual(25);
  });

  it('escort: trong bán kính quanh người chơi và không đứng chắn hướng bắn', () => {
    const anchor: V3 = [0, 0, 20];
    const fwd: [number, number] = [0, -1]; // người chơi nhìn −z, địch ở z = −10
    const p = w.tactics.pick({ self: [3, 0, 24], threat: [0, 0, -10], threatEye: [0, 1.6, -10], role: 'escort', anchor, anchorFwd: fwd, anchorRadius: 14 })!;
    expect(p).not.toBeNull();
    expect(Math.hypot(p.pos[0] - anchor[0], p.pos[2] - anchor[2])).toBeLessThanOrEqual(15);
    const vx = p.pos[0] - anchor[0];
    const vz = p.pos[2] - anchor[2];
    const along = vx * fwd[0] + vz * fwd[1];
    const perp = Math.abs(vx * fwd[1] - vz * fwd[0]);
    expect(along > 0 && perp < ai.tactics.escortLaneHalf).toBe(false);
  });
});

describe('T1.3–T1.6 Bộ đo AI (rừng thử, 4 địch vs người chơi bắn trả, 10 seed × 60 s)', () => {
  const runs: Array<Record<string, number>> = [];
  const maxMoversSeen: number[] = [];
  const pinnedFiring: number[] = [];
  beforeAll(() => {
    for (let seed = 1; seed <= 10; seed++) {
      const h = new AiHarness(w, { seed, enemies: 4 });
      let maxMovers = 0;
      let firedWhilePinned = 0;
      h.events.on('BOT_FIRED', (e) => {
        const b = h.bots.find((x) => x.id === e.botId);
        if (b && b.state === 'SUPPRESSED') firedWhilePinned++;
      });
      h.run(60, () => {
        // lao chiến thuật (tự cứu khi bị ghim/trống trải dưới đạn không tính: ai bị bắn cũng phải chạy)
        maxMovers = Math.max(maxMovers, h.bots.filter((b) => b.alive && b.bounding && !b.emergencyBound && b.role !== 'fallback').length);
      });
      runs.push(h.summary());
      maxMoversSeen.push(maxMovers);
      pinnedFiring.push(firedWhilePinned);
      h.dispose();
    }
  });
  const sum = (k: string): number => runs.reduce((a, r) => a + (r[k] ?? 0), 0);

  it('không bắn khi đang lao (ngoài 8 m): 0 phát', () => {
    expect(sum('shotsWhileBounding')).toBe(0);
    expect(sum('shots')).toBeGreaterThan(500);
  });

  it('bị áp chế → nấp hoặc lao vào chỗ che ≥ 70 % thời gian; bị ghim thì không bắn', () => {
    for (const r of runs) expect(r['coveredWhenShaken']!).toBeGreaterThanOrEqual(0.7);
    expect(sum('pins')).toBeGreaterThan(20);
    expect(pinnedFiring.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('lao ngắn: thời gian lộ liên tục khi lao ≤ 4 s', () => {
    for (const r of runs) expect(r['maxBoundExposedMs']!).toBeLessThanOrEqual(4000);
  });

  it('lao xen kẽ: ≥ 1 lần lao có người yểm trợ / 30 s; không quá 1 người lao cùng lúc (tổ 4)', () => {
    for (const r of runs) expect(r['coveredBounds']!).toBeGreaterThanOrEqual(2);
    expect(sum('coveredBounds') / sum('bounds')).toBeGreaterThanOrEqual(0.6);
    for (const m of maxMoversSeen) expect(m).toBeLessThanOrEqual(ai.team.maxMoversSmall);
  });

  it('ép sườn phối hợp: ≥ 60 % lệnh tới góc ≥ 50° so với nhóm yểm trợ', () => {
    expect(sum('flankOrders')).toBeGreaterThanOrEqual(8);
    expect(sum('flankSuccess') / sum('flankOrders')).toBeGreaterThanOrEqual(0.6);
  });

  // DV-083: lùi khi mất ≥ 2/3 quân (trước 50 %: trận kéo dài, địch rút quá sớm)
  it('mất ≥ 2/3 quân → tổ lùi', () => {
    const lost = runs.filter((r) => r['kills']! >= 3);
    expect(lost.length).toBeGreaterThan(0);
    for (const r of lost) expect(r['fallbacks']!).toBe(1);
  });

  it('vé tấn công: ≤ 2 địch bắn "thật" cùng lúc; người không vé hiếm khi trúng', () => {
    for (const r of runs) expect(r['maxHolders']!).toBeLessThanOrEqual(ai.cinematic.tokens);
    expect(sum('playerHits')).toBeGreaterThan(30); // vẫn có áp lực thật
    expect(sum('playerHitsByNonHolder') / sum('playerHits')).toBeLessThan(0.25);
  });

  it('tất định: cùng seed → cùng chỉ số', () => {
    const again = new AiHarness(w, { seed: 3, enemies: 4 });
    again.run(60);
    expect(JSON.stringify(again.summary())).toBe(JSON.stringify(runs[2]));
    again.dispose();
  });
});

describe('T1.5 Tổ ta: lệnh + báo hướng', async () => {
  const { Squadmates, clockOf } = await import('@game/ai/squadmates');
  type Actor = ConstructorParameters<typeof Object>[0];
  const mkActor = (id: string, name: string, pos: V3): Actor => ({ id, nameKey: `name.${name}`, bot: { alive: true, position: pos, alertTo: (p: V3) => alerted.push([id, p]) } });
  const alerted: Array<[string, V3]> = [];
  const said: Array<{ cue: string; speaker: string; vars?: Record<string, string | number> }> = [];
  let now = 0;
  const make = (): InstanceType<typeof Squadmates> => {
    const s = new Squadmates({
      player: () => ({ feet: [0, 0, 0], fwdX: 0, fwdZ: -1, speed: 1 }),
      objective: () => [0, 0, -100],
      say: (cue, speaker, vars) => {
        said.push({ cue, speaker, vars });
        return true;
      },
      now: () => now,
    });
    s.add(mkActor('q', 'quyet', [0, 0, -6]) as never, 'leader');
    for (const [i, n] of ['long', 'dat', 'hoan', 'khang'].entries()) s.add(mkActor(n, n, [i - 2, 0, 4 + i]) as never, 'follower');
    return s;
  };

  it('giờ đồng hồ theo hướng nhìn: trước 12, phải 3, sau 6, trái 9', () => {
    expect(clockOf(0, -1, 0, -10)).toBe(12);
    expect(clockOf(0, -1, 10, 0)).toBe(3);
    expect(clockOf(0, -1, 0, 10)).toBe(6);
    expect(clockOf(0, -1, -10, 0)).toBe(9);
    expect(clockOf(0, -1, 10, -17)).toBe(1);
  });

  it('báo hướng: "{h} giờ, {d} mét" làm tròn 5 m; chống lặp 12 s, địch mới xa > 15 m thì 6 s', () => {
    said.length = 0;
    now = 10;
    const s = make();
    expect(s.callout('long', [20, 0, 0])).toBe(true);
    expect(said.at(-1)!.vars).toEqual({ h: 3, d: 20 });
    expect(said.at(-1)!.speaker).toBe('LONG');
    now = 12;
    expect(s.callout('dat', [21, 0, 1])).toBe(false);
    now = 17;
    expect(s.callout('dat', [-30, 0, -30])).toBe(true); // địch mới, cách > 15 m
    expect(said.at(-1)!.vars).toEqual({ h: 11, d: 40 });
  });

  it('lệnh: giữ = điểm người chơi đứng, yểm trợ = báo động cả tổ về điểm nhắm rồi tự hết giờ, đội hình 5 người', () => {
    now = 100;
    alerted.length = 0;
    const s = make();
    expect(s.count).toBe(5);
    s.command('hold');
    expect(s.order).toBe('hold');
    expect(s.orderPoint).toEqual([0, 0, 0]);
    const e = s.escortFor('hoan')()!;
    expect(e.mode).toBe('hold');
    s.command('suppress', [5, 0, -30]);
    expect(alerted.length).toBe(5);
    expect(s.escortFor('long')()!.aimPoint).toEqual([5, 0, -30]);
    now = 100 + s.suppressMs / 1000 + 0.1;
    s.tick();
    expect(s.order).toBe('follow');
    s.command('advance', [0, 0, -40]);
    const g = s.goalFor('khang')()!;
    expect(Math.hypot(g.x, g.z + 40)).toBeLessThanOrEqual(3.01);
    // đội hình rắn: 4 người theo xếp 2 hàng sau người chơi
    s.command('follow');
    const goals = ['long', 'dat', 'hoan', 'khang'].map((id) => s.goalFor(id)()!);
    const zs = goals.map((q) => q.z).sort((a, b) => a - b);
    expect(zs[0]).toBeGreaterThanOrEqual(2.9);
    expect(zs[3]).toBeGreaterThan(zs[0]! + 2);
  });
});

describe('DV-071 lỗi tự bắn trúng đầu mình', () => {
  it('bot có collider đầu + thân (như trong game) bắn trúng mục tiêu ACTOR 15 m, không bao giờ HIT chính mình', async () => {
    const { attachActorBody } = await import('@game/actors/actorPhysics');
    const { Bot } = await import('@game/ai/bot');
    const { EventBus, mulberry32 } = await import('@engine/core');
    const { LAYER } = await import('@engine/physics/layers');
    const events = new EventBus<import('@game/ai/bot').BotEvents>(512);
    const self: V3 = [0, 0, 30];
    const tgt: V3 = [0, 0, 45];
    const myBody = attachActorBody(w.physics, 'shooter', self);
    const tBody = attachActorBody(w.physics, 'target', tgt);
    myBody.setPosition(...self);
    tBody.setPosition(...tgt);
    w.physics.step();
    const bot = new Bot('shooter', self, {
      physics: w.physics, nav: w.nav, events, prng: mulberry32(5), waypoints: w.waypoints, coverMarkers: [], tactics: w.tactics,
      faction: 'friend', hitMask: LAYER.WORLD | LAYER.ACTOR,
      target: () => ({ pos: tgt, eye: [tgt[0], 1.6, tgt[2]], alive: true }),
      camera: () => ({ pos: [0, 1.6, 30], fwd: [0, 0, 1] }),
      exclude: () => myBody.bodyCollider,
    });
    bot.yaw = Math.PI; // nhìn +z
    let selfHits = 0;
    let targetHits = 0;
    events.on('HIT', (e) => {
      if (e.actorId === 'shooter') selfHits++;
      if (e.actorId === 'target') targetHits++;
    });
    for (let t = 0; t < 60 * 8; t++) {
      if (t % 6 === 0) bot.think(0.1);
      bot.move(1 / 60);
      myBody.setPosition(bot.position[0], bot.position[1], bot.position[2]);
      w.physics.step();
    }
    expect(bot.stats.shots).toBeGreaterThan(5);
    expect(selfHits).toBe(0);
    expect(targetHits).toBeGreaterThan(0);
    bot.dispose();
    myBody.dispose();
    tBody.dispose();
    w.physics.step();
  });
});

describe('M1-T2 hành vi nhóm', () => {
  it('nằm phục: đã thấy người chơi ở 29 m (báo động) vẫn im, ≤ 25 m thì khai hoả', async () => {
    const { Bot } = await import('@game/ai/bot');
    const { EventBus, mulberry32 } = await import('@engine/core');
    const events = new EventBus<import('@game/ai/bot').BotEvents>(512);
    const self: V3 = [0, 0, -10];
    const player: V3 = [0, 0, 19];
    const bot = new Bot('amb', self, {
      physics: w.physics, nav: w.nav, events, prng: mulberry32(9), waypoints: [self, [self[0], 0, self[2]]], coverMarkers: [], tactics: w.tactics,
      target: () => ({ pos: player, eye: [player[0], 1.6, player[2]], alive: true, isPlayer: true }),
      camera: () => ({ pos: [0, 1.6, 30], fwd: [0, 0, -1] }),
      exclude: () => undefined,
    });
    bot.yaw = Math.PI;
    bot.ambush = true;
    const run = (s: number): void => {
      for (let t = 0; t < s * 60; t++) {
        if (t % 6 === 0) bot.think(0.1);
        bot.move(1 / 60);
      }
    };
    run(5);
    expect(bot.perception.state).toBe('ALERT');
    expect(bot.stats.shots).toBe(0);
    expect(bot.stance).toBe('crouch');
    player[2] = 8; // 18 m
    run(3);
    expect(bot.ambush).toBe(false);
    expect(bot.stats.shots).toBeGreaterThan(0);
    bot.dispose();
  });

  it('hành quân: Quyết đi tốc độ hành quân về điểm đến, tổ xếp hàng dọc sau Quyết cách 4 m', async () => {
    const { Squadmates } = await import('@game/ai/squadmates');
    const mk = (id: string, pos: V3, yaw = 0) => ({ id, nameKey: `name.${id}`, bot: { alive: true, position: pos, yaw, alertTo: () => {} } });
    const s = new Squadmates({ player: () => ({ feet: [0, 0, 5], fwdX: 0, fwdZ: -1, speed: 1 }), objective: () => [0, 0, -100], say: () => true, now: () => 0 });
    s.add(mk('quyet', [0, 0, 0]) as never, 'leader');
    s.add(mk('long', [3, 0, 3]) as never, 'follower');
    s.add(mk('dat', [-3, 0, 3]) as never, 'follower');
    s.pace = 'march';
    const lg = s.goalFor('quyet')()!;
    expect(lg.run).toBe(false);
    expect(lg.mul! * ai.move.speed).toBeCloseTo(ai.move.marchSpeed, 5);
    expect(lg.z).toBeLessThan(0); // về phía điểm đến (−z)
    const g1 = s.goalFor('long')()!;
    const g2 = s.goalFor('dat')()!;
    expect(g1.x).toBeCloseTo(0, 5);
    expect(g1.z).toBeCloseTo(8, 5); // chỗ 1 sau Quyết dành cho người chơi
    expect(g2.z).toBeCloseTo(12, 5);
  });
});
