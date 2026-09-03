/**
 * Telemetry overlay (PRD §15 12–20h): DOM <pre>, cập nhật 4 Hz, màu theo budget. F3 toggle.
 * Không nằm trong scene 3D. PROD chỉ hiện khi ?overlay=1.
 */
import { t } from './i18n';
import type { Telemetry } from '@qa/telemetry';
import { BUDGET, statusOf } from '@qa/budget';

export class Overlay {
  private el: HTMLElement;
  private lastUpdate = 0;
  updates = 0;
  visible = false;
  private extra: () => string = () => '';
  intervalMs = 250;

  constructor(
    private readonly telemetry: Telemetry,
    private readonly info: () => { backend: string; buildHash: string; tick: number; scale: number; clampCount: number },
  ) {
    this.el = document.getElementById('overlay')!;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F3') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  setExtra(fn: () => string): void {
    this.extra = fn;
  }

  toggle(force?: boolean): void {
    this.visible = force ?? !this.visible;
    this.el.hidden = !this.visible;
  }

  private cls(name: string, value: number | null): string {
    const def = BUDGET.metrics[name];
    if (!def) return '';
    const s = statusOf(value, def);
    return s === 'PASS' ? 'ok' : s === 'WARN' ? 'warn' : s === 'FAIL' ? 'bad' : '';
  }

  private line(label: string, metric: string, value: number | null, fmt: (v: number) => string): string {
    const v = value === null ? '—' : fmt(value);
    return `<span class="${this.cls(metric, value)}">${label.padEnd(9)} ${v}</span>`;
  }

  update(now: number): void {
    if (!this.visible || now - this.lastUpdate < this.intervalMs) return;
    this.lastUpdate = now;
    this.updates++;
    const s = this.telemetry.last();
    const sum = this.telemetry.frames >= 30 ? this.telemetry.summary() : null;
    const i = this.info();
    const f1 = (v: number): string => v.toFixed(1);
    const f0 = (v: number): string => v.toFixed(0);
    const lines = [
      `${t('ov.title')} · ${i.backend} · ${i.buildHash} · tick ${i.tick}`,
      this.line('fps', 'fps_avg', sum ? sum.fps_avg : null, f1) + `  1%low ${sum ? f1(sum.fps_1pct_low) : '—'}`,
      this.line('frame p95', 'frame_p95', sum ? sum.frame_p95 : null, (v) => `${f1(v)} ms`) + `  last ${s ? f1(s.frameMs) : '—'}`,
      this.line('cpu sim', 'cpu_sim_ms', sum ? sum.cpu_sim_p95 : null, (v) => `${f1(v)} ms`) + `  render ${sum ? f1(sum.cpu_render_p95) : '—'} ms`,
      this.line('gpu', 'gpu_ms', sum ? sum.gpu_ms_p95 : null, (v) => `${f1(v)} ms`) + (sum?.gpu_method === 'unavailable' ? ' (n/a)' : '') + (sum && sum.gpu_overlap_frames > 0 ? `  overlap ${sum.gpu_overlap_frames}` : ''),
      this.line('draws', 'draw_calls', s ? s.calls : null, f0) + `  tris ${s ? (s.tris / 1000).toFixed(0) : '—'}k`,
      this.line('actors', 'ai_full', s ? s.actorsFull : null, f0) + ` full / ${s ? f0(s.actorsTotal) : '—'} total`,
      this.line('heap', 'js_heap_mb', s ? s.heapMB : null, (v) => `${f0(v)} MB`) + `  Δ ${sum?.heap_delta_mb !== null && sum ? f1(sum.heap_delta_mb) : '—'}`,
      `scale     ${i.scale.toFixed(2)}  w ${s ? f0(s.renderWidth) : '—'}px  hitch ${sum ? sum.shader_hitches : 0}  clamp ${i.clampCount}`,
      this.extra(),
    ];
    this.el.innerHTML = lines.filter(Boolean).join('\n');
  }
}
