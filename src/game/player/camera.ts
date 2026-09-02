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
    this.euler.set(this.pitch + this.recoilPitch + shakeP, this.yaw + this.recoilYaw + shakeY, 0);
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
    this.landingDip = 0;
    this.bobPhase = 0;
    this.bobOffset.set(0, 0, 0);
  }
}
