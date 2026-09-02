/**
 * Game — integrator: renderer + arena + loop (FixedClock → Scheduler → render nội suy) + telemetry.
 * TIP-003 arena/free-fly · TIP-004 input source/telemetry/quality · TIP-005+ gắn player/weapon/ai/mission
 * qua các field public và resetHooks.
 */
import { Scene, PerspectiveCamera } from 'three/webgpu';
import { FixedClock, Scheduler, EventBus, mulberry32, type Prng } from '@engine/core';
import { createRenderer, backendFromSearch, type RendererBundle } from '@engine/render/backend';
import { buildArena, type ArenaData } from '@engine/render/arena';
import { createLighting, type LightRig } from '@engine/render/lighting';
import { createRain, type Rain } from '@engine/render/rain';
import { QualityScaler } from '@engine/render/scaler';
import { resolveQuality, type QualityPreset } from '@engine/render/quality';
import { readRenderInfo, type RenderFrameInfo } from '@engine/render/telemetryHooks';
import { FreeFly } from '@engine/input/freeFly';
import { KeyboardMouseInput, emptySnapshot, type InputSource, type InputSnapshot } from '@engine/input/input';
import { Dummy } from '@game/actors/dummy';
import { Telemetry, type FrameSample } from '@qa/telemetry';

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
  readonly telemetry = new Telemetry(8192);
  prng: Prng;
  seed: number;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(90, 1, 0.05, 400);
  bundle!: RendererBundle;
  arena!: ArenaData;
  lights!: LightRig;
  rain!: Rain;
  dummies: Dummy[] = [];
  quality!: QualityPreset;
  readonly scaler = new QualityScaler();
  freeFly: FreeFly | null = null;
  /** nguồn input hiện tại (bàn phím hoặc replay); bench hoán đổi rồi trả về defaultInput */
  input: InputSource;
  readonly defaultInput: KeyboardMouseInput;
  readonly inputState: InputSnapshot = emptySnapshot();
  readonly renderInfo: RenderFrameInfo = { calls: 0, triangles: 0, gpuMs: null, heapMB: null, renderWidth: 0, renderHeight: 0 };
  /** AI cập nhật (TIP-007); telemetry đọc */
  readonly actorStats = { full: 0, total: 0 };
  frames = 0;
  running = false;
  ready = false;
  lastFrameMs = 0;
  private lastT = 0;
  private raf = 0;
  private readonly sample: FrameSample = { frameMs: 0, cpuSimMs: 0, cpuRenderMs: 0, gpuMs: null, calls: 0, tris: 0, actorsFull: 0, actorsTotal: 0, heapMB: null, scale: 1, renderWidth: 0 };
  /** hook mỗi frame (overlay) */
  onFrame: ((game: Game, frameMs: number) => void) | null = null;
  /** TIP-005+: player điều khiển camera ở render(alpha); null → free-fly ở sim */
  cameraDriver: ((alpha: number, dt: number) => void) | null = null;
  readonly params: URLSearchParams;
  readonly resetHooks: Array<(seed: number) => void> = [];
  private pendingTimestamp = false;

  constructor(readonly opts: GameOptions) {
    this.params = new URLSearchParams(opts.search);
    this.seed = opts.seed ?? Number(this.params.get('seed') ?? 7);
    this.prng = mulberry32(this.seed);
    this.defaultInput = new KeyboardMouseInput(opts.canvas);
    this.input = this.defaultInput;
  }

  async init(): Promise<void> {
    const override = backendFromSearch(this.opts.search);
    this.quality = resolveQuality(this.params);
    this.scaler.enabled = this.quality.dynamicResolution;
    this.bundle = await createRenderer({
      canvas: this.opts.canvas,
      forceWebGL: override === 'webgl',
      onDeviceLost: (info) => this.events.emit('RENDER_DEVICE_LOST', info),
    });
    this.bundle.renderer.shadowMap.enabled = this.quality.shadows;
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.lights = createLighting(this.scene, this.quality.shadowMapSize);
    this.arena = buildArena(this.scene, this.seed);
    this.rain = createRain(Math.max(1, this.quality.rainCount));
    this.rain.mesh.visible = this.quality.rainCount > 0;
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

    this.defaultInput.attach();
    this.opts.canvas.addEventListener('click', () => {
      if (document.pointerLockElement !== this.opts.canvas) {
        const p = this.opts.canvas.requestPointerLock as (o?: { unadjustedMovement: boolean }) => Promise<void> | undefined;
        try {
          const r = p.call(this.opts.canvas, { unadjustedMovement: true });
          if (r && typeof r.catch === 'function') r.catch(() => this.opts.canvas.requestPointerLock());
        } catch {
          this.opts.canvas.requestPointerLock();
        }
      }
    });

    if (this.params.get('freefly') === '1' || this.cameraDriver === null) {
      this.freeFly = new FreeFly(this.camera);
      this.freeFly.yaw = 0; // spawn z=+40, nhìn −z về tâm arena
    }
    this.scheduler.add('sim60', (tick, dt) => this.simStep(tick, dt));
    this.scheduler.add('render', (alpha, dt) => this.renderStep(alpha, dt));
    this.actorStats.total = this.dummies.length;
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
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality.maxPixelRatio) * this.scaler.scale;
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

  /** Một frame: sim fixed-step → render nội suy → telemetry. Không mutate physics trong render. */
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
    const s = this.sample;
    s.frameMs = dt * 1000; // frame time thật (khoảng cách rAF), không phải chỉ CPU
    s.cpuSimMs = this.scheduler.frameSimMs;
    s.cpuRenderMs = this.scheduler.lastCostMs.render;
    s.gpuMs = this.renderInfo.gpuMs;
    s.calls = this.renderInfo.calls;
    s.tris = this.renderInfo.triangles;
    s.actorsFull = this.actorStats.full;
    s.actorsTotal = this.actorStats.total;
    s.heapMB = this.renderInfo.heapMB;
    s.scale = this.scaler.scale;
    s.renderWidth = this.renderInfo.renderWidth;
    if (this.frames > 1) this.telemetry.sample(s);
    this.onFrame?.(this, frameMs);
  }

  private simStep(tick: number, dt: number): void {
    this.input.snapshot(tick, this.inputState);
    if (!this.cameraDriver && this.freeFly) this.freeFly.step(this.inputState, dt);
  }

  private renderStep(alpha: number, dt: number): void {
    if (this.cameraDriver) this.cameraDriver(alpha, dt);
    const t = this.clock.simTime + alpha * this.clock.step;
    for (let i = 0; i < this.dummies.length; i++) this.dummies[i]!.setPose(t);
    this.lights.followTarget(this.camera);
    this.bundle.renderer.render(this.scene, this.camera);
    readRenderInfo(this.bundle.renderer, this.renderInfo);
    if (!this.pendingTimestamp) {
      this.pendingTimestamp = true;
      void this.bundle.renderer
        .resolveTimestampsAsync('render')
        .catch(() => undefined)
        .finally(() => {
          this.pendingTimestamp = false;
        });
    }
  }

  /** Đưa toàn bộ về trạng thái đầu (bench/test). Các TIP sau mở rộng qua resetHooks. */
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
