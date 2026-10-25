/**
 * Tổ ta (TIP-M1A; AI-T1.5 DV-071): 4–5 người có tên. Quyết dẫn đường về phía mục tiêu, còn lại đi đội hình rắn sau người chơi.
 * Lệnh (phím 1–4): `follow` theo tôi · `hold` giữ vị trí · `suppress` bắn yểm trợ chỗ tôi nhắm · `advance` tiến tới chỗ tôi nhắm.
 * Trong chiến đấu Bot dùng vai 'escort' với neo do `escortFor` cấp (người chơi / điểm giữ / điểm tiến) → mỗi người một chỗ nấp
 * quanh neo, không đứng chắn hướng bắn của người chơi. Báo hướng địch theo giờ đồng hồ so với hướng nhìn người chơi.
 * Barks qua cue thoại có ưu tiên thấp, chống spam (≥ 6 s mỗi người, ≥ 2,5 s toàn tổ). Thuần logic; không three/DOM.
 */
import type { BotActor } from '@game/actors/botActor';
import type { EscortInfo } from './bot';
import ai from '@content/tuning/ai.json';
import barkDef from '@content/voice/squad-barks.json';

type V3 = [number, number, number];

export interface SquadDeps {
  /** vị trí chân + hướng ngang người chơi (đơn vị) + tốc độ ngang */
  player: () => { feet: V3; fwdX: number; fwdZ: number; speed: number };
  /** điểm mục tiêu hiện tại (marker) */
  objective: () => V3 | null;
  /** phát cue thoại (bark) — trả false nếu bị chặn; `vars` chèn vào phụ đề */
  say: (cueId: string, speaker: string, vars?: Record<string, string | number>) => boolean;
  /** DV-087 câu hô biến thể (ngoài file thoại): khoá giọng `cue`, phụ đề là `text`; `priority` cao = chen được */
  sayLine?: (cue: string, speaker: string, text: string, priority: number) => boolean;
  now: () => number;
  /** [0,1) tất định (Prng của game); không có thì dùng bộ đếm */
  rand?: () => number;
}

/** DV-087 loại câu hô có nhiều biến thể (content/voice/squad-barks.json) */
export type BarkKind = 'contact' | 'reload' | 'kill' | 'hurt' | 'cover' | 'moving' | 'pinned' | 'grenade' | 'warnPlayer' | 'buddyDown' | 'blast' | 'rally' | 'giveAmmo' | 'offerAmmo';
interface BarkLine {
  t: string;
  who?: string[];
}
const BARK_LINES = (barkDef as unknown as { kinds: Record<BarkKind, { lines: BarkLine[] }> }).kinds;
const BARK_NAMES = (barkDef as unknown as { names: Record<string, string> }).names;
/** độ ưu tiên phụ đề theo loại (cảnh báo chen được câu hô thường) */
const BARK_PRIORITY: Record<BarkKind, number> = { contact: 4, reload: 3, kill: 3, hurt: 4, cover: 4, moving: 3, pinned: 4, grenade: 9, warnPlayer: 7, buddyDown: 8, blast: 6, rally: 3, giveAmmo: 6, offerAmmo: 6 };
/** chống spam (DV-087): ≥ 4,5 s mỗi người, ≥ 1,6 s cả tổ — nhiều câu hơn trước vì câu không lặp */
const PER_PERSON_S = 4.5;
const SQUAD_GAP_S = 1.6;

export type SquadOrder = 'follow' | 'hold' | 'suppress' | 'advance';
/** DV-083: assault = tổ trưởng chạy thẳng tới điểm kế, chờ khi người chơi tụt > 18 m (M1-T3 dồn dập) */
export type SquadPace = 'march' | 'normal' | 'assault';
type Goal = { x: number; z: number; run: boolean; mul?: number };

interface Member {
  actor: BotActor;
  role: 'leader' | 'follower';
  slot: number;
  lastBarkAt: number;
}

/** bark theo sự kiện → cue theo người nói (locale: dlg.M05…M15); cue speaker 'SQUAD' (M20+) ai nói cũng được */
const BARKS: Record<string, Record<string, string>> = {
  contact: { QUYET: 'M13', LONG: 'M05', DAT: 'M06', HOAN: 'M05', KHANG: 'M13' },
  reload: { LONG: 'M10', QUYET: 'M10', DAT: 'M10', HOAN: 'M10', KHANG: 'M10' },
  kill: { QUYET: 'M11', LONG: 'M14', DAT: 'M14', HOAN: 'M11', KHANG: 'M14' },
  hurt: { DAT: 'M12', LONG: 'M12', QUYET: 'M12', HOAN: 'M12', KHANG: 'M12' },
  cover: { DAT: 'M15', LONG: 'M15', QUYET: 'M15', HOAN: 'M15', KHANG: 'M15' },
};
const SQUAD_CUES = { callout: 'M20', follow: 'M21', hold: 'M22', suppress: 'M23', advance: 'M24', moving: 'M25', grenade: 'M26' } as const;

/** giờ đồng hồ (1–12, 12 = thẳng trước) của hướng (dx, dz) so với hướng nhìn (fx, fz) */
export function clockOf(fx: number, fz: number, dx: number, dz: number): number {
  // góc theo chiều kim đồng hồ nhìn từ trên (trục −z là trước, +x là phải)
  const a = Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz); // + = bên phải (theo kim)
  let h = Math.round((a / (Math.PI * 2)) * 12);
  h = ((h % 12) + 12) % 12;
  return h === 0 ? 12 : h;
}

export class Squadmates {
  order: SquadOrder = 'follow';
  /** nhịp đi (M1-T2): march = Quyết đi tốc độ hành quân tới điểm đến, tổ xếp hàng dọc sau Quyết */
  pace: SquadPace = 'normal';
  /** điểm của lệnh hiện tại (giữ/tiến/yểm trợ) */
  orderPoint: V3 | null = null;
  private suppressUntil = 0;
  private readonly members: Member[] = [];
  private lastAnyBarkAt = -Infinity;
  private lastCalloutAt = -Infinity;
  private readonly lastCalloutPos: V3 = [1e9, 0, 1e9];
  readonly stats = { barks: 0, barksDropped: 0, callouts: 0, commands: 0, grenadeWarnings: 0 };
  private lastGrenadeWarnAt = -Infinity;
  /** chỉ số câu vừa nói theo loại (cả tổ) — không lặp lại khi còn câu khác */
  private readonly recent = new Map<BarkKind, number[]>();
  private randN = 0;
  private lastWarnPlayerAt = -Infinity;
  private lastBlastAt = -Infinity;
  private lastOfferAt = -Infinity;
  private lastRallyAt = -Infinity;
  /** bán kính neo khi chiến đấu (m) */
  escortRadius = 14;
  holdRadius = 8;
  suppressMs = 12000;

  /** DV-090 vị trí đứng bắt đầu từ ô này (tiểu đội bộ đội không tên đi sau tổ Quyết: ô 4 trở đi) */
  constructor(
    private readonly deps: SquadDeps,
    private readonly slotBase = 0,
  ) {}

  add(actor: BotActor, role: 'leader' | 'follower'): void {
    this.members.push({ actor, role, slot: this.slotBase + this.members.filter((m) => m.role === 'follower').length, lastBarkAt: -Infinity });
  }

  remove(id: string): void {
    const i = this.members.findIndex((m) => m.actor.id === id);
    if (i >= 0) this.members.splice(i, 1);
  }

  clear(): void {
    this.members.length = 0;
    this.pace = 'normal';
    this.order = 'follow';
    this.orderPoint = null;
  }

  get count(): number {
    return this.members.length;
  }

  /** tổ trưởng còn sống (Quyết) */
  leader(): BotActor | null {
    const m = this.members.find((mm) => mm.role === 'leader' && mm.actor.bot.alive) ?? this.members.find((mm) => mm.actor.bot.alive);
    return m ? m.actor : null;
  }

  list(): readonly BotActor[] {
    return this.members.map((m) => m.actor);
  }

  /** người trong tổ theo mã người nói (giọng 3D tại chỗ người đó, DV-076) */
  actorOfSpeaker(speaker: string): BotActor | null {
    return this.members.find((m) => this.speakerOf(m) === speaker)?.actor ?? null;
  }

  private speakerOf(m: Member): string {
    return m.actor.nameKey?.replace('name.', '').toUpperCase() ?? 'QUYET';
  }

  /** lệnh từ kịch bản (mission `squad_order`): không đáp lời; giữ = đứng tại chỗ */
  setOrder(order: SquadOrder): void {
    this.order = order;
    this.orderPoint = null;
  }

  /** DV-094 kịch bản đặt điểm giữ (không đáp lời): tổ về quanh `p` (vòng 3 m) rồi giữ ở đó */
  holdAt(p: V3): void {
    this.order = 'hold';
    this.orderPoint = [p[0], p[1], p[2]];
  }

  /** lệnh của người chơi (phím 1–4). `point` = chỗ người chơi nhắm (yểm trợ/tiến); giữ = chỗ người chơi đứng */
  command(order: SquadOrder, point: V3 | null = null): void {
    const p = this.deps.player();
    this.order = order;
    this.stats.commands++;
    if (order === 'hold') this.orderPoint = [p.feet[0], p.feet[1], p.feet[2]];
    else if (order === 'follow') this.orderPoint = null;
    else this.orderPoint = point ? [point[0], point[1], point[2]] : [p.feet[0] + p.fwdX * 20, p.feet[1], p.feet[2] + p.fwdZ * 20];
    if (order === 'suppress' && this.orderPoint) {
      this.suppressUntil = this.deps.now() + this.suppressMs / 1000;
      const o = this.orderPoint;
      for (const m of this.members) m.actor.bot.alertTo([o[0], o[1] + 1.2, o[2]]);
    }
    // người gần nhất đáp lệnh (ưu tiên hơn bark thường)
    const alive = this.members.filter((m) => m.actor.bot.alive);
    if (!alive.length) return;
    alive.sort((a, b) => Math.hypot(a.actor.bot.position[0] - p.feet[0], a.actor.bot.position[2] - p.feet[2]) - Math.hypot(b.actor.bot.position[0] - p.feet[0], b.actor.bot.position[2] - p.feet[2]));
    const m = alive[0]!;
    if (this.deps.say(SQUAD_CUES[order], this.speakerOf(m))) {
      this.stats.barks++;
      m.lastBarkAt = this.deps.now();
      this.lastAnyBarkAt = m.lastBarkAt;
    }
  }

  /** gọi mỗi tick: hết giờ yểm trợ → về theo tôi */
  tick(): void {
    if (this.order === 'suppress' && this.deps.now() > this.suppressUntil) {
      this.order = 'follow';
      this.orderPoint = null;
    }
  }

  /** neo chiến đấu cho BotDeps.escort của một thành viên */
  escortFor(actorId: string): () => EscortInfo | null {
    return () => {
      if (!this.members.some((m) => m.actor.id === actorId)) return null;
      const p = this.deps.player();
      const fwd: [number, number] = [p.fwdX, p.fwdZ];
      const o = this.orderPoint;
      switch (this.order) {
        case 'hold':
          return o ? { anchor: o, fwd, radius: this.holdRadius, mode: 'hold', aimPoint: null } : { anchor: p.feet, fwd, radius: 20, mode: 'hold', aimPoint: null };
        case 'advance':
          return { anchor: o ?? p.feet, fwd, radius: 10, mode: 'advance', aimPoint: null };
        case 'suppress':
          return { anchor: p.feet, fwd, radius: this.escortRadius, mode: 'suppress', aimPoint: o };
        default:
          return { anchor: p.feet, fwd, radius: this.escortRadius, mode: 'escort', aimPoint: null };
      }
    };
  }

  /** closure cho BotDeps.followGoal (ngoài chiến đấu) */
  goalFor(actorId: string): () => Goal | null {
    return () => {
      const m = this.members.find((mm) => mm.actor.id === actorId);
      if (!m) return null;
      const p = this.deps.player();
      const pos = m.actor.bot.position;
      const dPlayer = Math.hypot(p.feet[0] - pos[0], p.feet[2] - pos[2]);
      if (this.order === 'hold' && !this.orderPoint) {
        // lệnh kịch bản: giữ chỗ; quá xa người chơi (> 20 m) thì về gần
        if (dPlayer > 20) return { x: p.feet[0] - p.fwdX * 2.5, z: p.feet[2] - p.fwdZ * 2.5, run: true };
        return null;
      }
      if ((this.order === 'hold' || this.order === 'advance') && this.orderPoint) {
        // về quanh điểm lệnh, mỗi người một chỗ (vòng 3 m)
        const k = this.members.indexOf(m);
        const a = (k / Math.max(1, this.members.length)) * Math.PI * 2;
        const gx = this.orderPoint[0] + Math.cos(a) * 3;
        const gz = this.orderPoint[2] + Math.sin(a) * 3;
        const d = Math.hypot(gx - pos[0], gz - pos[2]);
        if (d < 1.5) return null;
        return { x: gx, z: gz, run: d > 6 };
      }
      if (this.pace === 'march' && this.order === 'follow') return this.marchGoal(m, p, dPlayer);
      if (this.pace === 'assault' && this.order === 'follow') return this.assaultGoal(m, dPlayer);
      if (m.role === 'leader') {
        const o = this.deps.objective();
        if (!o) return this.sideGoal(p, m.slot, dPlayer);
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
        // DV-083: chỉ chạy khi người chơi xa > 10 m (trước đây cũng chạy khi người chơi sát < 5 m → bỏ chạy khỏi người chơi)
        return { x: pos[0] + dx * step, z: pos[2] + dz * step, run: dPlayer > 10 };
      }
      return this.sideGoal(p, m.slot, dPlayer);
    };
  }

  /**
   * Hành quân (M1-T2): Quyết đi đều tốc độ hành quân về điểm đến, dừng chờ khi người chơi tụt > 22 m, không đuổi theo người chơi
   * chạy trước; tổ xếp hàng dọc sau Quyết (người chơi đi ngay sau anh, chỗ thứ hai bỏ trống), cách 4 m.
   */
  private marchGoal(m: Member, _p: { feet: V3; fwdX: number; fwdZ: number; speed: number }, dPlayer: number): Goal | null {
    const mul = ai.move.marchSpeed / ai.move.speed;
    const leader = this.leader();
    if (!leader) return null;
    const o = this.deps.objective();
    const lp = leader.bot.position;
    if (m.actor === leader) {
      if (!o) return null;
      const dObj = Math.hypot(o[0] - lp[0], o[2] - lp[2]);
      if (dObj < 3) return null;
      if (dPlayer > 22) return null; // chờ người chơi
      // đi thẳng tới điểm đến theo navmesh (không bước 10 m theo đường chim bay: điểm giữa có thể rơi xuống lòng suối)
      return { x: o[0], z: o[2], run: false, mul };
    }
    // hướng hàng: Quyết → điểm đến (đứng yên thì theo hướng Quyết nhìn)
    let fx = -Math.sin(leader.bot.yaw);
    let fz = -Math.cos(leader.bot.yaw);
    if (o) {
      const l = Math.hypot(o[0] - lp[0], o[2] - lp[2]);
      if (l > 1) {
        fx = (o[0] - lp[0]) / l;
        fz = (o[2] - lp[2]) / l;
      }
    }
    const back = 4 * (m.slot + 2);
    const gx = lp[0] - fx * back;
    const gz = lp[2] - fz * back;
    const d = Math.hypot(gx - m.actor.bot.position[0], gz - m.actor.bot.position[2]);
    if (d < 1.2) return null;
    return { x: gx, z: gz, run: d > 10, mul: d > 4 ? 1 : mul };
  }

  /** DV-083 nhịp xung phong: tổ trưởng chạy thẳng tới điểm đến, dừng chờ người chơi tụt > 18 m; tổ chạy hàng sau tổ trưởng */
  private assaultGoal(m: Member, dPlayer: number): Goal | null {
    const leader = this.leader();
    if (!leader) return null;
    const o = this.deps.objective();
    const lp = leader.bot.position;
    if (m.actor === leader) {
      if (!o) return null;
      if (Math.hypot(o[0] - lp[0], o[2] - lp[2]) < 4) return null;
      if (dPlayer > 18) return null;
      return { x: o[0], z: o[2], run: true };
    }
    let fx = -Math.sin(leader.bot.yaw);
    let fz = -Math.cos(leader.bot.yaw);
    if (o) {
      const l = Math.hypot(o[0] - lp[0], o[2] - lp[2]);
      if (l > 1) {
        fx = (o[0] - lp[0]) / l;
        fz = (o[2] - lp[2]) / l;
      }
    }
    const side = m.slot % 2 === 0 ? -1 : 1;
    const back = 3 + 3 * m.slot;
    const gx = lp[0] - fx * back - fz * side * 2.5;
    const gz = lp[2] - fz * back + fx * side * 2.5;
    const d = Math.hypot(gx - m.actor.bot.position[0], gz - m.actor.bot.position[2]);
    if (d < 1.5) return null;
    return { x: gx, z: gz, run: d > 4 };
  }

  /** đội hình rắn sau người chơi: hàng k lùi 3 + 2,5·⌊k/2⌋ m, lệch trái/phải 1,8 m; đứng yên khi đã gần và ta không đi */
  private sideGoal(p: { feet: V3; fwdX: number; fwdZ: number; speed: number }, slot: number, dPlayer: number): { x: number; z: number; run: boolean } | null {
    const back = 3 + 2.5 * Math.floor(slot / 2);
    if (dPlayer < back + 1.5 && p.speed < 0.3) return null;
    const side = slot % 2 === 0 ? -1 : 1;
    const rx = -p.fwdZ;
    const rz = p.fwdX;
    return { x: p.feet[0] - p.fwdX * back + rx * side * 1.8, z: p.feet[2] - p.fwdZ * back + rz * side * 1.8, run: dPlayer > back + 6 };
  }

  private rand(): number {
    if (this.deps.rand) return this.deps.rand();
    this.randN = (this.randN + 0.6180339887) % 1;
    return this.randN;
  }

  /**
   * DV-087: chọn một câu của loại `kind` cho người nói — bỏ câu người này không nói (`who`), tránh các câu cả tổ vừa nói (nhớ tới
   * nửa số câu của loại), ngẫu nhiên trong phần còn lại. Trả chỉ số câu hoặc −1.
   */
  pickLine(kind: BarkKind, speaker: string): number {
    const lines = BARK_LINES[kind]?.lines ?? [];
    const ok: number[] = [];
    for (let i = 0; i < lines.length; i++) if (!lines[i]!.who || lines[i]!.who!.includes(speaker)) ok.push(i);
    if (!ok.length) return -1;
    const recent = this.recent.get(kind) ?? [];
    const fresh = ok.filter((i) => !recent.includes(i));
    const pool = fresh.length ? fresh : ok;
    const i = pool[Math.min(pool.length - 1, Math.floor(this.rand() * pool.length))]!;
    recent.push(i);
    while (recent.length > Math.max(1, Math.floor(lines.length / 2))) recent.shift();
    this.recent.set(kind, recent);
    return i;
  }

  /** nói một câu biến thể (không qua chống spam) — `target` = người được gọi tên (câu có {name}) */
  private speakVariant(m: Member, kind: BarkKind, target?: string): boolean {
    const speaker = this.speakerOf(m);
    const i = this.pickLine(kind, speaker);
    if (i < 0) return false;
    const line = BARK_LINES[kind].lines[i]!;
    const named = line.t.includes('{name}');
    if (named && (!target || !BARK_NAMES[target])) return false;
    const text = named ? line.t.replaceAll('{name}', BARK_NAMES[target!]!) : line.t;
    const cue = named ? `sq.${kind}#${i}-${target}` : `sq.${kind}#${i}`;
    if (!this.deps.sayLine) return false;
    return this.deps.sayLine(cue, speaker, text, BARK_PRIORITY[kind]);
  }

  /** bark theo sự kiện của một thành viên (contact/reload/kill/hurt/cover/moving/pinned) — DV-087 nhiều biến thể, không lặp */
  bark(actorId: string, kind: keyof typeof BARKS | 'moving' | 'pinned'): boolean {
    const m = this.members.find((mm) => mm.actor.id === actorId);
    if (!m || !m.actor.bot.alive) return false;
    const speaker = this.speakerOf(m);
    const now = this.deps.now();
    if (now - m.lastBarkAt < PER_PERSON_S || now - this.lastAnyBarkAt < SQUAD_GAP_S) {
      this.stats.barksDropped++;
      return false;
    }
    let ok = this.deps.sayLine ? this.speakVariant(m, kind as BarkKind) : false;
    // không có đường câu biến thể (test cũ, mission không có host) → cue cố định như trước
    if (!ok && !this.deps.sayLine) {
      const cue = kind === 'moving' ? SQUAD_CUES.moving : kind === 'pinned' ? BARKS.cover![speaker] : BARKS[kind]?.[speaker];
      ok = !!cue && this.deps.say(cue, speaker);
    }
    if (!ok) return false;
    m.lastBarkAt = now;
    this.lastAnyBarkAt = now;
    this.stats.barks++;
    return true;
  }

  /** DV-087 đồng đội gần người chơi nhất hét gọi tên Lâm (người chơi trúng đạn/đứng trống) — ≥ 9 s một lần */
  warnPlayer(): boolean {
    const now = this.deps.now();
    if (now - this.lastWarnPlayerAt < 9 || now - this.lastAnyBarkAt < 1) return false;
    const m = this.nearestToPlayer();
    if (!m || !this.speakVariant(m, 'warnPlayer')) return false;
    this.lastWarnPlayerAt = now;
    this.lastAnyBarkAt = now;
    m.lastBarkAt = now;
    this.stats.barks++;
    return true;
  }

  /** DV-090 đưa đạn cho Lâm: người được xin nói một câu (bỏ qua chống spam người, chỉ giữ khoảng cách 1 s cả tổ) */
  giveAmmo(actorId: string): boolean {
    const m = this.members.find((mm) => mm.actor.id === actorId);
    if (!m || !m.actor.bot.alive) return false;
    const now = this.deps.now();
    if (now - this.lastAnyBarkAt < 1) return false;
    if (!this.speakVariant(m, 'giveAmmo')) return false;
    m.lastBarkAt = now;
    this.lastAnyBarkAt = now;
    this.stats.barks++;
    return true;
  }

  /** DV-090 Lâm hết đạn: đồng đội gần nhất trong `maxDist` m gọi lại lấy đạn — ≥ 20 s một lần */
  offerAmmo(maxDist = 15): boolean {
    const now = this.deps.now();
    if (now - this.lastOfferAt < 20 || now - this.lastAnyBarkAt < 1.5) return false;
    const m = this.nearestToPlayer();
    if (!m) return false;
    const p = this.deps.player().feet;
    const q = m.actor.bot.position;
    if (Math.hypot(p[0] - q[0], p[2] - q[2]) > maxDist) return false;
    this.lastOfferAt = now;
    if (!this.speakVariant(m, 'offerAmmo')) return false;
    this.lastAnyBarkAt = now;
    m.lastBarkAt = now;
    this.stats.barks++;
    return true;
  }

  /** DV-087 đồng đội ngã: người còn sống gần nhất gào tên người đó (bỏ qua chống spam) */
  buddyDown(deadActorId: string, deadNameKey: string | null): boolean {
    const target = deadNameKey?.replace('name.', '').toUpperCase() ?? '';
    if (!BARK_NAMES[target]) return false;
    const dead = this.members.find((mm) => mm.actor.id === deadActorId)?.actor.bot.position;
    let best: Member | null = null;
    let bd = Infinity;
    for (const m of this.members) {
      if (!m.actor.bot.alive || m.actor.id === deadActorId || this.speakerOf(m) === target) continue;
      const p = m.actor.bot.position;
      const d = dead ? Math.hypot(p[0] - dead[0], p[2] - dead[2]) : 0;
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    if (!best || !this.speakVariant(best, 'buddyDown', target)) return false;
    const now = this.deps.now();
    best.lastBarkAt = now;
    this.lastAnyBarkAt = now;
    this.stats.barks++;
    return true;
  }

  /** DV-087 nổ sát người trong tổ (≤ 14 m): người gần nhất la lên — ≥ 5 s một lần */
  blastNear(x: number, z: number): boolean {
    const now = this.deps.now();
    if (now - this.lastBlastAt < 5 || now - this.lastAnyBarkAt < 0.8) return false;
    let best: Member | null = null;
    let bd = 14;
    for (const m of this.members) {
      if (!m.actor.bot.alive) continue;
      const p = m.actor.bot.position;
      const d = Math.hypot(p[0] - x, p[2] - z);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    if (!best || !this.speakVariant(best, 'blast')) return false;
    this.lastBlastAt = now;
    this.lastAnyBarkAt = now;
    best.lastBarkAt = now;
    this.stats.barks++;
    return true;
  }

  /** DV-087 giữa trận mà tổ im quá lâu (8–13 s): ai đó hô động viên/ra lệnh bắn trả — gọi mỗi khung khi đang giao chiến */
  rally(inCombat: boolean): boolean {
    if (!inCombat) return false;
    const now = this.deps.now();
    if (now - this.lastAnyBarkAt < 8 + this.rand() * 5 || now - this.lastRallyAt < 10) return false;
    const alive = this.members.filter((m) => m.actor.bot.alive);
    if (!alive.length) return false;
    // tổ trưởng hay hô hơn
    const lead = alive.find((m) => m.role === 'leader');
    const m = lead && this.rand() < 0.6 ? lead : alive[Math.min(alive.length - 1, Math.floor(this.rand() * alive.length))]!;
    this.lastRallyAt = now;
    if (!this.speakVariant(m, 'rally')) return false;
    this.lastAnyBarkAt = now;
    m.lastBarkAt = now;
    this.stats.barks++;
    return true;
  }

  private nearestToPlayer(): Member | null {
    const p = this.deps.player();
    let best: Member | null = null;
    let bd = 30;
    for (const m of this.members) {
      if (!m.actor.bot.alive) continue;
      const q = m.actor.bot.position;
      const d = Math.hypot(q[0] - p.feet[0], q[2] - p.feet[2]);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    return best;
  }

  /** "Lựu đạn! Nằm xuống!" (DV-074): bỏ qua chống spam riêng người nói, chỉ chặn trùng trong 1 s */
  warnGrenade(actorId: string): boolean {
    const m = this.members.find((mm) => mm.actor.id === actorId);
    if (!m || !m.actor.bot.alive) return false;
    const now = this.deps.now();
    if (now - this.lastGrenadeWarnAt < 1) return false;
    const ok = this.deps.sayLine ? this.speakVariant(m, 'grenade') : this.deps.say(SQUAD_CUES.grenade, this.speakerOf(m));
    if (!ok) return false;
    this.lastGrenadeWarnAt = now;
    m.lastBarkAt = now;
    this.lastAnyBarkAt = now;
    this.stats.grenadeWarnings++;
    return true;
  }

  /**
   * Báo hướng địch: "Địch, hướng {h} giờ, {d} mét!" theo hướng nhìn người chơi. Chống lặp: ≥ 12 s toàn tổ, hoặc ≥ 6 s nếu địch mới cách
   * chỗ đã báo > 15 m. Trả true nếu đã nói.
   */
  callout(actorId: string, enemy: Readonly<V3>): boolean {
    const m = this.members.find((mm) => mm.actor.id === actorId);
    if (!m || !m.actor.bot.alive) return false;
    const now = this.deps.now();
    const moved = Math.hypot(enemy[0] - this.lastCalloutPos[0], enemy[2] - this.lastCalloutPos[2]) > 15;
    if (now - this.lastCalloutAt < (moved ? 6 : 12)) return false;
    if (now - this.lastAnyBarkAt < 1) return false;
    const p = this.deps.player();
    const dx = enemy[0] - p.feet[0];
    const dz = enemy[2] - p.feet[2];
    const d = Math.max(5, Math.round(Math.hypot(dx, dz) / 5) * 5);
    const h = clockOf(p.fwdX, p.fwdZ, dx, dz);
    if (!this.deps.say(SQUAD_CUES.callout, this.speakerOf(m), { h, d })) return false;
    this.lastCalloutAt = now;
    this.lastAnyBarkAt = now;
    m.lastBarkAt = now;
    this.lastCalloutPos[0] = enemy[0];
    this.lastCalloutPos[2] = enemy[2];
    this.stats.callouts++;
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
