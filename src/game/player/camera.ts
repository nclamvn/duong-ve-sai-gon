/**
 * CameraRig (PRD PLY-003): look + bob + landing + recoil + shake — tách lớp, mỗi lớp có cường độ 0–1.
 * Recoil/shake KHÔNG đổi yaw/pitch gốc → không drift aim. Thuần toán, không DOM/renderer.
 */
import { Quaternion, Euler, Vector3 } from 'three';
import tuning from '@content/tuning/player.json';

export interface RigIntensity {
  bob: number;
  shake: number;
  recoil: number;
}

const DEG = Math.PI / 180;

export class CameraRig {
  yaw = 0;
  pitch = 0;
  pitchClamp = tuning.look.pitchClampDeg * DEG;
  readonly intensity: RigIntensity = { bob: 1, shake: 1, recoil: 1 };
  /** recoil view kick (rad) hiện tại — hồi về 0 */
  recoilPitch = 0;
  recoilYaw = 0;
  /** shake hiện tại */
  shakeAmp = 0;
  private shakePhase = 0;
  /** DV-088 loạng choạng (choáng nổ): nghiêng đầu (roll) + gục xuống (pitch), lò xo tắt dần — offset tạm như shake */
  stumbleRoll = 0;
  stumblePitch = 0;
  private stumbleRollV = 0;
  private stumblePitchV = 0;
  /**
   * DV-089 máy cầm tay: biên độ (rad) do Game đặt mỗi frame theo hồi + vận động + trận (0 = tắt). Nhiễu tần thấp nhiều tầng
   * (thở, bước, tay mỏi) — offset tạm như shake, không ghi vào yaw/pitch, theo cài đặt rung.
   */
  handheld = 0;
  private handT = 0;
  private handP = 0;
  private handY = 0;
  private handR = 0;
  /** landing dip (m) */
  landingDip = 0;
  private bobPhase = 0;
  readonly bobOffset = new Vector3();
  readonly quaternion = new Quaternion();
  private readonly euler = new Euler(0, 0, 0, 'YXZ');
  private recoilRecover = tuning.camera.recoil.recoverPerSec;
  private shakeDecay = tuning.camera.shake.decayPerSec;

  look(dx: number, dy: number, sensitivity: number, invertY: boolean): void {
    const s = tuning.look.baseSensitivityRadPerPx * sensitivity;
    this.yaw -= dx * s;
    this.pitch -= dy * s * (invertY ? -1 : 1);
    this.pitch = Math.max(-this.pitchClamp, Math.min(this.pitchClamp, this.pitch));
    // giữ yaw trong [-π, π] để hash ổn định
    if (this.yaw > Math.PI) this.yaw -= Math.PI * 2;
    else if (this.yaw < -Math.PI) this.yaw += Math.PI * 2;
  }

  /** kick recoil: pitch lên (rad dương), yaw ngẫu nhiên đã tính bởi weapon */
  kick(pitchRad: number, yawRad: number): void {
    this.recoilPitch += pitchRad * this.intensity.recoil;
    this.recoilYaw += yawRad * this.intensity.recoil;
  }

  shake(amp: number): void {
    this.shakeAmp = Math.max(this.shakeAmp, amp * this.intensity.shake);
  }

  /** DV-088 xô người: `k` 0..1, `side` −1 trái / +1 phải (phía bị sóng nổ đẩy) */
  stumble(k: number, side: number): void {
    const a = k * this.intensity.shake;
    this.stumbleRollV += side * a * 0.85;
    this.stumblePitchV -= a * 0.6;
  }

  landed(speed: number): void {
    this.landingDip = Math.min(0.25, speed * 0.02) * this.intensity.bob;
  }

  /** Gọi ở sim tick: cập nhật bob/recoil/shake theo dt. */
  step(dt: number, horizontalSpeed: number, grounded: boolean, sprinting: boolean): void {
    // recoil recovery (exponential)
    const k = Math.exp(-this.recoilRecover * dt);
    this.recoilPitch *= k;
    this.recoilYaw *= k;
    if (Math.abs(this.recoilPitch) < 1e-5) this.recoilPitch = 0;
    if (Math.abs(this.recoilYaw) < 1e-5) this.recoilYaw = 0;
    // shake decay
    this.shakeAmp *= Math.exp(-this.shakeDecay * dt);
    if (this.shakeAmp < 1e-4) this.shakeAmp = 0;
    this.shakePhase += dt * 37;
    // máy cầm tay: các tần số không chia hết nhau → không lặp nhịp thấy được
    this.handT += dt;
    const t = this.handT;
    const h = this.handheld * this.intensity.shake;
    this.handP = h * (0.55 * Math.sin(t * 1.27 + 0.4) + 0.3 * Math.sin(t * 2.91 + 1.7) + 0.15 * Math.sin(t * 6.83 + 0.2));
    this.handY = h * (0.6 * Math.sin(t * 0.93 + 2.1) + 0.28 * Math.sin(t * 2.37 + 0.9) + 0.12 * Math.sin(t * 5.71 + 1.3));
    this.handR = h * 0.8 * (0.7 * Math.sin(t * 0.71 + 1.1) + 0.3 * Math.sin(t * 1.83 + 2.6));
    // lò xo tắt dần (ω 5,5 rad/s, ζ 0,38): nghiêng rồi lắc lại một hai nhịp như người say sóng nổ
    const w2 = 30.25;
    const c2 = 2 * 0.38 * 5.5;
    this.stumbleRollV += (-w2 * this.stumbleRoll - c2 * this.stumbleRollV) * dt;
    this.stumbleRoll += this.stumbleRollV * dt;
    this.stumblePitchV += (-w2 * this.stumblePitch - c2 * this.stumblePitchV) * dt;
    this.stumblePitch += this.stumblePitchV * dt;
    if (Math.abs(this.stumbleRoll) + Math.abs(this.stumbleRollV) < 1e-5) this.stumbleRoll = this.stumbleRollV = 0;
    if (Math.abs(this.stumblePitch) + Math.abs(this.stumblePitchV) < 1e-5) this.stumblePitch = this.stumblePitchV = 0;
    // landing dip recover
    this.landingDip = Math.max(0, this.landingDip - tuning.camera.landing.recoverPerSec * dt * 0.1);
    // bob
    const b = tuning.camera.bob;
    if (grounded && horizontalSpeed > 0.3) {
      const freq = sprinting ? b.freqSprint : b.freqWalk;
      this.bobPhase += dt * freq * Math.PI * 2 * Math.min(1, horizontalSpeed / 4);
      const amp = Math.min(1, horizontalSpeed / 4) * this.intensity.bob;
      this.bobOffset.set(Math.sin(this.bobPhase) * b.ampX * amp, Math.abs(Math.sin(this.bobPhase)) * b.ampY * amp * -1, 0);
    } else {
      this.bobOffset.multiplyScalar(Math.exp(-10 * dt));
    }
  }

  /** Quaternion tổng hợp: look (+ recoil + shake). Recoil/shake là offset tạm, không ghi vào yaw/pitch. */
  compose(): Quaternion {
    const shakeP = this.shakeAmp * Math.sin(this.shakePhase) * 0.02;
    const shakeY = this.shakeAmp * Math.cos(this.shakePhase * 0.7) * 0.02;
    this.euler.set(this.pitch + this.recoilPitch + shakeP + this.stumblePitch + this.handP, this.yaw + this.recoilYaw + shakeY + this.handY, this.stumbleRoll + this.handR);
    return this.quaternion.setFromEuler(this.euler);
  }

  /** offset vị trí (bob + landing) trong không gian camera-local (x phải, y lên) */
  positionOffset(out: Vector3): Vector3 {
    out.copy(this.bobOffset);
    out.y -= this.landingDip;
    return out;
  }

  reset(yaw = 0, pitch = 0): void {
    this.yaw = yaw;
    this.pitch = pitch;
    this.recoilPitch = this.recoilYaw = 0;
    this.shakeAmp = 0;
    this.stumbleRoll = this.stumbleRollV = this.stumblePitch = this.stumblePitchV = 0;
    this.handP = this.handY = this.handR = 0;
    this.landingDip = 0;
    this.bobPhase = 0;
    this.bobOffset.set(0, 0, 0);
  }
}
