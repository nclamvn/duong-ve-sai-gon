/**
 * Game — integrator: renderer + arena + loop (FixedClock → Scheduler → render nội suy).
 * TIP-003: arena + free-fly. Các TIP sau gắn thêm player/weapon/ai/mission qua các field public.
 */
import { Scene, PerspectiveCamera, Vector3 } from 'three/webgpu';
import { FixedClock, Scheduler, EventBus, mulberry32, type Prng } from '@engine/core';
import { createRenderer, backendFromSearch, type RendererBundle } from '@engine/render/backend';
import { buildArena, type ArenaData } from '@engine/render/arena';
import { createLighting, type LightRig } from '@engine/render/lighting';
import { createRain, type Rain } from '@engine/render/rain';
import { QualityScaler } from '@engine/render/scaler';
import { readRenderInfo, type RenderFrameInfo } from '@engine/render/telemetryHooks';
import { FreeFly } from '@engine/input/freeFly';
import { Dummy } from '@game/actors/dummy';

export interface GameEvents extends Record<string, unknown> {
  RENDER_DEVICE_LOST: { api: string; message: string; reason: string | null };
  GAME_RESET: { seed: number };
  [k: string]: unknown;
}

export interface GameOptions {
  canvas: HTMLCanvasElement;
  search: string;
  seed?: number;
}

export class Game {
  readonly clock = new FixedClock(60, 5);
  readonly scheduler = new Scheduler();
  readonly events = new EventBus<GameEvents>(512);
  prng: Prng;
  seed: number;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(90, 1, 0.05, 400);
  bundle!: RendererBundle;
  arena!: ArenaData;
  lights!: LightRig;
  rain!: Rain;
  dummies: Dummy[] = [];
  readonly scaler = new QualityScaler();
  freeFly: FreeFly | null = null;
  readonly renderInfo: RenderFrameInfo = { calls: 0, triangles: 0, gpuMs: null, heapMB: null, renderWidth: 0, renderHeight: 0 };
  frames = 0;
  running = false;
  ready = false;
  lastFrameMs = 0;
  private lastT = 0;
  private raf = 0;
  /** hook để TIP-004 telemetry sample mỗi frame */
  onFrame: ((game: Game, frameMs: number) => void) | null = null;
  /** hook để TIP-005+ điều khiển camera; nếu null dùng free-fly */
  cameraDriver: ((alpha: number, dt: number) => void) | null = null;
  private readonly tmp = new Vector3();
  readonly params: URLSearchParams;

  constructor(readonly opts: GameOptions) {
    this.params = new URLSearchParams(opts.search);
    this.seed = opts.seed ?? Number(this.params.get('seed') ?? 7);
    this.prng = mulberry32(this.seed);
  }

  async init(): Promise<void> {
    const override = backendFromSearch(this.opts.search);
    this.bundle = await createRenderer({
      canvas: this.opts.canvas,
      forceWebGL: override === 'webgl',
      onDeviceLost: (info) => this.events.emit('RENDER_DEVICE_LOST', info),
    });
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.lights = createLighting(this.scene, Number(this.params.get('shadow') ?? 2048));
    this.arena = buildArena(this.scene, this.seed);
    this.rain = createRain(Number(this.params.get('rain') ?? 20000));
    this.scene.add(this.rain.mesh);
    for (let i = 0; i < this.arena.dummySpawns.length; i++) {
      const d = new Dummy({ phase: i * 0.9, color: 0x6f7f5f });
      const p = this.arena.dummySpawns[i]!;
      d.group.position.set(p[0], p[1], p[2]);
      d.group.rotation.y = Math.atan2(-p[0], -p[2]);
      this.scene.add(d.group);
      this.dummies.push(d);
    }
    const ps = this.arena.playerSpawn;
    this.camera.position.set(ps[0], 1.7, ps[2]);
    this.camera.lookAt(0, 1.2, 0);

    // Free-fly khi chưa có player (TIP-003) hoặc ?freefly=1
    if (this.params.get('freefly') === '1' || this.cameraDriver === null) {
      this.freeFly = new FreeFly(this.camera, this.opts.canvas);
      this.freeFly.attach();
      this.freeFly.yaw = 0; // spawn ở z=+40, nhìn −z về tâm arena
    }
    this.scheduler.add('render', (alpha, dt) => this.renderStep(alpha, dt));
    this.ready = true;
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.applyScale(true);
  }

  private applyScale(force = false): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * this.scaler.scale;
    const r = this.bundle.renderer;
    if (force || Math.abs(r.getPixelRatio() - dpr) > 1e-3) {
      r.setPixelRatio(dpr);
      r.setSize(window.innerWidth, window.innerHeight, false);
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastT = performance.now();
    const loop = (now: number): void => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = (now - this.lastT) / 1000;
      this.lastT = now;
      this.frame(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Một frame: sim fixed-step → render nội suy. Không mutate physics trong render. */
  frame(dt: number): void {
    const t0 = performance.now();
    this.scheduler.beginFrame();
    const adv = this.clock.advance(dt);
    for (let i = 0; i < adv.steps; i++) {
      this.events.currentTick = this.clock.tick - adv.steps + i + 1;
      this.scheduler.runSim(this.events.currentTick, this.clock.step);
    }
    this.scheduler.runRender(adv.alpha, dt);
    const frameMs = performance.now() - t0;
    this.lastFrameMs = frameMs;
    this.frames++;
    if (this.scaler.update(this.lastFrameMs)) this.applyScale();
    this.onFrame?.(this, frameMs);
  }

  private renderStep(alpha: number, dt: number): void {
    if (this.cameraDriver) this.cameraDriver(alpha, dt);
    else this.freeFly?.update(dt);
    const t = this.clock.simTime + alpha * this.clock.step;
    for (let i = 0; i < this.dummies.length; i++) this.dummies[i]!.setPose(t);
    this.tmp.copy(this.camera.position);
    this.lights.followTarget(this.camera);
    this.bundle.renderer.render(this.scene, this.camera);
    readRenderInfo(this.bundle.renderer, this.renderInfo);
  }

  /** Đưa toàn bộ về trạng thái đầu (bench/test). Các TIP sau mở rộng qua resetHooks. */
  readonly resetHooks: Array<(seed: number) => void> = [];
  reset(seed = this.seed): void {
    this.seed = seed;
    this.prng = mulberry32(seed);
    this.clock.reset();
    this.events.reset();
    this.scaler.reset();
    this.applyScale(true);
    for (const d of this.dummies) d.reset();
    const ps = this.arena.playerSpawn;
    this.camera.position.set(ps[0], 1.7, ps[2]);
    if (this.freeFly) {
      this.freeFly.yaw = 0;
      this.freeFly.pitch = 0;
    }
    for (const h of this.resetHooks) h(seed);
    this.frames = 0;
    this.events.emit('GAME_RESET', { seed });
  }
}
