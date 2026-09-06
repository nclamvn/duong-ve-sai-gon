/**
 * Game — integrator: renderer + arena + loop (FixedClock → Scheduler → render nội suy) + telemetry.
 * TIP-003 arena/free-fly · TIP-004 input source/telemetry/quality · TIP-005+ gắn player/weapon/ai/mission
 * qua các field public và resetHooks.
 */
import { Scene, PerspectiveCamera, HemisphereLight, DirectionalLight } from 'three/webgpu';
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
import { buildLevel, type LevelBuild } from '@engine/level/builder';
import { createDaylight } from '@engine/level/daylight';
import type { LevelDef } from '@engine/level/types';
import phoLevelJson from '@content/levels/pho-van-hai.level.json';
import truongSonLevelJson from '@content/levels/truong-son-a.level.json';
import { loadTerrainLevel, type TerrainLevelDef, type TerrainLevelBuild } from '@engine/terrain';
import { buildForest, VEG_QUALITY, type ForestBuild } from '@engine/vegetation';
import { t } from '@ui/i18n';
import { FreeFly } from '@engine/input/freeFly';
import { KeyboardMouseInput, emptySnapshot, type InputSource, type InputSnapshot } from '@engine/input/input';
import { createActorVisual, type ActorVisual } from '@game/actors/visual';
import { FpArms } from '@engine/render/fpArms';
import type { WeaponModelConfig } from '@engine/render/weaponModel';
import ak74mCfg from '@content/weapons/ak74m.json';
import ak47Cfg from '@content/weapons/ak47.json';
import hk416Cfg from '@content/weapons/hk416.json';
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
import { SquadCoordinator } from '@game/ai/squad';
import aiTuning from '@content/tuning/ai.json';
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
  /** lớp viewmodel (TIP-017b): scene + camera FOV hẹp riêng, đè lên cảnh (không méo hình như ép scale) */
  readonly vmScene = new Scene();
  readonly vmCamera = new PerspectiveCamera(60, 1, 0.03, 12);
  private readonly fxMuzzle = new Vector3();
  private readonly fxEject = new Vector3();
  bundle!: RendererBundle;
  arena!: ArenaData;
  /** level dữ liệu (TIP-019) — null khi chạy arena G0 */
  level: LevelBuild | null = null;
  /** 'arena' (bench/E2E G0, mặc định G0′ — content Hải Tuyến chỉ là test) | 'pho' (Phố Vạn Hải, test đô thị, `?level=pho`) | 'truong-son' (terrain DEM, TIP-D04) */
  levelId: 'pho' | 'arena' | 'truong-son' = 'arena';
  /** level terrain (TIP-D04) — null khi không phải ?level=truong-son */
  terrain: TerrainLevelBuild | null = null;
  /** rừng loài thật (TIP-D05) — null khi level không có `vegetation`, `?veg=0`, hoặc lite (`assets=0`) không kèm `?veg=1` */
  forest: ForestBuild | null = null;
  /** súng người chơi (TIP-D10): mặc định AK-47 1971; `?weapon=ak74m` giữ khẩu HT-MB để so sánh/calib cũ */
  playerWeaponId = 'ak47';
  /** súng của bot/dummy: HK416 (fixture HT-MB) — `?botWeapon=ak47` để calib tay theo khẩu người chơi (?calib=soldier) hoặc lính QGP cầm AK (D11) */
  botWeaponId = 'hk416';
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
  fpArms: FpArms | null = null;
  fpArmsCfg: NonNullable<WeaponModelConfig['fp']> | null = null;
  /** debug/calib (TIP-017): khoá AI (không think/move), ẩn viewmodel, ép pose FP */
  aiPaused = false;
  viewModelHidden = false;
  fpOverride: { ads: number; sprint: boolean } | null = null;
  private lastInputDx = 0;
  private lastInputDy = 0;
  readonly audio = new AudioEngine();
  /** actor registry: dummies (TIP-006) + bots (TIP-007) */
  readonly actors = new Map<string, ActorEntry>();
  nav!: NavService;
  navHelper: NavMeshHelper | null = null;
  readonly bots = new Map<string, BotActor>();
  /** tổ địch (TIP-018): ép sườn */
  squad: SquadCoordinator | null = null;
  private footstepMs = 0;
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

    // Level (TIP-019/ADR-007): mặc định Phố Vạn Hải ban ngày; bench/E2E dùng ?level=arena (G0 đêm cảng)
    const levelParam = this.params.get('level');
    this.levelId = levelParam === 'arena' || levelParam === 'pho' || levelParam === 'truong-son' ? levelParam : 'arena';
    const weaponParam = this.params.get('weapon');
    this.playerWeaponId = weaponParam === 'ak74m' || weaponParam === 'ak47' ? weaponParam : 'ak47';
    const botWeaponParam = this.params.get('botWeapon');
    this.botWeaponId = botWeaponParam === 'ak47' || botWeaponParam === 'ak74m' || botWeaponParam === 'hk416' ? botWeaponParam : 'hk416';
    const levelDef = this.levelId === 'pho' ? (phoLevelJson as unknown as LevelDef) : null;
    const terrainDef = this.levelId === 'truong-son' ? (truongSonLevelJson as unknown as TerrainLevelDef) : null;
    const skyDef = levelDef?.sky ?? terrainDef?.sky ?? null;
    if (terrainDef) {
      this.camera.near = terrainDef.camera.near;
      this.camera.far = terrainDef.camera.far;
      this.camera.updateProjectionMatrix();
    }
    // Asset CC0 (TIP-011/ADR-005): texture PBR luôn; model + HDRI trừ khi ?assets=0 (lite)
    this.assets = await loadAssets({
      renderer: this.bundle.renderer,
      lite: !this.quality.assets,
      noCharacter: !this.quality.character,
      noWeapons: !this.quality.weapons,
      weapons: [ak47Cfg as unknown as WeaponModelConfig, ak74mCfg as unknown as WeaponModelConfig, hk416Cfg as unknown as WeaponModelConfig],
      textureIds: levelDef?.textures ?? terrainDef?.textures,
      modelIds: levelDef?.models ?? terrainDef?.models,
      hdri: skyDef ? { id: skyDef.hdri, res: skyDef.res } : undefined,
      keepSky: !!skyDef,
    });
    if (terrainDef && skyDef) {
      // Terrain DEM (TIP-D04): ArenaData từ ô heightmap; ánh sáng ban ngày như level JSON
      this.terrain = await loadTerrainLevel(this.scene, terrainDef, { assets: this.assets, baseUrl: import.meta.env.BASE_URL ?? '/' });
      this.arena = this.terrain;
      // Rừng loài thật (TIP-D05): mặc định bật khi có model (assets); lite (CI) chỉ khi ?veg=1
      const vegParam = this.params.get('veg');
      if (terrainDef.vegetation && vegParam !== '0' && (this.quality.assets || vegParam === '1')) {
        const vq = { ...VEG_QUALITY[this.quality.tier] };
        const vd = this.params.get('vegDensity');
        const vl = this.params.get('vegLod');
        if (vd !== null) vq.density = Math.max(0, Number(vd));
        if (vl !== null) vq.lodScale = Math.max(0.1, Number(vl));
        if (this.params.get('vegShadow') === '0' || !this.quality.shadows) vq.shadows = false;
        this.forest = await buildForest(this.bundle.renderer, this.terrain.tile, terrainDef.vegetation, {
          baseUrl: import.meta.env.BASE_URL ?? '/',
          quality: vq,
          noImpostor: this.params.get('impostor') === '0',
        });
        this.terrain.root.add(this.forest.system.group);
        // collider thân cây vào ArenaData (nguồn collider duy nhất → physics.addStatic bên dưới)
        for (const c of this.forest.system.colliders) this.arena.colliders.push(c);
      }
      this.lights = createDaylight(this.scene, skyDef, {
        environment: this.assets.environment,
        sky: this.assets.sky,
        shadowMapSize: this.quality.shadowMapSize,
        csm: this.quality.shadows && this.params.get('csm') !== '0',
      });
      if (this.params.get('rain') === null) this.quality.rainCount = 0;
    } else if (levelDef) {
      this.level = buildLevel(this.scene, levelDef, { assets: this.assets, maxFxLights: this.quality.tier === 'low' ? 4 : 6 });
      this.arena = this.level;
      this.lights = createDaylight(this.scene, levelDef.sky, {
        environment: this.assets.environment,
        sky: this.assets.sky,
        shadowMapSize: this.quality.shadowMapSize,
        csm: this.quality.shadows && this.params.get('csm') !== '0',
      });
      if (this.params.get('rain') === null) this.quality.rainCount = 0; // bão đã qua
    } else {
      this.arena = buildArena(this.scene, this.seed, { assets: this.assets, signText: t('sign.port') });
      this.lights = createLighting(this.scene, {
        shadowMapSize: this.quality.shadowMapSize,
        environment: this.assets.environment,
        lamps: this.arena.lamps,
      });
    }
    this.lights.setCones(this.quality.lightCones);
    this.rain = createRain(Math.max(1, this.quality.rainCount), 70, 24, this.lights.lampArray, Math.max(1, this.quality.splashCount));
    this.rain.mesh.visible = this.quality.rainCount > 0;
    this.rain.splash.visible = this.quality.rainCount > 0 && this.quality.splashCount > 0;
    this.scene.add(this.rain.mesh, this.rain.splash);
    this.vmScene.add(this.vmCamera);
    this.vmScene.environment = this.scene.environment;
    this.vmScene.environmentIntensity = this.scene.environmentIntensity;
    if (skyDef) {
      const sky = skyDef;
      const sunVm = new DirectionalLight(sky.sun.color, sky.sun.intensity);
      const d = (this.lights as { sunDir?: [number, number, number] }).sunDir ?? [0.5, 0.7, 0.5];
      sunVm.position.set(d[0] * 20, d[1] * 20, d[2] * 20);
      this.vmScene.add(sunVm, sunVm.target);
      this.vmScene.add(new HemisphereLight(sky.hemi.sky, sky.hemi.ground, sky.hemi.intensity));
    } else this.vmScene.add(new HemisphereLight(0xdfe8ff, 0x3a3630, 0.35)); // nền cho súng/tay khi đèn cảnh không vào lớp riêng
    this.post = createPostStack(this.bundle.renderer, this.scene, this.camera, { tier: this.quality.post, backend: this.bundle.backend, taa: this.quality.taa, overlay: { scene: this.vmScene, camera: this.vmCamera } });
    for (let i = 0; i < this.arena.dummySpawns.length; i++) {
      const d = createActorVisual(this.quality.character ? this.assets.character : null, { phase: i * 0.9, color: 0x4a5246, visor: 0x2ad4ff, gear: 'pavn1971' }, this.assets.weapons[this.botWeaponId] ?? null);
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
    for (const c of this.arena.colliders) this.physics.addStatic({ kind: c.kind, position: c.position, size: c.size, yaw: c.yaw, heights: c.heights, n: c.n }, { id: c.id, kind: 'world', material: c.material });

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
    // tuning theo khẩu người chơi (TIP-D10): ak47 → content/tuning/weapons.json#ak47; khẩu HT-MB (ak74m) giữ ar_v1
    this.weapon = new Weapon(this.playerWeaponId === 'ak47' ? 'ak47' : 'ar_v1', this.physics, this.events as unknown as EventBus<WeaponEvents>, this.prng);
    this.weapon.onViewKick = (y, p) => this.player.rig.kick(p, y);
    this.shooter.exclude = this.player.controller.collider;
    this.fx = new WeaponFx(this.scene, this.camera, this.events as unknown as EventBus<WeaponEvents>, this.prng.fork('fx'));
    this.viewModel = new WeaponViewModel(this.vmCamera, { steel: this.assets.textures['metal_plate'] ?? null }, this.assets.weapons[this.playerWeaponId] ?? null);
    // cánh tay FP (TIP-016): mesh tay Mixamo + IK bám anchor súng; cần viewmodel glTF (anchor) + soldier_arms.glb
    const ak = this.assets.weapons[this.playerWeaponId];
    if (this.quality.arms && this.assets.arms && ak?.cfg.fp && this.viewModel.fpAnchors) {
      this.fpArms = new FpArms(this.assets.arms, this.viewModel.space); // kích thước thật, camera viewmodel riêng
      this.fpArmsCfg = ak.cfg.fp;
      this.viewModel.setGlovesVisible(false);
    }
    this.scene.add(this.camera); // camera phải nằm trong scene để viewmodel (con của camera) được render
    this.fx.muzzleWorld = this.fxMuzzle; // vị trí đầu nòng chiếu về camera chính (FX ở scene chính)
    this.fx.ejectWorld = this.fxEject;
    this.fx.botMuzzle = (id, out) => this.bots.get(id)?.dummy.muzzleWorld(out) ?? false;
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
    if (this.terrain?.navPrebuilt) {
      this.nav = NavService.fromExport(this.terrain.navPrebuilt);
      if (this.nav.polyCount === 0) {
        console.warn('[nav] nav.bin invalid (0 poly) -> runtime bake');
        this.nav.dispose();
        this.terrain.navPrebuilt = null;
      }
    }
    if (!this.terrain?.navPrebuilt) {
      const [navPos, navIdx] = getPositionsAndIndices(this.arena.navGeometry);
      this.nav = new NavService(navPos, navIdx, this.terrain ? { cs: 0.5, ch: 0.25 } : {});
    }
    this.navBuildMs = this.nav.buildMs;
    this.navHelper = new NavMeshHelper(this.nav.navMesh);
    this.navHelper.visible = false;
    this.scene.add(this.navHelper);
    window.addEventListener('keydown', (ev) => {
      if (ev.code === 'F4' && this.navHelper) this.navHelper.visible = !this.navHelper.visible;
    });
    this.squad = new SquadCoordinator(this.arena.coverMarkers);
    this.spawnBot('bot_a', 'ambient', this.arena.botSpawns['bot_a']!);
    this.scheduler.add('ai10', (_tick, dtAi) => {
      let full = 0;
      let alive = 0;
      for (const b of this.bots.values()) {
        if (!this.aiPaused) b.bot.think(dtAi);
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
    this.events.on('WEAPON_FIRED', (e) => this.audio.gunshot(e.weapon));
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
    this.vmCamera.aspect = w / h;
    this.vmCamera.updateProjectionMatrix();
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
    // Frame pacing (D-053): màn 120 Hz + frame ~9–10 ms → xen kẽ 8.3/16.7 ms (giật). Cap 60 → mỗi frame đúng 16.7 ms.
    // Bench (?bench=1) và ?fps=0 không cap để đo thật; ?fps=N đặt cap khác.
    const cap = this.quality.fpsCap;
    const minFrameMs = cap > 0 ? 1000 / cap - 1.0 : 0;
    const loop = (now: number): void => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      if (minFrameMs > 0 && now - this.lastT < minFrameMs) return;
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
    // tiếng chân khi chạy nước rút (TIP-018): bot nghe trong ~9 m
    if (this.player.alive && this.player.isSprinting && this.player.controller.grounded && this.player.controller.horizontalSpeed() > 3.5) {
      this.footstepMs += dt * 1000;
      if (this.footstepMs >= aiTuning.hearing.footstepIntervalMs) {
        this.footstepMs = 0;
        this.events.emit('PLAYER_FOOTSTEP', { origin: [ti.pos[0], ti.pos[1], ti.pos[2]] });
      }
    } else this.footstepMs = 0;
    for (const b of this.bots.values()) {
      if (!this.aiPaused) b.bot.move(dt);
      b.syncBody();
    }
    if (this.squad && !this.aiPaused) this.squad.tick(this.bots.values(), dt, ti.pos);
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
    this.viewModel.visible = !this.freeFly && this.player.alive && !this.viewModelHidden;
    // camera viewmodel bám camera chính; FOV = 2·atan(k·tan(fov/2)) với k = view.scale (0.62 → 64° khi fov 90)
    this.camera.updateMatrixWorld(true);
    this.vmCamera.position.copy(this.camera.position);
    this.vmCamera.quaternion.copy(this.camera.quaternion);
    const k = this.viewModelScale;
    const vmFov = (2 * Math.atan(k * Math.tan((this.camera.fov * Math.PI) / 360)) * 180) / Math.PI;
    if (Math.abs(this.vmCamera.fov - vmFov) > 0.01) {
      this.vmCamera.fov = vmFov;
      this.vmCamera.updateProjectionMatrix();
    }
    this.vmCamera.updateMatrixWorld(true);
    const fo = this.fpOverride;
    this.viewModel.update(dt, fo ? fo.ads : this.weapon.ads, this.lastInputDx, this.lastInputDy, this.player.rig.bobOffset.x, this.player.rig.bobOffset.y, this.player.controller.horizontalSpeed(), fo ? fo.sprint : this.player.isSprinting);
    if (this.fpArms) this.fpArms.visible = this.viewModel.visible;
    if (this.fpArms && this.fpArmsCfg && this.viewModel.fpAnchors && this.viewModel.visible) {
      this.fpArms.update({ gripR: this.viewModel.fpAnchors.gripR, gripL: this.viewModel.fpAnchors.gripL, handR: this.fpArmsCfg.handR, handL: this.fpArmsCfg.handL, triggerFinger: this.fpArmsCfg.triggerFinger });
    }
    // FX (tracer, lửa nòng, vỏ đạn) nằm ở scene chính: chiếu điểm nòng/cửa thoát từ camera viewmodel sang camera chính (cùng vị trí màn hình)
    this.vmToMain(this.viewModel.muzzleWorld, this.fxMuzzle);
    this.vmToMain(this.viewModel.ejectWorld, this.fxEject);
    this.lastInputDx = 0;
    this.lastInputDy = 0;
    this.hud.update();
    this.fx.update(dt);
    if (this.level) this.level.fx.update(dt);
    if (this.audio.ctx) {
      this.v3.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
      this.audio.setListener(this.camera.position.x, this.camera.position.y, this.camera.position.z, this.v3.x, this.v3.y, this.v3.z);
    }
    this.lights.followTarget(this.camera);
    if (this.terrain) this.terrain.mesh.update(this.camera);
    if (this.forest) this.forest.system.update(this.camera);
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

  /** k = view.scale của súng (FOV viewmodel); procedural = 0.62 */
  private get viewModelScale(): number {
    return this.assets?.weapons[this.playerWeaponId]?.cfg.view.scale ?? 0.62;
  }

  /**
   * Điểm world trong lớp viewmodel → điểm world ở scene chính có cùng vị trí màn hình và cùng độ sâu (camera chính).
   * (hai camera cùng vị trí/hướng, khác FOV → chỉ x/y view-space đổi theo tỉ lệ tan)
   */
  private vmToMain(src: Vector3, out: Vector3): void {
    out.copy(src).applyMatrix4(this.vmCamera.matrixWorldInverse);
    const tv = Math.tan((this.vmCamera.fov * Math.PI) / 360);
    const tm = Math.tan((this.camera.fov * Math.PI) / 360);
    const r = tm / tv; // > 1 khi FOV viewmodel hẹp hơn: cùng NDC → x/y view-space của camera chính lớn hơn
    out.x *= r;
    out.y *= r;
    out.applyMatrix4(this.camera.matrixWorld);
  }

  spawnBot(id: string, group: string, spawn: [number, number, number]): BotActor {
    const existing = this.bots.get(id);
    if (existing) return existing;
    const visual = createActorVisual(this.quality.character ? this.assets?.character ?? null : null, { color: 0x5a3a35, visor: 0xff5a2a, phase: id.length, gear: 'pavn1971' }, this.assets?.weapons[this.botWeaponId] ?? null);
    const b = new BotActor(id, group, spawn, this.scene, this.physics, visual, {
      physics: this.physics,
      nav: this.nav,
      events: this.events as unknown as EventBus<BotEvents>,
      prng: this.prng,
      waypoints: this.arena.waypoints,
      coverMarkers: this.arena.coverMarkers,
      target: () => this.targetInfo,
      camera: () => this.camInfo,
      groundHeight: this.terrain ? (x, z) => this.terrain!.heightAt(x, z) : undefined,
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
