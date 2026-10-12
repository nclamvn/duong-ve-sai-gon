/**
 * TIP-UX02 + TIP-M1A (unit): toán la bàn/marker (thuần), đội hình đồng đội (Squadmates goalFor) và mission M1 (schema + tham chiếu; đồ thị DV-085 ở m1Dv085.test.ts) — không DOM/three.
 */
import { describe, it, expect } from 'vitest';
import { bearingOf, relDeg } from '@ui/compass';
import { clampToEdge } from '@ui/markers';
import { Squadmates } from '@game/ai/squadmates';
import type { BotActor } from '@game/actors/botActor';
import { loadMission, loadDialogue } from '@game/mission/loader';
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
    const h = fakeActor('h', [2, 0, 2], 'name.long');
    sq.add(fakeActor('q', [0, 0, -2], 'name.quyet'), 'leader');
    sq.add(h, 'follower');
    expect(sq.goalFor('h')()).toBeNull(); // gần + đứng yên
    h.bot.position[2] = 20;
    const g = sq.goalFor('h')()!;
    expect(g.z).toBeCloseTo(3); // sau người chơi (fwd −z → sau = +z)
    expect(Math.abs(g.x)).toBeCloseTo(1.8); // AI-T1.5: đội hình rắn lệch 1,8 m
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
    sq.add(fakeActor('h', [0, 0, 0], 'name.long'), 'follower');
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

describe('mission M1 "Cổng Trời" (schema + tham chiếu; đồ thị DV-085 ở m1Dv085.test.ts)', () => {
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
    // zone nhiệm vụ nằm trong vùng navmesh của level (M1-T2: zone sống ở mission, level chỉ giữ zone bảo vệ khỏi hố bom)
    const nr = (levelJson.terrain as { navRect: { x: number; z: number; w: number; h: number } }).navRect;
    for (const z of def.zones ?? []) {
      expect(Math.abs(z.center[0] - nr.x), z.id).toBeLessThanOrEqual(nr.w / 2);
      expect(Math.abs(z.center[2] - nr.z), z.id).toBeLessThanOrEqual(nr.h / 2);
    }
  });
});
