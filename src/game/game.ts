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
import { loadAssets, type LoadedAssets } from '@engine/render/assets';
import { createPostStack, type PostStack } from '@engine/render/post';
import { t } from '@ui/i18n';
import { FreeFly } from '@engine/input/freeFly';
import { KeyboardMouseInput, emptySnapshot, type InputSource, type InputSnapshot } from '@engine/input/input';
import { createActorVisual, type ActorVisual } from '@game/actors/visual';
import { Telemetry, type FrameSample } from '@qa/telemetry';
import { initPhysics, PhysicsWorld } from '@engine/physics/world';
import { createPointerLock, type PointerLockController } from '@engine/input/pointerLock';
import { Player } from '@game/player/player';
import { SettingsStore, pickStore } from '@game/player/settings';
import { Hud } from '@ui/hud';
import { Weapon, type WeaponEvents, type ShooterContext } from '@game/weapons/weapon';
import { WeaponFx } from '@game/weapons/fx';
import { WeaponViewModel } from '@game/weapons/viewmodel';
import { AudioEngine } from '@engine/audio/audio';
import { attachActorBody, type ActorBody } from '@game/actors/actorPhysics';
import { Vector3 } from 'three/webgpu';
import { initNav, NavService } from '@engine/nav/navmesh';
import { getPositionsAndIndices, NavMeshHelper } from '@recast-navigation/three';
import { BotActor } from '@game/actors/botActor';
import type { BotEvents } from '@game/ai/bot';
import { MissionHost } from '@game/mission/missionHost';
import type { MissionEvents } from '@game/mission/types';

export interface GameEvents extends WeaponEvents, BotEvents, MissionEvents {
  RENDER_DEVICE_LOST: { api: string; message: string; reason: string | null };
  GAME_RESET: { seed: number };
  ACTOR_DIED: { actorId: string; group: string };
  [k: string]: unknown;
}

export interface ActorEntry {
  id: string;
  group: string;
  dummy: ActorVisual;
  body: ActorBody;
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
  readonly telemetry = new Telemetry(16384);
  prng: Prng;
  seed: number;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(90, 1, 0.05, 400);
  bundle!: RendererBundle;
  arena!: ArenaData;
  lights!: LightRig;
  rain!: Rain;
  assets: LoadedAssets | null = null;
  post!: PostStack;
  dummies: ActorVisual[] = [];
  quality!: QualityPreset;
  physics!: PhysicsWorld;
  player!: Player;
  settings!: SettingsStore;
  pointerLock!: PointerLockController;
  hud!: Hud;
  weapon!: Weapon;
  fx!: WeaponFx;
  viewModel!: WeaponViewModel;
  private lastInputDx = 0;
  private lastInputDy = 0;
  readonly audio = new AudioEngine();
  /** actor registry: dummies (TIP-006) + bots (TIP-007) */
  readonly actors = new Map<string, ActorEntry>();
  nav!: NavService;
  navHelper: NavMeshHelper | null = null;
  readonly bots = new Map<string, BotActor>();
  private readonly targetInfo = { pos: [0, 0, 0] as [number, number, number], eye: [0, 0, 0] as [number, number, number], alive: true };
  private readonly camInfo = { pos: [0, 0, 0] as [number, number, number], fwd: [0, 0, -1] as [number, number, number] };
  navBuildMs = 0;
  mission!: MissionHost;
  private prevInteract = false;
  private readonly shooter: ShooterContext = { origin: [0, 0, 0], aim: [0, 0, -1], stance: 'stand', moving: false, grounded: true, exclude: undefined };
  private readonly v3 = new Vector3();
  private readonly v3b = new Vector3();
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

    // Asset CC0 (TIP-011/ADR-005): texture PBR luôn; model + HDRI trừ khi ?assets=0 (lite)
    this.assets = await loadAssets({ renderer: this.bundle.renderer, lite: !this.quality.assets, noCharacter: !this.quality.character });
    this.arena = buildArena(this.scene, this.seed, { assets: this.assets, signText: t('sign.port') });
    this.lights = createLighting(this.scene, {
      shadowMapSize: this.quality.shadowMapSize,
      environment: this.assets.environment,
      lamps: this.arena.lamps,
    });
    this.lights.setCones(this.quality.lightCones);
    this.rain = createRain(Math.max(1, this.quality.rainCount), 70, 24, this.lights.lampArray, Math.max(1, this.quality.splashCount));
    this.rain.mesh.visible = this.quality.rainCount > 0;
    this.rain.splash.visible = this.quality.rainCount > 0 && this.quality.splashCount > 0;
    this.scene.add(this.rain.mesh, this.rain.splash);
    this.post = createPostStack(this.bundle.renderer, this.scene, this.camera, { tier: this.quality.post, backend: this.bundle.backend, taa: this.quality.taa });
    for (let i = 0; i < this.arena.dummySpawns.length; i++) {
      const d = createActorVisual(this.quality.character ? this.assets.character : null, { phase: i * 0.9, color: 0x4a5246, visor: 0x2ad4ff });
      const p = this.arena.dummySpawns[i]!;
      d.group.position.set(p[0], p[1], p[2]);
      d.group.rotation.y = Math.atan2(-p[0], -p[2]);
      this.scene.add(d.group);
      this.dummies.push(d);
    }
    const ps = this.arena.playerSpawn;
    this.camera.position.set(ps[0], 1.7, ps[2]);

    // Physics từ ArenaData (nguồn collider duy nhất)
    await initPhysics();
    this.physics = new PhysicsWorld();
    for (const c of this.arena.colliders) this.physics.addStatic({ kind: c.kind, position: c.position, size: c.size, yaw: c.yaw }, { id: c.id, kind: 'world', material: c.material });

    // Settings (IndexedDB) → player
    this.settings = new SettingsStore(await pickStore());
    await this.settings.load();
    this.player = new Player(this.physics, ps, 0);
    this.settings.onChange((s) => {
      this.player.applySettings(s);
      this.defaultInput.adsHold = s.adsHold;
      if (this.pointerLock) this.pointerLock.rawInput = s.rawInput;
    });
    this.hud = new Hud();

    // Actor bodies cho dummies (bia hitscan) + registry
    this.dummies.forEach((d, i) => {
      const id = `dummy_${i}`;
      const p = this.arena.dummySpawns[i]!;
      const body = attachActorBody(this.physics, id, p);
      this.actors.set(id, { id, group: 'dummies', dummy: d, body });
    });

    // Weapon + FX + audio (weapons phát event; fx/audio lắng nghe — PRD §3.2)
    this.weapon = new Weapon('ar_v1', this.physics, this.events as unknown as EventBus<WeaponEvents>, this.prng);
    this.weapon.onViewKick = (y, p) => this.player.rig.kick(p, y);
    this.shooter.exclude = this.player.controller.collider;
    this.fx = new WeaponFx(this.scene, this.camera, this.events as unknown as EventBus<WeaponEvents>, this.prng.fork('fx'));
    this.viewModel = new WeaponViewModel(this.camera, { steel: this.assets.textures['metal_plate'] ?? null });
    this.scene.add(this.camera); // camera phải nằm trong scene để viewmodel (con của camera) được render
    this.fx.muzzleWorld = this.viewModel.muzzleWorld;
    this.fx.ejectWorld = this.viewModel.ejectWorld;
    this.events.on('WEAPON_FIRED', () => this.viewModel.onShot());
    this.events.on('RELOAD_START', () => this.viewModel.onReload(this.weapon.def.reloadMs));
    this.events.on('HIT', (e) => {
      this.audio.impact('flesh', e.point);
      if (e.actorId === 'player') {
        const dead = this.player.damage(e.damage);
        if (dead) this.events.emit('ACTOR_DIED', { actorId: 'player', group: 'player' });
        return;
      }
      const b = this.bots.get(e.actorId);
      if (b) {
        this.player.eyePosition(this.v3);
        const died = b.applyDamage(e.damage, [this.v3.x, this.v3.y, this.v3.z]);
        if (died) this.events.emit('ACTOR_DIED', { actorId: b.id, group: b.group });
        return;
      }
      const a = this.actors.get(e.actorId);
      if (!a) return;
      const died = a.dummy.applyDamage(e.damage);
      if (died) {
        a.body.setEnabled(false);
        this.events.emit('ACTOR_DIED', { actorId: a.id, group: a.group });
      }
    });
    this.events.on('BOT_FIRED', (e) => {
      this.audio.gunshotAt(e.origin);
      this.bots.get(e.botId)?.dummy.onFire();
    });

    // Navmesh runtime từ ArenaData.navGeometry (ADR-003) + 1 bot tuần tra
    await initNav();
    const [navPos, navIdx] = getPositionsAndIndices(this.arena.navGeometry);
    this.nav = new NavService(navPos, navIdx);
    this.navBuildMs = this.nav.buildMs;
    this.navHelper = new NavMeshHelper(this.nav.navMesh);
    this.navHelper.visible = false;
    this.scene.add(this.navHelper);
    window.addEventListener('keydown', (ev) => {
      if (ev.code === 'F4' && this.navHelper) this.navHelper.visible = !this.navHelper.visible;
    });
    this.spawnBot('bot_a', 'ambient', this.arena.botSpawns['bot_a']!);
    this.scheduler.add('ai10', (_tick, dtAi) => {
      let full = 0;
      let alive = 0;
      for (const b of this.bots.values()) {
        b.bot.think(dtAi);
        if (b.bot.alive) {
          alive++;
          if (b.bot.lod === 'FULL') full++;
        }
      }
      this.actorStats.full = full;
      let dummiesAlive = 0;
      for (const a of this.actors.values()) if (a.dummy.alive) dummiesAlive++;
      this.actorStats.total = alive + dummiesAlive;
    });
    this.events.on('IMPACT', (e) => this.audio.impact(e.material, e.point));
    this.events.on('WEAPON_FIRED', () => this.audio.gunshot());
    this.events.on('RELOAD_START', () => this.audio.reload());
    const initAudio = (): void => {
      this.audio.init();
    };
    window.addEventListener('pointerdown', initAudio, { once: true });
    window.addEventListener('keydown', initAudio, { once: true });

    this.defaultInput.attach();
    this.pointerLock = createPointerLock(this.opts.canvas, this.settings.current.rawInput);
    this.opts.canvas.addEventListener('click', () => this.pointerLock.request());

    if (this.params.get('freefly') === '1') {
      this.freeFly = new FreeFly(this.camera);
      this.freeFly.yaw = 0; // spawn z=+40, nhìn −z về tâm arena
    } else {
      this.cameraDriver = (alpha) => this.player.render(this.camera, alpha);
    }
    this.scheduler.add('sim60', (tick, dt) => this.simStep(tick, dt));
    this.scheduler.add('render', (alpha, dt) => this.renderStep(alpha, dt));
    this.actorStats.total = this.dummies.length;

    // Mission data-driven (TIP-008): validate schema → runtime → start
    this.mission = new MissionHost(this);
    this.mission.start();
    window.addEventListener('keydown', (ev) => {
      if (ev.code === 'Enter' && !this.player.alive) this.respawn();
    });
    this.ready = true;
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.applyScale(true);
  }

  /** Pixel ratio hiệu dụng = min(DPR, maxPixelRatio, maxRenderWidth / CSS width) × scale — PRD §4 "Độ phân giải". */
  effectivePixelRatio(): number {
    const cssW = Math.max(1, window.innerWidth);
    return Math.min(window.devicePixelRatio || 1, this.quality.maxPixelRatio, this.quality.maxRenderWidth / cssW) * this.scaler.scale;
  }

  private applyScale(force = false): void {
    const dpr = this.effectivePixelRatio();
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

  /** Chạy N tick sim không render (QA/E2E: nhanh, deterministic). */
  stepSim(ticks: number): void {
    for (let i = 0; i < ticks; i++) {
      this.clock.advance(this.clock.step);
      this.events.currentTick = this.clock.tick;
      this.scheduler.runSim(this.clock.tick, this.clock.step);
    }
  }

  private simStep(tick: number, dt: number): void {
    this.input.snapshot(tick, this.inputState);
    this.lastInputDx = this.inputState.dx;
    this.lastInputDy = this.inputState.dy;
    if (this.freeFly) this.freeFly.step(this.inputState, dt);
    else this.player.step(this.inputState, dt);
    // Weapon sau player (vị trí mắt mới), trước physics.step để ray thấy state tick này
    const sh = this.shooter;
    this.player.eyePosition(this.v3);
    sh.origin[0] = this.v3.x;
    sh.origin[1] = this.v3.y;
    sh.origin[2] = this.v3.z;
    this.player.aimDirection(this.v3b, false);
    sh.aim[0] = this.v3b.x;
    sh.aim[1] = this.v3b.y;
    sh.aim[2] = this.v3b.z;
    sh.stance = this.player.controller.stance;
    sh.moving = this.player.controller.horizontalSpeed() > 0.5;
    sh.grounded = this.player.controller.grounded;
    if (this.player.alive) this.weapon.step(this.inputState, sh, dt);
    this.player.adsBlend = this.weapon.ads;
    // Bots: cập nhật target/camera info rồi move theo path
    const ti = this.targetInfo;
    ti.pos[0] = this.player.controller.feet[0];
    ti.pos[1] = this.player.controller.feet[1];
    ti.pos[2] = this.player.controller.feet[2];
    ti.eye[0] = sh.origin[0];
    ti.eye[1] = sh.origin[1];
    ti.eye[2] = sh.origin[2];
    ti.alive = this.player.alive;
    this.camInfo.pos[0] = sh.origin[0];
    this.camInfo.pos[1] = sh.origin[1];
    this.camInfo.pos[2] = sh.origin[2];
    this.camInfo.fwd[0] = sh.aim[0];
    this.camInfo.fwd[1] = sh.aim[1];
    this.camInfo.fwd[2] = sh.aim[2];
    for (const b of this.bots.values()) {
      b.bot.move(dt);
      b.syncBody();
    }
    this.physics.step();
    const interactEdge = this.inputState.interact && !this.prevInteract;
    this.prevInteract = this.inputState.interact;
    this.mission.step(dt, interactEdge);
    const h = this.hud.state;
    h.health = this.player.health;
    h.dead = !this.player.alive;
    h.mag = this.weapon.sm.mag;
    h.reserve = this.weapon.sm.reserve;
    h.weaponState = this.weapon.state;
    h.spreadDeg = this.weapon.spreadDeg;
  }

  private renderStep(alpha: number, dt: number): void {
    if (this.cameraDriver) this.cameraDriver(alpha, dt);
    const t = this.clock.simTime + alpha * this.clock.step;
    for (let i = 0; i < this.dummies.length; i++) this.dummies[i]!.setPose(t);
    for (const b of this.bots.values()) b.syncVisual(t);
    // viewmodel: chỉ khi có player (không free-fly)
    this.viewModel.visible = !this.freeFly && this.player.alive;
    this.viewModel.update(dt, this.weapon.ads, this.lastInputDx, this.lastInputDy, this.player.rig.bobOffset.x, this.player.rig.bobOffset.y, this.player.controller.horizontalSpeed());
    this.lastInputDx = 0;
    this.lastInputDy = 0;
    this.hud.update();
    this.fx.update(dt);
    if (this.audio.ctx) {
      this.v3.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
      this.audio.setListener(this.camera.position.x, this.camera.position.y, this.camera.position.z, this.v3.x, this.v3.y, this.v3.z);
    }
    this.lights.followTarget(this.camera);
    this.post.render();
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

  spawnBot(id: string, group: string, spawn: [number, number, number]): BotActor {
    const existing = this.bots.get(id);
    if (existing) return existing;
    const visual = createActorVisual(this.quality.character ? this.assets?.character ?? null : null, { color: 0x5a3a35, visor: 0xff5a2a, phase: id.length });
    const b = new BotActor(id, group, spawn, this.scene, this.physics, visual, {
      physics: this.physics,
      nav: this.nav,
      events: this.events as unknown as EventBus<BotEvents>,
      prng: this.prng,
      waypoints: this.arena.waypoints,
      coverMarkers: this.arena.coverMarkers,
      target: () => this.targetInfo,
      camera: () => this.camInfo,
    });
    this.bots.set(id, b);
    return b;
  }

  despawnBot(id: string): void {
    const b = this.bots.get(id);
    if (!b) return;
    b.dispose(this.scene);
    this.bots.delete(id);
  }

  /** Chết → tải checkpoint gần nhất, không có thì reset mission. */
  respawn(): void {
    if (!this.mission.load()) this.reset(this.seed);
  }

  /** Đưa toàn bộ về trạng thái đầu (bench/test). Các TIP sau mở rộng qua resetHooks. */
  reset(seed = this.seed): void {
    this.seed = seed;
    this.prng = mulberry32(seed);
    this.clock.reset();
    this.events.reset();
    this.scaler.reset();
    this.applyScale(true);
    for (const a of this.actors.values()) {
      a.dummy.reset();
      a.body.setEnabled(true);
    }
    const ps = this.arena.playerSpawn;
    this.camera.position.set(ps[0], 1.7, ps[2]);
    this.player.reset(0);
    this.weapon.reset(this.prng);
    this.fx.reset();
    this.viewModel.reset();
    for (const b of this.bots.values()) b.reset();
    this.mission.reset();
    if (this.freeFly) {
      this.freeFly.yaw = 0;
      this.freeFly.pitch = 0;
    }
    for (const h of this.resetHooks) h(seed);
    this.frames = 0;
    this.events.emit('GAME_RESET', { seed });
  }
}
