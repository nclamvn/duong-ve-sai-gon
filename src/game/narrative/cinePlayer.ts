/**
 * DV-093 đạo diễn intro: chạy một cinematic (content/cinematics/*.cine.json) trên chính màn chơi đã nạp.
 *  - đồng hồ biên tập (giây phim) tách khỏi đồng hồ thế giới: shot quay chậm / sự kiện `slowmo` hạ `game.simScale`;
 *  - camera theo CameraTrack (engine/cinematics), người chơi ẩn và đứng xa khỏi mọi vụ nổ trừ khi sự kiện cần bùn ống kính;
 *  - diễn viên = lính thật của game (cùng mô hình, hoạt ảnh) nhưng AI tạm dừng, vị trí/tư thế theo khoá thời gian;
 *  - sự kiện: màn đen, tựa, bản đồ, thoại, bộ đàm, nhạc, B-52, rải thảm, nổ, loạt đạn, quay chậm, lặng tiếng, chất phim.
 * Cùng một dòng thời gian cho xem trực tiếp (?cine=intro), ghi âm (?cine=intro&rec=audio) và dựng hình offline (rec=video).
 */
import { CameraTrack, CueTimeline, type CineEvent, type CinematicDef } from '@engine/cinematics/track';
import type { Game } from '@game/game';
import type { BotActor } from '@game/actors/botActor';
import { CineOverlay } from '@ui/cineOverlay';
import { BriefingMap, type MapCue } from '@ui/briefingMap';
import { showTitleCard } from '@ui/titleCard';
import type { IntroHandoff } from '@game/mission/types';

type V2 = [number, number];

export interface ActorKey {
  t: number;
  x: number;
  z: number;
  jump?: boolean;
  crouch?: boolean;
  aim?: V2;
  /** turn the body toward a point without raising the rifle (talking to someone on the ground) */
  face?: V2;
}

export interface ActorDef {
  id: string;
  faction: 'friend' | 'enemy';
  nameKey?: string;
  archetype?: 'grunt' | 'recon' | 'squad';
  keys: ActorKey[];
}

export interface IntroDef extends CinematicDef {
  actors: ActorDef[];
  /**
   * DV-094 intro nối liền vào trận: phim MP4 chiếu tới `cut` (giây, rơi vào khung đen), engine chạy tiếp từ `live`;
   * tới `t` thì trao quyền điều khiển tại chỗ camera đang đứng. `holdAt` (x, z) = chỗ tổ giữ; `skipCues` = câu radio
   * của nhiệm vụ intro đã nói rồi; `title`/`sub` = tựa hiện đè lúc đang chơi.
   */
  handoff?: { cut: number; live: number; t: number; holdAt?: V2; skipCues?: string[]; title?: string; sub?: string };
}

interface Burst {
  from: string;
  to: [number, number, number];
  until: number;
  next: number;
  rate: number;
  spread: number;
  n: number;
}

/** deterministic jitter (golden ratio sequence) — no Math.random (AGENTS) */
let jseq = 0;
function jitter(): number {
  jseq = (jseq + 0.6180339887) % 1;
  return jseq * 2 - 1;
}

export class CinePlayer {
  readonly track: CameraTrack;
  readonly overlay: CineOverlay;
  private readonly cues: CueTimeline;
  private readonly actors = new Map<string, { def: ActorDef; bot: BotActor }>();
  private readonly bursts: Burst[] = [];
  private readonly pending: Array<{ t: number; run: () => void }> = [];
  /** per-frame ramps; return true when finished */
  private ramps: Array<(now: number) => boolean> = [];
  /** editorial clock (s) */
  t = 0;
  done = false;
  private slow = 1;
  private lastDt = 1 / 30;
  private slowUntil = 0;
  private parked: [number, number, number] = [0, 0, 0];
  private stopMusic: ((fadeS?: number) => void) | null = null;
  private readonly prevFar: number;
  /** fog density before the cinematic (`fog` events change it; gameplay gets it back) */
  private readonly prevFog: number | null;
  onEnd: (() => void) | null = null;
  /** DV-094 trao quyền liền mạch tại `def.handoff.t` (thay cho chạy hết intro rồi cắt) */
  seamless = false;
  /** bước đồng hồ tối đa mỗi khung khi xem trực tiếp (bộ ghi offline bỏ giới hạn: bước = 1/fps) */
  maxDt = 0.1;

  constructor(
    private readonly game: Game,
    readonly def: IntroDef,
    private readonly opts: { audio: boolean } = { audio: true },
  ) {
    this.track = new CameraTrack(def);
    this.cues = new CueTimeline(def.events);
    this.overlay = new CineOverlay(document.getElementById('app') ?? document.body);
    this.prevFar = game.camera.far;
    this.prevFog = game.atmosphere?.densityScale.value ?? null;
  }

  /** take over camera, AI, HUD; spawn the cast. `from` > 0 = vào giữa intro (DV-094, phim đã chiếu phần trước) */
  start(from = 0): void {
    const g = this.game;
    g.aiPaused = true;
    g.viewModelHidden = true;
    const hud = document.getElementById('hud');
    if (hud) hud.hidden = true;
    g.camera.far = 3200;
    g.smokeKickCap = 0.08;
    g.camera.updateProjectionMatrix();
    // người chơi đứng xa khỏi mọi vụ nổ (không choáng, không bùn kính) — trừ sự kiện `lens`
    // ~300 m from every cue of the intro, still on the terrain tile (the tile is 2 km)
    this.parked = [-330, 0, 760];
    this.park();
    for (const a of this.def.actors) {
      const k = a.keys[0]!;
      const y = this.ground(k.x, k.z);
      const bot = g.spawnBot(`cine_${a.id}`, 'cine', [k.x, y, k.z], { faction: a.faction, nameKey: a.nameKey ?? null, archetype: a.archetype ?? 'grunt' });
      // close-ups: the skinned body's bind-pose bounds can cull it while its gear (never culled) floats in frame
      bot.dummy.group.traverse((o) => {
        o.frustumCulled = false;
      });
      this.actors.set(a.id, { def: a, bot });
    }
    g.preFrame = (dt) => this.step(dt);
    g.cameraDriver = () => this.applyCamera();
    if (from > 0) this.skipTo(from);
    this.step(0);
  }

  private ground(x: number, z: number): number {
    return this.game.terrain ? this.game.terrain.heightAt(x, z) : 0;
  }

  private park(): void {
    const p = this.parked;
    this.game.player.controller.teleport(p[0], this.ground(p[0], p[2]) + 0.3, p[2]);
  }

  /** advance the editorial clock by a real frame time; sets the world time scale for this frame */
  step(dt: number): void {
    if (this.done) return;
    // DV-094 khung giật (biên dịch shader, tab nền) không được nhảy cóc qua cả cảnh / điểm trao quyền
    dt = Math.min(dt, this.maxDt);
    this.t += dt;
    this.lastDt = dt;
    const now = this.t;
    this.cues.advance(now, (e) => this.fire(e));
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i]!;
      if (p.t <= now) {
        this.pending.splice(i, 1);
        p.run();
      }
    }
    this.ramps = this.ramps.filter((r) => !r(now));
    const shotScale = this.track.shotAt(now).timeScale ?? 1;
    const slow = now < this.slowUntil ? this.slow : 1;
    this.game.simScale = shotScale * slow;
    this.driveActors(now);
    this.driveBursts(now);
    this.overlay.update(now, dt);
    this.overlay.present();
    const h = this.def.handoff;
    if (this.seamless && h && now >= h.t && !this.done) this.handoff();
    else if (now >= this.def.duration && !this.done) this.finish();
  }

  private applyCamera(): void {
    const g = this.game;
    const c = this.track.at(this.t, (x, z) => this.ground(x, z));
    g.camera.position.set(c.pos[0], c.pos[1], c.pos[2]);
    g.camera.up.set(Math.sin(c.roll), Math.cos(c.roll), 0);
    g.camera.lookAt(c.look[0], c.look[1], c.look[2]);
    if (Math.abs(g.camera.fov - c.fov) > 1e-3) {
      g.camera.fov = c.fov;
      g.camera.updateProjectionMatrix();
    }
    g.camera.updateMatrixWorld();
  }

  /** DV-093 actor segment along the navmesh (wrecks, trees and rocks are carved out): never walk through an object */
  private readonly segPaths = new Map<string, { pts: V2[]; cum: number[] }>();

  private segPath(id: string, i: number, a: ActorKey, b: ActorKey): { pts: V2[]; cum: number[] } {
    const key = `${id}:${i}`;
    let sp = this.segPaths.get(key);
    if (sp) return sp;
    const pts: V2[] = [[a.x, a.z]];
    const nav = this.game.nav;
    const na = nav?.nearest({ x: a.x, y: this.ground(a.x, a.z), z: a.z });
    const nb = nav?.nearest({ x: b.x, y: this.ground(b.x, b.z), z: b.z });
    if (na && nb) for (const q of nav.findPath(na, nb)) pts.push([q.x, q.z]);
    pts.push([b.x, b.z]);
    const cum = [0];
    for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1]! + Math.hypot(pts[k]![0] - pts[k - 1]![0], pts[k]![1] - pts[k - 1]![1]));
    sp = { pts, cum };
    this.segPaths.set(key, sp);
    return sp;
  }

  private driveActors(now: number): void {
    for (const { def, bot } of this.actors.values()) {
      const ks = def.keys;
      let i = 0;
      while (i < ks.length - 1 && ks[i + 1]!.t <= now) i++;
      const a = ks[i]!;
      const b = ks[i + 1];
      let x = a.x;
      let z = a.z;
      if (b && !b.jump && b.t > a.t && Math.hypot(b.x - a.x, b.z - a.z) > 0.05) {
        const u = Math.min(1, Math.max(0, (now - a.t) / (b.t - a.t)));
        const { pts, cum } = this.segPath(def.id, i, a, b);
        const L = cum[cum.length - 1]!;
        const d = u * L;
        let k = 1;
        while (k < pts.length - 1 && cum[k]! < d) k++;
        const seg = Math.max(1e-6, cum[k]! - cum[k - 1]!);
        const f = Math.min(1, Math.max(0, (d - cum[k - 1]!) / seg));
        x = pts[k - 1]![0] + (pts[k]![0] - pts[k - 1]![0]) * f;
        z = pts[k - 1]![1] + (pts[k]![1] - pts[k - 1]![1]) * f;
      }
      const p = bot.bot.position;
      const dx = x - p[0];
      const dz = z - p[2];
      const jumped = Math.hypot(dx, dz) > 3;
      p[0] = x;
      p[2] = z;
      p[1] = this.ground(x, z);
      bot.bot.stance = a.crouch ? 'crouch' : 'stand';
      const firing = this.bursts.some((q) => q.from === def.id && q.until > now);
      let want = bot.bot.yaw;
      const look = a.aim ?? a.face;
      if (look) want = Math.atan2(-(look[0] - x), -(look[1] - z));
      else if (Math.hypot(dx, dz) > 1e-3) want = Math.atan2(-dx, -dz);
      bot.bot.aiming = !!a.aim || firing;
      // quay người mượt (≤ 7 rad/s), trừ lúc nhảy cảnh
      let dy = want - bot.bot.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      const maxTurn = 7 * Math.max(1 / 60, this.lastDt);
      bot.bot.yaw += jumped ? dy : Math.max(-maxTurn, Math.min(maxTurn, dy));
    }
  }

  private driveBursts(now: number): void {
    const g = this.game;
    for (const q of this.bursts) {
      while (q.next <= now && q.next < q.until) {
        q.next += 1 / q.rate;
        const src = this.actors.get(q.from)?.bot;
        if (!src || !src.bot.alive) continue;
        const p = src.bot.position;
        const eye: [number, number, number] = [p[0], p[1] + (src.bot.stance === 'crouch' ? 1.05 : 1.5), p[2]];
        const tx = q.to[0] + jitter() * q.spread;
        const ty = this.ground(q.to[0], q.to[2]) + q.to[1] + jitter() * q.spread * 0.4;
        const tz = q.to[2] + jitter() * q.spread;
        const L = Math.hypot(tx - eye[0], ty - eye[1], tz - eye[2]) || 1;
        g.events.emit('BOT_FIRED', { botId: src.id, origin: eye, dir: [(tx - eye[0]) / L, (ty - eye[1]) / L, (tz - eye[2]) / L], faction: src.faction });
        q.n++;
      }
    }
  }

  private fire(e: CineEvent): void {
    const g = this.game;
    const num = (k: string, d = 0): number => (typeof e[k] === 'number' ? (e[k] as number) : d);
    const v2 = (k: string): V2 | null => (Array.isArray(e[k]) ? (e[k] as V2) : null);
    switch (e.type) {
      case 'black':
        this.overlay.fadeBlack(num('to'), num('dur'));
        break;
      case 'title':
        this.overlay.title({ key: String(e['key']), style: (e['style'] as 'place' | 'main' | 'sub') ?? 'place', t0: e.t, dur: num('dur', 4), typeS: num('typeS') });
        break;
      case 'map':
        if (e['on'] === true) {
          if (!this.overlay.map) this.overlay.map = this.buildMap();
          this.overlay.map.setCues((e['cues'] as MapCue[]) ?? []);
          this.overlay.map.start(e.t);
          this.overlay.mapOn = true;
        } else this.overlay.mapOn = false;
        break;
      case 'say': {
        this.overlay.subtitle({ speakerKey: (e['speakerKey'] as string) ?? null, key: String(e['sub']), t0: e.t, dur: num('dur', 3) });
        if (this.opts.audio && g.audio.ctx) {
          const key = g.voice.resolve([String(e['cue'])]);
          if (key) g.voice.play(key, e['radio'] ? 'radio' : 'dialogue', { radio: e['radio'] === true, channel: 'line' });
        }
        break;
      }
      case 'radio':
        // nhiễu bộ đàm: vài nhát nhiễu dải giữa
        if (this.opts.audio) g.audio.radioStatic(num('dur', 4));
        break;
      case 'music':
        if (this.opts.audio) void g.audio.playClip(`${import.meta.env.BASE_URL ?? '/'}${String(e['file'])}`, 'music', num('gain', 1)).then((s) => (this.stopMusic = s));
        break;
      case 'film':
        g.setFilm(num('scale', 0.5));
        break;
      case 'haze':
        g.setBattleSmoke(num('scale', 0.4));
        break;
      case 'fog': {
        // sương: hệ số mật độ đổi mượt trong `dur`
        const atm = g.atmosphere;
        if (atm) {
          const from = atm.densityScale.value;
          const to = num('scale', 1);
          const dur = Math.max(0.01, num('dur', 0));
          const t0 = e.t;
          this.ramps.push((now) => {
            const u = Math.min(1, (now - t0) / dur);
            atm.densityScale.value = from + (to - from) * u;
            return u >= 1;
          });
        }
        break;
      }
      case 'hush':
        g.hush(num('depth', 0.7), num('dur', 3));
        break;
      case 'slowmo':
        this.slow = num('scale', 0.5);
        this.slowUntil = e.t + num('dur', 1);
        break;
      case 'sky': {
        const th = v2('through');
        if (g.sky && th) g.sky.triggerThrough(String(e['flight']), th, num('heading'), num('agl', 600));
        else if (g.sky) g.sky.trigger(String(e['flight']));
        break;
      }
      case 'carpet': {
        const a = v2('from');
        const b = v2('to');
        if (!a || !b) break;
        const n = Math.max(1, num('n', 20));
        const dur = num('dur', 4);
        for (let i = 0; i < n; i++) {
          const k = i / Math.max(1, n - 1);
          const side = jitter() * 26;
          const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
          const x = a[0] + (b[0] - a[0]) * k + (-(b[1] - a[1]) / L) * side;
          const z = a[1] + (b[1] - a[1]) * k + ((b[0] - a[0]) / L) * side;
          const smoke = e['smoke'] === true && i % 2 === 0;
          this.pending.push({
            t: e.t + k * dur,
            run: () => {
              g.explode([x, this.ground(x, z), z], { radius: num('radius', 9), damage: 0, botDamage: 0 });
              // cột khói đen bốc lên sau mỗi quả (một nửa số quả): đọc ra dãy bom rải thảm từ xa
              if (smoke) g.mission?.battle?.handle({ type: 'fx', kind: 'black', at: [x, z], scale: 2.6, durationMs: 90000 } as never);
            },
          });
        }
        break;
      }
      case 'explode': {
        const at = v2('at');
        if (!at) break;
        const pos: [number, number, number] = [at[0], this.ground(at[0], at[1]), at[1]];
        if (e['lens'] === true) {
          // bùn ống kính + choáng: người chơi đứng tạm ngay dưới camera trong khung này, rồi về chỗ đứng xa
          const c = g.camera.position;
          g.player.controller.teleport(c.x, this.ground(c.x, c.z) + 0.3, c.z);
          g.explode(pos, { radius: num('radius', 6), damage: 0, botDamage: 0 });
          this.pending.push({ t: e.t + 0.05, run: () => this.park() });
        } else g.explode(pos, { radius: num('radius', 6), damage: 0, botDamage: 0 });
        break;
      }
      case 'burst': {
        const to = e['to'];
        const from = String(e['from']);
        let target: [number, number, number] | null = null;
        if (Array.isArray(to) && to.length === 3) target = [to[0] as number, to[1] as number, to[2] as number];
        if (target) this.bursts.push({ from, to: target, until: e.t + num('dur', 2), next: e.t, rate: num('rate', 8), spread: num('spread', 2), n: 0 });
        break;
      }
      case 'boom':
        if (this.opts.audio) {
          const c = g.camera.position;
          g.audio.explosion([c.x, c.y, c.z], 2.2);
        }
        break;
      case 'birds':
      case 'end':
        break;
    }
  }

  private buildMap(): BriefingMap {
    const g = this.game;
    const lvl = g.terrainLevelDef;
    const feat = g.terrain?.tile.features?.data;
    const streams = (feat?.streams ?? []).map((s) => ({ pts: s.pts.map((p) => [p[0], p[1]] as V2), water: s.water }));
    const roads = (lvl?.roads ?? []).map((r) => ({ pts: r.pts as V2[] }));
    const convoy: V2 = [-78, 505];
    return new BriefingMap({
      center: [-120, 470],
      size: 520,
      heightAt: (x, z) => this.ground(x, z),
      streams,
      roads,
      route: [
        [-120, 640],
        [-66, 596],
        [-20, 605],
        [-12, 540],
        [-6, 480],
      ],
      enemy: [
        [
          [40, 590],
          [-12, 600],
        ],
        [
          [60, 470],
          [8, 478],
        ],
      ],
      convoy,
      labels: [
        [-44, 650, 'cine.map.l.suoi'],
        [-150, 500, 'cine.map.l.convoy'],
        [6, 420, 'cine.map.l.doi'],
        [-300, 300, 'cine.map.l.lz'],
      ],
      coordKey: 'cine.map.coord',
    });
  }

  /**
   * DV-094 vào giữa intro (phim MP4 đã chiếu tới `t`): dựng lại trạng thái tại `t` mà không phát lại chuyện đã qua. Chỉ áp
   * sự kiện trạng thái (chất phim, khói, sương, màn đen, bản đồ tắt, loạt đạn còn đang bắn, nhạc từ giữa bài, quay chậm còn
   * hiệu lực); nổ trong 0,6 s cuối vẫn chạy (bùn ống kính, choáng) để cảnh mở ra đúng nhịp.
   */
  skipTo(t: number): void {
    this.t = t;
    this.cues.advance(t, (e) => {
      const num = (k: string, d = 0): number => (typeof e[k] === 'number' ? (e[k] as number) : d);
      switch (e.type) {
        case 'film':
        case 'haze':
          this.fire(e);
          break;
        case 'map':
          if (e['on'] !== true) this.overlay.mapOn = false;
          break;
        case 'black':
          this.overlay.fadeBlack(num('to'), 1e-3);
          break;
        case 'fog': {
          const atm = this.game.atmosphere;
          if (atm) atm.densityScale.value = num('scale', 1);
          break;
        }
        case 'burst': {
          const until = e.t + num('dur', 2);
          if (until > t) {
            this.fire(e);
            const q = this.bursts[this.bursts.length - 1];
            if (q) q.next = t;
          }
          break;
        }
        case 'music':
          if (this.opts.audio && this.game.audio.ctx) {
            const off = t - e.t;
            void this.game.audio.playClip(`${import.meta.env.BASE_URL ?? '/'}${String(e['file'])}`, 'music', num('gain', 1), 0, off).then((st) => (this.stopMusic = st));
          }
          break;
        case 'slowmo':
          if (e.t + num('dur', 1) > t) this.fire(e);
          break;
        case 'explode':
          if (t - e.t <= 0.6) this.fire(e);
          break;
        default:
          break;
      }
    });
  }

  /**
   * DV-094 trao quyền liền mạch: người chơi đứng đúng chỗ camera (mắt, hướng nhìn), súng rút lên, tổ thật ra đúng chỗ diễn
   * viên đang đứng và giữ bờ suối, nhiệm vụ bắt đầu (bỏ câu radio vừa nói), camera chuyển êm 0,45 s, sương về mức trận trong
   * 5 s, nhạc tắt dần 6 s, tựa phim hiện đè.
   */
  private handoff(): void {
    const g = this.game;
    const h = this.def.handoff!;
    const c = this.track.at(this.t, (x, z) => this.ground(x, z));
    const cast: IntroHandoff['cast'] = [];
    for (const { def, bot } of this.actors.values()) {
      if (def.faction !== 'friend' || !def.nameKey) continue;
      const p = bot.bot.position;
      cast.push({ nameKey: def.nameKey, pos: [p[0], p[1], p[2]], yaw: bot.bot.yaw });
    }
    const fromPos = g.camera.position.clone();
    const fromQuat = g.camera.quaternion.clone();
    const fogTo = this.prevFog;
    const fogFrom = g.atmosphere?.densityScale.value ?? null;
    this.done = true;
    this.stopMusic?.(6);
    this.stopMusic = null;
    this.dispose();
    // sương: giữ mức intro rồi về mức trận trong 5 s (dispose vừa trả ngay → đặt lại rồi chuyển dần)
    const atm = g.atmosphere;
    if (atm && fogFrom !== null && fogTo !== null) {
      atm.densityScale.value = fogFrom;
      const t0 = performance.now();
      const ramp = (): void => {
        const u = Math.min(1, (performance.now() - t0) / 5000);
        atm.densityScale.value = fogFrom + (fogTo - fogFrom) * u * u * (3 - 2 * u);
        if (u < 1) requestAnimationFrame(ramp);
      };
      requestAnimationFrame(ramp);
    }
    // người chơi: chân dưới camera, nhìn đúng hướng camera đang nhìn
    const dx = c.look[0] - c.pos[0];
    const dy = c.look[1] - c.pos[1];
    const dz = c.look[2] - c.pos[2];
    const yaw = Math.atan2(-dx, -dz);
    const pitch = Math.max(-0.6, Math.min(0.6, Math.atan2(dy, Math.hypot(dx, dz))));
    const snap = g.player.snapshot();
    g.player.restore({ position: [c.pos[0], this.ground(c.pos[0], c.pos[2]), c.pos[2]], yaw, pitch, health: snap.health, stance: 'stand' });
    g.viewModel.reset();
    g.resetFilm();
    g.beginMission({ cast, ...(h.skipCues ? { skipCues: h.skipCues } : {}), ...(h.holdAt ? { holdAt: h.holdAt } : {}) });
    const hud = document.getElementById('hud');
    if (hud) {
      hud.style.opacity = '0';
      hud.style.transition = 'opacity 1.6s ease-out';
      requestAnimationFrame(() => requestAnimationFrame(() => (hud.style.opacity = '1')));
    }
    // camera: từ khung intro cuối sang mắt người chơi trong 0,45 s
    const drive = g.cameraDriver;
    const t0 = performance.now();
    g.cameraDriver = (alpha, dt) => {
      drive?.(alpha, dt);
      const u = Math.min(1, (performance.now() - t0) / 450);
      if (u >= 1) {
        g.cameraDriver = drive;
        return;
      }
      const e = u * u * (3 - 2 * u);
      const tp = g.camera.position.clone();
      const tq = g.camera.quaternion.clone();
      g.camera.position.lerpVectors(fromPos, tp, e);
      g.camera.quaternion.slerpQuaternions(fromQuat, tq, e);
      g.camera.updateMatrixWorld();
    };
    if (h.title) showTitleCard({ titleKey: h.title, ...(h.sub ? { subKey: h.sub } : {}), delayS: 1.6, holdS: 3.4 });
    this.onEnd?.();
  }

  private finish(): void {
    this.done = true;
    this.stopMusic?.(1.5);
    this.onEnd?.();
  }

  /** hand the world back: remove the cast, restore camera/AI/HUD (the caller starts the mission) */
  dispose(): void {
    const g = this.game;
    for (const { bot } of this.actors.values()) g.despawnBot(bot.id);
    this.actors.clear();
    g.preFrame = null;
    g.simScale = 1;
    g.aiPaused = false;
    g.viewModelHidden = false;
    g.camera.far = this.prevFar;
    if (g.atmosphere && this.prevFog !== null) g.atmosphere.densityScale.value = this.prevFog;
    g.smokeKickCap = 1;
    g.camera.up.set(0, 1, 0);
    g.camera.updateProjectionMatrix();
    this.overlay.dispose();
  }
}
