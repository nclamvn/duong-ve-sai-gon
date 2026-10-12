# DV-082 Completion Report: đồ hoạ điện ảnh rừng, lượt 4 (bùn, nước suối, chim và bướm)

STATUS: DONE (hình thật và khung hình chờ Chủ nhà duyệt trên Mac)

## FILES CHANGED

Tạo mới:
- `src/engine/render/wildlife.ts`: chim nhỏ theo đàn, chim lớn, bướm (một Mesh instanced mỗi loại, sinh từ hash(instanceIndex), vỗ/gập cánh trong shader, cánh bướm vẽ bằng shader).
- `tests/unit/aaa-pass4.test.ts` (3 test).

Sửa:
- `src/engine/render/envShade.ts`: bùn đất đỏ bám ủng, ống quần (chỉ thân có xương).
- `src/engine/terrain/water.ts`: vệt bọt dọc dòng, bọt trôi xuôi sau ghềnh, đường bọt sát bờ, lòng sâu sẫm/mép trong, Fresnel, che phản chiếu trời dưới tán, váng hố bom, đĩa hố 32 cạnh, thuộc tính `across`.
- `src/game/game.ts`: chim và bướm theo tier (`?wildlife=0`), cập nhật theo đất dưới camera.
- `src/engine/render/dustMotes.ts`, `src/engine/terrain/material.ts`: viết lại `smoothstep` cạnh đảo.
- `tests/e2e/shots-rung.spec.ts`: góc 7 (ghềnh suối), góc 8 (cận chân đồng đội).
- `docs/DECISIONS.md`: DV-082.

## TEST RESULTS

- `npx tsc --noEmit`: 0 lỗi.
- `npx vitest run`: 286/286 (mới 3: bùn chỉ cho thân có xương, chim/bướm instanced đúng số con, nước suối có thuộc tính ngang dòng và bọt trôi xuôi).
- E2E toàn bộ (webgl-ci): 23/23 (22,7 phút). Lần chạy đầu test arena (`boot`, `bench`) quá 90 s vì shader bùn chạy cả ở arena; sửa: không áp gì ở cảnh không có tán, gộp nhiễu bùn còn 2 lần đọc; chạy lại 23/23.
- Ảnh kiểm (SwiftShader, High + post medium, 1280 px): `truoc-sau.jpg` (trái DV-081, phải DV-082, 5 góc cũ), `ghenh-suoi.jpg` (góc mới), `bun-ung-truoc-sau.jpg` (cận chân đồng đội, trái `?envshade=0`, phải bùn), `buom.jpg` (bướm phóng to). evidence_status: sandbox_swiftshader_lifecycle_only.

## ISSUES

- Trung bình: nước suối nhìn xiên trong ảnh sandbox hơi xám bạc vì soi trời sương sáng ở khe trống; dưới tán đã tối lại. Cần xem trên Mac với SSR (High, WebGPU) mới thấy phản chiếu thật của bờ và cây.
- Thấp: chim ở xa 60 đến 150 m chỉ vài điểm ảnh, nhìn rõ nhất khi ngước lên khoảng trống tán; chưa có tiếng vỗ cánh gắn theo từng đàn (cảnh âm DV-075 đã có tiếng chim nền).
- Thấp: bướm bay theo nhiễu, không né người chơi/vật cản; đi xuyên lá bụi.
- Thấp: hai `smoothstep` cạnh đảo cũ trong `terrain/material.ts` (grassW, mudW, từ trước DV-079) chưa sửa để không đổi hình nền đã duyệt.

## DEVIATIONS

- Đã thử nhánh động `If` trong shader để bỏ qua phần bùn/viền nắng: trên WebGL sandbox lính hiện đen kịt, nên bỏ nhánh, giữ bản tính thẳng (đã gộp nhiễu) và chặn ở cấp material (không áp ở cảnh không tán).

- Rà và sửa `smoothstep` cạnh đảo trong code của DV-080 đến DV-082 (luật TSL trong AGENTS.md), ngoài phạm vi 3 hạng mục; hình không đổi trên WebGL sandbox.

## SUGGESTIONS

- Xem trên Mac: `?quality=high` so với `&wildlife=0`, `&envshade=0`; `npm run bench`.
- Phần đồ hoạ rừng ban ngày đã đủ bộ lớn; đề xuất chuyển sang Cổng B (5 người chơi thử) rồi quay lại tinh chỉnh theo ý kiến.
