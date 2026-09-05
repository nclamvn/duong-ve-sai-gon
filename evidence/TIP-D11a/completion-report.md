# Completion Report — TIP-D11a: Lính QGP 1971 lớp 2–15 m + tay FP 1971 (ART01a)

STATUS: **PARTIAL** — sandbox xong (retexture + gear procedural + tay FP tay trần), CI xanh; chờ **ảnh Mac WebGPU Chủ nhà chấm** và **cố vấn duyệt registry** (`approved: false`). Phần mesh mới (đầu thật, bàn chân + dép cao su, ba lô, bi đông) = **D11b**.

## FILES CHANGED
Tạo mới
- `scripts/retexture-1971.mjs` — Swat Guy → lính 1971: island (liên thông đỉnh) phân loại theo bbox tỷ lệ mesh; 1002 (gear) chỉ giữ bàn tay (|x| ≥ 90 % nửa rộng T-pose → da), đai cổ tay (73–90 % → cổ tay áo) và giày; 1001 bỏ đệm gối/túi/tai nghe/kính; sơn atlas theo lớp: VẢI = màu Tô Châu × dệt poplin CC0 × sáng/tối gốc (blur 22 px, chuẩn hoá **từng island** ≥ 200 tam giác, nén tương phản 0,45, sàn 0,78), DA (blur 2, nén 0,35), thắt lưng nâu, giày đen; normal vùng da phẳng; ORM: AO sàn 150/235, roughness sàn 190/128/140, metal 0; bỏ emissive. Manifest `soldier_mixamo`: historical, `registryId uni.pavn.1971.field_uniform_green`, approved false, sourceFiles (GLB gốc + vải), triangles.
- `src/engine/render/gear1971.ts` — mũ cối (lathe 14 điểm × 28 đoạn, kéo 1,0/1,12/1,14 → 0,30 × 0,34 × 0,125 m, vành nghiêng, DoubleSide) gắn `Head` (+13,5 cm, +1 cm trước, −3°); bao xe 3 túi ôm ngực (túi ngoài lùi 1,8 cm xoay ±23°, nắp, khuy, dây ngang, 2 dây vai) gắn `Spine2` (+19 cm trước, −3 cm); material olive 0x55634a roughness 0,92; geometry cache; `attachGear1971`/`findChestBone`/`GEAR_TRIANGLES`.
- `tests/unit/soldier1971.test.ts` (4 test): manifest historical/registry/approved/tam giác < 45 %; registry có 4 mục 1971; kích thước mũ/bao xe + tổng < 3 000 tam giác; attach/dispose + thiếu bone.
- `docs/tips/TIP-D11a.md`, `contracts/TIP-D11a.yaml`, `evidence/TIP-D11a/*`.

Sửa
- `src/game/actors/dummy.ts` (`DummyOptions.gear?: 'pavn1971'`), `src/game/actors/visual.ts` (`SoldierVisual.gear`, gắn sau súng), `src/game/game.ts` (bot + dummy `gear: 'pavn1971'`).
- `public/assets/characters/soldier.glb` 12,0 → **9,58 MB** KTX2 (tam giác 46 297 → **17 168**, −63 %), `soldier_arms.glb` 3,45 → **2,81 MB** (tay FP dẫn xuất qua `extract-arms.mjs` không đổi code); manifest tổng 120,3 → 120,7 MB (ktx2 của atlas sơn lại 2K).
- `README.md` (pipeline nhân vật 1971), `docs/DECISIONS.md` DV-027/028/029.

## TEST RESULTS (theo AC)
| AC | Kết quả |
|----|---------|
| Bot/dummy không rằn ri/giáp/kính/đệm gối; áo quần olive, tay trần, mũ cối, bao xe; tay FP ống tay olive + bàn tay da; `assets:validate` 0 lỗi; unit + CI xanh | **PASS** (sandbox WebGL2) — `sandbox-soldier-idle.png`, `sandbox-soldier-aim.png`, `sandbox-head.png`, `sandbox-fp-hip.png`, `fp-before-after.jpg` (găng đen/rằn ri → tay trần/áo olive); validate 77 asset 0 lỗi; unit 122/122; CI `ci.txt` |
| Manifest `soldier_mixamo`: historical=true, registryId ∈ `uniforms.yaml`, approved=false; tam giác < 45 % gốc | **PASS** — `uni.pavn.1971.field_uniform_green` (tier H); 17 168/46 297 = 37 % |
| Chủ nhà chấm ảnh Mac WebGPU 3 góc | **CHỜ** — Chủ nhà chạy `?level=arena&calib=soldier&botWeapon=ak47&weapon=ak47` (orbit: `__ht.calib.orbit(az, el, dist, h)`), `?calib=fp&weapon=ak47`, và `?level=truong-son` nhìn bot |

## ISSUES
- (Trung bình, D11b) **Mặt không có nét** (balaclava Swat sơn da: không mắt/mũi/miệng) — ở 2–15 m tạm được, cận cảnh là ma-nơ-canh. Cần đầu thật (mesh CC0/CC-BY hoặc đặt) + tóc; đồng đội gần (0–2 m, ART01 tầng 1) chưa đạt.
- (Trung bình, D11b) **Giày đen** thay vì dép cao su (registry `sandals_rubber` tier S): mesh không có bàn chân → dép cần chân trần + quai; PRD "thật đến từng cái dép" chưa đạt ở lớp này.
- (Thấp) Đầu to (vỏ mũ Swat làm sọ, rộng ±11 cm) → mũ cối phải 0,30 × 0,34 m để trùm — hơi quá cỡ; D11b đầu thật sẽ về 0,27 × 0,31.
- (Thấp) Áo giáp Swat sơn olive còn hình khối "áo phao" dưới bao xe; đọc như áo trấn thủ ở xa. D11b thay thân.
- (Đã sửa) Ảnh Mac đầu tiên của Chủ nhà: "cánh tay như bị tật" (`mac-fp-hip-before-fix.png`) — cổ tay trái gập do pose fit() của D10 + đai cổ tay găng sơn da thành bướu + ống tay còn loang rằn ri. Sửa: pose tay AK-74M đã kiểm Mac (DV-029), đai cổ tay → vải (cổ tay áo), blur vải 22 px/nén 0,45/sàn 0,78 → ống tay olive trơn. Còn: bàn tay găng Swat mập/mượt (bướu khớp ngón) → mesh tay trần thật ở D11b nếu Chủ nhà thấy.
- (Ghi nhận) Chiều cao nhân vật vẫn `targetHeight` 1,82 m (HT-MB) — bộ đội 1971 trung bình ~1,60–1,65 m: đổi ở `assets.ts` ảnh hưởng eye-height bot/hit zone/tay FP → ADR riêng (Chủ thầu).
- (Ghi nhận) Visor emissive (`opts.visor`) không còn material tên visor → không hiện; cyan/orange đọc phe qua visor mất — PRD không muốn hit-marker/đèn arcade nên ổn, nhưng độ đọc địch/bạn ở xa cần xem lại ở D08 (băng tay, mũ khác).

## DEVIATIONS
1. Giữ vỏ mũ Swat làm sọ (sơn da) thay vì bỏ: bỏ thì mặt chỉ tới mũi → lỗ giữa mặt và mũ (thử `shots3`). L1, ghi DV-027.
2. `game.ts` đặt `gear: 'pavn1971'` cho **cả** bot lẫn dummy (arena/pho là fixture HT-MB) — M1 địch là VNCH/Mỹ sẽ cần `gear` khác (D08/D11c); L1.
3. Không tách túi/nắp bao xe thành material khác (một material vải chung với mũ) — đủ đọc, tiết kiệm binding (DV-023).

## SUGGESTIONS (cho Chủ thầu)
- D11b (48 h còn lại của D11): đầu + bàn chân từ mesh CC0 (ví dụ base mesh CC0 trên Sketchfab/Poly Haven không có) hoặc Mixamo nhân vật khác có mặt thật (X Bot không; "Vanguard"/"Malcolm" có mặt nhưng trang phục khác — retexture tương tự); dép cao su lathe + quai; ba lô/bi đông procedural gắn `Spine`/`Hips`.
- Chủ nhà: chụp Mac cùng 3 góc (script `__ht.calib.orbit`) để so; nếu màu vải quá "xanh lá" hay quá xám, chỉnh `COLORS.CLOTH` trong `retexture-1971.mjs` (sRGB) và chạy lại pipeline 3 lệnh (≈ 3 phút, KTX2).
- Cố vấn: registry `field_uniform_green` H → cần ảnh/hiện vật để lên S và `approved: true`; hỏi luôn màu "xanh Tô Châu" (xám xanh vs xanh lá) để chốt `COLORS.CLOTH`.
