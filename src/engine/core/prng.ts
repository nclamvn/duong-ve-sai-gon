/**
 * PRNG deterministic (mulberry32) — D-009. Mỗi hệ (recoil, ai, spawn) fork stream riêng theo label
 * để thay đổi một hệ không làm lệch stream hệ khác.
 */
export interface Prng {
  readonly seed: number;
  /** [0,1) */
  next(): number;
  /** [a,b) */
  range(a: number, b: number): number;
  /** số nguyên [a,b] */
  int(a: number, b: number): number;
  /** chuẩn ~N(0,1) xấp xỉ (Box-Muller) */
  gaussian(): number;
  fork(label: string): Prng;
  /** số lần đã gọi next() — dùng cho snapshot */
  readonly calls: number;
}

export function hashString(s: string, seed = 0x811c9dc5): number {
  // FNV-1a 32-bit
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function mulberry32(seed: number): Prng {
  let a = seed >>> 0;
  let calls = 0;
  const next = (): number => {
    calls++;
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const p: Prng = {
    seed: seed >>> 0,
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    gaussian: () => {
      let u = 0;
      let v = 0;
      while (u === 0) u = next();
      while (v === 0) v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    fork: (label) => mulberry32(hashString(label, seed >>> 0)),
    get calls() {
      return calls;
    },
  };
  return p;
}

/** Tua nhanh một PRNG mới về trạng thái sau `calls` lần gọi (restore từ snapshot). */
export function replayPrng(seed: number, calls: number): Prng {
  const p = mulberry32(seed);
  for (let i = 0; i < calls; i++) p.next();
  return p;
}
