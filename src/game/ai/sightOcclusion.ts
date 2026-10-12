/**
 * DV-083 che tầm nhìn bởi thảm thực vật (luật công bằng PRD §20.3): dò theo tia mắt → mục tiêu, mỗi 1,5 m đọc lưới tầng thấp
 * (VegetationSystem.understoryGrid); điểm tia thấp hơn chiều cao tán ở ô đó thì cộng độ phủ. Bỏ 2 m đầu/cuối (lá sát mặt người
 * nhìn/người bị nhìn không che được cả thân). Trả 0 (thoáng) … 1 (kín). Thuần logic, không three.
 */
type V3 = readonly [number, number, number] | readonly number[];

export interface UnderstoryGrid {
  x0: number;
  z0: number;
  n: number;
  cell: number;
  cover: Float32Array;
  height: Float32Array;
}

export function makeSightOcclusion(grid: UnderstoryGrid, groundAt: (x: number, z: number) => number, k = 0.55): (from: V3, to: V3) => number {
  return (from, to) => {
    const dx = to[0]! - from[0]!;
    const dy = to[1]! - from[1]!;
    const dz = to[2]! - from[2]!;
    const len = Math.hypot(dx, dz);
    if (len < 4.5) return 0;
    const step = 1.5;
    let tau = 0;
    for (let s = 2; s < len - 2; s += step) {
      const t = s / len;
      const x = from[0]! + dx * t;
      const z = from[2]! + dz * t;
      const ix = Math.floor((x - grid.x0) / grid.cell);
      const iz = Math.floor((z - grid.z0) / grid.cell);
      if (ix < 0 || iz < 0 || ix >= grid.n || iz >= grid.n) continue;
      const o = iz * grid.n + ix;
      const c = grid.cover[o]!;
      if (c <= 0) continue;
      const above = from[1]! + dy * t - groundAt(x, z);
      const h = grid.height[o]!;
      if (above > h) continue;
      // phần dưới tán dày hơn phần ngọn
      tau += c * step * k * (above < h * 0.6 ? 1 : 0.5);
      if (tau > 4) break;
    }
    return 1 - Math.exp(-tau);
  };
}
