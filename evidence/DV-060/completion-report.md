# DV-060 · Completion Report: khe suối, hố bom, đá tảng, rừng ngổn ngang

STATUS: DONE (duyệt hình trên Mac)

evidence_status: sandbox_swiftshader_lifecycle_only

## Kết quả
- Địa hình: 38 khe (16 còn nước tháng 1, lưu vực lớn nhất 94 ha), 143 hố bom (53 đọng nước), DEM làm mượt nếp gấp lưới 30 m.
- Rừng: 29 luật, 125.846 cây/vật (E2E quality low); draw 125–136 (ngân sách 140), tam giác rừng 0,64–0,99 triệu (1,5 triệu), tổng ≤ 1,1 triệu (4 triệu).
- Ảnh: `khe-suoi-ho-bom-da-tang.jpg` (suối có nước, hố đọng nước, vệt hố B-52 nhìn từ trên, đá tảng, khe cạn, góc nhìn người chơi), `ban-do-khe-ho.jpg` (xanh đậm suối có nước, xanh nhạt khe cạn, đỏ hố khô, xanh dương hố đọng nước, xanh lá vùng bảo vệ).

## TEST RESULTS
- typecheck 0 lỗi; unit 28 file 185/185 (thêm `terrainFeatures.test.ts` 5 test); validate-assets 112 asset 0 lỗi.
- E2E webgl-ci boot + level-truong-son + mission: 12/12 pass.

## ISSUES
- Trung bình: cây tán vẫn là mô hình cành vặn; chỗ xa khe và hố, nhất là quanh spawn (vùng bảo vệ), nền vẫn thưa hơn bờ khe.
- Thấp: chưa có tiếng suối chảy trong cảnh âm.
- Thấp: đồng đội đi theo trong rừng dày từng lệch 13–18 m ở một lần chạy test trước khi bake nav 2 m và cho vật có collider tránh đường mòn; lần chạy cuối đạt.

## DEVIATIONS (L1)
- Ngưỡng test raycast/sample 0,15 → 0,2 m (lòng khe, hố trên lưới 2 m).
- Gỡ Monstera để giữ ngân sách draw ≤ 140 (không nâng ngân sách).
- Bỏ asset Poly Haven Boulder 01 (simplify meshopt không ra LOD1/2); đá tảng dùng đá rêu phóng lớn và Rock Face 01.
