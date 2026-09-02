## COMPLETION REPORT — TIP-007: Navmesh + Bot AI

**STATUS:** DONE

**FILES CHANGED:**
- Created: `src/engine/nav/navmesh.ts` (NavService: generateSoloNavMesh cs 0.3/ch 0.2/radius 0.4/climb 0.35/slope 50°, nearest/findPath/randomAround, polyCount, buildMs), `content/tuning/ai.json`
- Created: `src/game/ai/perception.ts` (FOV 110°, sight 40 m, hearing 25 m, suspicion gain theo khoảng cách, decay 0.25/s, ALERT memory 6 s → SUSPICIOUS → UNAWARE, lastKnown), `cover.ts` (score marker: gần, chắn LOS, mặt hướng threat, không quá gần), `lod.ts` (FULL/REDUCED/SLEEP + isOnScreen), `bot.ts` (FSM 5 state + DEAD, timeout/fallback mỗi state, peek/cover cycle với tìm vị trí ló ra có LOS, burst 3/cooldown 350/reload 2 s, retreat khi máu < 30 hoặc hết đạn, stuck detector 2 s replan → 4 s teleport, dùng chung `resolveShot` với mask WORLD|PLAYER, snapshot/restore)
- Created: `src/game/actors/botActor.ts` (glue Bot + Dummy + ActorBody)
- Modified: `src/game/game.ts` (initNav + NavService từ 213 nav mesh ArenaData, NavMeshHelper F4, spawnBot/despawnBot, tier ai10 think + actorStats full/total, sim60 move + syncBody, HIT routing player/bot/dummy, BOT_FIRED → audio 3D, `stepSim(ticks)` cho QA), `src/game/weapons/hitscan.ts` (hitMask param; kind 'player' là mục tiêu hợp lệ), `fx.ts` (tracer cho BOT_FIRED), `audio.ts` (gunshotAt positional)
- Created: `tests/unit/ai.test.ts` (9 test, arena thu nhỏ 80×80 dựng từ three core + recast trong Node)

**TEST RESULTS:** 6/6 AC pass · unit 61/61 · typecheck 0 · build OK
- AC1 navmesh: polyCount > 0 (arena thật: 833 poly, build 137 ms trong sandbox), path spawn→spawn ≥ 2 điểm, không điểm nào trong cover (+0.3 m), phải vòng qua block ở (0,−22): PASS
- AC2 perception: 10 m trong FOV có LOS 1 s → ALERT; mất LOS → ALERT giữ 6 s → SUSPICIOUS → UNAWARE; lastKnown giữ: PASS. Sau lưng có LOS → không thấy: PASS
- AC3 noise súng 15 m → SUSPICIOUS, lastKnown = vị trí súng; 30 m → không nghe: PASS
- AC4 FSM 3 phút × 10 seed (player đứng yên bắn mỗi 0.67 s, bị trúng nhẹ mỗi 10 s): không state vượt timeout (> 120 ms), bot bắn ≥ 1, có SEEK_COVER/PEEK_FIRE, không exception → 10/10: PASS. Deterministic: cùng seed → cùng snapshot + shots sau 30 s.
- AC5 stuck giả: replan sau ≤ 2 s kể từ khi có path; teleport ≤ 4 s, event AI_STUCK_RECOVERED: PASS
- AC6 LOD: mục tiêu > 60 m → SLEEP, `perceptionUpdates = 0` suốt 5 s; bảng computeLod (70/UNAWARE→SLEEP, 45→REDUCED, ALERT→FULL, offscreen 6 s→SLEEP): PASS
- Browser probe (WebGL2, `stepSim`): bot_a tuần tra 14.6 m/5 s ở SLEEP (player cách 80 m); player teleport cách 17 m bắn lên trời → INVESTIGATE → SEEK_COVER → PEEK_FIRE, bot bắn 16, trúng player 5 (máu 100 → 60), 0 stuck, 0 timeout, AI cost ai10 < 0.1 ms; `actorStats {full 1, total 9}`. Screenshot `evidence/TIP-007/bot-webgl.png` (bot ở giữa, tracer).

**ISSUES DISCOVERED:**
- [Medium→fixed] Peek từ cover marker lệch 1.6 m vẫn bị block 6 m che → không bao giờ có LOS. Sửa: `findPeekPos` quét 1.6/3.2/4.8 m hai bên, chọn điểm đầu tiên có LOS (physics ray). Bài học: marker cần biết bề rộng cover — G2 nên bake `coverMarkers` kèm `width`.
- [Low] Ở REDUCED LOD bot chỉ think mỗi 5 ai-tick → path đầu tiên có thể trễ tới 0.5 s; stuck detector đo từ lúc có path nên không ảnh hưởng.
- [Low] Frame render SwiftShader ~0.5 s → probe 1500 frame vượt timeout; đã thêm `Game.stepSim(ticks)` (sim không render) — E2E TIP-009 dùng cách này.
- [Info] Bot không dùng Rapier character controller (kinematic body đẩy theo navmesh) — đủ cho G0; G2 cân nhắc collision bot–bot.

**DEVIATIONS FROM SPEC:**
- `engageRange` 30 → 40 (= sightRange): bot thấy là bắn; 30 làm bot đứng nhìn ở 31 m. L1.
- PEEK_FIRE reset `stateMs` khi bắn (có hoạt động) để timeout 6 s chỉ bắt deadlock, không cắt giao tranh hợp lệ. L1.
- Bot spawn sẵn 1 con (`bot_a`, group `ambient`) từ init thay vì chờ mission; TIP-008 spawn thêm group qua mission node. L1.

**SUGGESTIONS FOR CHỦ THẦU:**
- `navBuildMs` (137 ms sandbox) nên vào telemetry boot để G2 quyết pre-bake (ADR-003 nói ngưỡng 50–200 ms).
- Bot damage 8/viên, 5 trúng trong 20 s ở 17 m → khá "hiền"; balance thuộc G2, không chỉnh ở G0.
