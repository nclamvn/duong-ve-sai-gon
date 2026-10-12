# BLUEPRINT M1-T3: "Cổng Trời" dồn dập (bản 20 phút)

Phiên bản 0.2, 2026-10-12 (0.2: chốt vị trí khi dựng DV-085). Thay BLUEPRINT-M1-T2 phần kịch bản; giữ địa hình, rừng, đồ hoạ DV-079..082.

## 1. Vì sao làm lại

Chủ nhà chơi thử (12/10): 2/3 đầu màn chỉ chạy theo đội trưởng, không thấy địch, không biết nhiệm vụ; địch ít (28) và ngờ nghệch; thiếu cháy, khói, bom đạn.

Đo trong code (rà ngày 12/10):
- 0 đến khoảng 10 phút đầu không có địch: suối, nghỉ lau súng, nấp máy bay, đồi, B-52, dấu vết; đội trưởng đi 1,3 m/s.
- Chỉ 2 địch cùng lúc được bắn thật vào người chơi (attack token), các địch khác cố tình bắn trượt; 3 phát đầu luôn là phát cảnh cáo.
- Địch nhắm đồng đội gần nhất (đồng đội không chết được), mù với người chơi ở xa 30 m khi chưa báo động, nhóm "săn" quên người chơi sau 9 s, vai trò chiến thuật chỉ chia một lần, lựu đạn rất hiếm (1 quả mỗi địch, nhiều điều kiện).
- Đồng đội giữ tốc độ hành quân khi vào trận (chạy loạn hoặc lết), sau trận đi "điều tra" lạc khỏi tổ.
- Không có cháy/khói/pháo động trong kịch bản; nổ không để lại gì.

## 2. Quyết định của Chủ nhà (12/10)

| Hạng mục | Chốt |
|---|---|
| Độ dài | khoảng 20 phút, dồn dập, cứ 1 đến 2 phút một biến cố |
| Mở màn | bị phục kích ngay ở suối |
| Đồng đội | 1 đến 2 người hy sinh theo kịch bản; Quyết sống tới cuối |
| Mật độ địch | 12 đến 16 cùng lúc, tổng khoảng 70 đến 90 |

## 3. Kịch bản mới (7 hồi)

Mỗi hồi có: mục tiêu một dòng + điểm đánh dấu + khoảng cách luôn bật, câu chỉ huy ngắn của Quyết, áp lực thời gian khi cần (đếm ngược trên HUD).

| Hồi | Thời gian | Diễn biến | Địch |
|---|---|---|---|
| 1. Phục kích bên suối | 0:00 đến 3:00 | Tổ đang lội qua ghềnh (x = −48) thì bờ bên kia nổ súng; cối 60 ly rơi quanh. Quyết: "Nằm xuống! Bắn trả!" Hướng dẫn ngay trong trận: nấp đá, ném lựu đạn (G), ra lệnh (1 đến 4). Thêm 3 tên vượt suối tiếp viện. Còn 2 tên thì tổ vượt suối đuổi theo. | 12 (6 bờ kia + 3 vòng sườn bắc + 3 tiếp viện) |
| 2. Napalm | 3:00 đến 5:30 | Đuổi theo lên dốc thì cặp F-4 bổ nhào; "Máy bay! Tản ra!". Napalm rơi thành dải 120 m sát đội hình: rừng cháy, khói đen, nóng gây sát thương. **Khang hy sinh** trong rìa lửa. Chạy thoát (đếm ngược 12 s) rồi chạm một tổ địch đang chặn đường thoát. | 6 + 3 |
| 3. Sườn đồi và B-52 | 5:30 đến 8:30 | Đánh chiếm điểm quan sát trên sườn đồi phía đông (tổ trinh sát cố thủ). Vừa chiếm xong thì "B-52! Xuống lòng suối!": dải bom đi về phía tổ, chạy khoảng 75 m xuống lòng suối trong 22 s (ngoài vùng an toàn là chết). Sau trận bom: hố cháy, khói, tàn quân lao ra. | 5 + 6 |
| 4. Cảm biến | 8:30 đến 11:00 | Tìm cảm biến địch ở bờ tây, gài thuốc phá (giữ F). Trong lúc chờ nổ: phản kích hai mũi bắc và tây, giữ chốt 90 s. | 15 (bắc 2 đợt) |
| 5. Khe | 11:00 đến 13:30 | Phục kích trong khe, địch có súng máy; vòng sườn bằng bờ khe. | 10 |
| 6. Dốc | 13:30 đến 16:30 | Đánh lên dốc: ổ súng máy trên đỉnh (lựu đạn để diệt), cối địch, tổ vòng sườn; chiếm đỉnh rồi giữ 60 s trước 2 đợt phản kích. | 16 |
| 7. Bãi đáp | 16:30 đến 20:00 | Chặn bãi đáp: trực thăng đổ quân hai đợt, giữ 90 s. **Hoàn hy sinh** khi giữ cánh trái. Pháo ta bắn chặn, tổ rút vào rừng, hết màn. | 6 + 8 + 2 |

Tổng 90 địch (đã dựng), tối đa 16 cùng lúc (hàng chờ đợt sau chỉ ra khi còn chỗ, điểm ra quân ngoài tầm nhìn người chơi).

## 4. Việc kỹ thuật

### 4.1 AI địch "khôn" hơn (`src/game/ai`, `content/tuning/ai.json`)
1. Chọn mục tiêu ưu tiên người chơi (thấy được, đang bắn, gần), xét tầm nhìn cho 2 ứng viên; không dồn hết đạn vào đồng đội.
2. Attack token 2 → 4; địch không có token vẫn bắn thật (sai số ×1,5, không lệch cố ý); phát cảnh cáo 3 → 1.
3. Nhóm "săn" bám người chơi: cập nhật vị trí người chơi mỗi 2,5 s, ép dần vào.
4. Địch ở 30 đến 60 m vẫn kiểm tầm nhìn (thưa hơn); đồng đội ngã gục thì cả nhóm báo động.
5. Chia lại vai trò mỗi 4 s; vòng sườn khi còn từ 2 người, hồi chiêu 6 s.
6. Đạo diễn áp lực: người chơi thay đạn hoặc trốn quá 3 s thì địch xông lên theo cặp; lựu đạn 2 quả mỗi địch, hồi chiêu nhóm 10 s, ném để đuổi người nấp lâu.
7. Mỗi nhóm có thể chia sẻ thông tin với nhóm khác trong cùng trận.
8. Lùm cây, dương xỉ dày che tầm nhìn (luật công bằng PRD §20.3): mỗi tia nhìn đi qua mật độ thảm thực vật thì giảm tốc độ phát hiện.

### 4.2 Đồng đội
1. Vào trận về tốc độ chiến đấu (bỏ hệ số hành quân), bắn khi di chuyển ngắn, sau trận quay lại theo tổ.
2. Nhịp mới `assault`: đội trưởng chạy (khoảng 5 m/s) tới điểm kế, dừng chờ nếu người chơi tụt quá 15 m; bỏ nhịp đi bộ 1,3 m/s trong M1.
3. API hy sinh theo kịch bản: hành động `squad_kill{name}` (bỏ sàn máu 20, ngã chết, tên rời tổ, thoại riêng).

### 4.3 Hành động kịch bản mới (`src/game/mission`, schema)
| Hành động | Làm gì |
|---|---|
| `fx{kind: fire/smoke, at, scale, durationMs}` | lửa, khói động trong kịch bản (bể dựng sẵn như hồi đêm) |
| `napalm{from, to, delayMs}` | cặp F-4 bay đúng đường, bom cháy rơi theo dải, lửa và khói đen kéo dài, vùng nóng gây sát thương |
| `mortar{zone, durationMs, rate}` | cối/pháo rơi quanh một vùng bất kỳ (thay chỗ gõ cứng `top`), có tiếng rít trước khi rơi |
| `reinforce{group, waves, intervalMs, maxAlive}` | quân tiếp viện theo đợt, tôn trọng trần 16, ra ở điểm khuất |
| `squad_order pace: assault` | đội trưởng chạy, chờ người chơi |
| `squad_kill{name}` | đồng đội hy sinh theo kịch bản |
| `objective{..., timerMs}` | đếm ngược trên HUD (chạy khỏi lửa, vào khe trước B-52) |
| `safe_zone{zone, damage}` | ngoài vùng an toàn khi hết giờ thì chịu sát thương (B-52, lửa) |

Nổ để lại hố cháy âm ỉ và khói (bể có hạn), khói nổ không còn bị thu hồi quá sớm (bể 40 → 96).

### 4.4 Âm thanh và thoại
- Tiếng rít đạn cối/pháo bay tới, tiếng gầm bổ nhào F-4, lửa cháy lách tách.
- Thoại mới khoảng 40 câu (Quyết chỉ huy ngắn gọn, tiếng hô của đồng đội, khoảnh khắc Khang và Hoàn hy sinh), mã M71 đến M99 + nhóm mới; lồng tiếng ElevenLabs như DV-076 (chạy script trên Mac, khoá chỉ trong `.env.local`).

## 5. Thứ tự giao việc (TIP)

| TIP | Nội dung | Kiểm |
|---|---|---|
| DV-083 | AI địch + đồng đội (4.1, 4.2 mục 1-2) | unit AI cập nhật ngưỡng mới, E2E ai-t1 |
| DV-084 | Hành động kịch bản mới + hiệu ứng (4.3, âm thanh) | unit runtime, E2E bắn thử từng hành động |
| DV-085 | Kịch bản M1 mới + thoại + lồng tiếng | unit đồ thị nhiệm vụ, E2E M1 vật lý + đi hết màn bằng bot người chơi, đo thời lượng |

Hồi đêm (Ngầm Ta Lê) và M2 không đổi trong lượt này.

## 6. Nghiệm thu

- Người chơi gặp địch trong 30 s đầu; không có quãng nào quá 90 s không giao tranh hoặc biến cố.
- Màn chơi bằng bot người chơi (`playtime-m1`) dài 15 đến 25 phút.
- Tổng địch 70 đến 90; số sống cùng lúc không vượt 16.
- Mục tiêu và điểm đánh dấu luôn có; mỗi hồi có câu chỉ huy trong 5 s đầu.
- Khang và Hoàn hy sinh đúng hồi; Quyết, Long, Đạt sống tới cuối.
- 60 fps ở High trên Mac (`npm run bench`, Chủ nhà đo).
- Unit + toàn bộ E2E xanh.
