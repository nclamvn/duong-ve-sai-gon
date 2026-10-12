/**
 * Tổ chiến đấu (AI-T1.4, DV-071; thay SquadCoordinator TIP-018 "1 người ép sườn").
 *
 * FireTeams — theo nhóm (group):
 *   - chia thông tin: một người thấy địch → đồng đội trong shareRadius biết vị trí, vào chiến đấu;
 *   - chia vai khi chạm địch: người đang thấy mục tiêu làm YỂM TRỢ (≤ nửa tổ), còn lại CƠ ĐỘNG (assault);
 *   - **lao xen kẽ**: mỗi lúc tối đa maxMovers người lao, và chỉ khi có người khác đang bắn yểm trợ;
 *   - ép sườn phối hợp: sau flankAfterBounds lần lao của nhóm cơ động, một người nhận vai flank (góc ≥ 50° so với yểm trợ);
 *   - mất ≥ fallbackLossFrac quân → cả tổ lùi từng người về điểm rút, rồi giữ.
 * AttackTokens — điện ảnh: tối đa `tokens` địch được bắn "thật" vào người chơi cùng lúc (gần + thấy rõ nhất); còn lại áp chế.
 * Thuần logic; không hard-code mission.
 */
import ai from '@content/tuning/ai.json';
import type { EventBus } from '@engine/core';
import { COMBAT_STATES, type Bot, type BotEvents, type TeamLink } from './bot';

type V3 = [number, number, number];

export interface SquadMember {
  group: string;
  bot: Bot;
  /** tổ ta: không chia vai (Squadmates lo), vẫn lao xen kẽ */
  friend?: boolean;
}

interface GroupState {
  initial: number;
  organized: boolean;
  fellBack: boolean;
  assaultBounds: number;
  flankCooldownMs: number;
  rally: V3 | null;
  members: Bot[];
  friend: boolean;
  /** đã lùi xong */
  fallen: Set<string>;
  /** DV-083: hẹn giờ chia lại vai (người mới vào trận không mặc định cơ động hết) */
  reorgMs: number;
  /** DV-083: hồi chiêu xông lên ép người chơi */
  pushCooldownMs: number;
}

/** DV-083: tình trạng người chơi cho "đạo diễn áp lực" (Game cập nhật mỗi tick) */
export interface PlayerPressure {
  pos: V3;
  reloading: boolean;
  /** không địch nào thấy người chơi đã bao lâu (ms) */
  hiddenMs: number;
  alive: boolean;
}

const TEAM = ai.team;
const SHARE_RADIUS = 45;
/** DV-083 */
const T83 = ai.team as typeof ai.team & { reorgMs?: number; flankMinAlive?: number; pushCooldownMs?: number; pushHiddenMs?: number; pushMax?: number; enemyShareRadius?: number };
const REORG_MS = T83.reorgMs ?? 4000;
const FLANK_MIN_ALIVE = T83.flankMinAlive ?? 2;
const PUSH_COOLDOWN_MS = T83.pushCooldownMs ?? 7000;
const PUSH_HIDDEN_MS = T83.pushHiddenMs ?? 3000;
const PUSH_MAX = T83.pushMax ?? 2;
const ENEMY_SHARE_RADIUS = T83.enemyShareRadius ?? 60;

function flat(a: Readonly<V3>, b: Readonly<V3>): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

export class FireTeams implements TeamLink {
  private accMs = 0;
  private readonly groups = new Map<string, GroupState>();
  private readonly byBot = new Map<Bot, GroupState>();
  readonly stats = { bounds: 0, coveredBounds: 0, flankOrders: 0, flankSuccess: 0, fallbacks: 0, shares: 0, organized: 0, pushes: 0 };
  /** DV-083: người chơi (đạo diễn áp lực); null = tắt */
  pressure: PlayerPressure | null = null;
  private readonly flankBounds = new Map<Bot, number>();
  private readonly unsubs: Array<() => void> = [];

  constructor(events?: EventBus<BotEvents>) {
    if (events) {
      this.unsubs.push(
        events.on('AI_STATE', (e: unknown) => {
          const ev = e as BotEvents['AI_STATE'];
          if (ev.to !== 'PEEK_FIRE' || (ev.from !== 'FLANK' && ev.from !== 'SEEK_COVER')) return;
          for (const [bot, g] of this.byBot) if (bot.id === ev.botId) this.flankArrived(g, bot, ev.from === 'FLANK');
        }),
      );
    }
    const unsub = events
      ? events.on('AI_BOUND', (e: unknown) => {
          const ev = e as BotEvents['AI_BOUND'];
          for (const [bot, g] of this.byBot) {
            if (bot.id !== ev.botId) continue;
            this.stats.bounds++;
            if (g.members.some((m) => m !== bot && m.alive && m.firing)) this.stats.coveredBounds++;
            if (!g.friend && ev.role === 'assault') g.assaultBounds++;
            break;
          }
        })
      : null;
    if (unsub) this.unsubs.push(unsub);
  }

  dispose(): void {
    for (const u of this.unsubs) u();
    this.unsubs.length = 0;
  }

  /** gắn bot vào nhóm (gọi khi spawn); bot.team = this */
  add(m: SquadMember): void {
    let g = this.groups.get(m.group);
    if (!g) {
      g = { initial: 0, organized: false, fellBack: false, assaultBounds: 0, flankCooldownMs: 0, rally: null, members: [], friend: !!m.friend, fallen: new Set(), reorgMs: REORG_MS, pushCooldownMs: 0 };
      this.groups.set(m.group, g);
    }
    if (g.members.includes(m.bot)) return;
    g.members.push(m.bot);
    g.initial++;
    m.bot.group = m.group;
    m.bot.team = this;
    this.byBot.set(m.bot, g);
  }

  remove(bot: Bot): void {
    const g = this.byBot.get(bot);
    if (!g) return;
    g.members.splice(g.members.indexOf(bot), 1);
    this.byBot.delete(bot);
    if (bot.team === this) bot.team = null;
  }

  /** reset nhóm (checkpoint/reset mission) */
  resetGroups(): void {
    for (const g of this.groups.values()) {
      g.organized = false;
      g.fellBack = false;
      g.assaultBounds = 0;
      g.flankCooldownMs = 0;
      g.rally = null;
      g.fallen.clear();
      g.initial = g.members.length;
      g.reorgMs = REORG_MS;
      g.pushCooldownMs = 0;
    }
    this.flankBounds.clear();
  }

  // ── TeamLink ──
  mayMove(bot: Bot): boolean {
    const g = this.byBot.get(bot);
    if (!g) return true;
    const alive = g.members.filter((m) => m.alive);
    if (alive.length <= 1) return true;
    const maxMovers = alive.length >= TEAM.largeGroup ? TEAM.maxMoversLarge : TEAM.maxMoversSmall;
    let movers = 0;
    let firing = 0;
    let engaged = 0;
    for (const m of alive) {
      if (m === bot) continue;
      if (m.bounding) movers++;
      if (m.firing) firing++;
      if (m.inCombat) engaged++;
    }
    if (movers >= maxMovers) return false;
    // lao khi có người yểm trợ; không ai khác đang đánh thì tự do
    return firing > 0 || engaged === 0 || engaged === movers;
  }

  allies(bot: Bot): readonly V3[] {
    const g = this.byBot.get(bot);
    if (!g) return [];
    const out: V3[] = [];
    for (const m of g.members) if (m !== bot && m.alive) out.push(m.cover ? m.cover.pos : m.position);
    return out;
  }

  support(bot: Bot): readonly V3[] {
    const g = this.byBot.get(bot);
    if (!g) return [];
    const out: V3[] = [];
    for (const m of g.members) if (m !== bot && m.alive && m.role === 'support') out.push(m.cover ? m.cover.pos : m.position);
    if (out.length === 0) for (const m of g.members) if (m !== bot && m.alive) out.push(m.position);
    return out;
  }

  rally(bot: Bot): V3 | null {
    return this.byBot.get(bot)?.rally ?? null;
  }

  /** gọi ở tier sim60/ai10 với dt giây */
  tick(dt: number): void {
    this.accMs += dt * 1000;
    if (this.accMs < TEAM.tickMs) return;
    const stepMs = this.accMs;
    this.accMs = 0;
    // DV-083: địch các nhóm cùng trận chia thông tin cho nhau (bán kính rộng hơn); tổ ta chia trong tổ
    const enemies: Bot[] = [];
    for (const g of this.groups.values()) if (!g.friend) for (const m of g.members) if (m.alive) enemies.push(m);
    this.share(enemies, ENEMY_SHARE_RADIUS);
    for (const g of this.groups.values()) {
      g.flankCooldownMs = Math.max(0, g.flankCooldownMs - stepMs);
      g.pushCooldownMs = Math.max(0, g.pushCooldownMs - stepMs);
      const alive = g.members.filter((m) => m.alive);
      if (alive.length === 0) continue;
      if (g.friend) this.share(alive);
      const engaged = alive.filter((m) => m.inCombat);
      if (engaged.length === 0) {
        if (g.organized && alive.every((m) => m.state === 'PATROL')) g.organized = false;
        continue;
      }
      if (g.friend) continue;
      if (!g.organized) this.organize(g, alive);
      else {
        g.reorgMs -= stepMs;
        if (g.reorgMs <= 0) {
          g.reorgMs = REORG_MS;
          this.organize(g, alive, true);
        }
      }
      // DV-083 đạo diễn áp lực: người chơi thay đạn hoặc nấp lâu → 1–2 người xông lên ép (cặp), hồi chiêu
      if (this.pressure && this.pressure.alive && g.pushCooldownMs <= 0 && !g.fellBack && (this.pressure.reloading || this.pressure.hiddenMs > PUSH_HIDDEN_MS)) {
        const pp = this.pressure.pos;
        const cands = alive.filter((m) => m.state === 'PEEK_FIRE' && m.role !== 'fallback' && m.role !== 'hold' && m.health > 40 && flat(m.position, pp) < 55);
        cands.sort((a, b) => flat(a.position, pp) - flat(b.position, pp) || (a.id < b.id ? -1 : 1));
        let n = 0;
        for (const m of cands) {
          if (n >= PUSH_MAX) break;
          m.role = 'assault';
          if (m.order('assault', 'team_push')) n++;
        }
        if (n > 0) {
          g.pushCooldownMs = PUSH_COOLDOWN_MS;
          this.stats.pushes++;
        }
      }
      // mất quân → lùi (nhóm săn không lùi: chúng được lệnh đuổi tới cùng)
      if (!g.fellBack && g.initial >= 2 && !alive.some((m) => m.hunter) && alive.length <= Math.floor(g.initial * TEAM.fallbackLossFrac)) {
        g.fellBack = true;
        this.stats.fallbacks++;
        const t = engaged[0]!.threat;
        let cx = 0;
        let cz = 0;
        for (const m of alive) {
          cx += m.position[0];
          cz += m.position[2];
        }
        cx /= alive.length;
        cz /= alive.length;
        const dx = cx - t[0];
        const dz = cz - t[2];
        const l = Math.hypot(dx, dz) || 1;
        g.rally = [cx + (dx / l) * 25, alive[0]!.position[1], cz + (dz / l) * 25];
        for (const m of alive) m.role = 'fallback';
      }
      if (g.fellBack) {
        for (const m of alive) {
          if (g.fallen.has(m.id)) continue;
          if (m.role !== 'fallback') continue;
          if (m.state === 'RETREAT') continue;
          if ((m.state === 'PEEK_FIRE' || m.state === 'ENGAGE') && this.mayMove(m)) {
            if (m.order('fallback', 'team_fallback')) g.fallen.add(m.id);
          }
        }
        // lùi xong → giữ
        for (const m of alive) if (g.fallen.has(m.id) && m.state === 'PEEK_FIRE' && m.role === 'fallback') m.role = 'hold';
        continue;
      }
      // ép sườn phối hợp
      if (alive.length >= FLANK_MIN_ALIVE && g.flankCooldownMs <= 0 && g.assaultBounds >= TEAM.flankAfterBounds && !alive.some((m) => m.role === 'flank' && m.inCombat)) {
        const cands = alive.filter((m) => m.role === 'assault' && m.state === 'PEEK_FIRE');
        if (cands.length) {
          // người đã lệch góc nhiều nhất so với nhóm yểm trợ đi ép sườn (đường vòng ngắn nhất)
          const off = (b: Bot): number => {
            const t = b.threat;
            const a = Math.atan2(b.position[2] - t[2], b.position[0] - t[0]);
            let best = Math.PI;
            for (const s of alive) {
              if (s === b || s.role !== 'support') continue;
              let d = Math.abs(a - Math.atan2(s.position[2] - t[2], s.position[0] - t[0])) % (Math.PI * 2);
              if (d > Math.PI) d = Math.PI * 2 - d;
              best = Math.min(best, d);
            }
            return best;
          };
          cands.sort((a, b) => off(b) - off(a) || (a.id < b.id ? -1 : 1));
          const f = cands[0]!;
          f.role = 'flank';
          if (this.mayMove(f) && f.order('flank', 'team_flank')) {
            this.stats.flankOrders++;
            g.flankCooldownMs = TEAM.flankCooldownMs;
            g.assaultBounds = 0;
          } else f.role = 'assault';
        }
      }
    }
  }

  /** chia vai: người thấy mục tiêu làm yểm trợ (≤ nửa tổ), còn lại cơ động */
  private organize(g: GroupState, alive0: Bot[], again = false): void {
    g.organized = true;
    this.stats.organized++;
    // chia lại (DV-083): giữ người đang ép sườn/lùi/giữ, chia lại phần còn lại
    const alive = again ? alive0.filter((m) => m.role === 'support' || m.role === 'assault') : alive0;
    const n = alive.length;
    if (n === 0) return;
    if (n === 1) {
      alive[0]!.role = 'assault';
      return;
    }
    const nSupport = Math.max(1, Math.floor(n / 2));
    const order = [...alive].sort((a, b) => {
      const va = a.perception.visible ? 0 : 1;
      const vb = b.perception.visible ? 0 : 1;
      return va - vb || flat(a.position, a.threat) - flat(b.position, b.threat) || (a.id < b.id ? -1 : 1);
    });
    order.forEach((m, i) => (m.role = i < nSupport ? 'support' : 'assault'));
  }

  /** người thấy địch hô cho đồng đội trong bán kính */
  private share(alive: Bot[], radius = SHARE_RADIUS): void {
    for (const src of alive) {
      const p = src.perception;
      // chỉ người đã khai hoả mới hô (người nằm phục thấy địch thì im)
      if (!src.inCombat || p.state !== 'ALERT' || !p.hasLastKnown || p.sinceContactMs > 2000) continue;
      for (const m of alive) {
        if (m === src || m.perception.state === 'ALERT') continue;
        if (flat(m.position, src.position) > radius) continue;
        m.alertTo([p.lastKnown[0], p.lastKnown[1], p.lastKnown[2]]);
        this.stats.shares++;
      }
    }
  }

  /** tới chỗ sau lần lao ép sườn: thành công nếu góc quanh mục tiêu ≥ flankAngleDeg so với nhóm yểm trợ (không có thì mọi đồng đội) */
  private flankArrived(g: GroupState, m: Bot, wasFlankState: boolean): void {
    if (!wasFlankState && m.role !== 'flank') return;
    const t = m.threat;
    const a = Math.atan2(m.position[2] - t[2], m.position[0] - t[0]);
    let minD = Math.PI;
    const sup = g.members.filter((s) => s !== m && s.alive && s.role === 'support');
    for (const s of sup.length ? sup : g.members) {
      if (s === m || !s.alive) continue;
      const sa = Math.atan2(s.position[2] - t[2], s.position[0] - t[0]);
      let d = Math.abs(a - sa) % (Math.PI * 2);
      if (d > Math.PI) d = Math.PI * 2 - d;
      minD = Math.min(minD, d);
    }
    const n = (this.flankBounds.get(m) ?? 0) + 1;
    this.flankBounds.set(m, n);
    if ((minD * 180) / Math.PI >= ai.tactics.flankAngleDeg) {
      this.stats.flankSuccess++;
      if (m.role === 'flank') m.role = 'assault';
      this.flankBounds.delete(m);
    } else if (n >= TEAM.flankMaxBounds) {
      // vòng mãi không tới góc: thôi, đánh từ đây
      if (m.role === 'flank') m.role = 'assault';
      this.flankBounds.delete(m);
    } // còn lại: giữ vai flank, lao tiếp sau một lượt ló
  }
}

/** vé tấn công (điện ảnh): ai được bắn "thật" vào người chơi */
export class AttackTokens {
  private accMs = 1e9;
  readonly holders = new Set<Bot>();
  readonly stats = { ticks: 0, maxHolders: 0 };

  constructor(private readonly cfg = ai.cinematic) {}

  tick(bots: Iterable<Bot>, player: Readonly<V3>, dt: number): void {
    this.accMs += dt * 1000;
    if (this.accMs < this.cfg.tokenTickMs) return;
    this.accMs = 0;
    this.stats.ticks++;
    const cands: Bot[] = [];
    for (const b of bots) {
      if (!b.alive) continue;
      b.hasToken = false;
      if (b.seesPlayer && COMBAT_STATES.has(b.state)) cands.push(b);
    }
    // giữ người đang cầm vé nếu còn đủ điều kiện (đỡ nhấp nháy), rồi người gần nhất
    cands.sort((a, b) => {
      const ha = this.holders.has(a) ? 0 : 1;
      const hb = this.holders.has(b) ? 0 : 1;
      return ha - hb || flat(a.position, player) - flat(b.position, player) || (a.id < b.id ? -1 : 1);
    });
    this.holders.clear();
    for (let i = 0; i < Math.min(this.cfg.tokens, cands.length); i++) {
      cands[i]!.hasToken = true;
      this.holders.add(cands[i]!);
    }
    this.stats.maxHolders = Math.max(this.stats.maxHolders, this.holders.size);
  }

  reset(): void {
    this.holders.clear();
    this.accMs = 1e9;
  }
}

/** @deprecated TIP-018 — giữ tên cho mã cũ; dùng FireTeams */
export { FireTeams as SquadCoordinator };
