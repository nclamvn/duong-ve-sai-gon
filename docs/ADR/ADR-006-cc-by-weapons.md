# ADR-006: Mở chính sách asset sang CC-BY (Sketchfab) cho vũ khí; ghi credit bắt buộc

**Status:** Accepted · 2026-09-03 · Quyết định Chủ nhà (AskUserQuestion) sau khi Thợ rà nguồn CC0

## Context
ADR-005 giới hạn asset ở Mixamo + CC0. Sau TIP-012, súng của địch là khối procedural một material và Chủ nhà yêu cầu "vũ khí hoàn hảo"
cho cả người chơi lẫn địch. Thợ rà CC0 (Sketchfab API filter `license=cc0`, OpenGameArt CC0, Poly Haven, Quaternius, Kenney):
- Sketchfab CC0: không có súng trường hiện đại nào ngoài **VSS Vintorez** (scan Bảo tàng vũ khí Tula, 36k tri) — súng bắn tỉa giảm thanh, lệch thể loại.
- OpenGameArt CC0 "Various Small Arms" (Tabasco, 2011): Blender 2.49, ~1.4k tri/súng, không UV/texture — thấp hơn súng procedural TIP-013.
- Quaternius/Kenney: low-poly cách điệu, trái hướng "chân thực điện ảnh" (D-036).
Trong khi đó Sketchfab CC-BY có nhiều súng game-ready PBR 4K, 10–30k tri (HK416 A7, AR-15, AK-74M, AKM…), tải được bằng tài khoản miễn phí.

## Decision
1. **Cho phép CC-BY 4.0 (và CC-BY 3.0) từ Sketchfab cho vũ khí và prop**, với điều kiện:
   - Mỗi asset ghi `content/assets/manifest.json`: `license: "CC-BY-4.0"`, `authors`, `url` (trang model), `attribution` (chuỗi credit đúng yêu cầu CC-BY: tên tác phẩm, tác giả, link, license).
   - Credit hiển thị ở **README §Credits**, `CREDITS.md`, và trong game (màn capability/pause — `ui.credits`) trước khi phát hành (G6); ở G0.5 tối thiểu README + CREDITS.md + màn capability.
   - Không dùng model có nhãn hiệu/logo game khác (PRD §9.2 Call of Duty) — ưu tiên model tác giả đã thay logo hư cấu.
   - CC-BY-NC / CC-BY-ND / CC-BY-SA **không** dùng (NC chặn thương mại, SA lây license, ND cấm tối ưu/chỉnh sửa).
2. **Tải:** Chủ nhà đăng nhập Sketchfab trong trình duyệt tích hợp (Thợ không nhập mật khẩu, không tạo tài khoản); Thợ tải bản glTF do Sketchfab
   xuất, bỏ vào `assets-src/sketchfab/<slug>/` (gitignore), convert bằng `scripts/convert-weapon.mjs` → `public/assets/weapons/<id>.glb` (meshopt, texture ≤ 2K WebP).
3. **Chọn súng (D-046):** người chơi Sơn Ưng dùng **AK-74M** (lực lượng Việt Nam dùng họ AK); địch dùng **họ AR-15/HK416** — phân biệt hình dáng.
4. Cấu hình vũ khí (anchor nòng/cửa thoát/tay cầm/băng đạn, tư thế hip/ADS) là **JSON trong `content/weapons/`** (content không TS), không hard-code trong viewmodel.

## Consequences
- (+) Súng thật PBR cho cả FPS viewmodel lẫn địch; pipeline glTF tái dùng cho prop G4.
- (+) Credit tập trung một chỗ (manifest → README/CREDITS/UI sinh tự động).
- (−) Thêm nghĩa vụ attribution suốt vòng đời; kiểm bằng `assets.test` (mọi asset CC-BY phải có `attribution`).
- (−) Phụ thuộc Chủ nhà đăng nhập Sketchfab mỗi lần cần model mới (như Mixamo).
