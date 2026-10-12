/**
 * Tiếng hô của địch (DV-076, tiếng Anh): sự kiện AI → loại câu (contact, reload, frag, grenade, moving, pinned, flank, fallback,
 * hit, mandown, lost, radio). Chống ồn: mỗi người ≥ perBotMs, toàn trận ≥ globalMs, cùng loại ≥ kindMs; câu khẩn (lựu đạn) bỏ qua
 * giới hạn chung. Giọng theo băm mã lính (E1..En) → cùng một người luôn cùng giọng. Thuần logic; Game lo phát 3D.
 */
export type ChatterKind = 'contact' | 'reload' | 'frag' | 'grenade' | 'moving' | 'pinned' | 'suppress' | 'flank' | 'fallback' | 'hit' | 'mandown' | 'lost' | 'radio';

export interface ChatterDeps {
  now: () => number;
  /** phát câu `kind` của người `botId`; false = không phát được (xa, chưa có giọng...) */
  play: (botId: string, kind: ChatterKind) => boolean;
}

const URGENT: ReadonlySet<ChatterKind> = new Set(['grenade', 'frag', 'radio']);

/** giọng địch theo mã lính (FNV-1a) */
export function enemyVoiceOf(botId: string, voices: number): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < botId.length; i++) {
    h ^= botId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `E${(h % voices) + 1}`;
}

export class EnemyChatter {
  perBotMs = 5000;
  globalMs = 1300;
  kindMs = 3500;
  private readonly lastBot = new Map<string, number>();
  private readonly lastKind = new Map<ChatterKind, number>();
  private lastAny = -Infinity;
  readonly stats = { said: 0, dropped: 0, byKind: {} as Partial<Record<ChatterKind, number>> };

  constructor(private readonly deps: ChatterDeps) {}

  say(botId: string, kind: ChatterKind): boolean {
    const now = this.deps.now() * 1000;
    const urgent = URGENT.has(kind);
    if (!urgent) {
      if (now - this.lastAny < this.globalMs || now - (this.lastBot.get(botId) ?? -Infinity) < this.perBotMs || now - (this.lastKind.get(kind) ?? -Infinity) < this.kindMs) {
        this.stats.dropped++;
        return false;
      }
    } else if (now - (this.lastKind.get(kind) ?? -Infinity) < 800) {
      this.stats.dropped++;
      return false;
    }
    if (!this.deps.play(botId, kind)) return false;
    this.lastAny = now;
    this.lastBot.set(botId, now);
    this.lastKind.set(kind, now);
    this.stats.said++;
    this.stats.byKind[kind] = (this.stats.byKind[kind] ?? 0) + 1;
    return true;
  }

  reset(): void {
    this.lastBot.clear();
    this.lastKind.clear();
    this.lastAny = -Infinity;
  }
}
