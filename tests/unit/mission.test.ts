import { describe, it, expect } from 'vitest';
import { EventBus } from '@engine/core';
import { loadMission, loadDialogue, validateSnapshot, MissionValidationError } from '@game/mission/loader';
import { MissionRuntime, type MissionWorld } from '@game/mission/runtime';
import { CheckpointStore, stateHash } from '@game/mission/checkpoint';
import { memoryStore } from '@game/player/settings';
import type { MissionEvents, CheckpointSnapshot } from '@game/mission/types';
import missionJson from '@content/missions/g0-arena.mission.json';
import dialogueJson from '@content/missions/g0-dialogue.json';
import { readFileSync } from 'node:fs';

/** Thế giới giả: player, actors theo group, inventory. Deterministic. */
class FakeWorld implements MissionWorld {
  player: [number, number, number] = [0, 0, 40];
  actors = new Map<string, { group: string; alive: boolean; health: number; position: [number, number, number] }>();
  tick = 0;
  spawnCalls = 0;
  mag = 30;
  reserve = 120;
  playerPosition(): [number, number, number] {
    return [...this.player] as [number, number, number];
  }
  spawnGroup(groupId: string, count: number): string[] {
    this.spawnCalls++;
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const id = `${groupId}_${i}`;
      this.actors.set(id, { group: groupId, alive: true, health: 100, position: [i, 0, -40] });
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
    return {
      actors: [...this.actors.entries()].map(([id, a]) => ({ id, group: a.group, position: [...a.position] as [number, number, number], health: a.health, alive: a.alive })),
      player: { position: [...this.player] as [number, number, number], yaw: 0, pitch: 0, health: 100, stance: 'stand' as const },
      inventory: { weapon: 'ar_v1', mag: this.mag, reserve: this.reserve },
      doors: [],
    };
  }
  restoreWorld(s: ReturnType<FakeWorld['captureWorld']>): void {
    this.actors.clear();
    for (const a of s.actors) this.actors.set(a.id, { group: a.group, alive: a.alive, health: a.health, position: [...a.position] as [number, number, number] });
    this.player = [...s.player.position] as [number, number, number];
    this.mag = s.inventory.mag;
    this.reserve = s.inventory.reserve;
  }
  currentTick(): number {
    return this.tick;
  }
  seed(): number {
    return 7;
  }
}

function setup() {
  const def = loadMission(missionJson);
  const dlg = loadDialogue(dialogueJson);
  const events = new EventBus<MissionEvents>(512);
  const world = new FakeWorld();
  const rt = new MissionRuntime(def, dlg, events, world);
  const stepN = (n: number): void => {
    for (let i = 0; i < n; i++) {
      world.tick++;
      rt.step(1 / 60);
    }
  };
  return { def, dlg, events, world, rt, stepN };
}

describe('TIP-008 Loader (PRD §8 schema + allow-list)', () => {
  it('mission g0-arena + dialogue hợp lệ', () => {
    expect(loadMission(missionJson).nodes.length).toBe(6);
    expect(loadDialogue(dialogueJson).cues.length).toBe(5);
  });

  it('action ngoài allow-list → reject với path nodes[1].actions[0].type', () => {
    const bad = JSON.parse(JSON.stringify(missionJson)) as typeof missionJson;
    (bad.nodes[1]!.actions[0] as { type: string }).type = 'explode_map';
    let err: MissionValidationError | null = null;
    try {
      loadMission(bad);
    } catch (e) {
      err = e as MissionValidationError;
    }
    expect(err).toBeInstanceOf(MissionValidationError);
    expect(err!.problems.some((p) => p.includes('/nodes/1/actions/0/type'))).toBe(true);
  });

  it('tham chiếu sai (next không tồn tại, group chưa khai báo) → reject', () => {
    const bad = JSON.parse(JSON.stringify(missionJson)) as typeof missionJson;
    (bad.nodes[0] as { next: string }).next = 'n_ghost';
    (bad.nodes[1]!.actions[1] as { group: string }).group = 'no_group';
    expect(() => loadMission(bad)).toThrow(MissionValidationError);
    try {
      loadMission(bad);
    } catch (e) {
      const p = (e as MissionValidationError).problems;
      expect(p.some((x) => x.includes("'n_ghost'"))).toBe(true);
      expect(p.some((x) => x.includes("'no_group'"))).toBe(true);
    }
  });

  it('mọi cue trong mission có trong dialogue và mọi subtitleKey có trong vi.json', () => {
    const vi = JSON.parse(readFileSync('content/locale/vi.json', 'utf8')) as Record<string, string>;
    const dlg = loadDialogue(dialogueJson);
    const cueIds = new Set(dlg.cues.map((c) => c.cueId));
    for (const n of missionJson.nodes) for (const a of n.actions) if (a.type === 'radio') expect(cueIds.has((a as { cue: string }).cue)).toBe(true);
    for (const c of dlg.cues) expect(vi[c.subtitleKey]).toBeDefined();
    for (const n of missionJson.nodes) for (const a of n.actions) if ('objectiveKey' in a) expect(vi[`hud.objective.${(a as { objectiveKey: string }).objectiveKey}`]).toBeDefined();
  });
});

describe('TIP-008 Runtime (PRD §6.5, §8)', () => {
  it('intro → radio D01 + objective; vào relay_zone → D03 + spawn đúng 1 lần dù zone_enter đúng nhiều tick', () => {
    const { events, world, rt, stepN } = setup();
    const radios: string[] = [];
    events.on('RADIO', (e) => radios.push(e.cue));
    rt.start();
    stepN(5);
    expect(radios).toEqual(['D01']);
    expect(rt.state.currentNode).toBe('n_zone');
    expect(rt.state.objectives['obj_reach_relay']).toBe('active');
    world.player = [0, 0, -20];
    stepN(5); // zone_enter đúng 5 tick liên tiếp
    expect(radios).toEqual(['D01', 'D03']);
    expect(world.spawnCalls).toBe(1);
    expect(rt.zoneEnterHits).toBeGreaterThanOrEqual(1);
    expect(rt.state.currentNode).toBe('n_clear');
    expect(rt.state.groups['bot_group_a']).toHaveLength(2);
    // phát lại action thủ công (mô phỏng re-enter) → duplicates tăng, không spawn thêm
    events.emit('SPAWN_GROUP', { group: 'bot_group_a', count: 2, spawn: 'bot_b' }, { id: 'g0-arena:n_zone:1' });
    expect(events.duplicates).toBe(1);
    expect(world.spawnCalls).toBe(1);
  });

  it('group chết → n_saved (D05, relay_cut, checkpoint cp0) → n_done MISSION_COMPLETE đúng 1 lần', () => {
    const { events, world, rt, stepN } = setup();
    let complete = 0;
    let checkpoint = 0;
    events.on('MISSION_COMPLETE', () => complete++);
    events.on('CHECKPOINT_SAVED', () => checkpoint++);
    rt.start();
    stepN(2);
    world.player = [0, 0, -20];
    stepN(2);
    expect(rt.state.currentNode).toBe('n_clear');
    stepN(60);
    expect(rt.state.currentNode).toBe('n_clear');
    for (const a of world.actors.values()) if (a.group === 'bot_group_a') a.alive = false;
    stepN(3);
    expect(rt.state.flags['relay_cut']).toBe(true);
    expect(rt.state.objectives['obj_clear_relay']).toBe('complete');
    expect(checkpoint).toBe(1);
    expect(rt.state.currentNode).toBe('n_done');
    expect(rt.state.complete).toBe(true);
    stepN(120);
    expect(complete).toBe(1);
    expect(events.duplicates).toBe(0);
  });

  it('n_zone timeout 60 s không vào zone → fallback n_timeout (D06, alarm_state) rồi quay lại n_zone; NODE_TIMEOUT log', () => {
    const { events, rt, stepN } = setup();
    const timeouts: string[] = [];
    const radios: string[] = [];
    events.on('NODE_TIMEOUT', (e) => timeouts.push(e.node));
    events.on('RADIO', (e) => radios.push(e.cue));
    rt.start();
    stepN(60 * 61);
    expect(timeouts).toEqual(['n_zone']);
    expect(radios).toContain('D06');
    expect(rt.state.flags['alarm_state']).toBe(true);
    expect(rt.state.currentNode).toBe('n_zone');
    // lần 2 không phát D06 lại (idempotent) nhưng vẫn timeout → fallback
    stepN(60 * 61);
    expect(timeouts).toEqual(['n_zone', 'n_zone']);
    expect(radios.filter((r) => r === 'D06')).toHaveLength(1);
  });

  it('restore: chơi thêm 30 s rồi restore(S) → hash bằng lúc lưu, không duplicate event; lặp 20 lần → 20/20', () => {
    const { events, world, rt, stepN } = setup();
    const store = new CheckpointStore(memoryStore());
    rt.start();
    stepN(2);
    world.player = [0, 0, -20];
    stepN(2);
    for (const a of world.actors.values()) if (a.group === 'bot_group_a') a.alive = false;
    let saved: ReturnType<CheckpointStore['save']> | null = null;
    events.on('CHECKPOINT_SAVED', (e) => {
      saved = store.save(rt.snapshot(e.checkpoint), events.seenIdList());
    });
    stepN(3);
    expect(saved).not.toBeNull();
    const S = saved!;
    let ok = 0;
    for (let i = 0; i < 20; i++) {
      // chơi tiếp: player di chuyển, actor hồi sinh giả, ammo đổi, event mới
      world.player = [10 + i, 0, 5];
      world.mag = 3;
      world.actors.set(`ghost_${i}`, { group: 'bot_group_a', alive: true, health: 50, position: [0, 0, 0] });
      events.emit('MISSION_FLAG', { flag: `junk_${i}`, value: true });
      stepN(60 * 30);
      rt.restore(S.snapshot, S.seenEventIds);
      const now = rt.snapshot(S.snapshot.checkpointId);
      if (stateHash(now) === S.hash && world.actors.size === S.snapshot.actors.length && events.size === 0 && world.mag === 30) ok++;
      // sau restore: các action một-lần không phát lại
      stepN(5);
      expect(events.countOf('CHECKPOINT_SAVED')).toBe(0);
    }
    expect(ok).toBe(20);
    expect(validateSnapshot(S.snapshot).checkpointId).toBe('cp0');
  });

  it('stateHash bỏ tick/timers, ổn định với float noise', () => {
    const { rt, stepN } = setup();
    rt.start();
    stepN(3);
    const a = rt.snapshot('x');
    const b: CheckpointSnapshot = { ...a, tick: a.tick + 999, timers: { nodeMs: 12345 }, player: { ...a.player, position: [a.player.position[0] + 1e-7, a.player.position[1], a.player.position[2]] } };
    expect(stateHash(a)).toBe(stateHash(b));
    const c: CheckpointSnapshot = { ...a, missionFlags: { relay_cut: true } };
    expect(stateHash(a)).not.toBe(stateHash(c));
  });
});
