/**
 * Free-fly camera cho QA/benchmark (?freefly=1) — tiêu thụ InputSnapshot (bàn phím hoặc replay).
 * Không phải player controller (TIP-005).
 */
import { PerspectiveCamera, Vector3, Euler } from 'three/webgpu';
import type { InputSnapshot } from './input';

export class FreeFly {
  yaw = 0;
  pitch = 0;
  speed = 8;
  sensitivity = 0.0022;
  private readonly dir = new Vector3();
  private readonly right = new Vector3();
  private readonly euler = new Euler(0, 0, 0, 'YXZ');

  constructor(readonly camera: PerspectiveCamera) {}

  /** Gọi ở sim tick (60 Hz) với snapshot của tick đó. */
  step(input: InputSnapshot, dt: number): void {
    this.yaw -= input.dx * this.sensitivity;
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - input.dy * this.sensitivity));
    this.euler.set(this.pitch, this.yaw, 0);
    this.camera.quaternion.setFromEuler(this.euler);
    this.dir.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.right.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const v = this.speed * (input.sprint ? 2.5 : 1) * dt;
    this.camera.position.addScaledVector(this.dir, input.fwd * v);
    this.camera.position.addScaledVector(this.right, input.right * v);
    if (input.jump) this.camera.position.y += 0.5;
    if (input.crouch) this.camera.position.y = Math.max(0.6, this.camera.position.y - v);
    // Giữ trong arena
    this.camera.position.x = Math.max(-58, Math.min(58, this.camera.position.x));
    this.camera.position.z = Math.max(-58, Math.min(58, this.camera.position.z));
    this.camera.position.y = Math.max(0.6, Math.min(30, this.camera.position.y));
  }
}
