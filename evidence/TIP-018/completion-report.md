# Completion Report — TIP-018 AI chiến đấu có "IQ"

STATUS: DONE (chờ Chủ nhà chơi thử trên Mac)

## FILES CHANGED
- `src/game/ai/bot.ts` (viết lại phần chiến đấu: ENGAGE/FLANK mới, bắn khi di chuyển trong nón trước mặt, cover chỉ khi chắn LOS ≤ 12 m, dịch chuyển ngắn, ló/nấp có jitter, đạn sượt, ngắm ngực + độ chụm settle, `aiming` cho visual, `orderFlank`), `src/game/ai/squad.ts` (mới: tổ ép sườn), `src/game/ai/cover.ts` (`blocked`), `src/game/actors/botActor.ts` (aiming từ bot), `src/game/game.ts` (tiếng chân chạy nước rút → `PLAYER_FOOTSTEP`; `SquadCoordinator.tick`), `content/tuning/ai.json` (mở rộng, cover.maxSearch 25 → 12, mag 20 → 30, cooldown 350 → 110 ms trong loạt), `tests/unit/ai.test.ts` (+6 test TIP-018), `docs/tips/TIP-018.md`, `contracts/TIP-018.yaml`, DECISIONS D-066.

## TEST RESULTS (AC)
- Unit `ai.test.ts` 15/15: player 6 m trước mặt → phát đầu ≤ 0,8 s, ENGAGE trước SEEK_COVER ✔; không cover ≤ 12 m → ≥ 4 loạt/10 s, trôi ≤ 4 m, mặt hướng player > 80 % mẫu ✔; có cover chắn LOS → SEEK_COVER (bắn khi trong nón) → PEEK_FIRE ≤ 6 s, bắn khi ló ✔; 3 bot cùng nhóm → đúng 1 FLANK trong 3 s ✔; tiếng chân 6 m sau lưng → SUSPICIOUS + lastKnown ✔; deterministic ✔; test TIP-007 cũ (timeout, stuck, LOD, checkpoint) vẫn xanh.
- Probe headless (`evidence/TIP-018/probe-front.txt`, `probe-shoot.txt`): player đứng 2–6 m trước mặt bot → ENGAGE tại 0,8 s, phát đầu < 1 s, 13 phát/7 s (4 loạt), player 100 → 0 HP trong ~7 s; sau khi mất mục tiêu: ENGAGE → INVESTIGATE tới vị trí cuối → PATROL (không nhấp nháy state).
- CI: xem `evidence/TIP-017/ci.log` (chạy chung).

## ISSUES
- (Trung bình — thiết kế) Sát thương: một bot ở 4 m hạ player đứng yên trong ~7 s, 3 bot ≈ 2–3 s; player không hồi máu. Đề nghị Chủ nhà chơi thử rồi quyết: (a) hồi máu kiểu CoD (sau 5 s không trúng đạn, 20 HP/s) — thay đổi PLY, cần D-xxx; (b) hạ `damage` 8 → 6 hoặc tăng `spreadFirstDeg`.
- (Thấp) Di chuyển ngắn khi ENGAGE là trượt thẳng (không có clip bước ngang) — chấp nhận ở G0.6, ghi nợ animation.
- (Thấp) Bot không bắn khi mục tiêu ngoài nón 60° phía trước lúc đang chạy (cố ý: không bắn quay lưng).

## DEVIATIONS
- `PATROL/INVESTIGATE → ENGAGE` khi chưa thấy chỉ xảy ra nếu vừa bị bắn/đạn sượt (`suppressedMs`); nếu chỉ nghe → INVESTIGATE tiến lên (tránh nhấp nháy ENGAGE↔INVESTIGATE thấy trong probe đầu).
- `states.ENGAGE` timeout 20 s (bắn reset stateMs) để không rơi về PATROL giữa trận.

## SUGGESTIONS
- G1: clip `rifle_strafe`/`rifle_walk_aim` Mixamo cho di chuyển khi bắn; lựu đạn; barks tiếng Việt khi phát hiện/ép sườn ("Bên trái!", "Ép sườn!") — SQD-002 sẵn cấu trúc.
