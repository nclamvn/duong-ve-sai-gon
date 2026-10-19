/**
 * MissionHost — nối MissionRuntime với Game (MissionWorld adapter): spawn group → bots, capture/restore world,
 * checkpoint, subtitles, HUD objective/prompt, radio ducking. Game gọi host.step() trong sim.
 */
import { GRENADE } from '@game/weapons/grenades';
import type { EventBus, Prng } from '@engine/core';
import type { Game } from '@game/game';
import { MissionRuntime, type MissionWorld } from './runtime';
import { loadMission, loadDialogue } from './loader';
import { CheckpointStore, stateHash, type SavedCheckpoint } from './checkpoint';
import type { CheckpointSnapshot, MissionDefinition, DialogueSet, MissionEvents } from './types';
import { Battle } from './battle';
import { BATTLE_ACTIONS } from './types';
import { Subtitles } from '@ui/subtitles';
import missionJson from '@content/missions/g0-arena.mission.json';
import phoMissionJson from '@content/missions/pho-van-hai.mission.json';
import truongSonMissionJson from '@content/missions/truong-son-a.mission.json';
import dialogueJson from '@content/missions/g0-dialogue.json';
import truongSonDialogueJson from '@content/missions/truong-son-a.dialogue.json';
import diemCao31MissionJson from '@content/missions/diem-cao-31.mission.json';
import diemCao31DialogueJson from '@content/missions/diem-cao-31.dialogue.json';
import ngamTaLeMissionJson from '@content/missions/ngam-ta-le.mission.json';
import ngamTaLeDialogueJson from '@content/missions/ngam-ta-le.dialogue.json';

export interface Interactable {
  id: string;
  position: [number, number, number];
  radius: number;
  holdMs: number;
  promptKey: string;
  fuseMs: number;
  prop: string | null;
  blastRadius: number;
  blastDamage: number;
  progress: number;
  done: boolean;
  /** giây còn lại của ngòi (−1 = không) */
  fuseLeft: number;
}

export class MissionHost implements MissionWorld {
  readonly def: MissionDefinition;
  readonly dialogue: DialogueSet;
  readonly runtime: MissionRuntime;
  readonly checkpoints: CheckpointStore;
  readonly subtitles = new Subtitles();
  private spawnCounter = 0;
  /** ids bot do mission spawn (để despawn khi reset/restore) */
  private readonly spawned = new Set<string>();
  private readonly ev: EventBus<MissionEvents>;
  private inRelayZone = false;
  /** điểm tương tác giữ phím (M2 R1 — bộc phá, gắn súng, băng bó): từ action `interactable`; xong → flag id; fuse → nổ → flag id_blown */
  readonly interactables: Interactable[] = [];
  private activeInteract: Interactable | null = null;
  /** pháo chuẩn bị (M2 C1, flag `arty`): đạn rơi quanh zone `top` mỗi 0,8–1,5 s; tiếng xích xe tăng (flag `tanks`) — âm + rung */
  private artyOn = false;
  private artyNext = 0;
  private tanksLeft = 0;
  private tanksNext = 0;
  /** pháo sáng địch (flag `flares`): mỗi 9–14 s một quả trên đỉnh, rơi 34 s */
  private flaresOn = false;
  private flareNext = 0;
  readonly artyStats = { shells: 0 };
  /** rải thảm B-52 (M1-T2, action `bombing`): hàng đợi quả bom theo sim time */
  private readonly bombs: Array<{ t: number; x: number; z: number; radius: number; damage: number }> = [];
  private simT = 0;
  readonly bombStats = { dropped: 0 };
  /** điểm Quyết dẫn tổ tới (squad_order.zone), null = theo mục tiêu */
  squadDest: [number, number, number] | null = null;
  /** QA (DV-085 `Game.calm`): đồ thị nhiệm vụ đứng yên */
  paused = false;
  /** marker mục tiêu gắn trên người Quyết (`@leader`) */
  markerOnLeader = false;
  private readonly rng: Prng;
  /** điểm marker mục tiêu hiện tại (world) — HUD la bàn/marker/minimap (TIP-UX02) */
  objectiveMarker: [number, number, number] | null = null;
  private objectiveMarkerKey: string | null = null;
  private barkSeq = 0;
  /**
   * DV-084 chiến trường (lửa, napalm, cối, vùng an toàn, đồng đội hy sinh) — chỉ dựng khi kịch bản có hành động chiến trường hoặc
   * rải bom (bể lửa thêm 4 đèn điểm: màn không dùng thì không trả giá đèn)
   */
  readonly battle: Battle | null;
  /** DV-084 đếm ngược mục tiêu (s còn lại; null = không) */
  private objTimer: number | null = null;

  constructor(private readonly game: Game) {
    this.rng = game.prng.fork('mission-host');
    const m1 = game.levelId === 'truong-son';
    const m2 = game.levelId === 'diem-cao-31';
    const night = game.levelId === 'ngam-ta-le';
    this.def = loadMission(game.levelId === 'pho' ? phoMissionJson : m1 ? truongSonMissionJson : m2 ? diemCao31MissionJson : night ? ngamTaLeMissionJson : missionJson);
    // hồi đêm (DV-078): thoại riêng + câu hô dùng chung của tổ từ M1 (báo hướng, nạp đạn, lựu đạn…)
    const nightDialogue = night ? { cues: [...ngamTaLeDialogueJson.cues, ...truongSonDialogueJson.cues.filter((c) => !ngamTaLeDialogueJson.cues.some((n) => n.cueId === c.cueId))] } : null;
    this.dialogue = loadDialogue(m1 ? truongSonDialogueJson : m2 ? diemCao31DialogueJson : nightDialogue ?? dialogueJson);
    this.ev = game.events as unknown as EventBus<MissionEvents>;
    this.runtime = new MissionRuntime(this.def, this.dialogue, this.ev, this);
    const needsBattle = this.def.nodes.some((n) => n.actions.some((a) => a.type === 'bombing' || BATTLE_ACTIONS.has(a.type)));
    this.battle = needsBattle ? new Battle(game, this.def.zones ?? [], game.prng.fork('battle')) : null;
    if (this.battle) game.scene.add(this.battle.group);
    this.ev.on('BATTLE', (e) => this.battle?.handle(e.action));
    this.checkpoints = new CheckpointStore(game.settings.store);
    this.ev.on('RADIO', (e) => {
      this.subtitles.show(e);
      // câu hô giữa trận không nén tiếng súng (DV-076); thoại cốt truyện vẫn nén
      if (!e.bark) game.audio.radioCue(e.durationMs);
    });
    this.subtitles.onDisplay = (req) => game.speak(req);
    this.subtitles.onCut = () => game.stopSpeech();
    this.ev.on('OBJECTIVE', (e) => {
      if (e.status === 'active') {
        game.hud.state.objectiveKey = e.key;
        this.setMarker(e.marker ?? null, e.key);
        this.objTimer = e.timerMs ? e.timerMs / 1000 : null;
      } else if (game.hud.state.objectiveKey === e.key) {
        game.hud.state.objectiveKey = null;
        this.objTimer = null;
        if (this.objectiveMarkerKey === e.key) this.setMarker(null, null);
      }
    });
    this.ev.on('SKY_TRIGGER', (e) => {
      if (!game.sky?.trigger(e.flight)) console.warn(`[mission] sky_trigger: flight ${e.flight} not found`);
    });
    this.ev.on('GROUP_HUNT', (e) => {
      const f = game.player.controller.feet;
      for (const b of game.bots.values()) {
        if (b.group !== e.group || !b.bot.alive || b.faction === 'friend') continue;
        b.bot.hunter = true;
        b.bot.ambush = false;
        b.bot.alertTo([f[0], f[1] + 1.6, f[2]]);
      }
    });
    this.ev.on('SQUAD_ORDER', (e) => {
      game.squadmates.setOrder(e.order);
      if (e.pace) game.squadmates.pace = e.pace;
      game.support.setOrder(e.order);
      if (e.pace) game.support.pace = e.pace;
      // điểm đến chỉ sống trong lệnh có `zone`; lệnh khác xoá (Quyết lại dẫn theo mục tiêu/người chơi)
      const z = e.zone ? this.def.zones?.find((zz) => zz.id === e.zone) : undefined;
      this.squadDest = z ? [z.center[0], this.groundY(z.center[0], z.center[2], z.center[1]), z.center[2]] : null;
    });
    this.ev.on('BOMBING', (e) => {
      // quả bom rải đều dọc đoạn, lệch ngang ±18 m, thời điểm có jitter (seeded)
      const dx = e.to[0] - e.from[0];
      const dz = e.to[1] - e.from[1];
      const l = Math.hypot(dx, dz) || 1;
      const nx = -dz / l;
      const nz = dx / l;
      for (let i = 0; i < e.count; i++) {
        const k = (i + this.rng.next() * 0.6) / e.count;
        const side = (this.rng.next() - 0.5) * 36;
        const t = this.simT + (e.delayMs + k * e.durationMs) / 1000;
        this.bombs.push({ t, x: e.from[0] + dx * k + nx * side, z: e.from[1] + dz * k + nz * side, radius: e.radius, damage: e.damage });
      }
      this.bombs.sort((a, b) => a.t - b.t);
    });
    this.ev.on('INTERACTABLE', (e) => {
      const z = this.def.zones?.find((zz) => zz.id === e.zone);
      if (!z) {
        console.warn(`[mission] interactable ${e.id}: zone ${e.zone} not found`);
        return;
      }
      if (this.interactables.some((it) => it.id === e.id)) return;
      const y = game.terrain ? game.terrain.heightAt(z.center[0], z.center[2]) : z.center[1];
      this.interactables.push({ id: e.id, position: [z.center[0], y, z.center[2]], radius: Math.max(2.5, z.radius), holdMs: e.holdMs, promptKey: e.promptKey, fuseMs: e.fuseMs, prop: e.prop, blastRadius: e.blastRadius, blastDamage: e.blastDamage, progress: 0, done: false, fuseLeft: -1 });
    });
    this.ev.on('MISSION_FLAG', (e) => {
      if (e.flag === 'arty') {
        this.artyOn = e.value;
        this.artyNext = 0.6;
      } else if (e.flag === 'tanks') {
        this.tanksLeft = e.value ? 14 : 0;
        this.tanksNext = 0;
      } else if (e.flag === 'flares') {
        this.flaresOn = e.value;
        this.flareNext = 1.5;
      }
    });
    this.ev.on('CHECKPOINT_SAVED', (e) => {
      this.save(e.checkpoint);
      game.nightAct?.saveCheckpoint(e.checkpoint);
    });
    this.ev.on('MISSION_COMPLETE', () => {
      game.hud.state.missionComplete = true;
    });
    game.settings.onChange((s) => this.subtitles.applySettings(s.subtitleScale, s.subtitleBg));
  }

  start(): void {
    this.runtime.start();
  }

  private groundY(x: number, z: number, fallback: number): number {
    return this.game.terrain ? this.game.terrain.heightAt(x, z) : fallback;
  }

  private setMarker(zoneId: string | null, key: string | null): void {
    this.objectiveMarkerKey = key;
    this.markerOnLeader = zoneId === '@leader';
    if (this.markerOnLeader) {
      this.objectiveMarker = this.squadLeaderPosition();
      return;
    }
    if (!zoneId) {
      this.objectiveMarker = null;
      return;
    }
    const z = this.def.zones?.find((zz) => zz.id === zoneId);
    if (!z) {
      this.objectiveMarker = null;
      return;
    }
    const y = this.game.terrain ? this.game.terrain.heightAt(z.center[0], z.center[2]) : z.center[1];
    this.objectiveMarker = [z.center[0], y, z.center[2]];
  }

  /** bark đồng đội: cue thoại ngoài graph (id sự kiện có số thứ tự → không bị dedupe) */
  /** cue có speaker 'SQUAD' = ai trong tổ nói cũng được: dùng `speaker` truyền vào (AI-T1.5) */
  say(cueId: string, speaker: string, vars?: Record<string, string | number>, bark = true): boolean {
    const cue = this.dialogue.cues.find((c) => c.cueId === cueId);
    if (!cue) return false;
    const who = cue.speaker === 'SQUAD' ? speaker : cue.speaker;
    this.ev.emit('RADIO', { cue: cue.cueId, speaker: who, subtitleKey: cue.subtitleKey, durationMs: cue.durationMs, priority: cue.priority, interruptPolicy: cue.interruptPolicy, bus: cue.bus ?? 'dialogue', vars, bark }, { id: `${this.def.id}:bark:${cueId}:${this.barkSeq++}` });
    return true;
  }

  /**
   * DV-087 câu hô biến thể của tổ (content/voice/squad-barks.json): không có trong file thoại — khoá giọng = `cue`.<người nói>,
   * phụ đề là chính câu (`bark.raw`), thời lượng ước theo độ dài (giọng thật kéo dài khi có file).
   */
  sayLine(cue: string, speaker: string, text: string, priority: number): boolean {
    const durationMs = Math.round(700 + text.length * 60);
    this.ev.emit('RADIO', { cue, speaker, subtitleKey: 'bark.raw', durationMs, priority, interruptPolicy: priority >= 7 ? 'interrupt' : 'drop', bus: 'dialogue', vars: { t: text }, bark: true }, { id: `${this.def.id}:bark:${cue}:${this.barkSeq++}` });
    return true;
  }

  /** tuỳ chọn spawn theo group (faction/tên/archetype) — dùng cả khi restore checkpoint */
  private spawnOpts(groupId: string, index: number): { faction: 'enemy' | 'friend'; nameKey: string | null; archetype: 'grunt' | 'recon' | 'squad'; spawnName: string | null } {
    const g = this.def.spawnGroups?.find((x) => x.id === groupId);
    if (!g) return { faction: 'enemy', nameKey: null, archetype: 'grunt', spawnName: null };
    return { faction: g.faction ?? (g.archetype === 'squad' ? 'friend' : 'enemy'), nameKey: g.names?.[index] ?? null, archetype: g.archetype, spawnName: g.spawns?.[index] ?? g.spawn };
  }

  /** tuyến của bot theo hành vi nhóm (M1-T2): giữ chỗ/phục = đứng tại chỗ; tuyến riêng `patrol`; mặc định marker quanh spawn */
  private waypointsFor(groupId: string, pos: [number, number, number], base: [number, number, number], faction: 'enemy' | 'friend'): Array<[number, number, number]> | undefined {
    const g = this.def.spawnGroups?.find((x) => x.id === groupId);
    if (g?.behavior === 'ambush' || g?.behavior === 'hold') return [pos, [pos[0], pos[1], pos[2]]];
    const route = g?.patrol?.map((n) => this.game.arena.botSpawns[n]).filter((p): p is [number, number, number] => !!p);
    if (route && route.length >= 2) return route;
    return this.patrolFor(faction, base);
  }

  /** tuyến tuần tra cho địch: cover marker trong 70 m quanh điểm spawn (thám báo quanh bãi bốc), không lang thang về waypoint level */
  private patrolFor(faction: 'enemy' | 'friend', base: [number, number, number]): Array<[number, number, number]> | undefined {
    if (faction !== 'enemy') return undefined;
    const near = this.game.arena.coverMarkers.filter((c) => Math.hypot(c.position[0] - base[0], c.position[2] - base[2]) <= 70).map((c) => c.position);
    return near.length >= 2 ? near : undefined;
  }

  // ---- MissionWorld
  playerPosition(): [number, number, number] {
    const f = this.game.player.controller.feet;
    return [f[0], f[1], f[2]];
  }

  spawnGroup(groupId: string, count: number, spawnName: string): string[] {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const o = this.spawnOpts(groupId, i);
      const list = this.def.spawnGroups?.find((x) => x.id === groupId)?.spawns;
      // DV-090: nhóm đông hơn danh sách điểm → dùng lại điểm theo vòng, lệch 2,8 m mỗi vòng (không chồng lên người đứng trước)
      const lap = list && list.length ? Math.floor(i / list.length) : 0;
      const name = list && list.length ? list[i % list.length]! : (o.spawnName ?? spawnName);
      const base = this.game.arena.botSpawns[name] ?? this.game.arena.botSpawns[spawnName] ?? this.game.arena.botSpawns['bot_a']!;
      const id = `${groupId}_${this.spawnCounter++}`;
      // mỗi thành viên có điểm riêng → đặt đúng điểm; chung điểm → rải vòng 2,5 m
      const own = !!this.game.arena.botSpawns[name] && name !== spawnName;
      const a = (i / Math.max(1, count)) * Math.PI * 2 + lap * 1.9;
      const ring = lap > 0 ? 2.8 : 2.5;
      const pos: [number, number, number] = (own || i === 0) && lap === 0 ? [base[0], base[1], base[2]] : [base[0] + Math.cos(a) * ring, base[1], base[2] + Math.sin(a) * ring];
      if (lap > 0 && this.game.terrain) pos[1] = this.game.terrain.heightAt(pos[0], pos[2]);
      const support = o.faction === 'friend' && o.archetype !== 'squad';
      const b = this.game.spawnBot(id, groupId, pos, { faction: o.faction, nameKey: o.nameKey, archetype: o.archetype, waypoints: this.waypointsFor(groupId, pos, base, o.faction), support });
      if (support) this.game.support.add(b, 'follower');
      else if (o.faction === 'friend') this.game.squadmates.add(b, i === 0 ? 'leader' : 'follower');
      this.applyBehavior(groupId, b);
      this.spawned.add(id);
      ids.push(id);
    }
    return ids;
  }

  /** vị trí Quyết (tổ trưởng còn sống) — điều kiện squad_at, marker @leader */
  squadLeaderPosition(): [number, number, number] | null {
    const l = this.game.squadmates.leader();
    if (!l) return null;
    const p = l.bot.position;
    return [p[0], p[1], p[2]];
  }

  /** hành vi nhóm địch (M1-T2): phục kích / săn */
  private applyBehavior(groupId: string, b: import('@game/actors/botActor').BotActor): void {
    const g = this.def.spawnGroups?.find((x) => x.id === groupId);
    if (!g || !b.bot.alive) return;
    if (g.behavior === 'ambush') b.bot.ambush = true;
    else if (g.behavior === 'hunt') {
      const p = this.game.player.controller.feet;
      b.bot.hunter = true; // DV-083: bám người chơi tới cùng
      b.bot.alertTo([p[0], p[1] + 1.6, p[2]]);
    }
  }

  /** DV-084: tổng địch còn sống (trần quân tiếp viện) */
  enemiesAlive(): number {
    let n = 0;
    for (const b of this.game.bots.values()) if (b.faction === 'enemy' && b.bot.alive) n++;
    return n;
  }

  groupAlive(groupId: string): number {
    let n = 0;
    for (const b of this.game.bots.values()) if (b.group === groupId && b.bot.alive) n++;
    return n;
  }

  captureWorld(): Pick<CheckpointSnapshot, 'actors' | 'player' | 'inventory' | 'doors'> {
    const actors: CheckpointSnapshot['actors'] = [];
    for (const b of this.game.bots.values()) {
      const s = b.bot.snapshot();
      actors.push({ id: b.id, group: b.group, position: s.position, health: s.health, alive: s.alive, state: s.state });
    }
    for (const a of this.game.actors.values()) {
      const p = a.dummy.group.position;
      actors.push({ id: a.id, group: a.group, position: [p.x, p.y, p.z], health: a.dummy.health, alive: a.dummy.alive });
    }
    const w = this.game.weapon.snapshot();
    // checkpoint = tiếp tế lựu đạn tới số mang ban đầu (DV-074)
    const gr = Math.max(this.game.playerGrenades, GRENADE.player.count);
    this.game.playerGrenades = gr;
    return { actors, player: this.game.player.snapshot(), inventory: { weapon: w.id, mag: w.mag, reserve: w.reserve, grenades: gr }, doors: [] };
  }

  restoreWorld(s: Pick<CheckpointSnapshot, 'actors' | 'player' | 'inventory' | 'doors'>): void {
    const g = this.game;
    // 1) xóa bot do mission spawn không có trong snapshot
    const keep = new Set(s.actors.map((a) => a.id));
    for (const id of [...this.spawned]) {
      if (!keep.has(id)) {
        g.despawnBot(id);
        this.spawned.delete(id);
      }
    }
    // 2) actors
    for (const a of s.actors) {
      if (a.group === 'dummies') {
        const d = g.actors.get(a.id);
        if (!d) continue;
        d.dummy.reset();
        if (!a.alive) d.dummy.applyDamage(100);
        else if (a.health < 100) d.dummy.applyDamage(100 - a.health);
        d.body.setEnabled(a.alive);
        continue;
      }
      if (a.group === 'player') continue;
      let b = g.bots.get(a.id);
      if (!b) {
        const idx = Number(a.id.slice(a.group.length + 1));
        const o = this.spawnOpts(a.group, Number.isFinite(idx) ? idx % Math.max(1, this.def.spawnGroups?.find((x) => x.id === a.group)?.count ?? 1) : 0);
        const support = o.faction === 'friend' && o.archetype !== 'squad';
        b = g.spawnBot(a.id, a.group, a.position, { faction: o.faction, nameKey: o.nameKey, archetype: o.archetype, waypoints: this.waypointsFor(a.group, a.position, a.position, o.faction), support });
        if (support) g.support.add(b, 'follower');
        else if (o.faction === 'friend') g.squadmates.add(b, idx === 0 ? 'leader' : 'follower');
        this.spawned.add(a.id);
      }
      b.reset();
      b.bot.restore({ id: a.id, position: a.position, yaw: 0, health: a.health, alive: a.alive, state: 'PATROL', waypointIndex: 0, mag: 20 });
      b.dummy.reset();
      if (!a.alive) b.dummy.applyDamage(100);
      b.body.setEnabled(a.alive);
      b.body.setPosition(a.position[0], a.position[1], a.position[2]);
      b.dummy.group.position.set(a.position[0], a.position[1], a.position[2]);
      if (a.alive && b.faction === 'enemy') this.applyBehavior(a.group, b);
      // DV-085 đồng đội hy sinh theo kịch bản: về checkpoint trước lúc hy sinh thì người đó trở lại tổ, sau thì không
      if (b.faction === 'friend' && !b.nameKey) {
        const inSup = g.support.list().includes(b);
        if (a.alive && !inSup) g.support.add(b, 'follower');
        else if (!a.alive && inSup) g.support.remove(b.id);
      } else if (b.faction === 'friend') {
        const inSquad = g.squadmates.list().includes(b);
        if (a.alive && !inSquad) g.squadmates.add(b, b.nameKey === 'name.quyet' ? 'leader' : 'follower');
        else if (!a.alive && inSquad) g.squadmates.remove(b.id);
      }
    }
    // 3) player + inventory
    g.player.restore(s.player);
    g.weapon.restore({ mag: s.inventory.mag, reserve: s.inventory.reserve });
    g.playerGrenades = s.inventory.grenades ?? GRENADE.player.count;
    g.grenades.clear();
    g.fx.reset();
    this.subtitles.reset();
    g.hud.state.dead = false;
    g.hud.state.missionComplete = false;
  }

  currentTick(): number {
    return this.game.clock.tick;
  }

  seed(): number {
    return this.game.seed;
  }

  // ---- checkpoint
  save(checkpointId = 'manual'): SavedCheckpoint {
    const snap = this.runtime.snapshot(checkpointId);
    return this.checkpoints.save(snap, this.game.events.seenIdList());
  }

  load(checkpointId?: string): SavedCheckpoint | null {
    const saved = checkpointId ? this.checkpoints.get(checkpointId) : this.checkpoints.lastSaved;
    if (!saved) return null;
    this.runtime.restore(saved.snapshot, saved.seenEventIds);
    // objective HUD từ snapshot
    const active = Object.entries(saved.snapshot.objectives ?? {}).find(([, v]) => v === 'active');
    this.game.hud.state.objectiveKey = active ? active[0] : null;
    const act = active ? this.def.nodes.flatMap((n) => n.actions).find((x) => x.type === 'objective' && x.objectiveKey === active[0]) : undefined;
    this.setMarker(act?.marker ?? null, active ? active[0] : null);
    this.bombs.length = 0;
    this.battle?.clearPending();
    this.objTimer = null;
    this.reapplySquadOrder(saved.snapshot.node);
    this.game.nightAct?.loadCheckpoint(saved.snapshot.checkpointId);
    this.checkpoints.loads++;
    return saved;
  }

  /**
   * Lệnh tổ không nằm trong snapshot: đi theo graph từ startNode tới node được nạp, lấy squad_order cuối cùng (lệnh, nhịp, điểm
   * đến) rồi áp lại — checkpoint giữa đoạn hành quân nạp lại vẫn đi nhịp hành quân tới đúng chỗ (M1-T2).
   */
  private reapplySquadOrder(nodeId: string): void {
    let order: 'follow' | 'hold' = 'follow';
    let pace: 'march' | 'normal' | 'assault' = 'normal';
    let zone: string | undefined;
    let id: string | null = this.def.startNode;
    const seen = new Set<string>();
    while (id && !seen.has(id)) {
      seen.add(id);
      const n = this.def.nodes.find((x) => x.id === id);
      if (!n) break;
      for (const a of n.actions) {
        if (a.type !== 'squad_order') continue;
        order = a.order ?? 'follow';
        if (a.pace) pace = a.pace;
        if (a.zone) zone = a.zone;
      }
      if (id === nodeId) break;
      id = n.next;
    }
    this.game.squadmates.setOrder(order);
    this.game.squadmates.pace = pace;
    this.game.support.setOrder(order);
    this.game.support.pace = pace;
    const z = zone ? this.def.zones?.find((zz) => zz.id === zone) : undefined;
    this.squadDest = z ? [z.center[0], this.groundY(z.center[0], z.center[2], z.center[1]), z.center[2]] : null;
  }

  /** hash trạng thái hiện tại (không lưu) — cùng hàm với CheckpointStore.save */
  currentHash(): string {
    return stateHash(this.runtime.snapshot('probe'));
  }

  /** sim tick */
  step(dt: number, interact: boolean, interactHeld = interact): void {
    if (!this.paused) this.runtime.step(dt);
    this.subtitles.update(dt); // phụ đề chạy theo sim time (deterministic, không phụ thuộc render)
    this.stepInteractables(dt, interact, interactHeld);
    this.stepAmbientScript(dt);
    this.battle?.update(dt);
    if (this.objTimer !== null) this.objTimer = Math.max(0, this.objTimer - dt);
    this.game.hud.state.objectiveTimer = this.objTimer;
    if (this.markerOnLeader) this.objectiveMarker = this.squadLeaderPosition();
    // Tương tác relay (PLY-004 tối giản): prompt khi trong relay_zone và chưa cắt
    const z = this.def.zones?.find((zz) => zz.id === 'relay_zone');
    if (z) {
      const p = this.game.player.controller.feet;
      this.inRelayZone = Math.hypot(p[0] - z.center[0], p[2] - z.center[2]) <= z.radius;
    }
    const cut = this.runtime.state.flags['relay_cut'] === true;
    if (!this.activeInteract) this.game.hud.state.promptKey = this.inRelayZone && !cut && this.game.player.alive ? 'cut_relay' : null;
    if (interact && this.inRelayZone && !cut) {
      this.runtime.state.flags['relay_cut'] = true;
      this.ev.emit('MISSION_FLAG', { flag: 'relay_cut', value: true }, { id: `${this.def.id}:interact:relay_cut` });
    }
  }

  /**
   * Tương tác giữ phím: điểm gần nhất trong bán kính (người chơi sống) hiện prompt + thanh tiến trình; giữ F đủ holdMs → xong
   * (flag id = true); có ngòi → đếm fuseMs rồi `game.explode` (gỡ prop) + flag id_blown. Tiến trình rớt 2× tốc độ khi thả phím.
   */
  private stepInteractables(dt: number, edge: boolean, held: boolean): void {
    const p = this.game.player.controller.feet;
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const it of this.interactables) {
      if (it.fuseLeft >= 0) {
        it.fuseLeft -= dt;
        if (it.fuseLeft < 0) {
          it.fuseLeft = -1;
          this.game.explode(it.position, { radius: it.blastRadius, damage: it.blastDamage, prop: it.prop });
          this.setFlag(`${it.id}_blown`);
        }
      }
      if (it.done || !this.game.player.alive) continue;
      const d = Math.hypot(p[0] - it.position[0], p[2] - it.position[2]);
      if (d <= it.radius && d < bestD) {
        bestD = d;
        best = it;
      }
    }
    if (this.activeInteract && this.activeInteract !== best) this.activeInteract.progress = 0;
    this.activeInteract = best;
    if (!best) {
      this.game.hud.state.promptProgress = -1;
      return;
    }
    this.game.hud.state.promptKey = best.promptKey;
    if (best.holdMs <= 0) {
      if (edge) this.finishInteract(best);
      this.game.hud.state.promptProgress = -1;
      return;
    }
    if (held) best.progress = Math.min(1, best.progress + (dt * 1000) / best.holdMs);
    else best.progress = Math.max(0, best.progress - (dt * 2000) / best.holdMs);
    this.game.hud.state.promptProgress = best.progress;
    if (best.progress >= 1) this.finishInteract(best);
  }

  /** pháo chuẩn bị + tiếng xích + rải thảm: theo sim time, seeded (rng fork) */
  private stepAmbientScript(dt: number): void {
    this.simT += dt;
    while (this.bombs.length && this.bombs[0]!.t <= this.simT) {
      const b = this.bombs.shift()!;
      const y = this.groundY(b.x, b.z, 0);
      this.game.explode([b.x, y, b.z], { radius: b.radius, damage: b.damage, shooter: 'air' });
      this.battle?.afterBlast([b.x, y, b.z], 1.6); // DV-084: hố bom cháy âm ỉ, khói
      // đất rung theo khoảng cách (B-52 cách hàng trăm mét vẫn rung cả rừng)
      const f = this.game.player.controller.feet;
      const d = Math.hypot(f[0] - b.x, f[2] - b.z);
      this.game.player.rig.shakeAmp = Math.max(this.game.player.rig.shakeAmp, Math.min(0.9, 60 / Math.max(60, d)));
      this.bombStats.dropped++;
    }
    if (this.artyOn) {
      this.artyNext -= dt;
      if (this.artyNext <= 0) {
        this.artyNext = 0.8 + this.rng.next() * 0.7;
        const z = this.def.zones?.find((zz) => zz.id === 'top');
        if (z) {
          const a = this.rng.next() * Math.PI * 2;
          const r = Math.sqrt(this.rng.next()) * (z.radius + 40);
          const x = z.center[0] + Math.sin(a) * r;
          const zz = z.center[2] + Math.cos(a) * r;
          const y = this.game.terrain ? this.game.terrain.heightAt(x, zz) : z.center[1];
          this.game.explode([x, y, zz], { radius: 9, damage: 70 });
          this.game.player.rig.shakeAmp = Math.max(this.game.player.rig.shakeAmp, 0.3); // đất rung dù ở xa (kịch bản C1)
          this.artyStats.shells++;
        }
      }
    }
    if (this.flaresOn && this.game.flares) {
      this.flareNext -= dt;
      if (this.flareNext <= 0) {
        this.flareNext = 9 + this.rng.next() * 5;
        const z = this.def.zones?.find((zz) => zz.id === 'top');
        if (z) {
          const a = this.rng.next() * Math.PI * 2;
          const r = this.rng.next() * 60;
          const x = z.center[0] + Math.sin(a) * r;
          const zz = z.center[2] + Math.cos(a) * r;
          const g = this.game.terrain ? this.game.terrain.heightAt(x, zz) : z.center[1];
          this.game.flares.fire(x, g + 110 + this.rng.next() * 40, zz, g, this.rng.next() * 6.28);
        }
      }
    }
    if (this.tanksLeft > 0) {
      this.tanksLeft -= dt;
      this.tanksNext -= dt;
      if (this.tanksNext <= 0) {
        this.tanksNext = 0.55 + this.rng.next() * 0.2;
        this.game.audio.tone('sfx', 48 + this.rng.next() * 12, 420, 0.22);
        this.game.player.rig.shakeAmp = Math.max(this.game.player.rig.shakeAmp, 0.12);
      }
    }
  }

  private finishInteract(it: Interactable): void {
    it.done = true;
    it.progress = 0;
    this.activeInteract = null;
    this.game.hud.state.promptKey = null;
    this.game.hud.state.promptProgress = -1;
    this.setFlag(it.id);
    if (it.fuseMs > 0) it.fuseLeft = it.fuseMs / 1000;
    this.ev.emit('INTERACT_DONE', { id: it.id }, { id: `${this.def.id}:interact:${it.id}` });
  }

  /** đặt cờ nhiệm vụ từ ngoài graph (tương tác, hồi đêm DV-078): idempotent theo tên cờ */
  setFlag(flag: string, value = true): void {
    if (this.runtime.state.flags[flag] === value) return;
    this.runtime.state.flags[flag] = value;
    this.ev.emit('MISSION_FLAG', { flag, value }, { id: `${this.def.id}:flag:${flag}:${value ? 1 : 0}` });
  }

  reset(): void {
    this.bombs.length = 0;
    this.battle?.clearPending();
    this.objTimer = null;
    this.squadDest = null;
    this.markerOnLeader = false;
    this.artyOn = false;
    this.flaresOn = false;
    this.tanksLeft = 0;
    this.interactables.length = 0;
    this.activeInteract = null;
    this.game.hud.state.promptProgress = -1;
    for (const id of this.spawned) this.game.despawnBot(id);
    this.spawned.clear();
    this.game.squadmates.clear();
    this.game.support.clear();
    this.setMarker(null, null);
    this.spawnCounter = 0;
    this.runtime.reset();
    this.subtitles.reset();
    this.game.hud.state.objectiveKey = null;
    this.game.hud.state.promptKey = null;
    this.game.hud.state.missionComplete = false;
    this.runtime.start();
  }
}

