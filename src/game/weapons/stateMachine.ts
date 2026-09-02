/**
 * WeaponStateMachine (PRD WPN-001): IDLE | FIRING | RELOADING | EMPTY | SWAPPING. Bảng chuyển trạng thái tường minh,
 * mọi state có maxDurationMs fallback → IDLE. ADS là flag độc lập (lerp 0→1 trong adsMs). Thuần TS.
 */
export type WeaponState = 'IDLE' | 'FIRING' | 'RELOADING' | 'EMPTY' | 'SWAPPING';

export interface WeaponSpec {
  rpm: number;
  magSize: number;
  reserve: number;
  reloadMs: number;
  adsMs: number;
  swapMs: number;
  maxStateMs: { FIRING: number; RELOADING: number; SWAPPING: number };
}

export interface SmEvents {
  /** một viên được bắn (shotIndex trong chuỗi liên tục) */
  onShot?: (shotIndex: number) => void;
  onReloadStart?: () => void;
  onReloadEnd?: () => void;
  onEmpty?: () => void;
  onStateChange?: (from: WeaponState, to: WeaponState) => void;
}

export class WeaponStateMachine {
  state: WeaponState = 'IDLE';
  mag: number;
  reserve: number;
  /** thời gian trong state hiện tại (ms) */
  stateMs = 0;
  /** ms còn lại trước khi bắn viên tiếp */
  cooldownMs = 0;
  /** 0..1 */
  ads = 0;
  adsWanted = false;
  triggerHeld = false;
  /** số viên bắn liên tục (reset khi ngừng ≥ resetMs — do RecoilTracker quyết) */
  shotIndex = 0;
  private readonly shotIntervalMs: number;
  /** tổng số viên bắn (telemetry/test) */
  totalShots = 0;
  fallbacks = 0;

  constructor(
    readonly spec: WeaponSpec,
    readonly events: SmEvents = {},
  ) {
    this.mag = spec.magSize;
    this.reserve = spec.reserve;
    this.shotIntervalMs = 60000 / spec.rpm;
  }

  private go(to: WeaponState): void {
    if (to === this.state) return;
    const from = this.state;
    this.state = to;
    this.stateMs = 0;
    this.events.onStateChange?.(from, to);
    if (to === 'RELOADING') this.events.onReloadStart?.();
    if (to === 'EMPTY') this.events.onEmpty?.();
  }

  pressFire(): void {
    this.triggerHeld = true;
  }

  releaseFire(): void {
    this.triggerHeld = false;
  }

  pressReload(): void {
    if ((this.state === 'IDLE' || this.state === 'EMPTY' || this.state === 'FIRING') && this.mag < this.spec.magSize && this.reserve > 0) this.go('RELOADING');
  }

  setAds(on: boolean): void {
    this.adsWanted = on;
  }

  startSwap(): void {
    if (this.state !== 'SWAPPING') this.go('SWAPPING');
  }

  private tryFire(): boolean {
    if (this.cooldownMs > 0) return false;
    if (this.mag <= 0) {
      this.go('EMPTY');
      return false;
    }
    this.mag--;
    this.totalShots++;
    this.cooldownMs = this.shotIntervalMs;
    this.events.onShot?.(this.shotIndex);
    this.shotIndex++;
    if (this.mag === 0) this.go('EMPTY');
    else this.go('FIRING');
    return true;
  }

  /** dt ms */
  tick(dtMs: number): void {
    this.stateMs += dtMs;
    this.cooldownMs = Math.max(0, this.cooldownMs - dtMs);
    // ADS lerp độc lập
    const adsRate = dtMs / Math.max(1, this.spec.adsMs);
    this.ads = this.adsWanted ? Math.min(1, this.ads + adsRate) : Math.max(0, this.ads - adsRate);

    switch (this.state) {
      case 'IDLE':
        if (this.triggerHeld) this.tryFire();
        break;
      case 'FIRING':
        if (this.triggerHeld) {
          if (!this.tryFire() && this.cooldownMs === 0 && this.mag > 0) this.go('IDLE');
        } else if (this.cooldownMs === 0) this.go('IDLE');
        if (this.state === 'FIRING' && this.stateMs > this.spec.maxStateMs.FIRING && this.cooldownMs === 0) {
          this.fallbacks++;
          this.go('IDLE');
        }
        break;
      case 'EMPTY':
        if (this.reserve > 0 && (this.triggerHeld || this.stateMs > 150)) this.go('RELOADING');
        break;
      case 'RELOADING':
        if (this.stateMs >= this.spec.reloadMs) {
          const need = this.spec.magSize - this.mag;
          const take = Math.min(need, this.reserve);
          this.mag += take;
          this.reserve -= take;
          this.events.onReloadEnd?.();
          this.go(this.mag > 0 ? 'IDLE' : 'EMPTY');
        } else if (this.stateMs > this.spec.maxStateMs.RELOADING) {
          this.fallbacks++;
          this.go('IDLE');
        }
        break;
      case 'SWAPPING':
        if (this.stateMs >= this.spec.swapMs || this.stateMs > this.spec.maxStateMs.SWAPPING) {
          if (this.stateMs > this.spec.maxStateMs.SWAPPING) this.fallbacks++;
          this.go(this.mag > 0 ? 'IDLE' : 'EMPTY');
        }
        break;
    }
  }

  snapshot(): { state: WeaponState; mag: number; reserve: number } {
    return { state: this.state, mag: this.mag, reserve: this.reserve };
  }

  restore(s: { mag: number; reserve: number }): void {
    this.mag = s.mag;
    this.reserve = s.reserve;
    this.state = this.mag > 0 ? 'IDLE' : 'EMPTY';
    this.stateMs = 0;
    this.cooldownMs = 0;
    this.ads = 0;
    this.adsWanted = false;
    this.triggerHeld = false;
    this.shotIndex = 0;
  }

  reset(): void {
    this.restore({ mag: this.spec.magSize, reserve: this.spec.reserve });
    this.totalShots = 0;
    this.fallbacks = 0;
  }
}
