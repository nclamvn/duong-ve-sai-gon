# Danh sách chọn asset cho hồi đêm "Ngầm Ta Lê" (M1, đêm)

> **Cập nhật 11/10/2026 (DV-077): anh Lâm đóng ngân sách asset, chỉ dùng đồ miễn phí.** Kết quả:
> - **Xe:** đã tải ZIL157 bort platforma (JLabus, CC-BY) → `veh_zil157.glb`, 47.499 tam giác, KTX2.
> - **Đại liên:** không mua Fab. Bản miễn phí không đạt → **tự dựng DShKM trên giá ba càng phòng không bằng code** (`scripts/models/build-dshk.py`, Blender) → `wpn_dshk.glb`, ~12k tam giác, có node xoay ngang/ngẩng và mốc đầu nòng, thước ngắm, tay cầm. Bản quyền của dự án (`DVSG-Own`).
> - **Thu:** dựng bằng MPFB/MakeHuman (CC0) → `chr_thu.glb`: nữ 19 tuổi cao 1,53 m, áo nhuộm xanh bạc, quần sẫm, tóc tết, chân trần, rig Mixamo (`scripts/characters/build-thu.py` + `finish-thu.mjs`). Nón lá NNgan (CC-BY) → `prop_nonla.glb`.
> - **Đạo cụ:** đèn dầu, phuy, can xăng Poly Haven (CC0), hòm quân dụng đã có sẵn.
> - Ảnh kiểm: `evidence/DV-077/assets-preview.png`.

*Mẻ cào lọc ngày 11/10/2026. Registry `dem_ngam`: 28 thực thể, 238 claim, 31 bản chụp nguồn, mọi cổng cắn (bites). Bản đầy đủ: `REGISTRY.txt`, claim trong `claims.jsonl`, bản chụp trong `snapshots/`. Loại mọi bản rip từ game (Enlisted, Metro 2033, War Thunder, WARNO), mọi bản không rõ tác giả gốc, mọi bản NC, mọi bản sinh bằng AI, mọi nhân vật gợi dục.*

## 1. Xe vận tải (đoàn 8 xe qua ngầm)

| | Asset | Nguồn, giá, license | Hình học | Kết luận |
|---|---|---|---|---|
| **X1** | **ZIL157 bort platforma**, JLabus | Sketchfab, 0 đ, CC-BY | 122.962 mặt, 12 texture, làm bằng Blender + Substance | **Chọn.** Đúng xe ZIL-157 thùng gỗ có khung mui bạt, xe chủ lực trên tuyến 1971. Giảm còn ~40k mặt, làm bản bạt phủ và bản không bạt, vẽ bẩn bùn đỏ |
| X2 | ZIL157, JLabus | Sketchfab, 0 đ, CC-BY | 276.922 mặt, 38 texture | Dự phòng (cùng tác giả, nặng gấp đôi) |
| X3 | ZIL 157 Military Truck, rylo | Sketchfab, 0 đ, CC-BY | 686.682 mặt | Dự phòng; quá nặng |
| X4 | ZiL-130, nghesiyeubuom97 | Sketchfab, 0 đ, CC-BY | 174.063 mặt | Dự phòng để đoàn xe có hai kiểu; ZiL-130 là xe đường bằng 4x2 |
| — | Zil 157 (dugito03), zil-130 (Ara_my45yt) | | | Loại: người đăng tự ghi "đã sửa mô hình" / trùng đúng số mặt với bản khác (đăng lại) |

Repo đang có Ural-4320 (đời 1977, sai thời kỳ): bỏ khỏi hồi đêm.

## 2. Đại liên 12,7 ly DShK (khẩu người chơi bắn máy bay)

Bản miễn phí trên Sketchfab đều không đạt (làm bằng Blockbench, nòng đôi tưởng tượng, hoặc rip từ game). Hai bản mua trên Fab, cùng giấy phép Fab Standard (phải đóng gói `.dvpak` như cây Fab, DV-062), cùng ghi "không dùng AI, không sinh bằng AI":

| | Asset | Giá Fab | Hình học | Dáng | Kết luận |
|---|---|---|---|---|---|
| **S1** | **DShK Heavy Machine Gun Low-poly PBR**, Max3d | **824.806 đ** | 25.919 tam giác, PBR 4K một bộ, bộ phận tách rời để làm chuyển động | **Chân ba càng phòng không cao**: đúng thế bắn máy bay ở ngầm | **Chọn.** Nhẹ, sẵn sàng cho game, xoay ngang/ngẩng được |
| S2 | Heavy Machine Gun Dshk 1938, Frigus | 1.023.966 đ đến 1.422.286 đ | 139k tam giác, 3 bộ 4K, có GLB | Giá bánh xe Kolesnikov có khiên (bộ sưu tập có thêm bản ba càng) | Dự phòng; đẹp hơn nhưng nặng gấp 5, giá bánh xe hợp bắn mặt đất hơn |

## 3. Thu (nữ thanh niên xung phong)

Không có nhân vật nữ miễn phí nào đạt: bản đẹp thì dựng từ DAZ3D/Character Creator (giấy phép dùng trong game riêng), gợi dục, hoặc anime/chibi; bản Fab đúng thời kỳ (Vietnam Meta Soldier) chỉ có lính nam và chỉ chạy Unreal.

**Đề xuất: tự dựng Thu bằng MPFB/MakeHuman.** Lưới người, target khuôn mặt và da đều là **CC0** (dùng được cho game đóng mã, có bản chụp FAQ). Em chạy Blender ngay trong sandbox: dựng cô gái 19 tuổi dáng người Việt, áo sơ mi dài tay xanh bạc và quần (quần áo hệ thống CC0 của MakeHuman, nhuộm lại), tóc buộc, đội **nón lá** của NNgan (Sketchfab, CC-BY, 1.512 mặt, tác giả người Việt; không dùng mũ tai bèo). Gắn rig tương thích Mixamo để dùng chung hoạt ảnh đang có (đứng, đi, vẫy đèn chỉ đường). Chất lượng mặt không bằng MetaHuman, nhưng Thu xuất hiện về đêm, dưới ánh đèn dầu, ở cự ly trung bình.

Dự phòng nếu anh muốn đẹp hơn: thuê/mua nhân vật nữ riêng (để khi làm phần Thu ở gần, cảnh bếp Hoàng Cầm M2).

## 4. Đạo cụ đêm (Poly Haven, CC0, tải thẳng không cần đăng nhập)

Đèn dầu `vintage_oil_lamp` (7.208 poly), phuy `barrel_03` (1.473), can xăng xanh `metal_jerrycan_green` (9.636), hòm gỗ quân dụng `wooden_military_crate` (22.986). Dự phòng: `wooden_lantern_01`, `old_military_crate`.

AC-130 đã có trong repo (CC-BY, helijah).

## 5. Việc cần anh Lâm

1. **Mua trên Fab** khẩu **S1 DShK (Max3d, 824.806 đ)** bằng tài khoản của anh (em không thanh toán thay).
2. Báo em để em **tải qua Chrome** của anh (anh đã đăng nhập): S1 trên Fab và **X1 ZIL157 bort platforma** trên Sketchfab (miễn phí, cần đăng nhập để tải).
3. Em tự tải đạo cụ Poly Haven, nón lá NNgan (cần đăng nhập Sketchfab, tải cùng lúc với X1) và bộ MakeHuman CC0 để dựng Thu.
