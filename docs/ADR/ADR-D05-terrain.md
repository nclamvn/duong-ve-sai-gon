# ADR-D05: `engine/terrain` — ô DEM thật, LOD instanced, splat theo quy tắc, heightfield Rapier, navmesh bake

- Trạng thái: **Chấp nhận** (2026-09-05, TIP-D04) — PRD DVSG TER-001/002/003, PRF-002 (streaming: chưa, xem Hệ quả).

## Bối cảnh
M1 "Cổng Trời" cần ≥ 2 km² địa hình Trường Sơn thật (PRD §5: 0,3–1,5 km² chơi được + chân trời) trên engine HT-MB vốn chỉ có mặt phẳng 120–200 m. Ngân sách: draw ≤ 400/650, tris ≤ 2,5/4 M, GPU ≤ 10,5 ms trên M1 Max; rừng (D05) sẽ chiếm phần lớn ngân sách → terrain phải rẻ: vài draw, < 100 k tam giác ở góc nhìn thường.

## Quyết định
1. **Nguồn cao độ:** SRTM 1″ (NASA/USGS, public domain) qua Terrain Tiles on AWS (`skadi/<lat>/<tile>.hgt.gz`), license `PD-USGov` trong manifest (DV-016). `scripts/terrain-bake.mjs` nội suy song tuyến từ lưới 30 m sang 2 m + fBm seeded 1,5 m (ghi rõ "procedural, không phải đo đạc" trong `meta.json`). Ô = `height.r16` (u16 LE, hàng 0 = bắc, cột 0 = tây) + `meta.json` + `preview.png` (+ `nav.bin`).
2. **Trục & cao độ engine:** +x đông, −z bắc; `y = zMin + u16/65535·(zMax − zMin) − yOffset` (`yOffset` trong level JSON đưa spawn ≈ 0). Mọi mã theo `meta.json` — không hard-code ô.
3. **Render:** ô 64 m × 4 LOD (2/4/8/16 m); mỗi LOD một `Mesh` + `InstancedBufferGeometry` (attribute `chunkOffset`), cao độ lấy trong vertex shader từ `DataTexture` RGBA8 (R,G = u16; nearest; đỉnh trùng texel) → **≤ 4 draw** cho 2 km; váy 6 m che khe LOD; LOD theo khoảng cách (96/192/384 m, hysteresis 8 m) + frustum cull AABB ô ở CPU. Normal per-pixel từ texture normal RGBA8 (linear). `castShadow` false, `receiveShadow` true (CSM).
4. **Vật liệu (TSL only):** splat 4 lớp theo quy tắc slope/height/noise (mùn lá · đất ướt · đá triplanar · cỏ tranh), tint từng lớp kéo texture Poly Haven ôn đới về tông nhiệt đới/đất đỏ, phá lặp hai tỉ lệ, wetness uniform. Splat map tác giả và đường mòn spline: D08.
5. **Physics:** một `heightfield` Rapier cho cả ô (2 m, 1025², column-major — hướng hàng/cột kiểm bằng unit test raycast); `SurfaceMaterial` thêm `earth`. Người chơi/bot dùng collider này, không dùng mesh render.
6. **Navmesh:** bake offline (`terrain-bake.mjs --nav`, recast solo, lưới 4 m trong `navRect`, cs 0,5 / ch 0,25) → `nav.bin` (`exportNavMesh`), runtime `NavService.fromExport`; thiếu/không hợp lệ (vite trả HTML) → bake runtime từ lưới 4 m (fallback, log). Tham số đi/leo/dốc (0,4 m / 0,35 m / 50°) dùng chung với `DEFAULT_NAV`.
7. **Level:** `content/levels/<id>.level.json` schema `terrain-level.schema.json` (spawn/waypoint/zone theo x/z, y lấy từ terrain) → `ArenaData` (nguồn collider duy nhất, như level đô thị). `?level=truong-son`. Camera `far` theo level (2 600 m).

## Hệ quả
- Chưa streaming ô (PRF-002) và chưa quadtree/morph (CDLOD): 1024 ô CPU-cull mỗi frame (~0,1 ms), chuyển LOD "nhảy" nhẹ ở 96 m — chấp nhận ở G0′; D08 quyết streaming 4 ô theo tuyến.
- Texture cao độ RGBA8 8,4 MB GPU (2 texture 1025²) thay vì r16/float (WebGL2/WebGPU không lọc r16unorm thống nhất). 16-bit → bước 5,6 mm với dải 370 m — đủ.
- Chi tiết < 30 m là procedural: lối mòn, hố bom, bờ suối phải được **tác giả** (D08/D12), không suy ra từ DEM.
- SwiftShader (CI) render terrain 2 km chậm (~1–2 s/frame) → E2E dùng `assets=0`, viewport nhỏ; số hiệu năng thật trên Mac (D05).
