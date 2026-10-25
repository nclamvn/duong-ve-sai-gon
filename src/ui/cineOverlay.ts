/**
 * DV-093 lớp phủ điện ảnh (intro): màn đen, viền phim (letterbox), tựa chữ gõ dần, phụ đề, bản đồ tác chiến.
 * Vẽ thuần bằng Canvas 2D theo trạng thái → cùng một hàm `paint(ctx, w, h)` cho màn hình và cho bộ ghi hình offline
 * (ghép lên khung WebGPU ở 4K). Mọi chữ lấy qua i18n (không literal tiếng Việt trong code).
 */
import { t } from './i18n';
import type { BriefingMap } from './briefingMap';

export interface CineTitle {
  key: string;
  /** 'place' = chữ nhỏ góc dưới trái (địa danh, ngày giờ) · 'main' = tựa lớn giữa màn */
  style: 'place' | 'main' | 'sub';
  /** thời điểm bắt đầu và thời lượng (s, đồng hồ intro) */
  t0: number;
  dur: number;
  /** giây gõ hết chữ (0 = hiện ngay) */
  typeS: number;
}

export interface CineSubtitle {
  speakerKey: string | null;
  key: string;
  t0: number;
  dur: number;
}

export class CineOverlay {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  /** độ đen toàn màn 0..1 */
  black = 0;
  private blackFrom = 0;
  private blackTo = 0;
  private blackT0 = 0;
  private blackDur = 0;
  /** viền phim: tỉ lệ khung hình mục tiêu (0 = tắt) */
  letterbox = 2.0;
  private titles: CineTitle[] = [];
  private subs: CineSubtitle[] = [];
  map: BriefingMap | null = null;
  mapOn = false;
  private mapAlpha = 0;
  private now = 0;

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'cine-overlay';
    Object.assign(this.canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '20' });
    parent.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
  }

  fadeBlack(to: number, dur: number): void {
    this.blackFrom = this.black;
    this.blackTo = to;
    this.blackT0 = this.now;
    this.blackDur = Math.max(1e-3, dur);
  }

  title(tt: CineTitle): void {
    this.titles.push(tt);
  }

  subtitle(s: CineSubtitle): void {
    this.subs = this.subs.filter((x) => x.t0 + x.dur < s.t0);
    this.subs.push(s);
  }

  /** advance overlay state to intro time `now` (s) */
  update(now: number, dt: number): void {
    this.now = now;
    const u = Math.min(1, Math.max(0, (now - this.blackT0) / this.blackDur));
    this.black = this.blackFrom + (this.blackTo - this.blackFrom) * u * u * (3 - 2 * u);
    this.mapAlpha += ((this.mapOn ? 1 : 0) - this.mapAlpha) * Math.min(1, dt * 3.5);
    this.map?.update(now, dt);
  }

  /** draw onto the on-screen overlay canvas */
  present(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(window.innerWidth * dpr);
    const h = Math.round(window.innerHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.ctx.clearRect(0, 0, w, h);
    this.paint(this.ctx, w, h);
  }

  /** resolution-independent paint (screen and offline recorder share it) */
  paint(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const s = h / 1080;
    if (this.mapAlpha > 0.01 && this.map) {
      ctx.save();
      ctx.globalAlpha = this.mapAlpha;
      this.map.paint(ctx, w, h);
      ctx.restore();
    }
    // viền phim
    if (this.letterbox > 0) {
      const want = w / this.letterbox;
      const bar = Math.max(0, (h - want) / 2);
      if (bar > 0) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, bar);
        ctx.fillRect(0, h - bar, w, bar);
      }
    }
    if (this.black > 0.002) {
      ctx.fillStyle = `rgba(0,0,0,${this.black.toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    }
    for (const tt of this.titles) this.paintTitle(ctx, tt, w, h, s);
    for (const sb of this.subs) this.paintSub(ctx, sb, w, h, s);
  }

  private fadeOf(t0: number, dur: number, fin = 0.5, fout = 0.7): number {
    const a = this.now - t0;
    if (a < 0 || a > dur) return 0;
    return Math.min(1, a / fin, (dur - a) / fout);
  }

  private paintTitle(ctx: CanvasRenderingContext2D, tt: CineTitle, w: number, h: number, s: number): void {
    const al = this.fadeOf(tt.t0, tt.dur, tt.style === 'main' ? 0.08 : 0.3, tt.style === 'main' ? 1.2 : 0.8);
    if (al <= 0) return;
    const full = t(tt.key);
    const n = tt.typeS > 0 ? Math.floor(Math.min(1, (this.now - tt.t0) / tt.typeS) * full.length) : full.length;
    const text = full.slice(0, n);
    ctx.save();
    ctx.globalAlpha = al;
    ctx.textBaseline = 'alphabetic';
    if (tt.style === 'main') {
      ctx.font = `600 ${Math.round(96 * s)}px "Barlow Condensed", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#efe6d2';
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 24 * s;
      this.spaced(ctx, text, w / 2, h / 2 + 30 * s, 0.32 * 96 * s, 'center');
      // vạch mảnh dưới tựa
      ctx.globalAlpha = al * 0.7;
      ctx.fillStyle = '#c8783a';
      const lw = Math.min(1, (this.now - tt.t0) / 0.9) * 360 * s;
      ctx.fillRect(w / 2 - lw / 2, h / 2 + 62 * s, lw, 2 * s);
    } else if (tt.style === 'sub') {
      ctx.font = `500 ${Math.round(30 * s)}px "Barlow Condensed", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(239,230,210,0.82)';
      this.spaced(ctx, text, w / 2, h / 2 + 118 * s, 0.4 * 30 * s, 'center');
    } else {
      // địa danh: góc dưới trái, kiểu máy chữ
      const x = 120 * s;
      const y = h - 190 * s;
      ctx.font = `600 ${Math.round(40 * s)}px "Barlow Condensed", sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#efe6d2';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 10 * s;
      const lines = text.split('\n');
      lines.forEach((ln, i) => {
        if (i > 0) ctx.font = `500 ${Math.round(28 * s)}px "Barlow Condensed", sans-serif`;
        this.spaced(ctx, ln, x, y + i * 44 * s, 0.22 * 28 * s, 'left');
      });
      if (n < full.length && Math.floor(this.now * 3) % 2 === 0) {
        const last = lines[lines.length - 1] ?? '';
        const lx = x + ctx.measureText(last).width + last.length * 0.22 * 28 * s + 6 * s;
        ctx.fillRect(lx, y + (lines.length - 1) * 44 * s - 26 * s, 14 * s, 30 * s);
      }
    }
    ctx.restore();
  }

  private paintSub(ctx: CanvasRenderingContext2D, sb: CineSubtitle, w: number, h: number, s: number): void {
    const al = this.fadeOf(sb.t0, sb.dur, 0.15, 0.3);
    if (al <= 0) return;
    ctx.save();
    ctx.globalAlpha = al;
    const y = h - (this.letterbox > 0 ? Math.max(0, (h - w / this.letterbox) / 2) : 0) - 46 * s;
    const who = sb.speakerKey ? `${t(sb.speakerKey).toUpperCase()}  ` : '';
    const line = t(sb.key);
    ctx.font = `600 ${Math.round(30 * s)}px "Be Vietnam Pro", sans-serif`;
    const ww = ctx.measureText(who).width;
    ctx.font = `400 ${Math.round(30 * s)}px "Be Vietnam Pro", sans-serif`;
    const lw = ctx.measureText(line).width;
    const x0 = w / 2 - (ww + lw) / 2;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur = 8 * s;
    ctx.font = `600 ${Math.round(30 * s)}px "Be Vietnam Pro", sans-serif`;
    ctx.fillStyle = '#e0aa5c';
    ctx.fillText(who, x0, y);
    ctx.font = `400 ${Math.round(30 * s)}px "Be Vietnam Pro", sans-serif`;
    ctx.fillStyle = '#f2ece0';
    ctx.fillText(line, x0 + ww, y);
    ctx.restore();
  }

  /** text with letter spacing (canvas letterSpacing is not everywhere) */
  private spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, sp: number, align: 'left' | 'center'): void {
    const chars = [...text];
    let width = 0;
    for (const c of chars) width += ctx.measureText(c).width + sp;
    width -= sp;
    let cx = align === 'center' ? x - width / 2 : x;
    const prevAlign = ctx.textAlign;
    ctx.textAlign = 'left';
    for (const c of chars) {
      ctx.fillText(c, cx, y);
      cx += ctx.measureText(c).width + sp;
    }
    ctx.textAlign = prevAlign;
  }

  dispose(): void {
    this.canvas.remove();
  }
}
