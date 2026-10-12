/**
 * Rừng thử cho AI-T1 (DV-071): sàn 100 × 100, thân cây (trụ), khúc gỗ đổ (che thấp 1,2 m), tảng đá (che cao), navmesh +
 * physics tĩnh. Dùng chung cho test hành vi và bộ đo AI (AiHarness).
 */
import { Mesh, BoxGeometry, PlaneGeometry, CylinderGeometry, MeshBasicMaterial } from 'three';
import { getPositionsAndIndices } from '@recast-navigation/three';
import { NavService } from '@engine/nav/navmesh';
import { PhysicsWorld } from '@engine/physics/world';
import { LAYER } from '@engine/physics/layers';
import { EventBus, mulberry32 } from '@engine/core';
import { Bot, type BotEvents, type BotTarget, type GrenadeLink } from '@game/ai/bot';
import { CoverField } from '@game/ai/coverField';
import { TacticalEvaluator } from '@game/ai/tactics';
import { FireTeams, AttackTokens } from '@game/ai/squad';
import type RAPIER from '@dimforge/rapier3d-compat';

type V3 = [number, number, number];

export interface ForestWorld {
  physics: PhysicsWorld;
  nav: NavService;
  tactics: TacticalEvaluator;
  trees: Array<{ x: number; z: number; r: number }>;
  waypoints: V3[];
}

/** rừng thưa tất định: cây ~ mỗi 7 m (lệch ngẫu nhiên), dọn trống quanh (0, ±40); vài khúc gỗ + tảng đá */
export function makeForest(seed = 7): ForestWorld {
  const meshes: Mesh[] = [];
  const mat = new MeshBasicMaterial();
  const physics = new PhysicsWorld();
  const floor = new Mesh(new PlaneGeometry(100, 100), mat);
  floor.rotation.x = -Math.PI / 2;
  floor.updateMatrixWorld(true);
  meshes.push(floor);
  physics.addStatic({ kind: 'box', position: [0, -0.5, 0], size: [50, 0.5, 50], yaw: 0 }, { id: 'floor', kind: 'world', material: 'earth' });
  const rnd = mulberry32(seed);
  const trees: Array<{ x: number; z: number; r: number }> = [];
  for (let gx = -42; gx <= 42; gx += 7) {
    for (let gz = -42; gz <= 42; gz += 7) {
      const x = gx + (rnd.next() - 0.5) * 4;
      const z = gz + (rnd.next() - 0.5) * 4;
      if (Math.abs(x) < 5 && Math.abs(Math.abs(z) - 40) < 5) continue; // chỗ đứng của hai bên
      if (rnd.next() < 0.25) continue;
      const r = 0.28 + rnd.next() * 0.3;
      trees.push({ x, z, r });
      const m = new Mesh(new CylinderGeometry(r, r, 8, 8), mat);
      m.position.set(x, 4, z);
      m.updateMatrixWorld(true);
      meshes.push(m);
      physics.addStatic({ kind: 'cylinder', position: [x, 4, z], size: [r, 4, 0], yaw: 0 }, { id: `veg_tree_${trees.length}`, kind: 'world', material: 'wood' });
    }
  }
  // khúc gỗ đổ (che thấp) và tảng đá (che cao)
  const boxes: Array<[number, number, number, number, number]> = [
    [-8, 6, 2.2, 0.6, 0.35],
    [9, -4, 2.4, 0.6, 0.35],
    [-14, -10, 2.0, 0.6, 0.35],
    [16, 12, 1.4, 1.3, 1.4],
    [-18, 18, 1.6, 1.3, 1.2],
  ];
  boxes.forEach(([x, z, hx, hy, hz], i) => {
    const m = new Mesh(new BoxGeometry(hx * 2, hy * 2, hz * 2), mat);
    m.position.set(x, hy, z);
    m.updateMatrixWorld(true);
    meshes.push(m);
    physics.addStatic({ kind: 'box', position: [x, hy, z], size: [hx, hy, hz], yaw: 0 }, { id: `rock_${i}`, kind: 'world', material: 'concrete' });
  });
  physics.step();
  const [positions, indices] = getPositionsAndIndices(meshes);
  const nav = new NavService(positions, indices);
  const field = new CoverField({
    los: (ax, ay, az, bx, by, bz) => physics.hasLineOfSight(ax, ay, az, bx, by, bz),
    ground: (x, z) => (Math.abs(x) <= 50 && Math.abs(z) <= 50 ? 0 : null),
    walkable: (x, y, z) => {
      const n = nav.nearest({ x, y, z });
      return n ? [n.x, n.y, n.z] : null;
    },
  });
  for (const t of trees) field.addTree(t.x, t.z, t.r, 0.5);
  const waypoints: V3[] = [
    [-10, 0, -34],
    [10, 0, -34],
    [10, 0, -24],
    [-10, 0, -24],
  ];
  return { physics, nav, tactics: new TacticalEvaluator(field), trees, waypoints };
}

export interface HarnessOpts {
  seed: number;
  /** số địch (một nhóm) */
  enemies?: number;
  /** vị trí người chơi giả */
  player?: V3;
  /** người chơi bắn: ms giữa hai phát */
  fireEveryMs?: number;
  /** xác suất trúng mỗi phát vào địch thấy được */
  hitChance?: number;
  damage?: number;
  cinematic?: boolean;
  /** tầm nhìn người chơi giả (m) */
  playerSight?: number;
  /** điểm xuất phát nhóm địch */
  spawn?: V3;
  /** lựu đạn (DV-074) */
  grenades?: GrenadeLink;
}

/** Bộ đo AI (T1.6): một nhóm địch vs người chơi giả bắn trả; chạy 60 Hz, think 10 Hz */
export class AiHarness {
  readonly events = new EventBus<BotEvents>(4096);
  readonly bots: Bot[] = [];
  readonly team: FireTeams;
  readonly tokens = new AttackTokens();
  readonly player: V3;
  readonly playerCollider: RAPIER.Collider;
  readonly reservations = new Map<string, string>();
  readonly metrics = { playerHits: 0, playerHitsByNonHolder: 0, maxHolders: 0, kills: 0, playerShots: 0, ticks: 0 };
  private readonly rnd;
  private fireAcc = 0;
  private burst = 0;
  private mag = 30;
  private tick = 0;

  constructor(
    readonly w: ForestWorld,
    readonly o: HarnessOpts,
  ) {
    this.player = o.player ?? [0, 0, 6];
    const { collider } = w.physics.addKinematicCapsule([this.player[0], 0.9, this.player[2]], 0.55, 0.35, { id: 'player', kind: 'player', material: 'flesh' }, LAYER.PLAYER);
    this.playerCollider = collider;
    w.physics.step();
    this.rnd = mulberry32(o.seed * 7919 + 13);
    this.team = new FireTeams(this.events);
    const n = o.enemies ?? 4;
    const sp = o.spawn ?? [0, 0, -38];
    const prng = mulberry32(o.seed);
    for (let i = 0; i < n; i++) {
      const s: V3 = [sp[0] + (i - (n - 1) / 2) * 3, 0, sp[2] + (i % 2) * 2];
      const target: BotTarget = { pos: this.player, eye: [this.player[0], 1.6, this.player[2]], alive: true, isPlayer: true };
      const bot = new Bot(`e${i}`, s, {
        physics: w.physics,
        nav: w.nav,
        events: this.events,
        prng,
        waypoints: w.waypoints,
        coverMarkers: [],
        tactics: w.tactics,
        reservations: this.reservations,
        cinematic: o.cinematic ?? true,
        grenades: o.grenades,
        target: () => target,
        camera: () => ({ pos: [this.player[0], 1.6, this.player[2]], fwd: [0, 0, -1] }),
        exclude: () => undefined,
      });
      this.bots.push(bot);
      this.team.add({ group: 'g', bot });
    }
    this.events.on('HIT', (e) => {
      if (e.actorId !== 'player') return;
      this.metrics.playerHits++;
      const b = this.bots.find((x) => x.id === e.shooter);
      if (b && !b.hasToken) this.metrics.playerHitsByNonHolder++;
    });
  }

  /** người chơi giả: bắn địch thấy được gần nhất (trúng theo xác suất, trượt thì đạn sượt qua đầu) */
  private playerFire(): boolean {
    const eye: V3 = [this.player[0], 1.6, this.player[2]];
    let best: Bot | null = null;
    let bd = Infinity;
    for (const b of this.bots) {
      if (!b.alive) continue;
      const hy = b.position[1] + b.eyeHeight;
      if (!this.w.physics.hasLineOfSight(eye[0], eye[1], eye[2], b.position[0], hy, b.position[2])) continue;
      const d = Math.hypot(b.position[0] - eye[0], b.position[2] - eye[2]);
      if (d > (this.o.playerSight ?? 45)) continue;
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    if (!best) return false;
    this.metrics.playerShots++;
    const hy = best.position[1] + best.eyeHeight - 0.2;
    const miss = this.rnd.next() >= (this.o.hitChance ?? 0.12);
    const off = miss ? 0.4 + this.rnd.next() * 1.4 : 0;
    const tx = best.position[0] + off;
    const dx = tx - eye[0];
    const dy = hy - eye[1];
    const dz = best.position[2] - eye[2];
    const l = Math.hypot(dx, dy, dz);
    this.events.emit('WEAPON_FIRED', { origin: eye, dir: [dx / l, dy / l, dz / l] });
    if (!miss && best.applyDamage(this.o.damage ?? 25, eye)) this.metrics.kills++;
    return true;
  }

  step(): void {
    const t = this.tick++;
    this.metrics.ticks++;
    if (t % 6 === 0) for (const b of this.bots) b.think(0.1);
    for (const b of this.bots) b.move(1 / 60);
    this.team.tick(1 / 60);
    this.tokens.tick(this.bots, this.player, 1 / 60);
    this.metrics.maxHolders = Math.max(this.metrics.maxHolders, this.tokens.holders.size);
    // người chơi giả "như người": loạt 3–6 phát, nghỉ 0,6–1,5 s, nạp 2,5 s mỗi 30 phát
    this.fireAcc -= 1000 / 60;
    if (this.fireAcc <= 0) {
      if (this.mag === 0) {
        this.mag = 30;
        this.fireAcc = 2500;
      } else if (this.burst > 0) {
        if (this.playerFire()) {
          this.burst--;
          this.mag--;
        } else this.burst = 0;
        this.fireAcc = this.o.fireEveryMs ?? 110;
      } else {
        this.burst = 3 + Math.floor(this.rnd.next() * 4);
        this.fireAcc = 600 + this.rnd.next() * 900;
      }
    }
    this.w.physics.step();
  }

  run(seconds: number, onTick?: (t: number) => void): void {
    for (let i = 0; i < seconds * 60; i++) {
      onTick?.(i);
      this.step();
    }
  }

  dispose(): void {
    for (const b of this.bots) b.dispose();
    this.team.dispose();
    this.w.physics.removeBody(this.playerCollider.parent()!);
    this.w.physics.step();
  }

  /** tổng hợp chỉ số §2 Blueprint */
  summary(): Record<string, number> {
    let shaken = 0;
    let shakenCovered = 0;
    let shotsWhileBounding = 0;
    let maxExposed = 0;
    let shots = 0;
    let pins = 0;
    let peeks = 0;
    for (const b of this.bots) {
      shaken += b.stats.msShaken;
      shakenCovered += b.stats.msShakenCovered;
      shotsWhileBounding += b.stats.shotsWhileBounding;
      maxExposed = Math.max(maxExposed, b.stats.maxBoundExposedMs);
      shots += b.stats.shots;
      pins += b.stats.pins;
      peeks += b.stats.peeks;
    }
    const ts = this.team.stats;
    return {
      shots,
      shotsWhileBounding,
      coveredWhenShaken: shaken > 0 ? shakenCovered / shaken : 1,
      shakenMs: shaken,
      maxBoundExposedMs: maxExposed,
      bounds: ts.bounds,
      coveredBounds: ts.coveredBounds,
      flankOrders: ts.flankOrders,
      flankSuccess: ts.flankSuccess,
      fallbacks: ts.fallbacks,
      pins,
      peeks,
      kills: this.metrics.kills,
      playerHits: this.metrics.playerHits,
      playerHitsByNonHolder: this.metrics.playerHitsByNonHolder,
      maxHolders: this.metrics.maxHolders,
    };
  }
}
