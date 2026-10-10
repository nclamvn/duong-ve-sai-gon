# Danh sách chọn asset lính hai phe hư cấu (DV-061)

*Mẻ cào lọc ngày 10/10/2026, ba mũi: miễn phí (A), mua giá thấp (B), hoạt ảnh và trang bị (C). Registry `linh_hu_cau`: 130 thực thể, 1.014 claim, 128 snapshot, 6/6 cổng cắn. Chi tiết từng món (giá, license, định dạng, rig, số tam giác, nguồn) nằm trong `REGISTRY-linh-refinery.md` và repo `docs/research/linh-hu-cau/`.*

## 0. Quy ước phe (anh Lâm chốt 10/10/2026)

- **Phe A (người chơi + đồng đội):** phe hư cấu, cầm AK. Dáng: mũ mềm hoặc mũ tai bèo, quần áo kaki xanh ô liu, bao xe đạn trước ngực, dép hoặc giày vải.
- **Phe B (đối phương):** phe hư cấu. Dáng khác hẳn phe A để nhận ra từ xa: mũ sắt, quần áo rằn ri, dây đeo trang bị, giày ủng.
- Không quân hiệu, cờ, phù hiệu của quân đội có thật. Mọi asset mang dấu hiệu thật phải vẽ lại trước khi vào game.

## 1. Phát hiện quan trọng nhất: license cho game chạy trên trình duyệt

Game của mình gửi file `.glb` qua HTTP. Người chơi rành kỹ thuật có thể mở DevTools và lưu file đó. Điều này chia các license làm ba nhóm:

| Nhóm | License | Kết luận |
|---|---|---|
| Sạch | CC0, CC-BY (ghi công), Mixamo | Dùng thẳng |
| Có điều kiện | Fab Standard, CGTrader Royalty Free, Unity Asset Store, Renderpeople | Cho phép dùng ngoài Unreal/Unity, **nhưng bắt buộc "ngăn người dùng cuối trích xuất" file gốc**. File `.glb` để trần là chưa đạt. |
| Loại | TurboSquid Standard (chỉ chấp nhận bản WebGL xuất từ Unity/Unreal/Lumberyard), Reallusion/ActorCore (nhúng vào ứng dụng cần bậc Enterprise), mọi license NC, mọi asset gắn cờ AI-generated, mọi asset ghi "ripped" | Không dùng |

**Đề xuất DV-062 (lớp bảo vệ asset):** đóng gói các asset mua vào gói riêng của game (`.dvpak`: mã hoá AES-GCM theo khối, khoá ghép lúc chạy, giải mã trong Web Worker rồi nạp thẳng vào bộ nhớ, không bao giờ để `.glb` trần trên mạng). Không chống được người quyết tâm, nhưng đây là "biện pháp hợp lý" mà các license trên đòi hỏi. Lớp này cũng cần cho **gói cây Fab anh sắp mua** và **tay AK của AB3DX đã mua (DV-055)**, vì cả hai cùng là Fab Standard. Với món mua riêng lẻ, nên gửi thêm một email ngắn hỏi người bán xác nhận cho dùng trong game web có mã hoá (em soạn sẵn được). Em không phải luật sư; đây là cách đọc điều khoản, không phải tư vấn pháp lý.

## 2. Phe A (người chơi + đồng đội, AK)

| # | Asset | Nguồn, giá, license | Hình học, rig | Đánh giá |
|---|---|---|---|---|
| A1 | **Vietnam Soldier (rigged)**, Pieter Ferreira | Sketchfab, 0 USD, CC-BY | 120.731 mặt, rig Mixamo, 1 texture 2048 | Ứng viên miễn phí tốt nhất có sẵn rig Mixamo (khớp ngay với hoạt ảnh hiện có). Phải xem ảnh để biết trang phục; giảm còn ~30k mặt; vẽ lại vải ô liu. Tác giả gắn nhãn "noai" (cấm dùng huấn luyện AI, không ảnh hưởng game). |
| A2 | **Modular Soldier Army**, 3DMAGIC24 | CGTrader, 14,99 USD, Royalty Free | 29.962 poly thân gốc, 60.298 đủ đồ; rig chuẩn + IK, "tương thích hoạt ảnh Mixamo"; có GLTF, FBX, BLEND | Rẻ, modular, có GLTF. Dáng hiện đại: tháo áo giáp, đội mũ tai bèo, vẽ lại vải ô liu. Cần lớp bảo vệ DV-062. Em đã tự mở trang kiểm lại giá và định dạng. |
| A3 | Soldier, China 1962, Andy Woodhead | Sketchfab, 0 USD, CC-BY | 317.688 mặt, tượng điêu khắc in 3D, không rig, tạo dáng sẵn | Dáng mũ mềm + AK gần phe A nhất, nhưng phải làm lại lưới và gắn rig (việc của hoạ sĩ, không phải việc chạy script). Giữ làm hình mẫu. |
| A0 | `soldier_mixamo` đang dùng (Swat Guy vẽ lại vải) | Mixamo | đang chạy trong game | Phương án dự phòng, không phải đích AAA. |

Phụ kiện phe A: **bao xe đạn AK "Chicom Type 56 Chest Rig Set"** (BOOTH, ¥500, license VN3 cho phép dùng trong game, ~10,6k tam giác); **mũ tai bèo** (CGTrader, 15 USD) hoặc **Pith Helmet** của justinanderson (Sketchfab, CC-BY, 5.328 mặt) cho dáng mũ cứng hư cấu.

## 3. Phe B (đối phương)

| # | Asset | Nguồn, giá, license | Hình học, rig | Đánh giá |
|---|---|---|---|---|
| B1 | **WW2 Panzergrenadier 2k**, britdawgmasterfunk | Sketchfab, 0 USD; tác giả ghi CC0, nhãn Sketchfab là CC-BY (cứ ghi công cho chắc) | **27.005 mặt**, PBR 2K, rig Mixamo gắn tay, thân dựa trên UE4 mannequin | **Sẵn sàng cho game nhất trong cả mẻ.** Mũ sắt, dây đeo, ủng đúng dáng phe B. Bắt buộc xoá phù hiệu, vẽ lại vải rằn ri, thay mũ. Em đã tự mở trang kiểm lại số mặt và license. |
| B2 | USA Vietnam Soldier, Sacha Gaffney | Sketchfab, 0 USD, CC-BY | 49.646 mặt, listing không ghi rig | Dáng thập niên 60 trong rừng; cần gắn rig. Vẽ lại để thành phe hư cấu. |
| B3 | Vietnam War American Soldier Rigged, andyhuang41 | CGTrader, 60 USD, Royalty Free | 108.042 tam giác, có rig, BLEND/FBX/OBJ | Đẹp và đúng dáng nhất trong nhóm mua, nhưng nặng và cần lớp bảo vệ. Chỉ mua nếu B1 không đạt khi anh chấm ảnh. |

Phụ kiện phe B: **M1 Helmet** của MelvinEbbuts (Sketchfab, CC-BY, 3.416 mặt) hoặc **"Spade" M1 Vietnam Helmet** của zuda (CC-BY, 3.196 mặt); vải rằn ri **ShareTextures Camouflage 24/30/38** (CC0, 4K).

## 4. Hoạt ảnh (dùng chung hai phe)

| # | Gói | Giá, license | Có gì | Vai |
|---|---|---|---|---|
| H1 | Mixamo | 0 USD, Mixamo | đi, chạy, bắn, chết; rig gốc của game | Nền, đang dùng |
| H2 | **Quaternius Universal Animation Library** | 0 USD (bản Standard 45 clip), CC0; GLB, FBX; "tương thích Mixamo" | locomotion nhiều hướng, chạy nước rút, bò, bơi, chết, động tác súng | Bổ sung miễn phí |
| H3 | **Kevin Iglesias Human Soldier Animations** | 30 USD (itch) hoặc 24,90 USD (Unity) | 538 file: ngắm, bắn, thay đạn, ném lựu đạn, 6 trúng đạn, 6 chết, đi khom, bò, chạy nước rút, đứng bị thương | Đáng tiền nhất. Trang không ghi loại xương: tải bản FREE (128 file, "tự chọn giá") kiểm trước khi mua |
| H4 | Kubold Rifle Crouch & Prone / Cover Rifle Animset Pro | 15 USD / 50 USD, Unity EULA | khom, nằm, nấp | Để sau, chỉ khi H1 đến H3 thiếu |

Chưa có nguồn: **lội nước, trèo qua vật thấp, các kiểu ló ra bắn từ chỗ nấp cao và thấp**. Đề xuất làm bằng code (IK chân + nghiêng thân + chậm bước khi lội) thay vì đi mua.

Loại: bộ dữ liệu Bandai Namco (CC BY-NC), Truebones (không ghi license, có hàng rip), các gói Fab hoạt ảnh súng (chỉ định dạng Unreal).

## 5. Đáng chú ý nhưng để sau

Fab có ba gói đúng thời kỳ, modular, chất lượng có vẻ cao nhất: **Vietnam Meta Soldier** và **US Meta Soldier Vietnam War** (wellweldedgames), **Vietnam Modular Soldier, Jungle Woodland Camo** (Woziva, 59 skeletal mesh, texture 4K). Cả ba **chỉ có định dạng Unreal**: phải cài Unreal Engine trên Mac để xuất FBX, giá trên trang không đọc được bằng công cụ. Nếu A1, A2, B1 không đạt sau khi anh chấm ảnh, đây là bước tiếp theo.

## 6. Hai lộ trình chi phí

| Lộ trình | Gồm | Tổng |
|---|---|---|
| **0 đồng (đề xuất làm trước)** | A1 + B1 + mũ M1 + Pith Helmet + vải rằn ri CC0 + Mixamo + Quaternius UAL + Kevin Iglesias FREE | 0 USD |
| Giá thấp | thêm A2 (14,99) + mũ tai bèo (15) + bao xe đạn (¥500) + Kevin Iglesias bản đầy đủ (30) | ~60 USD + ¥500, cộng 60 USD nếu cần B3 |

## 7. Việc anh Lâm làm (cần đăng nhập, em không đăng nhập thay)

1. Đăng nhập Sketchfab, tải định dạng **glTF** (hoặc "Original" nếu có FBX) các món: A1 Vietnam Soldier (rigged), B1 WW2 Panzergrenadier 2k, M1 Helmet (MelvinEbbuts), Pith Helmet (justinanderson), B2 USA Vietnam Soldier.
2. Trên itch.io tải hai gói miễn phí: Quaternius Universal Animation Library (Standard) và Kevin Iglesias Human Soldier Animations FREE.
3. Bỏ tất cả vào `~/Desktop/duong-ve-sai-gon/assets-src/characters/` (thư mục này không commit).

Sau đó em: chuyển đổi, giảm lưới, vẽ lại vải hai phe, gắn mũ và bao xe đạn, nối hoạt ảnh, đặt cả hai phe vào rừng và chụp ảnh để anh chấm. Món nào không đạt mới tính đến lộ trình mua.
