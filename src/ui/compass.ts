/**
 * La bàn HUD (TIP-UX02): băng vạch 10°, hướng chính 90° (B/Đ/N/T) + phụ 45° (ĐB/ĐN/TN/TB), notch giữa, marker mục tiêu/đồng đội theo
 * phương vị tương đối, kẹp mép. Quy ước: **bắc = −z world**, phương vị theo chiều kim đồng hồ nhìn từ trên (đông = +x).
 * Thuần DOM + toán; không phụ thuộc three (unit test được phần toán).
 */
import { t } from './i18n';

/** phương vị (độ, 0..360) của vector ngang (x, z) — bắc = −z, đông = +x */
export function bearingOf(dx: number, dz: number): number {
  const d = (Math.atan2(dx, -dz) * 180) / Math.PI;
  return ((d % 360) + 360) % 360;
}

/** góc lệch −180..180 (b − a) */
export function relDeg(a: number, b: number): number {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

export interface CompassMarker {
  id: string;
  kind: 'obj' | 'friend';
  bearing: number;
}

/** khoá i18n theo phương vị 0/45/…/315 */
const CARD_KEYS = ['compass.n', 'compass.ne', 'compass.e', 'compass.se', 'compass.s', 'compass.sw', 'compass.w', 'compass.nw'] as const;

export class CompassBar {
  private readonly tape: HTMLElement;
  private readonly markers = new Map<string, HTMLElement>();
  private readonly pool: HTMLElement[] = [];
  private ppd = 6;
  private lastHeading = NaN;
  private width = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly fovDeg = 90,
  ) {
    root.innerHTML = '<div class="tape"></div><div class="notch"></div>';
    this.tape = root.querySelector('.tape')!;
    this.build();
  }

  /** dựng băng −360..720 (3 vòng) để không phải cuộn */
  private build(): void {
    const frag: string[] = [];
    for (let d = -360; d <= 720; d += 10) {
      const major = d % 45 === 0;
      frag.push(`<i class="tick${major ? ' major' : ''}" data-d="${d}"></i>`);
      if (major) {
        const idx = (((d % 360) + 360) % 360) / 45;
        const minor = idx % 2 === 1;
        frag.push(`<b class="card${minor ? ' minor' : ''}" data-d="${d}">${t(CARD_KEYS[idx]!)}</b>`);
      }
    }
    this.tape.innerHTML = frag.join('');
    this.layout();
  }

  /** đặt lại vị trí px theo bề rộng hiện tại (gọi khi resize) */
  layout(): void {
    const w = this.root.clientWidth || 600;
    if (w === this.width) return;
    this.width = w;
    this.ppd = w / this.fovDeg;
    for (const el of this.tape.querySelectorAll<HTMLElement>('[data-d]')) el.style.left = `${Number(el.dataset['d']) * this.ppd}px`;
    this.lastHeading = NaN;
  }

  setHeading(deg: number): void {
    const h = ((deg % 360) + 360) % 360;
    if (Math.abs(h - this.lastHeading) < 0.05) return;
    this.lastHeading = h;
    this.tape.style.transform = `translateX(${(-h * this.ppd).toFixed(2)}px)`;
  }

  setMarkers(list: readonly CompassMarker[]): void {
    const seen = new Set<string>();
    const half = this.fovDeg / 2 - 1.5;
    for (const m of list) {
      seen.add(m.id);
      let el = this.markers.get(m.id);
      if (!el) {
        el = this.pool.pop() ?? document.createElement('i');
        el.className = `mk ${m.kind}`;
        el.dataset['kind'] = m.kind;
        this.root.appendChild(el);
        this.markers.set(m.id, el);
      }
      if (el.dataset['kind'] !== m.kind) {
        el.className = `mk ${m.kind}`;
        el.dataset['kind'] = m.kind;
      }
      const rel = relDeg(this.lastHeading || 0, m.bearing);
      const clamped = Math.max(-half, Math.min(half, rel));
      const edge = clamped !== rel;
      el.classList.toggle('edge', edge);
      el.style.left = `calc(50% + ${(clamped * this.ppd).toFixed(1)}px)`;
    }
    for (const [id, el] of this.markers) {
      if (seen.has(id)) continue;
      el.remove();
      this.pool.push(el);
      this.markers.delete(id);
    }
  }
}
