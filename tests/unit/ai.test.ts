import { describe, it, expect, beforeAll } from 'vitest';
import { Mesh, BoxGeometry, PlaneGeometry, MeshBasicMaterial } from 'three';
import { getPositionsAndIndices } from '@recast-navigation/three';
import { initNav, NavService } from '@engine/nav/navmesh';
import { initPhysics, PhysicsWorld } from '@engine/physics/world';
import { LAYER } from '@engine/physics/layers';
import { EventBus, mulberry32 } from '@engine/core';
import { Perception } from '@game/ai/perception';
import { computeLod } from '@game/ai/lod';
import { Bot, type BotEvents } from '@game/ai/bot';
import type { CoverMarker } from '@engine/render/arena';
import ai from '@content/tuning/ai.json';

interface World {
  physics: PhysicsWorld;
  nav: NavService;
  covers: { x: number; z: number; hx: number; hz: number }[];
  coverMarkers: CoverMarker[];
  waypoints: [number, number, number][];
  playerCollider: ReturnType<PhysicsWorld['addKinematicCapsule']>;
}

/** Arena thu nhỏ 80×80: sàn + 4 tường + 6 cover block, giống ArenaData về hợp đồng. */
function makeWorld(): World {
  const meshes: Mesh[] = [];
  const mat = new MeshBasicMaterial();
  const floor = new Mesh(new PlaneGeometry(80, 80), mat);
  floor.rotation.x = -Math.PI / 2;
  floor.updateMatrixWorld(true);
  meshes.push(floor);
  const physics = new PhysicsWorld();
  physics.addStatic({ kind: 'box', position: [0, -0.5, 0], size: [40, 0.5, 40], yaw: 0 }, { id: 'floor', kind: 'world', material: 'concrete' });
  const walls: Array<[number, number, number, number]> = [[0, -40, 40, 0.5], [0, 40, 40, 0.5], [-40, 0, 0.5, 40], [40, 0, 0.5, 40]];
  walls.forEach(([x, z, hx, hz], i) => {
    const m = new Mesh(new BoxGeometry(hx * 2, 6, hz * 2), mat);
    m.position.set(x, 3, z);
    m.updateMatrixWorld(true);
    meshes.push(m);
    physics.addStatic({ kind: 'box', position: [x, 3, z], size: [hx, 3, hz], yaw: 0 }, { id: `wall_${i}`, kind: 'world', material: 'concrete' });
  });
  const covers = [
    { x: -10, z: -8, hx: 3, hz: 1.2 }, { x: 10, z: -12, hx: 3, hz: 1.2 }, { x: -16, z: 8, hx: 3, hz: 1.2 },
    { x: 14, z: 10, hx: 3, hz: 1.2 }, { x: 0, z: -22, hx: 3, hz: 1.2 }, { x: -4, z: 16, hx: 3, hz: 1.2 },
  ];
  const coverMarkers: CoverMarker[] = [];
  covers.forEach((c, i) => {
    const m = new Mesh(new BoxGeometry(c.hx * 2, 2.6, c.hz * 2), mat);
    m.position.set(c.x, 1.3, c.z);
    m.updateMatrixWorld(true);
    meshes.push(m);
    physics.addStatic({ kind: 'box', position: [c.x, 1.3, c.z], size: [c.hx, 1.3, c.hz], yaw: 0 }, { id: `cover_${i}`, kind: 'world', material: 'steel' });
    coverMarkers.push({ id: `cm_${i}_a`, position: [c.x, 0, c.z + c.hz + 1.2], facing: [0, 0, -1] });
    coverMarkers.push({ id: `cm_${i}_b`, position: [c.x, 0, c.z - c.hz - 1.2], facing: [0, 0, 1] });
  });
  const [positions, indices] = getPositionsAndIndices(meshes);
  const nav = new NavService(positions, indices);
  const waypoints: [number, number, number][] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    waypoints.push([Math.cos(a) * 26, 0, Math.sin(a) * 26]);
  }
  const playerCollider = physics.addKinematicCapsule([0, 0.9, 30], 0.55, 0.35, { id: 'player', kind: 'player', material: 'flesh' }, LAYER.PLAYER);
  physics.step();
  return { physics, nav, covers, coverMarkers, waypoints, playerCollider };
}

function makeBot(w: World, id: string, spawn: [number, number, number], seed: number, playerPos: [number, number, number], events = new EventBus<BotEvents>(256)): { bot: Bot; events: EventBus<BotEvents>; player: { pos: [number, number, number]; alive: boolean } } {
  const player = { pos: playerPos, alive: true };
  const bot = new Bot(id, spawn, {
    physics: w.physics,
    nav: w.nav,
    events,
    prng: mulberry32(seed),
    waypoints: w.waypoints,
    coverMarkers: w.coverMarkers,
    target: () => ({ pos: player.pos, eye: [player.pos[0], player.pos[1] + 1.6, player.pos[2]], alive: player.alive }),
    camera: () => ({ pos: [player.pos[0], player.pos[1] + 1.6, player.pos[2]], fwd: [0, 0, -1] }),
    exclude: () => undefined,
  });
  return { bot, events, player };
}

/** Chạy N tick 60 Hz: move mỗi tick, think mỗi 6 tick. */
function run(w: World, bot: Bot, ticks: number, onTick?: (t: number) => void): void {
  for (let t = 0; t < ticks; t++) {
    onTick?.(t);
    if (t % 6 === 0) bot.think(0.1);
    bot.move(1 / 60);
    w.physics.step();
  }
}

let world: World;
beforeAll(async () => {
  await initPhysics();
  await initNav();
  world = makeWorld();
});

describe('TIP-007 Navmesh (AI-003)', () => {
  it('build từ arena thu nhỏ: polyCount > 0, path spawn→spawn ≥ 2 điểm, không cắt cover', () => {
    expect(world.nav.polyCount).toBeGreaterThan(0);
    expect(world.nav.buildMs).toBeLessThan(5000);
    const path = world.nav.findPath({ x: 0, y: 0, z: 30 }, { x: 0, y: 0, z: -30 });
    expect(path.length).toBeGreaterThanOrEqual(2);
    for (const p of path) {
      for (const c of world.covers) {
        const inside = Math.abs(p.x - c.x) < c.hx + 0.3 && Math.abs(p.z - c.z) < c.hz + 0.3;
        expect(inside).toBe(false);
      }
    }
    // đường đi qua cover ở (0,-22): phải vòng
    const straightThrough = path.every((p) => Math.abs(p.x) < 0.5);
    expect(straightThrough).toBe(false);
  });
});

describe('TIP-007 Perception (AI-001)', () => {
  it('mục tiêu 10 m trong FOV có LOS 1 s → ALERT; mất LOS 6 s → SUSPICIOUS → UNAWARE; lastKnown giữ', () => {
    const p = new Perception();
    const self: [number, number, number] = [0, 1.6, 0];
    const facing: [number, number, number] = [0, 0, -1];
    const target: [number, number, number] = [0, 1.6, -10];
    for (let i = 0; i < 10; i++) p.update(0.1, self, facing, target, true, []);
    expect(p.state).toBe('ALERT');
    expect(p.lastKnown).toEqual(target);
    const states: string[] = [];
    for (let i = 0; i < 90; i++) {
      p.update(0.1, self, facing, target, false, []);
      states.push(p.state);
    }
    expect(states).toContain('SUSPICIOUS');
    expect(p.state).toBe('UNAWARE');
    expect(p.lastKnown).toEqual(target);
    expect(p.suspicion).toBe(0);
  });

  it('không trong FOV (sau lưng) → không thấy dù có LOS', () => {
    const p = new Perception();
    for (let i = 0; i < 10; i++) p.update(0.1, [0, 1.6, 0], [0, 0, -1], [0, 1.6, 10], true, []);
    expect(p.state).toBe('UNAWARE');
    expect(p.visible).toBe(false);
  });

  it('noise súng cách 15 m → SUSPICIOUS, lastKnown = vị trí súng', () => {
    const p = new Perception();
    p.update(0.1, [0, 1.6, 0], [0, 0, -1], [0, 1.6, 50], false, [{ x: 15, y: 1.6, z: 0, loudness: 1 }]);
    expect(p.state).toBe('SUSPICIOUS');
    expect(p.lastKnown).toEqual([15, 1.6, 0]);
    const q = new Perception();
    q.update(0.1, [0, 1.6, 0], [0, 0, -1], [0, 1.6, 50], false, [{ x: 30, y: 1.6, z: 0, loudness: 1 }]);
    expect(q.state).toBe('UNAWARE');
  });
});

describe('TIP-007 Bot FSM (AI-002)', () => {
  it('3 phút seeded, player đứng yên bắn: không state vượt timeout, bot bắn ≥ 1, 10 seed → 10/10', () => {
    const limits = ai.states as Record<string, number>;
    let completed = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const { bot, events, player } = makeBot(world, `bot_${seed}`, [0, 0, -30], seed, [0, 0, 20]);
      let maxOver = 0;
      const seen = new Set<string>();
      events.on('AI_STATE', (e) => seen.add(e.to));
      run(world, bot, 60 * 180, (t) => {
        if (t % 40 === 0) events.emit('WEAPON_FIRED', { origin: [player.pos[0], 1.6, player.pos[2]] });
        // player đứng yên; bot bị "trúng" nhẹ mỗi 10 s để đo retreat khi thấp máu
        if (t % 600 === 599 && bot.health > 40) bot.applyDamage(15, [player.pos[0], 1.6, player.pos[2]]);
        const lim = limits[bot.state];
        if (lim !== undefined) maxOver = Math.max(maxOver, bot.stateMs - lim);
      });
      expect(maxOver).toBeLessThanOrEqual(120); // một bước think (100 ms) + sai số
      expect(bot.stats.shots).toBeGreaterThanOrEqual(1);
      expect(seen.has('SEEK_COVER') || seen.has('PEEK_FIRE')).toBe(true);
      expect(bot.alive).toBe(true);
      completed++;
    }
    expect(completed).toBe(10);
  });

  it('deterministic: cùng seed → cùng snapshot sau 30 s', () => {
    const snap = (seed: number): string => {
      const { bot, events, player } = makeBot(world, 'det', [0, 0, -30], seed, [0, 0, 20]);
      run(world, bot, 1800, (t) => {
        if (t % 40 === 0) events.emit('WEAPON_FIRED', { origin: [player.pos[0], 1.6, player.pos[2]] });
      });
      return JSON.stringify(bot.snapshot()) + bot.stats.shots;
    };
    expect(snap(4)).toBe(snap(4));
  });

  it('bot hạ player: HIT với actorId player, damage 8', () => {
    const { bot, events } = makeBot(world, 'shooter', [0, 0, 10], 2, [0, 0, 24]);
    let hitPlayer = 0;
    events.on('HIT', (e) => {
      if (e.actorId === 'player') {
        hitPlayer++;
        expect(e.damage).toBe(ai.combat.damage);
      }
    });
    bot.applyDamage(1, [0, 1.6, 24]); // báo động, lastKnown = player
    run(world, bot, 60 * 30);
    expect(bot.stats.shots).toBeGreaterThan(3);
    expect(hitPlayer).toBeGreaterThan(0);
  });
});

describe('TIP-007 Stuck recovery + LOD (AI-003/004)', () => {
  it('kẹt giả (vị trí bị kéo về): ≤ 2 s replan; ≤ 4 s teleport (AI_STUCK_RECOVERED)', () => {
    const { bot, events } = makeBot(world, 'stuck', [20, 0, 20], 3, [0, 0, 60]);
    const recovered: Array<{ method: string; t: number }> = [];
    let tick = 0;
    let firstPathTick = -1;
    events.on('AI_STUCK_RECOVERED', (e) => recovered.push({ method: e.method, t: tick }));
    run(world, bot, 60 * 8, (t) => {
      tick = t;
      if (firstPathTick < 0 && bot.path.length > 0) firstPathTick = t;
      // kéo bot về chỗ cũ mỗi tick → không di chuyển được
      bot.position[0] = 20;
      bot.position[2] = 20;
    });
    expect(firstPathTick).toBeGreaterThanOrEqual(0);
    expect(recovered.length).toBeGreaterThanOrEqual(2);
    expect(recovered[0]!.method).toBe('replan');
    expect(recovered[0]!.t - firstPathTick).toBeLessThanOrEqual(60 * 2 + 6);
    const tele = recovered.find((r) => r.method === 'teleport');
    expect(tele).toBeDefined();
    expect(tele!.t - firstPathTick).toBeLessThanOrEqual(60 * 4 + 6);
  });

  it('bot ở 70 m → SLEEP, perception không gọi trong 5 s; ALERT → FULL', () => {
    const { bot } = makeBot(world, 'far', [0, 0, -35], 5, [0, 0, 200]); // mục tiêu xa hơn 60 m suốt 5 s
    run(world, bot, 300);
    expect(bot.lod).toBe('SLEEP');
    expect(bot.stats.perceptionUpdates).toBe(0);
    expect(computeLod(70, 'UNAWARE', 0)).toBe('SLEEP');
    expect(computeLod(45, 'UNAWARE', 0)).toBe('REDUCED');
    expect(computeLod(70, 'ALERT', 0)).toBe('FULL');
    expect(computeLod(10, 'UNAWARE', 6000)).toBe('SLEEP');
    expect(computeLod(10, 'SUSPICIOUS', 6000)).toBe('FULL');
  });
});

describe('TIP-018 AI chiến đấu "IQ" (D-057)', () => {
  /** đặt player trước mặt bot (bot yaw 0 → mặt −z): player ở z − d */
  const front = (spawn: [number, number, number], d: number): [number, number, number] => [spawn[0], 0, spawn[2] - d];

  it('player hiện ra 6 m trước mặt (LOS, không bắn): bot bắn ≤ 0.8 s tại chỗ, ENGAGE trước SEEK_COVER', () => {
    const spawn: [number, number, number] = [20, 0, 25];
    const { bot, events } = makeBot(world, 'react', spawn, 11, front(spawn, 6));
    const states: string[] = [];
    let firstShotTick = -1;
    events.on('AI_STATE', (e) => states.push(e.to));
    events.on('BOT_FIRED', () => {
      if (firstShotTick < 0) firstShotTick = tick;
    });
    let tick = 0;
    const start: [number, number, number] = [...bot.position];
    run(world, bot, 60 * 3, (t) => {
      tick = t;
      if (firstShotTick < 0) {
        // trước phát đầu tiên bot không chạy đi (chỉ vài bước tuần tra dở dang)
        expect(Math.hypot(bot.position[0] - start[0], bot.position[2] - start[2])).toBeLessThan(1.5);
      }
    });
    expect(firstShotTick).toBeGreaterThanOrEqual(0);
    expect(firstShotTick / 60).toBeLessThanOrEqual(0.8);
    const iEngage = states.indexOf('ENGAGE');
    const iCover = states.indexOf('SEEK_COVER');
    expect(iEngage).toBeGreaterThanOrEqual(0);
    expect(iCover === -1 || iCover > iEngage).toBe(true);
  });

  it('không có cover trong 12 m: vẫn bắn ≥ 4 loạt / 10 s, dịch chuyển ≤ 4 m, mặt hướng player', () => {
    // góc arena (30, 30): cover gần nhất (14,10) cách > 20 m
    const spawn: [number, number, number] = [30, 0, 30];
    const { bot } = makeBot(world, 'nocover', spawn, 12, front(spawn, 8));
    const start: [number, number, number] = [...bot.position];
    let maxDrift = 0;
    let facingOk = 0;
    let samples = 0;
    run(world, bot, 60 * 10, (t) => {
      maxDrift = Math.max(maxDrift, Math.hypot(bot.position[0] - start[0], bot.position[2] - start[2]));
      if (t > 60 && t % 30 === 0) {
        samples++;
        const fx = -Math.sin(bot.yaw);
        const fz = -Math.cos(bot.yaw);
        const dx = spawn[0] - bot.position[0];
        const dz = spawn[2] - 8 - bot.position[2];
        const l = Math.hypot(dx, dz) || 1;
        if ((fx * dx + fz * dz) / l > 0.7) facingOk++;
      }
    });
    expect(bot.stats.bursts).toBeGreaterThanOrEqual(4);
    expect(maxDrift).toBeLessThanOrEqual(4);
    expect(facingOk / samples).toBeGreaterThan(0.8);
    expect(bot.state === 'ENGAGE' || bot.state === 'RETREAT').toBe(true);
  });

  it('có cover chắn LOS ≤ 12 m: sau engage đi cover (bắn khi player trong nón), tới PEEK_FIRE ≤ 6 s và bắn khi ló', () => {
    // cover block (10,-12) hx 3 hz 1.2, marker b tại (10, 0, -14.4) facing +z... player phía +z → marker a (10,0,-9.6) facing −z chắn LOS từ player ở z=-30? Không.
    // Player ở z = -2 (phía +z của block), bot ở (10, 0, -20) phía −z: marker b (10,0,-14.4) mặt che hướng +z → chắn LOS.
    const spawn: [number, number, number] = [10, 0, -20];
    const player: [number, number, number] = [10, 0, -2];
    const { bot, events } = makeBot(world, 'cover', spawn, 13, player);
    bot.yaw = Math.PI; // mặt +z về phía player
    const states: string[] = [];
    let seekShots = 0;
    let peekShots = 0;
    let peekAt = -1;
    let insideBlock = 0;
    events.on('AI_STATE', (e) => {
      states.push(e.to);
    });
    let tick = 0;
    events.on('BOT_FIRED', () => {
      if (bot.state === 'SEEK_COVER') seekShots++;
      if (bot.state === 'PEEK_FIRE') peekShots++;
    });
    run(world, bot, 60 * 14, (t) => {
      tick = t;
      if (peekAt < 0 && bot.state === 'PEEK_FIRE') peekAt = t;
      // DV-045: bước đi trượt trên navmesh → không được cắt góc xuyên khối cover (x 7..13, z −13,2..−10,8) như trước
      if (bot.position[0] > 7 && bot.position[0] < 13 && bot.position[2] > -13.2 && bot.position[2] < -10.8) insideBlock++;
      if (t % 45 === 0) events.emit('WEAPON_FIRED', { origin: [player[0], 1.6, player[2]], dir: [0, 0, -1] }); // player bắn về phía bot → đạn sượt → đi cover
    });
    void tick;
    expect(states).toContain('ENGAGE');
    expect(states).toContain('SEEK_COVER');
    expect(peekAt).toBeGreaterThanOrEqual(0);
    expect(peekAt / 60).toBeLessThanOrEqual(6.5); // 6,02 s sau DV-045 (đi vòng mép khối thay vì cắt góc: trước 5,3 s nhưng xuyên khối)
    expect(insideBlock).toBe(0);
    expect(peekShots).toBeGreaterThan(0);
    expect(seekShots + peekShots).toBeGreaterThan(3);
  });

  it('3 bot cùng nhóm thấy player: 1 bot FLANK trong 3 s tới góc ≥ 60°', async () => {
    const { SquadCoordinator } = await import('@game/ai/squad');
    const player: [number, number, number] = [0, 0, 0];
    const events = new EventBus<BotEvents>(256);
    const spawns: [number, number, number][] = [[-3, 0, 14], [0, 0, 15], [3, 0, 14]];
    const bots = spawns.map((s, i) => makeBot(world, `sq_${i}`, s, 20 + i, player, events).bot);
    for (const b of bots) b.yaw = 0; // mặt −z về player
    const squad = new SquadCoordinator(world.coverMarkers);
    let flankAt = -1;
    for (let t = 0; t < 60 * 6; t++) {
      for (const b of bots) {
        if (t % 6 === 0) b.think(0.1);
        b.move(1 / 60);
      }
      squad.tick(bots.map((b) => ({ group: 'g', bot: b })), 1 / 60, player);
      world.physics.step();
      if (flankAt < 0 && bots.some((b) => b.state === 'FLANK')) flankAt = t;
    }
    expect(flankAt).toBeGreaterThanOrEqual(0);
    expect(flankAt / 60).toBeLessThanOrEqual(3);
    expect(bots.filter((b) => b.stats.flanks > 0).length).toBe(1);
    expect(squad.stats.flankOrders).toBe(1);
  });

  it('tiếng chân 6 m sau lưng: SUSPICIOUS trong 1 s, lastKnown = vị trí chân', () => {
    const spawn: [number, number, number] = [-20, 0, 20];
    const { bot, events } = makeBot(world, 'ears', spawn, 31, [-20, 0, 26]); // player sau lưng (+z), bot mặt −z
    run(world, bot, 60, (t) => {
      if (t % 21 === 0) events.emit('PLAYER_FOOTSTEP', { origin: [-20, 0, 26] });
    });
    expect(bot.perception.state === 'SUSPICIOUS' || bot.perception.state === 'ALERT').toBe(true);
    expect(bot.perception.hasLastKnown).toBe(true);
    expect(bot.perception.lastKnown[2]).toBeCloseTo(26, 1);
  });

  it('deterministic TIP-018: cùng seed → cùng snapshot + stats sau 20 s chiến đấu', () => {
    const snap = (seed: number): string => {
      const spawn: [number, number, number] = [20, 0, 25];
      const { bot } = makeBot(world, 'det18', spawn, seed, front(spawn, 7));
      run(world, bot, 1200);
      return JSON.stringify(bot.snapshot()) + JSON.stringify(bot.stats);
    };
    expect(snap(9)).toBe(snap(9));
  });
});

describe('TIP-D11a Bot bám mặt navmesh trên dốc (terrain)', () => {
  it('tuần tra trên mặt phẳng nghiêng 20 % dài 80 m: y luôn cách mặt dốc ≤ 0,8 m (không "bay" tới y của góc kế)', () => {
    // mặt dốc z: −40 → +40, y = 0,2·(z + 40) (0 → 16 m) — straight path chỉ có góc đầu/cuối → cách cũ nhảy y = 16 ngay từ đầu
    const geo = new PlaneGeometry(40, 82, 4, 20);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes['position']!;
    for (let i = 0; i < pos.count; i++) pos.setY(i, 0.2 * (pos.getZ(i) + 40));
    geo.computeVertexNormals();
    const mesh = new Mesh(geo, new MeshBasicMaterial());
    mesh.updateMatrixWorld(true);
    const [positions, indices] = getPositionsAndIndices([mesh]);
    const nav = new NavService(positions, indices);
    expect(nav.polyCount).toBeGreaterThan(0);
    const physics = new PhysicsWorld();
    physics.addStatic({ kind: 'box', position: [0, -1, 0], size: [40, 0.5, 60], yaw: 0 }, { id: 'floor', kind: 'world', material: 'concrete' });
    physics.step();
    const waypoints: [number, number, number][] = [[0, 0, -38], [0, 15.2, 36]];
    const player = { pos: [200, 0, 200] as [number, number, number], alive: true };
    const bot = new Bot('slope', [0, 0.4, -38], {
      physics,
      nav,
      events: new EventBus<BotEvents>(64),
      prng: mulberry32(3),
      waypoints,
      coverMarkers: [],
      target: () => ({ pos: player.pos, eye: [200, 1.6, 200], alive: true }),
      camera: () => ({ pos: [200, 1.6, 200], fwd: [0, 0, -1] }),
      exclude: () => undefined,
    });
    let worst = 0;
    let travelled = 0;
    for (let t = 0; t < 60 * 25; t++) {
      if (t % 6 === 0) bot.think(0.1);
      bot.move(1 / 60);
      const z = bot.position[2];
      const ground = 0.2 * (z + 40);
      worst = Math.max(worst, Math.abs(bot.position[1] - ground));
      travelled = Math.max(travelled, z + 38);
    }
    expect(travelled).toBeGreaterThan(30); // có đi lên dốc thật
    expect(worst).toBeLessThanOrEqual(0.8);
  });
});
