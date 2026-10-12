# Completion Report: DV-066 (hệ chuyển động lính)

evidence_status: sandbox_swiftshader_lifecycle_only

STATUS: PARTIAL. Code chuyển động xong; clip Mixamo Pro Rifle Pack đã ghép (DV-067). Còn lại: mô hình nhân vật mới hai phe (đã tải, chưa dựng vào game).

FILES CHANGED
- created: `src/engine/render/locomotion.ts` (bộ điều khiển thuần, không import three), `src/engine/render/clipAnalysis.ts` (đo clip, tách lớp, bóc yaw clip xoay), `tests/unit/motionDv066.test.ts` (17 test), `tests/e2e/shots-linh.spec.ts` (ảnh, chỉ chạy khi đặt DV_SHOTS)
- modified: `src/engine/render/characters.ts` (CharacterInstance viết lại theo lớp), `src/game/actors/visual.ts` (ActorMotion, HitInfo, thân dưới do bộ điều khiển xoay), `src/game/actors/botActor.ts` (vận tốc mượt, yaw ngắm, pitch, phía trúng đạn), `src/game/ai/bot.ts` (`aimPitch` chỉ hình), `src/game/game.ts` (truyền vùng trúng), `tests/e2e/boot.spec.ts` (test DV-066 trên clip thật), `docs/DECISIONS.md`

ĐÃ LÀM
1. Hai lớp thân trên / thân dưới: bắn, nạp đạn, trúng đạn chỉ ở thân trên, chân vẫn bước. Mỗi lớp cộng đúng 1 (đo trên clip thật: sai số tối đa 5e-8).
2. Blend theo hướng × dáng đi (đi, chạy, cúi đi), pha chân chung, nhịp clip khớp tốc độ thật.
3. Đo tốc độ/hướng clip tự động từ bàn chân (in-place) hoặc từ hông (root motion). Clip hiện có: đi 1,19 m/s, chạy 3,03 m/s, hướng 0°, pha chân trái 0,28.
4. Xoay tại chỗ: ngực dẫn, chân theo (clip turn nếu có, chưa có thì xoay 3,2 rad/s).
5. Aim offset cột sống: ngực xoay 32,1° khi mục tiêu lệch 30° (chân đứng yên), ngẩng theo độ cao mục tiêu.
6. Trúng đạn / chết theo phía viên đạn tới, headshot; chọn tất định.

TEST RESULTS
- typecheck 0 lỗi; unit 212/212 (thêm 17)
- E2E: boot 8/8 (có test mới trên clip Mixamo thật), Trường Sơn 4/4, nhiệm vụ + Phố + Điểm cao 31 5/5 → 17 passed; shots-* bỏ qua ngoài DV_SHOTS
- Ảnh rừng: `tong-hop.jpg` (9 khung), `xoay-zoom.jpg` (súng chĩa camera → ngực xoay 100° trước → chân theo), `trung-dan-zoom.jpg` (đi ngang → trúng → nằm hẳn); thư mục `sau/`; số đo `motion-probe.json`

ISSUES
- (cao, chờ Chrome) Bộ clip hiện chỉ có 8 clip, đi/chạy chỉ hướng tới: lùi/đi ngang vẫn là xoay người + vặn ngực; xoay tại chỗ trượt chân; chỉ một kiểu chết. Hệ mới tự nhận clip khi có file đúng tên.
- (trung bình) Bot tuần tra 3,5 m/s là chạy bộ, không phải đi tuần (người thật ~1,3–1,5 m/s). Đổi là việc gameplay (thời gian nhiệm vụ, đồng đội theo), Chủ nhà quyết.
- (trung bình) Chưa có chân bám dốc (foot IK): trên dốc rừng một bàn chân có thể lơ lửng hoặc lún vài cm.
- (thấp) Cúi chưa bật cho bot: capsule va chạm chưa cúi theo.

DEVIATIONS
- Không có. Mô hình nhân vật mới (Task 41) chưa làm vì phụ thuộc file tải.

SUGGESTIONS
- Tải "Pro Rifle Pack" của Mixamo (một gói, đủ đi/chạy 8 hướng, xoay, chết nhiều kiểu) rồi đặt tên theo bảng trong DV-066.
- Sau khi có clip: foot IK hai chân theo terrain + hạ hông; cúi cho bot kèm capsule cúi.

CẬP NHẬT DV-067 (clip Mixamo thật)
- 31 clip mới trong `soldier.glb`; số đo trong `motion-probe.json` (24 clip di chuyển, hướng khớp tên file).
- E2E boot 8/8 sau khi sửa 2 test viết cho bộ clip cũ (nhiều biến thể chết; chọn đúng clip đi thẳng); unit 212/212.
- Ảnh `sau2/`, `ngang-lui.jpg` (đi ngang + lùi vẫn chĩa súng), `xoay-zoom-2.jpg` (xoay tại chỗ có bước chân), `trung-dan-zoom-2.jpg`.
