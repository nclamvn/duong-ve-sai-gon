# DV-086 Completion Report: ảnh trong và mịn, lửa cháy thật, tối ưu hiệu năng

STATUS: DONE phần code và đo được; khung hình thật (fps) chờ Chủ nhà chơi lại trên Mac

Yêu cầu Chủ nhà (12/10, sau khi chơi M1): màn hình mờ đục, sương bị sạn kiểu nhiễu hình, lửa napalm không tự nhiên, lag giật, cần tối ưu tối đa.

## ĐO TRÊN MAC (trước khi sửa)

Mở game trong trình duyệt của app Claude trên Mac (Apple, Metal 3, WebGPU, High, khung 1920 px), đọc telemetry:
- 937 draw call, 11,5 triệu tam giác mỗi khung; CPU dựng hình p95 24 ms, GPU p95 16,8 ms; độ phân giải động đã tụt về 0,65.
- Tắt riêng bóng cây (`?vegShadow=0`): còn 318 draw call, 5 triệu tam giác, khung 8 ms. Bóng cây là chi phí lớn nhất (mỗi cascade CSM vẽ lại mọi cây đổ bóng).
- Ảnh: tắt tia nắng thể tích + tia nắng màn hình thì cây tầm trung hết bị phủ trắng sữa; hạt phim 0,1 nhảy mỗi khung; mẫu dò tia thể tích lệch theo pixel không lọc.

## FILES CHANGED

Tạo mới:
- `src/engine/render/fireField.ts`: trường hạt lửa (lưỡi lửa, tàn lửa, quầng sáng đất) và khói, 4 InstancedMesh, đèn cố định số lượng gán cho đám gần camera.
- `evidence/DV-086/`: `mac-truoc-sau.jpg` (trái trước, phải sau, cùng cảnh mở màn trên Mac, kèm telemetry), `mac-lua-gan.jpg`, `mac-lua-khoi-xa.jpg`.

Sửa:
- `src/engine/render/post.ts`: hạt phim mặc định tắt; khử nhiễu GTAO; tia nắng màn hình không cộng chồng khi có tia thể tích; SSR theo `quality.ssr`; tia thể tích High 14 mẫu.
- `src/engine/render/volumetric.ts`: lọc 2 lượt giữ mép theo độ sâu (`?volblur=0` để so).
- `src/engine/render/quality.ts`: `shadowCascades` (High 2, Ultra theo level), `ssr` (chỉ Ultra), tầm bóng 0,7× ở Low/Medium/High; cờ `?cascades=`, `?ssr=`.
- `src/engine/level/daylight.ts`: số cascade theo quality; bật lớp chỉ-bóng cho camera bóng.
- `src/engine/vegetation/system.ts`: proxy bóng hình LOD1 cho cây ở gần (lớp chỉ-bóng).
- `src/engine/render/scaler.ts`: độ phân giải động bậc 0,1, tăng lại chậm (150 khung), nghỉ 90 khung giữa hai lần đổi.
- `src/engine/render/ambientFx.ts`: lửa/khói level dùng fireField; sửa `smoothstep` cạnh đảo.
- `src/game/game.ts`: lính xa hơn 35 m không đổ bóng; biên dịch sẵn pipeline trước khi vào chơi; nối cờ.
- `src/game/mission/battle.ts`: dùng fireField (24 đám lửa, 18 cột khói).
- `content/levels/truong-son-a.level.json`: grain 0, sương 0,012/m cao 1,8 m, tia thể tích 1,8, lift 0, tương phản 0,45; sỏi, đá bờ, đá rêu, rễ, cành hố bom không đổ bóng.
- Test: `aaa-pass2` (High 2 cascade, SSR chỉ Ultra), `aaa-pass3` (tầm nhìn sương 150 đến 400 m), `scaler` (tăng chậm hơn giảm).

## TEST RESULTS

- `npx tsc --noEmit`: 0 lỗi.
- `npx vitest run`: 297/297.
- E2E toàn bộ (webgl-ci): 23/23 (23 phút; 7 bỏ qua theo cờ), gồm test rừng (ngân sách draw call) và M1 7 hồi với lửa/khói mới.
- Mac, cùng cảnh mở màn M1 (High): **937 → 425 draw call, 11,5 → 6,7 triệu tam giác**; proxy bóng cây 0,18 triệu tam giác mỗi cascade thay cho hình LOD0.
- Mac, ảnh: xem `mac-truoc-sau.jpg` (trước: phủ sữa, độ phân giải động 0,65; sau: trong hơn, 1,00).

evidence_status: số draw call và tam giác đo trên Mac thật; fps trên Mac chưa đo lại được (khung trình duyệt của app bị ẩn nên trình duyệt ngưng vẽ), cần Chủ nhà chơi lại với `?overlay=1`.

## ISSUES

- Trung bình: chưa có số fps sau khi sửa trên Mac (lý do ở trên).
- Thấp: lửa và khói không ghi độ sâu nên lớp sương/tia thể tích tính như nền xa phía sau, khói ở xa nhạt hơn thực tế.
- Thấp: High không còn SSR (phản chiếu vũng nước); Ultra vẫn có.

## DEVIATIONS

- Đổi cấu hình High (2 cascade, không SSR) để tối ưu theo yêu cầu "tối đa"; Ultra giữ nguyên chất lượng.
- Sửa thêm `smoothstep` cạnh đảo còn sót trong `ambientFx.ts` (luật TSL).

## SUGGESTIONS

- Chủ nhà chơi lại M1 trên Mac với `?overlay=1` (fps, draw call, giật) và xem lửa napalm; nếu muốn bóng xa hơn thì thử `?cascades=3`.
- Nếu còn giật khi trực thăng/lính tiếp viện xuất hiện: thêm bước làm nóng sẵn mô hình lính và trực thăng lúc tải màn.
