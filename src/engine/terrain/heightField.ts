/**
 * Trường cao độ lọc tuyến tính cho pass hậu kỳ (DV-081): sương sát đất cần "cao bao nhiêu trên mặt đất" tại mọi điểm dọc tia
 * nhìn. Texture cao độ của terrain là RGBA8 hai byte + nearest (đọc ở vertex) — nội suy sai và lộ bậc; ở đây dựng bản
 * half-float hai kênh lọc linear, thu về ≤ 512² (sương mềm vài mét, không cần chi tiết hơn). Half-float chỉ chính xác ~0,5 m
 * ở 600 m → tách R = phần chẵn 64 m (chính xác tuyệt đối), G = phần dư 0..64 m (sai số ~3 cm); nội suy tuyến tính nên
 * lọc(R) + lọc(G) = lọc(cao độ). Shader: h = R + G + minY.
 */
import { DataTexture, DataUtils, RGFormat, HalfFloatType, LinearFilter, ClampToEdgeWrapping, NoColorSpace } from 'three/webgpu';
import type { TerrainTile } from './tile';

export interface HeightField {
  texture: DataTexture;
  /** góc tây bắc (x0, z0) và cạnh (m) — uv = (xz − x0z0) / size */
  x0: number;
  z0: number;
  size: number;
  /** cao độ engine = R + G + minY */
  minY: number;
}

export function makeHeightField(tile: TerrainTile, maxRes = 512): HeightField {
  const step = Math.max(1, Math.ceil(tile.n / maxRes));
  const m = Math.ceil(tile.n / step);
  const data = new Uint16Array(m * m * 2);
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < m; i++) {
      const x = -tile.half + Math.min(tile.n - 1, i * step) * tile.resM;
      const z = -tile.half + Math.min(tile.n - 1, j * step) * tile.resM;
      const h = tile.sample(x, z) - tile.minY;
      const coarse = Math.floor(h / 64) * 64;
      data[(j * m + i) * 2] = DataUtils.toHalfFloat(coarse);
      data[(j * m + i) * 2 + 1] = DataUtils.toHalfFloat(h - coarse);
    }
  }
  const t = new DataTexture(data, m, m, RGFormat, HalfFloatType);
  t.magFilter = t.minFilter = LinearFilter;
  t.wrapS = t.wrapT = ClampToEdgeWrapping;
  t.generateMipmaps = false;
  t.colorSpace = NoColorSpace;
  t.needsUpdate = true;
  // texel i ở x = −half + i·step·res → texel tâm khớp khi size = m·step·res và x0 lệch nửa texel
  const texel = step * tile.resM;
  return { texture: t, x0: -tile.half - texel / 2, z0: -tile.half - texel / 2, size: m * texel, minY: tile.minY };
}
