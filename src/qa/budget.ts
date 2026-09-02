/** Đối chiếu summary với config/performance-budget.json → status từng metric + verdict. Thuần TS, test được. */
import budgetJson from '@config/performance-budget.json';
import type { TelemetrySummary } from './telemetry';

export type BudgetStatus = 'PASS' | 'WARN' | 'FAIL' | 'NA';
export interface BudgetLine {
  value: number | null;
  target: number | null;
  red: number | null;
  status: BudgetStatus;
}
export type BudgetCheck = Record<string, BudgetLine>;
export type Verdict = 'PASS' | 'WARN' | 'FAIL';

interface MetricDef {
  target: number | null;
  red: number | null;
  direction: 'higher' | 'lower';
}

export const BUDGET = budgetJson as unknown as { metrics: Record<string, MetricDef>; evidence_status: string };

/** metric budget → field summary */
const MAP: Record<string, keyof TelemetrySummary | null> = {
  fps_avg: 'fps_avg',
  fps_1pct_low: 'fps_1pct_low',
  frame_p95: 'frame_p95',
  render_resolution: 'render_width_avg',
  gpu_ms: 'gpu_ms_p95',
  cpu_sim_ms: 'cpu_sim_p95',
  draw_calls: 'draw_calls_avg',
  triangles: 'triangles_avg',
  skinned_actors: 'actors_total_avg',
  ai_full: 'actors_full_avg',
  gpu_memory_gb: null,
  js_heap_mb: 'heap_end_mb',
  initial_payload_mb: null,
  level_total_mb: null,
  audio_voices: null,
};

export function statusOf(value: number | null, def: MetricDef): BudgetStatus {
  if (value === null || Number.isNaN(value)) return 'NA';
  const { target, red, direction } = def;
  if (direction === 'higher') {
    if (target !== null && value >= target) return 'PASS';
    if (red !== null && value < red) return 'FAIL';
    return 'WARN';
  }
  if (target !== null && value <= target) return 'PASS';
  if (red !== null && value > red) return 'FAIL';
  return 'WARN';
}

export function checkBudget(summary: TelemetrySummary, metrics = BUDGET.metrics): { budgetCheck: BudgetCheck; verdict: Verdict } {
  const budgetCheck: BudgetCheck = {};
  let verdict: Verdict = 'PASS';
  for (const [name, def] of Object.entries(metrics)) {
    const field = MAP[name];
    const value = field ? (summary[field] as number | null) : null;
    const status = statusOf(value, def);
    budgetCheck[name] = { value: value === null ? null : +value.toFixed(3), target: def.target, red: def.red, status };
    if (status === 'FAIL') verdict = 'FAIL';
    else if (status === 'WARN' && verdict === 'PASS') verdict = 'WARN';
  }
  return { budgetCheck, verdict };
}
