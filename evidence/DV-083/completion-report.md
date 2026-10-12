# DV-083 Completion Report: AI địch khôn hơn, đồng đội vào trận đúng nhịp

STATUS: DONE (cảm giác trận đánh chờ Chủ nhà chơi thử trên Mac)

Theo BLUEPRINT-M1-T3 mục 4.1 và 4.2 (mục 1, 2).

## FILES CHANGED

Tạo mới:
- `src/game/ai/sightOcclusion.ts`: tầm nhìn bị lùm cây, dương xỉ che (lấy mẫu 1,5 m dọc tia, bỏ 2 m đầu và cuối).
- `tests/unit/aiDv083.test.ts` (4 test).

Sửa:
- `src/game/ai/bot.ts`: cờ `hunter` (cập nhật vị trí người chơi mỗi 2,5 s, lệch ±4 m), vào trận thì về tốc độ chiến đấu, soi tầm nhìn mỗi nhịp nghĩ, che tầm nhìn theo thảm thực vật, đồng đội sau trận quay về tổ thay vì đi điều tra.
- `src/game/ai/squad.ts`: chia lại vai trò mỗi 4 s, vòng sườn khi còn từ 2 người, chia sẻ địch giữa các tổ trong 60 m, đạo diễn áp lực (người chơi khuất quá 3 s thì hai địch gần nhất xông lên, hồi 7 s), không lùi khi tổ có thợ săn.
- `src/game/ai/squadmates.ts`: nhịp `assault` (Quyết chạy tới điểm kế, chờ khi người chơi tụt quá 18 m; tổ chạy hàng so le).
- `src/engine/vegetation/system.ts`: lưới che phủ thảm thực vật 2 m (`understoryGrid`).
- `src/game/game.ts`: ưu tiên mục tiêu người chơi, địch ngã gục làm địch trong 35 m báo động, nạp lưới che tầm nhìn (`?vegsight=0` để so).
- `content/tuning/ai.json`, `content/tuning/grenade.json`: vé tấn công 4, bắn thật khi không có vé, phát cảnh cáo 1, lựu đạn địch 2 quả mỗi người.
- `tests/unit/aiT1.test.ts`: ngưỡng tổ lùi mới (mất 1/3 quân).

## TEST RESULTS

- `npx tsc --noEmit`: 0 lỗi.
- `npx vitest run`: toàn bộ xanh (xem DV-085).
- E2E `ai-t1` (trận dốc 4 giữ + 4 vòng sườn với tổ 5 người, 45 s): xanh; 139 phát của tổ ta, 119 phát của địch, 63 lần lao xen kẽ (59 có yểm trợ), 6 lệnh vòng sườn (3 thành), 34 lần chia lại vai trò, 20 lần chia sẻ địch, 0 phát bắn khi đang chạy.

## ISSUES

- Trung bình: độ khó tăng rõ (4 địch bắn thật cùng lúc). Cần Chủ nhà chơi thử để chỉnh `ai.json` (vé, tản đạn, sát thương lên người chơi).

## DEVIATIONS

- Không có.

## SUGGESTIONS

- Chỉnh độ khó sau khi Chủ nhà chơi thử (vé tấn công, tản đạn khi không có vé, sát thương lên người chơi).

evidence_status: sandbox_swiftshader_lifecycle_only
