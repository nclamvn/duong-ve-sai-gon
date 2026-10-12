# Completion Report: DV-076 (lồng tiếng ElevenLabs: ta tiếng Việt, địch tiếng Anh)

evidence_status: giọng tạo thật bằng tài khoản ElevenLabs của Chủ nhà (trên Mac); phát trong game kiểm ở sandbox SwiftShader. Cảm nhận nghe chưa duyệt.

STATUS: DONE

CÁCH TẠO LẠI (trên Mac, trong thư mục game)
- `npm run voice`: tạo câu mới hoặc câu đổi chữ/giọng (băm nội dung, câu cũ giữ nguyên, không tốn thêm ký tự).
- `npm run voice:verify`: nghe lại toàn bộ bằng speech-to-text, ghi `public/assets/voice/verify-report.json`.
- `npm run voice:fix`: tạo lại các câu bị chấm thấp trong báo cáo.
- Đổi giọng một vai: sửa `voiceId` trong `content/voice/cast.json` rồi `npm run voice`.
- Thêm câu hô địch: sửa `content/voice/enemy-lines.json`. Đổi thoại ta: sửa phụ đề trong `content/locale/vi.json` (test đỏ nếu quên tạo lại giọng).

VAI
| Vai | Giọng (thư viện ElevenLabs) |
|---|---|
| Lâm | Nhật Phong (trẻ, Bắc) |
| Quyết | Trung Caha (trung niên, Bắc, chắc) |
| Long | Phong (trẻ, Bắc, hiền) |
| Đạt | Ninh Đôn (trẻ, Bắc, trầm) |
| Hoàn | Son Tran (trẻ, Trung) |
| Khang | Kyle (trẻ, giàu cảm xúc) |
| Trung đội (bộ đàm) | Dũng (trung niên, Bắc, trầm) |
| Địch E1..E4 | George War-torn Sergeant, Harry Fierce Warrior, Callum, Liam |
| Điện đài địch | Adam Dominant |

SỐ LIỆU
- 383 file (237 tiếng Việt, 146 tiếng Anh), 241 khoá, 11′53″, 9,2 MB, ~12,5 nghìn ký tự.
- Kiểm chất lượng: lượt đầu 51/237 câu tiếng Việt khớp < 0,75 (gần hết là câu hô rất ngắn đọc với [shouting]) và 5/146 câu tiếng Anh; tự đọc lại (hạt giống khác → bỏ thẻ → eleven_flash_v2_5). Sau sửa: 370 file eleven_v3, 13 file flash; còn 1 file khớp 0,71 ("Nạp đạn!" nghe thành "Nạp đã").

TEST RESULTS
- typecheck 0 lỗi; unit 253/253 (thêm 8: manifest khớp kịch bản và băm chữ; đủ giọng mọi cue M1/M2; địch đủ 4 giọng × 12 loại; thời lượng hợp lý; tra khoá; xoay vòng lần đọc; chống ồn tiếng hô địch; giọng theo mã lính).
- E2E webgl-ci 21/21 (6 spec ảnh/đo thời lượng bỏ qua theo cờ). E2E mới `voice.spec.ts`: "Lựu đạn! Nằm xuống!" của Long phát 1 lần, phụ đề giữ 1,9 s ≥ giọng 1,6 s; báo hướng "Địch, hướng 4 giờ!" phát đúng giọng; địch 15 m nạp đạn hô tiếng Anh; địch 90 m không hô; 0 câu trễ, 0 thiếu.

ISSUES
- (thấp) Cảm xúc của câu hô dùng flash (13 file) phẳng hơn v3; nếu nghe thấy lệch, chạy lại riêng: `npm run voice -- --only '^M25\.' --force`.
- (thấp) Chưa có thanh âm lượng giọng riêng trong cài đặt.
- (đã sửa) Báo hướng địch trước đây hiện "{h}"/"{d}" thô trên phụ đề vì Game không chuyển biến.

DEVIATIONS
- Báo hướng chỉ nói giờ, không nói mét (phụ đề đổi theo): đủ tổ hợp giờ × khoảng cách × 5 người là ~500 file.
- Giọng thư viện được dùng trực tiếp qua API (ElevenLabs tự thêm vào thư viện của tài khoản khi gọi lần đầu).
- (đã sửa trong lúc làm) Hàng chờ phụ đề sắp theo ưu tiên làm lời ra lộn thứ tự khi giọng thật dài hơn ước lượng (M2: "Đi." chen trước "Sương xuống..." và lời bộ đàm). Nay giữ thứ tự kịch bản; câu hô chờ quá 2,5 s bỏ.
