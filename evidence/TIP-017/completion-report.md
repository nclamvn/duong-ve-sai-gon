# Completion Report — TIP-017 Súng nằm trong tay (hiệu chỉnh đo được + IK tay trái lính)

STATUS: DONE (chờ Chủ nhà chấm trên Mac WebGPU)

## FILES CHANGED
- Mới: `src/engine/render/armIk.ts` (IK 2 khớp thuần, `findArmChain`, `solveTwoBone`), `src/qa/calib.ts` (`?calib=soldier|fp`: đèn sáng, orbit, helper trục/khớp ngón, `measure()`, `fit()`, `setHand()`, `exportJson()`), `tests/unit/armIk.test.ts`, `docs/tips/TIP-017.md`, `contracts/TIP-017.yaml`.
- Sửa: `fpArms.ts` (dùng armIk; rig kích thước thật; `debugInfo()`), `rifleProp.ts` (`applyGripPivot` = inverse(`fp.handR`)), `weaponModel.ts` (`poseToMatrix`, bỏ `hand`, `fp` bắt buộc), `visual.ts` (IK tay trái lính tới `gripL · fp.handL`, `ikEnabled`, `applyRawPose`), `viewmodel.ts` (`space` scale (k,k,1) = FOV viewmodel; súng kích thước thật; đèn fill 0,45 cd), `game.ts` (`aiPaused`, `viewModelHidden`, `fpOverride`; IK chạy ở scale 1 rồi ép lại; tay FP ẩn theo viewmodel), `debugApi.ts`/`main.ts` (calib), `content/weapons/ak74m.json`, `hk416.json` (fp từ fit, bỏ hand), schema, README (tham số calib), DECISIONS D-063..D-065.

## TEST RESULTS (AC)
- Lính HK416 (`?calib=soldier`, `measure()` sau `fit()` trên clip `rifle_aim`): gripR ↔ tâm cung ngón phải **0,3 mm** (aim), 3,6 mm (idle), 5,8 mm (walk); gripL ↔ tâm cung ngón trái **2,6 mm** (aim), 9,5 mm (idle), 7,8 mm (walk); IK tay trái sai số 0. Hướng súng trong hệ nhân vật: aim yaw 6,8° / pitch 2,3° / roll 0 (thẳng phía trước); idle/walk hạ nòng chéo trước người (yaw 75°, pitch 28°) đúng clip Mixamo. Span hai tay Mixamo 0,306 m ≈ gripR→gripL HK416 0,308 m. → PASS (≤ 1,5 cm / ≤ 2 cm).
- FP AK-74M (`?calib=fp`, cùng bộ số): tay phải 4,9 mm, tay trái 8,3 mm; tầm với 0,498 m, đích xa nhất 0,479 m (hip) → hai tay đều chạm anchor, IK err 0 ở hip/ADS/sprint. → PASS.
- Ảnh: `soldier-aim.png`, `soldier-aim-close.png`, `soldier-idle.png`, `soldier-walk.png` (calib, đèn sáng, low WebGL2), `fp-hip.png`, `fp-ads.png`, `fp-hip-level.png` (medium, đèn game). Số đo: xem log phía dưới.
- Unit: 98/98 (armIk 4 test mới; weapons schema `fp` bắt buộc). CI: `ci.log`.

## ISSUES
- (Thấp) Clip `rifle_idle`/`rifle_walk` của Mixamo cầm súng chéo thấp (yaw 75°) — đúng animation, nhưng khi bot ENGAGE đứng yên sẽ chơi `rifle_aim` (TIP-018) nên khi bắn súng luôn hướng mục tiêu.
- (Thấp) ADS: AK kích thước thật gần camera hơn → rail/thước ngắm to hơn TIP-014; muốn nhỏ lại chỉ cần tăng `view.sightDistance` (JSON), không sửa code.
- (Thấp) Tay FP không có animation ngón riêng khi nạp đạn (như TIP-016).

## DEVIATIONS
- D-065: đổi cấu trúc viewmodel sang nhóm ép FOV (k,k,1) với súng/tay kích thước thật — cần thiết vì tay 0,62 (0,31 m) không với tới ốp lót ở khoảng cách thật (0,46 m). Hình chiếu màn hình của súng gần như cũ (cùng k), nòng dài hơn (không còn thu theo z) — giống FPS thật.
- Bỏ trường `hand` trong JSON/schema (một sự thật `fp`), sửa test tương ứng.
- Sửa bug ẩn TIP-016 (D-064: scratch quaternion dùng chung → hướng bàn tay sai) — phát hiện nhờ unit test mới.

## SUGGESTIONS
- Chủ nhà mở `http://127.0.0.1:5173/?calib=soldier&post=off&rain=0&quality=medium` trên Mac để xem cận cảnh WebGPU; `?calib=fp` cho tay FP. Nếu muốn tay trái lính ôm ốp lót xa hơn/gần hơn: `__ht.calib.setHand('L', pos, rot)` rồi `exportJson()`.
- Khi thêm súng mới (G1: 3 vũ khí): đặt anchor gripR/gripL đúng tay cầm/ốp lót là đủ — `fp` dùng lại được vì bàn tay Mixamo không đổi.
