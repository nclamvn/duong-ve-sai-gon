# Completion Report — TIP-D05: Rừng loài thật (`engine/vegetation`, Blueprint G0′ D05 + asset D12 theo DV-025)

STATUS: **PARTIAL** — sandbox xong (9 loài: 8 CC-BY + cỏ procedural, scatter seeded, batch instanced + LOD + impostor + gió + đè cỏ + collider thân; khói lửa xa), CI xanh (typecheck · unit 131/131 · build · E2E 9/9); **vòng 1 phản hồi Mac đã sửa (xem cuối)**; chờ **Chủ nhà bench Mac 3 run** (`?level=truong-son&bench=1` so `?veg=0`) + ảnh Mac WebGPU để ký **ADR-D06 GO/ADJUST** (cổng G0′ ≤ 12 ms GPU rừng).

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

---

# Vòng 1 — phản hồi Chủ nhà trên Mac WebGPU (4 lỗi giao diện, 2026-09-06)

Ảnh Mac: cây tán gần với rễ bạnh "trồi", đất trần, tay trái "để lên súng" thô, chưa có khói lửa/máy bay. Sửa trong cùng TIP-D05 (mục 1–3) và **mở việc mới cho mục 4** (khói lửa làm ngay bằng FX sẵn có; máy bay/lính dù cần asset + fact — xem SUGGESTIONS).

| # | Chủ nhà | Nguyên nhân | Sửa | Evidence |
|---|---------|-------------|-----|----------|
| 1 | "gốc cây như trồi lên mặt đất" | Rễ bạnh Tree GN rộng r ≈ 3 m (đo theo dải cao 0–1,25 m), gốc đặt đúng y = mặt đất tại tâm → trên sườn 20 % mép rễ phía dưới dốc hở 0,6 m; đầu rễ y = 0 nhưng vòm rễ cao hơn | Luật `sink: [cố định, × tan(dốc)]` mỗi loài (tree_gn [0,35, 2,0], tre [0,15, 1,2], cọ [0,1, 0,3], tầng thấp 0,03–0,05) — chôn gốc theo độ dốc tại điểm đặt (scatter.ts); collider/impostor dùng cùng y | `fix1-sandbox-tree-base-sink.jpg` (gốc trong đất, cỏ quanh) |
| 2 | "không có cỏ… cỏ cần dày, nhiều tầng cây, nhiều nhóm cây có dây leo" | D05 mới có 6 loài, tầng đất trần (đè cỏ/ground cover ghi D12) | **Cỏ procedural** `scripts/gen-grass.mjs` (texture bụi cỏ 34 lá vẽ bằng code, thẻ chéo 3 quad × 3 đoạn uốn gió, 3 biến thể × 3 LOD 16/8/2 tam giác, CC0 — manifest `source: procedural`), mật độ 22 000/ha trong 640 m quanh vùng chơi (714 k instance, LOD 14/26/42 m); **đè cỏ** (VEG-006): uniform `press` (chân người chơi, bán kính 0,9 m) trong `instancedWindPosition` — ngọn ngả ra xa + hạ xuống theo `pressM` (cỏ 1, bụi < 2,6 m 0,35, cây 0); thêm 2 loài từ nguồn đã tải: **monstera** (trầu bà lá xẻ, 4 biến thể, Tropical Pack) mọc theo trường noise của cây tán (`noiseId: tree_gn` → dây leo trong cụm cây) và **fern_grass** (POLYSCAN CC-BY, bụi dương xỉ thấp); cây tán 35 → 40/ha, noise min 0,28 (mảng rộng hơn), tre 10 → 12 bụi/ha; LOD tầng thấp lean hơn (ráy [0,5, 0,2, 0,06], fern_grass [0,6, 0,25, 0,06]); sức chứa batch = ước lượng đĩa lod[3] (không cấp phát cả rect: cỏ 714 k instance → batch ~4 k) | `fix1-sandbox-grass-low.jpg`, `fix1-sandbox-high-*.jpg`, `fix1-grass-texture.png`, `fix1-sandbox-new-species.jpg` |
| 3 | "ngón tay… bàn tay trái để lên súng rất thô và không tự nhiên" | (a) Tay đặt **bên trái** ốp lót, lòng bàn tay quay phải, ngón vắt qua mặt trên (pose kế thừa AK-74M); (b) ốp lót ở 0,44 m trước camera **ngoài tầm với** tay FP 0,498 m (vai −0,19/−0,19/+0,07 hệ camera → thiếu 6,5 cm) → cổ tay bị kéo lùi, ngón xuyên; (c) mesh găng Swat mập (D11b) | (a) rot tay trái **giải tích** từ trục local bàn tay Mixamo (+y = hướng ngón → (0,91, 0,41, 0) ngang qua ốp; +z = lòng bàn tay → lên-trái; +x trỏ→út → +z dọc nòng) = Euler (−1,571, −0,418, −1,571); pos (−0,08, −0,072, 0) để đốt gốc nằm dưới ốp; ngón co riêng tay trái `FINGER_CURL_L` (đốt 3 co mạnh 1,45 rad = đầu ngón đè mặt trên); ngón cái lưới 18 tổ hợp → curl [0,25, 0,35, 0,25] + khép [0,5, 0,5] (đốt 3 chạm mặt trái, đầu ngón đè mép trái-trên); (b) `hip.pos` z −0,28 → **−0,215**, x 0,11 → 0,085 (ốp 0,38 m trước camera, IK err 0); ADS không đổi (alignSight, ốp 0,305 m); `game.fpArms.thumbL` chỉnh runtime. Đo khớp trong hệ gripL: Index1 (1,4, −3,0) dưới ốp · Index2 (3,2, −0,2) mặt phải · Index3 (2,0, 2,9) góc phải-trên · Index4 (−0,6, 2,2) đè mặt trên · Thumb4 (−1,4, 2,5) | `fix1-sandbox-fp-hip.jpg`, `-zoom.jpg`, `-ads.jpg`; `content/weapons/ak47.json` `$comment` |
| 4 | "cần bổ sung khói lửa, máy bay… tiêm kích, trực thăng và lính dù" | Chưa có trong D05 (Blueprint: D08 set piece, D09 âm nền, G1.5 AC-130) | **Làm ngay:** `fx` cho level terrain (schema + `loadTerrainLevel` → `createAmbientFx` kế thừa HT-MB): 3 cột khói bom xa cao 300–420 m (`FxDef.height` mới; đen → xám khi lên cao, trôi theo gió) ở 500–700 m quanh tuyến, 1 đám cháy + khói xám gần tuyến (−262, 462), 1 khói xám (−40, 700); đèn lửa ≤ 4 (low 2). **Chưa làm (cần asset + fact):** máy bay — xem SUGGESTIONS | `fix1-sandbox-smoke-aerial.jpg` (3 cột khói trên tán rừng), `fix1-sandbox-fire.jpg` |

Số đo sandbox sau vòng 1 (high, `fix1-sandbox-high-stats.txt`): 9 loài, 799 k instance đặt (cỏ 714 k), 4 655 collider; nhìn thấy 10–11 k instance; rừng 1,44–1,59 M tam giác (cỏ chỉ 27 k), **draw rừng 99–117** (9 loài × biến thể × 3 LOD × material), tổng renderer 3,05–3,78 M (kể bóng), calls 202–259, CPU update 1,9–6 ms* (frame đầu sau đổi góc; ổn định ~2 ms — cỏ 714 k instance đi qua vòng ô/frame, tối ưu D12: bỏ ô ngoài lod[3] sớm). CI: typecheck · unit 131/131 · build · E2E 9/9 (`ci-fix1.txt`). Tam giác tăng ~0,3 M so trước vòng 1 (cây 40/ha, monstera, fern_grass) — **gate Mac ≤ 12 ms vẫn là số quyết định**; nếu ADJUST, cỏ có đòn bẩy riêng: 22 000 → 12 000/ha (−400 k instance, −30 % overdraw cỏ).

## SUGGESTIONS bổ sung (mục 4 — "trời" M1)
- **TIP mới "D-SKY: máy bay là thời tiết"** (đề xuất đặt sau D08 tuyến, trước D09 âm): hệ `engine/sky-traffic` — spline bay seeded, 2–4 lượt/phút (tiêm kích cặp đôi bay thấp qua thung lũng, trực thăng theo tuyến, vận tải cao), âm 3D theo Doppler (D09), bóng lướt trên tán (đổ bóng từ mesh máy bay là rẻ), khói/bụi khi bay thấp (`setWind` rừng đã có: gió mạnh lên khi trực thăng — VEG-002). Cần **Chủ nhà tải Sketchfab** (đăng nhập) — ứng viên CC-BY đã kiểm mô tả tác giả tự làm, không tag game: **UH-1B "TonyWony"** (13 k tri, "here is my helicopter i modeled and texture") + **Bell 205/UH-1 polarvoid** (2,4 k, cho xa); **F-4 Phantom II "andertan"** (62,7 k, tag vietnamwar/usnavy — cần simplify ≤ 15 k + LOD) + **"ETAN798"** (8,3 k stylized, cho xa); **A-1 Skyraider "Rhine_Lab_Muelsyse"** (58 k, cần simplify); **C-130 "Tyler_Dave"** (25,5 k); **CH-47 "Artjomka81"** (29,5 k — chưa có mô tả, kiểm trước khi tải). Mi-24 sẵn có của HT-MB **không dùng** (Mi-24 không có ở chiến trường 1971).
- **Lính dù — cần cố vấn trước khi làm:** năm 1971 không có nhảy dù ồ ạt xuống Trường Sơn; Sư đoàn Dù VNCH trong Lam Sơn 719 (2–3/1971, Đường 9 – Nam Lào) đổ bộ **bằng trực thăng**; biệt kích/thám báo (SOG) cũng đổ bằng trực thăng. Đề xuất thay bằng: (a) đổ quân trực thăng UH-1 lên bãi trống xa (đúng sử), (b) một chiếc dù đơn của phi công nhảy khỏi máy bay trúng đạn (có thật, gắn set piece bắn máy bay của D08/G1.5). Ghi registry `evt.1971.lam_son_719` tier P (nguồn: Lam Son 719 — Nguyen Duy Hinh, Indochina Monographs 1979).
- Khói lửa gần tuyến (xác xe cháy trên đường 20, hố bom còn khói) cần prop xác xe (Ural/BTR có sẵn HT-MB nhưng là xe Liên Xô — hợp với đoàn xe Trường Sơn bị đánh, đúng phe) → D08 đặt cùng tuyến.

---

# Vòng 2 — "triển khai hoàn tất các mục còn thiếu" (2026-09-06)

| Mục | Trạng thái | Chi tiết | Evidence |
|-----|-----------|----------|----------|
| Máy bay (tiêm kích, trực thăng, vận tải) | **Engine xong, chờ asset** | `engine/sky` (TIP-D-SKY): lịch bay seeded 6 lượt (F-4 cặp thấp 180–320 m, F-4 trúng đạn 350–520 m → dù, UH-1 cặp 70–120 m, UH-1 treo đổ quân 25 s tại (−560, 240), A-1 tuần tiễu, C-130 cao); cao độ = max địa hình dọc đường + AGL; đội hình so le; rotor quay; bóng CSM; **gió xoáy trực thăng lay rừng** (hook → `forest.setWind`); **âm 3D procedural có Doppler** (`AudioEngine.aircraft`: rotor 10,8 Hz/jet/prop); `?sky=0/1`, `?skyModel=`. Model `air_*` chưa có: Chrome của Chủ nhà **chưa đăng nhập Sketchfab** (tab UH-1B đang mở) → E2E/ảnh dùng stand-in Mi-24 (`?skyModel=veh_mi24`, không vào level) | `sky-pairs-standin.jpg`, `sky-hover-standin-mi24.jpg`, E2E "bầu trời" (`ci-fix2.txt`) |
| Lính dù | **Làm dạng đúng sử: dù phi công + đổ quân trực thăng** | Dù procedural (vòm 24 múi, dây, người treo), rơi 4,5–5,7 m/s trôi gió, thả ≥ 400 m sau khi F-4 "trúng đạn" bay qua; UH-1 treo 4 m ở bãi 25 s (đổ thám báo). Không làm nhảy dù ồ ạt (1971 không có) — chờ cố vấn registry `evt.1971.lam_son_719` | `sky-parachute-close.jpg` |
| Bot đi xuyên cây (ghi nợ D08) | **Xong** | navmesh bake `--level` với obstacle thân (1 366 lăng trụ, 4 554 poly, nav.bin 741 KB) + runtime bake cùng lăng trụ; 2 bài học recast ghi DV-040 (nắp 1,2 m, mặt navmesh 4 m); `density` tier = tập con → nav đúng mọi tier; E2E: 60 thân trong navRect không có điểm navmesh | `ci-fix2.txt` |
| Bàn tay thật (D11b) | **Chưa** | cần mesh tay CC0 + retarget skin về skeleton Mixamo (ước 12–16 h) — ngoài phạm vi vòng này | — |

CI vòng 2: typecheck · unit 132/132 · build · E2E 10/10.

## Việc còn lại cho Chủ nhà
1. **Đăng nhập Sketchfab trong Chrome** (tab đang mở) → em tải 5 model, convert (`convert-model.mjs --no-join`, KTX2), đặt vào level, chụp ảnh, sync tiếp.
2. Push + bench (như vòng 1): `git push origin master`; `…&level=truong-son&weapon=ak47&bench=1` ×3 và `&veg=0` ×3.
3. Cố vấn: sự kiện 1971 (Lam Sơn 719, không kích tuyến 20) — dù/đổ quân; chủng loại máy bay (F-4 USAF hay USN, UH-1B/D, A-1H).

# Vòng 3 — asset máy bay thật ("tôi đã đăng nhập rồi", 2026-09-06)

| Mục | Trạng thái | Chi tiết | Evidence |
|-----|-----------|----------|----------|
| Tải Sketchfab | **Xong (qua Browser pane đã đăng nhập, không nhập mật khẩu)** | `fetch('/i/models/<uid>/download')` → `fetch('/i/archives/latest?archiveType=glb…', {credentials:'include'})` → URL S3 ký → curl về `assets-src/sketchfab/` (gitignore). Kiểm nguồn trước khi dùng: **loại** F-4 andertan (texture `Eurofighter_RT`/`F15_R` ghép), A-1 Rhine_Lab (node `AH-1J_node…`), 42manako F-4E ("Model by PAV"), manilov.ap (hàng loạt máy bay mô tả Wikipedia, nguồn không rõ), thomas333 B-52 (bản chỉnh từ bohmerang), C-130 Tyler_Dave (không có archive); ETAN798 F-4 sạch nhưng pose nghiêng + bom rơi cùng mesh | DV-042 |
| Model dùng | **4 model CC-BY, manifest + CREDITS** | `air_uh1b` TonyWony 13 062 tri 2,71 MB (9 KTX2 1024); `air_f4` luacha2000 1 562 tri 0,09 MB (sơn SEA tan/xanh, sao USAF); `air_b52` bohmerang 14 392 tri 0,53 MB (simplify 0,85 cho ngân sách air_ 15 k); `air_c130` helijah (FlightGear) 12 698 tri 0,32 MB (giữ 12 node vỏ ngoài + cánh quạt, bỏ buồng lái/pháo, simplify 0,28, 3 draw). Validator 90 asset 0 lỗi 0 cảnh báo | `sky-air-models-sheet.jpg`, `sky-air-c130-sheet.jpg`, `CREDITS.md` |
| convert-model | **`--pre`, `--split-joints`** | Cả 3 model mũi ở −x → `--flip`; B-52/C-130 sải cánh > dài → `--yaw90`; `--pre x:90` (xoay trước khi căn trục, dùng khi model nằm nghiêng); **`--split-joints rotor_01,tail_rotor_02:z`**: tam giác thuộc joint (trọng số lớn nhất, 3 đỉnh) → primitive riêng dưới node pivot tại gốc joint (trục z bọc node khung `frame_*`) → rotor chính + đuôi UH-1 quay thật lúc chạy (spin regex `rotor|blade|prop`), skin bỏ, cây joint rỗng dọn | `sky-air-uh1b-rotor-spin-sheet.jpg` (xoay 1,2 rad: cánh vẫn trên trục) |
| Level | **6 lượt bay model thật** | F-4 cặp 180–320 m, F-4 trúng đạn → dù, UH-1 cặp 70–120 m, UH-1 treo 25 s, C-130 700–1 000 m, **tổ 3 B-52 1 500–1 900 m** (thực tế ~9 km — nén để còn thấy, cố vấn duyệt); **A-1 tạm bỏ** (chưa có model sạch). Điểm treo dời (−560, 240) → **(−624, 480)**: điểm cũ nằm trong tán cây (Huey treo 4 m AGL không nhìn thấy, `sky-hover-*`); `scripts/find-clearing.mjs` chạy scatter seeded tìm bãi trống tự nhiên (không cây thân trong 28 m, dốc 14°) | `sky-f4-pair.jpg`, `sky-huey-pair.jpg`, `sky-hover-clearing.jpg`, `sky-hover-close-veg0.jpg`, `sky-parachute-f4hit.jpg`, `sky-c130-high.jpg`, `sky-b52-cell.jpg` |
| E2E | **model thật, bỏ stand-in** | `level-truong-son` "bầu trời": 6 lượt, AGL > 30 m, treo (−624, 480) 2–8 m, gust → gió rừng, **rotor_01 quay** (> 0,05 rad/frame), dù ≥ 1; không lỗi console. CI: typecheck · unit 132/132 · build · E2E 10/10 | `ci-sky2.txt` |

Ảnh sandbox là WebGL2 SwiftShader (mờ, không post) — Mac WebGPU của Chủ nhà mới là ảnh chấm.

## Việc còn lại cho Chủ nhà (cập nhật)
1. `git push origin master` (13 commit) · bench như vòng 1.
2. Mac `?autostart=1&level=truong-son&weapon=ak47`: chờ ~1 phút thấy UH-1 cặp (20 s), F-4 cặp (40 s), UH-1 treo ở bãi trống (−624, 480) ~150 s, dù sau F-4 ~250 s, C-130 ~300 s, B-52 ~320 s (tua nhanh: `__ht.skyAdvance(300)` trong console với `?debug=1`) → chụp ảnh gửi em.
3. Cố vấn: chủng loại/độ cao B-52 (Arc Light tuyến 20, 1971) và C-130; A-1 khi có model sạch; registry `evt.1971.lam_son_719`.

