## COMPLETION REPORT — TIP-014: Vũ khí hoàn thiện — AK-74M (người chơi) + HK416 (địch) glTF CC-BY, lửa nòng địch, viewmodel data-driven

**STATUS:** DONE (sandbox, WebGL 2) — chờ Chủ nhà chấm trên Mac WebGPU (`npm run bench:quick` + chơi)

**INPUT (Sketchfab CC-BY 4.0, ADR-006 — Chủ nhà đăng nhập trong trình duyệt tích hợp, Thợ tải; không nhập mật khẩu):**
- "AK-74M Assault Rifle" by FJH — 17 595 tri, PBR 4K, part đặt tên (Magazine/Shutter/Handle…) → `assets-src/sketchfab/ak74m/ak74m.glb` (43 MB).
- "HK 416 A7 (free download)" by r4m — 30 088 tri, PBR 4K, 1 mesh (kèm băng đạn + 2 viên đạn trang trí rời) → `assets-src/sketchfab/hk416/hk416.glb` (28 MB).
- Nguồn gitignore, sha256 trong manifest `sourceFiles`; bản gốc cũng ở `~/Desktop/hai-tuyen/assets-src/sketchfab/`.

**FILES CHANGED:**
- Created: `scripts/convert-weapon.mjs` — glTF → phân tích hướng tự động (trục dài nhất = nòng; đầu tiết diện nhỏ = đầu nòng; tâm khối lệch xuống so với trục nòng = dưới), root node xoay/scale về hệ chuẩn (nòng −z, lên +y, gốc trên trục nòng, dài `--length` m), `--drop` node theo tên, `--cut "x>0.045"` bỏ tam giác theo vùng (prop trang trí dính trong mesh), `--simplify`, texture WebP (normal near-lossless), flatten/weld/dedup/prune/quantize/meshopt; in bbox từng node (hệ chuẩn) để điền JSON; manifest CC-BY + `attribution`.
- Created: `content/weapons/ak74m.json`, `hk416.json` + `content/schemas/weapon-model.schema.json` — anchors (muzzle/eject/gripR/gripL/sight/magazine), parts (magazine, bolt, boltTravel), view (scale, hip/ads/sprint, sightDistance, alignSight), hand (offset bone RightHand).
- Created: `src/engine/render/weaponModel.ts` — `loadWeaponModel`, `instantiateWeapon` (clone chia sẻ geometry/material, anchor Object3D, part theo tên, rest pose).
- Modified: `src/engine/render/assets.ts` — `weapons` (HEAD check; thiếu → procedural), `?weapons=0`; `quality.ts` cờ `weapons`.
- Modified: `src/engine/render/rifleProp.ts` — `attachRifle(bone, weapon?)` → glTF (pivot = gripR + `cfg.hand`) hoặc procedural; trả `{pivot, muzzle, kind}`.
- Modified: `src/game/actors/visual.ts` — `ActorVisual.muzzleWorld(out)`; SoldierVisual nhận `WeaponAsset`; `rifleKind`.
- Modified: `src/game/weapons/fx.ts` — `botMuzzle` resolver (Game gán) → BOT_FIRED: flash/spark/tracer/khói **từ đầu nòng thật**; `botLight` PointLight riêng cho địch (luôn trong scene, `created` +1); flash người chơi 0.7.
- Rewritten: `src/game/weapons/viewmodel.ts` — glTF AK-74M: pose từ JSON, **ADS căn đường ngắm** (anchor sight → (0,0,−0.34) camera), sprint pose (hạ súng khi chạy), reload: băng đạn tụt xuống/ra (0–35 %), ẩn/thay (35–60 %), lắp lại (60–80 %), bolt kéo (80–100 %), tay trái theo băng đạn; bolt giật 0.07 m mỗi phát; bao tay vải tại gripR/gripL; material riêng cho viewmodel (color ×1.25, metalness 0.6, envMapIntensity 2) + **đèn fill 1.1 cd con của root** (súng đen PBR chìm vào đêm nếu không); fallback procedural TIP-013 giữ nguyên (GeoBuilder).
- Modified: `src/game/game.ts` — nạp 2 cấu hình vũ khí, viewmodel AK-74M, địch HK416, `fx.botMuzzle`, `isSprinting` (player.ts).
- Credits: `src/ui/capability.ts` hiển thị attribution CC-BY từ manifest (`cap.credits`), `scripts/credits.mjs` → `CREDITS.md` (`npm run assets:credits`), README §Credits; `assets.test` bắt buộc attribution/url/authors cho CC-BY; `tests/unit/weapons.test.ts` (schema + manifest + anchor hợp lý + CREDITS).
- Manifest: `weapon_ak74m` 4.1 MB (16 795 tri, 3 texture 2K WebP), `weapon_hk416` 1.7 MB (15 198 tri sau simplify 0.6 + cut, 6 texture 1K); tổng asset 47.8 MB (< 60 MB).

**CALIBRATION:**
- AK-74M anchors từ bbox node: muzzle (0,0,−0.471), gripR Handle (0,−0.085,0.19), gripL Forend (0,−0.03,−0.13), sight (0,0.05,−0.2) = đỉnh ruồi/khe ngắm, magazine node `Magazine_lowT__0`, bolt `Shutter_lowT__0`. Kiểm bằng viewer headless (`scratchpad/viewer`) 4 góc + góc ngắm.
- HK416: 1 mesh → anchor theo ảnh grid: muzzle (0,0,−0.435), gripR (0,−0.1,0.15), gripL (0,−0.03,−0.15); băng đạn rời + đạn trang trí cắt bằng `--cut x>0.045` (5 188 tam giác).
- Tay địch: pivot gripR trong bone RightHand, rot (π/2,0,π) (như TIP-012), pos (0,0.06,−0.14) sau 3 vòng ảnh (súng ngang tầm tay, tay trái ôm ốp lót, báng ở vai).
- Viewmodel: hip (0.12,−0.1,−0.3), ADS tính từ sight, sprint (0.12,−0.16,−0.26) rot (−0.35,0.5,0.2); reload nâng súng lên-giữa + nghiêng trái để thấy băng đạn.

**TEST RESULTS:** xem `ci.log` (typecheck + unit 13 file + build + 6 E2E WebGL). Probe `vm.mjs` (low, 800×500): `vm gltf` 16 795 tri, 38 part, weapons [hk416, ak74m], rifle địch `gltf`; ADS 1.00; bắn 1 phát (bolt + flash); reload RELOADING 3 pha; sprint 6.5 m/s; địch bắn: `muzzleOk true`, tracer + flash tại nòng, `botLight` 1.87 cd; 0 lỗi console. Ảnh evidence medium 1024×640: `vm-{hip,ads,fire,reload-b,sprint}-webgl.png`, `enemy-fire-webgl.png`, `enemy-lineup-webgl.png`.

**ISSUES DISCOVERED:**
- [Med] Súng PBR gốc rất tối (base ~0.17, metal 0.6) → không đèn fill thì đen hoàn toàn ban đêm. Đèn fill 1.1 cd bán kính 1.2 m cũng chiếu nhẹ tường sát người chơi (như đèn mũ) — chấp nhận; nếu Chủ nhà thấy "súng sáng giả", giảm còn 0.7 cd.
- [Med] ADS: nắp hộp khoá nòng AK che phần dưới màn hình (đúng thực tế AK, sight 0.34 m). Nếu muốn thoáng hơn: `sightDistance` 0.4 hoặc `scale` 0.55 trong JSON — không cần sửa code.
- [Low] Tay trái/phải là bao tay vải procedural (khối) — cánh tay thật (Mixamo rig FPS) vẫn nợ G1.
- [Low] HK416 1 mesh nên địch không có animation băng đạn (không cần); cửa thoát vỏ địch không văng vỏ (chỉ người chơi).
- [Low] Sandbox SwiftShader chụp 1024×640 medium ~90 s/ảnh — probe chạy tick 48×30 rồi 2 tick đủ cỡ (`window.__ticks`).
- [Info] GLB nguồn Sketchfab có node "Shell/Round" (AK) và băng đạn rời (HK) — pipeline có `--drop`/`--cut` cho việc này.

**DEVIATIONS FROM SPEC:** không có "muzzle flash riêng theo loại súng" (cùng flipbook, scale 0.7/0.8); crouch/reload của địch dùng clip Mixamo có sẵn (không thêm clip mới); credits trong game đặt ở màn capability (chưa có màn credits riêng — G6).

**SUGGESTIONS FOR CHỦ THẦU:** Chủ nhà chấm trên Mac: (1) `npm install` (không có devDep mới ngoài TIP-012); (2) `npm run bench:quick` — thêm 2 đèn point (fill + bot) và 9 × HK416 15k tri: dự kiến +0.3–0.8 ms GPU; (3) chơi: ngắm (chuột phải) xem đường ngắm AK, R nạp đạn, Shift chạy, để địch bắn xem lửa nòng. Nếu WARN → HK416 simplify 0.4 + texture 512 cho địch.
