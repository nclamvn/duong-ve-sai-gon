# TIP-D04: Terrain prototype `engine/terrain` (G0′, PRD TER-001/002/003)

## HEADER
- TIP-ID: TIP-D04 · Project: DVSG · Module mới: `src/engine/terrain/{tile,mesh,material,collider,level,index}.ts`; sửa `src/engine/physics/world.ts` (heightfield), `src/engine/render/arena.ts` (`ColliderDef.material` +`earth`), `src/game/game.ts` (`?level=truong-son`, debug API), `scripts/terrain-bake.mjs` (+`--nav`), `scripts/fetch-assets.mjs` (4 bộ texture CC0 địa hình), `content/levels/truong-son-a.level.json` (mới), `tests/unit/terrain.test.ts`, `tests/e2e/level-truong-son.spec.ts`
- Dependencies: D01, D02 (KTX2, validator, ô `truong-son-a`) · Priority: P0 (đường găng D04 → D05 → D08) · Effort: 32 h Thợ

## CONTEXT
- Ô DEM `public/assets/terrain/truong-son-a/` (DV-016): `height.r16` 1025² u16 LE, 2 m/điểm, 2048 m, hàng 0 = bắc, cột 0 = tây; `meta.json` (zMin/zMax, layout, nguồn). Trục engine: +x đông, −z bắc → hàng r ↔ z = (r − 512)·2, cột c ↔ x = (c − 512)·2; y = zMin + u16/65535·(zMax − zMin) − **yOffset** (đưa cao độ spawn về ≈ 0 để số liệu quen thuộc; ghi trong LevelDef).
- Kiến trúc kế thừa: `ArenaData` là nguồn collider duy nhất (game.ts lặp `addStatic`); navmesh runtime từ `navGeometry` (recast solo); level = JSON trong `content/levels` (không TS trong content); TSL only; `engine/*` không import `game/*`; không `Math.random`.
- Ngân sách (budget JSON): draw target 400/đỏ 650; tris target 2,5 M/đỏ 4 M; `frame_p95` target_g1 16,67 ms trên Mac (Chủ nhà đo ở D05, không phải AC của TIP này).

## TASK
1. **Tile** (`tile.ts`): nạp `height.r16` + `meta.json` → `Float32Array` cao độ (m, đã trừ yOffset), `sample(x, z)` song tuyến, `normalAt(x, z)`, texture cao độ (RGBA8: R,G = u16 cao độ; B,A = normal xz mã hoá) cho vertex/fragment, `bounds`. Chạy được trong Node (unit test) — không phụ thuộc DOM.
2. **Mesh LOD** (`mesh.ts`): lưới ô 64 m (32×32 = 1024 ô); **4 LOD** (2/4/8/16 m) mỗi LOD một `InstancedMesh` chung geometry (33², 17², 9², 5² đỉnh + **váy** (skirt) sâu 6 m che khe giữa LOD), instance = ô, chọn LOD theo khoảng cách camera mỗi frame (ngưỡng 96/192/384 m, hysteresis 8 m), frustum-cull theo AABB ô (chiều cao từ min/max ô). Cao độ lấy trong vertex shader (TSL `texture(h, uv, level 0)`, nearest, đỉnh trùng texel) → **≤ 4 draw** cho toàn ô 2 km. Bóng: `castShadow` false, `receiveShadow` true (CSM); tris tổng ở góc nhìn thường ≤ 1,2 M.
3. **Vật liệu splat** (`material.ts`, TER-002 rút gọn): 4 lớp theo quy tắc slope/height trong fragment (không cần splat map ở prototype): mùn lá rừng (`brown_mud_leaves_01`, mặc định), đất đỏ đường mòn (`brown_mud_03`, nơi thấp/thoải + noise), đá (`aerial_rocks_02`, dốc > 38°, triplanar), cỏ tranh (`aerial_grass_rock`, cao + thoải). Phá lặp: trộn hai tỉ lệ tile (4 m và 23 m) theo noise; wetness theo lớp (mưa phùn M1 = 0,2 ở đất). Normal per-pixel từ texture normal của ô + normal map lớp. Texture CC0 Poly Haven qua `fetch-assets` → `assets:ktx2` → manifest/validator.
4. **Collider** (`collider.ts` + `world.ts`): `StaticShape` thêm `kind: 'heightfield'` (`heights` Float32Array (n×n), `n`, `size` = [sizeM, 1, sizeM]) → `RAPIER.ColliderDesc.heightfield(n−1, n−1, heights, scale)`; xác định thứ tự hàng/cột **bằng unit test** raycast (không đoán): 50 điểm seeded, |hit.y − sample| ≤ 0,15 m. `ColliderDef.material` thêm `'earth'` (audio/fx đã có default).
5. **Navmesh**: `scripts/terrain-bake.mjs --nav --navRect cx cz w h` bake recast trên lưới 4 m trong hình chữ nhật chơi (mặc định 512×512 m quanh spawn) → `public/assets/terrain/<id>/nav.bin` (`exportNavMesh`) + manifest; runtime `importNavMesh` nếu có file, không có → `navGeometry` = lưới 4 m của navRect (fallback, log build ms). `NavService` nhận thêm ctor từ navmesh có sẵn.
6. **Level** (`level.ts` + `content/levels/truong-son-a.level.json`, schema mới `terrain-level.schema.json`): `{ id, name, terrain: { id, yOffset, navRect }, sky (LevelSky, dùng `createDaylight` + fog dày hơn), textures[4 lớp], playerSpawn (x,z; y tự lấy từ terrain + 0,1), playerYaw, botSpawns, waypoints (theo sườn), zones, coverMarkers: [] }` → `ArenaData` (colliders = 1 heightfield, navGeometry/navPrebuilt, spawn, stats). `game.ts`: `levelId` thêm `'truong-son'` (`?level=truong-son`); `__ht.terrainHeight(x,z)` và `__ht.terrainStats()` (lod counts, draws, tris) cho probe/E2E.
7. **Tests**: unit `terrain.test.ts` (sample song tuyến tại đỉnh/giữa ô; normal hướng lên ở chỗ phẳng; chọn LOD theo khoảng cách + hysteresis; heightfield raycast ≤ 0,15 m; nav bake nhỏ 64 m trong Node có poly > 0 và `findPath` qua sườn). E2E `level-truong-son.spec.ts` (webgl-ci): boot `?level=truong-son&autostart=1&debug=1&quality=low&post=off` → 120 frame không lỗi; đứng 3 s: |y_chân − h(x,z)| ≤ 0,3; đi thẳng 8 s về hướng dốc lên: luôn ≥ h − 0,3 (không xuyên), tiến ≥ 15 m; quay về hướng dốc > maxSlopeDeg (chọn điểm trong test bằng `terrainHeight`) 4 s: không leo quá 2 m; bot_a có path (polys > 0).
8. **Evidence**: `evidence/TIP-D04/{spawn,ridge,valley,wire-lod}.png` (probe sandbox), `stats.txt` (draw/tris/LOD counts 3 góc, nav build ms hoặc bake ms, kích thước nav.bin), `ci.txt`, `completion-report.md`. Số Mac: D05.

## ACCEPTANCE CRITERIA
- Given `?level=truong-son&quality=medium` probe, Then terrain 2048 m hiển thị đúng địa hình DEM (so `preview.png`), **draw terrain ≤ 4**, tổng draw ≤ 120, tris ≤ 1,2 M ở 3 góc; 0 lỗi console; không khe hở (váy) ở ảnh wire-lod.
- Given unit test heightfield, Then 50/50 điểm |raycast − sample| ≤ 0,15 m; Given nav bake, Then polyCount > 0 và findPath thành công.
- Given E2E vật lý (DV-009), Then đứng/đi/dốc như mục 7; Given `npm run ci`, Then xanh.
- Given validator, Then 4 bộ texture mới CC0 + `nav.bin` trong manifest, 0 lỗi; `assets:ktx2` đã chạy (100 % KTX2).

## CONSTRAINTS
- Không đổi Three/Rapier/Recast; TSL only; không import `game/*` từ `engine/terrain`; không `Math.random`; content JSON không TS; tiếng Việt chỉ trong i18n/content.
- Không sửa budget để "đạt". Không tối ưu sớm (không CDLOD morph, không streaming) — chỉ đủ để D05 đo rừng; ghi SUGGESTIONS cho D08 (streaming ô, splat map tác giả, đường mòn spline).
- Toạ độ ô chính thức có thể đổi (DV-016): mọi mã theo `meta.json`, không hard-code số của `truong-son-a`.
