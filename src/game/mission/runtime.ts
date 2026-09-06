/**
 * MissionRuntime (PRD §6.5, §8): chạy graph node data-driven. Action idempotent qua EventBus id
 * `${missionId}:${nodeId}:${actionIdx}`; node có timeout/fallback; snapshot/restore sạch.
 * Không chứa shader/physics low-level. Thế giới (spawn, zone, actor) qua interface deps.
 */
import type { EventBus } from '@engine/core';
import type { MissionDefinition, MissionNode, MissionCondition, MissionAction, DialogueSet, DialogueCue, MissionEvents, CheckpointSnapshot } from './types';

export interface MissionWorld {
  /** vị trí player (feet) */
  playerPosition(): [number, number, number];
  /** spawn group → trả danh sách actor id đã spawn */
  spawnGroup(groupId: string, count: number, spawnName: string): string[];
  /** số actor còn sống trong group */
  groupAlive(groupId: string): number;
  /** snapshot/restore phần thế giới (player, actors, inventory) */
  captureWorld(): Pick<CheckpointSnapshot, 'actors' | 'player' | 'inventory' | 'doors'>;
  restoreWorld(s: Pick<CheckpointSnapshot, 'actors' | 'player' | 'inventory' | 'doors'>): void;
  currentTick(): number;
  seed(): number;
}

export interface MissionState {
  currentNode: string | null;
  flags: Record<string, boolean>;
  objectives: Record<string, 'active' | 'complete'>;
  /** group → actor ids */
  groups: Record<string, string[]>;
  nodeEnteredTick: number;
  complete: boolean;
  /** ms đã ở trong node hiện tại */
  nodeMs: number;
  /** đã enter-check xong node hiện tại (actions đã chạy) */
  nodeActive: boolean;
  /** nodeMs lúc actions chạy (điều kiện active_ms) */
  nodeActiveMs: number;
}

export class MissionRuntime {
  readonly state: MissionState = { currentNode: null, flags: {}, objectives: {}, groups: {}, nodeEnteredTick: 0, complete: false, nodeMs: 0, nodeActive: false, nodeActiveMs: 0 };
  private readonly nodes = new Map<string, MissionNode>();
  private readonly cues = new Map<string, DialogueCue>();
  private readonly zoneInside = new Map<string, boolean>();
  /** số lần zone_enter được đánh giá true (test idempotent) */
  zoneEnterHits = 0;
  private started = false;

  constructor(
    readonly def: MissionDefinition,
    dialogue: DialogueSet,
    private readonly events: EventBus<MissionEvents>,
    private readonly world: MissionWorld,
  ) {
    for (const n of def.nodes) this.nodes.set(n.id, n);
    for (const c of dialogue.cues) this.cues.set(c.cueId, c);
  }

  start(): void {
    this.started = true;
    this.enterNode(this.def.startNode);
  }

  private enterNode(id: string | null): void {
    if (id === null) return;
    const node = this.nodes.get(id);
    if (!node) throw new Error(`mission node not found: ${id}`);
    this.state.currentNode = id;
    this.state.nodeEnteredTick = this.world.currentTick();
    this.state.nodeMs = 0;
    this.state.nodeActive = false;
    this.state.nodeActiveMs = 0;
    this.events.emit('NODE_ENTER', { node: id });
  }

  private zoneOf(id: string): { center: [number, number, number]; radius: number } | null {
    const z = this.def.zones?.find((zz) => zz.id === id);
    return z ? { center: z.center, radius: z.radius } : null;
  }

  /** Điều kiện — đánh giá mỗi tick; zone_enter là edge (vào zone) nhưng runtime vẫn idempotent nhờ event id. */
  private check(c: MissionCondition): boolean {
    switch (c.type) {
      case 'always':
        return true;
      case 'flag':
        return (this.state.flags[c.flag ?? ''] ?? false) === (c.value ?? true);
      case 'group_dead': {
        const ids = this.state.groups[c.group ?? ''];
        if (!ids) return false; // chưa spawn → chưa "chết"
        return this.world.groupAlive(c.group ?? '') === 0;
      }
      case 'timeout':
        return this.state.nodeMs >= (c.ms ?? 0);
      case 'active_ms': // ms kể từ khi action của node đã chạy (không tính thời gian chờ enterConditions)
        return this.state.nodeActive && this.state.nodeMs - this.state.nodeActiveMs >= (c.ms ?? 0);
      case 'zone_enter': {
        const z = this.zoneOf(c.zone ?? '');
        if (!z) return false;
        const p = this.world.playerPosition();
        const inside = Math.hypot(p[0] - z.center[0], p[2] - z.center[2]) <= z.radius;
        if (inside) this.zoneEnterHits++;
        this.zoneInside.set(c.zone ?? '', inside);
        return inside;
      }
      default:
        return false;
    }
  }

  private all(conds: MissionCondition[]): boolean {
    for (let i = 0; i < conds.length; i++) if (!this.check(conds[i]!)) return false;
    return true;
  }

  private runAction(nodeId: string, idx: number, a: MissionAction): void {
    const id = `${this.def.id}:${nodeId}:${idx}`;
    switch (a.type) {
      case 'radio': {
        const cue = this.cues.get(a.cue ?? '');
        if (!cue) return;
        this.events.emit('RADIO', { cue: cue.cueId, speaker: cue.speaker, subtitleKey: cue.subtitleKey, durationMs: cue.durationMs, priority: cue.priority, interruptPolicy: cue.interruptPolicy, bus: cue.bus ?? 'dialogue' }, { id });
        break;
      }
      case 'objective':
        if (this.events.emit('OBJECTIVE', { key: a.objectiveKey ?? '', status: 'active', marker: a.marker }, { id })) this.state.objectives[a.objectiveKey ?? ''] = 'active';
        break;
      case 'objective_complete':
        if (this.events.emit('OBJECTIVE', { key: a.objectiveKey ?? '', status: 'complete' }, { id })) this.state.objectives[a.objectiveKey ?? ''] = 'complete';
        break;
      case 'spawn': {
        const g = this.def.spawnGroups?.find((x) => x.id === a.group);
        if (!g) return;
        if (this.events.emit('SPAWN_GROUP', { group: g.id, count: g.count, spawn: g.spawn }, { id })) {
          this.state.groups[g.id] = this.world.spawnGroup(g.id, Math.min(g.count, g.budget ?? g.count), g.spawn);
        }
        break;
      }
      case 'checkpoint':
        this.events.emit('CHECKPOINT_SAVED', { checkpoint: a.checkpoint ?? '' }, { id });
        break;
      case 'mission_complete':
        if (this.events.emit('MISSION_COMPLETE', { missionId: this.def.id }, { id })) this.state.complete = true;
        break;
      case 'set_flag':
        this.state.flags[a.flag ?? ''] = a.value ?? true;
        this.events.emit('MISSION_FLAG', { flag: a.flag ?? '', value: a.value ?? true }, { id });
        break;
      case 'sky_trigger':
        this.events.emit('SKY_TRIGGER', { flight: a.flight ?? '' }, { id });
        break;
      case 'squad_order':
        this.events.emit('SQUAD_ORDER', { order: a.order ?? 'follow' }, { id });
        break;
    }
  }

  /** Gọi mỗi sim tick (dt giây). */
  step(dt: number): void {
    if (!this.started || this.state.complete) return;
    const id = this.state.currentNode;
    if (!id) return;
    const node = this.nodes.get(id)!;
    this.state.nodeMs += dt * 1000;
    if (!this.state.nodeActive) {
      if (!this.all(node.enterConditions)) {
        if (node.timeoutMs && node.timeoutMs > 0 && this.state.nodeMs >= node.timeoutMs) {
          this.events.emit('NODE_TIMEOUT', { node: id, fallback: node.fallbackNext ?? null });
          this.enterNode(node.fallbackNext ?? node.next);
        }
        return;
      }
      this.state.nodeActive = true;
      this.state.nodeActiveMs = this.state.nodeMs;
      for (let i = 0; i < node.actions.length; i++) this.runAction(id, i, node.actions[i]!);
    }
    if (node.type === 'terminal') return;
    if (this.all(node.exitConditions)) {
      this.events.emit('NODE_EXIT', { node: id, next: node.next });
      this.enterNode(node.next);
    } else if (node.timeoutMs && node.timeoutMs > 0 && this.state.nodeMs >= node.timeoutMs) {
      this.events.emit('NODE_TIMEOUT', { node: id, fallback: node.fallbackNext ?? null });
      this.enterNode(node.fallbackNext ?? node.next);
    }
  }

  snapshot(checkpointId: string): CheckpointSnapshot {
    const w = this.world.captureWorld();
    return {
      schemaVersion: 1,
      missionId: this.def.id,
      checkpointId,
      node: this.state.currentNode ?? this.def.startNode,
      missionFlags: { ...this.state.flags },
      objectives: { ...this.state.objectives },
      actors: w.actors,
      player: w.player,
      inventory: w.inventory,
      doors: w.doors,
      timers: { nodeMs: this.state.nodeMs, nodeActiveMs: this.state.nodeActiveMs },
      seed: this.world.seed(),
      tick: this.world.currentTick(),
    };
  }

  /** Restore: xóa runtime state cũ trước (PRD §8), rồi apply. Caller phải reset EventBus + restoreSeen. */
  restore(s: CheckpointSnapshot, seenEventIds: string[]): void {
    this.state.flags = {};
    this.state.objectives = {};
    this.state.groups = {};
    this.state.complete = false;
    this.zoneInside.clear();
    this.zoneEnterHits = 0;
    this.events.reset();
    this.events.restoreSeen(seenEventIds);
    this.world.restoreWorld(s);
    this.state.flags = { ...s.missionFlags };
    this.state.objectives = { ...(s.objectives ?? {}) };
    // groups: từ actors trong snapshot
    for (const a of s.actors) {
      if (a.group === 'dummies' || a.group === 'ambient' || a.group === 'player') continue;
      (this.state.groups[a.group] ??= []).push(a.id);
    }
    this.state.currentNode = s.node;
    this.state.nodeMs = s.timers['nodeMs'] ?? 0;
    this.state.nodeEnteredTick = s.tick;
    // node hiện tại coi như đã enter-check + actions đã chạy (event id đã có trong seen) → chỉ chờ exit
    this.state.nodeActive = true;
    this.state.nodeActiveMs = s.timers['nodeActiveMs'] ?? 0;
    this.started = true;
  }

  reset(): void {
    this.state.currentNode = null;
    this.state.flags = {};
    this.state.objectives = {};
    this.state.groups = {};
    this.state.complete = false;
    this.state.nodeMs = 0;
    this.state.nodeActive = false;
    this.zoneInside.clear();
    this.zoneEnterHits = 0;
    this.started = false;
  }

  /** Nhảy tới node (debug). */
  jumpTo(nodeId: string): void {
    this.enterNode(nodeId);
  }
}
