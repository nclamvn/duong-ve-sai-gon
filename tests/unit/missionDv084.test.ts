/**
 * DV-084 hành động kịch bản mới: quân tiếp viện theo đợt (trần địch sống, group_dead chờ hết đợt, checkpoint giữ đợt còn chờ),
 * hành động chiến trường phát sự kiện BATTLE, mục tiêu có đếm ngược.
 */
import { describe, it, expect } from 'vitest';
import { EventBus } from '@engine/core';
import { loadMission, loadDialogue } from '@game/mission/loader';
import { MissionRuntime, type MissionWorld } from '@game/mission/runtime';
import type { MissionEvents } from '@game/mission/types';

class W implements MissionWorld {
  actors = new Map<string, { group: string; alive: boolean }>();
  seq = 0;
  playerPosition(): [number, number, number] {
    return [0, 0, 0];
  }
  spawnGroup(groupId: string, count: number): string[] {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const id = `${groupId}_${this.seq++}`;
      this.actors.set(id, { group: groupId, alive: true });
      ids.push(id);
    }
    return ids;
  }
  groupAlive(g: string): number {
    let n = 0;
    for (const a of this.actors.values()) if (a.group === g && a.alive) n++;
    return n;
  }
  enemiesAlive(): number {
    let n = 0;
    for (const a of this.actors.values()) if (a.alive) n++;
    return n;
  }
  killAll(g: string): void {
    for (const a of this.actors.values()) if (a.group === g) a.alive = false;
  }
  captureWorld() {
    return { actors: [...this.actors.entries()].map(([id, a]) => ({ id, group: a.group, position: [0, 0, 0] as [number, number, number], health: 100, alive: a.alive })), player: { position: [0, 0, 0] as [number, number, number], yaw: 0, pitch: 0, health: 100, stance: 'stand' as const }, inventory: { weapon: 'ak47', mag: 30, reserve: 90 }, doors: [] };
  }
  restoreWorld(s: ReturnType<W['captureWorld']>): void {
    this.actors.clear();
    for (const a of s.actors) this.actors.set(a.id, { group: a.group, alive: a.alive });
  }
  currentTick(): number {
    return 0;
  }
  seed(): number {
    return 1;
  }
}

const def = {
  id: 'dv084',
  version: '0.1.0',
  seedPolicy: 'fixed',
  seed: 1,
  startNode: 'a',
  checkpoints: ['c1'],
  localization: 'vi',
  zones: [{ id: 'z', center: [0, 0, 0], radius: 10 }],
  spawnGroups: [
    { id: 'wave', archetype: 'grunt', count: 6, spawn: 'p' },
    { id: 'other', archetype: 'grunt', count: 8, spawn: 'p' },
  ],
  nodes: [
    {
      id: 'a',
      type: 'encounter',
      enterConditions: [{ type: 'always' }],
      actions: [
        { type: 'spawn', group: 'other' },
        { type: 'reinforce', group: 'wave', waves: 3, intervalMs: 5000, maxAlive: 16 },
        { type: 'objective', objectiveKey: 'o', marker: 'z', timerMs: 20000 },
        { type: 'napalm', from: [0, 0], to: [50, 0] },
        { type: 'mortar', zone: 'z', durationMs: 10000, rate: 30 },
        { type: 'squad_kill', name: 'name.khang', kind: 'napalm' },
        { type: 'fx', kind: 'fire', at: [5, 5], durationMs: 30000 },
        { type: 'safe_zone', zone: 'z', delayMs: 15000, durationMs: 10000, damage: 50 },
        { type: 'checkpoint', checkpoint: 'c1' },
      ],
      exitConditions: [{ type: 'group_dead', group: 'wave' }],
      next: 'end',
    },
    { id: 'end', type: 'terminal', enterConditions: [{ type: 'always' }], actions: [{ type: 'mission_complete' }], exitConditions: [{ type: 'always' }], next: null },
  ],
};

describe('DV-084 quân tiếp viện + hành động chiến trường', () => {
  it('đợt sau chờ trần 16; group_dead chỉ đúng khi hết đợt; BATTLE phát đủ 6 loại; mục tiêu có đếm ngược', () => {
    const w = new W();
    const ev = new EventBus<MissionEvents>(256);
    const battles: string[] = [];
    let timer = 0;
    ev.on('BATTLE', (e) => battles.push(e.action.type));
    ev.on('OBJECTIVE', (e) => (timer = e.timerMs ?? 0));
    const rt = new MissionRuntime(loadMission(def), loadDialogue({ cues: [] }), ev, w);
    rt.start();
    rt.step(0.1);
    // 8 + 6 = 14 sống: đợt 2 (6) vượt trần 16 → phải chờ
    expect(w.enemiesAlive()).toBe(14);
    expect(battles.sort()).toEqual(['fx', 'mortar', 'napalm', 'safe_zone', 'squad_kill']);
    expect(timer).toBe(20000);
    for (let i = 0; i < 60; i++) rt.step(0.1);
    expect(w.groupAlive('wave')).toBe(6); // còn bị trần chặn
    w.killAll('other');
    w.killAll('wave');
    rt.step(0.1);
    expect(rt.state.currentNode).toBe('a'); // còn 2 đợt chờ → chưa xong dù cả nhóm đã chết
    for (let i = 0; i < 20; i++) rt.step(0.1);
    expect(w.groupAlive('wave')).toBe(6); // đợt 2 ra (trần đủ chỗ)
    w.killAll('wave');
    for (let i = 0; i < 60; i++) rt.step(0.1);
    w.killAll('wave');
    for (let i = 0; i < 5; i++) rt.step(0.1);
    expect(rt.state.currentNode).toBe('end');
  });

  it('checkpoint giữ số đợt còn chờ', () => {
    const w = new W();
    const ev = new EventBus<MissionEvents>(256);
    const rt = new MissionRuntime(loadMission(def), loadDialogue({ cues: [] }), ev, w);
    rt.start();
    rt.step(0.1);
    const snap = rt.snapshot('c1');
    expect(snap.timers['rf:wave:left']).toBe(2);
    const rt2 = new MissionRuntime(loadMission(def), loadDialogue({ cues: [] }), new EventBus<MissionEvents>(256), w);
    rt2.restore(snap, []);
    expect(rt2.state.reinforce['wave']?.left).toBe(2);
  });
});
