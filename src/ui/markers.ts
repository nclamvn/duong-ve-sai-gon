/**
 * Marker 3D trong khung hình (TIP-UX02): mục tiêu (kim cương + khoảng cách, kẹp mép có mũi tên khi ngoài khung) và tên đồng đội
 * (chỉ khi nhìn vào ≤ lookDeg, PRD §8.4 "dấu nhỏ khi nhìn vào"). Địch KHÔNG có marker (công bằng §20.3).
 * Chiếu bằng hàm `project` do game cấp (three Vector3.project) → ui không import three.
 */
import { t } from './i18n';

export interface Marker3DInput {
  id: string;
  kind: 'obj' | 'friend';
  /** world */
  x: number;
  y: number;
  z: number;
  /** đồng đội: khoá i18n tên */
  nameKey?: string;
  /** mục tiêu: khoảng cách m (đã tính) */
  dist?: number;
}

/** out: [ndcX, ndcY, behind(0|1)] */
export type Projector = (x: number, y: number, z: number, out: [number, number, number]) => void;

/** kẹp điểm NDC vào hình chữ nhật (1 − mx, 1 − my); sau camera → lật rồi ép ra mép. Trả góc mũi tên (rad, 0 = lên) */
export function clampToEdge(nx: number, ny: number, behind: boolean, mx: number, my: number): { x: number; y: number; edge: boolean; angle: number } {
  let x = behind ? -nx : nx;
  let y = behind ? -ny : ny;
  const lx = 1 - mx;
  const ly = 1 - my;
  const inside = !behind && Math.abs(x) <= lx && Math.abs(y) <= ly;
  if (inside) return { x, y, edge: false, angle: 0 };
  // ép theo tia từ tâm: tỉ lệ để chạm cạnh gần nhất
  if (behind && Math.abs(x) < 1e-4 && Math.abs(y) < 1e-4) y = -1;
  const k = Math.min(lx / Math.max(1e-6, Math.abs(x)), ly / Math.max(1e-6, Math.abs(y)));
  x *= k;
  y *= k;
  return { x, y, edge: true, angle: Math.atan2(x, y) };
}

export class Markers3D {
  private readonly els = new Map<string, HTMLElement>();
  private readonly proj: [number, number, number] = [0, 0, 0];
  private readonly lastText = new Map<string, string>();

  constructor(private readonly root: HTMLElement) {}

  /**
   * @param fwd hướng nhìn world (đơn vị) — để lọc đồng đội "đang nhìn vào"
   * @param eye vị trí mắt
   */
  update(list: readonly Marker3DInput[], project: Projector, w: number, h: number, eye: [number, number, number], fwd: [number, number, number], lookDeg = 9): void {
    const seen = new Set<string>();
    const cosLook = Math.cos((lookDeg * Math.PI) / 180);
    for (const m of list) {
      const dx = m.x - eye[0];
      const dy = m.y - eye[1];
      const dz = m.z - eye[2];
      const len = Math.hypot(dx, dy, dz) || 1;
      if (m.kind === 'friend') {
        const dot = (dx * fwd[0] + dy * fwd[1] + dz * fwd[2]) / len;
        if (dot < cosLook || len > 45) continue;
      }
      seen.add(m.id);
      project(m.x, m.y, m.z, this.proj);
      const c = clampToEdge(this.proj[0], this.proj[1], this.proj[2] > 0.5, 0.12, 0.16);
      let el = this.els.get(m.id);
      if (!el) {
        el = document.createElement('div');
        el.className = `m3 ${m.kind}`;
        el.dataset['testid'] = `marker-${m.kind}`;
        el.innerHTML = m.kind === 'obj' ? '<span class="ico"></span><span class="d"></span><span class="arrow"></span>' : '<span class="name"></span><span class="chev"></span>';
        this.root.appendChild(el);
        this.els.set(m.id, el);
      }
      const sx = ((c.x + 1) / 2) * w;
      const sy = ((1 - c.y) / 2) * h;
      el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%)`;
      el.classList.toggle('edge', c.edge);
      if (m.kind === 'obj') {
        const near = (m.dist ?? len) < 4;
        el.classList.toggle('faded', near);
        const text = `${Math.round(m.dist ?? len)} ${t('unit.m')}`;
        if (this.lastText.get(m.id) !== text) {
          this.lastText.set(m.id, text);
          (el.querySelector('.d') as HTMLElement).textContent = text;
        }
        if (c.edge) (el.querySelector('.arrow') as HTMLElement).style.transform = `translate(-50%, -100%) rotate(${((c.angle * 180) / Math.PI).toFixed(1)}deg) translateY(-1.1em)`;
      } else {
        const text = m.nameKey ? t(m.nameKey) : '';
        if (this.lastText.get(m.id) !== text) {
          this.lastText.set(m.id, text);
          (el.querySelector('.name') as HTMLElement).textContent = text;
        }
      }
    }
    for (const [id, el] of this.els) {
      if (seen.has(id)) continue;
      el.remove();
      this.els.delete(id);
      this.lastText.delete(id);
    }
  }

  get count(): number {
    return this.els.size;
  }
}
