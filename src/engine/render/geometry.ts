/**
 * Geometry procedural cho cảng (TIP-011): UV theo mét (1 unit uv = 1 m → material chia tileMeters),
 * container 20 ft, crate/pallet gỗ, cuộn cáp, thùng phuy có gân, cột đèn. Không asset ngoài; tất cả hợp collider cũ.
 */
import { BoxGeometry, CylinderGeometry, BufferGeometry, Matrix4, Vector3, Euler, Quaternion, TorusGeometry, RingGeometry } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion();
const _s = new Vector3(1, 1, 1);

/** BoxGeometry với UV theo mét: mỗi mặt uv = kích thước mặt (m). Thứ tự mặt của BoxGeometry: +x −x +y −y +z −z. */
export function metricBox(w: number, h: number, d: number): BoxGeometry {
  const g = new BoxGeometry(w, h, d);
  const uv = g.attributes['uv']!;
  const faceDims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = faceDims[f]!;
    for (let i = f * 4; i < f * 4 + 4; i++) {
      uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    }
  }
  return g;
}

/** Cylinder với UV theo mét (chu vi × chiều cao). */
export function metricCylinder(rTop: number, rBot: number, h: number, seg = 16, open = false): CylinderGeometry {
  const g = new CylinderGeometry(rTop, rBot, h, seg, 1, open);
  const uv = g.attributes['uv']!;
  const circ = Math.PI * (rTop + rBot);
  const n = uv.count;
  // thân: uv.x 0..1 quanh chu vi, uv.y 0..1 theo cao; nắp: uv dạng đĩa 0..1 → scale theo đường kính
  for (let i = 0; i < n; i++) {
    const inBody = i < (seg + 1) * 2;
    if (inBody) uv.setXY(i, uv.getX(i) * circ, uv.getY(i) * h);
    else uv.setXY(i, uv.getX(i) * rTop * 2, uv.getY(i) * rTop * 2);
  }
  return g;
}

function place(g: BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): BufferGeometry {
  _p.set(x, y, z);
  _q.setFromEuler(new Euler(rx, ry, rz));
  _m.compose(_p, _q, _s);
  g.applyMatrix4(_m);
  return g;
}

/** Gộp và trả về geometry đơn; tất cả part cùng material. */
function merge(parts: BufferGeometry[]): BufferGeometry {
  const g = mergeGeometries(parts, false);
  if (!g) throw new Error('merge failed');
  for (const p of parts) p.dispose();
  return g;
}

/**
 * Container 20 ft (visual cho cover block 6 × 2.6 × 2.4). Thân tôn sóng (metricBox) — chi tiết khung/cửa trả riêng
 * để dùng material thép tối. Trục dài theo x, cửa ở +x.
 */
export function containerParts(w = 6, h = 2.6, d = 2.4): { shell: BufferGeometry; frame: BufferGeometry } {
  const shell = metricBox(w - 0.1, h - 0.16, d - 0.1);
  place(shell, 0, 0, 0);
  const post = 0.16;
  const frame: BufferGeometry[] = [];
  // 4 cột góc + 8 thanh dọc cạnh (khung ISO)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) frame.push(place(new BoxGeometry(post, h, post), (sx * (w - post)) / 2, 0, (sz * (d - post)) / 2));
  for (const sy of [-1, 1]) {
    for (const sz of [-1, 1]) frame.push(place(new BoxGeometry(w, post * 0.8, post * 0.8), 0, (sy * (h - post * 0.8)) / 2, (sz * (d - post * 0.8)) / 2));
    for (const sx of [-1, 1]) frame.push(place(new BoxGeometry(post * 0.8, post * 0.8, d), (sx * (w - post * 0.8)) / 2, (sy * (h - post * 0.8)) / 2, 0));
  }
  // cửa +x: 4 thanh khoá dọc + tay khoá
  for (let i = 0; i < 4; i++) {
    const z = -d / 2 + 0.35 + i * ((d - 0.7) / 3);
    frame.push(place(new CylinderGeometry(0.03, 0.03, h - 0.4, 8), w / 2 + 0.04, 0, z));
    frame.push(place(new BoxGeometry(0.06, 0.05, 0.3), w / 2 + 0.06, -0.2 + (i % 2) * 0.3, z + 0.12));
  }
  // góc ISO (corner casting)
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) frame.push(place(new BoxGeometry(0.2, 0.2, 0.2), (sx * (w - 0.2)) / 2, (sy * (h - 0.2)) / 2, (sz * (d - 0.2)) / 2));
  return { shell, frame: merge(frame) };
}

/** Crate gỗ (khớp collider hộp w×h×d): ván ép + nẹp gỗ ở cạnh; UV theo mét. */
export function crate(w: number, h: number, d: number): BufferGeometry {
  const parts: BufferGeometry[] = [metricBox(w - 0.06, h - 0.06, d - 0.06)];
  const t = 0.06;
  // nẹp 12 cạnh
  for (const sy of [-1, 1]) {
    for (const sz of [-1, 1]) parts.push(place(metricBox(w, t, t), 0, (sy * (h - t)) / 2, (sz * (d - t)) / 2));
    for (const sx of [-1, 1]) parts.push(place(metricBox(t, t, d), (sx * (w - t)) / 2, (sy * (h - t)) / 2, 0));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(place(metricBox(t, h, t), (sx * (w - t)) / 2, 0, (sz * (d - t)) / 2));
  // nẹp chéo mặt trước/sau
  for (const sz of [-1, 1]) parts.push(place(metricBox(Math.hypot(w, h) * 0.92, t * 0.8, t * 0.6), 0, 0, (sz * (d - t * 0.6)) / 2, 0, 0, Math.atan2(h, w) * sz));
  return merge(parts);
}

/** Pallet + crate chồng (khớp collider hộp w×h×d; pallet 0.15 m). */
export function palletStack(w: number, h: number, d: number): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const ph = 0.14;
  // pallet: 3 dầm + 5 ván
  for (const sz of [-1, 0, 1]) parts.push(place(metricBox(w, ph * 0.5, 0.1), 0, -h / 2 + ph * 0.25, sz * (d / 2 - 0.06)));
  for (let i = 0; i < 5; i++) parts.push(place(metricBox(w / 5 - 0.03, ph * 0.35, d), -w / 2 + (i + 0.5) * (w / 5), -h / 2 + ph * 0.5 + ph * 0.17, 0));
  const ch = h - ph;
  parts.push(place(crate(w * 0.94, ch, d * 0.94), 0, -h / 2 + ph + ch / 2, 0));
  return merge(parts);
}

/** Cuộn cáp (khớp collider trụ r × h): 2 đĩa gỗ + lõi + cáp quấn (torus). */
export function cableSpool(r: number, h: number): { wood: BufferGeometry; cable: BufferGeometry } {
  const disc = 0.08;
  const wood = merge([
    place(metricCylinder(r, r, disc, 20), 0, h / 2 - disc / 2, 0),
    place(metricCylinder(r, r, disc, 20), 0, -h / 2 + disc / 2, 0),
    place(metricCylinder(r * 0.35, r * 0.35, h - disc * 2, 12), 0, 0, 0),
  ]);
  const cable = merge([place(new TorusGeometry(r * 0.62, r * 0.27, 10, 28), 0, 0, 0, Math.PI / 2)]);
  return { wood, cable };
}

/** Thùng phuy 200 L (r 0.3, h 0.9) + 2 gân. */
export function drum(r = 0.3, h = 0.9): BufferGeometry {
  return merge([
    metricCylinder(r, r, h, 14),
    place(new TorusGeometry(r, 0.018, 6, 20), 0, h * 0.2, 0, Math.PI / 2),
    place(new TorusGeometry(r, 0.018, 6, 20), 0, -h * 0.2, 0, Math.PI / 2),
  ]);
}

/** Cột đèn pha cảng: thân trụ 8 m + tay ngang 2.5 m + hộp đèn; trả về geometry thân và vị trí đèn local. */
export function lampPost(height = 8, arm = 2.6): { pole: BufferGeometry; head: BufferGeometry; headLocal: [number, number, number] } {
  const pole = merge([
    place(new CylinderGeometry(0.09, 0.14, height, 10), 0, height / 2, 0),
    place(new CylinderGeometry(0.06, 0.07, arm, 8), arm / 2, height - 0.15, 0, 0, 0, Math.PI / 2),
    place(new CylinderGeometry(0.22, 0.28, 0.08, 10), 0, 0.04, 0),
    place(new BoxGeometry(0.06, 0.9, 0.06), arm * 0.45, height - 0.6, 0, 0, 0, -0.6),
  ]);
  const head = merge([place(new BoxGeometry(0.7, 0.22, 0.42), arm, height - 0.2, 0)]);
  return { pole, head, headLocal: [arm, height - 0.32, 0] };
}

/** Vòng splash mưa (đơn vị, scale/opacity qua TSL). */
export function splashRing(): RingGeometry {
  const g = new RingGeometry(0.035, 0.06, 10, 1);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Tấm biển emissive (w × h m) — UV 0..1 để dán canvas texture. */
export function signPlane(w: number, h: number): BoxGeometry {
  return new BoxGeometry(w, h, 0.06);
}
