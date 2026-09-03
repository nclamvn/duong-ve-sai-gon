/**
 * Tổ địch (TIP-018): mỗi `tickMs`, theo nhóm — ≥ 2 bot đang chiến đấu cùng mục tiêu, chưa ai ép sườn → bot xa mục tiêu nhất
 * đi tới cover marker có góc (quanh mục tiêu) ≥ flankAngleDeg so với mọi đồng đội. 1 flanker/nhóm, cooldown theo nhóm.
 * Thuần logic; không hard-code mission.
 */
import ai from '@content/tuning/ai.json';
import type { CoverMarker } from '@engine/render/arena';
import type { Bot } from './bot';

type V3 = [number, number, number];
const COMBAT: ReadonlySet<string> = new Set(['ENGAGE', 'SEEK_COVER', 'PEEK_FIRE']);

export interface SquadMember {
  group: string;
  bot: Bot;
}

export class SquadCoordinator {
  private accMs = 0;
  private readonly cooldown = new Map<string, number>();
  readonly stats = { flankOrders: 0 };

  constructor(
    private readonly markers: CoverMarker[],
    private readonly cfg = ai.squad,
  ) {}

  /** gọi ở tier sim60 hoặc ai10 với dt giây */
  tick(members: Iterable<SquadMember>, dt: number, target: V3): void {
    this.accMs += dt * 1000;
    for (const [g, ms] of this.cooldown) this.cooldown.set(g, Math.max(0, ms - dt * 1000));
    if (this.accMs < this.cfg.tickMs) return;
    this.accMs = 0;
    const groups = new Map<string, SquadMember[]>();
    for (const m of members) {
      if (!m.bot.alive) continue;
      let arr = groups.get(m.group);
      if (!arr) groups.set(m.group, (arr = []));
      arr.push(m);
    }
    for (const [group, arr] of groups) {
      if ((this.cooldown.get(group) ?? 0) > 0) continue;
      if (arr.some((m) => m.bot.state === 'FLANK')) continue;
      const engaged = arr.filter((m) => COMBAT.has(m.bot.state) && m.bot.perception.state === 'ALERT');
      if (engaged.length < 2) continue;
      // bot xa mục tiêu nhất đi ép sườn
      let flanker = engaged[0]!;
      let fd = -1;
      for (const m of engaged) {
        const d = Math.hypot(m.bot.position[0] - target[0], m.bot.position[2] - target[2]);
        if (d > fd) {
          fd = d;
          flanker = m;
        }
      }
      const others = engaged.filter((m) => m !== flanker);
      const pos = this.pickFlankPoint(target, others.map((m) => m.bot.position), flanker.bot.position);
      if (pos && flanker.bot.orderFlank(pos)) {
        this.stats.flankOrders++;
        this.cooldown.set(group, this.cfg.cooldownMs);
      }
    }
  }

  /** marker trong [flankMinDist, flankMaxDist] quanh mục tiêu, góc nhỏ nhất tới các đồng đội ≥ flankAngleDeg, ưu tiên góc lớn rồi gần flanker */
  pickFlankPoint(target: V3, allies: V3[], self: V3): V3 | null {
    const minA = (this.cfg.flankAngleDeg * Math.PI) / 180;
    let best: V3 | null = null;
    let bestScore = -Infinity;
    for (const m of this.markers) {
      const dx = m.position[0] - target[0];
      const dz = m.position[2] - target[2];
      const d = Math.hypot(dx, dz);
      if (d < this.cfg.flankMinDist || d > this.cfg.flankMaxDist) continue;
      const ang = Math.atan2(dz, dx);
      let minDiff = Math.PI;
      for (const a of allies) {
        const aa = Math.atan2(a[2] - target[2], a[0] - target[0]);
        let diff = Math.abs(ang - aa);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        minDiff = Math.min(minDiff, diff);
      }
      if (minDiff < minA) continue;
      const dSelf = Math.hypot(m.position[0] - self[0], m.position[2] - self[2]);
      const score = minDiff * 10 - dSelf * 0.3;
      if (score > bestScore) {
        bestScore = score;
        best = [m.position[0], m.position[1], m.position[2]];
      }
    }
    return best;
  }
}
