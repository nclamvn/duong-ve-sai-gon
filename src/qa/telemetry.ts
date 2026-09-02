/**
 * Telemetry (PRD §4 Đo lường, §4.1 phương pháp): ring buffer typed-array, p95/p99, 1% low, heap trend.
 * Không allocation trong sample(). Số liệu chỉ có nghĩa trên thiết bị chuẩn (evidence_status).
 */
export interface FrameSample {
  frameMs: number;
  cpuSimMs: number;
  cpuRenderMs: number;
  gpuMs: number | null;
  calls: number;
  tris: number;
  actorsFull: number;
  actorsTotal: number;
  heapMB: number | null;
  scale: number;
  renderWidth: number;
}

export interface TelemetrySummary {
  frames: number;
  duration_s: number;
  fps_avg: number;
  fps_1pct_low: number;
  frame_p95: number;
  frame_p99: number;
  cpu_sim_p95: number;
  cpu_render_p95: number;
  draw_calls_avg: number;
  triangles_avg: number;
  heap_start_mb: number | null;
  heap_end_mb: number | null;
  heap_delta_mb: number | null;
  scale_avg: number;
  render_width_avg: number;
  actors_full_avg: number;
  actors_total_avg: number;
  gpu_ms_p95: number | null;
  gpu_method: 'timestamp_query' | 'unavailable';
  shader_hitches: number;
}

function percentile(sorted: Float32Array, n: number, p: number): number {
  if (n === 0) return 0;
  const idx = Math.min(n - 1, Math.max(0, Math.ceil(p * n) - 1));
  return sorted[idx]!;
}

export class Telemetry {
  readonly capacity: number;
  private readonly frameMs: Float32Array;
  private readonly cpuSim: Float32Array;
  private readonly cpuRender: Float32Array;
  private readonly gpu: Float32Array;
  private readonly calls: Float32Array;
  private readonly tris: Float32Array;
  private readonly actorsFull: Float32Array;
  private readonly actorsTotal: Float32Array;
  private readonly heap: Float32Array;
  private readonly scale: Float32Array;
  private readonly width: Float32Array;
  private readonly sortScratch: Float32Array;
  private head = 0;
  private count = 0;
  private totalMs = 0;
  private gpuSamples = 0;
  private hitches = 0;
  /** ngưỡng hitch ms (PRD REN-003: > 50 ms) */
  hitchMs = 50;
  recording = true;

  constructor(capacity = 8192) {
    this.capacity = capacity;
    this.frameMs = new Float32Array(capacity);
    this.cpuSim = new Float32Array(capacity);
    this.cpuRender = new Float32Array(capacity);
    this.gpu = new Float32Array(capacity);
    this.calls = new Float32Array(capacity);
    this.tris = new Float32Array(capacity);
    this.actorsFull = new Float32Array(capacity);
    this.actorsTotal = new Float32Array(capacity);
    this.heap = new Float32Array(capacity);
    this.scale = new Float32Array(capacity);
    this.width = new Float32Array(capacity);
    this.sortScratch = new Float32Array(capacity);
  }

  sample(s: FrameSample): void {
    if (!this.recording) return;
    const i = this.head;
    this.frameMs[i] = s.frameMs;
    this.cpuSim[i] = s.cpuSimMs;
    this.cpuRender[i] = s.cpuRenderMs;
    this.gpu[i] = s.gpuMs ?? -1;
    if (s.gpuMs !== null) this.gpuSamples++;
    this.calls[i] = s.calls;
    this.tris[i] = s.tris;
    this.actorsFull[i] = s.actorsFull;
    this.actorsTotal[i] = s.actorsTotal;
    this.heap[i] = s.heapMB ?? -1;
    this.scale[i] = s.scale;
    this.width[i] = s.renderWidth;
    this.head = (i + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
    this.totalMs += s.frameMs;
    if (s.frameMs > this.hitchMs) this.hitches++;
  }

  reset(): void {
    this.head = 0;
    this.count = 0;
    this.totalMs = 0;
    this.gpuSamples = 0;
    this.hitches = 0;
  }

  get frames(): number {
    return this.count;
  }

  /** Giá trị mới nhất (overlay). */
  last(): FrameSample | null {
    if (this.count === 0) return null;
    const i = (this.head - 1 + this.capacity) % this.capacity;
    return {
      frameMs: this.frameMs[i]!,
      cpuSimMs: this.cpuSim[i]!,
      cpuRenderMs: this.cpuRender[i]!,
      gpuMs: this.gpu[i]! >= 0 ? this.gpu[i]! : null,
      calls: this.calls[i]!,
      tris: this.tris[i]!,
      actorsFull: this.actorsFull[i]!,
      actorsTotal: this.actorsTotal[i]!,
      heapMB: this.heap[i]! >= 0 ? this.heap[i]! : null,
      scale: this.scale[i]!,
      renderWidth: this.width[i]!,
    };
  }

  private ordered(src: Float32Array): Float32Array {
    // copy theo thứ tự thời gian rồi sort — chỉ gọi khi summary() (có allocation trong sort của engine, chấp nhận)
    const n = this.count;
    const start = (this.head - n + this.capacity) % this.capacity;
    for (let k = 0; k < n; k++) this.sortScratch[k] = src[(start + k) % this.capacity]!;
    const view = this.sortScratch.subarray(0, n);
    view.sort();
    return view;
  }

  private avg(src: Float32Array, skipNegative = false): number {
    const n = this.count;
    if (n === 0) return 0;
    const start = (this.head - n + this.capacity) % this.capacity;
    let sum = 0;
    let m = 0;
    for (let k = 0; k < n; k++) {
      const v = src[(start + k) % this.capacity]!;
      if (skipNegative && v < 0) continue;
      sum += v;
      m++;
    }
    return m === 0 ? 0 : sum / m;
  }

  private at(src: Float32Array, k: number): number {
    const start = (this.head - this.count + this.capacity) % this.capacity;
    return src[(start + k) % this.capacity]!;
  }

  summary(): TelemetrySummary {
    const n = this.count;
    const sortedFrame = this.ordered(this.frameMs);
    const p95 = percentile(sortedFrame, n, 0.95);
    const p99 = percentile(sortedFrame, n, 0.99);
    // 1% low: trung bình 1% frame chậm nhất → FPS
    const onePct = Math.max(1, Math.floor(n * 0.01));
    let slowSum = 0;
    for (let k = n - onePct; k < n; k++) slowSum += sortedFrame[k]!;
    const slowAvg = n === 0 ? 0 : slowSum / onePct;
    const cpuSimP95 = percentile(this.ordered(this.cpuSim), n, 0.95);
    const cpuRenderP95 = percentile(this.ordered(this.cpuRender), n, 0.95);
    let gpuP95: number | null = null;
    if (this.gpuSamples > 0) {
      // lọc -1 (không có mẫu) trước khi percentile
      const start = (this.head - n + this.capacity) % this.capacity;
      let m = 0;
      for (let k = 0; k < n; k++) {
        const v = this.gpu[(start + k) % this.capacity]!;
        if (v >= 0) this.sortScratch[m++] = v;
      }
      const view = this.sortScratch.subarray(0, m);
      view.sort();
      gpuP95 = m > 0 ? percentile(view, m, 0.95) : null;
    }
    const heapStart = n > 0 && this.at(this.heap, 0) >= 0 ? this.at(this.heap, 0) : null;
    const heapEnd = n > 0 && this.at(this.heap, n - 1) >= 0 ? this.at(this.heap, n - 1) : null;
    const avgMs = n === 0 ? 0 : this.totalMs / n;
    return {
      frames: n,
      duration_s: this.totalMs / 1000,
      fps_avg: avgMs > 0 ? 1000 / avgMs : 0,
      fps_1pct_low: slowAvg > 0 ? 1000 / slowAvg : 0,
      frame_p95: p95,
      frame_p99: p99,
      cpu_sim_p95: cpuSimP95,
      cpu_render_p95: cpuRenderP95,
      draw_calls_avg: this.avg(this.calls),
      triangles_avg: this.avg(this.tris),
      heap_start_mb: heapStart,
      heap_end_mb: heapEnd,
      heap_delta_mb: heapStart !== null && heapEnd !== null ? heapEnd - heapStart : null,
      scale_avg: this.avg(this.scale),
      render_width_avg: this.avg(this.width),
      actors_full_avg: this.avg(this.actorsFull),
      actors_total_avg: this.avg(this.actorsTotal),
      gpu_ms_p95: gpuP95,
      gpu_method: this.gpuSamples > 0 ? 'timestamp_query' : 'unavailable',
      shader_hitches: this.hitches,
    };
  }
}
