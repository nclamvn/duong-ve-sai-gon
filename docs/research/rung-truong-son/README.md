# Domain rung_truong_son

Snapshot ở đây là TRÍCH ĐOẠN văn bản do công cụ WebFetch trả về (đã chuyển HTML → markdown, yêu cầu chép
nguyên văn), lưu dạng .md, kèm URL và thời điểm. Sandbox không được tải HTML thô bằng curl. Hệ quả: cổng
SPAN_NOT_FOUND kiểm span nằm trong trích đoạn, chưa kiểm được trích đoạn khớp 100 % trang gốc. Người kiểm
độc lập mở URL để đối chiếu.

Dựng lại: chép thư mục này vào `domains/rung_truong_son` của engine refinery rồi chạy
`python3 refinery.py domains/rung_truong_son` và `python3 bites.py domains/rung_truong_son`
(bites.py cần glob `snapshots/*.*` vì snapshot ở đây là .md). Kết quả mẻ 1: VALIDATION PASSED, 6/6 cổng cắn.
