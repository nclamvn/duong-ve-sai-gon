# TIP-D11b — Tay góc nhìn thứ nhất v2: asset tay riêng + IK + pose ngón authored (DV-049)

**Deps:** Chủ nhà chấm đồ hoạ 2026-09-08 ("đồ hoạ 6/10 nhưng nhân vật 4/10… tay nhân vật chính cầm súng (first person) cực xấu, không thấy hình bàn tay chuẩn"); AskUserQuestion chọn **"Thay hẳn: asset tay FP riêng + bake clip per súng"** + **"Tay FP mới ngay"**. **Ưu tiên:** P0.

## Context
- Tay FP cũ (TIP-016, `fpArms.ts`): lọc mesh cánh tay từ nhân vật **Mixamo** (third-person, thô) + IK runtime kéo giãn + ngón co calib mù → "bộ xương", không ra bàn tay. Gốc xấu là **mesh** (Mixamo) + không có vòng lặp thấy-để-sửa.
- Nay có **bpy trong sandbox** nhưng rig asset này VỠ trong Blender (xem "Bài học"); vòng lặp thấy-để-sửa dùng **render trong game** (Playwright WebGL) — renderer thật, FOV thật, súng thật.

## Task (đã làm)
1. **Asset** `public/assets/characters/fp_hands.glb` — David Fischer "First Person hands rigged" (Sketchfab uid `547a45535f0c4fe787948f7a7a6a88db`, **CC-BY-4.0**, tự làm .blend/.fbx, "ready to animate" 0 clip). Tay **trần** → đúng lính QGP 1971 (không đeo găng), khỏi retexture. 63 joint đủ đốt ngón, 7966 tam giác. Nguồn kiểm sạch (D-072/DV-026): tag chung (fps/rig/arms/hand), không IP game.
2. **Convert ở TẦNG glTF** `scripts/convert-fp-hands.mjs` (gltf-transform, KHÔNG Blender): bỏ rác (Icosphere + mesh kim 170 đỉnh); **vá rig** — chuỗi bàn tay (`forearm.001→hand→ngón`) treo thẳng ở root, tách khỏi cẳng tay biến dạng (`upper_arm→forearm_04`) → reparent `forearm.001` về dưới `forearm_04` **giữ world** (ma trận 4×4 tự viết: invert + decompose TRS) để cẳng tay+bàn tay thành MỘT chuỗi (xoay khuỷu kéo cả bàn tay); prune(keepLeaves — giữ xương đầu ngón) + quantize(chừa JOINTS_/WEIGHTS_) + meshopt → **106 KB**. Manifest CC-BY + attribution + sha256; CREDITS.
3. **`src/engine/render/fpHands.ts`** (mới, engine thuần):
   - Vật liệu da `MeshStandardNodeMaterial` (0xc79a72). *Bài học:* `MeshStandardMaterial` mặc định loader **không hiện** trong lớp overlay viewmodel three/webgpu.
   - Co theo **CẲNG TAY** = 0,27 m (đo `forearm→hand`), KHÔNG theo sải hai tay (co theo sải → cánh tay 0,1 m, IK không với tới báng 0,5 m).
   - **IK 2 khớp** `solveTwoBone` (tái dùng `armIk.ts`) đặt cả hai cổ tay lên `gripR`/`gripL` mỗi frame; hướng bàn tay + pole khuỷu theo `armR/armL` trong pose.
   - **Ngón co = pose authored** (`fingers` map: xoay local từng đốt) — dữ liệu, không IK. Ngón trỏ phải mở theo `triggerFinger`. three bỏ dấu chấm tên node → khớp `handR`, `f_index01R`…
   - Đung đưa/nảy/ADS kế thừa viewmodel space (cha). Đặt rig `place` (vai lùi/xuống camera) cố định camera-relative.
4. **Tích hợp:** `assets.ts` nạp `fp_hands.glb` (ưu tiên hơn `soldier_arms` cũ, fallback nếu thiếu). `game.ts` tạo `FpHands`, đọc `ak47.json#fp.handsPose` (fallback `DEFAULT_AK_GRIP`), `update(gripR, gripL)` mỗi frame. `weaponModel.ts` + schema: thêm `fp.handsPose`.
5. **Calib** `__ht.fp`: `setArm(side,px,py,pz,rx,ry,rz,ex,ey,ez)`, `setFinger(prefix,x,y,z)`, `setPlace(...)`, `setScale(s)`, `setPose(json)`, `dump()`. Công cụ ảnh: `scripts/qa-shoot-fp.mjs`.

## Acceptance (đạt trong sandbox)
- E2E `boot`: `fp_hands` nạp (7966 tri), IK đặt **cả hai cổ tay < 12 cm** so gripR/gripL, không lỗi console.
- CI: **147 unit + build + 16 E2E** (boot 6, truong-son/pho/mission 7, diem-cao-31 2, +1 tay FP) xanh.
- Ảnh `evidence/TIP-D11b/`: tay phải da trần cầm báng AK từ dưới-phải (rõ, tự nhiên) — hơn hẳn tay Mixamo "bộ xương".

## Deviations / nợ (điểm CALIB, không phải kiến trúc)
- **Tay TRÁI trên ốp lót** tới đúng anchor (IK sai 4 cm) nhưng bị **nòng/ốp che một phần** từ vài góc; "ôm" ngón theo hình học báng/ốp AK cần **mắt-thấy tinh chỉnh thời gian thực** — làm nhanh trên **Mac** (GPU thật, iterate tức thì, mắt Chủ nhà). Sau khi canh: `__ht.fp.dump()` → dán vào `content/weapons/ak47.json#fp.handsPose`.
- "Bake clip per súng" (idle/aim/reload thở/lắp băng) là bước tiếp: khi pose tĩnh đã đẹp, thêm clip AnimationMixer (crossFade). M16A1 địch dùng lại pipeline khi cần người chơi cầm.

## Bài học (ghi để khỏi lặp)
- **Rig asset này VỠ trong Blender:** mesh và skeleton ở hai scale khác nhau (empty 100× lồng nhau + FBX cm); `transform_apply`/reparent edit-mode làm lệch bind (cẳng tay 9 547 đơn vị, ngón sụp 5 mm khi re-export). → Sửa rig ở **tầng glTF** (gltf-transform giữ bind), pose **trong game** (three/Sketchfab load đúng như nhau).
- Xoay local xương (rotation_quaternion/euler) độc lập scale → nếu sau này cần Blender chỉ để lấy pose, trích **xoay local** áp vào glb gốc, đừng re-export mesh.

## Constraints giữ
TSL/NodeMaterial; engine không import game; content không TS; asset CC-BY có attribution + sha256 + manifest; vật liệu da không thêm texture (DV-023); không IP game, không asset rip.
