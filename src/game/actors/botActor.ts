/**
 * BotActor — glue: Bot (logic) + ActorVisual (Dummy procedural hoặc SoldierVisual glTF) + ActorBody (physics). Game sở hữu.
 */
import type { Scene } from 'three/webgpu';
import { Bot, type BotDeps } from '@game/ai/bot';
import type { ActorVisual } from './visual';
import { attachActorBody, type ActorBody } from './actorPhysics';
import ai from '@content/tuning/ai.json';
import type { PhysicsWorld } from '@engine/physics/world';

export type Faction = 'enemy' | 'friend';

export class BotActor {
  readonly bot: Bot;
  readonly dummy: ActorVisual;
  readonly body: ActorBody;
  readonly spawn: [number, number, number];
  /** phe (TIP-M1A): địch nhắm người chơi + đồng đội; đồng đội nhắm địch */
  faction: Faction = 'enemy';
  /** khoá i18n tên (đồng đội có tên — PRD §8.4 "dấu nhỏ khi nhìn vào") */
  nameKey: string | null = null;
  /** tick sim lần bắn gần nhất (minimap: địch chỉ hiện khi vừa bắn) */
  lastFireTick = -1e9;
  /** DV-091 AI slot: the bot thinks on ticks where tick % 6 === slot % 6 (spreads the 10 Hz AI over six frames) */
  aiSlot = 0;
  /** DV-091 sim time of death (s), -1 alive — corpses are cleared after a while out of view */
  diedAt = -1;

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

  /** hạ capsule khi cúi (AI-T1.3), làm mượt để không giật */
  private drop = 0;

  /** sim60: sau bot.move() — đẩy body theo vị trí logic; cúi → cả capsule + đầu hạ crouchDrop (phần dưới chìm vào đất, vô hại) */
  syncBody(): void {
    const want = this.bot.stance === 'crouch' ? ai.combat.crouchDrop : 0;
    this.drop += (want - this.drop) * 0.25;
    if (Math.abs(want - this.drop) < 0.005) this.drop = want;
    this.body.setPosition(this.bot.position[0], this.bot.position[1] - this.drop, this.bot.position[2]);
  }

  /** render: đồng bộ visual */
  private prevPos: [number, number, number] = [0, 0, 0];
  private prevT = 0;
  /** smoothed world velocity for the locomotion blend (DV-066) */
  private readonly vel: [number, number] = [0, 0];
  /** `pose` false: move the body but skip the animation update this frame (DV-091 animation LOD) */
  syncVisual(t: number, pose = true): void {
    const g = this.dummy.group;
    if (this.bot.alive) {
      const p = this.bot.position;
      const dtv = t - this.prevT;
      if (dtv > 1e-3) {
        let vx = (p[0] - this.prevPos[0]) / dtv;
        let vz = (p[2] - this.prevPos[2]) / dtv;
        const sp = Math.hypot(vx, vz);
        if (sp > 6) {
          // teleport/stuck recovery: not a real velocity
          vx = 0;
          vz = 0;
        }
        // smooth displayed velocity (sim steps at 60 Hz, render varies)
        const k = Math.min(1, dtv * 8);
        this.vel[0] += (vx - this.vel[0]) * k;
        this.vel[1] += (vz - this.vel[1]) * k;
        this.dummy.motion.speed += (Math.min(6, sp) - this.dummy.motion.speed) * k;
        this.prevPos[0] = p[0];
        this.prevPos[1] = p[1];
        this.prevPos[2] = p[2];
        this.prevT = t;
      }
      const m = this.dummy.motion;
      m.aiming = this.bot.aiming;
      m.crouch = this.bot.stance === 'crouch';
      m.yaw = this.bot.yaw;
      m.vx = this.vel[0];
      m.vz = this.vel[1];
      m.pitch = this.bot.aimPitch;
      g.position.set(p[0], p[1], p[2]);
      // procedural dummy faces the aim; a glTF soldier overrides this with its own body yaw in setPose
      if (!pose) return;
      g.rotation.y = this.bot.yaw;
    }
    if (pose) this.dummy.setPose(t);
  }

  applyDamage(amount: number, from: [number, number, number], zone?: string): boolean {
    const died = this.bot.applyDamage(amount, from);
    this.dummy.applyDamage(amount, { from, zone });
    if (died) this.body.setEnabled(false);
    return died;
  }

  reset(): void {
    this.drop = 0;
    this.diedAt = -1; // DV-091: corpse timer restarts (checkpoint load keeps the snapshot's bodies until they lie long enough)
    this.vel[0] = 0;
    this.vel[1] = 0;
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
