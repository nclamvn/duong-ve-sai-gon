/**
 * Player (PRD PLY-001..003): controller + camera rig + health. step() ở 60 Hz; render(alpha) nội suy → camera.
 * Không gọi renderer trực tiếp (PRD §3.2) — chỉ ghi vào PerspectiveCamera được inject.
 */
import { Vector3, type PerspectiveCamera } from 'three';
import { CapsuleController } from '@engine/physics/controller';
import type { PhysicsWorld } from '@engine/physics/world';
import type { InputSnapshot } from '@engine/input/input';
import { CameraRig } from './camera';
import type { Settings } from './settings';

export interface PlayerSnapshot {
  position: [number, number, number];
  yaw: number;
  pitch: number;
  health: number;
  stance: 'stand' | 'crouch';
}

export class Player {
  readonly controller: CapsuleController;
  readonly rig = new CameraRig();
  health = 100;
  readonly maxHealth = 100;
  alive = true;
  sensitivity = 1;
  invertY = false;
  baseFov = 90;
  /** 0..1 — weapon ADS lerp (TIP-006 ghi) → FOV */
  adsBlend = 0;
  adsFov = 55;
  private readonly eye: [number, number, number] = [0, 0, 0];
  private readonly offset = new Vector3();
  private readonly right = new Vector3();
  private readonly up = new Vector3();
  readonly spawn: [number, number, number];
  /** yaw hiện tại theo input (rad) — nguồn cho controller */
  private sprinting = false;

  constructor(physics: PhysicsWorld, spawn: [number, number, number], initialYaw = 0) {
    this.spawn = [spawn[0], spawn[1], spawn[2]];
    this.controller = new CapsuleController(physics, spawn);
    this.rig.reset(initialYaw, 0);
  }

  applySettings(s: Settings): void {
    this.sensitivity = s.sensitivity;
    this.invertY = s.invertY;
    this.baseFov = s.fov;
    this.rig.intensity.bob = s.bob / 100;
    this.rig.intensity.shake = s.shake / 100;
    this.rig.intensity.recoil = s.recoilView / 100;
  }

  step(input: InputSnapshot, dt: number): void {
    if (!this.alive) return;
    this.rig.look(input.dx, input.dy, this.sensitivity, this.invertY);
    this.controller.step(input, this.rig.yaw, dt);
    this.sprinting = input.sprint && input.fwd > 0 && this.controller.stance === 'stand';
    if (this.controller.landedSpeed > 2) this.rig.landed(this.controller.landedSpeed);
    this.rig.step(dt, this.controller.horizontalSpeed(), this.controller.grounded, this.sprinting);
  }

  /** Ghi camera từ trạng thái nội suy. */
  render(camera: PerspectiveCamera, alpha: number): void {
    this.controller.eye(alpha, this.eye);
    const q = this.rig.compose();
    camera.quaternion.copy(q);
    this.rig.positionOffset(this.offset);
    this.right.set(1, 0, 0).applyQuaternion(q);
    this.up.set(0, 1, 0);
    camera.position.set(this.eye[0], this.eye[1], this.eye[2]);
    camera.position.addScaledVector(this.right, this.offset.x).addScaledVector(this.up, this.offset.y);
    const fov = this.baseFov + (this.adsFov - this.baseFov) * this.adsBlend;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  damage(amount: number): boolean {
    if (!this.alive) return false;
    this.health = Math.max(0, this.health - amount);
    this.rig.shake(Math.min(1, amount / 30));
    if (this.health === 0) this.alive = false;
    return !this.alive;
  }

  /** Hướng nhìn thế giới (đơn vị) — hitscan dùng; không gồm recoil/shake (aim gốc). */
  aimDirection(out: Vector3, includeRecoil = true): Vector3 {
    const pitch = this.rig.pitch + (includeRecoil ? this.rig.recoilPitch : 0);
    const yaw = this.rig.yaw + (includeRecoil ? this.rig.recoilYaw : 0);
    out.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    return out;
  }

  eyePosition(out: Vector3): Vector3 {
    this.controller.eye(1, this.eye);
    return out.set(this.eye[0], this.eye[1], this.eye[2]);
  }

  snapshot(): PlayerSnapshot {
    return {
      position: [this.controller.feet[0], this.controller.feet[1], this.controller.feet[2]],
      yaw: this.rig.yaw,
      pitch: this.rig.pitch,
      health: this.health,
      stance: this.controller.stance,
    };
  }

  restore(s: PlayerSnapshot): void {
    this.controller.teleport(s.position[0], s.position[1], s.position[2]);
    this.rig.reset(s.yaw, s.pitch);
    this.health = s.health;
    this.alive = s.health > 0;
    if (s.stance === 'crouch') this.controller.stance = 'crouch';
  }

  reset(yaw = 0): void {
    this.controller.teleport(this.spawn[0], this.spawn[1], this.spawn[2]);
    this.controller.stance = 'stand';
    this.rig.reset(yaw, 0);
    this.health = this.maxHealth;
    this.alive = true;
    this.adsBlend = 0;
  }
}
