/**
 * Free-fly camera cho QA/benchmark (?freefly=1). Không phải player controller (TIP-005).
 */
import { PerspectiveCamera, Vector3, Euler } from 'three/webgpu';

export class FreeFly {
  yaw = 0;
  pitch = 0;
  speed = 8;
  private keys = new Set<string>();
  private readonly dir = new Vector3();
  private readonly right = new Vector3();
  private readonly euler = new Euler(0, 0, 0, 'YXZ');
  private onKey = (e: KeyboardEvent): void => {
    if (e.type === 'keydown') this.keys.add(e.code);
    else this.keys.delete(e.code);
  };
  private onMouse = (e: MouseEvent): void => {
    if (document.pointerLockElement !== this.canvas) return;
    this.yaw -= e.movementX * 0.0022;
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - e.movementY * 0.0022));
  };

  constructor(readonly camera: PerspectiveCamera, readonly canvas: HTMLCanvasElement) {}

  attach(): void {
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    window.addEventListener('mousemove', this.onMouse);
    this.canvas.addEventListener('click', () => this.canvas.requestPointerLock());
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    window.removeEventListener('mousemove', this.onMouse);
  }

  update(dt: number): void {
    this.euler.set(this.pitch, this.yaw, 0);
    this.camera.quaternion.setFromEuler(this.euler);
    this.dir.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.right.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const v = this.speed * (this.keys.has('ShiftLeft') ? 2.5 : 1) * dt;
    if (this.keys.has('KeyW')) this.camera.position.addScaledVector(this.dir, v);
    if (this.keys.has('KeyS')) this.camera.position.addScaledVector(this.dir, -v);
    if (this.keys.has('KeyD')) this.camera.position.addScaledVector(this.right, v);
    if (this.keys.has('KeyA')) this.camera.position.addScaledVector(this.right, -v);
    if (this.keys.has('KeyE')) this.camera.position.y += v;
    if (this.keys.has('KeyQ')) this.camera.position.y -= v;
  }
}
