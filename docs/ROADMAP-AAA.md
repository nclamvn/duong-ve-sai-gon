# Lộ trình AAA v0.2

Phiên bản: 0.2, 10/10/2026 (v0.2: ghi quyết định phe DV-061, lớp bảo vệ asset DV-062 đã làm, gói phe dữ liệu đã chạy). Người viết: Claude (Chủ thầu). Người duyệt: anh Lâm.
Phạm vi: engine three.js hiện tại (repo `duong-ve-sai-gon`, sau DV-060) và một lát cắt chơi được khoảng 30 phút.

## 0. Tóm tắt một đoạn

Mục tiêu không phải "làm một game AAA đầy đủ" (PRD v0.2 đã ghi rõ: AAA đầy đủ với mocap riêng là không khả thi). Mục tiêu là **một lát cắt 30 phút mà người chơi xem và chơi thấy cảm giác ngang tầm AAA**, đo được bằng số, không bằng cảm tính. Bối cảnh, phe phái, quân phục, ngôn ngữ thoại là **gói nội dung (content pack)** nạp vào engine. Engine, pipeline, AI, âm thanh, ánh sáng không biết mình đang chạy cuộc chiến nào. Rừng Trường Sơn hiện tại là gói bối cảnh đầu tiên, không phải giới hạn.

## 1. Nguyên tắc: bối cảnh là dữ liệu

1. **Engine trung lập.** Trong `src/**` chỉ có khái niệm `faction: player | ally | hostile | neutral`, không có tên quân đội, quốc gia, phe lịch sử. Đã có sẵn luật cấm chuỗi tiếng Việt trong `src/**/*.ts`; bổ sung luật cấm tên phe cụ thể (lint script).
2. **Bốn loại gói nội dung**, mỗi gói là thư mục `content/packs/<id>/` có manifest, license, sha256:
   - **Gói bối cảnh (setting):** địa hình (DEM, features), khí hậu, hệ thực vật, soundscape, hệ động vật. Ví dụ: `rung-nhiet-doi-1970s`, `rung-ma-thu-on-doi`, `nui-da-voi`.
   - **Gói phe (faction):** skin nhân vật trên cùng một rig, vũ khí, trang bị, thoại (VO), phù hiệu, màu sắc giao diện. Có thể là phe hư cấu.
   - **Gói nhiệm vụ (mission):** kịch bản, waypoint, trigger, set piece, nhạc.
   - **Gói ngôn ngữ (locale):** chuỗi UI, phụ đề.
3. **Phe hư cấu, không chọn phe (đã chốt, DV-061).** Hai phe hư cấu trên bối cảnh rừng nhiệt đới. **Phe A (người chơi + đồng đội) cầm AK** để người chơi Việt thấy gần gũi: mũ mềm hoặc tai bèo, kaki ô liu, bao xe đạn ngực. **Phe B (đối phương)** khác dáng rõ từ xa: mũ sắt, rằn ri, dây đeo, ủng. Không quân hiệu, cờ, phù hiệu quân đội có thật. Tên phe là dữ liệu trong gói phe.
4. **Set piece trung lập:** "oanh kích rải thảm", "phục kích trên đường mòn", "vượt suối dưới pháo sáng". Ai thả bom, ai phục kích là tham số của gói nhiệm vụ.
5. **Kiểm được:** thêm test `pack-swap`: nạp lát cắt với hai gói phe khác nhau, chạy E2E giống hệt nhau, chỉ khác asset.

## 2. "Cảm giác AAA" đo bằng gì

| # | Tiêu chí | Ngưỡng đạt | Cách đo |
|---|---|---|---|
| Q1 | Khung hình | p95 ≤ 16,67 ms, p99 ≤ 25 ms trên Mac của anh Lâm, preset High | `bench` 3 lượt × 5 phút, đường bay cố định |
| Q2 | Không có hàng tạm | 0 placeholder, 0 asset "xấu thấy rõ" trong 30 phút | danh sách asset + review ảnh chụp 40 điểm cố định |
| Q3 | Âm thanh thật | 100% tiếng nền, bước chân, súng, nước là bản ghi thật có license (không tổng hợp) | manifest âm thanh, cột `source` |
| Q4 | Chuyển động người | 0 lần trượt chân thấy được, 0 T-pose, chuyển trạng thái < 0,25 s | playtest + quay chậm 10 đoạn |
| Q5 | Đồng đội và đối phương tin được | ≥ 70% người chơi chấm "hành xử như người" ≥ 4/5 | phiếu playtest |
| Q6 | Khoảnh khắc điện ảnh | ≥ 2 khoảnh khắc mà ≥ 60% người chơi nhắc lại tự nhiên khi được hỏi "nhớ gì nhất" | phỏng vấn sau chơi |
| Q7 | Tải và ổn định | tải lần đầu ≤ 20 s, 0 crash trong 10 lượt chơi đủ 30 phút | log playtest |
| Q8 | So sánh mù | ảnh chụp game đặt cạnh ảnh tham chiếu (REFERENCE-PHOTOS), ≥ 40% người xem không chắc cái nào là game ở khoảng cách ≥ 15 m | khảo sát 20 người |

Ngân sách kỹ thuật giữ theo PRD: GPU ≤ 12 ms, draw ≤ 600, payload ≤ 250 MB.

## 3. Hiện trạng (sau DV-060)

- **Đã có, mức tốt:** địa hình DEM thật + khe suối (38 khe, 16 có nước) + hố bom (143, 53 đọng nước); 29 luật mọc thực vật, ~126 nghìn instance ở preset low, 125 đến 136 draw cho rừng; khí hậu và mặt trời theo ngày giờ thật; soundscape theo thời điểm; nav 2 m; 185 unit test, 12 E2E xanh.
- **Đã có, mức tạm:** cây tán lớn vẫn dáng ôn đới (cành xoắn); mặt nước chưa có chảy theo hướng dốc và bọt; quanh spawn còn thưa hơn bờ suối; chưa có tiếng suối.
- **Chưa có:** nhân vật hoàn chỉnh (rig + skin + hoạt ảnh đầy đủ), hệ súng đạn có cảm giác, AI chiến đấu, set piece, post-process điện ảnh (god ray, LUT, AO), UI/menu hoàn chỉnh, lưu game, cài đặt đồ hoạ.

## 4. Chín trụ cột

Mỗi trụ cột: Hiện trạng → Đích → Việc → Ai làm → Chi phí → Tiêu chí đạt.
"Claude" là việc em làm được trong sandbox; "Freelancer" là việc cần người thật có kỹ năng chuyên môn; "Lâm" là việc chỉ anh làm được (mua, đăng nhập, ký, chấm mắt).

### T1. Nhân vật và hoạt ảnh

- **Hiện trạng:** tay FP đã cầm súng hai tay (DV-056); đồng đội dùng rig tạm.
- **Đích:** một rig người chung (humanoid chuẩn Mixamo/UE5-compatible), mọi phe chỉ khác skin + phụ kiện; FP tay và thân thật; hoạt ảnh đi, chạy, nấp, bắn, thay đạn, trúng đạn, ngã, bò, lội nước.
- **Việc:**
  1. Chuẩn hoá rig (`content/characters/rig.humanoid.json`), retarget toàn bộ hoạt ảnh về rig này. (Claude)
  2. Motion matching nhẹ hoặc blend tree 2D theo tốc độ + hướng, IK chân trên địa hình dốc, IK tay trái lên ốp lót tay súng. (Claude)
  3. Bộ hoạt ảnh: Mixamo miễn phí cho bản nền; gói mocap trả phí cho chiến thuật (Fab, MoCap Online) nếu cần. (Lâm mua)
  4. Skin phe: 2 phe hư cấu × 3 biến thể (lính trơn, xạ thủ, chỉ huy). Danh sách chọn đã có (`docs/research/linh-hu-cau/ASSET-SHORTLIST-linh.md`): lộ trình 0 đồng trước (Sketchfab CC-BY/CC0 có rig Mixamo), mua chỉ khi ảnh không đạt. (Lâm tải, Claude chuyển đổi và vẽ lại)
  5. Ragdoll Rapier với khớp giới hạn, chuyển hoạt ảnh sang ragdoll khi chết. (Claude)
- **Chi phí:** lộ trình 0 đồng (Mixamo, Quaternius UAL CC0, Kevin Iglesias FREE, Sketchfab CC-BY); lộ trình giá thấp khoảng 60 USD + ¥500 (thêm 60 USD nếu cần lính phe B mua). Giá lấy từ trang bán ngày 10/10/2026.
- **Đạt:** Q4; test E2E đi qua dốc 30° không xuyên chân; 0 T-pose trong log.

### T2. Âm thanh

- **Hiện trạng:** soundscape theo giờ, dữ liệu tham chiếu đã cào lọc; chưa có tiếng suối, bước chân theo mặt đất, vang theo vùng.
- **Đích:** người chơi nhắm mắt vẫn biết mình đang ở bờ suối, trong hố bom hay dưới tán rậm.
- **Việc:**
  1. Nguồn tiếng thật: Sonniss GDC bundle (miễn phí, giấy phép rộng), Freesound CC0/CC-BY, gói Phong Nha 5 USD (chờ xác nhận license). (Claude lọc, Lâm mua gói trả phí)
  2. Âm thanh khe suối: nguồn âm gắn dọc polyline `features.json`, âm lượng theo `areaHa`. (Claude)
  3. Bước chân theo bề mặt: lá khô, đất đỏ, đá rêu, bùn, nước nông; lấy theo layer terrain + `fmask`. (Claude)
  4. Vùng vang (reverb zone): tán rậm, khe hẹp, hố bom, bãi trống. (Claude)
  5. Súng: tiếng gần, xa, tiếng vọng thung lũng theo khoảng cách và địa hình (che khuất bằng raycast). (Claude)
  6. Thoại: diễn viên lồng tiếng thật cho từng gói phe; gói hư cấu có thể dùng ngôn ngữ trung lập. (Freelancer)
  7. Nhạc: tối giản, chỉ ở set piece và kết thúc. (Freelancer hoặc thư viện có license)
- **Chi phí:** 0 USD (Sonniss, Freesound) + 5 USD (Phong Nha) + VO và nhạc **cần báo giá**.
- **Đạt:** Q3; test tự động: mọi `surface` trong level có ít nhất 4 mẫu bước chân.

### T3. Ánh sáng, màu và hậu kỳ

- **Hiện trạng:** mặt trời đúng vị trí, sương theo tầm nhìn; chưa có tia nắng xuyên tán, AO, LUT.
- **Đích:** hình ảnh như phim nhựa 35 mm thập niên 70, có tia sáng xuyên tán lúc bình minh.
- **Việc:**
  1. GTAO hoặc SSAO (three r185 có pass AO cho WebGPU). (Claude)
  2. God ray: volumetric đơn giản theo depth + mặt trời thấp; chỉ bật khi góc mặt trời < 25°. (Claude)
  3. LUT điện ảnh: 2 LUT (phim nhựa ấm, phim âm bản lạnh) làm từ ảnh tham chiếu, chọn theo preset khí hậu. (Claude)
  4. Grain, vignette, chromatic nhẹ, motion blur camera khi chạy. (Claude)
  5. Bình minh chuyển dần trong 30 phút (thời gian trong game chạy nhanh × 4). (Claude)
  6. Bóng: cascaded shadow 3 tầng cho Mac, 2 tầng cho preset thấp. (Claude)
- **Chi phí:** 0 USD.
- **Đạt:** Q1 vẫn giữ sau khi bật; Q8 so sánh mù.

### T4. Môi trường sống

- **Hiện trạng:** rừng dày, khe suối, hố bom, đá tảng; cây tán còn dáng ôn đới.
- **Đích:** rừng nhiệt đới tin được ở mọi khoảng cách, có phản ứng với người chơi.
- **Việc:**
  1. Thay cây tán: gói cây nhiệt đới trên Fab (~122 USD, đã có danh sách trong ASSET-SHORTLIST). (Lâm mua, Claude tích hợp)
  2. Dây leo, cây đổ, rễ bạnh, tre nứa: bổ sung từ cùng nguồn. (Lâm mua hoặc Claude lọc CC0)
  3. Tương tác: cỏ, dương xỉ rạp khi đi qua (vertex shader theo vị trí người), lá rung khi đạn bay qua. (Claude)
  4. Nước chảy: flow map theo hướng polyline, bọt ở chỗ dốc, gợn khi lội. (Claude)
  5. Động vật: chim bay khỏi tán khi có tiếng súng, khỉ trên cao (âm thanh + mô hình đơn giản ở xa), côn trùng quanh nước. (Claude, mô hình mua nếu cần)
  6. VFX: bụi đất đỏ khi đạn chạm, nước bắn khi đạn chạm suối, khói, lửa, lá rơi. (Claude)
  7. Lấp vùng thưa quanh spawn. (Claude)
- **Chi phí:** ~122 USD (Fab cây) + có thể thêm gói động vật **cần báo giá**.
- **Đạt:** Q2, Q8; draw cho rừng giữ ≤ 140.

### T5. Set piece có đạo diễn

- **Đích:** 2 khoảnh khắc người chơi nhớ (Q6).
- **Việc:**
  1. **Oanh kích rải thảm:** cảnh báo bằng âm thanh xa, mặt đất rung, chuỗi nổ chạy ngang tầm nhìn, cây đổ, tai ù (lọc âm cao), bụi che nắng. Dùng lại dữ liệu hố bom DV-060 làm vị trí. (Claude)
  2. **Vượt suối dưới pháo sáng ban đêm** hoặc **phục kích trên đường mòn** (anh Lâm chọn một). (Claude)
  3. Công cụ timeline đơn giản (`content/missions/*/sequence.json`): sự kiện theo giờ, theo trigger, theo vị trí. (Claude)
  4. Camera shake, slow-mo nhẹ 0,3 s, ống kính bẩn bụi. (Claude)
- **Chi phí:** 0 USD (dùng asset sẵn có) + nổ, mảnh vỡ có thể mua **cần báo giá**.
- **Đạt:** Q6; p95 trong set piece ≤ 22 ms.

### T6. AI đồng đội và đối phương

- **Hiện trạng:** đồng đội đi theo trên nav 2 m.
- **Đích:** đồng đội nấp, gọi nhau, che chắn; đối phương tuần tra, nghe, tìm, đánh tạt sườn, rút lui.
- **Việc:**
  1. Điểm nấp tự sinh từ đá tảng, gốc cây, mép hố bom, bờ suối (đã có trường khoảng cách). (Claude)
  2. Cảm nhận: tầm nhìn có che khuất bởi thực vật (mật độ instance), thính giác theo tiếng súng/bước chân. (Claude)
  3. Hành vi: behavior tree hoặc utility AI; trạng thái tuần tra, nghi ngờ, giao chiến, tạt sườn, rút. (Claude)
  4. Thoại tình huống (barks) nối với T2. (Claude + Freelancer VO)
  5. Phe chỉ là tham số: cùng một bộ hành vi, khác trang bị và thoại. (Claude)
- **Chi phí:** 0 USD.
- **Đạt:** Q5; test E2E: đối phương tìm được người chơi trong ≤ 60 s sau khi nghe tiếng súng.

### T7. Hiệu năng và tải

- **Hiện trạng:** ngân sách đo trong sandbox; chưa có bench chuẩn trên Mac của anh Lâm.
- **Việc:**
  1. `bench` đường bay cố định, xuất JSON (p50, p95, p99, draw, tri, bộ nhớ GPU). Anh Lâm chạy trên Mac. (Claude viết, Lâm chạy)
  2. Streaming theo ô (cell 256 m) để mở rộng bản đồ mà không tăng payload ban đầu. (Claude)
  3. Preset Thấp / Vừa / Cao / Điện ảnh, tự chọn theo bench lần đầu. (Claude)
  4. Nén: KTX2 toàn bộ, meshopt cho hình học, âm thanh Opus. (Claude)
  5. **Lớp bảo vệ asset (DV-062, đã làm 10/10/2026):** asset mua theo Fab Standard, CGTrader RF, Unity EULA phải "ngăn người dùng cuối trích xuất". Đóng gói vào `.dvpak` (AES-GCM theo khối, giải mã trong Web Worker, không để `.glb` trần trên mạng). Áp cho gói cây Fab, tay AK AB3DX, lính mua. Asset CC0/CC-BY/Mixamo không cần. (Claude)
- **Đạt:** Q1, Q7; payload ≤ 250 MB.

### T8. Cảm giác chơi (game feel)

- **Việc:**
  1. Súng: giật theo mẫu, nhắm qua thước ngắm thật, đạn rơi theo trọng lực, xuyên lá nhưng không xuyên thân cây, kẹt đạn hiếm. (Claude)
  2. Di chuyển: quán tính, chậm lại khi lội nước và bùn, trượt dốc đất đỏ, thở dốc khi chạy lâu. (Claude)
  3. Camera: lắc đầu khi đi nhẹ, ngả theo hướng nấp, độ trễ tay súng. (Claude)
  4. Phản hồi trúng đạn: âm thanh, rung, máu tối giản theo tiêu chuẩn phân loại tuổi mong muốn. (Claude)
- **Đạt:** playtest: ≥ 70% chấm "điều khiển đã tay" ≥ 4/5.

### T9. Giao diện, trợ năng, ngôn ngữ

- **Việc:**
  1. HUD tối giản (ẩn mặc định), la bàn, ra hiệu đồng đội. (Claude)
  2. Menu, cài đặt đồ hoạ, phím, âm thanh, lưu điểm kiểm tra. (Claude)
  3. Trợ năng: phụ đề có tên người nói, chỉnh cỡ chữ, chế độ mù màu, giảm rung camera, giảm nháy sáng. (Claude)
  4. Ngôn ngữ: vi, en trước; chuỗi trong `i18n` theo luật hiện tại. (Claude + Lâm duyệt bản vi)
- **Đạt:** 100% chuỗi UI qua i18n; test trợ năng tự động (độ tương phản, cỡ chữ tối thiểu).

## 5. Giai đoạn và phụ thuộc

### Giai đoạn A: Nền móng (ưu tiên trước)

T7.1 bench Mac, T1.1 rig chung, T1.2 IK, T2.1 đến T2.4 âm thanh môi trường, T3.1 đến T3.4 hậu kỳ, T4.1 cây Fab, T4.4 nước chảy, T4.7 lấp spawn, khung `content/packs/` + test `pack-swap`.
**Cổng A:** Q1 trên Mac sau khi bật AO + god ray + cây mới; Q3 cho tiếng môi trường; ảnh 40 điểm duyệt bởi anh Lâm.

### Giai đoạn B: Lối chơi

T8 toàn bộ, T6 toàn bộ, T1.3 đến T1.5 hoạt ảnh + skin 2 phe hư cấu, T2.5 súng, T4.3 và T4.6 tương tác + VFX.
**Cổng B:** playtest 5 người (trong nhà), Q4, Q5 ≥ 60%.

### Giai đoạn C: Điện ảnh và hoàn thiện

T5 hai set piece, T2.6 và T2.7 thoại + nhạc, T4.5 động vật, T7.2 đến T7.4 streaming + preset, T9 toàn bộ.
**Cổng C:** playtest 10 người (có người lạ), đủ Q1 đến Q8.

Phụ thuộc chính: T5 cần T4.6 (VFX) và T2 (âm thanh nổ); T6 cần T1.1 (rig) và điểm nấp; T2.6 (thoại) cần kịch bản gói nhiệm vụ.

## 6. Ngân sách đã biết

| Khoản | Giá | Trạng thái |
|---|---|---|
| Gói cây nhiệt đới Fab | ~122 USD | anh Lâm mua (đã chốt) |
| Âm thanh Phong Nha | 5 USD | chờ xác nhận license |
| Sonniss GDC, Freesound CC0, Poly Haven, Mixamo | 0 USD | dùng được |
| Mô hình lính 2 phe | 0 USD (lộ trình miễn phí) hoặc 15 đến 75 USD | danh sách chọn DV-061 |
| Hoạt ảnh lính | 0 USD hoặc 30 USD (Kevin Iglesias đầy đủ) | danh sách chọn DV-061 |
| Diễn viên lồng tiếng | cần báo giá | |
| Nhạc | cần báo giá | |
| Cố vấn lịch sử (chỉ khi bật gói phe lịch sử) | cần báo giá | |

Nguyên tắc asset giữ nguyên: CC0, CC-BY, Mixamo, tự làm, thuê có hợp đồng, hoặc mua Fab Standard dùng nguyên trạng. Không rip.

## 7. Đo lường và quy trình playtest

1. **Bench:** sau mỗi DV có ảnh hưởng hình ảnh, anh Lâm chạy `bench` trên Mac, file JSON lưu vào `evidence/DV-xxx/`.
2. **Ảnh 40 điểm:** vị trí + giờ cố định, chụp tự động, so với bản trước (diff).
3. **Playtest:** 5 đến 10 người, mỗi người chơi đủ 30 phút, không hướng dẫn; ghi màn hình; phiếu chấm 1 đến 5 cho Q4, Q5, T8; phỏng vấn 3 câu ("nhớ gì nhất", "lúc nào thấy giả", "có muốn chơi tiếp không").
4. **So sánh mù Q8:** 20 cặp ảnh, xáo ngẫu nhiên, 20 người xem.
5. **Review chuyên môn:** một người làm game hoặc làm phim xem bản cuối giai đoạn C (cần báo giá hoặc nhờ quen).

## 8. Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| WebGPU trên Safari/Mac kém hơn Chrome | Cao | bench cả hai; preset tự chọn; giữ đường WebGL fallback cho preset thấp |
| Hậu kỳ (AO, god ray) phá ngân sách 12 ms GPU | Cao | bật theo preset; render nửa độ phân giải; đo từng pass |
| Hoạt ảnh Mixamo không đủ cho chiến thuật | Trung bình | mua gói mocap; giới hạn bộ động tác trong lát cắt |
| Nhạy cảm chính trị nếu dùng phe lịch sử | Trung bình | mặc định phe hư cấu; gói lịch sử chỉ bật khi có cố vấn và anh Lâm quyết |
| Phạm vi phình | Cao | khoá lát cắt 30 phút; mọi ý mới vào backlog sau cổng C |
| Asset mua đòi ngăn trích xuất file (Fab, CGTrader, Unity) | Trung bình | lớp bảo vệ `.dvpak` (DV-062); ưu tiên CC0/CC-BY/Mixamo; email xin người bán xác nhận; loại TurboSquid, Reallusion |

## 9. Quyết định cần anh Lâm

1. ~~Phe hư cấu~~ Đã chốt (DV-061): hư cấu, không chọn phe, phe người chơi cầm AK.
2. ~~Gói cây Fab~~ Đã chốt: anh Lâm mua.
3. ~~Lớp bảo vệ asset~~ Đã duyệt và làm (DV-062).
4. Set piece thứ hai: **vượt suối dưới pháo sáng** hay **phục kích trên đường mòn**?
5. Có muốn em lập danh sách và xin báo giá cho lồng tiếng, nhạc (em soạn yêu cầu, anh gửi)?
6. Tiêu chuẩn mức độ bạo lực mong muốn (ảnh hưởng T8.4 và VFX)?
