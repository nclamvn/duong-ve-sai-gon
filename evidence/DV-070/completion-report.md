# Completion Report: DV-070 (M16 sạch chữ, biến thể lính, tóc, bám chân trên dốc)

evidence_status: sandbox_swiftshader_lifecycle_only

STATUS: DONE

FILES CHANGED
- created: `src/engine/render/footIk.ts`, `scripts/clean-m16-graffiti.mjs`, `scripts/clean-m16-graffiti.py`, `scripts/pz-hair-mask.mjs`, `scripts/paint-pz-hair.py`, `tests/unit/footIk.test.ts`, `tests/e2e/shots-bien-the.spec.ts`, `tests/e2e/shots-doc.spec.ts`
- modified: `public/assets/weapons/m16a1.glb`, `public/assets/characters/soldier_pz.glb`, `src/engine/render/{armIk,camo,characters}.ts`, `src/game/actors/{visual,dummy}.ts`, `src/game/game.ts`, `scripts/build-character-pz.mjs`, `content/assets/manifest.json`, `docs/DECISIONS.md`

TEST RESULTS
- typecheck 0 lỗi; unit 215/215 (+3 foot IK); validate-assets 0 lỗi
- E2E: boot 8/8, Trường Sơn 4/4, nhiệm vụ + Phố + Điểm cao 31 5/5 → 17 passed
- Bám chân, dốc 0,41 (Trường Sơn x −170, z 572): mũi giày trên mặt đất (m) không IK [0,077; −0,088], có IK [−0,025; −0,036]
- Ảnh: `doi-hinh.jpg` (5 phe A + 5 phe B: chiều cao, màu vải, mũ, một người đầu trần tóc húi cua), `doc.jpg`, `m16-truoc-sau.jpg`, `m16-bang-sach.jpg`

ISSUES
- (trung bình) Mặt vẫn chung một lưới; biến thể chỉ đổi màu da, cỡ đầu, mũ.
- (thấp) Có IK hai mũi giày cùng thấp hơn mặt đất ~3 cm (khớp ngón nằm trong giày, đế thấp hơn khớp); không lộ ở khoảng cách chơi.
- (thấp) Bám chân theo heightfield địa hình, chưa tính đá/khúc gỗ.

DEVIATIONS
- Không có.

SUGGESTIONS
- Biến thể mặt thật: mua/tải thêm 1–2 đầu có rig Mixamo cùng chuẩn để hoán đổi.
