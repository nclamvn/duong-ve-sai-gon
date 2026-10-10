# DV-059 · Completion Report: mẻ cào lọc asset rừng + lớp nền rừng CC0

STATUS: DONE cho phần làm được không cần mua; phần cây chính chờ Chủ nhà mua hoặc đăng nhập tải (L3)

evidence_status: sandbox_swiftshader_lifecycle_only

## Kết quả
- Registry `rung_truong_son`: thêm 3 mũi asset (I Fab/Megascans 208 claim, J Sketchfab 372, K Poly Haven/BlenderKit/khác 209). Tổng 397 thực thể, 1.909 claim, VALIDATION PASSED, 6/6 cổng cắn.
- Danh sách chọn theo vai: `docs/research/rung-truong-son/ASSET-SHORTLIST-rung.md`.
- 7 loài nền rừng CC0 Poly Haven vào game: `ph_fern`, `ph_calathea`, `ph_branches`, `ph_log`, `ph_stump`, `ph_rock_moss`, `ph_roots` (LOD0 2–18 k tam giác, KTX2, manifest CC0 có tác giả).

## FILES CHANGED
- `scripts/fetch-assets.mjs` (kiểu `vegsrc`), `scripts/convert-vegetation.mjs` (LOD0 simplify, nguồn `polyhaven`), `content/schemas/asset-manifest.schema.json` (+`polyhaven-vegetation`).
- `content/vegetation/species.json` (+7), `content/levels/truong-son-a.level.json` (+7 luật), `public/assets/vegetation/ph_*.glb`, `content/assets/manifest.json`, `CREDITS.md`, `public/assets/terrain/truong-son-a/{nav.bin,map.png}`.
- `tests/e2e/level-truong-son.spec.ts` (18 luật; sửa lỗi kiểu `perSpecies` có thể undefined lọt từ DV-057).
- `docs/research/rung-truong-son/` (claims, snapshots, registry, shortlist), `docs/DECISIONS.md` (DV-058, DV-059).

## TEST RESULTS
- typecheck 0 lỗi; unit 27 file 180/180; validate-assets 109 asset 0 lỗi.
- E2E webgl-ci boot + level-truong-son: 10/10 pass (7,9 phút).
- Rừng (E2E, quality low): 18 luật, 58.077 cây/vật; 77–87 draw; 0,31–0,48 triệu tam giác rừng, tổng ≤ 0,60 triệu (ngân sách test 1,5 / 4 triệu); CPU rừng 0,6 ms.
- Kích thước thật sau convert: thân đổ 4,1 × 1,06 m, gốc cây 1,4 × 0,57 m, đá 2,2–3,4 m, cụm rễ 4,1 × 1,5 m.

## ISSUES
- Trung bình: cây tán vẫn là mô hình CC-BY cành vặn. Không nguồn miễn phí nào có cây họ Dầu nguyên cây Đông Nam Á; cần Chủ nhà mua bộ Fab (khoảng 122 USD) hoặc tải scan CC-BY từ Sketchfab.
- Thấp: thân đổ chưa có va chạm (rừng chỉ có collider trụ đứng).
- Thấp: ảnh cận cảnh trong sandbox chưa bắt đúng góc vật mới (`nen-rung.jpg`); duyệt hình trên Mac.

## DEVIATIONS (L1)
- `bites.py` của bản sao engine refinery: không đổi thêm.

## SUGGESTIONS
- Mua bộ Fab theo mục 3 của shortlist, tải FBX vào `assets-src/fab/<gói>/`; Thầu convert và đặt vào tầng vượt tán, tán chính, cọ, tre, dương xỉ.
- Thêm collider hộp xoay cho thân đổ (engine vegetation hiện chỉ capsule).
