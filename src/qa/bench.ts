/**
 * Bench harness (PRD §4.1: replay 90 s × 3, median; §8 PerformanceReplay; §15 64–72h).
 * ?bench=1&runs=3&seconds=90&seed=7 → reset → warm-up → ghi → summary; median theo frame_p95;
 * POST /__bench (scripts/bench-plugin.ts) → evidence/G0/. 404 → tải file.
 */
import type { Game } from '@game/game';
import { makeArenaTrack, ReplayPlayer } from '@engine/input/replay';
import { checkBudget, type BudgetCheck, type Verdict } from './budget';
import type { TelemetrySummary } from './telemetry';
import { t } from '@ui/i18n';

export type EvidenceStatus = 'measured_on_reference_device' | 'measured_on_non_reference_device' | 'sandbox_swiftshader_lifecycle_only';

export interface BenchReport {
  schemaVersion: 1;
  seed: number;
  inputTrack: string;
  buildHash: string;
  evidence_status: EvidenceStatus;
  device: {
    userAgent: string;
    dpr: number;
    hardwareConcurrency: number;
    viewport: [number, number];
    adapter: Record<string, string> | null;
    platform: string;
  };
  browser: string;
  backend: 'webgpu' | 'webgl2';
  timestamp: string;
  config: Record<string, unknown>;
  runs: TelemetrySummary[];
  median: TelemetrySummary;
  budgetCheck: BudgetCheck;
  verdict: Verdict;
  notes: string[];
}

export interface BenchOptions {
  runs: number;
  seconds: number;
  seed: number;
  warmupSeconds?: number;
  buildHash: string;
}

function browserName(ua: string): string {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return 'Safari';
  if (/Firefox\//.test(ua)) return 'Firefox';
  return 'Unknown';
}

export function classifyEvidence(ua: string, adapter: Record<string, string> | null, backend: string): EvidenceStatus {
  const desc = `${adapter?.description ?? ''} ${adapter?.vendor ?? ''} ${adapter?.architecture ?? ''}`.toLowerCase();
  if (/swiftshader|llvmpipe|software/.test(desc) || /HeadlessChrome/.test(ua)) return 'sandbox_swiftshader_lifecycle_only';
  if (/Macintosh/.test(ua) && (/apple/.test(desc) || backend === 'webgl2')) return 'measured_on_reference_device';
  return 'measured_on_non_reference_device';
}

export function medianRun(runs: TelemetrySummary[]): TelemetrySummary {
  const sorted = [...runs].sort((a, b) => a.frame_p95 - b.frame_p95);
  return sorted[Math.floor((sorted.length - 1) / 2)]!;
}

function waitFrames(game: Game, seconds: number): Promise<void> {
  const t0 = performance.now();
  return new Promise((resolve) => {
    const check = (): void => {
      if (!game.running || performance.now() - t0 >= seconds * 1000) resolve();
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}

export async function runBench(game: Game, opts: BenchOptions, onStatus?: (msg: string) => void): Promise<BenchReport> {
  const runs: TelemetrySummary[] = [];
  const track = makeArenaTrack(opts.seed, opts.seconds);
  const warmup = opts.warmupSeconds ?? 2;
  const notes: string[] = [];
  for (let r = 0; r < opts.runs; r++) {
    onStatus?.(`${t('bench.running')} ${r + 1}/${opts.runs}`);
    const player = new ReplayPlayer(track);
    game.reset(opts.seed);
    game.input = player;
    game.telemetry.recording = false;
    await waitFrames(game, warmup);
    game.telemetry.reset();
    game.telemetry.recording = true;
    await waitFrames(game, opts.seconds);
    game.telemetry.recording = false;
    runs.push(game.telemetry.summary());
    game.input = game.defaultInput;
  }
  const median = medianRun(runs);
  const { budgetCheck, verdict } = checkBudget(median);
  const ua = navigator.userAgent;
  const adapter = game.bundle.adapterInfo ? { ...game.bundle.adapterInfo } : null;
  const evidence_status = classifyEvidence(ua, adapter, game.bundle.backend);
  if (evidence_status === 'sandbox_swiftshader_lifecycle_only') notes.push('sandbox/SwiftShader measurement: lifecycle check only, not valid for the G0 verdict.');
  if (median.gpu_method === 'unavailable') notes.push('GPU timestamp query unavailable: gpu_ms = NA, use the browser profiler.');
  if (median.gpu_overlap_frames > 0) notes.push(`GPU timestamp: ${median.gpu_overlap_frames} frames dropped where the per-pass sum exceeded frame time (overlapping passes on TBDR GPUs) — gpu_ms_p95 is from the remaining frames; frame_p95 bounds the true GPU cost.`);
  if (game.bundle.backend === 'webgpu') notes.push('WebGPU backend: draw_calls counts BatchedMesh sub-draws (1 drawIndexed per instance, same pipeline).');
  const report: BenchReport = {
    schemaVersion: 1,
    seed: opts.seed,
    inputTrack: track.name,
    buildHash: opts.buildHash,
    evidence_status,
    device: {
      userAgent: ua,
      dpr: window.devicePixelRatio,
      hardwareConcurrency: navigator.hardwareConcurrency ?? 0,
      viewport: [window.innerWidth, window.innerHeight],
      adapter,
      platform: navigator.platform,
    },
    browser: browserName(ua),
    backend: game.bundle.backend,
    timestamp: new Date().toISOString(),
    config: { runs: opts.runs, seconds: opts.seconds, warmup, quality: game.quality.tier, rain: game.quality.rainCount, shadow: game.quality.shadowMapSize, dynamicResolution: game.quality.dynamicResolution },
    runs,
    median,
    budgetCheck,
    verdict,
    notes,
  };
  return report;
}

export async function submitReport(report: BenchReport): Promise<{ saved: string | null; downloaded: boolean }> {
  try {
    const res = await fetch('/__bench', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(report) });
    if (res.ok) {
      const j = (await res.json()) as { saved: string };
      return { saved: j.saved, downloaded: false };
    }
  } catch {
    /* fallthrough */
  }
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `performance-report-${report.timestamp.replace(/[:.]/g, '-')}.json`;
  a.click();
  return { saved: null, downloaded: true };
}
