## COMPLETION REPORT — TIP-008: Mission node + Schema + Checkpoint + Debug API

**STATUS:** DONE

**FILES CHANGED:**
- Created: `content/missions/g0-arena.mission.json` (6 node: n_intro → n_zone[zone_enter, timeout 60 s → n_timeout] → n_clear[group_dead] → n_saved[D05, relay_cut, cp0] → n_done[terminal, mission_complete]; 2 zone; 1 spawnGroup ×2), `content/missions/g0-dialogue.json` (5 cue D01/D02/D03/D05/D06 với priority/interruptPolicy/durationMs)
- Created: `src/game/mission/types.ts` (allow-list ACTION_TYPES 7 / CONDITION_TYPES 5, kiểu record §8), `loader.ts` (ajv strict + kiểm tham chiếu node/zone/group/cue/checkpoint; MissionValidationError liệt kê path), `runtime.ts` (graph executor: enterConditions → actions idempotent id `${mission}:${node}:${idx}` → exitConditions → next; timeout/fallback; snapshot/restore xóa state cũ + EventBus.reset + restoreSeen), `checkpoint.ts` (CheckpointStore memory + IndexedDB, stateHash canonical bỏ tick/timers/checkpointId/actor FSM state), `missionHost.ts` (MissionWorld adapter: spawnGroup → bots, captureWorld/restoreWorld, prompt F cắt relay, subtitles theo sim time, radio ducking, HUD objective)
- Created: `src/ui/subtitles.ts` (priority/interrupt/queue/drop, speaker label, scale/bg theo settings)
- Modified: `src/game/game.ts` (MissionHost trong init, mission.step trong sim sau physics, Enter → respawn từ checkpoint), `src/qa/debugApi.ts` (teleport, setSeed, stateHash, reset, stepSim, kill, mission.*, checkpoint.*, events.*, bots)
- Modified: `src/game/ai/bot.ts` (event `NODE_TIMEOUT` của bot đổi tên `AI_TIMEOUT` tránh trùng mission), `loader.ts`/`bench.ts` (thông báo dev sang tiếng Anh theo D-008)
- Created: `tests/unit/mission.test.ts` (9 test), `tests/unit/i18n.test.ts` (2 test: grep literal tiếng Việt trong src/, key đủ)

**TEST RESULTS:** 7/7 AC pass · unit 72/72 · typecheck 0 · build OK
- AC1 mission hợp lệ load OK; action `explode_map` → reject với path `/nodes/1/actions/0/type`; tham chiếu sai (next/group) → reject: PASS
- AC2 vào relay_zone → D03 phát 1 lần, spawn 1 lần dù zone_enter đúng 5 tick liên tiếp; phát lại action cùng id → `duplicates = 1`, không spawn thêm: PASS
- AC3 group chết → n_saved (D05, relay_cut, obj_clear_relay complete, checkpoint cp0) → n_done → MISSION_COMPLETE đúng 1 lần, duplicates 0: PASS
- AC4 restore ×20: chơi thêm 30 s (player đổi vị trí, mag 3, actor "ma", event rác) → restore(S) → hash === hash lúc lưu, actor count đúng, event ring rỗng, CHECKPOINT_SAVED không phát lại → 20/20 (unit, FakeWorld) và **20/20 trong browser** (Game thật: bots/dummies/player/weapon): PASS
- AC5 n_zone timeout 60 s → NODE_TIMEOUT, fallback n_timeout (D06 1 lần, alarm_state) → quay lại n_zone; lần 2 timeout tiếp nhưng D06 không lặp: PASS
- AC6 PROD không `?debug=1` → `window.__ht` undefined: gate trong `installDebugApi` (import.meta.env.PROD) — kiểm E2E TIP-009.
- AC7 grep literal tiếng Việt trong `src/**/*.ts` ngoài i18n.ts → 0 (sau khi chuyển thông báo dev sang tiếng Anh): PASS
- Browser probe (WebGL2, stepSim): D01 hiện đúng chuỗi vi.json; teleport relay_zone → prompt "F — Cắt relay phụ", 2 bot spawn group; kill → n_done; checkpoint saves 1; restore 20/20 hash khớp (`28af73c3`); sau restore chạy 5 s → n_done, MISSION_COMPLETE count 1 (phát lại đúng 1 lần vì snapshot trước khi hoàn thành). Screenshot `evidence/TIP-008/mission-webgl.png`.

**ISSUES DISCOVERED:**
- [Medium→fixed] `stateHash` ban đầu gồm `checkpointId` và `actors[].state` (FSM volatile) → hash sau restore luôn khác. Sửa: bỏ 3 trường volatile; hash so sánh trạng thái thật.
- [Low] Screenshot sau `stepSim` (không render) còn tracer/muzzle "đóng băng" vì FX cập nhật ở render; trong chơi thật biến mất sau 60 ms. E2E chụp sau ≥ 2 frame render.
- [Low] Sau restore, Bot FSM về PATROL (path/timer nội bộ không nằm trong snapshot) — đúng PRD "actor về snapshot" ở mức vị trí/máu/alive; G3 cân nhắc lưu waypointIndex/awareness.

**DEVIATIONS FROM SPEC:**
- Phụ đề cập nhật ở sim tick thay vì render → deterministic và test được bằng `stepSim` (không cần render SwiftShader chậm). L1.
- Thêm `objective_complete obj_reach_relay` vào n_zone để HUD sau load checkpoint hiển thị đúng objective active. L1 (content, không đổi schema).
- Prompt "F — Cắt relay phụ": nhấn F đặt flag `relay_cut` ngay (PLY-004 tối giản) song song với n_saved cũng set flag — không xung đột.

**SUGGESTIONS FOR CHỦ THẦU:**
- Mission JSON đã đủ để AI sinh/đổi kịch bản mà không chạm engine (PRD §8): 7 action, 5 condition. Đề nghị G3 thêm `door`, `timer_start`, `play_music` vào allow-list qua ADR, không hard-code.
- `respawn()` nạp checkpoint gần nhất; nếu chưa có → reset mission. PRD §6.5 "Fail" còn thiếu điều kiện "An health" và "timer cứu trợ" — thuộc G3.
