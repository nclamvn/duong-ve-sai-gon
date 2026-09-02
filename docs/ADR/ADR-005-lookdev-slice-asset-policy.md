# ADR-005: Look-dev slice trước G1 + chính sách asset (Mixamo + CC0)

**Status:** Accepted · 2026-09-02 · Quyết định Chủ nhà sau khi chơi G0 trên M1 Max

## Context
G0 GO với dư địa lớn (p95 9.1 ms / 16.7; GPU 2.5 ms). Chủ nhà chơi thử và đánh giá: chuyển động mượt, nhưng
"chi tiết, màu sắc, texture và độ chân thực của súng, làn đạn, tia lửa, kẻ địch, vật thể rất nghèo nàn — cảm giác game thập niên 90".
PRD đặt Visual target ở G4 (tuần 12–15) và cấm AI tự nhập asset (§9.2). G0 đến nay 100% procedural, không texture, không IBL, không post FX.

Chẩn đoán 5 nguyên nhân: (1) không texture/normal map — màu phẳng vertex; (2) không environment/IBL — PBR như nhựa, không phản chiếu;
(3) không post stack — không bloom/AO/grain, tone map thô; (4) hình khối primitive, animation code 12 bone; (5) mưa/tia lửa là quad phẳng.

## Decision
1. **Chèn "G0.5 · Look-dev slice" trước G1.** Mục tiêu: một góc arena đạt chuẩn hình ảnh "chân thực điện ảnh" (đêm mưa cảng Vạn Hải:
   bề mặt ướt phản chiếu đèn, đèn natri, sương, khói) để Chủ nhà thấy trần hình ảnh của pipeline trước khi đổ 8 tuần vào G1–G3.
   G1–G3 giữ nguyên phạm vi; G4 còn lại là mở rộng art ra toàn map.
2. **Chính sách asset (Chủ nhà xác minh license, Thợ ghi manifest):**
   - **Mixamo (Adobe)** cho nhân vật + animation mocap: Chủ nhà tải bằng tài khoản Adobe, bỏ vào `assets-src/mixamo/`. Điều khoản Adobe:
     dùng miễn phí trong dự án (kể cả thương mại), không phân phối lại asset rời. Thợ không tải; chỉ chuyển đổi + tối ưu.
   - **CC0** (Poly Haven, ambientCG, Kenney, Quaternius, Sketchfab filter CC0) cho texture PBR, HDRI, props, súng: Thợ được tải trực tiếp
     vì CC0 không cần xác minh thêm; mọi file ghi `content/assets/manifest.json` (id, nguồn, URL, license, kích thước, hash).
   - Không asset nào ngoài hai nhóm trên. Không asset từ game tham chiếu (PRD §9.2).
3. **Định dạng:** glTF/GLB (glTF-Transform: prune/dedup/meshopt/resize). Texture: JPG/PNG ≤ 2K ở slice này; **KTX2/Basis là nợ kỹ thuật**
   (cần `toktx`), phải trả trước G4 khi payload > 150 MB target (§4.1 `initial_payload_mb`).
4. **Post stack theo tier** (không hạ chất lượng toàn cục để qua budget — §9.2): low = FXAA + bloom; medium = + GTAO; high = + SSR + TRAA.
   Mọi TIP render bench A/B trên Mac (`bench:quick` trước/sau) và ghi vào completion report.

## Consequences
- (+) Rủi ro lớn nhất còn lại ("engine có làm ra hình đẹp không") được trả lời trong ~3 TIP thay vì ở tuần 12.
- (+) Pipeline asset (manifest, convert, license) dựng sớm → G4 chỉ là mở rộng.
- (−) Payload tăng (texture/mesh); phải theo dõi `initial_payload_mb`; KTX2 là nợ có hạn.
- (−) Nhân vật phụ thuộc Chủ nhà tải Mixamo → TIP-012 chờ input; TIP-011/013 không phụ thuộc.
- (−) Post FX ăn GPU: dự kiến +4–7 ms ở high trên M1 Max; vẫn trong budget nhưng dư địa hết "6 lần".
