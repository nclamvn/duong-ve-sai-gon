# ADR-D02: Mục tiêu p95 ≤ 16,67 ms cho gate G1

- Trạng thái: **Chấp nhận** (DV-008, 2026-09-05)

## Bối cảnh
Budget HT-MB đặt `frame_p95.target = 18.5 ms` (dung sai cho 60 FPS trung bình). PRD v0.2 §22.3 chỉ ra 18,5 ms không đồng nghĩa 60 FPS ổn định; G1 cần chứng minh "cảm giác điều khiển", nên mục tiêu phải là một frame 60 Hz.

## Quyết định
Thêm `frame_p95.target_g1 = 16.67` vào `config/performance-budget.json`. Overlay/bench báo cả `target` và `target_g1`; VERIFY G1 chấm theo `target_g1`. Ngưỡng đỏ (22 ms) giữ nguyên. Đây là **siết** ngân sách, không phải nới; luật "không sửa budget để đạt" vẫn áp dụng cho mọi thay đổi theo hướng nới.

## Hệ quả
- Bench track `m1-v1` phải báo cả ba run, 1 % low, vùng tải/stream (PRD §22.3).
- Nếu G1 chỉ đạt 18,5 mà không đạt 16,67: không PASS G1; cắt FX Tier B/C trước, không hạ độ rõ mục tiêu.
