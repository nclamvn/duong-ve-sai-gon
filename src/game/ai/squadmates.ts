/**
 * Đồng đội có tên (TIP-M1A, Blueprint D13 rút gọn): Quyết dẫn đường về phía mục tiêu (dừng chờ khi ta tụt lại > 14 m),
 * Hải/Sáng đi sau đội hình; lệnh `follow`/`hold` từ mission (`squad_order`); khi thấy địch FSM Bot tự chiến đấu (target = địch
 * gần nhất — game cấp). Barks qua cue thoại có ưu tiên thấp, chống spam (≥ 6 s mỗi người, ≥ 2,5 s toàn tổ).
 * Thuần logic; không three/DOM.
 */
import type { BotActor } from '@game/actors/botActor';

type V3 = [number, number, number];

export interface SquadDeps {
  /** vị trí chân + hướng ngang người chơi (đơn vị) + tốc độ ngang */
  player: () => { feet: V3; fwdX: number; fwdZ: number; speed: number };
  /** điểm mục tiêu hiện tại (marker) */
  objective: () => V3 | null;
  /** phát cue thoại (bark) — trả false nếu bị chặn */
  say: (cueId: string, speaker: string) => boolean;
  now: () => number;
}

export type SquadOrder = 'follow' | 'hold';

interface Member {
  actor: BotActor;
  role: 'leader' | 'follower';
  slot: number;
  lastBarkAt: number;
}

/** bark theo sự kiện → cue theo người nói (locale: dlg.M10…M15) */
const BARKS: Record<string, Record<string, string>> = {
  contact: { QUYET: 'M13', HAI: 'M05', SANG: 'M06' },
  reload: { HAI: 'M10', QUYET: 'M10', SANG: 'M10' },
  kill: { QUYET: 'M11', HAI: 'M14', SANG: 'M14' },
  hurt: { SANG: 'M12', HAI: 'M12', QUYET: 'M12' },
  cover: { SANG: 'M15', HAI: 'M15', QUYET: 'M15' },
};

export class Squadmates {
  order: SquadOrder = 'follow';
  private readonly members: Member[] = [];
  private lastAnyBarkAt = -Infinity;
  readonly stats = { barks: 0, barksDropped: 0 };

  constructor(private readonly deps: SquadDeps) {}

  add(actor: BotActor, role: 'leader' | 'follower'): void {
    this.members.push({ actor, role, slot: this.members.length, lastBarkAt: -Infinity });
  }

  remove(id: string): void {
    const i = this.members.findIndex((m) => m.actor.id === id);
    if (i >= 0) this.members.splice(i, 1);
  }

  clear(): void {
    this.members.length = 0;
  }

  get count(): number {
    return this.members.length;
  }

  list(): readonly BotActor[] {
    return this.members.map((m) => m.actor);
  }

  /** closure cho BotDeps.followGoal của một thành viên */
  goalFor(actorId: string): () => { x: number; z: number; run: boolean } | null {
    return () => {
      const m = this.members.find((mm) => mm.actor.id === actorId);
      if (!m) return null;
      const p = this.deps.player();
      const pos = m.actor.bot.position;
      const dPlayer = Math.hypot(p.feet[0] - pos[0], p.feet[2] - pos[2]);
      if (this.order === 'hold') {
        // đứng gần người chơi nếu quá xa (> 20 m), còn lại giữ chỗ
        if (dPlayer > 20) return { x: p.feet[0] - p.fwdX * 2.5, z: p.feet[2] - p.fwdZ * 2.5, run: true };
        return null;
      }
      if (m.role === 'leader') {
        const o = this.deps.objective();
        if (!o) return this.sideGoal(p, 1, dPlayer);
        const dObj = Math.hypot(o[0] - pos[0], o[2] - pos[2]);
        const dObjPlayer = Math.hypot(o[0] - p.feet[0], o[2] - p.feet[2]);
        const ahead = dObjPlayer - dObj; // > 0: Quyết đang đi trước người chơi
        if (dObj < 5) return null; // tới mục tiêu: đứng chờ
        if (ahead > 14) return null; // ta tụt lại: dừng chờ
        if (dPlayer > 12 && ahead <= 0) {
          // người chơi vượt lên/xa: đuổi tới điểm 3 m trước người chơi về phía mục tiêu
          const px = (o[0] - p.feet[0]) / Math.max(1, dObjPlayer);
          const pz = (o[2] - p.feet[2]) / Math.max(1, dObjPlayer);
          return { x: p.feet[0] + px * 3, z: p.feet[2] + pz * 3, run: true };
        }
        // đi trước 8 m về phía mục tiêu (không vượt quá mục tiêu)
        const step = Math.min(8, dObj - 3);
        const dx = (o[0] - pos[0]) / dObj;
        const dz = (o[2] - pos[2]) / dObj;
        return { x: pos[0] + dx * step, z: pos[2] + dz * step, run: dPlayer < 5 || dPlayer > 10 };
      }
      return this.sideGoal(p, m.slot % 2 === 0 ? -1 : 1, dPlayer);
    };
  }

  /** điểm đội hình: sau người chơi 3 m, lệch ngang ±2 m; đứng yên khi đã gần và ta không di chuyển */
  private sideGoal(p: { feet: V3; fwdX: number; fwdZ: number; speed: number }, side: number, dPlayer: number): { x: number; z: number; run: boolean } | null {
    if (dPlayer < 4.5 && p.speed < 0.3) return null;
    const rx = -p.fwdZ;
    const rz = p.fwdX;
    return { x: p.feet[0] - p.fwdX * 3 + rx * side * 2, z: p.feet[2] - p.fwdZ * 3 + rz * side * 2, run: dPlayer > 9 };
  }

  /** bark theo sự kiện của một thành viên (contact/reload/kill/hurt/cover) */
  bark(actorId: string, kind: keyof typeof BARKS): boolean {
    const m = this.members.find((mm) => mm.actor.id === actorId);
    if (!m || !m.actor.bot.alive) return false;
    const speaker = m.actor.nameKey?.replace('name.', '').toUpperCase() ?? 'QUYET';
    const cue = BARKS[kind]?.[speaker];
    if (!cue) return false;
    const now = this.deps.now();
    if (now - m.lastBarkAt < 6 || now - this.lastAnyBarkAt < 2.5) {
      this.stats.barksDropped++;
      return false;
    }
    if (!this.deps.say(cue, speaker)) return false;
    m.lastBarkAt = now;
    this.lastAnyBarkAt = now;
    this.stats.barks++;
    return true;
  }

  /** khoảng cách xa nhất từ người chơi tới đồng đội còn sống theo vai (E2E): người dẫn được đi trước ≤ ~15 m */
  maxDistToPlayer(role: 'leader' | 'follower' | 'all' = 'all'): number {
    const p = this.deps.player();
    let d = 0;
    for (const m of this.members) {
      if (!m.actor.bot.alive || (role !== 'all' && m.role !== role)) continue;
      const pos = m.actor.bot.position;
      d = Math.max(d, Math.hypot(p.feet[0] - pos[0], p.feet[2] - pos[2]));
    }
    return d;
  }
}
