/**
 * QualityScaler — dynamic resolution theo frame pressure (PRD REN-004, §4 Độ phân giải).
 * Thuần TS, test được. Hysteresis: chỉ đổi khi N frame liên tiếp cùng vượt/dưới ngưỡng,
 * và tối đa một lần đổi mỗi `cooldownFrames`.
 */
export interface ScalerConfig {
  min: number;
  max: number;
  /** ngưỡng giảm: frame ms > downMs liên tiếp `hysteresisFrames` → giảm */
  downMs: number;
  /** ngưỡng tăng: frame ms < upMs liên tiếp `hysteresisFrames` → tăng */
  upMs: number;
  stepDown: number;
  stepUp: number;
  hysteresisFrames: number;
  cooldownFrames: number;
}

export const DEFAULT_SCALER: ScalerConfig = {
  min: 0.65,
  max: 1.0,
  downMs: 18.5,
  upMs: 14.0,
  stepDown: 0.05,
  stepUp: 0.02,
  hysteresisFrames: 30,
  cooldownFrames: 30,
};

export class QualityScaler {
  scale: number;
  private slowRun = 0;
  private fastRun = 0;
  private cooldown = 0;
  /** số lần đổi scale — test chống dao động */
  changes = 0;
  enabled = true;

  constructor(readonly cfg: ScalerConfig = DEFAULT_SCALER, initial = cfg.max) {
    this.scale = initial;
  }

  /** Gọi mỗi frame với frame time ms. Trả về true nếu scale vừa đổi. */
  update(frameMs: number): boolean {
    if (!this.enabled) return false;
    if (this.cooldown > 0) this.cooldown--;
    if (frameMs > this.cfg.downMs) {
      this.slowRun++;
      this.fastRun = 0;
    } else if (frameMs < this.cfg.upMs) {
      this.fastRun++;
      this.slowRun = 0;
    } else {
      // vùng giữa: reset cả hai để không dao động
      this.slowRun = 0;
      this.fastRun = 0;
    }
    if (this.cooldown > 0) return false;
    if (this.slowRun >= this.cfg.hysteresisFrames && this.scale > this.cfg.min) {
      this.scale = Math.max(this.cfg.min, +(this.scale - this.cfg.stepDown).toFixed(3));
      this.slowRun = 0;
      this.cooldown = this.cfg.cooldownFrames;
      this.changes++;
      return true;
    }
    if (this.fastRun >= this.cfg.hysteresisFrames && this.scale < this.cfg.max) {
      this.scale = Math.min(this.cfg.max, +(this.scale + this.cfg.stepUp).toFixed(3));
      this.fastRun = 0;
      this.cooldown = this.cfg.cooldownFrames;
      this.changes++;
      return true;
    }
    return false;
  }

  reset(scale = this.cfg.max): void {
    this.scale = scale;
    this.slowRun = 0;
    this.fastRun = 0;
    this.cooldown = 0;
    this.changes = 0;
  }
}
