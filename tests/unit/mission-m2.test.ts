/**
 * M2 R1 (Blueprint G2, DV-047): mission diem-cao-31 hợp lệ (schema, zone/spawn khớp level, cue/objective có locale), graph
 * C1–C2 chạy hết trên FakeWorld: intro → approach (pháo 30 s) → go → 3 rào (interactable → flag → nổ flag _blown) → hầm M60 →
 * hào → hầm chỉ huy (cpA) → đỉnh (cpB) → xong; level: props có 3 đoạn rào gỡ được, cỏ tranh, HDRI đêm không đèn thành phố.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { EventBus } from '@engine/core';
import { loadMission, loadDialogue } from '@game/mission/loader';
import { MissionRuntime, type MissionWorld } from '@game/mission/runtime';
import type { MissionEvents } from '@game/mission/types';
import missionJson from '@content/missions/diem-cao-31.mission.json';
import dialogueJson from '@content/missions/diem-cao-31.dialogue.json';
import levelJson from '@content/levels/diem-cao-31.level.json';
import { hasKey } from '@ui/i18n';
import { concertinaGeometry, PROP_MODEL, PROP_HALF } from '@engine/terrain/props';
import { Vector3 } from 'three/webgpu';

class M2World implements MissionWorld {
  player: [number, number, number] = [-402, 0, 274];
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
  kill(groupId: string): void {
    for (const a of this.actors.values()) if (a.group === groupId) a.alive = false;
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

describe('M2 R1 — Điểm cao 31 (mission + level)', () => {
  const def = loadMission(missionJson);
  const dlg = loadDialogue(dialogueJson);
  const level = levelJson as unknown as { props: Array<{ id: string; kind: string }>; sky: { hdri: string }; vegetation: { species: Array<{ id: string; press?: number }> }; zones: Record<string, { center: number[] }>; botSpawns: Record<string, number[]>; models: string[] };

  it('schema + tham chiếu: zone/spawn khớp level, cue B01–B14 + objective có locale, 4 nhóm spawn (đội 3 người + dù 2/6/5)', () => {
    expect(def.startNode).toBe('n_intro');
    for (const c of dlg.cues) expect(hasKey(c.subtitleKey), c.subtitleKey).toBe(true);
    for (let i = 1; i <= 14; i++) expect(dlg.cues.some((c) => c.cueId === `B${String(i).padStart(2, '0')}`)).toBe(true);
    for (const n of def.nodes) for (const a of n.actions) if (a.objectiveKey) expect(hasKey(`hud.objective.${a.objectiveKey}`), a.objectiveKey).toBe(true);
    for (const g of def.spawnGroups ?? []) for (const s of g.spawns ?? [g.spawn]) expect(level.botSpawns[s], `spawn ${s}`).toBeDefined();
    for (const z of def.zones ?? []) expect(level.zones[z.id]?.center).toEqual([z.center[0], z.center[2]]);
    const counts = Object.fromEntries((def.spawnGroups ?? []).map((g) => [g.id, g.count]));
    expect(counts).toEqual({ squad: 3, para_mg: 2, para_trench: 6, para_top: 5 });
    // interactable: 3 bộc phá trỏ prop rào _gap có trong level, promptKey có locale
    const charges = def.nodes.flatMap((n) => n.actions.filter((a) => a.type === 'interactable'));
    expect(charges.map((a) => a.prop)).toEqual(['wire_1_gap', 'wire_2_gap', 'wire_3_gap']);
    for (const a of charges) {
      expect(level.props.some((p) => p.id === a.prop && p.kind === 'wire')).toBe(true);
      expect(hasKey(`hud.prompt.${a.promptKey}`)).toBe(true);
      expect(a.fuseMs).toBe(3000);
    }
  });

  it('graph chạy hết trên FakeWorld: pháo 30 s, 3 rào (flag → _blown), hầm M60, hào, cpA, đỉnh, xong; flag arty/flares đúng lúc', () => {
    const events = new EventBus<MissionEvents>();
    const world = new M2World();
    const rt = new MissionRuntime(def, dlg, events, world);
    rt.start();
    const flags: Array<[string, boolean]> = [];
    const inter: string[] = [];
    events.on('MISSION_FLAG', (e) => flags.push([e.flag, e.value]));
    events.on('INTERACTABLE', (e) => inter.push(e.id));
    const step = (s: number): void => {
      for (let i = 0; i < s * 60; i++) {
        world.tick++;
        rt.step(1 / 60);
      }
    };
    step(0.1);
    expect(rt.state.currentNode).toBe('n_approach');
    expect(world.groupAlive('squad')).toBe(3);
    const foot = def.zones!.find((z) => z.id === 'foot_31')!;
    world.player = [foot.center[0], 0, foot.center[2]];
    step(0.1);
    expect(flags).toContainEqual(['arty', true]);
    step(29);
    expect(rt.state.currentNode).toBe('n_approach');
    step(1.5);
    expect(rt.state.currentNode).toBe('n_go');
    expect(flags).toContainEqual(['arty', false]);
    expect(flags).toContainEqual(['flares', true]);
    expect(inter).toEqual(['w1_charge']);
    // host giả lập: xong bộc phá → flag; nổ → flag _blown
    const blow = (k: string): void => {
      rt.state.flags[`${k}_charge`] = true;
      rt.state.flags[`${k}_charge_blown`] = true;
      step(0.1);
    };
    blow('w1');
    expect(rt.state.currentNode).toBe('n_wire2');
    expect(world.groupAlive('para_mg')).toBe(2);
    expect(inter).toEqual(['w1_charge', 'w2_charge']);
    blow('w2');
    expect(rt.state.currentNode).toBe('n_wire3');
    blow('w3');
    expect(rt.state.currentNode).toBe('n_mg');
    expect(world.groupAlive('para_trench')).toBe(6);
    world.kill('para_mg');
    step(0.1);
    expect(rt.state.currentNode).toBe('n_trench');
    expect(world.groupAlive('para_top')).toBe(5);
    world.kill('para_trench');
    step(0.1);
    expect(rt.state.currentNode).toBe('n_cp');
    const cp = def.zones!.find((z) => z.id === 'cp')!;
    world.player = [cp.center[0], 0, cp.center[2]];
    step(0.2);
    expect(rt.state.nodeActive).toBe(true);
    expect(flags).toContainEqual(['flares', false]);
    world.kill('para_top');
    step(0.1);
    expect(rt.state.currentNode).toBe('n_tanks');
    expect(flags).toContainEqual(['tanks', true]);
    step(14.5);
    expect(rt.state.currentNode).toBe('n_done');
    expect(rt.state.complete).toBe(true);
    expect(events.countOf('CHECKPOINT_SAVED')).toBe(3); // cp0, cpA, cpB
  });

  it('level: 3 lớp rào chỉ có đúng 3 đoạn _gap; props kind hợp lệ + model có trong danh sách nạp; cỏ tranh đè; HDRI đêm không đèn cảng', () => {
    const gaps = level.props.filter((p) => /_gap$/.test(p.id)).map((p) => p.id).sort();
    expect(gaps).toEqual(['wire_1_gap', 'wire_2_gap', 'wire_3_gap']);
    const ids = new Set(level.props.map((p) => p.id));
    expect(ids.size).toBe(level.props.length); // id duy nhất
    for (const p of level.props) {
      if (p.kind === 'wire') continue;
      const models = PROP_MODEL[p.kind as keyof typeof PROP_MODEL];
      expect(models, p.kind).toBeDefined();
      for (const m of models) expect(level.models).toContain(m);
      expect(PROP_HALF[p.kind as keyof typeof PROP_HALF]).toBeDefined();
    }
    expect(level.props.filter((p) => p.kind === 'wire').length).toBeGreaterThan(60);
    expect(level.props.filter((p) => p.kind === 'sandbag').length).toBeGreaterThan(50);
    const tall = level.vegetation.species.find((s) => s.id === 'grass_tall');
    expect(tall?.press).toBe(1);
    expect(level.sky.hdri).toBe('dikhololo_night');
    const m = JSON.parse(readFileSync('content/assets/manifest.json', 'utf8')) as { assets: Array<{ id: string; license: string }> };
    expect(m.assets.find((a) => a.id === 'dikhololo_night')?.license).toBe('CC0-1.0');
    expect(m.assets.find((a) => a.id === 'veg_grass_tall')?.license).toBe('CC0-1.0');
    expect(m.assets.find((a) => a.id === 'terrain_diem_cao_31')?.license).toBe('PD-USGov');
    // rào concertina: dài 6,4 m theo x, cao ~0,9–1,1 m, ≤ 2 000 tam giác
    const g = concertinaGeometry(6.4);
    g.computeBoundingBox();
    const s = g.boundingBox!.getSize(new Vector3());
    expect(s.x).toBeGreaterThan(6.2);
    expect(s.y).toBeGreaterThan(0.85);
    expect(s.y).toBeLessThan(1.15);
    expect(g.attributes['position']!.count / 3).toBeLessThan(2000);
  });
});
