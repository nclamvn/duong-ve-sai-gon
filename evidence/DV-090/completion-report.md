# DV-090 Completion Report: chạy thục mạng, nằm bò, lửa nòng, nổ gần, quân đông, xin đạn (19/10/2026)

STATUS: DONE (chờ Chủ nhà chơi lại trên Mac). Sáu việc Chủ nhà nêu sau khi chơi M1 bản DV-088/089. Ba lựa chọn Chủ nhà duyệt:
- cho phép ngoại lệ DV-054;
- địch × 1,5 và thêm 6 bộ đội;
- 8 băng đạn và xin đạn đồng đội.

## FILES CHANGED
- created:
  - `tests/e2e/dv090.spec.ts` (E2E vật lý nằm bò, xin đạn, tiểu đội đi cùng, tư thế chạy).
  - `evidence/DV-090/*.png`.
  - `public/assets/voice/vi/sq_giveAmmo_*`, `sq_offerAmmo_*`: 42 file ElevenLabs.
- modified:
  - Nằm bò:
    - `src/engine/input/input.ts`: phím Z `prone` (edge);
    - `src/engine/physics/controller.ts`: tư thế `prone`, `canRise`, mắt trôi mượt `eyeH`, `forceStance`;
    - `content/tuning/player.json`: `proneHeight` 0,8, `proneEye` 0,42, `move.prone` 0,9;
    - `src/game/player/player.ts`: hồi sinh/checkpoint đặt tư thế đúng collider; nằm lưu thành cúi;
    - `src/game/weapons/weapon.ts`: `crawling` thì không bắn; nằm yên chụm hơn.
  - Tay + súng:
    - `src/game/weapons/viewmodel.ts`: `poseArtist`, xoay cả khối quanh tâm khối; `poseTune` dữ liệu;
    - `vmStates.ts`, `artistViewmodel.ts`: `busy`, để không xoay khi đang bắn hoặc nạp.
  - Lửa nòng, `src/game/weapons/fx.ts`:
    - quầng sáng `glows`;
    - chớp to và sáng hơn;
    - tia lửa và khói nhiều hơn;
    - đèn nòng 12.
  - Nổ gần:
    - `src/engine/render/blastFx.ts`: `spray` (đất đá vụt qua mặt);
    - `src/game/game.ts`: bùn kính chỉ khi thấy vụ nổ, bùn tới trễ theo khoảng cách;
    - `src/game/mission/battle.ts`: cối rơi phía trước 70 %.
  - Quân đông:
    - `content/missions/truong-son-a.mission.json`: địch × 1,5, trần 24, nhóm `ban`, 24 đám cháy/khói;
    - `content/levels/truong-son-a.level.json`: điểm `ban1..6`;
    - `src/game/mission/missionHost.ts`: dùng lại điểm theo vòng, nhóm bạn không tên vào `support`;
    - `src/game/ai/squadmates.ts`: `slotBase`, `giveAmmo`, `offerAmmo`;
    - `src/game/game.ts`: `support` Squadmates, sát thương ½ cho bộ đội không tên, lệnh người chơi cho cả hai.
  - Đạn:
    - `content/tuning/weapons.json`: AK dự trữ 240;
    - `src/game/game.ts`: `stepResupply`;
    - `content/voice/squad-barks.json`: `giveAmmo` 5 câu, `offerAmmo` 4 câu;
    - `content/locale/vi.json`: `hud.prompt.ammo`, gợi ý phím Z và xin đạn.
  - Tests:
    - `tests/unit/m1Dv085.test.ts`: số địch mới, trần 24;
    - `tests/e2e/level-truong-son.spec.ts`: số địch mới, 6 bộ đội, lọc người có tên;
    - `tests/e2e/shell-shock.spec.ts`: nổ sau lưng thì không bùn, nổ trước mặt thì có đất đá vụt qua và bùn.
  - `docs/DECISIONS.md`: dòng DV-090.

## TEST RESULTS
- Typecheck 0 lỗi. Unit 304/304.
- E2E `dv090` (sandbox SwiftShader), kết quả đo được:

  | Việc | Kết quả |
  |---|---|
  | Nằm | mắt 1,68 → 0,42 m, capsule 0,8 m |
  | Bò 2 s | 1,67 m, 0 phát bắn khi đang bò |
  | Nằm yên | bắn được |
  | Z lần nữa | đứng dậy, mắt 1,68 m |
  | Quân ta | 11 người (5 có tên + 6 không tên) |
  | Xin đạn | dự trữ 0 → 60 sau khi giữ F |
  | Chạy thục mạng | khối tay súng xoay 0,7 rad sang trái, dừng chạy thì về 0 |

- E2E `shell-shock`: nổ 3 m sau lưng thì 0 bùn, 0 đất vụt; nổ 3 m trước mặt thì 1 lượt đất vụt, 1 lần bùn.
- Toàn bộ E2E webgl-ci: 26 pass, 1 fail, 9 skip, 27,7 phút.
  - Lỗi duy nhất: test vật lý Trường Sơn đếm 5 bot quân ta; nay có 11 (thêm 6 bộ đội) → sửa số trong test, chạy lại đạt.
  - Test M1 đầy đủ (mọi điểm ra quân, kể cả `ban1..6`, bám navmesh; 7 hồi; số địch mới) đạt.
- Ảnh (`evidence_status: sandbox_swiftshader_lifecycle_only`):
  - `01` chạy thục mạng;
  - `02` bò;
  - `03` lửa nòng một phát giữa ban ngày.

## ISSUES
- Trung bình: chưa chơi trên Mac.
  - Cần chấm: góc súng khi chạy, độ to lửa nòng, mật độ địch, có tụt fps khi 24 địch + 11 quân ta.
  - Hệ số tư thế nằm ở `viewModel.poseTune`, chỉnh nhanh được.
- Thấp: bộ đội không tên chưa có giọng hô; khi hy sinh, tổ chưa gào.

## DEVIATIONS
- Không có ngoài các lựa chọn Chủ nhà duyệt.

## SUGGESTIONS
- Nếu thấy tụt fps: hạ trần sống cùng lúc về 20 ở tier High, giữ 24 ở Ultra.
- Gói B (thương binh bò, kéo đồng đội) cần clip Mixamo.
- Có thể cho bộ đội không tên chết theo kịch bản ở hồi sườn đồi (nhịp Normandy).
