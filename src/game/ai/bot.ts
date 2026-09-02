/**
 * Bot (PRD AI-002/003/004): FSM PATROL → INVESTIGATE → SEEK_COVER → PEEK_FIRE → RETREAT → PATROL.
 * think() 10 Hz (theo LOD), move() 60 Hz theo path navmesh. Mỗi state có timeout/fallback. Stuck detector ≤ 2 s
 * replan, ≤ 4 s teleport về waypoint gần nhất (AI_STUCK_RECOVERED). Không hard-code mission timeline.
 * Thuần logic — visual (Dummy) và physics body do Game bind qua callbacks.
 */
import ai from '@content/tuning/ai.json';
import type { Prng, EventBus } from '@engine/core';
import type { PhysicsWorld } from '@engine/physics/world';
import type { NavService, NavPoint } from '@engine/nav/navmesh';
import type { CoverMarker } from '@engine/render/arena';
import { LAYER } from '@engine/physics/layers';
import type RAPIER from '@dimforge/rapier3d-compat';
import { Perception, type NoiseEvent } from './perception';
import { pickCover } from './cover';
import { computeLod, isOnScreen, type AiLod } from './lod';
import { resolveShot, type HitResult, type HitscanSpec } from '@game/weapons/hitscan';

export type BotState = 'PATROL' | 'INVESTIGATE' | 'SEEK_COVER' | 'PEEK_FIRE' | 'RETREAT' | 'DEAD';

export interface BotEvents extends Record<string, unknown> {
  BOT_FIRED: { botId: string; origin: [number, number, number]; dir: [number, number, number] };
  HIT: { actorId: string; zone: 'head' | 'body'; damage: number; point: [number, number, number]; penetrated: boolean };
  IMPACT: { point: [number, number, number]; normal: [number, number, number]; material: string; penetrated: boolean };
  AI_STATE: { botId: string; from: BotState; to: BotState; reason: string };
  AI_STUCK_RECOVERED: { botId: string; method: 'replan' | 'teleport' };
  NODE_TIMEOUT: { botId: string; state: BotState };
  [k: string]: unknown;
}

export interface BotDeps {
  physics: PhysicsWorld;
  nav: NavService;
  events: EventBus<BotEvents>;
  prng: Prng;
  waypoints: [number, number, number][];
  coverMarkers: CoverMarker[];
  /** vị trí + hướng nhìn mục tiêu (player) */
  target: () => { pos: [number, number, number]; eye: [number, number, number]; alive: boolean };
  camera: () => { pos: [number, number, number]; fwd: [number, number, number] };
  /** collider riêng của bot để loại trừ khi bắn */
  exclude: () => RAPIER.Collider | undefined;
}

export interface BotSnapshot {
  id: string;
  position: [number, number, number];
  yaw: number;
  health: number;
  alive: boolean;
  state: BotState;
  waypointIndex: number;
  mag: number;
}

const BOT_HITSCAN: HitscanSpec = { damage: { head: ai.combat.damage, body: ai.combat.damage }, penetrationAllow: [], penetrationMaxThickness: 0, penetrationDamageMul: 1, range: ai.combat.range };

export class Bot {
  readonly position: [number, number, number];
  yaw = 0;
  health = ai.health;
  alive = true;
  state: BotState = 'PATROL';
  stateMs = 0;
  lod: AiLod = 'FULL';
  readonly perception = new Perception();
  path: NavPoint[] = [];
  pathIndex = 0;
  waypointIndex = 0;
  mag = ai.combat.mag;
  /** thống kê/test */
  readonly stats = { shots: 0, replans: 0, stuckReplans: 0, teleports: 0, timeouts: 0, thinks: 0, perceptionUpdates: 0, hits: 0 };
  private cooldownMs = 0;
  private burstLeft = ai.combat.burst;
  private burstPauseMs = 0;
  private reloadMs = 0;
  private peekTimerMs = 0;
  private peeking = true;
  private coverPos: [number, number, number] | null = null;
  /** vị trí ló ra khỏi cover khi peek (ngang mặt cover, lệch 1.4 m) */
  private readonly peekPos: [number, number, number] = [0, 0, 0];
  private peekSide = 1;
  private moveTarget: [number, number, number] | null = null;
  private readonly noises: NoiseEvent[] = [];
  private readonly lastPos: [number, number, number];
  private stuckMs = 0;
  private stuckPhase = 0;
  private offscreenMs = 0;
  private aiTick = 0;
  private readonly hits: HitResult[] = [];
  private readonly fireOut: [number, number, number] = [0, 0, 0];
  private readonly eye: [number, number, number] = [0, 0, 0];
  private readonly facing: [number, number, number] = [0, 0, -1];
  private readonly prng: Prng;
  private readonly unsubNoise: () => void;

  constructor(
    readonly id: string,
    spawn: [number, number, number],
    private readonly deps: BotDeps,
  ) {
    this.position = [spawn[0], spawn[1], spawn[2]];
    this.lastPos = [spawn[0], spawn[1], spawn[2]];
    this.prng = deps.prng.fork(`ai:${id}`);
    this.waypointIndex = this.nearestWaypoint();
    this.unsubNoise = deps.events.on('WEAPON_FIRED', (e: unknown) => {
      const ev = e as { origin: [number, number, number] };
      if (this.noises.length < 8) this.noises.push({ x: ev.origin[0], y: ev.origin[1], z: ev.origin[2], loudness: 1 });
    });
  }

  dispose(): void {
    this.unsubNoise();
  }

  private go(to: BotState, reason: string): void {
    if (to === this.state) return;
    const from = this.state;
    this.state = to;
    this.stateMs = 0;
    if (from === 'PEEK_FIRE') this.moveTarget = null;
    this.deps.events.emit('AI_STATE', { botId: this.id, from, to, reason });
  }

  private nearestWaypoint(): number {
    let best = 0;
    let bd = Infinity;
    const w = this.deps.waypoints;
    for (let i = 0; i < w.length; i++) {
      const d = Math.hypot(w[i]![0] - this.position[0], w[i]![2] - this.position[2]);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  private setPathTo(x: number, y: number, z: number): boolean {
    const from = this.deps.nav.nearest({ x: this.position[0], y: this.position[1], z: this.position[2] });
    const to = this.deps.nav.nearest({ x, y, z });
    this.stats.replans++;
    if (!from || !to) {
      this.path = [];
      return false;
    }
    this.path = this.deps.nav.findPath(from, to);
    this.pathIndex = 0;
    return this.path.length > 0;
  }

  private eyePos(): [number, number, number] {
    this.eye[0] = this.position[0];
    this.eye[1] = this.position[1] + ai.perception.eyeHeight;
    this.eye[2] = this.position[2];
    return this.eye;
  }

  /** Suy nghĩ — gọi từ tier ai10 (dtAi = 0.1 s). LOD giảm tần suất. */
  think(dtAi: number): void {
    if (!this.alive) return;
    this.aiTick++;
    const target = this.deps.target();
    const dist = Math.hypot(target.pos[0] - this.position[0], target.pos[2] - this.position[2]);
    const cam = this.deps.camera();
    if (isOnScreen(cam.pos, cam.fwd, this.position)) this.offscreenMs = 0;
    else this.offscreenMs += dtAi * 1000;
    this.lod = computeLod(dist, this.perception.state, this.offscreenMs);
    if (this.lod === 'SLEEP') {
      this.noises.length = 0;
      if (this.state !== 'PATROL') this.go('PATROL', 'lod_sleep');
      this.stateMs += dtAi * 1000;
      this.patrolThink();
      return;
    }
    if (this.lod === 'REDUCED' && this.aiTick % ai.lod.reducedDivider !== 0) {
      this.noises.length = 0;
      return;
    }
    const dtEff = this.lod === 'REDUCED' ? dtAi * ai.lod.reducedDivider : dtAi;
    this.stats.thinks++;
    this.stateMs += dtEff * 1000;

    // Perception
    const eye = this.eyePos();
    this.facing[0] = -Math.sin(this.yaw);
    this.facing[2] = -Math.cos(this.yaw);
    const los = this.lod === 'FULL' && target.alive ? this.deps.physics.hasLineOfSight(eye[0], eye[1], eye[2], target.eye[0], target.eye[1], target.eye[2]) : false;
    this.perception.update(dtEff, eye, this.facing, target.eye, los && target.alive, this.noises);
    this.stats.perceptionUpdates++;
    this.noises.length = 0;

    // Timers
    this.cooldownMs = Math.max(0, this.cooldownMs - dtEff * 1000);
    this.burstPauseMs = Math.max(0, this.burstPauseMs - dtEff * 1000);
    if (this.reloadMs > 0) {
      this.reloadMs -= dtEff * 1000;
      if (this.reloadMs <= 0) this.mag = ai.combat.mag;
    }

    // Timeout/fallback chung
    const limit = (ai.states as Record<string, number>)[this.state];
    if (limit !== undefined && this.stateMs > limit) {
      this.stats.timeouts++;
      this.deps.events.emit('NODE_TIMEOUT', { botId: this.id, state: this.state });
      this.go(this.state === 'PATROL' ? 'PATROL' : 'PATROL', 'timeout');
      this.waypointIndex = (this.waypointIndex + 1) % this.deps.waypoints.length;
      const w = this.deps.waypoints[this.waypointIndex]!;
      this.setPathTo(w[0], w[1], w[2]);
      return;
    }

    switch (this.state) {
      case 'PATROL':
        this.patrolThink();
        if (this.perception.state === 'ALERT') this.go('SEEK_COVER', 'alert');
        else if (this.perception.state === 'SUSPICIOUS' && this.perception.hasLastKnown) {
          const lk = this.perception.lastKnown;
          if (this.setPathTo(lk[0], lk[1], lk[2])) this.go('INVESTIGATE', 'suspicious');
        }
        break;
      case 'INVESTIGATE':
        if (this.perception.state === 'ALERT') this.go('SEEK_COVER', 'alert');
        else if (this.perception.state === 'UNAWARE') this.go('PATROL', 'lost');
        else if (this.arrived()) {
          // nhìn quanh: xoay yaw
          this.yaw += dtEff * 1.5;
          if (this.stateMs > 4000) this.go('PATROL', 'investigated');
        }
        break;
      case 'SEEK_COVER': {
        if (!this.coverPos) {
          const threat = this.perception.hasLastKnown ? this.perception.lastKnown : target.pos;
          const pick = pickCover(this.deps.coverMarkers, this.position, threat, (x, y, z, tx, ty, tz) => this.deps.physics.hasLineOfSight(x, y, z, tx, ty, tz));
          if (pick) {
            this.coverPos = [pick.marker.position[0], pick.marker.position[1], pick.marker.position[2]];
            if (!this.setPathTo(this.coverPos[0], this.coverPos[1], this.coverPos[2])) this.coverPos = null;
          }
          if (!this.coverPos) {
            this.go('PEEK_FIRE', 'no_cover');
            break;
          }
        }
        if (this.arrived() || this.stateMs > 3000) {
          this.peeking = true;
          this.peekTimerMs = ai.combat.peekMs;
          this.go('PEEK_FIRE', 'in_cover');
        } else if (this.perception.visible && dist < 8) {
          this.go('PEEK_FIRE', 'too_close');
        }
        break;
      }
      case 'PEEK_FIRE': {
        this.path = [];
        this.faceTarget(target.eye);
        this.peekTimerMs -= dtEff * 1000;
        if (this.peekTimerMs <= 0) {
          this.peeking = !this.peeking;
          this.peekTimerMs = this.peeking ? ai.combat.peekMs : ai.combat.coverMs;
          if (this.peeking && !this.perception.visible) this.peekSide = -this.peekSide; // đổi bên nếu bên trước không thấy
        }
        if (this.coverPos) {
          const threat = this.perception.hasLastKnown ? this.perception.lastKnown : target.pos;
          if (this.peeking && this.moveTarget !== this.peekPos) this.findPeekPos(threat);
          this.moveTarget = this.peeking ? this.peekPos : this.coverPos;
        } else this.moveTarget = null;
        if (this.health < ai.combat.retreatHealth || (this.mag === 0 && this.reloadMs <= 0)) {
          this.go('RETREAT', this.mag === 0 ? 'reload' : 'low_health');
          break;
        }
        if (this.peeking && this.perception.visible && dist <= ai.combat.engageRange) this.tryFire(target.eye);
        if (this.perception.state !== 'ALERT') {
          this.coverPos = null;
          if (this.perception.hasLastKnown) {
            const lk = this.perception.lastKnown;
            this.setPathTo(lk[0], lk[1], lk[2]);
            this.go('INVESTIGATE', 'lost_contact');
          } else this.go('PATROL', 'calm');
        }
        break;
      }
      case 'RETREAT': {
        if (this.reloadMs <= 0 && this.mag === 0) this.reloadMs = ai.combat.reloadMs;
        if (!this.coverPos || this.stateMs < 50) {
          const threat = this.perception.hasLastKnown ? this.perception.lastKnown : target.pos;
          const pick = pickCover(this.deps.coverMarkers, this.position, threat, (x, y, z, tx, ty, tz) => this.deps.physics.hasLineOfSight(x, y, z, tx, ty, tz));
          if (pick) {
            this.coverPos = [pick.marker.position[0], pick.marker.position[1], pick.marker.position[2]];
            this.setPathTo(this.coverPos[0], this.coverPos[1], this.coverPos[2]);
          }
        }
        if (this.mag > 0 && this.reloadMs <= 0 && (this.arrived() || this.stateMs > 2500)) {
          this.peeking = true;
          this.peekTimerMs = ai.combat.peekMs;
          this.go('PEEK_FIRE', 'reloaded');
        }
        break;
      }
      case 'DEAD':
        break;
    }
  }

  /** Tìm vị trí ló ra: quét lệch ngang 1.6→5.6 m hai bên (bên ưu tiên trước), chọn điểm gần nhất có LOS tới threat. */
  private findPeekPos(threat: [number, number, number]): void {
    const c = this.coverPos!;
    const tx = threat[0] - c[0];
    const tz = threat[2] - c[2];
    const tl = Math.hypot(tx, tz) || 1;
    const px = -tz / tl;
    const pz = tx / tl;
    const eyeY = c[1] + ai.perception.eyeHeight;
    const threatEyeY = threat[1] + (threat[1] < 1 ? ai.perception.eyeHeight : 0);
    for (let k = 1; k <= 3; k++) {
      const off = 1.6 * k;
      for (const side of [this.peekSide, -this.peekSide]) {
        const x = c[0] + px * off * side;
        const z = c[2] + pz * off * side;
        if (this.deps.physics.hasLineOfSight(x, eyeY, z, threat[0], threatEyeY, threat[2])) {
          this.peekPos[0] = x;
          this.peekPos[1] = c[1];
          this.peekPos[2] = z;
          this.peekSide = side;
          return;
        }
      }
    }
    // không tìm được → đứng tại cover (vẫn thử bắn nếu thấy)
    this.peekPos[0] = c[0];
    this.peekPos[1] = c[1];
    this.peekPos[2] = c[2];
  }

  private patrolThink(): void {
    if (this.path.length === 0 || this.arrived()) {
      if (this.arrived() && this.path.length > 0) this.waypointIndex = (this.waypointIndex + 1) % this.deps.waypoints.length;
      const w = this.deps.waypoints[this.waypointIndex]!;
      if (!this.setPathTo(w[0], w[1], w[2])) this.waypointIndex = (this.waypointIndex + 1) % this.deps.waypoints.length;
    }
  }

  private arrived(): boolean {
    if (this.path.length === 0) return true;
    const last = this.path[this.path.length - 1]!;
    return Math.hypot(last.x - this.position[0], last.z - this.position[2]) < ai.move.arriveRadius;
  }

  private faceTarget(t: [number, number, number]): void {
    this.yaw = Math.atan2(-(t[0] - this.position[0]), -(t[2] - this.position[2]));
  }

  private tryFire(targetEye: [number, number, number]): void {
    if (this.cooldownMs > 0 || this.burstPauseMs > 0 || this.mag <= 0 || this.reloadMs > 0) return;
    const eye = this.eyePos();
    const dx = targetEye[0] - eye[0];
    const dy = targetEye[1] - eye[1];
    const dz = targetEye[2] - eye[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    this.fireOut[0] = dx / len;
    this.fireOut[1] = dy / len;
    this.fireOut[2] = dz / len;
    this.mag--;
    this.stats.shots++;
    this.stateMs = 0; // có hoạt động → không tính là kẹt state
    this.cooldownMs = ai.combat.cooldownMs;
    this.burstLeft--;
    if (this.burstLeft <= 0) {
      this.burstLeft = ai.combat.burst;
      this.burstPauseMs = ai.combat.burstPauseMs;
    }
    this.deps.events.emit('BOT_FIRED', { botId: this.id, origin: [eye[0], eye[1], eye[2]], dir: [this.fireOut[0], this.fireOut[1], this.fireOut[2]] });
    resolveShot(this.deps.physics, eye, this.fireOut, ai.combat.spreadDeg, BOT_HITSCAN, this.prng, this.deps.exclude(), this.hits, LAYER.WORLD | LAYER.PLAYER);
    for (let i = 0; i < this.hits.length; i++) {
      const h = this.hits[i]!;
      if (h.kind === 'actor' && h.actorId) {
        this.stats.hits++;
        this.deps.events.emit('HIT', { actorId: h.actorId, zone: h.zone ?? 'body', damage: h.damage, point: h.point, penetrated: false });
      } else this.deps.events.emit('IMPACT', { point: h.point, normal: h.normal, material: h.material, penetrated: false });
    }
  }

  /** Di chuyển theo path — tier sim60. */
  move(dt: number): void {
    if (!this.alive) return;
    if (this.state === 'PEEK_FIRE') {
      this.stuckMs = 0;
      const mt = this.moveTarget;
      if (mt) {
        const dx = mt[0] - this.position[0];
        const dz = mt[2] - this.position[2];
        const d = Math.hypot(dx, dz);
        if (d > 0.05) {
          const step = Math.min(d, ai.move.speed * dt);
          this.position[0] += (dx / d) * step;
          this.position[2] += (dz / d) * step;
        }
      }
      return;
    }
    if (this.path.length > 0 && this.pathIndex < this.path.length) {
      let wp = this.path[this.pathIndex]!;
      let dx = wp.x - this.position[0];
      let dz = wp.z - this.position[2];
      let d = Math.hypot(dx, dz);
      while (d < 0.25 && this.pathIndex < this.path.length - 1) {
        this.pathIndex++;
        wp = this.path[this.pathIndex]!;
        dx = wp.x - this.position[0];
        dz = wp.z - this.position[2];
        d = Math.hypot(dx, dz);
      }
      if (d > 1e-3) {
        const speed = this.perception.state === 'ALERT' ? ai.move.alertSpeed : ai.move.speed;
        const step = Math.min(d, speed * dt);
        this.position[0] += (dx / d) * step;
        this.position[2] += (dz / d) * step;
        this.position[1] = wp.y;
        const wantYaw = Math.atan2(-dx, -dz);
        let dy = wantYaw - this.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        this.yaw += Math.max(-ai.move.turnRate * dt, Math.min(ai.move.turnRate * dt, dy));
      }
      // Stuck detector
      this.stuckMs += dt * 1000;
      if (this.stuckMs >= ai.move.stuckMs) {
        const moved = Math.hypot(this.position[0] - this.lastPos[0], this.position[2] - this.lastPos[2]);
        if (moved < ai.move.stuckDistance && !this.arrived()) {
          this.stuckPhase++;
          if (this.stuckPhase >= 2) {
            const w = this.deps.waypoints[this.nearestWaypoint()]!;
            const n = this.deps.nav.nearest({ x: w[0], y: w[1], z: w[2] });
            if (n) {
              this.position[0] = n.x;
              this.position[1] = n.y;
              this.position[2] = n.z;
            }
            this.stats.teleports++;
            this.stuckPhase = 0;
            this.path = [];
            this.deps.events.emit('AI_STUCK_RECOVERED', { botId: this.id, method: 'teleport' });
          } else {
            const last = this.path[this.path.length - 1]!;
            const around = this.deps.nav.randomAround({ x: this.position[0], y: this.position[1], z: this.position[2] }, 2, () => this.prng.next());
            const goal = around ?? { x: last.x, y: last.y, z: last.z };
            this.stats.stuckReplans++;
            this.setPathTo(goal.x, goal.y, goal.z);
            this.deps.events.emit('AI_STUCK_RECOVERED', { botId: this.id, method: 'replan' });
          }
        } else this.stuckPhase = 0;
        this.stuckMs = 0;
        this.lastPos[0] = this.position[0];
        this.lastPos[1] = this.position[1];
        this.lastPos[2] = this.position[2];
      }
    } else this.stuckMs = 0;
  }

  applyDamage(amount: number, fromPos?: [number, number, number]): boolean {
    if (!this.alive) return false;
    this.health = Math.max(0, this.health - amount);
    if (fromPos) {
      this.perception.suspicion = 1;
      this.perception.lastKnown[0] = fromPos[0];
      this.perception.lastKnown[1] = fromPos[1];
      this.perception.lastKnown[2] = fromPos[2];
      this.perception.hasLastKnown = true;
      this.perception.sinceContactMs = 0;
      this.perception.state = 'ALERT';
    }
    if (this.health === 0) {
      this.alive = false;
      this.go('DEAD', 'killed');
      return true;
    }
    return false;
  }

  snapshot(): BotSnapshot {
    return { id: this.id, position: [this.position[0], this.position[1], this.position[2]], yaw: this.yaw, health: this.health, alive: this.alive, state: this.state, waypointIndex: this.waypointIndex, mag: this.mag };
  }

  restore(s: BotSnapshot): void {
    this.position[0] = s.position[0];
    this.position[1] = s.position[1];
    this.position[2] = s.position[2];
    this.yaw = s.yaw;
    this.health = s.health;
    this.alive = s.alive;
    this.state = s.alive ? 'PATROL' : 'DEAD';
    this.waypointIndex = s.waypointIndex;
    this.mag = s.mag;
    this.path = [];
    this.coverPos = null;
    this.perception.reset();
    this.stateMs = 0;
    this.reloadMs = 0;
    this.cooldownMs = 0;
  }

  reset(spawn: [number, number, number]): void {
    this.restore({ id: this.id, position: spawn, yaw: 0, health: ai.health, alive: true, state: 'PATROL', waypointIndex: 0, mag: ai.combat.mag });
    this.waypointIndex = this.nearestWaypoint();
    this.stats.shots = this.stats.replans = this.stats.stuckReplans = this.stats.teleports = this.stats.timeouts = this.stats.thinks = this.stats.perceptionUpdates = this.stats.hits = 0;
    this.offscreenMs = 0;
    this.aiTick = 0;
  }
}
