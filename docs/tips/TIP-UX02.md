# TIP-UX02 — HUD FPS cao cấp + bản đồ (G1-A, DV-043)

**Deps:** TIP-D-SKY (lượt bay), D05 (rừng). **Ưu tiên:** P0 (Chủ nhà: "phần text trên màn hình game thô… đúng một UI game FPS cao cấp", "không có khung bản đồ để di chuyển").

## Context
- HUD hiện tại: DOM trong `index.html` `<style>` + `src/ui/hud.ts` (chữ mono, không la bàn/bản đồ/marker). Token PRD §8.3 (than #151A18, giấy #E9E0CD, mực #202823, đất #BE995B, nguy hiểm #C7614C; Noto Sans/tương đương có dấu Việt; lề HUD ≥ 5 %; tương phản ≥ 4,5:1) — HUD dùng tông trong game (trắng ấm/đất), bản đồ giấy dùng palette giấy/mực.
- i18n: mọi chuỗi qua `t()` (`content/locale/vi.json`); AGENTS.md: không literal tiếng Việt trong runtime.
- Player yaw/camera: `game.camera`; mục tiêu: `mission.def.zones` + objective key; bot: `game.bots` (BotActor.group/faction).

## Task
1. Font OFL tự host `public/fonts/` (Barlow Condensed Medium/SemiBold — số, nhãn; Be Vietnam Pro Regular/SemiBold — chữ), manifest type `font`, license `OFL-1.1`.
2. `src/ui/hud.ts` viết lại theo layout §8.4: mục tiêu góc trên trái (banner 6 s → thu gọn), la bàn trên giữa, đạn dưới phải (băng to + dự trữ + tên súng + chế độ + thanh băng), máu dưới trái (thanh + trạng thái Ổn định/Bị thương/Nguy kịch) + vignette đỏ theo máu/trúng đạn, hit marker (thường/hạ), vòng chỉ hướng trúng đạn, prompt tương tác, phụ đề (tên + icon radio), chấm ngắm ẩn khi ADS.
3. `src/ui/compass.ts`: thanh la bàn 90° tầm nhìn, vạch 15°, nhãn B/ĐB/Đ/ĐN/N/TN/T/TB, marker mục tiêu (kim cương) + đồng đội (chevron) theo phương vị tương đối, kẹp mép.
4. `src/ui/markers.ts`: marker 3D (mục tiêu + khoảng cách m; tên đồng đội khi nhìn vào ≤ 8°; địch KHÔNG marker) chiếu bằng `camera.project`, kẹp mép khi ngoài khung, ẩn khi < 4 m.
5. `src/ui/minimap.ts`: canvas 2D góc dưới trái (bản đồ giấy bake `public/assets/terrain/<id>/map.png` từ `terrain-bake --map`: hillshade + đường đồng mức 20 m + tông rừng theo scatter + bãi trống), xoay theo yaw, tỉ lệ 1 px = 1,5 m, người chơi mũi tên, mục tiêu, đồng đội, địch chỉ khi vừa bắn (≤ 3 s); bật/tắt (settings + phím N); bản đồ chiến thuật toàn màn phím M (lưới 100 m, tên địa danh, mục tiêu, chú giải).
6. Sự kiện game: `PLAYER_HIT_ENEMY {kill}` cho hit marker; `HIT` player kèm vị trí nguồn cho vòng hướng.
7. Locale: khoá mới trong `vi.json`; xoá phụ thuộc chuỗi Hải Tuyến khi ở level truong-son.

## Acceptance (Gherkin)
- Given `?level=truong-son&autostart=1`, When khung hình đầu, Then thấy la bàn, đạn, máu, minimap (`data-testid`), font tải xong (`document.fonts.check`).
- Given yaw đổi 90°, Then vạch la bàn dịch đúng 90°/(tầm 90°) × bề rộng thanh.
- Given mục tiêu ở (x,z), When quay lưng, Then marker kẹp mép có mũi tên; When nhìn thẳng, Then marker ở giữa ± 5 % và khoảng cách đúng ± 1 m.
- Given bắn trúng bot, Then hit marker hiện ≤ 1 frame, khác màu khi hạ.
- Given trúng đạn từ hướng trái, Then vòng chỉ hướng lệch trái ± 15°.
- Nhấn M → bản đồ toàn màn có mục tiêu + người chơi; nhấn lại → tắt; pointer lock giữ nguyên.
- Không lỗi console; typecheck/unit/E2E xanh; ảnh Mac WebGPU Chủ nhà chấm.

## Constraints
- DOM/CSS + một canvas 2D minimap (không React, không WebGL cho HUD); cập nhật mỗi frame chỉ transform/text đổi.
- Không thêm dependency. Không literal tiếng Việt trong src. Font chỉ OFL.
