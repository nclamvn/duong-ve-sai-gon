# Decisions Log — Đường về Sài Gòn (DVSG)

Quyết định của dự án mới, đánh số DV-xxx. Quyết định của engine kế thừa (HT-MB, D-001..D-075) ở `docs/legacy/DECISIONS-HTMB.md` và vẫn có hiệu lực trừ khi bị ghi đè ở đây.

| ID | Ai | Quyết định | Lý do / nguồn |
|----|----|-----------|---------------|
| DV-001 | Chủ nhà | Sau hai demo HT-MB, phát triển nghiêm túc một FPS chiến dịch chơi đơn kiểu CoD, bối cảnh chiến tranh Việt Nam 1971 → 30/4/1975, "thật đến từng cái dép"; cảnh 1 rừng Trường Sơn, vai Quân Giải phóng, AK-47; Claude làm biên kịch | Yêu cầu 2026-09-05 |
| DV-002 | Chủ nhà | 8 nhiệm vụ 1971 → 30/4/1975; một nhân vật xuyên suốt (Nguyễn Đức Thành); cảnh thành phố = Thành cổ Quảng Trị 1972 | AskUserQuestion 2026-09-05 → `docs/story/KICH-BAN-v0.1.md` |
| DV-003 | Chủ nhà | PRD v0.2 (thêm §8 sửa, §19–24: UI/UX, mỹ thuật, điện ảnh, backlog G1) là SOT; ưu tiên chứng minh 15 phút "Cổng Trời" hấp dẫn trước khi mở tám nhiệm vụ | Bàn giao 2026-09-05 |
| DV-004 | Chủ nhà | **APPROVED Blueprint G0′ + G1** (`docs/BLUEPRINT-G1.md`): G0′ 2 tuần (D01–D05), G1 ≈ 8 tuần (D06–D19), G1.5 "M1 hoàn chỉnh" (đêm, AC-130, thám báo, Thu) là gate riêng trước G2 | 2026-09-05 |
| DV-005 | Thầu (Chủ nhà chấp thuận qua APPROVED) | Điện ảnh: cutscene **trong engine** (camera track JSON, cùng asset gameplay) là chính + công cụ ghi MP4 1080p24 cho CINE-00/briefing; Blender chỉ dự phòng nếu animatic D16 không đạt | Blueprint G1 R3 |
| DV-006 | Thầu (Chủ nhà chấp thuận) | Fork `hai-tuyen` (8745ba3) → repo `duong-ve-sai-gon`; engine + pipeline + test giữ nguyên; content Hải Tuyến (arena, Phố Vạn Hải, mission G0) giữ làm **test/bench** (`?level=arena` mặc định, `?level=pho`), không phải content game; docs HT-MB vào `docs/legacy/` | TIP-D01 |
| DV-007 | Thầu | Khẩu mẫu G1 = AK-47/Type 56 báng gỗ 1971 (không dùng AK-74M của HT-MB) | Blueprint G1 §1 |
| DV-008 | Thầu | `frame_p95.target_g1 = 16.67 ms` thêm vào budget (ADR-D02); ngưỡng đỏ giữ; không sửa để "đạt" | PRD v0.2 §22.3 |
| DV-009 | Thầu | Mọi level mới bắt buộc E2E vật lý người chơi trong CI (kế thừa D-075); mọi asset lịch sử phải có `registryId` trỏ registry có provenance P/S; asset ngoài phải qua kiểm rip (D-072) | PRD v0.2 §7.2, §12 |
| DV-010 | Thầu | Cutscene/video không chặn tiến trình mission (mission không phụ thuộc video chạy hết); người thật có tên không có lời thoại bịa; không nhân bản giọng người thật | PRD v0.2 §22.2, §9.2, AUD-005 |
| DV-011 | Thợ (L1) | Tìm thấy WIP TIP-023 chưa commit trong sandbox HT-MB (spline + setpiece technical/flyby, typecheck + unit xanh, chưa render/E2E) → cất ở nhánh `tip-023-wip` của `hai-tuyen`, không đưa vào fork; dùng lại cho `engine/vehicles` ở G2 sau khi nghiệm thu | TIP-D01 |
