# Completion Report — TIP-D04: Terrain prototype `engine/terrain` (G0′)

STATUS: **DONE** (Mac WebGPU xác nhận sau 3 sửa — xem Bổ sung; deferred dưới)

## FILES CHANGED
Tạo mới
- `src/engine/terrain/tile.ts` — `TerrainTile`: nạp `height.r16` + `meta.json`, cao độ engine (−yOffset), `sample` song tuyến, `normalAt`, `minMax` ô, texture cao độ/normal RGBA8, `gridMesh` (nav/debug). Không DOM — chạy trong Node.
- `src/engine/terrain/lod.ts` — hằng LOD (ô 64 m; 2/4/8/16 m; ngưỡng 96/192/384 m; hysteresis 8 m; váy 6 m), `chooseLod`.
- `src/engine/terrain/mesh.ts` — `makeChunkGeometry` (lưới + váy 4 cạnh, attribute `skirt`, normal phẳng), `TerrainMesh`: 4 `Mesh` × `InstancedBufferGeometry` (`chunkOffset`), chọn LOD + frustum cull AABB ô mỗi frame, `stats`.
- `src/engine/terrain/material.ts` — TSL: vertex lấy cao độ từ texture (nearest, level 0) + váy; fragment splat 4 lớp theo slope/height/noise, tint lớp (`DEFAULT_LAYER_TINT`), phá lặp 2 tỉ lệ, đá triplanar, normal per-pixel từ texture + detail; `receivedShadowPositionNode` bias theo normal thật; lite (không texture) = màu theo slope.
- `src/engine/terrain/level.ts` — `loadTerrainLevel(def)` → `ArenaData` (1 collider heightfield `earth`, navGeometry lưới 4 m trong navRect, `nav.bin` bake sẵn có kiểm content-type, spawn/waypoint/zone y từ terrain, `heightAt`).
- `src/engine/terrain/index.ts`; `content/levels/truong-son-a.level.json` + `content/schemas/terrain-level.schema.json`; `tests/unit/terrain.test.ts` (9 test); `tests/e2e/level-truong-son.spec.ts`; `docs/ADR/ADR-D05-terrain.md`; `docs/tips/TIP-D04.md`; `contracts/TIP-D04.yaml`; `evidence/TIP-D04/*`; `public/assets/terrain/truong-son-a/nav.bin`; 4 bộ texture CC0 Poly Haven KTX2 (`brown_mud_leaves_01`, `brown_mud_03`, `aerial_rocks_02`, `aerial_grass_rock`).

Sửa
- `src/engine/physics/world.ts` — `StaticShape.kind` +`heightfield` (`heights`, `n`; chuyển row-major → column-major Rapier), `SurfaceMaterial` +`earth`.
- `src/engine/render/arena.ts` — `ColliderKind` +`heightfield`, `ColliderDef` +`heights/n`, material +`earth`.
- `src/engine/nav/navmesh.ts` — `NavService.fromExport(data)` / `export()` (importNavMesh/exportNavMesh), ctor overload nhận `NavMesh`.
- `src/game/game.ts` — `levelId` +`'truong-son'` (`?level=truong-son`), `terrain` field, camera near/far theo level, `createDaylight` dùng chung skyDef, nav bake sẵn (fallback runtime nếu 0 poly), `terrain.mesh.update(camera)` mỗi frame, collider heightfield qua `addStatic`.
- `src/qa/debugApi.ts` — `terrainHeight(x,z)`, `terrainStats()`.
- `src/engine/render/post.ts` — GTAO mờ dần 30 → 70 m (`AO_FADE_START/END`) + sàn SSR chỉ cho roughness < ~0,5 — xem DEVIATIONS 2, DV-022/024.
- `scripts/terrain-bake.mjs` — chế độ `--nav` (bake recast → `nav.bin` + manifest); `scripts/fetch-assets.mjs` — giữ entry đã có, `--force id` (DV-019); `content/assets/manifest.json` (+4 texture, +nav.bin; 76 asset, 120,3 MB); `README.md`; `docs/DECISIONS.md` (DV-018..DV-022).

## TEST RESULTS (theo AC)
| AC | Kết quả |
|----|---------|
| Probe `?level=truong-son`: terrain ≤ 4 draw, tổng ≤ 120, tris ≤ 1,2 M ở 3 góc; 0 lỗi console; không khe LOD | **PASS** (WebGL2 sandbox; WebGPU Mac PASS sau sửa binding — xem Bổ sung) — terrain 4/4/4 draw; tổng 81/81/41; tris 0,35/0,32/0,24 M (terrain 64k/38k/39k); 0 error (2 warning có sẵn/SwiftShader); `wire-lod.png` không khe (`stats.txt`) |
| Unit: heightfield raycast ≤ 0,15 m (50/50); nav bake polyCount > 0 + findPath | **PASS** — 50/50 (mặt nghiêng tổng hợp ≤ 0,02 m: xác nhận column-major hàng z/cột x); nav 64 m: poly > 0, path > 1 điểm; 9/9 test `terrain.test.ts` |
| E2E `level-truong-son` (webgl-ci): đứng/đi/dốc không xuyên; dốc quá maxSlope không leo | **PASS** 22,7 s — đứng 3 s gap ≤ 0,3; đi lên dốc thoải 8 s tiến ≥ 15 m, minGap > −0,3; dốc > 58° trong 300 m quanh spawn: leo < 2,5 m; nav 1732 poly; terrain 4 draw; bot_a có mặt |
| `assets:validate` 0 lỗi (4 texture CC0 KTX2 + nav.bin); `npm run ci` xanh | **PASS** — 76 asset 120,3 MB 0 lỗi; CI: typecheck OK, unit 115/115, build, e2e 8/8 (`ci.txt`) |

## BỔ SUNG SAU KIỂM TRÊN MAC (WebGPU, 022d365 → 3 sửa)
- **Mac chỉ thấy trời, không thấy đất** (Chủ nhà báo): chẩn đoán qua Chrome của Chủ nhà (extension) — `renderer.debug.getShaderAsync` cho thấy fragment shader terrain có 15 `texture_2d` + 3 depth CSM = 18 sampled texture, 17 sampler; `device.limits` = 16/16 → pipeline WebGPU thất bại **im lặng** (draw được đếm, console không lỗi; tắt `roughnessNode`/`aoNode` (bỏ 4 texture ARM) thì hiện). Sandbox WebGL2 (giới hạn 32) không bắt được. Sửa `material.ts`: đất dùng normal mùn, cỏ dùng normal+arm mùn, đá arm hằng → 11 + 3 = 14 texture, 13 sampler → **hiện đúng trên Mac** (`mac-webgpu-spawn.jpg`, 58 fps / p95 17,5 ms ở 1920 px, post high). Luật DV-023.
- Sau khi hiện: vệt/ô SSR trên sườn (post high) → sàn SSR chỉ cho roughness < ~0,5 (DV-024); vạch GTAO từ ~50 m → AO fade 30→70 m. Xác nhận trên Mac: `post=low` sạch, `post=medium` có vạch trước sửa, sau sửa sạch ở góc spawn.
- Chưa có ảnh Mac cho góc ridge/valley — Chủ nhà đi thử; số fps 1920 px: **58 fps, p95 17,5 ms** (baseline trước rừng, post high + SSR + AO).

## ISSUES
- (Thấp, deferred) GTAO nửa phân giải trên mặt terrain xa tạo ô/vạch (đã xác định bằng thí nghiệm `post=low` sạch / `shadow=0` vẫn vạch): đã mờ AO từ 60 → 140 m; còn vạch mờ ở góc nhìn xiên trong 140 m (`valley.png` phía dưới). Mac full-res sẽ khác — D05 đo lại; nếu còn, hạ `radius` hoặc AO theo normal MRT của terrain.
- (Thấp, deferred) Nhìn từ xa terrain "đồi cỏ" chứ chưa "rừng": đúng kỳ vọng D04 (rừng là D05); tint lớp đã kéo về tông đất đỏ/mùn, còn HDRI trời quang `kloofendal` (CC0 duy nhất hiện có) — M1 cần HDRI âm u/mưa (D12 ART01b).
- (Ghi nhận) Chuyển LOD "nhảy" ở 96 m không morph; với rừng che phủ sẽ khó thấy; CDLOD/streaming để D08 quyết (ADR-D05 Hệ quả).
- (Ghi nhận) SwiftShader: boot terrain medium ≈ 60–90 s, mỗi frame ≈ 1–2 s → E2E dùng `assets=0` + low.

## DEVIATIONS
1. **Camera near 0,05 → 0,25 riêng level terrain** (`camera.near` trong level JSON; arena/pho giữ 0,05): depth 24-bit tới far 2,6 km. Không đổi contract; viewmodel ở scene riêng (near 0,03) nên tay/súng không bị cắt.
2. **`post.ts` ngoài scope:** fade GTAO theo khoảng cách (cuối cùng 30 → 70 m) và sàn SSR gated theo roughness. L1: không đổi API/contract; ảnh hưởng mọi level: mất AO ở > 30 m và mất sàn SSR trên mặt nhám — ghi DV-022/024; Chủ nhà kiểm cảm nhận pho trên Mac. Chủ thầu có thể yêu cầu đo lại pho trên Mac để chắc không đổi cảm nhận.
3. `fetch-assets.mjs` sửa để không ghi đè `.ktx2` (DV-019) — cần thiết để tải 4 texture mới mà không phá KTX2 của D02.
4. Texture JPG nguồn Poly Haven không còn trong `assets-src/` (fetch ghi thẳng `public/`, ktx2 xoá) — tải lại được bằng `--force id`; ghi README. Không lưu bản JPG để tránh 2 bản.
5. Chưa bake normal map riêng cho ô (normal tính CPU lúc nạp ~40 ms cho 1025²) — đủ nhanh, để D08 xem có cần đưa vào pipeline bake khi nhiều ô.

## SUGGESTIONS (cho Chủ thầu)
- **D05 (rừng):** `TerrainTile.sample/normalAt` + `gridMesh` đủ cho scatter theo slope/height (mask: không cây trên đá > 38°, mật độ theo hN); `chunkOffset`/ô 64 m dùng chung làm cell vegetation; bench Mac 3 góc này (spawn/ridge/valley) + góc nhìn xuống thung lũng làm chuẩn so sánh trước/sau rừng.
- **D08:** splat map tác giả (RGBA 512² per ô) + đường mòn spline "đè" lớp mud và hạ cỏ; hố bom = decal cao độ (sửa `heights` trước khi tạo texture/heightfield); streaming 4 ô theo tuyến; morph LOD nếu playtest thấy "nhảy".
- Ô chính thức: nếu Chủ nhà chốt toạ độ khác, chỉ cần chạy lại `terrain-bake` (+`--nav`) và sửa `truong-son-a.level.json` (yOffset, navRect, spawn) — engine không hard-code.
- Mac: chạy `?level=truong-son&autostart=1` WebGPU: kiểm màu lớp (mùn nâu sẫm, đất đỏ nâu, đá xám, cỏ vàng xanh), không khe LOD khi di chuyển, F4 xem navmesh; ghi fps/p95 ở 1920 px cho D05.
