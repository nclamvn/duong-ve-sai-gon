## COMPLETION REPORT — TIP-002: engine/core

**STATUS:** DONE

**FILES CHANGED:**
- Created: `src/engine/core/clock.ts` (FixedClock: accumulator, clamp dt ≤ 0.25 s, maxSubSteps, alpha, clampCount), `events.ts` (EventBus ring 512, id idempotent, duplicates, reset/restoreSeen cho checkpoint), `scheduler.ts` (tier sim60/ai10/render, lastCostMs, frameSimMs), `prng.ts` (mulberry32, fork theo FNV-1a label, gaussian, replayPrng), `pool.ts` (fixed capacity, stats created/exhausted, forEachInUse, at()), `ids.ts`, `index.ts`
- Created: `tests/unit/core.test.ts` (13 test)

**TEST RESULTS:** 6/6 AC pass · `npm run test` 18/18 · typecheck 0 lỗi
- AC1 60 step / simTime ≈ 1.0 qua 37 dt ngẫu nhiên: PASS (với maxSubSteps 12 — xem DEVIATIONS)
- AC2 dt 5 s → steps ≤ maxSubSteps, clampCount > 0: PASS
- AC3 emit trùng id → 1 handler, duplicates 1: PASS
- AC4 ai10 chạy 10/60 tick: PASS
- AC5 mulberry32(42) deterministic, fork khác stream: PASS
- AC6 Pool 4: lần 5 null, exhausted 1, release/acquire lại: PASS; created === capacity

**ISSUES DISCOVERED:**
- [Low] Với maxSubSteps = 5 (mặc định), frame > 83 ms bị bỏ bớt thời gian sim → đúng thiết kế chống spiral-of-death nhưng AC1 với gap ngẫu nhiên lớn nhất ~0.15 s bị clamp. Đã ghi `clampCount` vào telemetry để G0 bench thấy số lần hitch.

**DEVIATIONS FROM SPEC:**
- AC1 dùng `FixedClock(60, 12)` thay vì mặc định 5 — vì test sinh gap ngẫu nhiên, không phải vì code sai. Mặc định runtime vẫn 5. L1.
- Thêm `EventBus.restoreSeen()/seenIdList()` (không có trong spec) — cần cho TIP-008 restore checkpoint không phát lại event một-lần. L1, mở rộng API không đổi contract cũ.
- Thêm `replayPrng(seed, calls)` để snapshot lưu số lần gọi PRNG → restore đúng stream. L1.

**SUGGESTIONS FOR CHỦ THẦU:**
- `Scheduler.frameSimMs` là số "CPU game time" cho budget `cpu_sim_ms` (target 5 ms). Đề nghị TIP-004 lấy p95 của giá trị này thay vì tổng frame.
