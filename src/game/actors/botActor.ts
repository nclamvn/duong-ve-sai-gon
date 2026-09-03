/**
 * BotActor — glue: Bot (logic) + ActorVisual (Dummy procedural hoặc SoldierVisual glTF) + ActorBody (physics). Game sở hữu.
 */
import type { Scene } from 'three/webgpu';
import { Bot, type BotDeps } from '@game/ai/bot';
import type { ActorVisual } from './visual';
import { attachActorBody, type ActorBody } from './actorPhysics';
import type { PhysicsWorld } from '@engine/physics/world';

export class BotActor {
  readonly bot: Bot;
  readonly dummy: ActorVisual;
  readonly body: ActorBody;
  readonly spawn: [number, number, number];

  constructor(
    readonly id: string,
    readonly group: string,
    spawn: [number, number, number],
    scene: Scene,
    physics: PhysicsWorld,
    visual: ActorVisual,
    deps: Omit<BotDeps, 'exclude'>,
  ) {
    this.spawn = [spawn[0], spawn[1], spawn[2]];
    this.body = attachActorBody(physics, id, spawn);
    this.bot = new Bot(id, spawn, { ...deps, exclude: () => this.body.bodyCollider });
    this.dummy = visual;
    this.dummy.group.position.set(spawn[0], spawn[1], spawn[2]);
    this.dummy.group.name = id;
    scene.add(this.dummy.group);
  }

  /** sim60: sau bot.move() — đẩy body theo vị trí logic */
  syncBody(): void {
    this.body.setPosition(this.bot.position[0], this.bot.position[1], this.bot.position[2]);
  }

  /** render: đồng bộ visual */
  private prevPos: [number, number, number] = [0, 0, 0];
  private prevT = 0;
  syncVisual(t: number): void {
    const g = this.dummy.group;
    if (this.bot.alive) {
      const p = this.bot.position;
      const dtv = t - this.prevT;
      if (dtv > 1e-3) {
        const sp = Math.hypot(p[0] - this.prevPos[0], p[2] - this.prevPos[2]) / dtv;
        // lọc mượt tốc độ hiển thị
        this.dummy.motion.speed += (Math.min(6, sp) - this.dummy.motion.speed) * Math.min(1, dtv * 8);
        this.prevPos[0] = p[0];
        this.prevPos[1] = p[1];
        this.prevPos[2] = p[2];
        this.prevT = t;
      }
      this.dummy.motion.aiming = this.bot.aiming;
      g.position.set(p[0], p[1], p[2]);
      g.rotation.y = this.bot.yaw;
    }
    this.dummy.setPose(t);
  }

  applyDamage(amount: number, from: [number, number, number]): boolean {
    const died = this.bot.applyDamage(amount, from);
    this.dummy.applyDamage(amount);
    if (died) this.body.setEnabled(false);
    return died;
  }

  reset(): void {
    this.bot.reset(this.spawn);
    this.dummy.reset();
    this.dummy.group.position.set(this.spawn[0], this.spawn[1], this.spawn[2]);
    this.body.setEnabled(true);
    this.body.setPosition(this.spawn[0], this.spawn[1], this.spawn[2]);
  }

  dispose(scene: Scene): void {
    this.bot.dispose();
    this.body.dispose();
    scene.remove(this.dummy.group);
  }
}
