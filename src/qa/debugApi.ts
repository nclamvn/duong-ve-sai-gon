/**
 * Debug API `window.__ht` cho Playwright/QA (PRD §3 Test, §3.2 qa/debug). Không ship trong release:
 * PROD build chỉ cài khi ?debug=1. TIP-003 metrics · TIP-004 summary/bench · TIP-008 mission/checkpoint.
 */
import type { Game } from '@game/game';
import type { TelemetrySummary } from './telemetry';
import type { BenchReport } from './bench';
import type { CalibApi } from './calib';
import { loadModel } from '@engine/render/assets';
import { Box3, Vector3, type Mesh } from 'three/webgpu';

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
  /** QA prop: nạp assets/models/<id>.glb đặt vào scene (TIP-021 lineup) → kích thước bbox (m) */
  /** id có '/' → đường dẫn assets/<id>.glb (vd. vegetation/fern); keep = regex tên node giữ hiển thị (LOD/biến thể) */
  spawnModel(id: string, x: number, y: number, z: number, yaw?: number, scale?: number, keep?: string): Promise<{ size: [number, number, number]; min: [number, number, number]; tris: number }>;
  /** terrain (TIP-D04): cao độ mặt đất tại (x, z) — null khi level không có terrain */
  terrainHeight(x: number, z: number): number | null;
  /** terrain (TIP-D04): thống kê LOD/draw/tris của frame gần nhất */
  terrainStats(): { lod: number[]; visible: number; chunks: number; tris: number; draws: number; navPrebuilt: boolean; polys: number } | null;
  /** rừng (TIP-D05): thống kê frame gần nhất + thời gian nạp/bake — null khi không có rừng */
  vegetationStats(): { species: number; placed: number; visible: number; draws: number; triangles: number; impostors: number; lod: number[]; cpuMs: number; colliders: number; loadMs: number; bakeMs: number; perSpecies: Record<string, number> } | null;
  /** rừng: gió 0..1 (VEG-002) */
  setWind(strength: number, dirX?: number, dirZ?: number): void;
  /** máy bay (TIP-D-SKY): thống kê + lượt đang bay; skyAdvance tua lịch (s) */
  skyStats(): { flights: number; active: number; runs: number; parachutes: number; gust: number; nearestM: number; time: number; runsNow: Array<{ id: string; phase: string; pos: [number, number, number]; s: number; length: number }>; parasNow: Array<{ pos: [number, number, number]; alive: boolean }> } | null;
  skyAdvance(seconds: number): void;
  skyDrop(x: number, y: number, z: number): void;
  /** kích hoạt lượt bay theo id (mission sky_trigger) */
  skyTrigger(flightId: string): boolean;
  /** đồng đội (TIP-M1A): số thành viên còn sống, khoảng cách xa nhất tới người chơi, lệnh, bark */
  squad(): { count: number; maxDist: number; leaderDist: number; followerDist: number; order: string; barks: number; members: Array<{ id: string; name: string | null; faction: string; alive: boolean; health: number; state: string }> };
  /** HUD (TIP-UX02): thống kê + marker mục tiêu */
  hud(): { hits: number; kills: number; damageIndicators: number; objectiveChanges: number; heading: number; objectiveDist: number | null; marker: [number, number, number] | null; markers3d: number; minimapImage: boolean };
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
    spawnModel: async (id, x, y, z, yaw = 0, scale = 1, keep) => {
      const base = import.meta.env.BASE_URL ?? '/';
      const g = await loadModel(id.includes('/') ? `${base}assets/${id}.glb` : `${base}assets/models/${id}.glb`);
      g.position.set(x, y, z);
      g.rotation.y = yaw;
      g.scale.setScalar(scale);
      let tris = 0;
      if (keep) {
        const re = new RegExp(keep);
        for (const c of g.children) c.visible = re.test(c.name);
      }
      g.traverse((o) => {
        const m = o as Mesh;
        if (m.isMesh && m.visible && (!m.parent || m.parent.visible)) tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes['position']!.count) / 3;
      });
      game.scene.add(g);
      g.updateMatrixWorld(true);
      const bb = new Box3().setFromObject(g);
      const sz = bb.getSize(new Vector3());
      return { size: [sz.x, sz.y, sz.z], min: [bb.min.x, bb.min.y, bb.min.z], tris };
    },
    terrainHeight: (x, z) => (game.terrain ? game.terrain.heightAt(x, z) : null),
    terrainStats: () => (game.terrain ? { ...game.terrain.mesh.stats, lod: [...game.terrain.mesh.stats.lod], navPrebuilt: !!game.terrain.navPrebuilt, polys: game.nav?.polyCount ?? 0 } : null),
    vegetationStats: () => {
      const f = game.forest;
      if (!f) return null;
      const s = f.system.stats;
      return { ...s, lod: [...s.lod], loadMs: f.loadMs, bakeMs: f.bakeMs, perSpecies: f.system.placedPerSpecies() };
    },
    setWind: (strength, dirX, dirZ) => game.forest?.system.setWind(strength, dirX, dirZ),
    skyStats: () => (game.sky ? { ...game.sky.stats, time: game.sky.time, runsNow: game.sky.active(), parasNow: game.sky.parachutesNow() } : null),
    skyAdvance: (seconds) => game.sky?.advance(seconds),
    skyTrigger: (id) => game.sky?.trigger(id) ?? false,
    squad: () => ({
      count: game.squadmates.list().filter((b) => b.bot.alive).length,
      maxDist: game.squadmates.maxDistToPlayer(),
      leaderDist: game.squadmates.maxDistToPlayer('leader'),
      followerDist: game.squadmates.maxDistToPlayer('follower'),
      order: game.squadmates.order,
      barks: game.squadmates.stats.barks,
      members: [...game.bots.values()].map((b) => ({ id: b.id, name: b.nameKey, faction: b.faction, alive: b.bot.alive, health: b.bot.health, state: b.bot.state })),
    }),
    hud: () => ({ ...game.hud.stats, heading: game.hud.state.headingDeg, objectiveDist: game.hud.state.objectiveDist, marker: game.mission.objectiveMarker, markers3d: game.hud.markers.count, minimapImage: game.hud.minimap.hasImage }),
    skyDrop: (x, y, z) => game.sky?.dropParachute(x, y, z),
    bots: () => [...game.bots.values()].map((b) => ({ id: b.id, group: b.group, state: b.bot.state, lod: b.bot.lod, alive: b.bot.alive, health: b.bot.health, position: [b.bot.position[0], b.bot.position[1], b.bot.position[2]] })),
  };
  // calib tay FP v2 (TIP-D11b): chỉnh pose bằng ảnh sandbox rồi dump ra để ghi vào ak47.json#fp.handsPose
  api.fp = {
    has: () => !!game.fpHands,
    pose: () => game.fpHandsPose,
    setArm: (side: 'R' | 'L', px: number, py: number, pz: number, rx: number, ry: number, rz: number, ex: number, ey: number, ez: number) => {
      const p = game.fpHandsPose; if (!game.fpHands || !p) return;
      const a = side === 'L' ? p.armL : p.armR;
      a.pos = [px, py, pz]; a.rot = [rx, ry, rz]; a.pole = [ex, ey, ez];
      game.fpHands.applyPose(p);
    },
    setFinger: (prefix: string, x: number, y: number, z: number) => {
      const p = game.fpHandsPose; if (!game.fpHands || !p) return;
      p.fingers[prefix] = [x, y, z]; game.fpHands.applyPose(p);
    },
    setScale: (s: number) => { const p = game.fpHandsPose; if (!game.fpHands || !p) return; p.scale = s; game.fpHands.applyPose(p); },
    setPlace: (px: number, py: number, pz: number, ex = 0, ey = 0, ez = 0) => {
      const p = game.fpHandsPose; if (!game.fpHands || !p) return;
      p.place = { pos: [px, py, pz], euler: [ex, ey, ez] }; game.fpHands.applyPose(p);
    },
    setPose: (json: string) => { if (!game.fpHands) return; game.fpHandsPose = JSON.parse(json); game.fpHands.applyPose(game.fpHandsPose!); },
    dump: () => JSON.stringify(game.fpHandsPose),
    tris: () => game.fpHands?.triangles ?? 0,
  };
  // calib viewmodel rig sẵn (TIP-D11b): co/xoay/dời cả bộ AK+tay
  api.vm = {
    has: () => game.viewModel?.hasFpvm?.() ?? false,
    set: (scale: number, rx: number, ry: number, rz: number, px: number, py: number, pz: number) => game.viewModel?.setFpvmTransform?.(scale, rx, ry, rz, px, py, pz),
  };
  window.__ht = api;
  return api;
}
