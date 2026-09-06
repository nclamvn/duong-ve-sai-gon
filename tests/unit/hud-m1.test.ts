/**
 * TIP-UX02 + TIP-M1A (unit): toán la bàn/marker (thuần), đội hình đồng đội (Squadmates goalFor) và mission M1 (schema + active_ms +
 * graph chạy hết trên FakeWorld) — không DOM/three.
 */
import { describe, it, expect } from 'vitest';
import { bearingOf, relDeg } from '@ui/compass';
import { clampToEdge } from '@ui/markers';
import { Squadmates } from '@game/ai/squadmates';
import type { BotActor } from '@game/actors/botActor';
import { EventBus } from '@engine/core';
import { loadMission, loadDialogue } from '@game/mission/loader';
import { MissionRuntime, type MissionWorld } from '@game/mission/runtime';
import type { MissionEvents } from '@game/mission/types';
import missionJson from '@content/missions/truong-son-a.mission.json';
import dialogueJson from '@content/missions/truong-son-a.dialogue.json';
import levelJson from '@content/levels/truong-son-a.level.json';
import { hasKey } from '@ui/i18n';

describe('la bàn (TIP-UX02)', () => {
  it('bearingOf: bắc = −z → 0°, đông = +x → 90°, nam 180°, tây 270°', () => {
    expect(bearingOf(0, -1)).toBeCloseTo(0);
    expect(bearingOf(1, 0)).toBeCloseTo(90);
    expect(bearingOf(0, 1)).toBeCloseTo(180);
    expect(bearingOf(-1, 0)).toBeCloseTo(270);
  });
  it('relDeg: góc lệch ngắn nhất −180..180', () => {
    expect(relDeg(350, 10)).toBeCloseTo(20);
    expect(relDeg(10, 350)).toBeCloseTo(-20);
    expect(relDeg(0, 180)).toBeCloseTo(180);
  });
  it('marker: trong khung giữ nguyên; ngoài khung/sau lưng kẹp mép có góc mũi tên', () => {
    expect(clampToEdge(0.2, -0.3, false, 0.1, 0.1)).toEqual({ x: 0.2, y: -0.3, edge: false, angle: 0 });
    const r = clampToEdge(2, 0.1, false, 0.1, 0.1);
    expect(r.edge).toBe(true);
    expect(r.x).toBeCloseTo(0.9);
    expect(Math.abs(r.y)).toBeLessThan(0.9);
    const b = clampToEdge(0.3, 0.2, true, 0.1, 0.1); // sau lưng → lật xuống dưới
    expect(b.edge).toBe(true);
    expect(b.y).toBeLessThan(0);
    expect(Math.abs(Math.abs(b.y) - 0.9) < 1e-6 || Math.abs(Math.abs(b.x) - 0.9) < 1e-6).toBe(true);
  });
});

function fakeActor(id: string, pos: [number, number, number], nameKey: string): BotActor {
  return { id, nameKey, faction: 'friend', bot: { position: pos, alive: true, health: 100 } } as unknown as BotActor;
}

describe('đồng đội (TIP-M1A Squadmates)', () => {
  const mk = (objective: [number, number, number] | null, feet: [number, number, number], speed = 1) => {
    const said: string[] = [];
    let now = 0;
    const sq = new Squadmates({
      player: () => ({ feet, fwdX: 0, fwdZ: -1, speed }),
      objective: () => objective,
      say: (cue) => (said.push(cue), true),
      now: () => now,
    });
    return { sq, said, tick: (s: number) => (now += s) };
  };
  it('Quyết dẫn: đi trước 8 m về mục tiêu; dừng khi ta tụt lại > 14 m; đuổi khi ta vượt lên', () => {
    const { sq } = mk([0, 0, -100], [0, 0, 0]);
    const q = fakeActor('q', [0, 0, -2], 'name.quyet');
    sq.add(q, 'leader');
    const g1 = sq.goalFor('q')()!;
    expect(g1.z).toBeCloseTo(-10);
    q.bot.position[2] = -20; // đã đi trước 20 m → chờ
    expect(sq.goalFor('q')()).toBeNull();
    q.bot.position[2] = 30; // người chơi vượt 30 m → đuổi tới trước người chơi 3 m
    const g3 = sq.goalFor('q')()!;
    expect(g3.z).toBeCloseTo(-3);
    expect(g3.run).toBe(true);
  });
  it('Hải theo sau 3 m lệch ngang; đứng yên khi gần và ta không di chuyển; hold giữ chỗ', () => {
    const { sq } = mk(null, [0, 0, 0], 0);
    const h = fakeActor('h', [2, 0, 2], 'name.hai');
    sq.add(fakeActor('q', [0, 0, -2], 'name.quyet'), 'leader');
    sq.add(h, 'follower');
    expect(sq.goalFor('h')()).toBeNull(); // gần + đứng yên
    h.bot.position[2] = 20;
    const g = sq.goalFor('h')()!;
    expect(g.z).toBeCloseTo(3); // sau người chơi (fwd −z → sau = +z)
    expect(Math.abs(g.x)).toBeCloseTo(2);
    expect(g.run).toBe(true);
    sq.order = 'hold';
    h.bot.position[2] = 12;
    expect(sq.goalFor('h')()).toBeNull();
    h.bot.position[2] = 40;
    expect(sq.goalFor('h')()!.run).toBe(true); // hold nhưng > 20 m → về gần
  });
  it('bark: theo người nói; chống spam 6 s/người và 2,5 s toàn tổ', () => {
    const { sq, said, tick } = mk(null, [0, 0, 0]);
    sq.add(fakeActor('q', [0, 0, 0], 'name.quyet'), 'leader');
    sq.add(fakeActor('h', [0, 0, 0], 'name.hai'), 'follower');
    expect(sq.bark('q', 'contact')).toBe(true);
    expect(sq.bark('h', 'contact')).toBe(false); // toàn tổ 2,5 s
    tick(3);
    expect(sq.bark('h', 'contact')).toBe(true);
    expect(sq.bark('q', 'kill')).toBe(false); // Quyết còn cooldown 6 s
    tick(4);
    expect(sq.bark('q', 'kill')).toBe(true);
    expect(said).toEqual(['M13', 'M05', 'M11']);
    for (const c of said) expect(hasKey(`dlg.${c}`)).toBe(true);
  });
});

/** Thế giới giả cho mission M1 */
class M1World implements MissionWorld {
  player: [number, number, number] = [-134, 0, 580];
  actors = new Map<string, { group: string; alive: boolean }>();
  tick = 0;
  playerPosition(): [number, number, number] {
    return [...this.player] as [number, number, number];
  }
  spawnGroup(groupId: string, count: number): string[] {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const id = `${groupId}_${i}`;
      this.actors.set(id, { group: groupId, alive: true });
      ids.push(id);
    }
    return ids;
  }
  groupAlive(groupId: string): number {
    let n = 0;
    for (const a of this.actors.values()) if (a.group === groupId && a.alive) n++;
    return n;
  }
  captureWorld() {
    return { actors: [], player: { position: [...this.player] as [number, number, number], yaw: 0, pitch: 0, health: 100, stance: 'stand' as const }, inventory: { weapon: 'ak47', mag: 30, reserve: 120 }, doors: [] };
  }
  restoreWorld(): void {}
  currentTick(): number {
    return this.tick;
  }
  seed(): number {
    return 1971;
  }
}

describe('mission M1 lát cắt (TIP-M1A)', () => {
  const def = loadMission(missionJson);
  const dlg = loadDialogue(dialogueJson);
  it('schema + tham chiếu hợp lệ; mọi cue/objective/name có locale; zone/spawn khớp level', () => {
    expect(def.startNode).toBe('n_intro');
    for (const c of dlg.cues) expect(hasKey(c.subtitleKey), c.subtitleKey).toBe(true);
    for (const n of def.nodes) for (const a of n.actions) if (a.objectiveKey) expect(hasKey(`hud.objective.${a.objectiveKey}`), a.objectiveKey).toBe(true);
    for (const g of def.spawnGroups ?? []) {
      for (const s of g.spawns ?? [g.spawn]) expect((levelJson.botSpawns as Record<string, unknown>)[s], `spawn ${s}`).toBeDefined();
      for (const nk of g.names ?? []) expect(hasKey(nk), nk).toBe(true);
    }
    for (const z of def.zones ?? []) expect((levelJson.zones as Record<string, { center: number[] }>)[z.id]?.center).toEqual([z.center[0], z.center[2]]);
  });
  it('graph chạy hết: intro → ridge (active_ms 4,5 s sau khi vào zone, không tính thời gian chờ) → block 2 đợt → lz → done; sky_trigger + squad_order phát đúng', () => {
    const events = new EventBus<MissionEvents>();
    const world = new M1World();
    const rt = new MissionRuntime(def, dlg, events, world);
    rt.start();
    const sky: string[] = [];
    const orders: string[] = [];
    const objectives: Array<{ key: string; status: string; marker?: string }> = [];
    events.on('SKY_TRIGGER', (e) => sky.push(e.flight));
    events.on('SQUAD_ORDER', (e) => orders.push(e.order));
    events.on('OBJECTIVE', (e) => objectives.push({ key: e.key, status: e.status, marker: e.marker }));
    const step = (s: number): void => {
      for (let i = 0; i < s * 60; i++) {
        world.tick++;
        rt.step(1 / 60);
      }
    };
    step(0.1);
    expect(rt.state.currentNode).toBe('n_ridge');
    expect(world.groupAlive('squad')).toBe(2);
    expect(objectives[0]).toEqual({ key: 'obj_m1_follow', status: 'active', marker: 'ridge' });
    step(30); // đi 30 s chưa vào zone — nodeMs lớn nhưng active_ms chưa tính
    expect(rt.state.currentNode).toBe('n_ridge');
    world.player = [-200, 0, 430];
    step(0.1);
    expect(rt.state.currentNode).toBe('n_ridge');
    expect(rt.state.nodeActive).toBe(true);
    step(3);
    expect(rt.state.currentNode).toBe('n_ridge'); // 3 s < 4,5 s
    step(2);
    expect(rt.state.currentNode).toBe('n_block');
    expect(objectives.at(-1)).toEqual({ key: 'obj_m1_block', status: 'active', marker: 'block' });
    world.player = [-262, 0, 352];
    step(0.1);
    expect(world.groupAlive('recon_1')).toBe(3);
    step(26); // timeout 25 s → đợt 2 dù đợt 1 chưa chết
    expect(rt.state.currentNode).toBe('n_wave2');
    expect(world.groupAlive('recon_2')).toBe(3);
    for (const a of world.actors.values()) if (a.group.startsWith('recon')) a.alive = false;
    step(0.1);
    expect(rt.state.currentNode).toBe('n_lz');
    world.player = [-292, 0, 306];
    step(0.1);
    expect(sky).toEqual(['huey_insert']);
    step(35);
    expect(rt.state.currentNode).toBe('n_done');
    expect(rt.state.complete).toBe(true);
    expect(orders).toEqual(['follow', 'hold', 'follow', 'hold']);
    expect(events.countOf('MISSION_COMPLETE')).toBe(1);
  });
});
