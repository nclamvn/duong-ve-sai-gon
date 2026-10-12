# Completion Report: DV-068 (mũ sắt phe A thay mũ tai bèo)

evidence_status: sandbox_swiftshader_lifecycle_only

STATUS: DONE

FILES CHANGED
- created: `scripts/prep-helmet.mjs`, `public/assets/characters/helmet_a.glb` (2.580 tam giác, 49 KB), `tests/e2e/shots-mu.spec.ts`
- modified: `src/engine/render/gearFactionA.ts` (mũ dựng sẵn, `HELMET_A_HEAD_OFFSET`), `src/engine/render/assets.ts` (nạp `helmet_a.glb`), `src/engine/render/characters.ts` (`props`), `src/game/actors/visual.ts`, `content/assets/manifest.json`, `CREDITS.md`, `content/factions/factions.json`, `tests/e2e/boot.spec.ts`, `tests/unit/motionDv066.test.ts`, `docs/DECISIONS.md`

TEST RESULTS
- typecheck 0 lỗi; unit 212/212; validate-assets 0 lỗi; CREDITS sinh lại có ghi công SimplyK
- E2E boot 8/8 (phe A mang `gear_helmet_a`)
- Ảnh: `mu-1.jpg` … `mu-6.jpg` (6 vòng căn mũ, 4 góc), `rung-phe-a.jpg` (cảnh rừng), thư mục `rung/`

ISSUES
- (thấp) Nhìn thẳng từ sau vẫn thấy gáy dưới vành mũ (giống người thật); không còn chỗ da xuyên vỏ.
- (thấp) Quai cằm bỏ hẳn; nếu muốn quai, cần dựng quai riêng ôm theo mặt Swat.

DEVIATIONS
- Bỏ lót da so với kế hoạch ban đầu (xuyên vỏ sau giảm lưới).

SUGGESTIONS
- Phe B: thay lính Swat bằng mô hình Panzergrenadier (rig Mixamo, 27 nghìn tam giác) + mũ M1 Efarys (gỡ huy hiệu, lá bài), tô rằn ri phe B.
