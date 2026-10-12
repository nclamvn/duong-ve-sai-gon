# Completion Report: DV-069 (thân lính có đầu người thật)

evidence_status: sandbox_swiftshader_lifecycle_only

STATUS: DONE

FILES CHANGED
- created: `scripts/build-character-pz.mjs`, `scripts/clean-pz-insignia.py`, `public/assets/characters/soldier_pz.glb`
- modified: `src/engine/render/characters.ts` (hồ sơ thân, node material, nhuộm vải xám), `camo.ts` (`camoGreyFabricNode`), `armIk.ts` (`handFrameInv`), `fpHands.ts`, `gear1971.ts` (Spine2_ref), `gearFactionA.ts` (offset mũ đầu thật, bỏ túi ngực), `assets.ts` (`soldier_pz.glb`, `?body=swat`), `src/game/actors/visual.ts`, `dummy.ts`, `src/game/factions.ts`, `game.ts`, `content/factions/factions.json` (phe A `skin: olive`), manifest, CREDITS, tests

TEST RESULTS
- typecheck 0 lỗi; unit 212/212; validate-assets 0 lỗi (KTX2)
- E2E: boot 8/8 (có đo chuyển động trên thân mới: 24 hướng khớp, mỗi lớp cộng đủ 1, ngực xoay 32° khi mục tiêu lệch 30°), Trường Sơn 4/4, nhiệm vụ + Phố + Điểm cao 31 5/5 → 17 passed
- Ảnh: `can-canh.jpg` (4 góc, hai phe), `xoay.jpg`, `ngang-lui.jpg`, `trung-dan.jpg`, `doi-hinh.jpg` (rừng), thư mục `a1/ a2/ final/ rung/`

ISSUES
- (trung bình) Hai phe dùng chung một thân (khác màu áo, mũ); mặt giống nhau. Cần thêm 1–2 thân/mặt để đội hình không như nhân bản.
- (trung bình) Dáng áo là áo dã chiến kiểu Thế chiến 2 (cổ bẻ, túi nắp) đã xoá phù hiệu; nhìn gần vẫn đọc ra kiểu áo.
- (thấp) Súng M16A1 (asset cũ) có dòng chữ khắc tay trên báng; nên xoá.
- (thấp) Vết vá vải nhìn sát thấy viền nhẹ; ở khoảng cách chơi không thấy.

DEVIATIONS
- Không dùng mẫu "Vietnam Soldier (rigged)" (nhãn NoAI, Chủ nhà chọn giữ hướng khác).

SUGGESTIONS
- Thêm biến thể mặt (hoán đổi texture mặt) hoặc mua gói nhân vật nhiều thân có rig Mixamo.
- Mũ M1 phe B: thay bằng mẫu Efarys đã tải khi cần cận cảnh đẹp hơn.
