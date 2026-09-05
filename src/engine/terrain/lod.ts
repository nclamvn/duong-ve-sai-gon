/**
 * LOD terrain (TIP-D04): ô 64 m, 4 mức 2/4/8/16 m; chọn theo khoảng cách camera → tâm ô (xz) với hysteresis 8 m.
 * Thuần số học — chạy trong unit test.
 */
export const CHUNK_M = 64;
/** bước lưới (m) từng LOD */
export const LOD_RES = [2, 4, 8, 16] as const;
/** ngưỡng khoảng cách (m) chuyển LOD i → i+1 */
export const LOD_DISTANCES = [96, 192, 384] as const;
export const LOD_HYSTERESIS = 8;
/** váy (skirt) kéo xuống (m) che khe giữa LOD kề nhau */
export const SKIRT_M = 6;

/** số đỉnh mỗi cạnh của lưới LOD */
export function lodVerts(lod: number): number {
  return CHUNK_M / LOD_RES[lod]! + 1;
}

/** chọn LOD theo khoảng cách; `prev` = LOD hiện tại (−1 = chưa có) để tránh nhấp nháy ở ngưỡng */
export function chooseLod(dist: number, prev: number): number {
  let lod = 0;
  for (let i = 0; i < LOD_DISTANCES.length; i++) {
    let th = LOD_DISTANCES[i]!;
    if (prev >= 0) th += prev <= i ? LOD_HYSTERESIS : -LOD_HYSTERESIS;
    if (dist > th) lod = i + 1;
    else break;
  }
  return lod;
}
