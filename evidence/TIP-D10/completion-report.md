# Completion Report — TIP-D10: AK-47/Type 56 1971 — súng người chơi (GF01)

STATUS: **PARTIAL** — bước 1 + 2 xong trong sandbox (WebGL2/SwiftShader); còn **ảnh Mac WebGPU do Chủ nhà chấm** (hip/ADS/reload) và **chữ ký cố vấn** (`approved: false` giữ nguyên).

## FILES CHANGED
Bước 1 (2a91795): `scripts/lib/bake-skins.mjs`, `scripts/convert-weapon.mjs`, `scripts/weapon-profile.mjs`, `public/assets/weapons/ak47.glb` (KTX2 2,78 MB), `content/weapons/ak47.json`, manifest `weapon_ak47` (CC-BY-4.0 Aleksei Vlasov/CRWDE, `historical/registryId wpn.pavn.type56_rifle/approved:false`), `src/game/game.ts` (`?weapon=`), `tests/unit/weapons.test.ts`, CREDITS.

Bước 2 (commit này)
- `content/weapons/ak47.json` — `fp.handR/handL`: lần đầu từ `fit()` (clip `rifle_aim`, L raw 8,1 cm → cổ tay gập trên Mac); **sửa:** dùng pose AK-74M đã kiểm Mac (TIP-017), measure R 4,9 mm / L 8,3 mm.
- `content/tuning/weapons.json` — entry **`ak47`**: 600 v/ph, băng 30/120, sát thương 80/34, reload 2 500 ms, ADS 210 ms (khoảng thử 180–240, GUN-201), FOV ADS 58, recoil 10 viên giật đứng 1,3→0,85° lệch phải, noise 0,2, viewKick 0,42, spread hip 2,2/3,8 ADS 0,35, xuyên gỗ/bạt 0,4 m, tầm 250 m. Không phải thông số thực — tinh chỉnh bằng người chơi.
- `src/game/game.ts` — `Weapon` dùng tuning theo khẩu (`ak47` ↔ `ak47`; `ak74m` giữ `ar_v1`); `botWeaponId` + `?botWeapon=` (bot/dummy cầm khẩu chọn — calib và lính QGP D11); `audio.gunshot(e.weapon)`.
- `src/qa/calib.ts` — `soldierWeaponId = game.botWeaponId` (thay `?calibWeapon`).
- `src/game/weapons/viewmodel.ts` — reload với súng **một mesh** (`parts: {}`): tay trái vẫn đi xuống anchor `magazine` rồi lên (lắc-khoá), thân súng dip; bolt không có → bỏ qua. Không đổi hành vi AK-74M/HK416.
- `src/engine/audio/audio.ts` — `gunshot(weaponId)`: hồ sơ `ak47` trầm hơn (4,2 kHz/620 Hz/220 Hz, thân 170 ms, đuôi 560 ms); `impact('earth')` đục ngắn 380 Hz/120 ms (GUN-202, vật liệu terrain D04).
- `src/game/weapons/fx.ts` — impact `earth`: 5 puff bụi to hơn, lâu hơn, không tia lửa.
- `tests/unit/weapons.test.ts` — +1 test tuning `ak47` (600 v/ph, băng 30, ADS 180–240, recoil 10 viên đứng > ngang, RELOADING trần > reload, giật viên đầu > AR-V1).
- Evidence: `evidence/TIP-D10/{calib-soldier-aim,sandbox-hip,sandbox-ads,sandbox-fire,sandbox-reload}.png`, `measure.txt`, `ci.txt`.

## TEST RESULTS (theo AC)
| AC | Kết quả |
|----|---------|
| `?weapon` mặc định ak47; ak74m fixture; `weapons.test` PASS; `assets:validate` 0 lỗi; manifest historical+registryId+approved=false | **PASS** — unit 118/118 (7 test weapons), CI xanh (`ci.txt`: typecheck, unit, build, e2e 8/8 5,2 phút) |
| Mac `?calib=fp`: `measure()` R/L ≤ 1,5 cm; tay trái trên ốp lót; ảnh hip/ADS/sprint Chủ nhà chấm | **PARTIAL** — pose fit() lần đầu (L raw 7,8 cm) bị Chủ nhà chấm trên Mac: "cánh tay như bị tật" (cổ tay trái gập, `evidence/TIP-D11a/mac-fp-hip-before-fix.png`) → **đổi sang pose AK-74M đã kiểm Mac** (TIP-017; DV-029) → Chủ nhà chấm lần 2: "ngón cái không sát súng, ngón khác xuyên súng" → đo khớp ngón trong hệ anchor (`measure.txt`): gripL cũ −0,13 nằm ở đầu hộp khoá nòng, lòng ngón lệch trái 3 cm, ngón cái giơ thẳng 8,5 cm. Sửa: gripL = tâm ốp lót (silhouette), handL.pos dịch phải/lên, hip.pos gần hơn 2 cm (tầm với), ngón cái trái khép quanh −z (`fpArms THUMB_L_CLOSE`) → Index2 chạm đáy ốp, Index4/Middle4 ở góc trên-trái/mặt trái ngoài ốp, Thumb4 trên mép trái-trên (`sandbox-hip.png`, `sandbox-ads.png`). `measure().L` 2,1 cm là trọng tâm ngón so anchor (không phải xuyên) — AC ≤ 1,5 cm đổi thành **ảnh Chủ nhà chấm** |
| ADS 180–240 ms; reload có thời điểm nạp xác định; không lỗi console | **PASS** — ADS 0→1: 13 tick = 217 ms (adsMs 210); bắn 40 frame @60 Hz: 7 viên (600 v/ph ✓), 7 IMPACT, recoil pitch tích luỹ 0,94° sau hồi; reload 28 → RELOADING (2 500 ms) → IDLE 30/118, `RELOAD_END` ×1, tay trái xuống băng rồi lên (`sandbox-reload.png`); 0 lỗi console |

## ISSUES
- (Trung bình, chờ Chủ nhà) Găng tay đen + ống tay rằn ri Swat Guy còn nguyên trong ảnh — là việc **D11a** (tay trần + vải Tô Châu), không phải D10.
- (Ghi nhận) `measure().L.error` chỉ là khoảng cách trọng tâm ngón ↔ anchor; xuyên/ôm phải đo khớp ngón trong hệ anchor (`scratchpad/fp-bones.mjs` → nên đưa vào `calib.measure()` ở D11b) hoặc ảnh.
- (Ghi nhận) `fit()` tự động từ clip Mixamo không tin được cho tay trái khi khẩu khác (AK-47: gun-in-char yaw 57°/pitch 23°, L raw 8 cm) — pose kiểm bằng mắt trên Mac là chuẩn; chỉnh tiếp bằng `?calib=fp&weapon=ak47` `setHand('L', pos, rot)` + `exportJson()` (không sửa code).
- (Thấp, deferred) Băng đạn CRWDE không tách (`parts: {}`) → reload không thấy băng rời; khi cần hero reload dùng "Used AK 47" (dan741vlasov, 38 k tri, có băng rời) hoặc cắt băng bằng `--cut` theo bbox (z −0,06..0,03, y < −0,05).
- (Thấp, deferred) Bolt không có part → không giật khi bắn; kick thân súng vẫn có.
- (Ghi nhận) Sprint pose trong calib = hip (calib đứng yên, sprint cần speed > 3,5 m/s) — kiểm khi chạy thật trên Mac.
- (Chờ) Cố vấn: AK-47 CRWDE (không nắp đầu ruồi/lưỡi lê gập Type 56) — giữ `approved: false`.

## DEVIATIONS
1. `?calibWeapon=` (bước 1) đổi thành `?botWeapon=` chung cho game (L1: bot/dummy cầm khẩu chọn, dùng lại cho lính QGP D11) — docs/TIP sửa theo.
2. `viewmodel.ts`/`audio.ts`/`fx.ts` ngoài scope contract (L1: tính năng GF01 "reload/impact/audio theo vật liệu" nằm trong TASK bước 2; không đổi API; AK-74M/HK416 không đổi hành vi).
3. Tuning `ak47` tách entry riêng thay vì sửa `ar_v1` (giữ fixture HT-MB nguyên).

## SUGGESTIONS (cho Chủ thầu)
- Chủ nhà trên Mac (`npm run dev`, WebGPU): `?level=arena&calib=fp&weapon=ak47` xem 3 pose; `?level=truong-son&weapon=ak47` bắn xuống đất nghe/thấy impact `earth`; bấm R xem tay trái xuống băng. Ghi cảm nhận ADS/recoil (1–5) để tinh chỉnh `content/tuning/weapons.json#ak47`.
- D11a chạy ngay sau (tay trần + áo Tô Châu) — ảnh Mac D10 nên chụp sau D11a để chấm một lần.
