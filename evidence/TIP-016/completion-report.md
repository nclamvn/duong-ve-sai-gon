## COMPLETION REPORT — TIP-016: Cánh tay góc nhìn thứ nhất (Mixamo arms + IK bám súng)

**STATUS:** DONE (sandbox, WebGL 2) — chờ Chủ nhà chấm trên Mac

**FILES CHANGED:**
- Created: `scripts/extract-arms.mjs` — lọc tam giác tay từ `soldier.glb` theo trọng số skin (≥ 0.35 trên 48 joint vai/tay/ngón) → `public/assets/characters/soldier_arms.glb` 2.1 MB (15 658 tri, texture 1K, không animation); manifest `soldier_arms` (dẫn xuất Mixamo). Tổng asset 49.9 MB.
- Created: `src/engine/render/fpArms.ts` — rig gắn camera (gốc chân −1.62 m × scale 0.62, xoay π), IK 2 khớp mỗi tay (vai → khuỷu → cổ tay) tới `anchor · fp.hand{R,L}`, khuỷu theo pole, bàn tay hướng world đúng offset, cẳng tay xoắn nửa góc theo bàn tay, ngón co quanh trục x local (kiểm bằng viewer: x đúng, z sai), ngón trỏ phải duỗi theo `triggerFinger`. Không allocation mỗi frame (scratch vector).
- Modified: `viewmodel.ts` — `fpAnchors` (gripR; gripL con của nhóm tay trái → theo băng đạn khi reload), `setGlovesVisible(false)` khi có tay thật.
- Modified: `game.ts` (tạo FpArms sau viewmodel, update sau viewmodel.update, `camera.updateMatrixWorld`), `assets.ts` (`arms` HEAD-check), `quality.ts` (`?arms=0`), `weaponModel.ts` (`fp` trong config), schema + `content/weapons/*.json` mục `fp`.
- Evidence: `evidence/TIP-016/fp-{hip,ads,reload}.png` (medium 1024×640), `ci.log`.

**CALIBRATION:** khung bone Mixamo đo trong viewer (RightHand: +y dọc ngón, +z lòng bàn tay, +x ngón cái; LeftHand: +x phía ngón út). Tay phải: lòng bàn tay −x súng, ngón (0,−0.35,−0.94) → Euler (−1.927, −1.571, 0), cổ tay (0.035, 0.028, 0.075) so với gripR. Tay trái: lòng bàn tay (0.03, 0.92, 0.39), ngón (0.59, 0.30, −0.74) → Euler (−1.166, 0.027, −0.637), cổ tay (−0.05, −0.04, 0.05) so với gripL. Rig scale theo viewmodel (0.62) để tay và súng cùng tỉ lệ; lỗi ban đầu (rig full-scale → vai ở −0.73 m, tay không với tới) đã sửa.

**TEST RESULTS:** `npm run ci` exit 0 — 88 unit (13 file), 6 E2E WebGL (4.9 min); 0 lỗi console. Probe: `arms true`, 15 658 tri; tay trái ôm ốp lót ở hip/ADS/nhìn xuống; reload: tay trái đi theo băng đạn xuống rồi lên.

**ISSUES DISCOVERED:**
- [Low] Tay phải hầu như ngoài khung hình ở hip/ADS (tay cầm sát camera) — như FPS thông thường; nhìn xuống mới thấy.
- [Low] Không có animation tay riêng (kéo bolt, lắp băng) — tay trái đi theo băng đạn bằng IK, tay phải giữ tay cầm; đủ cho G0.5, G1 có thể thêm keyframe tay.
- [Low] Ống tay áo camo giống địch (cùng Swat Guy) — tint 0xb9c4ad; đổi nhân vật người chơi (Mixamo khác) sẽ tự có tay riêng qua extract-arms.
- [Info] Thêm 15.7k tri skinned + 2 draw; dự kiến ≤ 0.3 ms trên M1 Max (Chủ nhà bench).

**DEVIATIONS FROM SPEC:** không có; ảnh CoD chỉ dùng làm tham chiếu tư thế (không asset).

**SUGGESTIONS FOR CHỦ THẦU:** Chủ nhà chơi thử: nhìn tay trái khi đứng/ngắm/nạp đạn; nếu cổ tay trái lệch ở góc nhìn xuống → chỉnh `fp.handL` trong `content/weapons/ak74m.json` (không sửa code).
