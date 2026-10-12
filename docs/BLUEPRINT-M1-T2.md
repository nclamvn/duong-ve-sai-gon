# BLUEPRINT M1-T2: "Cổng Trời" bản chiến đấu (~30 phút)

*Chủ thầu, 2026-10-11. Phase 2 sau AI-T1 (DV-071). Chủ nhà đã chốt: bản chiến đấu trước (hành quân 8–10 phút, B-52, săn thám báo 3 trận tăng dần, chặn bãi đáp; 25–30 địch; đêm AC-130 làm sau). Nhân vật chính là **Lâm**; tổ: Quyết (tổ trưởng), Long, Đạt, Hoàn, Khang (DV-072). Quyết định ghi ở DV-073.*

## 1. Vấn đề của bản cũ

Bản lát cắt TIP-M1A: 8 node, 6 địch, quãng đường ~320 m, xong trong ~3 phút; mọi mục tiêu là "đi tới vòng tròn rồi bắn". Không có nhịp lặng trước trận, không có lý do để săn, trận nào cũng giống trận nào.

## 2. Nhịp 3 hồi (route ~950 m trong vùng navmesh 512 × 512 m)

| Hồi | Đoạn | Việc của người chơi | Địch | Ước thời lượng |
|---|---|---|---|---|
| I Hành quân | Xuất phát → suối → chỗ nghỉ → bãi trống (máy bay) → đồi quan sát | Đi theo Quyết theo nhịp hành quân (1,6 m/s), lội suối, nghỉ chân tháo lau AK (giữ F), nằm im khi F-4 bay qua | 0 | 8–10′ |
| I | B-52 | Từ đồi nhìn trận rải thảm dọc dải hố phía đông (~40 quả trong 25 s), đất rung | 0 | 1,5′ |
| II Săn | Dấu vết | Kiểm tra "cây nhiệt đới" (cảm biến) và dấu giày mới cạnh hố bom | 0 | 1,5′ |
| II | Trận 1 "chạm trán" | Toán 4 trinh sát đang đi tuần, chạm nhau tầm gần trong rừng | 4 | 3–4′ |
| II | Trận 2 "phục kích ở khe cạn" | Lần theo dấu về khe cạn; 6 tên nằm phục, nổ súng khi ta vào 25 m | 6 | 4–5′ |
| II | Trận 3 "dốc" | Chúng chiếm dốc chặn đường rút: 4 giữ dốc, 4 vòng sườn | 8 | 4–5′ |
| III Bãi đáp | Chặn bãi | 6 tên giữ bãi, rồi UH-1 vào treo, 4 tên chạy về bãi; giữ đến khi trực thăng bỏ đi | 10 | 5–6′ |
| | **Tổng** | | **28** | **~28–33′** |

Checkpoint sau mỗi đoạn (7 điểm). Quyết hô theo đoạn; tổ ta đánh theo AI-T1 (lệnh 1–4).

## 3. Kiến trúc thêm (mở rộng mission runtime, không đổi kiến trúc)

| Phần | Việc |
|---|---|
| Điều kiện mới | `squad_at` (Quyết trong zone: hành quân cùng tổ, không chạy vượt được), `group_alive_max` (còn ≤ n địch) |
| Action mới | `bombing` (rải bom dọc đoạn thẳng: số quả, thời gian, trễ, bán kính, sát thương); `squad_order` thêm `pace` (march/normal) và `zone` (điểm đến của Quyết) |
| SpawnGroup | `behavior`: patrol (mặc định) · ambush (nằm im, cúi, chỉ nổ súng khi ta ≤ 25 m hoặc bị bắn) · hunt (biết vị trí ta, lao tới theo AI-T1) |
| Marker | mục tiêu "Theo anh Quyết" gắn trên người Quyết (`@leader`) |
| Tổ ta khi hành quân | Quyết đi tốc độ hành quân tới zone đích; tổ xếp hàng dọc sau Quyết cách 4 m |

## 4. AC

- Graph chạy hết bằng test đơn vị (thế giới giả) và E2E (dịch chuyển + hạ nhóm), đủ 28 địch, 7 checkpoint, không lỗi console.
- Hành quân: node chỉ qua khi Quyết tới zone (người chơi chạy trước không bỏ qua được).
- B-52: ≥ 35 tiếng nổ dọc dải hố, người chơi trên đồi không mất máu, màn hình rung.
- Phục kích: tổ phục không bắn khi ta còn > 25 m (trừ khi bị bắn).
- Ước thời lượng: bảng tính từ chiều dài đường navmesh, thời lượng thoại/sự kiện và thời gian đánh đo trong sim.

## 5. Ngoài phạm vi

Đêm AC-130 + đoàn xe + Thu ở ngầm (làm sau); thu âm thoại; clip nằm/bò.
