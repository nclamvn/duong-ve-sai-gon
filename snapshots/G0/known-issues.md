# Known issues — G0

Tổng hợp tự động từ evidence/*/completion-report.md (2026-09-02T11:20:24.884Z).

## TIP-001
- [Low] TypeScript 7.0 đã bỏ `baseUrl` và bắt `paths` phải tương đối → đã sửa. Ghi vào AGENTS.md? Không cần; tsconfig là nguồn.

## TIP-002
- [Low] Với maxSubSteps = 5 (mặc định), frame > 83 ms bị bỏ bớt thời gian sim → đúng thiết kế chống spiral-of-death nhưng AC1 với gap ngẫu nhiên lớn nhất ~0.15 s bị clamp. Đã ghi `clampCount` vào telemetry để G0 bench thấy số lần hitch.

## TIP-003
- [Medium] `renderer.info.render.calls` trong WebGPURenderer là tổng `render()` tích lũy, không phải draw call/frame → đã đổi sang `drawCalls`. Nếu không phát hiện, telemetry sẽ báo sai gấp hàng trăm lần.
- [Low] SwiftShader chậm (~1–2 FPS ở 1280×800 + shadow 2048 + rain 20k) → thêm `?rain=N&shadow=N` để CI chạy nhanh; không ảnh hưởng build Mac.
- [Low] Rain hạt sát camera (< 0.5 m) hiện thành vạch to. Chấp nhận ở greybox; G4 xử lý bằng fade theo khoảng cách.

## TIP-004
- [Medium] Bench dùng thời gian thật (performance.now) cho `seconds`; ở máy 1–2 FPS, 90 s chỉ được ~150 frame — chấp nhận vì trên M1 Max 60 FPS → 5400 frame. Không dùng simTime vì clamp maxSubSteps làm sim chậm hơn thật.
- [Low] `performance.memory` chỉ có trên Chromium và thô (5 MB ở headless) → Safari sẽ ra `heap = null` → budget js_heap NA. Đúng thiết kế NA.
- [Low] `fps_avg` có `red: null` theo PRD → không bao giờ FAIL, chỉ WARN; FAIL đến từ `fps_1pct_low` (red 40). Đúng bảng PRD.

## TIP-005
- [Low] Khi grounded, vy giữ −0.5 rồi trừ gravity → hash hiện `vy = −0.66`; là giá trị "giữ tiếp xúc" cho snap-to-ground, không phải rơi. Ghi chú để người đọc hash không hiểu nhầm.
- [Low] Playwright screenshot timeout khi loop đang chạy trên SwiftShader (frame 500+ ms) → E2E TIP-009 sẽ `game.stop()` trước khi chụp.

## TIP-006
- [Low] Muzzle flash là plane phẳng gắn camera → hiện thành tam giác giữa màn hình ở góc nhìn headless. Greybox chấp nhận; G4 thay bằng sprite/billboard TSL.
- [Low] Dummy chết xoay group −90° quanh gốc chân → nằm dọc theo hướng nhìn, trong ảnh trông như capsule dựng. Không ảnh hưởng gameplay.
- [Info] AudioContext không khởi tạo trong headless (không user gesture) → `audio.ctx = null`, mọi call no-op. Đúng thiết kế; trên Mac click đầu tiên sẽ mở.

## TIP-007
- [Medium→fixed] Peek từ cover marker lệch 1.6 m vẫn bị block 6 m che → không bao giờ có LOS. Sửa: `findPeekPos` quét 1.6/3.2/4.8 m hai bên, chọn điểm đầu tiên có LOS (physics ray). Bài học: marker cần biết bề rộng cover — G2 nên bake `coverMarkers` kèm `width`.
- [Low] Ở REDUCED LOD bot chỉ think mỗi 5 ai-tick → path đầu tiên có thể trễ tới 0.5 s; stuck detector đo từ lúc có path nên không ảnh hưởng.
- [Low] Frame render SwiftShader ~0.5 s → probe 1500 frame vượt timeout; đã thêm `Game.stepSim(ticks)` (sim không render) — E2E TIP-009 dùng cách này.
- [Info] Bot không dùng Rapier character controller (kinematic body đẩy theo navmesh) — đủ cho G0; G2 cân nhắc collision bot–bot.

## TIP-008
- [Medium→fixed] `stateHash` ban đầu gồm `checkpointId` và `actors[].state` (FSM volatile) → hash sau restore luôn khác. Sửa: bỏ 3 trường volatile; hash so sánh trạng thái thật.
- [Low] Screenshot sau `stepSim` (không render) còn tracer/muzzle "đóng băng" vì FX cập nhật ở render; trong chơi thật biến mất sau 60 ms. E2E chụp sau ≥ 2 frame render.
- [Low] Sau restore, Bot FSM về PATROL (path/timer nội bộ không nằm trong snapshot) — đúng PRD "actor về snapshot" ở mức vị trí/máu/alive; G3 cân nhắc lưu waypointIndex/awareness.

## TIP-009
- [Medium→fixed] Playwright `devices['Desktop Chrome']` dùng UA Chrome thường (không "HeadlessChrome") → classifyEvidence xếp sandbox thành `non_reference_device`. Sửa: WebGL2 backend đọc `WEBGL_debug_renderer_info` → "SwiftShader" → sandbox. Trên Mac Chrome WebGL2 sẽ ra "ANGLE (Apple, Apple M1 Max, Metal)" → reference.
- [Low] Preview server cũ (từ probe trước) còn sống với plugin cũ làm 1 spec fail giả; `reuseExistingServer: true` tiện cho dev nhưng CI nên kill port 4173 trước. Ghi vào README? Đã ghi ở known-issues.
- [Info] `tests/e2e` import JSON cần đọc file thay vì `import` (Node ESM đòi import attribute).
