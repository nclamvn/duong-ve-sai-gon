/**
 * Subtitles (PRD A11Y-001, SQD-002 priority/interrupt): hàng phụ đề [SPEAKER] text, priority + interruptPolicy,
 * kích thước/độ mờ nền theo Settings. Mọi chuỗi qua i18n.
 */
import { t } from './i18n';

export interface CueRequest {
  cue: string;
  speaker: string;
  subtitleKey: string;
  durationMs: number;
  priority: number;
  interruptPolicy: string;
}

export class Subtitles {
  private el: HTMLElement;
  private current: CueRequest | null = null;
  private remainingMs = 0;
  private queue: CueRequest[] = [];
  /** log hiển thị (test) */
  readonly shown: string[] = [];
  dropped = 0;
  interrupted = 0;

  constructor() {
    this.el = document.getElementById('subtitles')!;
  }

  applySettings(scale: number, bg: number): void {
    this.el.style.fontSize = `calc(clamp(14px, 1.4vw, 22px) * ${scale})`;
    this.el.style.setProperty('--sub-bg', String(bg));
  }

  show(req: CueRequest): void {
    if (this.current) {
      if (req.priority > this.current.priority && req.interruptPolicy === 'interrupt') {
        this.interrupted++;
        this.queue.unshift(this.current); // cue bị cắt quay lại hàng chờ (thoại quan trọng không mất)
        this.display(req);
        return;
      }
      if (req.interruptPolicy === 'drop' && req.priority < this.current.priority) {
        this.dropped++;
        return;
      }
      this.queue.push(req);
      this.queue.sort((a, b) => b.priority - a.priority);
      return;
    }
    this.display(req);
  }

  private display(req: CueRequest): void {
    this.current = req;
    this.remainingMs = req.durationMs;
    this.shown.push(req.cue);
    this.el.hidden = false;
    this.el.innerHTML = `<span class="speaker">${t(`speaker.${req.speaker}`)}</span><span data-testid="subtitle-text" data-cue="${req.cue}">${t(req.subtitleKey)}</span>`;
  }

  /** dt giây — gọi mỗi frame (render) */
  update(dt: number): void {
    if (!this.current) return;
    this.remainingMs -= dt * 1000;
    if (this.remainingMs <= 0) {
      this.current = null;
      const next = this.queue.shift();
      if (next) this.display(next);
      else {
        this.el.hidden = true;
        this.el.innerHTML = '';
      }
    }
  }

  get activeCue(): string | null {
    return this.current?.cue ?? null;
  }

  reset(): void {
    this.current = null;
    this.queue.length = 0;
    this.shown.length = 0;
    this.el.hidden = true;
    this.el.innerHTML = '';
  }
}
