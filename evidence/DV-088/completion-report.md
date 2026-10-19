# DV-088 Completion Report: gói A "bị nổ sát người" (19/10/2026)

STATUS: DONE (chờ Chủ nhà chấm cảm giác trên Mac). Gói A trong đề xuất ba gói để đạt chất trận Normandy. Làm ở engine, mọi vụ nổ đi qua `Game.explode` đều dùng (lựu đạn, cối, pháo, bom, napalm, bộc phá), mọi màn hưởng.

## FILES CHANGED
- created:
  - `src/engine/render/scorch.ts`: vết cháy xém, 48 vết vòng tròn, 1 draw call, biên dịch lúc nạp (ô chưa dùng co về 0 nhưng vẫn vẽ).
  - `src/ui/lensDirt.ts`: bùn lên ống kính (canvas 2D trên ảnh game, dưới HUD).
  - `tests/unit/shellShock.test.ts` (3 test), `tests/e2e/shell-shock.spec.ts` (E2E vật lý), `tests/e2e/shots-shock.spec.ts` (ảnh, không chạy CI).
  - `evidence/DV-088/*.png`.
- modified:
  - `src/engine/audio/audio.ts`:
    - chuỗi master → lowpass → gain → loa;
    - `shellShock(k, s)`: ù tai, ù rít ~4 kHz, hụt âm lượng;
    - `heartbeat(k)`, `clearShock()`;
    - thêm nhát "chát" 3,2 kHz khi đạn sượt rất sát.
  - `src/engine/render/post.ts`: uniform `shock`, `shockDir`, `shockFlash`.
    - Nhìn đôi lệch màu dùng chung texture đầu vào của FXAA, không thêm pass.
    - Thêm mất màu, viền tối kiểu đường hầm, chớp trắng.
  - `src/engine/render/blastFx.ts`: `rain(feet, k)`, mưa đất 96 hạt × 4 lần cùng lúc (thêm 1 draw call).
  - `src/game/player/camera.ts`: `stumble(k, side)`, lò xo nghiêng đầu và gục xuống, theo cài đặt rung.
  - `src/engine/physics/controller.ts`: `speedMul` (mặc định 1).
  - `src/game/game.ts`:
    - `playerShock`, `updateShock`, `placeScorch`;
    - đạn sượt làm đất văng quanh chân (phát `IMPACT` earth);
    - reset;
    - `?shock=0` tắt choáng.
  - `docs/DECISIONS.md`: dòng DV-088.

## TEST RESULTS
- Typecheck 0 lỗi. Unit 304/304 (thêm 3).
- E2E `shell-shock` (sandbox SwiftShader, post low) PASS:

  | Tình huống | Kết quả |
  |---|---|
  | nổ xa 70 m | không choáng, có vết cháy |
  | nổ sát 3 m | choáng 0,96; post shock 0,996; tốc độ × 0,57; nghiêng đầu 0,25 rad (trước khi giảm lò xo); bùn ống kính phủ 1; 1 lần mưa đất; 2 vết cháy |
  | 8 viên đạn sượt | 7 lần đất văng quanh chân |
  | 7 s sau | hết choáng, hết bùn, chân bình thường |

- Toàn bộ E2E webgl-ci (`npx playwright test --project=webgl-ci`): 24 pass, 8 skip (7 spec ảnh và `playtime-m1`, chỉ chạy tay), 0 fail, 28,7 phút.
- Ảnh (sandbox, M1, post medium, `vegDensity=0.35`, `evidence_status: sandbox_swiftshader_lifecycle_only`):
  - `01` trước nổ;
  - `02` 0,1 s: chớp trắng, nhìn đôi, bùn văng, mưa đất;
  - `03` 0,6 s: nhìn đôi, mất màu, viền tối, bùn mép khung;
  - `04` 2 s: đang hồi, cột bụi và đám bụi sau nổ.
  - Ảnh 7 s và vết cháy xém chưa chụp được: SwiftShader quá chậm, hết hạn 30 phút. Chấm trên Mac.

## ISSUES
- Trung bình: chưa nghe/chấm trên Mac.
  - Cần chấm: độ ù tai, ù rít, tim đập, độ nghiêng đầu, độ dày bùn, chớp trắng.
  - Tự động không chấm được game feel (AGENTS §6).
  - Server dev trên Mac đang tắt.
- Thấp:
  - Nhìn đôi lấy mẫu ảnh trước grade nên ảnh ma cùng tông với ảnh chính.
  - Nếu nhìn thấy hai lớp viền ở vùng sáng thì hạ hệ số trộn 0,62.
- Thấp: tốc độ chậm tới × 0,55 lúc vừa choáng. Có thể cảm giác "bị trói" nếu nổ liên tục; cần chơi thử.

## DEVIATIONS
- Đất văng quanh chân đi qua sự kiện `IMPACT` sẵn có (bụi, vết đạn, tiếng phụp).
  - Lính phe ta đứng gần cũng bị áp chế nhẹ như khi đạn thật cắm đất. Hợp lý nên giữ.

## SUGGESTIONS
- Gói B (lính nền đông, người bị thương bò gọi cứu thương, kéo đồng đội) cần clip Mixamo do Chủ nhà tải, và quyết mức máu me.
- Gói C (màu phim bleach-bypass, máy cầm tay, nhịp một hồi kiểu Normandy) có thể làm ngay, không cần asset.
