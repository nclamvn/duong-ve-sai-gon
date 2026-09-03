/**
 * Bot (PRD AI-002/003/004; TIP-018 "IQ"): FSM
 *   PATROL → INVESTIGATE → ENGAGE (bắn phản xạ tại chỗ) → SEEK_COVER (vừa đi vừa bắn) → PEEK_FIRE (ló/nấp) → FLANK (tổ giao) → RETREAT → PATROL.
 * Nguyên tắc: **bắn trước, di chuyển sau**; cover chỉ khi cover thật (chắn LOS, gần); không cover → đứng bắn + dịch chuyển ngắn;
 * mặt luôn hướng mục tiêu khi bắn; nghe tiếng chân; đạn sượt → nấp. think() 10 Hz (theo LOD), move() 60 Hz.
 * Mỗi state có timeout/fallback. Stuck detector ≤ 2 s replan, ≤ 4 s teleport (AI_STUCK_RECOVERED). Không hard-code mission.
 * Thuần logic — visual (SoldierVisual) và physics body do Game bind qua callbacks.
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

export type BotState = 'PATROL' | 'INVESTIGATE' | 'ENGAGE' | 'SEEK_COVER' | 'PEEK_FIRE' | 'FLANK' | 'RETREAT' | 'DEAD';

type V3 = [number, number, number];

export interface BotEvents extends Record<string, unknown> {
  BOT_FIRED: { botId: string; origin: V3; dir: V3 };
  HIT: { actorId: string; zone: 'head' | 'body'; damage: number; point: V3; penetrated: boolean };
  IMPACT: { point: V3; normal: V3; material: string; penetrated: boolean };
  AI_STATE: { botId: string; from: BotState; to: BotState; reason: string };
  AI_STUCK_RECOVERED: { botId: string; method: 'replan' | 'teleport' };
  AI_TIMEOUT: { botId: string; state: BotState };
  /** người chơi chạy nước rút (TIP-018): tiếng chân */
  PLAYER_FOOTSTEP: { origin: V3 };
  [k: string]: unknown;
}

export interface BotDeps {
  physics: PhysicsWorld;
  nav: NavService;
  events: EventBus<BotEvents>;
  prng: Prng;
  waypoints: V3[];
  coverMarkers: CoverMarker[];
  /** vị trí + hướng nhìn mục tiêu (player) */
  target: () => { pos: V3; eye: V3; alive: boolean };
  camera: () => { pos: V3; fwd: V3 };
  /** collider riêng của bot để loại trừ khi bắn */
  exclude: () => RAPIER.Collider | undefined;
}

export interface BotSnapshot {
  id: string;
  position: V3;
  yaw: number;
  health: number;
  alive: boolean;
  state: BotState;
  waypointIndex: number;
  mag: number;
}

const C = ai.combat;
const BOT_HITSCAN: HitscanSpec = { damage: { head: C.damage, body: C.damage }, penetrationAllow: [], penetrationMaxThickness: 0, penetrationDamageMul: 1, range: C.range };
const PATH_STATES: ReadonlySet<BotState> = new Set(['PATROL', 'INVESTIGATE', 'SEEK_COVER', 'FLANK', 'RETREAT']);

export class Bot {
  readonly position: V3;
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
  mag = C.mag;
  /** đang giơ súng ngắm (visual) */
  aiming = false;
  /** thống kê/test */
  readonly stats = { shots: 0, replans: 0, stuckReplans: 0, teleports: 0, timeouts: 0, thinks: 0, perceptionUpdates: 0, hits: 0, bursts: 0, flanks: 0 };
  private cooldownMs = 0;
  private burstLeft = C.burst;
  private burstPauseMs = 0;
  private reloadMs = 0;
  private reactionMs = 0;
  private engageMs = 0;
  private settleMs = 0;
  private lostMs = 0;
  private suppressedMs = 0;
  private repositionMs = 0;
  private coverRetryMs = 0;
  private peekTimerMs = 0;
  private peeking = true;
  private peekFails = 0;
  private coverPos: V3 | null = null;
  /** vị trí ló ra khỏi cover khi peek */
  private readonly peekPos: V3 = [0, 0, 0];
  private peekSide = 1;
  private readonly stepPos: V3 = [0, 0, 0];
  private moveTarget: V3 | null = null;
  private flankTarget: V3 | null = null;
  private readonly noises: NoiseEvent[] = [];
  private readonly lastPos: V3;
  private stuckMs = 0;
  private stuckPhase = 0;
  private offscreenMs = 0;
  private aiTick = 0;
  private lateralSide = 1;
  private readonly hits: HitResult[] = [];
  private readonly fireOut: V3 = [0, 0, 0];
  private readonly eye: V3 = [0, 0, 0];
  private readonly facing: V3 = [0, 0, -1];
  private readonly aimPoint: V3 = [0, 0, 0];
  private readonly prng: Prng;
  private readonly unsubs: Array<() => void> = [];

  constructor(
    readonly id: string,
    spawn: V3,
    private readonly deps: BotDeps,
  ) {
    this.position = [spawn[0], spawn[1], spawn[2]];
    this.lastPos = [spawn[0], spawn[1], spawn[2]];
    this.prng = deps.prng.fork(`ai:${id}`);
    this.waypointIndex = this.nearestWaypoint();
    this.unsubs.push(
      deps.events.on('WEAPON_FIRED', (e: unknown) => {
        const ev = e as { origin: V3; dir?: V3 };
        if (this.noises.length < 8) this.noises.push({ x: ev.origin[0], y: ev.origin[1], z: ev.origin[2], loudness: 1 });
        if (ev.dir) this.checkSuppression(ev.origin, ev.dir);
      }),
      deps.events.on('PLAYER_FOOTSTEP', (e: unknown) => {
        const ev = e as { origin: V3 };
        if (this.noises.length < 8) this.noises.push({ x: ev.origin[0], y: ev.origin[1], z: ev.origin[2], loudness: ai.hearing.footstepLoudness });
      }),
    );
  }

  dispose(): void {
    for (const u of this.unsubs) u();
    this.unsubs.length = 0;
  }

  /** đạn sượt: khoảng cách từ ngực bot tới tia bắn (phía trước tia) < suppressRadius → nấp/ưu tiên cover */
  private checkSuppression(origin: V3, dir: V3): void {
    if (!this.alive) return;
    const cx = this.position[0] - origin[0];
    const cy = this.position[1] + 1.2 - origin[1];
    const cz = this.position[2] - origin[2];
    const t = cx * dir[0] + cy * dir[1] + cz * dir[2];
    if (t < 0 || t > C.range) return;
    const px = cx - dir[0] * t;
    const py = cy - dir[1] * t;
    const pz = cz - dir[2] * t;
    if (Math.hypot(px, py, pz) < C.suppressRadius) this.suppressedMs = C.suppressMs;
  }

  private go(to: BotState, reason: string): void {
    if (to === this.state) return;
    const from = this.state;
    this.state = to;
    this.stateMs = 0;
    this.moveTarget = null;
    if (to === 'ENGAGE') {
      this.engageMs = 0;
      this.repositionMs = C.repositionMs * 0.5;
      if (from === 'PATROL' || from === 'INVESTIGATE') this.reactionMs = C.reactionMs + this.prng.next() * C.reactionJitterMs;
    }
    if (to !== 'FLANK') this.flankTarget = null;
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

  private eyePos(): V3 {
    this.eye[0] = this.position[0];
    this.eye[1] = this.position[1] + ai.perception.eyeHeight;
    this.eye[2] = this.position[2];
    return this.eye;
  }

  private distTo(p: V3): number {
    return Math.hypot(p[0] - this.position[0], p[2] - this.position[2]);
  }

  /** mục tiêu nằm trong nón bắn phía trước (theo yaw hiện tại) */
  private inFireCone(t: V3): boolean {
    const dx = t[0] - this.position[0];
    const dz = t[2] - this.position[2];
    const l = Math.hypot(dx, dz) || 1;
    return (dx * this.facing[0] + dz * this.facing[2]) / l >= C.fovFireDot;
  }

  /** Suy nghĩ — gọi từ tier ai10 (dtAi = 0.1 s). LOD giảm tần suất. */
  think(dtAi: number): void {
    if (!this.alive) return;
    this.aiTick++;
    const target = this.deps.target();
    const dist = this.distTo(target.pos);
    const cam = this.deps.camera();
    if (isOnScreen(cam.pos, cam.fwd, this.position)) this.offscreenMs = 0;
    else this.offscreenMs += dtAi * 1000;
    this.lod = computeLod(dist, this.perception.state, this.offscreenMs);
    if (this.lod === 'SLEEP') {
      this.noises.length = 0;
      if (this.state !== 'PATROL') this.go('PATROL', 'lod_sleep');
      this.stateMs += dtAi * 1000;
      this.aiming = false;
      this.patrolThink();
      return;
    }
    if (this.lod === 'REDUCED' && this.aiTick % ai.lod.reducedDivider !== 0) {
      this.noises.length = 0;
      return;
    }
    const dtEff = this.lod === 'REDUCED' ? dtAi * ai.lod.reducedDivider : dtAi;
    const ms = dtEff * 1000;
    this.stats.thinks++;
    this.stateMs += ms;

    // Perception
    const eye = this.eyePos();
    this.facing[0] = -Math.sin(this.yaw);
    this.facing[2] = -Math.cos(this.yaw);
    const los = this.lod === 'FULL' && target.alive ? this.deps.physics.hasLineOfSight(eye[0], eye[1], eye[2], target.eye[0], target.eye[1], target.eye[2]) : false;
    this.perception.update(dtEff, eye, this.facing, target.eye, los && target.alive, this.noises);
    this.stats.perceptionUpdates++;
    this.noises.length = 0;
    const per = this.perception;
    const visible = per.visible && target.alive;

    // Timers
    this.cooldownMs = Math.max(0, this.cooldownMs - ms);
    this.burstPauseMs = Math.max(0, this.burstPauseMs - ms);
    this.suppressedMs = Math.max(0, this.suppressedMs - ms);
    this.coverRetryMs = Math.max(0, this.coverRetryMs - ms);
    this.repositionMs = Math.max(0, this.repositionMs - ms);
    this.reactionMs = Math.max(0, this.reactionMs - ms);
    if (this.reloadMs > 0) {
      this.reloadMs -= ms;
      if (this.reloadMs <= 0) this.mag = C.mag;
    }
    if (visible) {
      this.settleMs = Math.min(C.settleMs, this.settleMs + ms);
      this.lostMs = 0;
    } else {
      this.settleMs = 0;
      this.lostMs += ms;
    }

    // Timeout/fallback chung
    const limit = (ai.states as Record<string, number>)[this.state];
    if (limit !== undefined && this.stateMs > limit) {
      this.stats.timeouts++;
      this.deps.events.emit('AI_TIMEOUT', { botId: this.id, state: this.state });
      this.coverPos = null;
      this.go('PATROL', 'timeout');
      this.waypointIndex = (this.waypointIndex + 1) % this.deps.waypoints.length;
      const w = this.deps.waypoints[this.waypointIndex]!;
      this.setPathTo(w[0], w[1], w[2]);
      this.aiming = false;
      return;
    }

    // Luật chung: thấy mục tiêu khi chưa chiến đấu → ENGAGE ngay (bắn trước, di chuyển sau)
    if (visible && per.state === 'ALERT' && (this.state === 'PATROL' || this.state === 'INVESTIGATE')) {
      this.path = [];
      this.go('ENGAGE', 'contact');
    }

    this.aiming = false;
    switch (this.state) {
      case 'PATROL':
        this.patrolThink();
        if (per.state === 'ALERT' && per.hasLastKnown && this.suppressedMs > 0) {
          // bị bắn trúng/đạn sượt mà chưa thấy → quay về hướng nguồn, ENGAGE để phản ứng (không đứng chờ)
          this.path = [];
          this.go('ENGAGE', 'alert_unseen');
        } else if (per.state !== 'UNAWARE' && per.hasLastKnown) {
          const lk = per.lastKnown;
          if (this.setPathTo(lk[0], lk[1], lk[2])) this.go('INVESTIGATE', per.state === 'ALERT' ? 'alert_unseen' : 'suspicious');
        }
        break;
      case 'INVESTIGATE':
        if (per.state === 'ALERT' && per.hasLastKnown && this.suppressedMs > 0 && this.stateMs > 300) {
          this.path = [];
          this.go('ENGAGE', 'alert_unseen');
        } else if (per.state === 'UNAWARE') this.go('PATROL', 'lost');
        else if (this.arrived()) {
          this.yaw += dtEff * 1.5; // nhìn quanh
          if (this.stateMs > 4000) this.go('PATROL', 'investigated');
        }
        break;
      case 'ENGAGE':
        this.engageThink(target, dist, visible, ms);
        break;
      case 'SEEK_COVER': {
        if (!this.coverPos) {
          this.go('ENGAGE', 'no_cover');
          break;
        }
        // vừa đi vừa bắn khi mục tiêu trong nón trước mặt
        if (visible && this.inFireCone(target.eye) && dist <= C.engageRange) {
          this.aiming = true;
          this.tryFire(target.eye, true);
        }
        if (this.arrived() || this.stateMs > 5000) {
          this.peeking = true;
          this.peekFails = 0;
          this.peekTimerMs = C.peekMs;
          this.go('PEEK_FIRE', 'in_cover');
        }
        break;
      }
      case 'PEEK_FIRE':
        this.peekThink(target, dist, visible, ms);
        break;
      case 'FLANK': {
        if (visible && this.inFireCone(target.eye) && dist <= C.engageRange) {
          this.aiming = true;
          this.tryFire(target.eye, true);
        }
        if (!this.flankTarget || this.arrived() || (visible && dist < C.closeRange * 2)) this.go('ENGAGE', 'flank_done');
        break;
      }
      case 'RETREAT': {
        if (this.reloadMs <= 0 && this.mag === 0) this.reloadMs = C.reloadMs;
        if (!this.coverPos && this.stateMs < 50) {
          const threat = per.hasLastKnown ? per.lastKnown : target.pos;
          const pick = pickCover(this.deps.coverMarkers, this.position, threat, (x, y, z, tx, ty, tz) => this.deps.physics.hasLineOfSight(x, y, z, tx, ty, tz));
          if (pick) {
            this.coverPos = [pick.marker.position[0], pick.marker.position[1], pick.marker.position[2]];
            if (!this.setPathTo(this.coverPos[0], this.coverPos[1], this.coverPos[2])) this.coverPos = null;
          }
          if (!this.coverPos) this.stepAway(target.pos, 2); // không cover → lùi 2 m nạp đạn
        }
        if (this.mag > 0 && this.reloadMs <= 0 && (this.arrived() || this.stateMs > 2500)) {
          if (this.coverPos) {
            this.peeking = true;
            this.peekFails = 0;
            this.peekTimerMs = C.peekMs;
            this.go('PEEK_FIRE', 'reloaded');
          } else this.go('ENGAGE', 'reloaded');
        }
        break;
      }
      case 'DEAD':
        break;
    }
  }

  /** ENGAGE: đứng bắn phản xạ; dịch chuyển ngắn; cover chỉ khi có nghĩa; mất dấu → tiến lên. */
  private engageThink(target: { pos: V3; eye: V3 }, dist: number, visible: boolean, ms: number): void {
    const per = this.perception;
    const focus = visible ? target.eye : per.hasLastKnown ? per.lastKnown : target.eye;
    if (!this.moveTarget) this.faceTarget(focus);
    this.engageMs += ms;
    this.aiming = true;
    if (this.health < C.retreatHealth || (this.mag === 0 && this.reloadMs <= 0)) {
      this.coverPos = null;
      this.go('RETREAT', this.mag === 0 ? 'reload' : 'low_health');
      return;
    }
    if (visible && this.reactionMs <= 0 && dist <= C.engageRange) this.tryFire(target.eye, this.moveTarget !== null);
    // cover có nghĩa: sau engageMs, hoặc bị bắn/đạn sượt, hoặc máu < 60
    const wantCover = this.engageMs > C.engageMs || this.suppressedMs > 0 || this.health < 60;
    if (wantCover && this.coverRetryMs <= 0) {
      this.coverRetryMs = ai.cover.retryMs;
      const threat = per.hasLastKnown ? per.lastKnown : target.pos;
      const pick = pickCover(this.deps.coverMarkers, this.position, threat, (x, y, z, tx, ty, tz) => this.deps.physics.hasLineOfSight(x, y, z, tx, ty, tz));
      if (pick && pick.blocked) {
        this.coverPos = [pick.marker.position[0], pick.marker.position[1], pick.marker.position[2]];
        if (this.setPathTo(this.coverPos[0], this.coverPos[1], this.coverPos[2])) {
          this.go('SEEK_COVER', this.suppressedMs > 0 ? 'suppressed' : 'engaged_long');
          return;
        }
        this.coverPos = null;
      }
    }
    // mất dấu → tiến lên vị trí cuối
    if (!visible && this.lostMs > C.lostMs) {
      if (per.hasLastKnown && this.setPathTo(per.lastKnown[0], per.lastKnown[1], per.lastKnown[2])) this.go('INVESTIGATE', 'lost_contact');
      else if (per.state === 'UNAWARE') this.go('PATROL', 'calm');
      return;
    }
    // dịch chuyển ngắn giữa các loạt (không cover)
    if (this.moveTarget) {
      if (this.distTo(this.moveTarget) < 0.1) this.moveTarget = null;
    } else if (this.repositionMs <= 0 && visible) {
      this.repositionMs = C.repositionMs + this.prng.next() * C.repositionJitterMs;
      if (dist > C.farRange) this.stepToward(target.pos, 3);
      else if (dist < C.closeRange) this.stepAway(target.pos, 2);
      else this.stepLateral(target.pos, 1.5 + this.prng.next() * 1.5);
    }
  }

  /** PEEK_FIRE: ló ra bắn / nấp; ló mà không thấy → đổi bên; 3 lần → bỏ cover. */
  private peekThink(target: { pos: V3; eye: V3 }, dist: number, visible: boolean, ms: number): void {
    const per = this.perception;
    this.path = [];
    if (this.peeking) this.faceTarget(visible ? target.eye : per.hasLastKnown ? per.lastKnown : target.eye);
    this.peekTimerMs -= ms;
    if (this.peekTimerMs <= 0) {
      if (this.peeking) {
        if (!visible) this.peekFails++;
        else this.peekFails = 0;
        this.peeking = false;
        this.peekTimerMs = (this.suppressedMs > 0 ? C.coverSuppressedMs : C.coverMs) + this.prng.next() * C.coverJitterMs;
        if (this.peekFails >= 2) this.peekSide = -this.peekSide;
      } else {
        this.peeking = true;
        this.peekTimerMs = C.peekMs + this.prng.next() * C.peekJitterMs;
      }
    }
    if (this.peekFails >= C.peekFailMax) {
      this.coverPos = null;
      if (per.hasLastKnown && this.setPathTo(per.lastKnown[0], per.lastKnown[1], per.lastKnown[2])) this.go('INVESTIGATE', 'peek_lost');
      else this.go('ENGAGE', 'peek_lost');
      return;
    }
    if (this.coverPos) {
      const threat = per.hasLastKnown ? per.lastKnown : target.pos;
      if (this.peeking && this.moveTarget !== this.peekPos) this.findPeekPos(threat);
      this.moveTarget = this.peeking ? this.peekPos : this.coverPos;
    } else {
      this.go('ENGAGE', 'no_cover');
      return;
    }
    if (this.health < C.retreatHealth || (this.mag === 0 && this.reloadMs <= 0)) {
      this.go('RETREAT', this.mag === 0 ? 'reload' : 'low_health');
      return;
    }
    if (this.peeking) {
      this.aiming = true;
      if (visible && dist <= C.engageRange) this.tryFire(target.eye, false);
    }
    if (per.state !== 'ALERT') {
      this.coverPos = null;
      if (per.hasLastKnown) {
        this.setPathTo(per.lastKnown[0], per.lastKnown[1], per.lastKnown[2]);
        this.go('INVESTIGATE', 'lost_contact');
      } else this.go('PATROL', 'calm');
    }
  }

  /** Tổ giao ép sườn: đi tới điểm `pos` (bắn khi mục tiêu trong nón), tới nơi → ENGAGE. */
  orderFlank(pos: V3): boolean {
    if (!this.alive || this.state === 'RETREAT' || this.state === 'DEAD') return false;
    if (!this.setPathTo(pos[0], pos[1], pos[2])) return false;
    this.flankTarget = [pos[0], pos[1], pos[2]];
    this.coverPos = null;
    this.stats.flanks++;
    this.go('FLANK', 'squad_flank');
    return true;
  }

  private setStep(x: number, z: number): void {
    const n = this.deps.nav.nearest({ x, y: this.position[1], z });
    if (!n || Math.hypot(n.x - x, n.z - z) > 1.5) return;
    this.stepPos[0] = n.x;
    this.stepPos[1] = n.y;
    this.stepPos[2] = n.z;
    this.moveTarget = this.stepPos;
  }

  private stepToward(t: V3, d: number): void {
    const dx = t[0] - this.position[0];
    const dz = t[2] - this.position[2];
    const l = Math.hypot(dx, dz) || 1;
    this.setStep(this.position[0] + (dx / l) * d, this.position[2] + (dz / l) * d);
  }

  private stepAway(t: V3, d: number): void {
    this.stepToward(t, -d);
  }

  private stepLateral(t: V3, d: number): void {
    const dx = t[0] - this.position[0];
    const dz = t[2] - this.position[2];
    const l = Math.hypot(dx, dz) || 1;
    this.lateralSide = -this.lateralSide;
    this.setStep(this.position[0] + (-dz / l) * d * this.lateralSide, this.position[2] + (dx / l) * d * this.lateralSide);
  }

  /** Tìm vị trí ló ra: quét lệch ngang 1.6→4.8 m hai bên (bên ưu tiên trước), chọn điểm gần nhất có LOS tới threat. */
  private findPeekPos(threat: V3): void {
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

  private faceTarget(t: V3): void {
    this.yaw = Math.atan2(-(t[0] - this.position[0]), -(t[2] - this.position[2]));
    this.facing[0] = -Math.sin(this.yaw);
    this.facing[2] = -Math.cos(this.yaw);
  }

  /** Bắn một viên (nếu hết cooldown/loạt): ngắm ngực, độ chụm "settle", di chuyển thì loãng hơn. */
  private tryFire(targetEye: V3, moving: boolean): void {
    if (this.cooldownMs > 0 || this.burstPauseMs > 0 || this.mag <= 0 || this.reloadMs > 0) return;
    const eye = this.eyePos();
    const a = this.aimPoint;
    a[0] = targetEye[0];
    a[1] = targetEye[1] - C.aimDrop;
    a[2] = targetEye[2];
    const dx = a[0] - eye[0];
    const dy = a[1] - eye[1];
    const dz = a[2] - eye[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    this.fireOut[0] = dx / len;
    this.fireOut[1] = dy / len;
    this.fireOut[2] = dz / len;
    const settle = C.settleMs > 0 ? this.settleMs / C.settleMs : 1;
    let spread = C.spreadFirstDeg + (C.spreadDeg - C.spreadFirstDeg) * settle;
    if (moving) spread *= C.moveSpreadMul;
    this.mag--;
    this.stats.shots++;
    this.stateMs = 0; // có hoạt động → không tính là kẹt state
    this.cooldownMs = C.cooldownMs;
    this.burstLeft--;
    if (this.burstLeft <= 0) {
      this.burstLeft = C.burst;
      this.burstPauseMs = C.burstPauseMs + this.prng.next() * C.burstPauseJitterMs;
      this.stats.bursts++;
    }
    this.deps.events.emit('BOT_FIRED', { botId: this.id, origin: [eye[0], eye[1], eye[2]], dir: [this.fireOut[0], this.fireOut[1], this.fireOut[2]] });
    resolveShot(this.deps.physics, eye, this.fireOut, spread, BOT_HITSCAN, this.prng, this.deps.exclude(), this.hits, LAYER.WORLD | LAYER.PLAYER);
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
    const mt = this.moveTarget;
    if (mt && !PATH_STATES.has(this.state)) {
      // di chuyển thẳng ngắn (ló/nấp, dịch chuyển khi ENGAGE): mặt vẫn hướng mục tiêu (faceTarget ở think)
      this.stuckMs = 0;
      const dx = mt[0] - this.position[0];
      const dz = mt[2] - this.position[2];
      const d = Math.hypot(dx, dz);
      if (d > 0.05) {
        const step = Math.min(d, ai.move.speed * dt);
        this.position[0] += (dx / d) * step;
        this.position[2] += (dz / d) * step;
      } else if (this.state === 'ENGAGE') this.moveTarget = null;
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

  applyDamage(amount: number, fromPos?: V3): boolean {
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
      this.suppressedMs = C.suppressMs;
    }
    if (this.health === 0) {
      this.alive = false;
      this.aiming = false;
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
    this.moveTarget = null;
    this.flankTarget = null;
    this.perception.reset();
    this.stateMs = 0;
    this.reloadMs = 0;
    this.cooldownMs = 0;
    this.burstPauseMs = 0;
    this.burstLeft = C.burst;
    this.reactionMs = 0;
    this.engageMs = 0;
    this.settleMs = 0;
    this.lostMs = 0;
    this.suppressedMs = 0;
    this.repositionMs = 0;
    this.coverRetryMs = 0;
    this.peekFails = 0;
    this.aiming = false;
  }

  reset(spawn: V3): void {
    this.restore({ id: this.id, position: spawn, yaw: 0, health: ai.health, alive: true, state: 'PATROL', waypointIndex: 0, mag: C.mag });
    this.waypointIndex = this.nearestWaypoint();
    const st = this.stats;
    st.shots = st.replans = st.stuckReplans = st.teleports = st.timeouts = st.thinks = st.perceptionUpdates = st.hits = st.bursts = st.flanks = 0;
    this.offscreenMs = 0;
    this.aiTick = 0;
  }
}
