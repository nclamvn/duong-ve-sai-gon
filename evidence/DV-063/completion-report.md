# Completion Report: DV-063 (rừng vòng 4)

evidence_status: sandbox_swiftshader_lifecycle_only

STATUS: DONE (phần làm được không cần mua/tải). Còn chờ: cây tán nhiệt đới (gói Fab Chủ nhà mua), âm thanh bản ghi thật.

FILES CHANGED
- created: `src/engine/render/cinematic.ts`, `tests/unit/forestDv063.test.ts`, `tests/e2e/shots-rung.spec.ts` (chỉ chạy khi đặt `DV_SHOTS`), `evidence/DV-063/*`
- modified: `content/levels/truong-son-a.level.json` (boost, mật độ, LOD, `post`), `content/schemas/terrain-level.schema.json`, `src/engine/vegetation/scatter.ts` (boost), `src/engine/vegetation/system.ts` (batch chung theo asset, sức chứa theo ô dày nhất), `src/engine/terrain/tile.ts` (mặt nạ đường mòn), `src/engine/terrain/material.ts` (thảm lá mục phủ kín), `src/engine/terrain/features.ts` (streamEmitters, groundSurface), `src/engine/terrain/water.ts` (flow, bọt, gợn lội), `src/engine/terrain/level.ts`, `src/engine/render/post.ts`, `src/engine/audio/audio.ts` (brook, footstep), `src/game/game.ts`, `public/assets/terrain/truong-son-a/nav.bin`, `content/assets/manifest.json`, `docs/DECISIONS.md`

TEST RESULTS
- typecheck 0 lỗi; unit 195/195; validate-assets 0 lỗi
- E2E rừng (ngân sách quality low): draw ≤ 140, tam giác rừng ≤ 1,5 triệu: đạt (lần đầu 150 draw / 1,83 triệu → batch chung theo asset + LOD0 scan nặng 12 m)
- E2E toàn bộ (webgl-ci, build production): 17 passed, 1 skipped (ảnh chỉ chạy khi đặt DV_SHOTS), 14,4 phút; M1 đồng đội theo vẫn đạt sau khi nền dày hơn
- Ảnh: `truoc-sau.jpg` (trái trước, phải sau; 4 góc cố định; quality low), `tia-nang-tat-bat.jpg` (trái low không tia, phải post=medium có tia nắng + màu phim), thư mục `truoc/`, `sau/`, `sau-medium/`

ISSUES
- (cao, chờ Chủ nhà) Cây tán vẫn dáng ôn đới: chỉ thay được khi có gói Fab.
- (trung bình) Âm thanh suối và bước chân là tổng hợp thủ tục; tiêu chí Q3 (100 % bản ghi thật) chưa đạt. Cần tải Sonniss/Freesound.
- (thấp) Ảnh sandbox là SwiftShader quality low (mật độ 0,5); trên Mac high mật độ gấp đôi và có tia nắng.

DEVIATIONS
- Tia nắng tự viết (màn hình, depth) thay `GodraysNode` của three: GodraysNode cần shadow map của một DirectionalLight thường, không chạy với CSM đang dùng.

SUGGESTIONS
- Chủ nhà chạy `?shafts=0` và `?grade=0` trên Mac để so A/B, báo mức tia nắng/màu muốn đậm hay nhạt (tham số trong `post` của level).
