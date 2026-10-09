# DV-057 · Completion Report: rừng Trường Sơn theo registry refinery

STATUS: DONE (chờ Chủ nhà duyệt hình và tiếng trên Mac; hai quyết định L3 ở cuối)

evidence_status: sandbox_swiftshader_lifecycle_only (ảnh và số tam giác đo trong sandbox WebGL SwiftShader, không phải GPU Mac)

## FILES CHANGED

Tạo mới:
- `src/engine/sky/solar.ts`: vị trí mặt trời NOAA, giờ mọc/lặn, quy ước phương vị engine.
- `src/engine/sky/climate.ts`: preset trời + ngày/giờ/toạ độ → LevelSky; tầm nhìn → mật độ FogExp2 (ngưỡng tương phản 2 %).
- `src/engine/audio/soundscapePlan.ts`, `src/engine/audio/soundscape.ts`: cảnh âm rừng thủ tục (Thợ phụ dựng, Thầu nối).
- `content/ecology/climate.truong-son.json` (4 preset), `content/ecology/soundscape.truong-son.json` (12 voice).
- `scripts/check-soundscape-refs.mjs` (+ `.d.mts`): kiểm ref claim cho mọi file `content/ecology/*.json`.
- `tests/unit/solarClimate.test.ts` (8 test), `tests/unit/soundscapePlan.test.ts` (14), `tests/unit/soundscape.test.ts` (3).
- `docs/research/rung-truong-son/`: domain refinery mẻ 1 và 2 (claims, 350 snapshot, registry, bảng ảnh tham chiếu).

Sửa:
- `src/engine/vegetation/scatter.ts` (`asset`, `noise.max`), `system.ts`, `forest.ts` (khoá GLB/atlas theo `asset ?? id`).
- `src/engine/terrain/level.ts` (`climate?`), `src/engine/audio/audio.ts` (bus `ambience`), `src/game/game.ts` (nối climate, mưa phùn, cảnh âm).
- `content/levels/truong-son-a.level.json` (climate, lớp đất, 11 luật thực vật), `content/schemas/terrain-level.schema.json`.
- `scripts/fetch-assets.mjs` (+4 asset CC0), `content/assets/manifest.json`, `CREDITS.md`.
- `public/assets/terrain/truong-son-a/nav.bin`, `map.png` (bake lại theo rừng mới).
- `tests/unit/vegetation.test.ts` (+1 test noise.max, khoá GLB), `tests/e2e/level-truong-son.spec.ts` (11 luật).

## TEST RESULTS
- typecheck: 0 lỗi.
- unit: 27 file, 180/180 pass.
- validate-assets: 102 asset, 0 lỗi, 0 cảnh báo.
- check-soundscape-refs: climate 54 số (10 từ claim, 14 định lượng của claim định tính, 30 thiết kế), soundscape 313 số; 0 lỗi.
- E2E webgl-ci: boot + level-truong-son + mission, 12/12 pass (10,3 phút).
- Rừng (E2E, quality low): 11 luật, 51.458 cây/bụi; vượt tán 419, tán chính 4.067; 60–65 draw, 0,29–0,44 triệu tam giác rừng, tổng ≤ 0,56 triệu (ngân sách test 1,5 / 4 triệu); CPU rừng 0,5 ms. Cỏ giảm mạnh vì chỉ còn ở khoảng trống tán.
- Ảnh: `truoc_*.jpg` (`?climate=0`, rừng mới), `sau_*.jpg` (climate tháng 1), `so-sanh.jpg`.

## ISSUES
- Trung bình: cây tán (`tree_gn`, Sketchfab CC-BY) có dáng cành vặn như cây ôn đới; xếp hai tầng nhưng nhìn vẫn giống vườn cây. Registry tả rừng già thân cột thẳng, tán khép. Giới hạn ở asset, không ở luật đặt.
- Thấp: tiếng động vật là tổng hợp thủ tục, chưa ai nghe thử. Chưa có bản ghi thật sạch giấy phép cho vượn *Nomascus* và trĩ sao.
- Thấp: lớp đất đỏ nhân với tint mud mặc định có thể quá đỏ trên Mac.

## DEVIATIONS (L1)
- Đèn mặt trời kẹp cao độ ≥ 7° (thật lúc vào màn là −1,9°): bóng CSM sát chân trời dài vô tận; cường độ nắng đã giảm theo preset u ám.
- `bites.py` của engine refinery (bản sao trong sandbox): glob snapshot `*.*` và cổng CAPTURE_MISSING xoá đúng snapshot được claim dẫn tới. Không sửa `refinery.py`.
- Loại 21 claim của một nguồn khí hậu tải bằng đường không được phép.

## SUGGESTIONS (cho Chủ nhà)
1. Cổng Trời: nguồn đặt nó trên đường 12 (Cha Lo), ô DEM đang ở vùng đường 20. Giữ hay dời ô?
2. Mua một gói cây nhiệt đới photoscan trên Fab (registry mục 9 có danh sách và giá) để thay cây tán.
3. Nghe cảnh âm trên Mac lúc vào màn (06:24, vượn hót tới khoảng 06:42).
