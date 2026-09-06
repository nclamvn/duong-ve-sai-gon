/**
 * Minimap + bản đồ chiến thuật (TIP-UX02, Chủ nhà: "không có khung bản đồ để di chuyển"). Canvas 2D:
 *  - minimap góc dưới trái: ảnh bản đồ giấy bake (`terrain-bake --map` → map.png, bắc = −z ở mép trên) xoay theo hướng nhìn,
 *    bán kính nhìn `viewM`, mũi tên người chơi, kim cương mục tiêu, chấm đồng đội, địch chỉ khi vừa bắn (caller lọc);
 *  - bản đồ toàn màn (phím M): cả ô, bắc lên trên, lưới 100 m, chú giải; phím N bật/tắt minimap.
 * Không phụ thuộc three. Không Math.random.
 */
import { t } from './i18n';

export interface MinimapActor {
  x: number;
  z: number;
  /** rad, quy ước yaw player (0 = −z, dương = quay trái) — chỉ dùng cho player */
  yaw?: number;
  kind: 'player' | 'friend' | 'enemy';
}

export interface MapMeta {
  /** cạnh ô (m), tâm (cx, cz) world */
  sizeM: number;
  cx: number;
  cz: number;
}

export class Minimap {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly tac: HTMLElement;
  private readonly tacCanvas: HTMLCanvasElement;
  private readonly tacCtx: CanvasRenderingContext2D | null;
  private img: HTMLImageElement | null = null;
  private meta: MapMeta = { sizeM: 2048, cx: 0, cz: 0 };
  /** vùng bản đồ chiến thuật (m) — mặc định cả ô; level đặt theo navRect + lề */
  private focus: { cx: number; cz: number; size: number } | null = null;
  private player: MinimapActor = { x: 0, z: 0, yaw: 0, kind: 'player' };
  private others: readonly MinimapActor[] = [];
  private objective: { x: number; z: number } | null = null;
  /** bán kính nhìn minimap (m) */
  viewM = 110;
  enabled = true;
  tacOpen = false;
  /** vẽ mỗi n frame (minimap rẻ nhưng không cần 60 Hz) */
  private frame = 0;
  private lastSize = 0;
  private headingDeg = 0;

  constructor(private readonly root: HTMLElement) {
    this.canvas = root.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d');
    (root.querySelector('.n') as HTMLElement).textContent = t('compass.n');
    (root.querySelector('.scale span') as HTMLElement).textContent = `100 ${t('unit.m')}`;
    this.tac = document.createElement('div');
    this.tac.id = 'tacmap';
    this.tac.hidden = true;
    this.tac.dataset['testid'] = 'tacmap';
    this.tac.innerHTML = `<div class="paper"><canvas></canvas><div class="title"></div><div class="legend"></div><div class="hint"></div></div>`;
    document.body.appendChild(this.tac);
    this.tacCanvas = this.tac.querySelector('canvas')!;
    this.tacCtx = this.tacCanvas.getContext('2d');
    (this.tac.querySelector('.title') as HTMLElement).textContent = t('map.title');
    (this.tac.querySelector('.legend') as HTMLElement).innerHTML = [
      ['#f3efe4', 'map.legend.player'],
      ['#e0aa5c', 'map.legend.objective'],
      ['#9fd8a8', 'map.legend.friend'],
      ['#ff6b57', 'map.legend.enemy'],
    ]
      .map(([c, k]) => `<span><b style="background:${c}"></b>${t(k!)}</span>`)
      .join('');
    (this.tac.querySelector('.hint') as HTMLElement).textContent = t('map.hint');
    window.addEventListener('keydown', (ev) => {
      if (ev.code === 'KeyM') this.toggleTac();
      else if (ev.code === 'KeyN') this.setEnabled(!this.enabled);
    });
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.root.hidden = !on;
  }

  toggleTac(open = !this.tacOpen): void {
    this.tacOpen = open;
    this.tac.hidden = !open;
    if (open) this.drawTac();
  }

  /** nạp ảnh bản đồ (bake) — không có ảnh vẫn vẽ nền phẳng */
  setMap(url: string | null, meta: MapMeta): void {
    this.meta = meta;
    this.img = null;
    if (!url) return;
    const im = new Image();
    im.onload = () => {
      this.img = im;
    };
    im.onerror = () => {
      this.img = null;
    };
    im.src = url;
  }

  /** vùng hiển thị của bản đồ chiến thuật (vuông, m) */
  setFocus(cx: number, cz: number, size: number): void {
    this.focus = { cx, cz, size };
  }

  setActors(player: MinimapActor, others: readonly MinimapActor[], objective: { x: number; z: number } | null): void {
    this.player = player;
    this.others = others;
    this.objective = objective;
  }

  get hasImage(): boolean {
    return this.img !== null;
  }

  /** gọi mỗi frame; vẽ minimap 30 Hz, bản đồ toàn màn 10 Hz khi mở */
  draw(headingDeg: number): void {
    this.headingDeg = headingDeg;
    this.frame++;
    if (this.enabled && this.frame % 2 === 0) this.drawMini();
    if (this.tacOpen && this.frame % 6 === 0) this.drawTac();
  }

  private drawMini(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const css = this.root.clientWidth || 150;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const S = Math.round(css * dpr);
    if (S !== this.lastSize) {
      this.canvas.width = S;
      this.canvas.height = S;
      this.lastSize = S;
    }
    const k = S / (2 * this.viewM); // px/m
    const h = (this.headingDeg * Math.PI) / 180;
    const p = this.player;
    ctx.clearRect(0, 0, S, S);
    // nền + ảnh bản đồ xoay
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, S, S);
    ctx.clip();
    ctx.translate(S / 2, S / 2);
    ctx.rotate(-h);
    ctx.scale(k, k);
    ctx.translate(-p.x, -p.z);
    const m = this.meta;
    if (this.img) ctx.drawImage(this.img, m.cx - m.sizeM / 2, m.cz - m.sizeM / 2, m.sizeM, m.sizeM);
    else {
      ctx.fillStyle = '#3a4a33';
      ctx.fillRect(m.cx - m.sizeM / 2, m.cz - m.sizeM / 2, m.sizeM, m.sizeM);
      ctx.strokeStyle = 'rgba(243,239,228,0.12)';
      ctx.lineWidth = 1 / k;
      for (let g = -m.sizeM / 2; g <= m.sizeM / 2; g += 100) {
        ctx.beginPath();
        ctx.moveTo(m.cx + g, m.cz - m.sizeM / 2);
        ctx.lineTo(m.cx + g, m.cz + m.sizeM / 2);
        ctx.moveTo(m.cx - m.sizeM / 2, m.cz + g);
        ctx.lineTo(m.cx + m.sizeM / 2, m.cz + g);
        ctx.stroke();
      }
    }
    ctx.restore();
    // phủ tối nhẹ + nón nhìn
    ctx.fillStyle = 'rgba(21,26,24,0.18)';
    ctx.fillRect(0, 0, S, S);
    ctx.save();
    ctx.translate(S / 2, S / 2);
    const cone = ctx.createRadialGradient(0, 0, 0, 0, 0, S * 0.5);
    cone.addColorStop(0, 'rgba(243,239,228,0.22)');
    cone.addColorStop(1, 'rgba(243,239,228,0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, S * 0.5, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // actor
    const toScreen = (x: number, z: number): [number, number] => {
      const dx = (x - p.x) * k;
      const dz = (z - p.z) * k;
      const c = Math.cos(-h);
      const s = Math.sin(-h);
      return [S / 2 + dx * c - dz * s, S / 2 + dx * s + dz * c];
    };
    const r = Math.max(2.5, 3 * dpr);
    for (const a of this.others) {
      const [sx, sy] = toScreen(a.x, a.z);
      if (sx < 0 || sy < 0 || sx > S || sy > S) continue;
      ctx.fillStyle = a.kind === 'friend' ? '#9fd8a8' : '#ff6b57';
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (this.objective) {
      let [sx, sy] = toScreen(this.objective.x, this.objective.z);
      // kẹp trong vòng tròn (mép)
      const ddx = sx - S / 2;
      const ddy = sy - S / 2;
      const dd = Math.hypot(ddx, ddy);
      const lim = S / 2 - 6 * dpr;
      if (dd > lim) {
        sx = S / 2 + (ddx / dd) * lim;
        sy = S / 2 + (ddy / dd) * lim;
      }
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Math.PI / 4);
      const d = 4 * dpr;
      ctx.fillStyle = 'rgba(224,170,92,0.35)';
      ctx.strokeStyle = '#e0aa5c';
      ctx.lineWidth = 1.5 * dpr;
      ctx.fillRect(-d, -d, 2 * d, 2 * d);
      ctx.strokeRect(-d, -d, 2 * d, 2 * d);
      ctx.restore();
    }
    // người chơi: mũi tên hướng lên
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.fillStyle = '#f3efe4';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 1;
    const a = 5 * dpr;
    ctx.beginPath();
    ctx.moveTo(0, -a * 1.3);
    ctx.lineTo(a * 0.8, a);
    ctx.lineTo(0, a * 0.55);
    ctx.lineTo(-a * 0.8, a);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // chữ B (bắc) ở mép theo hướng bắc
    const n = this.root.querySelector('.n') as HTMLElement;
    const nr = css / 2 - 10;
    const nx = -Math.sin(h) * nr;
    const ny = -Math.cos(h) * nr;
    n.style.transform = `translate(calc(-50% + ${nx.toFixed(1)}px), ${(ny + css / 2 - 3).toFixed(1)}px)`;
    // thước 100 m
    const sc = this.root.querySelector('.scale i') as HTMLElement;
    sc.style.width = `${(100 * (css / (2 * this.viewM))).toFixed(1)}px`;
  }

  private drawTac(): void {
    const ctx = this.tacCtx;
    if (!ctx) return;
    const paper = this.tac.querySelector('.paper') as HTMLElement;
    const css = paper.clientWidth || 600;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const S = Math.round(css * dpr);
    if (this.tacCanvas.width !== S) {
      this.tacCanvas.width = S;
      this.tacCanvas.height = S;
    }
    const m = this.meta;
    const f = this.focus ?? { cx: m.cx, cz: m.cz, size: m.sizeM };
    const k = S / f.size;
    const x0 = f.cx - f.size / 2;
    const z0 = f.cz - f.size / 2;
    const toScreen = (x: number, z: number): [number, number] => [(x - x0) * k, (z - z0) * k];
    ctx.clearRect(0, 0, S, S);
    if (this.img) {
      // cắt vùng focus từ ảnh cả ô
      const sx = ((x0 - (m.cx - m.sizeM / 2)) / m.sizeM) * this.img.width;
      const sz = ((z0 - (m.cz - m.sizeM / 2)) / m.sizeM) * this.img.height;
      const sw = (f.size / m.sizeM) * this.img.width;
      ctx.drawImage(this.img, sx, sz, sw, sw, 0, 0, S, S);
    } else {
      ctx.fillStyle = '#e9e0cd';
      ctx.fillRect(0, 0, S, S);
    }
    // lưới 100 m (bám bội số 100 world)
    ctx.strokeStyle = 'rgba(32,40,35,0.22)';
    ctx.lineWidth = 1;
    ctx.font = `${Math.round(10 * dpr)}px "Barlow Condensed", sans-serif`;
    ctx.fillStyle = 'rgba(32,40,35,0.6)';
    const g0 = Math.ceil(x0 / 100) * 100;
    const h0 = Math.ceil(z0 / 100) * 100;
    for (let g = g0; g <= x0 + f.size; g += 100) {
      const q = (g - x0) * k;
      ctx.beginPath();
      ctx.moveTo(q, 0);
      ctx.lineTo(q, S);
      ctx.stroke();
      if (g % 200 === 0) ctx.fillText(String(g), q + 3, 11 * dpr);
    }
    for (let g = h0; g <= z0 + f.size; g += 100) {
      const q = (g - z0) * k;
      ctx.beginPath();
      ctx.moveTo(0, q);
      ctx.lineTo(S, q);
      ctx.stroke();
      if (g % 200 === 0) ctx.fillText(String(g), 3, q - 3);
    }
    // actor
    for (const a of this.others) {
      const [sx, sy] = toScreen(a.x, a.z);
      ctx.fillStyle = a.kind === 'friend' ? '#3f8f56' : '#c7614c';
      ctx.beginPath();
      ctx.arc(sx, sy, 4 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
    if (this.objective) {
      const [sx, sy] = toScreen(this.objective.x, this.objective.z);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Math.PI / 4);
      const d = 6 * dpr;
      ctx.fillStyle = 'rgba(190,153,91,0.45)';
      ctx.strokeStyle = '#8a6a2f';
      ctx.lineWidth = 2 * dpr;
      ctx.fillRect(-d, -d, 2 * d, 2 * d);
      ctx.strokeRect(-d, -d, 2 * d, 2 * d);
      ctx.restore();
    }
    const [px, pz] = toScreen(this.player.x, this.player.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate((this.headingDeg * Math.PI) / 180);
    ctx.fillStyle = '#202823';
    ctx.strokeStyle = '#f3efe4';
    ctx.lineWidth = 1.5 * dpr;
    const a = 7 * dpr;
    ctx.beginPath();
    ctx.moveTo(0, -a * 1.3);
    ctx.lineTo(a * 0.8, a);
    ctx.lineTo(0, a * 0.55);
    ctx.lineTo(-a * 0.8, a);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
