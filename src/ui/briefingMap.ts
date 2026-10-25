/**
 * DV-093 bản đồ tác chiến cho đoạn giao nhiệm vụ của intro: giấy bản đồ địa hình (đường đồng mức dựng từ DEM thật của màn,
 * khe suối, đường xe), rồi các nét tay vẽ dần theo lời chỉ huy: vòng đỏ chỗ đoàn xe bị chặn, mũi tên đường tiến của tổ,
 * mũi tên xanh địch, toạ độ gõ dần. Vẽ một lần ra canvas nền, mỗi khung chỉ chồng nét động + lia/zoom.
 * Quy ước màu bản đồ quân sự kiểu Xô (ta đỏ, địch xanh); phe hư cấu, không phù hiệu thật.
 */
import { t } from './i18n';

type V2 = [number, number];

export interface BriefingMapInput {
  /** tâm và cạnh vùng bản đồ (m, hệ level) */
  center: V2;
  size: number;
  heightAt(x: number, z: number): number;
  streams: Array<{ pts: V2[]; water: boolean }>;
  roads: Array<{ pts: V2[] }>;
  /** đường tiến của tổ (đỏ) */
  route: V2[];
  /** hướng địch (xanh): các mũi tên [từ, tới] */
  enemy: Array<[V2, V2]>;
  /** vòng đỏ chỗ đoàn xe */
  convoy: V2;
  /** nhãn: [x, z, i18n key] */
  labels: Array<[number, number, string]>;
  /** key i18n dòng toạ độ gõ dần */
  coordKey: string;
}

export interface MapCue {
  /** giây kể từ lúc bật bản đồ */
  t: number;
  /** 'convoy' vòng đỏ · 'route' đường tiến · 'enemy' địch · 'coord' toạ độ · 'zoom' lia tới [x, z, zoom] */
  what: 'convoy' | 'route' | 'enemy' | 'coord' | 'zoom';
  at?: [number, number, number];
  dur?: number;
}

const PAPER = '#d8cfb2';
const INK = '#5b4a33';
const CONTOUR = 'rgba(122, 82, 40, 0.55)';
const CONTOUR_IDX = 'rgba(110, 70, 30, 0.85)';
const WATER = 'rgba(46, 96, 150, 0.85)';
const RED = '#b0261c';
const BLUE = '#1f4f9a';

export class BriefingMap {
  private readonly base: HTMLCanvasElement;
  private readonly px = 1536;
  private local = 0;
  private started = -1;
  private cues: MapCue[] = [];
  private view = { x: 0, z: 0, zoom: 1 };
  private viewFrom = { x: 0, z: 0, zoom: 1 };
  private viewTo = { x: 0, z: 0, zoom: 1 };
  private viewT0 = 0;
  private viewDur = 1;

  constructor(private readonly inp: BriefingMapInput) {
    this.base = document.createElement('canvas');
    this.base.width = this.px;
    this.base.height = this.px;
    this.view = { x: inp.center[0], z: inp.center[1], zoom: 1 };
    this.viewFrom = { ...this.view };
    this.viewTo = { ...this.view };
    this.drawBase();
  }

  setCues(c: MapCue[]): void {
    this.cues = [...c].sort((a, b) => a.t - b.t);
  }

  /** bắt đầu đếm thời gian bản đồ */
  start(now: number): void {
    this.started = now;
  }

  update(now: number, _dt: number): void {
    if (this.started < 0) return;
    this.local = now - this.started;
    for (const c of this.cues) {
      if (c.what === 'zoom' && c.at && this.local >= c.t && this.viewT0 < c.t) {
        this.viewFrom = { ...this.view };
        this.viewTo = { x: c.at[0], z: c.at[1], zoom: c.at[2] };
        this.viewT0 = c.t;
        this.viewDur = c.dur ?? 3;
      }
    }
    const u = Math.min(1, Math.max(0, (this.local - this.viewT0) / this.viewDur));
    const e = u * u * (3 - 2 * u);
    this.view.x = this.viewFrom.x + (this.viewTo.x - this.viewFrom.x) * e;
    this.view.z = this.viewFrom.z + (this.viewTo.z - this.viewFrom.z) * e;
    this.view.zoom = this.viewFrom.zoom + (this.viewTo.zoom - this.viewFrom.zoom) * e;
  }

  // ------------------------------------------------------------------ base (một lần)

  /** toạ độ level → pixel trên canvas nền */
  private toBase(x: number, z: number): V2 {
    const { center, size } = this.inp;
    return [((x - center[0]) / size + 0.5) * this.px, ((z - center[1]) / size + 0.5) * this.px];
  }

  private drawBase(): void {
    const ctx = this.base.getContext('2d')!;
    const P = this.px;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, P, P);
    // vân giấy: vệt loang tất định (không Math.random)
    let seed = 1971;
    const rnd = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 900; i++) {
      const x = rnd() * P;
      const y = rnd() * P;
      const r = 6 + rnd() * 60;
      ctx.fillStyle = `rgba(${rnd() < 0.5 ? '120,95,60' : '255,250,235'},${(0.015 + rnd() * 0.035).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // nền đồi bóng mờ + đường đồng mức (marching squares) từ DEM thật
    const { center, size } = this.inp;
    const N = 220;
    const step = size / N;
    const H = new Float32Array((N + 1) * (N + 1));
    let hmin = Infinity;
    let hmax = -Infinity;
    for (let j = 0; j <= N; j++)
      for (let i = 0; i <= N; i++) {
        const h = this.inp.heightAt(center[0] - size / 2 + i * step, center[1] - size / 2 + j * step);
        H[j * (N + 1) + i] = h;
        hmin = Math.min(hmin, h);
        hmax = Math.max(hmax, h);
      }
    const cell = P / N;
    // bóng đồi: ảnh N×N rồi phóng mịn (không ô vuông)
    const hs = document.createElement('canvas');
    hs.width = N;
    hs.height = N;
    const hctx = hs.getContext('2d')!;
    const img = hctx.createImageData(N, N);
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const a = H[j * (N + 1) + i]!;
        const b = H[j * (N + 1) + i + 1]!;
        const c = H[(j + 1) * (N + 1) + i]!;
        const shade = Math.max(-1, Math.min(1, (a - b + a - c) * 0.35));
        const o = (j * N + i) * 4;
        if (shade > 0) {
          img.data[o] = 255;
          img.data[o + 1] = 248;
          img.data[o + 2] = 230;
          img.data[o + 3] = Math.round(shade * 0.2 * 255);
        } else {
          img.data[o] = 90;
          img.data[o + 1] = 65;
          img.data[o + 2] = 35;
          img.data[o + 3] = Math.round(-shade * 0.18 * 255);
        }
      }
    hctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(hs, 0, 0, P, P);
    const interval = 5;
    for (let lv = Math.ceil(hmin / interval) * interval; lv <= hmax; lv += interval) {
      const idx = Math.round(lv) % 25 === 0;
      ctx.strokeStyle = idx ? CONTOUR_IDX : CONTOUR;
      ctx.lineWidth = idx ? 2.1 : 1.0;
      ctx.beginPath();
      for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
          const v0 = H[j * (N + 1) + i]!;
          const v1 = H[j * (N + 1) + i + 1]!;
          const v2 = H[(j + 1) * (N + 1) + i + 1]!;
          const v3 = H[(j + 1) * (N + 1) + i]!;
          const pts: V2[] = [];
          const edge = (va: number, vb: number, xa: number, ya: number, xb: number, yb: number): void => {
            if ((va < lv) !== (vb < lv)) {
              const k = (lv - va) / (vb - va);
              pts.push([(xa + (xb - xa) * k) * cell, (ya + (yb - ya) * k) * cell]);
            }
          };
          edge(v0, v1, i, j, i + 1, j);
          edge(v1, v2, i + 1, j, i + 1, j + 1);
          edge(v2, v3, i + 1, j + 1, i, j + 1);
          edge(v3, v0, i, j + 1, i, j);
          if (pts.length >= 2) {
            ctx.moveTo(pts[0]![0], pts[0]![1]);
            ctx.lineTo(pts[1]![0], pts[1]![1]);
            if (pts.length === 4) {
              ctx.moveTo(pts[2]![0], pts[2]![1]);
              ctx.lineTo(pts[3]![0], pts[3]![1]);
            }
          }
        }
      ctx.stroke();
    }
    // lưới toạ độ 100 m
    ctx.strokeStyle = 'rgba(60,45,30,0.28)';
    ctx.lineWidth = 1;
    const g0x = Math.ceil((center[0] - size / 2) / 100) * 100;
    const g0z = Math.ceil((center[1] - size / 2) / 100) * 100;
    ctx.font = '600 20px "Barlow Condensed", sans-serif';
    ctx.fillStyle = 'rgba(60,45,30,0.6)';
    for (let x = g0x; x < center[0] + size / 2; x += 100) {
      const [bx] = this.toBase(x, 0);
      ctx.beginPath();
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx, P);
      ctx.stroke();
      ctx.fillText(String(Math.round((x + 4000) / 10) % 100).padStart(2, '0'), bx + 4, 18);
    }
    for (let z = g0z; z < center[1] + size / 2; z += 100) {
      const [, bz] = this.toBase(0, z);
      ctx.beginPath();
      ctx.moveTo(0, bz);
      ctx.lineTo(P, bz);
      ctx.stroke();
      ctx.fillText(String(Math.round((9000 - z) / 10) % 100).padStart(2, '0'), 6, bz - 4);
    }
    // khe suối
    for (const s of this.inp.streams) {
      ctx.strokeStyle = WATER;
      ctx.lineWidth = s.water ? 3.2 : 1.4;
      ctx.setLineDash(s.water ? [] : [6, 4]);
      ctx.beginPath();
      s.pts.forEach((p, k) => {
        const [x, y] = this.toBase(p[0], p[1]);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // đường xe: nét đôi
    for (const r of this.inp.roads) {
      for (const [w, c] of [
        [5, INK],
        [2.4, PAPER],
      ] as Array<[number, string]>) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.beginPath();
        r.pts.forEach((p, k) => {
          const [x, y] = this.toBase(p[0], p[1]);
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
    }
    // nhãn
    ctx.fillStyle = INK;
    ctx.font = 'italic 600 34px "Barlow Condensed", sans-serif';
    for (const [x, z, key] of this.inp.labels) {
      const [bx, bz] = this.toBase(x, z);
      ctx.fillText(t(key), bx, bz);
    }
    // ô tên bản đồ
    ctx.fillStyle = 'rgba(40,30,20,0.85)';
    ctx.font = '600 38px "Barlow Condensed", sans-serif';
    ctx.fillText(t('cine.map.sheet'), 36, P - 56);
    ctx.font = '500 26px "Barlow Condensed", sans-serif';
    ctx.fillText(t('cine.map.scale'), 36, P - 18);
  }

  // ------------------------------------------------------------------ mỗi khung

  paint(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // giấy phủ kín khung (cover), lia/zoom theo view
    const P = this.px;
    const fit = Math.max(w, h) / P;
    const z = this.view.zoom * fit;
    const [vx, vz] = this.toBase(this.view.x, this.view.z);
    ctx.save();
    ctx.fillStyle = '#16120d';
    ctx.fillRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2);
    ctx.scale(z, z);
    ctx.translate(-vx, -vz);
    ctx.drawImage(this.base, 0, 0);
    this.paintMarks(ctx);
    ctx.restore();
    // vignette + vệt sáng đèn bàn
    const g = ctx.createRadialGradient(w * 0.45, h * 0.4, h * 0.1, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(255,230,180,0.06)');
    g.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // toạ độ gõ dần
    const cc = this.cues.find((c) => c.what === 'coord');
    if (cc && this.local >= cc.t) {
      const s = h / 1080;
      const full = t(this.inp.coordKey);
      const n = Math.floor(Math.min(1, (this.local - cc.t) / (cc.dur ?? 2.5)) * full.length);
      ctx.save();
      ctx.font = `600 ${Math.round(40 * s)}px "Barlow Condensed", sans-serif`;
      ctx.fillStyle = 'rgba(240,232,214,0.92)';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 8 * s;
      ctx.textAlign = 'right';
      ctx.fillText(full.slice(0, n), w - 110 * s, 170 * s);
      ctx.restore();
    }
  }

  private progress(what: MapCue['what']): number {
    const c = this.cues.find((x) => x.what === what);
    if (!c || this.local < c.t) return 0;
    return Math.min(1, (this.local - c.t) / (c.dur ?? 2));
  }

  private paintMarks(ctx: CanvasRenderingContext2D): void {
    // vòng đỏ chỗ đoàn xe (vẽ dần như bút sáp, rồi gạch chéo)
    const pc = this.progress('convoy');
    if (pc > 0) {
      const [cx, cz] = this.toBase(this.inp.convoy[0], this.inp.convoy[1]);
      ctx.strokeStyle = RED;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.ellipse(cx, cz, 58, 44, -0.3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2.1 * Math.min(1, pc * 1.4));
      ctx.stroke();
      if (pc > 0.75) {
        const k = (pc - 0.75) / 0.25;
        ctx.lineWidth = 3;
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(cx - 22 + i * 10, cz - 22);
          ctx.lineTo(cx - 22 + i * 10 + 44 * k, cz - 22 + 44 * k);
          ctx.stroke();
        }
      }
    }
    // đường tiến của tổ: nét đỏ đứt vẽ dần + đầu mũi tên
    const pr = this.progress('route');
    if (pr > 0) this.arrowPath(ctx, this.inp.route, pr, RED, [14, 8]);
    const pe = this.progress('enemy');
    if (pe > 0) for (const [a, b] of this.inp.enemy) this.arrowPath(ctx, [a, b], pe, BLUE, []);
  }

  private arrowPath(ctx: CanvasRenderingContext2D, pts: V2[], p: number, col: string, dash: number[]): void {
    const bp = pts.map((q) => this.toBase(q[0], q[1]));
    let total = 0;
    for (let i = 1; i < bp.length; i++) total += Math.hypot(bp[i]![0] - bp[i - 1]![0], bp[i]![1] - bp[i - 1]![1]);
    let left = total * p;
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(bp[0]![0], bp[0]![1]);
    let tip: V2 = bp[0]!;
    let dir: V2 = [1, 0];
    for (let i = 1; i < bp.length && left > 0; i++) {
      const a = bp[i - 1]!;
      const b = bp[i]!;
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const k = Math.min(1, left / L);
      tip = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
      dir = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
      ctx.lineTo(tip[0], tip[1]);
      left -= L;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    const s = 22;
    ctx.beginPath();
    ctx.moveTo(tip[0] + dir[0] * s, tip[1] + dir[1] * s);
    ctx.lineTo(tip[0] - dir[1] * s * 0.6, tip[1] + dir[0] * s * 0.6);
    ctx.lineTo(tip[0] + dir[1] * s * 0.6, tip[1] - dir[0] * s * 0.6);
    ctx.closePath();
    ctx.fill();
  }
}
