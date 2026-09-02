/**
 * Perception (PRD AI-001): sight (FOV + range + LOS) và hearing (noise trong hearRange) → suspicion 0..1,
 * last-known position, state UNAWARE | SUSPICIOUS | ALERT. Thuần TS; LOS do caller cung cấp.
 */
import ai from '@content/tuning/ai.json';

export type AwarenessState = 'UNAWARE' | 'SUSPICIOUS' | 'ALERT';

export interface PerceptionConfig {
  fovDeg: number;
  sightRange: number;
  hearRange: number;
  gainNear: number;
  gainFar: number;
  decayPerSec: number;
  suspiciousAt: number;
  alertAt: number;
  memoryMs: number;
}

export interface NoiseEvent {
  x: number;
  y: number;
  z: number;
  /** cường độ 0..1 (súng = 1) */
  loudness: number;
}

export class Perception {
  suspicion = 0;
  state: AwarenessState = 'UNAWARE';
  readonly lastKnown: [number, number, number] = [0, 0, 0];
  hasLastKnown = false;
  /** ms từ lần cuối thấy/nghe */
  sinceContactMs = 1e9;
  /** đang thấy mục tiêu ở tick này */
  visible = false;
  private readonly cfg: PerceptionConfig;
  private readonly cosHalfFov: number;

  constructor(cfg: Partial<PerceptionConfig> = {}) {
    this.cfg = { ...ai.perception, ...cfg } as PerceptionConfig;
    this.cosHalfFov = Math.cos(((this.cfg.fovDeg / 2) * Math.PI) / 180);
  }

  /**
   * @param dt giây · self vị trí mắt bot · facing hướng nhìn bot (đơn vị, xz) · target vị trí mục tiêu · hasLOS true nếu không bị chắn
   */
  update(dt: number, self: [number, number, number], facing: [number, number, number], target: [number, number, number], hasLOS: boolean, noises: NoiseEvent[]): void {
    const dx = target[0] - self[0];
    const dy = target[1] - self[1];
    const dz = target[2] - self[2];
    const dist = Math.hypot(dx, dy, dz);
    let inSight = false;
    if (dist <= this.cfg.sightRange && dist > 1e-3) {
      const dot = (dx * facing[0] + dz * facing[2]) / (Math.hypot(dx, dz) || 1);
      // trong FOV hoặc rất gần (< 3 m: cảm nhận)
      inSight = (dot >= this.cosHalfFov || dist < 3) && hasLOS;
    }
    this.visible = inSight;
    if (inSight) {
      const t = Math.min(1, dist / this.cfg.sightRange);
      const gain = this.cfg.gainNear + (this.cfg.gainFar - this.cfg.gainNear) * t;
      this.suspicion = Math.min(1, this.suspicion + gain * dt);
      this.lastKnown[0] = target[0];
      this.lastKnown[1] = target[1];
      this.lastKnown[2] = target[2];
      this.hasLastKnown = true;
      this.sinceContactMs = 0;
    } else {
      this.sinceContactMs += dt * 1000;
      this.suspicion = Math.max(0, this.suspicion - this.cfg.decayPerSec * dt);
    }
    for (let i = 0; i < noises.length; i++) {
      const n = noises[i]!;
      const nd = Math.hypot(n.x - self[0], n.z - self[2]);
      if (nd <= this.cfg.hearRange * n.loudness) {
        this.suspicion = Math.max(this.suspicion, this.cfg.suspiciousAt + 0.05);
        if (!inSight) {
          this.lastKnown[0] = n.x;
          this.lastKnown[1] = n.y;
          this.lastKnown[2] = n.z;
          this.hasLastKnown = true;
          this.sinceContactMs = 0;
        }
      }
    }
    // state với hysteresis: ALERT giữ trong memoryMs sau contact, rồi hạ xuống SUSPICIOUS (đi tìm) trước khi UNAWARE
    if (this.suspicion >= this.cfg.alertAt) this.state = 'ALERT';
    else if (this.state === 'ALERT') {
      if (this.sinceContactMs < this.cfg.memoryMs) this.state = 'ALERT';
      else {
        this.state = 'SUSPICIOUS';
        this.suspicion = Math.max(this.suspicion, this.cfg.suspiciousAt);
      }
    } else if (this.suspicion >= this.cfg.suspiciousAt) this.state = 'SUSPICIOUS';
    else if (this.state === 'SUSPICIOUS' && this.suspicion > 0) this.state = 'SUSPICIOUS';
    else this.state = 'UNAWARE';
  }

  reset(): void {
    this.suspicion = 0;
    this.state = 'UNAWARE';
    this.hasLastKnown = false;
    this.sinceContactMs = 1e9;
    this.visible = false;
  }
}
