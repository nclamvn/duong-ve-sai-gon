/**
 * DV-078 hồi đêm Ngầm Ta Lê: đoàn xe (qua ngầm từng chiếc, kẹt nước → đẩy, cháy giữa ngầm → chắn → đẩy xác, lái xe bị thương →
 * cứu/hy sinh), AC-130 (vòng lượn, dò 40 ly vào xe, bị 12,7 bắn rát → bỏ vòng rồi quay lại, quét minigun ụ súng có báo trước),
 * đại liên 12,7 (nhịp bắn, thay hộp, đạn đạo + bắn đón trúng máy bay) và cân bằng cả đêm với người chơi giả lập.
 */
import { describe, it, expect } from 'vitest';
import { mulberry32 } from '@engine/core';
import { Convoy, RoadPath, type ConvoyEvent } from '@game/night/convoy';
import { Gunship } from '@game/night/gunship';
import { MountedGun } from '@game/night/mountedGun';
import { NightLogic, leadAngles, type NightConfig } from '@game/night/nightLogic';
import { readFileSync } from 'node:fs';
import { distToPolyline, roadClearings, ruleWithClear, type ScatterRule } from '@engine/vegetation/scatter';
import { paintRoads } from '@engine/terrain/level';
import { loadDialogue, loadMission } from '@game/mission/loader';
import nightMission from '@content/missions/ngam-ta-le.mission.json';
import nightDialogue from '@content/missions/ngam-ta-le.dialogue.json';
import viJson from '@content/locale/vi.json';
import nightJson from '@content/tuning/night.json';
import levelJson from '@content/levels/ngam-ta-le.level.json';

const CFG = nightJson as unknown as NightConfig;
const ROAD = (levelJson as unknown as { roads: Array<{ id: string; pts: Array<[number, number]> }> }).roads.find((r) => r.id === CFG.convoy.road)!.pts;
const flat = (): number => 0;
const DT = 1 / 30;

function run(n: number, f: (i: number) => void): void {
  for (let i = 0; i < n; i++) f(i);
}

describe('DV-078 level ngam-ta-le', () => {
  it('đúng schema; dùng chung ô truong-son-a với nav riêng; ngầm/ụ súng/Thu/spawn trong navRect; props có model trong manifest', async () => {
    const Ajv = (await import('ajv')).default;
    const schema = JSON.parse(readFileSync('content/schemas/terrain-level.schema.json', 'utf8'));
    const def = JSON.parse(readFileSync('content/levels/ngam-ta-le.level.json', 'utf8'));
    const ajv = new Ajv({ strict: false, allErrors: true });
    expect(ajv.validate(schema, def), JSON.stringify(ajv.errors)).toBe(true);
    expect(def.terrain.id).toBe('truong-son-a');
    expect(def.terrain.navFile).toBe('nav-ngam-ta-le.bin');
    const nr = def.terrain.navRect;
    const inRect = (p: [number, number]): boolean => Math.abs(p[0] - nr.x) < nr.w / 2 && Math.abs(p[1] - nr.z) < nr.h / 2;
    for (const z of ['spawn', 'thu', 'ford', 'gun', 'depot']) expect(inRect(def.zones[z].center), z).toBe(true);
    const manifest = JSON.parse(readFileSync('content/assets/manifest.json', 'utf8')) as { assets: Array<{ id: string }> };
    const ids = new Set(manifest.assets.map((a) => a.id));
    for (const m of def.models) expect(ids.has(m), m).toBe(true);
    // AC-130 ngoài tầm nhìn sương? fog density thấp đủ để thấy máy bay ở ~1 km (lửa đầu nòng)
    expect(def.sky.fog.density).toBeLessThan(0.004);
  });

  it('rừng chừa dải trống dọc đường và quanh ụ súng; mặt đường vẽ đất xới', () => {
    const def = JSON.parse(readFileSync('content/levels/ngam-ta-le.level.json', 'utf8'));
    const clear = [...def.vegetation.clear, ...roadClearings(def.roads)];
    const tree = ruleWithClear({ id: 'tree_gn', collider: { radius: 0.4, height: 8 } } as unknown as ScatterRule, clear);
    const fern = ruleWithClear({ id: 'fern' } as unknown as ScatterRule, clear);
    expect(tree.clearPaths!.length).toBe(2);
    const road = def.roads[0];
    // dải trống: cây thân ≥ halfWidth + 1,8; tầng thấp ≥ halfWidth
    const rc = roadClearings(def.roads)[0]!;
    expect(rc.within).toBeCloseTo(road.halfWidth + 1.8);
    expect(rc.withinLow).toBe(road.halfWidth);
    expect(distToPolyline(road.pts, road.pts[1][0] + 1, road.pts[1][1] - 1)).toBeCloseTo(Math.SQRT2, 3);
    expect(fern.clearPaths!.every((c) => (c.withinLow ?? c.within) <= c.within)).toBe(true);
    // vẽ mặt nạ: ô 8×8, res 1 m, đường chéo
    const data = new Uint8Array(8 * 8 * 4).fill(255);
    const n = paintRoads(data, { n: 8, half: 4, resM: 1 }, [{ pts: [[-4, -4], [3, 3]], halfWidth: 0.6 }]);
    expect(n).toBeGreaterThan(8);
    expect(data[(4 * 8 + 4) * 4 + 3]).toBeLessThan(60); // trên đường
    expect(data[(0 * 8 + 7) * 4 + 3]).toBe(255); // xa đường
  });
});

describe('DV-078 nhiệm vụ + thoại', () => {
  it('graph hợp lệ, cờ do hồi đêm đặt (gun_manned, convoy_done, night_over) có trong điều kiện; thoại hợp lệ, mọi câu có phụ đề', () => {
    const m = loadMission(nightMission);
    const d = loadDialogue(nightDialogue);
    const flags = m.nodes.flatMap((n) => n.exitConditions).filter((c) => c.type === 'flag').map((c) => c.flag);
    expect(flags).toEqual(['gun_manned', 'convoy_done', 'night_over']);
    const vi = viJson as Record<string, string>;
    for (const c of d.cues) expect(vi[c.subtitleKey], c.cueId).toBeTruthy();
    for (const n of m.nodes) for (const a of n.actions) if (a.type === 'radio') expect(d.cues.some((c) => c.cueId === a.cue), a.cue).toBe(true);
    for (const n of m.nodes) for (const a of n.actions) if (a.type === 'objective') expect(vi[`hud.objective.${a.objectiveKey}`], a.objectiveKey).toBeTruthy();
  });
});

describe('DV-078 đường xe', () => {
  it('fordS của tuning khớp điểm ngầm (đường cắt suối) trên đường của level', () => {
    const road = new RoadPath(ROAD);
    const ford = road.at(CFG.convoy.fordS);
    const zone = (levelJson as unknown as { zones: Record<string, { center: [number, number] }> }).zones['ford']!;
    expect(Math.hypot(ford.x - zone.center[0], ford.z - zone.center[1])).toBeLessThan(1.5);
    expect(road.length).toBeGreaterThan(CFG.convoy.fordS + CFG.convoy.exitAfter);
    const pr = road.project(ford.x + 3, ford.z - 3);
    expect(Math.abs(pr.s - CFG.convoy.fordS)).toBeLessThan(0.1);
  });
});

describe('DV-078 đoàn xe', () => {
  const mk = (ev: ConvoyEvent[] = []) => new Convoy(CFG.convoy, new RoadPath(ROAD), mulberry32(3), (e) => ev.push(e));

  it('chưa cho đi thì đứng yên; cho đi thì qua ngầm từng chiếc, giữ khoảng cách, đủ 8 xe khi không ai bắn', () => {
    const ev: ConvoyEvent[] = [];
    const c = mk(ev);
    const s0 = c.trucks.map((t) => t.s);
    run(300, () => c.step(DT));
    expect(c.trucks.map((t) => t.s)).toEqual(s0);
    c.go = true;
    const F = CFG.convoy.fordS;
    let maxInFord = 0;
    let minGap = Infinity;
    const pushing = new Map<number, number>();
    for (let i = 0; i < 30 * 600 && !c.done; i++) {
      // xe kẹt: người chơi + 2 đồng đội đẩy
      pushing.clear();
      for (const t of c.trucks) if (t.state === 'stuck') pushing.set(t.id, 3);
      c.step(DT, { pushing });
      const inFord = c.trucks.filter((t) => (t.state === 'moving' || t.state === 'stuck') && Math.abs(t.s - F) <= CFG.convoy.fordHalf).length;
      maxInFord = Math.max(maxInFord, inFord);
      const live = c.trucks.filter((t) => t.state !== 'gone').sort((a, b) => b.s - a.s);
      for (let k = 1; k < live.length; k++) minGap = Math.min(minGap, live[k - 1]!.s - live[k]!.s);
    }
    expect(c.done).toBe(true);
    expect(c.crossed).toBe(8);
    expect(maxInFord).toBe(1);
    expect(minGap).toBeGreaterThan(CFG.convoy.gap - 0.6);
    expect(ev.filter((e) => e.type === 'depart').length).toBe(8);
    expect(ev.filter((e) => e.type === 'stuck').map((e) => e.truck)).toEqual([CFG.convoy.stuckIndex]);
    expect(ev.filter((e) => e.type === 'freed').length).toBe(1);
    expect(ev.at(-1)!.type).toBe('done');
  });

  it('xe kẹt giữa ngầm chắn cả đoàn tới khi đẩy; đẩy nhiều người nhanh hơn', () => {
    const time = (helpers: number): number => {
      const c = mk();
      c.go = true;
      let stuckAt = -1;
      const pushing = new Map<number, number>();
      for (let i = 0; i < 30 * 400; i++) {
        pushing.clear();
        const st = c.trucks.find((t) => t.state === 'stuck');
        if (st && stuckAt < 0) stuckAt = i;
        if (st) pushing.set(st.id, helpers);
        c.step(DT, { pushing });
        if (stuckAt >= 0 && !st) return (i - stuckAt) * DT;
      }
      return Infinity;
    };
    const alone = time(1);
    const team = time(3);
    expect(alone).toBeGreaterThan(CFG.convoy.push.waterS - 0.2);
    expect(alone).toBeLessThan(CFG.convoy.push.waterS + 0.5);
    expect(team).toBeLessThan(alone * 0.6);
    // không ai đẩy: xe sau đứng ở vạch dừng
    const c = mk();
    c.go = true;
    run(30 * 200, () => c.step(DT));
    const st = c.trucks.find((t) => t.state === 'stuck')!;
    expect(st).toBeTruthy();
    const behind = c.trucks.filter((t) => t.id > st.id);
    for (const t of behind) expect(t.s).toBeLessThanOrEqual(CFG.convoy.fordS - CFG.convoy.fordHalf - CFG.convoy.stopLine + 0.6);
  });

  it('xe cháy giữa ngầm chắn ngầm → đẩy xác sang bên; lái xe bị thương: cứu được hoặc hy sinh sau bleedS', () => {
    const ev: ConvoyEvent[] = [];
    const c = mk(ev);
    c.go = true;
    // xe đầu vào giữa ngầm thì bắn cháy
    let hit = false;
    for (let i = 0; i < 30 * 120 && !hit; i++) {
      c.step(DT);
      const t0 = c.trucks[0]!;
      if (t0.state === 'moving' && Math.abs(t0.s - CFG.convoy.fordS) < 2) {
        const p = c.pose(t0);
        c.damageAt(p.x, p.z, 3, 200);
        hit = true;
      }
    }
    const t0 = c.trucks[0]!;
    expect(t0.state).toBe('burning');
    expect(t0.block).toBe('wreck');
    expect(c.fordBlocker()).toBe(t0);
    run(30 * 30, () => c.step(DT));
    expect(c.trucks[1]!.s).toBeLessThanOrEqual(CFG.convoy.fordS - CFG.convoy.fordHalf - CFG.convoy.stopLine + 0.6);
    const pushing = new Map([[0, 2]]);
    run(Math.ceil((30 * CFG.convoy.push.wreckS) / (1 + CFG.convoy.push.helperMul)) + 5, () => c.step(DT, { pushing }));
    expect(t0.block).toBeNull();
    expect(t0.lateral).toBe(CFG.convoy.wreckAside);
    expect(ev.some((e) => e.type === 'wreck_cleared')).toBe(true);
    run(30 * 30, () => c.step(DT));
    expect(c.trucks[1]!.s).toBeGreaterThan(CFG.convoy.fordS);
    // lái xe: tìm seed cho ra bị thương rồi thử cứu / bỏ mặc
    const outcome = (rescue: boolean): string | null => {
      for (let seed = 1; seed < 40; seed++) {
        const cc = new Convoy(CFG.convoy, new RoadPath(ROAD), mulberry32(seed));
        const p = cc.pose(cc.trucks[5]!);
        cc.damageAt(p.x, p.z, 2, 500);
        const tr = cc.trucks[5]!;
        if (tr.driver !== 'injured') continue;
        expect(tr.driverAt).not.toBeNull();
        const d = Math.hypot(tr.driverAt![0] - p.x, tr.driverAt![1] - p.z);
        expect(d).toBeGreaterThan(2.5);
        expect(d).toBeLessThan(6.5);
        run(Math.ceil(30 * (rescue ? CFG.convoy.driver.rescueS + 0.2 : CFG.convoy.driver.bleedS + 1)), () => cc.step(DT, { rescuing: rescue ? 5 : null }));
        return tr.driver;
      }
      return null;
    };
    expect(outcome(true)).toBe('rescued');
    expect(outcome(false)).toBe('dead');
  });

  it('máy bay đang bắn vào đoạn trống → xe dưới tán không ra', () => {
    const c = mk();
    c.go = true;
    run(30 * 8, () => c.step(DT, { hazard: true }));
    const edge = CFG.convoy.fordS - CFG.convoy.openBefore - 2;
    // xe đầu đã ở đoạn trống: chỉ tới vạch dừng; các xe dưới tán không ra quá mép tán
    expect(c.trucks[0]!.s).toBeLessThanOrEqual(CFG.convoy.fordS - CFG.convoy.fordHalf - CFG.convoy.stopLine + 0.01);
    for (const t of c.trucks.slice(1)) expect(t.s).toBeLessThanOrEqual(edge + 0.01);
    // hết nguy hiểm → đi tiếp
    run(30 * (CFG.convoy.hazardHoldS + CFG.convoy.departDelayS + 6), () => c.step(DT));
    expect(c.trucks[0]!.s).toBeGreaterThan(CFG.convoy.fordS - CFG.convoy.fordHalf);
  });

  it('người đứng giữa đường trước mũi xe: xe dừng cách đầu xe ≥ 2 m, người tránh ra thì đi tiếp', () => {
    const c = mk();
    c.go = true;
    const ws = [{ s: CFG.convoy.fordS - 22, d: 0.5 }];
    run(30 * 30, () => c.step(DT, { walkers: ws }));
    const t0 = c.trucks[0]!;
    expect(ws[0]!.s - (t0.s + CFG.convoy.length / 2)).toBeGreaterThanOrEqual(2.4);
    run(30 * 20, () => c.step(DT, { walkers: [{ s: CFG.convoy.fordS - 22, d: 4 }] }));
    expect(t0.s).toBeGreaterThan(CFG.convoy.fordS - 10);
  });

  it('snapshot/restore giữ trạng thái xe', () => {
    const c = mk();
    c.go = true;
    run(30 * 40, () => c.step(DT));
    const s = c.snapshot();
    const d = mk();
    d.restore(s);
    expect(d.trucks.map((t) => [t.s, t.state])).toEqual(c.trucks.map((t) => [t.s, t.state]));
  });
});

describe('DV-078 AC-130', () => {
  const targets: Array<{ id: number; x: number; z: number; vx: number; vz: number }> = [{ id: 0, x: 0, z: 0, vx: 0, vz: 0 }];
  const mk = (impacts: Array<[number, number]> = []) =>
    new Gunship(CFG.gunship, [0, 0, 0], { groundY: flat, targets: () => targets, gunPos: () => [-40, 20] }, mulberry32(9), { impact: (s) => s.kind === 'bofors' && impacts.push([s.at[0], s.at[2]]) });

  it('bay tới → lượn vòng đúng bán kính/độ cao, nghiêng cánh pylon turn, tốc độ tiếp tuyến', () => {
    const g = mk();
    g.arrive();
    run(30 * (CFG.gunship.inbound.seconds + 8), () => g.step(DT));
    expect(g.phase).toBe('attack');
    const r = Math.hypot(g.pos[0], g.pos[2]);
    expect(Math.abs(r - CFG.gunship.orbit.radius)).toBeLessThan(40);
    expect(Math.abs(g.pos[1] - CFG.gunship.orbit.alt)).toBeLessThan(30);
    expect(Math.hypot(g.vel[0], g.vel[2])).toBeCloseTo(CFG.gunship.orbit.speed, 0);
    // vận tốc vuông góc bán kính
    expect(Math.abs(g.vel[0] * g.pos[0] + g.vel[2] * g.pos[2]) / (r * CFG.gunship.orbit.speed)).toBeLessThan(0.05);
    expect(g.bank).toBeGreaterThan(0.2);
  });

  it('40 ly dò dần vào xe đứng yên (phát sau gần hơn phát đầu); áp lực làm lệch hơn', () => {
    const miss = (harass: number): number[] => {
      const imp: Array<[number, number]> = [];
      const g = mk(imp);
      g.arrive();
      run(30 * (CFG.gunship.inbound.seconds + 1), () => g.step(DT));
      const errs: number[] = [];
      for (let i = 0; i < 30 * 25; i++) {
        g.harass = harass;
        g.step(DT);
      }
      for (const [x, z] of imp) errs.push(Math.hypot(x, z));
      return errs;
    };
    const calm = miss(0);
    expect(calm.length).toBeGreaterThan(6);
    const first = calm.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
    const later = calm.slice(4, 8).reduce((a, b) => a + b, 0) / 4;
    expect(later).toBeLessThan(first);
    expect(later).toBeLessThan(6);
    const shaken = miss(0.9);
    const shakenLater = shaken.slice(4, 8).reduce((a, b) => a + b, 0) / 4;
    expect(shakenLater).toBeGreaterThan(later);
  });

  it('12,7 trúng đủ → bỏ vòng (leo cao, ra xa, không bắn) rồi quay lại; báo trước khi quét minigun', () => {
    const phases: string[] = [];
    let warns = 0;
    const g = new Gunship(CFG.gunship, [0, 0, 0], { groundY: flat, targets: () => targets, gunPos: () => [-40, 20] }, mulberry32(9), { phase: (p) => phases.push(p), warn: () => warns++ });
    g.arrive();
    run(30 * (CFG.gunship.inbound.seconds + 8), () => g.step(DT));
    // bắn rát: áp lực vượt ngưỡng minigun trước
    run(Math.ceil(CFG.gunship.minigun.harassMin / CFG.gunship.harass.perHit), () => g.onHit());
    expect(g.harass).toBeGreaterThanOrEqual(CFG.gunship.minigun.harassMin);
    run(30 * 2, () => g.step(DT));
    expect(warns).toBe(1);
    expect(g.warnLeft).toBeGreaterThan(0);
    run(Math.ceil(1 / CFG.gunship.harass.perHit) + 1, () => g.onHit());
    expect(g.phase).toBe('breaking');
    const bofors0 = g.stats.bofors;
    run(30 * (CFG.gunship.break.rampS + CFG.gunship.break.holdS - 1), () => g.step(DT));
    expect(g.phase).toBe('away');
    expect(Math.hypot(g.pos[0], g.pos[2])).toBeGreaterThan(CFG.gunship.break.radius * 0.85);
    expect(g.stats.bofors).toBe(bofors0);
    run(30 * (CFG.gunship.break.returnS + 3), () => g.step(DT));
    expect(g.phase).toBe('attack');
    expect(phases).toEqual(['inbound', 'attack', 'breaking', 'away', 'returning', 'attack']);
    // không rơi: vẫn bay
    expect(g.pos[1]).toBeGreaterThan(300);
  });
});

describe('DV-078 đại liên 12,7', () => {
  it('600 phát/phút, băng 50, hết băng tự thay hộp, đạn rơi theo trọng lực', () => {
    let fired = 0;
    let reloads = 0;
    const g = new MountedGun(CFG.dshk, [0, 0, 0], mulberry32(1), { fire: () => fired++, reload: () => reloads++ });
    g.aim(0, 0.6);
    run(30 * 2, () => g.step(DT, true, false, () => ({ hit: false, dist: 1e9 }), () => -1e9));
    expect(fired).toBeGreaterThanOrEqual(CFG.dshk.belt * 0 + 19);
    expect(fired).toBeLessThanOrEqual(21);
    run(30 * 4, () => g.step(DT, true, false, () => ({ hit: false, dist: 1e9 }), () => -1e9));
    expect(fired).toBe(CFG.dshk.belt);
    expect(reloads).toBe(1);
    expect(g.reloading).toBeGreaterThan(0);
    run(30 * (CFG.dshk.reloadS + 0.2), () => g.step(DT, false, false, () => ({ hit: false, dist: 1e9 }), () => -1e9));
    expect(g.mag).toBe(CFG.dshk.belt);
    // đạn bắn ngang rơi xuống
    const h = new MountedGun(CFG.dshk, [0, 0, 0], mulberry32(1));
    h.aim(0, 0);
    h.step(1 / 600, true, false, () => ({ hit: false, dist: 1e9 }), () => -1e9);
    const r = h.rounds.find((x) => x.live)!;
    const y0 = r.pos[1];
    run(30, () => h.step(DT, false, false, () => ({ hit: false, dist: 1e9 }), () => -1e9));
    expect(r.pos[1]).toBeLessThan(y0 - 3);
    expect(Math.abs(r.pos[2])).toBeGreaterThan(700);
  });

  it('bắn đón đúng thì trúng AC-130 đang lượn, ngắm thẳng vào máy bay thì trượt', () => {
    const shots = (lead: boolean): number => {
      const g = new Gunship(CFG.gunship, [0, 0, 0], { groundY: flat, targets: () => [], gunPos: () => [0, 0] }, mulberry32(4));
      g.arrive();
      run(30 * (CFG.gunship.inbound.seconds + 4), () => g.step(DT));
      const gun = new MountedGun(CFG.dshk, [30, 0, 0], mulberry32(5));
      for (let i = 0; i < 30 * 6; i++) {
        const muzzle = gun.toWorld(CFG.dshk.muzzle);
        const a = lead ? leadAngles(muzzle, g.pos, g.vel, CFG.dshk.muzzleVelocity, CFG.dshk.gravity) : leadAngles(muzzle, g.pos, [0, 0, 0], CFG.dshk.muzzleVelocity, 0);
        gun.aim(a.yaw, a.pitch);
        gun.step(DT, true, false, (p0, p1) => g.testSegment(p0, p1), flat);
        g.step(DT);
      }
      return gun.stats.hits;
    };
    expect(shots(true)).toBeGreaterThan(10);
    expect(shots(false)).toBeLessThan(3);
  });
});

describe('DV-078 cân bằng cả đêm (người chơi giả lập)', () => {
  /**
   * Người chơi giả lập: ngồi súng bắn đón (sai số σ độ) khi máy bay lượn bắn; xe kẹt/xác chắn ngầm hoặc lái xe bị thương thì rời
   * súng xuống ngầm (mất 8 s mỗi lượt đi), lúc đó phụ xạ ngồi thay (nếu `crew`). `shoot = false`: chỉ làm việc dưới ngầm.
   */
  function night(sigmaDeg: number, shoot: boolean, crew: boolean, seed: number): { crossed: number; rescued: number; breaks: number; t: number; minigun: number } {
    const prng = mulberry32(seed);
    const noise = mulberry32(seed + 100);
    const gunBase = [-221.7, 0, 682.1];
    const L = new NightLogic(CFG, ROAD, gunBase, flat, prng);
    L.convoy.go = true;
    L.gunship.arrive();
    const pushing = new Map<number, number>();
    let t = 0;
    let transit = 0;
    let at: 'gun' | 'ford' = 'gun';
    for (; t < 60 * 15 && !(L.convoy.done && L.gunship.phase !== 'attack'); t += DT) {
      pushing.clear();
      const block = L.convoy.trucks.find((x) => x.block !== null);
      const injured = L.convoy.trucks.find((x) => x.driver === 'injured');
      const want = block || injured || !shoot ? 'ford' : 'gun';
      if (want !== at) {
        at = want;
        transit = 8;
      }
      transit -= DT;
      const there = transit <= 0;
      const mounted = there && at === 'gun';
      let rescuing: number | null = null;
      if (there && at === 'ford') {
        if (block) pushing.set(block.id, 3);
        else if (injured) rescuing = injured.id;
      }
      const m = L.gun.toWorld(CFG.dshk.muzzle);
      const a = leadAngles(m, L.gunship.pos, L.gunship.vel, CFG.dshk.muzzleVelocity, CFG.dshk.gravity);
      const e = (sigmaDeg * Math.PI) / 180;
      const fire = mounted && (L.gunship.phase === 'attack' || L.gunship.phase === 'returning');
      L.step(DT, { mounted, trigger: fire, reload: false, yaw: a.yaw + noise.gaussian() * e, pitch: a.pitch + noise.gaussian() * e, player: mounted ? gunBase : [-190, 0, 690], crouched: false, alive: true, pushing, rescuing, crewGun: crew });
    }
    return { crossed: L.convoy.crossed, rescued: L.convoy.stats.rescued, breaks: L.gunship.stats.breaks, t, minigun: L.gunship.stats.minigun };
  }
  const avg = (f: (seed: number) => { crossed: number }): number => [1, 2, 3, 4].map(f).reduce((a, r) => a + r.crossed, 0) / 4;

  it('bỏ mặc máy bay (không ai bắn): gần mất cả đoàn; phụ xạ bắn thay đỡ được ít; bắn đón tốt giữ được đa số; đêm 2,5–10 phút', () => {
    const nobody = avg((s) => night(0, false, false, s));
    const crewOnly = avg((s) => night(0, false, true, s));
    const good = avg((s) => night(0.35, true, true, s));
    const poor = avg((s) => night(1.5, true, true, s));
    const one = night(0.35, true, true, 1);
    console.log('[night balance]', JSON.stringify({ nobody, crewOnly, good, poor, one }));
    expect(nobody).toBeLessThanOrEqual(2);
    expect(crewOnly).toBeGreaterThan(nobody);
    expect(good).toBeGreaterThanOrEqual(5.5);
    expect(poor).toBeLessThanOrEqual(good - 1);
    expect(one.breaks).toBeGreaterThanOrEqual(2);
    expect(one.t).toBeGreaterThan(150);
    expect(one.t).toBeLessThan(600);
    // bắn rát thì bị minigun quét ụ súng
    expect(one.minigun).toBeGreaterThanOrEqual(1);
  });
});
