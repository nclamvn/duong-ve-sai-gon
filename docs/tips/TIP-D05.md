# TIP-D05: Rừng loài thật — `engine/vegetation` (Blueprint G0′ D05 + phần asset của D12, DV-025)

## HEADER
- TIP-ID: TIP-D05 · Project: DVSG · Module: `src/engine/vegetation/{scatter,species,material,system,impostor,forest,index}.ts` (mới), `scripts/convert-vegetation.mjs` (mới), `content/vegetation/species.json` (mới), `public/assets/vegetation/*.glb` (6 loài, mới), `content/levels/truong-son-a.level.json` (+`vegetation`), `content/schemas/terrain-level.schema.json`, `src/engine/terrain/level.ts` (+`vegetation?`), `src/engine/terrain/tile.ts` (min/max float32), `src/game/game.ts` (`forest`), `src/qa/debugApi.ts` (`vegetationStats`, `setWind`, `spawnModel` mở rộng), `scripts/ktx2.mjs` (+`vegetation`), `scripts/validate-assets.mjs` (`veg_` 22 k), `tests/unit/vegetation.test.ts`, `tests/e2e/level-truong-son.spec.ts` (+test rừng)
- Dependencies: D04 terrain (TerrainTile/heightfield/level JSON), D02 KTX2, D11a (bot trên terrain — ảnh tham chiếu) · Priority: P0 (đường găng G0′ → D08) · Effort: 40 h Thợ (Blueprint) — thực tế ≈ 44 h (thêm kiểm nguồn Sketchfab + chuyển đổi 6 loài)

## CONTEXT
- Blueprint G0′ D05: `engine/vegetation` 20–40 k instance, 5 loài, gió, 3 LOD + impostor, culling ô, đè cỏ; **cổng: bench Mac 3 run, ADR rừng GO/ADJUST** (≤ 12 ms GPU ở 1920 px). DV-025 đổi thành **loài thật** ngay (Chủ nhà: "rừng không cây").
- PRD VEG-001…006 (instanced seeded, gió TSL, lá alpha hai mặt + trong mờ giả, culling ô + LOD CPU fallback, một hệ nhiều preset, collider thân); PRF: draw ≤ 400/650, tam giác ≤ 2,5/4 M; DV-023 binding ≤ 16.
- Nguồn asset: PRD §12 (CC0/CC-BY có ghi công, không rip — DV-026 loại 3 ứng viên nhiễm license); Chủ nhà đăng nhập Sketchfab, Thợ tải (`assets-src/sketchfab/`, không commit).
- Ràng buộc engine: TSL only, `engine/*` không import `game/*`, không `Math.random`, content không TS, mỗi level mới có E2E vật lý.

## TASK
1. **Asset:** chọn 6 loài đúng vùng (tán có dây leo, tre/nứa, chuối rừng, ráy, dương xỉ, cọ), kiểm rip (mô tả/tag/tên material/tác giả), tải GLB; `content/vegetation/species.json` (node regex biến thể, material lá, chiều cao, tỉ lệ LOD, texture, cast/collider, attribution); `scripts/convert-vegetation.mjs` → GLB `v<i>_lod<k>` + `_WIND` + material `leaf_*/bark_*` + manifest `veg_*` (CC-BY-4.0, attribution, sourceFiles, triangles); `ktx2.mjs` thêm thư mục; `assets:validate` 0 lỗi; `CREDITS.md` sinh lại.
2. **Scatter** seeded theo luật (lưới jitter, dốc/cao/noise/bụi/rect), gom ô 64 m — thuần Node để unit test.
3. **Render** batch instanced (attribute riêng) theo (loài × biến thể × LOD × material), LOD theo ô + từng cây ở ô vắt ngưỡng, frustum cull ô, gió TSL (`positionNode`), lá hai mặt alphaTest + tint, bóng LOD0/1 loài tán, impostor 8 hướng bake lúc nạp, tier chất lượng + tham số URL, `__ht.vegetationStats()`.
4. **Physics:** cylinder thân cho loài `collider` vào `ArenaData.colliders`.
5. **Level:** khối `vegetation` trong `truong-son-a.level.json` (seed 1971, rect 1 024 m quanh navRect, 6 luật, tầng thấp rect 832 m) + schema; `?level=truong-son` mặc định có rừng (`?veg=0` tắt; lite cần `?veg=1`).
6. **Test/evidence:** unit scatter (7), E2E rừng (ngân sách draw/tris/calls, collider thân chặn người chơi, gió, không lỗi console); ảnh sandbox high/low; `docs/ADR/ADR-D06-rung.md` (đề xuất, cổng GO/ADJUST); DECISIONS DV-032…035; README.

## ACCEPTANCE CRITERIA
- Given `http://127.0.0.1:5173/?autostart=1&level=truong-son&weapon=ak47` trên Mac, Then rừng 6 loài hiện quanh spawn/tuyến (tán, tre, cọ, chuối, ráy, dương xỉ), gió nhẹ, impostor ở xa, không lỗi console; người chơi không đi xuyên thân cây tán/cọ/tre.
- Given `quality=high` sandbox, Then tam giác rừng ≤ 1,5 M, draw rừng ≤ 90, tổng renderer ≤ 4 M (đỏ) và cùng seed → cùng rừng (unit); `assets:validate` 0 lỗi; unit + CI xanh.
- Given Chủ nhà bench Mac (`?level=truong-son&bench=1`, 3 run, 1920 px) và so `?veg=0`, Then GPU rừng ≤ 12 ms → ADR-D06 ký **GO**; ngược lại **ADJUST** theo thứ tự đòn bẩy trong ADR (không hạ chất lượng toàn cục).

## CONSTRAINTS
- Không đổi three/Rapier/recast; không sửa `config/performance-budget.json`; không ship texture/mesh ngoài license cho phép; mọi loài có `attribution` trong manifest và hiện ở màn capability.
- Không BatchedMesh (WebGPU r185 một draw mỗi instance); không normal map ở D05 (binding + 3 MB); không đặt cây bằng tay (seeded từ luật; tuyến tác giả ở D08 bằng mặt nạ).
- Đè cỏ (VEG-006), subsurface theo hướng sáng (VEG-003), compute LOD (VEG-004), octahedral impostor, ground cover → **D12**; navmesh với obstacle cây → **D08**.
