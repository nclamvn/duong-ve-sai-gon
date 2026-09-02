/**
 * CapsuleController — Rapier KinematicCharacterController (PRD PLY-001): đi/chạy/cúi/nhảy thấp, autostep, slope,
 * snap-to-ground. Thuần logic, không DOM. stateHash() để test determinism.
 */
import type RAPIER from '@dimforge/rapier3d-compat';
import type { PhysicsWorld } from './world';
import { LAYER } from './layers';
import type { InputSnapshot } from '@engine/input/input';
import tuning from '@content/tuning/player.json';

export type Stance = 'stand' | 'crouch';

export interface ControllerConfig {
  radius: number;
  standHeight: number;
  crouchHeight: number;
  walk: number;
  sprint: number;
  crouch: number;
  accel: number;
  decel: number;
  airControl: number;
  jumpVelocity: number;
  gravity: number;
  maxFall: number;
  offset: number;
  autostepHeight: number;
  autostepMinWidth: number;
  maxSlopeDeg: number;
  minSlideDeg: number;
  snapToGround: number;
}

export const DEFAULT_CONTROLLER: ControllerConfig = {
  radius: tuning.capsule.radius,
  standHeight: tuning.capsule.standHeight,
  crouchHeight: tuning.capsule.crouchHeight,
  walk: tuning.move.walk,
  sprint: tuning.move.sprint,
  crouch: tuning.move.crouch,
  accel: tuning.move.accel,
  decel: tuning.move.decel,
  airControl: tuning.move.airControl,
  jumpVelocity: tuning.jump.velocity,
  gravity: tuning.jump.gravity,
  maxFall: tuning.jump.maxFall,
  offset: tuning.controller.offset,
  autostepHeight: tuning.controller.autostepHeight,
  autostepMinWidth: tuning.controller.autostepMinWidth,
  maxSlopeDeg: tuning.controller.maxSlopeDeg,
  minSlideDeg: tuning.controller.minSlideDeg,
  snapToGround: tuning.controller.snapToGround,
};

export class CapsuleController {
  readonly cfg: ControllerConfig;
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  private readonly cc: RAPIER.KinematicCharacterController;
  /** vị trí chân (feet) — nguồn sự thật */
  readonly feet: [number, number, number];
  readonly prevFeet: [number, number, number];
  /** vận tốc ngang mong muốn hiện tại (m/s) */
  readonly vel: [number, number, number] = [0, 0, 0];
  vy = 0;
  grounded = false;
  wasGrounded = false;
  stance: Stance = 'stand';
  /** tốc độ chạm đất khi landing (để camera dip) */
  landedSpeed = 0;
  justJumped = false;
  private readonly desired = { x: 0, y: 0, z: 0 };

  constructor(
    readonly physics: PhysicsWorld,
    spawn: [number, number, number],
    cfg: Partial<ControllerConfig> = {},
    id = 'player',
  ) {
    this.cfg = { ...DEFAULT_CONTROLLER, ...cfg };
    this.feet = [spawn[0], spawn[1], spawn[2]];
    this.prevFeet = [spawn[0], spawn[1], spawn[2]];
    const hh = this.halfHeight('stand');
    const created = physics.addKinematicCapsule([spawn[0], spawn[1] + hh + this.cfg.radius, spawn[2]], hh, this.cfg.radius, { id, kind: 'player', material: 'flesh' }, LAYER.PLAYER);
    this.body = created.body;
    this.collider = created.collider;
    const cc = physics.world.createCharacterController(this.cfg.offset);
    cc.enableAutostep(this.cfg.autostepHeight, this.cfg.autostepMinWidth, true);
    cc.enableSnapToGround(this.cfg.snapToGround);
    cc.setMaxSlopeClimbAngle((this.cfg.maxSlopeDeg * Math.PI) / 180);
    cc.setMinSlopeSlideAngle((this.cfg.minSlideDeg * Math.PI) / 180);
    cc.setUp({ x: 0, y: 1, z: 0 });
    cc.setApplyImpulsesToDynamicBodies(false);
    this.cc = cc;
  }

  halfHeight(stance: Stance): number {
    const h = stance === 'stand' ? this.cfg.standHeight : this.cfg.crouchHeight;
    return (h - 2 * this.cfg.radius) / 2;
  }

  get height(): number {
    return this.stance === 'stand' ? this.cfg.standHeight : this.cfg.crouchHeight;
  }

  /** Tâm capsule (world) từ feet. */
  private centerY(): number {
    return this.feet[1] + this.halfHeight(this.stance) + this.cfg.radius;
  }

  private canStand(): boolean {
    // Ray từ đỉnh capsule cúi lên tới chiều cao đứng
    const top = this.feet[1] + this.cfg.crouchHeight;
    const need = this.cfg.standHeight - this.cfg.crouchHeight + 0.05;
    const hit = this.physics.castRay(this.feet[0], top, this.feet[2], 0, 1, 0, need, LAYER.WORLD, this.collider);
    return hit === null;
  }

  private setStance(s: Stance): void {
    if (s === this.stance) return;
    this.stance = s;
    this.collider.setHalfHeight(this.halfHeight(s));
  }

  /**
   * Một tick 60 Hz. `yaw` = hướng nhìn (rad) để đổi input local → world.
   */
  step(input: InputSnapshot, yaw: number, dt: number): void {
    const c = this.cfg;
    this.prevFeet[0] = this.feet[0];
    this.prevFeet[1] = this.feet[1];
    this.prevFeet[2] = this.feet[2];
    this.justJumped = false;
    this.landedSpeed = 0;

    // Stance
    if (input.crouch) this.setStance('crouch');
    else if (this.stance === 'crouch' && this.canStand()) this.setStance('stand');

    // Hướng mong muốn (world) từ fwd/right theo yaw
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    // forward = (-sin, 0, -cos) khi yaw=0 nhìn −z
    let mx = -sin * input.fwd + cos * input.right;
    let mz = -cos * input.fwd - sin * input.right;
    const mlen = Math.hypot(mx, mz);
    if (mlen > 1) {
      mx /= mlen;
      mz /= mlen;
    }
    const maxSpeed = this.stance === 'crouch' ? c.crouch : input.sprint && input.fwd > 0 ? c.sprint : c.walk;
    const tx = mx * maxSpeed;
    const tz = mz * maxSpeed;
    const rate = (mlen > 0 ? c.accel : c.decel) * (this.grounded ? 1 : c.airControl) * dt;
    this.vel[0] = approach(this.vel[0], tx, rate);
    this.vel[2] = approach(this.vel[2], tz, rate);

    // Dọc
    if (this.grounded) {
      if (this.vy < 0) this.vy = -0.5; // giữ tiếp xúc nhẹ cho snap
      if (input.jump && this.stance === 'stand') {
        this.vy = c.jumpVelocity;
        this.justJumped = true;
      }
    }
    this.vy = Math.max(-c.maxFall, this.vy - c.gravity * dt);
    this.vel[1] = this.vy;

    this.desired.x = this.vel[0] * dt;
    this.desired.y = this.vel[1] * dt;
    this.desired.z = this.vel[2] * dt;
    this.cc.computeColliderMovement(this.collider, this.desired, undefined, undefined);
    const mv = this.cc.computedMovement();
    this.wasGrounded = this.grounded;
    this.grounded = this.cc.computedGrounded();
    this.feet[0] += mv.x;
    this.feet[1] += mv.y;
    this.feet[2] += mv.z;
    if (this.grounded && !this.wasGrounded) {
      this.landedSpeed = Math.max(0, -this.vy);
      this.vy = 0;
    }
    // Trần/đầu chạm: nếu muốn đi lên nhưng không đi được → hủy vy
    if (this.desired.y > 1e-4 && mv.y < this.desired.y * 0.5) this.vy = Math.min(this.vy, 0);
    this.body.setNextKinematicTranslation({ x: this.feet[0], y: this.centerY(), z: this.feet[2] });
  }

  teleport(x: number, y: number, z: number): void {
    this.feet[0] = this.prevFeet[0] = x;
    this.feet[1] = this.prevFeet[1] = y;
    this.feet[2] = this.prevFeet[2] = z;
    this.vel[0] = this.vel[1] = this.vel[2] = 0;
    this.vy = 0;
    this.body.setTranslation({ x, y: this.centerY(), z }, true);
    this.body.setNextKinematicTranslation({ x, y: this.centerY(), z });
  }

  /** Vị trí mắt nội suy cho render (alpha). */
  eye(alpha: number, out: [number, number, number]): void {
    const eyeY = this.height - tuning.capsule.eyeOffsetFromTop;
    out[0] = this.prevFeet[0] + (this.feet[0] - this.prevFeet[0]) * alpha;
    out[1] = this.prevFeet[1] + (this.feet[1] - this.prevFeet[1]) * alpha + eyeY;
    out[2] = this.prevFeet[2] + (this.feet[2] - this.prevFeet[2]) * alpha;
  }

  horizontalSpeed(): number {
    return Math.hypot(this.vel[0], this.vel[2]);
  }

  stateHash(): string {
    const r = (v: number): string => (Math.round(v * 1e4) / 1e4).toFixed(4);
    return `${r(this.feet[0])},${r(this.feet[1])},${r(this.feet[2])}|${this.stance}|${r(this.vy)}|${this.grounded ? 1 : 0}`;
  }
}

function approach(v: number, target: number, rate: number): number {
  if (v < target) return Math.min(target, v + rate);
  if (v > target) return Math.max(target, v - rate);
  return v;
}
