# TIP-D10: AK-47/Type 56 1971 — súng người chơi (GF01, DV-007, DV-025 asset sprint)

## HEADER
- TIP-ID: TIP-D10 · Project: DVSG · Module: `scripts/convert-weapon.mjs` (+`scripts/lib/bake-skins.mjs`), `content/weapons/ak47.json`, `public/assets/weapons/ak47.glb`, `src/game/game.ts` (`?weapon=`), `src/qa/calib.ts` (`?calibWeapon=`), manifest (`historical/registryId/approved`), `tests/unit/weapons.test.ts`
- Dependencies: D02 (KTX2/validator), D03 (registry `wpn.pavn.type56_rifle`) · Priority: P0 (asset sprint, DV-025) · Effort: 32 h Thợ (bước 1 model + config 6 h · bước 2 fit tay/ADS/recoil/reload 26 h)

## CONTEXT
- Khẩu mẫu G1 = AK-47/Type 56 báng gỗ 1971 (DV-007). Registry: Type 56 phổ biến hơn AK-47/AKM Liên Xô, nhận dạng bằng nắp che đầu ruồi + lưỡi lê gập (tier S). HT-MB đang dùng AK-74M (sai thời kỳ) — giữ làm fixture `?weapon=ak74m`.
- Ứng viên Sketchfab CC-BY đã kiểm rip (DV-026): **"AK 47" — Aleksei Vlasov/CRWDE** (6 464 tri, 1 material, 5 texture 2K, mô tả "based on original factory blueprints", cho thương mại) — chọn; "Used AK 47" (dan741vlasov, 38 k tri kèm băng/đạn, 4K) — dự phòng hero; loại jeandiz/billyjackman3d (tag Squad/CS/Battlefield).
- Hạn chế: model CRWDE **không có nắp che đầu ruồi và lưỡi lê gập của Type 56** → manifest `historical: true, registryId: wpn.pavn.type56_rifle, approved: false`; cố vấn quyết giữ AK-47 (Liên Xô viện trợ, cũng có mặt 1971) hay tìm/đặt Type 56.
- Model gốc có skin + animation "shooting" → phải nướng skin trước khi phân tích hướng (lỗi lần đầu: profile geometry gom về một điểm).

## TASK
1. **Bước 1 (xong):** `bake-skins` dùng chung → `convert-weapon` (dài 0,87 m, nòng −z) → `ak47.glb` 1,44 MB WebP → `assets:ktx2` (2,78 MB KTX2); `content/weapons/ak47.json` với anchor đo từ profile geometry (`scripts/weapon-profile.mjs`): muzzle z −0,435; đầu ruồi z −0,41 y 0,040; thước ngắm z −0,07 y 0,037; báng cầm z 0,18 y −0,10; ốp lót −0,28..−0,12 → gripL z −0,13; băng đạn đáy y −0,173; `parts: {}` (một mesh — băng đạn không tách). `?weapon=ak47` mặc định.
2. **Bước 2:** fit tay bằng `?calib=soldier&calibWeapon=ak47` (fit() trên clip rifle_aim → exportJson → `fp.handR/handL`), kiểm `?calib=fp` hip/ADS/sprint trên Mac WebGPU: tay trái ôm ốp lót, tay phải ôm báng cầm, ngón trỏ ngoài cò; ADS 180–240 ms thẳng đầu ruồi–thước ngắm; recoil 3 lớp và reload theo GF01 (băng đạn chưa tách → reload là chuyển động cả khẩu, ghi deferred); âm/impact theo vật liệu `earth` (terrain) thêm vào pool.
3. **Evidence:** ảnh Mac hip/ADS/sprint + clip bắn/thay băng; `measure()` gripR/gripL ≤ 1,5 cm; cố vấn ký súng (chờ).

## ACCEPTANCE CRITERIA
- Given `?level=truong-son` mặc định, Then súng người chơi là `ak47` (KTX2, manifest historical/registryId), `?weapon=ak74m` vẫn chạy; unit `weapons.test` PASS; `assets:validate` 0 lỗi.
- Given `?calib=fp` trên Mac, Then `measure()` R/L ≤ 1,5 cm, tay trái nằm trên ốp lót (không lơ lửng), ảnh 3 pose được Chủ nhà chấm.
- Given bắn/ADS/reload, Then ADS 180–240 ms, thời điểm nạp xác định trong test ammo state; không lỗi console.

## CONSTRAINTS
- Không sửa `convert-model.mjs` (giữ inline bake, tránh hồi quy TIP-021); không đổi schema weapon-model; TSL only; không tiếng Việt trong src.
