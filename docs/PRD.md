# PRODUCT REQUIREMENTS DOCUMENT — ĐƯỜNG VỀ SÀI GÒN (tên tạm)

> **Bản cập nhật 0.2 · 05/09/2026.** Giữ khung PRD gốc, sửa trực tiếp mục 8, luật PLY-008, phạm vi G1/G5, cách diễn giải hiệu năng/tải và tình trạng bằng chứng; bổ sung mục 19–24. Khi có khác biệt với các ước lượng/danh sách kỹ thuật gốc, quyết định v0.2 và tiêu chí ở mục 19–23 là phần đề xuất mới cần duyệt. Không coi các ý tưởng hoặc bài nghiệm thu này là đã triển khai. Kịch bản nhân vật và dữ liệu lịch sử chưa được cung cấp đầy đủ.

Game bắn súng góc nhìn thứ nhất điện ảnh, chơi đơn, chiến dịch 8 nhiệm vụ từ Trường Sơn 1971 đến Sài Gòn 30/4/1975, chạy trên trình duyệt bằng Three.js WebGPU/TSL, xây bằng quy trình Vibecode và pipeline dữ liệu cào–lọc–làm giàu.

| Thuộc tính | Giá trị |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phiên bản           | 0.2 — Draft thiết kế trải nghiệm, UI/UX và điện ảnh; chờ duyệt sản xuất                                                                                                                                                   |
| Ngày                | 05/09/2026                                                                                                                                                                    |
| Chủ sở hữu sản phẩm | Nguyễn Cảnh Lâm                                                                                                                                                               |
| Tên mã              | DVSG                                                                                                                                                                          |
| Kịch bản gốc        | `duong-ve-sai-gon/KICH-BAN-v0.1.md` (8 nhiệm vụ, nhân vật, thoại mẫu)                                                                                                         |
| Engine kế thừa      | HT-MB (Hải Tuyến) engine v0.6 — Three.js 0.185.1 `three/webgpu` + TSL, Rapier, recast-navigation, Vite + TS strict, Vitest + Playwright, level JSON, pipeline asset CC0/CC-BY |
| Thiết bị chuẩn      | MacBook Pro M1 Max 32 GB, Chrome Stable macOS (màn 120 Hz), Safari 26 phụ                                                                                                     |
| Phạm vi phát hành   | Chiến dịch chơi đơn khoảng 5 giờ theo tuyến chính; xác nhận bằng playtest; phát hành theo hồi (Hồi I trước)                                                                                                                 |

**NORTH STAR.** Trên đường Vào nhiệm vụ (bỏ phim), người chơi có quyền điều khiển trong mục tiêu 30 giây với điều kiện tải được công bố, rồi cảm nhận bối cảnh 1971 qua không gian và hành động đầu tiên; đi qua bốn năm trong khoảng năm giờ; đến trưa 30/4/1975 đứng trên bãi cỏ Dinh Độc Lập và không muốn bắn nữa. Mọi thứ trên màn hình — cái dép, khẩu súng, biển hiệu, tiếng đài — đều có nguồn.

Tài liệu này dùng nguyên tắc "cào lọc có bằng chứng" như PRD HT-MB: khả năng kỹ thuật được nối tới nguồn (S04–S13 được v0.1 dẫn lại từ HT-MB; chưa kiểm độc lập trong lần đánh giá này; nguồn đối chiếu mới ở §24), mọi con số hiệu năng/khối lượng/tiến độ là engineering target phải đo, và mọi chi tiết lịch sử chỉ được vào game sau khi qua registry có provenance (§9). Dấu **[KC]** = cần kiểm chứng.

---

## 0. KẾT LUẬN ĐIỀU HÀNH

**QUYẾT ĐỊNH: GO có điều kiện.** Làm **lát cắt 12–15 phút đại diện của M1 "Cổng Trời"** (tuyến rừng, hành quân, vượt ngầm nông, một encounter và một tương tác đồng đội; phần đêm/khí tài mở sau khi mẫu đạt, theo §20.2) trên engine HT-MB đã có; song song dựng registry lịch sử 1971 (quân phục, vũ khí, xe, máy bay). Không mở rộng sang M2 trước khi M1 đạt Gate G1 (60 FPS rừng rậm trên M1 Max, asset 1971 đúng qua cố vấn lịch sử, người chơi thật chấm "tin là 1971").

Theo thông tin trong PRD v0.1 (chưa kiểm build/bench thô ở lần sửa này), hai demo HT-MB được báo cáo đã chứng minh trên đúng máy chuẩn rằng engine WebGPU/TSL chạy 60–120 FPS ở arena đêm (G0 PASS, p95 9,1 ms) và dựng được một khu phố ban ngày với nhà cửa, xe thật, khói lửa, AI có IQ, súng nằm trong tay (G0.6). Bài học G0.6 cũng cho thấy ba lỗ hổng phải bịt ngay từ đầu dự án này: (1) màn ban ngày 403 draw nhưng \~54 FPS ở 1920 px trên Mac, nghĩa là ngân sách GPU đã đầy trước khi có rừng; (2) kiểm thử chỉ bằng ảnh để lọt lỗi rơi xuyên đất — mọi level phải có E2E vật lý người chơi; (3) asset Sketchfab dán nhãn CC-BY vẫn có thể là đồ rip từ game — phải có cổng kiểm nguồn.

| Khía cạnh | Phán quyết | Điều kiện |
| ---------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Rừng nhiệt đới dày, gió, ánh sáng xuyên tán ở 60 FPS | Khả thi có điều kiện            | Instancing + impostor + culling theo ô; đo ở G1 trước khi làm art; rừng là rủi ro số 1                                                |
| Tám nhiệm vụ, tám bối cảnh khác nhau                 | Khả thi                         | Mỗi bối cảnh là một "kit" (rừng, phố đổ, phố Hà Nội, cao nguyên, biển–đèo, cao su, xa lộ–đô thị lớn); reuse hệ thống, không reuse map |
| "Thật đến từng cái dép"                              | Khả thi với chi phí dữ liệu lớn | Registry lịch sử có provenance là điều kiện tiên quyết của mỗi asset; cố vấn lịch sử là một gate                                      |
| Nhân vật/quân phục 1971–75 từ thư viện CC            | Rủi ro cao                      | Không có sẵn nhiều; kế hoạch kitbash + retexture + tự dựng phụ kiện (§7.4); phải chứng minh ở G1                                      |
| Xe tăng chở bộ binh, trực thăng, B-52                | Khả thi                         | Khí tài kịch bản trên spline (D-060), platform kinematic cho tùng thiết; không mô phỏng lái                                           |
| Bơi sông, cõng thương binh, cứu người dưới gạch      | Khả thi                         | Cơ chế mini, controller state mới; thiết kế ở G1, làm ở G2                                                                            |
| Chất lượng AAA đầy đủ, mocap riêng                   | Không khả thi                   | Mixamo + IK thủ tục + vài clip đặt riêng; chấp nhận giới hạn                                                                          |
| Multiplayer                                          | Ngoài phạm vi                   | Chơi đơn cho toàn bộ v1.0                                                                                                             |

---

## 1. TẦM NHÌN

Đường về Sài Gòn là FPS chiến dịch chơi đơn kể chuyện một người lính bình thường từ Trường Sơn 1971 đến 30/4/1975. Nó khác Call of Duty ở ba điểm cố ý: máy bay Mỹ là "thời tiết" không đánh lại được suốt hai hồi đầu; có nhiệm vụ gần như không bắn; và kẻ thù có mặt người. Nó giống Call of Duty ở nhịp set piece, cảm giác súng, và độ tin cậy kỹ thuật.

Bốn lời hứa:

**Lời hứa lịch sử.** Mọi vật thể, trang phục, phương tiện, địa danh, ngày giờ trong game đều truy được nguồn tier P hoặc S trong registry (§9). Chi tiết không kiểm được thì làm mờ đi chứ không bịa.

**Lời hứa thị giác.** Rừng già có gió và tia nắng; sông có dòng; phố đổ có bụi treo trong không khí; phố sống có xe Honda và biển hiệu đúng năm; bầu trời có B-52 không nhìn thấy nhưng cảm thấy.

**Lời hứa gameplay.** Súng có trọng lượng, AI có phản xạ và chiến thuật (kế thừa TIP-018), đội hình có tên có tính nết; người chơi lớn dần thành người chỉ huy.

**Lời hứa quy trình.** Toàn bộ game được xây bằng Vibecode (Chủ nhà – Chủ thầu – Thợ), kịch bản và dữ liệu lịch sử bằng cào–lọc–làm giàu, engine bằng AI coding; mỗi hệ thống có contract, test, benchmark và evidence. Dự án là bằng chứng cho phương pháp.

Đối tượng: người chơi Việt Nam yêu FPS điện ảnh và lịch sử; cộng đồng vibecode và WebGPU; nhà giáo dục lịch sử; nhà phát hành/nhà đầu tư đánh giá năng lực sản xuất bằng AI.

---

## 2. PHẠM VI

| Nhóm | Trong v1.0 | Ngoài v1.0 |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Nội dung                    | 8 nhiệm vụ theo Kịch bản v0.1; 1 nhân vật; tiểu đội 4 + lính mới; 1 nhân vật đối phương xuyên suốt; đoạn chuyển 1973                                       | Nhánh cốt truyện; nhiệm vụ phụ; open world; chơi phía bên kia |
| Chiến đấu                   | AK-47 (Type 56), CKC, K-54, RPD, B40, B41, lựu đạn, súng máy cố định 12,7/14,5; nhặt tạm M16/M79/M60; xe tăng gọi hoả lực                                  | Lái xe tăng/máy bay; 20+ súng; tuỳ biến súng                  |
| Đội hình                    | Tiểu đội có tên; 3 lệnh ở cấp cao nhất; barks tiếng Việt                                                                                                   | Điều khiển từng người; co-op                                  |
| Đồ hoạ                      | WebGPU/TSL, rừng, terrain, nước bơi được, thời gian trong ngày cố định theo nhiệm vụ (một cảnh bình minh động), CSM, GTAO, SSR, bloom, grade theo nhiệm vụ | Path tracing; phá huỷ vật lý toàn cảnh; ray tracing phần cứng |
| Khí tài                     | Xe tăng/thiết giáp/xe tải/trực thăng/máy bay theo spline; tùng thiết; súng máy trên xe                                                                     | Vehicle combat tự do                                          |
| Nền tảng                    | macOS M1 Max Chrome (chuẩn); Safari smoke; Windows Chrome mid-range là mục tiêu G4                                                                         | Mobile; console; Firefox                                      |
| Dịch vụ                     | Save chiến dịch local (IndexedDB), settings, telemetry dev                                                                                                 | Tài khoản, cloud save, leaderboard                            |
| Ngôn ngữ                    | Tiếng Việt (thoại, UI, phụ đề); phụ đề tiếng Anh ở G5                                                                                                      | Lồng tiếng Anh                                                |

**Nguyên tắc chống phình:** feature mới phải trả lời "nó có nằm trong một trong 8 nhiệm vụ và có được nhìn thấy trong 5 phút chơi của nhiệm vụ đó không". Không có thì vào backlog.

**Phát hành theo hồi:** Hồi I (M1–M3) là sản phẩm có thể chơi và trình diễn trước; Hồi II–III nối thêm. Save chiến dịch phải migrate được giữa các bản.

---

## 3. NỘI DUNG — TÁM NHIỆM VỤ VÀ YÊU CẦU KỸ THUẬT CỦA TỪNG NHIỆM VỤ

Chi tiết cốt truyện, nhân vật, thoại ở Kịch bản v0.1. Bảng này là "hoá đơn kỹ thuật" của từng nhiệm vụ: cái gì phải dựng, to bao nhiêu, cơ chế nào mới.

| # | Nhiệm vụ · thời gian | Địa hình / kích thước map | Cơ chế mới | Khí tài, địch đặc thù | Thời lượng |
| --------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----- |
| M1                                                                                            | Cổng Trời · Trường Sơn 1/1971            | Rừng già dốc, suối, ngầm, đường đất; 1,2 × 0,8 km tuyến tính chia 4 ô stream             | Hành quân có tải, "tai" nghe máy bay, vượt ngầm, súng máy cố định, tầm nhìn rừng, chăm sốt rét đồng đội (script)              | Zil-157, Gaz-63, 12,7 mm; AC-130 (đêm), OV-10, UH-1, B-52 (rung đất); thám báo tiger stripe, M16/CAR-15 | 35 ph |
| M2                                                                                            | Bản Đông · Đường 9 2–3/1971              | Điểm cao có cứ điểm, Đường 9, bãi đổ trực thăng, rừng thưa hơn; 1,5 × 1,0 km, 4 ô        | Tấn công cứ điểm đêm (bộc phá, hào), tùng thiết, bắn trực thăng, tù binh (băng bó), lựa chọn không thưởng                     | PT-76, T-54; M41, M113, GMC, M60, M79, Claymore; UH-1H, AH-1G, CH-47, A-1; lính dù Sài Gòn              | 40 ph |
| M3                                                                                            | Tám mươi mốt ngày đêm · Quảng Trị 9/1972 | Sông rộng 150–200 m có dòng, thị xã đổ nát 0,6 × 0,5 km, Thành cổ; 3 ô + sông            | Bơi/ngụp, chiến đấu nhà đổ (leo, chui, phá tường), "bị bom", chỉ huy tạm (2 lệnh), pháo sáng                                  | RPD, AK báng gấp, B40/B41; M48 (xa), pháo 105/155, pháo hạm, B-52, A-37; TQLC Sài Gòn                   | 40 ph |
| M4                                                                                            | Mười hai ngày đêm · Hà Nội 12/1972       | Phố Khâm Thiên và ngõ, nóc nhà, hồ Ngọc Hà xa; 0,5 × 0,4 km "sống" rồi đổ                | Đi bộ thành phố hoà bình (tương tác, loa, tàu điện), cứu người dưới gạch (đào, cõng), phòng không 14,5 theo âm thanh/ánh sáng | ZPU-2, 12,7; SAM-2 (vạch lửa), B-52 cháy rơi (nền), F-4, F-111; tàu điện, xe đạp, hầm ống               | 30 ph |
| —                                                                                             | Đoạn chuyển 1973 · bờ Thạch Hãn          | Cảnh cắt in-engine, không chơi                                                           | —                                                                                                                             | Cầu phao, tù binh hai bên                                                                               | 3 ph  |
| M5                                                                                            | Buôn Ma Thuột · 3/1975                   | Rừng khộp đất đỏ → thị xã cao nguyên nguyên vẹn 0,8 × 0,6 km; 4 ô                        | Chỉ huy tiểu đội (3 lệnh), gọi tăng bắn hoả điểm (pháo hiệu), bảo vệ dân dưới hầm                                             | T-54B, K63, Zil-131; M41, M113, V-100, cối 81, A-37; sư đoàn 23, ĐPQ, cảnh sát dã chiến                 | 35 ph |
| M6                                                                                            | Đèo Hải Vân · Huế–Đà Nẵng 3/1975         | Đèo ven biển 3 km trên xe + Đà Nẵng cảng/sân bay 0,7 × 0,5 km; stream tuyến tính         | Lên/xuống xe đang chạy chậm, phân biệt người bỏ súng, cứu người dưới nước                                                     | K63, Zil-131, Jeep; xe bỏ đầy đường; Boeing 727, C-130 (xa), tàu biển                                   | 30 ph |
| M7                                                                                            | Cửa ngõ · Xuân Lộc 4/1975                | Rừng cao su hàng thẳng, thị xã nhỏ, Đường 1, ngã ba, nhà thờ; 1,2 × 0,8 km               | Thua một đợt xung phong (script), chống tăng B41, CBU-55 nền, cõng đồng đội                                                   | T-54, K63, pháo 130; M48, M113, M72, A-37, F-5; sư đoàn 18, lữ dù                                       | 40 ph |
| M8                                                                                            | Cầu Sài Gòn · 30/4/1975                  | Xa lộ 2,5 km trên xe → cầu Sài Gòn → Hàng Xanh → Thị Nghè → Dinh Độc Lập; 6 ô tuyến tính | Bình minh động, "đi và nhìn" có tốc độ, trận cầu, kiểm soát ngón tay (người bỏ súng), kết chơi được không bắn                 | T-54B, K63, Gaz-69; M48, M113; CH-53/46 (xa); Honda, Lambretta, taxi, xích lô máy, xe lam; Dinh Độc Lập | 40 ph |

Tổng diện tích dựng ≈ 8 map, mỗi map 0,3–1,5 km² phần chơi được, cộng "đường chân trời" rẻ (khối, billboard). So với HT-MB (0,02 km²) là bước nhảy 20–50 lần về diện tích; câu trả lời kỹ thuật là streaming theo ô, kit bối cảnh dùng lại trong một nhiệm vụ, và địa hình procedural trên dữ liệu cao độ thật.

---

## 4. THIẾT KẾ GAMEPLAY

Loop cốt lõi giữ từ HT-MB: quan sát → chọn nhịp → di chuyển cùng đội → giao chiến → đổi vị trí → micro-objective → nhịp điện ảnh → checkpoint. Thêm ba loop đặc trưng: **hành quân** (đi, nghe, giữ sức, chăm đồng đội), **giữ** (sửa công sự, kéo thương binh, lấy đạn — M3), **không bắn** (M4, M6, M8).

### 4.1 Người chơi

| ID | Yêu cầu | Ưu tiên | Nghiệm thu |
| ------------------------------ | ------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| PLY-001                        | Đi, chạy, cúi, bò (mới), nhảy thấp, vault; sức bền ảnh hưởng tốc độ khi mang nặng (M1)      | Must   | Controller 60 Hz, không xuyên; E2E vật lý mỗi level (D-075)                     |
| PLY-002                        | Bơi mặt nước và ngụp có sức, dòng chảy đẩy, mảnh pháo trên mặt nước gây sát thương (M3, M6) | Must   | Test dòng chảy deterministic; không kẹt bờ                                      |
| PLY-003                        | Cõng đồng đội/dân (tốc độ giảm, không bắn, thả) — M3, M4, M7                                | Must   | State machine không kẹt; thả đúng chỗ                                           |
| PLY-004                        | Đào/kéo người dưới đổ nát (mini tương tác giữ phím) — M4                                    | Must   | Không xuyên collider gạch                                                       |
| PLY-005                        | Lên/xuống xe đang chạy chậm; ngồi trên tháp pháo/thùng xe, bắn từ xe — M2, M5–M8            | Must   | Platform kinematic mang người chơi; camera không giật                           |
| PLY-006                        | Đặt bộc phá/đếm; pháo hiệu chỉ mục tiêu cho tăng                                            | Should | Idempotent, có huỷ                                                              |
| PLY-007                        | Máu không tự hồi; băng cá nhân (giới hạn) hồi một phần; đồng đội băng cho nhau (script)     | Must   | Cân bằng ở G2 bằng playtest; không "cửa sổ đỏ" kiểu hiện đại                    |
| PLY-008 | Kỷ luật với dân và người đã đầu hàng; tín hiệu hình/âm rõ, không bẫy thất bại; xử lý đạn đã bắn và nguồn sát thương theo §20.3 | Must | UX-107; checkpoint an toàn; không gán sát thương AI/script cho người chơi |

### 4.2 Vũ khí

| ID | Yêu cầu | Ưu tiên | Nghiệm thu |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------- |
| WPN-001                        | Kho súng người chơi theo năm: 1971 AK-47/Type 56 báng gỗ, CKC, K-54; 1972 AK báng gấp, RPD; 1975 AK, B41 (Út), lựu đạn chày/K? [KC] | Must   | Model, âm, tốc độ bắn, băng đạn đúng registry `weapons` |
| WPN-002                        | Nhặt tạm vũ khí địch (M16A1, M79, M60) với đạn hạn chế; không giữ qua checkpoint                                                    | Should | Bỏ khi hết đạn; không phá cân bằng                      |
| WPN-003                        | Hitscan cho súng bộ binh (kế thừa), **đạn bay** cho B40/B41/M79/lựu đạn (parabol, thời gian nổ)                                     | Must   | Replay seed; test parabol                               |
| WPN-004                        | Súng máy cố định 12,7/14,5 (M1, M2, M4): nòng nóng, băng, quay giới hạn, bắn theo âm thanh/pháo sáng với máy bay                    | Must   | Không hạ được B-52 (không có trong hit list)            |
| WPN-005                        | Đổi băng, kẹt đạn hiếm (chỉ khi ngâm nước — M3), lau súng ở chỗ nghỉ (tương tác, không bắt buộc)                                    | Could  | Không gây frustration; tuning data                      |
| WPN-006                        | Viewmodel lớp riêng (TIP-017b) + tay FP theo quân phục từng năm (áo Tô Châu, tay trần, bao xe)                                      | Must   | Đúng màu vải theo registry `uniforms`                   |

### 4.3 AI, đội hình, khí tài

| ID | Yêu cầu | Ưu tiên | Nghiệm thu |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------- |
| AI-001                         | FSM TIP-018 (ENGAGE/cover/flank/suppression/hearing) làm nền; thêm archetype: bộ binh Sài Gòn, dù (hung hãn, phản kích), TQLC (giữ chốt, lựu đạn), thám báo (ẩn, rút, gọi trực thăng), ĐPQ (dễ bỏ chạy), lính "đã bỏ súng" (không phải mục tiêu) | Must | Mỗi archetype có tuning JSON; test 15+ case             |
| AI-002                         | Địch dùng vũ khí cộng đồng: M60 cố định, M79 cầu vồng, M72 chống tăng ta                                                                                                                                                                         | Must | Đạn bay dùng chung WPN-003                              |
| AI-003                         | Địch có hoả lực gián tiếp theo script: pháo/cối rơi theo vùng, không nhắm cá nhân                                                                                                                                                                | Must | Vùng nguy hiểm đọc được (tiếng rít, đất bay)            |
| SQD-001                        | Tiểu đội có tên, theo spline/navmesh, cover marker, bắn hỗ trợ, cõng nhau, chết theo kịch bản hoặc theo gameplay (lính mới)                                                                                                                      | Must | Không chặn cửa; hồi phục teleport ngoài tầm nhìn        |
| SQD-002                        | Lệnh tăng theo cấp: 0 lệnh (M1–M2) → 2 (M3) → 3 (M5+): theo tôi / giữ / đánh vào                                                                                                                                                                 | Must | Lệnh có phản hồi thoại; không deadlock                  |
| SQD-003                        | Barks tiếng Việt theo event, ưu tiên, cooldown; giọng từng người                                                                                                                                                                                 | Must | Không chồng thoại objective                             |
| VEH-001                        | Khí tài trên spline (D-060): xe tải, xe tăng ta, M41/M48/M113 địch, trực thăng, máy bay; kinematic; có trạng thái cháy/bị hạ tại điểm kịch bản                                                                                                   | Must | Không lái; deterministic theo thời gian sim             |
| VEH-002                        | Xe tăng ta là platform: bộ binh (người chơi + AI) đứng/ngồi, bắn từ xe; xe dừng/bắn theo lệnh pháo hiệu                                                                                                                                          | Must | Physics: người chơi được mang theo, không rơi khi xe rẽ |
| VEH-003                        | Trực thăng UH-1 đổ quân, AH-1 bắn rốc-két theo pattern, có thể bị hạ ở M2; rotor quay, bụi bãi đáp                                                                                                                                               | Must | Chỉ hạ được ở nhiệm vụ cho phép                         |
| VEH-004                        | "Máy bay là thời tiết": AC-130 quỹ đạo tròn bắn xuống, B-52 rung đất + sóng bụi, OV-10 đánh dấu khói, F-4/A-37 bổ nhào theo script                                                                                                               | Must | Âm thanh có hướng (AUD-003)                             |
| MIS-001                        | Mission graph JSON (kế thừa) + encounter director theo vùng, budget spawn, checkpoint deterministic; thêm node "cutscene in-engine", "letter", "choice không thưởng"                                                                             | Must | Restart invariant; hash trạng thái                      |
| MIS-002                        | Save chiến dịch: tiến độ nhiệm vụ, thư đã mở, thương vong tiểu đội có tên, cấp của Thành; migrate giữa bản phát hành                                                                                                                             | Must | Test migrate v(n) → v(n+1)                              |

### 4.4 Độ khó và cân bằng

Ba mức (Tân binh / Chiến sĩ / Cựu binh) chỉ đổi sát thương nhận và lượng băng cá nhân; không đổi AI. Số liệu TTK, spread, sát thương đặt trong `content/tuning/*.json`, cân bằng bằng playtest người thật ở G2 và G4 (không tự chấm bằng test).

---

## 5. ĐỒ HOẠ KỸ THUẬT

**Bổ sung v0.2:** danh sách hiệu ứng ở §5 là khả năng dự kiến; mức bắt buộc/có điều kiện theo §22.3. Không bật đồng thời toàn bộ post stack làm mặc định. Phiên bản engine dưới đây là thông tin kế thừa, chưa kiểm trong repo.

Nền: Three.js 0.185.1 `three/webgpu`, TSL only (không ShaderMaterial/onBeforeCompile), WebGPU primary + WebGL 2 fallback cùng content path, post stack node (`pass`, MRT, GTAO, SSR, bloom, FXAA/TRAA, film, vignette, AgX). Kế thừa từ HT-MB: CSMShadowNode, HDRI + PMREM, lớp viewmodel riêng, FX khói/lửa/tàn lửa/bụi instanced billboard TSL, mưa GPU, mặt đường ướt SSR, level JSON builder, instancing prop theo primitive với `instanceColor`. Bảng dưới liệt kê **cái mới** và quy tắc.

### 5.1 Ánh sáng, bầu trời, thời gian

| ID | Yêu cầu | Ghi chú |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| REN-001             | Mỗi nhiệm vụ có "sky profile": HDRI Poly Haven phù hợp giờ/trời + sun đúng phương vị theo ngày và vĩ độ (tính từ registry `timeline`: ví dụ Buôn Ma Thuột 10/3 rạng sáng; Sài Gòn 30/4 bình minh 5h50 [KC]) | Sun az/el tính bằng công thức thiên văn, không đặt tay |
| REN-002             | Bình minh động ở M8 (30 phút chơi = 6h00 → 11h30 nén): đổi HDRI cross-fade, sun, màu fog, cường độ bóng                                                                                                     | Chỉ M8; các map khác cố định giờ                       |
| REN-003             | Đêm (M1, M2, M3): trăng + pháo sáng (PointLight rơi có dù, bóng động 1 nguồn), đèn gầm xe, lửa; CSM đêm dùng trăng                                                                                          | ≤ 2 shadow light cục bộ trong shot                     |
| REN-004             | Tia nắng xuyên tán (god rays) trong rừng: volumetric ray-march thưa theo depth + shadow map, quality High/Medium                                                                                            | Off ở Low; đo GPU riêng                                |
| REN-005             | Fog theo tầng (height fog) + fog thể tích cục bộ (sương suối, bụi sau bom) bằng box volume TSL                                                                                                              | Không dùng post fog toàn màn cho khói cục bộ           |
| REN-006             | Grade màu theo nhiệm vụ (LUT 3D, phong cách phim màu 70s nhẹ, hạt phim), không tint quá tay                                                                                                                 | LUT là data; A/B với ảnh tư liệu                       |

### 5.2 Địa hình và thảm thực vật — rủi ro số 1

| ID | Yêu cầu | Ghi chú |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| TER-001             | Terrain heightmap tile (512² mỗi ô 256 m, LOD 4 mức, skirt), sinh từ DEM thật (SRTM/Copernicus 30 m) của đúng toạ độ Trường Sơn/Đường 9/Hải Vân **[KC giấy phép DEM]** + chi tiết procedural nhỏ; các map đô thị dùng terrain phẳng có bậc | Engine mới `engine/terrain`; tận dụng phương pháp geodata của Chủ nhà |
| TER-002             | Vật liệu terrain: splat 4–6 lớp (đất đỏ, mùn lá, đá, bùn, cỏ, nhựa đường) triplanar, tiling phá lặp bằng noise, wetness theo lớp                                                                                                           | TSL; texture Poly Haven/ambientCG 1K–2K                               |
| TER-003             | Collider terrain heightfield Rapier + navmesh recast trên terrain (bake offline theo ô)                                                                                                                                                    | Bake trong pipeline, không lúc chạy                                   |
| VEG-001             | Hệ thảm thực vật instanced: cây tán (3 LOD + impostor octahedral), cây bụi, dương xỉ, cỏ, dây leo; đặt bằng scatter map theo độ dốc/độ cao/tuyến (không ngẫu nhiên tự do — seeded)                                                         | Mục tiêu G1: 20–40 nghìn instance nhìn thấy, ≤ 40 draw cho toàn rừng  |
| VEG-002             | Gió: dịch đỉnh theo noise + bend theo chiều cao (TSL `positionNode`), gió mạnh lên khi trực thăng/bom                                                                                                                                      | Không animation skinned cho cây                                       |
| VEG-003             | Lá: alpha-to-coverage hoặc alpha hashed + two-sided lighting, subsurface giả (translucency theo hướng sáng)                                                                                                                                | Kiểm alpha trên WebGL2 fallback                                       |
| VEG-004             | Culling theo ô (frustum + khoảng cách + occlusion thô bằng bounding của ô), chọn LOD trên GPU khi có compute (WebGPU) và trên CPU theo ô (fallback)                                                                                        | Compute là mục tiêu; fallback phải chạy                               |
| VEG-005             | Rừng khộp (M5), cao su (M7) là biến thể scatter của cùng hệ; phố có cây (M4, M8) dùng cây đơn lẻ                                                                                                                                           | Một hệ, nhiều preset                                                  |
| VEG-006             | Va chạm: cây thân là collider capsule; bụi/cỏ không collider, có "đè" khi đi qua (uốn theo vị trí người chơi/xe)                                                                                                                           | Đè bằng uniform vị trí ≤ 8 tác nhân                                   |

### 5.3 Nước

| ID | Yêu cầu | Ghi chú |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| WAT-001             | Sông (M3 Thạch Hãn, M6 biển/cảng, M1 suối/ngầm): mặt nước có dòng (flow map), sóng nhỏ, phản xạ SSR + planar dự phòng, khúc xạ theo depth, bọt ở bờ, bùn đục | TSL; ưu tiên WebGPU; fallback không khúc xạ |
| WAT-002             | Người chơi và AI tương tác: bơi (PLY-002), gợn nước theo chuyển động, đạn/pháo tạo cột nước (VFX pool)                                                       | Cột nước từ pháo là điểm nhấn M3            |
| WAT-003             | Mưa/ướt kế thừa HT-MB (M1 mưa phùn)                                                                                                                          | —                                           |

### 5.4 Kiến trúc, đô thị, phá huỷ

| ID | Yêu cầu | Ghi chú |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| CTY-001             | Builder level JSON (TIP-019) mở rộng: kit nhà theo bối cảnh — thị xã miền Trung 1972, phố Hà Nội 1972 (nhà ống mái ngói, ngõ), thị xã cao nguyên 1975, Đà Nẵng ven biển, thị xã Đông Nam Bộ, Sài Gòn (nhà phố, biệt thự, xa lộ, cầu) — mỗi kit là bộ facade/roof/sign parametric + prop | Không dựng từng nhà bằng tay; biển hiệu từ pool text đúng thời (registry `daily-life`) |
| CTY-002             | Trạng thái phá huỷ **được tác giả**: mỗi lot có mức damage 0–1 → biến thể đổ nát (TIP-019 đã có) + đống gạch, dầm lộ, hố bom trên terrain                                                                                                                                               | Không phá huỷ vật lý runtime trừ script (tường thủng khi bộc phá)                      |
| CTY-003             | Nội thất chơi được cho nhà đổ (M3) và nhà dân (M4, M5): kit phòng 2–3 tầng, cầu thang, hầm, lỗ tường                                                                                                                                                                                    | Navmesh nhiều tầng; collider khớp hình                                                 |
| CTY-004             | Công trình mốc dựng theo tư liệu: Thành cổ Quảng Trị (tường, cổng), cầu Sài Gòn, Dinh Độc Lập (mặt tiền, cổng, bãi cỏ, nóc), đèo Hải Vân                                                                                                                                                | Mỗi mốc là 1 TIP riêng có ảnh đối chứng                                                |
| CTY-005             | Đường chân trời rẻ: khối + billboard + fog; núi xa bằng terrain LOD thấp                                                                                                                                                                                                                | —                                                                                      |

### 5.5 Hiệu ứng

| ID | Yêu cầu | Ghi chú |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| VFX-001             | Kế thừa: muzzle, tracer, impact/decal, vỏ đạn, khói, lửa, tàn lửa, bụi, mưa                                               | Pool, không allocation                          |
| VFX-002             | B-52 rải thảm: dãy nổ theo đường thẳng ở xa (flash → cột đất → sóng bụi lan), rung camera theo khoảng cách, ù tai (audio) | Không thấy máy bay; kịch bản chỉ định đường bom |
| VFX-003             | AC-130: tracer đỏ cong từ trên xuống theo quỹ đạo tròn, tiếng "cưa" Vulcan trễ theo khoảng cách, xe cháy                  | M1                                              |
| VFX-004             | Pháo sáng: rơi có dù, ánh sáng lắc, khói trắng; chiếu sáng thật (light)                                                   | M2, M3                                          |
| VFX-005             | Cột nước pháo trên sông; bụi gạch treo lâu trong nhà đổ; lá bay khi trực thăng; đất đỏ bụi xe                             | M3, M2, M5                                      |
| VFX-006             | CBU-55 (M7) và cháy rừng cao su: một cú "nén" ánh sáng rồi cây ngã đồng loạt (instanced anim), không máu me               | Làm kỹ, có A/B với người xem                    |
| VFX-007             | Tổn thương người: máu mức vừa, ngã theo ragdoll đơn giản hoặc clip chết; xác che sau vài giây bằng bụi/thời gian          | Rating M/17+                                    |

### 5.6 Nhân vật và hoạt hình

| ID | Yêu cầu | Ghi chú |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| CHR-001             | Skeleton Mixamo chung cho mọi người (ta, địch, dân); mesh thân theo quân phục từng lực lượng/năm; đầu 6–8 biến thể Việt (mặt, tóc, tuổi) [KC nguồn model đầu CC]                                   | Đầu là rủi ro asset (§7.4)                   |
| CHR-002             | Phụ kiện gắn bone: mũ cối, mũ tai bèo, mũ sắt M1 (lưới/không), nón đỏ/xanh, bao xe, ba lô, bi đông, dép/giày; hoán đổi theo registry                                                               | Attachment table trong JSON                  |
| CHR-003             | Hoạt hình: Mixamo (idle/walk/run/aim/fire/reload/hit/death/crouch) + đặt thêm: bò, bơi, cõng, đào, lên xe, ngồi xe, bắn từ xe, giơ tay, cởi áo; thiếu clip → IK/procedural (TIP-017 armIk mở rộng) | Danh sách clip là contract G1                |
| CHR-004             | LOD skinned 3 mức + impostor cho hàng người xa (M6 đám đông, M8 dân); ≤ 16 skinned full gần camera                                                                                                 | Đám đông xa là instanced billboard hoạt hình |
| CHR-005             | Tay FP đổi theo quân phục/năm; găng không dùng (bộ đội 1971 tay trần) [KC]                                                                                                                         | —                                            |

### 5.7 Chất lượng và hiệu năng render

| ID | Yêu cầu | Ghi chú |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| PRF-001             | Quality Low/Medium/High + dynamic resolution 0,65–1,0 (kế thừa); High mặc định trên M1 Max ở 1920 px                               | Không đổi gameplay            |
| PRF-002             | Streaming theo ô: nạp ô kế tiếp, giải phóng ô đã qua (map tuyến tính M1, M6, M8); ô = terrain tile + vegetation cell + level chunk | Không hitch > 50 ms khi đổi ô |
| PRF-003             | Shader warmup ở loading theo danh sách material của nhiệm vụ                                                                       | —                             |
| PRF-004             | Texture KTX2/Basis bắt buộc từ G2 (nợ HT-MB); 1K mặc định, 2K hero, 4K không                                                       | Validator trong CI            |
| PRF-005             | Bóng: CSM 2–3 cascade theo map; prop < 0,8 m không đổ bóng; rừng: chỉ cây tán đổ bóng, LOD thấp không                              | Đo từng map                   |

---

## 6. ÂM THANH

| ID | Yêu cầu | Ghi chú |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| AUD-001             | Bus master/SFX/thoại/radio–loa/nhạc; ducking theo ưu tiên (kế thừa)                                                                                                          | —                                         |
| AUD-002             | Súng 3 lớp (transient/body/tail) theo môi trường: rừng (tail dài, echo đồi), phố đổ (phản xạ gắt), phố sống, đèo (gió)                                                       | Reverb preset theo zone                   |
| AUD-003             | Máy bay có hướng và khoảng cách: Doppler, trễ âm theo khoảng cách (B-52 rung đất trước, tiếng sau), AC-130 tiếng bắn trễ, trực thăng rotor thump; HRTF PannerNode            | "Máy bay là thời tiết" sống bằng âm thanh |
| AUD-004             | Môi trường theo giờ và địa hình: rừng đêm/ngày (côn trùng, chim, suối, mưa), phố (loa, tàu điện, xe, chợ), biển (sóng, còi tàu)                                              | Loop + one-shot theo seed                 |
| AUD-005             | Thoại tiếng Việt: chất giọng vùng (Nghệ, Hà Nội, Tày, Quảng Trị, Gò Công); dev dùng TTS placeholder, **bản phát hành dùng diễn viên người**; không nhân bản giọng người thật | Quyết định Chủ nhà; ghi ADR               |
| AUD-006             | Bản tin đài/loa: nội dung theo registry `timeline` (tư liệu thật, không bịa lời người thật), giọng đọc dựng lại                                                              | —                                         |
| AUD-007             | Nhạc gốc: sáo trúc, đàn bầu, ghi-ta gỗ, dây tối giản; leitmotif Thu/Hải/Quyết; không bài hát có bản quyền                                                                    | Hợp đồng nhạc sĩ hoặc sáng tác có license |

---

## 7. ASSET

### 7.1 Chính sách license (kế thừa D-060, siết thêm)

Được phép: Adobe Mixamo (nhân vật, animation, auto-rig), CC0 (Poly Haven, ambientCG, Kenney, Quaternius…), CC-BY 4.0 (Sketchfab…) với attribution bắt buộc trong manifest, CREDITS.md và màn credits; asset tự dựng (procedural, kitbash) và asset đặt riêng có hợp đồng. **Không được phép**: asset của Call of Duty hay bất kỳ game nào; asset "rip" từ game dù dán nhãn CC (D-072 — kiểm mô tả, tag, tên material, tác giả trước khi tải); nhạc/lời bài hát có bản quyền; ảnh tư liệu có bản quyền làm texture trực tiếp (chỉ làm tham chiếu). Mọi file có `license`, `source`, `url`, `authors`, `sha256`, `size` trong manifest; thiếu là không vào build.

### 7.2 Asset là thể hiện của registry

Mỗi asset lịch sử (quân phục, súng, xe, máy bay, biển hiệu, xe dân sự, đồ dùng) phải trỏ tới một entry trong registry (§9) bằng `registryId`, và entry đó phải có ít nhất một nguồn tier P/S. Asset không có registryId chỉ được dùng cho vật thể "vô danh" (đá, đất, cây, nhà chung). Validator CI kiểm liên kết này.

### 7.3 Danh mục và ước lượng khối lượng (engineering estimate, hiệu chỉnh sau G1)

**Ghi chú v0.2:** một số số lượng gốc không khớp danh sách liệt kê (nhân vật, súng, máy bay). Chưa dùng các tổng này để chốt báo giá; phải tách SKU/biến thể trong asset manifest. Chưa có kiểm kê độc lập ở lần sửa này.

| Nhóm | Số lượng ước | Nguồn dự kiến | Ghi chú |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------- |
| Nhân vật thân (quân phục)                | 12 bộ: bộ đội 1971 Tô Châu, bộ đội 1972, QGP 1975 tai bèo, TNXP nữ, tự vệ HN (nam/nữ), dân HN, dân BMT/SG (nam/nữ), lính SG bộ binh, dù, TQLC, ĐPQ, thám báo, phi công Mỹ                            | Mixamo thân + retexture + kitbash CC-BY; đặt riêng 3–4 bộ nếu G1 chứng minh không có | Rủi ro cao nhất                    |
| Đầu/mặt                                  | 8 biến thể Việt + 2 Mỹ                                                                                                                                                                               | CC-BY/CC0 scan hoặc đặt riêng [KC]                                                   | —                                  |
| Phụ kiện đội/đeo                         | 25                                                                                                                                                                                                   | CC-BY + procedural (mũ cối, tai bèo, dép, bao xe, ba lô, bi đông, ruột tượng)        | Convert-model pipeline             |
| Súng người chơi/địch                     | 14: AK-47/Type 56 (2 báng), CKC, K-54, RPD, RPK, B40, B41, lựu đạn chày; M16A1, CAR-15, M79, M60, M72, M1911                                                                                         | Sketchfab CC-BY (nhiều), kiểm rip                                                    | Pipeline convert-weapon có sẵn     |
| Súng cố định/pháo                        | 8: 12,7 DShK, 14,5 ZPU-2, cối 60/82, DKZ, 37 mm (nền), M60 cố định, 105 (nền)                                                                                                                        | CC-BY + procedural                                                                   | —                                  |
| Xe ta                                    | 8: PT-76, T-54B, K63, Zil-157, Zil-131, Gaz-63, Gaz-66, Gaz-69                                                                                                                                       | CC-BY (T-54, Zil phổ biến), kiểm rip                                                 | Rotor/bánh giữ pivot               |
| Xe địch                                  | 8: M41, M48, M113, V-100, GMC, Jeep M151, Dodge, xe tang lễ? (không)                                                                                                                                 | CC-BY                                                                                | —                                  |
| Máy bay                                  | 12: AC-130A, B-52D (chỉ cháy rơi, xa), OV-10, UH-1H, AH-1G, CH-47, A-1, A-37, F-4, F-5, F-111, CH-53/CH-46; SAM-2 vạch lửa                                                                           | CC-BY; hạ LOD mạnh                                                                   | Phần lớn ở xa                      |
| Xe dân sự                                | 15: Honda Dame/67/SS50, Vespa (có), Lambretta 3 bánh, xe lam, taxi Renault 4CV, Peugeot 404, Citroën, xích lô, xích lô máy, xe đạp Thống Nhất/Phượng Hoàng, tàu điện HN, xe buýt, xe tải Desoto [KC] | CC-BY (một số có), procedural xe đạp/xích lô                                         | Sài Gòn/Hà Nội "sống" nhờ nhóm này |
| Kit kiến trúc                            | 6 kit × 20–30 module facade/mái/cổng/biển                                                                                                                                                            | Procedural TIP-019 mở rộng + texture Poly Haven                                      | Không tải model nhà                |
| Công trình mốc                           | 5: Thành cổ, cầu Sài Gòn, Dinh Độc Lập, đèo Hải Vân (địa hình + đường), cổng chào thị xã                                                                                                             | Tự dựng theo ảnh/sơ đồ                                                               | Mỗi cái là 1 TIP                   |
| Prop                                     | 350–500: quân dụng (hòm đạn, bao cát có, dây thép gai, hào, hầm chữ A, bếp Hoàng Cầm, võng, đèn dầu, radio, máy PRC-25), dân dụng theo vùng/năm, biển hiệu, cột điện, chợ                            | Poly Haven CC0 (nhiều), CC-BY, procedural                                            | Instanced                          |
| Thực vật                                 | 35 loài/biến thể: cây rừng già 6, cây tầng dưới 6, dương xỉ/chuối rừng 5, cỏ 4, dây leo 3, khộp 3, cao su 2, cây phố 4 (phượng, bàng, me, xà cừ)                                                     | Poly Haven/Quaternius CC0, Sketchfab CC-BY, tự tạo impostor                          | LOD + impostor bắt buộc            |
| Texture PBR                              | 150–200 bộ 1K–2K                                                                                                                                                                                     | Poly Haven/ambientCG CC0                                                             | KTX2                               |
| HDRI                                     | 10                                                                                                                                                                                                   | Poly Haven CC0                                                                       | Theo sky profile                   |
| Âm thanh                                 | 600–900 file                                                                                                                                                                                         | CC0 (freesound CC0, sonniss GDC packs [KC license]) + thu riêng                      | Manifest riêng                     |
| Thoại                                    | \~1.500 dòng                                                                                                                                                                                         | Diễn viên                                                                            | Bản dev TTS                        |

### 7.4 Kế hoạch cho phần khó nhất — nhân vật 1971–75

Thư viện CC gần như không có bộ đội Việt Nam/lính Sài Gòn đúng chuẩn. Kế hoạch ba tầng, chứng minh ở G1 bằng đúng một nhân vật (bộ đội 1971):

1. **Thân**: chọn 2–3 thân Mixamo (hoặc mesh người CC-BY auto-rig bằng Mixamo) làm base; quần áo được **retexture** (vải Tô Châu xanh lá bạc màu, bà ba đen, đồ rằn ri hoa rừng/sóng biển/tiger stripe theo registry) trên UV thân; nếp vải procedural qua normal map.
2. **Phụ kiện**: mũ cối, mũ tai bèo, mũ sắt M1, bao xe, ba lô, bi đông, dép, giày, bốt — model riêng gắn bone (CHR-002), convert qua `convert-model.mjs`.
3. **Đầu**: 8 biến thể mặt Việt từ scan/model CC (kiểm rip) hoặc đặt nghệ sĩ; tóc ngắn theo thời; da tay FP theo nhân vật.

Nếu sau G1 tầng 1 không đạt "tin là 1971" theo cố vấn lịch sử và người chơi thật, chuyển sang đặt riêng 3–4 bộ thân (ngân sách ngoài AI) — ghi ADR. Không kéo dài thử nghiệm quá 3 tuần.

### 7.5 Pipeline và quy tắc kỹ thuật

Script kế thừa: `fetch-assets` (Poly Haven), `convert-weapon`, `convert-model` (chuẩn hoá, nướng skin, join material, override material, manifest + size), `convert-mixamo`, `extract-arms`, `optimize-models`, `credits`. Thêm: `convert-character` (retexture + attachment table), `make-impostor` (octahedral từ model cây), `terrain-bake` (DEM → tile heightmap + splat + navmesh), `scatter-bake` (scatter map → instance buffer theo ô), `ktx2` (toàn bộ texture), `validate-assets` (license, sha256, registryId, texel density, tri budget, tên).

Quy tắc: đơn vị mét, +x là chiều dài xe, đáy y = 0; texel density 512–1024 px/m gần, 128–256 xa; tri budget: nhân vật ≤ 25k LOD0, súng FP ≤ 20k, xe ≤ 40k, máy bay ≤ 15k, cây LOD0 ≤ 8k + impostor, prop ≤ 3k; material ≤ 4/model (join khi convert); tên `veh_`, `chr_`, `wpn_`, `veg_`, `prop_`, `bld_`, `lm_`.

### 7.6 Cổng cố vấn lịch sử

Mỗi asset lịch sử qua checklist trước khi được đánh dấu `approved`: đúng năm, đúng lực lượng, đúng vùng, đúng biến thể (ví dụ AK-47 báng gỗ 1971 vs báng gấp), màu/vải/phù hiệu, cách mang đeo; nguồn ảnh đối chứng đính kèm; người duyệt ký (Chủ nhà hoặc cố vấn). Asset `approved = false` chỉ chạy trong build dev.

---

## 8. UI, UX, TRÌNH BÀY, TIẾP CẬN — cập nhật v0.2

### 8.1 Nguyên tắc giao diện

**Giao diện mang chất liệu của ký ức; thông tin chiến đấu phải rõ ngay.** Menu dùng giấy, vải, mực và bản đồ minh họa; HUD dùng chữ sạch, tương phản tốt. Không ép mọi thông tin thành đồ vật trong thế giới game: việc đọc máu, đạn và mục tiêu không được biến thành thao tác rườm rà. Không dùng màn hình vệ tinh, kính nhìn đêm, mã nhị phân hay nhiễu số làm ngôn ngữ chủ đạo cho bối cảnh 1971–1975.

UX-001 được làm rõ: không mini-map mặc định *(sửa DV-043, 2026-09-06: Chủ nhà chọn minimap bản đồ giấy bật mặc định ở M1 + la bàn + marker 3D + bản đồ chiến thuật phím M; tắt bằng N)*, nhưng có trợ giúp định hướng tùy chọn. Hiển thị cả đạn trong súng và băng dự trữ ở chế độ mặc định; chế độ Nhập vai có thể ẩn số đạn nhưng phải có thao tác kiểm tra. Nhịp thở và thay đổi hình ảnh hỗ trợ trạng thái sức khỏe, không phải kênh thông tin duy nhất.

### 8.2 Luồng vào game và quay lại

| Màn hình | Nội dung và thao tác chính | Trạng thái phải xử lý |
| --- | --- | --- |
| Khởi động lần đầu | Tiếng Việt mặc định; phụ đề bật; nút Bắt đầu; truy cập ngay Âm thanh, Phụ đề, Giảm chuyển động | Chưa phát tiếng trước thao tác người dùng; cài đặt lưu trước khi phát phim |
| Menu chính | Tiếp tục lớn nhất khi có save; Chiến dịch mới; Chọn nhiệm vụ; Túi thư; Tùy chỉnh; Những người thực hiện | Không có save thì ẩn Tiếp tục; có save thì Chiến dịch mới phải xác nhận ghi đè |
| Bắt đầu chiến dịch | Hai lựa chọn rõ: Xem mở đầu / Vào nhiệm vụ | Chọn vào nhiệm vụ bỏ phim; vẫn hiện ngày, nơi chốn, mục tiêu và thao tác đầu tiên |
| Chọn nhiệm vụ | Ba hồi; tên nhiệm vụ; ngày tháng đã duyệt; trạng thái đã hoàn thành; tóm tắt không tiết lộ đoạn sau | Chơi lại dùng trạng thái khởi đầu đã định nghĩa; không sửa save chiến dịch chính |
| Đang chuẩn bị | Ký họa và trạng thái thực: Đang tải khu vực / Đang chuẩn bị cảnh / Sẵn sàng | Chỉ hiện % khi biết mẫu số; lỗi có Thử lại và Về menu; không giả tiến độ |
| Tạm dừng | Tiếp tục; Mục tiêu hiện tại; Tải điểm lưu; Tùy chỉnh; Về menu | Esc, mất khóa chuột hoặc chuyển tab đều tạm dừng game đơn; không chết khi đang đọc |
| Thất bại | Nguyên nhân cụ thể; Tải điểm lưu; Tùy chỉnh | Không phát lại phim đã xem; không đặt điểm lưu trong trạng thái chết hoặc thiếu đồ bắt buộc |
| Hoàn thành | Một đoạn nhật ký ngắn, thư mới nếu có, Tiếp tục / Về menu | Không bảng xếp hạng số mạng; chỉ ghi nhận mục tiêu và điều người chơi đã trải qua |

Menu nền là một góc lán với túi thư, bi đông, bóng cây; về sau chỉ thay 1–2 đạo cụ theo tiến độ. Tránh dựng tám menu 3D riêng. Nền động giới hạn 30 FPS; có ảnh tĩnh tương đương. Chuyển mục 120–180 ms, không để animation chặn thao tác. Bản đồ chiến dịch là bản đồ kể chuyện đã biên tập, không được trình bày như bản đồ hành quân lịch sử đã xác minh.

### 8.3 Hệ chữ, màu và bố cục

Các số dưới đây là token đề xuất để prototype, không phải bằng chứng đã đạt chuẩn tiếp cận. Tính theo CSS pixel trên viewport 1280 × 800; kiểm thêm 1440 × 900, 1920 × 1200 và 16:9. Render scale của cảnh 3D không làm giảm độ phân giải UI.

| Thành phần | Đặc tả v0.2 |
| --- | --- |
| Màu | Nền than #151A18; giấy #E9E0CD; mực #202823; điểm nhấn đất #BE995B; nguy hiểm #C7614C. Trạng thái có biểu tượng/chữ kèm màu |
| Chữ | Noto Sans hoặc font tương đương có đủ dấu Việt cho UI/phụ đề; serif chỉ cho tiêu đề và thư. Chữ viết tay chỉ là hình thức, luôn có Bản dễ đọc |
| Cỡ chữ | Menu 18–22 px; thông tin phụ 16 px; phụ đề mặc định 24 px, tăng đến 48 px; UI scale 100–150%. Không dùng chữ toàn hoa cho đoạn dài |
| Vùng an toàn | Lề HUD ít nhất 5% chiều ngang/dọc. Chừa vùng phụ đề giữa đáy; objective, thông báo nhặt đồ và prompt không chồng nhau |
| Tương phản | Mục tiêu chữ thường ít nhất 4,5:1 trên nền cuối cùng; kiểm cả cảnh sáng, đêm và cảnh nổ. Phụ đề có nền đen tùy độ đục 0–100% |
| Điều hướng | Tab/Shift+Tab, Enter, Esc; focus nhìn thấy; remap phím cập nhật mọi prompt. Nút chính tối thiểu 44 × 44 CSS px trong bố cục chuột |
| Âm UI | Giấy, bút, khóa túi tiết chế; mỗi thao tác một phản hồi ngắn; âm xác nhận không lớn hơn thoại |

### 8.4 HUD theo ngữ cảnh

Góc trên trái: một mục tiêu hiện tại, ví dụ “Theo tiểu đội xuống ngầm”; xuất hiện 6 giây khi đổi rồi thu gọn. Nhấn phím Mục tiêu để xem lại; hỗ trợ tăng thời gian hoặc luôn hiện. Không nhắc lại mỗi vài giây.

Giữa màn hình: chấm ngắm nhỏ tùy chọn; prompt “E · Qua ngầm” chỉ hiện với đối tượng hợp lệ và trong tầm. Khi ADS, chấm ngắm ẩn; không thu nhỏ chữ hoặc làm mờ cả màn để giả tập trung. Góc dưới phải: đạn trong súng, băng dự trữ, băng cá nhân; hướng bố trí tránh bàn tay và phụ đề.

Sức khỏe có trạng thái chữ/biểu tượng “Ổn định / Bị thương / Nguy kịch” tùy chọn, đủ đọc khi tắt hiệu ứng tổn thương. Đồng đội nhận diện bằng silhouette, vị trí, giọng và dấu nhỏ khi nhìn vào; không chỉ dựa vào màu quân phục. Trợ giúp định hướng bật theo nhu cầu: nhắc hướng bằng thoại/chữ, rồi dấu vị trí mục tiêu; không tự xoay camera.

Khi hành quân, HUD thu gọn nhưng không giấu thông tin cần thiết. Trong giao chiến, đạn và tình trạng bị thương hiện rõ. Khi đọc thư, game tạm dừng; có Bản dễ đọc, Nghe đọc, Đóng. Lệnh tiểu đội dùng ba ô ngắn gắn phím; lệnh không thực hiện được phải trả lời “Chưa có đường tới đó”, không im lặng.

### 8.5 Tiếp cận và cảm giác điều khiển

UX-005 và A11Y-001 có hiệu lực từ G1. Phụ đề áp dụng cả phim, thoại ngoài khung hình và lời dẫn; tên người nói xuất hiện khi đổi người. Caption âm thanh quan trọng như “[Động cơ phía trên, bên trái]” có thể bật riêng; không tiết lộ đối thủ chưa thể nghe/thấy. Phụ đề thường tối đa hai dòng, ưu tiên khoảng 36–40 ký tự mỗi dòng, ngắt theo nghĩa và kiểm trực tiếp với tiếng Việt. Các nguyên tắc này tham chiếu XAG 104; cỡ chữ cụ thể ở trên là lựa chọn của dự án. [R04]

Preset Giảm chuyển động: tắt head bob, camera roll, blur, grain, chromatic aberration, zoom do chạy và rung phụ; giữ nguyên độ giật ảnh hưởng gameplay của vũ khí nhưng tách khỏi rung trang trí. FOV hiển thị rõ là góc ngang quy đổi tại 16:9: mặc định 90°, dải thử 75–110°; Three.js lưu góc dọc nên phải chuyển đổi, không gán thẳng cùng con số. Có độ nhạy riêng hip-fire/ADS, đảo trục, giữ/bật tắt ADS, cúi và tương tác. [R05]

Âm thanh có preset Tai nghe / Loa / Ban đêm với dải động hẹp; slider nhạc, thoại, hiệu ứng độc lập. Tắt ù tai không được làm mất tín hiệu nguy hiểm. Phim có Pause, Bỏ qua, Phụ đề và âm lượng; phím tắt luôn được chú thích. Giữ để bỏ qua 0,6 giây là mặc định; có lựa chọn bấm một lần trong tiếp cận.

RAT-001: giữ mục tiêu nội dung trưởng thành, máu vừa và không tra tấn của v0.1; đây chưa phải phân loại độ tuổi được cấp. Ghi “Nhân vật hư cấu trong bối cảnh lịch sử” ở phần giới thiệu, có thể mở lại; không dùng tuyên bố này để thay việc kiểm sử. A11Y-002 mở rộng thành kiểm toàn bộ cảnh nhấp nháy, âm lớn và rung; preset giảm cường độ phải có cả bản phim phù hợp hoặc bản tĩnh kèm lời dẫn, vì tắt shader không sửa được hiệu ứng đã nướng vào video.

### 8.6 Nghiệm thu UI/UX

| ID | Pass bắt buộc |
| --- | --- |
| UX-101 | Người mới tìm được Bắt đầu, Phụ đề và Tùy chỉnh mà không cần người hướng dẫn trong bài thử ngắn |
| UX-102 | Cả đường Xem mở đầu và Vào nhiệm vụ đều đến đúng trạng thái M1; không lặp hai phim giới thiệu |
| UX-103 | UI ở các viewport quy định và phụ đề 200% không bị cắt, chồng prompt hoặc che vùng ngắm trọng yếu |
| UX-104 | Dùng bàn phím vào/ra mọi màn, focus không mất; đổi phím không để lại prompt cũ; lỗi save có giải thích |
| UX-105 | Chuyển tab, Esc, mất pointer lock: game và phim dừng; quay lại không tự phát súng hoặc tự chạy |
| UX-106 | Phụ đề và caption quan trọng được kiểm bằng cách tắt âm hoàn toàn; trạng thái máu đọc được khi tắt hậu kỳ |
| UX-107 | Người chơi phân biệt được đầu hàng trước khi bị áp dụng luật thất bại; xử lý chi tiết tại §20.3 |

---

## 9. DỮ LIỆU LỊCH SỬ — SOT CỦA "THẬT"

Đây là phần khiến dự án khác mọi game khác và là nơi phương pháp cào–lọc–làm giàu của Chủ nhà gánh việc.

### 9.1 Bảy registry

Mỗi registry là YAML, mỗi fact có `id`, `value`, `provenance_level` (P gốc / S thứ cấp có kiểm / H suy luận / X tranh chấp), `sources[]` (url, trích đoạn, ngày truy cập), `disputed`, `used_by[]` (asset/mission). Dựng và audit bằng refinery + registry-hygiene.

| Registry | Nội dung | Tiêu thụ bởi |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `uniforms`                      | Từng lực lượng × năm: vải, màu, kiểu, mũ, giày dép, trang bị mang đeo, phù hiệu                                  | CHR, tay FP, cố vấn        |
| `weapons`                       | Mẫu, biến thể, năm, băng đạn, tốc độ bắn, tầm, tiếng, cách cầm/đeo, đơn vị dùng                                  | WPN, AI, AUD               |
| `vehicles`                      | Xe quân sự và dân sự theo vùng/năm, màu, số hiệu kiểu, tiếng máy                                                 | VEH, CTY                   |
| `aircraft`                      | Loại, vai trò, cao độ, quỹ đạo, vũ khí, tiếng                                                                    | VEH-004, AUD-003           |
| `places`                        | Bản đồ, ảnh, sơ đồ, tên đường đúng năm, công trình mốc, hướng nắng                                               | TER, CTY, REN-001          |
| `timeline`                      | Ngày giờ sự kiện, đơn vị, con số đã kiểm; **con số tranh chấp giữ cả hai bên**                                   | Màn tải, bản tin, kịch bản |
| `daily-life`                    | Tem phiếu, loa, tàu điện, hầm ống, giá cả, tên bài hát trên đài (chỉ tên), xưng hô, tiếng lóng, poster/biển hiệu | UX, CTY, thoại             |

### 9.2 Quy tắc

Kịch bản chỉ được dùng fact có provenance P/S; fact H phải được viết mờ ("một điểm cao"), fact X phải trung lập hoặc bỏ. Người thật có tên: chỉ xuất hiện như sự kiện nền/bản tin theo tư liệu, không lời thoại bịa. Cách gọi quân đối phương trong thoại là quyết định của Chủ nhà (kịch bản v0.1 dùng "lính Sài Gòn/quân Sài Gòn"). Mỗi nhiệm vụ có `docs/history/M<n>.md` liệt kê fact đã dùng và trạng thái kiểm — đây là artifact cho cổng cố vấn.

### 9.3 Cổng "kiểm sử" theo nhiệm vụ

Trước khi nhiệm vụ vào G-content: 100 % fact [KC] trong kịch bản của nhiệm vụ đó có provenance P/S hoặc đã được viết mờ; 100 % asset lịch sử `approved`; một người có hiểu biết lịch sử (ngoài Chủ nhà) chơi qua và ký "không thấy sai".

---

## 10. KIẾN TRÚC KỸ THUẬT

Kế thừa toàn bộ HT-MB: luồng runtime (60 Hz sim cố định, AI 5–15 Hz, render biến thiên, event có ID, background decode), module `engine/*` không import `game/*`, `content/` không có TS, không `Math.random` (seed), deps pinned, không đổi Three/Rapier/Recast giữa gate nếu không có ADR, TSL only, hình khớp collider, tiếng Việt chỉ trong content JSON/i18n.

Module thêm:

| Package | Trách nhiệm | Không được làm |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------- |
| engine/terrain                      | tile heightmap, LOD, splat, heightfield collider, navmesh bake glue                                    | Không biết nhiệm vụ           |
| engine/vegetation                   | scatter cell, instancing, LOD/impostor, gió, đè, culling                                               | Không đọc gameplay            |
| engine/water                        | mặt nước, dòng, tương tác, bơi query (độ sâu, dòng tại điểm)                                           | Không xử lý máu               |
| engine/vehicles                     | spline follower kinematic, platform mang actor, bánh/rotor, trạng thái cháy                            | Không quyết định ai bị bắn    |
| engine/aircraft                     | quỹ đạo máy bay, nguồn âm có hướng, sự kiện bom/tracer                                                 | Không spawn địch              |
| engine/streaming                    | ô, nạp/giải phóng, warmup shader theo ô                                                                | Không giữ tham chiếu gameplay |
| game/squad                          | tiểu đội có tên, lệnh theo cấp, barks, cõng, chết theo kịch bản                                        | Không hard-code map           |
| game/narrative                      | thư, nhật ký, cutscene in-engine, lựa chọn không thưởng, save chiến dịch                               | Không chứa shader             |
| content/registry                    | 7 registry YAML + `docs/history/M*.md`                                                                 | Không logic                   |
| tools/ (scripts)                    | terrain-bake, scatter-bake, convert-character, make-impostor, ktx2, validate-assets, refinery adapters | —                             |

Save chiến dịch: schema có version; migrate test trong CI. Checkpoint trong nhiệm vụ kế thừa (snapshot idempotent, hash).

---

## 11. NGÂN SÁCH HIỆU NĂNG v1 (engineering\_default\_requires\_review)

Thiết bị chuẩn M1 Max, Chrome, render nội bộ 1920 × 1200, quality High. Thay bằng số đo ở G1 (rừng) và G3 (đô thị lớn); mỗi nhiệm vụ có bench track riêng (`bench/M<n>-v1`, replay 90 giây, 3 lần, median).

| Chỉ số | Target | Đỏ | Ghi chú |
| ---------------------------- | -------------------- | ------------------- | ----------------------------------------- |
| FPS                          | 60 avg; 1 % low ≥ 45 | 1 % low < 40        | Cap 60 khi chơi (D-053)                   |
| Frame p95 | Mục tiêu ≤ 16,67 ms theo §22.3 | > 22 ms | 18,5 ms là dung sai v0.1, không phải 60 FPS ổn định; không ghi PASS nếu chưa đạt mục tiêu đã khóa |
| GPU                          | ≤ 12 ms              | > 15 ms             | Rừng/đô thị được thêm 1,5 ms so với HT-MB |
| CPU sim + AI                 | ≤ 5 ms               | > 8 ms              | AI LOD                                    |
| Draw calls                   | ≤ 600 điển hình      | > 900               | Rừng instanced ≤ 40; đô thị batched       |
| Tam giác nhìn thấy           | ≤ 4 M                | > 6 M               | Impostor từ 60 m (cây), 120 m (nhà)       |
| Skinned gần camera           | ≤ 16                 | > 22                | Đám đông = impostor                       |
| AI full                      | ≤ 12                 | > 16                | —                                         |
| Bộ nhớ GPU asset resident    | ≤ 3,5 GB             | > 5 GB              | KTX2 bắt buộc                             |
| JS heap                      | ≤ 800 MB             | > 1,1 GB / tăng dần | Soak 20 phút                              |
| Payload nạp đầu mỗi nhiệm vụ | ≤ 250 MB             | > 400 MB            | Stream phần còn lại                       |
| Tổng chiến dịch              | ≤ 2,5 GB             | > 4 GB              | Theo hồi                                  |
| Thời gian tải nhiệm vụ | ≤ 15 s khi warm cache hoặc điều kiện mạng/payload đã chốt | > 30 s trong điều kiện chuẩn | Cold load báo riêng; §22.3, không bảo đảm 250 MB trong 15 s mọi mạng |
| Hitch đổi ô                  | ≤ 50 ms              | > 100 ms            | —                                         |

`config/performance-budget.json` là nguồn duy nhất; không sửa để "đạt".

---

## 12. QUY TRÌNH PHÁT TRIỂN BẰNG AI (Vibecode v6.1)

Ba vai: Chủ nhà khoá cảm giác, phạm vi, lịch sử và quyết định; Chủ thầu (Claude) thiết kế, chia TIP, kiểm; Thợ (Claude Code) thi công, test, báo cáo. Artifact bắt buộc kế thừa: AGENTS.md, docs/PRD.md (bản này), docs/ADR, contracts/\*.yaml, config/performance-budget.json, content/schemas, evidence/\<TIP>/, snapshots/\<gate>/, docs/DECISIONS.md. Thêm: `content/registry/*.yaml`, `docs/history/M*.md`, `docs/art-bible.md` (palette, texel, silhouette theo bối cảnh), `docs/story/` (kịch bản, thoại, thư).

Những việc AI không được tự quyết (kế thừa §9.2 HT-MB, thêm): dùng asset nghi rip; gán lời thoại cho người thật; dùng con số lịch sử tranh chấp như sự thật; nhân bản giọng người thật; mở rộng sang nhiệm vụ mới khi nhiệm vụ hiện tại chưa qua gate; hạ chất lượng toàn cục để che regression.

Bài học bắt buộc từ HT-MB (D-075, D-072): mọi level mới có E2E vật lý người chơi (đứng, chạy, lên bậc, xuống nước) trong CI; mọi asset ngoài có kiểm nguồn trước khi tải; hiệu năng đo trên máy chuẩn trước khi làm art.

---

## 13. GATE, LỘ TRÌNH, ƯỚC LƯỢNG

| Gate | Tuần (từ khởi động) | Phạm vi | Pass bắt buộc |
| ----------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| G0' · Kế thừa                                   | 0     | Fork engine HT-MB, đổi tên, dọn nợ TIP-026 (perf 400 draw), KTX2                                                                     | CI xanh; bench arena cũ không tụt                                                          |
| G1 · Vertical slice M1 | 1–8 (ước lượng gốc, cần rà lại) | Lát cắt 12–15 phút §20.2; mẫu nhân vật/súng/rừng; UI/A11y từ đầu; animatic CINE-00 và handoff | Bench máy thật; kiểm sử; gate trải nghiệm §23.3; chưa yêu cầu map M1 35 phút hoàn chỉnh |
| G2 · Hồi I | 9–20 (ước lượng gốc, cần rà lại) | Hoàn thiện M1 từ lát cắt lên nhiệm vụ 35 phút; M2, M3, tiểu đội, save chiến dịch và phim tương ứng | Hồi I chơi liền khoảng 2 giờ; checkpoint 20/20; kiểm sử M1–M3; cinematic không làm mất quyền điều khiển/lưu |
| G3 · Hồi II + đô thị                            | 21–28 | M4 Hà Nội (phố sống, cứu người, phòng không), đoạn chuyển 1973, kit đô thị, đám đông impostor                                        | Đô thị 0,5 km² trong budget; kịch bản không bắn được người chơi chấp nhận                  |
| G4 · Hồi III                                    | 29–44 | M5–M8: cao nguyên, đèo–biển, cao su, xa lộ–Sài Gòn, bình minh động, mốc kiến trúc, Windows/Chrome mid-range smoke                    | 4 nhiệm vụ chơi liền; bench từng map; kiểm sử                                              |
| G5 · Content complete | 45–50 (ước lượng gốc) | Thoại diễn viên, nhạc gốc, hoàn thiện UI/A11y đã có từ G1, phụ đề Anh, cân bằng, các phim đã khóa | Không blocker; license 100%; soak; CIN-201–209 và UX-101–107 |
| G6 · Release                                    | 51–56 | Tối ưu, browser matrix, trailer, giấy phép phát hành [KC]                                                                            | 3 run không crash; 1 % low đạt; snapshot                                                   |

**ƯỚC LƯỢNG v0.1, chưa tính/chốt lại phạm vi điện ảnh v0.2.** 12–14 tháng cho một người làm gần toàn thời gian với AI, có ngân sách nhỏ cho diễn viên lồng tiếng, nhạc sĩ và 3–4 bộ nhân vật đặt riêng nếu cần. Làm bán thời gian: 20–26 tháng. Confidence trung bình–thấp cho tới khi G1 xong: G1 là nơi biết rừng và nhân vật có làm được với thư viện CC hay không. Nếu Hồi I (G2) xong đúng hạn, ước lượng còn lại tăng độ tin.

### 13.1 Tiêu chí dừng hoặc thu hẹp

| Trigger | Hành động |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| G1 rừng không đạt 60 FPS sau 3 vòng tối ưu   | Giảm mật độ + impostor sớm hơn; nếu vẫn không: M1 chuyển sang rừng thưa/bìa rừng, ghi ADR |
| G1 nhân vật không "tin là 1971"              | Đặt riêng 3–4 bộ; nếu không có ngân sách: thu hẹp lực lượng xuất hiện gần camera          |
| Kiểm sử một nhiệm vụ > 20 % fact không nguồn | Viết mờ kịch bản, không ship fact; nếu cốt lõi nhiệm vụ dựa trên fact đó → đổi nhiệm vụ   |
| Tiến độ trượt > 30 % sau G2                  | Phát hành Hồi I; gộp M6 vào M5 (Đà Nẵng thành cutscene); giữ M8                           |
| Chi phí asset đặt riêng vượt ngân sách       | Giữ M1–M4 + M8, cắt M6, M7 xuống cutscene                                                 |

---

## 14. KIỂM THỬ VÀ NGHIỆM THU

| Lớp | Phạm vi | Evidence |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Unit                                     | vũ khí, đạn bay, AI archetype, lệnh tiểu đội, save migrate, registry validator, scatter/terrain bake | Vitest                             |
| Schema                                   | mission/encounter/dialogue/level/asset/registry                                                      | JSON Schema + YAML schema trong CI |
| Sim/E2E vật lý (mới, bắt buộc mỗi level) | đứng, chạy, bậc, bơi, lên xe, cõng; không rơi xuyên; navmesh có poly                                 | Playwright `level-<id>.spec`       |
| E2E nhiệm vụ                             | boot → đi hết graph bằng debug trigger → checkpoint → complete                                       | Playwright trace                   |
| Visual                                   | hero shot mỗi map, A/B với ảnh tư liệu (không pixel-diff với ảnh thật — chỉ đối chiếu người)         | Ảnh + biên bản                     |
| Performance                              | bench track mỗi map, 90 s × 3                                                                        | JSON + overlay                     |
| Soak                                     | 20 phút mỗi map, checkpoint 20 lần                                                                   | Heap trend                         |
| Kiểm sử                                  | checklist §9.3                                                                                       | `docs/history/M*.md` ký            |
| Người chơi thật                          | 5 người/gate: cảm giác súng, đọc được, nhịp, "tin là năm đó", cảm xúc ở M3/M4                        | Scorecard + clip                   |

Definition of Done cho một nhiệm vụ: chơi liền không debug; checkpoint 20/20; budget đạt trên máy chuẩn; WebGL 2 fallback boot và chơi được ở Medium; 100 % asset license + registryId + approved; kiểm sử ký; phụ đề đầy đủ; không P0/P1.

---

## 15. RỦI RO

| Mức | Rủi ro | Tín hiệu sớm | Giảm thiểu |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Rất cao                             | Không có asset nhân vật/quân phục 1971–75 đạt chuẩn từ thư viện CC                                                                                                         | G1 thân retexture nhìn "cosplay"      | Kế hoạch §7.4 ba tầng, ngân sách đặt riêng, quyết trong 3 tuần                                    |
| Cao                                 | Rừng rậm không đạt 60 FPS trên WebGPU trình duyệt                                                                                                                          | GPU > 15 ms ở G1                      | Instancing/impostor/culling GPU; giảm mật độ theo LOD; đo trước art                               |
| Cao                                 | Nhạy cảm lịch sử và pháp lý: sai chi tiết, con số tranh chấp, cách gọi, người thật; giấy phép phát hành game tại Việt Nam cho nội dung chiến tranh [KC quy định hiện hành] | Phản hồi cộng đồng, cố vấn từ chối ký | Registry provenance, viết mờ, cố vấn ngoài, không lời thoại người thật, tham vấn pháp lý trước G5 |
| Cao                                 | Phạm vi 8 map                                                                                                                                                              | TIP mọc ngoài kịch bản                | Phát hành theo hồi; tiêu chí thu hẹp §13.1                                                        |
| Trung                               | Thoại/nhạc: TTS lộ, nhạc thiếu                                                                                                                                             | Playtest chê giọng                    | Diễn viên + nhạc sĩ có hợp đồng từ G3                                                             |
| Trung                               | Asset rip lọt                                                                                                                                                              | Tag/mô tả/material lạ                 | Cổng kiểm nguồn (D-072) tự động + tay                                                             |
| Trung                               | Bơi/cõng/lên xe làm controller phức tạp, lỗi kẹt                                                                                                                           | Bug state machine                     | Mỗi state có test sim; fallback thoát state                                                       |
| Trung                               | Save chiến dịch vỡ khi đổi bản                                                                                                                                             | Migrate fail                          | Schema version + test                                                                             |
| Thấp                                | Safari/Windows khác Chrome Mac                                                                                                                                             | Post FX sai                           | Smoke mỗi gate; fallback                                                                          |

---

## 16. BACKLOG SAU v1.0

Nhiệm vụ mở rộng (Campuchia 1970, An Lộc 1972, Thượng Đức 1974, Đường 7); góc nhìn thứ hai (biệt động Sài Gòn); chế độ "bảo tàng" đi bộ xem asset có chú thích nguồn (tận dụng registry — sản phẩm giáo dục); phụ đề/lồng tiếng Anh; gamepad; co-op 2 người (PRD riêng); phá huỷ vật lý mở rộng.

---

## 17. NGUỒN

Khả năng kỹ thuật (Three.js WebGPU/TSL, glTF/Meshopt/KTX2, Rapier, recast, Pointer Lock, PositionalAudio, Playwright) được v0.1 dẫn lại từ registry S01–S13 của PRD HT-MB. Registry và confidence gốc không được kiểm độc lập ở lần sửa này; không sử dụng confidence số làm chứng nhận. Nguồn vừa đối chiếu và phạm vi hỗ trợ được ghi tại §24. Nguồn lịch sử không nằm trong PRD mà trong `content/registry/*.yaml` với provenance từng fact; DEM: SRTM/Copernicus (license mở) [KC điều khoản]. Hai demo HT-MB (G0 bench 120 FPS p95 9,1 ms; G0.6 Phố Vạn Hải 403 draw/2,4 M tri trên Mac) được v0.1 nêu là bằng chứng nội bộ, chưa truy cập trong lần sửa này; evidence được dẫn tới repo `nclamvn/hai-tuyen`.

---

## 18. CHECKLIST KHỞI ĐỘNG 2 TUẦN (G0')

| Ngày | Việc | Output |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1–2               | Fork `hai-tuyen` → repo mới; đổi tên, xoá content Vạn Hải khỏi build mặc định (giữ arena bench); AGENTS.md cập nhật luật lịch sử/asset | Repo sạch, CI xanh                       |
| 3–5               | TIP-026 nợ perf: gộp material, atlas biển hiệu, bóng chọn lọc; KTX2 pipeline; bench `arena` không tụt                                  | Bench JSON                               |
| 6–8               | Registry skeleton 7 file + schema + validator; cào–lọc lượt đầu `uniforms/weapons/vehicles/aircraft` cho 1971 (Trường Sơn, Đường 9)    | `content/registry/*`, báo cáo provenance |
| 9–11              | `engine/terrain` prototype: DEM tile một ô Trường Sơn, collider, navmesh bake; đo                                                      | Ảnh + bench                              |
| 12–14             | `engine/vegetation` prototype: 20k instance, gió, LOD/impostor thô; đo GPU; quyết GO/ADJUST cho G1                                     | ADR rừng, G0' report                     |

**HÀNH ĐỘNG ĐẦU TIÊN.** Không tải quân phục hay dựng Dinh Độc Lập. Dựng một ô rừng xấu nhưng đo được, và một registry `uniforms` 1971 có nguồn. Hai thứ này quyết định game có làm được hay không.

---

## 19. ĐÁNH GIÁ THIẾT KẾ CHUYÊN NGHIỆP

### 19.1 Kết luận và giới hạn đánh giá

**GO có điều kiện cho một lát cắt chơi được của Cổng Trời; chưa đủ cơ sở khóa sản xuất toàn bộ tám nhiệm vụ.** Đường Về Sài Gòn có bản sắc nhờ hành quân, đồng đội, thư và sự thay đổi ý nghĩa của việc nổ súng. Giá trị cần theo đuổi từ FPS điện ảnh là nhịp dẫn dắt, cảm giác điều khiển, dàn cảnh và âm thanh; dự án cần một ngôn ngữ hình ảnh riêng cho Việt Nam 1971–1975.

Đánh giá này dựa trên PRD v0.1 đính kèm. Chưa có build chơi thử, video gameplay, repo, bench thô hoặc file KICH-BAN-v0.1.md để kiểm độc lập. Những con số HT-MB, tình trạng engine và nhân vật trong nguồn được xem là thông tin do tài liệu báo cáo. Đây là đánh giá thiết kế tài liệu, không phải chấm điểm chất lượng game đã chạy. Các đề xuất thoại/cảnh mới là hư cấu sáng tác, chưa thay thế kịch bản gốc hoặc chứng nhận lịch sử.

| Mảng | Điểm mạnh | Khoảng trống phải xử lý |
| --- | --- | --- |
| Tầm nhìn | Có đích cảm xúc khác FPS tính điểm tiêu diệt | Cần biến “không muốn bắn” thành tình huống chơi có quyền chủ động |
| Chiến dịch | Mỗi nhiệm vụ có địa hình và cơ chế riêng | Tám map dễ thành tám dự án; phải chốt một cơ chế và một hình ảnh nổi bật cho mỗi map |
| Chiến đấu | Có cover, suppression, âm thanh và đội hình | Thiếu nhịp encounter, độ rõ mục tiêu, feedback tay/súng và quy tắc AI công bằng |
| UI/UX | Tối giản, tiếng Việt, có phụ đề | Máu/đạn quá mơ hồ; chưa có luồng lỗi, quay lại, chọn nhiệm vụ và điểm chuyển phim–game |
| Đồ họa | Registry asset, LOD, streaming và hạn mức | Danh sách FX rộng hơn kế hoạch art; raymarch, SSR, bóng và lá cùng tranh ngân sách GPU |
| Cốt truyện | Người lính thường, thư và đồng đội là nền tốt | Hành trình cùng nhân vật qua các mặt trận cần lý do và mốc chuyển; không tự thêm quan hệ nhân vật khi chưa đọc kịch bản |
| Sản xuất | Có gate, kiểm sử, tiêu chí thu hẹp | UI/âm thanh/animation để muộn làm G1 không chứng minh được chất lượng trải nghiệm |

### 19.2 Các quyết định sửa v0.1

| ID | Quyết định thiết kế v0.2 | Tác động |
| --- | --- | --- |
| DD-201 | G1 chứng minh 12–15 phút chơi đại diện, trong map M1 dự kiến 35 phút | Chưa cần dựng kín 0,96 km² để biết game có đáng chơi |
| DD-202 | Một khẩu súng FP, một đồng đội gần, một tuyến rừng và một encounter phải đạt chất lượng mẫu | Dùng mẫu này để nhân rộng, không sản xuất hàng loạt asset chưa đạt |
| DD-203 | Phim mở đầu 90 giây, briefing ngắn từng nhiệm vụ, chuyển vào game khoảng 12 giây | CINE-00 thay briefing M1 trên đường chơi chiến dịch lần đầu |
| DD-204 | UI và tiếp cận làm từ G1; G5 hoàn thiện ngôn ngữ, kiểm tra và polish | Sửa phân kỳ, không âm thầm coi phần mới là miễn phí |
| DD-205 | 60 FPS ổn định là mục tiêu gameplay; 120 FPS là thử nghiệm sau khi đạt | Màn 120 Hz không tạo ra cam kết render 120 FPS |
| DD-206 | Máu/đạn rõ mặc định; Nhập vai là tùy chọn | Giữ chất thời kỳ ở hình thức, giảm phạt người chơi vì thiếu thông tin |
| DD-207 | Mỗi lần chết chỉ lặp tối đa khoảng 2–3 phút chiến đấu đã học | Điểm lưu không bắt xem lại phim hoặc hành quân dài |
| DD-208 | Khóa liên tục nhân vật trước khi thu thoại cuối | Biên tập viên phải giải thích chuyển Quảng Trị–Hà Nội–1973; phương án đổi POV chỉ là lựa chọn cần chủ dự án quyết định |

Về thời lượng: tám nhiệm vụ trong bảng gốc cộng thành 290 phút. Với đoạn 1973 dài 180 giây, CINE-00 90 giây, briefing M2–M8 tổng 310 giây và tám handoff 12 giây, một lượt đi thẳng khoảng 301 phút, chưa tính chết/tải/đọc thư. Vì vậy “4–5 giờ” nên đổi thành “khoảng 5 giờ theo tuyến chính; xác nhận bằng playtest”, hoặc phải chủ động rút gameplay. Không cộng thêm CINE-M1 40 giây vào lượt đầu.

## 20. THIẾT KẾ TRẢI NGHIỆM VÀ ĐỊNH HƯỚNG MỸ THUẬT

### 20.1 Bốn trụ cột dùng để duyệt mọi tính năng

**Ở trong một cơ thể.** Tay giữ dây ba lô, hơi thở sau dốc, bùn bám gấu quần và tiếng vải tạo trọng lượng. Điều khiển phải đáp ứng trước, animation trang trí theo sau; không dùng camera lắc liên tục để giả sức nặng.

**Sống cùng một nhóm người.** Đồng đội có cách đi, cử chỉ, đồ dùng và giọng riêng; phản hồi khi được giúp. Trong G1 chỉ cần một quan hệ đáng nhớ qua ba lần tương tác. Không cần hệ hội thoại sinh bằng LLM khi đang chơi.

**Nguy hiểm có thể đọc và học.** Tiếng động, tia lửa, chuyển động lá và phản ứng đồng đội báo nguy. AI không nhìn xuyên cỏ đậm mà người chơi không nhìn xuyên được; nghe không đồng nghĩa biết chính xác tọa độ. Mỗi lần thua phải giải thích được bằng tình huống đã nhận biết.

**Sự yên lặng có ý nghĩa.** Sau giao chiến để người chơi đi, nhìn, giúp và chọn tốc độ. M8 kết thúc bằng quyền bước tiếp hoặc dừng lại quan sát; không biến đoạn cuối thành một video dài thay cho quyền điều khiển.

### 20.2 Cổng Trời: lát cắt 15 phút cần làm trước

Thời gian dưới đây tính từ lúc có quyền điều khiển, không bao gồm phim và tải. Đây là đề xuất nhịp chơi, không phải xác nhận sự kiện lịch sử hoặc đoạn trích từ kịch bản chưa được cung cấp. Không gộp mọi cơ chế M1 vào lát cắt.

| Phút | Trải nghiệm, mức căng 1–5 | Hành động và dẫn hướng | Camera, âm thanh, kiểm chứng |
| --- | --- | --- | --- |
| 0–2 | Nhập vai, 1 | Đi theo một đồng đội; chọn nhìn thư hoặc đi ngay; học nhìn/đi/cúi | Tay gấp thư; suối ở xa. Ít nhất 4/5 người mới hiểu ai cần theo |
| 2–4 | Tò mò, 2 | Qua lối hẹp và bậc thấp; học giữ khoảng cách | Khoảng sáng ở lối ra; tiếng dép/vải. Không bảng tutorial phủ màn |
| 4–6 | Lo lắng, 3 | Tiếng động cơ; tìm chỗ khuất theo đồng đội | Chỉ gợi hướng, không giật camera; caption tương đương khi tắt âm |
| 6–8 | Vượt khó, 3 | Qua một ngầm nông theo lối dễ đọc; hỗ trợ một người ở bờ | Nước/bùn vừa đủ, không bắt buộc hệ bơi M3; điểm lưu A sau bờ an toàn |
| 8–11 | Giao chiến ngắn, 5 | 4–6 đối thủ theo các đợt nhỏ; hai tuyến cover nối lại; mục tiêu thoát vùng | Khẩu súng mẫu, impact rõ; không thêm phương tiện. Điểm lưu B trước encounter |
| 11–13 | Giải tỏa, 2 | Đổi băng, kiểm thương, tìm lại đồng đội | Hạ nhạc, tiếng rừng trở lại; không VO dài lúc đang bị bắn |
| 13–15 | Gắn bó, 1 | Đưa bi đông bằng tương tác tùy chọn; nhìn tuyến đường tiếp theo | Một câu đáp ngắn, không thưởng XP; checkpoint C, kết demo ở quyền điều khiển |

M1 hoàn chỉnh mới thêm phần đêm và sự kiện máy bay theo kịch bản/kiểm sử. Lát cắt ban đầu chỉ dùng động cơ xa chưa định danh nếu chưa có nguồn. Dẫn hướng theo ba tầng: bố cục/âm thanh, đồng đội gợi ý, trợ giúp UI do người chơi bật. Sau khoảng 20 giây không tiến triển, nhắc một lần; không spam hoặc tự di chuyển nhân vật.

### 20.3 Combat feel, quyền chủ động và luật công bằng

GUN-201: với khẩu mẫu, input bắn tạo phản hồi hình/âm ở frame render kế tiếp khi game đang sẵn sàng; animation tay không đợi mạng. Đồng bộ nòng súng, âm nổ, vỏ đạn và impact theo event, tránh phát hai lần sau load. Mục tiêu thử ADS 180–240 ms, không phải thông số thực của súng; tinh chỉnh bằng người chơi. Recoil gameplay, viewmodel kick và camera shake là ba lớp riêng.

GUN-202: đạn va đất, gỗ, đá và kim loại có âm/hạt khác nhau nhưng dùng chung pool. Không đặt hit marker âm lớn kiểu arcade làm mặc định; tùy chọn xác nhận trúng nhẹ cho người cần rõ hơn. Thay băng có trạng thái hủy và thời điểm nạp đạn xác định; không mất/nhân đôi đạn khi chuyển animation.

ENC-201: encounter mẫu có cover chính, một lối đổi vị trí, khoảng rút và tuyến AI hợp lệ. Không spawn trước mắt, sau lưng vừa dọn sạch hoặc trong collider. Độ khó v0.1 được giữ để đo ban đầu; nếu không tạo đủ khác biệt, chỉ sửa các tham số phản ứng/độ chính xác/nhịp áp chế sau playtest và ADR, không thêm AI gian lận.

PLY-008 được sửa: người đầu hàng có vũ khí hạ/bỏ, cử chỉ và lời thoại nhất quán; “cởi áo” không là điều kiện nhận dạng. Trước khi chuyển protected phải có tín hiệu đọc được và xử lý đạn đang bay từ trước; trạng thái đã đầu hàng không tự quay sang bắn lén trong cùng encounter. Lựu đạn hoặc sát thương do script/AI không được gán nhầm cho người chơi. Không dùng người dân chạy bất ngờ vào làn đạn làm bẫy thất bại. Nếu vi phạm có chủ ý sau tín hiệu rõ, tải checkpoint an toàn với lời giải thích ngắn. Không có điểm số cho băng bó tù binh.

Cảnh thua có kịch bản ở M7 phải chuyển mục tiêu sang rút/cứu người trước khi tình thế trở thành bất khả thắng. Không giả vờ cho phép thắng rồi vô hiệu hóa mọi phát bắn. Nhân vật có tên chết theo kịch bản và lính mới có thể chết do gameplay phải được tách trong save; không ghi lại cái chết của nhân vật cốt truyện bằng tai nạn AI.

### 20.4 Mỹ thuật theo khoảng cách và thứ tự đầu tư

| Lớp | Điều tạo chất lượng cảm nhận | Cách giữ khả thi |
| --- | --- | --- |
| 0–2 m | Tay, vải, gỗ súng, dây da, chuyển động thay băng, cạnh kim loại có độ mòn có chủ đích | Một bộ tay và một súng mẫu hoàn chỉnh; không tăng polygon để chữa rig sai |
| 2–15 m | Mặt/cử chỉ một đồng đội, cửa, bi đông, bảng chữ, rễ và nước cạnh đường | Hero prop tập trung theo shot; vết bẩn có nguyên nhân, không phủ noise mọi bề mặt |
| 15–60 m | Silhouette đối thủ, ánh sáng lối đi, lớp cây, khói tách không gian | Kiểm alpha overdraw và bóng; mật độ hình ảnh dày không buộc mật độ collider dày |
| Xa hơn | Đồi núi, trời, đoàn xe, đường chân trời và quy mô chiến trường | LOD, impostor và sự kiện xa; không mô phỏng mọi thứ ngoài tuyến chơi |

Các lớp lá phải có khác biệt hình khối và sắc độ, tránh “bức tường xanh”. Cây sát đường có vài chi tiết chạm được; tán xa dùng impostor. Lối đi, đối thủ và vật tương tác vẫn đọc được khi tắt bloom, AO và volumetric. Tia nắng chỉ dùng ở shot đáng nhớ, không bắt buộc mọi ô rừng.

Không dùng nước ướt/SSR phủ toàn cảnh để tạo cảm giác cao cấp. Roughness đúng vật liệu và nguồn sáng có chủ đích quan trọng hơn phản xạ dày. Skin không bóng nhựa; texture mới không sửa được áo sai silhouette. Chữ trên biển hiệu phải được dựng thành vector/texture từ chuỗi đã duyệt, không chấp nhận chữ AI sai dấu trong asset cuối.

VFX kể chuyện: bụi lắng trên đồ vật, vải ướt tối màu ở mép, một chiếc dép mắc bùn, bóng đèn chao nhẹ khi có rung. Chọn tối đa ba chi tiết gần camera mỗi đoạn; dùng mask/decal/animation cục bộ, không tạo hệ mô phỏng toàn cục cho từng chi tiết. Cận mặt chỉ đưa vào phim khi rig, mắt và biểu cảm đạt mẫu; nếu chưa đạt, kể bằng tay, vai, bóng và phản ứng.

### 20.5 Nhận diện hình ảnh và âm thanh của tám nhiệm vụ

| Nhiệm vụ | Bảng màu và hình ảnh chủ đạo | Khoảnh khắc đồ họa/âm thanh cần giữ |
| --- | --- | --- |
| M1 Cổng Trời | Xanh lá trầm, đất ẩm, ánh sáng nhỏ lọt tán | Tiếng chân và hơi thở đối lập tiếng động cơ; một bàn tay giúp qua ngầm |
| M2 Bản Đông | Đêm xanh than, đất xám, pháo sáng ấm | Bóng người đổi hướng khi pháo sáng rơi; rotor chỉ át thoại ở đoạn không mang thông tin |
| M3 Quảng Trị | Nước lạnh, gạch đỏ sẫm, bụi nhạt | Mặt nước che rồi mở chân trời; dùng âm trầm và khoảng lặng thay cho rung kéo dài |
| M4 Hà Nội | Phố có màu đời thường, sau đó bụi bạc | Một đồ vật trước/sau biến cố; tiếng gọi dẫn cứu người. Không trang trí đau thương như cảnh tượng để ngắm |
| M5 Buôn Ma Thuột | Đất đỏ, vải bạc, nắng sớm | Bụi xe tách lớp phố; người dân có hành động có mục đích thay vì crowd chạy hỗn loạn |
| M6 Hải Vân | Biển bạc, núi xanh, đường xám | Không gian mở và tiếng gió tạo nhịp thở; camera trên xe giảm rung theo tùy chọn |
| M7 Xuân Lộc | Hàng cao su lặp, đất khô, khói mờ | Tuyến thẳng bị phá vỡ bằng lối rút; sự kiện CBU-55 chỉ sản xuất sau kiểm nguồn riêng |
| M8 Sài Gòn | Ánh sáng tự nhiên, màu phố trở lại | Âm xe/tiếng người dần thay tiếng súng; ending giữ màu thật, không ép LUT vàng chiến thắng |

Đây là art direction đề xuất, không khẳng định màu ảnh tư liệu tương đương màu thật. M8 nên dùng các mốc giờ có chuyển đoạn rõ để nén hành trình; không quảng bá mô phỏng mặt trời “chính xác” khi thời gian kể chuyện bị nén mạnh. Quan hệ khoảng cách–âm thanh và kiểu nổ đặc thù trong AUD-003/VFX-006 còn cần chuyên môn kiểm; không duyệt chỉ vì nghe hoặc nhìn kịch tính.

## 21. ĐIỆN ẢNH TRƯỚC KHI VÀO GAME

### 21.1 Cấu trúc và ngôn ngữ điện ảnh

Phương án chọn: **video dựng trước cho mở đầu/briefing; cảnh trong engine cho bước chuyển và những đoạn người chơi có thể nhìn quanh.** Video giúp kiểm soát dựng phim, ánh sáng, biểu cảm và chi phí mỗi frame khi phát. Cảnh trong engine dùng đúng asset, thời tiết, màu và vị trí camera của gameplay để giảm chênh lệch chất lượng. Không đặt độ chân thực của phim vượt quá khả năng gameplay rồi bán kỳ vọng sai.

Ngôn ngữ: bản đồ giấy, nét bút chì, mép thư, tiếng máy thu, cận vật dụng và góc ngang tầm người. Chuyển cảnh bằng âm thanh đến sớm, hình ảnh nối tương đồng và chuyển động tự nhiên; không dùng HUD tác chiến hiện đại. Phần đồ họa bản đồ chỉ chỉ ra “đang ở đâu, đi đâu, vì sao”, không diễn giải toàn bộ lịch sử.

Mỗi phim trả lời ba câu: người chơi là ai trong cảnh này; cần làm gì ngay sau phim; điều gì khiến việc đó quan trọng. Thoại mở đầu ưu tiên ít câu, có khoảng thở. Nhạc gốc có một mô-típ ngắn biến đổi qua các hồi; không mô phỏng giai điệu/âm hiệu thương hiệu của Call of Duty.

### 21.2 Danh mục phim và quy tắc phát

| ID | Thời lượng mục tiêu | Nội dung và cách dùng |
| --- | --- | --- |
| CINE-00 | 90 giây | Mở đầu “Lá thư chưa gửi”; phát khi chọn Xem mở đầu ở chiến dịch mới; gồm định hướng M1 ở đoạn cuối |
| CINE-M1 | 40 giây | Bản rút gọn riêng cho Chọn nhiệm vụ M1/Xem lại; không nối ngay sau CINE-00 |
| CINE-M2 | 45 giây | Điểm cao và bóng pháo sáng; hiểu đường tiếp cận, mục tiêu trước mắt; vào game từ mép hào |
| CINE-M3 | 50 giây | Lá thư bọc chống ướt; bờ sông và mục tiêu vượt sang; nối bằng bàn tay giữ đồ ở bờ |
| CINE-M4 | 45 giây | Một phố đang sống, tiếng xe/loa được duyệt; bàn tay trao vật dụng; trao điều khiển trước biến cố |
| CINE-1973 | 180 giây | Đoạn chuyển đã có ở v0.1; giữ là cảnh trong engine, chia ba nhịp 60 giây; phải xác nhận nhân vật và nguồn trước khóa dựng |
| CINE-M5 | 40 giây | Bản đồ, bụi đỏ và tiếng máy; lời giao nhiệm vụ ngắn; nối vào đội hình đang chờ |
| CINE-M6 | 40 giây | Bánh xe, đèo và đường chân trời mở; mục tiêu di chuyển; không spoil tình huống cứu người |
| CINE-M7 | 45 giây | Hàng cây thẳng và một dấu bút bị sửa; mục tiêu ban đầu; không tiết lộ cái chết hoặc trận thua có script |
| CINE-M8 | 45 giây | Ngày/địa điểm đã duyệt, phố bắt đầu hiện ra; nhiệm vụ giữ đội hình; không chiếu trước cảnh kết ở Dinh |

Các phim M2–M8 dùng cấu trúc chung: khoảng 1/4 thời gian cho vị trí, 1/2 cho con người và nguy cơ, 1/4 cho mục tiêu/hình ảnh nối cảnh. Mỗi phim có shot list riêng trước khi sản xuất; bảng này là treatment, không phải bảy kịch bản quay đã hoàn tất.

Lần đầu: menu → chọn Xem mở đầu → CINE-00 → chuẩn bị nếu cần → Nhận điều khiển → handoff M1 → gameplay. Chọn Vào nhiệm vụ đi thẳng tới màn chuẩn bị. Tiếp tục save đi thẳng tới checkpoint. Chơi lại nhiệm vụ có tùy chọn xem briefing. Mọi phim được xem lại trong Nhật ký; replay không thay tiến độ chiến dịch.

Mục tiêu “30 giây vào vai” đo từ lúc chọn Vào nhiệm vụ đến quyền điều khiển trên cấu hình/tình trạng cache đã công bố. Đường xem CINE-00 là khoảng 102 giây phim + handoff, cộng tải nếu có; không thể đồng thời hứa 30 giây điều khiển với intro bắt buộc 90 giây.

### 21.3 Kịch bản quay CINE-00 — “Lá thư chưa gửi”, 90 giây

Lời kể đề xuất của Thành, nhân vật hư cấu được nhắc trong PRD. Không gán tuổi, đơn vị hoặc quan hệ với Thu/Hải/Quyết khi chưa có kịch bản nguồn. Lời của “Đồng đội” để casting sau. Chữ ngày tháng, địa danh, đạo cụ và quân phục phải đối chiếu registry trước bản phát hành.

| Shot / timecode | Hình ảnh và camera | Thoại, âm thanh và điểm dựng |
| --- | --- | --- |
| S01 · 00–08 | Tối chuyển dần thành cận vải ba lô ẩm; khung tĩnh, một bàn tay đi vào | Tiếng thở, vải, một giọt nước. Chưa nhạc, chưa nổ |
| S02 · 08–20 | Góc qua vai trên lá thư; chỉ đọc được một dòng đã duyệt; nét bút ngừng | Thành: “Có những điều, lúc lên đường tôi chưa biết viết thế nào.” Ngừng 2 giây |
| S03 · 20–32 | Thư được gấp, bọc và cất; cắt theo chuyển động sang khóa túi | Thành: “Tôi nghĩ, đi hết con dốc này rồi sẽ viết tiếp.” Một mô-típ nhạc rất mỏng bắt đầu |
| S04 · 32–45 | Cận chân qua đất ướt, chuyển sang trung cảnh sau lưng; máy di chuyển ổn định | Tiếng chân/vải, suối xa. Tên game chưa xuất hiện; tránh nêu mẫu súng chưa duyệt |
| S05 · 45–58 | Hai bóng người qua khoảng sáng; camera ở tầm vai, không flycam toàn chiến trường | Tiếng động cơ đi vào trước hình. Nhạc giảm để người xem nhận ra âm thanh |
| S06 · 58–70 | Đồng đội giơ tay ra hiệu dừng; cận tay và mắt nhìn lên, không cắt tới máy bay | Đồng đội: “Dừng một chút. Nghe đã.” Khoảng lặng; không diễn giải chiến thuật ngoài nhu cầu kể chuyện |
| S07 · 70–82 | Máy nhìn theo dòng nước tới lối xuống; người trước quay lại chờ | Thành: “Rồi tôi nhận ra, mình không đi một mình.” Tiếng suối nối sang cảnh M1 |
| S08 · 82–90 | Tên ĐƯỜNG VỀ SÀI GÒN trên nền tối tự nhiên; chuyển về bàn tay nắm dây túi, trùng pose đầu handoff | Chữ “Cổng Trời · Trường Sơn · 1971” chỉ dùng khi duyệt; Đồng đội: “Theo tôi xuống ngầm.” Objective lặp trong HUD sau khi vào chơi |

Nguyên tắc diễn: đọc như nhớ lại một việc cụ thể, tránh giọng diễn văn. Không dùng hình tư liệu chiến tranh như texture trang trí. Không đặt người thật hoặc lời đài nguyên bản vào phim này; nếu thêm về sau phải có nguồn và quyền sử dụng tương ứng.

### 21.4 CINE-M1 — briefing độc lập, 40 giây

| Timecode | Hình và lời đề xuất | Chức năng |
| --- | --- | --- |
| 00–10 | Nét bút trên bản đồ minh họa tuyến ngầm, chữ Trường Sơn / 1971 đã duyệt | Người chơi hiểu không gian; không hiện tọa độ chính xác giả |
| 10–20 | Một đường cong theo suối nối sang hình nước; tiếng vải và bước chân | Xác lập chất liệu M1, không thêm battle montage |
| 20–30 | Đồng đội chờ bên dốc: “Qua ngầm rồi nghỉ. Đi sát nhau.” | Đặt mục tiêu tức thời; tên người nói chốt theo kịch bản |
| 30–40 | Camera xuống tầm mắt Thành; bàn tay giữ dây túi, nước ở hướng đi | Khớp hình với handoff; không cài thêm tình tiết mà người skip sẽ không biết |

### 21.5 Handoff 12 giây và cảnh tương tác

0–4 giây: đúng pose cuối phim, cùng lens/phơi sáng; vải và tiếng suối nối qua cắt. 4–8 giây: đồng đội bước vào tuyến; người chơi có thể nhìn quanh nhẹ nếu pointer lock đã cấp. 8–12 giây: tay về pose di chuyển, objective hiện, mở locomotion; không xoay camera cưỡng bức về hướng đồng đội.

Nếu dữ liệu chưa sẵn sàng, giữ poster cuối với trạng thái chuẩn bị; không chạy camera vào một map chưa có collider. Nút “Nhận điều khiển” được dùng khi cần xin khóa chuột; không giả định sự kiện video kết thúc đủ quyền gọi Pointer Lock. Có đường bỏ handoff khi chơi lại hoặc bật giảm chuyển động. Handoff không chứa thông tin cốt truyện duy nhất. [R02]

In-engine sau giao chiến ưu tiên “được nhìn, được đi chậm” với staging có thể bỏ lỡ phần hình nhưng không mất objective. Tránh lấy camera khỏi người chơi mỗi khi có một vụ nổ. Chỉ khóa chuyển động khi animation tương tác cần đồng bộ, và phải có thoát/cancel hợp lệ.

## 22. TRIỂN KHAI ĐIỆN ẢNH, HIỆU NĂNG VÀ DỮ LIỆU

### 22.1 Phương án sản xuất khả thi

G1 làm animatic CINE-00 bằng hình khối, keyframe và tiếng tạm, sau đó hoàn thiện 20–30 giây đại diện trước khi render cả phim. Ưu tiên reuse asset M1 đã duyệt; dựng ngoại tuyến trong Blender hoặc công cụ tương đương, lưu camera, project, texture, audio stem và nguồn. Khả năng/time render phải đo trên một shot của máy thật; không có ước lượng FPS render ngoại tuyến trong PRD này.

Bản phân phối thử: MP4 H.264, 1920 × 1080, 24 FPS, SDR; không yêu cầu 4K/HDR để xem trên màn Retina. Preset encode thử 6–10 Mb/s video, kiểm banding rừng, nước và bóng tối rồi quyết bitrate. Dùng HTML video phủ UI cho phim toàn màn hình; không mặc định đưa video vào texture 3D hoặc chạy hậu kỳ full scene phía sau. `MediaCapabilities.decodingInfo()` và `canPlayType()` hỗ trợ chọn bản phát, nhưng phải thử decode thực trên Chrome/Safari mục tiêu. [R03]

Phụ đề là track WebVTT tách, không nướng vào hình. Để slider thoại/nhạc/hiệu ứng độc lập trong phim, dùng video không tiếng cùng ba track thoại, nhạc và SFX đồng bộ theo media time; pause/seek/resume phải giữ sync. Nếu chưa đạt đồng bộ, dùng một audio mix và ghi rõ chỉ có âm lượng phim ở prototype, không đánh dấu AUD-001 hoàn thành. Không ép Web Audio cập nhật theo frame của game đã pause.

### 22.2 Hợp đồng trạng thái

`game/narrative` quyết định phim nào và checkpoint nào; `engine/cinematics` chịu media, camera track, timeline và giải phóng; UI chịu controls/subtitles; `content/cinematics/*.json` là dữ liệu, không nhúng logic TypeScript. Mission progression không phụ thuộc vào việc video đã chạy hết.

Luồng trạng thái: MENU → PREPARE → VIDEO hoặc READY → HANDOFF → PLAYING. PAUSED giữ trạng thái trước đó. ERROR có Thử lại / Bỏ phim nếu gameplay sẵn sàng / Về menu. Skip chỉ bỏ phần trình bày, vẫn phải chờ READY. READY yêu cầu asset thiết yếu, collider, navmesh/tuyến cần thiết, điểm spawn đứng được, camera và vật liệu đã chuẩn bị.

Manifest tối thiểu: `id`, `revision`, `missionId`, `durationMs`, `sources` (URL nội bộ, codec, resolution, bitrate), `poster`, `subtitleTracks`, `voiceTracks`, `audioBed`, `reducedMotionSource`, `skipPolicy`, `nextNode`, `assetManifestIds`, `historyFactIds`. Phân biệt nguồn file media với nguồn chứng minh lịch sử; không dùng một trường URL cho cả hai.

Save có `schemaVersion`, `missionId`, `checkpointId`, `narrativeFlags`, `cinematicsSeen` theo id/revision và trạng thái `completed`/`skipped`. Một eventId chuyển mission chỉ commit một lần kể cả `ended`, skip và load hoàn tất đến gần nhau. Khi đóng tab giữa phim, lần quay lại có Xem lại / Vào nhiệm vụ; không buộc xem lại. Không tạo checkpoint chỉ chứa camera phim mà thiếu trạng thái nhân vật.

Khi vào gameplay: hủy input cũ, đợi thả nút bấm dùng để skip/nhận điều khiển, rồi mới bật bắn/di chuyển. Khi ẩn tab: pause media và sim, dừng audio; trở lại chờ Tiếp tục. Khi `play()` bị chặn, hiện Phát phim, không tự lặp yêu cầu. [R01] Khi pointer lock thất bại, giữ màn Nhận điều khiển và thông báo ngắn; nghe `pointerlockchange`/`pointerlockerror`, không chỉ dựa Promise. [R02]

### 22.3 Ngân sách và hiệu ứng ưu tiên

Thông số dưới đây là mục tiêu cần đo, không phải benchmark đã đạt. Giữ cap gameplay 60 FPS và render nội bộ tối đa 1920 × 1200 làm đường chuẩn; UI độc lập. Mốc 16,67 ms là thời gian một frame 60 Hz. p95 18,5 ms trong v0.1 là dung sai cũ, không đồng nghĩa 60 FPS ổn định; dùng p95 ≤ 16,67 ms làm mục tiêu G1, báo trung thực cả vùng tải/stream và 1% low. 1% low tính từ trung bình 1% frame chậm nhất, không lẫn với percentile FPS.

| Thành phần | Quyết định và số cần ghi |
| --- | --- |
| Gameplay | Giữ ngân sách GPU ≤ 12 ms, CPU sim+AI ≤ 5 ms làm cảnh báo riêng; không cộng chúng như công thức frame vì có phần chồng và còn CPU render/driver |
| Benchmark | 90 giây × 3 có warmup cố định; cùng route/seed/preset; báo cả ba run, không chỉ median. Thêm soak 20 phút và đường chuyển ô |
| GPU memory | Trình duyệt không đảm bảo số VRAM chính xác, M1 dùng bộ nhớ hợp nhất; budget 3,5 GB là ước tính từ resource tracker, kèm process memory và điều kiện máy |
| CPU bottleneck | Đo main thread, animation, culling, DOM, vật lý; tăng GPU load không chữa CPU nghẽn |
| Phim 90 giây | 6–10 Mb/s tương đương khoảng 67,5–112,5 MB video theo MB thập phân; cộng audio/subtitle/container. Không coi kích thước nén là RAM khi giải mã |
| Cả bộ video | CINE-00 + tám briefing = 440 giây, khoảng 330–550 MB video cùng bitrate; đoạn 1973 là in-engine nên không cộng vào lượng encode này |
| Mạng | 100 MB ở 50 Mb/s cần tối thiểu khoảng 16 giây truyền lý tưởng; payload 250 MB cần khoảng 40 giây. Target tải 15 giây phải ghi rõ warm cache hoặc mạng/cỡ cell tương ứng |
| Nạp chồng phim | Ưu tiên video và cell đầu; dừng render nền; giới hạn decode texture/warmup theo đo đạc. Không giả định vừa xem video vừa dựng toàn map là miễn phí |

FX Tier A bắt buộc: PBR/roughness, ánh sáng định hướng, bóng chọn lọc, fog rẻ, AA đã kiểm, impact và âm đúng ngữ cảnh. Tier B có điều kiện: GTAO, bloom nhẹ, grading và volumetric ở vài shot. Tier C sau G1: SSR diện rộng, planar reflection, compute culling tùy biến, nhiều đèn đổ bóng. Tắt Tier C không được làm mất mục tiêu hoặc thay độ khó. Planar reflection là render bổ sung, không phải fallback rẻ mặc định cho SSR.

Three.js xác nhận TSL/node materials và post stack riêng của WebGPURenderer; renderer vẫn có cảnh báo experimental trong tài liệu hiện tại. Khả năng fallback WebGL2 không chứng minh mọi tổ hợp hiệu ứng, compute và asset của dự án đều tương đương. Pin phiên bản dự án, test material mẫu trên cả backend và ghi ADR khi nâng; không hứa có lợi hiệu năng chỉ vì dùng WebGPU. [R06]

### 22.4 Nghiệm thu phim và chuyển cảnh

| ID | Tình huống và điều kiện đạt |
| --- | --- |
| CIN-201 | Xem hết, skip ở đầu/giữa/cuối, spam skip cùng lúc ended: cùng mission state, không duplicate spawn hoặc save |
| CIN-202 | Video chậm, thiếu file, codec lỗi, autoplay bị chặn: có lựa chọn hữu ích; không màn đen vô hạn |
| CIN-203 | Skip khi chưa tải xong: chờ READY; nhân vật không rơi xuyên mặt đất hoặc điều khiển camera chưa gắn actor |
| CIN-204 | Esc/chuyển tab/resume trong phim, handoff, gameplay: âm, camera và sim đồng bộ; không tự bắn |
| CIN-205 | Phụ đề hai cỡ, tắt âm, giảm chuyển động, 16:10/16:9: nội dung không mất; không stretch/crop hình quan trọng |
| CIN-206 | Đồng bộ thoại–hình mục tiêu sai lệch ≤ 80 ms trong run thử sau pause/seek; lệch quá ngưỡng là lỗi, không bù bằng subtitle sớm |
| CIN-207 | Phim 1080p24 phát ba lượt, mỗi lượt dropped frame < 1% sau startup; ghi trình duyệt, codec và hoạt động tải nền |
| CIN-208 | Replay phim và Chọn nhiệm vụ không sửa tiến độ; reload giữa phim có đường tiếp tục; migration save được kiểm |
| CIN-209 | Chuyển vào game không flash trắng, nhảy FOV/grade/pose rõ; input có hiệu lực sau nhận điều khiển; lỗi được ghi clip trên máy thật |

Không dùng headless Playwright làm bằng chứng chất lượng GPU/camera/âm thanh trên M1 Max. CI kiểm logic và luồng; người thật kiểm cảm giác, phụ đề và điện ảnh trong trình duyệt đích.

## 23. KẾ HOẠCH THI CÔNG VÀ CỔNG DUYỆT BỔ SUNG

### 23.1 Thay đổi phân kỳ

G0' vẫn ưu tiên terrain/collider/rừng và registry. Thêm skeleton UI/menu/save flow, không làm phim cuối. G1 chia ba bước theo dependency: blockout và điều khiển; mẫu tay/súng/đồng đội và một encounter; animatic cùng handoff, sau đó playtest kết hợp. Chỉ khi mẫu 20–30 giây điện ảnh đạt mới render 90 giây cuối. G2–G4 nhân rộng theo nhiệm vụ; thu thoại cuối khi nội dung đã khóa. G5 hoàn thiện tiếp cận và localization đã tồn tại từ G1, không bắt đầu chúng từ số không.

Ước lượng gốc 12–14 tháng là giả định của v0.1, không được xác nhận lại bởi bản bổ sung. Sau G1 phải dự toán riêng số shot, ngày animation, chỉnh âm, giọng diễn viên, kiểm sử và sửa sau playtest. AI giúp viết công cụ, mã, validator, dựng blockout và biến thể; chất lượng diễn xuất, thẩm mỹ, nguồn sử và quyết định cắt cảnh vẫn cần con người duyệt.

### 23.2 Backlog đủ nhỏ để giao Codex/Claude Code

| Gói | Đầu ra cụ thể | Phụ thuộc / evidence |
| --- | --- | --- |
| TIP-UX01 | UI shell, menu, settings, i18n, focus, save error states | Không cần art cuối; clip keyboard flow và các viewport |
| TIP-GF01 | Một súng FP: rig, ADS, recoil, reload, impact, audio | Asset đã duyệt; clip bắn/thay băng và test ammo state |
| TIP-M101 | Tuyến 15 phút blockout, ba checkpoint, encounter 4–6 địch | Controller/collider; full run không debug, reset invariant |
| TIP-ART01 | Một ô rừng, một đồng đội gần, bộ tay và palette M1 | Registry; ảnh có cùng ánh sáng/pose tham chiếu và bench |
| TIP-CIN01 | Media player + subtitle + skip/pause/error + input handoff | UX shell; test CIN-201–205 trước phim đẹp |
| TIP-CIN02 | Animatic 90 giây, briefing M1 40 giây, handoff 12 giây | Script và nguồn tạm có nhãn; người duyệt chốt nhịp |
| TIP-CIN03 | 20–30 giây hoàn thiện đại diện, sau đó CINE-00 cuối | ART01, CIN02; visual/sound review, asset/license manifest |
| TIP-QA01 | Playtest G1, perf máy thật, danh sách sửa ưu tiên | Tích hợp tất cả; raw observations, clip, không chỉ điểm trung bình |

Contract mỗi gói phải nêu phạm vi, ID yêu cầu, file được sửa, trạng thái chưa biết, evidence và lệnh chạy. Không giao “làm giống Call of Duty” như một tiêu chí nghiệm thu. Không để nhiều coding agent cùng sửa controller/mission state hoặc tự đổi dependency trong cùng gate.

### 23.3 Gate trải nghiệm G1

Năm người chơi mới, có cả người quen và ít quen FPS, thử hai đường vào game. Mẫu này chỉ là bằng chứng định tính ban đầu, không đủ kết luận cho toàn thị trường. Ghi màn hình, câu hỏi sau chơi, chỗ lạc đường, chết và bỏ phim; chỉ ghi telemetry khi được người thử đồng ý.

Pass đề xuất: ít nhất 4/5 hiểu mục tiêu hiện tại sau 60 giây điều khiển; ít nhất 4/5 mô tả được một đồng đội hoặc một hành động đáng nhớ; không ai bị kẹt vì menu/collider/checkpoint; mọi người tìm được cách skip và chỉnh phụ đề. Chấm riêng cảm giác súng, dễ đọc, khó chịu camera và “tin bối cảnh” trên thang 1–5, xem từng câu trả lời. Người kiểm sử đánh giá niên đại; người chơi đánh giá cảm nhận, không thay vai nhau.

Phim đạt khi người xem hiểu mục tiêu và mối quan hệ sau khi xem, còn người skip vẫn hiểu nhiệm vụ qua gameplay. Không dùng tỷ lệ xem hết phim làm mục tiêu buộc giữ người chơi. Nếu điện ảnh tốt nhưng gameplay nhạt, ưu tiên sửa 15 phút chơi; nếu GPU vượt budget, giảm FX có điều kiện trước khi giảm độ rõ mục tiêu.

### 23.4 Những đầu vào còn thiếu trước sản xuất cuối

Kịch bản nhân vật v0.1 và hành trình liên tục của Thành; registry lịch sử thực tế; repo và bench thô; số GPU core/phiên bản OS/browser của máy chuẩn; ngân sách diễn viên/nhạc/animation; quyền dùng font/asset cụ thể. Các phần này có thể điền trong lúc làm prototype, nhưng không được ghi “đã duyệt” hoặc “đã đạt” khi chưa có evidence.

## 24. NGUỒN ĐỐI CHIẾU BỔ SUNG VÀ PHẠM VI BÀN GIAO

Đối chiếu ngày 05/09/2026. Các nguồn dưới đây hỗ trợ ràng buộc API và tiếp cận; không chứng minh FPS của dự án hoặc các sự kiện lịch sử. Nội dung art direction, shot list, thời lượng, token UI và budget mới là quyết định đề xuất của bản v0.2.

| ID | Nguồn trực tiếp | Áp dụng |
| --- | --- | --- |
| R01 | [MDN — Autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) | Xử lý play bị chặn; tương tác để kích hoạt tiếng |
| R02 | [MDN — requestPointerLock](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestPointerLock) | User activation, sự kiện thành công/thất bại, handoff |
| R03 | [MDN — Media Capabilities API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Capabilities_API) | Kiểm codec, smoothness và power efficiency theo thiết bị |
| R04 | [Microsoft — XAG 104](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/104) | Phụ đề, người nói, caption, nền và cấu hình trước intro |
| R05 | [Microsoft — XAG 117](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/117) | Chuyển động UI/camera, FOV, tắt hiệu ứng gây khó chịu |
| R06 | [Three.js — WebGPURenderer](https://threejs.org/manual/en/webgpurenderer) | TSL, node post-processing, fallback và trạng thái experimental |

Bàn giao lần này là PRD cập nhật cùng bản đánh giá/đặc tả thiết kế, có kịch bản quay CINE-00 và CINE-M1, treatment các phim còn lại và hợp đồng triển khai. Chưa có file video MP4, asset 3D mới hoặc mã tích hợp trong repo; các bài nghiệm thu ở trên là yêu cầu cho bước thi công, chưa được chạy trên game.

**— HẾT PRD v0.2 —**
