/**
 * Obstacle thân cây cho navmesh (TIP-D05 vòng 2 / D08): mỗi collider cylinder → lăng trụ 8 cạnh (tường −0,8..capH + nắp) đưa vào
 * lưới đầu vào recast — nắp ở 1,2 m: cao hơn walkableClimb (nếu ≤ 0,5 m recast coi là bậc thang leo được → không carve) và thấp hơn
 * walkableHeight 1,8 → ô dưới thân mất khoảng trống → không đi được; walkableRadius xói mòn quanh gốc. Thuần số (Node + trình duyệt): dùng cho `terrain-bake.mjs --nav --level` và bake runtime (game).
 */
import type { ColliderDef } from '../render/arena';

export interface NavObstacleMesh {
  positions: Float32Array;
  indices: Uint32Array;
  count: number;
}

export function navObstacleMesh(colliders: readonly ColliderDef[], opts: { capH?: number; sides?: number; radiusPad?: number; groundAt?: (x: number, z: number) => number } = {}): NavObstacleMesh {
  const capH = opts.capH ?? 1.2; // > walkableClimb (0,35 m → 2 cell 0,5 m: nắp thấp hơn bị coi là bậc thang đi lên được) và < walkableHeight 1,8
  const sides = opts.sides ?? 8;
  const pad = opts.radiusPad ?? 0.05;
  const groundAt = opts.groundAt;
  const list = colliders.filter((c) => c.kind === 'cylinder');
  const vPer = sides * 2 + 1;
  const positions = new Float32Array(list.length * vPer * 3);
  const idx: number[] = [];
  let v = 0;
  for (const c of list) {
    const r = c.size[0] + pad;
    // đáy = mặt đất tại tâm (gốc cây đã chôn theo dốc — `sink` — nên đáy cylinder có thể thấp hơn mặt đất 1–2 m → phải lấy terrain)
    const base = groundAt ? groundAt(c.position[0], c.position[2]) : c.position[1] - c.size[1];
    const y0 = base - 0.8;
    const y1 = base + capH;
    const b0 = v;
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const x = c.position[0] + Math.cos(a) * r;
      const z = c.position[2] + Math.sin(a) * r;
      positions[(b0 + i) * 3] = x;
      positions[(b0 + i) * 3 + 1] = y0;
      positions[(b0 + i) * 3 + 2] = z;
      positions[(b0 + sides + i) * 3] = x;
      positions[(b0 + sides + i) * 3 + 1] = y1;
      positions[(b0 + sides + i) * 3 + 2] = z;
    }
    const top = b0 + sides * 2;
    positions[top * 3] = c.position[0];
    positions[top * 3 + 1] = y1;
    positions[top * 3 + 2] = c.position[2];
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      // tường (hai mặt để không phụ thuộc chiều)
      idx.push(b0 + i, b0 + sides + i, b0 + j, b0 + j, b0 + sides + i, b0 + sides + j);
      idx.push(b0 + j, b0 + sides + i, b0 + i, b0 + sides + j, b0 + sides + i, b0 + j);
      // nắp
      idx.push(b0 + sides + i, top, b0 + sides + j);
    }
    v += vPer;
  }
  return { positions, indices: new Uint32Array(idx), count: list.length };
}
