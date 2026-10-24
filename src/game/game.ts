/**
 * Game — integrator: renderer + arena + loop (FixedClock → Scheduler → render nội suy) + telemetry.
 * TIP-003 arena/free-fly · TIP-004 input source/telemetry/quality · TIP-005+ gắn player/weapon/ai/mission
 * qua các field public và resetHooks.
 */
import { Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, BufferGeometry, BufferAttribute, Mesh, Color, PointLight } from 'three/webgpu';
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
import { Flares } from '@engine/render/flares';
import { buildLevel, type LevelBuild } from '@engine/level/builder';
import { createDaylight } from '@engine/level/daylight';
import type { LevelDef } from '@engine/level/types';
import phoLevelJson from '@content/levels/pho-van-hai.level.json';
import truongSonLevelJson from '@content/levels/truong-son-a.level.json';
import diemCao31LevelJson from '@content/levels/diem-cao-31.level.json';
import ngamTaLeLevelJson from '@content/levels/ngam-ta-le.level.json';
import { loadTerrainLevel, type TerrainLevelDef, type TerrainLevelBuild } from '@engine/terrain';
import { createAtmosphere, type Atmosphere } from '@engine/render/atmosphere';
import { setSun, WEATHER } from '@engine/render/sceneLight';
import { canopyMap } from '@engine/vegetation/canopy';
import { makeHeightField } from '@engine/terrain/heightField';
import { createDustMotes, type DustMotes } from '@engine/render/dustMotes';
import { createWildlife, type Wildlife } from '@engine/render/wildlife';
import { makeSightOcclusion } from '@game/ai/sightOcclusion';
import type RAPIER from '@dimforge/rapier3d-compat';
import { buildForest, VEG_QUALITY, navObstacleMesh, navPadFor, roadClearings, type ForestBuild } from '@engine/vegetation';
import { SkyTraffic } from '@engine/sky';
import { loadModel } from '@engine/render/assets';
import { t } from '@ui/i18n';
import { FreeFly } from '@engine/input/freeFly';
import { KeyboardMouseInput, emptySnapshot, type InputSource, type InputSnapshot } from '@engine/input/input';
import { createActorVisual, type ActorVisual } from '@game/actors/visual';
import { FpArms } from '@engine/render/fpArms';
import { FpHands, type FpHandsPose } from '@engine/render/fpHands';
import type { WeaponModelConfig, WeaponAsset } from '@engine/render/weaponModel';
import ak74mCfg from '@content/weapons/ak74m.json';
import ak47Cfg from '@content/weapons/ak47.json';
import m16a1Cfg from '@content/weapons/m16a1.json';
import hk416Cfg from '@content/weapons/hk416.json';
import { Telemetry, type FrameSample } from '@qa/telemetry';
import { initPhysics, PhysicsWorld } from '@engine/physics/world';
import { createPointerLock, type PointerLockController } from '@engine/input/pointerLock';
import { Player } from '@game/player/player';
import { SettingsStore, pickStore } from '@game/player/settings';
import { Hud } from '@ui/hud';
import { bearingOf, relDeg, type CompassMarker } from '@ui/compass';
import type { Marker3DInput } from '@ui/markers';
import type { MinimapActor } from '@ui/minimap';
import { Weapon, type WeaponEvents, type ShooterContext } from '@game/weapons/weapon';
import { WeaponFx } from '@game/weapons/fx';
import { WeaponViewModel } from '@game/weapons/viewmodel';
import { AudioEngine } from '@engine/audio/audio';
import { VoiceBank, voiceKeys } from '@engine/audio/voice';
import { EnemyChatter, enemyVoiceOf, type ChatterKind } from '@game/ai/enemyChatter';
import type { CueRequest } from '@ui/subtitles';
import { attachActorBody, type ActorBody } from '@game/actors/actorPhysics';
import { Vector3 } from 'three/webgpu';
import { initNav, NavService } from '@engine/nav/navmesh';
import { getPositionsAndIndices, NavMeshHelper } from '@recast-navigation/three';
import { BotActor } from '@game/actors/botActor';
import type { Bot, BotEvents, GrenadeLink } from '@game/ai/bot';
import { GrenadeSystem, GRENADE, solveLob, type Grenade } from '@game/weapons/grenades';
import { GrenadeView } from '@game/weapons/grenadeView';
import { FireTeams, AttackTokens } from '@game/ai/squad';
import { CoverField } from '@game/ai/coverField';
import { TacticalEvaluator } from '@game/ai/tactics';
import { Squadmates } from '@game/ai/squadmates';
import { LAYER } from '@engine/physics/layers';
import type { Faction } from '@game/actors/botActor';
import aiTuning from '@content/tuning/ai.json';
import { MissionHost, missionUsesFlares } from '@game/mission/missionHost';
import { NightAct } from '@game/night/nightAct';
import { createBlastFx, type BlastFx } from '@engine/render/blastFx';
import { createScorch, type Scorch } from '@engine/render/scorch';
import { LensDirt } from '@ui/lensDirt';
import climateJson from '@content/ecology/climate.truong-son.json';
import soundscapeJson from '@content/ecology/soundscape.truong-son.json';
import { resolveClimate, parseClimatePresets, type ResolvedClimate, type LevelClimate } from '@engine/sky/climate';
import { Soundscape } from '@engine/audio/soundscape';
import { parseSoundscapeConfig, type AmbientState } from '@engine/audio/soundscapePlan';
import type { MissionEvents } from '@game/mission/types';
import { factionLook, resolvePackId, type FactionLook } from '@game/factions';
import { streamEmitters, groundSurface, type GroundSurface } from '@engine/terrain/features';

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

/** DV-070: FNV-1a of an actor id → stable look-variation seed */
function hashSeed(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** DV-091 corpse clearing (s, m): keep a body this long, shorter when many lie around; never in view nearer than farM */
/** DV-091 animation LOD (m, frames, s) */
const ANIM_LOD = { farM: 45, nearM: 8, every: 3, settledS: 4 };
const CORPSE = { keepS: 25, shortS: 8, crowd: 14, nearM: 6, farM: 70 };

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
  /** vụ nổ (DV-087) */
  blast!: BlastFx;
  /** khói chiến trường trong sương thể tích (DV-087): mức nền do kịch bản đặt + phần cộng thêm theo vụ nổ gần đây */
  private smokeBase = 0;
  private smokeTarget = 0;
  private smokeKick = 0;
  /** ngẫu nhiên tất định cho chọn câu hô (DV-087) */
  private readonly barkRng: Prng = mulberry32(0x5eed87);
  private rallyAcc = 0;
  /**
   * DV-088 choáng nổ (shell shock): mức 0..1 sau vụ nổ sát người, tắt dần ~5 s — ù tai, nhìn đôi, loạng choạng, chân nặng,
   * tim đập. `shockFlash` = chớp trắng lúc nổ rất sát.
   */
  private shock = 0;
  private shockFlash = 0;
  private shockT = 0;
  /** DV-090 xin đạn: thời gian giữ F, lúc mỗi đồng đội vừa cho, thống kê */
  private resupplyHold = 0;
  private readonly ammoGivenAt = new Map<string, number>();
  readonly resupplyStats = { count: 0 };
  /** DV-090 bùn đang bay tới kính (s), độ mạnh, phía */
  private mudPending = 0;
  private mudK = 0;
  private mudSide = 0;
  private heartAcc = 0;
  readonly shockStats = { count: 0, peak: 0, dirtKicks: 0 };
  /**
   * DV-089 chất phim chiến tranh 0..1: màu bleach-bypass, máy cầm tay, từ 0,5 thì lửa/nổ/bụi chạy nhịp 24 khung (màn trập hẹp).
   * Mặc định theo level (`post.film`), mission đổi theo hồi (`fx` kind `film`); `?film=0` tắt.
   */
  private film = 0;
  private filmTarget = 0;
  private filmDefault = 0;
  /** DV-089 thế giới lặng (hush): còn bao lâu (s), độ sâu */
  private hushLeft = 0;
  private hushDepth = 0;
  /** DV-088 vết cháy xém trên mặt đất (null khi chưa dựng) */
  scorch: Scorch | null = null;
  /** DV-088 bùn bắn lên ống kính */
  lensDirt: LensDirt | null = null;
  /** ngẫu nhiên tất định cho FX quanh người chơi (đất văng chân, DV-088) */
  private readonly fxRng: Prng = mulberry32(0xd1a7f0);
  /** đèn chớp lửa nòng trong lớp súng (DV-087) */
  private readonly vmFlash = new PointLight(0xffa04a, 0, 3, 1.2);
  readonly vmCamera = new PerspectiveCamera(60, 1, 0.03, 12);
  private readonly fxMuzzle = new Vector3();
  private readonly fxEject = new Vector3();
  bundle!: RendererBundle;
  arena!: ArenaData;
  /** level dữ liệu (TIP-019) — null khi chạy arena G0 */
  level: LevelBuild | null = null;
  /** 'truong-son' (M1 Trường Sơn — mặc định từ DV-044) | 'diem-cao-31' (M2 R1 đêm công đồn, `?level=diem-cao-31`) | 'arena' (bench/E2E G0 — content Hải Tuyến chỉ là test, `?level=arena`) | 'pho' (Phố Vạn Hải, test đô thị, `?level=pho`) */
  levelId: 'pho' | 'arena' | 'truong-son' | 'diem-cao-31' | 'ngam-ta-le' = 'truong-son';
  /** hồi đêm Ngầm Ta Lê (DV-078, `?level=ngam-ta-le`): đoàn xe + AC-130 + đại liên; null ở level khác */
  nightAct: NightAct | null = null;
  /** level terrain đang chơi (đọc nextLevel, roads…) */
  terrainLevelDef: TerrainLevelDef | null = null;
  /** DV-091 next AI slot (spreads bot thinking over the six ticks of a 10 Hz AI step) */
  private aiSlotNext = 0;
  /** DV-091 corpses removed (tests) */
  readonly corpseStats = { cleared: 0 };
  /** DV-091 soldiers ever spawned per faction (the bots map no longer keeps cleared corpses) */
  readonly spawnStats = { enemy: 0, friend: 0 };
  /** DV-091 animation LOD on (?animlod=0 off; offline cinematic renders turn it off) */
  animLod = true;
  /** level terrain (TIP-D04) — null khi không phải ?level=truong-son */
  terrain: TerrainLevelBuild | null = null;
  /** rừng loài thật (TIP-D05) — null khi level không có `vegetation`, `?veg=0`, hoặc lite (`assets=0`) không kèm `?veg=1` */
  forest: ForestBuild | null = null;
  /** máy bay ambient (TIP-D-SKY) — null khi level không có `airTraffic`, `?sky=0`, hoặc lite không kèm `?sky=1` */
  sky: SkyTraffic | null = null;
  /** gió xoáy trực thăng hiện tại 0..1 (telemetry/debug) */
  skyGust = 0;
  /** ánh sáng lớp súng/tay (DV-079): theo độ che tán tại chỗ người chơi đứng */
  private vmLight: { sun: DirectionalLight; hemi: HemisphereLight; sun0: number; hemi0: number; env0: number } | null = null;
  private vmShade = 0;
  /** phơi sáng thích nghi (DV-079) */
  exposure = 1;
  /** khí quyển (DV-079): sương theo độ cao + tán xạ nắng; null = FogExp2 cũ (`?atmo=0`) */
  atmosphere: Atmosphere | null = null;
  /** DV-083 đạo diễn áp lực */
  private playerHiddenMs = 0;
  private readonly pressure = { pos: [0, 0, 0] as [number, number, number], reloading: false, hiddenMs: 0, alive: true };
  /** DV-083 che tầm nhìn bởi tầng thấp (null = không rừng) */
  private sightOcclusion: ((from: readonly number[], to: readonly number[]) => number) | null = null;
  /** DV-081 bụi lơ lửng trong cột nắng */
  private dust: DustMotes | null = null;
  /** DV-082 chim và bướm */
  private wildlife: Wildlife | null = null;
  /** trời theo registry (DV-057): mặt trời thiên văn + preset sương/mây/mưa phùn — null khi level không khai `climate` */
  climate: ResolvedClimate | null = null;
  /** cảnh âm rừng thủ tục theo giờ/mùa/mưa (DV-057) — null khi level không có climate hoặc `?amb=0` */
  soundscape: Soundscape | null = null;
  /** đồng hồ địa phương của cảnh âm: phút từ 0h, tăng theo thời gian chơi */
  readonly amb: AmbientState = { localMin: 0, sunriseMin: 390, sunsetMin: 1063, month: 1, rain: 0, wind: 0 };
  private ambElapsedS = 0;
  private ambWindBase = 0.35;
  /** súng người chơi (TIP-D10): mặc định AK-47 1971; `?weapon=ak74m` giữ khẩu HT-MB để so sánh/calib cũ */
  playerWeaponId = 'ak47';
  /** súng của bot/dummy: HK416 (fixture HT-MB) — `?botWeapon=ak47` để calib tay theo khẩu người chơi (?calib=soldier) hoặc lính QGP cầm AK (D11) */
  /**
   * Súng bot ép qua `?botWeapon=` (calib/bench); mặc định theo phe — DV-046: phe ta AK-47 (1971), địch M16A1 khi có asset
   * (Chủ nhà Mac 2026-09-06: "đồng đội không dùng AK47, không đúng lính Việt Nam năm 7x" — trước đây mọi bot cầm HK416 của Hải Tuyến)
   */
  botWeaponId: string | null = null;
  /** DV-063 âm thanh mặt đất */
  private brooks: Array<ReturnType<AudioEngine['brook']>> = [];
  private brookTimer = 0;
  private stepAcc = 0;
  private readonly stepNormal: [number, number, number] = [0, 1, 0];
  /** mặt đất bước chân cuối (QA) */
  lastStepSurface: GroundSurface | null = null;
  /** gói phe đang dùng (DV-061, ?factions=) */
  factionPack = 'fictional';
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
  fpHands: FpHands | null = null;
  fpHandsPose: FpHandsPose | null = null;
  /** debug/calib (TIP-017): khoá AI (không think/move), ẩn viewmodel, ép pose FP */
  aiPaused = false;
  /** QA (DV-085) `?calm=1` (chỉ khi ?debug=1): dừng kịch bản ngay khi tổ đã ra, xem `calm()` */
  private calmOnStart = false;
  viewModelHidden = false;
  fpOverride: { ads: number; sprint: boolean } | null = null;
  private readonly v3c = new Vector3();
  private readonly hudCompass: CompassMarker[] = [];
  private readonly hudMarkers: Marker3DInput[] = [];
  private readonly hudMini: MinimapActor[] = [];
  private lastInputDx = 0;
  private lastInputDy = 0;
  readonly audio = new AudioEngine();
  /** giọng lồng tiếng (DV-076); ?voice=0 tắt */
  readonly voice = new VoiceBank(this.audio, `${import.meta.env.BASE_URL ?? '/'}assets/voice/`);
  private stopVoice: (() => void) | null = null;
  /** tiếng hô tiếng Anh của địch (DV-076) */
  readonly chatter = new EnemyChatter({ now: () => this.clock.simTime, play: (id, kind) => this.playChatter(id, kind) });
  /** actor registry: dummies (TIP-006) + bots (TIP-007) */
  readonly actors = new Map<string, ActorEntry>();
  nav!: NavService;
  navHelper: NavMeshHelper | null = null;
  readonly bots = new Map<string, BotActor>();
  /** tổ chiến đấu (AI-T1.4): yểm trợ/cơ động, lao xen kẽ, ép sườn, lùi */
  squad: FireTeams | null = null;
  /** vé tấn công điện ảnh (AI-T1.4) */
  readonly tokens = new AttackTokens();
  /** chỗ nấp tự sinh + chấm vị trí (AI-T1.1/T1.2), dựng sau navmesh */
  tactics: TacticalEvaluator | null = null;
  readonly coverReservations = new Map<string, string>();
  /** thời điểm (s sim) người chơi trúng đạn lần cuối (hồi máu điện ảnh) */
  private lastHurtAt = -1e9;
  /** áp chế người chơi 0..1 (DV-075): đạn địch sượt qua ≤ 2,5 m */
  playerSuppression = 0;
  private suppLastAt = -1e9;
  readonly nearMissStats = { count: 0, blocked: 0 };
  /** lựu đạn (DV-074) */
  grenades!: GrenadeSystem;
  private grenadeView: GrenadeView | null = null;
  /** lựu đạn người chơi còn mang */
  playerGrenades = GRENADE.player.count;
  private grenadeCdUntil = 0;
  private wantThrow = false;
  private lastEnemyThrowAt = -1e9;
  private readonly groupThrowAt = new Map<string, number>();
  /** lựu đạn địch đã cảnh báo (id) */
  private readonly warnedGrenades = new Set<number>();
  readonly grenadeLink: GrenadeLink = {
    canThrow: (bot) => {
      const A = GRENADE.ai;
      const now = this.clock.simTime * 1000;
      if (now - this.lastEnemyThrowAt < A.globalCooldownMs) return false;
      if (now - (this.groupThrowAt.get(bot.group) ?? -1e9) < A.groupCooldownMs) return false;
      let live = 0;
      for (const g of this.grenades.live()) if (g.faction === 'enemy') live++;
      return live < A.maxLiveEnemy;
    },
    throwAt: (bot, from, to) => {
      const v = solveLob(from, to, GRENADE.ai.lobDeg, GRENADE.ai.maxSpeed);
      const owner = this.bots.get(bot.id);
      const g = this.grenades.spawn(from, v, bot.id, owner?.faction === 'friend' ? 'friend' : 'enemy');
      if (!g) return false;
      const now = this.clock.simTime * 1000;
      this.lastEnemyThrowAt = now;
      this.groupThrowAt.set(bot.group, now);
      return true;
    },
    dangers: () => this.grenades.live(),
  };
  /** đồng đội có tên (TIP-M1A) */
  squadmates!: Squadmates;
  /** DV-090 tiểu đội bộ đội không tên đánh cùng tổ (đi theo cùng lệnh, không hô, có thể hy sinh) */
  support!: Squadmates;
  private footstepMs = 0;
  private readonly targetInfo = { pos: [0, 0, 0] as [number, number, number], eye: [0, 0, 0] as [number, number, number], alive: true, isPlayer: true };
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
  /** DV-093 called at the start of every frame with the real frame time (cinematic director) */
  preFrame: ((dt: number) => void) | null = null;
  /** DV-093 world time scale (sim + render effects); 1 = real time */
  simScale = 1;
  readonly params: URLSearchParams;
  readonly resetHooks: Array<(seed: number) => void> = [];
  private pendingTimestamp = false;

  constructor(readonly opts: GameOptions) {
    this.params = new URLSearchParams(opts.search);
    this.seed = opts.seed ?? Number(this.params.get('seed') ?? 7);
    this.calmOnStart = this.params.get('calm') === '1' && this.params.get('debug') === '1';
    // giọng (DV-076): manifest nhỏ, tải song song; file mp3 tải dần (prefetch) và giải mã khi nói
    if (this.params.get('voice') !== '0') void this.voice.load().then((ok) => ok && this.voice.manifest && this.voice.prefetch(Object.keys(this.voice.manifest.lines)));
    this.prng = mulberry32(this.seed);
    this.defaultInput = new KeyboardMouseInput(opts.canvas);
    this.input = this.defaultInput;
  }

  async init(): Promise<void> {
    const override = backendFromSearch(this.opts.search);
    this.quality = resolveQuality(this.params);
    this.scaler.enabled = this.quality.dynamicResolution;
    this.animLod = this.params.get('animlod') !== '0';
    this.bundle = await createRenderer({
      canvas: this.opts.canvas,
      forceWebGL: override === 'webgl',
      trackTimestamp: this.params.get('bench') === '1' || this.params.get('debug') === '1' || this.params.get('gpuTime') === '1',
      hdr: this.wantHdr(),
      onDeviceLost: (info) => this.events.emit('RENDER_DEVICE_LOST', info),
    });
    this.bundle.renderer.shadowMap.enabled = this.quality.shadows;
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Level (TIP-019/ADR-007): mặc định Phố Vạn Hải ban ngày; bench/E2E dùng ?level=arena (G0 đêm cảng)
    const levelParam = this.params.get('level');
    this.levelId = levelParam === 'arena' || levelParam === 'pho' || levelParam === 'truong-son' || levelParam === 'diem-cao-31' || levelParam === 'ngam-ta-le' ? levelParam : 'truong-son';
    const weaponParam = this.params.get('weapon');
    this.playerWeaponId = weaponParam === 'ak74m' || weaponParam === 'ak47' ? weaponParam : 'ak47';
    this.factionPack = resolvePackId(this.params.get('factions'));
    const botWeaponParam = this.params.get('botWeapon');
    this.botWeaponId = botWeaponParam === 'ak47' || botWeaponParam === 'ak74m' || botWeaponParam === 'hk416' || botWeaponParam === 'm16a1' ? botWeaponParam : null;
    const levelDef = this.levelId === 'pho' ? (phoLevelJson as unknown as LevelDef) : null;
    const terrainDef0 =
      this.levelId === 'truong-son'
        ? (truongSonLevelJson as unknown as TerrainLevelDef)
        : this.levelId === 'diem-cao-31'
          ? (diemCao31LevelJson as unknown as TerrainLevelDef)
          : this.levelId === 'ngam-ta-le'
            ? (ngamTaLeLevelJson as unknown as TerrainLevelDef)
            : null;
    this.terrainLevelDef = terrainDef0;
    // Trời theo registry (DV-057): level có `climate` → mặt trời tính thiên văn, sương/mây/mưa phùn theo preset. `?climate=0` giữ trời đặt tay cũ (A/B).
    const climateDef: LevelClimate | undefined = terrainDef0?.climate;
    this.climate = terrainDef0 && climateDef && this.params.get('climate') !== '0' ? resolveClimate(terrainDef0.sky, climateDef, parseClimatePresets(climateJson)) : null;
    const terrainDef: TerrainLevelDef | null =
      terrainDef0 && this.climate ? { ...terrainDef0, sky: this.climate.sky, terrain: { ...terrainDef0.terrain, wetness: this.climate.wetness } } : terrainDef0;
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
      swatBody: this.params.get('body') === 'swat',
      noWeapons: !this.quality.weapons,
      weapons: [ak47Cfg as unknown as WeaponModelConfig, m16a1Cfg as unknown as WeaponModelConfig, ak74mCfg as unknown as WeaponModelConfig, hk416Cfg as unknown as WeaponModelConfig],
      textureIds: levelDef?.textures ?? terrainDef?.textures,
      modelIds: levelDef?.models ?? terrainDef?.models,
      hdri: skyDef ? { id: skyDef.hdri, res: skyDef.res } : undefined,
      keepSky: !!skyDef,
    });
    WEATHER.forest.value = 0;
    WEATHER.wet.value = 0;
    if (terrainDef && skyDef) {
      // Terrain DEM (TIP-D04): ArenaData từ ô heightmap; ánh sáng ban ngày như level JSON
      this.terrain = await loadTerrainLevel(this.scene, terrainDef, { assets: this.assets, baseUrl: import.meta.env.BASE_URL ?? '/', maxFxLights: this.quality.tier === 'low' ? 2 : 4 });
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
        // DV-078: dải trống dọc đường xe (level roads) + khoảng trống khai trong vegetation.clear — cùng luật với terrain-bake --nav
        const vegDef = { ...terrainDef.vegetation, clear: [...(terrainDef.vegetation.clear ?? []), ...roadClearings(terrainDef.roads)] };
        this.forest = await buildForest(this.bundle.renderer, this.terrain.tile, vegDef, {
          baseUrl: import.meta.env.BASE_URL ?? '/',
          quality: vq,
          noImpostor: this.params.get('impostor') === '0',
        });
        this.terrain.root.add(this.forest.system.group);
        // DV-079 bản đồ độ che tán (terrain + cây bụi đọc: tối dưới tán kín, bóng tán ngoài tầm CSM)
        if (this.params.get('canopy') !== '0') {
          canopyMap.fill(terrainDef.vegetation.rect, this.forest.system.canopyTrees());
          // DV-081 nhân vật nhận che sáng tán + viền nắng (?envshade=0 để so)
          WEATHER.forest.value = this.params.get('envshade') === '0' ? 0 : 1;
        }
        // DV-079 lá ướt theo trời (mưa phùn/sương sớm)
        this.forest.system.wind.wet.value = this.climate ? Math.min(1, this.climate.wetness * 1.2) : (terrainDef.terrain.wetness ?? 0.2);
        WEATHER.wet.value = this.params.get('envshade') === '0' ? 0 : this.forest.system.wind.wet.value;
        // DV-083 lùm cây che tầm nhìn AI (?vegsight=0 để tắt)
        if (this.params.get('vegsight') !== '0') {
          const tr = this.terrain;
          this.sightOcclusion = makeSightOcclusion(this.forest.system.understoryGrid(2), (x, z) => tr.heightAt(x, z));
        }
        // collider thân cây vào ArenaData (nguồn collider duy nhất → physics.addStatic bên dưới)
        for (const c of this.forest.system.colliders) this.arena.colliders.push(c);
      }
      // Máy bay ambient (TIP-D-SKY): nạp model air_* của các lượt (thiếu → bỏ lượt), ?skyModel=<id> ép một model cho mọi lượt (debug)
      const skyParam = this.params.get('sky');
      if (terrainDef.airTraffic && skyParam !== '0' && (this.quality.assets || skyParam === '1')) {
        const base = import.meta.env.BASE_URL ?? '/';
        const override = this.params.get('skyModel');
        const def = override ? { ...terrainDef.airTraffic, flights: terrainDef.airTraffic.flights.map((f) => ({ ...f, model: override })) } : terrainDef.airTraffic;
        const ids = [...new Set(def.flights.map((f) => f.model))];
        const models: Record<string, import('three/webgpu').Object3D> = {};
        await Promise.all(
          ids.map(async (id) => {
            try {
              models[id] = await loadModel(`${base}assets/models/${id}.glb`);
            } catch (e) {
              console.warn(`[sky] model ${id} missing (assets/models/${id}.glb) — flights skipped: ${(e as Error).message ?? e}`);
            }
          }),
        );
        this.sky = new SkyTraffic(this.terrain.tile, def, models, {
          onGust: (g, dx, dz) => {
            this.skyGust = g;
            if (this.forest) {
              const base0 = terrainDef.vegetation?.wind ?? 0.35;
              this.forest.system.setWind(Math.min(1, base0 + g * 0.9), g > 0 ? dx : undefined, g > 0 ? dz : undefined);
            }
          },
          sound: (kind) => (kind === 'none' ? null : this.audio.aircraft(kind)),
        });
        this.terrain.root.add(this.sky.group);
      }
      this.lights = createDaylight(this.scene, skyDef, {
        environment: this.assets.environment,
        sky: this.assets.sky,
        shadowMapSize: this.quality.shadowMapSize,
        csm: this.quality.shadows && this.params.get('csm') !== '0',
        // DV-080 ultra: bóng 4096, tầm 1,5×, PCF bán kính 2
        shadowFarScale: this.quality.shadowFarScale,
        shadowRadius: this.quality.shadowRadius,
        ...(this.quality.shadowCascades !== null ? { cascades: this.quality.shadowCascades } : {}),
      });
      // DV-079: uniform mặt trời dùng chung (nắng xuyên lá, bóng tán xa) + khí quyển sương theo độ cao, tán xạ về phía nắng
      const sunDir = (this.lights as unknown as { sunDir: [number, number, number] }).sunDir;
      setSun(sunDir, skyDef.sun.color, skyDef.sun.intensity, skyDef.csm.maxFar * this.quality.shadowFarScale);
      if (this.params.get('atmo') !== '0') {
        this.atmosphere = createAtmosphere(this.scene, { color: skyDef.fog.color, density: skyDef.fog.density, sunColor: skyDef.sun.color, ...(skyDef.atmosphere ?? {}) });
        this.atmosphere.setSun(sunDir);
      }
      // mưa phùn theo preset (giữ số hạt của tier, chỉ hiện một phần qua rain.intensity bên dưới); không preset → tạnh
      if (this.params.get('rain') === null && !(this.climate && this.climate.drizzle > 0)) this.quality.rainCount = 0;
      if (this.climate && this.params.get('amb') !== '0') {
        this.soundscape = new Soundscape(this.audio, parseSoundscapeConfig(soundscapeJson as unknown), (this.seed ^ 0x5a17) >>> 0);
        this.amb.month = this.climate.month;
        this.amb.sunriseMin = this.climate.sunriseMin;
        this.amb.sunsetMin = this.climate.sunsetMin;
        this.amb.localMin = this.climate.localMin;
        this.amb.rain = this.climate.drizzle;
        this.ambElapsedS = 0;
        this.ambWindBase = terrainDef.vegetation?.wind ?? 0.35;
      } else if (terrainDef.ambience && this.params.get('amb') !== '0') {
        // DV-078: level đêm không climate — cảnh âm rừng theo giờ khai trong `ambience` (bình minh/hoàng hôn mặc định tháng 1)
        this.soundscape = new Soundscape(this.audio, parseSoundscapeConfig(soundscapeJson as unknown), (this.seed ^ 0x5a17) >>> 0);
        const [hh, mm] = terrainDef.ambience.localTime.split(':').map(Number);
        this.amb.month = terrainDef.ambience.month;
        this.amb.localMin = (hh ?? 0) * 60 + (mm ?? 0);
        this.amb.rain = 0;
        this.ambElapsedS = 0;
        this.ambWindBase = terrainDef.vegetation?.wind ?? 0.35;
      }
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
    if (this.climate && this.climate.drizzle > 0 && this.params.get('rain') === null) this.rain.intensity.value = this.climate.drizzle;
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
      const hemiVm = new HemisphereLight(sky.hemi.sky, sky.hemi.ground, sky.hemi.intensity);
      this.vmScene.add(hemiVm);
      // DV-079: IBL lớp súng 0,65 × cảnh — kim loại thép nhuộm đen không loá trắng như nhôm dưới trời sương sáng
      this.vmLight = { sun: sunVm, hemi: hemiVm, sun0: sky.sun.intensity, hemi0: sky.hemi.intensity, env0: this.scene.environmentIntensity * 0.65 };
    } else this.vmScene.add(new HemisphereLight(0xdfe8ff, 0x3a3630, 0.35)); // nền cho súng/tay khi đèn cảnh không vào lớp riêng
    // DV-087: chớp lửa nòng hắt ánh cam lên súng và tay (đèn luôn trong lớp súng, cường độ 0 khi nghỉ → không biên dịch lại)
    this.vmFlash.castShadow = false;
    this.vmScene.add(this.vmFlash);
    // DV-063: hậu kỳ điện ảnh theo level (tia nắng xuyên tán, màu phim); ?shafts=0 / ?grade=0 để so A/B
    const lp = terrainDef?.post;
    this.filmDefault = this.params.get('film') === '0' ? 0 : (lp?.film ?? 0);
    this.film = this.filmTarget = this.filmDefault;
    const rig = this.lights as { sunColor?: number; sunIntensity?: number };
    const sc = new Color(rig.sunColor ?? 0xffffff).multiplyScalar(rig.sunIntensity ?? 1);
    // DV-081 sương sát đất: ánh trời trong sương = màu sương của trời (linear) × độ sáng ánh trời
    const fogC = new Color(skyDef?.fog.color ?? 0x9fb09d).multiplyScalar(skyDef?.hemi.intensity ?? 1);
    const mistAmbient: [number, number, number] = [fogC.r, fogC.g, fogC.b];
    this.post = createPostStack(this.bundle.renderer, this.scene, this.camera, {
      tier: this.quality.post,
      backend: this.bundle.backend,
      taa: this.quality.taa,
      ssr: this.quality.ssr,
      overlay: { scene: this.vmScene, camera: this.vmCamera },
      shafts: lp?.shafts && this.params.get('shafts') !== '0' ? { ...lp.shafts, sunColor: [sc.r, sc.g, sc.b] } : null,
      // DV-080 tia nắng thể tích: cần rừng + bản đồ độ che tán + khí quyển; ?vol=0 để so A/B
      volumetric: this.forest && this.atmosphere && lp?.volumetric && this.params.get('vol') !== '0' && this.params.get('canopy') !== '0' ? { ...lp.volumetric, ...(this.params.get('mist') === '0' ? { mist: false as const } : {}), ...(this.params.get('volblur') === '0' ? { denoise: false } : {}), sunColor: [sc.r, sc.g, sc.b], debug: this.params.get('vol') === 'debug', ground: this.terrain ? makeHeightField(this.terrain.tile) : null, ambient: mistAmbient } : null,
      grade: lp?.grade && this.params.get('grade') !== '0' ? lp.grade : false,
      ...(lp?.grain !== undefined ? { grain: lp.grain } : {}),
      ...(this.params.get('aoden') === '0' ? { aoDenoise: false } : {}),
      ...(lp?.vignette !== undefined ? { vignette: lp.vignette } : {}),
      ...(lp?.bloom !== undefined ? { bloomStrength: lp.bloom } : {}),
      // DV-092 HDR thật: chỉ khi canvas đang ở chế độ extended (WebGPU + màn EDR hoặc ?hdr=1)
      hdr: this.hdrOut ? { gain: lp?.hdr?.gain ?? 1, threshold: lp?.hdr?.threshold ?? 1.6, headroom: lp?.hdr?.headroom ?? 3 } : null,
    });
    // DV-081: sương sát đất trôi cùng hướng gió rừng (cùng đối tượng Vector2 → đổi gió trực thăng/bom cũng đổi hướng trôi)
    if (this.post.volumetric && this.forest) (this.post.volumetric.wind as { value: unknown }).value = this.forest.system.wind.dir.value;
    // DV-082 chim lượn trên tán, bướm quanh người chơi: cảnh rừng có tán (không phụ thuộc tia thể tích), theo tier; ?wildlife=0
    if (this.forest && this.terrain && this.params.get('wildlife') !== '0' && this.quality.post !== 'off' && this.quality.post !== 'low') {
      const n = { medium: [42, 1, 16], high: [63, 2, 28], ultra: [98, 3, 44] }[this.quality.post as 'medium' | 'high' | 'ultra'];
      this.wildlife = createWildlife({ birds: n[0]!, bigBirds: n[1]!, butterflies: n[2]! });
      (this.wildlife.wind as { value: unknown }).value = this.forest.system.wind.dir.value;
      for (const m of this.wildlife.meshes) this.scene.add(m);
    }
    // DV-081 bụi trong cột nắng: chỉ khi có tia thể tích (cùng tán, cùng nắng); số hạt theo tier, ?dust=0 để so
    if (this.post.volumetric && this.forest && this.params.get('dust') !== '0') {
      const n = { off: 0, low: 0, medium: 500, high: 900, ultra: 1600 }[this.quality.post];
      if (n > 0) {
        // ?dust=debug: hạt to × 6, sáng × 20 để soi chỗ hạt sáng (chỉ trong cột nắng)
        const dbg = this.params.get('dust') === 'debug';
        this.dust = createDustMotes({ count: n, canopyHeight: lp?.volumetric ? (lp.volumetric.canopyHeight ?? 18) : 18, ...(dbg ? { sizeM: 0.13, intensity: 24 } : {}) });
        (this.dust.wind as { value: unknown }).value = this.forest.system.wind.dir.value;
        this.scene.add(this.dust.sprite);
      }
    }
    // DV-091: flare lights live from load only on levels whose mission uses them (no per-pixel light cost elsewhere)
    if (this.terrain && missionUsesFlares(this.levelId)) this.flares = new Flares(this.scene, { max: this.quality.tier === 'low' ? 2 : 3 });
    for (let i = 0; i < this.arena.dummySpawns.length; i++) {
      const d = createActorVisual(this.quality.character ? this.assets.character : null, { phase: i * 0.9, seed: hashSeed(`dummy_${i}`), color: 0x4a5246, visor: 0x2ad4ff, gear: this.lookFor('friend').gear, skin: this.lookFor('friend').skin }, this.weaponFor('friend'));
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
    this.grenades = new GrenadeSystem({
      physics: this.physics,
      groundHeight: (x, z) => (this.terrain ? this.terrain.heightAt(x, z) : null),
      explode: (g) => this.grenadeBlast(g),
      onBounce: (g, sp) => this.audio.grenadeBounce(g.pos, Math.min(1, sp / 10)),
    });
    for (const c of this.arena.colliders) {
      const col = this.physics.addStatic({ kind: c.kind, position: c.position, size: c.size, yaw: c.yaw, heights: c.heights, n: c.n }, { id: c.id, kind: 'world', material: c.material });
      if (c.id.startsWith('prop_')) this.propColliders.set(c.id, col);
    }

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
    if (this.terrain) {
      this.hud.minimap.setMap(`${import.meta.env.BASE_URL ?? '/'}assets/terrain/${terrainDef!.terrain.id}/map.png`, { sizeM: this.terrain.tile.sizeM, cx: 0, cz: 0 });
      const nr = terrainDef!.terrain.navRect;
      this.hud.minimap.setFocus(nr.x, nr.z, Math.max(nr.w, nr.h) + 200);
    }
    else this.hud.minimap.setMap(null, { sizeM: 240, cx: 0, cz: 0 });

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
    // DV-087 vụ nổ có khối: cầu lửa → khói đen, đất đá văng, cột đất, vòng bụi sát đất, bụi lơ lửng (3 draw call)
    this.blast = createBlastFx({ blasts: this.quality.tier === 'low' ? 8 : 16 });
    this.scene.add(this.blast.group);
    // bụi/khói vụ nổ trôi theo gió rừng (cùng đối tượng Vector2)
    if (this.forest) (this.blast.wind as { value: unknown }).value = this.forest.system.wind.dir.value;
    // DV-088 vết cháy xém + bùn ống kính
    this.scorch = createScorch();
    this.scene.add(this.scorch.mesh);
    this.lensDirt = new LensDirt(this.bundle.renderer.domElement.parentElement);
    this.grenadeView = new GrenadeView(this.scene);
    // DV-065: tay áo người chơi theo gói phe (?sleeve=0 giữ màu gốc của nghệ sĩ để so A/B)
    const sleeveHex = this.params.get('sleeve') === '0' ? undefined : this.lookFor('friend').sleeve;
    this.viewModel = new WeaponViewModel(this.vmCamera, { steel: this.assets.textures['metal_plate'] ?? null }, this.assets.weapons[this.playerWeaponId] ?? null, this.assets.fpViewmodel, sleeveHex ? { sleeveColor: parseInt(sleeveHex.slice(1), 16) } : {});
    // tay FP v2 (TIP-D11b, Chủ nhà chọn "tự dựng"): cẳng tay 1971 procedural DỰNG SẴN trong viewmodel (tay áo Tô Châu
    // + cẳng tay + bàn tay ôm súng), nằm trong hệ súng → theo sway/ADS, không rig/IK → không nháy. Bật mặc định khi có arms.
    // (Asset tay rig David Fischer/Mixamo giữ trong code làm fallback nghiên cứu, KHÔNG dùng cho người chơi mặc định.)
    this.viewModel.setGlovesVisible(!!this.quality.arms);
    this.scene.add(this.camera); // camera phải nằm trong scene để viewmodel (con của camera) được render
    this.fx.muzzleWorld = this.fxMuzzle; // vị trí đầu nòng chiếu về camera chính (FX ở scene chính)
    this.fx.ejectWorld = this.fxEject;
    this.fx.botMuzzle = (id, out) => this.bots.get(id)?.dummy.muzzleWorld(out) ?? false;
    this.events.on('WEAPON_FIRED', () => this.viewModel.onShot());
    this.events.on('RELOAD_START', () => this.viewModel.onReload(this.weapon.def.reloadMs, this.weapon.snapshot().mag === 0));
    this.events.on('HIT', (e) => {
      const shooterBot = e.shooter && e.shooter !== 'player' ? this.bots.get(e.shooter) : undefined;
      if (e.actorId === 'player') {
        if (shooterBot && shooterBot.faction === 'friend') return; // đồng đội không sát thương người chơi (TIP-M1A)
        this.audio.impact('flesh', e.point);
        // điện ảnh (AI-T1.4): đạn địch giảm còn playerDamageMul (bộc phá, pháo, ngã giữ nguyên); hồi máu sau regenDelayMs
        this.lastHurtAt = this.clock.simTime;
        const dead = this.player.damage(e.damage * (shooterBot && !e.blast ? aiTuning.cinematic.playerDamageMul : 1));
        // vòng chỉ hướng trúng đạn (TIP-UX02): phương vị nguồn so với hướng nhìn (nổ: tâm nổ)
        if (shooterBot) {
          const f = this.player.controller.feet;
          const src = e.blast ? e.point : shooterBot.bot.position;
          this.hud.damageFrom(relDeg(this.cameraHeadingDeg(), bearingOf(src[0] - f[0], src[2] - f[2])));
        }
        if (dead) this.events.emit('ACTOR_DIED', { actorId: 'player', group: 'player' });
        // DV-087: đồng đội gọi tên người chơi khi Lâm dính đạn/nổ gần
        else if (this.player.health < 70 || e.blast) this.squadmates.warnPlayer();
        return;
      }
      const b = this.bots.get(e.actorId);
      if (b) {
        if (shooterBot && shooterBot.faction === b.faction) return; // cùng phe: không sát thương
        if (e.shooter === 'player' && b.faction === 'friend') return; // người chơi không bắn được đồng đội (PRD §20.3 công bằng — đồng đội né; tạm miễn)
        this.audio.impact('flesh', e.point);
        if (shooterBot) this.v3.set(shooterBot.bot.position[0], shooterBot.bot.position[1] + 1.5, shooterBot.bot.position[2]);
        else this.player.eyePosition(this.v3);
        // điện ảnh (AI-T1): tổ ta bắn địch đau hơn; tổ ta có tên không chết ở M1 (dừng ở friendMinHealth, vẫn bị áp chế)
        const cin = aiTuning.cinematic;
        let dmg = e.damage;
        if (shooterBot?.faction === 'friend' && b.faction === 'enemy') dmg *= cin.friendDamageMul;
        // DV-090: bộ đội không tên (tiểu đội đi cùng) có thể hy sinh, chịu nửa sát thương cho sống lâu hơn qua các hồi
        if (b.faction === 'friend') dmg = b.nameKey ? Math.min(dmg, Math.max(0, b.bot.health - cin.friendMinHealth)) : dmg * 0.5;
        const died = b.applyDamage(dmg, [this.v3.x, this.v3.y, this.v3.z], e.zone);
        if (e.shooter === 'player') this.hud.hit(died);
        if (shooterBot && shooterBot.faction === 'friend' && died) this.squadmates.bark(shooterBot.id, 'kill');
        if (!died && b.faction === 'friend' && b.bot.health < 55) this.squadmates.bark(b.id, 'hurt');
        if (b.faction === 'enemy' && !died) this.chatter.say(b.id, 'hit');
        if (died) {
          b.diedAt = this.clock.simTime;
          this.events.emit('ACTOR_DIED', { actorId: b.id, group: b.group });
          if (b.faction === 'friend') {
            this.squadmates.remove(b.id);
            this.support.remove(b.id);
          }
          else this.enemyManDown(b.bot.position, shooterBot ? shooterBot.bot.position : this.player.controller.feet);
        }
        return;
      }
      this.audio.impact('flesh', e.point);
      const a = this.actors.get(e.actorId);
      if (!a) return;
      const died = a.dummy.applyDamage(e.damage);
      if (e.shooter === 'player') this.hud.hit(died);
      if (died) {
        a.body.setEnabled(false);
        this.events.emit('ACTOR_DIED', { actorId: a.id, group: a.group });
      }
    });
    this.events.on('BOT_FIRED', (e) => {
      this.audio.gunshotFar(e.origin);
      this.playerNearMiss(e.origin, e.dir, e.faction);
      const b = this.bots.get(e.botId);
      if (b) {
        b.dummy.onFire();
        b.lastFireTick = this.clock.tick;
      }
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
      // bake runtime: thêm obstacle thân cây (cùng lăng trụ như terrain-bake --level) để bot đi vòng cây
      const navGeo = [...this.arena.navGeometry];
      if (this.forest && this.forest.system.colliders.length) {
        const ob = navObstacleMesh(this.forest.system.colliders, { capH: 1.2, sides: 8, radiusPad: (c) => navPadFor(c.id, 0), groundAt: (x, z) => this.terrain!.tile.sampleGrid(x, z, Math.max(1, Math.round(4 / this.terrain!.tile.resM))) });
        const g = new BufferGeometry();
        g.setAttribute('position', new BufferAttribute(ob.positions, 3));
        g.setIndex(new BufferAttribute(ob.indices, 1));
        const m = new Mesh(g);
        m.name = 'veg_nav_obstacles';
        m.updateMatrixWorld(true);
        navGeo.push(m);
      }
      const [navPos, navIdx] = getPositionsAndIndices(navGeo);
      this.nav = new NavService(navPos, navIdx, this.terrain ? { cs: 0.5, ch: 0.25 } : {});
    }
    this.navBuildMs = this.nav.buildMs;
    this.navHelper = new NavMeshHelper(this.nav.navMesh);
    this.navHelper.visible = false;
    this.scene.add(this.navHelper);
    window.addEventListener('keydown', (ev) => {
      if (ev.code === 'F4' && this.navHelper) this.navHelper.visible = !this.navHelper.visible;
    });
    this.buildTactics();
    this.squad = new FireTeams(this.events as unknown as EventBus<BotEvents>);
    if (this.levelId !== 'truong-son' && this.levelId !== 'diem-cao-31' && this.levelId !== 'ngam-ta-le') this.spawnBot('bot_a', 'ambient', this.arena.botSpawns['bot_a']!);
    // DV-091: each bot thinks at 10 Hz but on its own sixth of the ticks — 35 bots no longer all think in one frame
    // (one 60 Hz frame in six used to carry the whole AI cost: a regular micro-stutter in big fights)
    this.scheduler.add('sim60', (tick, dt) => {
      if (this.aiPaused) return;
      const div = this.scheduler.aiDivider;
      const phase = tick % div;
      for (const b of this.bots.values()) if (b.aiSlot % div === phase) b.bot.think(dt * div);
    });
    this.scheduler.add('ai10', () => {
      let full = 0;
      let alive = 0;
      for (const b of this.bots.values()) {
        if (b.bot.alive) {
          alive++;
          if (b.bot.lod === 'FULL') full++;
        }
      }
      this.actorStats.full = full;
      this.sweepCorpses();
      let dummiesAlive = 0;
      for (const a of this.actors.values()) if (a.dummy.alive) dummiesAlive++;
      this.actorStats.total = alive + dummiesAlive;
    });
    this.events.on('IMPACT', (e) => this.audio.impact(e.material, e.point));
    this.events.on('WEAPON_FIRED', (e) => {
      this.audio.gunshot(e.weapon);
      this.audio.gunshotTail();
    });
    this.events.on('RELOAD_START', () => this.audio.reload());
    const initAudio = (): void => {
      const was = !!this.audio.ctx;
      this.audio.init();
      // câu đầu nhiệm vụ lên trước khi người chơi bấm (trình duyệt chặn âm khi chưa có thao tác) → nói lại câu đang hiện
      const cur = this.mission?.subtitles.activeRequest;
      if (!was && cur) this.speak(cur);
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
    this.squadmates = new Squadmates({
      player: () => {
        const f = this.player.controller.feet;
        this.player.aimDirection(this.v3b, false);
        const l = Math.hypot(this.v3b.x, this.v3b.z) || 1;
        return { feet: [f[0], f[1], f[2]], fwdX: this.v3b.x / l, fwdZ: this.v3b.z / l, speed: this.player.controller.horizontalSpeed() };
      },
      objective: () => this.mission.squadDest ?? (this.mission.markerOnLeader ? null : this.mission.objectiveMarker),
      say: (cue, speaker, vars) => this.mission.say(cue, speaker, vars),
      sayLine: (cue, speaker, text, priority) => this.mission.sayLine(cue, speaker, text, priority),
      now: () => this.clock.simTime,
      rand: () => this.barkRng.next(),
    });
    this.support = new Squadmates(
      {
        player: () => {
          const f = this.player.controller.feet;
          this.player.aimDirection(this.v3b, false);
          const l = Math.hypot(this.v3b.x, this.v3b.z) || 1;
          return { feet: [f[0], f[1], f[2]], fwdX: this.v3b.x / l, fwdZ: this.v3b.z / l, speed: this.player.controller.horizontalSpeed() };
        },
        objective: () => this.mission.squadDest ?? (this.mission.markerOnLeader ? null : this.mission.objectiveMarker),
        say: () => false,
        now: () => this.clock.simTime,
        rand: () => this.barkRng.next(),
      },
      4,
    );
    this.events.on('AI_STATE', (e) => {
      const b = this.bots.get(e.botId);
      if (!b || b.faction !== 'friend') return;
      // chạm địch: báo hướng theo giờ đồng hồ (AI-T1.5), không được thì hô chung
      if (e.to === 'ENGAGE' && (e.from === 'PATROL' || e.from === 'INVESTIGATE')) {
        // DV-087: báo giờ đồng hồ chỉ khoảng 1/3 số lần — còn lại hô tự nhiên (nhiều biến thể) cho đỡ đều đều
        if (!(e.reason === 'contact' && this.barkRng.next() < 0.35 && this.squadmates.callout(b.id, b.bot.threat))) this.squadmates.bark(b.id, 'contact');
      }
      else if (e.to === 'SEEK_COVER') this.squadmates.bark(b.id, 'cover');
    });
    this.events.on('AI_RELOAD', (e) => {
      const b = this.bots.get(e.botId);
      if (b && b.faction === 'friend') this.squadmates.bark(b.id, 'reload');
    });
    // AI-T1.5: tổ ta hô khi lao ("yểm trợ, tôi lên!") và khi bị ghim
    this.events.on('AI_BOUND', (e) => {
      const b = this.bots.get(e.botId);
      if (b && b.faction === 'friend' && (e.reason === 'advance' || e.reason === 'follow_anchor')) this.squadmates.bark(b.id, 'moving');
    });
    this.events.on('AI_PINNED', (e) => {
      const b = this.bots.get(e.botId);
      if (b && b.faction === 'friend') this.squadmates.bark(b.id, 'pinned');
      else if (b) this.chatter.say(b.id, 'pinned');
    });
    // địch hô tiếng Anh (DV-076)
    this.events.on('AI_STATE', (e) => {
      const b = this.bots.get(e.botId);
      if (!b || b.faction !== 'enemy') return;
      if (e.to === 'ENGAGE' && (e.from === 'PATROL' || e.from === 'INVESTIGATE')) this.chatter.say(b.id, 'contact');
      else if (e.to === 'RETREAT' && e.reason === 'grenade') this.chatter.say(b.id, 'grenade');
      else if (e.to === 'FLANK') this.chatter.say(b.id, 'flank');
      else if (e.to === 'RETREAT') this.chatter.say(b.id, 'fallback');
      else if (e.to === 'INVESTIGATE' && e.reason === 'lost_contact') this.chatter.say(b.id, 'lost');
      else if (e.to === 'PEEK_FIRE' && b.bot.role === 'support') this.chatter.say(b.id, 'suppress');
    });
    this.events.on('AI_RELOAD', (e) => {
      if (this.bots.get(e.botId)?.faction === 'enemy') this.chatter.say(e.botId, 'reload');
    });
    this.events.on('AI_BOUND', (e) => {
      const b = this.bots.get(e.botId);
      if (!b || b.faction !== 'enemy') return;
      if (e.reason !== 'grenade') this.chatter.say(b.id, 'moving');
    });
    this.events.on('AI_GRENADE', (e) => {
      if (this.bots.get(e.botId)?.faction === 'enemy') this.chatter.say(e.botId, 'frag');
    });
    // hồi đêm (DV-078): dựng trước mission.start (nghe cờ convoy_go/gunship từ node đầu)
    if (this.levelId === 'ngam-ta-le' && this.terrain && terrainDef) {
      this.nightAct = new NightAct(this, terrainDef);
      this.blast.light.value = 0.15;
      await this.nightAct.load();
    }
    this.mission = new MissionHost(this);
    this.mission.start();
    window.addEventListener('keydown', (ev) => {
      if (ev.code === 'Enter' && !this.player.alive) this.respawn();
      // DV-078: hoàn thành nhiệm vụ → Enter sang level nối tiếp (giữ tham số chất lượng)
      else if (ev.code === 'Enter' && this.hud.state.missionComplete && this.terrainLevelDef?.nextLevel && this.params.get('autonext') !== '0') this.gotoLevel(this.terrainLevelDef.nextLevel);
      // lệnh tổ (AI-T1.5): 1 theo · 2 giữ · 3 yểm trợ chỗ nhắm · 4 tiến tới chỗ nhắm
      const ord = ev.code === 'Digit1' ? 'follow' : ev.code === 'Digit2' ? 'hold' : ev.code === 'Digit3' ? 'suppress' : ev.code === 'Digit4' ? 'advance' : null;
      if (ord && this.player.alive && !ev.repeat) {
        const pt = this.aimPoint();
        this.squadmates.command(ord, pt);
        this.support.command(ord, pt); // DV-090 tiểu đội đi cùng nghe cùng lệnh (không đáp lời)
      }
      // lựu đạn (DV-074): G ném theo hướng nhìn
      if (ev.code === 'KeyG' && !ev.repeat) this.wantThrow = true;
    });
    // DV-086: biên dịch sẵn mọi pipeline đang có trong scene (lửa/khói chiến trường, lính, súng) trước khi vào chơi — tránh khựng
    // khung lần đầu một vật liệu xuất hiện giữa trận
    try {
      await this.bundle.renderer.compileAsync(this.scene, this.camera);
      await this.bundle.renderer.compileAsync(this.vmScene, this.vmCamera);
    } catch (e) {
      console.warn('[render] compileAsync', e);
    }
    this.ready = true;
  }

  /**
   * DV-092 HDR output: ?hdr=1 on (needs an EDR display: MacBook Pro XDR, HDR monitor), ?hdr=auto on when the display reports
   * high dynamic range; default off until judged on the owner's Mac
   */
  private wantHdr(): boolean {
    const p = this.params.get('hdr');
    if (p === '1') return true;
    if (p === 'auto') return typeof window.matchMedia === 'function' && window.matchMedia('(dynamic-range: high)').matches;
    return false;
  }

  /** DV-092 the canvas really is an extended-range (rgba16float) WebGPU canvas */
  get hdrOut(): boolean {
    return this.bundle.backend === 'webgpu' && this.wantHdr();
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
    // DV-093 cinematic: the director advances its own clock first and may slow the world (simScale < 1 = slow motion)
    this.preFrame?.(dt);
    const dts = dt * this.simScale;
    this.scheduler.beginFrame();
    const adv = this.clock.advance(dts);
    for (let i = 0; i < adv.steps; i++) {
      this.events.currentTick = this.clock.tick - adv.steps + i + 1;
      this.scheduler.runSim(this.events.currentTick, this.clock.step);
    }
    this.scheduler.runRender(adv.alpha, dts);
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
    // DV-078: ngồi đại liên → khoá di chuyển, nòng theo hướng nhìn (nightAct tự xoay camera rig)
    const onGun = this.nightAct ? this.nightAct.preStep(this.inputState, dt) : false;
    if (this.freeFly) this.freeFly.step(this.inputState, dt);
    else if (!onGun) this.player.step(this.inputState, dt);
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
    sh.crawling = sh.stance === 'prone' && (this.inputState.fwd !== 0 || this.inputState.right !== 0 || this.player.controller.horizontalSpeed() > 0.2);
    sh.grounded = this.player.controller.grounded;
    if (this.player.alive && !onGun) this.weapon.step(this.inputState, sh, dt);
    if (!onGun) this.player.adsBlend = this.weapon.ads;
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
    if (this.wantThrow) {
      this.wantThrow = false;
      this.throwGrenade();
    }
    this.grenades.tick(dt);
    this.grenadeWarnings();
    if (this.squad && !this.aiPaused) {
      // DV-083 đạo diễn áp lực: người chơi thay đạn / nấp lâu → địch xông lên
      let seen = false;
      for (const b of this.bots.values()) if (b.faction === 'enemy' && b.bot.alive && b.bot.seesPlayer) seen = true;
      this.playerHiddenMs = seen ? 0 : this.playerHiddenMs + dt * 1000;
      const pf = this.player.controller.feet;
      this.pressure.pos[0] = pf[0];
      this.pressure.pos[1] = pf[1];
      this.pressure.pos[2] = pf[2];
      this.pressure.reloading = this.weapon.sm.state === 'RELOADING';
      this.pressure.hiddenMs = this.playerHiddenMs;
      this.pressure.alive = this.player.alive;
      this.squad.pressure = this.pressure;
      this.squad.tick(dt);
      this.squadmates.tick();
      this.support.tick();
      // tổ ta thấy địch mới (cách chỗ đã báo > 15 m) → báo hướng (tự chống lặp)
      if (this.clock.tick % 30 === 0) for (const b of this.squadmates.list()) if (b.bot.alive && b.bot.perception.visible && b.bot.inCombat) this.squadmates.callout(b.id, b.bot.threat);
      this.tokens.tick(this.enemyBots(), ti.pos, dt);
    }
    // hồi máu điện ảnh: sau regenDelayMs không trúng đạn, hồi tới regenTo
    const cin = aiTuning.cinematic;
    if (this.player.alive && this.player.health < cin.regenTo && (this.clock.simTime - this.lastHurtAt) * 1000 > cin.regenDelayMs) {
      this.player.health = Math.min(cin.regenTo, this.player.health + cin.regenPerSec * dt);
    }
    this.physics.step();
    const interactEdge = this.inputState.interact && !this.prevInteract;
    this.prevInteract = this.inputState.interact;
    this.mission.step(dt, interactEdge, this.inputState.interactHeld || this.inputState.interact);
    this.stepResupply(dt, this.inputState.interactHeld || this.inputState.interact);
    if (this.calmOnStart && this.squadmates.count > 0) {
      this.calmOnStart = false;
      this.calm();
    }
    const h = this.hud.state;
    h.health = this.player.health;
    h.squadOrderKey = this.squadmates.count > 0 ? `hud.order.${this.squadmates.order}` : null;
    h.dead = !this.player.alive;
    h.mag = this.weapon.sm.mag;
    h.magSize = this.weapon.def.magSize;
    h.reserve = this.weapon.sm.reserve;
    h.weaponState = this.weapon.state;
    h.weaponKey = `weapon.${this.weapon.id}`;
    h.spreadDeg = this.weapon.spreadDeg;
    h.ads = this.weapon.ads;
    h.grenades = this.playerGrenades;
    if (this.clock.simTime - this.suppLastAt > 0.8 || !this.player.alive) this.playerSuppression = Math.max(0, this.playerSuppression - 0.4 * dt);
    h.suppression = this.playerSuppression;
    this.nightAct?.postStep(dt, interactEdge, this.inputState.interactHeld || this.inputState.interact);
  }

  /**
   * DV-090 xin đạn đồng đội (Chủ nhà: hết đạn trước 1/3 màn): đứng cách một đồng đội (có tên hoặc không) ≤ 2,6 m, giữ F 0,8 s →
   * nhận 2 băng; mỗi người cho lại sau 60 s; dự trữ trần 10 băng. Đồng đội có tên nói một câu khi đưa. Lâm cạn đạn → đồng đội
   * gần (≤ 15 m) gọi lại lấy. Prompt nhiệm vụ (bộc phá, đại liên) luôn được ưu tiên.
   */
  private stepResupply(dt: number, held: boolean): void {
    const h = this.hud.state;
    const sm = this.weapon.sm;
    const mag = this.weapon.def.magSize;
    const cap = mag * 10;
    const clear = (): void => {
      this.resupplyHold = 0;
      if (h.promptKey === 'ammo') {
        h.promptKey = null;
        h.promptProgress = -1;
      }
    };
    if (!this.player.alive || this.freeFly || (h.promptKey && h.promptKey !== 'ammo')) return clear();
    const now = this.clock.simTime;
    if (sm.reserve === 0 && sm.mag <= 5) this.squadmates.offerAmmo(15);
    if (sm.reserve + sm.mag > cap - mag) return clear();
    const f = this.player.controller.feet;
    let giver: BotActor | null = null;
    let bd = 2.6;
    for (const b of this.bots.values()) {
      if (b.faction !== 'friend' || !b.bot.alive) continue;
      if (now - (this.ammoGivenAt.get(b.id) ?? -1e9) < 60) continue;
      const d = Math.hypot(b.bot.position[0] - f[0], b.bot.position[2] - f[2]);
      if (d < bd) {
        bd = d;
        giver = b;
      }
    }
    if (!giver) return clear();
    h.promptKey = 'ammo';
    h.promptKeyCap = 'key.f';
    if (!held) {
      this.resupplyHold = 0;
      h.promptProgress = -1;
      return;
    }
    this.resupplyHold += dt;
    h.promptProgress = Math.min(1, this.resupplyHold / 0.8);
    if (this.resupplyHold < 0.8) return;
    sm.reserve = Math.min(cap - sm.mag, sm.reserve + mag * 2);
    this.ammoGivenAt.set(giver.id, now);
    this.resupplyStats.count++;
    this.audio.reload();
    if (giver.nameKey) this.squadmates.giveAmmo(giver.id);
    clear();
  }

  /** hướng nhìn camera theo la bàn (độ, 0 = bắc = −z, kim đồng hồ) */
  cameraHeadingDeg(): number {
    this.v3c.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    return bearingOf(this.v3c.x, this.v3c.z);
  }

  /** dữ liệu HUD theo camera (la bàn, marker 3D, minimap) — gọi ở render sau khi camera cập nhật (TIP-UX02) */
  private feedHud(): void {
    const hud = this.hud;
    const heading = this.cameraHeadingDeg();
    hud.state.headingDeg = heading;
    const eye: [number, number, number] = [this.camera.position.x, this.camera.position.y, this.camera.position.z];
    this.v3c.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const fwd: [number, number, number] = [this.v3c.x, this.v3c.y, this.v3c.z];
    const feet = this.player.controller.feet;
    this.hudCompass.length = 0;
    this.hudMarkers.length = 0;
    this.hudMini.length = 0;
    const obj = this.mission.objectiveMarker;
    if (obj) {
      const d = Math.hypot(obj[0] - feet[0], obj[2] - feet[2]);
      hud.state.objectiveDist = d;
      this.hudCompass.push({ id: 'obj', kind: 'obj', bearing: bearingOf(obj[0] - feet[0], obj[2] - feet[2]) });
      this.hudMarkers.push({ id: 'obj', kind: 'obj', x: obj[0], y: obj[1] + 1.6, z: obj[2], dist: d });
    } else hud.state.objectiveDist = null;
    for (const b of this.bots.values()) {
      if (!b.bot.alive) continue;
      const p = b.bot.position;
      if (b.faction === 'friend') {
        this.hudCompass.push({ id: b.id, kind: 'friend', bearing: bearingOf(p[0] - feet[0], p[2] - feet[2]) });
        this.hudMarkers.push({ id: b.id, kind: 'friend', x: p[0], y: p[1] + 2.05, z: p[2], nameKey: b.nameKey ?? undefined });
        this.hudMini.push({ x: p[0], z: p[2], kind: 'friend' });
      } else if (this.clock.tick - b.lastFireTick < 180) this.hudMini.push({ x: p[0], z: p[2], kind: 'enemy' });
    }
    hud.setCompassMarkers(this.hudCompass);
    hud.setMarkers3D(this.hudMarkers, this.projectPoint, eye, fwd);
    hud.setMinimapActors({ x: feet[0], z: feet[2], yaw: this.player.rig.yaw, kind: 'player' }, this.hudMini, obj ? { x: obj[0], z: obj[2] } : null);
  }

  private readonly projectPoint = (x: number, y: number, z: number, out: [number, number, number]): void => {
    this.v3c.set(x, y, z).project(this.camera);
    out[0] = this.v3c.x;
    out[1] = this.v3c.y;
    out[2] = this.v3c.z > 1 || this.v3c.z < -1 ? 1 : 0;
  };

  private renderStep(alpha: number, dt: number): void {
    if (this.cameraDriver) this.cameraDriver(alpha, dt);
    this.nightAct?.render(dt);
    const t = this.clock.simTime + alpha * this.clock.step;
    for (let i = 0; i < this.dummies.length; i++) this.dummies[i]!.setPose(t);
    // DV-091 animation LOD: mixer + IK + foot planting at full rate only for soldiers the camera can see up close; far or
    // behind-camera soldiers pose every third frame (position every frame), settled corpses not at all
    const ce = this.camera.matrixWorld.elements;
    const cx = ce[12]!;
    const cz = ce[14]!;
    const fx = -ce[8]!;
    const fz = -ce[10]!;
    const fl = Math.hypot(fx, fz) || 1;
    const now = this.clock.simTime;
    for (const b of this.bots.values()) {
      if (!b.bot.alive && b.diedAt >= 0 && now - b.diedAt > ANIM_LOD.settledS) continue;
      const p = b.bot.position;
      const dx = p[0] - cx;
      const dz = p[2] - cz;
      const d = Math.hypot(dx, dz);
      const ahead = (dx * fx + dz * fz) / fl > -2;
      const low = this.animLod && (d > ANIM_LOD.farM || (!ahead && d > ANIM_LOD.nearM));
      b.syncVisual(t, !low || (this.frames + b.aiSlot) % ANIM_LOD.every === 0);
    }
    this.grenadeView?.sync(this.grenades.live(), dt);
    // viewmodel: chỉ khi có player (không free-fly)
    this.viewModel.visible = !this.freeFly && this.player.alive && !this.viewModelHidden && !this.nightAct?.mounted;
    // camera viewmodel bám camera chính; FOV = 2·atan(k·tan(fov/2)) với k = view.scale (0.62 → 64° khi fov 90)
    this.camera.updateMatrixWorld(true);
    this.vmCamera.position.copy(this.camera.position);
    this.vmCamera.quaternion.copy(this.camera.quaternion);
    const k = this.viewModelScale;
    const vmFov = this.viewModel.fovOverride ?? (2 * Math.atan(k * Math.tan((this.camera.fov * Math.PI) / 360)) * 180) / Math.PI;
    if (Math.abs(this.vmCamera.fov - vmFov) > 0.01) {
      this.vmCamera.fov = vmFov;
      this.vmCamera.updateProjectionMatrix();
    }
    this.vmCamera.updateMatrixWorld(true);
    // DV-079: súng/tay dưới tán kín tối như cảnh (ánh trời gián tiếp −55 %, nắng trực tiếp −65 %), ra khoảng trống sáng lại
    if (this.vmLight) {
      const cv = canopyMap.at(this.camera.position.x, this.camera.position.z);
      this.vmShade += (cv - this.vmShade) * Math.min(1, dt * 3);
      this.vmScene.environmentIntensity = this.vmLight.env0 * (1 - 0.55 * this.vmShade);
      this.vmLight.hemi.intensity = this.vmLight.hemi0 * (1 - 0.55 * this.vmShade);
      this.vmLight.sun.intensity = this.vmLight.sun0 * (1 - 0.65 * this.vmShade);
    }
    // DV-079 mắt quen tối: dưới tán kín phơi sáng tăng dần (≈ 1,5 s), ra khoảng trống giảm lại — như máy quay tự cân sáng
    if (this.terrain && this.params.get('adapt') !== '0') {
      const target = 1 + 0.28 * canopyMap.at(this.camera.position.x, this.camera.position.z);
      this.exposure += (target - this.exposure) * Math.min(1, dt / 1.5);
      this.bundle.renderer.toneMappingExposure = this.exposure;
    }
    const fo = this.fpOverride;
    this.viewModel.prone = this.player.controller.stance === 'prone';
    this.viewModel.update(dt, fo ? fo.ads : this.weapon.ads, this.lastInputDx, this.lastInputDy, this.player.rig.bobOffset.x, this.player.rig.bobOffset.y, this.player.controller.horizontalSpeed(), fo ? fo.sprint : this.player.isSprinting);
    if (this.fpHands) this.fpHands.visible = this.viewModel.visible;
    if (this.fpHands && this.viewModel.fpAnchors && this.viewModel.visible) {
      this.fpHands.triggerFinger = 0.5; // ngón trỏ: giữa (bản calib sẽ nối bắn/ADS sau)
      this.fpHands.update(this.viewModel.fpAnchors.gripR, this.viewModel.fpAnchors.gripL);
    }
    if (this.fpArms) this.fpArms.visible = this.viewModel.visible;
    if (this.fpArms && this.fpArmsCfg && this.viewModel.fpAnchors && this.viewModel.visible) {
      this.fpArms.update({ gripR: this.viewModel.fpAnchors.gripR, gripL: this.viewModel.fpAnchors.gripL, handR: this.fpArmsCfg.handR, handL: this.fpArmsCfg.handL, triggerFinger: this.fpArmsCfg.triggerFinger });
    }
    // FX (tracer, lửa nòng, vỏ đạn) nằm ở scene chính: chiếu điểm nòng/cửa thoát từ camera viewmodel sang camera chính (cùng vị trí màn hình)
    this.vmToMain(this.viewModel.muzzleWorld, this.fxMuzzle);
    this.vmToMain(this.viewModel.ejectWorld, this.fxEject);
    this.lastInputDx = 0;
    this.lastInputDy = 0;
    this.feedHud();
    this.hud.update();
    this.fx.update(dt);
    this.blast.update(dt);
    this.updateBattleSmoke(dt);
    this.updateShock(dt);
    this.updateFilm(dt);
    this.vmFlash.position.copy(this.viewModel.muzzleWorld);
    this.vmFlash.intensity = this.fx.muzzleLight.intensity * 0.4; // DV-090: đèn nòng 7 → 12 nên hệ số lớp súng giữ ánh ~ như cũ × 1,5
    this.flares?.update(dt);
    if (this.level) this.level.fx.update(dt);
    if (this.terrain) this.terrain.fx.update(dt);
    if (this.audio.ctx) {
      this.v3.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
      this.audio.setListener(this.camera.position.x, this.camera.position.y, this.camera.position.z, this.v3.x, this.v3.y, this.v3.z);
    }
    if (this.soundscape && this.climate) {
      // đồng hồ cảnh âm tăng theo thời gian chơi (vượn hót quanh bình minh, tắc kè chạng vạng...)
      this.ambElapsedS += dt;
      this.amb.localMin = (this.climate.localMin + this.ambElapsedS / 60) % 1440;
      this.amb.wind = Math.min(1, this.ambWindBase + this.skyGust * 0.9);
      this.soundscape.update(dt, this.amb, this.camera.position);
    }
    if (this.terrain && this.audio.ctx && this.params.get('amb') !== '0') this.updateGroundAudio(dt);
    if (this.terrain) this.updateWader();
    this.lights.followTarget(this.camera);
    (this.lights as { syncShadowLayers?: () => void }).syncShadowLayers?.();
    this.updateActorShadows();
    if (this.terrain) this.terrain.mesh.update(this.camera);
    if (this.sky) this.sky.update(dt, this.camera);
    if (this.forest) {
      // đè cỏ (VEG-006): chân người chơi — D12 mở rộng ≤ 8 tác nhân (bot/xe)
      const f = this.player.controller.feet;
      if (!this.freeFly) this.forest.system.setPress(f[0]!, f[1]!, f[2]!, 0.9);
      else this.forest.system.setPress(0, 0, 0, 0);
      this.forest.system.update(this.camera);
    }
    this.post.stress.value = this.playerSuppression * 0.9;
    {
      const s = this.shock * this.shock * (3 - 2 * this.shock);
      this.post.shock.value = s;
      this.post.shockDir.value.set(Math.cos(this.shockT * 1.9) * 0.012 * s, Math.sin(this.shockT * 1.3) * 0.007 * s);
      this.post.shockFlash.value = this.shockFlash;
    }
    let volEnv: { groundY: number; sigma: number } | undefined;
    if (this.post.volumetric && this.terrain && this.atmosphere) {
      const cp = this.camera.matrixWorld.elements;
      volEnv = { groundY: this.terrain.heightAt(cp[12]!, cp[14]!), sigma: this.atmosphere.sigmaAt(cp[13]!) };
      this.dust?.update(volEnv.groundY);
    }
    if (this.wildlife && this.terrain) {
      const e = this.camera.matrixWorld.elements;
      this.wildlife.update(volEnv?.groundY ?? this.terrain.heightAt(e[12]!, e[14]!));
    }
    this.post.update(this.camera, (this.lights as { sunDir?: [number, number, number] }).sunDir ?? null, volEnv);
    this.post.render();
    readRenderInfo(this.bundle.renderer, this.renderInfo);
    if (!this.pendingTimestamp && (this.bundle.renderer.backend as unknown as { trackTimestamp?: boolean }).trackTimestamp) {
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

  /**
   * DV-087 khói chiến trường: mức nền 0..1 do kịch bản đặt (`fx` kind `haze`) — đổi êm trong vài giây; cộng phần do vụ nổ
   * gần đây (tan dần). Đẩy vào sương thể tích (khói được nắng xuyên thành tia) nếu có.
   */
  setBattleSmoke(level: number): void {
    this.smokeTarget = Math.max(0, Math.min(1, level));
  }

  private updateBattleSmoke(dt: number): void {
    // DV-087: tổ im quá lâu giữa trận → có người hô động viên/bắn trả (kiểm mỗi giây)
    this.rallyAcc += dt;
    if (this.rallyAcc >= 1) {
      this.rallyAcc = 0;
      let fighting = false;
      for (const b of this.bots.values()) {
        if (b.faction === 'enemy' && b.bot.alive && (b.bot.state === 'ENGAGE' || b.bot.state === 'PEEK_FIRE' || b.bot.state === 'FLANK')) {
          fighting = true;
          break;
        }
      }
      this.squadmates.rally(fighting);
    }
    this.smokeBase += (this.smokeTarget - this.smokeBase) * Math.min(1, dt * 0.25);
    this.smokeKick = Math.max(0, this.smokeKick - dt * 0.012);
    const v = this.post.volumetric as { smoke?: { value: number } } | null | undefined;
    if (v?.smoke) v.smoke.value = Math.min(1, this.smokeBase + this.smokeKick);
  }

  /** DV-088 vết cháy xém nằm trên mặt đất (terrain: bám độ cao + pháp tuyến; nổ trên không cao > 2 m thì bỏ) */
  private placeScorch(p: readonly [number, number, number], radius: number, napalm: boolean): void {
    if (!this.scorch) return;
    if (this.terrain) {
      const h = this.terrain.heightAt(p[0], p[2]);
      if (Math.abs(p[1] - h) > 2) return;
      this.scorch.spawn([p[0], h, p[2]], radius, this.terrain.tile.normalAt(p[0], p[2]), napalm);
    } else this.scorch.spawn(p, radius, [0, 1, 0], napalm);
  }

  /**
   * DV-088 choáng nổ theo khoảng cách chân người chơi `dp` tới tâm nổ: k = 1 sát tâm → 0 ở ~4,5 × bán kính (vật che giữa → × che).
   * k > 0,12: ù tai + ù rít, nhìn đôi, loạng choạng ngược phía nổ, chân nặng; k > 0,3 mưa đất; k > 0,35 bùn lên ống kính;
   * k > 0,55 chớp trắng.
   */
  private playerShock(p: readonly [number, number, number], radius: number, dp: number, shield: number): void {
    if (!this.player.alive || this.freeFly || this.params.get('shock') === '0') return;
    const lo = radius * 0.5;
    const hi = radius * 4.5;
    const x = Math.max(0, Math.min(1, (dp - lo) / (hi - lo)));
    const k = (1 - x * x * (3 - 2 * x)) * (shield < 1 ? 0.6 : 1);
    if (k < 0.12) return;
    this.shock = Math.max(this.shock, k);
    this.shockStats.count++;
    this.shockStats.peak = Math.max(this.shockStats.peak, k);
    this.audio.shellShock(k, 2.2 + 4.5 * k);
    if (k > 0.55) this.shockFlash = Math.max(this.shockFlash, (k - 0.55) / 0.45);
    // phía vụ nổ so với hướng nhìn: nổ bên phải → đầu bị hất nghiêng sang trái
    const rel = relDeg(this.cameraHeadingDeg(), bearingOf(p[0] - this.player.controller.feet[0], p[2] - this.player.controller.feet[2]));
    const side = rel >= 0 ? 1 : -1;
    this.player.rig.stumble(k, side);
    const f = this.player.controller.feet;
    if (k > 0.3) this.blast.rain([f[0], f[1], f[2]], k);
    // DV-090 (Chủ nhà: bùn bám kính mà không thấy vụ nổ là không tự nhiên): bùn và đất đá vụt qua mặt chỉ khi vụ nổ nằm
    // trong tầm mắt (±60° quanh hướng nhìn) và không bị che; bùn tới sau khi cục đất bay tới (theo khoảng cách)
    if (k > 0.3 && Math.abs(rel) < 60) {
      this.player.eyePosition(this.v3);
      const e = this.v3;
      if (this.physics.hasLineOfSight(e.x, e.y, e.z, p[0], p[1] + 0.6, p[2])) {
        this.blast.spray(p, [e.x, e.y, e.z], k);
        if (k > 0.35) {
          this.mudPending = Math.hypot(e.x - p[0], e.z - p[2]) / 24 + 0.06;
          this.mudK = k;
          this.mudSide = Math.max(-1, Math.min(1, rel / 60));
        }
      }
    }
  }

  /** DV-089 chất phim theo hồi (mission `fx` kind `film`): chuyển dần trong ~2 s */
  setFilm(level: number): void {
    if (this.params.get('film') === '0') return;
    this.filmTarget = Math.max(0, Math.min(1, level));
  }

  /** DV-089 thế giới lặng đi `seconds` giây (độ sâu 0..1): tiếng trận chìm, tim đập, thoại vẫn rõ */
  hush(depth: number, seconds: number): void {
    this.hushDepth = Math.max(0, Math.min(1, depth));
    this.hushLeft = seconds;
    this.audio.hush(this.hushDepth, seconds);
  }

  /** mức chất phim hiện tại (E2E/debug) */
  get filmLevel(): number {
    return this.film;
  }

  /** DV-089 mỗi frame: màu phim, nhịp màn trập, rung cầm tay theo vận động + áp chế + choáng (ngắm thì đỡ rung) */
  private updateFilm(dt: number): void {
    this.film += (this.filmTarget - this.film) * Math.min(1, dt * 0.6);
    if (Math.abs(this.filmTarget - this.film) < 1e-3) this.film = this.filmTarget;
    this.post.bleach.value = this.film;
    this.blast.staccato = this.film >= 0.5 && this.params.get('staccato') !== '0' ? 24 : 0;
    this.hushLeft = Math.max(0, this.hushLeft - dt);
    const rig = this.player.rig;
    if (this.freeFly || !this.player.alive || this.film <= 0) {
      rig.handheld = 0;
      return;
    }
    const mv = Math.min(1, this.player.controller.horizontalSpeed() / 6);
    const amp = this.film * (0.0035 + 0.006 * mv + 0.004 * this.playerSuppression) + 0.008 * this.shock;
    rig.handheld = amp * (1 - 0.6 * this.player.adsBlend);
  }

  /** DV-088 mỗi frame: choáng tắt dần, chân nặng theo choáng, tim đập khi choáng hoặc máu thấp, bùn ống kính mờ dần */
  private updateShock(dt: number): void {
    this.shockT += dt;
    this.shock = Math.max(0, this.shock - dt * 0.18);
    this.shockFlash = Math.max(0, this.shockFlash - dt * 3.2);
    this.player.controller.speedMul = 1 - 0.45 * this.shock;
    if (this.mudPending > 0) {
      this.mudPending -= dt;
      if (this.mudPending <= 0) this.lensDirt?.splash(this.mudK, this.mudSide);
    }
    this.lensDirt?.update(dt);
    const hp = this.player.alive ? this.player.health : 100;
    const hb = Math.max(this.shock * 0.9, hp < 35 ? ((35 - hp) / 35) * 0.8 : 0, this.hushLeft > 0 ? 0.35 + 0.35 * this.hushDepth : 0);
    if (hb > 0.05 && this.audio.ctx) {
      this.heartAcc += dt;
      if (this.heartAcc >= 60 / (72 + 50 * hb)) {
        this.heartAcc = 0;
        this.audio.heartbeat(hb);
      }
    } else this.heartAcc = 0;
  }

  /** mức choáng nổ hiện tại (E2E/debug) */
  get shockLevel(): number {
    return this.shock;
  }

  /** mức khói chiến trường hiện tại (E2E/debug) */
  get battleSmoke(): number {
    return Math.min(1, this.smokeBase + this.smokeKick);
  }

  /** pháo sáng (M2 R1) — chỉ level terrain đêm; mission bắn qua flag `flares` */
  flares: Flares | null = null;
  /** collider tĩnh của props terrain theo id (gỡ khi bộc phá — M2 R1) */
  private readonly propColliders = new Map<string, RAPIER.Collider>();
  /** thống kê nổ (E2E) */
  readonly blastStats = { count: 0, playerHits: 0, botHits: 0, propsRemoved: 0 };

  /**
   * Nổ bộc phá/lựu đạn tại `position` (M2 R1): FX + âm + rung camera; người chơi trong `radius` mất `damage` (cúi/nằm → ×0,25 —
   * "nằm xuống"), bot trong bán kính trúng như đạn (HIT, shooter player); gỡ prop terrain `prop` (rào) + collider + nav.
   */
  explode(
    position: [number, number, number],
    opts: { radius?: number; damage?: number; botDamage?: number; prop?: string | null; shooter?: string; occlude?: boolean; crouchMul?: number; kind?: 'dirt' | 'napalm' } = {},
  ): void {
    const radius = opts.radius ?? 6;
    const damage = opts.damage ?? 35;
    const botDamage = opts.botDamage ?? damage * 2;
    // vật che giữa tâm nổ và người (thân cây, đồi) giảm sát thương (lựu đạn, DV-074)
    const shield = (x: number, y: number, z: number): number =>
      opts.occlude && !this.physics.hasLineOfSight(position[0], position[1] + 0.35, position[2], x, y, z) ? GRENADE.occludedMul : 1;
    this.blastStats.count++;
    this.fx.explosion(position, radius);
    this.blast.spawn(position, radius, opts.kind ?? 'dirt');
    // mỗi vụ nổ gần làm khói chiến trường dày thêm một chút (tan dần trong ~1 phút)
    const cp = this.camera.position;
    if (Math.hypot(cp.x - position[0], cp.z - position[2]) < 140) this.smokeKick = Math.min(0.6, this.smokeKick + 0.04 + radius * 0.006);
    this.squadmates.blastNear(position[0], position[2]);
    this.audio.explosion(position, 1 + radius / 8);
    const f = this.player.controller.feet;
    const dp = Math.hypot(f[0] - position[0], f[2] - position[2]);
    this.player.rig.shakeAmp = Math.max(this.player.rig.shakeAmp, Math.min(1, 1.6 * (1 - Math.min(1, dp / (radius * 3)))));
    this.placeScorch(position, radius, opts.kind === 'napalm');
    this.playerShock(position, radius, dp, opts.occlude ? shield(f[0], f[1] + 1.0, f[2]) : 1);
    if (dp <= radius && this.player.alive) {
      const st = this.player.controller.stance;
      // DV-090 nằm sát đất: mảnh văng phần lớn bay qua đầu (× 0,6 hệ số cúi)
      const crouched = st !== 'stand';
      const lowMul = st === 'prone' ? 0.6 : 1;
      const fall = 1 - (dp / radius) * 0.5;
      const d = Math.round(damage * fall * (crouched ? (opts.crouchMul ?? 0.25) * lowMul : 1) * shield(f[0], f[1] + 1.0, f[2]));
      this.blastStats.playerHits++;
      this.events.emit('HIT', { actorId: 'player', zone: 'body', damage: d, point: position, penetrated: false, shooter: opts.shooter ?? 'blast', blast: true });
    }
    for (const b of this.bots.values()) {
      if (!b.bot.alive) continue;
      const db = Math.hypot(b.bot.position[0] - position[0], b.bot.position[2] - position[2]);
      if (db > radius) continue;
      const p = b.bot.position;
      const d = Math.round(botDamage * (1 - (db / radius) * 0.5) * (b.bot.stance === 'crouch' ? 0.75 : 1) * shield(p[0], p[1] + 0.9, p[2]));
      if (d <= 0) continue;
      this.blastStats.botHits++;
      this.events.emit('HIT', { actorId: b.id, zone: 'body', damage: d, point: position, penetrated: false, shooter: opts.shooter ?? 'player', blast: true });
    }
    if (opts.prop) this.removeProp(opts.prop);
  }

  /**
   * Thoại lên phụ đề → phát giọng (DV-076): tra `<cue>.<SPEAKER>.h<giờ>` → `<cue>.<SPEAKER>` → `<cue>`. Người trong tổ nói thì
   * tiếng phát 3D tại chỗ người đó (xa > 2,5 m), bộ đàm qua lọc radio. Trả thời lượng (ms) để phụ đề giữ đủ lâu.
   */
  speak(req: CueRequest): number {
    if (req.cue === 'M61') this.enemyRadio();
    // chưa mở âm (chưa có thao tác người dùng, test không âm): không giữ phụ đề lâu hơn kịch bản
    if (!this.audio.ctx) return 0;
    const key = this.voice.resolve(voiceKeys(req.cue, req.speaker, req.vars));
    if (!key) return 0;
    const radio = req.bus === 'radio';
    let position: [number, number, number] | undefined;
    const who = radio ? null : this.squadmates.actorOfSpeaker(req.speaker);
    if (who && who.bot.alive) {
      const p = who.bot.position;
      const f = this.player.controller.feet;
      if (Math.hypot(p[0] - f[0], p[2] - f[2]) > 2.5) position = [p[0], p[1] + who.bot.eyeHeight, p[2]];
    }
    this.stopSpeech();
    return this.voice.play(key, radio ? 'radio' : 'dialogue', { position, radio, channel: 'line', onStop: (s) => (this.stopVoice = s) });
  }

  stopSpeech(): void {
    this.voice.cancel('line');
    this.stopVoice?.();
    this.stopVoice = null;
  }

  /** câu hô của địch: 3D tại người nói, ≤ 70 m; giọng theo mã lính */
  private playChatter(botId: string, kind: ChatterKind): boolean {
    const b = this.bots.get(botId);
    if (!b || (!b.bot.alive && kind !== 'hit')) return false;
    const p = b.bot.position;
    const c = this.camInfo.pos;
    if (Math.hypot(p[0] - c[0], p[2] - c[2]) > 70) return false;
    const key = kind === 'radio' ? 'en.radio.ERADIO' : `en.${kind}.${enemyVoiceOf(botId, 4)}`;
    if (!this.voice.manifest?.lines[key]) return false;
    return this.voice.play(key, 'dialogue', { position: [p[0], p[1] + b.bot.eyeHeight, p[2]], radio: kind === 'radio', gain: 0.95 }) > 0;
  }

  /** địch gần chỗ đồng đội ngã (≤ 25 m) hô "Man down!" */
  private enemyManDown(at: readonly number[], killer: readonly number[]): void {
    let best: string | null = null;
    let bd = 25;
    for (const o of this.bots.values()) {
      if (o.faction !== 'enemy' || !o.bot.alive) continue;
      const d = Math.hypot(o.bot.position[0] - at[0]!, o.bot.position[2] - at[2]!);
      // DV-083: thấy/nghe đồng đội gục trong 35 m → cả nhóm báo động về hướng kẻ bắn (không còn bắn tỉa từng người một)
      if (d < 35) o.bot.alertTo([killer[0]! + (this.prng.next() - 0.5) * 6, killer[1]! + 1.6, killer[2]! + (this.prng.next() - 0.5) * 6]);
      if (d < bd) {
        bd = d;
        best = o.id;
      }
    }
    if (best) this.chatter.say(best, 'mandown');
  }

  /** điện đài viên địch gọi trực thăng (cue M61) */
  private enemyRadio(): void {
    const f = this.player.controller.feet;
    let best: string | null = null;
    let bd = Infinity;
    for (const o of this.bots.values()) {
      if (o.faction !== 'enemy' || !o.bot.alive) continue;
      const d = Math.hypot(o.bot.position[0] - f[0], o.bot.position[2] - f[2]);
      if (d < bd) {
        bd = d;
        best = o.id;
      }
    }
    if (best) this.chatter.say(best, 'radio');
  }

  /**
   * Ném lựu đạn của người chơi (DV-074): từ mắt theo hướng nhìn nâng thêm pitchUpDeg, tốc độ `player.speed`. Trả false khi hết,
   * đang hồi hoặc đã chết.
   */
  throwGrenade(): boolean {
    const P = GRENADE.player;
    const now = this.clock.simTime * 1000;
    if (!this.player.alive || this.playerGrenades <= 0 || now < this.grenadeCdUntil) return false;
    this.player.eyePosition(this.v3);
    this.player.aimDirection(this.v3b, false);
    const h = Math.hypot(this.v3b.x, this.v3b.z) || 1;
    const pitch = Math.min((70 * Math.PI) / 180, Math.asin(Math.max(-1, Math.min(1, this.v3b.y))) + (P.pitchUpDeg * Math.PI) / 180);
    const hx = this.v3b.x / h;
    const hz = this.v3b.z / h;
    const from: [number, number, number] = [this.v3.x + hx * 0.4, this.v3.y - 0.15, this.v3.z + hz * 0.4];
    const vel: [number, number, number] = [hx * Math.cos(pitch) * P.speed, Math.sin(pitch) * P.speed, hz * Math.cos(pitch) * P.speed];
    if (!this.grenades.spawn(from, vel, 'player', 'player')) return false;
    this.playerGrenades--;
    this.grenadeCdUntil = now + P.cooldownMs;
    this.audio.grenadeThrow();
    // ném lựu đạn = tiếng động (địch quay về hướng này như tiếng súng nhỏ)
    this.events.emit('PLAYER_FOOTSTEP', { origin: [this.player.controller.feet[0], this.player.controller.feet[1], this.player.controller.feet[2]] });
    return true;
  }

  private grenadeBlast(g: Grenade): void {
    this.warnedGrenades.delete(g.id);
    this.explode([g.pos[0], g.pos[1], g.pos[2]], { radius: GRENADE.radius, damage: GRENADE.playerDamage, botDamage: GRENADE.botDamage, shooter: g.owner, occlude: true, crouchMul: 0.6 });
  }

  /** lựu đạn địch rơi gần người chơi/tổ ta: tổ ta hô "Lựu đạn!", HUD chỉ hướng */
  private grenadeWarnings(): void {
    const f = this.player.controller.feet;
    let warn: Grenade | null = null;
    let wd = Infinity;
    for (const g of this.grenades.live()) {
      if (g.faction !== 'enemy') continue;
      const d = Math.hypot(g.pos[0] - f[0], g.pos[2] - f[2]);
      if (d < wd && (g.landed || d < GRENADE.ai.fleeRadius)) {
        wd = d;
        warn = g;
      }
      if (!this.warnedGrenades.has(g.id) && (g.landed || d < GRENADE.ai.fleeRadius) && d < GRENADE.ai.warnRadius) {
        this.warnedGrenades.add(g.id);
        let caller: string | null = null;
        let cd = Infinity;
        for (const b of this.squadmates.list()) {
          if (!b.bot.alive) continue;
          const db = Math.hypot(b.bot.position[0] - g.pos[0], b.bot.position[2] - g.pos[2]);
          if (db < cd) {
            cd = db;
            caller = b.id;
          }
        }
        if (caller) this.squadmates.warnGrenade(caller);
      }
    }
    const hs = this.hud.state;
    if (warn && wd <= GRENADE.radius + 3 && this.player.alive) {
      hs.grenadeWarnDeg = relDeg(this.cameraHeadingDeg(), bearingOf(warn.pos[0] - f[0], warn.pos[2] - f[2]));
      hs.grenadeWarnDist = wd;
    } else hs.grenadeWarnDeg = null;
  }

  /**
   * Đạn địch sượt qua người chơi (DV-075): điểm gần nhất của tia tới mắt ≤ 2,5 m, trước điểm đó không bị đất/cây chặn → tiếng
   * "chát/víu" 3D tại điểm đó, rung nhẹ, thanh áp chế tăng (tối viền + mất màu, hồi sau 0,8 s yên).
   */
  private playerNearMiss(origin: readonly number[], dir: readonly number[], faction?: string): void {
    if ((faction ?? 'enemy') !== 'enemy' || !this.player.alive || this.freeFly) return;
    this.player.eyePosition(this.v3);
    const ex = this.v3.x - origin[0]!;
    const ey = this.v3.y - origin[1]!;
    const ez = this.v3.z - origin[2]!;
    const tt = ex * dir[0]! + ey * dir[1]! + ez * dir[2]!;
    if (tt < 3 || tt > aiTuning.combat.range) return;
    const cx = origin[0]! + dir[0]! * tt;
    const cy = origin[1]! + dir[1]! * tt;
    const cz = origin[2]! + dir[2]! * tt;
    const d = Math.hypot(this.v3.x - cx, this.v3.y - cy, this.v3.z - cz);
    if (d > 2.5) return;
    if (!this.physics.hasLineOfSight(origin[0]!, origin[1]!, origin[2]!, cx, cy, cz)) {
      this.nearMissStats.blocked++;
      return;
    }
    const k = 1 - d / 2.5;
    this.nearMissStats.count++;
    this.audio.nearMiss([cx, cy, cz], k);
    this.playerSuppression = Math.min(1, this.playerSuppression + 0.07 + 0.16 * k);
    this.suppLastAt = this.clock.simTime;
    this.player.rig.shakeAmp = Math.max(this.player.rig.shakeAmp, 0.06 + 0.1 * k);
    // DV-088 đạn trong loạt cắm đất quanh chân (đất bắn tung, tiếng phụp): hơn nửa số lần sượt, lệch về phía đạn bay qua
    if (this.terrain && this.fxRng.next() < 0.6) {
      const f = this.player.controller.feet;
      const hx = dir[0]!;
      const hz = dir[2]!;
      const hl = Math.hypot(hx, hz) || 1;
      const px = -hz / hl;
      const pz = hx / hl;
      const side = (cx - f[0]) * px + (cz - f[2]) * pz >= 0 ? 1 : -1;
      const lat = side * (0.7 + this.fxRng.next() * 2.4);
      const fwd = -1 + this.fxRng.next() * 4.5;
      const ix = f[0] + px * lat + (hx / hl) * fwd;
      const iz = f[2] + pz * lat + (hz / hl) * fwd;
      this.shockStats.dirtKicks++;
      this.events.emit('IMPACT', { point: [ix, this.terrain.heightAt(ix, iz), iz], normal: this.terrain.tile.normalAt(ix, iz), material: 'earth', penetrated: false });
    }
  }

  /** gỡ prop terrain (ẩn + collider) — trả false nếu không có */
  removeProp(id: string): boolean {
    const ok = this.terrain?.props.remove(id) ?? false;
    const col = this.propColliders.get(`prop_${id}`);
    if (col) {
      this.physics.removeCollider(col);
      this.propColliders.delete(`prop_${id}`);
    }
    if (ok) this.blastStats.propsRemoved++;
    return ok;
  }

  /**
   * DV-063 âm thanh mặt đất: tiếng suối từ 3 khe có nước gần nhất (cập nhật 4 lần/giây) và tiếng bước chân người chơi theo
   * mặt đất dưới chân (lá mục, đất nện, bùn, đá, nước) mỗi sải chân.
   */
  private updateGroundAudio(dt: number): void {
    const tile = this.terrain!.tile;
    const F = tile.features;
    this.brookTimer -= dt;
    if (F && this.brookTimer <= 0) {
      this.brookTimer = 0.25;
      const cp = this.camera.position;
      const em = streamEmitters(F.data, cp.x, cp.z, 3, 140);
      for (let i = 0; i < 3; i++) {
        if (!this.brooks[i]) this.brooks[i] = this.audio.brook();
        const b = this.brooks[i];
        const e = em[i];
        if (!b) continue;
        if (!e) {
          b.set(cp, 0);
          continue;
        }
        const y = this.terrain!.heightAt(e.x, e.z) + 0.2;
        b.set({ x: e.x, y, z: e.z }, (0.3 + 0.7 * e.size) * (0.55 + Math.min(1, e.grade * 8) * 0.6));
      }
    }
    const c = this.player.controller;
    if (!this.player.alive || !c.grounded) {
      this.stepAcc = 0;
      return;
    }
    const v = c.horizontalSpeed();
    if (v < 0.3) {
      this.stepAcc = Math.min(this.stepAcc, 0.5);
      return;
    }
    const crouch = c.stance === 'crouch';
    // DV-090 bò: nhịp lê người sột soạt 0,45 m, nhỏ
    const prone = c.stance === 'prone';
    const stride = this.player.isSprinting ? 1.3 : prone ? 0.45 : crouch ? 0.6 : 0.85;
    this.stepAcc += (v * dt) / stride;
    if (this.stepAcc >= 1) {
      this.stepAcc -= 1;
      const f = c.feet;
      tile.normalAt(f[0], f[2], this.stepNormal);
      const surf = groundSurface(F, f[0], f[2], 1 - this.stepNormal[1]);
      this.audio.footstep(surf, this.player.isSprinting ? 1 : prone ? 0.22 : crouch ? 0.35 : 0.65);
      this.lastStepSurface = surf;
    }
  }

  /** DV-063: gợn nước quanh chân khi người chơi lội suối/hố (độ mạnh theo tốc độ) */
  private updateWader(): void {
    const w = this.terrain?.water;
    const F = this.terrain?.tile.features;
    if (!w || !F) return;
    const f = this.player.controller.feet;
    const inWater = F.distance('water', f[0], f[2]) < 0.3;
    w.setWader(f[0], f[2], inWater ? Math.min(1, 0.25 + this.player.controller.horizontalSpeed() / 3) : 0);
  }

  /** id súng bot theo gói phe (DV-061, `content/factions/factions.json`); thiếu asset súng → AK-47 */
  weaponIdFor(faction: Faction, archetype?: string): string {
    if (this.botWeaponId) return this.botWeaponId;
    const w = factionLook(this.factionPack, faction === 'friend' ? 'friend' : 'enemy', archetype).weapon;
    return this.assets?.weapons[w] ? w : 'ak47';
  }

  /** vẻ ngoài theo gói phe (DV-061): súng, vải, trang bị */
  lookFor(faction: Faction, archetype?: string): FactionLook {
    return factionLook(this.factionPack, faction === 'friend' ? 'friend' : 'enemy', archetype);
  }

  private weaponFor(faction: Faction): WeaponAsset | null {
    return this.assets?.weapons[this.weaponIdFor(faction)] ?? null;
  }

  spawnBot(id: string, group: string, spawn: [number, number, number], opts: { faction?: Faction; nameKey?: string | null; archetype?: 'grunt' | 'recon' | 'squad'; waypoints?: Array<[number, number, number]>; support?: boolean } = {}): BotActor {
    const existing = this.bots.get(id);
    if (existing) return existing;
    const faction: Faction = opts.faction ?? 'enemy';
    const recon = opts.archetype === 'recon';
    // vẻ ngoài theo gói phe (DV-061): gói 'fictional' mặc định, 'historical-1971' giữ hành vi DV-046
    const look = this.lookFor(faction, opts.archetype);
    const visual = createActorVisual(
      this.quality.character ? this.assets?.character ?? null : null,
      { color: recon ? 0x3a3a2a : 0x5a3a35, visor: 0xff5a2a, phase: id.length, seed: hashSeed(id), skin: look.skin, gear: look.gear },
      this.assets?.weapons[this.weaponIdFor(faction, opts.archetype)] ?? null,
    );
    const target = { pos: [0, 0, 0] as [number, number, number], eye: [0, 0, 0] as [number, number, number], alive: false, isPlayer: false };
    const b = new BotActor(id, group, spawn, this.scene, this.physics, visual, {
      physics: this.physics,
      nav: this.nav,
      events: this.events as unknown as EventBus<BotEvents>,
      prng: this.prng,
      waypoints: opts.waypoints && opts.waypoints.length >= 2 ? opts.waypoints : this.arena.waypoints,
      coverMarkers: this.arena.coverMarkers,
      tactics: this.tactics ?? undefined,
      reservations: this.coverReservations,
      cinematic: faction === 'enemy',
      grenades: this.grenadeLink,
      target: () => this.nearestHostile(b, target),
      camera: () => this.camInfo,
      groundHeight: this.terrain ? (x, z) => this.terrain!.heightAt(x, z) : undefined,
      sightOcclusion: this.sightOcclusion && faction === 'enemy' ? this.sightOcclusion : undefined,
      faction,
      hitMask: faction === 'friend' ? LAYER.WORLD | LAYER.ACTOR : LAYER.WORLD | LAYER.PLAYER | LAYER.ACTOR,
      followGoal: faction === 'friend' ? (opts.support ? this.support : this.squadmates).goalFor(id) : undefined,
      escort: faction === 'friend' ? (opts.support ? this.support : this.squadmates).escortFor(id) : undefined,
    });
    b.faction = faction;
    b.nameKey = opts.nameKey ?? null;
    if (this.terrain) visual.ground = (x, z) => this.terrain!.heightAt(x, z);
    b.aiSlot = this.aiSlotNext++;
    this.spawnStats[faction === 'enemy' ? 'enemy' : 'friend']++;
    this.bots.set(id, b);
    this.squad?.add({ group, bot: b.bot, friend: faction === 'friend' });
    return b;
  }

  /** điểm người chơi đang nhắm (tia WORLD ≤ 150 m), không trúng gì → 40 m phía trước (lệnh tổ) */
  private aimPoint(): [number, number, number] {
    this.player.eyePosition(this.v3);
    this.player.aimDirection(this.v3b, false);
    const hit = this.physics.castRay(this.v3.x, this.v3.y, this.v3.z, this.v3b.x, this.v3b.y, this.v3b.z, 150, LAYER.WORLD);
    if (hit) return [hit.point[0], hit.point[1], hit.point[2]];
    return [this.v3.x + this.v3b.x * 40, this.v3.y + this.v3b.y * 40, this.v3.z + this.v3b.z * 40];
  }

  /** địch còn sống (vé tấn công) */
  private *enemyBots(): Iterable<Bot> {
    for (const b of this.bots.values()) if (b.faction === 'enemy') yield b.bot;
  }

  /**
   * Chỗ nấp tự sinh (AI-T1.1, DV-071): thân cây (collider trụ của rừng) + hố bom (terrainFeatures) + marker level; kiểm che bằng
   * tia tĩnh (WORLD). Dựng một lần sau navmesh.
   */
  private buildTactics(): void {
    const t0 = performance.now();
    const nav = this.nav;
    const terrain = this.terrain;
    const field = new CoverField({
      los: (ax, ay, az, bx, by, bz) => this.physics.hasLineOfSight(ax, ay, az, bx, by, bz),
      ground: (x, z) => (terrain ? terrain.heightAt(x, z) : nav.nearest({ x, y: 0, z })?.y ?? null),
      walkable: (x, y, z) => {
        const n = nav.nearest({ x, y, z });
        return n ? [n.x, n.y, n.z] : null;
      },
    });
    if (this.forest) field.addTreeColliders(this.forest.system.colliders, { standoffFor: (id) => navPadFor(id, 0.05) });
    for (const c of terrain?.tile.features?.data.craters ?? []) field.addCrater(c.x, c.z, c.r);
    for (const m of this.arena.coverMarkers) field.addMarker(m.position[0], m.position[1], m.position[2]);
    this.tactics = new TacticalEvaluator(field);
    console.info(`[ai] cover field: ${field.stats.trees} trees, ${field.stats.craters} craters, ${field.stats.markers} markers, ${(performance.now() - t0).toFixed(1)} ms`);
  }

  /** mục tiêu gần nhất khác phe (TIP-M1A): địch → người chơi/đồng đội; đồng đội → địch. Không có → alive=false (bot tuần tra/theo) */
  private nearestHostile(self: BotActor, out: { pos: [number, number, number]; eye: [number, number, number]; alive: boolean; isPlayer: boolean }): { pos: [number, number, number]; eye: [number, number, number]; alive: boolean; isPlayer: boolean } {
    const p = self.bot.position;
    let best = Infinity;
    let found = false;
    out.isPlayer = false;
    if (self.faction === 'enemy') {
      const ti = this.targetInfo;
      if (ti.alive) {
        // DV-083: địch ưu tiên người chơi — đồng đội chỉ thành mục tiêu khi gần hơn hẳn (< 0,55 × cự ly tới người chơi)
        best = Math.hypot(ti.pos[0] - p[0], ti.pos[2] - p[2]) * 0.55;
        out.pos[0] = ti.pos[0]; out.pos[1] = ti.pos[1]; out.pos[2] = ti.pos[2];
        out.eye[0] = ti.eye[0]; out.eye[1] = ti.eye[1]; out.eye[2] = ti.eye[2];
        out.isPlayer = true;
        found = true;
      }
    }
    for (const o of this.bots.values()) {
      if (o === self || !o.bot.alive || o.faction === self.faction) continue;
      const q = o.bot.position;
      const d = Math.hypot(q[0] - p[0], q[2] - p[2]);
      if (d < best) {
        best = d;
        out.pos[0] = q[0]; out.pos[1] = q[1]; out.pos[2] = q[2];
        out.eye[0] = q[0]; out.eye[1] = q[1] + o.bot.eyeHeight; out.eye[2] = q[2];
        out.isPlayer = false;
        found = true;
      }
    }
    if (!found) {
      out.pos[0] = 1e5; out.pos[1] = 0; out.pos[2] = 1e5;
      out.eye[0] = 1e5; out.eye[1] = 1.6; out.eye[2] = 1e5;
    }
    out.alive = found;
    return out;
  }

  private actorShadowTick = 0;
  /**
   * DV-086: lính (người và súng) ở xa hơn 35 m (đã ngã: 15 m) không đổ bóng — mỗi cascade CSM vẽ lại mọi caster, 16 lính × 4 mesh
   * × 2 cascade là hàng trăm draw call mà bóng người ở xa trong rừng không nhìn thấy. Đổi castShadow không biên dịch lại shader.
   * Duyệt lại mỗi 8 frame (mô hình glTF có thể nạp sau khi lính ra).
   */
  private updateActorShadows(): void {
    if ((this.actorShadowTick++ & 7) !== 0) return;
    const c = this.camera.position;
    for (const b of this.bots.values()) {
      const p = b.bot.position;
      const on = Math.hypot(p[0] - c.x, p[2] - c.z) < (b.bot.alive ? 35 : 15);
      b.dummy.group.traverse((o) => {
        const m = o as unknown as { isMesh?: boolean; castShadow: boolean; userData: { castBase?: boolean } };
        if (!m.isMesh) return;
        m.userData.castBase ??= m.castShadow; // giữ cờ gốc (lửa nòng, kính… vốn không đổ bóng)
        m.castShadow = on && m.userData.castBase;
      });
    }
  }

  /**
   * QA (DV-085): dừng kịch bản (test vật lý/rừng/giọng/lựu đạn đo trên level mà M1 mở màn bằng phục kích): đồ thị nhiệm vụ đứng
   * yên (phụ đề, tương tác vẫn chạy), gỡ địch, huỷ đòn chờ, tổ về theo người chơi
   */
  calm(): void {
    this.mission.paused = true;
    this.mission.battle?.clearPending();
    for (const b of [...this.bots.values()]) if (b.faction === 'enemy') this.despawnBot(b.id);
    this.squadmates.setOrder('follow');
    this.squadmates.pace = 'normal';
    this.support.setOrder('follow');
    this.support.pace = 'normal';
    this.mission.squadDest = null;
    this.mission.objectiveMarker = null;
    this.mission.markerOnLeader = false;
  }

  /**
   * DV-084 đồng đội hy sinh theo kịch bản (mission `squad_kill`): bỏ sàn máu friendMinHealth, ngã chết như trúng đạn, rời tổ.
   * Trả false nếu không tìm thấy hoặc đã chết.
   */
  killSquadmate(id: string): boolean {
    const b = this.bots.get(id);
    if (!b || !b.bot.alive || b.faction !== 'friend') return false;
    const p = b.bot.position;
    const died = b.applyDamage(9999, [p[0] + 1, p[1] + 1.5, p[2]], 'body');
    if (!died) return false;
    this.events.emit('ACTOR_DIED', { actorId: b.id, group: b.group });
    // DV-087: người còn lại gào tên đồng đội vừa ngã
    this.squadmates.buddyDown(b.id, b.nameKey ?? null);
    this.squadmates.remove(b.id);
    this.support.remove(b.id);
    return true;
  }

  /**
   * DV-091: enemy corpses used to stay for the whole mission (≈120 skinned bodies by the last act: draw calls, skinning,
   * physics, a growing bots map). A body is removed once it has lain long enough and the player is not looking at it;
   * at most one per sweep (10 Hz) so removals never pile into one frame.
   */
  private sweepCorpses(): void {
    const now = this.clock.simTime;
    const f = this.player.controller.feet;
    this.camera.getWorldDirection(this.v3);
    let dead = 0;
    for (const b of this.bots.values()) if (!b.bot.alive && b.faction === 'enemy') dead++;
    const keepS = dead > CORPSE.crowd ? CORPSE.shortS : CORPSE.keepS;
    for (const b of this.bots.values()) {
      if (b.bot.alive || b.faction !== 'enemy') continue;
      if (b.diedAt < 0) b.diedAt = now;
      if (now - b.diedAt < keepS) continue;
      const p = b.bot.position;
      const dx = p[0] - f[0];
      const dz = p[2] - f[2];
      const d = Math.hypot(dx, dz);
      const inView = d < CORPSE.farM && (dx * this.v3.x + dz * this.v3.z) / Math.max(1e-3, d) > 0.2;
      if (inView && d > CORPSE.nearM) continue;
      if (d <= CORPSE.nearM) continue; // under the player's feet: leave it
      this.despawnBot(b.id);
      this.corpseStats.cleared++;
      return;
    }
  }

  despawnBot(id: string): void {
    const b = this.bots.get(id);
    if (!b) return;
    this.squad?.remove(b.bot);
    b.dispose(this.scene);
    this.bots.delete(id);
    this.squadmates.remove(id);
    this.support.remove(id);
  }

  /** sang level khác (giữ tham số URL trừ level) — tải lại trang (mỗi level dựng lại renderer/physics/nav) */
  gotoLevel(id: string): void {
    const p = new URLSearchParams(this.params);
    p.set('level', id);
    window.location.search = p.toString();
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
    this.smokeKick = 0;
    this.shock = this.shockFlash = 0;
    this.mudPending = 0;
    this.ammoGivenAt.clear();
    this.resupplyHold = 0;
    this.film = this.filmTarget = this.filmDefault;
    this.hushLeft = 0;
    this.player.controller.speedMul = 1;
    this.audio.clearShock();
    this.lensDirt?.reset();
    this.scorch?.reset();
    this.viewModel.reset();
    for (const b of this.bots.values()) b.reset();
    this.coverReservations.clear();
    this.squad?.resetGroups();
    this.tokens.reset();
    this.lastHurtAt = -1e9;
    this.grenades.clear();
    this.playerSuppression = 0;
    this.playerGrenades = GRENADE.player.count;
    this.grenadeCdUntil = 0;
    this.lastEnemyThrowAt = -1e9;
    this.groupThrowAt.clear();
    this.warnedGrenades.clear();
    this.chatter.reset();
    this.stopSpeech();
    this.mission.reset();
    this.nightAct?.reset();
    if (this.freeFly) {
      this.freeFly.yaw = 0;
      this.freeFly.pitch = 0;
    }
    for (const h of this.resetHooks) h(seed);
    this.frames = 0;
    this.events.emit('GAME_RESET', { seed });
  }
}
