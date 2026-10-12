/**
 * Hồi đêm "Ngầm Ta Lê" (DV-078) — tích hợp với Game: hình (8 xe ZIL-157, ụ DShKM, AC-130, Thu, phụ xạ Đạt, lái xe bị thương,
 * lửa xe cháy, vệt đạn), âm (máy xe, động cơ AC-130, súng máy bay tới trễ theo tốc độ âm, 12,7), HUD (đếm xe, thước ngắm vòng,
 * nhắc phím), tương tác (F ngồi/rời súng, giữ F đẩy xe/kéo lái xe), thoại theo sự kiện và cờ nhiệm vụ.
 * Logic thuần ở NightLogic (đoàn xe/máy bay/súng); ở đây chỉ đọc trạng thái + nối input.
 *
 * Nhịp: Game.simStep gọi `preStep` (trước player: ngồi súng thì khoá di chuyển, nòng theo hướng nhìn, chạy logic) và `postStep`
 * (cuối tick: nhắc phím, ngồi/rời súng, đẩy/cứu, HUD); render gọi `render` sau camera (ngồi súng: mắt ở thước ngắm).
 */
import { Group, Mesh, BoxGeometry, CylinderGeometry, SphereGeometry, MeshStandardNodeMaterial, MeshBasicNodeMaterial, AdditiveBlending, PointLight, Vector3, type Object3D, type Material, type MeshStandardMaterial } from 'three/webgpu';
import { toStandardNodeMaterial } from '@engine/render/characters';
import type { Game } from '@game/game';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { InputSnapshot } from '@engine/input/input';
import type { TerrainLevelDef } from '@engine/terrain/level';
import { loadModel } from '@engine/render/assets';
import { createGltfLoader } from '@engine/render/loaders';
import { createAmbientFx, type AmbientFx } from '@engine/render/ambientFx';
import type { FxDef } from '@engine/level/types';
import { createActorVisual, type ActorVisual } from '@game/actors/visual';
import { t } from '@ui/i18n';
import nightJson from '@content/tuning/night.json';
import { NightLogic, type NightConfig } from './nightLogic';
import type { ConvoyEvent, ConvoySnapshot } from './convoy';
import type { GunshipPhase, GunshipSnapshot, Shell } from './gunship';
import { ThuView } from './thuView';
import { Streaks, Flashes } from './streaks';

export const NIGHT: NightConfig = nightJson as unknown as NightConfig;

type V3 = [number, number, number];

interface TruckView {
  root: Group;
  body: Object3D;
  charred: boolean;
  /** đèn gầm (2 ô phát sáng dưới ba-đờ-xốc) */
  glow: Mesh;
  /** vật liệu gốc (trả lại khi nạp checkpoint/reset) */
  orig: Map<Mesh, Material | Material[]>;
  /** hộp va chạm kinematic (người chơi không đi xuyên xe) */
  phys: { body: RAPIER.RigidBody; collider: RAPIER.Collider } | null;
}

interface AircraftSound {
  set(pos: { x: number; y: number; z: number }, vel: { x: number; y: number; z: number }): void;
  stop(): void;
}

const _v = new Vector3();
const _pose = { x: 0, z: 0, dx: 0, dz: 1 };

export class NightAct {
  readonly logic: NightLogic;
  mounted = false;
  /** đã ngồi súng lần nào (cờ gun_manned) */
  private everMounted = false;
  private readonly root = new Group();
  private readonly trucks: TruckView[] = [];
  private gunRoot: Group | null = null;
  private gunYaw: Object3D | null = null;
  private gunPitch: Object3D | null = null;
  private gunship: Group | null = null;
  private thu: ThuView | null = null;
  private dat: ActorVisual | null = null;
  private readonly drivers = new Map<number, ActorVisual>();
  private fires: AmbientFx | null = null;
  private readonly fireOf = new Map<number, number>();
  private readonly streaks = new Streaks();
  private readonly flashes: Flashes;
  private readonly fordLight = new PointLight(0xcfe0ff, 0, 9, 1.6);
  private readonly muzzleLight = new PointLight(0xffc070, 0, 14, 1.4);
  private muzzleLife = 0;
  private drone: AircraftSound | null = null;
  private readonly engines: Array<AircraftSound | null> = [];
  private readonly charredMat = new MeshStandardNodeMaterial({ color: 0x14110e, roughness: 1, metalness: 0 });
  private readonly gunBase: V3;
  private readonly thuPos: V3;
  private readonly thuYaw: number;
  /** đầu vào đẩy/cứu tính ở postStep, logic dùng ở preStep tick sau */
  private readonly pushing = new Map<number, number>();
  private rescuing: number | null = null;
  private zoom = 0;
  private readonly lastSaid = new Map<string, number>();
  private speakerTurn = 0;
  private endT = -1;
  private resultSaid = false;
  private squadDestOwned = false;
  private readonly cps = new Map<string, { convoy: ConvoySnapshot; gunship: GunshipSnapshot; mounted: boolean; everMounted: boolean }>();
  private lastBurstAt: Record<'vulcan' | 'minigun', number> = { vulcan: -1, minigun: -1 };
  private shotN = 0;
  readonly stats = { mounts: 0, dismounts: 0, pushTicks: 0, rescueTicks: 0, lines: 0 };

  constructor(
    private readonly game: Game,
    level: TerrainLevelDef,
  ) {
    const road = level.roads?.find((r) => r.id === NIGHT.convoy.road);
    if (!road) throw new Error(`[night] level ${level.id} has no road ${NIGHT.convoy.road}`);
    const ground = (x: number, z: number): number => game.terrain!.heightAt(x, z);
    const gz = level.zones['gun']!.center;
    this.gunBase = [gz[0], ground(gz[0], gz[1]), gz[1]];
    const tz = level.zones['thu']!.center;
    this.thuPos = [tz[0], ground(tz[0], tz[1]), tz[1]];
    // Thu nhìn về hàng xe (ngược chiều chạy)
    const r0 = road.pts[0]!;
    const r1 = road.pts[1]!;
    const ux = r1[0] - r0[0];
    const uz = r1[1] - r0[1];
    this.thuYaw = Math.atan2(-ux, -uz);
    this.logic = new NightLogic(NIGHT, road.pts, this.gunBase, ground, game.prng.fork('night'), {
      convoy: (e) => this.onConvoy(e),
      shellFired: (s) => this.onShellFired(s),
      shellImpact: (s) => this.onShellImpact(s),
      gunshipPhase: (p, prev) => this.onPhase(p, prev),
      gunshipWarn: () => this.say('N12', this.squadSpeaker('QUYET'), 6),
      gunshipHit: () => undefined,
      gunFire: (m, d, tr) => this.onGunFire(m, d, tr),
      gunHitAir: (at) => {
        this.flashes.fire(at, 2.2, 0.08, 2.4, 1.8, 0.9);
        if (this.mounted) game.hud.hit(false);
      },
      gunGround: (at) => this.groundImpact(at),
      gunReload: () => game.audio.reload(),
      playerHit: (dmg, at) => game.events.emit('HIT', { actorId: 'player', zone: 'body', damage: dmg, point: [at[0]!, at[1]!, at[2]!], penetrated: false, shooter: 'gunship', blast: true }),
    });
    this.root.name = 'night_act';
    this.flashes = new Flashes(this.root, 14);
    this.root.add(this.streaks.mesh, this.fordLight, this.muzzleLight);
    game.scene.add(this.root);
    game.events.on('MISSION_FLAG', (e) => {
      if (e.flag === 'convoy_go' && e.value) this.logic.convoy.go = true;
      if (e.flag === 'gunship' && e.value) this.logic.gunship.arrive();
    });
  }

  /** nạp model (song song); lite (`assets=0`) dùng khối thay thế nhẹ */
  async load(): Promise<void> {
    const g = this.game;
    const base = `${import.meta.env.BASE_URL ?? '/'}assets/`;
    const full = g.quality.assets || g.params.get('nightModels') === '1';
    const safe = async (url: string): Promise<Group | null> => {
      try {
        return await loadModel(url);
      } catch (e) {
        console.warn(`[night] model missing ${url}: ${(e as Error).message ?? e}`);
        return null;
      }
    };
    const [truck, gun, c130, lamp, hat, thuGltf] = full
      ? await Promise.all([
          safe(`${base}models/veh_zil157.glb`),
          safe(`${base}models/wpn_dshk.glb`),
          safe(`${base}models/air_c130.glb`),
          safe(`${base}models/vintage_oil_lamp.glb`),
          safe(`${base}models/prop_nonla.glb`),
          createGltfLoader()
            .loadAsync(`${base}characters/chr_thu.glb`)
            .then((x) => x.scene)
            .catch(() => null),
        ])
      : [null, null, null, null, null, null];
    // xe
    const boxMat = new MeshStandardNodeMaterial({ color: 0x3b4030, roughness: 0.9 });
    // đèn gầm: hai khe sáng nhỏ dưới ba-đờ-xốc (đèn ngụy trang, chỉ soi mặt đường)
    const glowMat = new MeshStandardNodeMaterial({ color: 0x000000, emissive: 0xbfd2ff, emissiveIntensity: 1.2 });
    glowMat.fog = false;
    for (let i = 0; i < NIGHT.convoy.count; i++) {
      const root = new Group();
      root.name = `truck_${i}`;
      let body: Object3D;
      if (truck) {
        body = truck.clone(true);
        body.rotation.y = -Math.PI / 2; // model: đầu xe −x → −z
      } else {
        body = new Mesh(new BoxGeometry(2.4, 2.6, NIGHT.convoy.length), boxMat);
        body.position.y = 1.3;
      }
      root.add(body);
      const glow = new Mesh(new BoxGeometry(0.16, 0.03, 0.06), glowMat);
      glow.position.set(-0.62, 0.36, -NIGHT.convoy.length / 2 + 0.15);
      const glow2 = glow.clone();
      glow.add(glow2);
      glow2.position.set(1.24, 0, 0);
      root.add(glow);
      this.root.add(root);
      const phys = g.physics.addKinematicBox([0, -200 - i * 10, 0], [1.2, 1.25, NIGHT.convoy.length / 2], { id: `truck_${i}`, kind: 'world', material: 'steel' });
      this.trucks.push({ root, body, charred: false, glow, orig: new Map(), phys });
    }
    // ụ súng
    this.gunRoot = new Group();
    this.gunRoot.position.set(this.gunBase[0], this.gunBase[1], this.gunBase[2]);
    if (gun) {
      this.gunRoot.add(gun);
      this.gunYaw = gun.getObjectByName('dshk_yaw') ?? null;
      this.gunPitch = gun.getObjectByName('dshk_pitch') ?? null;
    } else {
      const mat = new MeshStandardNodeMaterial({ color: 0x2a2c26, roughness: 0.6, metalness: 0.5 });
      const yaw = new Group();
      yaw.position.y = 1.18;
      const pitch = new Group();
      pitch.position.y = 0.13;
      const barrel = new Mesh(new CylinderGeometry(0.03, 0.03, 1.6, 8), mat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.z = -0.6;
      pitch.add(barrel);
      yaw.add(pitch);
      this.gunRoot.add(yaw, new Mesh(new CylinderGeometry(0.05, 0.4, 1.18, 6), mat));
      (this.gunRoot.children[1] as Mesh).position.y = 0.59;
      this.gunYaw = yaw;
      this.gunPitch = pitch;
    }
    this.root.add(this.gunRoot);
    // AC-130
    this.gunship = new Group();
    this.gunship.name = 'ac130';
    if (c130) {
      c130.rotation.y = Math.PI / 2; // mũi +x → −z (như engine/sky)
      c130.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        // vật liệu node riêng, tắt sương: máy bay cách ~1 km trong sương đêm vẫn là bóng xám dưới trăng
        const conv = (mt: Material): Material => {
          const n = toStandardNodeMaterial(mt as MeshStandardMaterial);
          n.fog = false;
          return n;
        };
        m.material = Array.isArray(m.material) ? m.material.map(conv) : conv(m.material);
        m.castShadow = false;
        m.frustumCulled = false;
      });
      // ánh lửa ống xả 4 động cơ T56 (mờ, chỉ thấy khi nhìn kỹ — thứ để bám theo giữa hai loạt đạn)
      const exMat = new MeshBasicNodeMaterial({ color: 0xff7a2a, transparent: true, depthWrite: false, blending: AdditiveBlending });
      exMat.fog = false;
      exMat.toneMapped = false;
      exMat.color.setRGB(1.1, 0.42, 0.12);
      const exGeo = new SphereGeometry(0.5, 8, 6);
      for (const z of [-7.6, -4.4, 4.4, 7.6]) {
        const ex = new Mesh(exGeo, exMat);
        ex.position.set(-2.2, 4.2, z);
        c130.add(ex);
      }
      this.gunship.add(c130);
    } else this.gunship.add(new Mesh(new BoxGeometry(40, 3, 30), boxMat));
    this.gunship.visible = false;
    this.root.add(this.gunship);
    // Thu
    if (thuGltf) {
      this.thu = new ThuView(thuGltf, lamp, hat, this.thuPos, this.thuYaw);
      this.thu.attach(this.root);
    }
    // phụ xạ Đạt cạnh ụ (không phải bot: không AI, không trúng đạn)
    const look = g.lookFor('friend');
    this.dat = createActorVisual(g.quality.character ? g.assets?.character ?? null : null, { color: 0x4a5246, visor: 0x2ad4ff, seed: 0xda7, gear: look.gear, skin: look.skin, phase: 1.3 }, g.assets?.weapons[g.weaponIdFor('friend')] ?? null);
    this.dat.ground = (x, z) => g.terrain!.heightAt(x, z);
    this.root.add(this.dat.group);
    // lửa xe cháy: 8 chỗ (lửa + khói), cất dưới đất khi chưa cháy (giữ số đèn cố định — không biên dịch lại shader)
    const defs: FxDef[] = [];
    for (let i = 0; i < NIGHT.convoy.count; i++) {
        defs.push({ kind: 'fire', position: [0, -500, 0], scale: 1.5 });
      defs.push({ kind: 'smoke', position: [0, -500, 0], scale: 2.2, height: 40, color: 0x120f0c, lit: 0.18 });
    }
    this.fires = createAmbientFx(defs, { maxLights: 2 });
    this.root.add(this.fires.group);
    this.syncTrucks();
    this.placeDat();
  }

  // ---------------------------------------------------------------- sim

  /** trước player.step: true = đang ngồi súng (Game bỏ di chuyển + súng tay) */
  preStep(input: InputSnapshot, dt: number): boolean {
    const g = this.game;
    const p = g.player;
    if (this.mounted && !p.alive) this.dismount(false);
    if (this.mounted) {
      p.rig.look(input.dx, input.dy, p.sensitivity, p.invertY);
      p.rig.step(dt, 0, true, false);
      this.logic.gun.aim(p.rig.yaw, p.rig.pitch);
      const f = this.logic.gun.gunnerFeet();
      p.controller.teleport(f[0], g.terrain!.heightAt(f[0], f[2]), f[2]);
      this.zoom += ((input.ads ? 1 : 0) - this.zoom) * Math.min(1, dt * 8);
      p.adsBlend = this.zoom * 0.45;
    }
    const f = p.controller.feet;
    this.syncTruckBodies();
    this.logic.step(dt, {
      mounted: this.mounted,
      trigger: input.fire,
      reload: input.reload,
      yaw: p.rig.yaw,
      pitch: p.rig.pitch,
      player: [f[0], f[1], f[2]],
      crouched: p.controller.stance === 'crouch',
      alive: p.alive,
      pushing: this.pushing,
      rescuing: this.rescuing,
      crewGun: !this.mounted && this.everMounted,
    });
    return this.mounted;
  }

  /** cuối tick sim (sau mission.step): nhắc phím, ngồi/rời súng, đẩy/cứu, HUD */
  postStep(dt: number, edge: boolean, held: boolean): void {
    const g = this.game;
    const h = g.hud.state;
    const L = this.logic;
    const C = NIGHT.convoy;
    const f = g.player.controller.feet;
    this.pushing.clear();
    this.rescuing = null;
    // đẩy/cứu
    let prompt: string | null = null;
    let progress = -1;
    if (this.mounted) {
      prompt = 'dismount';
      if (edge) this.dismount(true);
    } else if (g.player.alive) {
      let best = Infinity;
      const gd = Math.hypot(f[0] - this.gunBase[0], f[2] - this.gunBase[2]);
      if (gd <= NIGHT.dshk.mountRadius) {
        best = gd;
        prompt = 'mount';
      }
      for (const tr of L.convoy.trucks) {
        if (tr.block) {
          const pp = L.convoy.pushPoint(tr);
          const d = Math.hypot(f[0] - pp[0], f[2] - pp[1]);
          if (d <= C.push.radius && d < best) {
            best = d;
            prompt = 'push';
            progress = tr.push;
            if (held) {
              // đồng đội đứng quanh đuôi xe cùng đẩy
              let helpers = 0;
              for (const b of g.squadmates.list()) if (b.bot.alive && Math.hypot(b.bot.position[0] - pp[0], b.bot.position[2] - pp[1]) <= C.push.radius + 2.5) helpers++;
              this.pushing.set(tr.id, 1 + helpers);
              this.stats.pushTicks++;
            }
          }
        }
        if (tr.driver === 'injured' && tr.driverAt) {
          const d = Math.hypot(f[0] - tr.driverAt[0], f[2] - tr.driverAt[1]);
          if (d <= C.driver.radius && d < best) {
            best = d;
            prompt = 'rescue';
            progress = tr.rescue;
            if (held) {
              this.rescuing = tr.id;
              this.stats.rescueTicks++;
            }
          }
        }
      }
      if (prompt === 'mount' && edge) this.mount();
    }
    if (prompt || h.promptKey === null || ['mount', 'dismount', 'push', 'rescue'].includes(h.promptKey)) {
      h.promptKey = prompt;
      h.promptProgress = prompt === 'push' || prompt === 'rescue' ? progress : -1;
    }
    // đồng đội ra đẩy xe chắn ngầm
    const block = L.convoy.fordBlocker();
    if (block) {
      const pp = L.convoy.pushPoint(block);
      g.mission.squadDest = [pp[0], g.terrain!.heightAt(pp[0], pp[1]), pp[1]];
      this.squadDestOwned = true;
    } else if (this.squadDestOwned) {
      g.mission.squadDest = null;
      this.squadDestOwned = false;
    }
    // HUD
    h.convoy = L.convoy.go || L.convoy.crossed > 0 ? { crossed: L.convoy.crossed, total: C.count, lost: L.convoy.stats.destroyed } : h.convoy ?? null;
    h.aaSight = this.mounted;
    if (this.mounted) {
      const gun = L.gun;
      h.weaponKey = 'weapon.dshk';
      h.mag = gun.mag;
      h.magSize = NIGHT.dshk.belt;
      h.reserve = -1;
      h.weaponState = gun.reloading > 0 ? 'RELOAD' : 'READY';
      h.spreadDeg = NIGHT.dshk.spreadDeg;
      h.grenades = undefined;
    }
    // kết đêm: Quyết nói kết quả, Thu chào, rồi cờ night_over
    if (this.endT >= 0) {
      this.endT += dt;
      if (!this.resultSaid && this.endT > 3) {
        this.resultSaid = true;
        const n = L.convoy.crossed;
        this.say(n >= C.count ? 'N30' : n >= Math.ceil(C.count / 2) ? 'N31' : 'N32', 'QUYET', 0, true);
        this.say('N33', 'THU', 0, true);
      }
      if (this.endT > 16) g.mission.setFlag('night_over');
      if (g.hud.state.missionComplete) {
        h.completeSub = t('hud.night_complete_sub', { n: L.convoy.crossed, total: C.count, r: L.convoy.stats.rescued });
      }
    }
  }

  private mount(): void {
    const g = this.game;
    this.mounted = true;
    this.stats.mounts++;
    // giữ hướng nhìn hiện tại, ngẩng lên trời
    g.player.rig.pitch = Math.max(g.player.rig.pitch, 0.35);
    g.player.controller.stance = 'stand';
    if (!this.everMounted) {
      this.everMounted = true;
      g.mission.setFlag('gun_manned');
    }
    this.placeDat();
  }

  private dismount(say: boolean): void {
    const g = this.game;
    this.mounted = false;
    this.stats.dismounts++;
    this.zoom = 0;
    g.player.adsBlend = 0;
    g.hud.state.aaSight = false;
    // bước ra sau giá 1,6 m
    const gun = this.logic.gun;
    const x = gun.base[0] + Math.sin(gun.yaw) * 1.7;
    const z = gun.base[2] + Math.cos(gun.yaw) * 1.7;
    g.player.controller.teleport(x, g.terrain!.heightAt(x, z) + 0.05, z);
    if (say && this.logic.gunship.phase !== 'idle') this.say('N22', 'DAT', 20);
    this.placeDat();
  }

  // ---------------------------------------------------------------- sự kiện

  /** người nói luân phiên trong tổ còn sống (ưu tiên `prefer`) */
  private squadSpeaker(prefer?: string): string {
    const alive = this.game.squadmates.list().filter((b) => b.bot.alive);
    const names = ['QUYET', 'LONG', 'HOAN', 'KHANG'];
    if (prefer && alive.some((b) => this.game.squadmates.actorOfSpeaker(prefer) === b)) return prefer;
    const s = names[this.speakerTurn++ % names.length]!;
    return s;
  }

  /** thoại ngoài graph, chống lặp theo cue (`throttleS`); `force` bỏ qua chống lặp */
  private say(cue: string, speaker: string, throttleS = 0, force = false): void {
    const now = this.logic.time;
    const last = this.lastSaid.get(cue) ?? -1e9;
    if (!force && now - last < throttleS) return;
    // câu bắt buộc (force) là thoại cốt truyện: xếp hàng giữ thứ tự, không bị bỏ vì cũ như câu hô
    if (this.game.mission.say(cue, speaker, undefined, !force)) {
      this.lastSaid.set(cue, now);
      this.stats.lines++;
    }
  }

  private onConvoy(e: ConvoyEvent): void {
    const g = this.game;
    switch (e.type) {
      case 'crossed':
        this.say('N20', 'THU', 25);
        break;
      case 'stuck':
        this.say('N15', 'THU', 0, true);
        this.say('N16', 'QUYET', 0, true);
        break;
      case 'freed':
        this.say('N18', 'LAIXE', 0, true);
        break;
      case 'destroyed': {
        this.say('N13', this.squadSpeaker(), 8);
        const slot = this.fireOf.size;
        this.fireOf.set(e.truck, slot);
        this.charTruck(e.truck);
        break;
      }
      case 'wreck_blocks':
        this.say('N19', 'THU', 0, true);
        break;
      case 'driver_injured': {
        this.say('N14', this.squadSpeaker(), 10);
        const tr = this.logic.convoy.trucks[e.truck]!;
        if (tr.driverAt) {
          const v = createActorVisual(g.quality.character ? g.assets?.character ?? null : null, { color: 0x4a5246, visor: 0x2ad4ff, seed: 0x1a1 + e.truck, gear: g.lookFor('friend').gear, skin: g.lookFor('friend').skin, phase: e.truck }, null);
          v.ground = (x, z) => g.terrain!.heightAt(x, z);
          v.group.position.set(tr.driverAt[0], g.terrain!.heightAt(tr.driverAt[0], tr.driverAt[1]), tr.driverAt[1]);
          v.group.rotation.y = this.thuYaw + 1.2;
          v.applyDamage(100); // nằm (clip ngã giữ khung cuối)
          this.root.add(v.group);
          this.drivers.set(e.truck, v);
        }
        break;
      }
      case 'driver_rescued': {
        this.say('N17', 'LAIXE', 0, true);
        const v = this.drivers.get(e.truck);
        if (v) {
          v.group.removeFromParent();
          this.drivers.delete(e.truck);
        }
        break;
      }
      case 'hold':
        this.say('N21', 'THU', 30);
        break;
      case 'done':
        this.endT = 0;
        g.mission.setFlag('convoy_done');
        break;
      default:
        break;
    }
  }

  private onPhase(p: GunshipPhase, prev: GunshipPhase): void {
    const g = this.game;
    if (p === 'inbound' && !this.drone && g.audio.ctx) this.drone = g.audio.aircraft('prop');
    if (p === 'attack' && prev === 'inbound') {
      this.say('N08', 'QUYET', 0, true);
      this.say('N09', 'DAT', 0, true);
    } else if (p === 'breaking') this.say('N10', this.squadSpeaker(), 12);
    else if (p === 'attack' && prev === 'returning') this.say('N11', this.squadSpeaker(), 12);
    if (p === 'gone') {
      this.drone?.stop();
      this.drone = null;
    }
  }

  private onShellFired(s: Shell): void {
    const g = this.game;
    // lửa đầu nòng sườn trái máy bay (thấy rõ trong đêm, là thứ người chơi ngắm theo)
    const big = s.kind === 'bofors';
    this.flashes.fire(s.from, big ? 5.5 : 3.2, big ? 0.09 : 0.05, 2.2, 1.6, 0.8);
    if (!g.audio.ctx) return;
    if (big) g.audio.airGun(s.from, 'bofors');
    else {
      const k = s.kind as 'vulcan' | 'minigun';
      if (s.t0 - this.lastBurstAt[k] > 0.6) g.audio.airGun(s.from, k, (k === 'vulcan' ? NIGHT.gunship.vulcan.burstS : NIGHT.gunship.minigun.burstS) * 1000);
      this.lastBurstAt[k] = s.t0;
    }
  }

  private onShellImpact(s: Shell): void {
    const g = this.game;
    const at: V3 = [s.at[0], s.at[1], s.at[2]];
    const f = g.player.controller.feet;
    const d = Math.hypot(f[0] - at[0], f[2] - at[2]);
    if (s.kind === 'bofors') {
      g.fx.explosion(at, 2.4);
      g.audio.shellHit(at, 'bofors');
      g.player.rig.shakeAmp = Math.max(g.player.rig.shakeAmp, Math.min(0.7, 9 / Math.max(9, d)));
    } else {
      if (d < 220) g.events.emit('IMPACT', { point: at, normal: [0, 1, 0], material: 'earth', penetrated: false });
      g.audio.shellHit(at, s.kind);
      if (d < 12) g.player.rig.shakeAmp = Math.max(g.player.rig.shakeAmp, 0.15);
    }
  }

  private onGunFire(m: readonly number[], _d: readonly number[], _tracer: boolean): void {
    const g = this.game;
    this.shotN++;
    this.flashes.fire(m, 0.45, 0.045, 2.0, 1.5, 0.8);
    this.muzzleLight.position.set(m[0]!, m[1]!, m[2]!);
    this.muzzleLight.intensity = 5;
    this.muzzleLife = 0.05;
    if (this.mounted) {
      if (g.audio.ctx) g.audio.heavyGun();
      g.player.rig.kick(NIGHT.dshk.kickPitch, (this.shotN % 2 ? 1 : -1) * NIGHT.dshk.kickPitch * 0.4);
      g.player.rig.shakeAmp = Math.max(g.player.rig.shakeAmp, NIGHT.dshk.shake);
    } else if (g.audio.ctx && this.shotN % 2 === 0) g.audio.gunshotFar(m as V3);
  }

  private groundImpact(at: readonly number[]): void {
    const c = this.game.camera.position;
    if (Math.hypot(at[0]! - c.x, at[2]! - c.z) < 250) this.game.events.emit('IMPACT', { point: [at[0]!, at[1]!, at[2]!], normal: [0, 1, 0], material: 'earth', penetrated: false });
  }

  private charTruck(id: number): void {
    const v = this.trucks[id];
    if (!v || v.charred) return;
    v.charred = true;
    v.body.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      if (!v.orig.has(m)) v.orig.set(m, m.material);
      m.material = this.charredMat;
    });
    v.glow.visible = false;
  }

  // ---------------------------------------------------------------- render

  private syncTrucks(): void {
    const L = this.logic;
    const ground = (x: number, z: number): number => this.game.terrain!.heightAt(x, z);
    const C = NIGHT.convoy;
    for (const tr of L.convoy.trucks) {
      const v = this.trucks[tr.id];
      if (!v) continue;
      v.root.visible = tr.state !== 'gone';
      if (!v.root.visible) continue;
      const p = L.convoy.pose(tr, _pose);
      // bốn điểm bánh: dốc dọc/ngang theo đất
      const hl = C.length * 0.32;
      const hw = 1.0;
      const fx = p.x + p.dx * hl;
      const fz = p.z + p.dz * hl;
      const bx = p.x - p.dx * hl;
      const bz = p.z - p.dz * hl;
      const lx = -p.dz * hw;
      const lz = p.dx * hw;
      const hfl = ground(fx + lx, fz + lz);
      const hfr = ground(fx - lx, fz - lz);
      const hbl = ground(bx + lx, bz + lz);
      const hbr = ground(bx - lx, bz - lz);
      const y = (hfl + hfr + hbl + hbr) / 4;
      const pitch = Math.atan2((hfl + hfr - hbl - hbr) / 2, hl * 2);
      const roll = Math.atan2((hfr + hbr - hfl - hbl) / 2, hw * 2);
      v.root.position.set(p.x, y, p.z);
      v.root.rotation.set(pitch, Math.atan2(-p.dx, -p.dz), roll, 'YXZ');
      // lửa theo xe cháy
      const slot = this.fireOf.get(tr.id);
      if (slot !== undefined && this.fires) {
        const fire = this.fires.group.children[slot * 2];
        const smoke = this.fires.group.children[slot * 2 + 1];
        fire?.position.set(p.x - p.dx * 1.4, y + 1.2, p.z - p.dz * 1.4);
        smoke?.position.set(p.x, y + 2, p.z);
      }
    }
  }

  /** hộp va chạm xe theo vị trí logic (trước physics.step) */
  private syncTruckBodies(): void {
    const L = this.logic;
    for (const tr of L.convoy.trucks) {
      const ph = this.trucks[tr.id]?.phys;
      if (!ph) continue;
      const on = tr.state !== 'gone';
      if (ph.collider.isEnabled() !== on) ph.collider.setEnabled(on);
      if (!on) continue;
      const p = L.convoy.pose(tr, _pose);
      const y = this.game.terrain!.heightAt(p.x, p.z) + 1.35;
      const yaw = Math.atan2(-p.dx, -p.dz);
      ph.body.setNextKinematicTranslation({ x: p.x, y, z: p.z });
      ph.body.setNextKinematicRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) });
    }
  }

  private placeDat(): void {
    const d = this.dat;
    if (!d) return;
    const gun = this.logic.gun;
    if (this.logic.crewOnGun || (!this.mounted && this.everMounted)) {
      const f = gun.gunnerFeet();
      d.group.position.set(f[0], this.game.terrain!.heightAt(f[0], f[2]), f[2]);
      d.motion.yaw = gun.yaw;
      d.motion.aiming = true;
      d.motion.pitch = Math.min(0.6, gun.pitch);
    } else {
      // phụ xạ quỳ bên trái giá, cạnh hòm đạn
      const x = gun.base[0] - Math.cos(gun.yaw) * 1.3 + Math.sin(gun.yaw) * 0.6;
      const z = gun.base[2] + Math.sin(gun.yaw) * 1.3 + Math.cos(gun.yaw) * 0.6;
      d.group.position.set(x, this.game.terrain!.heightAt(x, z), z);
      d.motion.yaw = gun.yaw;
      d.motion.aiming = false;
      d.motion.pitch = 0;
    }
    d.motion.crouch = !(this.logic.crewOnGun || (!this.mounted && this.everMounted));
    d.motion.speed = 0;
    d.group.rotation.y = d.motion.yaw ?? 0;
  }

  /** sau camera (Game.renderStep): đặt mắt khi ngồi súng, đồng bộ hình */
  render(dt: number): void {
    const g = this.game;
    const L = this.logic;
    const now = L.time;
    if (this.mounted) {
      const eye = L.gun.toWorld(NIGHT.dshk.eye);
      g.camera.position.set(eye[0], eye[1], eye[2]);
      g.camera.updateMatrixWorld(true);
    }
    this.syncTrucks();
    // súng
    if (this.gunYaw) this.gunYaw.rotation.y = L.gun.yaw;
    if (this.gunPitch) this.gunPitch.rotation.x = L.gun.pitch;
    this.placeDat();
    this.dat?.setPose(now);
    for (const v of this.drivers.values()) v.setPose(now);
    // máy bay
    const gs = L.gunship;
    if (this.gunship) {
      this.gunship.visible = gs.phase !== 'idle' && gs.phase !== 'gone';
      this.gunship.position.set(gs.pos[0], gs.pos[1], gs.pos[2]);
      this.gunship.rotation.set(0, Math.atan2(-gs.vel[0], -gs.vel[2]), gs.bank, 'YXZ');
    }
    if (this.drone) this.drone.set({ x: gs.pos[0], y: gs.pos[1], z: gs.pos[2] }, { x: gs.vel[0], y: gs.vel[1], z: gs.vel[2] });
    // Thu: đưa đèn khi có xe trong/sát ngầm
    if (this.thu) {
      let near = false;
      for (const tr of L.convoy.trucks) if ((tr.state === 'moving' || tr.state === 'stuck') && Math.abs(tr.s - NIGHT.convoy.fordS) < NIGHT.convoy.fordHalf + 12) near = true;
      this.thu.wave += ((near ? 1 : 0.15) - this.thu.wave) * Math.min(1, dt * 2);
      this.thu.update(dt);
    }
    // đèn soi ngầm: theo xe đang qua (đèn gầm hắt xuống nước)
    let ford: { x: number; z: number } | null = null;
    for (const tr of L.convoy.trucks) {
      if ((tr.state === 'moving' || tr.state === 'stuck') && Math.abs(tr.s - NIGHT.convoy.fordS) < NIGHT.convoy.fordHalf + 6) {
        const p = L.convoy.pose(tr, _pose);
        ford = { x: p.x + p.dx * 3.6, z: p.z + p.dz * 3.6 };
      }
    }
    if (ford) {
      this.fordLight.position.set(ford.x, g.terrain!.heightAt(ford.x, ford.z) + 0.7, ford.z);
      this.fordLight.intensity = 2.2;
    } else this.fordLight.intensity = 0;
    if (this.muzzleLife > 0) {
      this.muzzleLife -= dt;
      if (this.muzzleLife <= 0) this.muzzleLight.intensity = 0;
    }
    this.flashes.update(dt);
    this.fires?.update(dt);
    // vệt đạn
    const S = this.streaks;
    S.begin();
    const cam = g.camera.position;
    const wOf = (x: number, y: number, z: number, k: number): number => Math.max(0.05, Math.hypot(x - cam.x, y - cam.y, z - cam.z) * k);
    for (const r of L.gun.rounds) {
      if (!r.live || !r.tracer || r.age > 2.8) continue;
      const len = Math.min(16, 0.018 * Math.hypot(r.vel[0], r.vel[1], r.vel[2]));
      const sp = Math.hypot(r.vel[0], r.vel[1], r.vel[2]) || 1;
      const a = [r.pos[0] - (r.vel[0] / sp) * len, r.pos[1] - (r.vel[1] / sp) * len, r.pos[2] - (r.vel[2] / sp) * len];
      S.push(a, r.pos, wOf(r.pos[0], r.pos[1], r.pos[2], 0.0016), 0.55, 2.6, 0.7);
    }
    for (const s of gs.shells) {
      if (now < s.t0 || now > s.t1) continue;
      const k = (now - s.t0) / Math.max(1e-3, s.t1 - s.t0);
      const len = s.kind === 'bofors' ? 30 : s.kind === 'vulcan' ? 18 : 12;
      const dx = s.at[0] - s.from[0];
      const dy = s.at[1] - s.from[1];
      const dz = s.at[2] - s.from[2];
      const dl = Math.hypot(dx, dy, dz) || 1;
      const hx = s.from[0] + dx * k;
      const hy = s.from[1] + dy * k;
      const hz = s.from[2] + dz * k;
      const tail = [hx - (dx / dl) * len, hy - (dy / dl) * len, hz - (dz / dl) * len];
      const w = wOf(hx, hy, hz, s.kind === 'bofors' ? 0.0026 : 0.0016);
      S.push(tail, [hx, hy, hz], w, 2.6, 0.55, 0.25);
    }
    S.end();
    this.updateSounds();
  }

  private updateSounds(): void {
    const g = this.game;
    if (!g.audio.ctx) return;
    if (!this.engines.length) for (let i = 0; i < 2; i++) this.engines.push(g.audio.aircraft('truck'));
    if (!this.drone && this.logic.gunship.phase !== 'idle' && this.logic.gunship.phase !== 'gone') this.drone = g.audio.aircraft('prop');
    // máy hai xe gần camera nhất (còn chạy/chờ)
    const cam = g.camera.position;
    const list = this.logic.convoy.trucks
      .filter((tr) => tr.state === 'waiting' || tr.state === 'moving' || tr.state === 'stuck' || tr.state === 'crossed')
      .map((tr) => {
        const p = this.logic.convoy.pose(tr, { x: 0, z: 0, dx: 0, dz: 1 });
        return { p, v: tr.v, d: Math.hypot(p.x - cam.x, p.z - cam.z) };
      })
      .sort((a, b) => a.d - b.d);
    for (let i = 0; i < this.engines.length; i++) {
      const e = this.engines[i];
      const it = list[i];
      if (!e) continue;
      if (!it) {
        e.set({ x: cam.x, y: -2000, z: cam.z }, { x: 0, y: 0, z: 0 });
        continue;
      }
      const y = this.game.terrain!.heightAt(it.p.x, it.p.z) + 1;
      _v.set(it.p.dx * it.v, 0, it.p.dz * it.v);
      e.set({ x: it.p.x, y, z: it.p.z }, { x: _v.x, y: 0, z: _v.z });
    }
  }

  // ---------------------------------------------------------------- checkpoint

  saveCheckpoint(id: string): void {
    this.cps.set(id, { convoy: this.logic.convoy.snapshot(), gunship: this.logic.gunship.snapshot(), mounted: false, everMounted: this.everMounted });
  }

  loadCheckpoint(id: string): void {
    const s = this.cps.get(id);
    if (!s) return;
    if (this.mounted) this.dismount(false);
    this.logic.convoy.restore(s.convoy);
    this.logic.gunship.restore(s.gunship);
    this.everMounted = s.everMounted;
    this.afterRestore();
  }

  private afterRestore(): void {
    // hình xe cháy theo trạng thái
    for (const v of this.trucks) {
      if (!v.charred) continue;
      v.charred = false;
      for (const [m, mat] of v.orig) m.material = mat;
      v.glow.visible = true;
    }
    this.fireOf.clear();
    if (this.fires) for (const c of this.fires.group.children) c.position.set(0, -500, 0);
    for (const tr of this.logic.convoy.trucks) {
      if (tr.state === 'burning') {
        this.fireOf.set(tr.id, this.fireOf.size);
        this.charTruck(tr.id);
      }
    }
    for (const v of this.drivers.values()) v.group.removeFromParent();
    this.drivers.clear();
    this.endT = this.logic.convoy.done ? 0 : -1;
    this.resultSaid = false;
    this.pushing.clear();
    this.rescuing = null;
  }

  reset(): void {
    if (this.mounted) this.dismount(false);
    this.logic.reset();
    this.everMounted = false;
    this.cps.clear();
    this.lastSaid.clear();
    this.drone?.stop();
    this.drone = null;
    this.endT = -1;
    this.resultSaid = false;
    this.afterRestore();
    this.game.hud.state.convoy = null;
    this.game.hud.state.completeSub = null;
  }
}
