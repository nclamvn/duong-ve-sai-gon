/**
 * Debug API `window.__ht` cho Playwright/QA (PRD §3 Test, §3.2 qa/debug). Không ship trong release:
 * PROD build chỉ cài khi ?debug=1. TIP-003 metrics · TIP-004 summary/bench · TIP-008 mission/checkpoint.
 */
import type { Game } from '@game/game';
import type { TelemetrySummary } from './telemetry';
import type { BenchReport } from './bench';
import type { CalibApi } from './calib';

export interface HtDebugApi {
  ready: boolean;
  version: string;
  buildHash: string;
  backend: string;
  metrics(): { frames: number; lastFrameMs: number; scale: number; calls: number; triangles: number; tick: number; simTime: number };
  summary(): TelemetrySummary;
  benchReport?: BenchReport;
  benchSaved?: { saved: string | null; downloaded: boolean };
  game: Game;
  teleport(x: number, y: number, z: number): void;
  setSeed(n: number): void;
  stateHash(): string;
  reset(seed?: number): void;
  stepSim(ticks: number): void;
  kill(groupOrId: string): number;
  mission: {
    state(): { currentNode: string | null; flags: Record<string, boolean>; objectives: Record<string, 'active' | 'complete'>; complete: boolean; groups: Record<string, string[]> };
    trigger(nodeId: string): void;
    zones(): Record<string, { center: [number, number, number]; radius: number }>;
    subtitle(): string | null;
    subtitlesShown(): string[];
  };
  checkpoint: { save(id?: string): string; load(id?: string): string | null; lastHash(): string | null; saves(): number };
  events: { recent(n?: number): Array<{ type: string; id: string | null; tick: number }>; countOf(type: string): number; duplicates(): number };
  bots(): Array<{ id: string; group: string; state: string; lod: string; alive: boolean; health: number; position: [number, number, number] }>;
  /** chế độ hiệu chỉnh tay cầm (TIP-017) — chỉ khi ?calib= */
  calib?: CalibApi;
  [k: string]: unknown;
}

declare global {
  interface Window {
    __ht?: HtDebugApi;
  }
}

export function installDebugApi(game: Game, buildHash: string): HtDebugApi | null {
  const params = new URLSearchParams(location.search);
  if (import.meta.env.PROD && params.get('debug') !== '1') return null;
  const api: HtDebugApi = {
    ready: true,
    version: '0.1.0-g0',
    buildHash,
    backend: game.bundle.backend,
    metrics: () => ({
      frames: game.frames,
      lastFrameMs: game.lastFrameMs,
      scale: game.scaler.scale,
      calls: game.renderInfo.calls,
      triangles: game.renderInfo.triangles,
      tick: game.clock.tick,
      simTime: game.clock.simTime,
    }),
    summary: () => game.telemetry.summary(),
    game,
    teleport: (x, y, z) => game.player.controller.teleport(x, y, z),
    setSeed: (n) => game.reset(n),
    stateHash: () => game.mission.currentHash(),
    reset: (seed) => game.reset(seed ?? game.seed),
    stepSim: (ticks) => game.stepSim(ticks),
    kill: (groupOrId) => {
      let n = 0;
      for (const b of game.bots.values()) {
        if ((b.id === groupOrId || b.group === groupOrId) && b.bot.alive) {
          game.events.emit('HIT', { actorId: b.id, zone: 'head', damage: 1000, point: [b.bot.position[0], b.bot.position[1] + 1.6, b.bot.position[2]], penetrated: false });
          n++;
        }
      }
      return n;
    },
    mission: {
      state: () => {
        const st = game.mission.runtime.state;
        return { currentNode: st.currentNode, flags: { ...st.flags }, objectives: { ...st.objectives }, complete: st.complete, groups: { ...st.groups } };
      },
      trigger: (nodeId) => game.mission.runtime.jumpTo(nodeId),
      zones: () => Object.fromEntries((game.mission.def.zones ?? []).map((z) => [z.id, { center: z.center, radius: z.radius }])),
      subtitle: () => game.mission.subtitles.activeCue,
      subtitlesShown: () => [...game.mission.subtitles.shown],
    },
    checkpoint: {
      save: (id) => game.mission.save(id ?? 'manual').hash,
      load: (id) => game.mission.load(id)?.hash ?? null,
      lastHash: () => game.mission.checkpoints.lastSaved?.hash ?? null,
      saves: () => game.mission.checkpoints.saves,
    },
    events: {
      recent: (n) => game.events.recent(n ?? 32).map((r) => ({ type: r.type, id: r.id, tick: r.tick })),
      countOf: (type) => game.events.countOf(type),
      duplicates: () => game.events.duplicates,
    },
    bots: () => [...game.bots.values()].map((b) => ({ id: b.id, group: b.group, state: b.bot.state, lod: b.bot.lod, alive: b.bot.alive, health: b.bot.health, position: [b.bot.position[0], b.bot.position[1], b.bot.position[2]] })),
  };
  window.__ht = api;
  return api;
}
