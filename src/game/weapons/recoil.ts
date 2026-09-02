/**
 * RecoilTracker (PRD WPN-003): pattern data-driven + noise seeded, clamp tổng pitch, reset sau resetMs không bắn.
 * Xuất viewKick (áp lên CameraRig.recoil — không đổi look gốc) và aimOffset (áp vào hướng bắn).
 */
import type { Prng } from '@engine/core';

const DEG = Math.PI / 180;

export interface RecoilSpec {
  recoilPattern: number[][];
  recoilNoise: number;
  recoilResetMs: number;
  maxPitchDeg: number;
  viewKickScale: number;
}

export class RecoilTracker {
  /** offset tích lũy áp vào hướng bắn (rad) */
  yaw = 0;
  pitch = 0;
  shotIndex = 0;
  private sinceShotMs = 0;
  private readonly recoverPerSec: number;

  constructor(
    readonly spec: RecoilSpec,
    private prng: Prng,
    recoverPerSec = 12,
  ) {
    this.recoverPerSec = recoverPerSec;
  }

  setPrng(p: Prng): void {
    this.prng = p;
  }

  /** Trả về [viewYawRad, viewPitchRad] để CameraRig.kick. */
  kick(out: [number, number]): [number, number] {
    const pat = this.spec.recoilPattern;
    const i = Math.min(this.shotIndex, pat.length - 1);
    const base = pat[i] ?? [0, 1];
    const n = this.spec.recoilNoise;
    const yawDeg = (base[0] ?? 0) + (this.prng.next() * 2 - 1) * n;
    const pitchDeg = (base[1] ?? 1) + (this.prng.next() * 2 - 1) * n;
    this.yaw += yawDeg * DEG;
    this.pitch = Math.min(this.spec.maxPitchDeg * DEG, this.pitch + pitchDeg * DEG);
    this.shotIndex++;
    this.sinceShotMs = 0;
    out[0] = yawDeg * DEG * this.spec.viewKickScale;
    out[1] = pitchDeg * DEG * this.spec.viewKickScale;
    return out;
  }

  /** dt giây; hồi offset về 0; reset shotIndex sau resetMs. */
  recover(dt: number): void {
    this.sinceShotMs += dt * 1000;
    const k = Math.exp(-this.recoverPerSec * dt);
    this.yaw *= k;
    this.pitch *= k;
    if (Math.abs(this.yaw) < 1e-5) this.yaw = 0;
    if (Math.abs(this.pitch) < 1e-5) this.pitch = 0;
    if (this.sinceShotMs >= this.spec.recoilResetMs) this.shotIndex = 0;
  }

  reset(): void {
    this.yaw = this.pitch = 0;
    this.shotIndex = 0;
    this.sinceShotMs = 1e9;
  }
}
