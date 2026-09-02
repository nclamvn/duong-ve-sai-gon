/**
 * EventBus — event có ID, idempotent, log được (PRD §3.1 "Event có ID; chạy idempotent; log được").
 * Ring buffer cố định: không tăng bộ nhớ theo thời gian chơi.
 */
export interface EventRecord<T = unknown> {
  type: string;
  id: string | null;
  payload: T;
  tick: number;
  seq: number;
}

export type Handler<T> = (payload: T, record: EventRecord<T>) => void;

export interface EmitOptions {
  /** ID nghiệp vụ. Cùng ID emit lần 2 → bỏ qua, tính vào duplicates. */
  id?: string;
  tick?: number;
}

export class EventBus<TMap extends Record<string, unknown> = Record<string, unknown>> {
  private handlers = new Map<string, Set<Handler<never>>>();
  private seenIds = new Set<string>();
  private readonly ring: Array<EventRecord | null>;
  private head = 0;
  private count = 0;
  private seq = 0;
  duplicates = 0;
  currentTick = 0;

  constructor(readonly capacity = 512) {
    this.ring = new Array<EventRecord | null>(capacity).fill(null);
  }

  on<K extends keyof TMap & string>(type: K, handler: Handler<TMap[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as Handler<never>);
    return () => this.off(type, handler);
  }

  off<K extends keyof TMap & string>(type: K, handler: Handler<TMap[K]>): void {
    this.handlers.get(type)?.delete(handler as Handler<never>);
  }

  /** Trả true nếu event được phát; false nếu bị bỏ vì trùng ID. */
  emit<K extends keyof TMap & string>(type: K, payload: TMap[K], opts?: EmitOptions): boolean {
    const id = opts?.id ?? null;
    if (id !== null) {
      if (this.seenIds.has(id)) {
        this.duplicates++;
        return false;
      }
      this.seenIds.add(id);
    }
    const record: EventRecord<TMap[K]> = { type, id, payload, tick: opts?.tick ?? this.currentTick, seq: this.seq++ };
    this.ring[this.head] = record as EventRecord;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
    const set = this.handlers.get(type);
    if (set) for (const h of set) (h as Handler<TMap[K]>)(payload, record);
    return true;
  }

  /** Đã từng phát event với ID này chưa (dùng cho checkpoint restore). */
  hasSeen(id: string): boolean {
    return this.seenIds.has(id);
  }

  /** Bản sao log gần nhất (mới nhất ở cuối). Chỉ dùng cho test/telemetry — có allocation. */
  recent(n = this.count): EventRecord[] {
    const out: EventRecord[] = [];
    const take = Math.min(n, this.count);
    for (let i = 0; i < take; i++) {
      const idx = (this.head - take + i + this.capacity) % this.capacity;
      const r = this.ring[idx];
      if (r) out.push(r);
    }
    return out;
  }

  countOf(type: string): number {
    let c = 0;
    for (let i = 0; i < this.capacity; i++) if (this.ring[i]?.type === type) c++;
    return c;
  }

  /** Xóa log + seenIds (checkpoint restore phải gọi trước khi apply snapshot). Handler giữ nguyên. */
  reset(): void {
    this.ring.fill(null);
    this.head = 0;
    this.count = 0;
    this.seq = 0;
    this.duplicates = 0;
    this.seenIds.clear();
  }

  /** Khôi phục tập ID đã thấy (từ snapshot) để không phát lại event một-lần sau restore. */
  restoreSeen(ids: Iterable<string>): void {
    for (const id of ids) this.seenIds.add(id);
  }

  seenIdList(): string[] {
    return [...this.seenIds];
  }

  get size(): number {
    return this.count;
  }
}
