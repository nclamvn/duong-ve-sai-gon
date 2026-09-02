## COMPLETION REPORT — TIP-004: Telemetry overlay + Replay + Bench harness

**STATUS:** DONE

**FILES CHANGED:**
- Created: `src/qa/telemetry.ts` (ring buffer 11 kênh Float32Array, p95/p99, 1% low, heap trend, hitch > 50 ms, gpu_method), `src/qa/budget.ts` (đối chiếu budget → PASS/WARN/FAIL/NA, verdict), `src/qa/bench.ts` (runBench: reset → warm-up 2 s → ghi → median theo frame_p95 → report theo schema → POST /__bench, fallback tải file; classifyEvidence → `evidence_status`), `src/ui/overlay.ts` (DOM 4 Hz, màu theo budget, F3), `src/engine/input/input.ts` (InputSnapshot/InputSource, KeyboardMouseInput với edge/hold, pointer-lock-aware), `src/engine/input/replay.ts` (InputTrack keyframe, ReplayPlayer, makeArenaTrack seeded), `src/engine/render/quality.ts` (preset low/medium/high — adopt suggestion TIP-003)
- Modified: `src/game/game.ts` (input source hoán đổi được, telemetry sample mỗi frame, quality preset, resolveTimestampsAsync cho GPU time, actorStats), `src/main.ts` (overlay + bench flow), `src/qa/debugApi.ts` (summary, benchReport, benchSaved), `src/engine/input/freeFly.ts` (tiêu thụ InputSnapshot ở sim tick thay vì DOM listener riêng)
- Created: `tests/unit/telemetry.test.ts` (9 test: telemetry, replay, budget, median)

**TEST RESULTS:** 5/5 AC pass · unit 31/31 · typecheck 0
- AC1 Telemetry 980×16 + 20×40 → p95 16.0, p99 40, 1% low 25 fps, frames 1000: PASS
- AC2 makeArenaTrack(7, 90) ×2 deep-equal; seed 8 khác: PASS
- AC3 headless WebGL2 `?bench=1&runs=1&seconds=3&quality=low`: POST /__bench sau 6.2 s, file `performance-report-*.json` hợp lệ schema (ajv), verdict FAIL, `evidence_status = sandbox_swiftshader_lifecycle_only`: PASS (file mẫu chuyển sang `evidence/TIP-004/performance-report-sandbox-sample.json` để không lẫn với evidence G0 thật)
- AC4 Overlay F3 toggle; `intervalMs = 250` → ≤ 4 cập nhật/giây (counter `updates`): PASS
- AC5 budget fps 50 (target 60/red null) → WARN; 35 với red 40 → FAIL: PASS

Bất ngờ có ích: EXT_disjoint_timer_query_webgl2 hoạt động cả trên SwiftShader → `gpu_method = timestamp_query` (1964 ms/frame, đúng bản chất software GPU).

**ISSUES DISCOVERED:**
- [Medium] Bench dùng thời gian thật (performance.now) cho `seconds`; ở máy 1–2 FPS, 90 s chỉ được ~150 frame — chấp nhận vì trên M1 Max 60 FPS → 5400 frame. Không dùng simTime vì clamp maxSubSteps làm sim chậm hơn thật.
- [Low] `performance.memory` chỉ có trên Chromium và thô (5 MB ở headless) → Safari sẽ ra `heap = null` → budget js_heap NA. Đúng thiết kế NA.
- [Low] `fps_avg` có `red: null` theo PRD → không bao giờ FAIL, chỉ WARN; FAIL đến từ `fps_1pct_low` (red 40). Đúng bảng PRD.

**DEVIATIONS FROM SPEC:**
- Kéo `KeyboardMouseInput` + pointer lock cơ bản từ TIP-005 sang TIP-004: bench cần một InputSource hoán đổi được (replay ↔ bàn phím) ngay bây giờ; TIP-005 chỉ còn tinh chỉnh settings/raw input. L1 — không đổi contract, giảm rework.
- Thêm `?quality=low|medium|high` (REN-002 sớm) theo suggestion TIP-003. L1.

**SUGGESTIONS FOR CHỦ THẦU:**
- Phán quyết G0 nên đọc `evidence_status === 'measured_on_reference_device'` + `verdict`; hai giá trị này in ngay trên overlay sau khi bench xong nên có thể chụp màn hình làm bằng chứng.
- Bench trên Mac nên chạy ở cửa sổ 1920×1200 (viewport ghi vào report) để đúng "render nội bộ 1920×1200 default" của PRD §4.1.
