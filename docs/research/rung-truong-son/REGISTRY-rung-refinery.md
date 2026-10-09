# Registry cào–lọc · Rừng Trường Sơn cho Đường về Sài Gòn

*Mẻ 1, ngày 2026-10-09. Năm mũi cào song song (thực vật, địa hình và khí hậu, động vật và âm thanh, dấu vết chiến tranh 1971, nguồn asset sạch giấy phép). Kỷ luật refinery: mỗi giá trị có tier và nguồn, giá trị lệch nhau giữ nguyên trạng thái tranh chấp, ô thiếu nguồn ghi honest-null, không lấp bằng phỏng đoán.*

Tier: **A** = nguồn gốc hoặc chuyên môn (báo cáo khảo sát khu bảo tồn, bài khoa học, IUCN, PROSEA, CIFOR, hồi ký nhân chứng, chuyên khảo quân sử, trang giấy phép chính thức). **B** = thứ cấp uy tín (Wikipedia, WWF ecoregion, báo lớn). **C** = blog, du lịch, lời kể chưa kiểm.

## 0. Kết quả build

| Chỉ số | Giá trị |
|---|---|
| Snapshot | 177 trích đoạn (A 39, B 25, C 27, D 41, E 45) |
| Claim | 759 (tier A 378 · B 356 · C 25); 7 giữ nguyên văn, 711 chuẩn hoá (phần lớn là dịch sang tiếng Việt), 41 suy luận |
| Thực thể | 179 trên mẫu số ước lượng 200 (coverage 89,5 %) |
| Cổng | VALIDATION PASSED. Bite suite: 6/6 cổng cắn (CAPTURE_MISSING, SPAN_NOT_FOUND, SOURCED_ATTR, AMBIGUOUS_MERGE_UNFLAGGED, DISTRIBUTION_NO_DENOMINATOR, IDEMPOTENT). Build tất định, auditor dựng lại khớp |
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

## 8. Honest-null: đã tìm, chưa có nguồn đạt chuẩn

- **Cổng Trời (M1)**: không tìm thấy nguồn mô tả trọng điểm này; tên có thể trùng nhiều nơi. Cần Chủ nhà xác định toạ độ trên tuyến.
- Hình thái suối nhỏ: bề rộng, nước trong hay đục theo mùa, đá tảng lòng suối, rêu, thác cụ thể. Nguồn chỉ nói chung "streams, springs and waterfalls". **Đây là lỗ hổng lớn nhất cho cảnh "như phim"**, cần ảnh tham chiếu.
- Ngầm thời chiến: độ sâu nước, vật liệu, cọc mốc (chỉ có "vài cm dưới mặt nước"). Ngầm Ta Lê chỉ có tên.
- Độ dày lớp lá rụng (cm) ở Trường Sơn; % độ tàn che và % ánh sáng đo riêng ở Trường Sơn.
- Độ cao rễ bạnh đo ở Trường Sơn; màu vỏ chò chỉ; mô tả táu, re, dẻ; chuối rừng, tre le, loài rêu và địa y cụ thể.
- Kích thước hầm chữ A, lán, hào giao thông, bếp Hoàng Cầm; cầu phao; "đường kéo pháo"; hình dạng đồi 31.
- Mô tả tiếng trĩ sao, âm sắc tiếng mang sủa (xeno-canto chặn công cụ đọc).
- Khỉ vàng, culi, bò tót, gấu, lợn rừng, nhím, trăn, đom đóm, kiến, bướm: chưa cào kịp trong mẻ này.
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

## 10. Đề xuất bước tiếp (Chủ nhà quyết)

1. **Xác định toạ độ Cổng Trời** của M1 để chốt sườn núi, độ cao, loại rừng (rừng đất thấp hay núi thấp) và khí hậu áp dụng.
2. **Bù lỗ hổng suối và nền rừng bằng ảnh tham chiếu**: mẻ cào ảnh có giấy phép rõ (Wikimedia Commons CC, ảnh tư liệu có chú thích) cho suối đá, ngầm, nền rừng Trường Sơn. Ảnh chỉ làm tham chiếu cho hoạ sĩ, không đưa vào game.
3. **Biến registry thành dữ liệu game**: bảng loài cho `content/vegetation/species.json` (chiều cao, tầng, mật độ theo loại rừng), lịch âm thanh theo giờ (vượn quanh bình minh, tắc kè chạng vạng, không ve tháng 1), preset thời tiết M1 và M2.
4. **Chọn asset**: thử một gói Fab rừng nhiệt đới photoscan kết hợp CC0 (Poly Haven, ambientCG) cho đất, đá, rêu. Thay thực vật Nam Mỹ bằng loài Trường Sơn ở tầng gần camera.
5. **Cào mẻ 2** cho các loài còn honest-null (khỉ vàng, culi, lợn rừng, trăn, đom đóm) và lớp hầm, lán, hào.

---

## Phụ lục: toàn bộ registry theo thực thể

Mỗi dòng: giá trị [tier·nguồn]. Nhiều giá trị trong một ô được giữ cả, không chọn hộ.

### tang_tan (9)

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
- kích thước: Rừng nguyên sinh 3 tầng tán, cao 25–35 m, cây vượt tán đôi khi 45 m [B·ecoregions.worldwildlife.org] · Cây vượt tán cao tới 45 m [B·en.wikipedia.org]
- hình thái, màu: Cây vượt tán lớn nhô trên tán tạo mặt tán gồ ghề [B·ecoregions.worldwildlife.org] · Cấu trúc 3–5 tầng: tầng trội, tầng tán, dưới tán, cây bụi, cỏ quyết [C·luatminhkhue.vn] · Cây gỗ khổng lồ có rễ bạnh, cây cao tới 50 m, có dây leo thân gỗ, tầng tán và tầng dưới tán (Phong Nha) [A·thesalmons.org]
- mật độ, license: Đakrông có diện tích rừng thường xanh đất thấp còn lại lớn nhất miền Trung [A·thiennhienviet.org.vn] · Rừng nguyên sinh chỉ chiếm khoảng 60% diện tích Đakrông [A·thiennhienviet.org.vn]
- honest-null: tên khoa học, hành vi, âm thanh, mùa, thời tiết

**Rừng thường xanh núi thấp (á nhiệt đới)**
- tên khoa học: Họ ưu thế: Sim, Dẻ, Côm, Long não; có họ Kim giao [B·ecoregions.worldwildlife.org]
- độ cao: 800–1.200 m, tán 2 tầng [B·ecoregions.worldwildlife.org] · Bạch Mã: rừng thường xanh núi trên 900 m [A·thiennhienviet.org.vn] · Bắc Hướng Hóa: rừng á nhiệt đới núi trung bình trên 600 m [A·locjkt.or.id]
- kích thước: Tán cao khoảng 15–25 m [B·en.wikipedia.org]
- hình thái, màu: Thung lũng 5 tầng; sườn dốc và đỉnh không có tầng vượt tán, chỉ 4 tầng [A·locjkt.or.id] · Phụ sinh, nhất là phong lan, rất nhiều [B·ecoregions.worldwildlife.org] · Bạch Mã trên 1.000 m: cổ thụ mọc trên tầng rêu dày, mây phủ quanh năm [B·tuoitre.vn]
- mùa, thời tiết: Đỉnh núi cao quanh năm mây phủ [B·tuoitre.vn]
- mật độ, license: Họ Dẻ chiếm tới 60% số cây ở nơi điều kiện ít khắc nghiệt [A·locjkt.or.id]
- honest-null: phân bố, hành vi, âm thanh

**Rừng thứ sinh sau nương rẫy**
- kích thước: Rừng thứ sinh thấp hình thành 8–10 năm sau nương rẫy [A·locjkt.or.id]
- hình thái, màu: Tầng trên là cây ưa sáng mọc từ gốc chồi hoặc hạt [A·locjkt.or.id] · Tầng dưới là dương xỉ, cỏ, gừng, ráy [A·locjkt.or.id]
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
- kích thước: Bắc Hướng Hóa: cây vượt tán tới 30 m, thường 20–25 m [A·locjkt.or.id] · Thường không quá 20–25 m [A·locjkt.or.id] · Đường kính thân 40–80 cm, cá biệt 120 cm [A·locjkt.or.id] · Rừng mưa nhiệt đới nói chung: vượt tán 45–55 m, hiếm khi 70–80 m (số liệu toàn cầu, không riêng Trường Sơn) [B·en.wikipedia.org]
- honest-null: phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license


### cay_go (14)

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


### cay_bui_tham_tuoi (5)

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


### day_leo_bieu_sinh (5)

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


### tre_nua_co (9)

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
- phân bố: Campuchia và Việt Nam [B·en.wikipedia.org]
- kích thước: Cao 8–12 m, lóng dài tới 55 cm, đường kính 5,5 cm, vách mỏng [B·en.wikipedia.org]
- honest-null: tên khoa học, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Nứa (Neohouzeaua dulloa)**
- độ cao: Mọc hoang trong rừng thường xanh 300–700 m [A·uses.plantnet-project.org]
- kích thước: Thân cao 7–9 m, mảnh, vách mỏng, đường kính tới 1 cm, lóng 40–60 cm [A·uses.plantnet-project.org]
- hình thái, màu: Cụm thưa, thân đứng hoặc ngả dựa cây bên cạnh [A·uses.plantnet-project.org]
- honest-null: tên khoa học, phân bố, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Tre gai (Bambusa blumeana)**
- phân bố: Ở VN là cây trồng; mọc hoang dưới 300 m ven sông suối [A·prosea-bamboos.linnaeus.naturalis.nl]
- kích thước: Thân cao 15–25 m, đường kính tới 20 cm, bụi 10–40 cây [A·prosea-bamboos.linnaeus.naturalis.nl]
- hình thái, màu: Cành gốc có gai đan thành bờ rào dày cao 2–3 m [A·prosea-bamboos.linnaeus.naturalis.nl]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Tre núi Arundinaria peteloti**
- độ cao: Đất thoái hóa 700–1.200 m [A·locjkt.or.id]
- kích thước: Cao 3–5 m, mọc dày đặc [A·locjkt.or.id]
- honest-null: tên khoa học, phân bố, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Tre nứa sau xáo trộn**
- mật độ, license: Bụi tre Chimonobambusa, Dendrocalamus mọc ở nơi bị xáo trộn [B·en.wikipedia.org] · Bão mở tán thường xuyên thúc đẩy tre phát triển [B·ecoregions.worldwildlife.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Trảng cỏ cây bụi thứ sinh**
- tên khoa học: Sim Rhodomyrtus tomentosa, mua Melastoma candidum, cỏ tranh Imperata cylindrica [A·thiennhienviet.org.vn] · Cỏ ưu thế: Miscanthus floridulus, Thysanolaena maxima, Saccharum spontaneum, Imperata cylindrica, I. conferta [A·locjkt.or.id]
- hình thái, màu: Đỉnh núi đất mỏng, nắng gió: chỉ 3 tầng, ưu thế họ Hòa thảo [A·locjkt.or.id]
- mật độ, license: Phục hồi chậm vì bị đốt định kỳ [A·thiennhienviet.org.vn] · Đakrông bị cô lập bởi đất nông nghiệp, cây bụi, trảng cỏ rộng [A·thiennhienviet.org.vn]
- honest-null: phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết


### dat_tham_la (8)

**Bãi lầy Khe Ve**
- hình thái, màu: Trời mưa cả vùng Khe Ve thành bãi lầy, phải lội bùn [B·special.nhandan.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Lớp lá rụng nền rừng nhiệt đới**
- hình thái, màu: Lá rụng phân huỷ nhanh do nóng ẩm, mùn không tích tụ dày (mô tả chung rừng nhiệt đới) [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

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
- kích thước: Hơn 220 km hang và sông ngầm đã khảo sát [A·whc.unesco.org] · Vùng không karst chia cắt sâu, độ dốc 25–30° [B·en.wikipedia.org]
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


### linh_truong (10)

**Khỉ mặt đỏ**
- tên khoa học: Macaca arctoides [A·thiennhienviet.org.vn]
- kích thước: đuôi cụt 32–69 mm; đực 51,7–65 cm, 9,7–10,2 kg [B·en.wikipedia.org]
- hình thái, màu: lông dài dày, xám/nâu/đỏ/đen; mặt hồng-đỏ, già thì sẫm nâu-đen, rụng lông [B·en.wikipedia.org]
- honest-null: phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

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
- phân bố: Đakrông (Quảng Trị) và Phong Nha–Kẻ Bàng [A·thiennhienviet.org.vn]
- kích thước: lông phủ đuôi đến 1,73 m; tổng dài 1,9–2,39 m [B·en.wikipedia.org]
- hình thái, màu: lông đen và vàng da bò lốm đốm nâu sẫm; mỏ hồng to; da quanh mắt xanh lam [B·en.wikipedia.org]
- hành vi, âm thanh: nhút nhát, khó gặp; làm tổ trên dốc đứng giữa lớp lá rụng [B·en.wikipedia.org]
- honest-null: độ cao, mùa, thời tiết, mật độ, license


### gam_nhan (2)

**Dúi mốc lớn**
- hình thái, màu: lông lưng nâu xám hoặc nâu sẫm; hang một lối vào đánh dấu bằng ụ đất [B·en.wikipedia.org]
- hành vi, âm thanh: ra ngoài ban đêm kiếm thực vật; sống bụi tre, ven rừng [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, mùa, thời tiết, mật độ, license

**Sóc bụng đỏ**
- hình thái, màu: lưng nâu, bụng ngả đỏ, đuôi thường có ít đen [B·en.wikipedia.org]
- hành vi, âm thanh: ban ngày, trên tán; tổ lá cao 7–18 m; kêu báo động khi có thú săn, vây rắn [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, mùa, thời tiết, mật độ, license


### bo_sat_luong_cu (5)

**Cạp nong**
- hình thái, màu: khoanh đen và vàng xen kẽ bao quanh thân; dài tối đa trên 2 m [B·en.wikipedia.org]
- hành vi, âm thanh: chủ yếu ban đêm; ngày lờ đờ, giấu đầu dưới khoanh thân [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, mùa, thời tiết, mật độ, license

**Hổ mang chúa**
- kích thước: trưởng thành 3,18–4 m; dài nhất ghi nhận 5,85 m [B·en.wikipedia.org]
- hình thái, màu: da xanh ô-liu, khoang đen-trắng hội về đầu; con non đen vạch chữ V trắng/vàng [B·en.wikipedia.org]
- hành vi, âm thanh: tiếng 'gầm' trầm, tần số trội ~600 Hz, dưới 2.500 Hz [B·en.wikipedia.org] · hoảng thì dựng nửa thân, bạnh mang, phì to; săn ban ngày [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, mùa, thời tiết, mật độ, license

**Rắn lục mép trắng**
- kích thước: dài tối đa đực 60 cm, cái 81 cm [B·en.wikipedia.org]
- hình thái, màu: lưng xanh lục; hai bên đầu dưới mắt vàng/trắng/xanh nhạt sáng hơn [B·en.wikipedia.org]
- hành vi, âm thanh: nọc chủ yếu độc máu; nhiều vụ cắn, ít tử vong [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, mùa, thời tiết, mật độ, license

**Tắc kè**
- kích thước: dài 25–30 cm (cả đuôi), có con đến 40 cm [B·en.wikipedia.org]
- hành vi, âm thanh: tiếng đực to như 'tô-kê', thường mở đầu bằng tràng lách cách nhanh, trầm [B·en.wikipedia.org] · kêu nhiều nhất lúc chạng vạng, đỉnh thứ hai lúc rạng sáng; đêm đi săn côn trùng [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, mùa, thời tiết, mật độ, license

**Ếch nhái (nhiều loài)**
- hành vi, âm thanh: khi mưa, tiếng ếch nhái và muông thú như bản hợp xướng (nhân chứng 1967–69) [B·baovanhoa.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, mùa, thời tiết, mật độ, license


### con_trung_khac (4)

**Muỗi Anopheles dirus**
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

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


### thu_lon (4)

**Hổ**
- mật độ, license: Phong Nha–Kẻ Bàng hiện không còn ý nghĩa bảo tồn hổ [A·thiennhienviet.org.vn] · lời đồn bộ đội 1967–69: núi Răng Cưa nhiều hang đá, cọp sống thành đàn (truyền miệng, chưa kiểm) [B·baovanhoa.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Mang đỏ phương bắc**
- hình thái, màu: đực có gạc ngắn và răng nanh trên dài [B·en.wikipedia.org]
- hành vi, âm thanh: tiếng kêu như tiếng sủa, dùng báo động và liên lạc [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, mùa, thời tiết, mật độ, license

**Sao la**
- tên khoa học: Pseudoryx nghetinhensis [A·thiennhienviet.org.vn]
- hình thái, màu: lông nâu sô-cô-la, mảng trắng ở mặt, họng, hai bên cổ; sừng nâu sẫm/đen dài 35–50 cm [B·en.wikipedia.org]
- hành vi, âm thanh: hoạt động cả ngày lẫn đêm (theo dân địa phương); đơn độc hoặc 2–3 con [B·en.wikipedia.org]
- mật độ, license: khoa học công bố 17/7/1992 (tức chưa được biết năm 1971); ước 50–300 cá thể (2015); nhà khoa học chưa từng quan sát ngoài tự nhiên [B·en.wikipedia.org]
- honest-null: phân bố, độ cao, kích thước, mùa, thời tiết

**Voi châu Á**
- mật độ, license: Phong Nha–Kẻ Bàng hiện không còn ý nghĩa bảo tồn voi [A·thiennhienviet.org.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết


### dau_vet_chien_tranh (33)

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

**Bếp Hoàng Cầm**
- phân bố: Dùng dọc đường Trường Sơn: 'ngày không khói, đêm không lửa' [B·vietnamnews.vn]
- hình thái, màu: Bếp đào vào chân đồi, rãnh khói tỏa ra như vòi mực [B·vietnamnews.vn] · Rãnh khói phủ cành cây và đất ẩm [B·vietnamnews.vn] · Khói thoát lên trông như sương sớm rồi tan nhanh, là sát mặt đất [B·vietnamnews.vn] · Hố sâu có nắp, ống tre dài ngầm dưới đất tản khói [B·en.wikipedia.org]
- honest-null: tên khoa học, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Cháy rừng do napalm và bom cháy**
- hình thái, màu: Phun rụng lá cho khô, rồi ném napalm đốt lớp lá rụng [A·openvault.wgbh.org] · Nền đất quanh cứ điểm trên đồi lóe lửa napalm từ Phantom bổ nhào xuống rừng (Nam Lào 1971) [B·warfarehistorynetwork.com]
- hành vi, âm thanh: Không khí nồng mùi cỏ cháy, mùi thuốc súng (Đồi Không Tên, Đường 9) [A·baohatinh.vn]
- mùa, thời tiết: Rừng ẩm nhiệt đới không bắt lửa thành 'bão lửa' dù đã phun khô và rải bom cháy M35 bằng B-52 (Pink Rose 1967) [C·globalsecurity.org] · Mùa khô, lửa cũng không xuyên vào loại rừng như thế [A·openvault.wgbh.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, mật độ, license

**Cua chữ A**
- phân bố: Thuộc Đường 20 Quyết Thắng, cùng cụm với ngầm Ta Lê, đèo Phu La Nhích [B·baolaichau.vn]
- hình thái, màu: Khúc cua biến mất, còn lại hàng trăm hố bom và cồn đất đỏ [C·nguoiquansat.vn] · Ban đêm mịt mù pháo sáng [B·sggp.org.vn]
- honest-null: tên khoa học, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Cầu cáp tháo lắp**
- hình thái, màu: Trụ sẵn hai bờ, chạng vạng căng 4 dây cáp, bắc gỗ, sáng tháo cất [B·baophapluat.vn]
- hành vi, âm thanh: Xe qua cầu lắc lư, có xe trượt rơi xuống sông [B·baophapluat.vn]
- mật độ, license: Đường 12 (Khe Ve – đèo Mụ Giạ) dài 45 km có hơn 10 cầu; có cả cầu giả nhử bom [B·baophapluat.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, mùa, thời tiết

**Cầu ngầm (cầu dưới mặt nước)**
- phân bố: Bến lội Ban Laboy có bến phụ thượng nguồn với cầu ngầm [C·thehochiminhtrail.com]
- kích thước: Mặt cầu nằm dưới mặt nước vài cm ('cầu chìm', 'cầu tàng hình') [B·nhandan.vn]
- hình thái, màu: Cầu thô sơ dựng dưới mặt nước [B·en.wikipedia.org] · Chuyển từ cầu nổi sang cầu dưới mặt nước [B·vnexpress.net]
- honest-null: tên khoa học, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Cứ điểm 31 (Hill 31)**
- phân bố: Bãi đáp 31 cách Bản Đông khoảng 8 km về phía bắc [A·apps.dtic.mil]
- hình thái, màu: Đồi dốc đến mức xe tăng không tấn công lên được [B·en.wikipedia.org]
- honest-null: tên khoa học, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Cứ điểm 543**
- hình thái, màu: Quả đồi cao rộng hàng mẫu, đất đá cày xới; địch bắn ra từ hầm, thông hào [A·baodautu.vn]
- hành vi, âm thanh: Máy bay địch gầm thét trên đầu như chuồn chuồn mùa hè [A·baodautu.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, mùa, thời tiết, mật độ, license

**Giàn ngụy trang và đường kín**
- hình thái, màu: Giàn tre công phu dọc đường để che dấu vết [B·historynet.com] · 'Đường kín': trồng cây, kết tán lá che kín cung đường [B·nhandan.vn]
- hành vi, âm thanh: Đội làm đường lùa đàn gia súc đi lại trên đường để xoá vết [B·historynet.com]
- mật độ, license: Đến 1973 xe chạy suốt tuyến dưới tán rừng, chỉ ra khỏi tán khi lội suối [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, mùa, thời tiết

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

**Ngầm Ta Lê**
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

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
- mật độ, license: Phun một lần chết 10–20% cây gỗ; hai lần liên tiếp chết 50–100% [A·nal.usda.gov] · Vùng bị phun nặng: 85–100% cây gỗ chết [A·digitalrepository.unm.edu]
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
- hình thái, màu: Đồi bị bạt thấp, mặt đường cày xới, cây cháy rụi, rừng già thành đồi trọc [B·baolaichau.vn] · Cảnh hoang tàn như vùng đất chết [B·baolaichau.vn] · Ban đêm pháo sáng sáng rực suốt đêm [B·sggp.org.vn] · Núi rừng rực đỏ bởi pháo sáng và bom đạn ban đêm [B·sggp.org.vn]
- mật độ, license: Hàng ngàn trọng điểm, tập đoàn trọng điểm trên mọi đường dọc, ngang [B·vnexpress.net]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết

**Trọng điểm A-T-P (Cà Roòng)**
- mật độ, license: 15 ngày, Mỹ ném 17.625 tấn bom xuống ATP [C·nguoiquansat.vn] · Hơn 10.000 lần ném bom, bắn phá, trong đó 2.450 lần B-52 [B·sggp.org.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Trọng điểm Trạ Ang**
- hình thái, màu: Km12 Đường 20, 8/1968: đỉnh núi sụp, lòng đường hiện ra dưới pháo sáng [B·sggp.org.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Trực thăng trên chiến trường Đường 9**
- hành vi, âm thanh: Trực thăng bị bắn bốc cháy quầng lửa đỏ, mảnh đạn văng vù vù [A·baohatinh.vn]
- mùa, thời tiết: Sáng 13/2/1971 bầu trời rợp máy bay địch [A·baohatinh.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, mật độ, license

**Đèo Phu La Nhích**
- hình thái, màu: Đèo bị bóc hết cây, hàng ngàn mét đường khoét sâu vào taluy [C·nguoiquansat.vn]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Đường 20 Quyết Thắng**
- phân bố: Từ Phong Nha bên sông Son đến ngã ba Lùm Phùm [C·nguoiquansat.vn]
- kích thước: Đoạn đường 20 hiện dài khoảng 70 km [C·nguoiquansat.vn]
- mật độ, license: Trục ngang có mật độ bom trên 1 km đường cao nhất Trường Sơn [C·nguoiquansat.vn]
- honest-null: tên khoa học, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Đường 9**
- độ cao: Dãy đồi phía bắc Đường 9: nhiều đỉnh 500–850 m [A·apps.dtic.mil]
- hình thái, màu: Đầu 1971 hư hỏng nặng, chỉ xe xích và jeep đi được [B·en.wikipedia.org] · Mặt đường lỗ chỗ, ổ gà xói, cỏ mọc kín từng đoạn, đá lở lấp một phần [A·usmcu.edu] · Khói, bụi và mù che tầm quan sát trên không [B·en.wikipedia.org] · Đường đất một làn, mặt gồ ghề, cầu cống bị phá [A·apps.dtic.mil] · Đường đất một làn bỏ hoang 40 năm, lề cao hai bên, không chỗ xoay xở [B·warfarehistorynetwork.com] · Rừng rậm hai bên đường [A·apps.dtic.mil] · Thung lũng Sê Pôn tương đối bằng, cây bụi xen mảng rừng lớn; núi cao phía bắc và nam [B·warfarehistorynetwork.com] · Quanh Sê Pôn địa hình thấp, cây thưa [A·apps.dtic.mil] · Đường bị vách núi cao phía nam khống chế, dễ bị chặn [A·apps.dtic.mil] · Vùng núi Quảng Trị: rừng hai–ba tầng tán, tầng dưới rất rậm; trung du khô, cây không cao quá đầu người [A·apps.dtic.mil] · Trung du khô cằn, cây không cao quá đầu người [A·apps.dtic.mil] · Bãi đáp trực thăng tự nhiên hiếm, thường bị phòng thủ [B·en.wikipedia.org] · Cây bụi rậm dọc đường; đường xấu, mưa lớn cản hành quân [A·ac119gunships.com] · Các bãi đáp trên sống núi cao phía nam, nhìn xuống Đường 9 [A·ac119gunships.com]
- mùa, thời tiết: Mùa mưa (tháng 6–11) đường thường không đi được [A·usmcu.edu]
- mật độ, license: Cuối chiến dịch: Đường 9 ngổn ngang xe tăng, xe cộ hỏng cháy [B·historynet.com]
- honest-null: tên khoa học, phân bố, kích thước, hành vi, âm thanh

**Đường xe Trường Sơn**
- kích thước: Đường đất rộng 5,5 m (18 ft), có đoạn rải sỏi hoặc lát gỗ ngang [B·en.wikipedia.org] · Đường ngụy trang rộng 18 ft [B·historynet.com] · Đến cuối chiến tranh: 5 trục dọc, 21 trục ngang, tổng 20.000 km [B·vnexpress.net]
- hình thái, màu: Đường dã chiến thiếu đường rải đá, mặt cứng [B·vnexpress.net] · Đoạn đường một bên vách đá dựng đứng, một bên vực sâu [A·baophapluat.vn] · Hang trong vách đá được công binh cải tạo làm chỗ xe tránh máy bay [A·baophapluat.vn] · Có đường tránh, đường song song vòng qua trọng điểm [B·vnexpress.net] · Lát đá làm mặt đường trong bom đạn, kiểm tra ban đêm bằng đèn dầu [B·sggp.org.vn]
- hành vi, âm thanh: Xe chạy đêm, ngày vào hang hoặc rừng rậm ẩn [A·baophapluat.vn] · Trăng sáng thì không bật đèn gầm; qua sông, lên dốc tắt hết đèn [B·baolaichau.vn] · Qua sông tắt đèn vì ánh sáng phản chiếu mặt nước [B·baolaichau.vn] · Xe bắt đầu chạy ngay sau hoàng hôn, thưa dần 3–6 giờ sáng [B·historynet.com]
- mùa, thời tiết: Mùa mưa biến đường mòn thành bùn, suối tràn bờ [A·apps.dtic.mil] · Mùa khô (khoảng tháng 11–4) mới thi công lớn được [A·apps.dtic.mil]
- honest-null: tên khoa học, phân bố, độ cao, mật độ, license

**Đường ống xăng dầu Trường Sơn**
- kích thước: Ống nhựa, có trạm bơm nhỏ; 4 tuyến, lớn nhất đường kính 20 cm [B·en.wikipedia.org]
- hình thái, màu: Ống và trạm bơm chôn ngầm hoặc giấu trong hang; qua suối cố định như cầu treo [B·special.nhandan.vn] · Có chỗ nối bằng ống lồ ô khoét rỗng; bể chứa là phuy 200 lít trên đỉnh đèo [B·vnexpress.net]
- honest-null: tên khoa học, phân bố, độ cao, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Đồi Không Tên (Cha Phi)**
- phân bố: Ngã ba Cha Phi, án ngữ Đường 16 xuống cụm cứ điểm Bản Đông [A·baohatinh.vn]
- hình thái, màu: Xác trực thăng Mỹ bị bắn rơi nằm trên đồi [A·baohatinh.vn]
- hành vi, âm thanh: Trực thăng bay rà thấp, gió cánh quạt làm nghiêng ngả ngọn cây [A·baohatinh.vn]
- honest-null: tên khoa học, độ cao, kích thước, mùa, thời tiết, mật độ, license


### asset_nguon (34)

**Artlist Vietnam Ambiences (Echoto Sound)**
- hành vi, âm thanh: Rừng có vượn hót và ve sầu kêu; rừng chạng vạng có chim và ve [A·artlist.io]
- mật độ, license: Giấy phép Artlist Pro: game/app cần giấy phép doanh nghiệp riêng [A·help-center.artlist.io]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, mùa, thời tiết

**BOOM Library Tropical Jungle**
- hành vi, âm thanh: Có khỉ rú (howler monkey, loài châu Mỹ): không đúng Đông Nam Á [B·thomannmusic.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, mùa, thời tiết, mật độ, license

**Echoto Jungle Adventure Vietnam**
- hành vi, âm thanh: Vượn đực hót, góc gần, nền rừng nhẹ [B·asoundeffect.com] · Ve sầu tần số cao, mic gần, tách riêng [B·asoundeffect.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, mùa, thời tiết, mật độ, license

**Evermotion Standard Licence**
- mật độ, license: Cho phép dùng để tạo trò chơi máy tính và phần mềm [A·evermotion.org] · Cấm đặt file chứa sản phẩm tách rời được lên website/máy chủ để bên thứ ba lấy: rủi ro với game web tải GLB [A·evermotion.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Freesound**
- mật độ, license: Âm CC0 không có hạn chế [A·freesound.org] · Noncommercial: không được kiếm tiền từ sản phẩm tạo ra, cấm ship trong game thương mại [A·freesound.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Giấy phép BOOM Library**
- mật độ, license: Một người dùng duy nhất, không mở rộng cho công ty [A·boomlibrary.com] · Phải kết hợp với yếu tố khác; cấm dùng 'trần' hay như sản phẩm rời [A·boomlibrary.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Giấy phép Fab Standard License**
- kích thước: Ngưỡng bậc giá: doanh thu gộp 100.000 USD trong 12 tháng gần nhất [A·dev.epicgames.com]
- mật độ, license: Dùng được với mọi công cụ tương thích, không giới hạn ở Unreal Engine [A·fab.com] · Được phân phối thương mại dự án có tích hợp asset Fab [A·fab.com] · Cấm bán lại hoặc phân phối lại asset dưới dạng rời (standalone) [A·fab.com] · Bậc Reference-Only (UEFN) không cấp file định dạng nguồn, không hợp cho three.js [A·fab.com] · Epic đang loại bỏ dần giấy phép UE Marketplace; sản phẩm mới không phát hành theo giấy phép đó [A·dev.epicgames.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Giấy phép Poly Haven CC0**
- mật độ, license: CC0: dùng mọi mục đích kể cả thương mại, không bắt buộc ghi công [A·polyhaven.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Giấy phép ambientCG CC0**
- mật độ, license: Được đưa file thô vào dự án, ví dụ trò chơi điện tử; không bắt buộc ghi công [A·docs.ambientcg.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Gói Fab FANTASTIC Lost Jungle (Tidal Flask Studios)**
- kích thước: Giá từ 49,99 USD [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Gói Fab Jungle Pack (A. zoOmika)**
- hình thái, màu: Cây, bụi, dương xỉ, dây leo, đá, tán lá cho rừng rậm [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Gói Fab MW Tropical Rainforest Biome (MAWI United)**
- kích thước: Giá từ 324,99 USD [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Gói Fab POLYGON Tropical Jungle (Synty Studios)**
- hình thái, màu: Low-poly phong cách: cọ, cây rừng, bụi, dương xỉ, hoa, cỏ, đá, vách, thác [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Gói Fab Rain Forest Pack (Kaizen Digital Interactive)**
- kích thước: Hơn 120 asset, bản đồ mẫu 1 km2, texture tới 4K, Nanite UE 5.1+ [A·fab.com] · Giá từ 79,99 USD [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Gói Fab Tropical Jungle (Dokyo)**
- phân bố: Nguồn thực vật từ Costa Rica (Trung Mỹ), không phải Đông Nam Á [A·fab.com]
- honest-null: tên khoa học, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Gói Fab Tropical Jungle Pack (Kaizen Digital Interactive)**
- kích thước: Giá từ 49,99 USD [A·fab.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Gói Sonniss GDC Game Audio Bundle**
- mật độ, license: Royalty-free, dùng thương mại, không bắt buộc ghi công, vĩnh viễn [A·sonniss.com] · Không được phân phối dưới dạng file rời hay trong thư viện âm thanh; cấm huấn luyện AI/ML [A·sonniss.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Macaulay Library**
- mật độ, license: Mọi dùng thương mại cần hợp đồng license, có thể tính phí [A·support.ebird.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Maxtree Plant Models**
- mật độ, license: Theo CG Channel: file được cấp phép dùng thương mại (chưa thấy trang license chính thức) [B·cgchannel.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Poly Haven Anthurium Botany 01**
- hình thái, màu: Cây bụi lá rộng bóng, ánh ướt, gân lá rõ, mọc thành khóm thấp [A·api.polyhaven.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Bamboo Tunnel (HDRI)**
- hình thái, màu: HDRI đường hầm tre khô giữa trưa, tán vòm dày, nắng ấm lốm đốm [A·api.polyhaven.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Brown Mud Rocks 01**
- hình thái, màu: Bùn nâu lẫn sỏi, đá, rêu, cỏ dại; bờ suối, đất ướt [A·api.polyhaven.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Fern 02**
- hình thái, màu: Bốn khóm dương xỉ, lá có răng cưa, xanh lốm đốm [A·api.polyhaven.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Forest Leaves 02**
- hình thái, màu: Nền rừng phủ rêu: mảng rêu gồ, lá rụng, cành nhỏ, mùn [A·api.polyhaven.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Mossy Rock**
- hình thái, màu: Đá phong hoá có vân, nứt, địa y lốm đốm và mảng rêu xanh [A·api.polyhaven.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Poly Haven Pachira Aquatica 01**
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**Rainforest Ambience Phong Nha Vietnam (Libby và Marcel)**
- phân bố: Ghi ở Phong Nha: vườn thực vật và gần động Thiên Đường bên sông [B·payhip.com]
- kích thước: 30 file, 93 phút, WAV 192 kHz/24-bit, giá 5 USD [B·payhip.com]
- hành vi, âm thanh: Tiếng chim, ếch kêu, thác nước [B·payhip.com]
- mật độ, license: Ghi 'Royalty-free' nhưng chưa đọc được văn bản License Agreement (game/thương mại chưa rõ) [B·payhip.com]
- honest-null: tên khoa học, độ cao, hình thái, màu, mùa, thời tiết

**Sonniss Tropical Ambiences (Stéphane Fufa Dufour)**
- hành vi, âm thanh: Đêm rừng mưa: suối sương mù ban đêm, mưa đêm có giọt rơi từ lá [A·sonniss.com] · Suối rừng mưa chảy lớn với tiếng chim lác đác [A·sonniss.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, mùa, thời tiết, mật độ, license

**SpeedTree Library Asset**
- mật độ, license: Library Asset chỉ được dùng như thành phần nhúng của sản phẩm được cấp phép [A·unity.com] · Licensed Production là sản phẩm định danh bằng tên trong Order Form [A·unity.com] · SpeedTree Cinema không được dùng cho sản phẩm tương tác/thời gian thực [A·unity.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**Thư viện Quixel Megascans trên Fab**
- kích thước: Từ 2025: gói khởi đầu miễn phí hơn 1.500 asset chọn lọc, cho mọi engine [A·unrealengine.com] · Giá lẻ từ 0,99 USD (asset 2D/3D), 4,99 USD (kit thủ tục), 24,99 USD (gói) [B·cgchannel.com]
- mật độ, license: Miễn phí cho mọi engine đến hết 2024 (phải nhận vào thư viện Fab) [A·unrealengine.com] · Từ 2025 phần lớn Megascans không còn miễn phí, kể cả trong Unreal Engine [B·cgchannel.com] · Megascans tải qua Bridge theo Epic Content License cũ chỉ được dùng miễn phí trong Unreal Engine: CẤM cho three.js [B·cgchannel.com]
- honest-null: tên khoa học, phân bố, độ cao, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

**ZapSplat Thailand jungle ambiences**
- hành vi, âm thanh: Ghi ban đêm: côn trùng, ve sầu lớn, ếch, mưa nhỏ nhỏ giọt từ tán [B·zapsplat.com]
- mật độ, license: Giấy phép ZapSplat cho game/app; bản miễn phí phải ghi công 'ZapSplat', Premium thì không [A·zapsplat.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, mùa, thời tiết

**ambientCG Ground037**
- hình thái, màu: Nền rừng ẩm, rêu xanh, cỏ mọc um [A·ambientcg.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**ambientCG Ground106**
- hình thái, màu: Đất nâu be, lá rụng, bùn, lòng suối, gồ ghề [A·ambientcg.com]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hành vi, âm thanh, mùa, thời tiết, mật độ, license

**xeno-canto**
- mật độ, license: Mọi bản ghi theo một giấy phép Creative Commons, mỗi bản một loại: phải kiểm từng bản [B·en.wikipedia.org]
- honest-null: tên khoa học, phân bố, độ cao, kích thước, hình thái, màu, hành vi, âm thanh, mùa, thời tiết

