## COMPLETION REPORT — TIP-012: Nhân vật thật — Mixamo Swat Guy + 8 clip, state machine, súng prop

**STATUS:** DONE (sandbox, WebGL 2) — chờ Chủ nhà chấm trên Mac WebGPU cùng TIP-011/013

**INPUT (Mixamo, tải qua tài khoản Adobe của Chủ nhà — Thợ thao tác trong trình duyệt tích hợp, không nhập mật khẩu):**
- Character **Swat Guy** (FBX Binary, With Skin, T-pose, 30 fps) → `assets-src/mixamo/swat.fbx` (115 MB, texture PNG 4K).
- 8 animation (Without Skin, 30 fps, In Place): `rifle_idle` (Rifle Idle), `rifle_walk` (Rifle Walk), `rifle_run` (Rifle Run), `rifle_aim` (Rifle Aiming Idle), `rifle_fire` (Firing Rifle), `rifle_reload` (Reloading), `hit` (Hit Reaction), `death_front` (Death From The Front).
- `assets-src/` gitignore; sha256 từng FBX nguồn ghi trong `content/assets/manifest.json` (`soldier_mixamo.sourceFiles`). Cùng bộ FBX đã sync sang `~/Desktop/hai-tuyen/assets-src/mixamo/` để Chủ nhà convert lại được.

**FILES CHANGED:**
- Created: `public/assets/characters/soldier.glb` — 7.18 MB (6.85 MiB), 46 297 tri, 65 bone, 8 clip; bỏ ignore trong `.gitignore` (bản convert Mixamo chính thức, có manifest).
- Modified: `scripts/convert-mixamo.mjs` — thêm `textureCompress` (sharp, JPEG q86, resize ≤ 2048): texture 4K PNG của Mixamo làm GLB 92.6 MB → 7.2 MB; tuỳ chọn `--texture=<px>`; `sharp 0.35.4` devDep.
- Modified: `content/assets/manifest.json` — mục `soldier_mixamo` (type `character`, license Mixamo, sha256 GLB + 9 FBX nguồn); tổng asset 44.3 MB (< 60 MB, `assets.test`).
- Created: `src/engine/render/rifleProp.ts` — AR procedural gộp 1 mesh (receiver, rail, ốp lót, nòng −z, giảm giật, băng đạn, tay cầm, báng, đầu ruồi/thước ngắm), `attachRifle(bone)` gắn vào `mixamorigRightHand`; `RIFLE_HAND_OFFSET = { pos (0, 0.05, −0.07), rot Euler(π/2, 0, π) }` calibrate bằng ảnh.
- Modified: `src/game/actors/visual.ts` — `SoldierVisual`: rig Mixamo nhìn về +z → `root.rotation.y = π` (hệ actor mặt trước −z); gắn súng vào tay phải (`rifle`).
- Evidence: `evidence/TIP-012/lineup-swat-webgl.png` (3 lính: ngắm / đi / đang ngã chết), `rifle-aim-{side,front}-webgl.png`, `rifle-poses-idle-run-webgl.jpg`, `rifle-calib-sheet-webgl.jpg` (3 ứng viên offset × 3 góc).

**CALIBRATION súng (bone RightHand):** bone +y chạy dọc bàn tay (về phía trước khi ngắm), −z lên mu bàn tay. Thử 12 Euler × 2 góc → (π/2,0,0) đúng hướng nòng nhưng băng đạn ngược lên; thêm roll π quanh nòng → (π/2,0,π): nòng ra trước, băng đạn xuống. Dịch 5 cm ra trước + 7 cm lên để tay cầm vào lòng bàn tay, tay trái ôm ốp lót. Kiểm ở Rifle Aiming Idle (ngắm), Rifle Idle (hạ súng chéo thân), Rifle Run (ôm súng ngang ngực) — đều khớp, không cần offset riêng từng clip.

**TEST RESULTS:** `npm run ci` exit 0 — typecheck, 84 unit (12 file), build, 6 E2E WebGL (3.9 min); 0 lỗi console. Probe lineup: `kind gltf`, scale 1.002 (cao 1.816 → 1.82 m), clips đủ 8 alias (`CLIP_ALIASES` map idle/walk/run/aim/fire/reload/hit/death), head bone `mixamorigHead`, d2 chết → clip death giữ frame cuối (`d2alive false`). Lineup medium 1024×640: 286 draw, 1.73 M tri (3 lính nhìn gần + bot + mưa 800).

**ISSUES DISCOVERED:**
- [Med] Súng của địch là procedural tối (1 material) — đủ nhận dạng ở khoảng cách chiến đấu nhưng cận cảnh còn "khối". Thay bằng GLB súng CC0 (Sketchfab CC0/Quaternius) khi Chủ nhà chọn; cùng `attachRifle` (gốc = tay cầm, nòng −z).
- [Med] Bot bắn: có clip `rifle_fire` + âm + tracer từ vị trí bot, nhưng **chưa có muzzle flash tại nòng súng địch** → nhiệm vụ nhỏ ở G1 (lấy world position đầu nòng từ `rifle` mesh, tái dùng flash flipbook TIP-013).
- [Low] Skinned mesh 46 k tri × 9 actor (dummy + bot) ≈ 420 k tri skinned nếu tất cả trong khung hình; sandbox không đo được GPU thật → chờ `bench:quick` Mac (`skinned_actors` ≤ 10 giữ nguyên). Nếu WARN: `--simplify` trong convert (meshopt simplify 0.5) hoặc LOD theo khoảng cách.
- [Low] Hit reaction dùng clip Mixamo `Hit Reaction` full-body (không additive) — khi trúng đạn lúc đang chạy sẽ khựng 0.05 s crossfade; chấp nhận ở G0.5.
- [Info] Console: `PMREMGenerator.fromEquirectangularAsync` deprecated (three r185) — không ảnh hưởng.

**DEVIATIONS FROM SPEC:**
- Hit zone **không** bám bone: giữ `DUMMY_HIT_ZONES` tĩnh (D-027) vì rig Mixamo chuẩn hoá đúng 1.82 m như Dummy → capsule/sphere cũ vẫn trùng thân/đầu ở tư thế đứng; đổi sang bone sẽ đụng hitscan + test tỉ lệ head/body và không đem lại khác biệt nhìn thấy ở G0.5. Ghi nợ G1 (khi có tư thế cúi/ngã cần hit zone động).
- Aim/fire/reload/hit là crossfade full-body (Mixamo không cung cấp mask additive) thay vì upper-body additive.
- Clip tuỳ chọn (Death From Back Headshot, Crouch) chưa tải — alias `crouch_*` fallback về idle/walk.

**SUGGESTIONS FOR CHỦ THẦU:** chấm chung với TIP-011/013 trên Mac (`npm install` để có sharp/fbx2gltf/gltf-transform devDep → `npm run bench:quick` → chơi). Nếu bench WARN vì skinned tri → TIP-012b simplify 0.5 + LOD. Ưu tiên tiếp theo cho "ấn tượng": muzzle flash tại nòng địch + GLB súng CC0.
