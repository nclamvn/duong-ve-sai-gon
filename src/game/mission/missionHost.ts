/**
 * MissionHost — nối MissionRuntime với Game (MissionWorld adapter): spawn group → bots, capture/restore world,
 * checkpoint, subtitles, HUD objective/prompt, radio ducking. Game gọi host.step() trong sim.
 */
import type { EventBus } from '@engine/core';
import type { Game } from '@game/game';
import { MissionRuntime, type MissionWorld } from './runtime';
import { loadMission, loadDialogue } from './loader';
import { CheckpointStore, stateHash, type SavedCheckpoint } from './checkpoint';
import type { CheckpointSnapshot, MissionDefinition, DialogueSet, MissionEvents } from './types';
import { Subtitles } from '@ui/subtitles';
import missionJson from '@content/missions/g0-arena.mission.json';
import phoMissionJson from '@content/missions/pho-van-hai.mission.json';
import truongSonMissionJson from '@content/missions/truong-son-a.mission.json';
import dialogueJson from '@content/missions/g0-dialogue.json';
import truongSonDialogueJson from '@content/missions/truong-son-a.dialogue.json';

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
  /** điểm marker mục tiêu hiện tại (world) — HUD la bàn/marker/minimap (TIP-UX02) */
  objectiveMarker: [number, number, number] | null = null;
  private objectiveMarkerKey: string | null = null;
  private barkSeq = 0;

  constructor(private readonly game: Game) {
    const m1 = game.levelId === 'truong-son';
    this.def = loadMission(game.levelId === 'pho' ? phoMissionJson : m1 ? truongSonMissionJson : missionJson);
    this.dialogue = loadDialogue(m1 ? truongSonDialogueJson : dialogueJson);
    this.ev = game.events as unknown as EventBus<MissionEvents>;
    this.runtime = new MissionRuntime(this.def, this.dialogue, this.ev, this);
    this.checkpoints = new CheckpointStore(game.settings.store);
    this.ev.on('RADIO', (e) => {
      this.subtitles.show(e);
      game.audio.radioCue(e.durationMs);
    });
    this.ev.on('OBJECTIVE', (e) => {
      if (e.status === 'active') {
        game.hud.state.objectiveKey = e.key;
        this.setMarker(e.marker ?? null, e.key);
      } else if (game.hud.state.objectiveKey === e.key) {
        game.hud.state.objectiveKey = null;
        if (this.objectiveMarkerKey === e.key) this.setMarker(null, null);
      }
    });
    this.ev.on('SKY_TRIGGER', (e) => {
      if (!game.sky?.trigger(e.flight)) console.warn(`[mission] sky_trigger: flight ${e.flight} not found`);
    });
    this.ev.on('SQUAD_ORDER', (e) => {
      game.squadmates.order = e.order;
    });
    this.ev.on('CHECKPOINT_SAVED', (e) => this.save(e.checkpoint));
    this.ev.on('MISSION_COMPLETE', () => {
      game.hud.state.missionComplete = true;
    });
    game.settings.onChange((s) => this.subtitles.applySettings(s.subtitleScale, s.subtitleBg));
  }

  start(): void {
    this.runtime.start();
  }

  private setMarker(zoneId: string | null, key: string | null): void {
    this.objectiveMarkerKey = key;
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
  say(cueId: string, _speaker: string): boolean {
    const cue = this.dialogue.cues.find((c) => c.cueId === cueId);
    if (!cue) return false;
    this.ev.emit('RADIO', { cue: cue.cueId, speaker: cue.speaker, subtitleKey: cue.subtitleKey, durationMs: cue.durationMs, priority: cue.priority, interruptPolicy: cue.interruptPolicy, bus: cue.bus ?? 'dialogue' }, { id: `${this.def.id}:bark:${cueId}:${this.barkSeq++}` });
    return true;
  }

  /** tuỳ chọn spawn theo group (faction/tên/archetype) — dùng cả khi restore checkpoint */
  private spawnOpts(groupId: string, index: number): { faction: 'enemy' | 'friend'; nameKey: string | null; archetype: 'grunt' | 'recon' | 'squad'; spawnName: string | null } {
    const g = this.def.spawnGroups?.find((x) => x.id === groupId);
    if (!g) return { faction: 'enemy', nameKey: null, archetype: 'grunt', spawnName: null };
    return { faction: g.faction ?? (g.archetype === 'squad' ? 'friend' : 'enemy'), nameKey: g.names?.[index] ?? null, archetype: g.archetype, spawnName: g.spawns?.[index] ?? g.spawn };
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
      const base = this.game.arena.botSpawns[o.spawnName ?? spawnName] ?? this.game.arena.botSpawns[spawnName] ?? this.game.arena.botSpawns['bot_a']!;
      const id = `${groupId}_${this.spawnCounter++}`;
      // mỗi thành viên có điểm riêng → đặt đúng điểm; chung điểm → rải vòng 2,5 m
      const own = !!this.game.arena.botSpawns[o.spawnName ?? ''] && o.spawnName !== spawnName;
      const a = (i / Math.max(1, count)) * Math.PI * 2;
      const pos: [number, number, number] = own || i === 0 ? [base[0], base[1], base[2]] : [base[0] + Math.cos(a) * 2.5, base[1], base[2] + Math.sin(a) * 2.5];
      const b = this.game.spawnBot(id, groupId, pos, { faction: o.faction, nameKey: o.nameKey, archetype: o.archetype, waypoints: this.patrolFor(o.faction, base) });
      if (o.faction === 'friend') this.game.squadmates.add(b, i === 0 ? 'leader' : 'follower');
      this.spawned.add(id);
      ids.push(id);
    }
    return ids;
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
    return { actors, player: this.game.player.snapshot(), inventory: { weapon: w.id, mag: w.mag, reserve: w.reserve }, doors: [] };
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
        b = g.spawnBot(a.id, a.group, a.position, { faction: o.faction, nameKey: o.nameKey, archetype: o.archetype });
        if (o.faction === 'friend') g.squadmates.add(b, idx === 0 ? 'leader' : 'follower');
        this.spawned.add(a.id);
      }
      b.reset();
      b.bot.restore({ id: a.id, position: a.position, yaw: 0, health: a.health, alive: a.alive, state: 'PATROL', waypointIndex: 0, mag: 20 });
      b.dummy.reset();
      if (!a.alive) b.dummy.applyDamage(100);
      b.body.setEnabled(a.alive);
      b.body.setPosition(a.position[0], a.position[1], a.position[2]);
      b.dummy.group.position.set(a.position[0], a.position[1], a.position[2]);
    }
    // 3) player + inventory
    g.player.restore(s.player);
    g.weapon.restore({ mag: s.inventory.mag, reserve: s.inventory.reserve });
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
    this.checkpoints.loads++;
    return saved;
  }

  /** hash trạng thái hiện tại (không lưu) — cùng hàm với CheckpointStore.save */
  currentHash(): string {
    return stateHash(this.runtime.snapshot('probe'));
  }

  /** sim tick */
  step(dt: number, interact: boolean): void {
    this.runtime.step(dt);
    this.subtitles.update(dt); // phụ đề chạy theo sim time (deterministic, không phụ thuộc render)
    // Tương tác relay (PLY-004 tối giản): prompt khi trong relay_zone và chưa cắt
    const z = this.def.zones?.find((zz) => zz.id === 'relay_zone');
    if (z) {
      const p = this.game.player.controller.feet;
      this.inRelayZone = Math.hypot(p[0] - z.center[0], p[2] - z.center[2]) <= z.radius;
    }
    const cut = this.runtime.state.flags['relay_cut'] === true;
    this.game.hud.state.promptKey = this.inRelayZone && !cut && this.game.player.alive ? 'cut_relay' : null;
    if (interact && this.inRelayZone && !cut) {
      this.runtime.state.flags['relay_cut'] = true;
      this.ev.emit('MISSION_FLAG', { flag: 'relay_cut', value: true }, { id: `${this.def.id}:interact:relay_cut` });
    }
  }

  reset(): void {
    for (const id of this.spawned) this.game.despawnBot(id);
    this.spawned.clear();
    this.game.squadmates.clear();
    this.game.squadmates.order = 'follow';
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

