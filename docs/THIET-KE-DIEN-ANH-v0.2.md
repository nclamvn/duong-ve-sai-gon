BẢN BỔ SUNG PRD v0.2 \| 05/09/2026

Dành cho chủ dự án, thiết kế game, mỹ thuật và Codex / Claude Code.

Kết luận: làm một lát cắt Cổng Trời có chất lượng trải nghiệm hoàn chỉnh
trước khi mở rộng tám nhiệm vụ. Phim mở đầu phải dẫn vào một trò chơi có
cảm giác tốt, mục tiêu rõ và đồng đội đáng nhớ.

Tài liệu này tập hợp các phần mới của PRD v0.2. Số mục giữ theo PRD để
dễ tra cứu; mục 8 được đặt sau định hướng trải nghiệm. Bản Markdown đi
kèm là PRD đầy đủ đã sửa tại chỗ. Chưa có video hoặc build game được sản
xuất trong lần bàn giao này.

# 19. ĐÁNH GIÁ THIẾT KẾ CHUYÊN NGHIỆP

## 19.1 Kết luận và giới hạn đánh giá

**GO có điều kiện cho một lát cắt chơi được của Cổng Trời; chưa đủ cơ sở
khóa sản xuất toàn bộ tám nhiệm vụ.** Đường Về Sài Gòn có bản sắc nhờ
hành quân, đồng đội, thư và sự thay đổi ý nghĩa của việc nổ súng. Giá
trị cần theo đuổi từ FPS điện ảnh là nhịp dẫn dắt, cảm giác điều khiển,
dàn cảnh và âm thanh; dự án cần một ngôn ngữ hình ảnh riêng cho Việt Nam
1971--1975.

Đánh giá này dựa trên PRD v0.1 đính kèm. Chưa có build chơi thử, video
gameplay, repo, bench thô hoặc file KICH-BAN-v0.1.md để kiểm độc lập.
Những con số HT-MB, tình trạng engine và nhân vật trong nguồn được xem
là thông tin do tài liệu báo cáo. Đây là đánh giá thiết kế tài liệu,
không phải chấm điểm chất lượng game đã chạy. Các đề xuất thoại/cảnh mới
là hư cấu sáng tác, chưa thay thế kịch bản gốc hoặc chứng nhận lịch sử.

  -----------------------------------------------------------------------
  Mảng          Điểm mạnh                    Khoảng trống phải xử lý
  ------------- ---------------------------- ----------------------------
  Tầm nhìn      Có đích cảm xúc khác FPS     Cần biến "không muốn bắn"
                tính điểm tiêu diệt          thành tình huống chơi có
                                             quyền chủ động

  Chiến dịch    Mỗi nhiệm vụ có địa hình và  Tám map dễ thành tám dự án;
                cơ chế riêng                 phải chốt một cơ chế và một
                                             hình ảnh nổi bật cho mỗi map

  Chiến đấu     Có cover, suppression, âm    Thiếu nhịp encounter, độ rõ
                thanh và đội hình            mục tiêu, feedback tay/súng
                                             và quy tắc AI công bằng

  UI/UX         Tối giản, tiếng Việt, có phụ Máu/đạn quá mơ hồ; chưa có
                đề                           luồng lỗi, quay lại, chọn
                                             nhiệm vụ và điểm chuyển
                                             phim--game

  Đồ họa        Registry asset, LOD,         Danh sách FX rộng hơn kế
                streaming và hạn mức         hoạch art; raymarch, SSR,
                                             bóng và lá cùng tranh ngân
                                             sách GPU

  Cốt truyện    Người lính thường, thư và    Hành trình cùng nhân vật qua
                đồng đội là nền tốt          các mặt trận cần lý do và
                                             mốc chuyển; không tự thêm
                                             quan hệ nhân vật khi chưa
                                             đọc kịch bản

  Sản xuất      Có gate, kiểm sử, tiêu chí   UI/âm thanh/animation để
                thu hẹp                      muộn làm G1 không chứng minh
                                             được chất lượng trải nghiệm
  -----------------------------------------------------------------------

## 19.2 Các quyết định sửa v0.1

  ------------------------------------------------------------------------
  ID        Quyết định thiết kế  Tác động
            v0.2                 
  --------- -------------------- -----------------------------------------
  DD-201    G1 chứng minh 12--15 Chưa cần dựng kín 0,96 km² để biết game
            phút chơi đại diện,  có đáng chơi
            trong map M1 dự kiến 
            35 phút              

  DD-202    Một khẩu súng FP,    Dùng mẫu này để nhân rộng, không sản xuất
            một đồng đội gần,    hàng loạt asset chưa đạt
            một tuyến rừng và    
            một encounter phải   
            đạt chất lượng mẫu   

  DD-203    Phim mở đầu 90 giây, CINE-00 thay briefing M1 trên đường chơi
            briefing ngắn từng   chiến dịch lần đầu
            nhiệm vụ, chuyển vào 
            game khoảng 12 giây  

  DD-204    UI và tiếp cận làm   Sửa phân kỳ, không âm thầm coi phần mới
            từ G1; G5 hoàn thiện là miễn phí
            ngôn ngữ, kiểm tra   
            và polish            

  DD-205    60 FPS ổn định là    Màn 120 Hz không tạo ra cam kết render
            mục tiêu gameplay;   120 FPS
            120 FPS là thử       
            nghiệm sau khi đạt   

  DD-206    Máu/đạn rõ mặc định; Giữ chất thời kỳ ở hình thức, giảm phạt
            Nhập vai là tùy chọn người chơi vì thiếu thông tin

  DD-207    Mỗi lần chết chỉ lặp Điểm lưu không bắt xem lại phim hoặc hành
            tối đa khoảng 2--3   quân dài
            phút chiến đấu đã    
            học                  

  DD-208    Khóa liên tục nhân   Biên tập viên phải giải thích chuyển
            vật trước khi thu    Quảng Trị--Hà Nội--1973; phương án đổi
            thoại cuối           POV chỉ là lựa chọn cần chủ dự án quyết
                                 định
  ------------------------------------------------------------------------

Về thời lượng: tám nhiệm vụ trong bảng gốc cộng thành 290 phút. Với đoạn
1973 dài 180 giây, CINE-00 90 giây, briefing M2--M8 tổng 310 giây và tám
handoff 12 giây, một lượt đi thẳng khoảng 301 phút, chưa tính
chết/tải/đọc thư. Vì vậy "4--5 giờ" nên đổi thành "khoảng 5 giờ theo
tuyến chính; xác nhận bằng playtest", hoặc phải chủ động rút gameplay.
Không cộng thêm CINE-M1 40 giây vào lượt đầu.

# 20. THIẾT KẾ TRẢI NGHIỆM VÀ ĐỊNH HƯỚNG MỸ THUẬT

## 20.1 Bốn trụ cột dùng để duyệt mọi tính năng

**Ở trong một cơ thể.** Tay giữ dây ba lô, hơi thở sau dốc, bùn bám gấu
quần và tiếng vải tạo trọng lượng. Điều khiển phải đáp ứng trước,
animation trang trí theo sau; không dùng camera lắc liên tục để giả sức
nặng.

**Sống cùng một nhóm người.** Đồng đội có cách đi, cử chỉ, đồ dùng và
giọng riêng; phản hồi khi được giúp. Trong G1 chỉ cần một quan hệ đáng
nhớ qua ba lần tương tác. Không cần hệ hội thoại sinh bằng LLM khi đang
chơi.

**Nguy hiểm có thể đọc và học.** Tiếng động, tia lửa, chuyển động lá và
phản ứng đồng đội báo nguy. AI không nhìn xuyên cỏ đậm mà người chơi
không nhìn xuyên được; nghe không đồng nghĩa biết chính xác tọa độ. Mỗi
lần thua phải giải thích được bằng tình huống đã nhận biết.

**Sự yên lặng có ý nghĩa.** Sau giao chiến để người chơi đi, nhìn, giúp
và chọn tốc độ. M8 kết thúc bằng quyền bước tiếp hoặc dừng lại quan sát;
không biến đoạn cuối thành một video dài thay cho quyền điều khiển.

## 20.2 Cổng Trời: lát cắt 15 phút cần làm trước

Thời gian dưới đây tính từ lúc có quyền điều khiển, không bao gồm phim
và tải. Đây là đề xuất nhịp chơi, không phải xác nhận sự kiện lịch sử
hoặc đoạn trích từ kịch bản chưa được cung cấp. Không gộp mọi cơ chế M1
vào lát cắt.

  -----------------------------------------------------------------------
  Phút      Trải nghiệm,    Hành động và dẫn hướng Camera, âm thanh, kiểm
            mức căng 1--5                          chứng
  --------- --------------- ---------------------- ----------------------
  0--2      Nhập vai, 1     Đi theo một đồng đội;  Tay gấp thư; suối ở
                            chọn nhìn thư hoặc đi  xa. Ít nhất 4/5 người
                            ngay; học nhìn/đi/cúi  mới hiểu ai cần theo

  2--4      Tò mò, 2        Qua lối hẹp và bậc     Khoảng sáng ở lối ra;
                            thấp; học giữ khoảng   tiếng dép/vải. Không
                            cách                   bảng tutorial phủ màn

  4--6      Lo lắng, 3      Tiếng động cơ; tìm chỗ Chỉ gợi hướng, không
                            khuất theo đồng đội    giật camera; caption
                                                   tương đương khi tắt âm

  6--8      Vượt khó, 3     Qua một ngầm nông theo Nước/bùn vừa đủ, không
                            lối dễ đọc; hỗ trợ một bắt buộc hệ bơi M3;
                            người ở bờ             điểm lưu A sau bờ an
                                                   toàn

  8--11     Giao chiến      4--6 đối thủ theo các  Khẩu súng mẫu, impact
            ngắn, 5         đợt nhỏ; hai tuyến     rõ; không thêm phương
                            cover nối lại; mục     tiện. Điểm lưu B trước
                            tiêu thoát vùng        encounter

  11--13    Giải tỏa, 2     Đổi băng, kiểm thương, Hạ nhạc, tiếng rừng
                            tìm lại đồng đội       trở lại; không VO dài
                                                   lúc đang bị bắn

  13--15    Gắn bó, 1       Đưa bi đông bằng tương Một câu đáp ngắn,
                            tác tùy chọn; nhìn     không thưởng XP;
                            tuyến đường tiếp theo  checkpoint C, kết demo
                                                   ở quyền điều khiển
  -----------------------------------------------------------------------

M1 hoàn chỉnh mới thêm phần đêm và sự kiện máy bay theo kịch bản/kiểm
sử. Lát cắt ban đầu chỉ dùng động cơ xa chưa định danh nếu chưa có
nguồn. Dẫn hướng theo ba tầng: bố cục/âm thanh, đồng đội gợi ý, trợ giúp
UI do người chơi bật. Sau khoảng 20 giây không tiến triển, nhắc một lần;
không spam hoặc tự di chuyển nhân vật.

## 20.3 Combat feel, quyền chủ động và luật công bằng

GUN-201: với khẩu mẫu, input bắn tạo phản hồi hình/âm ở frame render kế
tiếp khi game đang sẵn sàng; animation tay không đợi mạng. Đồng bộ nòng
súng, âm nổ, vỏ đạn và impact theo event, tránh phát hai lần sau load.
Mục tiêu thử ADS 180--240 ms, không phải thông số thực của súng; tinh
chỉnh bằng người chơi. Recoil gameplay, viewmodel kick và camera shake
là ba lớp riêng.

GUN-202: đạn va đất, gỗ, đá và kim loại có âm/hạt khác nhau nhưng dùng
chung pool. Không đặt hit marker âm lớn kiểu arcade làm mặc định; tùy
chọn xác nhận trúng nhẹ cho người cần rõ hơn. Thay băng có trạng thái
hủy và thời điểm nạp đạn xác định; không mất/nhân đôi đạn khi chuyển
animation.

ENC-201: encounter mẫu có cover chính, một lối đổi vị trí, khoảng rút và
tuyến AI hợp lệ. Không spawn trước mắt, sau lưng vừa dọn sạch hoặc trong
collider. Độ khó v0.1 được giữ để đo ban đầu; nếu không tạo đủ khác
biệt, chỉ sửa các tham số phản ứng/độ chính xác/nhịp áp chế sau playtest
và ADR, không thêm AI gian lận.

PLY-008 được sửa: người đầu hàng có vũ khí hạ/bỏ, cử chỉ và lời thoại
nhất quán; "cởi áo" không là điều kiện nhận dạng. Trước khi chuyển
protected phải có tín hiệu đọc được và xử lý đạn đang bay từ trước;
trạng thái đã đầu hàng không tự quay sang bắn lén trong cùng encounter.
Lựu đạn hoặc sát thương do script/AI không được gán nhầm cho người chơi.
Không dùng người dân chạy bất ngờ vào làn đạn làm bẫy thất bại. Nếu vi
phạm có chủ ý sau tín hiệu rõ, tải checkpoint an toàn với lời giải thích
ngắn. Không có điểm số cho băng bó tù binh.

Cảnh thua có kịch bản ở M7 phải chuyển mục tiêu sang rút/cứu người trước
khi tình thế trở thành bất khả thắng. Không giả vờ cho phép thắng rồi vô
hiệu hóa mọi phát bắn. Nhân vật có tên chết theo kịch bản và lính mới có
thể chết do gameplay phải được tách trong save; không ghi lại cái chết
của nhân vật cốt truyện bằng tai nạn AI.

## 20.4 Mỹ thuật theo khoảng cách và thứ tự đầu tư

  -----------------------------------------------------------------------
  Lớp           Điều tạo chất lượng cảm nhận Cách giữ khả thi
  ------------- ---------------------------- ----------------------------
  0--2 m        Tay, vải, gỗ súng, dây da,   Một bộ tay và một súng mẫu
                chuyển động thay băng, cạnh  hoàn chỉnh; không tăng
                kim loại có độ mòn có chủ    polygon để chữa rig sai
                đích                         

  2--15 m       Mặt/cử chỉ một đồng đội,     Hero prop tập trung theo
                cửa, bi đông, bảng chữ, rễ   shot; vết bẩn có nguyên
                và nước cạnh đường           nhân, không phủ noise mọi bề
                                             mặt

  15--60 m      Silhouette đối thủ, ánh sáng Kiểm alpha overdraw và bóng;
                lối đi, lớp cây, khói tách   mật độ hình ảnh dày không
                không gian                   buộc mật độ collider dày

  Xa hơn        Đồi núi, trời, đoàn xe,      LOD, impostor và sự kiện xa;
                đường chân trời và quy mô    không mô phỏng mọi thứ ngoài
                chiến trường                 tuyến chơi
  -----------------------------------------------------------------------

Các lớp lá phải có khác biệt hình khối và sắc độ, tránh "bức tường
xanh". Cây sát đường có vài chi tiết chạm được; tán xa dùng impostor.
Lối đi, đối thủ và vật tương tác vẫn đọc được khi tắt bloom, AO và
volumetric. Tia nắng chỉ dùng ở shot đáng nhớ, không bắt buộc mọi ô
rừng.

Không dùng nước ướt/SSR phủ toàn cảnh để tạo cảm giác cao cấp. Roughness
đúng vật liệu và nguồn sáng có chủ đích quan trọng hơn phản xạ dày. Skin
không bóng nhựa; texture mới không sửa được áo sai silhouette. Chữ trên
biển hiệu phải được dựng thành vector/texture từ chuỗi đã duyệt, không
chấp nhận chữ AI sai dấu trong asset cuối.

VFX kể chuyện: bụi lắng trên đồ vật, vải ướt tối màu ở mép, một chiếc
dép mắc bùn, bóng đèn chao nhẹ khi có rung. Chọn tối đa ba chi tiết gần
camera mỗi đoạn; dùng mask/decal/animation cục bộ, không tạo hệ mô phỏng
toàn cục cho từng chi tiết. Cận mặt chỉ đưa vào phim khi rig, mắt và
biểu cảm đạt mẫu; nếu chưa đạt, kể bằng tay, vai, bóng và phản ứng.

## 20.5 Nhận diện hình ảnh và âm thanh của tám nhiệm vụ

  -----------------------------------------------------------------------
  Nhiệm vụ      Bảng màu và hình ảnh chủ đạo Khoảnh khắc đồ họa/âm thanh
                                             cần giữ
  ------------- ---------------------------- ----------------------------
  M1 Cổng Trời  Xanh lá trầm, đất ẩm, ánh    Tiếng chân và hơi thở đối
                sáng nhỏ lọt tán             lập tiếng động cơ; một bàn
                                             tay giúp qua ngầm

  M2 Bản Đông   Đêm xanh than, đất xám, pháo Bóng người đổi hướng khi
                sáng ấm                      pháo sáng rơi; rotor chỉ át
                                             thoại ở đoạn không mang
                                             thông tin

  M3 Quảng Trị  Nước lạnh, gạch đỏ sẫm, bụi  Mặt nước che rồi mở chân
                nhạt                         trời; dùng âm trầm và khoảng
                                             lặng thay cho rung kéo dài

  M4 Hà Nội     Phố có màu đời thường, sau   Một đồ vật trước/sau biến
                đó bụi bạc                   cố; tiếng gọi dẫn cứu người.
                                             Không trang trí đau thương
                                             như cảnh tượng để ngắm

  M5 Buôn Ma    Đất đỏ, vải bạc, nắng sớm    Bụi xe tách lớp phố; người
  Thuột                                      dân có hành động có mục đích
                                             thay vì crowd chạy hỗn loạn

  M6 Hải Vân    Biển bạc, núi xanh, đường    Không gian mở và tiếng gió
                xám                          tạo nhịp thở; camera trên xe
                                             giảm rung theo tùy chọn

  M7 Xuân Lộc   Hàng cao su lặp, đất khô,    Tuyến thẳng bị phá vỡ bằng
                khói mờ                      lối rút; sự kiện CBU-55 chỉ
                                             sản xuất sau kiểm nguồn
                                             riêng

  M8 Sài Gòn    Ánh sáng tự nhiên, màu phố   Âm xe/tiếng người dần thay
                trở lại                      tiếng súng; ending giữ màu
                                             thật, không ép LUT vàng
                                             chiến thắng
  -----------------------------------------------------------------------

Đây là art direction đề xuất, không khẳng định màu ảnh tư liệu tương
đương màu thật. M8 nên dùng các mốc giờ có chuyển đoạn rõ để nén hành
trình; không quảng bá mô phỏng mặt trời "chính xác" khi thời gian kể
chuyện bị nén mạnh. Quan hệ khoảng cách--âm thanh và kiểu nổ đặc thù
trong AUD-003/VFX-006 còn cần chuyên môn kiểm; không duyệt chỉ vì nghe
hoặc nhìn kịch tính.

# 8. UI, UX, TRÌNH BÀY, TIẾP CẬN --- cập nhật v0.2

Bố cục dưới đây là sơ đồ UI để duyệt thứ bậc thông tin; phần chi tiết và
tiêu chí triển khai theo các mục tiếp theo.

![Ba sơ đồ bố cục menu chính, HUD trong nhiệm vụ và màn phim mở đầu bằng
tiếng Việt.](media/image1.png){width="6.5in"
height="4.708333333333333in"}

## 8.1 Nguyên tắc giao diện

**Giao diện mang chất liệu của ký ức; thông tin chiến đấu phải rõ
ngay.** Menu dùng giấy, vải, mực và bản đồ minh họa; HUD dùng chữ sạch,
tương phản tốt. Không ép mọi thông tin thành đồ vật trong thế giới game:
việc đọc máu, đạn và mục tiêu không được biến thành thao tác rườm rà.
Không dùng màn hình vệ tinh, kính nhìn đêm, mã nhị phân hay nhiễu số làm
ngôn ngữ chủ đạo cho bối cảnh 1971--1975.

UX-001 được làm rõ: không mini-map mặc định, nhưng có trợ giúp định
hướng tùy chọn. Hiển thị cả đạn trong súng và băng dự trữ ở chế độ mặc
định; chế độ Nhập vai có thể ẩn số đạn nhưng phải có thao tác kiểm tra.
Nhịp thở và thay đổi hình ảnh hỗ trợ trạng thái sức khỏe, không phải
kênh thông tin duy nhất.

## 8.2 Luồng vào game và quay lại

  -----------------------------------------------------------------------
  Màn hình      Nội dung và thao tác chính   Trạng thái phải xử lý
  ------------- ---------------------------- ----------------------------
  Khởi động lần Tiếng Việt mặc định; phụ đề  Chưa phát tiếng trước thao
  đầu           bật; nút Bắt đầu; truy cập   tác người dùng; cài đặt lưu
                ngay Âm thanh, Phụ đề, Giảm  trước khi phát phim
                chuyển động                  

  Menu chính    Tiếp tục lớn nhất khi có     Không có save thì ẩn Tiếp
                save; Chiến dịch mới; Chọn   tục; có save thì Chiến dịch
                nhiệm vụ; Túi thư; Tùy       mới phải xác nhận ghi đè
                chỉnh; Những người thực hiện 

  Bắt đầu chiến Hai lựa chọn rõ: Xem mở đầu  Chọn vào nhiệm vụ bỏ phim;
  dịch          / Vào nhiệm vụ               vẫn hiện ngày, nơi chốn, mục
                                             tiêu và thao tác đầu tiên

  Chọn nhiệm vụ Ba hồi; tên nhiệm vụ; ngày   Chơi lại dùng trạng thái
                tháng đã duyệt; trạng thái   khởi đầu đã định nghĩa;
                đã hoàn thành; tóm tắt không không sửa save chiến dịch
                tiết lộ đoạn sau             chính

  Đang chuẩn bị Ký họa và trạng thái thực:   Chỉ hiện % khi biết mẫu số;
                Đang tải khu vực / Đang      lỗi có Thử lại và Về menu;
                chuẩn bị cảnh / Sẵn sàng     không giả tiến độ

  Tạm dừng      Tiếp tục; Mục tiêu hiện tại; Esc, mất khóa chuột hoặc
                Tải điểm lưu; Tùy chỉnh; Về  chuyển tab đều tạm dừng game
                menu                         đơn; không chết khi đang đọc

  Thất bại      Nguyên nhân cụ thể; Tải điểm Không phát lại phim đã xem;
                lưu; Tùy chỉnh               không đặt điểm lưu trong
                                             trạng thái chết hoặc thiếu
                                             đồ bắt buộc

  Hoàn thành    Một đoạn nhật ký ngắn, thư   Không bảng xếp hạng số mạng;
                mới nếu có, Tiếp tục / Về    chỉ ghi nhận mục tiêu và
                menu                         điều người chơi đã trải qua
  -----------------------------------------------------------------------

Menu nền là một góc lán với túi thư, bi đông, bóng cây; về sau chỉ thay
1--2 đạo cụ theo tiến độ. Tránh dựng tám menu 3D riêng. Nền động giới
hạn 30 FPS; có ảnh tĩnh tương đương. Chuyển mục 120--180 ms, không để
animation chặn thao tác. Bản đồ chiến dịch là bản đồ kể chuyện đã biên
tập, không được trình bày như bản đồ hành quân lịch sử đã xác minh.

## 8.3 Hệ chữ, màu và bố cục

Các số dưới đây là token đề xuất để prototype, không phải bằng chứng đã
đạt chuẩn tiếp cận. Tính theo CSS pixel trên viewport 1280 × 800; kiểm
thêm 1440 × 900, 1920 × 1200 và 16:9. Render scale của cảnh 3D không làm
giảm độ phân giải UI.

  -----------------------------------------------------------------------
  Thành phần       Đặc tả v0.2
  ---------------- ------------------------------------------------------
  Màu              Nền than #151A18; giấy #E9E0CD; mực #202823; điểm nhấn
                   đất #BE995B; nguy hiểm #C7614C. Trạng thái có biểu
                   tượng/chữ kèm màu

  Chữ              Noto Sans hoặc font tương đương có đủ dấu Việt cho
                   UI/phụ đề; serif chỉ cho tiêu đề và thư. Chữ viết tay
                   chỉ là hình thức, luôn có Bản dễ đọc

  Cỡ chữ           Menu 18--22 px; thông tin phụ 16 px; phụ đề mặc định
                   24 px, tăng đến 48 px; UI scale 100--150%. Không dùng
                   chữ toàn hoa cho đoạn dài

  Vùng an toàn     Lề HUD ít nhất 5% chiều ngang/dọc. Chừa vùng phụ đề
                   giữa đáy; objective, thông báo nhặt đồ và prompt không
                   chồng nhau

  Tương phản       Mục tiêu chữ thường ít nhất 4,5:1 trên nền cuối cùng;
                   kiểm cả cảnh sáng, đêm và cảnh nổ. Phụ đề có nền đen
                   tùy độ đục 0--100%

  Điều hướng       Tab/Shift+Tab, Enter, Esc; focus nhìn thấy; remap phím
                   cập nhật mọi prompt. Nút chính tối thiểu 44 × 44 CSS
                   px trong bố cục chuột

  Âm UI            Giấy, bút, khóa túi tiết chế; mỗi thao tác một phản
                   hồi ngắn; âm xác nhận không lớn hơn thoại
  -----------------------------------------------------------------------

## 8.4 HUD theo ngữ cảnh

Góc trên trái: một mục tiêu hiện tại, ví dụ "Theo tiểu đội xuống ngầm";
xuất hiện 6 giây khi đổi rồi thu gọn. Nhấn phím Mục tiêu để xem lại; hỗ
trợ tăng thời gian hoặc luôn hiện. Không nhắc lại mỗi vài giây.

Giữa màn hình: chấm ngắm nhỏ tùy chọn; prompt "E · Qua ngầm" chỉ hiện
với đối tượng hợp lệ và trong tầm. Khi ADS, chấm ngắm ẩn; không thu nhỏ
chữ hoặc làm mờ cả màn để giả tập trung. Góc dưới phải: đạn trong súng,
băng dự trữ, băng cá nhân; hướng bố trí tránh bàn tay và phụ đề.

Sức khỏe có trạng thái chữ/biểu tượng "Ổn định / Bị thương / Nguy kịch"
tùy chọn, đủ đọc khi tắt hiệu ứng tổn thương. Đồng đội nhận diện bằng
silhouette, vị trí, giọng và dấu nhỏ khi nhìn vào; không chỉ dựa vào màu
quân phục. Trợ giúp định hướng bật theo nhu cầu: nhắc hướng bằng
thoại/chữ, rồi dấu vị trí mục tiêu; không tự xoay camera.

Khi hành quân, HUD thu gọn nhưng không giấu thông tin cần thiết. Trong
giao chiến, đạn và tình trạng bị thương hiện rõ. Khi đọc thư, game tạm
dừng; có Bản dễ đọc, Nghe đọc, Đóng. Lệnh tiểu đội dùng ba ô ngắn gắn
phím; lệnh không thực hiện được phải trả lời "Chưa có đường tới đó",
không im lặng.

## 8.5 Tiếp cận và cảm giác điều khiển

UX-005 và A11Y-001 có hiệu lực từ G1. Phụ đề áp dụng cả phim, thoại
ngoài khung hình và lời dẫn; tên người nói xuất hiện khi đổi người.
Caption âm thanh quan trọng như "\[Động cơ phía trên, bên trái\]" có thể
bật riêng; không tiết lộ đối thủ chưa thể nghe/thấy. Phụ đề thường tối
đa hai dòng, ưu tiên khoảng 36--40 ký tự mỗi dòng, ngắt theo nghĩa và
kiểm trực tiếp với tiếng Việt. Các nguyên tắc này tham chiếu XAG 104; cỡ
chữ cụ thể ở trên là lựa chọn của dự án. \[R04\]

Preset Giảm chuyển động: tắt head bob, camera roll, blur, grain,
chromatic aberration, zoom do chạy và rung phụ; giữ nguyên độ giật ảnh
hưởng gameplay của vũ khí nhưng tách khỏi rung trang trí. FOV hiển thị
rõ là góc ngang quy đổi tại 16:9: mặc định 90°, dải thử 75--110°;
Three.js lưu góc dọc nên phải chuyển đổi, không gán thẳng cùng con số.
Có độ nhạy riêng hip-fire/ADS, đảo trục, giữ/bật tắt ADS, cúi và tương
tác. \[R05\]

Âm thanh có preset Tai nghe / Loa / Ban đêm với dải động hẹp; slider
nhạc, thoại, hiệu ứng độc lập. Tắt ù tai không được làm mất tín hiệu
nguy hiểm. Phim có Pause, Bỏ qua, Phụ đề và âm lượng; phím tắt luôn được
chú thích. Giữ để bỏ qua 0,6 giây là mặc định; có lựa chọn bấm một lần
trong tiếp cận.

RAT-001: giữ mục tiêu nội dung trưởng thành, máu vừa và không tra tấn
của v0.1; đây chưa phải phân loại độ tuổi được cấp. Ghi "Nhân vật hư cấu
trong bối cảnh lịch sử" ở phần giới thiệu, có thể mở lại; không dùng
tuyên bố này để thay việc kiểm sử. A11Y-002 mở rộng thành kiểm toàn bộ
cảnh nhấp nháy, âm lớn và rung; preset giảm cường độ phải có cả bản phim
phù hợp hoặc bản tĩnh kèm lời dẫn, vì tắt shader không sửa được hiệu ứng
đã nướng vào video.

## 8.6 Nghiệm thu UI/UX

  -----------------------------------------------------------------------
  ID               Pass bắt buộc
  ---------------- ------------------------------------------------------
  UX-101           Người mới tìm được Bắt đầu, Phụ đề và Tùy chỉnh mà
                   không cần người hướng dẫn trong bài thử ngắn

  UX-102           Cả đường Xem mở đầu và Vào nhiệm vụ đều đến đúng trạng
                   thái M1; không lặp hai phim giới thiệu

  UX-103           UI ở các viewport quy định và phụ đề 200% không bị
                   cắt, chồng prompt hoặc che vùng ngắm trọng yếu

  UX-104           Dùng bàn phím vào/ra mọi màn, focus không mất; đổi
                   phím không để lại prompt cũ; lỗi save có giải thích

  UX-105           Chuyển tab, Esc, mất pointer lock: game và phim dừng;
                   quay lại không tự phát súng hoặc tự chạy

  UX-106           Phụ đề và caption quan trọng được kiểm bằng cách tắt
                   âm hoàn toàn; trạng thái máu đọc được khi tắt hậu kỳ

  UX-107           Người chơi phân biệt được đầu hàng trước khi bị áp
                   dụng luật thất bại; xử lý chi tiết tại §20.3
  -----------------------------------------------------------------------

# 21. ĐIỆN ẢNH TRƯỚC KHI VÀO GAME

## 21.1 Cấu trúc và ngôn ngữ điện ảnh

Phương án chọn: **video dựng trước cho mở đầu/briefing; cảnh trong
engine cho bước chuyển và những đoạn người chơi có thể nhìn quanh.**
Video giúp kiểm soát dựng phim, ánh sáng, biểu cảm và chi phí mỗi frame
khi phát. Cảnh trong engine dùng đúng asset, thời tiết, màu và vị trí
camera của gameplay để giảm chênh lệch chất lượng. Không đặt độ chân
thực của phim vượt quá khả năng gameplay rồi bán kỳ vọng sai.

Ngôn ngữ: bản đồ giấy, nét bút chì, mép thư, tiếng máy thu, cận vật dụng
và góc ngang tầm người. Chuyển cảnh bằng âm thanh đến sớm, hình ảnh nối
tương đồng và chuyển động tự nhiên; không dùng HUD tác chiến hiện đại.
Phần đồ họa bản đồ chỉ chỉ ra "đang ở đâu, đi đâu, vì sao", không diễn
giải toàn bộ lịch sử.

Mỗi phim trả lời ba câu: người chơi là ai trong cảnh này; cần làm gì
ngay sau phim; điều gì khiến việc đó quan trọng. Thoại mở đầu ưu tiên ít
câu, có khoảng thở. Nhạc gốc có một mô-típ ngắn biến đổi qua các hồi;
không mô phỏng giai điệu/âm hiệu thương hiệu của Call of Duty.

## 21.2 Danh mục phim và quy tắc phát

  --------------------------------------------------------------------------
  ID          Thời lượng mục tiêu  Nội dung và cách dùng
  ----------- -------------------- -----------------------------------------
  CINE-00     90 giây              Mở đầu "Lá thư chưa gửi"; phát khi chọn
                                   Xem mở đầu ở chiến dịch mới; gồm định
                                   hướng M1 ở đoạn cuối

  CINE-M1     40 giây              Bản rút gọn riêng cho Chọn nhiệm vụ
                                   M1/Xem lại; không nối ngay sau CINE-00

  CINE-M2     45 giây              Điểm cao và bóng pháo sáng; hiểu đường
                                   tiếp cận, mục tiêu trước mắt; vào game từ
                                   mép hào

  CINE-M3     50 giây              Lá thư bọc chống ướt; bờ sông và mục tiêu
                                   vượt sang; nối bằng bàn tay giữ đồ ở bờ

  CINE-M4     45 giây              Một phố đang sống, tiếng xe/loa được
                                   duyệt; bàn tay trao vật dụng; trao điều
                                   khiển trước biến cố

  CINE-1973   180 giây             Đoạn chuyển đã có ở v0.1; giữ là cảnh
                                   trong engine, chia ba nhịp 60 giây; phải
                                   xác nhận nhân vật và nguồn trước khóa
                                   dựng

  CINE-M5     40 giây              Bản đồ, bụi đỏ và tiếng máy; lời giao
                                   nhiệm vụ ngắn; nối vào đội hình đang chờ

  CINE-M6     40 giây              Bánh xe, đèo và đường chân trời mở; mục
                                   tiêu di chuyển; không spoil tình huống
                                   cứu người

  CINE-M7     45 giây              Hàng cây thẳng và một dấu bút bị sửa; mục
                                   tiêu ban đầu; không tiết lộ cái chết hoặc
                                   trận thua có script

  CINE-M8     45 giây              Ngày/địa điểm đã duyệt, phố bắt đầu hiện
                                   ra; nhiệm vụ giữ đội hình; không chiếu
                                   trước cảnh kết ở Dinh
  --------------------------------------------------------------------------

Các phim M2--M8 dùng cấu trúc chung: khoảng 1/4 thời gian cho vị trí,
1/2 cho con người và nguy cơ, 1/4 cho mục tiêu/hình ảnh nối cảnh. Mỗi
phim có shot list riêng trước khi sản xuất; bảng này là treatment, không
phải bảy kịch bản quay đã hoàn tất.

Lần đầu: menu → chọn Xem mở đầu → CINE-00 → chuẩn bị nếu cần → Nhận điều
khiển → handoff M1 → gameplay. Chọn Vào nhiệm vụ đi thẳng tới màn chuẩn
bị. Tiếp tục save đi thẳng tới checkpoint. Chơi lại nhiệm vụ có tùy chọn
xem briefing. Mọi phim được xem lại trong Nhật ký; replay không thay
tiến độ chiến dịch.

Mục tiêu "30 giây vào vai" đo từ lúc chọn Vào nhiệm vụ đến quyền điều
khiển trên cấu hình/tình trạng cache đã công bố. Đường xem CINE-00 là
khoảng 102 giây phim + handoff, cộng tải nếu có; không thể đồng thời hứa
30 giây điều khiển với intro bắt buộc 90 giây.

## 21.3 Kịch bản quay CINE-00 --- "Lá thư chưa gửi", 90 giây

Lời kể đề xuất của Thành, nhân vật hư cấu được nhắc trong PRD. Không gán
tuổi, đơn vị hoặc quan hệ với Thu/Hải/Quyết khi chưa có kịch bản nguồn.
Lời của "Đồng đội" để casting sau. Chữ ngày tháng, địa danh, đạo cụ và
quân phục phải đối chiếu registry trước bản phát hành.

  ------------------------------------------------------------------------
  Shot /       Hình ảnh và camera            Thoại, âm thanh và điểm dựng
  timecode                                   
  ------------ ----------------------------- -----------------------------
  S01 · 00--08 Tối chuyển dần thành cận vải  Tiếng thở, vải, một giọt
               ba lô ẩm; khung tĩnh, một bàn nước. Chưa nhạc, chưa nổ
               tay đi vào                    

  S02 · 08--20 Góc qua vai trên lá thư; chỉ  Thành: "Có những điều, lúc
               đọc được một dòng đã duyệt;   lên đường tôi chưa biết viết
               nét bút ngừng                 thế nào." Ngừng 2 giây

  S03 · 20--32 Thư được gấp, bọc và cất; cắt Thành: "Tôi nghĩ, đi hết con
               theo chuyển động sang khóa    dốc này rồi sẽ viết tiếp."
               túi                           Một mô-típ nhạc rất mỏng bắt
                                             đầu

  S04 · 32--45 Cận chân qua đất ướt, chuyển  Tiếng chân/vải, suối xa. Tên
               sang trung cảnh sau lưng; máy game chưa xuất hiện; tránh
               di chuyển ổn định             nêu mẫu súng chưa duyệt

  S05 · 45--58 Hai bóng người qua khoảng     Tiếng động cơ đi vào trước
               sáng; camera ở tầm vai, không hình. Nhạc giảm để người xem
               flycam toàn chiến trường      nhận ra âm thanh

  S06 · 58--70 Đồng đội giơ tay ra hiệu      Đồng đội: "Dừng một chút.
               dừng; cận tay và mắt nhìn     Nghe đã." Khoảng lặng; không
               lên, không cắt tới máy bay    diễn giải chiến thuật ngoài
                                             nhu cầu kể chuyện

  S07 · 70--82 Máy nhìn theo dòng nước tới   Thành: "Rồi tôi nhận ra, mình
               lối xuống; người trước quay   không đi một mình." Tiếng
               lại chờ                       suối nối sang cảnh M1

  S08 · 82--90 Tên ĐƯỜNG VỀ SÀI GÒN trên nền Chữ "Cổng Trời · Trường Sơn ·
               tối tự nhiên; chuyển về bàn   1971" chỉ dùng khi duyệt;
               tay nắm dây túi, trùng pose   Đồng đội: "Theo tôi xuống
               đầu handoff                   ngầm." Objective lặp trong
                                             HUD sau khi vào chơi
  ------------------------------------------------------------------------

Nguyên tắc diễn: đọc như nhớ lại một việc cụ thể, tránh giọng diễn văn.
Không dùng hình tư liệu chiến tranh như texture trang trí. Không đặt
người thật hoặc lời đài nguyên bản vào phim này; nếu thêm về sau phải có
nguồn và quyền sử dụng tương ứng.

## 21.4 CINE-M1 --- briefing độc lập, 40 giây

  ------------------------------------------------------------------------
  Timecode     Hình và lời đề xuất           Chức năng
  ------------ ----------------------------- -----------------------------
  00--10       Nét bút trên bản đồ minh họa  Người chơi hiểu không gian;
               tuyến ngầm, chữ Trường Sơn /  không hiện tọa độ chính xác
               1971 đã duyệt                 giả

  10--20       Một đường cong theo suối nối  Xác lập chất liệu M1, không
               sang hình nước; tiếng vải và  thêm battle montage
               bước chân                     

  20--30       Đồng đội chờ bên dốc: "Qua    Đặt mục tiêu tức thời; tên
               ngầm rồi nghỉ. Đi sát nhau."  người nói chốt theo kịch bản

  30--40       Camera xuống tầm mắt Thành;   Khớp hình với handoff; không
               bàn tay giữ dây túi, nước ở   cài thêm tình tiết mà người
               hướng đi                      skip sẽ không biết
  ------------------------------------------------------------------------

## 21.5 Handoff 12 giây và cảnh tương tác

0--4 giây: đúng pose cuối phim, cùng lens/phơi sáng; vải và tiếng suối
nối qua cắt. 4--8 giây: đồng đội bước vào tuyến; người chơi có thể nhìn
quanh nhẹ nếu pointer lock đã cấp. 8--12 giây: tay về pose di chuyển,
objective hiện, mở locomotion; không xoay camera cưỡng bức về hướng đồng
đội.

Nếu dữ liệu chưa sẵn sàng, giữ poster cuối với trạng thái chuẩn bị;
không chạy camera vào một map chưa có collider. Nút "Nhận điều khiển"
được dùng khi cần xin khóa chuột; không giả định sự kiện video kết thúc
đủ quyền gọi Pointer Lock. Có đường bỏ handoff khi chơi lại hoặc bật
giảm chuyển động. Handoff không chứa thông tin cốt truyện duy nhất.
\[R02\]

In-engine sau giao chiến ưu tiên "được nhìn, được đi chậm" với staging
có thể bỏ lỡ phần hình nhưng không mất objective. Tránh lấy camera khỏi
người chơi mỗi khi có một vụ nổ. Chỉ khóa chuyển động khi animation
tương tác cần đồng bộ, và phải có thoát/cancel hợp lệ.

# 22. TRIỂN KHAI ĐIỆN ẢNH, HIỆU NĂNG VÀ DỮ LIỆU

## 22.1 Phương án sản xuất khả thi

G1 làm animatic CINE-00 bằng hình khối, keyframe và tiếng tạm, sau đó
hoàn thiện 20--30 giây đại diện trước khi render cả phim. Ưu tiên reuse
asset M1 đã duyệt; dựng ngoại tuyến trong Blender hoặc công cụ tương
đương, lưu camera, project, texture, audio stem và nguồn. Khả năng/time
render phải đo trên một shot của máy thật; không có ước lượng FPS render
ngoại tuyến trong PRD này.

Bản phân phối thử: MP4 H.264, 1920 × 1080, 24 FPS, SDR; không yêu cầu
4K/HDR để xem trên màn Retina. Preset encode thử 6--10 Mb/s video, kiểm
banding rừng, nước và bóng tối rồi quyết bitrate. Dùng HTML video phủ UI
cho phim toàn màn hình; không mặc định đưa video vào texture 3D hoặc
chạy hậu kỳ full scene phía sau. MediaCapabilities.decodingInfo() và
canPlayType() hỗ trợ chọn bản phát, nhưng phải thử decode thực trên
Chrome/Safari mục tiêu. \[R03\]

Phụ đề là track WebVTT tách, không nướng vào hình. Để slider
thoại/nhạc/hiệu ứng độc lập trong phim, dùng video không tiếng cùng ba
track thoại, nhạc và SFX đồng bộ theo media time; pause/seek/resume phải
giữ sync. Nếu chưa đạt đồng bộ, dùng một audio mix và ghi rõ chỉ có âm
lượng phim ở prototype, không đánh dấu AUD-001 hoàn thành. Không ép Web
Audio cập nhật theo frame của game đã pause.

## 22.2 Hợp đồng trạng thái

game/narrative quyết định phim nào và checkpoint nào; engine/cinematics
chịu media, camera track, timeline và giải phóng; UI chịu
controls/subtitles; content/cinematics/\*.json là dữ liệu, không nhúng
logic TypeScript. Mission progression không phụ thuộc vào việc video đã
chạy hết.

Luồng trạng thái: MENU → PREPARE → VIDEO hoặc READY → HANDOFF → PLAYING.
PAUSED giữ trạng thái trước đó. ERROR có Thử lại / Bỏ phim nếu gameplay
sẵn sàng / Về menu. Skip chỉ bỏ phần trình bày, vẫn phải chờ READY.
READY yêu cầu asset thiết yếu, collider, navmesh/tuyến cần thiết, điểm
spawn đứng được, camera và vật liệu đã chuẩn bị.

Manifest tối thiểu: id, revision, missionId, durationMs, sources (URL
nội bộ, codec, resolution, bitrate), poster, subtitleTracks,
voiceTracks, audioBed, reducedMotionSource, skipPolicy, nextNode,
assetManifestIds, historyFactIds. Phân biệt nguồn file media với nguồn
chứng minh lịch sử; không dùng một trường URL cho cả hai.

Save có schemaVersion, missionId, checkpointId, narrativeFlags,
cinematicsSeen theo id/revision và trạng thái completed/skipped. Một
eventId chuyển mission chỉ commit một lần kể cả ended, skip và load hoàn
tất đến gần nhau. Khi đóng tab giữa phim, lần quay lại có Xem lại / Vào
nhiệm vụ; không buộc xem lại. Không tạo checkpoint chỉ chứa camera phim
mà thiếu trạng thái nhân vật.

Khi vào gameplay: hủy input cũ, đợi thả nút bấm dùng để skip/nhận điều
khiển, rồi mới bật bắn/di chuyển. Khi ẩn tab: pause media và sim, dừng
audio; trở lại chờ Tiếp tục. Khi play() bị chặn, hiện Phát phim, không
tự lặp yêu cầu. \[R01\] Khi pointer lock thất bại, giữ màn Nhận điều
khiển và thông báo ngắn; nghe pointerlockchange/pointerlockerror, không
chỉ dựa Promise. \[R02\]

## 22.3 Ngân sách và hiệu ứng ưu tiên

Thông số dưới đây là mục tiêu cần đo, không phải benchmark đã đạt. Giữ
cap gameplay 60 FPS và render nội bộ tối đa 1920 × 1200 làm đường chuẩn;
UI độc lập. Mốc 16,67 ms là thời gian một frame 60 Hz. p95 18,5 ms trong
v0.1 là dung sai cũ, không đồng nghĩa 60 FPS ổn định; dùng p95 ≤ 16,67
ms làm mục tiêu G1, báo trung thực cả vùng tải/stream và 1% low. 1% low
tính từ trung bình 1% frame chậm nhất, không lẫn với percentile FPS.

  -----------------------------------------------------------------------
  Thành phần       Quyết định và số cần ghi
  ---------------- ------------------------------------------------------
  Gameplay         Giữ ngân sách GPU ≤ 12 ms, CPU sim+AI ≤ 5 ms làm cảnh
                   báo riêng; không cộng chúng như công thức frame vì có
                   phần chồng và còn CPU render/driver

  Benchmark        90 giây × 3 có warmup cố định; cùng route/seed/preset;
                   báo cả ba run, không chỉ median. Thêm soak 20 phút và
                   đường chuyển ô

  GPU memory       Trình duyệt không đảm bảo số VRAM chính xác, M1 dùng
                   bộ nhớ hợp nhất; budget 3,5 GB là ước tính từ resource
                   tracker, kèm process memory và điều kiện máy

  CPU bottleneck   Đo main thread, animation, culling, DOM, vật lý; tăng
                   GPU load không chữa CPU nghẽn

  Phim 90 giây     6--10 Mb/s tương đương khoảng 67,5--112,5 MB video
                   theo MB thập phân; cộng audio/subtitle/container.
                   Không coi kích thước nén là RAM khi giải mã

  Cả bộ video      CINE-00 + tám briefing = 440 giây, khoảng 330--550 MB
                   video cùng bitrate; đoạn 1973 là in-engine nên không
                   cộng vào lượng encode này

  Mạng             100 MB ở 50 Mb/s cần tối thiểu khoảng 16 giây truyền
                   lý tưởng; payload 250 MB cần khoảng 40 giây. Target
                   tải 15 giây phải ghi rõ warm cache hoặc mạng/cỡ cell
                   tương ứng

  Nạp chồng phim   Ưu tiên video và cell đầu; dừng render nền; giới hạn
                   decode texture/warmup theo đo đạc. Không giả định vừa
                   xem video vừa dựng toàn map là miễn phí
  -----------------------------------------------------------------------

FX Tier A bắt buộc: PBR/roughness, ánh sáng định hướng, bóng chọn lọc,
fog rẻ, AA đã kiểm, impact và âm đúng ngữ cảnh. Tier B có điều kiện:
GTAO, bloom nhẹ, grading và volumetric ở vài shot. Tier C sau G1: SSR
diện rộng, planar reflection, compute culling tùy biến, nhiều đèn đổ
bóng. Tắt Tier C không được làm mất mục tiêu hoặc thay độ khó. Planar
reflection là render bổ sung, không phải fallback rẻ mặc định cho SSR.

Three.js xác nhận TSL/node materials và post stack riêng của
WebGPURenderer; renderer vẫn có cảnh báo experimental trong tài liệu
hiện tại. Khả năng fallback WebGL2 không chứng minh mọi tổ hợp hiệu ứng,
compute và asset của dự án đều tương đương. Pin phiên bản dự án, test
material mẫu trên cả backend và ghi ADR khi nâng; không hứa có lợi hiệu
năng chỉ vì dùng WebGPU. \[R06\]

## 22.4 Nghiệm thu phim và chuyển cảnh

  -----------------------------------------------------------------------
  ID               Tình huống và điều kiện đạt
  ---------------- ------------------------------------------------------
  CIN-201          Xem hết, skip ở đầu/giữa/cuối, spam skip cùng lúc
                   ended: cùng mission state, không duplicate spawn hoặc
                   save

  CIN-202          Video chậm, thiếu file, codec lỗi, autoplay bị chặn:
                   có lựa chọn hữu ích; không màn đen vô hạn

  CIN-203          Skip khi chưa tải xong: chờ READY; nhân vật không rơi
                   xuyên mặt đất hoặc điều khiển camera chưa gắn actor

  CIN-204          Esc/chuyển tab/resume trong phim, handoff, gameplay:
                   âm, camera và sim đồng bộ; không tự bắn

  CIN-205          Phụ đề hai cỡ, tắt âm, giảm chuyển động, 16:10/16:9:
                   nội dung không mất; không stretch/crop hình quan trọng

  CIN-206          Đồng bộ thoại--hình mục tiêu sai lệch ≤ 80 ms trong
                   run thử sau pause/seek; lệch quá ngưỡng là lỗi, không
                   bù bằng subtitle sớm

  CIN-207          Phim 1080p24 phát ba lượt, mỗi lượt dropped frame \<
                   1% sau startup; ghi trình duyệt, codec và hoạt động
                   tải nền

  CIN-208          Replay phim và Chọn nhiệm vụ không sửa tiến độ; reload
                   giữa phim có đường tiếp tục; migration save được kiểm

  CIN-209          Chuyển vào game không flash trắng, nhảy FOV/grade/pose
                   rõ; input có hiệu lực sau nhận điều khiển; lỗi được
                   ghi clip trên máy thật
  -----------------------------------------------------------------------

Không dùng headless Playwright làm bằng chứng chất lượng GPU/camera/âm
thanh trên M1 Max. CI kiểm logic và luồng; người thật kiểm cảm giác, phụ
đề và điện ảnh trong trình duyệt đích.

# 23. KẾ HOẠCH THI CÔNG VÀ CỔNG DUYỆT BỔ SUNG

## 23.1 Thay đổi phân kỳ

G0\' vẫn ưu tiên terrain/collider/rừng và registry. Thêm skeleton
UI/menu/save flow, không làm phim cuối. G1 chia ba bước theo dependency:
blockout và điều khiển; mẫu tay/súng/đồng đội và một encounter; animatic
cùng handoff, sau đó playtest kết hợp. Chỉ khi mẫu 20--30 giây điện ảnh
đạt mới render 90 giây cuối. G2--G4 nhân rộng theo nhiệm vụ; thu thoại
cuối khi nội dung đã khóa. G5 hoàn thiện tiếp cận và localization đã tồn
tại từ G1, không bắt đầu chúng từ số không.

Ước lượng gốc 12--14 tháng là giả định của v0.1, không được xác nhận lại
bởi bản bổ sung. Sau G1 phải dự toán riêng số shot, ngày animation,
chỉnh âm, giọng diễn viên, kiểm sử và sửa sau playtest. AI giúp viết
công cụ, mã, validator, dựng blockout và biến thể; chất lượng diễn xuất,
thẩm mỹ, nguồn sử và quyết định cắt cảnh vẫn cần con người duyệt.

## 23.2 Backlog đủ nhỏ để giao Codex/Claude Code

  -----------------------------------------------------------------------
  Gói           Đầu ra cụ thể                Phụ thuộc / evidence
  ------------- ---------------------------- ----------------------------
  TIP-UX01      UI shell, menu, settings,    Không cần art cuối; clip
                i18n, focus, save error      keyboard flow và các
                states                       viewport

  TIP-GF01      Một súng FP: rig, ADS,       Asset đã duyệt; clip
                recoil, reload, impact,      bắn/thay băng và test ammo
                audio                        state

  TIP-M101      Tuyến 15 phút blockout, ba   Controller/collider; full
                checkpoint, encounter 4--6   run không debug, reset
                địch                         invariant

  TIP-ART01     Một ô rừng, một đồng đội     Registry; ảnh có cùng ánh
                gần, bộ tay và palette M1    sáng/pose tham chiếu và
                                             bench

  TIP-CIN01     Media player + subtitle +    UX shell; test CIN-201--205
                skip/pause/error + input     trước phim đẹp
                handoff                      

  TIP-CIN02     Animatic 90 giây, briefing   Script và nguồn tạm có nhãn;
                M1 40 giây, handoff 12 giây  người duyệt chốt nhịp

  TIP-CIN03     20--30 giây hoàn thiện đại   ART01, CIN02; visual/sound
                diện, sau đó CINE-00 cuối    review, asset/license
                                             manifest

  TIP-QA01      Playtest G1, perf máy thật,  Tích hợp tất cả; raw
                danh sách sửa ưu tiên        observations, clip, không
                                             chỉ điểm trung bình
  -----------------------------------------------------------------------

Contract mỗi gói phải nêu phạm vi, ID yêu cầu, file được sửa, trạng thái
chưa biết, evidence và lệnh chạy. Không giao "làm giống Call of Duty"
như một tiêu chí nghiệm thu. Không để nhiều coding agent cùng sửa
controller/mission state hoặc tự đổi dependency trong cùng gate.

## 23.3 Gate trải nghiệm G1

Năm người chơi mới, có cả người quen và ít quen FPS, thử hai đường vào
game. Mẫu này chỉ là bằng chứng định tính ban đầu, không đủ kết luận cho
toàn thị trường. Ghi màn hình, câu hỏi sau chơi, chỗ lạc đường, chết và
bỏ phim; chỉ ghi telemetry khi được người thử đồng ý.

Pass đề xuất: ít nhất 4/5 hiểu mục tiêu hiện tại sau 60 giây điều khiển;
ít nhất 4/5 mô tả được một đồng đội hoặc một hành động đáng nhớ; không
ai bị kẹt vì menu/collider/checkpoint; mọi người tìm được cách skip và
chỉnh phụ đề. Chấm riêng cảm giác súng, dễ đọc, khó chịu camera và "tin
bối cảnh" trên thang 1--5, xem từng câu trả lời. Người kiểm sử đánh giá
niên đại; người chơi đánh giá cảm nhận, không thay vai nhau.

Phim đạt khi người xem hiểu mục tiêu và mối quan hệ sau khi xem, còn
người skip vẫn hiểu nhiệm vụ qua gameplay. Không dùng tỷ lệ xem hết phim
làm mục tiêu buộc giữ người chơi. Nếu điện ảnh tốt nhưng gameplay nhạt,
ưu tiên sửa 15 phút chơi; nếu GPU vượt budget, giảm FX có điều kiện
trước khi giảm độ rõ mục tiêu.

## 23.4 Những đầu vào còn thiếu trước sản xuất cuối

Kịch bản nhân vật v0.1 và hành trình liên tục của Thành; registry lịch
sử thực tế; repo và bench thô; số GPU core/phiên bản OS/browser của máy
chuẩn; ngân sách diễn viên/nhạc/animation; quyền dùng font/asset cụ thể.
Các phần này có thể điền trong lúc làm prototype, nhưng không được ghi
"đã duyệt" hoặc "đã đạt" khi chưa có evidence.

# 24. NGUỒN ĐỐI CHIẾU BỔ SUNG VÀ PHẠM VI BÀN GIAO

Đối chiếu ngày 05/09/2026. Các nguồn dưới đây hỗ trợ ràng buộc API và
tiếp cận; không chứng minh FPS của dự án hoặc các sự kiện lịch sử. Nội
dung art direction, shot list, thời lượng, token UI và budget mới là
quyết định đề xuất của bản v0.2.

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------
  ID        Nguồn trực tiếp                                                                                                 Áp dụng
  --------- --------------------------------------------------------------------------------------------------------------- -----------------------------------------
  R01       [[MDN --- Autoplay guide]{.underline}](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)      Xử lý play bị chặn; tương tác để kích
                                                                                                                            hoạt tiếng

  R02       [[MDN ---                                                                                                       User activation, sự kiện thành công/thất
            requestPointerLock]{.underline}](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestPointerLock)   bại, handoff

  R03       [[MDN --- Media Capabilities                                                                                    Kiểm codec, smoothness và power
            API]{.underline}](https://developer.mozilla.org/en-US/docs/Web/API/Media_Capabilities_API)                      efficiency theo thiết bị

  R04       [[Microsoft --- XAG                                                                                             Phụ đề, người nói, caption, nền và cấu
            104]{.underline}](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/104)       hình trước intro

  R05       [[Microsoft --- XAG                                                                                             Chuyển động UI/camera, FOV, tắt hiệu ứng
            117]{.underline}](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/117)       gây khó chịu

  R06       [[Three.js --- WebGPURenderer]{.underline}](https://threejs.org/manual/en/webgpurenderer)                       TSL, node post-processing, fallback và
                                                                                                                            trạng thái experimental
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------
