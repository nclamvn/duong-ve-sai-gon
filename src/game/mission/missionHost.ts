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
import dialogueJson from '@content/missions/g0-dialogue.json';

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

  constructor(private readonly game: Game) {
    this.def = loadMission(missionJson);
    this.dialogue = loadDialogue(dialogueJson);
    this.ev = game.events as unknown as EventBus<MissionEvents>;
    this.runtime = new MissionRuntime(this.def, this.dialogue, this.ev, this);
    this.checkpoints = new CheckpointStore(game.settings.store);
    this.ev.on('RADIO', (e) => {
      this.subtitles.show(e);
      game.audio.radioCue(e.durationMs);
    });
    this.ev.on('OBJECTIVE', (e) => {
      if (e.status === 'active') game.hud.state.objectiveKey = e.key;
      else if (game.hud.state.objectiveKey === e.key) game.hud.state.objectiveKey = null;
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

  // ---- MissionWorld
  playerPosition(): [number, number, number] {
    const f = this.game.player.controller.feet;
    return [f[0], f[1], f[2]];
  }

  spawnGroup(groupId: string, count: number, spawnName: string): string[] {
    const base = this.game.arena.botSpawns[spawnName] ?? this.game.arena.botSpawns['bot_a']!;
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const id = `${groupId}_${this.spawnCounter++}`;
      const a = (i / Math.max(1, count)) * Math.PI * 2;
      const pos: [number, number, number] = [base[0] + Math.cos(a) * 2.5, base[1], base[2] + Math.sin(a) * 2.5];
      this.game.spawnBot(id, groupId, pos);
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
        b = g.spawnBot(a.id, a.group, a.position);
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
    this.spawnCounter = 0;
    this.runtime.reset();
    this.subtitles.reset();
    this.game.hud.state.objectiveKey = null;
    this.game.hud.state.promptKey = null;
    this.game.hud.state.missionComplete = false;
    this.runtime.start();
  }
}

