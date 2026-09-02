/**
 * Scheduler — tier sim60 (mọi tick), ai10 (tick % 6 === 0), render (mỗi frame, alpha).
 * Đo chi phí từng tier bằng performance.now() → CPU game time cho telemetry (PRD §4 Đo lường).
 */
export type Tier = 'sim60' | 'ai10' | 'render';

export type SimTask = (tick: number, dt: number) => void;
export type RenderTask = (alpha: number, dt: number) => void;

const now: () => number =
  typeof performance !== 'undefined' && typeof performance.now === 'function' ? () => performance.now() : () => Date.now();

export class Scheduler {
  private sim60: SimTask[] = [];
  private ai10: SimTask[] = [];
  private render: RenderTask[] = [];
  /** chi phí ms của lần chạy gần nhất theo tier */
  readonly lastCostMs: Record<Tier, number> = { sim60: 0, ai10: 0, render: 0 };
  /** tổng chi phí sim (sim60 + ai10) trong frame hiện tại — reset ở beginFrame() */
  frameSimMs = 0;
  aiDivider = 6;

  add(tier: 'sim60' | 'ai10', task: SimTask): () => void;
  add(tier: 'render', task: RenderTask): () => void;
  add(tier: Tier, task: SimTask | RenderTask): () => void {
    const list = this[tier] as Array<SimTask | RenderTask>;
    list.push(task);
    return () => {
      const i = list.indexOf(task);
      if (i >= 0) list.splice(i, 1);
    };
  }

  beginFrame(): void {
    this.frameSimMs = 0;
  }

  /** Chạy một tick sim. Gọi `steps` lần mỗi frame theo FixedClock. */
  runSim(tick: number, dt: number): void {
    const t0 = now();
    for (let i = 0; i < this.sim60.length; i++) this.sim60[i]!(tick, dt);
    const t1 = now();
    this.lastCostMs.sim60 = t1 - t0;
    if (tick % this.aiDivider === 0) {
      for (let i = 0; i < this.ai10.length; i++) this.ai10[i]!(tick, dt * this.aiDivider);
      const t2 = now();
      this.lastCostMs.ai10 = t2 - t1;
      this.frameSimMs += t2 - t0;
    } else {
      this.frameSimMs += t1 - t0;
    }
  }

  runRender(alpha: number, dt: number): void {
    const t0 = now();
    for (let i = 0; i < this.render.length; i++) this.render[i]!(alpha, dt);
    this.lastCostMs.render = now() - t0;
  }

  clear(): void {
    this.sim60.length = 0;
    this.ai10.length = 0;
    this.render.length = 0;
  }
}
