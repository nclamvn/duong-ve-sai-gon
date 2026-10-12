# DV-085 Completion Report: M1 "Cổng Trời" bản dồn dập (7 hồi, 90 địch)

STATUS: DONE, chờ Chủ nhà chơi thử trên Mac (độ dài thật, độ khó, cảm giác từng hồi)

Theo BLUEPRINT-M1-T3 (bản 0.2: chốt vị trí khi dựng). Bản đồ dàn cảnh: `ban-do-m1.png` (chấm đỏ địch, xanh tổ ta, vàng chỗ xuất phát, vòng trắng vùng nhiệm vụ).

## FILES CHANGED

Tạo mới:
- `tests/unit/m1Dv085.test.ts` (6 test): đồ thị 7 hồi chạy hết, trần 16 sống khi không ai bị giết, mỗi mục tiêu có marker và câu chỉ huy, điểm ra quân và vùng nhiệm vụ trên đất đi được.
- `scripts/m1-map.mjs`: vẽ bản đồ dàn cảnh M1.
- `public/assets/voice/vi/M00, M16 đến M19, M27, M28, M71 đến M99.mp3` (36 câu, ElevenLabs trên Mac).
- `docs/BLUEPRINT-M1-T3.md`.

Sửa:
- `content/missions/truong-son-a.mission.json` (0.3.0): 33 nút, 19 vùng, 19 nhóm (1 tổ ta + 18 nhóm địch), 7 checkpoint.
- `content/levels/truong-son-a.level.json`: chỗ xuất phát (−68, 594) nhìn sang đông, điểm ra quân mới, bỏ điểm `f1*` cũ.
- `content/missions/truong-son-a.dialogue.json`, `content/locale/vi.json`: 36 câu thoại, 12 dòng mục tiêu mới.
- `scripts/voice/lines.mjs`: thẻ diễn cho câu mới; `public/assets/voice/manifest.json`, `content/assets/manifest.json`.
- `src/game/mission/types.ts`, `runtime.ts`, `missionHost.ts`, schema: hành động `group_hunt` (tàn quân lao vào người chơi); `group_alive_max` chưa đúng khi còn đợt tiếp viện chờ; về checkpoint trước lúc hy sinh thì người đó trở lại tổ.
- `src/game/mission/battle.ts`: chỗ chưa dùng trong bể lửa/khói không vẽ.
- `src/game/actors/dummy.ts`: xác lính dựng bằng code ngã nằm trên đất thật (trước đây về y = 0, ở bờ suối −1,5 m thì xác lơ lửng).
- `src/game/game.ts`, `src/qa/debugApi.ts`: `calm()` / `?calm=1` (chỉ khi ?debug=1) dừng kịch bản cho test không phải về nhiệm vụ.
- Test cập nhật: `hud-m1` (đồ thị cũ chuyển sang m1Dv085), `forestDv063`, `terrain`, E2E `level-truong-son` (M1 viết lại; vật lý đo dốc ở trại đường mòn), `voice`, `grenade-gunfeel` (đo ở trại đường mòn), `playtime-m1` (người chơi giả đi theo navmesh, vừa tiến vừa bắn), `shots-rung` (`calm=1`).

## TEST RESULTS

- `npx tsc --noEmit`: 0 lỗi.
- `npx vitest run`: 297/297.
- E2E toàn bộ (webgl-ci): 22/23 lần chạy cuối (24 phút; 7 bỏ qua theo cờ); test rừng trượt ngưỡng CPU 8 ms (đo 9,8 ms, sandbox) rồi chạy lại xanh, các lần trước xanh. Lần chạy toàn bộ trước đó (trước khi dời vị trí hồi 2 đến 4): 23/23.
- E2E M1: mọi điểm ra quân bám navmesh ≤ 1,5 m; địch bắn trong 30 s đầu, cối và đòn đánh nổ; Quyết xung phong > 2,5 m/s; luật phe, hit marker, xác nằm hẳn; napalm làm bỏng người đứng trong dải; Khang hy sinh, còn Quyết, Long, Đạt, Hoàn; B-52 ≥ 35 quả, trong lòng suối không mất máu; gài bộc phá, đếm ngược > 80 s, hai mũi phản kích 5 + 5; tổ phục im khi ta còn 45 m, khai hoả khi 4 m; giữ đỉnh dốc; 2 lượt trực thăng; Hoàn hy sinh, còn Quyết, Long, Đạt; tổng 90 địch; xong màn, có M00 và M09.
- Người chơi giả (`DV_PLAYTIME=1`, không chết, không nạp lại, chạy nước rút khi có đếm ngược): 13,4 và 14,8 phút ở hai lần đo cuối, hết màn; 90 địch ra đủ, tối đa 16 sống cùng lúc; quãng lặng dài nhất 50 đến 60 s (sau trận B-52).

## ISSUES

- Trung bình: người chơi giả mất 13,4 đến 14,8 phút, dưới khung 15 đến 25 phút của blueprint. Người chơi thật có chết, nạp lại, nấp, nạp đạn nên ước 17 đến 22 phút; cần Chủ nhà chơi thử để chốt. Test `playtime-m1` đặt sàn 12 phút (bắt lỗi kịch bản bị rút ngắn), có ghi chú lý do.
- Trung bình: navmesh không phủ sườn bờ đông xa hơn x ≈ 5 và dải đông bắc; dòng suối chỉ có lối AI qua được ở phía nam (gần chỗ xuất phát). Đồng đội và địch đi vòng xa khi phải qua suối (ví dụ từ sườn đồi xuống lòng suối lúc B-52: người chơi chạy thẳng 50 m, AI phải vòng khoảng 340 m). Không ảnh hưởng người chơi; đồng đội có sàn máu nên không chết oan. Bake lại navmesh có lối qua suối là việc riêng.
- Thấp: câu thoại M1-T2 cũ (M30 đến M70 trừ các câu dùng lại) vẫn nằm trong file thoại, không còn dùng ở M1.
- Thấp: chưa có ảnh chụp hồi napalm, B-52 trên Mac (cần WebGPU High).

## DEVIATIONS

- Vị trí so với blueprint 0.1: điểm quan sát dời từ "đồi" sang sườn bờ đông gần suối (đồi cũ ở đáy thung, không cao); cây cảm biến và tàn quân sau B-52 sang bờ tây (bờ đông không nối navmesh, AI không tới được); mũi phản kích thứ hai từ tây thay vì đông (câu M90 đọc lại "Bắc và tây").
- Thêm so với blueprint: 3 tên tiếp viện vượt suối ở hồi 1, giữ đỉnh dốc 60 s ở hồi 6 (kéo dài hồi 1 và hồi 6 cho gần nhịp 20 phút); tổng 90 địch (đúng trần 70 đến 90).
- Sửa ngoài phạm vi: xác lính dạng code lơ lửng ở địa hình thấp (lỗi có từ trước, lộ ra khi chỗ xuất phát xuống bờ suối).

## SUGGESTIONS

- Chủ nhà chơi thử M1 trên Mac (High, WebGPU) và ghi: thời lượng thật, chỗ chết nhiều, hồi nào lặng, độ khó; Thầu chỉnh `content/tuning/ai.json` và nhịp các nút theo đó.
- Bake lại navmesh M1 có lối qua suối ở giữa thung (quanh z 440 đến 460) để AI không phải vòng xa.
- Xoá các câu thoại M1-T2 không còn dùng khi chốt bản M1 này.

evidence_status: sandbox_swiftshader_lifecycle_only (E2E và người chơi giả đo trong sandbox WebGL; không đo khung hình).
