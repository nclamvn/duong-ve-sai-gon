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
  /** 'radio' → icon sóng trước tên (TIP-UX02) */
  bus?: string;
  /** biến chèn vào phụ đề (báo hướng địch AI-T1.5: {h} giờ, {d} mét) */
  vars?: Record<string, string | number>;
  /** câu hô giữa trận (DV-076): chờ quá BARK_STALE_MS thì bỏ (hô "Nạp đạn!" muộn 10 s là sai) */
  bark?: boolean;
}

const BARK_STALE_MS = 2500;

export class Subtitles {
  private el: HTMLElement;
  private current: CueRequest | null = null;
  private remainingMs = 0;
  private queue: Array<CueRequest & { queuedAt?: number }> = [];
  private clockMs = 0;
  /** log hiển thị (test) */
  readonly shown: string[] = [];
  dropped = 0;
  interrupted = 0;
  /** DV-076: phát giọng khi câu thật sự lên màn hình; trả thời lượng giọng (ms) để phụ đề không tắt trước lời */
  onDisplay: ((req: CueRequest) => number) | null = null;
  /** câu đang nói bị cắt (ưu tiên cao hơn chen ngang, reset) → dừng giọng */
  onCut: (() => void) | null = null;

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
        this.onCut?.();
        this.display(req);
        return;
      }
      if (req.interruptPolicy === 'drop' && req.priority < this.current.priority) {
        this.dropped++;
        return;
      }
      // DV-076: hàng chờ giữ thứ tự kịch bản (giọng thật dài hơn ước lượng → trước đây câu ưu tiên cao nhảy lên trước câu dẫn
      // chuyện, lời ra lộn thứ tự); chỉ câu 'interrupt' được lên đầu hàng
      const q = { ...req, queuedAt: this.clockMs };
      if (req.interruptPolicy === 'interrupt') this.queue.unshift(q);
      else this.queue.push(q);
      return;
    }
    this.display(req);
  }

  private display(req: CueRequest): void {
    this.current = req;
    const voiceMs = this.onDisplay?.(req) ?? 0;
    this.remainingMs = Math.max(req.durationMs, voiceMs > 0 ? voiceMs + 350 : 0);
    this.shown.push(req.cue);
    this.el.hidden = false;
    const radio = req.bus === 'radio' ? '<i class="radio" aria-hidden="true"></i>' : '';
    this.el.innerHTML = `${radio}<span class="speaker">${t(`speaker.${req.speaker}`)}</span><span data-testid="subtitle-text" data-cue="${req.cue}">${t(req.subtitleKey, req.vars)}</span>`;
  }

  /** dt giây — gọi mỗi frame (render) */
  update(dt: number): void {
    this.clockMs += dt * 1000;
    if (!this.current) return;
    this.remainingMs -= dt * 1000;
    if (this.remainingMs <= 0) {
      this.current = null;
      let next = this.queue.shift();
      while (next?.bark && this.clockMs - (next.queuedAt ?? this.clockMs) > BARK_STALE_MS) {
        this.dropped++;
        next = this.queue.shift();
      }
      if (next) this.display(next);
      else {
        this.el.hidden = true;
        this.el.innerHTML = '';
      }
    }
  }

  /** câu đang hiện (nói lại khi âm thanh vừa được mở, DV-076) */
  get activeRequest(): CueRequest | null {
    return this.current;
  }

  get activeCue(): string | null {
    return this.current?.cue ?? null;
  }

  reset(): void {
    if (this.current) this.onCut?.();
    this.current = null;
    this.queue.length = 0;
    this.shown.length = 0;
    this.el.hidden = true;
    this.el.innerHTML = '';
  }
}
