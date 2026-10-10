# Registry cào–lọc · Rừng Trường Sơn cho Đường về Sài Gòn

*Mẻ 1, mẻ 2 (2026-10-09) và mẻ asset (2026-10-10, mũi I Fab/Megascans, J Sketchfab, K Poly Haven/BlenderKit/khác; danh sách chọn ở `ASSET-SHORTLIST-rung.md`). Mẻ 2 thêm ba mũi: Cổng Trời và đường 20/đường 12 cùng công sự (F), bảng ảnh tham chiếu (G), loài còn thiếu (H). Năm mũi cào song song (thực vật, địa hình và khí hậu, động vật và âm thanh, dấu vết chiến tranh 1971, nguồn asset sạch giấy phép). Kỷ luật refinery: mỗi giá trị có tier và nguồn, giá trị lệch nhau giữ nguyên trạng thái tranh chấp, ô thiếu nguồn ghi honest-null, không lấp bằng phỏng đoán.*

Tier: **A** = nguồn gốc hoặc chuyên môn (báo cáo khảo sát khu bảo tồn, bài khoa học, IUCN, PROSEA, CIFOR, hồi ký nhân chứng, chuyên khảo quân sử, trang giấy phép chính thức). **B** = thứ cấp uy tín (Wikipedia, WWF ecoregion, báo lớn). **C** = blog, du lịch, lời kể chưa kiểm.

## 0. Kết quả build

| Chỉ số | Giá trị |
|---|---|
| Snapshot | 504 trích đoạn (mẻ 1: A 39, B 25, C 27, D 41, E 45; mẻ 2: F 39, G 75, H 59; mẻ asset: I 79, J 21, K 54) |
| Claim | 1.909 (tier A 1.168 · B 680 · C 61); 101 giữ nguyên văn, 1.666 chuẩn hoá (phần lớn là dịch sang tiếng Việt), 142 suy luận |
| Thực thể | 397 trên mẫu số ước lượng 420 (coverage 94,5 %). Mẫu số đã sửa ba lần, ghi trong domain.yaml |
| Cổng | VALIDATION PASSED. Bite suite: 6/6 cổng cắn. Build tất định, auditor dựng lại khớp |
| Kiểm chéo bằng tay | Đối chiếu ngẫu nhiên 3 nguồn với trang gốc (ambientCG license, báo cáo Bắc Hướng Hóa, bài vượn hót Nakai–Nam Theun): 5/5 câu khớp nguyên văn |

**Giới hạn phải biết:**

- Snapshot là trích đoạn do công cụ đọc web trả về (giới hạn khoảng 125 ký tự mỗi câu trích), không phải HTML thô. Cổng SPAN_NOT_FOUND kiểm span nằm trong trích đoạn; người kiểm độc lập mở URL để đối chiếu.
- Đã **loại 21 claim** của một nguồn (VASS, "Vùng khí hậu Bắc Trung Bộ", file .docx) vì mũi B tải nó bằng đường không được phép trong môi trường này. Các ý khí hậu đó vẫn có nguồn khác (Frontier/BirdLife Bắc Hướng Hóa, USMC, Wikipedia).
- 31 claim "nhom" của mũi C được Thầu gán ở bước gộp, đánh dấu `inferred`.
- Gộp tường minh 4 cặp tên (A Sầu, ánh sáng nền rừng, khí hậu Bắc Hướng Hóa, Đường 9). Năm tên vượn và ba tên khỉ để trong cụm mơ hồ, **cấm tự gộp** vì phân loại vượn đổi nhiều lần.
- Engine coi mọi giá trị khác nhau trong một ô là tranh chấp. Phần lớn 100 ô "tranh chấp" thật ra là nhiều mặt mô tả bổ sung cho nhau (hình thái, âm thanh). Mục 7 chỉ liệt kê **mâu thuẫn số liệu thật**.

---

## 1. Rừng trông thế nào: cấu trúc tầng

| Hạng mục | Giá trị | Tier | Nguồn |
|---|---|---|---|
| Rừng nguyên sinh thường xanh đất thấp | 3 tầng tán, cao 25–35 m, cây vượt tán tới 45 m nhô lên làm mặt tán gồ ghề | B | WWF ecoregion IM0141 |
| **Rừng thật sát Đường 9 (Bắc Hướng Hóa)** | Vượt tán thường 20–25 m, tối đa 30 m, thân 40–80 cm (cá biệt 120 cm), chỉ phủ 15–20 % diện tích. Tán chính 10–15 m, tán tròn, cao khá đều. Dưới tán 7–10 m. Cây bụi dưới 5 m. Thảm tươi: dương xỉ, ráy, gừng, lá dong | A | Báo cáo đa dạng sinh học Bắc Hướng Hóa (Frontier/BirdLife) |
| Phong Nha | Cây gỗ khổng lồ có rễ bạnh, cao tới 50 m, kèm dây leo thân gỗ | A | UNEP-WCMC datasheet |
| Rừng quanh Khe Sanh | 2–3 tầng tán cao 18–27 m, cây bụi, dây leo, bụi tre rậm che tầm nhìn | A | USMC "Khe Sanh: Ringed by Fire" |
| Rừng Quảng Trị (1971) | Vùng núi 2–3 tầng tán, tầng dưới rất rậm; trung du khô, cây không quá đầu người; quanh Sê Pôn thấp và thưa | A | Nguyễn Duy Hinh, "Lam Son 719" (Indochina Monograph) |
| Trên 600–900 m | Tán thấp còn 15–25 m, 2 tầng, họ Dẻ tới 60 % số cây, phong lan rất nhiều; sườn dốc và đỉnh không có tầng vượt tán | A/B | Bắc Hướng Hóa, Sourcebook Bạch Mã, WWF |
| Ánh sáng nền rừng | Khoảng 2 % nắng tới nền rừng, 5 % tới tầng dưới tán. Xa suối và khoảng trống thì nền rừng khá quang, dễ đi; bụi rậm dồn ở ven suối và chỗ trống | B | Wikipedia "Tropical rainforest" (số chung, không đo ở Trường Sơn) |
| Dấu hiệu rừng già | Dây leo dài tới 30 m, to 10 cm, rất nhiều; rừng thứ sinh gần như không có dây leo, phong lan, dương xỉ thân gỗ | A | Bắc Hướng Hóa |

**Hệ quả cho dựng cảnh:** rừng game không nên là "bức tường xanh" đều khắp. Rừng già: thân cột thẳng, tán khép cao, nền tối và tương đối quang, dây leo lớn treo từ tán. Bụi rậm dày chỉ ở ven suối, khoảng trống, mép đường và rừng thứ sinh. Đó là điểm phân biệt cảnh thật với cảnh game rẻ.

## 2. Loài cây hoạ sĩ cần dựng

| Loài/nhóm | Mắt thấy | Tier | Nguồn |
|---|---|---|---|
| Lim xanh (*Erythrophleum fordii*) | Thân tròn, vỏ nâu sẫm nứt ô vuông, nhiều bì khổng, gốc bạnh nhỏ, tán dày xanh quanh năm. Tháng 12–1 quả đậu dài 15–30 cm chín nâu đến đen xám (đúng tháng 1/1971) | A | CIFOR |
| Chò nâu (*Dipterocarpus retusus*) | Vỏ xám hơi nứt, thân tròn thẳng không cành 15–20 m, lá to 16–28 cm | A | PROSEA |
| Kiền kiền (*Hopea pierrei*) | Thân hay cong vặn, vỏ nhẵn sẫm có đốm sáng, rễ bạnh mỏng hoặc rễ chống | A | PROSEA |
| Chò đen | Loài họ Dầu dày nhất rừng A Lưới 500–910 m, 89 cây/ha | A | ĐH Huế |
| Đa, si, sung bóp cổ (*Ficus*) | Rễ buông từ cây chủ xuống ôm thân; cây chủ chết thì đa thành cột rỗng ruột; bám cả vách đá vôi | A/B | Bắc Hướng Hóa, Wikipedia |
| Dương xỉ tổ chim (*Asplenium*) | Lá đơn xanh bóng dài 90–125 cm, xếp hoa thị như phễu hứng lá rụng, bám cao trên cành | A | Australian Tropical Ferns |
| Dương xỉ thân gỗ (*Cyathea*) | Thân tới 15–20 m, cuống lá có gai, gốc tím phủ vảy; ở khe suối ẩm và mép rừng ven đường | A | PROSEA |
| Móc, đùng đình (*Caryota*) | Lá kép 2 lần, lá chét hình nêm kiểu đuôi cá; mọc cụm cao 5–12 m, lá dài 2–4 m, quả cam đến đỏ sẫm | A | PROSEA |
| Song mây (*Calamus*) | Thân leo dài tới 70 m, gai xanh chĩa xuống dài tới 1 cm, roi móc dài tới 5 m; VN có 18 loài | A | Palms (IPS) |
| Cọ (*Livistona saribus*) | Lá quạt, cao tới 20 m ở khoảng trống; lấn lên tầng trên ở rừng đã khai thác | B | WWF |
| Lá nón (*Lanonia centralis*) | Có ở Bạch Mã | B | NYBG |
| Nứa (*Neohouzeaua dulloa*) | Cao 7–9 m, cụm thưa, thân ngả dựa cây bên; 300–700 m | A | PROSEA |
| Tre núi (*Arundinaria peteloti*) | 3–5 m, mọc dày đặc chiếm đất thoái hoá 700–1.200 m | A | Bắc Hướng Hóa |
| Cỏ tranh (*Imperata cylindrica*) | Cao 0,1–1,2 m (có khi 3 m), lá già mép sắc cứa tay, gân giữa trắng, bông túm lông trắng; lửa làm nó thành thảm gần như thuần loài | A | PROSEA |
| Lách (*Saccharum spontaneum*) | Cao 1–4 m, bẹ lá thường tím, bụi lớn ven sông | A | PROSEA |
| Chít (*Thysanolaena latifolia*) | Sườn dốc, bờ khe; bông chín xanh nhạt hoặc đỏ tháng 1–3 | B | Wikipedia |

## 3. Mặt đất, đá, suối

| Hạng mục | Giá trị | Tier | Nguồn |
|---|---|---|---|
| Đất Khe Sanh | Sét đỏ nâu phong hoá sâu lẫn bazan, "đỏ hơn mọi thứ đất tôi từng thấy"; quần áo, lều, xe đều nhuốm đỏ | A | USMC |
| Hai trạng thái đất đỏ | Mưa: trơn như sân băng. Khô: bụi mịn như phấn bay mù | A | USMC |
| Đất đồi quanh Khe Sanh | Cát lẫn đá, tầng mỏng, khó đào | A | USMC |
| Đất Bắc Hướng Hóa | Feralit vàng nâu trên đá phiến mica, mặt "mịn như lụa"; feralit vàng nhiều cát, thô; núi trung bình feralit đỏ vàng mùn; ven sông phù sa | A | Bắc Hướng Hóa |
| Độ dốc | Sườn Quảng Bình của Bắc Hướng Hóa 15–25°, có chỗ dốc hơn. Vùng không karst Phong Nha chia cắt sâu, dốc 25–30°. Đakrông núi thấp chia cắt mạnh, phần lớn dưới 500 m | A/B | Frontier, Wikipedia PNKB, Sourcebook Đakrông |
| Hai sườn Trường Sơn | Sườn đông dốc đứng lên từ đồng bằng, nhiều sông ngắn; sườn tây (Lào) thoải hơn, thành cao nguyên rồi xuống Mê Kông | B | Wikipedia |
| Karst Phong Nha – Hin Nam No | Vách dựng, hố sụt sâu, sông ngầm; đá vôi xen phiến sét, sa thạch, granit; cây con chỉ mọc trong hốc đá có đất | A/B | UNESCO, Wikipedia, Frontier |
| Đá tai mèo | Mỏm đá trên tuyến Trường Sơn phải ghép cây làm cầu vượt | B | Nhân Dân |
| Bạch Mã | Granit chủ yếu, phủ sa thạch, phiến, gneiss; dốc hiểm | A | Sourcebook |
| Thung lũng Sê Pôn | Lòng máng rộng 3,5–5 km giữa hai dãy núi, cao 170 m; bãi bằng có bụi rậm xen mảng rừng; bờ sông dốc đứng | B | Wikipedia |
| Thung lũng A Sầu | Dài 40 km, đáy phẳng rộng 1,5 km phủ cỏ voi cao, hai bên núi rừng dày 900–1.800 m | B | Wikipedia |
| Sông Sê Băng Hiêng chỗ Đường 9 qua | Rộng 30 m, phần lớn năm sâu khoảng 1 m, lội được | B | Wikipedia |
| Suối quanh Khe Sanh | Mùa khô lội được, sau mưa lớn không qua nổi; mưa lớn ở Đakrông gây lũ quét, xói mạnh | A | USMC, Sourcebook Đakrông |
| Bãi lầy Khe Ve | Mưa xuống cả vùng thành bãi lầy, phải lội bùn | B | Nhân Dân |

## 4. Trời, sương, ánh sáng cho M1 (tháng 1) và M2 (tháng 2–3)

| Hạng mục | Giá trị | Tier | Nguồn |
|---|---|---|---|
| Khe Sanh (367 m) tháng 1/2/3 | Cao trung bình 22,1/23,9/27,5 °C; thấp 15,8/16,6/18,6 °C; kỷ lục thấp khoảng 8 °C. Mưa 18/18/38 mm. Ẩm 86–90 %. Nắng 125/125/165 giờ/tháng | B | Wikipedia (bảng khí hậu) |
| Bắc Hướng Hóa | Tháng 12–1 khô và lạnh nhất, khoảng 20 °C, trên 500 m có lúc 15 °C. Tháng 2 nhiều mây nhất, 2,3 giờ nắng/ngày. Tháng 2–3 mưa nhẹ | A | Frontier/BirdLife |
| Sương mùa đông Khe Sanh | Mưa phùn và sương "cuộn về từ núi", gần trưa hôm sau mới tan. Mây thấp khoảng 150 m, tầm nhìn dưới 0,8 km, mỗi đợt 3–5 ngày. Năm 1968 trời quang dần từ tháng 3 | A/B | USMC, Wikipedia Battle of Khe Sanh |
| Nam Lào tháng 2–3/1971 | Sáng sớm sương mặt đất, mây thấp, tầm nhìn 0–2 dặm. Trưa khá quang. Chiều và chập tối mù khói, tầm nhìn dưới 3 dặm. Chỉ bay tốt từ 10–12 giờ đến giữa chiều. Ngày 4–5/2 mây thấp xen mưa | A | Hồi ức đơn vị bay (catkillers), tướng Hinh |
| Lệch mùa hai sườn | Sườn đông mưa thu đông (Đông Hà mùa mưa tháng 8–12, đỉnh tháng 10 khoảng 630 mm; tháng 1–3 chỉ 53/32/35 mm). Sườn Lào (Sê Pôn) khô tháng 10–3, mưa từ đầu tháng 5. **M2 rơi vào cuối mùa khô bên Lào** | A/B | Wikipedia Đông Hà, Lam Son 719, Xepon |
| Gió Lào | Khô nóng, có lúc trên 40 °C, ẩm có lúc dưới 30 %; thổi khoảng tháng 3–6, mạnh nhất 6–7. **Ngoài khung M1, M2** | A | Frontier/BirdLife |
| Mặt trời Huế (UTC+7) | Tháng 1 mọc 6:22, lặn 17:37. Tháng 2 mọc 6:17, lặn 17:53. Tháng 3 mọc 5:59, lặn 18:00 | C | solarwatch.app |
| Múi giờ 1971 | Miền Nam dùng UTC+8 (1/1/1960 đến 12/6/1975), miền Bắc UTC+7. Đồng hồ phía Sài Gòn chỉ giờ mọc khoảng 7:22 tháng 1 | B | Wikipedia "Time in Vietnam" |

**Hệ quả cho dựng cảnh:** M1 tháng 1 là cảnh lạnh ẩm, mây thấp, sương và mưa phùn kéo dài tới gần trưa, ít nắng. Tia nắng xuyên tán (REN-004) chỉ hợp cho buổi trưa hiếm hoi trời quang, không phải bảng màu mặc định. M2 tháng 2–3: sáng sương, trưa quang, chiều mù khói, đất đỏ chuyển từ ẩm sang bụi.

## 5. Âm thanh và con vật

| Loài | Mắt thấy, tai nghe | Tier | Nguồn |
|---|---|---|---|
| Vượn đen má trắng (*Nomascus* sp., sườn Lào giáp Quảng Bình) | Con đực đầu tiên hót trung bình **12 phút trước mặt trời mọc**, mọi tiếng hót tắt trung bình **13 phút sau**. Một hồi hót đôi dài trung bình 16 phút, ngắn lại khi có gió. Hót nhiều hơn vào mùa khô lạnh (đúng tháng 1), ít hơn ngày mưa | A | Coudrat et al. 2015, Int. J. Primatology |
| Cấu trúc bài hót đôi | Vài nốt mở đầu của cả hai, rồi "great call" của con cái; con đực im, chèn coda, rồi hót xen tới great call kế tiếp | A | Frontiers 2023 (vượn nuôi) |
| Màu vượn | Con đực đen tuyền có mảng má trắng, con cái nâu vàng | B | Wikipedia |
| Lời nhân chứng 1967–69 | "Tiếng vượn kêu hú suốt ngày"; đêm có "âm thanh sột soạt rất lạ"; mưa thì muỗi, vắt khắp nơi, ếch nhái "như một bản hợp xướng" | B | Báo Văn Hoá (tuyến phía nam vùng game) |
| Voọc chà vá chân nâu | Đầu bạc, thái dương đỏ, trán đen, mặt vàng nâu, vòng cổ cam; sống tán cao, đàn trung bình 18 con; gầm gừ trầm khi doạ, rít chói khi hoảng; giật mình thì sủa to và **đập cành** | B/A | Wikipedia, Sourcebook Đakrông |
| Voọc Hà Tĩnh | Đen tuyền, má trắng kéo qua tai xuống cổ; ngủ hang vách đá vôi, ra lúc rạng sáng, về đầu chiều; đàn 2–15 con (vùng karst Phong Nha) | B/A | Wikipedia, Sourcebook Phong Nha |
| Khỉ mặt đỏ | Mặt hồng đỏ, già sẫm nâu đen, đuôi cụt 32–69 mm | B/A | Wikipedia, Đakrông |
| Khỉ đuôi lợn | Lông xám tròn quanh má, vệt đỏ khoé mắt ngoài, đuôi mảnh; đàn có thể trên 150 con | B | Wikipedia |
| Hồng hoàng | Tiếng vỗ cánh nặng nghe từ xa, "như đầu máy hơi nước khởi động"; hót đôi "kok" khoảng 1 lần/giây rồi thành hỗn hợp gầm và sủa | B | Wikipedia |
| Trĩ sao | Đuôi trống dài tới 1,73 m, tổng dài 1,9–2,39 m; lông đen vàng da bò lốm đốm, mỏ hồng, da quanh mắt xanh lam | B/A | Wikipedia, Đakrông, Phong Nha |
| Bìm bịp lớn | Tiếng trầm vang lặp lại; thân đen ánh tím, cánh nâu hạt dẻ, mắt đỏ, dài 48 cm; đi dưới đất, hoạt động sáng và chiều muộn | B | Wikipedia |
| Gà rừng | Gáy ngắn hơn gà nhà, tắt đột ngột ở cuối; hoàng hôn bay lên cây ngủ | B | Wikipedia |
| Gà lôi lam mào trắng | Báo động trầm khàn "uk uk uk"; trống xanh đen có mào; nấp ở rừng có cọ và tre (tìm lại 1996 ở Đakrông, Phong Điền) | B/A | Wikipedia, Sourcebook |
| Sóc bụng đỏ | Lưng nâu, bụng đỏ; ban ngày trên tán; kêu báo động và vây rắn | B | Wikipedia |
| Dúi mốc lớn | Hang một lối vào có ụ đất, ở bụi tre; ra ngoài ban đêm | B | Wikipedia |
| Tắc kè | Tiếng đực to "tô-kê", mở đầu bằng tràng lách cách trầm; kêu nhiều nhất chạng vạng, đỉnh thứ hai rạng sáng; da xám xanh đốm cam đỏ, dài 25–30 cm | B | Wikipedia |
| Rắn lục mép trắng | Lưng xanh lục, vùng dưới mắt sáng, dài tối đa 81 cm | B | Wikipedia |
| Hổ mang chúa | Dài 3,2–4 m, xanh ô liu có khoang; tiếng "gầm" trầm khoảng 600 Hz; dựng nửa thân, bạnh mang | B | Wikipedia |
| Cạp nong | Khoanh đen vàng; ban ngày lờ đờ, giấu đầu dưới khoanh thân | B | Wikipedia |
| Mang | Tiếng kêu như tiếng sủa, dùng báo động | B | Wikipedia |
| Ve sầu | Kêu mạnh nhất giờ nóng mùa hè, tới 120 dB. **Tháng 1 rất ít hoặc không có ve**; tháng 2–3 chưa có nguồn Trường Sơn | B | Wikipedia |
| Sao la | Công bố năm 1992; lính 1971 không biết tên, nếu có chỉ là "con thú lạ" | B/A | Wikipedia, Đakrông |
| Hổ, voi | Phong Nha nay không còn ý nghĩa bảo tồn hổ, voi (A). Lời đồn bộ đội 1967–69 "cọp sống thành từng đàn" ở núi Răng Cưa (B, chưa kiểm, phía nam vùng game) | A/B | Sourcebook Phong Nha, Báo Văn Hoá |

**Hệ quả cho âm thanh:** bình minh M1 có một cửa sổ khoảng 25 phút quanh lúc mặt trời mọc dành cho vượn hót đôi, xa và vang trên sườn núi. Ban ngày tháng 1 im hơn người ta tưởng: không có tường ve sầu. Chạng vạng có tắc kè, gà rừng lên cây ngủ. Mưa thì ếch nhái. Tiếng mang sủa và voọc đập cành là âm báo động tự nhiên, có thể dùng làm tín hiệu gameplay (có người đi gần).

## 6. Lớp chiến tranh trên cảnh rừng (1965–1972)

| Hạng mục | Giá trị | Tier | Nguồn |
|---|---|---|---|
| Hố bom lớn | Đường kính khoảng 9 m (30 ft), sâu hơn 1,5 m (5 ft) | B | Time 1972 (kho CIA) |
| Hố bom đọng nước | Nơi nước ngầm nông dưới 1,5 m, hố đầy nước rất nhanh, thành ổ muỗi; đất trong hố sẫm và ẩm hơn | B | Time/CIA, Undark |
| Thảm bom B-52 | B-52D mang 108 quả 500 lb, bay tốp 3, thả từ rất cao nên dưới đất không thấy, không nghe máy bay | B | Wikipedia Arc Light |
| Hố bom trên Đường 9 phía Lào (2/1971) | Hố lớn và mương cắt đường nhiều chỗ; hố bị cỏ rậm và tre che, trinh sát trên không không thấy | A/B | Tướng Hinh; Warfare History Network |
| Chất độc da cam | Lá rụng 3–6 tuần sau khi phun. Vệt phun rõ rộng khoảng 85 m, dài 15 km. Phun hai năm liền thì 50–100 % cây gỗ chết. Còn nhiều thân cây chết đứng | A | Báo cáo thuốc diệt cỏ (kho Agent Orange, USDA/NAL); Westing |
| A Lưới | Bị phun khoảng 1965–1970; ven đường từ Huế vào: sườn đồi trơ trụi phía trước, rừng không bị phun phía sau; sạt lở nhiều | A | Hatfield |
| Thay thế sau phun và cháy | Gần như toàn cỏ; tre tăng; trảng cỏ cháy hằng năm nên không thành rừng lại | A | USDA/NAL, WGBH |
| Napalm | Phun cho lá rụng khô rồi ném napalm đốt lớp lá; rừng ẩm không thành "bão lửa" | A/C | WGBH, GlobalSecurity |
| Trọng điểm | Đồi bị bạt thấp, mặt đường cày xới, cây cháy rụi, "rừng già biến thành đồi trọc"; Cua chữ A còn "hàng trăm hố bom và cồn đất đỏ" | B/C | Báo Lai Châu, Người Quan Sát |
| Đường xe Trường Sơn | Đường đất rộng 5,5 m (18 ft), có đoạn rải sỏi hoặc lát gỗ ngang; có đường tránh vòng qua trọng điểm; có đoạn vách dựng một bên, vực một bên | B/A | Wikipedia, VnExpress, hồi ký lái xe |
| Ngụy trang | Giàn tre dọc đường; "đường kín" trồng cây cho tán kết kín; lùa gia súc đi lại xoá vết xe | B | HistoryNet, Nhân Dân |
| Cầu ngầm | Mặt cầu dưới mặt nước vài cm ("cầu chìm, cầu tàng hình"). Cầu cáp: chạng vạng căng 4 dây cáp, bắc gỗ, xe qua lắc lư, sáng tháo cất | B | Nhân Dân, Pháp Luật |
| Đèn xe | Chạy đêm; trăng sáng thì không bật đèn gầm; qua sông, lên dốc tắt hết đèn vì mặt nước phản chiếu | B | Báo Lai Châu |
| Bếp Hoàng Cầm | Đào vào chân đồi, rãnh khói toả như vòi mực, phủ cành cây và đất ẩm; khói lên như sương sớm, là sát đất rồi tan nhanh | B | Vietnam News |
| Đường 9 năm 1971 | Đường đất một làn, gồ ghề, cầu cống bị phá, vách núi cao phía nam khống chế; lề cao hai bên; chỉ xe xích và jeep đi được; cỏ mọc kín từng đoạn, đá lở lấp một phần | A/B | Tướng Hinh, Wikipedia Lam Son 719 |
| Khe Sanh đầu 1971 | Cao nguyên Xóm Chàm 490 m, đất sét laterit; cỏ cao phủ căn cứ cũ, còn mìn chống tăng; Làng Vây còn xác tăng cháy từ 1968 | A/B | Hồi ký công binh, Wikipedia |
| Trực thăng | Bay rà thấp, gió cánh quạt làm nghiêng ngọn cây; ở cứ điểm 543 máy bay "gầm thét như chuồn chuồn mùa hè" | A | Hồi ức cựu chiến binh |
| Mùi | "Nồng nặc mùi cỏ cháy, mùi thuốc súng" | A | Cựu chiến binh trận Đồi Không Tên |

## 6b. Mẻ 2: Cổng Trời, đường 20, công sự, loài bổ sung

**Phát hiện quan trọng cho M1:** không nguồn nào ghi có "Cổng Trời" trên đường 20 Quyết Thắng. Cổng Trời được nhắc trên tuyến **đường 12 (nay QL12A), Cha Lo, Minh Hóa, Quảng Bình**: "ngã ba Khe Ve vượt Cổng Trời lên Cha Lo đến Khăm Muộn" (B, Báo Pháp luật), khoảng Km 34,5 đường 12A (C). Cảnh: một bên vực, một bên núi cao, rừng tầng tầng lớp lớp, lan rừng bám dày, mây mù quanh năm; bị không kích 1965–1973; có kho trung chuyển, kho xăng, trận địa pháo phòng không (B). Ô DEM hiện tại (17,55°N 106,10°E) nằm ở vùng đường 20, cách Mụ Giạ khoảng 37 km. **Chủ nhà quyết**: giữ toạ độ (cảnh thực chất là đường 20) hay dời ô DEM lên Cha Lo.

| Hạng mục | Giá trị | Tier | Nguồn |
|---|---|---|---|
| Đường 20 Quyết Thắng | Dài 125 km, hơn 40 km xuyên núi đá; Km 0 Phong Nha → dốc Ba Thang → Km 12 Trạ Ang (hang Chỉ huy) → hang Tám Cô Km 16+200 → … → cụm Cà Roòng–ATP Km 63–65 | B | Báo Pháp luật, Tuổi Trẻ, Nhân Dân |
| Vách đường 20 | Một bên vách đá dựng đứng, một bên vực; hang trong vách cải tạo giấu xe; ta-luy đá tai mèo chênh vênh; bom và tên lửa bắn vào vách cho núi sập lấp đường | A/B | Hồi ức lái xe, Báo Pháp luật |
| Ngụy trang đường | Kéo buộc ngọn cây hai bên vào nhau; buộc đá vào cành tre uốn cong thành đường hầm lá; treo giỏ cây ở đoạn trống | B | Báo Pháp luật, Arcadia |
| Ngầm Ta Lê, sông Chà Là | Nước chảy rất xiết; tháng 5/1968 ngầm Ta Lê còn 6 hố bom sâu chưa lấp | B | |
| Cầu ngầm | Gỗ, cát, đất ngay dưới mặt nước; nước giảm sức nổ | B | Wikipedia |
| Hầm chữ A (mẫu phục dựng) | Sâu 1–1,2 m, rộng 1 m, dài 1,5 m, khung tre gỗ ghép chữ A, cửa có thể thông hai đầu | B | |
| Lán | Mái lợp lá trung quân màu vàng như rơm rạ | A | Hồi ức nữ chiến sĩ (SGGP) |
| Trang bị cá nhân | Tăng, võng bạt, mũ cối, mũ tai bèo, quần áo gabađin, AK47; bọc võng bằng vải dù pháo sáng | A | Báo Quốc tế |
| Đêm trên tuyến | Chỉ còn tiếng côn trùng và tiếng hú xa của thú rừng; sức ép bom thổi phần phật ép người vào vách hầm | A | Hồi ức |
| Cầu treo dây rừng | Dài cả trăm mét, ra giữa cầu đung đưa như võng | A/B | |
| Cảm biến "cây nhiệt đới" | Hình dáng và màu như cây nhỏ | A | |
| Mang (hoẵng) | Lưng vàng rám nắng, bụng trắng, mặt và chân nâu sẫm, cao vai 40–65 cm; thấy thú săn mồi thì sủa như chó, có thể liền hơn một giờ | B | ADW |
| Khỉ vàng | Lông nâu hoặc xám, mặt hồng trụi lông, đàn 20–200 con; bị đe doạ sủa chói cao; có ở Bắc Hướng Hóa | B/A | Wikipedia, Frontier |
| Cu li | Đêm, bò chậm, mắt phản quang cam dưới đèn; con cái gọi bằng tiếng huýt to | B/A | |
| Lợn rừng | Hoảng thì khịt "ukh ukh" hoặc rít; lợn con có sọc; để lại vết ủi đất và vũng đầm | B | |
| Gấu ngựa, gấu chó | Gấu ngựa đen có vệt V trắng kem ở ngực; gấu chó để vết cào trên thân cây, ngủ trên cây 2–7 m | B/A | |
| Trĩ sao | Con đực hú to, kéo dài mùa sinh sản; **Bạch Mã tháng 1–2/1990 nghe ít nhất 75 con kêu** (đúng tháng M1); bãi múa là khoảnh được dọn sạch lá rụng | B/A | eBird, BirdLife IBA |
| Kiến vàng | Thợ màu cam, tổ là chùm lá khâu tơ, có tổ dài hơn nửa mét; cắn đau, phun axit formic | B | |
| Đom đóm | Ở VN chủ yếu cuối xuân và mùa hè: tháng 1–3 rất ít | B/C | |
| Bướm | Bạch Mã 361 loài, nhiều ở trảng cỏ, ít trong rừng kín; Phong Nha hơn 250 loài | A | |
| Độ tàn che rừng già | Pù Mát 0,76; Cúc Phương 0,90; Xuân Sơn 0,66; cây cao trung bình 15–17 m | A | |
| Chuối rừng | *Musa balbisiana* có quần thể bản địa miền Trung; *M. acuminata* chiếm nhanh chỗ vừa cháy | A/B | |
| Táu, dẻ, re hương | Táu *Vatica* ưu thế ở Pù Mát; dẻ *Castanopsis* đấu đầy gai; re hương vỏ nâu lục nứt sâu, cả cây mùi long não | A/B | |
| Địa y trên vỏ cây (VN) | Dạng vảy đến dạng lá, xám, hơi vàng hoặc xanh lục nhạt, sũng nước khi ướt | A | Taiwania |

**Bảng ảnh tham chiếu** (mũi G, 75 ảnh, tách thành tài liệu `REFERENCE-PHOTOS.md`): Wikimedia Commons không mở được trong môi trường này, nên ảnh lấy từ picryl (bản sao Commons, NARA, USAF), Flickr USMC Archives (CC BY 2.0), Unsplash, Pexels. 23 ảnh All rights reserved chỉ để xem, không sao chép. Nhóm còn yếu: rễ bạnh, dây leo, dương xỉ thân gỗ chụp tại Trường Sơn; đất bazan đỏ cận cảnh; ngầm thời chiến.

## 7. Mâu thuẫn số liệu thật (giữ nguyên, không chọn hộ)

| Hạng mục | Các giá trị | Ghi chú |
|---|---|---|
| Chiều cao lim xanh | 37–45 m, đường kính 200–250 cm (CIFOR, A) · khoảng 10 m, đôi khi 30 m (Wikipedia EN, B) | Chênh rất lớn |
| Chiều cao tán rừng | 25–35 m, vượt tán 45 m (WWF, rừng nguyên sinh) · vượt tán 20–25 m, tán chính 10–15 m (Bắc Hướng Hóa) | BHH chỉ 8 % là rừng giàu, nên thấp hơn. Chọn theo loại rừng của từng ô map |
| Ranh giới rừng đất thấp và rừng núi | 600 m (BHH) · 800 m (WWF, Phong Nha) · 900 m (Bạch Mã) · 700/1.000 m (C) | |
| Độ sâu hố bom | Hơn 1,5 m (Time, B) · khoảng 4,5 m (lời kể phi công, C) · 0,9 m hố cũ nay (Undark, B, đã bồi) | |
| Tổng số hố bom | 10–15 triệu chỉ miền Nam (Westing, A) · hơn 21 triệu (Time) · 26 triệu toàn Đông Dương (Undark, Scientific American) | |
| Thời gian rụng lá sau phun | 2–3 tuần (C) · 3–6 tuần (USDA/NAL, A) · khô trong 4–6 tuần (C) | |
| Rừng sau khi phun | "Thường tái sinh nhanh" (Time 1972, B) · thành trảng cỏ, 15 năm chưa hồi (Westing, WGBH, A) | |
| Mùa mưa sườn đông | Đông Hà 8–12 · Bắc Hướng Hóa hai mùa 8–11 và 4–8 · Khe Sanh 5–11, đỉnh tháng 10 · USMC "tháng 6 đến 11" | Khác điểm đo và sườn |
| Mùa khô Lào | Giữa tháng 10 đến giữa tháng 3 (Wikipedia) · tháng 11 đến 4 (Nalty) | Đầu 2/1971 vẫn mây thấp, mưa |
| Mưa đỉnh Bạch Mã | 7.977 mm/năm (Sourcebook) · trên 9.900 mm/năm (Tuổi Trẻ) | |
| Lượng mưa năm Khe Sanh | 2.113 mm (Wikipedia) · khoảng 2.030 mm (USMC) · 2.400–2.800 mm (BHH) | |
| Phân loại vượn | Đakrông ghi "vượn đen má hung *Hylobates leucogenys*" (cũ) · Wikipedia: Trung VN là vượn siki, *N. leucogenys* chỉ còn ở bắc | Cụm mơ hồ, cấm gộp |
| Khỉ đuôi lợn | *Macaca nemestrina* (Đakrông) · *M. leonina* (phân loại hiện nay) | |
| Đường 20: thời gian làm, ngày thông | 105 ngày · 127 ngày · "77 ngày đêm"; 5/5/1966 · hai mũi gặp nhau Km 65 ngày 14/4/1966 | Mẻ 2 |
| Đá lấp hang Tám Cô | "hàng trăm tấn" · "hàng ngàn tấn" (cùng Tuổi Trẻ, khác bài) | |
| Độ cao Trạ Ang | "điểm cao 150 m, dài 5 km" · "núi cao 400–600 m" | |
| Lông đuôi trĩ sao | 1,73 m (Wikipedia) · 150 cm (C) | |
| Re hương cao | 10–20 m · tới 50 m (cùng trang Wikipedia) | |
| Lồ ô | *Bambusa procera* (mẻ 1) · *Schizostachyum zollingeri* (DTIC 1974) | |

## 8. Honest-null: đã tìm, chưa có nguồn đạt chuẩn

- **Toạ độ và độ cao Cổng Trời Cha Lo** (mẻ 2 tìm được vị trí theo tuyến, chưa có toạ độ). Không có Cổng Trời nào trên đường 20, đường 15 hay phía Lào trong nguồn đã đọc.
- Hình thái suối nhỏ: bề rộng, nước trong hay đục theo mùa, đá tảng lòng suối, rêu, thác cụ thể. Nguồn chỉ nói chung "streams, springs and waterfalls". **Đây là lỗ hổng lớn nhất cho cảnh "như phim"**, cần ảnh tham chiếu.
- Ngầm thời chiến: độ sâu nước, vật liệu, cọc mốc (chỉ có "vài cm dưới mặt nước"). Ngầm Ta Lê chỉ có tên.
- Độ dày lớp lá rụng (cm) ở Trường Sơn; % độ tàn che và % ánh sáng đo riêng ở Trường Sơn.
- Độ cao rễ bạnh đo ở Trường Sơn; màu vỏ chò chỉ; mô tả táu, re, dẻ; chuối rừng, tre le, loài rêu và địa y cụ thể.
- Kích thước hầm chữ A, lán, hào giao thông, bếp Hoàng Cầm; cầu phao; "đường kéo pháo"; hình dạng đồi 31.
- Mô tả tiếng trĩ sao, âm sắc tiếng mang sủa (xeno-canto chặn công cụ đọc).
- Mẻ 2 đã bù khỉ vàng, cu li, lợn rừng, gấu, bò tót, nhím, trăn, đom đóm, kiến, bướm. Còn thiếu: tiếng sóc chuột, tiếng nhím, kích thước lợn rừng riêng Đông Dương, màu vỏ và rễ bạnh chò chỉ, tên khoa học của "le", rêu và địa y riêng Trường Sơn, độ dày thảm lá rụng ở Trường Sơn, kích thước bếp Hoàng Cầm và hào giao thông, hầm tăng xê.
- Bản ghi âm CC0 của vượn *Nomascus* Trường Sơn, trĩ sao, ve sầu Việt Nam: không tìm thấy.
- Gói Megascans tropical cụ thể trên Fab (trang tìm kiếm Fab chặn công cụ đọc); không gói Fab nào ghi Đông Nam Á.

## 9. Nguồn asset và âm thanh (mũi E, chỉ những gì trang nói)

| Nguồn | Kết luận | Tier |
|---|---|---|
| Fab Standard License | Dùng "với mọi công cụ tương thích, không giới hạn ở Unreal Engine"; được phân phối thương mại dự án có tích hợp asset; cấm bán hoặc phân phối lại asset dạng rời. Bậc Personal và Professional cùng phạm vi quyền, ngưỡng 100.000 USD doanh thu 12 tháng. Bậc Reference-Only (UEFN) không cấp file nguồn | A |
| Megascans | Miễn phí mọi engine tới hết 2024, rồi bán lẻ: từ 0,99 USD một asset, 4,99 USD một kit, 24,99 USD một gói; từ 2025 có gói khởi đầu miễn phí trên 1.500 asset. **Bẫy:** tải qua Bridge theo Epic Content License cũ chỉ được dùng miễn phí trong Unreal. Phải lấy qua thư viện Fab mới áp giấy phép mới | A/B |
| Gói Fab rừng nhiệt đới | Rain Forest Pack (Kaizen, từ 79,99 USD, trên 120 asset photoscan, map mẫu 1 km²) · Tropical Jungle Pack (Kaizen, từ 49,99 USD) · MW Tropical Rainforest Biome (MAWI, từ 324,99 USD) · FANTASTIC Lost Jungle (Tidal Flask, từ 49,99 USD) · Tropical Jungle (Dokyo, 66 asset, thực vật Costa Rica) · Jungle Pack (A. zoOmika) · POLYGON Tropical Jungle (Synty, low-poly). Trang listing ghi định dạng Unreal Engine | A |
| Poly Haven (CC0) | Mossy Rock 8K (đá vân nứt, địa y, mảng rêu) · Forest Leaves 02 8K (rêu gồ, lá rụng, cành nhỏ, khoảng 3 × 3 m) · Brown Mud Rocks 01 (bùn lẫn sỏi, rêu, bờ suối) · Fern 02 (4 khóm dương xỉ, 6.232 polygon) · Anthurium Botany 01 · Pachira Aquatica 01. HDRI Bamboo Tunnel chụp ở Nam Phi, tre khô, **không giống rừng ẩm** | A |
| ambientCG (CC0) | Ghi rõ được đưa file thô vào video game. Ground106 (đất nâu be, lá, bùn, lòng suối) · Ground037 (nền rừng ẩm, rêu, cỏ) | A |
| SpeedTree Library | Chỉ dùng như thành phần nhúng của sản phẩm có tên trong Order Form; bản Cinema không dùng cho game | A |
| Evermotion | Cho phép làm game, nhưng **cấm đặt file tách rời được lên website, máy chủ**: rủi ro lớn với game web tải GLB | A |
| Âm thanh Việt Nam | Echoto "Jungle Adventure Vietnam" có vượn đực hót gần và ve sầu (B). Bộ Echoto trên Artlist: giấy phép Pro loại game ra, phải mua giấy phép doanh nghiệp (A). "Rainforest Ambience Phong Nha Vietnam" (Libby và Marcel): 30 file, 93 phút, 192 kHz/24-bit, 5 USD, ghi "royalty-free" nhưng chưa đọc được văn bản license (B) | A/B |
| Sonniss GDC bundle | Royalty-free, dùng cho game, không cần ghi công, cấm phát hành dạng file rời; gói "Tropical Ambiences" có mưa đêm nhỏ giọt từ lá, suối đêm | A |
| ZapSplat | Đêm rừng Thái Lan (côn trùng, ve, ếch, mưa nhỏ giọt từ tán); bản miễn phí phải ghi công | A/B |
| BOOM Library | Giấy phép một người dùng, không mở rộng cho công ty; gói Tropical Jungle có khỉ rú **châu Mỹ**, sai lục địa | A/B |
| Freesound, xeno-canto, Macaulay | Freesound: CC0 dùng được, Noncommercial thì không. xeno-canto: giấy phép từng bản, nhiều bản phi thương mại. Macaulay: thương mại cần hợp đồng | A/B |

## 10. Đã triển khai vào game (DV-057, 2026-10-09)

1. **Trời tháng 1 theo registry**: mặt trời tính thiên văn từ ngày 20/1/1971, 06:24 giờ UTC+7, toạ độ tâm DEM (mọc 06:29). Preset `m1-jan-dawn`: HDRI sáng sớm sương mù (Poly Haven CC0), tầm nhìn 600 m (registry: dưới 0,8 km), nắng yếu, ánh sáng trời khuếch tán, mưa phùn nhẹ, đất ướt. Preset M2 (sáng, trưa, chiều mù khói) đã có dữ liệu, chưa gắn vào level đêm Điểm cao 31.
2. **Tầng rừng**: vượt tán 20–29 m thưa, không mọc trên sườn dốc và đỉnh; tán chính 11–15 m dày; nền dưới tán thưa; cỏ, chuối rừng, cọ, dương xỉ dày dồn vào khoảng trống tán; ráy ở chỗ trũng. Navmesh và bản đồ giấy bake lại.
3. **Mặt đất CC0**: lá rụng nền rừng, đá phủ rêu, đất đỏ feralit lẫn sỏi (Poly Haven).
4. **Cảnh âm thanh thủ tục**: vượn hót đôi trong cửa sổ [mọc − 12, mọc + 13] phút, hồng hoàng, bìm bịp, gà rừng, tắc kè, ếch khi mưa đêm, mưa phùn, không ve tháng 1; mang và voọc chỉ kêu khi báo động.
5. **Dữ liệu SOT**: `content/ecology/*.json`, mọi con số có ref về registry hoặc khai là thiết kế; script và unit test chặn ref sai.

**Còn chờ Chủ nhà:** chốt vị trí Cổng Trời (giữ đường 20 hay dời ô DEM lên Cha Lo, đường 12); duyệt hình và tiếng trên Mac; quyết mua một gói cây nhiệt đới photoscan trên Fab nếu muốn thân cột thẳng, tán khép kín (cây tán hiện có là mô hình CC-BY dáng cành vặn, giới hạn lớn nhất còn lại về độ thật).

---

## Phụ lục: toàn bộ registry theo thực thể

Mỗi dòng: giá trị [tier·nguồn]. Nhiều giá trị trong một ô được giữ cả, không chọn hộ.

### tang_tan (10)

**Rừng khộp (rừng dầu rụng lá)**
- tên khoa học: Shorea siamensis, S. obtusa, Dipterocarpus obtusifolius, D. tuberculatus [B·ecoregions.worldwildlife.org]
- phân bố: Ở VN: cao nguyên thượng nguồn Sê San và Srêpốk [B·en.wikipedia.org]
- kích thước: Cây thấp 5–8 m, độ che phủ 50–80%, cây vượt tán 10–12 m [B·ecoregions.worldwildlife.org]
- hình thái, màu: Tầng dưới mở, ưu thế cỏ; có thiên tuế [B·ecoregions.worldwildlife.org] · Cây ưu thế có vỏ dày như bần chịu lửa [B·ecoregions.worldwildlife.org]
- mùa, thời tiết: Cháy dưới tán chủ yếu tháng 12–đầu tháng 3; mưa 1.000–1.500 mm, 5–7 tháng khô [B·ecoregions.worldwildlife.org]
- honest-null: độ cao, hành vi, âm thanh, mật độ, license

**Rừng kín thường xanh nhiệt đới đất thấp**
- phân bố: Phong Điền cùng Đakrông còn một trong những diện tích rừng thường xanh đất thấp lớn nhất [A·thiennhienviet.org.vn]
- độ cao: Rừng thường xanh đất thấp dưới 900 m (Bạch Mã) [A·thiennhienviet.org.vn] · Rừng thường xanh đất thấp dưới 600 m (Bắc Hướng Hóa) [A·locjkt.or.id] · Rừng rậm nhiệt đới ẩm lá rộng thường xanh ở dưới 700 m (miền Bắc), 1000 m (miền Nam) [C·luatminhkhue.vn]
- kích thước: Rừng nguyên sinh 3 tầng tán, cao 25–35 m, cây vượt tán đôi khi 45 m [B·ecoregions.worldwildlife.org] · Cây vượt tán cao tới 45 m [B·en.wikipedia.org] · Chiều cao cây trung bình rừng già 15,3–16,6 m (Xuân Sơn, Cúc Phương, Pù Mát) [A·journal.vnuf.edu.vn]
- hình thái, màu: Cây vượt tán lớn nhô trên tán tạo mặt tán gồ ghề [B·ecoregions.worldwildlife.org] · Cấu trúc 3–5 tầng: tầng trội, tầng tán, dưới tán, cây bụi, cỏ quyết [C·luatminhkhue.vn] · Cây gỗ khổng lồ có rễ bạnh, cây cao tới 50 m, có dây leo thân gỗ, tầng tán và tầng dưới tán (Phong Nha) [A·thesalmons.org] · Rừng tốt cấu trúc ổn định, rất ít ánh sáng xuống nền rừng (Bắc Hướng Hóa) [A·locjkt.or.id]
- mật độ, license: Đakrông có diện tích rừng thường xanh đất thấp còn lại lớn nhất miền Trung [A·thiennhienviet.org.vn] · Rừng nguyên sinh chỉ chiếm khoảng 60% diện tích Đakrông [A·thiennhienviet.org.vn] · Độ tàn che rừng già: Pù Mát 0,76; Cúc Phương 0,90; Xuân Sơn 0,66 [A·journal.vnuf.edu.vn]
- honest-null: tên khoa học, hành vi, âm thanh, mùa, thời tiết

**Rừng lùn rêu đỉnh núi**
- độ cao: Pù Mát (Nghệ An): rừng lùn chủ yếu trên 1.500 m [A·ir.xtbg.ac.cn]
- hình thái, màu: Rừng lùn phủ rêu với cây bụi họ Mua, Đỗ quyên (Vaccinium), Chè (Tam Đảo) [A·real.mtak.hu]
- honest-null: tên khoa học, phân bố, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Rừng thường xanh núi thấp (á nhiệt đới)**
- tên khoa học: Họ ưu thế: Sim, Dẻ, Côm, Long não; có họ Kim giao [B·ecoregions.worldwildlife.org]
- độ cao: 800–1.200 m, tán 2 tầng [B·ecoregions.worldwildlife.org] · Bạch Mã: rừng thường xanh núi trên 900 m [A·thiennhienviet.org.vn] · Bắc Hướng Hóa: rừng á nhiệt đới núi trung bình trên 600 m [A·locjkt.or.id] · Bạch Mã: rừng thường xanh đất thấp dưới 900 m, rừng thường xanh núi trên 900 m (vùng 20–1.448 m) [A·thiennhienviet.org.vn]
- kích thước: Tán cao khoảng 15–25 m [B·en.wikipedia.org]
- hình thái, màu: Thung lũng 5 tầng; sườn dốc và đỉnh không có tầng vượt tán, chỉ 4 tầng [A·locjkt.or.id] · Phụ sinh, nhất là phong lan, rất nhiều [B·ecoregions.worldwildlife.org] · Bạch Mã trên 1.000 m: cổ thụ mọc trên tầng rêu dày, mây phủ quanh năm [B·tuoitre.vn]
- mùa, thời tiết: Đỉnh núi cao quanh năm mây phủ [B·tuoitre.vn]
- mật độ, license: Họ Dẻ chiếm tới 60% số cây ở nơi điều kiện ít khắc nghiệt [A·locjkt.or.id]
- honest-null: phân bố, hành vi, âm thanh

**Rừng thứ sinh sau nương rẫy**
- kích thước: Rừng thứ sinh thấp hình thành 8–10 năm sau nương rẫy [A·locjkt.or.id]
- hình thái, màu: Tầng trên là cây ưa sáng mọc từ gốc chồi hoặc hạt [A·locjkt.or.id] · Tầng dưới là dương xỉ, cỏ, gừng, ráy [A·locjkt.or.id] · Rừng thứ sinh rất ít dây leo, ít dương xỉ, thường không có phong lan và dương xỉ trên cây [A·locjkt.or.id]
- mật độ, license: A Lưới: loài ưu thế phần lớn ưa sáng, mọc nhanh, gỗ kém, rừng đang phục hồi [A·csdlkhoahoc.hueuni.edu.vn]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Rừng trên núi đá vôi**
- tên khoa học: Loài phổ biến: Hopea hainanensis, Garcinia fragraeoides, Burretiodendron hsienmu, Chukrasia tabularis [A·thesalmons.org]
- kích thước: Cây cao 10–15 m, đường kính 50 cm, tán thưa hơn [A·locjkt.or.id]
- hình thái, màu: Đất rất mỏng, cây non chỉ mọc trong khe đá, còi [A·thesalmons.org] · Đá vôi gần như phủ kín rừng trừ vách dựng đứng [A·thiennhienviet.org.vn]
- mật độ, license: Phong Nha: ~75% là rừng thường xanh đất thấp trên đá [A·thesalmons.org]
- honest-null: phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Tầng cây bụi**
- kích thước: Cây bụi và cây tái sinh dưới 5 m [A·locjkt.or.id]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Tầng dưới tán**
- kích thước: Cây gỗ nhỏ cao 7–10 m và cây non của các tầng trên [A·locjkt.or.id]
- hình thái, màu: Cây tầng dưới thường có lá to hơn để thích nghi ánh sáng yếu (chung cho rừng mưa) [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Tầng tán chính**
- tên khoa học: Họ ưu thế: Dẻ, Long não, Đậu, Xoan, Bồ hòn [A·locjkt.or.id]
- kích thước: Bắc Hướng Hóa: cây tầng tán chính cao 10–15 m [A·locjkt.or.id]
- hình thái, màu: Chiều cao khá đều, tán tròn, thân 30–40 cm [A·locjkt.or.id]
- honest-null: phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Tầng vượt tán**
- tên khoa học: Loài điển hình: Canarium subulatum, Canarium album (họ Trám Burseraceae) [A·locjkt.or.id]
- kích thước: Bắc Hướng Hóa: cây vượt tán tới 30 m, thường 20–25 m [A·locjkt.or.id] · Thường không quá 20–25 m [A·locjkt.or.id] · Đường kính thân 40–80 cm, cá biệt 120 cm [A·locjkt.or.id] · Rừng mưa nhiệt đới nói chung: vượt tán 45–55 m, hiếm khi 70–80 m (số liệu toàn cầu, không riêng Trường Sơn) [B·en.wikipedia.org] · Đường kính 40–80 cm, có cây tới 120 cm [A·locjkt.or.id]
- mật độ, license: Bắc Hướng Hóa: cây vượt tán ít, chỉ chiếm 15–20% diện tích [A·locjkt.or.id]
- honest-null: phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết


### cay_go (22)

**Bách xanh đá**
- tên khoa học: Calocedrus rupestris [A·thesalmons.org]
- mật độ, license: Khoảng 2.500 cây trên 50 km² đá vôi Phong Nha, tuổi 500–600 năm [A·thesalmons.org]
- honest-null: phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Chi Sao (Hopea)**
- độ cao: Kẻ Gỗ: trên 300 m hệ cây gỗ ưu thế là Hopea [A·thiennhienviet.org.vn]
- mật độ, license: Một loài Hopea cùng Castanopsis hystrix và Madhuca pasquieri ưu thế tán trên [B·ecoregions.worldwildlife.org]
- honest-null: tên khoa học, phân bố, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Chò chỉ**
- tên khoa học: Parashorea chinensis [B·en.wikipedia.org]
- phân bố: Nam Trung Quốc, bắc Lào và Việt Nam [B·en.wikipedia.org]
- kích thước: Cao 40–72 m [B·en.wikipedia.org]
- honest-null: độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Chò nâu**
- độ cao: Rừng núi thường xanh đến nửa rụng lá 800–1.500 m, xuống tới 100 m [A·uses.plantnet-project.org]
- kích thước: Cao tới 48 m; thân tròn thẳng không cành 15–20 m, đường kính tới 150 cm [A·uses.plantnet-project.org]
- hình thái, màu: Vỏ xám, hơi nứt; lá to 16–28 cm [A·uses.plantnet-project.org]
- honest-null: tên khoa học, phân bố, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Chò đen**
- tên khoa học: Parashorea stellata [A·csdlkhoahoc.hueuni.edu.vn]
- phân bố: Rừng kín thường xanh núi thấp A Lưới, tuyến 500–910 m [A·csdlkhoahoc.hueuni.edu.vn]
- mật độ, license: A Lưới (A Roàng): mật độ 89 cây/ha, IVI cao nhất 29,6% [A·csdlkhoahoc.hueuni.edu.vn]
- honest-null: độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Cọ (Livistona saribus)**
- kích thước: Cọ lá quạt dưới tán ở khoảng trống nhỏ, cao tới 20 m [B·ecoregions.worldwildlife.org]
- mật độ, license: Rừng bị khai thác: cọ tăng ưu thế lên tầng trên, xuất hiện Knema erratica [B·ecoregions.worldwildlife.org]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Dẻ (Castanopsis hystrix)**
- phân bố: Đông Dương (gồm Lào, Việt Nam); đất ẩm, hay mọc cùng cây họ Long não [B·en.wikipedia.org]
- kích thước: Cao tới 30 m [B·en.wikipedia.org]
- honest-null: tên khoa học, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Dẻ gai (chi Castanopsis)**
- phân bố: Pù Mát: Castanopsis và Lithocarpus nằm trong các chi nhiều loài; họ Dẻ 4 chi/50 loài [A·ir.xtbg.ac.cn]
- hình thái, màu: Đấu (vỏ bọc hạt) cứng như hạt dẻ gai châu Âu và có gai như hạt dẻ [B·en.wikipedia.org]
- mật độ, license: Khoảng 140 loài; phổ biến trong rừng núi ưu thế bộ Dẻ [B·en.wikipedia.org]
- honest-null: tên khoa học, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết

**Dẻ đá (chi Lithocarpus)**
- phân bố: Bắc Hướng Hóa có Lithocarpus fenestratus và L. haemispherica (VU) [A·locjkt.or.id]
- độ cao: Ưu thế ở vùng cao trên 1.000 m; không chịu được khô hạn theo mùa [B·en.wikipedia.org]
- hình thái, màu: Cây thường xanh, lá dai như da mọc so le; hạt bọc vỏ gỗ cứng, đấu ôm phần gốc quả [B·en.wikipedia.org]
- honest-null: tên khoa học, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Gụ (chi Sindora)**
- kích thước: Cao 20–35 (46) m, đường kính tới 100 (180) cm (mô tả cấp chi) [A·uses.plantnet-project.org]
- hình thái, màu: Vỏ nhẵn mỏng, xám tía sẫm, lốm đốm xanh/nâu/vàng; rụng lá ngắn [A·uses.plantnet-project.org]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Kiền kiền**
- tên khoa học: Hopea pierrei [A·csdlkhoahoc.hueuni.edu.vn]
- độ cao: Rừng mưa thường xanh đất thấp Đông Dương tới khoảng 1.000 m [A·uses.plantnet-project.org]
- kích thước: Cao tới 25 m, đường kính tới 50 cm, thân thường cong vặn [A·uses.plantnet-project.org]
- hình thái, màu: Rễ bạnh mỏng hoặc rễ chống, vỏ nhẵn sẫm có đốm sáng [A·uses.plantnet-project.org]
- honest-null: phân bố, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Lim xanh**
- tên khoa học: Erythrophleum fordii [A·cifor-icraf.org]
- phân bố: Có ở Quảng Bình, Quảng Trị, Nghệ An, Quảng Nam… [A·cifor-icraf.org]
- độ cao: 300–900 m [A·cifor-icraf.org] · Kẻ Gỗ: dưới 300 m ưu thế Michelia, Cinnamomum, Madhuca pasquieri và lim xanh [A·thiennhienviet.org.vn]
- kích thước: Cao 37–45 m, đường kính 200–250 cm (CIFOR) [A·cifor-icraf.org] · Cao khoảng 10 m, đôi khi 30 m (Wikipedia, mâu thuẫn với CIFOR) [B·en.wikipedia.org]
- hình thái, màu: Thân tròn, vỏ nâu sẫm nứt ô vuông, nhiều bì khổng; gốc có bạnh nhỏ [A·cifor-icraf.org] · Gốc có bạnh nhỏ [A·cifor-icraf.org] · Tán lá dày xanh quanh năm, lá kép lông chim 2 lần [A·cifor-icraf.org]
- mùa, thời tiết: Hoa trắng nhỏ nở tháng 3–4; quả đậu dài 15–30 cm chín tháng 12–1, màu nâu đến đen xám [A·cifor-icraf.org]
- honest-null: hành vi, âm thanh, mật độ, license

**Re (Cinnamomum balansae)**
- phân bố: Ghi nhận ở Bắc Hướng Hóa (Quảng Trị), mức VU/EN [A·locjkt.or.id]
- honest-null: tên khoa học, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Re hương**
- tên khoa học: Cinnamomum parthenoxylon (nay Camphora parthenoxylon) [B·en.wikipedia.org]
- kích thước: Cao 10–20 m [B·en.wikipedia.org] · Có thể cao tới 50 m, thân tới 60 cm [B·en.wikipedia.org]
- hình thái, màu: Vỏ nâu lục, nứt sâu, bong thành mảng nhỏ; lá xanh bóng hình bầu dục 7–10 cm có mũi nhọn [B·en.wikipedia.org]
- hành vi, âm thanh: Toàn cây toả mùi long não mạnh [B·en.wikipedia.org]
- mật độ, license: Cực kỳ nguy cấp ở Việt Nam; Bắc Hướng Hóa ghi nhận (CR) [A·locjkt.or.id]
- honest-null: phân bố, độ cao, mùa, thời tiết

**Rễ bạnh**
- kích thước: Có thể cao tới 9 m, lan 30 m trên mặt đất (số liệu chung toàn cầu) [B·en.wikipedia.org]
- hình thái, màu: Rễ bạnh lớn hơn ở phía đối diện hướng tán lệch [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Rừng lá kim núi cao (Pơ mu)**
- độ cao: 1.200–1.800 m, ưu thế Pơ mu Fokienia hodginsii [B·ecoregions.worldwildlife.org]
- kích thước: Pơ mu cao 40–50 m, đường kính 1,5 m [B·ecoregions.worldwildlife.org]
- hình thái, màu: Rừng mát ẩm, phụ sinh rêu/địa y dày, lớp thảm mục dày [B·ecoregions.worldwildlife.org]
- honest-null: tên khoa học, phân bố, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Sao đen**
- tên khoa học: Hopea odorata [A·uses.plantnet-project.org]
- phân bố: Ven suối, đất sâu dưới 600 m; PROSEA ghi phân bố ở NAM Việt Nam [A·uses.plantnet-project.org]
- kích thước: Cao tới 45 m; thân thẳng không cành tới 25 m, đường kính 120 cm, rễ bạnh rõ [A·uses.plantnet-project.org]
- hình thái, màu: Vỏ bong vảy, nâu sẫm [A·uses.plantnet-project.org]
- honest-null: độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Sến mật (Madhuca pasquieri)**
- mật độ, license: Một trong các loài ưu thế tầng cao nhất rừng thường xanh đất thấp Bắc Trung Bộ [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Thông ba lá**
- tên khoa học: Pinus kesiya [B·en.wikipedia.org]
- độ cao: Nơi khô, đất mỏng/đá tới 1.500 m, cao 20–30 m, hay cháy [B·en.wikipedia.org]
- honest-null: phân bố, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Táu (Vatica odorata)**
- tên khoa học: Vatica odorata (phân loài brevipetiolata ở Việt Nam) [B·en.wikipedia.org]
- độ cao: Rừng hỗn giao họ Dầu, tới 1.900 m [B·en.wikipedia.org]
- kích thước: Cây tầng tán cao tới 40 m, đường kính tới 60 cm [B·en.wikipedia.org]
- hình thái, màu: Lá dai như da, hình trứng đến elip, dài tới 16 cm; hoa thơm [B·en.wikipedia.org]
- mật độ, license: Là loài đặc trưng lâm phần rừng già Xuân Sơn (IVI 26,3) [A·journal.vnuf.edu.vn]
- honest-null: phân bố, hành vi, âm thanh, mùa, thời tiết

**Táu (Vatica tonkinensis)**
- tên khoa học: Vatica tonkinensis A.Chev. [A·journal.vnuf.edu.vn]
- mật độ, license: Loài ưu thế lâm phần rừng già Pù Mát (Nghệ An, Bắc Trung Bộ), IVI 41,3 [A·journal.vnuf.edu.vn]
- honest-null: phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Táu (chi Vatica)**
- phân bố: Từ Ấn Độ, nam Trung Quốc qua Đông Dương tới Indonesia, Philippines; 78 loài [B·en.wikipedia.org]
- honest-null: tên khoa học, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license


### cay_bui_tham_tuoi (8)

**Chuối hột rừng (Musa balbisiana)**
- tên khoa học: Musa balbisiana [A·doaj.org]
- phân bố: Có quần thể bản địa ở miền Trung Việt Nam (rìa phía nam vùng phân bố, đa dạng di truyền cao) [A·doaj.org]
- honest-null: độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Chuối rừng (Musa acuminata)**
- phân bố: Bản địa Malesia và phần lớn lục địa Đông Dương [B·en.wikipedia.org]
- hình thái, màu: Thân giả mảnh; lá xanh sẫm có thể có mảng đỏ sẫm; quả nhiều hạt (15–62 hạt/quả) [B·en.wikipedia.org]
- mật độ, license: Chiếm nhanh vùng mới xáo trộn như chỗ vừa cháy rừng [B·en.wikipedia.org]
- honest-null: tên khoa học, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết

**Chuối rừng (chi Musa)**
- độ cao: Bắc Việt Nam: M. itinerans 136–1.331 m, M. acuminata 136–989 m, M. balbisiana 108–981 m [A·link.springer.com]
- mật độ, license: M. itinerans phân bố rộng nhất, mọc thành khóm lớn; một số loài ở chỗ trống ít cạnh tranh ánh sáng [A·link.springer.com]
- honest-null: tên khoa học, phân bố, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Dương xỉ thân gỗ (chi Cyathea)**
- tên khoa học: Cyathea; tên Việt ráng tiên tọa [A·uses.plantnet-project.org]
- phân bố: Dưới tán rừng ẩm, khe suối; vài loài ưa nơi trống, bìa rừng ven đường [A·uses.plantnet-project.org]
- kích thước: Thân cao dưới 5 cm đến 15 (20) m, đường kính 2–24 cm (cấp chi) [A·uses.plantnet-project.org]
- hình thái, màu: Lá xếp hoa thị trên đỉnh thân; cuống to, nhiều gai, gốc tím có vảy [A·uses.plantnet-project.org]
- honest-null: độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Lá nón**
- tên khoa học: Lanonia centralis (trước nhầm là Licuala spinosa) [B·nybg.org]
- phân bố: Thu mẫu ở VQG Bạch Mã, gần Huế [B·nybg.org]
- honest-null: độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Móc, đùng đình (chi Caryota)**
- tên khoa học: Caryota; tên Việt: móc, đùng đình, móc đen [A·uses.plantnet-project.org]
- độ cao: Từ mực nước biển đến khoảng 2.000 m, rừng nguyên sinh và thứ sinh [A·uses.plantnet-project.org]
- kích thước: C. mitis mọc cụm, cao 5–12 m, thân 5–15 cm, lá 2–4 m, quả cam đến đỏ sẫm [A·uses.plantnet-project.org] · Loài thân đơn lớn cao 10–25 m, thân 20–45 cm (C. rumphiana) [A·uses.plantnet-project.org]
- hình thái, màu: Lá kép lông chim 2 lần, lá chét hình nêm xéo (đuôi cá) [A·uses.plantnet-project.org]
- honest-null: phân bố, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Ráy (Alocasia odora)**
- kích thước: Cao 0,5–1,6 m, cuống lá 0,3–1 m [B·en.wikipedia.org]
- hình thái, màu: Lá to hình mũi giáo/giọt nước [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Tầng thảm tươi**
- hình thái, màu: Dương xỉ và cây thân thảo: Ráy, Gừng, Lá dong, Gai, Thài lài, Cỏ [A·locjkt.or.id]
- mật độ, license: Rừng chưa bị tác động: tầng dưới thưa vì tán dày ít ánh sáng xuống đất [B·ecoregions.worldwildlife.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết


### day_leo_bieu_sinh (7)

**Dây leo thân gỗ**
- kích thước: Nhiều dây leo lớn dài tới 30 m, đường kính 10 cm [A·locjkt.or.id]
- mật độ, license: Rừng thứ sinh rất ít dây leo, không có phong lan và dương xỉ thân gỗ [A·locjkt.or.id]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Dương xỉ tổ chim**
- tên khoa học: Asplenium nidus [A·apps.lucidcentral.org]
- kích thước: Lá đơn dài 90–125 cm, rộng 8,5–15 cm, xanh bóng [A·apps.lucidcentral.org]
- hình thái, màu: Lá xếp hoa thị như cái tổ hứng nước mưa và rác lá [A·apps.lucidcentral.org]
- honest-null: phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Phong lan**
- mật độ, license: Phong Nha: họ Lan 24 loài, có hài Paphiopedilum dianthum [A·thesalmons.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Rêu và địa tiền biểu sinh**
- độ cao: Rừng mưa núi 1.015–1.185 m và rừng lùn phủ rêu trên đỉnh (Tam Đảo) [A·real.mtak.hu]
- hình thái, màu: Địa tiền dán sát mặt lá cây bụi và dứa dại; dọc suối nhỏ rất nhiều rêu [A·real.mtak.hu]
- mật độ, license: Tam Đảo: 38 loài địa tiền mọc trên mặt lá; rừng ẩm nguyên vẹn giàu rêu (dữ liệu miền Bắc) [A·real.mtak.hu]
- honest-null: tên khoa học, phân bố, kích thước, hành vi, âm thanh, mùa, thời tiết

**Song mây (chi Calamus)**
- độ cao: Sườn dốc rừng mưa đất thấp 500–800 m [A·palms.org]
- kích thước: Thân leo dài tới 70 m, đường kính 4–5,5 cm (loài mới ở VN) [A·palms.org]
- hình thái, màu: Gai xanh chĩa xuống dài tới 1 cm; roi leo dài tới 5 m [A·palms.org] · Roi (flagellum) dài tới 5 m [A·palms.org]
- mật độ, license: 18 loài Calamus ở Việt Nam (Evans et al.) [A·palms.org]
- honest-null: tên khoa học, phân bố, hành vi, âm thanh, mùa, thời tiết

**Đa, si, sung (chi Ficus) và cây bóp cổ**
- tên khoa học: Loài bóp cổ châu Á: Ficus altissima, F. benjamina, F. microcarpa, F. virens… [B·en.wikipedia.org]
- phân bố: Thung lũng ẩm Bắc Hướng Hóa có Ficus, Moraceae, dương xỉ thân gỗ [A·locjkt.or.id] · Ficus mọc trên vách đá vôi trơ [A·locjkt.or.id]
- hình thái, màu: Hạt nảy mầm trên cây chủ, rễ buông xuống ôm lấy thân cây chủ [B·en.wikipedia.org] · Cây chủ chết mục, cây đa thành cột rỗng ruột [B·en.wikipedia.org]
- honest-null: độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Địa y**
- phân bố: Mẫu thu trên vỏ cây phơi sáng, cành cây trong rừng thứ sinh và rừng lá rộng thường xanh (Lâm Đồng, TP.HCM) [A·taiwania.ntu.edu.tw]
- hình thái, màu: Tản dạng vảy bám (crustose) đến dạng lá; màu xám, hơi vàng hoặc xanh lục nhạt [A·taiwania.ntu.edu.tw] · Có loài dạng lá nhăn, sũng nước khi ướt, màu xám [A·taiwania.ntu.edu.tw]
- mật độ, license: Việt Nam đã ghi nhận 275 loài, ước tổng khoảng 1.000 loài [A·taiwania.ntu.edu.tw]
- honest-null: tên khoa học, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết


### tre_nua_co (10)

**Chít (Thysanolaena latifolia)**
- phân bố: Đồi dốc, bờ cát sông, bờ khe ẩm [B·en.wikipedia.org]
- hình thái, màu: Mọc thành bụi; bông chín xanh nhạt hoặc đỏ, thu hái tháng 1–3 [B·en.wikipedia.org]
- honest-null: tên khoa học, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Cỏ tranh**
- tên khoa học: Imperata cylindrica [B·ecoregions.worldwildlife.org]
- kích thước: Thân 0,1–1,2 m, có khi 3 m; lá dài 10–180 cm [A·uses.plantnet-project.org]
- hình thái, màu: Lá già mép cứng sắc cứa tay, gân giữa trắng [A·uses.plantnet-project.org] · Bông có túm lông tơ trắng dài tới 2,5 cm [A·uses.plantnet-project.org]
- mật độ, license: Lửa đốt thúc đẩy thành thảm gần như thuần loài [A·uses.plantnet-project.org]
- honest-null: phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Lách (Saccharum spontaneum)**
- phân bố: Bụi lớn ven sông, mương, tới 1.700 m [A·uses.plantnet-project.org]
- kích thước: Thân 1–4 m hoặc hơn; bẹ lá thường tím [A·uses.plantnet-project.org]
- honest-null: tên khoa học, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Lồ ô (Bambusa procera)**
- tên khoa học: Báo cáo 1974 gọi 'Lo-o' là Schizostachyum zollingeri (khác tên khoa học mẻ 1) [A·apps.dtic.mil]
- phân bố: Campuchia và Việt Nam [B·en.wikipedia.org]
- kích thước: Cao 8–12 m, lóng dài tới 55 cm, đường kính 5,5 cm, vách mỏng [B·en.wikipedia.org]
- honest-null: độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Nứa (Neohouzeaua dulloa)**
- độ cao: Mọc hoang trong rừng thường xanh 300–700 m [A·uses.plantnet-project.org]
- kích thước: Thân cao 7–9 m, mảnh, vách mỏng, đường kính tới 1 cm, lóng 40–60 cm [A·uses.plantnet-project.org]
- hình thái, màu: Cụm thưa, thân đứng hoặc ngả dựa cây bên cạnh [A·uses.plantnet-project.org]
- honest-null: tên khoa học, phân bố, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Tre chi Oxytenanthera**
- tên khoa học: Nay xếp vào chi Gigantochloa [A·vjs.vjs.ac.vn]
- phân bố: Mẫu chuẩn O. polanei thu ở Quảng Trị (Poilane 1920); mẫu khác ở Paka, Quảng Trị [A·vjfs.vafs.gov.vn]
- mật độ, license: O. dinhensis là loài phổ biến nhất của chi trong vùng khảo sát 1974 [A·apps.dtic.mil]
- honest-null: độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Tre gai (Bambusa blumeana)**
- phân bố: Ở VN là cây trồng; mọc hoang dưới 300 m ven sông suối [A·prosea-bamboos.linnaeus.naturalis.nl]
- kích thước: Thân cao 15–25 m, đường kính tới 20 cm, bụi 10–40 cây [A·prosea-bamboos.linnaeus.naturalis.nl] · Ở bìa rừng đất tốt, khóm lớn rõ ràng, thân tới 75 ft (~23 m) (báo cáo 1974, miền Nam VN) [A·apps.dtic.mil]
- hình thái, màu: Cành gốc có gai đan thành bờ rào dày cao 2–3 m [A·prosea-bamboos.linnaeus.naturalis.nl]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Tre núi Arundinaria peteloti**
- độ cao: Đất thoái hóa 700–1.200 m [A·locjkt.or.id]
- kích thước: Cao 3–5 m, mọc dày đặc [A·locjkt.or.id]
- honest-null: tên khoa học, phân bố, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Tre nứa sau xáo trộn**
- hình thái, màu: Có loài mọc thành bụi không rõ ranh giới, thấp; có loài thành khóm lớn [A·apps.dtic.mil]
- mật độ, license: Bụi tre Chimonobambusa, Dendrocalamus mọc ở nơi bị xáo trộn [B·en.wikipedia.org] · Bão mở tán thường xuyên thúc đẩy tre phát triển [B·ecoregions.worldwildlife.org] · Miền Nam VN (1974): ước 1,4 triệu acre tre đã chiếm ưu thế; rừng thứ sinh thành 'biển tre' kéo dài cả thế kỷ [A·apps.dtic.mil] · Tán rừng bị mở làm tre tăng; cháy theo mùa cản cây gỗ tái sinh [A·apps.dtic.mil]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết

**Trảng cỏ cây bụi thứ sinh**
- tên khoa học: Sim Rhodomyrtus tomentosa, mua Melastoma candidum, cỏ tranh Imperata cylindrica [A·thiennhienviet.org.vn] · Cỏ ưu thế: Miscanthus floridulus, Thysanolaena maxima, Saccharum spontaneum, Imperata cylindrica, I. conferta [A·locjkt.or.id]
- hình thái, màu: Đỉnh núi đất mỏng, nắng gió: chỉ 3 tầng, ưu thế họ Hòa thảo [A·locjkt.or.id]
- mật độ, license: Phục hồi chậm vì bị đốt định kỳ [A·thiennhienviet.org.vn] · Đakrông bị cô lập bởi đất nông nghiệp, cây bụi, trảng cỏ rộng [A·thiennhienviet.org.vn]
- honest-null: phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết


### dat_tham_la (8)

**Bãi lầy Khe Ve**
- kích thước: Phuy xăng 200 lít, 4 chiến sĩ khiêng qua bãi lầy [B·special.nhandan.vn]
- hình thái, màu: Trời mưa cả vùng Khe Ve thành bãi lầy, phải lội bùn [B·special.nhandan.vn]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Lớp lá rụng nền rừng nhiệt đới**
- kích thước: Đồng Nai (rừng kín thường xanh): độ dày thảm khô rừng giàu 21,3 cm, trung bình 38,3 cm, nghèo 59,0 cm (số liệu bảng, cần đối chiếu đơn vị) [A·journal.vnuf.edu.vn] · Panama và Peru: độ dày lá rụng chênh 16 lần giữa 28 lâm phần; dày hơn trên đất cát [A·repository.si.edu]
- hình thái, màu: Lá rụng phân huỷ nhanh do nóng ẩm, mùn không tích tụ dày (mô tả chung rừng nhiệt đới) [B·en.wikipedia.org]
- mật độ, license: Thảm khô dày nhất ở rừng nghèo, mỏng nhất ở rừng giàu [A·journal.vnuf.edu.vn]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Đất feralit vàng nhiều cát**
- hình thái, màu: Vàng nhạt, nhiều cát, thô ráp [A·locjkt.or.id]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Đất feralit vàng nâu trên đá phiến mica**
- phân bố: Đồi và núi thấp Bắc Hướng Hóa [A·locjkt.or.id]
- hình thái, màu: Vàng nâu, phong hoá từ đá phiến mica, mặt mịn như lụa [A·locjkt.or.id]
- honest-null: tên khoa học, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Đất feralit đỏ vàng mùn**
- phân bố: Núi nhỏ và trung bình [A·locjkt.or.id]
- hình thái, màu: Đỏ vàng, mịn, nhiều chất hữu cơ hơn [A·locjkt.or.id]
- honest-null: tên khoa học, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Đất trên đồi quanh Khe Sanh**
- hình thái, màu: Đất pha cát, nhiều đá, tầng mỏng, khó đào [A·usmcu.edu]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Đất đỏ bazan Khe Sanh**
- phân bố: Triền đất đỏ bazan ở Khe Sanh, Hướng Phùng, Tân Lập, A Dơi [B·vietnamplus.vn]
- hình thái, màu: Sét đỏ nâu phong hoá sâu lẫn bazan [A·usmcu.edu] · Đỏ đến mức mọi thứ (quần áo, lều, xe) đều nhuốm đỏ [A·usmcu.edu] · Khi mưa sét đỏ trơn như băng [A·usmcu.edu] · Khi khô thành bụi mịn như phấn bay mù không khí [A·usmcu.edu] · Sét laterit hoặc đá sắt/nhôm phong hoá [B·en.wikipedia.org]
- honest-null: tên khoa học, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Đất đỏ nhiệt đới (mô tả chung)**
- hình thái, màu: Màu đỏ do nóng ẩm (mô tả chung, không riêng Trường Sơn) [B·en.wikipedia.org] · Đất rừng mưa thường mỏng, bị rửa trôi khoáng [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license


### da_dia_chat (10)

**Dãy Trường Sơn**
- phân bố: Phần lớn đỉnh nằm phía Lào [B·en.wikipedia.org]
- hình thái, màu: Sườn đông dốc đứng lên từ đồng bằng, nhiều sông ngắn [B·en.wikipedia.org] · Sườn tây (Lào) thoải hơn, tạo cao nguyên rồi xuống sông Mê Kông [B·en.wikipedia.org]
- honest-null: tên khoa học, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Núi đá vôi Bắc Hướng Hóa**
- độ cao: Đỉnh đá vôi Sa Mu 1.550 m, núi Voi Mẹp 1.771 m [A·locjkt.or.id]
- hình thái, màu: Tầng đất rất mỏng trên đồi đá vôi [A·locjkt.or.id]
- honest-null: tên khoa học, phân bố, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Thung lũng A Lưới (A Sầu)**
- phân bố: 65 km tây Huế, sát biên giới Lào, thuộc đường Hồ Chí Minh [A·hatfieldgroup.com]
- độ cao: Hai dãy núi hai bên cao 900–1.800 m [B·en.wikipedia.org]
- kích thước: Dài 40 km theo hướng bắc – nam [B·en.wikipedia.org] · Đáy phẳng rộng 1,5 km, phủ cỏ voi cao [B·en.wikipedia.org]
- hình thái, màu: Ven đường từ Huế vào: sườn đồi trơ trụi [A·hatfieldgroup.com] · Còn dấu vết đường băng cũ ở căn cứ A So, Tà Bạt [A·hatfieldgroup.com]
- honest-null: tên khoa học, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Thung lũng Sê Pôn**
- phân bố: Bắt đầu ngay phía tây Khe Sanh [B·en.wikipedia.org]
- độ cao: Sê Pôn (Tchepone) ở độ cao 170 m [B·en.wikipedia.org]
- kích thước: Lòng máng rộng 3,5–5 km giữa hai dãy núi cao [B·en.wikipedia.org]
- hình thái, màu: Vùng đồi núi gãy khúc, phủ rừng [B·en.wikipedia.org] · Vùng bằng có bụi rậm xen mảng rừng, có đồi cao phía bắc [B·en.wikipedia.org]
- mùa, thời tiết: Mùa mưa tháng 7–9, 410–510 mm/tháng [B·en.wikipedia.org] · Mùa khô Lào từ tháng 10 đến tháng 3 [B·en.wikipedia.org] · Mùa mưa bắt đầu đầu tháng 5 [B·en.wikipedia.org] · Mưa trung bình năm 1.890 mm [B·en.wikipedia.org]
- honest-null: tên khoa học, hành vi, âm thanh, mật độ, license

**Đá granit Bạch Mã**
- độ cao: Đỉnh Bạch Mã 1.448 m [A·thiennhienviet.org.vn]
- hình thái, màu: Địa hình dốc, hiểm trở, bị nước mặt chia cắt mạnh [A·thiennhienviet.org.vn]
- mùa, thời tiết: Mưa năm ở đỉnh Bạch Mã 7.977 mm [A·thiennhienviet.org.vn] · Mưa đỉnh Bạch Mã hơn 9.900 mm/năm; toàn vùng 3.440 mm [B·tuoitre.vn]
- honest-null: tên khoa học, phân bố, kích thước, hành vi, âm thanh, mật độ, license

**Đá tai mèo**
- hình thái, màu: Mỏm đá tai mèo nhọn trên tuyến đường ống Trường Sơn, phải ghép cây làm cầu vượt [B·special.nhandan.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Đá vôi karst Phong Nha – Kẻ Bàng – Hin Nam No**
- phân bố: Vắt qua biên giới Việt Nam – Lào [A·whc.unesco.org]
- độ cao: Đỉnh Co Preu 1.213 m, Co Rilata 1.128 m [B·en.wikipedia.org]
- kích thước: Hơn 220 km hang và sông ngầm đã khảo sát [A·whc.unesco.org] · Vùng không karst chia cắt sâu, độ dốc 25–30° [B·en.wikipedia.org] · Đường 20 có hơn 40 km xuyên núi đá [B·baophapluat.vn]
- hình thái, màu: Vách đá dựng, hố sụt sâu, mạng sông ngầm [A·whc.unesco.org] · Đá vôi xen kẹp đá phiến sét, sa thạch và granit [A·whc.unesco.org] · Cây con chỉ mọc trong hốc, khe đá vôi có đất tích tụ [B·en.wikipedia.org]
- mùa, thời tiết: Mưa năm khoảng 2.000–2.500 mm [B·en.wikipedia.org] · 88% lượng mưa rơi tháng 7–12 [B·en.wikipedia.org] · Tháng 12–2 lạnh nhất, trung bình 18°C [B·en.wikipedia.org]
- honest-null: tên khoa học, hành vi, âm thanh, mật độ, license

**Địa hình Bắc Hướng Hóa**
- độ cao: Từ 150 đến 1.700 m [A·en.nbca.gov.vn]
- kích thước: Sườn phía Quảng Bình dốc 15–25°, có chỗ dốc hơn [A·locjkt.or.id]
- mùa, thời tiết: Mưa lớn trên sườn bất ổn gây sạt lở thường xuyên [A·locjkt.or.id]
- honest-null: tên khoa học, phân bố, hình thái, màu, hành vi, âm thanh, mật độ, license

**Địa hình quanh Khe Sanh**
- độ cao: Núi Động Tri 1.015 m, đỉnh cao nhất khu vực [A·usmcu.edu] · Căn cứ Khe Sanh ở 490 m [B·en.wikipedia.org]
- kích thước: Rừng 2–3 tầng tán cao 18–27 m (60–90 ft) [A·usmcu.edu]
- hình thái, màu: Đồi dốc, thung lũng, rừng nhiều tầng, cây bụi rậm [A·usmcu.edu] · Đồi 861: chỏm trọc đầy hố bom, rộng 50–60 m ở đỉnh [A·usmcu.edu]
- honest-null: tên khoa học, phân bố, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Địa hình Đakrông**
- độ cao: Đỉnh Động Ba Le 1.102 m; phần lớn dưới 500 m [A·thiennhienviet.org.vn]
- hình thái, màu: Núi thấp, chia cắt mạnh, độ dốc khá lớn [A·en.nbca.gov.vn]
- honest-null: tên khoa học, phân bố, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license


### suoi_nuoc (10)

**Lũ quét**
- phân bố: Vùng núi, trung du Quảng Trị [B·vietnamplus.vn]
- honest-null: tên khoa học, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Ngầm tràn**
- mùa, thời tiết: Nguy hiểm khi nước dâng hoặc chảy xiết, cấm qua [B·vietnamplus.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mật độ, license

**Suối vùng Khe Sanh**
- mùa, thời tiết: Lội qua được mùa khô, không qua được sau mưa lớn [A·usmcu.edu]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mật độ, license

**Sông Bến Hải**
- phân bố: Đoạn trên núi gọi là Rào Thanh [B·en.wikipedia.org]
- kích thước: Dài khoảng 100 km, chỗ rộng nhất khoảng 200 m [B·en.wikipedia.org]
- honest-null: tên khoa học, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Sông Rào Quán**
- hình thái, màu: Chảy hướng tây bắc – đông nam, phía bắc căn cứ Khe Sanh [A·usmcu.edu]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Sông Sê Băng Hiêng**
- kích thước: Rộng 30 m nhưng phần lớn năm chỉ sâu 1 m [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Sông Sê Pôn**
- hình thái, màu: Bờ sông dốc đứng [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Sông Thạch Hãn**
- phân bố: Nhánh Rào Quán bắt nguồn từ núi phía bắc Khe Sanh [B·en.wikipedia.org]
- kích thước: Dài 170 km (hộp thông tin) [B·en.wikipedia.org] · Dài khoảng 270 km (thân bài) [B·en.wikipedia.org]
- honest-null: tên khoa học, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Sông suối vùng Bắc Hướng Hóa**
- hình thái, màu: Sông ngắn, dốc, chảy về phía đông, đông bắc [A·locjkt.or.id]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Sông Đakrông**
- mùa, thời tiết: Mưa lớn gây lũ quét và xói mòn mạnh [A·thiennhienviet.org.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mật độ, license


### khi_hau_anh_sang (12)

**Gió Tây khô nóng (gió Lào)**
- mùa, thời tiết: Ở Bắc Hướng Hóa thổi tháng 3–6 [A·locjkt.or.id] · Tháng 6–7 nhiệt độ trung bình 29°C, thường lên 39°C khi gió phơn thổi [A·locjkt.or.id] · Tháng 6–7 gió phơn làm độ ẩm có lúc dưới 30% [A·locjkt.or.id]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mật độ, license

**Giờ mặt trời mọc lặn Huế tháng 1–3**
- mùa, thời tiết: Tháng 1: mọc 6:22, lặn 17:37, ngày dài 11h15 (giờ UTC+7 hiện nay) [C·solarwatch.app] · Tháng 2: mọc 6:17, lặn 17:53, ngày dài 11h36 [C·solarwatch.app] · Tháng 3: mọc 5:59, lặn 18:00, ngày dài 12h01 [C·solarwatch.app]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mật độ, license

**Khí hậu Bắc Hướng Hóa**
- mùa, thời tiết: Mưa năm 2.400–2.800 mm [A·locjkt.or.id] · Tháng 2–3 mưa nhẹ; tháng 12–1 khô nhất [A·locjkt.or.id] · Tháng 12–1 lạnh nhất ~20°C, có khi 15°C trên 500 m [A·locjkt.or.id] · Gió Lào (Phơn) khô nóng tháng 3–6; tháng 6–7 có thể 39°C, độ ẩm dưới 30% [A·locjkt.or.id] · Lượng mưa năm 2.400–2.800 mm [A·locjkt.or.id] · Tháng 12–1 ở nơi trên 500 m nhiệt độ có lúc xuống 15°C [A·locjkt.or.id] · Tháng 2 nhiều mây nhất, trung bình 2,3 giờ nắng/ngày [A·locjkt.or.id] · Mùa ẩm tháng 8–5, độ ẩm 85–90% [A·locjkt.or.id]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mật độ, license

**Khí hậu Khe Sanh**
- độ cao: Trạm khí hậu Khe Sanh ở 367 m [B·en.wikipedia.org]
- mùa, thời tiết: Nhiệt độ tối đa trung bình T1 22,1°C, T2 23,9°C, T3 27,5°C [B·en.wikipedia.org] · Nhiệt độ tối thiểu trung bình T1 15,8°C, T2 16,6°C, T3 18,6°C [B·en.wikipedia.org] · Thấp kỷ lục T1 8,2°C, T2 9,2°C, T3 8,6°C [B·en.wikipedia.org] · Mưa T1 18,4 mm, T2 18,4 mm, T3 38,4 mm (mùa khô) [B·en.wikipedia.org] · Mưa T7–T12: 223,0 / 283,2 / 376,6 / 456,8 / 197,3 / 62,8 mm; cả năm 2.113,1 mm [B·en.wikipedia.org] · Số ngày mưa T1 10,0; T2 7,4; T3 8,3 [B·en.wikipedia.org] · Độ ẩm T1 90,2%, T2 89,7%, T3 86,0% [B·en.wikipedia.org] · Giờ nắng T1 125,2; T2 124,6; T3 164,5 [B·en.wikipedia.org] · Biên độ nhiệt ngày đêm khoảng 7–9°C [B·vietnamplus.vn]
- honest-null: tên khoa học, phân bố, kích thước, hình thái, màu, hành vi, âm thanh, mật độ, license

**Khí hậu Phong Nha – Kẻ Bàng**
- mùa, thời tiết: 2.000–2.500 mm/năm, 88% rơi tháng 7–12, mưa trên 160 ngày/năm [A·thesalmons.org] · Tháng 12–2 lạnh nhất TB 18°C; tối thấp 6°C [A·thesalmons.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mật độ, license

**Khí hậu Đông Hà**
- mùa, thời tiết: Mùa mưa tháng 8–12 do gió mùa đông bắc, đỉnh tháng 10 [B·en.wikipedia.org] · Mùa khô tháng 1–7, có đỉnh mưa phụ tháng 5 [B·en.wikipedia.org] · Mưa T1 52,9 mm, T2 32,0 mm, T3 35,2 mm [B·en.wikipedia.org] · Giờ nắng T1 95,3; T2 88,9; T3 123,4 [B·en.wikipedia.org] · Số ngày mưa T1 14,0; T2 11,4; T3 11,3 [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mật độ, license

**Múi giờ Việt Nam 1971**
- phân bố: Miền Nam (VNCH) dùng UTC+8 từ 1/1/1960 đến 12/6/1975 [B·en.wikipedia.org] · Miền Bắc dùng UTC+7 từ 1/1/1968 [B·en.wikipedia.org]
- honest-null: tên khoa học, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Mưa Quảng Trị – Huế**
- mùa, thời tiết: Quảng Trị khoảng 2.500 mm/năm, đỉnh mưa tháng 10–11 [B·ecoregions.worldwildlife.org] · Mùa mưa rõ từ tháng 9 đến tháng 1; không tháng nào dưới 60 mm [B·ecoregions.worldwildlife.org] · Huế khoảng 3.000 mm/năm [B·ecoregions.worldwildlife.org] · Đỉnh Bạch Mã 7.977 mm/năm, có lẽ nơi mưa nhiều nhất VN [A·thiennhienviet.org.vn] · Toàn vùng Bạch Mã bình quân 3.440 mm/năm (mâu thuẫn số với đỉnh 7.977 mm vì khác điểm đo) [B·tuoitre.vn] · A Lưới 3.400–3.800 mm/năm, nhiệt độ TB 22–24,5°C [A·csdlkhoahoc.hueuni.edu.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mật độ, license

**Mưa phùn**
- mùa, thời tiết: Ở Khe Sanh mưa phùn và sương lăn từ núi xuống, kéo đến gần trưa hôm sau mới tan [A·usmcu.edu]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mật độ, license

**Sương mù và mây thấp Khe Sanh**
- mùa, thời tiết: Mùa gió đông bắc: mây thấp, trời u ám, sương dày [A·usmcu.edu] · Trần mây xuống tới khoảng 150 m (500 ft), tầm nhìn dưới 0,8 km [A·usmcu.edu] · Mỗi đợt kéo dài 3–5 ngày [A·usmcu.edu] · Mây thấp và sương bao phủ từ sáng sớm đến khoảng trưa [B·en.wikipedia.org] · Thời tiết quang hơn vào tháng 3 [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mật độ, license

**Thời tiết Nam Lào tháng 2–3/1971**
- kích thước: Trần mây 2.500 ft ở đồng bằng chỉ cho bay ở 1.000 ft trên vùng tác chiến [A·apps.dtic.mil]
- hình thái, màu: Bụi Khe Sanh dữ dội, mất kính bảo hộ thì như bị phun cát vào mắt [A·thedaysforward.com]
- mùa, thời tiết: Sáng sớm sương mặt đất, trần mây thấp, tầm nhìn 0–2 dặm; trưa khá quang [A·catkillers.org] · Chiều muộn và chập tối mù khói, tầm nhìn dưới 3 dặm [A·catkillers.org] · Chỉ thuận lợi cho không quân từ 10–12 giờ đến giữa chiều; buổi sáng mây và mù [A·apps.dtic.mil] · Ngày 4–5/2/1971 mây thấp xen mưa làm hoãn đổ quân [A·apps.dtic.mil] · Khói, bụi, mù che tầm nhìn máy bay trinh sát FAC (bay trên 4.000 ft) [B·warfarehistorynetwork.com] · Bầu trời xám, mây thấp trên miền đông Lào [B·warfarehistorynetwork.com] · Mưa lớn hạn chế hoạt động không quân [B·en.wikipedia.org] · Đất laterit còn rất ẩm vì gió mùa vừa dứt; sau đó khô và bụi kinh khủng (Khe Sanh) [A·thedaysforward.com] · Thời tiết xấu huỷ đổ quân ngày thứ hai, cản không kích; Khe Sanh có lúc bị cấm bay [A·ac119gunships.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mật độ, license

**Ánh sáng nền rừng nhiệt đới**
- hình thái, màu: Xa bờ suối và khoảng trống, nền rừng khá trống cây [B·en.wikipedia.org] · Nền rừng tương đối quang, ít cây bụi do thiếu sáng [B·en.wikipedia.org]
- mật độ, license: Nền rừng mưa nhận khoảng 2% ánh nắng; tầng dưới tán khoảng 5% (số liệu chung rừng mưa) [B·en.wikipedia.org] · Khoảng 5% ánh nắng xuyên tán tới tầng dưới [B·en.wikipedia.org] · Nền rừng nhận khoảng 2% ánh sáng mặt trời [B·en.wikipedia.org] · Khoảng 5% ánh sáng tới tầng dưới tán [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết


### linh_truong (13)

**Cu li lớn**
- tên khoa học: Nycticebus bengalensis (khảo sát Bắc Hướng Hóa ghi theo tên cũ Nycticebus coucang) [A·locjkt.or.id]
- phân bố: Ghi nhận ở Bắc Hướng Hóa (Quảng Trị) [A·locjkt.or.id] · Có ở 24 khu bảo tồn Việt Nam và 14 khu bảo tồn Lào [B·en.wikipedia.org]
- kích thước: Dài 26–38 cm, nặng 1–2,1 kg [B·en.wikipedia.org]
- hình thái, màu: Lông dày như len, lưng nâu xám, bụng trắng; cẳng tay và bàn tay gần trắng [B·en.wikipedia.org] · Mắt phản quang màu cam sáng dưới đèn [B·en.wikipedia.org]
- hành vi, âm thanh: Hoạt động đêm, sống trên cây, ở cả rừng thường xanh và rụng lá [B·en.wikipedia.org] · Con cái động dục gọi con đực bằng tiếng huýt to [B·en.wikipedia.org]
- mật độ, license: IUCN xếp Nguy cấp (EN), đánh giá 2020 [B·en.wikipedia.org]
- honest-null: độ cao, mùa, thời tiết

**Cu li nhỏ**
- tên khoa học: Nycticebus pygmaeus [A·locjkt.or.id]
- phân bố: Ghi nhận ở Bắc Hướng Hóa; phân bố phía đông sông Mê Kông (Việt Nam, Lào, đông Campuchia, Trung Quốc) [B·en.wikipedia.org]
- kích thước: Dài khoảng 19–23 cm, đuôi rất ngắn, nặng khoảng 450 g [B·en.wikipedia.org]
- hình thái, màu: Vòng quanh mắt nâu sẫm, sọc trắng từ mũi lên trán, hai bên sườn vàng nhạt hơn lưng [B·en.wikipedia.org]
- hành vi, âm thanh: Hoạt động đêm, bò chậm trên cành, không nhảy; ít hoạt động đêm lạnh có trăng [B·en.wikipedia.org] · Tiếng kêu gồm tiếng huýt ngắn và tiếng gọi mẹ con [B·en.wikipedia.org]
- honest-null: độ cao, mùa, thời tiết, mật độ, license

**Khỉ mặt đỏ**
- tên khoa học: Macaca arctoides [A·thiennhienviet.org.vn]
- kích thước: đuôi cụt 32–69 mm; đực 51,7–65 cm, 9,7–10,2 kg [B·en.wikipedia.org]
- hình thái, màu: lông dài dày, xám/nâu/đỏ/đen; mặt hồng-đỏ, già thì sẫm nâu-đen, rụng lông [B·en.wikipedia.org]
- honest-null: phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Khỉ vàng**
- tên khoa học: Macaca mulatta [A·locjkt.or.id]
- phân bố: Có trong danh lục thú Khu BTTN Bắc Hướng Hóa (Quảng Trị) [A·locjkt.or.id] · Phân loài Đông Dương có ở Myanmar, bắc Thái Lan và Việt Nam [B·en.wikipedia.org]
- kích thước: Con đực trưởng thành dài trung bình khoảng 53 cm, nặng khoảng 7,7 kg [B·en.wikipedia.org]
- hình thái, màu: Lông nâu hoặc xám, mặt hồng không có lông [B·en.wikipedia.org]
- hành vi, âm thanh: Hoạt động ban ngày, cả trên cây lẫn mặt đất [B·en.wikipedia.org] · Khi bị đe doạ phát một tiếng sủa đơn, to, cao, chói (shrill bark) [B·en.wikipedia.org]
- mật độ, license: Đàn gồm 20–200 cá thể đực và cái [B·en.wikipedia.org]
- honest-null: độ cao, mùa, thời tiết

**Khỉ đuôi lợn**
- tên khoa học: Macaca nemestrina (tên ghi trong nguồn 2000s; nay khỉ đuôi lợn phương bắc là M. leonina) [A·thiennhienviet.org.vn]
- hình thái, màu: lông xám tròn quanh má; vệt đỏ ở mỗi khoé mắt ngoài; đuôi mảnh đen [B·en.wikipedia.org]
- mật độ, license: đàn khá lớn, có thể trên 150 con [B·en.wikipedia.org]
- honest-null: phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết

**Voọc Hà Tĩnh**
- phân bố: có quần thể ở Phong Nha–Kẻ Bàng [A·thiennhienviet.org.vn] · vách đá vôi dốc miền Trung VN và nam Lào; không có ở tỉnh Hà Tĩnh [B·en.wikipedia.org]
- hình thái, màu: trưởng thành gần như đen tuyền, má trắng kéo qua tai xuống cổ; con sơ sinh lông vàng [B·en.wikipedia.org]
- hành vi, âm thanh: ngủ trong hang, khe vách đá vôi; rời hang lúc rạng sáng, về đầu buổi chiều [B·en.wikipedia.org]
- mật độ, license: đàn thường 2–15 con, tối đa 30 [B·en.wikipedia.org]
- honest-null: tên khoa học, độ cao, kích thước, mùa, thời tiết

**Voọc chà vá chân nâu**
- tên khoa học: Pygathrix nemaeus [A·thiennhienviet.org.vn]
- phân bố: Việt Nam từ Nghệ An đến Gia Lai; nam Lào [B·en.wikipedia.org]
- hình thái, màu: đỉnh đầu bạc, thái dương lông đỏ, trán đen [B·en.wikipedia.org] · mặt vàng nâu, mí mắt xanh nhạt; vòng cổ cam có dải đen [B·en.wikipedia.org]
- hành vi, âm thanh: gầm gừ trầm khi đe doạ; tiếng rít ngắn chói khi hoảng [B·en.wikipedia.org] · giật mình thì sủa to và đập cành [B·en.wikipedia.org]
- mật độ, license: đàn trung bình 18 con (đơn vị ~6,5 con); có đàn đến 50 [B·en.wikipedia.org] · ở Phong Nha có thể đã suy giảm mạnh [A·thiennhienviet.org.vn]
- honest-null: độ cao, kích thước, mùa, thời tiết

**Vượn (loài không xác định, lời nhân chứng 1967–69)**
- hành vi, âm thanh: đoàn đi bộ Trường Sơn nghe vượn kêu hú suốt ngày; đêm có tiếng sột soạt lạ [B·baovanhoa.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, mùa, thời tiết, mật độ, license

**Vượn đen má hung**
- tên khoa học: Hylobates leucogenys (tên ghi trong nguồn, phân loại cũ) [A·thiennhienviet.org.vn]
- honest-null: phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Vượn đen má trắng**
- phân bố: chỉ còn ở bắc Việt Nam và bắc Lào [B·en.wikipedia.org]
- hình thái, màu: đực đen toàn thân, mảng trắng rõ ở má [B·en.wikipedia.org]
- mật độ, license: nhóm tối đa 6 con [B·en.wikipedia.org]
- honest-null: tên khoa học, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết

**Vượn đen má trắng (Nomascus sp., Nakai–Nam Theun)**
- phân bố: Nakai–Nam Theun, Trường Sơn phía Lào (giáp Quảng Bình/Hà Tĩnh) [A·kirim.kmutt.ac.th]
- hành vi, âm thanh: tiếng hót đực đầu tiên bắt đầu trung bình 12 phút trước khi mặt trời mọc [A·kirim.kmutt.ac.th] · mọi tiếng hót tắt trung bình 13 phút sau khi mặt trời mọc [A·kirim.kmutt.ac.th] · một hồi hót đôi kéo dài trung bình 16 phút; ngắn lại khi có gió [A·kirim.kmutt.ac.th]
- mùa, thời tiết: hót nhiều hơn vào mùa khô lạnh; hót nhiều hơn ngày không mưa [A·kirim.kmutt.ac.th]
- honest-null: tên khoa học, độ cao, kích thước, hình thái, màu, mật độ, license

**Vượn đen má trắng siki**
- phân bố: nguyên thuỷ: miền Trung Việt Nam và miền Trung Lào [B·en.wikipedia.org]
- hình thái, màu: đực trưởng thành đen, cái nâu; con non nâu nhạt rồi đen [B·en.wikipedia.org] · mảng lông trắng lớn quanh mép miệng [B·en.wikipedia.org]
- honest-null: tên khoa học, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Vượn đen má vàng phía nam**
- hành vi, âm thanh: cặp đực-cái hót đôi buổi sáng 5:00–10:00, dài khoảng 10–25 phút (cá thể nuôi) [A·frontiersin.org] · cấu trúc: vài nốt mở đầu của cả hai, rồi 'great call' của con cái, con đực im rồi thêm đoạn coda [A·frontiersin.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, mùa, thời tiết, mật độ, license


### chim (5)

**Bìm bịp lớn**
- hình thái, màu: đầu và thân đen ánh tím, lưng và cánh nâu hạt dẻ, mắt đỏ hồng ngọc; dài 48 cm [B·en.wikipedia.org]
- hành vi, âm thanh: tiếng 'búp-búp-búp' trầm vang lặp lại, đôi khi song ca [B·en.wikipedia.org] · bay yếu, leo trèo trong bụi hoặc đi bộ dưới đất; hoạt động sáng ấm và chiều muộn [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, mùa, thời tiết, mật độ, license

**Gà lôi lam mào trắng**
- tên khoa học: Lophura edwardsi [A·thiennhienviet.org.vn]
- phân bố: đặc hữu miền Trung VN: Hà Tĩnh, Quảng Bình, Quảng Trị, Thừa Thiên Huế [B·en.wikipedia.org]
- hình thái, màu: trống xanh-đen có mào; mái nâu xỉn; dài 58–65 cm [B·en.wikipedia.org]
- hành vi, âm thanh: tiếng báo động trầm khàn 'uk uk uk uk uk'; hay nấp ở tầng thấp [B·en.wikipedia.org]
- mật độ, license: tìm lại năm 1996 ở Đakrông và Phong Điền [A·thiennhienviet.org.vn] · IUCN: cực kỳ nguy cấp, có thể đã tuyệt chủng ngoài tự nhiên; không thấy ngoài tự nhiên từ 2000 [B·en.wikipedia.org]
- honest-null: độ cao, kích thước, mùa, thời tiết

**Gà rừng**
- hình thái, màu: trống có lông cổ dài vàng óng; đuôi 14 lông ánh xanh-tím-lục [B·en.wikipedia.org]
- hành vi, âm thanh: tiếng gáy ngắn hơn gà nhà, tắt đột ngột ở cuối [B·en.wikipedia.org] · đàn 1–vài trống với nhiều mái; chỉ bay lên cây ngủ lúc hoàng hôn; ưa ven rừng [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, mùa, thời tiết, mật độ, license

**Hồng hoàng**
- kích thước: dài 95–130 cm, sải cánh 152 cm; đực ~3 kg [B·en.wikipedia.org]
- hình thái, màu: mũ sừng vàng tươi và đen trên mỏ đồ sộ, nhìn trước hình chữ U [B·en.wikipedia.org]
- hành vi, âm thanh: vỗ cánh nặng, nghe từ xa, như đầu máy hơi nước khởi động [B·en.wikipedia.org] · hót đôi: con đực 'kok' khoảng 1 lần/giây, con cái nhập vào, thành hỗn hợp gầm và sủa [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, mùa, thời tiết, mật độ, license

**Trĩ sao**
- tên khoa học: Rheinardia ocellata [A·thiennhienviet.org.vn]
- phân bố: Đakrông (Quảng Trị) và Phong Nha–Kẻ Bàng [A·thiennhienviet.org.vn] · Thừa Thiên Huế: Bạch Mã, Phong Điền, KBT Sao La; phát hiện qua bẫy ảnh và máy ghi âm thụ động [B·tienphong.vn]
- kích thước: lông phủ đuôi đến 1,73 m; tổng dài 1,9–2,39 m [B·en.wikipedia.org] · Lông đuôi con đực dài tới 150 cm [C·pierrewildlife.com]
- hình thái, màu: lông đen và vàng da bò lốm đốm nâu sẫm; mỏ hồng to; da quanh mắt xanh lam [B·en.wikipedia.org]
- hành vi, âm thanh: nhút nhát, khó gặp; làm tổ trên dốc đứng giữa lớp lá rụng [B·en.wikipedia.org] · Con đực phát tiếng hú to, kéo dài vào mùa sinh sản [B·ebird.org] · Thường chỉ thấy ở bãi múa, nơi con đực dọn sạch lá rụng [B·ebird.org]
- mùa, thời tiết: Bạch Mã tháng 1–2/1990 nghe ít nhất 75 con kêu (tháng 4–5/1991: 21 con) [A·thiennhienviet.org.vn]
- mật độ, license: Bạch Mã là nơi trĩ sao có mật độ cao [A·thiennhienviet.org.vn] · Suy giảm nhanh ở Việt Nam và Lào do săn bắt và mất sinh cảnh [B·static1.squarespace.com]
- honest-null: độ cao


### gam_nhan (5)

**Dúi mốc lớn**
- hình thái, màu: lông lưng nâu xám hoặc nâu sẫm; hang một lối vào đánh dấu bằng ụ đất [B·en.wikipedia.org]
- hành vi, âm thanh: ra ngoài ban đêm kiếm thực vật; sống bụi tre, ven rừng [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, mùa, thời tiết, mật độ, license

**Sóc bụng đỏ**
- hình thái, màu: lưng nâu, bụng ngả đỏ, đuôi thường có ít đen [B·en.wikipedia.org]
- hành vi, âm thanh: ban ngày, trên tán; tổ lá cao 7–18 m; kêu báo động khi có thú săn, vây rắn [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, mùa, thời tiết, mật độ, license

**Sóc chuột (Tamiops maritimus)**
- phân bố: Lào và Việt Nam phía đông sông Mê Kông [B·en.wikipedia.org]
- hành vi, âm thanh: Hoạt động ngày, sống rất nhiều trên cây; ăn quả, hạt, côn trùng, mật hoa gừng [B·en.wikipedia.org]
- honest-null: tên khoa học, độ cao, kích thước, hình thái, màu, mùa, thời tiết, mật độ, license

**Sóc chuột (Tamiops rodolphii)**
- phân bố: Đông Thái Lan, Campuchia, nam Lào, nam Việt Nam (không phải loài chính ở Trường Sơn Bắc) [B·en.wikipedia.org]
- hành vi, âm thanh: Ở tầng dưới tán và tán thấp; kiếm ăn dọc mặt vỏ cây thẳng đứng [B·en.wikipedia.org]
- honest-null: tên khoa học, độ cao, kích thước, hình thái, màu, mùa, thời tiết, mật độ, license

**Sóc chuột (chi Tamiops)**
- kích thước: Dài đầu-thân 10–13 cm [B·en.wikipedia.org]
- hình thái, màu: Sọc đen dọc giữa lưng, các sọc nhạt xen sọc nâu sẫm; sọc má đứt ở vai [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license


### bo_sat_luong_cu (9)

**Cạp nong**
- hình thái, màu: khoanh đen và vàng xen kẽ bao quanh thân; dài tối đa trên 2 m [B·en.wikipedia.org]
- hành vi, âm thanh: chủ yếu ban đêm; ngày lờ đờ, giấu đầu dưới khoanh thân [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, mùa, thời tiết, mật độ, license

**Hổ mang chúa**
- kích thước: trưởng thành 3,18–4 m; dài nhất ghi nhận 5,85 m [B·en.wikipedia.org]
- hình thái, màu: da xanh ô-liu, khoang đen-trắng hội về đầu; con non đen vạch chữ V trắng/vàng [B·en.wikipedia.org]
- hành vi, âm thanh: tiếng 'gầm' trầm, tần số trội ~600 Hz, dưới 2.500 Hz [B·en.wikipedia.org] · hoảng thì dựng nửa thân, bạnh mang, phì to; săn ban ngày [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, mùa, thời tiết, mật độ, license

**Rắn hổ mang (Naja sp., Bắc Hướng Hóa)**
- tên khoa học: Khảo sát Bắc Hướng Hóa ghi 'Indochinese Cobra Naja naja' (tên cũ, loài chưa phân định) [A·locjkt.or.id]
- honest-null: phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Rắn hổ mang một mắt kính**
- phân bố: Từ Ấn Độ tới Trung Quốc, Việt Nam, Campuchia; có ở Lào [B·en.wikipedia.org]
- kích thước: Trưởng thành dài 1,35–1,5 m [B·en.wikipedia.org]
- hình thái, màu: Lưng vàng, nâu, xám hoặc đen nhạt; mang bành có vòng hình chữ O (một mắt kính) [B·en.wikipedia.org]
- hành vi, âm thanh: Sống trên mặt đất, hoạt động mạnh nhất lúc chạng vạng; phì to rồi mổ khi bị dồn [B·en.wikipedia.org]
- honest-null: tên khoa học, độ cao, mùa, thời tiết, mật độ, license

**Rắn hổ mang phun nọc Đông Dương**
- phân bố: Thái Lan, Campuchia, Việt Nam, Lào [B·en.wikipedia.org]
- kích thước: Trưởng thành dài trung bình 0,9–1,2 m [B·en.wikipedia.org]
- hình thái, màu: Xám đến nâu đến đen có đốm hoặc sọc trắng; dấu mang bành hình kính, không đều hoặc không có [B·en.wikipedia.org]
- hành vi, âm thanh: Chủ yếu hoạt động đêm; phun nọc thành dạng sương chứ không thành tia [B·en.wikipedia.org]
- honest-null: tên khoa học, độ cao, mùa, thời tiết, mật độ, license

**Rắn lục mép trắng**
- kích thước: dài tối đa đực 60 cm, cái 81 cm [B·en.wikipedia.org]
- hình thái, màu: lưng xanh lục; hai bên đầu dưới mắt vàng/trắng/xanh nhạt sáng hơn [B·en.wikipedia.org]
- hành vi, âm thanh: nọc chủ yếu độc máu; nhiều vụ cắn, ít tử vong [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, mùa, thời tiết, mật độ, license

**Trăn đất**
- tên khoa học: Python bivittatus (tách khỏi trăn Ấn Độ từ 2009) [B·en.wikipedia.org] · Bắc Hướng Hóa ghi Python molurus (tên cũ) [A·locjkt.or.id]
- kích thước: Ngoài tự nhiên thường dài tới 5 m, trung bình 3,7 m; con 5 m nặng 75 kg [B·en.wikipedia.org]
- hình thái, màu: Nền sẫm với nhiều mảng nâu viền đen dọc lưng [B·en.wikipedia.org]
- hành vi, âm thanh: Chủ yếu hoạt động đêm; bơi và leo giỏi, cần nguồn nước thường xuyên, lặn được tới nửa giờ [B·en.wikipedia.org]
- honest-null: phân bố, độ cao, mùa, thời tiết, mật độ, license

**Tắc kè**
- kích thước: dài 25–30 cm (cả đuôi), có con đến 40 cm [B·en.wikipedia.org]
- hành vi, âm thanh: tiếng đực to như 'tô-kê', thường mở đầu bằng tràng lách cách nhanh, trầm [B·en.wikipedia.org] · kêu nhiều nhất lúc chạng vạng, đỉnh thứ hai lúc rạng sáng; đêm đi săn côn trùng [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, mùa, thời tiết, mật độ, license

**Ếch nhái (nhiều loài)**
- hành vi, âm thanh: khi mưa, tiếng ếch nhái và muông thú như bản hợp xướng (nhân chứng 1967–69) [B·baovanhoa.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, mùa, thời tiết, mật độ, license


### con_trung_khac (9)

**Bướm ngày (Rhopalocera)**
- độ cao: Bạch Mã: đa dạng loài dưới 1.000 m cao hơn trên 1.000 m [A·jos.hueuni.edu.vn]
- mật độ, license: Bạch Mã: 361 loài bướm ngày; họ Bướm giáp (Nymphalidae) nhiều loài nhất [A·jos.hueuni.edu.vn] · Bạch Mã: trảng cỏ nhiều loài nhất, rừng kín tự nhiên ít nhất [A·jos.hueuni.edu.vn] · Phong Nha–Kẻ Bàng: hơn 250 loài bướm (khảo sát 1999, 2022–2023) [A·gbif.org] · Phong Nha–Kẻ Bàng: hơn 270 loài bướm (nguồn du lịch) [C·discoveryhotels.com.vn] · 36 loài bướm phượng (Papilionidae) ở Bạch Mã, Phong Điền, Sao La (Thừa Thiên Huế) [A·journal.vnuf.edu.vn]
- honest-null: tên khoa học, phân bố, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Bướm phượng cánh chim chấm liền**
- tên khoa học: Troides helena [A·journal.vnuf.edu.vn]
- phân bố: Ghi nhận ở các khu bảo tồn Thừa Thiên Huế; có trong Sách Đỏ Việt Nam 2007 [A·journal.vnuf.edu.vn]
- hình thái, màu: Cánh trước đen nhung có vệt nhạt dọc gân; cánh sau vàng óng như lụa, gân đen mảnh [B·en.wikipedia.org]
- honest-null: độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Kiến vàng**
- tên khoa học: Oecophylla smaragdina [B·en.wikipedia.org]
- kích thước: Kiến thợ dài 5–7 mm [B·en.wikipedia.org] · Kiến thợ lớn dài khoảng 8–10 mm (trang chi Oecophylla) [B·en.wikipedia.org] · Tổ lớn dài hơn nửa mét [B·en.wikipedia.org]
- hình thái, màu: Thợ chủ yếu màu cam; tổ làm từ lá khâu bằng tơ của ấu trùng, nằm giữa tán lá [B·en.wikipedia.org]
- hành vi, âm thanh: Không đốt nhưng cắn đau và tiết/phun axit formic; bảo vệ lãnh thổ hung hăng [B·en.wikipedia.org]
- mật độ, license: Một tập đoàn có thể chiếm 151 tổ trên 12 cây, tới nửa triệu cá thể [B·en.wikipedia.org]
- honest-null: phân bố, độ cao, mùa, thời tiết

**Muỗi Anopheles dirus**
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Mùa bướm trắng Phong Nha**
- hành vi, âm thanh: Đẹp nhất 8–10 giờ sáng và 3–5 giờ chiều; từng đàn bay dọc sông Son, sông Chày [C·discoveryhotels.com.vn]
- mùa, thời tiết: Tháng 3 đến tháng 5 hằng năm [C·discoveryhotels.com.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, mật độ, license

**Sốt rét rừng**
- mật độ, license: nhân chứng đi bộ Trường Sơn 1967–69 bị sốt rét rừng liên tục [B·baovanhoa.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Ve sầu**
- hành vi, âm thanh: đến 120 dB, trong số tiếng côn trùng to nhất; đôi khi đồng ca [B·en.wikipedia.org]
- mùa, thời tiết: kêu mạnh nhất giờ nóng nhất ngày hè; cần nhiệt bên ngoài; vài loài kêu lúc chạng vạng [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, mật độ, license

**Vắt rừng**
- tên khoa học: Haemadipsa sylvestris (Ấn Độ, Đông Dương, Malesia) [B·en.wikipedia.org]
- hành vi, âm thanh: hút máu; vết cắn chảy máu lâu [B·en.wikipedia.org]
- mùa, thời tiết: khi trời mưa muỗi, vắt bám khắp nơi (nhân chứng 1967–69) [B·baovanhoa.vn]
- honest-null: phân bố, độ cao, kích thước, hình thái, màu, mật độ, license

**Đom đóm**
- phân bố: Ven suối, bụi thấp, khoảng rừng ẩm tối, nơi ẩm và ít ánh sáng nhân tạo [B·baophapluat.vn]
- hình thái, màu: Ánh sáng vàng, xanh lục hoặc đỏ nhạt (510–670 nm); ấu trùng cũng phát sáng [B·en.wikipedia.org]
- hành vi, âm thanh: Con đực bay nháy sáng tìm bạn, chủ yếu lúc chạng vạng; ở Đông Nam Á nhiều đàn nháy đồng bộ ven sông [B·en.wikipedia.org]
- mùa, thời tiết: Ở Cúc Phương xuất hiện những đêm cuối xuân đầu hè [B·baophapluat.vn] · Chỉ phát sáng mùa hè; trải đông ở dạng ấu trùng, ra vào mùa xuân [C·heritagevietnamairlines.com]
- honest-null: tên khoa học, độ cao, kích thước, mật độ, license


### thu_lon (10)

**Bò tót**
- tên khoa học: Bos gaurus (khảo sát Bắc Hướng Hóa ghi Bos frontalis) [A·locjkt.or.id]
- kích thước: Cao vai 142–220 cm, dài đầu-thân 250–330 cm; con cái 440–1.000 kg [B·en.wikipedia.org]
- hình thái, màu: Con đực nâu sẫm gần đen; cẳng chân dưới trắng hoặc vàng nâu như đi tất; sừng dài 60–115 cm [B·en.wikipedia.org]
- hành vi, âm thanh: Báo động bằng tiếng khịt huýt, kêu trầm như bò nhà; tiếng gọi động dục vang xa hơn 1,6 km [B·en.wikipedia.org]
- mật độ, license: Tháng 1–2 sống đàn nhỏ 8–11 con với một bò đực (số liệu Ấn Độ) [B·en.wikipedia.org] · Lào giữa thập niên 1990 ước tới 200 cá thể trong các khu bảo tồn [B·en.wikipedia.org]
- honest-null: phân bố, độ cao, mùa, thời tiết

**Gấu chó**
- tên khoa học: Helarctos malayanus [A·locjkt.or.id]
- kích thước: Dài đầu-thân 100–140 cm, cao vai gần 70 cm, nặng 25–65 kg [B·en.wikipedia.org]
- hình thái, màu: Lông thường đen tuyền; mảng ngực từ cam, vàng đất tới kem hay trắng; mõm xám, bạc hoặc cam [B·en.wikipedia.org] · Vuốt hình lưỡi liềm, vuốt trước dài nặng; để lại vết cào trên thân cây đã leo [B·en.wikipedia.org]
- hành vi, âm thanh: Chủ yếu hoạt động ngày; leo giỏi, phơi nắng hoặc ngủ trên cây cao 2–7 m [B·en.wikipedia.org]
- mật độ, license: Quần thể Việt Nam lo ngại giảm 50–80% trong 30 năm tới [B·en.wikipedia.org]
- honest-null: phân bố, độ cao, mùa, thời tiết

**Gấu ngựa**
- tên khoa học: Ursus thibetanus [A·locjkt.or.id]
- kích thước: Cao vai 70–100 cm, dài 120–190 cm; con đực 60–200 kg [B·en.wikipedia.org]
- hình thái, màu: Lông đen, mõm nâu nhạt, mảng trắng kem ở ngực đôi khi hình chữ V [B·en.wikipedia.org]
- hành vi, âm thanh: Hoạt động ngày, chuyển sang đêm gần nơi có người; leo cây giỏi, nằm nghỉ trên ổ trên cây [B·en.wikipedia.org] · Tiếng kêu đa dạng: gầm gừ, rên, gầm, tiếng chép [B·en.wikipedia.org]
- mật độ, license: Thợ săn ở Bắc Hướng Hóa cho biết gấu chó hiếm hơn gấu ngựa [A·locjkt.or.id]
- honest-null: phân bố, độ cao, mùa, thời tiết

**Hổ**
- mật độ, license: Phong Nha–Kẻ Bàng hiện không còn ý nghĩa bảo tồn hổ [A·thiennhienviet.org.vn] · lời đồn bộ đội 1967–69: núi Răng Cưa nhiều hang đá, cọp sống thành đàn (truyền miệng, chưa kiểm) [B·baovanhoa.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Lợn rừng**
- tên khoa học: Sus scrofa [B·en.wikipedia.org]
- phân bố: Một phân loài phân bố từ ven biển Trung Quốc xuống Việt Nam [B·en.wikipedia.org]
- kích thước: Con đực trung bình 75–100 kg, cao vai 75–80 cm, thân dài 150 cm (số liệu chung, không riêng Đông Dương) [B·en.wikipedia.org] · Nanh dưới lộ ra dài 10–12 cm [B·en.wikipedia.org]
- hình thái, màu: Lợn con lông nâu nhạt hoặc nâu gỉ sắt với các sọc nhạt dọc sườn và lưng [B·en.wikipedia.org]
- hành vi, âm thanh: Gọi nhau bằng tiếng ủn ỉn; khi hoảng phát tiếng khịt 'ukh! ukh!' hoặc rít 'gu-gu-gu' [B·en.wikipedia.org] · Sống theo bầy do lợn cái già đầu đàn dẫn dắt; để lại dấu ủi đất, giẫm và vũng đầm [B·en.wikipedia.org]
- honest-null: độ cao, mùa, thời tiết, mật độ, license

**Mang lớn**
- tên khoa học: Muntiacus vuquangensis (Megamuntiacus vuquangensis) [A·locjkt.or.id]
- phân bố: Ghi nhận ở Bắc Hướng Hóa và Đakrông (Quảng Trị) [A·thiennhienviet.org.vn]
- honest-null: độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Mang đỏ phương bắc**
- phân bố: Trung Quốc, Campuchia, Lào, Thái Lan, Việt Nam [B·en.wikipedia.org]
- kích thước: Thân dài 89–135 cm, cao vai 40–65 cm, đuôi 13–23 cm, nặng 14–35 kg (M. muntjak nghĩa rộng) [B·animaldiversity.org]
- hình thái, màu: đực có gạc ngắn và răng nanh trên dài [B·en.wikipedia.org] · Lưng vàng nâu như vàng rám, bụng trắng, chân và mặt nâu sẫm [B·animaldiversity.org] · Răng nanh trên con đực như ngà dài khoảng 1 inch (2,5 cm) [B·animaldiversity.org]
- hành vi, âm thanh: tiếng kêu như tiếng sủa, dùng báo động và liên lạc [B·en.wikipedia.org] · Tiếng kêu như chó sủa khi phát hiện thú săn mồi; có thể sủa hơn một giờ liền [B·animaldiversity.org] · Hoạt động cả ngày lẫn đêm; con trưởng thành sống đơn độc [B·animaldiversity.org]
- honest-null: tên khoa học, độ cao, mùa, thời tiết, mật độ, license

**Nhím (Hystrix brachyura)**
- tên khoa học: Hystrix brachyura [A·locjkt.or.id]
- phân bố: Bắc Hướng Hóa: xác nhận qua dấu chân, lông gai và một con nuôi nhốt [A·locjkt.or.id]
- kích thước: Đầu-thân 56–74 cm, đuôi 6–11 cm, nặng 10–18 kg [B·en.wikipedia.org]
- hình thái, màu: Lông gai phần trên thân đen với khoanh trắng hoặc vàng [B·en.wikipedia.org]
- hành vi, âm thanh: Kiếm ăn ban đêm, ngày nghỉ trong hang có lối mòn toả ra xung quanh [B·en.wikipedia.org]
- honest-null: độ cao, mùa, thời tiết, mật độ, license

**Sao la**
- tên khoa học: Pseudoryx nghetinhensis [A·thiennhienviet.org.vn]
- hình thái, màu: lông nâu sô-cô-la, mảng trắng ở mặt, họng, hai bên cổ; sừng nâu sẫm/đen dài 35–50 cm [B·en.wikipedia.org]
- hành vi, âm thanh: hoạt động cả ngày lẫn đêm (theo dân địa phương); đơn độc hoặc 2–3 con [B·en.wikipedia.org]
- mật độ, license: khoa học công bố 17/7/1992 (tức chưa được biết năm 1971); ước 50–300 cá thể (2015); nhà khoa học chưa từng quan sát ngoài tự nhiên [B·en.wikipedia.org]
- honest-null: phân bố, độ cao, kích thước, mùa, thời tiết

**Voi châu Á**
- mật độ, license: Phong Nha–Kẻ Bàng hiện không còn ý nghĩa bảo tồn voi [A·thiennhienviet.org.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết


### dau_vet_chien_tranh (47)

**Bãi giấu xe**
- hành vi, âm thanh: Tài xế vội vào bãi giấu xe trước bình minh [B·en.wikipedia.org]
- mật độ, license: Khoảng 100 binh trạm, cách nhau một ngày đường, có hầm kho lớn [A·apps.dtic.mil]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, mùa, thời tiết

**Bản Đông (A Lưới, Lào)**
- phân bố: Mục tiêu A Lưới, tên địa lý Bản Đông, trên Đường 9 ở Lào [A·apps.dtic.mil]
- mật độ, license: Cánh quân thiết giáp dừng khoảng 5 km tây Bản Đông [B·historynet.com]
- honest-null: tên khoa học, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Bến lội Ban Laboy**
- phân bố: Lối vào Lào qua đèo Ban Karai, tới bến lội Ban Laboy [C·thehochiminhtrail.com]
- mật độ, license: Nơi bị ném bom nhiều nhất thế giới tính theo đầu người (nguồn blog) [C·thehochiminhtrail.com]
- honest-null: tên khoa học, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Bến phà Long Đại**
- hình thái, màu: Pháo sáng phủ kín trời, xe nằm im chờ [B·baophapluat.vn]
- hành vi, âm thanh: Ngày giấu phà dưới tán cây ven sông, đêm lắp ráp cầu phà [B·baophapluat.vn] · Pháo khói bắn xuống đánh dấu mục tiêu khi phát hiện hoạt động [B·baophapluat.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, mùa, thời tiết, mật độ, license

**Bếp Hoàng Cầm**
- phân bố: Dùng dọc đường Trường Sơn: 'ngày không khói, đêm không lửa' [B·vietnamnews.vn]
- hình thái, màu: Bếp đào vào chân đồi, rãnh khói tỏa ra như vòi mực [B·vietnamnews.vn] · Rãnh khói phủ cành cây và đất ẩm [B·vietnamnews.vn] · Khói thoát lên trông như sương sớm rồi tan nhanh, là sát mặt đất [B·vietnamnews.vn] · Hố sâu có nắp, ống tre dài ngầm dưới đất tản khói [B·en.wikipedia.org] · Hố lớn trước bếp phủ tấm che, làm buồng khói/buồng gió [B·vietnamnews.vn] · Nhiều đường rãnh tản khói ra mặt đất [B·vietnamnews.vn]
- mùa, thời tiết: Đặt tên chính thức tháng 10/1952 [B·vietnamnews.vn]
- honest-null: tên khoa học, độ cao, kích thước, hành vi, âm thanh, mật độ, license

**Cháy rừng do napalm và bom cháy**
- hình thái, màu: Phun rụng lá cho khô, rồi ném napalm đốt lớp lá rụng [A·openvault.wgbh.org] · Nền đất quanh cứ điểm trên đồi lóe lửa napalm từ Phantom bổ nhào xuống rừng (Nam Lào 1971) [B·warfarehistorynetwork.com]
- hành vi, âm thanh: Không khí nồng mùi cỏ cháy, mùi thuốc súng (Đồi Không Tên, Đường 9) [A·baohatinh.vn]
- mùa, thời tiết: Rừng ẩm nhiệt đới không bắt lửa thành 'bão lửa' dù đã phun khô và rải bom cháy M35 bằng B-52 (Pink Rose 1967) [C·globalsecurity.org] · Mùa khô, lửa cũng không xuyên vào loại rừng như thế [A·openvault.wgbh.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, mật độ, license

**Cua chữ A**
- phân bố: Thuộc Đường 20 Quyết Thắng, cùng cụm với ngầm Ta Lê, đèo Phu La Nhích [B·baolaichau.vn] · Chữ A trong ATP; đại đội C5 phụ trách cua chữ A [B·baophapluat.vn]
- hình thái, màu: Khúc cua biến mất, còn lại hàng trăm hố bom và cồn đất đỏ [C·nguoiquansat.vn] · Ban đêm mịt mù pháo sáng [B·sggp.org.vn]
- honest-null: tên khoa học, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Cảm biến 'cây nhiệt đới'**
- hình thái, màu: Thiết bị điện tử có hình dáng, màu sắc giống cây nhỏ rừng nhiệt đới [A·baophapluat.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Cầu cáp tháo lắp**
- hình thái, màu: Trụ sẵn hai bờ, chạng vạng căng 4 dây cáp, bắc gỗ, sáng tháo cất [B·baophapluat.vn]
- hành vi, âm thanh: Xe qua cầu lắc lư, có xe trượt rơi xuống sông [B·baophapluat.vn]
- mật độ, license: Đường 12 (Khe Ve – đèo Mụ Giạ) dài 45 km có hơn 10 cầu; có cả cầu giả nhử bom [B·baophapluat.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, mùa, thời tiết

**Cầu ngầm (cầu dưới mặt nước)**
- phân bố: Bến lội Ban Laboy có bến phụ thượng nguồn với cầu ngầm [C·thehochiminhtrail.com]
- kích thước: Mặt cầu nằm dưới mặt nước vài cm ('cầu chìm', 'cầu tàng hình') [B·nhandan.vn]
- hình thái, màu: Cầu thô sơ dựng dưới mặt nước [B·en.wikipedia.org] · Chuyển từ cầu nổi sang cầu dưới mặt nước [B·vnexpress.net] · Làm bằng gỗ, cát, đất ngay dưới mặt nước; xe nặng lội nước nông qua [B·en.wikipedia.org]
- mật độ, license: Nước cách ly sức nổ nên bom khó phá [B·en.wikipedia.org]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết

**Cầu treo dây rừng**
- kích thước: Toàn bằng dây và cây rừng, dài cả trăm mét [A·baoquocte.vn]
- hành vi, âm thanh: Ra giữa cầu đung đưa như cái võng [B·sggp.org.vn]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, mùa, thời tiết, mật độ, license

**Cọc tiêu dẫn đường**
- hình thái, màu: "Cọc tiêu sống": tốp 10–12 nữ TNXP mặc áo đông xuân trắng đứng dẫn xe (Truông Bồn, Nghệ An, 1968) [B·lsvn.vn] · Bẹ chuối rải hai bên đường làm vạch cho lái xe ban đêm [B·lsvn.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Cổng Trời Cha Lo**
- phân bố: Trên đường 12 (nay QL12A), không phải đường 20: Khe Ve – Cổng Trời – Cha Lo – Khăm Muộn [B·baophapluat.vn] · Cột mốc Km 34,5 đường 12A, xã Dân Hóa (Minh Hóa cũ), cách Đồng Hới ~150 km [C·vinpearl.com] · Thuộc quần thể VQG Phong Nha – Kẻ Bàng (theo Nhân Dân) [B·nhandan.vn]
- hình thái, màu: Một bên vực, một bên núi cao [C·vinpearl.com] · Rừng chen chúc tầng tầng lớp lớp, núi sừng sững vút cao [B·nhandan.vn] · Lan rừng bám chi chít trên cành, thân cây [B·nhandan.vn] · Có kho trung chuyển, kho xăng dầu, công sự ngầm, đồn biên phòng [C·vinpearl.com] · 1965–1973 là trận địa pháo phòng không Tiểu đoàn Nguyễn Viết Xuân [B·nhandan.vn]
- mùa, thời tiết: Mây mù phủ kín quanh năm [C·vinpearl.com] · Dưới chân dãy Giăng Màn quanh năm mờ sương [B·thoibaotaichinhvietnam.vn] · Bị không kích ác liệt 1965–1973 [C·vinpearl.com]
- honest-null: tên khoa học, độ cao, kích thước, hành vi, âm thanh, mật độ, license

**Cứ điểm 31 (Hill 31)**
- phân bố: Bãi đáp 31 cách Bản Đông khoảng 8 km về phía bắc [A·apps.dtic.mil]
- hình thái, màu: Đồi dốc đến mức xe tăng không tấn công lên được [B·en.wikipedia.org]
- honest-null: tên khoa học, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Cứ điểm 543**
- hình thái, màu: Quả đồi cao rộng hàng mẫu, đất đá cày xới; địch bắn ra từ hầm, thông hào [A·baodautu.vn]
- hành vi, âm thanh: Máy bay địch gầm thét trên đầu như chuồn chuồn mùa hè [A·baodautu.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, mùa, thời tiết, mật độ, license

**Dốc Ba Thang**
- hình thái, màu: Công binh treo mình trên vách đá thi công [B·baovanhoa.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Giàn ngụy trang và đường kín**
- hình thái, màu: Giàn tre công phu dọc đường để che dấu vết [B·historynet.com] · 'Đường kín': trồng cây, kết tán lá che kín cung đường [B·nhandan.vn] · Đoạn núi cao rừng rậm: kéo buộc ngọn cây hai bên đường vào nhau [B·baophapluat.vn] · Buộc đá nặng vào cành tre uốn cong ngang đường thành đường hầm lá [B·environmentandsociety.org] · Treo giỏ cây trồng chậu dọc đoạn trống thưa cây [B·environmentandsociety.org] · Mở đường đến đâu ngụy trang cây lá đến đó [B·baophapluat.vn]
- hành vi, âm thanh: Đội làm đường lùa đàn gia súc đi lại trên đường để xoá vết [B·historynet.com]
- mật độ, license: Đến 1973 xe chạy suốt tuyến dưới tán rừng, chỉ ra khỏi tán khi lội suối [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, mùa, thời tiết

**Hang Chỉ huy (hang 7 tầng)**
- phân bố: Km12 đường 20, vùng lõi Phong Nha – Kẻ Bàng [C·oxalisadventure.com]
- kích thước: Hang cao gần trăm mét, cải tạo thành 7 tầng trong 3 tháng [B·sggp.org.vn] · Rộng khoảng 150 m, cao hơn 100 m [C·oxalisadventure.com]
- hình thái, màu: Rừng tái sinh trên đá vôi cổ quanh hang [B·sggp.org.vn]
- mật độ, license: Khu Km12 hứng hơn 16.000 quả bom trong 3 tháng [C·oxalisadventure.com]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết

**Hang Tám Cô**
- phân bố: Km 16+200 đường 20 (hang ở km 16,5) [B·tuoitre.vn]
- kích thước: Tảng đá lấp cửa hang nặng hàng trăm tấn [B·tuoitre.vn] · Tảng đá lấp cửa hang nặng hàng ngàn tấn [B·tuoitre.vn]
- hình thái, màu: Km 16 bị quật nát, đất đá bật tung [B·tuoitre.vn]
- mùa, thời tiết: Chiều 14/11/1972 B-52 rải thảm từ km 16 [B·tuoitre.vn]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mật độ, license

**Hầm chữ A**
- kích thước: Sâu 1–1,2 m, rộng 1 m, dài 1,5 m (mẫu phục dựng Hỏa Lò) [B·baovanhoa.vn]
- hình thái, màu: Khung chịu lực tre, gỗ ghép hình chữ A; cửa có thể thông hai đầu [B·baovanhoa.vn]
- hành vi, âm thanh: Người trong hầm ngồi xổm, cúi đầu, tay che tai [B·baovanhoa.vn]
- honest-null: tên khoa học, phân bố, độ cao, mùa, thời tiết, mật độ, license

**Hố bom**
- kích thước: Một hố bom ở Lào ngày nay dùng làm ao: rộng khoảng 20 ft (≈6 m), sâu 3 ft (≈0,9 m) [B·undark.org]
- hình thái, màu: Nơi mực nước ngầm nông dưới 5 ft, hố bom đầy nước rất nhanh thành ao [B·cia.gov] · Đất trong hố bom sẫm và ẩm hơn bên ngoài, ít gió hơn [B·undark.org] · Đường Trường Sơn bị bom cày xới, hố bom chi chít, đồi bị san phẳng [B·sggp.org.vn] · Đường 9 phía Lào bị hố bom và mương cắt đứt nhiều chỗ (2/1971) [A·apps.dtic.mil] · Hố bom ở căn cứ Tà Bạt sau chiến tranh bị cây bụi rậm phủ [A·hatfieldgroup.com] · Đường mòn bị bom làm lỗ chỗ, mưa mùa làm hằn rãnh [B·airandspaceforces.com] · Hố bom ở trọng điểm được san lấp và biến thành hố nghi binh ngụy trang [B·vnexpress.net]
- hành vi, âm thanh: Ao hố bom thành nơi muỗi sốt rét sinh sản [B·cia.gov] · Xe phải dừng hàng loạt sau chỗ sạt lở hoặc hố bom [A·apps.dtic.mil]
- mật độ, license: Khoảng 26 triệu hố bom trên cảnh quan [B·undark.org] · Ước tính 10–15 triệu hố bom lớn ở miền Nam Việt Nam [A·digitalrepository.unm.edu] · Hơn 21 triệu hố bom, phủ khoảng 345.000 acre (con số báo chí 1972) [B·cia.gov]
- honest-null: tên khoa học, phân bố, độ cao, mùa, thời tiết

**Hố bom B-52**
- phân bố: Có hố bom B-52 ở Quảng Trị từ 8/1965 [A·archives-spec.unl.edu]
- kích thước: Hố mỗi quả bom khoảng 30 ft (≈9 m) rộng, 15 ft (≈4,5 m) sâu (lời kể phi công B-52, 1965) [C·war-stories.com] · Hố bom lớn ở Đông Dương mỗi hố khoảng 30 ft (≈9 m) đường kính, sâu hơn 5 ft (≈1,5 m) [B·cia.gov]
- hình thái, màu: Ảnh gốc Quảng Trị 8/1965: hàng bộ đội đứng quanh miệng một hố bom lớn, núi phía sau [A·archives-spec.unl.edu] · Hố bom bị che bởi cỏ rậm và tre, khó thấy từ trên cao [B·warfarehistorynetwork.com]
- mật độ, license: Cả vùng Đường 9 bên Lào đầy hố bom lớn bị cỏ và tre che khuất, trinh sát trên không không thấy [B·warfarehistorynetwork.com]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết

**Khe Sanh (căn cứ, 1971)**
- độ cao: Độ cao 490 m (1.608 ft) trên cao nguyên Xóm Chàm [B·en.wikipedia.org]
- hình thái, màu: Nền đất sét laterit hoặc đá phong hoá sắt/nhôm, có lộ đá bazan [B·en.wikipedia.org] · Đầu 1971 cỏ cao phủ căn cứ cũ, phải ủi dọn, còn mìn chống tăng [A·thedaysforward.com] · Trước chiến tranh quanh Khe Sanh là rừng mưa ba tầng tán dày; gần như không còn [B·undark.org]
- hành vi, âm thanh: Hàng trăm trực thăng vận tải lớn CH-47, CH-54 hoạt động [A·thedaysforward.com]
- mật độ, license: Tái kích hoạt ngày 30/1/1971 cho Lam Sơn 719 [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, kích thước, mùa, thời tiết

**LZ Lolo**
- độ cao: Trên đỉnh cao nhất của vách núi phía nam, 13 km đông nam Sê Pôn [B·historynet.com]
- mật độ, license: 11 trực thăng bị bắn rơi, 44 chiếc hỏng khi đổ một tiểu đoàn [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Làng Vây**
- hình thái, màu: Năm 1971 vẫn còn xác xe tăng Liên Xô cháy từ trận 1968 [A·thedaysforward.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Lán trại bộ đội**
- hình thái, màu: Mái lán lợp lá trung quân, màu vàng như rơm rạ [A·sggp.org.vn] · Dựng lán trại chỉ với con dao nhỏ [A·baonghean.vn] · Mưa rừng không có củi khô, phải tước thân bằng lăng tươi làm củi [A·baoquocte.vn]
- hành vi, âm thanh: Đêm chỉ còn tiếng côn trùng và tiếng hú xa của thú rừng [A·baoquocte.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, mùa, thời tiết, mật độ, license

**Ngã ba Khe Ve**
- phân bố: Ngã ba trên đường 12 (QL12A), Minh Hóa; đầu dốc lên Cổng Trời, Cha Lo [B·baophapluat.vn]
- hình thái, màu: Binh trạm 12 đóng tại Khe Ve, giữ kho xăng lớn [B·special.nhandan.vn]
- honest-null: tên khoa học, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Ngầm Ta Lê**
- hình thái, màu: Sông Ta Lê nước chảy rất xiết [B·baovanhoa.vn]
- mật độ, license: Tháng 5/1968 có 6 hố bom sâu chưa san lấp, xe ùn tắc phía sau [B·baophapluat.vn] · Trọng điểm bắn phá của máy bay [B·baophapluat.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết

**Rừng bị rải chất độc và bom (Trường Sơn Bắc)**
- mật độ, license: Bạch Mã: diện tích rừng lớn bị chất làm rụng lá, bom và máy hạng nặng phá hủy [A·thiennhienviet.org.vn] · Đakrông: chất làm rụng lá là yếu tố chính làm suy giảm, chia cắt rừng [A·thiennhienviet.org.vn] · Bắc Hướng Hóa: bị phun rải từ máy bay trong chiến tranh [A·locjkt.or.id] · Phong Nha: phần lớn rừng nguyên sinh bị cháy hư hại nặng trong chiến tranh [A·thesalmons.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Rừng dọc tuyến Trường Sơn**
- độ cao: Núi hiểm trở 500–2.400 m [B·en.wikipedia.org]
- hình thái, màu: Tre mọc dày ở độ cao thấp dưới tán; trên khoảng 730 m (2.400 ft) là cây thường xanh cao vút [A·apps.dtic.mil] · Suối chảy xiết khoét đá vôi thành hang và cột karst [A·apps.dtic.mil] · Rừng ba tầng tán; trực thăng cứu hộ không thấy được người dưới đất [B·airandspaceforces.com]
- mùa, thời tiết: Gió mùa tây nam (giữa tháng 5 – giữa tháng 9) mưa nặng, trời thường u ám [B·en.wikipedia.org] · Mùa khô (giữa tháng 10 – giữa tháng 3) tương đối khô, mát hơn [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, kích thước, hành vi, âm thanh, mật độ, license

**Rừng trúng chất độc da cam**
- tên khoa học: Agent Orange (2,4-D + 2,4,5-T), vừa làm rụng lá vừa diệt cây lá rộng và thân gỗ [A·nal.usda.gov]
- phân bố: Thung lũng A Lưới bị phun nặng khoảng 1965–1970, chủ yếu chất da cam [A·hatfieldgroup.com] · Không quân Mỹ phun rải dọc đường mòn ở Lào từ 12/1965 [B·en.wikipedia.org]
- kích thước: Vệt phun rõ nét rộng khoảng 85 m, dài 15 km [A·nal.usda.gov]
- hình thái, màu: Phun vào rừng ba tầng, thuốc thường tan ở tán trên; rừng như vậy thường tái sinh nhanh [B·cia.gov] · Ven đường Huế – A Lưới: sườn đồi trơ trụi phía trước, rừng không bị phun phía sau [A·hatfieldgroup.com] · Mất rừng giữ đất, sạt lở nhiều dọc đường vào A Lưới [A·hatfieldgroup.com] · Cây chết đứng do chiến tranh còn thấy nhiều nơi [A·digitalrepository.unm.edu]
- mùa, thời tiết: Lá rụng 3–6 tuần sau khi phun; cây sống sót ra lá lại trong vòng một năm [A·nal.usda.gov] · Rụng lá, hoa, quả trong 2–3 tuần sau phun [C·chm.bris.ac.uk]
- mật độ, license: Phun một lần chết 10–20% cây gỗ; hai lần liên tiếp chết 50–100% [A·nal.usda.gov] · Vùng bị phun nặng: 85–100% cây gỗ chết [A·digitalrepository.unm.edu] · Đến giữa 1966 ước 1.500 km đường bị phun 200.000 gallon thuốc diệt cỏ [B·environmentandsociety.org]
- honest-null: độ cao, hành vi, âm thanh

**Săn bắn và bẫy thú**
- mật độ, license: săn bắn là đe doạ lớn nhất ở Phong Nha–Kẻ Bàng; săn linh trưởng không bền vững [A·thiennhienviet.org.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Thảm bom B-52**
- kích thước: Một phi đội rải kín một khu khoảng 1.100 × 2.200 yard (≈1 × 2 km) [C·war-stories.com] · B-52 bay theo tốp 3 chiếc gọi là 'cell' [B·en.wikipedia.org] · B-52D mang 108 quả bom 500 lb, hoặc 84 quả 500 lb + 24 quả 750 lb [B·en.wikipedia.org]
- hình thái, màu: Thảm bom xẻ thành rãnh dài qua rừng cây cao cỡ nhà 20 tầng, dài khoảng 1,5 dặm [C·war-stories.com]
- hành vi, âm thanh: Thả từ tầng bình lưu, dưới đất không thấy không nghe máy bay [B·en.wikipedia.org] · Sóng xung kích bom 750 lb giết người trong hầm ngay tức khắc [C·themightyninth.sdsu.edu]
- mật độ, license: Trọng điểm A-T-P (Đường 20) bị B-52 rải thảm 2.450 lần [B·sggp.org.vn] · Đường 20: mỗi ngày khoảng 30 lần B-52, 50 lần cường kích [C·nguoiquansat.vn]
- honest-null: tên khoa học, phân bố, độ cao, mùa, thời tiết

**Trảng cỏ thoái hoá sau chiến tranh**
- hình thái, màu: Vùng hư hại nặng thay bằng gần như toàn cỏ thân thảo [A·digitalrepository.unm.edu] · Cỏ xâm lấn chiếm chỗ, ngăn rừng tái sinh sau rửa trôi đất mặt [B·pulitzercenter.org] · Sau phun nhẹ là cây gỗ thấp; sau phun nặng là trảng cỏ thoái hoá [A·openvault.wgbh.org]
- mùa, thời tiết: Trảng cỏ cháy định kỳ, có lẽ hằng năm, nên không trở lại rừng [A·openvault.wgbh.org]
- mật độ, license: Vùng phun ghi nhận cỏ tăng, dự báo tre cũng tăng [A·nal.usda.gov]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh

**Trọng điểm (tọa độ lửa)**
- hình thái, màu: Đồi bị bạt thấp, mặt đường cày xới, cây cháy rụi, rừng già thành đồi trọc [B·baolaichau.vn] · Cảnh hoang tàn như vùng đất chết [B·baolaichau.vn] · Ban đêm pháo sáng sáng rực suốt đêm [B·sggp.org.vn] · Núi rừng rực đỏ bởi pháo sáng và bom đạn ban đêm [B·sggp.org.vn] · Mặt đường cày xới, cây cối cháy rụi, đồi bị san phẳng [A·sggp.org.vn] · Rừng núi trơ trụi tan hoang vì bom chà đi xát lại [B·baophapluat.vn]
- mật độ, license: Hàng ngàn trọng điểm, tập đoàn trọng điểm trên mọi đường dọc, ngang [B·vnexpress.net]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết

**Trọng điểm A-T-P (Cà Roòng)**
- phân bố: Nay ở Km 63+900 Tỉnh lộ 562, xã Thượng Trạch, Bố Trạch [B·nhandan.vn]
- mật độ, license: 15 ngày, Mỹ ném 17.625 tấn bom xuống ATP [C·nguoiquansat.vn] · Hơn 10.000 lần ném bom, bắn phá, trong đó 2.450 lần B-52 [B·sggp.org.vn] · Mỗi ngày 30–40 trận, có tuần ném 50.000 quả bom [C·phongnhasmiletravel.com] · Trung bình 2.203 tấn bom mỗi km (2,2 tấn mỗi mét) [B·baovanhoa.vn] · Hơn 10.000 lần ném bom, 2.450 lần B-52 rải thảm (SGGP gán cho ATP) [A·sggp.org.vn]
- honest-null: tên khoa học, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Trọng điểm Trạ Ang**
- phân bố: Đoạn Km12–Km14 đường 20 [C·discoveryhotels.com.vn] · Cửa khẩu Trà Ang ở km 12 và km 16 đường 20 [B·vnexpress.net] · Ngã tư Trạ Ang sau Km 0–Km 15 [B·tuoitre.vn]
- độ cao: Ở điểm cao 150 m, dài 5 km [C·phongnhasmiletravel.com] · Đường vắt trên núi cao 400–600 m nhìn xuống vực Trạ Ang [C·discoveryhotels.com.vn]
- hình thái, màu: Km12 Đường 20, 8/1968: đỉnh núi sụp, lòng đường hiện ra dưới pháo sáng [B·sggp.org.vn] · Có cầu Trạ Ang bắc qua suối cùng tên; xăng được kéo ngược suối Trà Ang [B·vnexpress.net]
- mật độ, license: Bị đánh liên tục 87 ngày đêm, có ngày 27 B-52 và 30 máy bay khác [C·discoveryhotels.com.vn]
- honest-null: tên khoa học, kích thước, hành vi, âm thanh, mùa, thời tiết

**Trực thăng trên chiến trường Đường 9**
- hành vi, âm thanh: Trực thăng bị bắn bốc cháy quầng lửa đỏ, mảnh đạn văng vù vù [A·baohatinh.vn]
- mùa, thời tiết: Sáng 13/2/1971 bầu trời rợp máy bay địch [A·baohatinh.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, mật độ, license

**Võng và tăng bộ đội**
- hình thái, màu: Trang bị: quần áo gabađin, AK47, mũ cối, mũ tai bèo, tăng, võng bạt [A·baoquocte.vn] · Bọc võng bằng vải dù pháo sáng lót dưới lưng cho ấm [A·sggp.org.vn]
- hành vi, âm thanh: Trinh sát leo lên cây cao mắc võng ngủ [B·sggp.org.vn]
- mùa, thời tiết: Được hướng dẫn mắc võng tránh mưa rừng [A·baoquocte.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, mật độ, license

**Đèo Ban Karai**
- phân bố: 17°19′48″B 106°12′7″Đ, biên giới Việt–Lào, ~60 km tây nam Đồng Hới [B·en.wikipedia.org]
- độ cao: 418 m (trùng số với Mụ Giạ trên Wikipedia, cần kiểm) [B·en.wikipedia.org]
- mật độ, license: 19/4–24/6/1968 chiến dịch Turnpike, có B-52 [B·en.wikipedia.org]
- honest-null: tên khoa học, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Đèo Mụ Giạ**
- phân bố: 17°39′53″B 105°45′45″Đ, ~90 km tây bắc Đồng Hới; nối QL15 (Tân Ấp) với đường 12 Lào [B·en.wikipedia.org]
- độ cao: 418 m [B·en.wikipedia.org]
- hình thái, màu: Bên trái đỉnh đá vôi răng cưa, bên phải cao nguyên đỉnh bằng [B·en.wikipedia.org] · Rừng mưa nhiệt đới rậm phủ kín, gần như cản trinh sát đường không [B·en.wikipedia.org]
- mật độ, license: 12/4/1966: 29 B-52 lần đầu đánh đèo [B·en.wikipedia.org]
- honest-null: tên khoa học, kích thước, hành vi, âm thanh, mùa, thời tiết

**Đèo Phu La Nhích**
- hình thái, màu: Đèo bị bóc hết cây, hàng ngàn mét đường khoét sâu vào taluy [C·nguoiquansat.vn] · Dốc dựng đứng [B·baovanhoa.vn] · Nằm trong bối cảnh núi đá vôi karst [C·thehochiminhtrail.com]
- mật độ, license: Gần 10.000 lần đánh phá, khoảng 2.450 lần B-52 (Báo Pháp luật gán riêng cho đèo) [B·baophapluat.vn] · Mỗi người chốt giữ hứng bình quân ~1.900 quả bom [B·baophapluat.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết

**Đường 20 Quyết Thắng**
- phân bố: Từ Phong Nha bên sông Son đến ngã ba Lùm Phùm [C·nguoiquansat.vn] · Từ Phong Nha (Quảng Bình) sang ngã ba Lùm Bùm (Nam Lào) [B·baophapluat.vn] · Km 00 ở thôn Phong Nha, xã Sơn Trạch, Bố Trạch; nối đường 9 qua ngã ba Lùm Bùm (Khăm Muộn, Lào) [C·phongnhasmiletravel.com] · Km 0 cách di tích phà Xuân Sơn chừng 2 km ngược lên [B·tuoitre.vn] · Nằm giữa đường 12 (phía bắc) và đường 18 (phía nam) [C·thehochiminhtrail.com]
- kích thước: Đoạn đường 20 hiện dài khoảng 70 km [C·nguoiquansat.vn] · Dài 125 km, trong đó hơn 40 km qua núi đá [B·baophapluat.vn] · Dùng 270 tấn TNT, phá hơn 1 triệu m3 đá [B·baophapluat.vn]
- hình thái, màu: Công binh nối 3 thang tre leo vách đá để đục lỗ đặt mìn [B·baophapluat.vn] · Km 12: bom, tên lửa bắn vào vách đá dựng đứng cho sập núi lấp đường [B·baophapluat.vn] · Không phải một đường mà nhiều đường, có đường tránh và đường K bí mật [C·thehochiminhtrail.com] · Bối cảnh núi đá vôi karst bao quanh đèo Phu La Nhích [C·thehochiminhtrail.com] · Các trọng điểm: Km 00 đến Km 10, Km 14 (cùng Trà Ang, ATP) [C·phongnhasmiletravel.com] · Trọng điểm: ngầm Trạ Ang, Km14, Km16, phà Xuân Sơn [B·baovanhoa.vn] · Trọng điểm: dốc Ba Thang, tổng kho NH, hang Thông Tin, hang Y Tá [B·tuoitre.vn] · Điểm thi công khó: dốc Đồng Tiền, U Bò, Khe Diêm [B·baovanhoa.vn] · Sông Chà Là, Ta Lê nước chảy rất xiết; đèo Phu La Nhích dốc dựng đứng [B·baovanhoa.vn] · Hang động, vách đá cải tạo thành nơi cất vũ khí, hàng [C·heritagevietnamairlines.com]
- mùa, thời tiết: Khởi công tháng 12/1965 bằng loạt bộc phá hạ dốc Ba Thang [C·phongnhasmiletravel.com] · Khai thông ngày 5/5/1966 [C·phongnhasmiletravel.com] · Hai mũi thi công gặp nhau tại Km65 ngày 14/4/1966 [B·baovanhoa.vn] · Thời gian thi công: kế hoạch 105 ngày [B·baophapluat.vn] · Thời gian thi công: 127 ngày [C·phongnhasmiletravel.com] · Hai hướng gặp nhau tại km 65 biên giới Việt–Lào sau 77 ngày đêm [B·baophapluat.vn] · Đường mở thường bị ngập nước mùa mưa [B·baophapluat.vn]
- mật độ, license: Trục ngang có mật độ bom trên 1 km đường cao nhất Trường Sơn [C·nguoiquansat.vn] · Mật độ bom trên 1 km đường thuộc loại cao nhất Trường Sơn [B·baovanhoa.vn] · Tên lóng "Sa mạc lửa", bị ném bom ngày đêm [C·thehochiminhtrail.com]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh

**Đường 9**
- độ cao: Dãy đồi phía bắc Đường 9: nhiều đỉnh 500–850 m [A·apps.dtic.mil]
- hình thái, màu: Đầu 1971 hư hỏng nặng, chỉ xe xích và jeep đi được [B·en.wikipedia.org] · Mặt đường lỗ chỗ, ổ gà xói, cỏ mọc kín từng đoạn, đá lở lấp một phần [A·usmcu.edu] · Khói, bụi và mù che tầm quan sát trên không [B·en.wikipedia.org] · Đường đất một làn, mặt gồ ghề, cầu cống bị phá [A·apps.dtic.mil] · Đường đất một làn bỏ hoang 40 năm, lề cao hai bên, không chỗ xoay xở [B·warfarehistorynetwork.com] · Rừng rậm hai bên đường [A·apps.dtic.mil] · Thung lũng Sê Pôn tương đối bằng, cây bụi xen mảng rừng lớn; núi cao phía bắc và nam [B·warfarehistorynetwork.com] · Quanh Sê Pôn địa hình thấp, cây thưa [A·apps.dtic.mil] · Đường bị vách núi cao phía nam khống chế, dễ bị chặn [A·apps.dtic.mil] · Vùng núi Quảng Trị: rừng hai–ba tầng tán, tầng dưới rất rậm; trung du khô, cây không cao quá đầu người [A·apps.dtic.mil] · Trung du khô cằn, cây không cao quá đầu người [A·apps.dtic.mil] · Bãi đáp trực thăng tự nhiên hiếm, thường bị phòng thủ [B·en.wikipedia.org] · Cây bụi rậm dọc đường; đường xấu, mưa lớn cản hành quân [A·ac119gunships.com] · Các bãi đáp trên sống núi cao phía nam, nhìn xuống Đường 9 [A·ac119gunships.com]
- mùa, thời tiết: Mùa mưa (tháng 6–11) đường thường không đi được [A·usmcu.edu]
- mật độ, license: Cuối chiến dịch: Đường 9 ngổn ngang xe tăng, xe cộ hỏng cháy [B·historynet.com]
- honest-null: tên khoa học, phân bố, kích thước, hành vi, âm thanh

**Đường xe Trường Sơn**
- kích thước: Đường đất rộng 5,5 m (18 ft), có đoạn rải sỏi hoặc lát gỗ ngang [B·en.wikipedia.org] · Đường ngụy trang rộng 18 ft [B·historynet.com] · Đến cuối chiến tranh: 5 trục dọc, 21 trục ngang, tổng 20.000 km [B·vnexpress.net]
- hình thái, màu: Đường dã chiến thiếu đường rải đá, mặt cứng [B·vnexpress.net] · Đoạn đường một bên vách đá dựng đứng, một bên vực sâu [A·baophapluat.vn] · Hang trong vách đá được công binh cải tạo làm chỗ xe tránh máy bay [A·baophapluat.vn] · Có đường tránh, đường song song vòng qua trọng điểm [B·vnexpress.net] · Lát đá làm mặt đường trong bom đạn, kiểm tra ban đêm bằng đèn dầu [B·sggp.org.vn] · Trọng điểm thường là núi cao, cua gấp, đường độc đạo [A·baophapluat.vn] · Một bên vách ta-luy đá tai mèo, một bên thung lũng sâu [B·baophapluat.vn] · Đường rẽ ngoặt sang hai bên để lái xe né, đánh lừa máy bay [A·baophapluat.vn] · Dùng xe ủi đẩy bom nổ chậm xuống vực; mặt đường lấp ~500 m3 đá [B·baophapluat.vn]
- hành vi, âm thanh: Xe chạy đêm, ngày vào hang hoặc rừng rậm ẩn [A·baophapluat.vn] · Trăng sáng thì không bật đèn gầm; qua sông, lên dốc tắt hết đèn [B·baolaichau.vn] · Qua sông tắt đèn vì ánh sáng phản chiếu mặt nước [B·baolaichau.vn] · Xe bắt đầu chạy ngay sau hoàng hôn, thưa dần 3–6 giờ sáng [B·historynet.com] · Đêm có trăng sao tắt hết đèn, đêm tối trời chỉ bật đèn gầm [A·baophapluat.vn] · Mỗi ngày một lái xe thường chỉ chạy được 1 chuyến [A·sggp.org.vn]
- mùa, thời tiết: Mùa mưa biến đường mòn thành bùn, suối tràn bờ [A·apps.dtic.mil] · Mùa khô (khoảng tháng 11–4) mới thi công lớn được [A·apps.dtic.mil] · Mùa mưa đường đất nhầy nhụa, mùa khô nắng cháy, gió Lào [B·dantri.com.vn]
- honest-null: tên khoa học, phân bố, độ cao, mật độ, license

**Đường ống xăng dầu Trường Sơn**
- kích thước: Ống nhựa, có trạm bơm nhỏ; 4 tuyến, lớn nhất đường kính 20 cm [B·en.wikipedia.org] · Xăng bọc túi nilon 20 lít, cõng qua trọng điểm [B·special.nhandan.vn]
- hình thái, màu: Ống và trạm bơm chôn ngầm hoặc giấu trong hang; qua suối cố định như cầu treo [B·special.nhandan.vn] · Có chỗ nối bằng ống lồ ô khoét rỗng; bể chứa là phuy 200 lít trên đỉnh đèo [B·vnexpress.net] · Ban đầu ống tôn cuộn nối chốt cao su [B·special.nhandan.vn]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Đồi Không Tên (Cha Phi)**
- phân bố: Ngã ba Cha Phi, án ngữ Đường 16 xuống cụm cứ điểm Bản Đông [A·baohatinh.vn]
- hình thái, màu: Xác trực thăng Mỹ bị bắn rơi nằm trên đồi [A·baohatinh.vn]
- hành vi, âm thanh: Trực thăng bay rà thấp, gió cánh quạt làm nghiêng ngả ngọn cây [A·baohatinh.vn]
- honest-null: tên khoa học, độ cao, kích thước, mùa, thời tiết, mật độ, license


### asset_nguon (202)

**Artlist Vietnam Ambiences (Echoto Sound)**
- hành vi, âm thanh: Rừng có vượn hót và ve sầu kêu; rừng chạng vạng có chim và ve [A·artlist.io]
- mật độ, license: Giấy phép Artlist Pro: game/app cần giấy phép doanh nghiệp riêng [A·help-center.artlist.io]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, mùa, thời tiết

**BOOM Library Tropical Jungle**
- hành vi, âm thanh: Có khỉ rú (howler monkey, loài châu Mỹ): không đúng Đông Nam Á [B·thomannmusic.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, mùa, thời tiết, mật độ, license

**Blender Sapling Tree Gen (cộng đồng Blender)**
- mật độ, license: Add-on GPL v3 trở lên, cho Blender 4.4+, hỗ trợ hạn chế [A·extensions.blender.org] · Đầu ra tạo trong Blender thuộc sở hữu người dùng [A·blender.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**BlenderKit Ancient Banyan Tree Trunk Scan (Scarit Editz)**
- tên khoa học: Đa (banyan, chi Ficus); trang không ghi loài cụ thể [A·blendkit.com]
- kích thước: 1.416.713 poly; file 564,8 MiB (rất nặng cho web) [A·blendkit.com]
- hình thái, màu: Photoscan gốc đa cổ thụ: vân vỏ, rễ, rêu nhẹ [A·blendkit.com]
- mật độ, license: Royalty free, miễn phí (rủi ro trích xuất trên web) [A·blendkit.com]
- honest-null: phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**BlenderKit Bamboo Trees (Jan Hecl)**
- kích thước: 108.937 poly; 56,1 MiB [A·blendkit.com]
- hình thái, màu: Bụi tre thực tế, lá xanh tươi [A·blendkit.com]
- mật độ, license: Royalty free, miễn phí; mô tả nói hợp môi trường game [A·blendkit.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**BlenderKit Banyan Tree (REAL SCANS, 204.774 poly)**
- kích thước: 204.774 poly; 37,0 MiB [A·blendkit.com]
- hình thái, màu: Scan hai đoạn cây đa, hệ rễ phức tạp, vỏ sần [A·blendkit.com]
- mật độ, license: Royalty free, miễn phí [A·blendkit.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**BlenderKit Banyan Tree (REAL SCANS, 53.777 poly)**
- phân bố: Mô tả hướng tới cảnh rừng nhiệt đới; không ghi nơi chụp [A·blendkit.com]
- kích thước: 53.777 poly; 22,0 MiB [A·blendkit.com]
- hình thái, màu: Scan gốc đa trưởng thành, lưới rễ khí sinh buông dày, hệ rễ toả trên mặt đất [A·blendkit.com]
- mật độ, license: Royalty free, miễn phí [A·blendkit.com]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết

**BlenderKit Banyan Tree Trunk With Roots (REAL SCANS)**
- kích thước: 265.637 poly; 40,6 MiB [A·blendkit.com]
- hình thái, màu: Scan đoạn dưới thân đa, mạng rễ khí sinh, gốc phong hoá [A·blendkit.com]
- mật độ, license: Royalty free, miễn phí [A·blendkit.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**BlenderKit Ceiba Tree (Jordi Se-Cam)**
- tên khoa học: Ceiba (cây bông gòn rừng, kapok); tag 'amazona' gợi gốc Amazon [A·blendkit.com]
- phân bố: Kiểu Amazon (Nam Mỹ) theo tag; dáng cây vượt tán có thể mượn tạm [A·blendkit.com]
- kích thước: Cao 25 m; 533.080 poly; 194,6 MiB [A·blendkit.com]
- hình thái, màu: Cây rừng lớn có lớp texture rêu [A·blendkit.com]
- mật độ, license: Royalty free, miễn phí [A·blendkit.com]
- honest-null: độ cao, hành vi, âm thanh, mùa, thời tiết

**BlenderKit Rocks, Tree Roots In Forest (EB Adventure Photoscans)**
- phân bố: Photoscan rừng mưa ôn đới British Columbia, Canada (không phải nhiệt đới) [A·blendkit.com]
- kích thước: 349.849 poly; 386,5 MiB [A·blendkit.com]
- hình thái, màu: Đá và rễ cây trên lối mòn rừng mưa [A·blendkit.com]
- mật độ, license: Royalty free [A·blendkit.com]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết

**BlenderKit Tall Forest Fern (Crazy0_0Cat)**
- kích thước: Trang ghi 64 poly (nghi lỗi số liệu); 8,7 MiB [A·blendkit.com]
- mật độ, license: Royalty free; trang hiện cả nhãn Free và Full Plan (mâu thuẫn) [A·blendkit.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**BlenderKit Tree Fern Large (Amanpreet Bajwa)**
- kích thước: 48.755 poly; 16,6 MiB; PBR [A·blendkit.com]
- hình thái, màu: Dương xỉ thân gỗ lớn, PBR, tối ưu [A·blendkit.com]
- mật độ, license: Royalty free, miễn phí [A·blendkit.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Chương trình Fab Limited-Time Free**
- mật độ, license: Đợt 6 đến 20/10/2026: Ready Map Vol 2, AdaptivePathfindingSystem, Stylized Harvest Farm; không có gói rừng nhiệt đới [A·fab.com] · Đợt 8 đến 22/9/2026 có Sharur's Normandy Village + PCG Plants (cây châu Âu) [C·forums.unrealengine.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Danh mục Atlas ambientCG**
- kích thước: 61 atlas; nhóm lá gồm Foliage001–008 và LeafSet001–030 [A·ambientcg.com]
- hình thái, màu: Atlas lá là texture (ảnh PBR), không phải mesh 3D; tag chủ yếu lá ôn đới (maple, ivy, needles, autumn) [A·ambientcg.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**EZ-Tree (Daniel Greenheck)**
- hình thái, màu: Chỉ hai kiểu cây: rụng lá (deciduous) và thường xanh (evergreen); lá/vỏ mặc định kiểu Oak [A·github.com]
- mật độ, license: Mã nguồn MIT [A·github.com] · Web app xuất .PNG hoặc .GLB; gói npm @dgreenheck/ez-tree [A·github.com] · README không ghi nguồn/giấy phép texture lá, vỏ (honest-null, phải kiểm trước khi dùng) [A·github.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết

**Echoto Jungle Adventure Vietnam**
- hành vi, âm thanh: Vượn đực hót, góc gần, nền rừng nhẹ [B·asoundeffect.com] · Ve sầu tần số cao, mic gần, tách riêng [B·asoundeffect.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, mùa, thời tiết, mật độ, license

**Evermotion Standard Licence**
- mật độ, license: Cho phép dùng để tạo trò chơi máy tính và phần mềm [A·evermotion.org] · Cấm đặt file chứa sản phẩm tách rời được lên website/máy chủ để bên thứ ba lấy: rủi ro với game web tải GLB [A·evermotion.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab AD Dipterocarpus turbinatus Trunk 01 (anydrafts official)**
- tên khoa học: Dipterocarpus turbinatus (dầu rái) [A·fab.com]
- kích thước: Đoạn thân/gốc 233 x 219 x 296 cm, texture 8K, có HIGH và LOD0 đến LOD5 [A·fab.com] · Kích thước vật lý 233*219*296 cm [A·fab.com] · Giá từ 2,99 USD [A·fab.com]
- mật độ, license: Định dạng Blender và fbx; Generated with AI: No (trang không nói photoscan) [A·fab.com]
- honest-null: phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Alexandra Palm (Quixel Megascans)**
- phân bố: Cau Alexandra (Archontophoenix, gốc Úc): cọ cảnh quan ven biển, không phải loài Trường Sơn [A·fab.com]
- kích thước: Miễn phí [A·fab.com]
- mật độ, license: Định dạng fbx, gltf [A·fab.com]
- honest-null: tên khoa học, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Alocasia macrorrhiza Elephant Ears (3DTree)**
- tên khoa học: Alocasia macrorrhiza (ráy) [A·fab.com]
- kích thước: Giá từ 11,99 USD [A·fab.com]
- mật độ, license: Định dạng fbx và GLB/glTF chuyển đổi [A·fab.com]
- honest-null: phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Ancient Banyan Tree Pack (WonderFuel)**
- kích thước: 19 asset, low-poly 9.000 đến 28.000 tam giác, FBX + GLB; giá từ 18,99 USD [A·fab.com] · Giá từ 18,99 USD [A·fab.com]
- hình thái, màu: Biến thể đa: bóp cổ (Strangler Fig), rễ phụ cao, cây đổ, phủ rêu [A·fab.com]
- mật độ, license: Nhãn Generated with AI có giá trị Yes (dòng kế tiếp trong snapshot); phong cách stylized/fantasy [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Fab Arjun Tree with Buttressed Roots (Vfx shashwat)**
- tên khoa học: Terminalia arjuna (chi Chiêu liêu, gốc Ấn Độ) [A·fab.com]
- kích thước: Giá từ 24,99 USD [A·fab.com]
- hình thái, màu: Gốc có rễ bạnh rõ, tán tròn nhiều tầng lá bóng [A·fab.com]
- mật độ, license: Định dạng obj, glb, fbx; mô tả còn nguyên chỗ trống mẫu "[confirm before listing]": cảnh báo chất lượng [A·fab.com]
- honest-null: phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Fab Asplenium Nidus Bird's Nest Fern (3DTree)**
- tên khoa học: Asplenium nidus (tổ chim) [A·fab.com]
- phân bố: Có tag "Vietnam" [A·fab.com]
- kích thước: Giá từ 10,99 USD [A·fab.com]
- mật độ, license: Định dạng fbx và GLB/glTF chuyển đổi [A·fab.com]
- honest-null: độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Bamboo Bambusa lako (3DTree)**
- tên khoa học: Bambusa lako (tre Timor, Đông Nam Á hải đảo) [A·fab.com]
- kích thước: Giá từ 8,99 USD [A·fab.com]
- mật độ, license: Định dạng fbx và GLB/glTF chuyển đổi [A·fab.com]
- honest-null: phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Banana Tree (Inventive World)**
- mật độ, license: Định dạng obj, fbx, glb, usdz [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Banyan Tree with Aerial Roots (Vfx shashwat)**
- tên khoa học: Ficus benghalensis (đa) [A·fab.com]
- phân bố: Mô tả hướng tới môi trường Nam/Đông Nam Á [A·fab.com]
- kích thước: Giá từ 40,99 USD [A·fab.com]
- hình thái, màu: Tán dày, mạng rễ phụ thõng xuống dày đặc [A·fab.com]
- mật độ, license: Định dạng glb, fbx, obj; trang ghi Generated with AI: No [A·fab.com]
- honest-null: độ cao, hành vi, âm thanh, mùa, thời tiết

**Fab Beech Fern (Quixel Megascans)**
- kích thước: From Free (dương xỉ ôn đới) [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Fab Broadleaf Lady Palm (Quixel Megascans)**
- tên khoa học: Cọ lá rộng lady palm (thường là Rhapis excelsa, trang không ghi Latin) [A·fab.com]
- kích thước: Từ 3,99 USD [A·fab.com]
- mật độ, license: Định dạng fbx, gltf [A·fab.com]
- honest-null: phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Caryota mitis Fishtail Palm Tukas (3DTree)**
- tên khoa học: Caryota mitis (đùng đình) [A·fab.com]
- kích thước: Giá từ 10,99 USD; không ghi poly/LOD [A·fab.com]
- mật độ, license: Định dạng fbx và GLB/glTF chuyển đổi [A·fab.com]
- honest-null: phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Chinese Banyan Tree #01 (Antonio Kowatsch)**
- kích thước: Giá từ 14,99 USD mỗi cây (#01 đến #10) [A·fab.com]
- mật độ, license: Định dạng fbx và GLB/glTF chuyển đổi [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Chinese Fan Palm (Quixel Megascans)**
- tên khoa học: Cọ quạt Trung Hoa (Livistona chinensis theo tên thường, trang không ghi tên Latin) [A·fab.com]
- kích thước: Từ 3,99 USD [A·fab.com]
- mật độ, license: Định dạng fbx, gltf [A·fab.com]
- honest-null: phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Coconut (Quixel Megascans)**
- kích thước: From Free [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Fab Common Fern (Quixel Megascans)**
- kích thước: Từ 3,99 USD [A·fab.com]
- mật độ, license: Định dạng fbx, gltf [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Cyathea cooperi Australian Tree Fern 01 (3DTree)**
- tên khoa học: Cyathea cooperi (dương xỉ thân gỗ Úc, cùng chi với loài VN) [A·fab.com]
- kích thước: Giá từ 8,99 USD [A·fab.com]
- mật độ, license: Định dạng fbx và GLB/glTF chuyển đổi; Generated with AI: No [A·fab.com]
- honest-null: phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Fan Palm Stems (Quixel Megascans)**
- kích thước: Vùng scan 0,41 x 0,41 m, texel 9990 px/m [A·fab.com]
- mật độ, license: Chỉ là texture set (atlas cuống lá cọ quạt), không có mesh 3D [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Ficus Microcarpa Tree Trunk (Quixel Megascans)**
- tên khoa học: Ficus microcarpa (si, gừa) [A·fab.com]
- kích thước: Thân/gốc si 0,82 x 1,49 x 2,31 m, texel 5751 px/m; từ 2,99 USD [A·fab.com]
- hình thái, màu: Thân cây lớn phủ rêu, tag Tropical/Subtropical, photoscan [A·fab.com]
- mật độ, license: Định dạng fbx, gltf, GLB chuyển đổi [A·fab.com]
- honest-null: phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Fab Ficus benghalensis (3DTree)**
- tên khoa học: Ficus benghalensis [A·fab.com]
- kích thước: Giá từ 10,99 USD; không ghi poly [A·fab.com]
- mật độ, license: Định dạng fbx (3ds Max) và GLB/glTF chuyển đổi; hướng archviz (Vray/Corona) [A·fab.com]
- honest-null: phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Foliage VOL.42 Dicranopteris Ferns (Dekogon Studios)**
- tên khoa học: Dicranopteris (guột, dương xỉ đất trống phổ biến ở Việt Nam) [A·fab.com]
- kích thước: 13 mesh, texture 4K, dựng Nanite (poly cao); giá từ 12,99 USD [A·fab.com]
- mật độ, license: Định dạng chỉ "Unreal Engine", tối ưu Nanite: không hợp web [A·fab.com]
- honest-null: phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Lady Fern (Quixel Megascans)**
- phân bố: Dương xỉ ôn đới (lady fern), có tag "Jungle" nhưng không phải loài Đông Nam Á [A·fab.com]
- kích thước: Miễn phí [A·fab.com]
- mật độ, license: Định dạng fbx, gltf; Fab Standard License [A·fab.com]
- honest-null: tên khoa học, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Large Fallen Tree (Quixel Megascans)**
- phân bố: Tag gồm cả Temperate và Jungle: nguồn gốc vùng không ghi [A·fab.com]
- kích thước: Miễn phí; thân đổ 1,5 x 7,11 x 2,38 m; mật độ texel 5476 px/m [A·fab.com] · Giá: Free [A·fab.com]
- hình thái, màu: Thân cây lá rộng đổ, phủ rêu, mục, khô; photoscan [A·fab.com]
- mật độ, license: Định dạng fbx, gltf, bản chuyển GLB/glTF/USDZ: dùng được cho three.js [A·fab.com]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết

**Fab Licuala Palm Tree Pack (Srayt)**
- kích thước: 3 mẫu, khoảng 200k poly mỗi cây, film-ready; texture PNG 2k/4k; giá từ 8,99 USD [A·fab.com]
- mật độ, license: Định dạng fbx, usd, Blender; tác giả nói không thân thiện engine thời gian thực [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Long Liana Stem (Quixel Megascans)**
- kích thước: Thân dây leo dài 2,32 m; texel 5493 px/m; danh mục ghi "From Free" [A·fab.com] · Giá trên trang danh mục: From Free [A·fab.com]
- hình thái, màu: Thân dây leo gỗ, rêu, nhám, tag Tropical/Vine [A·fab.com]
- mật độ, license: Định dạng fbx, gltf, GLB chuyển đổi; có bậc UEFN Reference [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Fab Megaplants (Quixel Megaplants)**
- phân bố: Bộ đầu (11/2025) gồm 5 loài châu Âu: Black Alder, Norway Maple, Common Hazel, European Aspen, European Beech [B·80.lv] · Loài phát hành 2026 phần lớn ôn đới (Silver Birch, Norway Spruce, Japanese Cypress...) [A·quixel.com]
- mật độ, license: Thiết kế cho Procedural Vegetation Editor của UE 5.7: gắn chặt Unreal [A·quixel.com] · Megaplants mới từ 7/2026 chỉ tương thích UE 5.8 trở lên [A·quixel.com]
- honest-null: tên khoa học, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Megaplants: Giant Bamboo (Quixel Megaplants)**
- tên khoa học: Dendrocalamus giganteus (mai/luồng khổng lồ, tre Đông Nam Á) [A·fab.com]
- kích thước: Miễn phí [A·fab.com]
- hình thái, màu: Photogrammetry, gồm mesh cành lá, texture, material instance và preset PVE [A·fab.com]
- mật độ, license: Định dạng chỉ "Unreal Engine": KHÔNG dùng được cho three.js [A·fab.com]
- honest-null: phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Fab Military Trench Megascans Sample (Quixel Megascans)**
- kích thước: Miễn phí [A·fab.com]
- hình thái, màu: Chiến hào: gỗ súc, bao cát, ván, ụ đất, dây thép gai (photogrammetry) [A·fab.com]
- mật độ, license: Dự án mẫu chỉ "Unreal Engine"; asset rời thuộc bộ Trenches phải mua lẻ [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Fab Mossy Rock (Quixel Megascans)**
- kích thước: Đá nhỏ 0,43 x 0,43 x 0,35 m, texel 4891 px/m [A·fab.com]
- hình thái, màu: Đá có địa y và rêu, bề mặt nhám [A·fab.com]
- mật độ, license: Định dạng fbx, gltf, GLB chuyển đổi [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Fab Mossy Rock Formation (Quixel Megascans)**
- kích thước: Khối đá lớn 1,63 x 3,28 x 1,41 m, texel 5534 px/m [A·fab.com]
- mật độ, license: Định dạng fbx, gltf, GLB chuyển đổi, UEFN [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Pack 12 Rock Moss RainForest (KidsGame)**
- hình thái, màu: Đá phủ rêu xanh, điêu khắc tay (không phải scan) [A·fab.com]
- mật độ, license: Định dạng chỉ "Unreal Engine"; giá từ 5,99 USD [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết

**Fab Photorealistic Tropical Rainforest Foliage Pack (Ultima Store)**
- kích thước: Giá từ 9,99 USD [A·fab.com]
- mật độ, license: Nhãn "Generated with AI: Yes"; định dạng chỉ Unreal Engine [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Rainforest Assets Pack (Dario E)**
- kích thước: Giá 34,99 USD [A·fab.com]
- mật độ, license: Giấy phép "UE Marketplace License" (chỉ cho Unreal): CẤM theo luật dự án [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Ready Map Vol 2 Bridge Environment (Six Sides Studios)**
- mật độ, license: Định dạng chỉ "Unreal Engine"; cảnh hậu tận thế, thực vật mùa ôn đới [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Realistic Tropical Trees 1 (Defuse Studios)**
- kích thước: 33 mesh cây, mỗi cây 3 LOD; giá từ 9,99 USD [A·fab.com]
- mật độ, license: Định dạng chỉ "Unreal Engine" [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Sago Palm (Quixel Megascans)**
- mật độ, license: Chỉ texture set (atlas lá), không có mesh [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Shorea Roxburghii White Meranti (3DGardenPlants)**
- tên khoa học: Shorea roxburghii (chai/sến trắng, họ Dầu) [A·fab.com]
- kích thước: Low-poly 10.000 đến 100.000 polygon; high-poly 100.000 đến 1.500.000 [A·fab.com] · Giá từ 29,99 USD [A·fab.com]
- mật độ, license: Định dạng fbx, GLB/glTF chuyển đổi, Unreal, 3ds Max, Blender, Maya, C4D [A·fab.com]
- honest-null: phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Subtropical flora (SergeiZhuchenko)**
- kích thước: 71 asset: 8 cây, 6 cọ, 4 chuối, cây bụi [A·fab.com]
- mật độ, license: Định dạng chỉ "Unreal Engine" [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Tree Stump (Quixel Megascans)**
- kích thước: Gốc cây 3,65 x 3,76 x 2,72 m; từ 2,99 USD [A·fab.com]
- mật độ, license: Định dạng fbx, gltf, GLB chuyển đổi [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Tropical Amazon Rainforest Jungle Vegetation (FaxLab3D)**
- phân bố: Chủ đề Amazon, gộp từ dự án Nuke Island/Drift Islands [A·fab.com]
- kích thước: Giá từ 14,99 USD; LOD billboard cho cây xa [A·fab.com]
- mật độ, license: Định dạng chỉ "Unreal Engine" [A·fab.com]
- honest-null: tên khoa học, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Tropical Island Plant Collection (HKhalife)**
- kích thước: Tổng 1.035.377 poly [A·fab.com]
- hình thái, màu: Cọ, chuối, cây bụi hoa (Ixora, Bougainvillea...), lan, dương xỉ: cây vườn đảo [A·fab.com]
- mật độ, license: Định dạng Blender, GLB, glTF, USDZ [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Fab Tropical Palm (Quixel Megascans)**
- kích thước: Từ 3,99 USD [A·fab.com]
- mật độ, license: Định dạng fbx, gltf [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab Tropical South-East Asia Jungle Pack (STF3d)**
- phân bố: Nhắm rừng nhiệt đới Đông Nam Á (tag lại lẫn Africa, Brasil, Caribbean) [A·fab.com]
- kích thước: 82 mesh: chuối, cây, dương xỉ, đá, thân, tre... [A·fab.com] · Phần lớn asset 50 đến 8000 đỉnh (low-poly) [A·fab.com] · Giá từ 50,99 USD [A·fab.com]
- hình thái, màu: Trộn dựng tay và photogrammetry; dây leo, cọ, tre, cây [A·fab.com]
- mật độ, license: Định dạng trên listing chỉ "Unreal Engine": không dùng được trực tiếp cho three.js [A·fab.com]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết

**Fab UCreate Tropical Trees and Palms (MichalSornat)**
- kích thước: 32 mesh, texture 4K, billboard LOD; giá từ 49,99 USD [A·fab.com]
- mật độ, license: Định dạng chỉ "Unreal Engine"; không ghi loài [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Fab tropical Vegetation: Banana Plants (Project Nature)**
- kích thước: Miễn phí; 14 mesh chuối các giai đoạn lớn [A·fab.com]
- hình thái, màu: Từng bộ phận cây được photoscan riêng rồi dựng lại [A·fab.com]
- mật độ, license: Định dạng chỉ "Unreal Engine": free nhưng không dùng được cho three.js [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Freesound**
- mật độ, license: Âm CC0 không có hạn chế [A·freesound.org] · Noncommercial: không được kiếm tiền từ sản phẩm tạo ra, cấm ship trong game thương mại [A·freesound.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Giấy phép BOOM Library**
- mật độ, license: Một người dùng duy nhất, không mở rộng cho công ty [A·boomlibrary.com] · Phải kết hợp với yếu tố khác; cấm dùng 'trần' hay như sản phẩm rời [A·boomlibrary.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Giấy phép BlenderKit (Blendkit)**
- kích thước: Có gói Free Plan và Full Plan (trả phí), Full Plan 2 GB lưu trữ [A·blendkit.com]
- mật độ, license: Chỉ có 2 giấy phép: Royalty Free và CC0; BlenderKit đã đổi tên Blendkit [A·blendkit.com] · Royalty Free: dùng thương mại không ghi công, cấm bán lại asset ở dạng gốc [A·blendkit.com] · Bán game dùng model Blendkit được, NẾU người dùng không trích xuất model dễ dàng [A·blendkit.com] · Asset trong bản phân phối không được để trích xuất trực tiếp: GLB tải qua HTTP trong game web dễ bị lấy ra, nên Royalty Free rủi ro cho three.js [A·blendkit.com] · Asset CC0 trên Blendkit: làm gì cũng được về mặt kỹ thuật [A·blendkit.com] · Trang FAQ không nêu định dạng tải (.blend/FBX/glTF); honest-null, cần Blender để xuất GLB [A·blendkit.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Giấy phép CGTrader Royalty Free**
- mật độ, license: Dùng trong game chỉ khi model nằm trong định dạng độc quyền [A·cgtrader.com] · Phải ngăn người dùng cuối truy cập file model: GLB tải HTTP trong game web khó thoả [A·cgtrader.com] · Model miễn phí theo giấy phép người bán chọn (phải đọc từng trang) [A·cgtrader.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Giấy phép Fab Standard License**
- kích thước: Ngưỡng bậc giá: doanh thu gộp 100.000 USD trong 12 tháng gần nhất [A·dev.epicgames.com]
- mật độ, license: Dùng được với mọi công cụ tương thích, không giới hạn ở Unreal Engine [A·fab.com] · Được phân phối thương mại dự án có tích hợp asset Fab [A·fab.com] · Cấm bán lại hoặc phân phối lại asset dưới dạng rời (standalone) [A·fab.com] · Bậc Reference-Only (UEFN) không cấp file định dạng nguồn, không hợp cho three.js [A·fab.com] · Epic đang loại bỏ dần giấy phép UE Marketplace; sản phẩm mới không phát hành theo giấy phép đó [A·dev.epicgames.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Giấy phép Poly Haven CC0**
- mật độ, license: CC0: dùng mọi mục đích kể cả thương mại, không bắt buộc ghi công [A·polyhaven.com] · CC0: dùng mọi mục đích kể cả thương mại [A·polyhaven.com] · Được phân phối lại, chia sẻ (file GLB nằm lộ trên web không vi phạm) [A·polyhaven.com] · Không bắt buộc ghi công [A·polyhaven.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Giấy phép Sketchfab CC Attribution**
- mật độ, license: Bắt buộc ghi công tác giả ở mọi nơi dùng công khai (trừ CC0) [A·help.sketchfab.com] · Mẫu dòng ghi công CC BY 4.0 [A·help.sketchfab.com] · Được chia sẻ, sửa, dùng nhưng phải ghi công [A·help.sketchfab.com] · Biến thể NonCommercial cấm dùng thương mại (loại) [A·help.sketchfab.com] · Biến thể NoDerivs cấm sửa đổi (loại) [A·help.sketchfab.com] · Biến thể ShareAlike buộc tác phẩm phái sinh cùng license [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Giấy phép Sketchfab Standard**
- mật độ, license: Standard không bắt ghi công (ngoài phạm vi CC0/CC-BY của mũi J, Chủ nhà quyết) [A·help.sketchfab.com] · Dùng toàn cầu mọi loại hình, thương mại hoặc không [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Giấy phép Superhive Standard Royalty-Free**
- mật độ, license: Phân phối lại chỉ khi được phép (w/p); dùng thương mại có; không cần ghi công [A·support.blendermarket.com] · Trang không nói về game hay việc lộ file cho người dùng cuối (honest-null) [A·support.blendermarket.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Giấy phép TurboSquid Standard 3D Model License**
- mật độ, license: Cho phép game web, PC, console, mobile [A·blog.turbosquid.com] · Model phải nằm trong định dạng độc quyền, không mở/nhập được: GLB chuẩn không thoả [A·blog.turbosquid.com] · Cấm đưa file model cho người dùng cuối [A·blog.turbosquid.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Giấy phép ambientCG CC0**
- mật độ, license: Được đưa file thô vào dự án, ví dụ trò chơi điện tử; không bắt buộc ghi công [A·docs.ambientcg.com] · Mọi asset CC0, tự do dùng không ghi công (xác nhận lại trên trang asset 2026-10-10) [A·ambientcg.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Gói Fab FANTASTIC Lost Jungle (Tidal Flask Studios)**
- kích thước: Giá từ 49,99 USD [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Gói Fab Jungle Lowpoly Foliage Pack (Green Stream)**
- kích thước: Giá từ 19,99 USD [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Gói Fab Jungle Pack (A. zoOmika)**
- kích thước: Giá từ 34,99 USD [A·fab.com]
- hình thái, màu: Cây, bụi, dương xỉ, dây leo, đá, tán lá cho rừng rậm [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Gói Fab MW Tropical Rainforest Biome (MAWI United)**
- phân bố: Tag Amazon, Mangrove: thiên về rừng mưa Nam Mỹ [A·fab.com]
- kích thước: Giá từ 324,99 USD [A·fab.com]
- hình thái, màu: Hàng trăm scan thực vật: cây, cây bụi, asset rừng; photogrammetry [A·fab.com]
- mật độ, license: Định dạng chỉ "Unreal Engine" (biome PCG cho UE5) [A·fab.com]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết

**Gói Fab POLYGON Tropical Jungle (Synty Studios)**
- hình thái, màu: Low-poly phong cách: cọ, cây rừng, bụi, dương xỉ, hoa, cỏ, đá, vách, thác [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Gói Fab Rain Forest Pack (Kaizen Digital Interactive)**
- kích thước: Hơn 120 asset, bản đồ mẫu 1 km2, texture tới 4K, Nanite UE 5.1+ [A·fab.com] · Giá từ 79,99 USD [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Gói Fab Tropical Jungle (Dokyo)**
- phân bố: Nguồn thực vật từ Costa Rica (Trung Mỹ), không phải Đông Nam Á [A·fab.com]
- kích thước: Giá từ 9,99 USD [A·fab.com]
- honest-null: tên khoa học, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Gói Fab Tropical Jungle Pack (Kaizen Digital Interactive)**
- phân bố: 63 asset, từ cây đa (banyan) đến dương xỉ, nguồn từ nhiệt đới Đông Nam Á [A·fab.com]
- kích thước: Giá từ 49,99 USD [A·fab.com] · Texture trung bình 2048x2048 [A·fab.com] · Giá từ 49,99 USD [A·fab.com]
- mật độ, license: Định dạng chỉ "Unreal Engine" [A·fab.com]
- honest-null: tên khoa học, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Gói Sonniss GDC Game Audio Bundle**
- mật độ, license: Royalty-free, dùng thương mại, không bắt buộc ghi công, vĩnh viễn [A·sonniss.com] · Không được phân phối dưới dạng file rời hay trong thư viện âm thanh; cấm huấn luyện AI/ML [A·sonniss.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Kenney Nature Kit (Kenney)**
- kích thước: 330 asset [A·kenney.nl]
- mật độ, license: Miễn phí, CC0 [A·kenney.nl]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Laubwerk Plant Kits (Maxon)**
- mật độ, license: Laubwerk đã về Maxon (6/1/2025); cây chỉ phát qua gói Maxon One, sẵn cho Redshift [A·maxon.net]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Macaulay Library**
- mật độ, license: Mọi dùng thương mại cần hợp đồng license, có thể tính phí [A·support.ebird.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Maxtree Plant Models**
- tên khoa học: Vol 36 có Mangifera indica (xoài) [A·maxtree.org]
- kích thước: Từ hàng trăm nghìn tới hàng triệu polygon; giá 125–1.770 USD [A·maxtree.org] · Giá 125–1.770 USD [A·maxtree.org]
- mật độ, license: Theo CG Channel: file được cấp phép dùng thương mại (chưa thấy trang license chính thức) [B·cgchannel.com] · Trang sản phẩm Maxtree: model không dành cho game [A·maxtree.org]
- honest-null: phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Poly Haven Anthurium Botany 01**
- kích thước: 4.134 poly; scan [A·api.polyhaven.com]
- hình thái, màu: Cây bụi lá rộng bóng, ánh ướt, gân lá rõ, mọc thành khóm thấp [A·api.polyhaven.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Bamboo Tunnel (HDRI)**
- hình thái, màu: HDRI đường hầm tre khô giữa trưa, tán vòm dày, nắng ấm lốm đốm [A·api.polyhaven.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Boulder 01 (Rico Cilliers)**
- kích thước: 123.976 poly [A·api.polyhaven.com]
- hình thái, màu: Tảng đá lớn có địa y, phong hoá, dạng vách [A·api.polyhaven.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Brown Mud Rocks 01**
- hình thái, màu: Bùn nâu lẫn sỏi, đá, rêu, cỏ dại; bờ suối, đất ướt [A·api.polyhaven.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Calathea Orbifolia 01 (Rob Tuytel, Rico Cilliers)**
- tên khoa học: Calathea orbifolia (họ Dong Marantaceae, gốc Nam Mỹ) [A·api.polyhaven.com]
- kích thước: 16.688 poly; scan; 8K [A·api.polyhaven.com]
- hình thái, màu: Bụi lá rộng bóng, có gân, hình tim, xanh đậm (gần dáng lá dong) [A·api.polyhaven.com]
- honest-null: phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Dead Tree Trunk (Rob Tuytel)**
- kích thước: 101.802 poly; dài ~3,05 m [A·api.polyhaven.com]
- hình thái, màu: Khúc gỗ chết dài, vỏ nứt mục, vân gỗ rõ, đầu gãy, mảng rêu xanh [A·api.polyhaven.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Dead Tree Trunk 02 (Jenelle van Heerden, Rico Cilliers)**
- kích thước: 155.864 poly; có LOD; dài ~4,05 m, đường kính ~1,06 m [A·api.polyhaven.com]
- hình thái, màu: Thân cây chết mục, khô, vỏ thô, địa y, gốc gãy [A·api.polyhaven.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Dry Branches Medium 01 (Rico Cilliers)**
- kích thước: 16.803 poly [A·api.polyhaven.com]
- hình thái, màu: Cành khô chết, que, nhánh nhỏ [A·api.polyhaven.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Fern 02**
- kích thước: 6.232 poly; scan [A·api.polyhaven.com]
- hình thái, màu: Bốn khóm dương xỉ, lá có răng cưa, xanh lốm đốm [A·api.polyhaven.com]
- mật độ, license: Có bản glTF 1k tải trực tiếp (cùng blend, fbx, usd) [A·api.polyhaven.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Poly Haven Forest Leaves 02**
- hình thái, màu: Nền rừng phủ rêu: mảng rêu gồ, lá rụng, cành nhỏ, mùn [A·api.polyhaven.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Island Tree 01 (Rob Tuytel, Rico Cilliers)**
- phân bố: Cây ven biển dạng đảo (coastal), thân vặn: đúng kiểu 'cành vặn' cần tránh cho cây vượt tán Trường Sơn [A·api.polyhaven.com]
- kích thước: 3.729.692 poly ở bản gốc (quá nặng cho web nếu không decimate); có LOD; texture tối đa 8K [A·api.polyhaven.com] · Hộp bao ~12,5 m cạnh dài nhất (API ghi mm; đơn vị suy ra) [A·api.polyhaven.com]
- hình thái, màu: Thân vặn xoắn, rễ lộ, tán dày uốn theo gió biển (cây ven biển) [A·api.polyhaven.com]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Island Tree 02 (Rob Tuytel, Rico Cilliers)**
- phân bố: Cây ven biển dạng đảo (coastal), thân vặn: đúng kiểu 'cành vặn' cần tránh cho cây vượt tán Trường Sơn [A·api.polyhaven.com]
- kích thước: 1.762.064 poly ở bản gốc (quá nặng cho web nếu không decimate); có LOD; texture tối đa 8K [A·api.polyhaven.com] · Hộp bao ~8,5 m cạnh dài nhất (API ghi mm; đơn vị suy ra) [A·api.polyhaven.com]
- hình thái, màu: Cây đảo nhỏ ven biển, thân vặn phong hoá, tán xanh dày xoè [A·api.polyhaven.com]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Island Tree 03 (Rob Tuytel, Rico Cilliers)**
- phân bố: Cây ven biển dạng đảo (coastal), thân vặn: đúng kiểu 'cành vặn' cần tránh cho cây vượt tán Trường Sơn [A·api.polyhaven.com]
- kích thước: 4.760.490 poly ở bản gốc (quá nặng cho web nếu không decimate); có LOD; texture tối đa 8K [A·api.polyhaven.com] · Hộp bao ~8,5 m cạnh dài nhất (API ghi mm; đơn vị suy ra) [A·api.polyhaven.com]
- hình thái, màu: Cây thấp ven biển bị gió quật, nhiều thân vặn, rễ lộ trên nền cát [A·api.polyhaven.com]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Jacaranda Tree (Rico Cilliers)**
- tên khoa học: Jacaranda (chi Jacaranda, gốc Nam Mỹ; trang không ghi loài) [A·api.polyhaven.com]
- phân bố: Cây Jacaranda (gốc Nam Mỹ), không phải loài Đông Nam Á; dựng tay (Rico Cilliers: All), không phải photoscan [A·api.polyhaven.com]
- kích thước: 312.356 poly; có LOD; texture tối đa 8K [A·api.polyhaven.com] · Hộp bao khoảng 24,2 x 18,0 x 19,8 m (API ghi mm; đơn vị suy ra) [A·api.polyhaven.com]
- hình thái, màu: Tán rộng, lá dày, nhiều thân (multi-trunk), vỏ chi tiết [A·api.polyhaven.com]
- mật độ, license: CC0 Poly Haven; tải được glTF/FBX/blend qua API (script fetch-assets của repo) [A·api.polyhaven.com]
- honest-null: độ cao, hành vi, âm thanh, mùa, thời tiết

**Poly Haven Moss 01 (Rob Tuytel)**
- kích thước: 246.170 poly; geometry nodes [A·api.polyhaven.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Mossy Rock**
- hình thái, màu: Đá phong hoá có vân, nứt, địa y lốm đốm và mảng rêu xanh [A·api.polyhaven.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Mountainside (Dario Barresi, Rico Cilliers)**
- kích thước: 287.755 poly [A·api.polyhaven.com]
- hình thái, màu: Vách núi, mặt đá có địa y, tảng đá, địa hình [A·api.polyhaven.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Pachira Aquatica 01**
- kích thước: 76.914 poly; scan (Rob Tuytel) [A·api.polyhaven.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Rock Face 01 (Dario Barresi)**
- kích thước: 20.174 poly (nhẹ, hợp web) [A·api.polyhaven.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Rock Moss Set 01 (Kless Gyzen)**
- kích thước: 63.127 poly cho cả bộ 6 hòn [A·api.polyhaven.com]
- hình thái, màu: Bộ 6 hòn đá rừng phong hoá, rêu xanh nhạt, đất [A·api.polyhaven.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Rock Moss Set 02 (Kless Gyzen)**
- kích thước: 57.647 poly [A·api.polyhaven.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Root Cluster 01 (Jenelle van Heerden, Rico Cilliers)**
- phân bố: Photoscan (Photography), không ghi loài/vùng [A·api.polyhaven.com]
- kích thước: 225.261 poly; ~4,1 m dài; 8K [A·api.polyhaven.com]
- hình thái, màu: Cụm rễ rối, vỏ chi tiết, lá nền rừng phủ lớp [A·api.polyhaven.com]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Root Cluster 02 (Jenelle van Heerden)**
- kích thước: 339.641 poly; khá dẹt (~2,4 x 2,7 x 0,2 m) [A·api.polyhaven.com]
- hình thái, màu: Cụm rễ cây chết phong hoá, mảnh nền rừng dạng module [A·api.polyhaven.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Shrub 02 (Rico Cilliers)**
- kích thước: 52.317 poly [A·api.polyhaven.com]
- hình thái, màu: Cây non/bụi tầng thấp lá xanh [A·api.polyhaven.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Single Root (Jenelle van Heerden)**
- kích thước: 114.424 poly [A·api.polyhaven.com]
- hình thái, màu: Một rễ cây trồi trên nền rừng [A·api.polyhaven.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Tree Small 02 (Rico Cilliers)**
- tên khoa học: Burkea africana (wild syringa), cây Nam Phi [A·api.polyhaven.com]
- phân bố: Loài châu Phi (Burkea africana), không phải Đông Nam Á [A·api.polyhaven.com]
- kích thước: 4.652.585 poly; có LOD; 8K [A·api.polyhaven.com]
- hình thái, màu: Cây nhỏ thân mảnh cong, tán thưa thoáng lá chùm [A·api.polyhaven.com]
- honest-null: độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Tree Stump 01 (Rob Tuytel)**
- phân bố: Gốc cây từ bộ sưu tập rừng thông (pine_forest), có rêu; ôn đới [A·api.polyhaven.com]
- kích thước: 41.046 poly [A·api.polyhaven.com]
- honest-null: tên khoa học, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Tree Stump 02 (Rob Tuytel)**
- phân bố: Gốc cây từ bộ sưu tập rừng thông (pine_forest), có rêu; ôn đới [A·api.polyhaven.com]
- kích thước: 62.345 poly [A·api.polyhaven.com]
- honest-null: tên khoa học, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Quaternius Stylized Nature MegaKit (Quaternius)**
- kích thước: 116 model: 40 cây, 35 cây/hoa, 27 đá [A·quaternius.com]
- hình thái, màu: Phong cách stylized kiểu Ghibli, không photoreal [A·quaternius.com]
- mật độ, license: CC0; FBX, OBJ, glTF + .blend [A·quaternius.com] · Dùng thương mại tự do (CC0); 60–70% gói miễn phí [A·quaternius.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Quaternius Ultimate Nature Pack (Quaternius)**
- kích thước: 150 model; FBX, OBJ, Blend (không ghi glTF) [A·quaternius.com]
- mật độ, license: CC0 [A·quaternius.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Rainforest Ambience Phong Nha Vietnam (Libby và Marcel)**
- phân bố: Ghi ở Phong Nha: vườn thực vật và gần động Thiên Đường bên sông [B·payhip.com]
- kích thước: 30 file, 93 phút, WAV 192 kHz/24-bit, giá 5 USD [B·payhip.com]
- hành vi, âm thanh: Tiếng chim, ếch kêu, thác nước [B·payhip.com]
- mật độ, license: Ghi 'Royalty-free' nhưng chưa đọc được văn bản License Agreement (game/thương mại chưa rõ) [B·payhip.com]
- honest-null: tên khoa học, độ cao, hình thái, màu, mùa, thời tiết

**Sketchfab AS01 Bambusa Vulgaris Golden Bamboo (xfrog)**
- mật độ, license: LOẠI: CC Attribution-NonCommercial-NoDerivs [A·api.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Sketchfab AS06 Ficus Benghalensis Banyan (xfrog)**
- mật độ, license: LOẠI: CC Attribution-NonCommercial-NoDerivs [A·api.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Agarwood (Valery.Li)**
- tên khoa học: Aquilaria sinensis [B·api.sketchfab.com]
- phân bố: Rừng mưa Đông Nam Á [B·api.sketchfab.com]
- kích thước: 640.743 faces [A·api.sketchfab.com]
- hình thái, màu: Cây trầm hương nguyên cây, dựng tay [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Alocasia Tropical Plants Pack Free Sample (estudioshout)**
- mật độ, license: LOẠI: CC Attribution-NonCommercial [A·api.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Alocasia baginda (harenil)**
- tên khoa học: Alocasia baginda [B·api.sketchfab.com]
- kích thước: 154.078 faces [A·api.sketchfab.com]
- hình thái, màu: Ráy cảnh scan ảnh (giống cây cảnh, có thể kèm chậu) [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Alocasia macrorrhizos (DJMiddi)**
- tên khoa học: Alocasia macrorrhizos [B·api.sketchfab.com]
- kích thước: 1.707 faces (rất nhẹ) [A·api.sketchfab.com]
- hình thái, màu: Ráy/dọc mùng lá lớn dựng tay [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Alocasia zebrina Tiger Elephant Ear (The_Structure_World)**
- tên khoa học: Alocasia zebrina [B·api.sketchfab.com]
- kích thước: 477 faces [A·api.sketchfab.com]
- hình thái, màu: Ráy cuống vằn low-poly [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab BANYAN TREE (jimmygunawan)**
- kích thước: 50.000 faces (trong ngưỡng 60k) [A·api.sketchfab.com]
- hình thái, màu: Cây đa photogrammetry nhanh từ 12 ảnh [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab BORNEAN RAINFOREST TREE (muhammadhakim22800)**
- phân bố: Borneo (Đông Nam Á), cảm hứng chứ không phải scan [B·api.sketchfab.com]
- kích thước: 1.058.756 faces, 12 bộ cây [A·api.sketchfab.com]
- hình thái, màu: 12 bộ cây dựng tay lấy cảm hứng rừng mưa Borneo [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Bamboo (Maskable)**
- kích thước: 25.796 faces [A·api.sketchfab.com]
- hình thái, màu: Tre mid-high poly tối ưu cho game, tag Đông Á [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Bamboo (pergamond)**
- kích thước: 39.878 faces [A·api.sketchfab.com]
- hình thái, màu: Cây tre, mô tả tối giản [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Bamboo Plants FREE Low Poly (LadyLionStudios)**
- kích thước: 4.665 faces [A·api.sketchfab.com]
- hình thái, màu: Tre low-poly (tác giả thực là LordSamueliSolo) [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Bamboo Raft Scaniverse (db4)**
- kích thước: 253.997 faces [A·api.sketchfab.com]
- hình thái, màu: Xác bè tre buộc bằng dây mây và dây nylon (cảnh báo có dây nylon hiện đại) [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Bamboo photoscan (Arthur_mf)**
- kích thước: 177.282 faces [A·api.sketchfab.com]
- hình thái, màu: Tre photoscan, chân thực [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Banana Plant (evolveduk)**
- kích thước: 4.402 faces [A·api.sketchfab.com]
- hình thái, màu: Cây chuối dựng bằng Tree It [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Banana Tree (Garecra)**
- kích thước: 5.662 faces (game-ready) [A·api.sketchfab.com]
- hình thái, màu: Cây chuối dựng Blender, texture lấy từ Quixel Bridge (cảnh báo nguồn texture) [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Banana leaf AMAPstudio (griffon.sebastien)**
- kích thước: 26.224 faces [A·api.sketchfab.com]
- hình thái, màu: Lá chuối mô phỏng thực vật học bằng AMAPstudio (CIRAD) [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Banyan Tree of NCKU (ncku_museum)**
- kích thước: 189.533 faces [A·api.sketchfab.com]
- hình thái, màu: Cây đa photoscan Agisoft của bảo tàng đại học [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Banyan on palmyra (feklee)**
- phân bố: Batticaloa, Sri Lanka [B·api.sketchfab.com]
- kích thước: 2.704.191 faces (quá nặng) [A·api.sketchfab.com]
- hình thái, màu: Cây đa bóp cổ mọc trên cây thốt nốt, photogrammetry [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Bird Nest Fern Scaniverse LIDAR (db4)**
- tên khoa học: Asplenium nidus [B·api.sketchfab.com]
- phân bố: Kuching, Sarawak, Borneo (Malaysia) [A·api.sketchfab.com]
- kích thước: 338.815 faces (scan LiDAR, cần decimate xuống ≤15k) [A·api.sketchfab.com]
- hình thái, màu: Dương xỉ tổ chim scan LiDAR bằng Scaniverse [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Blue Fern (gavinpgamer1)**
- hình thái, màu: Tag tên game Half-Life, Black Mesa, Xen [A·api.sketchfab.com]
- mật độ, license: LOẠI: rip từ game Half-Life/Black Mesa (decompile bằng Crowbar) dù gắn CC Attribution [A·api.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết

**Sketchfab CC0 Malayan Banyan Ficus microcarpa 038bae (ffishAsia-and-floraZia)**
- tên khoa học: Ficus microcarpa [B·api.sketchfab.com]
- kích thước: 2.355.367 faces (nặng. cần decimate) [A·api.sketchfab.com]
- hình thái, màu: Cây si Ficus microcarpa, mô tả kiểu tiêu bản phân loại học [B·api.sketchfab.com]
- mật độ, license: CC0 Public Domain [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab CC0 Malayan Banyan Ficus microcarpa 19172c (ffishAsia-and-floraZia)**
- tên khoa học: Ficus microcarpa [B·api.sketchfab.com]
- kích thước: 609.313 faces (nặng. cần decimate) [A·api.sketchfab.com]
- hình thái, màu: Cây si Ficus microcarpa, mô tả kiểu tiêu bản phân loại học [B·api.sketchfab.com]
- mật độ, license: CC0 Public Domain [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab CC0 Malayan Banyan Ficus microcarpa 4b98d9 (ffishAsia-and-floraZia)**
- tên khoa học: Ficus microcarpa [B·api.sketchfab.com]
- kích thước: 1.127.010 faces (nặng. cần decimate) [A·api.sketchfab.com]
- hình thái, màu: Cây si Ficus microcarpa, mô tả kiểu tiêu bản phân loại học [B·api.sketchfab.com]
- mật độ, license: CC0 Public Domain [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab CC0 Malayan Banyan Ficus microcarpa 6882b8 (ffishAsia-and-floraZia)**
- tên khoa học: Ficus microcarpa [B·api.sketchfab.com]
- kích thước: 1.637.988 faces (nặng. cần decimate) [A·api.sketchfab.com]
- hình thái, màu: Cây si Ficus microcarpa, mô tả kiểu tiêu bản phân loại học [B·api.sketchfab.com]
- mật độ, license: CC0 Public Domain [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Chinese Banyan Ficus Microcarpa (Valery.Li)**
- tên khoa học: Ficus microcarpa [B·api.sketchfab.com]
- phân bố: Bản địa Sri Lanka, Ấn Độ, Đài Loan, quần đảo Mã Lai [B·api.sketchfab.com]
- kích thước: 111.392 faces [A·api.sketchfab.com]
- hình thái, màu: Cây si/gừa nguyên cây, dựng tay [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Curtain Fig Tree Yungaburra (kungphil)**
- kích thước: faceCount 0: dữ liệu LiDAR, không phải lưới [A·api.sketchfab.com]
- hình thái, màu: Cây sung bóp cổ (strangler fig) nổi tiếng, LiDAR [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Dead Tree Stump (gamingassets)**
- kích thước: 22.958 faces [A·api.sketchfab.com]
- hình thái, màu: Gốc cây chết photogrammetry có rễ [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Dipterocarp in Maliau Basin (kungphil)**
- phân bố: Maliau Basin, Malaysia (Borneo) [B·api.sketchfab.com]
- kích thước: faceCount 0: là đám mây điểm LiDAR, không phải lưới, chỉ dùng làm tham chiếu tỷ lệ [A·api.sketchfab.com]
- hình thái, màu: Cây họ Dầu cao 54 m, ngọn gãy [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Drevo stump (Pjotruska)**
- kích thước: 36.123 faces (mid-poly) [A·api.sketchfab.com]
- hình thái, màu: Gốc cây thật bản mid-poly, chưa sạch [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Elephant Ear Bush (darkmoral)**
- kích thước: 2.268 faces (game-ready) [A·api.sketchfab.com]
- hình thái, màu: Bụi ráy tai voi game-ready [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab FREE Livistona Chinensis Fan Palm (AllQuad)**
- tên khoa học: Livistona chinensis [B·api.sketchfab.com]
- kích thước: 61.856 faces [A·api.sketchfab.com]
- hình thái, màu: Cọ quạt Livistona, gắn tag nội thất/trang trí (có thể là cây chậu) [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Fallen Spruce Tree (kj3987)**
- kích thước: 12.716 faces [A·api.sketchfab.com]
- hình thái, màu: Cây vân sam đổ photoscan, texture không chi tiết (loài ôn đới) [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Fallen Tree PNW (Kickflipkid687)**
- phân bố: Tây Bắc Thái Bình Dương (Bắc Mỹ, ôn đới) [B·api.sketchfab.com]
- kích thước: 1.000.128 faces (quá nặng) [A·api.sketchfab.com]
- hình thái, màu: Thân cây đổ phủ rêu, scan RealityScan [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Fan palm tree (1-3D.com)**
- mật độ, license: CC Attribution-ShareAlike (ngoài danh sách CC0/CC-BY của luật dự án, Chủ nhà quyết) [A·api.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Fishtail palm tree from Poly by Google (ie-niels)**
- kích thước: 966 faces (low-poly) [A·api.sketchfab.com]
- hình thái, màu: Cây móc đuôi cá low-poly, bản lưu từ Google Poly [B·api.sketchfab.com]
- mật độ, license: CC Attribution (bản sao lưu từ Google Poly; tác giả gốc khác người upload) [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com] · Cảnh báo: tag video-games nhưng nguồn là Google Poly, không thấy tên game cụ thể [A·api.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Jungle Tree (kirsula228)**
- kích thước: 13.724 faces [A·api.sketchfab.com]
- hình thái, màu: Cây nhiệt đới dựng tay cho game [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Jungle Tree (kobaltsecond)**
- kích thước: 30.720 faces [A·api.sketchfab.com]
- hình thái, màu: Ghép từ nhiều model miễn phí khác (chuỗi ghi công phức tạp) [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Jungle Tree (rodrigogelmi)**
- kích thước: 124.671 faces [A·api.sketchfab.com]
- hình thái, màu: Cây lớn dựng tay để tạo rừng rậm [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Jungle Tree Roots (boypuff)**
- kích thước: 433.171 faces (lưới đã decimate) [A·api.sketchfab.com]
- hình thái, màu: Gốc cây rừng có rễ, photoscan Agisoft [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Jungle Tree With Liana (sebastienthapa20)**
- kích thước: 4.750 faces (low-poly) [A·api.sketchfab.com]
- hình thái, màu: Cây rừng kèm dây leo, low-poly [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Jungle Trees (rhcreations)**
- kích thước: 47.447 faces cho cả bộ (trong ngưỡng 60k) [A·api.sketchfab.com]
- hình thái, màu: Bộ cây rừng rậm dựng bằng Blender, có cọ [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Jungle roots (boypuff)**
- kích thước: 431.454 faces [A·api.sketchfab.com]
- hình thái, màu: Rễ cây rừng nhiệt đới photoscan, vùng đảo [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Jungle tree (Cliffcographics)**
- kích thước: 48.420 faces [A·api.sketchfab.com]
- hình thái, màu: Cây đơn giản cho cảnh rừng, tác giả nói không giống thật 100% [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Jungle tree partial (boypuff)**
- kích thước: 172.706 faces [A·api.sketchfab.com]
- hình thái, màu: Một phần thân cây rừng photoscan [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Liana tree (JonathanPepe)**
- phân bố: Cao Hùng, Đài Loan [B·api.sketchfab.com]
- kích thước: 49.999 faces [A·api.sketchfab.com]
- hình thái, màu: Cây có dây leo, chụp tại Đài Loan [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Moreton Bay Fig Tree 4 (b_nealie)**
- phân bố: Auckland, New Zealand (cây trồng công viên; loài gốc Úc) [B·api.sketchfab.com]
- kích thước: 398.830 faces [A·api.sketchfab.com]
- hình thái, màu: Cây sung già có rễ bạnh, vài vùng chưa có texture [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Moreton Bay Fig Tree 5 (b_nealie)**
- phân bố: Auckland, New Zealand (cây trồng công viên; loài gốc Úc) [B·api.sketchfab.com]
- kích thước: 399.574 faces [A·api.sketchfab.com]
- hình thái, màu: Cây sung già có rễ bạnh và rễ khí, photogrammetry [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Moreton Bay Fig Tree 6 (b_nealie)**
- phân bố: Auckland, New Zealand (cây trồng công viên; loài gốc Úc) [B·api.sketchfab.com]
- kích thước: 397.615 faces [A·api.sketchfab.com]
- hình thái, màu: Cây sung có rễ bạnh lớn và rễ khí [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Mossy old tree log (julianmalik)**
- kích thước: 20.390 faces (đã retopo, có normal map) [A·api.sketchfab.com]
- hình thái, màu: Khúc gỗ đổ phủ rêu photoscan, retopo ZBrush [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Mossy tree stump (nedo)**
- kích thước: 292.890 faces [A·api.sketchfab.com]
- hình thái, màu: Gốc cây phủ rêu scan (rừng Đức, ôn đới) [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Ponga (toAflame)**
- phân bố: New Zealand [B·api.sketchfab.com]
- kích thước: 647 faces (rất nhẹ) [A·api.sketchfab.com]
- hình thái, màu: Dương xỉ thân gỗ low-poly làm asset môi trường tương tác [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Port Jackson Fig (Landy42)**
- tên khoa học: Ficus rubiginosa [B·api.sketchfab.com]
- phân bố: Newcastle, Úc [B·api.sketchfab.com]
- kích thước: 7.609.654 faces (quá nặng) [A·api.sketchfab.com]
- hình thái, màu: Cây sung lớn trong công viên, scan [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Realistic HD Male fern 3/50 (PlantCatalog)**
- tên khoa học: Dryopteris filix-mas [B·api.sketchfab.com]
- kích thước: 126.070 faces [A·api.sketchfab.com]
- hình thái, màu: Dương xỉ thường (loài ôn đới) dựng thủ tục [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Realistic HD Mexican fan palm 8/10 (PlantCatalog)**
- tên khoa học: Washingtonia robusta [B·api.sketchfab.com]
- phân bố: Bắc Mỹ, sa mạc (sai vùng) [B·api.sketchfab.com]
- kích thước: 162.290 faces [A·api.sketchfab.com]
- hình thái, màu: Cọ quạt Washingtonia (cọ sa mạc Bắc Mỹ, chỉ thay thế tạm hình dáng) [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Realistic Jungle Tree (Garecra)**
- kích thước: 2.324.826 faces (quá nặng cho web, cần decimate/LOD) [A·api.sketchfab.com]
- hình thái, màu: Cây rừng nhiệt đới dựng tay kiểu nanite/UE5, không ghi loài [B·api.sketchfab.com] · Tag cho thấy dựng nhắm Unreal Engine 5 [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Realistic Jungle Tree Avatar (Garecra)**
- kích thước: 711.124 faces [A·api.sketchfab.com]
- hình thái, màu: Cây rừng rậm kiểu phim Avatar/Pandora (cảnh báo IP phim, không phải rip game) [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Tree Fern 1 (b_nealie)**
- phân bố: Auckland, New Zealand (dương xỉ thân gỗ NZ, không phải Cyathea Đông Dương) [B·api.sketchfab.com]
- kích thước: 130.032 faces [A·api.sketchfab.com]
- hình thái, màu: Dương xỉ thân gỗ ghép từ scan photogrammetry các phần Ponga và Mamaku [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Tree Stump Photogrammetry (tinyruin)**
- mật độ, license: LOẠI: CC Attribution-NonCommercial [A·api.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Tree fern stem Cornell (DigitalAtlasOfAncientLife)**
- tên khoa học: Cyatheaceae hoặc Dicksoniaceae (chưa chắc) [B·api.sketchfab.com]
- kích thước: 468.892 faces [A·api.sketchfab.com]
- hình thái, màu: Chỉ một đoạn thân dương xỉ thân gỗ (tiêu bản bảo tàng), không có tán lá [B·api.sketchfab.com]
- mật độ, license: CC0 Public Domain [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Tree stump Photogrammetry retopo (Hullken)**
- kích thước: 163.242 faces [A·api.sketchfab.com]
- hình thái, màu: Gốc cây photogrammetry từ video 4K60, đã retopo [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Tree with ferns and moss (b_nealie)**
- phân bố: Auckland, New Zealand [B·api.sketchfab.com]
- kích thước: 398.162 faces [A·api.sketchfab.com]
- hình thái, màu: Gốc cây có dương xỉ và rêu, photogrammetry [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Tropical Plants Pack M02P (MozzarellaARC)**
- kích thước: 46.575 faces cho cả gói [A·api.sketchfab.com]
- hình thái, màu: Gói cây nhiệt đới gồm cọ, chuối, dương xỉ, monstera (dòng cây cảnh trong nhà) [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Tropical Rainforest Tree Stump (db4)**
- tên khoa học: Tristaniopsis whiteana [B·api.sketchfab.com]
- phân bố: Sarawak, Borneo (Malaysia) [A·api.sketchfab.com]
- kích thước: 510.418 faces (scan LiDAR, cần decimate) [A·api.sketchfab.com]
- hình thái, màu: Gốc cây rừng mưa nhiệt đới scan LiDAR [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Variegated Alocasia (Naturalai)**
- mật độ, license: Cảnh báo: tag cho thấy tạo/xử lý bằng AI (createdwithai, meshyai) [A·api.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Waterfall Rock 1 Scaniverse (db4)**
- phân bố: Thác Sebarau, Padawan, Sarawak, Borneo [A·api.sketchfab.com]
- kích thước: 207.050 faces [A·api.sketchfab.com]
- hình thái, màu: Đá suối phủ rêu quanh thác Sebarau, scan [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab Waterfall Rock 5 Scaniverse (db4)**
- phân bố: Thác Sebarau, Padawan, Sarawak, Borneo [A·api.sketchfab.com]
- kích thước: 230.714 faces [A·api.sketchfab.com]
- hình thái, màu: Đá suối phủ rêu quanh thác Sebarau, scan [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab liana (nlyCGI)**
- kích thước: 28.659 faces [A·api.sketchfab.com]
- hình thái, màu: Dây leo, không mô tả, không tag [B·api.sketchfab.com]
- mật độ, license: CC Attribution [A·api.sketchfab.com] · Định dạng: Sketchfab tự chuyển glTF/GLB/USDZ khi có thể; định dạng gốc và độ phân giải texture chưa kiểm được (trang model chặn robots) [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Sketchfab định dạng tải tự động**
- kích thước: GLB có nhiều bản texture: gốc, 4K, 1K [A·help.sketchfab.com] · Bản GLB 1K tải trực tiếp không nén ZIP [A·sketchfab.com]
- hình thái, màu: Chuyển sang glTF dùng vật liệu và texture PBR [A·help.sketchfab.com]
- mật độ, license: Mọi model downloadable được tự chuyển sang glTF và USDZ khi có thể [A·help.sketchfab.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**Smithsonian Open Access 3D (Smithsonian Gardens)**
- tên khoa học: Lycaste virginalis (lan Trung Mỹ) [A·3d.si.edu]
- kích thước: Chỉ 2 kết quả, đều là hoa lan Lycaste virginalis; không có cây rừng [A·3d.si.edu]
- honest-null: phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Sonniss Tropical Ambiences (Stéphane Fufa Dufour)**
- hành vi, âm thanh: Đêm rừng mưa: suối sương mù ban đêm, mưa đêm có giọt rơi từ lá [A·sonniss.com] · Suối rừng mưa chảy lớn với tiếng chim lác đác [A·sonniss.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, mùa, thời tiết, mật độ, license

**SpeedTree Library Asset**
- mật độ, license: Library Asset chỉ được dùng như thành phần nhúng của sản phẩm được cấp phép [A·unity.com] · Licensed Production là sản phẩm định danh bằng tên trong Order Form [A·unity.com] · SpeedTree Cinema không được dùng cho sản phẩm tương tác/thời gian thực [A·unity.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Superhive Botaniq Trees (polygoniq)**
- kích thước: Bản Full 129 USD (tất cả asset); Starter 2 USD (~3% asset) [A·superhivemarket.com]
- hình thái, màu: Thư viện cây, cọ, bụi, cây thực tế tối ưu, >1000 model [A·superhivemarket.com]
- mật độ, license: Royalty Free (Superhive); asset nén trong file .paq [A·superhivemarket.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**The Grove (F12)**
- kích thước: Starter 99 EUR, Indie 199 EUR, Studio 799 EUR; twig 9,69 EUR mỗi loại [B·cgchannel.com]
- mật độ, license: Được đưa cây vào game với điều kiện cây không trích xuất được [A·thegrove3d.com] · Cấm bán/phân phối model cây mọc bằng The Grove Core [A·thegrove3d.com] · Xuất FBX, OBJ, USD từ phần mềm chủ; cấu trúc mesh hợp three.js [B·cgchannel.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Thư viện Quixel Megascans trên Fab**
- kích thước: Từ 2025: gói khởi đầu miễn phí hơn 1.500 asset chọn lọc, cho mọi engine [A·unrealengine.com] · Giá lẻ từ 0,99 USD (asset 2D/3D), 4,99 USD (kit thủ tục), 24,99 USD (gói) [B·cgchannel.com] · Giá lẻ cây 3D Megascans trên trang danh mục: từ 3,99 USD (Tropical Palm, Fern, Cat Palm) [A·fab.com] · Giá lẻ thân, gốc, đá Megascans: từ 2,99 USD [A·fab.com] · 4 bậc chất lượng: Raw 8K, High 4K, Mid 2K, Low 1K [B·forums.unrealengine.com] · Mỗi bậc có LOD riêng kèm mesh billboard; bản Nanite chỉ có một mesh [B·forums.unrealengine.com] · Bậc Mid 2K dành cho game indie hoặc asset nền [B·forums.unrealengine.com]
- mật độ, license: Miễn phí cho mọi engine đến hết 2024 (phải nhận vào thư viện Fab) [A·unrealengine.com] · Từ 2025 phần lớn Megascans không còn miễn phí, kể cả trong Unreal Engine [B·cgchannel.com] · Megascans tải qua Bridge theo Epic Content License cũ chỉ được dùng miễn phí trong Unreal Engine: CẤM cho three.js [B·cgchannel.com] · Megascans tải qua Fab in Launcher: FBX là định dạng tối ưu cho DCC, Unity và UE dưới 5.3 [A·dev.epicgames.com] · Với UE 5.3 trở lên, glTF là định dạng tối ưu (tài liệu ghi ".gtlf") [A·dev.epicgames.com] · File Unreal Engine không có nút tải xuống thô (chỉ nhập qua Fab plugin) [A·dev.epicgames.com] · Trang listing Megascans 3D ghi định dạng fbx, gltf và bản chuyển đổi GLB/glTF/USDZ [A·fab.com] · Megascans dạng texture set (atlas lá) chỉ có "texture set", không có mesh [A·fab.com] · Nội dung Quixel phát hành 2026 dùng miễn phí theo Fab Standard License (mục được đánh dấu free) [A·quixel.com] · Thư viện có cả asset miễn phí và asset trả phí "premium" [A·quixel.com] · Fab có thư viện tài nguyên hoàn toàn miễn phí ngày càng lớn, gồm Megascans chất lượng cao [A·unrealengine.com] · Theo licenseorg: miễn phí nay chỉ giới hạn ở asset thuộc bậc free của Fab [C·licenseorg.com] · Người dùng báo một số Megascans đã nhận trong đợt free lại thành hàng trả phí trên Fab (diễn đàn, 2026) [C·forums.unrealengine.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Thư viện model Poly Haven**
- phân bố: Danh mục cây chủ yếu từ các bộ sưu tập namaqualand (Nam Phi khô), pine_forest (ôn đới), verdant_trail; không có model cọ, tre, chuối, dương xỉ thân gỗ, dây leo [A·api.polyhaven.com]
- kích thước: 521 model; 20 model nhóm trees, 57 plants, 37 rocks, 32 ground cover [A·api.polyhaven.com] · Chỉ 20 model trong nhóm cây (trees) [A·api.polyhaven.com]
- honest-null: tên khoa học, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**TreeIt (Evolved Software)**
- kích thước: Có LOD điều chỉnh [A·evolved-software.com]
- mật độ, license: Miễn phí; xuất .dbo .fbx .obj .x (không glTF) [A·evolved-software.com] · Được bán model cây làm bằng TreeIt nếu là sản phẩm của mình [A·evolved-software.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**ZapSplat Thailand jungle ambiences**
- hành vi, âm thanh: Ghi ban đêm: côn trùng, ve sầu lớn, ếch, mưa nhỏ nhỏ giọt từ tán [B·zapsplat.com]
- mật độ, license: Giấy phép ZapSplat cho game/app; bản miễn phí phải ghi công 'ZapSplat', Premium thì không [A·zapsplat.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, mùa, thời tiết

**ambientCG Foliage 001**
- kích thước: 1K-PNG 12 MB, 2K-PNG 44 MB, 4K-PNG 165 MB [A·ambientcg.com]
- hình thái, màu: Atlas cỏ xanh (texture PBR) [A·ambientcg.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**ambientCG Ground037**
- hình thái, màu: Nền rừng ẩm, rêu xanh, cỏ mọc um [A·ambientcg.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**ambientCG Ground106**
- hình thái, màu: Đất nâu be, lá rụng, bùn, lòng suối, gồ ghề [A·ambientcg.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**ambientCG Leaf Set 024**
- kích thước: Khổ thật ~40 x 40 cm; 1K–8K; 2K-PNG 46 MB [A·ambientcg.com]
- hình thái, màu: Bộ lá xanh nhạt, chụp quang trắc bề mặt (Surface Photogrammetry) [A·ambientcg.com]
- mật độ, license: CC0, không cần ghi công [A·ambientcg.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**ambientCG Leaf Set 029**
- kích thước: 1K-PNG ~9,8 MB; 2K-PNG ~33 MB [A·ambientcg.com]
- hình thái, màu: Bộ lá thường xuân (ivy) xanh: có thể làm lá dây leo tạm [A·ambientcg.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**proctree.js (Paul Brunt)**
- kích thước: Không có bản phát hành, chỉ 9 commit (dự án cũ 2012) [A·github.com]
- hình thái, màu: Sinh mảng đỉnh, pháp tuyến, UV, mặt cho thân và lưới cành lá (twig) riêng; có ví dụ Three.js [A·github.com]
- mật độ, license: Giấy phép kiểu BSD 3 điều khoản; giữ thông báo bản quyền khi phân phối [A·github.com]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết

**xeno-canto**
- mật độ, license: Mọi bản ghi theo một giấy phép Creative Commons, mỗi bản một loại: phải kiểm từng bản [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

