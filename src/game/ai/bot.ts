/**
 * Bot (PRD AI-002/003/004; TIP-018; AI-T1.3 DV-071 "bộ não chiến thuật"). FSM:
 *   PATROL → INVESTIGATE → ENGAGE (phản xạ, bắn tại chỗ, chọn vị trí) → SEEK_COVER (LAO, không bắn) → PEEK_FIRE (nấp ↔ ló bắn)
 *   ⇄ SUPPRESSED (bị ghim: cúi sát, không ló) · FLANK (lao theo lệnh tổ) · RETREAT (lùi theo vai fallback) → DEAD.
 *
 * Nguyên tắc AI-T1:
 *   - **không bắn khi đang lao** (trừ cự ly < noFireMoveRange); bắn trước, lao sau; lao ngắn (≤ maxMove) tới chỗ che thật;
 *   - vị trí chọn bằng TacticalEvaluator theo VAI (tổ giao), chỗ che kiểm bằng tia (CoverField), giữ chỗ chung;
 *   - **thanh áp chế** 0..1 (đạn sượt, trúng đạn, đạn chạm cạnh người): run tay, ló ngắn, ≥ pinnedAt thì bị ghim;
 *   - chu kỳ nấp/ló theo loại che: 'low' cúi nấp → đứng lên bắn; 'full' nấp sau thân → bước ngang ra mép; nạp đạn khi nấp;
 *   - tư thế cúi (capsule hạ crouchDrop, mắt crouchEye) do BotActor/visual đọc `stance`.
 * think() 10 Hz (theo LOD), move() 60 Hz. Mỗi state có timeout/fallback; stuck detector replan/teleport như cũ.
 * Thuần logic: visual + physics body do Game bind qua callbacks. Tất định theo prng.fork.
 */
import ai from '@content/tuning/ai.json';
import grenadeTuning from '@content/tuning/grenade.json';
import type { Prng, EventBus } from '@engine/core';
import type { PhysicsWorld } from '@engine/physics/world';
import type { NavService, NavPoint } from '@engine/nav/navmesh';
import type { CoverMarker } from '@engine/render/arena';
import { LAYER } from '@engine/physics/layers';
import type RAPIER from '@dimforge/rapier3d-compat';
import { Perception, type NoiseEvent } from './perception';
import { CoverField, type CoverQuality } from './coverField';
import { TacticalEvaluator, type TacticalPick, type TacticalRole } from './tactics';
import { computeLod, isOnScreen, type AiLod } from './lod';
import { resolveShot, type HitResult, type HitscanSpec } from '@game/weapons/hitscan';

export type BotState = 'PATROL' | 'INVESTIGATE' | 'ENGAGE' | 'SEEK_COVER' | 'PEEK_FIRE' | 'SUPPRESSED' | 'FLANK' | 'RETREAT' | 'DEAD';
export type Stance = 'stand' | 'crouch';

type V3 = [number, number, number];

export interface BotEvents extends Record<string, unknown> {
  BOT_FIRED: { botId: string; origin: V3; dir: V3; faction?: 'enemy' | 'friend' };
  HIT: { actorId: string; zone: 'head' | 'body'; damage: number; point: V3; penetrated: boolean; shooter?: string; blast?: boolean };
  IMPACT: { point: V3; normal: V3; material: string; penetrated: boolean };
  AI_STATE: { botId: string; from: BotState; to: BotState; reason: string };
  AI_STUCK_RECOVERED: { botId: string; method: 'replan' | 'teleport' };
  AI_TIMEOUT: { botId: string; state: BotState };
  /** bắt đầu nạp đạn (bark đồng đội) */
  AI_RELOAD: { botId: string };
  /** bắt đầu một lần lao (bark "yểm trợ!") */
  AI_BOUND: { botId: string; role: TacticalRole; reason: string };
  /** bị ghim (bark "bị áp chế!") */
  AI_PINNED: { botId: string };
  /** ném lựu đạn (DV-074): tổ ta hô "Lựu đạn!" */
  AI_GRENADE: { botId: string; target: V3 };
  /** người chơi chạy nước rút (TIP-018): tiếng chân */
  PLAYER_FOOTSTEP: { origin: V3 };
  [k: string]: unknown;
}

export interface BotTarget {
  pos: V3;
  eye: V3;
  alive: boolean;
  /** mục tiêu là người chơi (vé tấn công, loạt cảnh cáo) */
  isPlayer?: boolean;
}

/** liên kết tổ (FireTeam): giấy phép lao, vai, vị trí đồng đội */
export interface TeamLink {
  /** được phép bắt đầu một lần lao chiến thuật (lao xen kẽ) */
  mayMove(bot: Bot): boolean;
  /** vị trí đồng đội cùng tổ còn sống (giãn cách) */
  allies(bot: Bot): readonly V3[];
  /** vị trí nhóm yểm trợ (vai flank) */
  support(bot: Bot): readonly V3[];
  /** điểm rút (vai fallback) */
  rally?(bot: Bot): V3 | null;
}

/** tổ ta (T1.5): neo theo người chơi + lệnh */
export interface EscortInfo {
  anchor: V3;
  fwd: [number, number];
  radius: number;
  mode: 'escort' | 'hold' | 'advance' | 'suppress';
  /** điểm người chơi đang nhắm (lệnh bắn yểm trợ) */
  aimPoint: V3 | null;
}

/** lựu đạn đang bay/nằm (DV-074) */
export interface GrenadeDanger {
  readonly pos: Readonly<V3>;
  readonly vel: Readonly<V3>;
  readonly fuseMs: number;
  readonly landed: boolean;
}

/** liên kết lựu đạn (Game cấp): giới hạn nhịp ném chung + danh sách lựu đạn để chạy khỏi */
export interface GrenadeLink {
  canThrow(bot: Bot): boolean;
  throwAt(bot: Bot, from: V3, to: V3): boolean;
  dangers(): readonly GrenadeDanger[];
}

export interface BotDeps {
  physics: PhysicsWorld;
  nav: NavService;
  events: EventBus<BotEvents>;
  prng: Prng;
  waypoints: V3[];
  coverMarkers: CoverMarker[];
  /** vị trí + hướng nhìn mục tiêu (player hoặc địch gần nhất) */
  target: () => BotTarget;
  camera: () => { pos: V3; fwd: V3 };
  /** collider riêng của bot để loại trừ khi bắn */
  exclude: () => RAPIER.Collider | undefined;
  /** cao độ mặt đất chính xác tại x/z (terrain heightfield, TIP-D11a) — không có → dùng navmesh */
  groundHeight?: (x: number, z: number) => number | null;
  /** phe (TIP-M1A): 'friend' = đồng đội — target() là địch gần nhất, không nghe tiếng chân người chơi, bắn layer ACTOR */
  faction?: 'enemy' | 'friend';
  /** lớp vật lý tia bắn được chạm (mặc định WORLD|PLAYER) */
  hitMask?: number;
  /** điểm đi theo (đồng đội): PATROL đi tới điểm này thay vì waypoint; null = đứng yên */
  followGoal?: () => { x: number; z: number; run: boolean; mul?: number } | null;
  /** DV-083: độ che tầm nhìn bởi thảm thực vật giữa hai điểm (0 thoáng … 1 kín); không có = không che */
  sightOcclusion?: (from: Readonly<V3>, to: Readonly<V3>) => number;
  /** chấm vị trí dùng chung (Game dựng một lần từ cây/hố/marker); thiếu → bot tự dựng từ coverMarkers */
  tactics?: TacticalEvaluator;
  /** khoá giữ chỗ dùng chung: key → id bot */
  reservations?: Map<string, string>;
  /** neo tổ ta (T1.5) */
  escort?: () => EscortInfo | null;
  /** chế độ điện ảnh (T1.4): vé tấn công + loạt cảnh cáo khi bắn người chơi */
  cinematic?: boolean;
  /** lựu đạn (DV-074): ném + chạy khỏi vùng nổ */
  grenades?: GrenadeLink;
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
const S = ai.suppression;
const CIN = ai.cinematic;
const GA = grenadeTuning.ai;
/** DV-083: nhóm săn */
const HUNT = (ai as unknown as { hunt?: { refreshMs: number; jitterM: number } }).hunt ?? { refreshMs: 2500, jitterM: 4 };
const BOT_HITSCAN: HitscanSpec = { damage: { head: C.damage, body: C.damage }, penetrationAllow: [], penetrationMaxThickness: 0, penetrationDamageMul: 1, range: C.range };
/** khoảng từ mắt tới điểm xuất phát tia bắn (m) — lớn hơn bán kính quả cầu đầu 0,16 */
const MUZZLE_OFFSET = 0.35;
const PATH_STATES: ReadonlySet<BotState> = new Set(['PATROL', 'INVESTIGATE', 'SEEK_COVER', 'FLANK', 'RETREAT']);
const BOUND_STATES: ReadonlySet<BotState> = new Set(['SEEK_COVER', 'FLANK', 'RETREAT']);
/** lý do lao tự cứu (không cần giấy phép tổ) */
const EMERGENCY: ReadonlySet<string> = new Set(['pinned', 'low_health', 'exposed', 'compromised_fire', 'grenade']);
export const COMBAT_STATES: ReadonlySet<BotState> = new Set(['ENGAGE', 'SEEK_COVER', 'PEEK_FIRE', 'SUPPRESSED', 'FLANK', 'RETREAT']);

/** chỗ đang giữ */
interface Position {
  key: string;
  pos: V3;
  quality: CoverQuality;
  peek: V3 | null;
  peekSide: number;
}

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
  /** aim pitch toward the last faced target eye, + = up (visual only, DV-066) */
  aimPitch = 0;
  /** tư thế (capsule + visual) */
  stance: Stance = 'stand';
  /** thanh áp chế 0..1 */
  suppression = 0;
  /** vai do tổ giao (mặc định: địch assault, ta escort) */
  role: TacticalRole;
  /** vé tấn công (T1.4): false = bắn người chơi chỉ để áp chế */
  hasToken = true;
  /** liên kết tổ (FireTeam gắn) */
  team: TeamLink | null = null;
  /** nhóm (FireTeam) */
  group = '';
  /** nằm phục (M1-T2): cúi im, chỉ nổ súng khi mục tiêu ≤ ambushRange hoặc bị bắn/đồng đội đã nổ súng */
  ambush = false;
  /** tick này đang thấy người chơi (vé tấn công) */
  seesPlayer = false;
  /**
   * DV-083 săn (M1-T3): nhóm "hunt" luôn biết đại khái người chơi ở đâu — mỗi `huntRefreshMs` cập nhật vị trí cuối (lệch vài
   * mét) khi mất dấu, nên ép dần vào thay vì quên sau 9 s rồi đi tuần.
   */
  hunter = false;
  private huntMs = 0;
  /** thống kê/test + bộ đo AI (T1.6) */
  readonly stats = {
    shots: 0, replans: 0, stuckReplans: 0, teleports: 0, timeouts: 0, thinks: 0, perceptionUpdates: 0, hits: 0, bursts: 0, flanks: 0,
    bounds: 0, shotsWhileBounding: 0, pins: 0, peeks: 0, coverPicks: 0, compromised: 0, reloadsInCover: 0,
    msShaken: 0, msShakenCovered: 0, boundExposedMs: 0, maxBoundExposedMs: 0, warnShots: 0, suppressShots: 0,
    grenades: 0, grenadeEvades: 0,
  };
  /** lựu đạn còn mang (DV-074) */
  grenades = 0;
  /** đang chạy khỏi lựu đạn (ms còn lại) */
  private evadeMs = 0;
  private grenadeNoticeMs = 0;
  private grenadeReactMs = 0;
  /** mục tiêu đứng yên bao lâu (vị trí cuối biết không dời quá stillRadius) */
  private lkStillMs = 0;
  private readonly lkAnchor: V3 = [1e9, 0, 1e9];
  private peekThrowChecked = false;
  private cooldownMs = 0;
  private burstLeft = C.burst;
  private burstPauseMs = 0;
  private reloadMs = 0;
  private reactionMs = 0;
  private settleMs = 0;
  private lostMs = 0;
  /** ms từ lần cuối bị áp chế (lớn = chưa từng) */
  private calmMs = 1e9;
  private seekMs = 0;
  private recheckMs = 0;
  private phaseMs = 0;
  /** PEEK_FIRE: đang ló (true) hay nấp */
  private peeking = false;
  private peekSawTarget = false;
  private peekElapsedMs = 0;
  private peekFails = 0;
  private peeksDone = 0;
  private advanceAfter = C.advanceAfterPeeks;
  private wantMove = false;
  private warnLeft = 0;
  private unseenMs = 1e9;
  private pinnedMs = 0;
  private boundExposedMs = 0;
  /** chỗ hiện tại (đang tới hoặc đang giữ) */
  cover: Position | null = null;
  /** vai + lý do của lần lao hiện tại (bộ đo) */
  boundRole: TacticalRole = 'assault';
  boundReason = '';
  private readonly stepPos: V3 = [0, 0, 0];
  private moveTarget: V3 | null = null;
  private readonly noises: NoiseEvent[] = [];
  private readonly lastPos: V3;
  private stuckMs = 0;
  private stuckPhase = 0;
  private offscreenMs = 0;
  private aiTick = 0;
  /** hệ số tốc độ khi đi theo (đuổi kịp) */
  private speedMul = 1;
  private followReplanMs = 0;
  private readonly hits: HitResult[] = [];
  private readonly fireOut: V3 = [0, 0, 0];
  private readonly eye: V3 = [0, 0, 0];
  private readonly facing: V3 = [0, 0, -1];
  private readonly aimPoint: V3 = [0, 0, 0];
  private readonly muzzle: V3 = [0, 0, 0];
  private readonly threatEye: V3 = [0, 0, 0];
  private readonly threatFeet: V3 = [0, 0, 0];
  private readonly prng: Prng;
  private readonly tactics: TacticalEvaluator;
  private readonly reservations: Map<string, string>;
  private readonly unsubs: Array<() => void> = [];

  constructor(
    readonly id: string,
    spawn: V3,
    private readonly deps: BotDeps,
  ) {
    this.position = [spawn[0], spawn[1], spawn[2]];
    this.lastPos = [spawn[0], spawn[1], spawn[2]];
    this.prng = deps.prng.fork(`ai:${id}`);
    this.role = deps.faction === 'friend' ? 'escort' : 'assault';
    this.grenades = this.grenadeAllowance();
    this.waypointIndex = this.nearestWaypoint();
    this.tactics = deps.tactics ?? Bot.localTactics(deps);
    this.reservations = deps.reservations ?? new Map();
    this.unsubs.push(
      deps.events.on('WEAPON_FIRED', (e: unknown) => {
        if (deps.faction === 'friend') return; // người chơi cùng phe đồng đội
        const ev = e as { origin: V3; dir?: V3 };
        if (this.noises.length < 8) this.noises.push({ x: ev.origin[0], y: ev.origin[1], z: ev.origin[2], loudness: ai.hearing.gunshotLoudness });
        if (ev.dir) this.nearMiss(ev.origin, ev.dir);
      }),
      deps.events.on('BOT_FIRED', (e: unknown) => {
        const ev = e as BotEvents['BOT_FIRED'];
        if (ev.botId === this.id || (ev.faction ?? 'enemy') === (deps.faction ?? 'enemy')) return;
        if (this.noises.length < 8) this.noises.push({ x: ev.origin[0], y: ev.origin[1], z: ev.origin[2], loudness: ai.hearing.gunshotLoudness });
        this.nearMiss(ev.origin, ev.dir);
      }),
      deps.events.on('IMPACT', (e: unknown) => {
        const ev = e as { point: V3 };
        const d = Math.hypot(ev.point[0] - this.position[0], ev.point[2] - this.position[2]);
        if (d < S.impactRadius && Math.abs(ev.point[1] - this.position[1] - 0.8) < 1.6) this.addSuppression(S.impactGain * (1 - d / S.impactRadius));
      }),
      deps.events.on('PLAYER_FOOTSTEP', (e: unknown) => {
        if (deps.faction === 'friend') return;
        const ev = e as { origin: V3 };
        if (this.noises.length < 8) this.noises.push({ x: ev.origin[0], y: ev.origin[1], z: ev.origin[2], loudness: ai.hearing.footstepLoudness });
      }),
    );
  }

  /** CoverField tối thiểu từ marker level (unit test, level không có cây) */
  static localTactics(deps: Pick<BotDeps, 'physics' | 'nav' | 'coverMarkers' | 'groundHeight'>): TacticalEvaluator {
    const field = new CoverField({
      los: (ax, ay, az, bx, by, bz) => deps.physics.hasLineOfSight(ax, ay, az, bx, by, bz),
      ground: (x, z) => deps.groundHeight?.(x, z) ?? deps.nav.nearest({ x, y: 0, z })?.y ?? null,
      walkable: (x, y, z) => {
        const n = deps.nav.nearest({ x, y, z });
        return n ? [n.x, n.y, n.z] : null;
      },
    });
    for (const m of deps.coverMarkers) field.addMarker(m.position[0], m.position[1], m.position[2]);
    return new TacticalEvaluator(field);
  }

  dispose(): void {
    for (const u of this.unsubs) u();
    this.unsubs.length = 0;
    this.releaseCover();
  }

  get eyeHeight(): number {
    return this.stance === 'crouch' ? C.crouchEye : ai.perception.eyeHeight;
  }

  get bounding(): boolean {
    return BOUND_STATES.has(this.state) && this.path.length > 0;
  }

  get inCombat(): boolean {
    return COMBAT_STATES.has(this.state);
  }

  /** đang nấp (không ló) trong chỗ có che */
  get covered(): boolean {
    if (!this.cover || this.cover.quality === 'none') return false;
    if (this.state === 'SUPPRESSED') return true;
    return this.state === 'PEEK_FIRE' && !this.peeking;
  }

  /** PEEK_FIRE đang ló */
  get peekingNow(): boolean {
    return this.state === 'PEEK_FIRE' && this.peeking;
  }

  /** lần lao tự cứu (bị ghim/trống trải dưới đạn/thấp máu), không cần giấy phép tổ */
  get emergencyBound(): boolean {
    return this.bounding && EMERGENCY.has(this.boundReason);
  }

  /** người được phép bắn yểm trợ (đang ở vị trí, không lao) */
  get firing(): boolean {
    return (this.state === 'PEEK_FIRE' && this.peeking) || this.state === 'ENGAGE';
  }

  private addSuppression(v: number): void {
    if (!this.alive || v <= 0) return;
    // tổ ta là lính cũ (điện ảnh): ít bị ghim hơn, vẫn bắn trả
    if (this.deps.faction === 'friend') v *= CIN.friendSuppressionMul;
    this.suppression = Math.min(1, this.suppression + v);
    this.calmMs = 0;
  }

  /** đạn sượt: khoảng cách từ đầu bot tới tia bắn (phía trước tia) */
  private nearMiss(origin: V3, dir: V3): void {
    if (!this.alive) return;
    const cx = this.position[0] - origin[0];
    const cy = this.position[1] + this.eyeHeight - 0.2 - origin[1];
    const cz = this.position[2] - origin[2];
    const t = cx * dir[0] + cy * dir[1] + cz * dir[2];
    if (t < 0 || t > C.range) return;
    const d = Math.hypot(cx - dir[0] * t, cy - dir[1] * t, cz - dir[2] * t);
    if (d < S.nearMissRadius) {
      this.addSuppression(S.nearMissBase + S.nearMissGain * (1 - d / S.nearMissRadius));
      // đạn sượt mà chưa thấy → biết hướng nguồn
      const p = this.perception;
      if (p.state !== 'ALERT') {
        p.suspicion = Math.max(p.suspicion, ai.perception.alertAt);
        p.lastKnown[0] = origin[0];
        p.lastKnown[1] = origin[1];
        p.lastKnown[2] = origin[2];
        p.hasLastKnown = true;
        p.sinceContactMs = 0;
      }
    }
  }

  private go(to: BotState, reason: string): void {
    if (to === this.state) return;
    const from = this.state;
    this.state = to;
    this.stateMs = 0;
    this.moveTarget = null;
    this.phaseMs = 0;
    // DV-083: vào trận bỏ hệ số tốc độ theo tổ (hành quân 0,37× / chạy 1,8×) — trước đây đồng đội lết hoặc phóng loạn giữa trận
    if (COMBAT_STATES.has(to)) this.speedMul = 1;
    if (to === 'ENGAGE') {
      this.lostMs = 0;
      this.seekMs = C.engageSeekMs * (0.5 + this.prng.next());
      if (from === 'PATROL' || from === 'INVESTIGATE') this.reactionMs = C.reactionMs + this.prng.next() * C.reactionJitterMs;
    }
    if (BOUND_STATES.has(to)) {
      this.boundExposedMs = 0;
      this.stance = 'stand';
    }
    if (to === 'PATROL' || to === 'INVESTIGATE' || to === 'DEAD') {
      this.releaseCover();
      this.stance = 'stand';
    }
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
    this.eye[1] = this.position[1] + this.eyeHeight;
    this.eye[2] = this.position[2];
    return this.eye;
  }

  private distTo(p: V3): number {
    return Math.hypot(p[0] - this.position[0], p[2] - this.position[2]);
  }

  // ───────────────────────── chỗ nấp ─────────────────────────

  private releaseCover(): void {
    if (this.cover && this.reservations.get(this.cover.key) === this.id) this.reservations.delete(this.cover.key);
    this.cover = null;
  }

  private reservedFor(): Set<string> {
    const s = new Set<string>();
    for (const [k, owner] of this.reservations) if (owner !== this.id) s.add(k);
    return s;
  }

  /** hỏi tactics một vị trí cho vai `role`; null nếu không có */
  private findPosition(role: TacticalRole, opts: { needCover?: boolean; maxMove?: number } = {}): TacticalPick | null {
    const esc = this.deps.escort?.() ?? null;
    let anchor: V3 | undefined;
    let anchorRadius: number | undefined;
    let anchorFwd: [number, number] | undefined;
    if (esc) {
      anchor = esc.anchor;
      anchorRadius = esc.radius;
      anchorFwd = esc.fwd;
    } else if (role === 'fallback') anchor = this.team?.rally?.(this) ?? undefined;
    return this.tactics.pick({
      self: this.position,
      threat: this.threatFeet,
      threatEye: this.threatEye,
      role,
      allies: this.team?.allies(this),
      support: role === 'flank' ? this.team?.support(this) : undefined,
      anchor,
      anchorRadius,
      anchorFwd,
      reserved: this.reservedFor(),
      // trống trải thì đứng yên bắn còn hơn lao ra chỗ trống khác (tổ ta escort được phép: theo người chơi)
      needCover: opts.needCover ?? role !== 'escort',
      maxMove: opts.maxMove ?? (role === 'flank' ? ai.tactics.flankMaxMove : undefined),
    });
  }

  /** nhận vị trí + đi tới (lao) */
  private takePosition(p: TacticalPick, state: 'SEEK_COVER' | 'FLANK' | 'RETREAT', role: TacticalRole, reason: string): boolean {
    const atSpot = Math.hypot(p.pos[0] - this.position[0], p.pos[2] - this.position[2]) < 0.8;
    if (!atSpot && !this.setPathTo(p.pos[0], p.pos[1], p.pos[2])) return false;
    this.releaseCover();
    this.cover = { key: p.key, pos: [p.pos[0], p.pos[1], p.pos[2]], quality: p.quality, peek: p.peek ? [p.peek[0], p.peek[1], p.peek[2]] : null, peekSide: p.peekSide || 1 };
    this.reservations.set(p.key, this.id);
    this.stats.coverPicks++;
    this.boundRole = role;
    this.boundReason = reason;
    if (atSpot) {
      this.path = [];
      this.enterPosition('at_spot');
      return true;
    }
    this.stats.bounds++;
    if (state === 'FLANK') this.stats.flanks++;
    this.go(state, reason);
    this.deps.events.emit('AI_BOUND', { botId: this.id, role, reason });
    return true;
  }

  /** tới chỗ: bắt đầu chu kỳ nấp/ló (nấp trước nếu đang run tay hoặc băng vơi) */
  private enterPosition(reason: string): void {
    this.peekFails = 0;
    this.peeksDone = 0;
    this.wantMove = false;
    this.advanceAfter = this.role === 'flank' ? 1 : C.advanceAfterPeeks + Math.floor(this.prng.next() * (C.advanceJitterPeeks + 1));
    this.go('PEEK_FIRE', reason);
    const hideFirst = this.suppression >= S.shakenAt || this.mag < C.mag * C.reloadInCoverFrac;
    this.setPhase(!hideFirst);
    this.recheckMs = C.coverRecheckMs;
  }

  private setPhase(peek: boolean): void {
    this.peeking = peek;
    if (peek) {
      this.peekElapsedMs = 0;
      this.phaseMs = C.peekMs + this.prng.next() * C.peekJitterMs;
      this.peekSawTarget = false;
      this.peekThrowChecked = false;
      this.stats.peeks++;
    } else this.phaseMs = C.hideMs + this.prng.next() * C.hideJitterMs;
  }

  /** chỗ hiện tại còn che được mối đe doạ hiện tại không (1–2 tia) */
  private coverHolds(): boolean {
    const c = this.cover;
    if (!c) return false;
    const q = this.tactics.field.probe(c.pos[0], c.pos[1], c.pos[2], this.threatEye);
    if (q === 'none') return false;
    if (q !== c.quality) {
      c.quality = q;
      c.peek = null;
    }
    return true;
  }

  /** chỗ 'full': tính lại điểm ló cho hướng mối đe doạ hiện tại */
  private refreshPeek(): boolean {
    const c = this.cover!;
    if (c.quality !== 'full') return true;
    const out: V3 = [0, 0, 0];
    const side = this.tactics.field.peekPoint(c.pos[0], c.pos[1], c.pos[2], this.threatEye, out, c.peekSide);
    if (side === 0) {
      c.peek = null;
      return false;
    }
    c.peek = out;
    c.peekSide = side;
    return true;
  }

  /** vai hiện tại → state lao tương ứng */
  private boundStateFor(role: TacticalRole): 'SEEK_COVER' | 'FLANK' | 'RETREAT' {
    return role === 'flank' ? 'FLANK' : role === 'fallback' ? 'RETREAT' : 'SEEK_COVER';
  }

  /** thử lao tới vị trí mới theo vai (cần giấy phép tổ trừ khi `force`) */
  private tryReposition(reason: string, role: TacticalRole = this.role, force = false): boolean {
    if (!force && this.team && !this.team.mayMove(this)) return false;
    const p = this.findPosition(role, reason === 'pinned' ? { needCover: true } : {});
    if (!p) return false;
    if (this.cover && p.key === this.cover.key && !reason.startsWith('compromised')) return false;
    return this.takePosition(p, this.boundStateFor(role), role, reason);
  }

  /** mối đe doạ hiện tại (chân) */
  get threat(): Readonly<V3> {
    return this.threatFeet;
  }

  /** đồng đội hô "có địch!" (FireTeam chia thông tin): biết vị trí, vào chiến đấu */
  alertTo(pos: V3): void {
    if (!this.alive) return;
    const p = this.perception;
    if (p.state === 'ALERT' && this.state !== 'PATROL' && this.state !== 'INVESTIGATE') return;
    this.ambush = false; // đồng đội đã nổ súng: cả tổ phục khai hoả
    p.suspicion = Math.max(p.suspicion, ai.perception.alertAt);
    p.state = 'ALERT';
    p.lastKnown[0] = pos[0];
    p.lastKnown[1] = pos[1];
    p.lastKnown[2] = pos[2];
    p.hasLastKnown = true;
    p.sinceContactMs = 0;
    if (this.state === 'PATROL' || this.state === 'INVESTIGATE') {
      this.path = [];
      this.threatEye[0] = pos[0];
      this.threatEye[1] = pos[1];
      this.threatEye[2] = pos[2];
      this.threatFeet[0] = pos[0];
      this.threatFeet[1] = pos[1] - ai.perception.eyeHeight;
      this.threatFeet[2] = pos[2];
      this.go('ENGAGE', 'team_alert');
    }
  }

  /** Tổ giao lệnh (FireTeam): vai mới, lao ngay nếu được */
  order(role: TacticalRole, reason = 'team_order'): boolean {
    if (!this.alive || this.state === 'DEAD') return false;
    this.role = role;
    if (!this.inCombat || this.bounding) return false;
    return this.tryReposition(reason, role, true);
  }

  /** giữ tương thích TIP-018: ép sườn tới điểm cho sẵn */
  orderFlank(pos: V3): boolean {
    if (!this.alive || this.state === 'RETREAT' || this.state === 'DEAD') return false;
    if (!this.setPathTo(pos[0], pos[1], pos[2])) return false;
    this.releaseCover();
    this.cover = { key: `f${Math.round(pos[0])}_${Math.round(pos[2])}`, pos: [pos[0], pos[1], pos[2]], quality: 'none', peek: null, peekSide: 1 };
    this.stats.flanks++;
    this.stats.bounds++;
    this.boundRole = 'flank';
    this.go('FLANK', 'squad_flank');
    return true;
  }

  // ───────────────────────── suy nghĩ ─────────────────────────

  /** Suy nghĩ — gọi từ tier ai10 (dtAi = 0.1 s). LOD giảm tần suất. */
  think(dtAi: number): void {
    if (!this.alive) return;
    this.aiTick++;
    const target = this.deps.target();
    const dist = this.distTo(target.pos);
    const cam = this.deps.camera();
    if (isOnScreen(cam.pos, cam.fwd, this.position)) this.offscreenMs = 0;
    else this.offscreenMs += dtAi * 1000;
    // tổ ta luôn ở cạnh người chơi: LOD theo khoảng cách tới camera, không ngủ khi khuất màn hình (DV-071: trước đây đồng đội
    // sau lưng người chơi "ngủ" giữa trận vì mục tiêu là địch và họ khuất màn hình)
    // người nằm phục canh dù khuất màn hình (không ngủ theo offscreen)
    this.lod = this.deps.faction === 'friend' ? computeLod(Math.hypot(cam.pos[0] - this.position[0], cam.pos[2] - this.position[2]), this.perception.state, 0) : computeLod(dist, this.perception.state, this.ambush ? 0 : this.offscreenMs);
    if (this.lod === 'SLEEP') {
      // ngủ nhưng vẫn nghe (tiếng súng 100 m): rẻ, không tia
      if (this.noises.length) {
        this.facing[0] = -Math.sin(this.yaw);
        this.facing[2] = -Math.cos(this.yaw);
        this.perception.update(dtAi, this.eyePos(), this.facing, target.eye, false, this.noises);
      }
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
    // DV-083: ở tầm REDUCED (30–60 m) cũng xét tầm nhìn (thưa: chỉ những tick được nghĩ) — trước đây địch xa mù với người chơi
    // DV-083: lùm cây/dương xỉ dày che tầm nhìn (luật công bằng PRD §20.3) — deps.sightOcclusion 0..1 (1 = kín)
    let los = target.alive ? this.deps.physics.hasLineOfSight(eye[0], eye[1], eye[2], target.eye[0], target.eye[1], target.eye[2]) : false;
    if (los && this.deps.sightOcclusion) {
      const occ = this.deps.sightOcclusion(eye, target.eye);
      // gần (< 6 m) hoặc đang bắn nhau thì vẫn thấy chớp lửa/động; xa sau lùm kín thì không
      if (occ >= 0.85 && dist > 6 && !(target.isPlayer && this.calmMs < 400)) los = false;
    }
    this.perception.update(dtEff, eye, this.facing, target.eye, los && target.alive, this.noises);
    this.stats.perceptionUpdates++;
    if (this.hunter && target.alive && target.isPlayer && this.deps.faction !== 'friend') this.huntFeed(target, ms);
    this.noises.length = 0;
    const per = this.perception;
    const visible = per.visible && target.alive;
    this.seesPlayer = visible && !!target.isPlayer;

    // mối đe doạ: thấy → mục tiêu; không → vị trí cuối
    const te = visible ? target.eye : per.hasLastKnown ? per.lastKnown : target.eye;
    this.threatEye[0] = te[0];
    this.threatEye[1] = te[1];
    this.threatEye[2] = te[2];
    this.threatFeet[0] = te[0];
    this.threatFeet[1] = te[1] - ai.perception.eyeHeight;
    this.threatFeet[2] = te[2];

    // Timers
    this.cooldownMs = Math.max(0, this.cooldownMs - ms);
    this.burstPauseMs = Math.max(0, this.burstPauseMs - ms);
    this.reactionMs = Math.max(0, this.reactionMs - ms);
    this.seekMs -= ms;
    this.recheckMs -= ms;
    this.phaseMs -= ms;
    if (this.reloadMs > 0) {
      this.reloadMs -= ms;
      if (this.reloadMs <= 0) this.mag = C.mag;
    }
    if (visible) {
      if (this.unseenMs > CIN.warnResetMs && target.isPlayer && this.deps.cinematic) this.warnLeft = CIN.warnShots;
      this.settleMs = Math.min(C.settleMs, this.settleMs + ms);
      this.lostMs = 0;
      this.unseenMs = 0;
    } else {
      this.settleMs = 0;
      this.lostMs += ms;
      this.unseenMs += ms;
    }
    // áp chế: hồi sau calmMs
    this.calmMs += ms;
    if (this.calmMs > S.calmMs) this.suppression = Math.max(0, this.suppression - S.decayPerSec * dtEff);
    if (this.suppression >= S.shakenAt) {
      this.stats.msShaken += ms;
      // nấp, hoặc đang lao vào chỗ che thật (phản ứng đúng khi bị bắn)
      if (this.covered || (this.bounding && this.cover !== null && this.cover.quality !== 'none')) this.stats.msShakenCovered += ms;
    }
    if (this.bounding && los) {
      this.boundExposedMs += ms;
      this.stats.boundExposedMs += ms;
      this.stats.maxBoundExposedMs = Math.max(this.stats.maxBoundExposedMs, this.boundExposedMs);
    }

    // lựu đạn (DV-074): theo dõi mục tiêu đứng yên; đang/cần chạy khỏi vùng nổ thì bỏ qua FSM
    this.trackStill(ms);
    if (this.evadeThink(ms)) return;

    // Timeout/fallback chung
    // tuần tra theo tổ (đồng đội) không có hạn giờ: trước DV-073 hết 60 s PATROL → go('PATROL') không đổi state nên stateMs
    // không về 0 → mỗi tick "timeout" + đặt path về waypoint level (tổ trưởng quay đầu đi ngược)
    const limit = this.state === 'PATROL' && this.deps.followGoal ? undefined : (ai.states as Record<string, number>)[this.state];
    if (limit !== undefined && this.stateMs > limit) {
      this.stateMs = 0;
      this.stats.timeouts++;
      this.deps.events.emit('AI_TIMEOUT', { botId: this.id, state: this.state });
      if (this.inCombat && per.state === 'ALERT') {
        // chiến đấu kéo dài: đứng tại chỗ đánh tiếp thay vì bỏ trận
        this.path = [];
        this.releaseCover();
        this.go('ENGAGE', 'timeout');
      } else {
        this.go('PATROL', 'timeout');
        this.waypointIndex = (this.waypointIndex + 1) % this.deps.waypoints.length;
        const w = this.deps.waypoints[this.waypointIndex]!;
        this.setPathTo(w[0], w[1], w[2]);
      }
      this.aiming = false;
      return;
    }

    // nằm phục: thấy mà còn xa, chưa bị bắn → nằm im chờ (M1-T2)
    if (this.ambush && (this.state === 'PATROL' || this.state === 'INVESTIGATE')) {
      // người nằm phục canh mọi hướng: trong tầm phục + có đường ngắm là nổ súng (không cần nằm trong nón nhìn)
      const trigger = ((visible || los) && target.alive && dist <= C.ambushRange) || this.calmMs < 300 || this.health < ai.health;
      if (!trigger) {
        this.path = [];
        this.stance = 'crouch';
        this.aiming = visible;
        if (visible) this.faceTarget(target.eye);
        return;
      }
      this.ambush = false;
      this.path = [];
      this.faceTarget(target.eye);
      const p = this.perception;
      p.suspicion = 1;
      p.state = 'ALERT';
      p.lastKnown[0] = target.eye[0];
      p.lastKnown[1] = target.eye[1];
      p.lastKnown[2] = target.eye[2];
      p.hasLastKnown = true;
      p.sinceContactMs = 0;
      this.go('ENGAGE', 'ambush');
    }
    // chạm địch khi chưa chiến đấu → ENGAGE (bắn trước, di chuyển sau)
    if (per.state === 'ALERT' && (this.state === 'PATROL' || this.state === 'INVESTIGATE') && (visible || this.calmMs < 300)) {
      this.path = [];
      this.go('ENGAGE', visible ? 'contact' : 'alert_unseen');
    }

    // bị ghim: mọi state chiến đấu trừ khi đang lao tới chỗ che
    if (this.inCombat && this.state !== 'SUPPRESSED' && this.suppression >= S.pinnedAt && !(this.bounding && this.cover && this.cover.quality !== 'none')) {
      this.enterPinned();
      if ((this.state as BotState) !== 'SUPPRESSED') return; // đã lao tìm chỗ
    }

    this.aiming = false;
    switch (this.state) {
      case 'PATROL':
        this.patrolThink();
        if (per.state !== 'UNAWARE' && per.hasLastKnown && !this.deps.followGoal) {
          const lk = per.lastKnown;
          if (this.setPathTo(lk[0], lk[1], lk[2])) this.go('INVESTIGATE', per.state === 'ALERT' ? 'alert_unseen' : 'suspicious');
        }
        break;
      case 'INVESTIGATE':
        if (per.state === 'UNAWARE') this.go('PATROL', 'lost');
        else if (this.arrived()) {
          this.yaw += dtEff * 1.5; // nhìn quanh
          if (this.stateMs > 4000) this.go('PATROL', 'investigated');
        }
        break;
      case 'ENGAGE':
        this.engageThink(target, dist, visible);
        break;
      case 'SEEK_COVER':
      case 'FLANK':
      case 'RETREAT':
        this.boundThink(target, dist, visible);
        break;
      case 'PEEK_FIRE':
        this.peekThink(target, dist, visible);
        break;
      case 'SUPPRESSED':
        this.pinnedThink(ms);
        break;
      case 'DEAD':
        break;
    }
  }

  private grenadeAllowance(): number {
    return (GA.factions as string[]).includes(this.deps.faction ?? 'enemy') ? GA.perBot : 0;
  }

  /** vị trí cuối biết của mục tiêu đứng yên bao lâu (ném lựu đạn vào người nằm im sau chỗ nấp) */
  private trackStill(ms: number): void {
    const per = this.perception;
    if (!per.hasLastKnown) {
      this.lkStillMs = 0;
      return;
    }
    const lk = per.lastKnown;
    if (Math.hypot(lk[0] - this.lkAnchor[0], lk[2] - this.lkAnchor[2]) > GA.stillRadius) {
      this.lkAnchor[0] = lk[0];
      this.lkAnchor[1] = lk[1];
      this.lkAnchor[2] = lk[2];
      this.lkStillMs = 0;
    } else this.lkStillMs += ms;
  }

  /**
   * Lựu đạn gần (≤ fleeRadius, đã chạm đất hoặc bay chậm/sát người): sau phản xạ reactMs (+ jitter) chạy ra khỏi vùng nổ theo hướng
   * ngược lại (thử lệch ±40°/±80° nếu hướng thẳng không có đường), không chạy được thì cúi sát. Trả true khi đang né (bỏ qua FSM).
   */
  private evadeThink(ms: number): boolean {
    if (this.evadeMs > 0) {
      this.evadeMs -= ms;
      this.aiming = false;
      if (this.path.length === 0 || this.arrived()) this.stance = 'crouch';
      if (this.evadeMs <= 0) {
        this.evadeMs = 0;
        this.path = [];
        this.go(this.perception.state === 'ALERT' ? 'ENGAGE' : 'PATROL', 'grenade_clear');
      }
      return true;
    }
    const link = this.deps.grenades;
    if (!link) return false;
    let near: GrenadeDanger | null = null;
    let nd = Infinity;
    for (const g of link.dangers()) {
      const d = Math.hypot(g.pos[0] - this.position[0], g.pos[2] - this.position[2]);
      if (d > GA.fleeRadius || Math.abs(g.pos[1] - this.position[1]) > 4) continue;
      const sp = Math.hypot(g.vel[0], g.vel[1], g.vel[2]);
      if (!(g.landed || sp < GA.noticeSpeed || d < GA.noticeFlightRadius)) continue;
      if (d < nd) {
        nd = d;
        near = g;
      }
    }
    if (!near) {
      this.grenadeNoticeMs = 0;
      return false;
    }
    if (this.grenadeNoticeMs === 0) this.grenadeReactMs = GA.reactMs + this.prng.next() * GA.reactJitterMs;
    this.grenadeNoticeMs += ms;
    if (this.grenadeNoticeMs < this.grenadeReactMs) return false;
    this.grenadeNoticeMs = 0;
    this.stats.grenadeEvades++;
    this.releaseCover();
    this.boundReason = 'grenade';
    this.boundRole = this.role;
    this.ambush = false;
    this.go('RETREAT', 'grenade');
    this.evadeMs = Math.max(600, near.fuseMs + 400);
    if (!this.fleeFrom(near.pos)) {
      this.path = [];
      this.stance = 'crouch';
    }
    return true;
  }

  private fleeFrom(gp: Readonly<V3>): boolean {
    let ax = this.position[0] - gp[0];
    let az = this.position[2] - gp[2];
    let l = Math.hypot(ax, az);
    if (l < 0.2) {
      ax = Math.sin(this.yaw);
      az = Math.cos(this.yaw);
      l = 1;
    }
    ax /= l;
    az /= l;
    const want = GA.fleeRadius + 1.5;
    for (const deg of [0, 40, -40, 80, -80]) {
      const a = (deg * Math.PI) / 180;
      const dx = ax * Math.cos(a) - az * Math.sin(a);
      const dz = ax * Math.sin(a) + az * Math.cos(a);
      const n = this.deps.nav.nearest({ x: gp[0] + dx * want, y: this.position[1], z: gp[2] + dz * want });
      if (!n || Math.hypot(n.x - gp[0], n.z - gp[2]) < GA.fleeRadius - 0.5) continue;
      if (this.setPathTo(n.x, n.y, n.z)) return true;
    }
    return false;
  }

  /**
   * Ném lựu đạn (DV-074): còn lựu đạn, mục tiêu ALERT ở 12–30 m, nằm im ≥ stillMs (và đang khuất, hoặc nằm im gấp đôi), Game cho phép
   * (hồi chiêu chung/nhóm, số quả đang bay), qua xác suất `chance`. Điểm rơi tản theo cự ly. Trả true nếu đã ném.
   */
  private maybeGrenade(): boolean {
    const link = this.deps.grenades;
    if (!link || this.grenades <= 0) return false;
    const per = this.perception;
    if (per.state !== 'ALERT' || !per.hasLastKnown) return false;
    if (this.lkStillMs < GA.stillMs) return false;
    if (this.unseenMs < GA.unseenMs && this.lkStillMs < GA.stillMs * 2) return false;
    const lk = per.lastKnown;
    const d = Math.hypot(lk[0] - this.position[0], lk[2] - this.position[2]);
    if (d < GA.minRange || d > GA.maxRange) return false;
    if (!link.canThrow(this)) return false;
    if (this.prng.next() > GA.chance) return false;
    const sc = GA.scatterBase + d * GA.scatterPerM;
    const tx = lk[0] + this.prng.gaussian() * sc;
    const tz = lk[2] + this.prng.gaussian() * sc;
    const ty = this.deps.groundHeight?.(tx, tz) ?? lk[1] - ai.perception.eyeHeight;
    const to: V3 = [tx, ty, tz];
    const from: V3 = [this.position[0], this.position[1] + 1.7, this.position[2]];
    if (!link.throwAt(this, from, to)) return false;
    this.grenades--;
    this.stats.grenades++;
    this.deps.events.emit('AI_GRENADE', { botId: this.id, target: to });
    return true;
  }

  private needsRetreat(): boolean {
    return this.health < C.retreatHealth && this.role !== 'fallback' && this.deps.faction !== 'friend';
  }

  private startReload(inCover: boolean): void {
    if (this.reloadMs > 0 || this.mag === C.mag) return;
    this.reloadMs = C.reloadMs;
    if (inCover) this.stats.reloadsInCover++;
    this.deps.events.emit('AI_RELOAD', { botId: this.id });
  }

  /** ENGAGE: chưa có chỗ — phản xạ, cúi, bắn tại chỗ; tìm vị trí ngay khi phản xạ xong. */
  private engageThink(target: BotTarget, dist: number, visible: boolean): void {
    const per = this.perception;
    this.faceTarget(this.threatEye);
    this.aiming = true;
    this.stance = dist > 15 || this.suppression >= S.shakenAt ? 'crouch' : 'stand';
    if (this.needsRetreat()) {
      this.role = 'fallback';
      if (this.tryReposition('low_health', 'fallback', true)) return;
    }
    if (this.mag === 0) this.startReload(false);
    if (visible && this.reactionMs <= 0 && dist <= C.engageRange) this.tryFire(target, false);
    else if (!visible && (this.role === 'support' || this.role === 'escort') && this.unseenMs < C.suppressFireMs && per.hasLastKnown && this.reactionMs <= 0) this.trySuppressFire();
    if (this.seekMs <= 0 && this.reactionMs <= 0) {
      this.seekMs = C.noCoverRetryMs;
      // đang đứng ở chỗ che được? → giữ chỗ luôn
      const here = this.tactics.field.probe(this.position[0], this.position[1], this.position[2], this.threatEye);
      if (here !== 'none' && this.role !== 'assault' && this.role !== 'flank') {
        this.releaseCover();
        const key = `h${Math.round(this.position[0] / 1.5)}_${Math.round(this.position[2] / 1.5)}`;
        this.cover = { key, pos: [this.position[0], this.position[1], this.position[2]], quality: here, peek: null, peekSide: 1 };
        this.reservations.set(key, this.id);
        this.enterPosition('cover_here');
        return;
      }
      // trống trải: lao (tự vệ khi lộ không cần giấy phép); không thì chờ giấy phép tổ
      // trống trải + đang bị bắn → chạy ngay; không thì bắn trả và chờ lượt lao của tổ (không cả tổ cùng chạy)
      const exposed = here === 'none';
      if (this.tryReposition(exposed ? 'exposed' : 'engaged', this.role, exposed && (this.calmMs < 300 || this.suppression >= S.shakenAt))) return;
    }
    // mất dấu → tiến lên vị trí cuối (tổ ta: về theo tổ, không đi "điều tra" lạc khỏi người chơi — DV-083)
    if (!visible && this.lostMs > C.lostMs * 2) {
      if (this.deps.followGoal && this.deps.faction === 'friend') {
        this.releaseCover();
        this.path = [];
        this.go('PATROL', 'regroup');
      } else if (per.hasLastKnown && this.setPathTo(per.lastKnown[0], per.lastKnown[1], per.lastKnown[2])) this.go('INVESTIGATE', 'lost_contact');
      else if (per.state === 'UNAWARE') this.go('PATROL', 'calm');
    }
  }

  /** SEEK_COVER / FLANK / RETREAT: lao tới chỗ — KHÔNG bắn (trừ cự ly gần), tới nơi → nấp/ló. */
  private boundThink(target: BotTarget, dist: number, visible: boolean): void {
    this.stance = 'stand';
    if (visible && dist < C.noFireMoveRange) {
      this.faceTarget(target.eye);
      this.aiming = true;
      this.tryFire(target, true);
    }
    if (this.mag === 0) this.startReload(false);
    if (this.arrived()) {
      this.path = [];
      if (this.cover) this.enterPosition(this.state === 'FLANK' ? 'flank_done' : 'in_cover');
      else this.go('ENGAGE', 'arrived_no_cover');
    }
  }

  /** PEEK_FIRE: nấp ↔ ló theo loại che; nạp đạn khi nấp; đổi chỗ theo vai khi tổ cho phép. */
  private peekThink(target: BotTarget, dist: number, visible: boolean): void {
    const per = this.perception;
    const c = this.cover;
    this.path = [];
    if (!c) {
      this.go('ENGAGE', 'no_cover');
      return;
    }
    if (per.state !== 'ALERT') {
      this.releaseCover();
      if (this.deps.followGoal && this.deps.faction === 'friend') this.go('PATROL', 'regroup');
      else if (per.hasLastKnown && this.setPathTo(per.lastKnown[0], per.lastKnown[1], per.lastKnown[2])) this.go('INVESTIGATE', 'lost_contact');
      else this.go('PATROL', 'calm');
      return;
    }
    if (this.needsRetreat()) {
      this.role = 'fallback';
      if (this.tryReposition('low_health', 'fallback', true)) return;
    }
    // tổ ta: neo dời xa (người chơi đi tiếp) → đổi chỗ theo
    const esc = this.deps.escort?.() ?? null;
    if (esc && Math.hypot(c.pos[0] - esc.anchor[0], c.pos[2] - esc.anchor[2]) > esc.radius + 3) {
      if (this.tryReposition('follow_anchor', this.role, true)) return;
    }
    if (this.peeking) {
      if (visible) this.peekSawTarget = true;
      this.peekElapsedMs += 100;
      const spot = c.quality === 'full' && c.peek ? c.peek : c.pos;
      this.moveTarget = spot;
      this.stance = c.quality === 'none' ? 'crouch' : 'stand';
      this.faceTarget(visible ? target.eye : this.threatEye);
      this.aiming = true;
      const there = this.distTo(spot) < 0.35;
      // ló ra tới mép: mục tiêu nằm im sau chỗ nấp → ném lựu đạn rồi thụt xuống (DV-074)
      if (there && !this.peekThrowChecked) {
        this.peekThrowChecked = true;
        if (this.maybeGrenade()) {
          this.peeksDone++;
          this.setPhase(false);
          return;
        }
      }
      if (there && visible && this.reactionMs <= 0 && dist <= C.engageRange) this.tryFire(target, false);
      // yểm trợ và tổ ta bắn áp chế vào chỗ địch vừa khuất (tổ ta "lính cũ" giữ hoả lực cho người chơi cơ động)
      else if (there && !visible && (this.role === 'support' || this.role === 'escort' || esc?.mode === 'suppress') && this.unseenMs < C.suppressFireMs) this.trySuppressFire(esc?.mode === 'suppress' ? esc.aimPoint : null);
      // run tay → thụt xuống sớm; hết giờ → nấp
      const duck = this.suppression >= S.shakenAt && this.peekElapsedMs > 400;
      if (this.phaseMs <= 0 || duck || (this.mag === 0 && this.reloadMs <= 0)) {
        this.peeksDone++;
        if (!this.peekSawTarget) this.peekFails++;
        else this.peekFails = 0;
        if ((this.role === 'assault' || this.role === 'flank' || esc?.mode === 'advance') && this.peeksDone >= this.advanceAfter) this.wantMove = true;
        this.setPhase(false);
      }
      return;
    }
    // nấp
    this.moveTarget = c.pos;
    this.stance = 'crouch';
    this.faceTarget(this.threatEye);
    if (this.mag < C.mag * C.reloadInCoverFrac) this.startReload(true);
    if (this.phaseMs > 0 || this.reloadMs > 0) return;
    // chuẩn bị ló: chỗ còn che? (mối đe doạ có thể đã vòng sườn)
    if (this.recheckMs <= 0) {
      this.recheckMs = C.coverRecheckMs;
      if (!this.coverHolds()) {
        this.stats.compromised++;
        const underFire = this.calmMs < 300;
        if (this.tryReposition(underFire ? 'compromised_fire' : 'compromised', this.role, underFire)) return;
      }
    }
    if (this.peekFails >= C.peekFailMax) {
      // ló mãi không thấy: yểm trợ/giữ đổi chỗ; xung kích đi tìm
      this.peekFails = 0;
      if (this.role === 'support' || this.role === 'hold' || this.role === 'escort') {
        if (this.tryReposition('peek_lost', this.role)) return;
      } else if (per.hasLastKnown) {
        if (this.tryReposition('peek_lost', 'assault')) return;
      }
    }
    if (this.wantMove) {
      const next: TacticalRole = this.role === 'flank' ? 'flank' : esc?.mode === 'advance' ? 'escort' : 'assault';
      if (this.tryReposition('advance', next)) return;
      if (!this.team || this.team.mayMove(this)) {
        // không có chỗ tốt hơn: đánh tiếp từ đây vài lượt ló nữa
        this.wantMove = false;
        this.peeksDone = 0;
      } // còn lại: chờ lượt lao (ló thêm, yểm trợ người đang lao)
    }
    if (!this.refreshPeek()) {
      // chỗ 'full' không có góc ló cho hướng này
      this.stats.compromised++;
      if (this.tryReposition('no_angle', this.role)) return;
    }
    this.setPhase(true);
  }

  /** bị ghim: lao tìm chỗ che nếu đang trống trải, không thì cúi sát trong chỗ */
  private enterPinned(): void {
    this.stats.pins++;
    this.deps.events.emit('AI_PINNED', { botId: this.id });
    this.pinnedMs = 0;
    const here = this.cover && this.distTo(this.cover.pos) < 1.2 ? this.cover.quality : this.tactics.field.probe(this.position[0], this.position[1], this.position[2], this.threatEye);
    if (here === 'none') {
      this.path = [];
      if (this.tryReposition('pinned', this.role === 'escort' ? 'escort' : 'hold', true)) return;
    } else if (!this.cover || this.distTo(this.cover.pos) >= 1.2) {
      this.releaseCover();
      const key = `h${Math.round(this.position[0] / 1.5)}_${Math.round(this.position[2] / 1.5)}`;
      this.cover = { key, pos: [this.position[0], this.position[1], this.position[2]], quality: here, peek: null, peekSide: 1 };
      this.reservations.set(key, this.id);
    }
    this.path = [];
    this.go('SUPPRESSED', 'pinned');
  }

  private pinnedThink(ms: number): void {
    this.pinnedMs += ms;
    this.stance = 'crouch';
    this.aiming = false;
    if (this.cover) this.moveTarget = this.cover.pos;
    this.faceTarget(this.threatEye);
    if (this.mag < C.mag * 0.6) this.startReload(true);
    if (this.suppression < S.releaseAt || this.pinnedMs > S.pinnedMaxMs) {
      if (this.pinnedMs > S.pinnedMaxMs) this.suppression = Math.min(this.suppression, S.releaseAt);
      if (this.cover) this.enterPosition('unpinned');
      else this.go('ENGAGE', 'unpinned');
    }
  }

  private setStep(x: number, z: number): void {
    const n = this.deps.nav.nearest({ x, y: this.position[1], z });
    if (!n || Math.hypot(n.x - x, n.z - z) > 1.5) return;
    this.stepPos[0] = n.x;
    this.stepPos[1] = n.y;
    this.stepPos[2] = n.z;
    this.moveTarget = this.stepPos;
  }

  /** DV-083: nhóm săn — mất dấu người chơi quá huntRefreshMs thì "được báo" vị trí (lệch ≤ huntJitterM), giữ ALERT */
  private huntFeed(target: BotTarget, ms: number): void {
    this.huntMs -= ms;
    if (this.huntMs > 0) return;
    this.huntMs = HUNT.refreshMs;
    if (this.perception.visible) return;
    const j = HUNT.jitterM;
    const pos: V3 = [target.eye[0] + (this.prng.next() - 0.5) * 2 * j, target.eye[1], target.eye[2] + (this.prng.next() - 0.5) * 2 * j];
    const p = this.perception;
    if (p.state === 'ALERT' && this.state !== 'PATROL' && this.state !== 'INVESTIGATE') {
      // đang trong trận: chỉ cập nhật vị trí cuối, giữ báo động (không rơi về tuần tra)
      p.lastKnown[0] = pos[0];
      p.lastKnown[1] = pos[1];
      p.lastKnown[2] = pos[2];
      p.hasLastKnown = true;
      p.sinceContactMs = 0;
      p.suspicion = Math.max(p.suspicion, ai.perception.alertAt);
      return;
    }
    this.alertTo(pos);
  }

  /** lùi một bước (giữ cho test/calib) */
  stepAway(t: V3, d: number): void {
    const dx = t[0] - this.position[0];
    const dz = t[2] - this.position[2];
    const l = Math.hypot(dx, dz) || 1;
    this.setStep(this.position[0] - (dx / l) * d, this.position[2] - (dz / l) * d);
  }

  private patrolThink(): void {
    if (this.deps.followGoal) {
      // đồng đội (TIP-M1A): đi tới điểm đội hình; replan khi điểm dời > 1,5 m hoặc mỗi 1 s; không có điểm → đứng
      const g = this.deps.followGoal();
      this.speedMul = g?.run ? 1.8 : (g?.mul ?? 1); // chạy theo kịp người chơi nước rút (~6,3 m/s); hành quân chậm (M1-T2)
      if (!g) {
        this.path = [];
        return;
      }
      const dx = g.x - this.position[0];
      const dz = g.z - this.position[2];
      if (Math.hypot(dx, dz) < 1.2) {
        this.path = [];
        this.followReplanMs = 0;
        return;
      }
      const last = this.path.length ? this.path[this.path.length - 1]! : null;
      const moved = !last || Math.hypot(last.x - g.x, last.z - g.z) > 1.5;
      this.followReplanMs += 100;
      // replan có nhịp (≥ 1 s; mất đường thì 0,3 s): goal rơi ngoài navmesh làm path ngắn "tới nơi" ngay → trước đây replan mỗi
      // tick, path reset về góc đầu, tổ trưởng đi lùi (DV-073)
      const need = this.path.length === 0 || this.arrived() || moved;
      if (need && this.followReplanMs >= (this.path.length === 0 ? 300 : 1000)) {
        this.followReplanMs = 0;
        // cao độ đích theo mặt đất (đích cao hơn/thấp hơn > 4 m thì navmesh.nearest theo y hiện tại không tìm thấy)
        const gy = this.deps.groundHeight?.(g.x, g.z) ?? this.position[1];
        if (!this.setPathTo(g.x, gy, g.z)) this.path = [];
      }
      return;
    }
    this.speedMul = 1;
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
    const horiz = Math.hypot(t[0] - this.position[0], t[2] - this.position[2]);
    this.aimPitch = Math.atan2(t[1] - (this.position[1] + this.eyeHeight), Math.max(0.5, horiz));
    this.facing[0] = -Math.sin(this.yaw);
    this.facing[2] = -Math.cos(this.yaw);
  }

  /** bắn áp chế vào vị trí cuối (hoặc điểm lệnh) khi không thấy: tản lớn */
  private trySuppressFire(point: V3 | null = null): void {
    const p = point ?? this.perception.lastKnown;
    this.faceTarget(p);
    if (this.fire(p, C.suppressSpreadDeg, 0)) this.stats.suppressShots++;
  }

  /** Bắn vào mục tiêu: độ chụm "settle", di chuyển/run tay thì loãng; người chơi: vé tấn công + loạt cảnh cáo (điện ảnh). */
  private tryFire(target: BotTarget, moving: boolean): void {
    const settle = C.settleMs > 0 ? this.settleMs / C.settleMs : 1;
    let spread = C.spreadFirstDeg + (C.spreadDeg - C.spreadFirstDeg) * settle;
    if (moving) spread *= C.moveSpreadMul;
    if (this.suppression >= S.shakenAt) spread *= S.shakenSpreadMul;
    let offset = 0;
    let warn = false;
    if (target.isPlayer && this.deps.cinematic) {
      if (this.warnLeft > 0) {
        offset = CIN.warnOffsetM;
        warn = true;
      } else if (!this.hasToken) {
        spread *= CIN.noTokenSpreadMul;
        offset = CIN.noTokenAimOffsetM;
      }
    }
    if (this.deps.faction === 'friend') spread *= C.botVsBotSpreadMul; // tổ ta bắn địch phải có thương vong (nhịp điện ảnh)
    const a = this.aimPoint;
    a[0] = target.eye[0];
    a[1] = target.eye[1] - C.aimDrop;
    a[2] = target.eye[2];
    // ngực bị che (nấp thấp, ló đầu) → nhắm đầu
    if (this.cooldownMs <= 0 && this.burstPauseMs <= 0) {
      const e = this.eyePos();
      if (!this.deps.physics.hasLineOfSight(e[0], e[1], e[2], a[0], a[1], a[2])) a[1] = target.eye[1] - 0.1;
    }
    if (this.fire(a, spread, offset) && warn) {
      this.warnLeft--;
      this.stats.warnShots++;
    }
  }

  private fire(aim: V3, spreadDeg: number, offsetM: number): boolean {
    if (this.cooldownMs > 0 || this.burstPauseMs > 0 || this.mag <= 0 || this.reloadMs > 0) return false;
    const eye = this.eyePos();
    let ax = aim[0];
    const ay = aim[1] + (offsetM > 0 ? (this.prng.next() - 0.3) * offsetM * 0.6 : 0);
    let az = aim[2];
    if (offsetM > 0) {
      // lệch ngang có chủ đích: đạn sượt cạnh người (nghe "chiu", thấy đạn vạch) chứ không trúng
      const dx = aim[0] - eye[0];
      const dz = aim[2] - eye[2];
      const l = Math.hypot(dx, dz) || 1;
      const side = this.prng.next() < 0.5 ? -1 : 1;
      const off = offsetM * (0.7 + this.prng.next() * 0.6) * side;
      ax += (-dz / l) * off;
      az += (dx / l) * off;
    }
    const dx = ax - eye[0];
    const dy = ay - eye[1];
    const dz = az - eye[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    this.fireOut[0] = dx / len;
    this.fireOut[1] = dy / len;
    this.fireOut[2] = dz / len;
    if (this.bounding && Math.hypot(dx, dz) > C.noFireMoveRange) this.stats.shotsWhileBounding++;
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
    this.deps.events.emit('BOT_FIRED', { botId: this.id, origin: [eye[0], eye[1], eye[2]], dir: [this.fireOut[0], this.fireOut[1], this.fireOut[2]], faction: this.deps.faction ?? 'enemy' });
    // đầu nòng ra khỏi quả cầu đầu của chính mình (r 0,16 quanh mắt): trước DV-071 tia xuất phát TRONG đầu bot → mọi phát vào
    // lớp ACTOR trúng chính mình (HIT cùng phe bị bỏ qua) → đồng đội/địch bắn nhau không bao giờ trúng
    const o = this.muzzle;
    o[0] = eye[0] + this.fireOut[0] * MUZZLE_OFFSET;
    o[1] = eye[1] + this.fireOut[1] * MUZZLE_OFFSET;
    o[2] = eye[2] + this.fireOut[2] * MUZZLE_OFFSET;
    resolveShot(this.deps.physics, o, this.fireOut, spreadDeg, BOT_HITSCAN, this.prng, this.deps.exclude(), this.hits, this.deps.hitMask ?? (LAYER.WORLD | LAYER.PLAYER));
    for (let i = 0; i < this.hits.length; i++) {
      const h = this.hits[i]!;
      if (h.kind === 'actor' && h.actorId === this.id) continue;
      if (h.kind === 'actor' && h.actorId) {
        this.stats.hits++;
        this.deps.events.emit('HIT', { actorId: h.actorId, zone: h.zone ?? 'body', damage: h.damage, point: h.point, penetrated: false, shooter: this.id });
      } else this.deps.events.emit('IMPACT', { point: h.point, normal: h.normal, material: h.material, penetrated: false });
    }
    return true;
  }

  /**
   * Bám mặt navmesh tại x/z hiện tại (TIP-D11a, Chủ nhà: "quân địch bay trên không trung"): trên terrain, đoạn thẳng giữa hai
   * góc của straight path dài tới 60 m và lệch cao độ hàng chục m — lấy y của góc kế (cách cũ) làm bot lơ lửng/chìm.
   * Không tìm được điểm gần (< 1,5 m ngang) → dùng fallback (y góc kế / y hiện tại).
   */
  private settleY(fallback: number): void {
    const g = this.deps.groundHeight?.(this.position[0], this.position[2]);
    if (g !== null && g !== undefined) {
      this.position[1] = g;
      return;
    }
    const n = this.deps.nav.nearest({ x: this.position[0], y: this.position[1], z: this.position[2] });
    this.position[1] = n && Math.hypot(n.x - this.position[0], n.z - this.position[2]) < 1.5 ? n.y : fallback;
  }

  /**
   * Bước tới (x, z) nhưng **trượt trên mặt navmesh** (moveAlongSurface): mép navmesh = tường/thân cây (obstacle bake DV-040) →
   * bot không xuyên thân cây ở mọi state (Chủ nhà Mac 2026-09-06: "đồng đội chạy xuyên qua cây"). Không có navmesh gần → đi thẳng.
   */
  private slide(x: number, z: number): void {
    const r = this.deps.nav.moveAlong({ x: this.position[0], y: this.position[1], z: this.position[2] }, { x, y: this.position[1], z });
    if (r) {
      this.position[0] = r.x;
      this.position[2] = r.z;
    } else {
      this.position[0] = x;
      this.position[2] = z;
    }
  }

  /** Di chuyển theo path — tier sim60. */
  move(dt: number): void {
    if (!this.alive) return;
    const mt = this.moveTarget;
    if (mt && !PATH_STATES.has(this.state)) {
      // di chuyển thẳng ngắn (ló/nấp): mặt vẫn hướng mối đe doạ (faceTarget ở think)
      this.stuckMs = 0;
      const dx = mt[0] - this.position[0];
      const dz = mt[2] - this.position[2];
      const d = Math.hypot(dx, dz);
      if (d > 0.05) {
        const sp = this.stance === 'crouch' ? ai.move.crouchSpeed : ai.move.peekSpeed;
        const step = Math.min(d, sp * dt);
        this.slide(this.position[0] + (dx / d) * step, this.position[2] + (dz / d) * step);
        this.settleY(this.position[1]);
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
        const base = BOUND_STATES.has(this.state) ? ai.move.boundSpeed : this.perception.state === 'ALERT' ? ai.move.alertSpeed : ai.move.speed;
        const speed = base * this.speedMul;
        const step = Math.min(d, speed * dt);
        this.slide(this.position[0] + (dx / d) * step, this.position[2] + (dz / d) * step);
        this.settleY(wp.y);
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
    this.addSuppression(S.hitGain);
    if (fromPos) {
      const p = this.perception;
      p.suspicion = 1;
      p.lastKnown[0] = fromPos[0];
      p.lastKnown[1] = fromPos[1];
      p.lastKnown[2] = fromPos[2];
      p.hasLastKnown = true;
      p.sinceContactMs = 0;
      p.state = 'ALERT';
      // trúng đạn khi đang nấp → chỗ đã lộ
      if (this.covered) this.recheckMs = 0;
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
    this.releaseCover();
    this.moveTarget = null;
    this.perception.reset();
    this.stateMs = 0;
    this.reloadMs = 0;
    this.cooldownMs = 0;
    this.burstPauseMs = 0;
    this.burstLeft = C.burst;
    this.reactionMs = 0;
    this.settleMs = 0;
    this.lostMs = 0;
    this.unseenMs = 1e9;
    this.warnLeft = 0;
    this.suppression = 0;
    this.calmMs = 1e9;
    this.seekMs = 0;
    this.recheckMs = 0;
    this.phaseMs = 0;
    this.peeking = false;
    this.peekFails = 0;
    this.peeksDone = 0;
    this.wantMove = false;
    this.pinnedMs = 0;
    this.stance = 'stand';
    this.aiming = false;
    this.hasToken = true;
    this.seesPlayer = false;
    this.ambush = false;
    this.grenades = this.grenadeAllowance();
    this.evadeMs = 0;
    this.grenadeNoticeMs = 0;
    this.lkStillMs = 0;
    this.lkAnchor[0] = 1e9;
    this.lkAnchor[2] = 1e9;
    this.peekThrowChecked = false;
  }

  reset(spawn: V3): void {
    this.restore({ id: this.id, position: spawn, yaw: 0, health: ai.health, alive: true, state: 'PATROL', waypointIndex: 0, mag: C.mag });
    this.waypointIndex = this.nearestWaypoint();
    this.role = this.deps.faction === 'friend' ? 'escort' : 'assault';
    const st = this.stats as Record<string, number>;
    for (const k of Object.keys(st)) st[k] = 0;
    this.offscreenMs = 0;
    this.aiTick = 0;
    this.aimPitch = 0;
  }
}
