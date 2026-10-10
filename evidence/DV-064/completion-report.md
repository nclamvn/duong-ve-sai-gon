# Completion Report: DV-064 (tích hợp cây mua trên Fab)

evidence_status: sandbox_swiftshader_lifecycle_only

STATUS: DONE (5/6 listing). Long Liana Stem chưa có: bậc miễn phí chỉ là UEFN tham chiếu, bậc Personal 84.683 đ chưa mua.

TẢI (Chrome của Chủ nhà, đã đăng nhập Fab; chỉ bấm Download, không nhập mật khẩu, không mua thêm)
- Shorea roxburghii: bản FBX 285 MB (GLB chuyển đổi sẵn của Fab chỉ còn ảnh lá 64 px, bỏ). Dùng 4 cây LowPoly 9,6 đến 13,6 m.
- Dipterocarpus turbinatus Trunk 01: FBX 8K (703 MB; giải nén trên Mac, chỉ chuyển LOD0 + ảnh màu lên sandbox).
- Ficus Microcarpa Tree Trunk, Large Fallen Tree: GLB "high" 4K.
- Chinese Fan Palm: FBX "high", 7 biến thể × 4 LOD.
- Gói gốc đã chép vào `assets-src/fab/cay-nhiet-doi/` trên Mac (không commit).

PIPELINE
- `scripts/prep-atlas-tree.mjs` (mới): gộp 5 material lá thành atlas 1020×512 + một vỏ (UV lặp giữ nguyên), bỏ hoa, gộp đỉnh để mỗi lá là một thành phần liên thông → mỗi cây đúng 2 primitive.
- `scripts/prep-plant-tex.mjs` (mới): ảnh rời cạnh FBX, ghép opacity vào alpha, lấp màu vùng trong suốt (chống viền đen ở mip xa), `--gain` nâng độ sáng albedo scan.
- `convert-vegetation.mjs`: nhánh `fab` (source fab, Fab-Standard, protect). Sau đó KTX2 và `pack-assets.mjs` → 5 gói `.dvpak` mới.

LEVEL
- Shorea thay Tree GN cho vượt tán (20–29 m) và tán chính (11–15 m), cùng batch.
- Thân đổ 7 m Megascans thay thân đổ cũ (ph_log, crater_logs).
- Gốc dầu rái gãy (ph_stump, va chạm 0,85 m) và gốc si rễ bạnh (ph_stump2, 0,65 m); tránh đường mòn 4 m, boost cách đường ≥ 6 m.
- Luật dương xỉ cũ dùng chung GLB ph_fern.
- Cọ quạt: đã đổi, đóng gói, nhưng TẠM GỠ khỏi level (xem ISSUES).

TEST RESULTS
- typecheck 0 lỗi; unit 195/195; validate-assets 0 lỗi; pack-assets --check OK
- E2E rừng: draw ≤ 140, tam giác ≤ 1,5 triệu (lần đầu 1,76 triệu → LOD Shorea lá 0,32/0,12/0,05, LOD0 tán chính 18 m, nhẹ hoá vài lớp nền); đồng đội theo đạt sau khi thu nhỏ va chạm gốc cây
- E2E toàn bộ: 17 passed, 1 skipped (chuỗi đầy đủ 16/17, test bầu trời trượt vì đồng hồ trời chạy trong lúc nạp rừng lâu hơn → test tiến tới mốc tuyệt đối t = 60 s thay vì cộng 60 s; chạy lại cả 4 test Trường Sơn: 4/4 đạt)
- Ảnh `truoc-sau.jpg`: trái DV-063 (cây Tree GN), phải DV-064 (Shorea), cùng 4 góc, quality low

ISSUES
- (trung bình) Cọ quạt Megascans dưới tán hiện đen kịt ở WebGL sandbox; đã loại trừ normal, bóng, độ sáng texture, viền alpha. Cần xem trên Mac WebGPU trước khi bật lại.
- (trung bình) Tán ở quality low trông thưa hơn rừng già thật (lá tỉa ở LOD1/LOD2). Trên Mac high LOD0 xa hơn nên dày hơn; nếu vẫn thưa → mua cây si/đa (#3 danh sách) cho tầng tán giữa.
- (thấp) Vỏ Shorea sáng hơi hồng (đúng màu "white meranti"), có thể tint tối hơn nếu Chủ nhà thấy lạc tông.
- (thấp) Ghi chú bản quyền anydrafts cấm đăng lại nội dung; dùng trong game theo Fab Standard, chỉ phát dạng gói mã hoá.

DEVIATIONS
- Dùng bản FBX thay GLB của Fab cho Shorea (GLB chuyển đổi tự động mất texture).

SUGGESTIONS
- Chủ nhà mua thêm Chinese Banyan #01/#02 và Caryota (đùng đình) để tầng tán giữa và tầng dưới đúng rừng Trường Sơn hơn; Long Liana Stem (84.683 đ) cho dây leo.
