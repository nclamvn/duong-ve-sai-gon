/**
 * CheckpointStore (PRD §6.5 Restart invariant, §8 CheckpointSnapshot): memory + IndexedDB; stateHash canonical.
 */
import { hashString } from '@engine/core';
import type { KeyValueStore } from '@game/player/settings';
import type { CheckpointSnapshot } from './types';

/** JSON canonical (key sắp xếp) — bỏ trường volatile (tick, timers) để hash so sánh trạng thái thật. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(',')}}`;
}

export function stateHash(s: CheckpointSnapshot): string {
  const { tick: _t, timers: _tm, checkpointId: _c, ...rest } = s; // checkpointId là nhãn, không phải trạng thái
  // FSM state của actor là volatile (path/timer nội bộ không nằm trong snapshot) → không đưa vào hash
  rest.actors = rest.actors.map(({ state: _s, ...a }) => a);
  // làm tròn số thực để hash ổn định qua float noise
  const rounded = JSON.parse(JSON.stringify(rest, (_k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v))) as unknown;
  return hashString(canonical(rounded)).toString(16).padStart(8, '0');
}

export interface SavedCheckpoint {
  snapshot: CheckpointSnapshot;
  seenEventIds: string[];
  hash: string;
  savedAt: string;
}

export class CheckpointStore {
  private readonly mem = new Map<string, SavedCheckpoint>();
  lastSaved: SavedCheckpoint | null = null;
  saves = 0;
  loads = 0;

  constructor(
    private readonly store: KeyValueStore | null,
    private readonly keyPrefix = 'ht-checkpoint',
  ) {}

  save(snapshot: CheckpointSnapshot, seenEventIds: string[]): SavedCheckpoint {
    const saved: SavedCheckpoint = { snapshot, seenEventIds: [...seenEventIds], hash: stateHash(snapshot), savedAt: new Date().toISOString() };
    this.mem.set(snapshot.checkpointId, saved);
    this.lastSaved = saved;
    this.saves++;
    if (this.store) void this.store.set(`${this.keyPrefix}:${snapshot.missionId}:${snapshot.checkpointId}`, saved).catch(() => undefined);
    return saved;
  }

  get(checkpointId: string): SavedCheckpoint | null {
    return this.mem.get(checkpointId) ?? null;
  }

  async loadPersisted(missionId: string, checkpointId: string): Promise<SavedCheckpoint | null> {
    if (!this.store) return null;
    try {
      const s = await this.store.get<SavedCheckpoint>(`${this.keyPrefix}:${missionId}:${checkpointId}`);
      if (s) this.mem.set(checkpointId, s);
      return s ?? null;
    } catch {
      return null;
    }
  }

  clear(): void {
    this.mem.clear();
    this.lastSaved = null;
  }
}
