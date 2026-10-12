# DV-081 Completion Report: đồ hoạ điện ảnh rừng, lượt 3 (sương sát đất, bụi trong cột nắng, nhân vật dưới ánh rừng)

STATUS: DONE (hình thật và khung hình chờ Chủ nhà duyệt trên Mac)

## FILES CHANGED

Tạo mới:
- `src/engine/terrain/heightField.ts`: trường cao độ half-float hai kênh (phần chẵn 64 m + phần dư), lọc tuyến tính, ≤ 512², cho pass hậu kỳ.
- `src/engine/render/dustMotes.ts`: bụi/phấn hoa lơ lửng (Sprite instanced, hạt sinh từ hash, hộp cuộn theo camera).
- `src/engine/render/envShade.ts`: material nhân vật dưới ánh rừng (che sáng tán, viền nắng ngược sáng, ướt theo trời).
- `tests/unit/aaa-pass3.test.ts` (3 test).

Sửa:
- `src/engine/render/volumetric.ts`: sương sát đất trong pass tia nắng (output rgb tán xạ + a truyền qua), mẫu dồn gần camera, tách hàm `canopySunLight` dùng chung.
- `src/engine/render/post.ts`: ghép cảnh × truyền qua + tán xạ; truyền trường cao độ và màu ánh trời.
- `src/engine/render/sceneLight.ts`: `WEATHER` (độ ướt, cờ cảnh rừng) dùng chung.
- `src/game/actors/visual.ts`: áp envShade cho lính + mũ + túi + súng.
- `src/game/game.ts`: trường cao độ, màu sương, gió cho sương và bụi, bụi theo tier, `WEATHER`, cờ `?mist=0`, `?dust=0|debug`, `?envshade=0`.
- `content/levels/truong-son-a.level.json` (`post.volumetric.mist`), `content/schemas/terrain-level.schema.json`.
- `tests/e2e/shots-rung.spec.ts`: góc 6 (đồng đội ngược nắng).
- `docs/DECISIONS.md`: DV-081.

## TEST RESULTS

- `npx tsc --noEmit`: 0 lỗi.
- `npx vitest run`: 283/283 (mới 3: trường cao độ khớp ô dưới 5 cm, material nhân vật áp một lần và đổi material cổ điển sang node dùng chung, cấu hình sương M1).
- E2E toàn bộ (webgl-ci): 22/23 (23 phút); test giọng (`voice.spec.ts`, cảnh `post=off veg=0`, không đụng phần đổi của lượt này) trễ giải mã 1 câu quá 400 ms do máy sandbox đang tải nặng, chạy lại riêng 1/1 qua (`late` 0).
- Ảnh kiểm (SwiftShader, High + post medium, 1280 px): `truoc-sau.jpg` (trái DV-080, phải DV-081, 5 góc) + `dong-doi-nguoc-nang.jpg` (góc mới, đồng đội ngược nắng), `bui-debug.jpg` (hạt bụi phóng to × 6, sáng × 20: chỉ hạt trong vệt nắng sáng). evidence_status: sandbox_swiftshader_lifecycle_only.

## ISSUES

- Trung bình: viền nắng trên lính khó thấy trong ảnh sandbox (chỉ hiện khi người đứng đúng vệt nắng và camera ngược nắng); độ mạnh ở `envShade` (`rim` 0,45), chỉnh sau khi xem trên Mac.
- Thấp: bụi ở cỡ thật (3 cm) gần như dưới một điểm ảnh trong ảnh sandbox 1280 px; trên Mac 1920 px + bloom sẽ là đốm lấp lánh. Ảnh debug xác nhận hạt chỉ sáng trong vệt nắng.
- Thấp: sương sát đất chỉ tính trong 56 m quanh camera; xa hơn do sương giải tích theo độ cao (DV-079) lo, không thấy đường nối trong ảnh kiểm.

## DEVIATIONS

- Nắng tán xạ trong sương sát đất giảm còn 0,35 lần so với sương nền: bản đầu nhìn về phía nắng bị loá trắng cả khung hình.

## SUGGESTIONS

- Xem trên Mac: `?quality=high` so với `&mist=0`, `&dust=0`, `&envshade=0`; `npm run bench`.
- Nếu muốn sương dày hơn lúc rạng sáng: tăng `post.volumetric.mist.density` trong level M1 (0,035 → 0,05).
