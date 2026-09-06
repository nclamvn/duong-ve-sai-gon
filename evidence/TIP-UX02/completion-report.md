# Completion Report — TIP-UX02: HUD FPS cao cấp + bản đồ (G1-A, DV-043)

STATUS: **DONE (sandbox) — chờ ảnh Mac WebGPU Chủ nhà chấm**

## FILES CHANGED
- Mới: `src/ui/hud.css` (token PRD §8.3 bản sáng, font OFL tự host), `src/ui/compass.ts` (bearingOf/relDeg + băng la bàn DOM), `src/ui/markers.ts` (marker 3D + kẹp mép), `src/ui/minimap.ts` (minimap canvas + bản đồ chiến thuật M/N), `public/assets/fonts/*.woff2` (Barlow Condensed, Be Vietnam Pro — subset Latin+Việt, OFL), `public/assets/terrain/truong-son-a/map.png` (bake), `tests/unit/hud-m1.test.ts`.
- Sửa: `src/ui/hud.ts` (viết lại: mục tiêu góc trái 6 s → thu gọn, la bàn + số hướng, máu thanh + trạng thái chữ + vignette, đạn băng/dự trữ/tên súng/chế độ/thanh băng, chấm ngắm ẩn khi ADS, hit marker thường/hạ, vòng hướng trúng đạn, banner), `src/ui/subtitles.ts` (icon radio), `index.html` (bỏ CSS HUD cũ), `src/game/game.ts` (`feedHud` mỗi frame: heading từ camera, marker mục tiêu/đồng đội, minimap actor, địch chỉ khi vừa bắn ≤ 3 s; HIT có `shooter` → hit marker / vòng hướng), `src/game/weapons/weapon.ts` + `src/game/ai/bot.ts` (HIT.shooter), `scripts/terrain-bake.mjs --map` (giấy + hillshade + đồng mức 20/100 m + tông rừng từ scatter), `content/locale/vi.json` (khoá HUD/la bàn/bản đồ/súng/chế độ), manifest + schema + validator (type `font`, license `OFL-1.1`, source `google-fonts`), `scripts/validate-assets.mjs`, `src/qa/debugApi.ts` (`hud()`).

## TEST RESULTS (theo AC TIP-UX02)
| AC | Kết quả |
|---|---|
| Khung đầu có la bàn/đạn/máu/minimap, font tải | ✅ E2E "M1 lát cắt": testid compass/minimap/ammo("AK-47")/health("Ổn định"), `document.fonts.check` |
| Yaw đổi 90° → số hướng đổi 90 | ✅ E2E (heading 019 → 109…) + unit bearingOf/relDeg |
| Marker mục tiêu: giữa khi nhìn, kẹp mép khi ngoài khung, khoảng cách | ✅ unit clampToEdge; E2E `marker-obj` = 1, `objectiveDist` 164 m |
| Hit marker ≤ 1 frame, khác màu khi hạ | ✅ E2E `.hitmarker.show` sau HIT shooter=player |
| Vòng hướng trúng đạn | ✅ E2E `.damage-dir .on` sau HIT player từ bot |
| M mở/đóng bản đồ, N bật/tắt minimap | ✅ ảnh `sandbox-tacmap.jpg` (phím M qua keydown) |
| Không lỗi console; CI xanh | ✅ `ci.txt`: typecheck · unit 140/140 · build · E2E 11/11 |

Ảnh: `sandbox-hud-spawn.jpg` (đầy đủ phần tử), `sandbox-hud-ridge-minimap.jpg` (minimap bản đồ giấy + đồng mức), `sandbox-tacmap.jpg`, `sandbox-hud-ads.jpg` (chấm ngắm ẩn), `map-bake-crop.jpg`.

## ISSUES
- (thấp) Sandbox WebGL2 SwiftShader không có post → ảnh mờ; chữ HUD chưa chấm được độ nét trên Mac Retina (font-size clamp 13–19 px theo vw).
- (thấp) Bản đồ chiến thuật: nhãn lưới trùng ở mép; địch chỉ hiện khi vừa bắn (công bằng §20.3) — Chủ nhà xác nhận có muốn "địch đã phát hiện" không.
- (trung) PRD §8.1 ghi "không mini-map mặc định" — Chủ nhà chọn minimap bật mặc định ở M1 (tắt bằng N) → cần sửa PRD (DV-043).

## DEVIATIONS
- Font đặt ở `public/assets/fonts/` (manifest schema đòi `^assets/`), không phải `public/fonts/`.
- Hit marker có (PRD D10 "không hit-marker arcade"): làm **kín đáo** (4 vạch 9 px, 0,28 s; hạ = đỏ) theo yêu cầu "UI FPS cao cấp" của Chủ nhà; có thể tắt bằng settings ở D06.

## SUGGESTIONS
- D06 UI shell: settings cho minimap/hit marker/độ to HUD; PRD §8.1/§8.4 cập nhật theo DV-043.
- ART02: vignette máu dùng post (không phải DOM multiply) khi có LUT.
