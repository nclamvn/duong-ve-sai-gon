/**
 * DV-088 bùn đất bắn lên ống kính (vụ nổ sát người, như máy quay chiến trường): lớp canvas 2D nằm trên ảnh game, dưới HUD.
 * Mỗi lần văng: vài đốm bùn to có mép lởm chởm (dồn ra mép khung, giữa khung vẫn nhìn được), giọt nhỏ quanh, vệt chảy xuống,
 * bụi lấm tấm. Giữ ~1,5 s rồi mờ dần; văng tiếp khi chưa tan thì vẽ chồng lên. Ngẫu nhiên tất định (mulberry32).
 */
import { mulberry32, type Prng } from '@engine/core/prng';

/** giữ nguyên (s) trước khi mờ */
const HOLD_S = 1.6;
/** thời gian mờ hết (s) */
const FADE_S = 3.4;

export class LensDirt {
  readonly canvas: HTMLCanvasElement | null = null;
  private readonly g: CanvasRenderingContext2D | null = null;
  private readonly rng: Prng = mulberry32(0x1e5d1a7);
  private age = Infinity;
  private strength = 0;
  /** số lần văng (E2E) */
  splats = 0;

  constructor(parent: HTMLElement | null) {
    if (!parent || typeof document === 'undefined') return;
    const c = document.createElement('canvas');
    c.className = 'lens-dirt';
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0;';
    parent.appendChild(c);
    this.canvas = c;
    this.g = c.getContext('2d');
  }

  /** độ phủ hiện tại 0..1 (E2E/debug) */
  get opacity(): number {
    if (this.age === Infinity) return 0;
    return this.strength * (this.age < HOLD_S ? 1 : Math.max(0, 1 - (this.age - HOLD_S) / FADE_S));
  }

  /** văng bùn: `k` 0..1 theo độ gần vụ nổ, `side` −1..1 (phía vụ nổ trên màn hình → bùn dồn về phía đó) */
  splash(k: number, side = 0): void {
    const c = this.canvas;
    const g = this.g;
    if (!c || !g) return;
    const w = Math.max(320, Math.round((c.clientWidth || 1280) / 2));
    const h = Math.max(180, Math.round((c.clientHeight || 720) / 2));
    if (c.width !== w || c.height !== h || this.opacity <= 0.01) {
      c.width = w;
      c.height = h;
      g.clearRect(0, 0, w, h);
    }
    const r = this.rng;
    const kk = Math.max(0, Math.min(1, k));
    const big = 2 + Math.round(kk * 4);
    for (let i = 0; i < big; i++) {
      // dồn ra mép: chọn điểm theo góc, bán kính 0,55–1,05 (tâm khung ít bùn)
      const ang = r.next() * Math.PI * 2;
      const rad = 0.72 + r.next() * 0.4;
      let x = 0.5 + Math.cos(ang) * rad * 0.5 + side * 0.12;
      let y = 0.5 + Math.sin(ang) * rad * 0.5 + 0.06;
      x = Math.max(-0.05, Math.min(1.05, x)) * w;
      y = Math.max(-0.05, Math.min(1.05, y)) * h;
      const R = (0.04 + r.next() * 0.09) * (0.6 + kk * 0.6) * h;
      this.blob(g, x, y, R, 0.82 + r.next() * 0.15);
      // giọt văng quanh đốm to
      const drops = 4 + r.int(0, 8);
      for (let d = 0; d < drops; d++) {
        const a = r.next() * Math.PI * 2;
        const dist = R * (1.1 + r.next() * 1.8);
        this.blob(g, x + Math.cos(a) * dist, y + Math.sin(a) * dist, R * (0.08 + r.next() * 0.2), 0.75 + r.next() * 0.2);
      }
      // vệt bùn chảy xuống
      if (r.next() < 0.45) {
        const len = R * (0.8 + r.next() * 1.6);
        const wd = R * (0.06 + r.next() * 0.08);
        g.save();
        g.filter = `blur(${Math.max(0.6, wd * 0.5).toFixed(1)}px)`;
        const grad = g.createLinearGradient(x, y, x, y + len);
        grad.addColorStop(0, 'rgba(52,34,20,0.7)');
        grad.addColorStop(1, 'rgba(52,34,20,0)');
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(x - wd, y);
        g.quadraticCurveTo(x - wd * 0.4, y + len * 0.7, x + (r.next() - 0.5) * wd, y + len);
        g.quadraticCurveTo(x + wd * 0.4, y + len * 0.7, x + wd, y);
        g.fill();
        g.restore();
      }
    }
    // bụi đất lấm tấm khắp khung
    const specks = Math.round(60 + kk * 260);
    for (let i = 0; i < specks; i++) {
      const x = r.next() * w;
      const y = r.next() * h;
      const s = (0.4 + r.next() * r.next() * 2.6) * (h / 540);
      g.fillStyle = `rgba(${40 + r.int(0, 30)},${26 + r.int(0, 18)},${16 + r.int(0, 10)},${(0.35 + r.next() * 0.5).toFixed(2)})`;
      g.beginPath();
      g.arc(x, y, s, 0, Math.PI * 2);
      g.fill();
    }
    this.strength = Math.min(1, Math.max(this.opacity, 0.55 + kk * 0.45));
    this.age = 0;
    this.splats++;
    c.style.opacity = this.strength.toFixed(3);
  }

  /**
   * đốm bùn: cụm 7–15 vòng tròn chồng nhau lệch ngẫu nhiên (mép hữu cơ, không thành hình sao), làm mềm bằng blur nhẹ,
   * rồi lõi đặc tối hơn và vài hạt sạn sắc bên trong
   */
  private blob(g: CanvasRenderingContext2D, x: number, y: number, R: number, a: number): void {
    const r = this.rng;
    const n = 7 + r.int(0, 8);
    const soft = Math.max(0.6, R * 0.09);
    g.save();
    g.filter = `blur(${soft.toFixed(1)}px)`;
    g.fillStyle = `rgba(66,44,27,${(a * 0.72).toFixed(2)})`;
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const ang = r.next() * Math.PI * 2;
      const d = R * 0.55 * Math.sqrt(r.next());
      const cr = R * (0.28 + r.next() * 0.42);
      g.moveTo(x + Math.cos(ang) * d + cr, y + Math.sin(ang) * d * 0.85);
      g.arc(x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.85, cr, 0, Math.PI * 2);
    }
    g.fill();
    g.filter = `blur(${(soft * 1.6).toFixed(1)}px)`;
    g.fillStyle = `rgba(34,22,13,${(a * 0.7).toFixed(2)})`;
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const ang = r.next() * Math.PI * 2;
      const d = R * 0.25 * r.next();
      const cr = R * (0.18 + r.next() * 0.22);
      g.moveTo(x + Math.cos(ang) * d + cr, y + Math.sin(ang) * d);
      g.arc(x + Math.cos(ang) * d, y + Math.sin(ang) * d, cr, 0, Math.PI * 2);
    }
    g.fill();
    g.restore();
    // sạn: hạt nhỏ sắc, sáng tối lẫn lộn
    const grit = 3 + r.int(0, Math.min(14, Math.round(R / 3)));
    for (let i = 0; i < grit; i++) {
      const ang = r.next() * Math.PI * 2;
      const d = R * 0.7 * Math.sqrt(r.next());
      g.fillStyle = r.next() < 0.3 ? 'rgba(120,96,70,0.6)' : 'rgba(24,15,9,0.8)';
      g.beginPath();
      g.arc(x + Math.cos(ang) * d, y + Math.sin(ang) * d, Math.max(0.5, R * (0.02 + r.next() * 0.05)), 0, Math.PI * 2);
      g.fill();
    }
  }

  update(dt: number): void {
    if (!this.canvas || this.age === Infinity) return;
    this.age += dt;
    const o = this.opacity;
    this.canvas.style.opacity = o.toFixed(3);
    if (o <= 0) {
      this.age = Infinity;
      this.g?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  reset(): void {
    this.age = Infinity;
    this.strength = 0;
    if (this.canvas) {
      this.canvas.style.opacity = '0';
      this.g?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}
