import { describe, it, expect } from 'vitest';
import { Telemetry, type FrameSample } from '@qa/telemetry';
import { makeArenaTrack, ReplayPlayer, FLAG } from '@engine/input/replay';
import { emptySnapshot } from '@engine/input/input';
import { checkBudget, statusOf } from '@qa/budget';
import { medianRun } from '@qa/bench';

function sample(frameMs: number, extra: Partial<FrameSample> = {}): FrameSample {
  return { frameMs, cpuSimMs: 1, cpuRenderMs: 2, gpuMs: null, calls: 60, tris: 90000, actorsFull: 1, actorsTotal: 9, heapMB: 100, scale: 1, renderWidth: 1920, ...extra };
}

describe('TIP-004 Telemetry', () => {
  it('980×16 ms + 20×40 ms → p95 ≈ 16, p99 40, 1% low ≈ 25 fps, frames 1000', () => {
    const t = new Telemetry(2048);
    for (let i = 0; i < 1000; i++) t.sample(sample(i % 50 === 0 ? 40 : 16));
    const s = t.summary();
    expect(s.frames).toBe(1000);
    expect(s.frame_p95).toBeCloseTo(16, 3);
    expect(s.fps_1pct_low).toBeCloseTo(25, 3);
    expect(s.frame_p99).toBe(40);
    expect(s.fps_avg).toBeCloseTo(1000 / 16.48, 1);
    expect(s.gpu_method).toBe('unavailable');
    expect(s.gpu_ms_p95).toBeNull();
    expect(s.shader_hitches).toBe(0);
  });

  it('heap start/end/delta và hitch > 50 ms', () => {
    const t = new Telemetry(64);
    t.sample(sample(16, { heapMB: 100 }));
    t.sample(sample(70, { heapMB: 110 }));
    t.sample(sample(16, { heapMB: 130 }));
    const s = t.summary();
    expect(s.heap_start_mb).toBe(100);
    expect(s.heap_end_mb).toBe(130);
    expect(s.heap_delta_mb).toBe(30);
    expect(s.shader_hitches).toBe(1);
  });

  it('ring buffer: sau capacity, frames = capacity và giữ mẫu mới nhất', () => {
    const t = new Telemetry(16);
    for (let i = 0; i < 40; i++) t.sample(sample(i));
    expect(t.frames).toBe(16);
    expect(t.last()!.frameMs).toBe(39);
    expect(t.summary().frame_p99).toBe(39);
  });

  it('gpu p95 khi có timestamp', () => {
    const t = new Telemetry(64);
    for (let i = 0; i < 20; i++) t.sample(sample(16, { gpuMs: 8 + (i % 2) }));
    const s = t.summary();
    expect(s.gpu_method).toBe('timestamp_query');
    expect(s.gpu_ms_p95).toBe(9);
  });
});

describe('TIP-004 Replay track', () => {
  it('makeArenaTrack(7, 90) deterministic; 5400 tick; keyframe tăng dần', () => {
    const a = makeArenaTrack(7, 90);
    const b = makeArenaTrack(7, 90);
    expect(a).toEqual(b);
    expect(a.ticks).toBe(5400);
    expect(a.frames.length).toBeGreaterThan(20);
    for (let i = 1; i < a.frames.length; i++) expect(a.frames[i]!.tick).toBeGreaterThan(a.frames[i - 1]!.tick);
    expect(makeArenaTrack(8, 90)).not.toEqual(a);
  });

  it('ReplayPlayer giữ trạng thái nút giữa keyframe, edge chỉ ở tick keyframe, dx chia đều', () => {
    const track = { name: 't', seed: 1, ticks: 100, frames: [{ tick: 0, fwd: 1, right: 0, flags: FLAG.fire | FLAG.jump, dx: 60, dy: 0 }, { tick: 30, fwd: 0, right: 1, flags: FLAG.ads, dx: 0, dy: 0 }] };
    const p = new ReplayPlayer(track);
    const s = emptySnapshot();
    p.snapshot(0, s);
    expect(s.fire).toBe(true);
    expect(s.jump).toBe(true);
    expect(s.dx).toBe(2);
    p.snapshot(10, s);
    expect(s.fire).toBe(true);
    expect(s.jump).toBe(false);
    expect(s.fwd).toBe(1);
    p.snapshot(45, s);
    expect(s.fire).toBe(false);
    expect(s.ads).toBe(true);
    expect(s.right).toBe(1);
    p.snapshot(100, s);
    expect(s.ads).toBe(false);
    expect(p.finished).toBe(true);
  });
});

describe('TIP-004 Budget', () => {
  it('fps 50 với target 60 / red 40 → WARN; 35 → FAIL; 61 → PASS', () => {
    const def = { target: 60, red: 40, direction: 'higher' as const };
    expect(statusOf(50, def)).toBe('WARN');
    expect(statusOf(35, def)).toBe('FAIL');
    expect(statusOf(61, def)).toBe('PASS');
    expect(statusOf(null, def)).toBe('NA');
    const lower = { target: 18.5, red: 22, direction: 'lower' as const };
    expect(statusOf(17, lower)).toBe('PASS');
    expect(statusOf(20, lower)).toBe('WARN');
    expect(statusOf(23, lower)).toBe('FAIL');
  });

  it('checkBudget: verdict = worst status, NA bỏ qua', () => {
    const t = new Telemetry(64);
    for (let i = 0; i < 100; i++) t.sample(sample(20)); // 50 fps → WARN; p95 20 → WARN
    const { budgetCheck, verdict } = checkBudget(t.summary());
    expect(budgetCheck.fps_avg!.status).toBe('WARN');
    expect(budgetCheck.gpu_ms!.status).toBe('NA');
    expect(budgetCheck.draw_calls!.status).toBe('PASS');
    expect(verdict).toBe('WARN');
  });

  it('medianRun chọn theo frame_p95', () => {
    const mk = (p95: number) => ({ ...new Telemetry(4).summary(), frame_p95: p95 });
    expect(medianRun([mk(30), mk(10), mk(20)]).frame_p95).toBe(20);
    expect(medianRun([mk(30), mk(10)]).frame_p95).toBe(10);
  });
});
