/**
 * DV-085 M1 "Cổng Trời" bản dồn dập (BLUEPRINT-M1-T3): đồ thị 7 hồi chạy hết trên thế giới giả (đếm địch, trần 16 sống, hành động
 * chiến trường, đồng đội hy sinh đúng hồi, mục tiêu có marker, mỗi mục tiêu có câu chỉ huy, checkpoint), và mọi điểm ra quân/vùng
 * nhiệm vụ nằm trên đất đi được (dốc < 35°, không trong lòng suối, không trong hố bom).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { EventBus } from '@engine/core';
import { TerrainTile, type TerrainMeta } from '@engine/terrain/tile';
import type { TerrainFeaturesData } from '@engine/terrain/features';
import { loadMission, loadDialogue } from '@game/mission/loader';
import { MissionRuntime, type MissionWorld } from '@game/mission/runtime';
import type { MissionEvents, MissionAction } from '@game/mission/types';
import missionJson from '@content/missions/truong-son-a.mission.json';
import dialogueJson from '@content/missions/truong-son-a.dialogue.json';
import levelJson from '@content/levels/truong-son-a.level.json';

const def = loadMission(missionJson);
const dlg = loadDialogue(dialogueJson);
const zoneOf = (id: string): [number, number, number] => {
  const z = def.zones!.find((zz) => zz.id === id)!;
  return [z.center[0], 0, z.center[2]];
};

/** thế giới giả: bot sống/chết theo nhóm, đếm trần địch sống */
class W implements MissionWorld {
  player: [number, number, number] = [levelJson.playerSpawn[0]!, 0, levelJson.playerSpawn[1]!];
  actors = new Map<string, { group: string; alive: boolean }>();
  seq = 0;
  tick = 0;
  maxAlive = 0;
  spawned = 0;
  playerPosition(): [number, number, number] {
    return [...this.player] as [number, number, number];
  }
  squadLeaderPosition(): [number, number, number] | null {
    return null;
  }
  spawnGroup(groupId: string, count: number): string[] {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const id = `${groupId}_${this.seq++}`;
      this.actors.set(id, { group: groupId, alive: true });
      ids.push(id);
      if (groupId !== 'squad') this.spawned++;
    }
    this.maxAlive = Math.max(this.maxAlive, this.enemiesAlive());
    return ids;
  }
  groupAlive(g: string): number {
    let n = 0;
    for (const a of this.actors.values()) if (a.group === g && a.alive) n++;
    return n;
  }
  enemiesAlive(): number {
    let n = 0;
    for (const a of this.actors.values()) if (a.alive && a.group !== 'squad') n++;
    return n;
  }
  kill(g: string, leave = 0): void {
    const alive = [...this.actors.values()].filter((a) => a.group === g && a.alive);
    for (const a of alive.slice(0, Math.max(0, alive.length - leave))) a.alive = false;
  }
  killEnemies(): void {
    for (const a of this.actors.values()) if (a.group !== 'squad') a.alive = false;
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

function run() {
  const events = new EventBus<MissionEvents>(8192);
  const world = new W();
  const rt = new MissionRuntime(def, dlg, events, world);
  const battle: MissionAction[] = [];
  const cps: string[] = [];
  const objectives: Array<{ key: string; status: string; marker?: string; timerMs?: number }> = [];
  const radio: string[] = [];
  const hunts: string[] = [];
  const nodes: Array<{ node: string; t: number }> = [];
  let t = 0;
  events.on('BATTLE', (e) => battle.push(e.action));
  events.on('CHECKPOINT_SAVED', (e) => cps.push(e.checkpoint));
  events.on('OBJECTIVE', (e) => objectives.push({ key: e.key, status: e.status, marker: e.marker, timerMs: e.timerMs }));
  events.on('RADIO', (e) => radio.push(e.cue));
  events.on('GROUP_HUNT', (e) => hunts.push(e.group));
  events.on('NODE_ENTER', (e) => nodes.push({ node: e.node, t }));
  rt.start();
  const step = (s: number): void => {
    for (let i = 0; i < s * 20; i++) {
      world.tick++;
      t += 0.05;
      rt.step(0.05);
      world.maxAlive = Math.max(world.maxAlive, world.enemiesAlive());
    }
  };
  const node = (): string | null => rt.state.currentNode;
  return { events, world, rt, battle, cps, objectives, radio, hunts, nodes, step, node };
}

describe('DV-085 M1 bản dồn dập: đồ thị 7 hồi', () => {
  it('chạy hết: phục kích ngay đầu màn, napalm (Khang), sườn đồi, B-52 vào lòng suối, cảm biến 90 s, khe, dốc, bãi đáp (Hoàn), rút; 105–150 địch, ≤ 24 sống', () => {
    const r = run();
    const { world, step, node } = r;
    step(0.5);
    // HỒI 1: địch có mặt từ giây đầu, cối, mục tiêu có marker
    expect(node()).toBe('n_a1');
    expect(world.groupAlive('squad')).toBe(5);
    expect(world.groupAlive('a1_bo')).toBe(9);
    expect(r.radio[0]).toBe('M71');
    expect(r.objectives[0]).toMatchObject({ key: 'obj_m1_ambush', status: 'active', marker: 'bo_dong' });
    expect(r.battle.filter((a) => a.type !== 'fx').map((a) => a.type)).toEqual(['strike', 'mortar']);
    // DV-087: trận mở màn trong khói (sương thể tích) và rừng đang cháy
    expect(r.battle.find((a) => a.type === 'fx' && a.kind === 'haze')?.scale).toBeGreaterThan(0);
    expect(r.battle.filter((a) => a.type === 'fx' && a.kind !== 'haze').length).toBeGreaterThanOrEqual(4);
    step(22);
    expect(node()).toBe('n_a1b');
    expect(world.groupAlive('a1_suon')).toBe(5);
    world.kill('a1_bo', 2);
    step(25.2);
    expect(node()).toBe('n_a1c'); // đợt tiếp viện vượt suối từ bắc
    expect(world.groupAlive('a1_tiep')).toBe(5);
    world.kill('a1_suon', 1);
    world.kill('a1_tiep', 1);
    step(0.2);
    expect(node()).toBe('n_chase');
    expect(r.hunts).toContain('a1_bo'); // tàn quân lao lên, không nằm lại sau lưng
    world.killEnemies();
    // HỒI 2: tới bờ đông thì napalm; 13 s sau Khang hy sinh; toán chặn
    world.player = zoneOf('doc_dong');
    step(0.2);
    expect(node()).toBe('n_napalm');
    const napalm = r.battle.find((a) => a.type === 'napalm')!;
    expect(napalm.from).toBeDefined();
    expect(r.objectives.at(-1)).toMatchObject({ key: 'obj_m1_napalm', timerMs: 12000, marker: 'thoat' });
    step(13.2);
    expect(r.battle.find((a) => a.type === 'squad_kill')?.name).toBe('name.khang');
    step(5.2);
    expect(node()).toBe('n_chan');
    expect(world.groupAlive('chan') + world.groupAlive('chan_san')).toBe(14);
    world.kill('chan', 1);
    step(0.2);
    // DV-089 HỒI 3 theo nhịp Normandy: nín thở dưới chân đồi (thế giới lặng, tổ nằm giữ) → pháo dồn về phía tổ → xung phong
    expect(node()).toBe('n_doi_lull');
    expect(r.battle.some((a) => a.type === 'fx' && a.kind === 'hush')).toBe(true);
    step(16.2);
    expect(node()).toBe('n_doi_barrage');
    expect(r.battle.filter((a) => a.type === 'strike' && a.near !== undefined).length).toBeGreaterThanOrEqual(2);
    step(8);
    // sườn đồi → B-52: chạy vào lòng suối trong 22 s, ngoài vùng an toàn chịu sát thương
    expect(node()).toBe('n_doi');
    expect(world.groupAlive('doi_giu')).toBe(8);
    world.killEnemies();
    step(4.5);
    expect(node()).toBe('n_b52');
    expect(r.objectives.at(-1)).toMatchObject({ key: 'obj_m1_b52_run', timerMs: 22000, marker: 'ham' });
    expect(r.battle.find((a) => a.type === 'safe_zone')?.zone).toBe('ham');
    step(31.2);
    expect(node()).toBe('n_b52_after');
    expect(world.groupAlive('sot')).toBe(9);
    expect(r.battle.filter((a) => a.type === 'fx').length).toBeGreaterThanOrEqual(6);
    world.killEnemies();
    step(0.2);
    // HỒI 4: gài bộc phá (giữ F) → giữ chốt 90 s, hai mũi phản kích
    expect(node()).toBe('n_cb');
    r.rt.state.flags['bo_pha'] = true;
    step(0.2);
    expect(node()).toBe('n_cb_hold');
    expect(r.objectives.at(-1)).toMatchObject({ key: 'obj_m1_defend', timerMs: 90000 });
    expect(world.groupAlive('cb_bac')).toBe(8);
    step(30.2);
    expect(node()).toBe('n_cb_hold2');
    expect(world.groupAlive('cb_dong')).toBe(8);
    expect(world.groupAlive('cb_bac')).toBe(8); // DV-090 trần 24: đợt 2 (8 + 8 + 8 = 24) ra được khi tới hạn
    step(10);
    expect(world.groupAlive('cb_bac')).toBe(16);
    world.killEnemies();
    r.rt.state.flags['bo_pha_blown'] = true;
    step(0.2);
    expect(node()).toBe('n_khe_go');
    expect(world.groupAlive('f2')).toBe(9); // tổ phục đã nằm sẵn trong khe
    // HỒI 5: khe cạn
    world.player = zoneOf('khe');
    step(0.2);
    expect(node()).toBe('n_khe');
    expect(world.groupAlive('khe_mg') + world.groupAlive('khe_sau')).toBe(8);
    world.killEnemies();
    step(0.2);
    // HỒI 6: dốc — ổ súng giữ đỉnh, vòng sườn, tiếp viện 2 đợt, cối
    expect(node()).toBe('n_f3_go');
    expect(world.groupAlive('f3_hold')).toBe(6);
    world.player = zoneOf('doc');
    step(0.2);
    expect(node()).toBe('n_f3');
    expect(world.groupAlive('f3_flank')).toBe(6);
    step(35.2);
    expect(node()).toBe('n_f3b');
    world.kill('f3_hold');
    step(0.2);
    expect(node()).toBe('n_f3c'); // chiếm đỉnh → giữ 60 s trước phản kích
    expect(r.objectives.at(-1)).toMatchObject({ key: 'obj_m1_hold_hill', timerMs: 60000 });
    expect(world.groupAlive('f3_rf')).toBe(6);
    step(60.2);
    expect(node()).toBe('n_lz_go');
    expect(world.groupAlive('f3_rf')).toBe(12); // đợt 2 ra ở giây 25 của lúc giữ đỉnh
    expect(world.groupAlive('lz_a')).toBe(0); // 6 + 12 sống: toán giữ bãi (9) chờ chỗ dưới trần 24
    for (const g of ['f3_flank', 'f3_rf']) world.kill(g);
    step(1.2);
    expect(world.groupAlive('lz_a')).toBe(9);
    // HỒI 7: bãi đáp — 2 lượt trực thăng, giữ 90 s, Hoàn hy sinh, pháo ta bắn chặn, rút
    world.player = zoneOf('lz');
    step(0.2);
    expect(node()).toBe('n_lz');
    expect(world.groupAlive('lz_a')).toBe(9);
    step(34.2);
    expect(node()).toBe('n_lz2');
    expect(r.objectives.at(-1)).toMatchObject({ key: 'obj_m1_lz_hold', timerMs: 90000 });
    step(42.5);
    expect(r.battle.filter((a) => a.type === 'squad_kill').map((a) => a.name)).toEqual(['name.khang', 'name.hoan']);
    world.killEnemies();
    step(48);
    expect(node()).toBe('n_lz_done');
    expect(r.battle.filter((a) => a.type !== 'fx').at(-1)).toMatchObject({ type: 'mortar', kind: 'artillery' });
    world.player = zoneOf('rut');
    step(7);
    expect(node()).toBe('n_done');
    expect(r.rt.state.complete).toBe(true);
    expect(r.radio.slice(-2)).toEqual(['M00', 'M09']);
    expect(r.cps).toEqual(def.checkpoints);
    expect(r.cps.length).toBe(7);
    expect(world.spawned, 'tổng địch (DV-090 × 1,5)').toBeGreaterThanOrEqual(105);
    expect(world.spawned).toBeLessThanOrEqual(150);
    expect(world.maxAlive, 'địch sống cùng lúc').toBeLessThanOrEqual(24);
    expect(r.events.countOf('MISSION_COMPLETE')).toBe(1);
  });

  it('không giết ai: tiếp viện chờ dưới trần 24 sống, "còn ít" chưa đúng khi đợt còn chờ; nút nào cũng có lối ra theo giờ', () => {
    const r = run();
    const { world, step, node } = r;
    for (let k = 0; k < 200 && !r.rt.state.complete; k++) {
      // người chơi đi theo marker hiện tại (không bắn ai); gài bộc phá khi tới
      const m = r.objectives.filter((o) => o.status === 'active').at(-1)?.marker;
      if (m && m !== '@leader') world.player = zoneOf(m);
      if (node() === 'n_cb') r.rt.state.flags['bo_pha'] = true;
      if (node() === 'n_cb_hold2') r.rt.state.flags['bo_pha_blown'] = true;
      step(15);
      // giả lập đồng đội + người chơi hạ dần địch: mỗi 15 s chết 3 đứa
      let n = 0;
      for (const a of world.actors.values()) if (a.alive && a.group !== 'squad' && n++ < 3) a.alive = false;
    }
    expect(r.rt.state.complete).toBe(true);
    expect(world.maxAlive).toBeLessThanOrEqual(24);
    // thời gian kịch bản khi đi tức thời giữa các marker (đường đi thật thêm 4–6 phút; đo đủ ở E2E playtime-m1)
    const tEnd = r.nodes.at(-1)!.t;
    expect(tEnd / 60).toBeGreaterThan(7);
    expect(tEnd / 60).toBeLessThan(40);
  });

  it('mỗi nút giao mục tiêu đều có câu chỉ huy; mọi mục tiêu có marker; mọi cue có trong thoại; không còn câu "còn đủ cả" (M68)', () => {
    const cues = new Set(dlg.cues.map((c) => c.cueId));
    const zones = new Set(def.zones!.map((z) => z.id));
    for (const n of def.nodes) {
      const objs = n.actions.filter((a) => a.type === 'objective');
      if (objs.length) expect(n.actions.some((a) => a.type === 'radio'), n.id).toBe(true);
      for (const o of objs) expect(zones.has(o.marker ?? ''), `${n.id} ${o.objectiveKey}`).toBe(true);
      for (const a of n.actions) {
        if (a.type === 'radio') expect(cues.has(a.cue!), a.cue).toBe(true);
        if (a.zone) expect(zones.has(a.zone), `${n.id} zone ${a.zone}`).toBe(true);
        if (a.type === 'squad_kill') expect(['name.khang', 'name.hoan']).toContain(a.name);
        expect(a.cue).not.toBe('M68');
      }
      if (n.type !== 'terminal' && !n.exitConditions.some((c) => c.type === 'always' || c.type === 'active_ms')) expect(n.timeoutMs, `${n.id} cần lối ra theo giờ`).toBeGreaterThan(0);
    }
  });
});

describe('DV-085 M1: điểm ra quân và vùng nhiệm vụ trên đất đi được', () => {
  const DIR = 'public/assets/terrain/truong-son-a';
  const meta = JSON.parse(readFileSync(`${DIR}/meta.json`, 'utf8')) as TerrainMeta;
  const feat = JSON.parse(readFileSync(`${DIR}/features.json`, 'utf8')) as TerrainFeaturesData;
  const buf = readFileSync(`${DIR}/height.r16`);
  const tile = new TerrainTile(meta, new Uint16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), (levelJson.terrain as { yOffset: number }).yOffset);
  tile.setFeatures(feat);
  const slopeDeg = (x: number, z: number): number => {
    let m = 0;
    for (const [dx, dz] of [[1.5, 0], [0, 1.5], [1.5, 1.5], [1.5, -1.5]] as const) m = Math.max(m, Math.abs(tile.sample(x + dx, z + dz) - tile.sample(x - dx, z - dz)) / (2 * Math.hypot(dx, dz)));
    return (Math.atan(m) * 180) / Math.PI;
  };
  const waterDist = (x: number, z: number): number => {
    let d = Infinity;
    for (const s of feat.streams) {
      if (!s.water) continue;
      const p = s.pts;
      for (let i = 0; i < p.length - 1; i++) {
        const [ax, az] = p[i]!;
        const [bx, bz] = p[i + 1]!;
        const vx = bx! - ax!;
        const vz = bz! - az!;
        const u = Math.max(0, Math.min(1, ((x - ax!) * vx + (z - az!) * vz) / (vx * vx + vz * vz || 1)));
        d = Math.min(d, Math.hypot(x - ax! - vx * u, z - az! - vz * u));
      }
    }
    return d;
  };
  const inCrater = (x: number, z: number): boolean => feat.craters.some((c) => Math.hypot(x - c.x, z - c.z) < c.r);

  it('mọi điểm ra quân của M1 (và chỗ xuất phát): dốc < 35°, cách nước > 4 m, ngoài hố bom', () => {
    const spawns = levelJson.botSpawns as Record<string, number[]>;
    const used = new Set<string>();
    for (const g of def.spawnGroups ?? []) for (const s of g.spawns ?? [g.spawn]) used.add(s);
    const bad: string[] = [];
    for (const k of [...used, '@player']) {
      const p = k === '@player' ? (levelJson.playerSpawn as number[]) : spawns[k]!;
      const [x, z] = [p[0]!, p[p.length - 1]!];
      const s = slopeDeg(x, z);
      const w = waterDist(x, z);
      if (s >= 35 || w <= 4 || inCrater(x, z)) bad.push(`${k} (${x},${z}) dốc ${s.toFixed(0)} nước ${w.toFixed(1)} hố ${inCrater(x, z)}`);
    }
    expect(bad).toEqual([]);
  });

  it('địch ra quân không trong 25 m quanh chỗ xuất phát của người chơi (trừ tổ phục kích bờ bên kia ≥ 35 m)', () => {
    const spawns = levelJson.botSpawns as Record<string, number[]>;
    const ps = levelJson.playerSpawn as number[];
    for (const g of def.spawnGroups ?? []) {
      if (g.faction === 'friend') continue;
      for (const s of g.spawns ?? [g.spawn]) {
        const p = spawns[s]!;
        expect(Math.hypot(p[0]! - ps[0]!, p[p.length - 1]! - ps[1]!), s).toBeGreaterThan(g.id === 'a1_bo' ? 35 : 25);
      }
    }
  });

  it('vùng nhiệm vụ: tâm trên đất đi được (vùng "ham" là lòng suối nên được phép gần nước)', () => {
    for (const z of def.zones ?? []) {
      expect(slopeDeg(z.center[0], z.center[2]), z.id).toBeLessThan(35);
      if (z.id !== 'ham') expect(waterDist(z.center[0], z.center[2]), z.id).toBeGreaterThan(4);
    }
  });
});
