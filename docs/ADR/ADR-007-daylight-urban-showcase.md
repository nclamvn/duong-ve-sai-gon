# ADR-007: Màn showcase "Phố Vạn Hải, sáng sau bão" — đổi hướng hình ảnh + mở rộng chính sách asset

- Trạng thái: **Chấp nhận** (Chủ nhà, 2026-09-03; D-057..D-061) · Thay thế phần hướng hình ảnh của ADR-005 (đêm mưa cảng) · Bổ sung ADR-006 (CC-BY).

## Bối cảnh
Sau khi chơi bản G0.5 (TIP-011..016), Chủ nhà kết luận: AI coding làm được game, nhưng để **chứng minh** cần một màn "wow": ban ngày sáng, đô thị ngoài trời nhiều màu sắc, khói lửa ngổn ngang, có khí tài/phương tiện, lính cầm súng đúng tay và AI có "IQ". Bối cảnh đêm-hộp hiện tại (container/crate) nghèo nàn.

## Quyết định
1. **Bối cảnh:** Vạn Hải **sáng hôm sau siêu bão** — giữ lore PRD §6 (Kình Xám, Mắt Bão, tổ Sơn Ưng, An, Trạm Bắc); khu phố nhà ống nhiều màu, biển hiệu tiếng Việt, đổ nát sau bão + giao tranh (khói, lửa từ hạ tầng cháy và xe cháy).
2. **Quy mô:** một khu phố 160 × 120 m, 3 điểm giao tranh (đầu phố / chợ / ngã tư), 8–10 phút, 2 đồng đội (VY, DUY) bắn hỗ trợ (SQD-001).
3. **Asset:** CC-BY Sketchfab cho **mọi** loại (xe, nhà, prop) với credit bắt buộc (CREDITS.md, màn capability, README) + Poly Haven CC0 (texture, HDRI ngày, prop) + Mixamo (nhân vật). Manifest license/sha256 từng file; test chặn thiếu attribution. Không dùng asset/texture do dịch vụ AI sinh (chưa có chính sách).
4. **Khí tài:** kịch bản (spline, kinematic, không lái được): xe bọc thép cháy tĩnh, bán tải súng máy địch tiến vào (bắn), trực thăng bay qua, xe buýt/ô tô/xe máy cháy.
5. **Thứ tự:** TIP-017 (súng trong tay) + TIP-018 (AI) trước, rồi TIP-019..026 theo Blueprint G0.6.

## Hệ quả
- Arena G0 (đêm) giữ làm bench hồi quy; màn mới có track bench riêng `pho-v1`; budget `config/performance-budget.json` không đổi.
- Mưa/SSR sàn ướt giữ module (vũng nước còn lại sau bão); ánh sáng chuyển sang sun + CSM + HDRI ngày.
- PRD §6.2 nhịp nhiệm vụ được rút gọn/đổi bối cảnh trong TIP-025 (thoại viết lại, nhân vật giữ).
