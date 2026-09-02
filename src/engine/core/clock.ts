/**
 * FixedClock — nhịp mô phỏng cố định (PRD §3.1: 60 Hz fixed, render biến thiên).
 * Không allocation trong advance(). Không import DOM/three.
 */
export interface ClockAdvance {
  /** số bước sim cần chạy trong frame này */
  steps: number;
  /** phần dư accumulator / step, dùng để nội suy render, ∈ [0,1) */
  alpha: number;
}

export class FixedClock {
  readonly step: number;
  readonly maxSubSteps: number;
  /** tổng số tick sim đã chạy — đơn điệu tăng */
  tick = 0;
  /** thời gian mô phỏng (giây) = tick * step */
  simTime = 0;
  private accumulator = 0;
  private readonly result: ClockAdvance = { steps: 0, alpha: 0 };
  /** số lần dt bị clamp (tab ẩn, hitch) — telemetry */
  clampCount = 0;

  constructor(stepHz = 60, maxSubSteps = 5, readonly maxDt = 0.25) {
    this.step = 1 / stepHz;
    this.maxSubSteps = maxSubSteps;
  }

  /** Gọi mỗi frame với dt thực (giây). Trả về số bước sim cần chạy + alpha nội suy. */
  advance(dtSeconds: number): ClockAdvance {
    let dt = dtSeconds;
    if (!(dt >= 0)) dt = 0; // NaN/âm → 0
    if (dt > this.maxDt) {
      dt = this.maxDt;
      this.clampCount++;
    }
    this.accumulator += dt;
    let steps = Math.floor(this.accumulator / this.step);
    if (steps > this.maxSubSteps) {
      // Bỏ thời gian không mô phỏng được để không xoáy chết (spiral of death)
      steps = this.maxSubSteps;
      this.accumulator = steps * this.step + (this.accumulator % this.step);
      this.clampCount++;
    }
    this.accumulator -= steps * this.step;
    this.tick += steps;
    this.simTime = this.tick * this.step;
    this.result.steps = steps;
    this.result.alpha = this.accumulator / this.step;
    return this.result;
  }

  reset(): void {
    this.tick = 0;
    this.simTime = 0;
    this.accumulator = 0;
    this.clampCount = 0;
  }
}
