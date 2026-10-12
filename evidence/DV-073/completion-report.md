# Completion Report: DV-072 + DV-073 (đổi tên nhân vật; M1 "Cổng Trời" bản chiến đấu)

evidence_status: sandbox_swiftshader_sim (cảm giác chơi chưa duyệt trên Mac)

STATUS: DONE

FILES CHANGED
- created: `docs/BLUEPRINT-M1-T2.md`, `tests/e2e/playtime-m1.spec.ts` (chạy khi `DV_PLAYTIME=1`)
- rewritten: `content/missions/truong-son-a.mission.json` (24 node, 7 nhóm, 12 zone, 8 checkpoint)
- modified: `content/missions/truong-son-a.dialogue.json` (+41 câu thoại M30–M70), `content/missions/diem-cao-31.{mission,dialogue}.json`, `content/levels/{truong-son-a,diem-cao-31}.level.json` (+31 điểm spawn), `content/schemas/{mission,dialogue}.schema.json`, `content/locale/vi.json`, `content/tuning/ai.json`, `src/game/mission/{types,runtime,loader,missionHost}.ts`, `src/game/ai/{bot,squad,squadmates}.ts`, `src/game/game.ts`, `docs/story/{KICH-BAN-v0.1,KICH-BAN-M2-v0.1}.md`, `docs/{PRD,BLUEPRINT-G1,THIET-KE-DIEN-ANH-v0.2,BLUEPRINT-AI-T1,DECISIONS}.md`, tests

TEST RESULTS
- typecheck 0 lỗi; unit 237/237; E2E webgl-ci 19/19 (6 spec ảnh/đo thời lượng bỏ qua theo cờ môi trường). `level-truong-son` bài rừng: phần đo đi theo người chơi đặt nhịp thường (đầu nhiệm vụ giờ là nhịp hành quân theo Quyết)
- Graph M1 chạy hết (unit, thế giới giả): 28 địch, 8 checkpoint, node hành quân chờ Quyết.
- E2E M1 trên level thật: Quyết đi nhịp hành quân; người chơi chạy trước tới suối thì node không qua; giữ F lau súng; F-4; B-52 rải ≥ 35 quả, người chơi trên đồi không mất máu, màn hình rung; tổ phục im khi ta ở 45 m (0 phát), khai hoả khi ta vào khe; bãi đáp + UH-1; nhiệm vụ hoàn thành.
- Người chơi giả chơi hết (level thật, rừng bật):

| Đoạn | Vào node (s) | Thời lượng |
|---|---|---|
| Hành quân: suối (lấy nước 15 s) | 0 | 1′42″ |
| Nghỉ chân lau súng + chuyện quê | 102 | 1′53″ |
| Bãi trống, nằm im khi F-4 qua | 215 | 1′29″ |
| Đồi + B-52 | 304 | 1′47″ |
| Dấu vết (cây nhiệt đới) | 411 | 1′08″ |
| Trận 1 chạm trán (4) | 479 | 2′22″ |
| Trận 2 phục kích khe cạn (6) | 621 | 1′26″ |
| Trận 3 dốc (4 + 4) | 707 | 5′38″ |
| Bãi đáp (6 + 4 + UH-1) | 1045 | 6′04″ |
| Kết | 1409 | 8″ |
| **Tổng** | | **23′37″** |

Người chơi giả: 289 phát, hạ 20/28 (tổ ta hạ 8), không chết, đi đường thẳng tốc độ 3 m/s và luôn biết đích. Người chơi thật dự kiến 28–33 phút.

ISSUES
- (trung bình, đã sửa) Tổ trưởng/đồng đội hết 60 s tuần tra bị "timeout" mỗi tick (go về cùng state không đặt lại đồng hồ) → quay đầu đi về waypoint cũ của level. Có từ TIP-M1A.
- (trung bình, đã sửa) Đích cao hơn/thấp hơn chỗ đứng > 4 m thì không tìm được đường (navmesh tra theo cao độ hiện tại).
- (thấp) Hành quân đo được 6,9′ với người chơi giả bám sát; mục tiêu 8–10′ phụ thuộc người chơi thật dừng nhìn. Nếu Chủ nhà thấy nhanh: giảm `move.marchSpeed` (1,3) hoặc kéo dài các node nghỉ.
- (thấp) Trận phục kích ngắn với người chơi giả (đi thẳng vào giữa khe); người chơi thật đi sát bờ như Quyết dặn sẽ lâu hơn.
- (thấp) Đêm AC-130, đoàn xe, Thu ở ngầm: chưa làm (ngoài phạm vi bản chiến đấu).

DEVIATIONS
- Thêm checkpoint cp1b (sau suối) để chết giữa hành quân không phải đi lại từ đầu → 8 checkpoint thay vì 7.
- Zone của nhiệm vụ không thêm vào level (zone level là vùng chặn hố bom của terrain-features; "dấu vết" cố ý đặt cạnh hố bom).

SUGGESTIONS
- Chơi thử trên Mac lấy thời lượng thật và độ khó của trận dốc (5′38″ là trận dài nhất).
- Thu âm 4–5 câu chính (B-52, phục kích, trực thăng) trước khi thu cả bộ.
