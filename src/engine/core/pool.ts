/**
 * Pool cố định — không grow ngầm (PRD §4 Particles/CPU: "không tạo object JS mỗi hạt").
 * acquire() trả null khi cạn; caller quyết tái dụng cái cũ nhất hay bỏ qua.
 */
export interface PoolStats {
  inUse: number;
  capacity: number;
  /** số lần acquire thất bại vì cạn */
  exhausted: number;
  /** số lần factory được gọi — phải === capacity sau warm-up, không bao giờ hơn */
  created: number;
}

export class Pool<T> {
  private readonly items: T[] = [];
  private readonly free: number[] = [];
  private readonly inUseFlag: Uint8Array;
  readonly stats: PoolStats;

  constructor(
    factory: (index: number) => T,
    private readonly resetFn: (item: T) => void,
    readonly capacity: number,
  ) {
    this.inUseFlag = new Uint8Array(capacity);
    this.stats = { inUse: 0, capacity, exhausted: 0, created: 0 };
    for (let i = 0; i < capacity; i++) {
      this.items.push(factory(i));
      this.stats.created++;
      this.free.push(capacity - 1 - i);
    }
    // free là stack: pop() lấy index 0 trước cho dễ đoán
  }

  acquire(): T | null {
    const idx = this.free.pop();
    if (idx === undefined) {
      this.stats.exhausted++;
      return null;
    }
    this.inUseFlag[idx] = 1;
    this.stats.inUse++;
    return this.items[idx]!;
  }

  release(item: T): void {
    const idx = this.items.indexOf(item);
    if (idx < 0 || this.inUseFlag[idx] === 0) return;
    this.inUseFlag[idx] = 0;
    this.stats.inUse--;
    this.resetFn(item);
    this.free.push(idx);
  }

  releaseAll(): void {
    for (let i = 0; i < this.capacity; i++) {
      if (this.inUseFlag[i] === 1) {
        this.inUseFlag[i] = 0;
        this.resetFn(this.items[i]!);
        this.free.push(i);
      }
    }
    this.stats.inUse = 0;
  }

  /** Duyệt các item đang dùng (không allocation). */
  forEachInUse(fn: (item: T, index: number) => void): void {
    for (let i = 0; i < this.capacity; i++) if (this.inUseFlag[i] === 1) fn(this.items[i]!, i);
  }

  /** Item theo index (dùng cho InstancedMesh mapping). */
  at(index: number): T {
    return this.items[index]!;
  }

  isInUse(index: number): boolean {
    return this.inUseFlag[index] === 1;
  }
}
