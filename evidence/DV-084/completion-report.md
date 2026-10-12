# DV-084 Completion Report: hành động kịch bản chiến trường

STATUS: DONE (hình lửa, khói, napalm chờ Chủ nhà xem trên Mac)

Theo BLUEPRINT-M1-T3 mục 4.3 và 4.4 (âm thanh).

## FILES CHANGED

Tạo mới:
- `src/game/mission/battle.ts`: bể lửa/khói dựng sẵn (14 lửa, 4 có đèn; 9 khói đen; 8 khói xám), đòn đánh, cối/pháo rơi quanh người chơi trong vùng, napalm theo dải với cặp F-4, vùng nóng gây bỏng, vùng an toàn, đồng đội hy sinh, hố nổ để lại lửa âm ỉ và khói.
- `tests/unit/missionDv084.test.ts` (2 test).

Sửa:
- `src/game/mission/types.ts`, `runtime.ts`, `content/schemas/mission.schema.json`: hành động `reinforce`, `fx`, `strike`, `napalm`, `mortar`, `squad_kill`, `safe_zone`; mục tiêu có `timerMs`; đợt tiếp viện chờ giữ được qua checkpoint; `group_dead` chưa đúng khi còn đợt chờ.
- `src/game/mission/missionHost.ts`: nối sự kiện chiến trường, đếm ngược mục tiêu lên HUD, bom B-52 để lại hố cháy.
- `src/engine/sky/traffic.ts`: lượt bay đi qua đúng một điểm theo hướng cho trước (`triggerThrough`).
- `src/engine/audio/audio.ts`: tiếng rít đạn tới, tiếng phụt lửa napalm.
- `src/ui/hud.ts`, `hud.css`, `content/locale/vi.json`: đếm ngược trên dòng mục tiêu, dưới 10 s đổi màu gấp.

## TEST RESULTS

- Unit: tiếp viện theo đợt dưới trần sống, checkpoint giữ đợt chờ, hành động phát sự kiện BATTLE, mục tiêu có đếm ngược: xanh.
- E2E M1 (DV-085) chạy thật mọi hành động: napalm 1 lượt, người chơi đứng trong dải bị bỏng, hơn 5 đám lửa; B-52 rải ≥ 35 quả, trong lòng suối không mất máu, không chịu sát thương ngoài vùng an toàn; cối và đòn đánh mở màn nổ ≥ 2 quả.

## ISSUES

- Thấp: lửa và khói dùng bể có hạn; khi quá nhiều vụ nổ cùng lúc, đám cũ nhất bị lấy lại sớm.
- Thấp: đèn lửa tối đa 4 cái; lửa thứ 5 trở đi không chiếu sáng xung quanh.

## DEVIATIONS

- (sửa thêm khi làm DV-085) Chỗ chưa dùng trong bể lửa/khói trước đây vẫn được vẽ ở dưới đất (y = −500), làm vượt ngân sách draw call của test rừng (319 > 280). Nay cất thì ẩn phần vẽ; đèn lửa giữ nguyên để số đèn không đổi (đổi số đèn làm biên dịch lại shader, giật khung).

## SUGGESTIONS

- Xem napalm và B-52 trên Mac ở High: nếu khói đen quá dày che tầm nhìn lâu, giảm `scale` hoặc `durationMs` của `fx` trong mission.

evidence_status: sandbox_swiftshader_lifecycle_only
