# Completion Report — TIP-D05: Rừng loài thật (`engine/vegetation`, Blueprint G0′ D05 + asset D12 theo DV-025)

STATUS: **PARTIAL** — sandbox xong (6 loài CC-BY, scatter seeded, batch instanced + LOD + impostor + gió + collider thân), CI xanh (typecheck · unit 130/130 · build · E2E 9/9); chờ **Chủ nhà bench Mac 3 run** (`?level=truong-son&bench=1` so `?veg=0`) + ảnh Mac WebGPU để ký **ADR-D06 GO/ADJUST** (cổng G0′ ≤ 12 ms GPU rừng).

Link kiểm trên Mac (như đã hứa: "khi có rừng, cùng link này sẽ hiện"): `http://127.0.0.1:5173/?autostart=1&level=truong-son&weapon=ak47`

## FILES CHANGED
Tạo mới
- `src/engine/vegetation/scatter.ts` — lưới jitter seeded (6 số PRNG/điểm), mặt nạ dốc/cao/fBm noise, bụi, rect riêng, gom ô 64 m (thuần Node).
- `src/engine/vegetation/species.ts` — nạp GLB loài (`v<i>_lod<k>`), **nướng ma trận node** vào POSITION (quantize KHR), bbox/chiều cao thật, bảng material (map, leaf, alphaTest).
- `src/engine/vegetation/material.ts` — TSL: `instancedWindPosition` (yaw/scale/uốn thân h²/rung lá theo `_WIND`, uniform `dir`/`strength`), `createVegetationMaterial` (normal xoay + `negateOnBackSide`, tint ±18 % ngả vàng/xanh, lá alphaTest hai mặt + emissive 6 %, thân FrontSide; 6 binding).
- `src/engine/vegetation/system.ts` — `VegetationSystem`: batch (loài × biến thể × LOD × material) `InstancedBufferGeometry` + `iPosScale`/`iRotTint`; mỗi frame LOD theo ô (hysteresis 6 m, chỉ đổi một bậc) / từng cây ở ô vắt ngưỡng (jitter ±3 m), frustum-cull AABB ô, chép instance (`updateRange`); bóng LOD0/1 loài `cast`; impostor lod[2]→lod[3]; collider cylinder thân; `stats`, `setWind`, `placedPerSpecies`, `dispose`.
- `src/engine/vegetation/impostor.ts` — bake atlas 8 phương vị × biến thể (RenderTarget RGBA8, ô 256 px, ortho nghiêng 15°, unlit, alphaTest 0,2, `rt.viewport/scissor`); batch billboard TSL (chọn ô theo `atan` trong hệ cây, AO dọc, normal lên + về camera, đung đưa theo gió).
- `src/engine/vegetation/forest.ts` — `buildForest` (nạp song song 6 GLB, bake impostor, dựng system), `VEG_QUALITY` tier low/medium/high (0,5/0,6/off · 0,75/0,85/on · 1/1/on).
- `scripts/convert-vegetation.mjs` — Sketchfab GLB → GLB loài: gom prim theo regex node (biến thể, composite parts), lớp lá/thân, chuẩn hoá gốc/tâm/chiều cao, 3 LOD (tỉa thẻ lá seeded phóng ≤ 2,2 / meshopt simplify vào accessor mới), `_WIND`, material `leaf_*/bark_*` (MASK 0,5, hai mặt), texture WebP (lá 1024, thân 512), quantize (POSITION/NORMAL/TEXCOORD_0), manifest `veg_*` (CC-BY-4.0, attribution, sourceFiles, triangles). `--only`, `--dry`.
- `content/vegetation/species.json` — 6 loài + attribution Sketchfab (uid/name/author/url/faces): tree_gn (Node_λrt), bamboo ×3 (JonhGillessen), banana (DJMiddi), fern ×4 + palm ×3 (MozzarellaARC), elephant_ear ×2 (BANDANNA).
- `public/assets/vegetation/{tree_gn,bamboo,banana,fern,elephant_ear,palm}.glb` — 3,7 MB KTX2; tam giác/biến thể LOD0/1/2: tree 21 003/5 425/2 251 · bamboo 4 673/2 083/809 · banana 3 332/1 245/1 284 · fern 1 495/538/200 · elephant_ear 3 274/1 323/627 · palm 4 080/1 841/831.
- `tests/unit/vegetation.test.ts` (7): deterministic theo seed; mật độ ≈ perHa trên ô phẳng; mặt nạ dốc/cao; noise + fBm [0,1] mượt; ô liền/offset/AABB; bụi tre + biến thể; level JSON hợp schema + manifest CC-BY có attribution + GLB tồn tại.
- `tests/e2e/level-truong-son.spec.ts` + test "rừng": 6 loài, > 10 k instance, > 1 000 collider, atlas cây; 4 hướng: draw rừng 10–90, tam giác rừng ≤ 1,5 M, tổng ≤ 4 M, calls ≤ 220 (đo mỗi tick rAF); impostor > 20; CPU < 8 ms; đi thẳng vào thân cây 4 s: khoảng cách tới trục ≥ r + capsule − 5 cm, vẫn trên đất; `setWind`; không lỗi console.
- `docs/ADR/ADR-D06-rung.md` (đề xuất, cổng GO/ADJUST + đòn bẩy), `docs/tips/TIP-D05.md`, `contracts/TIP-D05.yaml`, `evidence/TIP-D05/*`.

Sửa
- `content/levels/truong-son-a.level.json` — khối `vegetation` (seed 1971, cell 64, gió 0,35, rect 1 024 m quanh navRect; tree 35/ha noise 0,3 lod 32/100/170/600 cast collider 0,45×6 · palm 12/ha lod 35/90/150/450 collider 0,2×3 · bamboo 10 bụi/ha × 2–4 lod 35/90/200/400 collider 0,35×4 · banana 60/ha thấp (height ≤ 0,6) lod 30/70/130 · elephant_ear 250/ha lod 18/40/90 · fern 900/ha lod 12/28/70; tầng thấp rect 832 m). `content/schemas/terrain-level.schema.json` (+`vegetation`, `rect`).
- `src/engine/terrain/level.ts` (`TerrainLevelDef.vegetation?`), `src/engine/terrain/tile.ts` (min/max từ float32 — DV-035).
- `src/game/game.ts` — `forest` sau `loadTerrainLevel`: tier + `?veg/vegDensity/vegLod/vegShadow/impostor`, group vào `terrain.root`, collider thân vào `arena.colliders` (→ `physics.addStatic`), `forest.system.update(camera)` mỗi frame trước post.
- `src/qa/debugApi.ts` — `vegetationStats()`, `setWind()`, `spawnModel(id có '/', keep regex)`.
- `scripts/ktx2.mjs` (+thư mục `vegetation`), `scripts/validate-assets.mjs` (`veg_` 8 k → 22 k LOD0 cây tán), `content/assets/manifest.json` (83 asset, 124,3 MB; URL Sketchfab slug đúng), `CREDITS.md` (sinh lại), `README.md` (pipeline + tham số + credits), `docs/DECISIONS.md` DV-032…036, `.gitignore` (`out/`).

## TEST RESULTS (theo AC)
| AC | Kết quả |
|----|---------|
| Mac: link truong-son hiện rừng 6 loài, gió, impostor xa, không lỗi console; không xuyên thân cây | **CHỜ Chủ nhà** — sandbox WebGL2 đạt (ảnh `sandbox-high-*.png`; E2E collider thân PASS) |
| Sandbox high: tam giác rừng ≤ 1,5 M, draw rừng ≤ 90, tổng ≤ 4 M; cùng seed → cùng rừng; validate 0 lỗi; unit + CI xanh | **PASS** — high: rừng 1,08–1,25 M tam giác, 62–78 draw, tổng renderer 2,33–3,05 M (kể bóng), calls 140–204, CPU update 0,5–0,7 ms (`sandbox-high-stats.txt`); low: 0,49 M / 53 draw / tổng 0,57 M. Unit 130/130, E2E 9/9 (`ci.txt`), `assets:validate` 83 asset 0 lỗi 0 cảnh báo |
| Bench Mac 3 run so `?veg=0`: GPU rừng ≤ 12 ms → ADR-D06 GO | **CHỜ Chủ nhà** — `npm run dev` → `http://127.0.0.1:5173/?autostart=1&level=truong-son&weapon=ak47&bench=1` (3 run) rồi cùng URL + `&veg=0`; file bench vào `evidence/TIP-D05/mac-bench-*.json` |

Số đặt (ô A, high): 50 450 instance (tree 2 360 · palm 521 · bamboo 1 250 · banana 670 · elephant_ear 8 922 · fern 36 727), 4 131 collider; nạp 6 GLB 0,13–0,4 s, bake impostor 0,1–0,16 s.

## ISSUES
- (Cao, cổng) **Chưa có số GPU thật** — sandbox chỉ đếm tam giác/draw; chi phí thật của lá hai mặt alphaTest là overdraw. Đòn bẩy ADJUST đã xếp thứ tự trong ADR-D06 (bóng LOD0/cascade gần → impostor 130 m → atlas 1 material/loài → LOD0 tầng thấp → mật độ 0,8).
- (Trung bình, D12) Draw rừng 62–78 > PRD ≤ 40 (mỗi loài 2–3 material × 3 LOD × biến thể); cần atlas texture mỗi loài (1 material/loài → ~30 draw).
- (Trung bình, D12) Chỉ **1 biến thể cây tán** (Tree GN) → lặp hình ở LOD1/2 + impostor; tầng đất trần (chưa cỏ/lá mục/dây leo rủ); chưa "đè cỏ" (VEG-006) vì chưa có cỏ; subsurface chỉ là emissive 6 % (VEG-003).
- (Trung bình, D08) Navmesh không biết thân cây → **bot đi xuyên cây**; người chơi thì bị chặn (collider). D08 bake lại navmesh với obstacle cylinder (recast `addCylinderObstacle` hoặc rasterize trụ).
- (Thấp) LOD/impostor đổi "nhảy" (không crossfade); ranh impostor thấy ở ~100 m tier low / 170 m high; impostor 8 hướng "xoay nhảy" ở ranh 22,5°. Octahedral + dither crossfade → D12 nếu Chủ nhà thấy.
- (Thấp) Tán LOD1/LOD2 thưa hơn LOD0 dù đã phóng thẻ (độ phủ ~1,0/0,73); cây 60–170 m đọc "thưa lá" khi ngược sáng.
- (Thấp) Bóng: LOD0+1 cây tán/cọ/tre × 3 cascade ≈ 1–1,8 M tam giác (không cull theo cascade — batch không có bounding riêng); nếu Mac chậm, đòn bẩy (1).
- (Ghi nhận) Cây đặt cả trên tuyến đi/waypoint (chưa có mặt nạ tuyến §20.2) — D08 thêm luật `mask`/spline loại cây khỏi lối mòn và dọn spawn.
- (Ghi nhận) Sketchfab "Tropical Plants Pack M02P" dùng chung cho fern + palm (một attribution, hai asset id) — validator/credits chấp nhận (lặp dòng credit).

## DEVIATIONS
1. Đè cỏ (VEG-006 phần "đè") **bỏ khỏi D05** (Blueprint ghi "đè cỏ"): chưa có lớp cỏ (ground cover) — Chủ nhà đặt ưu tiên loài thật (DV-025); ghi D12. L2 → Chủ thầu ghi nhận trong ADR-D06.
2. Impostor **8 hướng trụ** thay vì octahedral (PRD VEG-001): đủ cho cây tán nhìn ngang (camera FPS, chênh cao độ < 30°); octahedral để D12. L1.
3. `TerrainTile.minY/maxY` sửa cách tính (float32) — ngoài scope terrain nhưng cần cho mặt nạ cao độ; kiểm unit terrain 9/9 không đổi. L1 (DV-035).
4. Ngân sách validator `veg_` 8 k → 22 k: LOD0 cây tán 21 k chỉ hiện < 32 m; không phải nới để "đạt" (LOD1/2 2–5 k, impostor 2 tam giác). L1 (DV-034).
5. Vegetation bật mặc định ở `?level=truong-son` khi có model (assets); lite/CI cần `?veg=1` để E2E vật lý D04 giữ thời gian chạy. L1.

## SUGGESTIONS (cho Chủ thầu)
- Chủ nhà bench Mac trước khi đụng thêm: nếu GPU rừng ≤ 8 ms thì D12 có dư địa cho ground cover + cỏ; nếu 8–12 ms thì D12 phải lấy lại từ đòn bẩy (1)(3) trước khi thêm loài.
- D08: navmesh obstacle cây + mặt nạ tuyến (spline loại cây khỏi lối mòn 3 m, khoảng sáng theo §20.2) + dọn bán kính spawn 6 m.
- D12: thêm 1–2 loài tán (Dipterocarp/chò), dây leo rủ, ground cover (cỏ tranh cards + lá mục decal) + đè cỏ (uniform ≤ 8 tác nhân), atlas 1 material/loài, octahedral impostor, dither crossfade LOD; hỏi cố vấn thực vật (Musa acuminata/Alocasia/tre có đúng vùng Quảng Bình–Khe Sanh 1971).
- Sau bench: ghi `mac-bench-*.json` vào evidence, Chủ thầu ký ADR-D06 (GO/ADJUST) và cập nhật STATUS G0′.
