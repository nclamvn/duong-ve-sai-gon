# Completion Report DV-091..093: bản trình diễn nhà đầu tư (24–25/10/2026)

STATUS: PARTIAL.
- Phần code xong: chống giật, đoàn xe cháy, HDR tuỳ chọn, intro dựng trong engine, nạp song song.
- Còn chờ hai việc từ Chủ nhà:
  - giọng chỉ huy/Quyết và nhạc nền (ElevenLabs báo hoá đơn chưa thanh toán);
  - dựng hình 4K trên Mac (cần `npm run dev`).

Chủ nhà duyệt (24/10):
- intro dựng trong engine, xuất MP4;
- kiểu giao nhiệm vụ rồi mở màn hành động;
- chỉ asset miễn phí;
- hạn 1 tuần.

## FILES CHANGED

DV-091 chống giật (commit 48ed3d8):
- `engine/render/characters.ts`, `camo.ts`, `envShade.ts`: đồ thị node dùng chung, biến thể qua `materialReference`.
- `engine/render/flares.ts`: đèn không bật tắt `visible`.
- `game/game.ts`:
  - AI rải 6 khung;
  - LOD hoạt ảnh;
  - dọn xác;
  - `spawnStats`;
  - timestamp chỉ khi đo.
- `game/actors/botActor.ts`, `game/ai/bot.ts`: Quyết thôi nấp khi hết địch.
- `ui/hud.ts`, `ui/minimap.ts`: không ép bố cục.
- `engine/audio/audio.ts`: HRTF chỉ gần.
- `engine/render/backend.ts`.
- Tests:
  - `tests/e2e/shader-share.spec.ts`, `first-use.spec.ts` (mới);
  - `level-truong-son.spec.ts`, `playtime-m1.spec.ts`: đếm địch theo `spawnStats`, Quyết xung phong có người chơi đứng sau.

DV-092 cảnh (commit 48ed3d8):
- `engine/render/burnt.ts` (mới).
- `engine/terrain/props.ts`: prop `wreck`.
- `engine/terrain/features.ts`: `trails`.
- `engine/render/post.ts`: lớp HDR.
- `content/levels/truong-son-a.level.json`: đường xe, 5 xác Zil-157, đồ rơi vãi, lửa khói, boost × 1,4, tương phản 0,58.
- `public/assets/terrain/truong-son-a/features.json`: trail = tuyến giao tranh thật.
- `nav.bin`, `nav-ngam-ta-le.bin`: bake lại.
- `scripts/terrain-bake.mjs`, schema, manifest.
- `tests/e2e/dv092.spec.ts`, `tests/unit/forestDv063.test.ts`.

DV-093 intro (đã chép sang Mac, chưa commit):
- `content/cinematics/intro.cine.json`: 8 shot, 8 diễn viên, ~45 sự kiện (DV-093b: 9 shot).
- `content/missions/intro.dialogue.json`: C01–C05.
- Locale `cine.*`, `dlg.C0x`.
- Engine và game:
  - `engine/cinematics/track.ts`;
  - `game/narrative/cinePlayer.ts`, `cineRecorder.ts`, `cineBoot.ts`;
  - `ui/cineOverlay.ts`, `ui/briefingMap.ts`, `ui/introVideo.ts`;
  - `engine/render/atmosphere.ts` (`densityScale`), `engine/audio/audio.ts` (`recordTap`, `playClip`, `radioStatic`);
  - `game/game.ts` (`preFrame`, `simScale`, `setFixedRender`, `beginMission`, `smokeKickCap`);
  - `main.ts`.
- Scripts:
  - `scripts/cine-plugin.ts`: POST `/__cine/write` → `recordings/`;
  - `scripts/cine-mux.mjs`: ffmpeg;
  - `scripts/cine-music.mjs`: ElevenLabs Music.
- `engine/render/assets.ts`: nạp song song.
- `game/mission/missionHost.ts`: `voiceCuesFor`, `missionUsesFlares`.
- Tests: `tests/unit/cinematics.test.ts`, `tests/e2e/dv093.spec.ts`.

## TEST RESULTS

Kết quả sandbox (`evidence_status: sandbox_swiftshader_lifecycle_only`).

- Typecheck 0 lỗi.
- Unit 306/307. Lỗi duy nhất: `voice.test` cho C01–C05 chưa có file giọng, chờ ElevenLabs.
- Chống giật:
  - thêm 14 lính cùng loại: chương trình shader mới 14 → 0, thời gian 6,1 s → 0,6 s;
  - lần đầu nổ, lửa, napalm, máy bay, lựu đạn, đất vụt, chất phim: 0 chương trình mới.
- `dv092`:
  - 5 xác xe, một node màu cháy dùng chung;
  - navmesh vòng qua xác (> 2 m);
  - 0 thân cây trên đường xe;
  - người chơi chạy vào xác xe dừng cách tâm 1,6 m.
- `dv093`:
  - intro giữ nhiệm vụ (0 lính nhiệm vụ);
  - 8 diễn viên;
  - camera khớp track (sai số 0);
  - bản đồ vẽ được;
  - hết intro: xoá diễn viên, M1 ra quân 11 người, HUD bật.
- `mission.spec` (checkpoint hash) và M1 E2E đầy đủ: đạt sau khi sửa đồng hồ xác và test Quyết xung phong.
- Ảnh intro 60 s: `intro-bang-anh.jpg` (mỗi 2 s), khung lớn `0x-*.jpg`, bản sửa cảnh `sua-canh.jpg`.

## ISSUES

- Cao: chưa có giọng C01–C05 và nhạc. ElevenLabs trả `payment_required`; Chủ nhà đang xử lý.
- Cao: chưa chấm trên Mac:
  - đoàn xe;
  - HDR (`?hdr=1`);
  - độ mượt;
  - cảnh trên không và B-52.
  Sandbox không giải mã được gói cây Fab nên rừng nhìn từ trên cao thưa hơn thật.
- Trung bình: cảnh B-52 và trên không còn ít kịch tính trong ảnh sandbox; cần xem bản 4K trên Mac để chỉnh tiếp.
- Thấp: mở màn M1 nhìn về phía đông lúc bình minh (ngược nắng qua sương) nên ảnh sáng mờ.

## DEVIATIONS

- L1: thêm tiền tố cue `C` vào schema thoại. Lý do: M00–M99 đã kín và M1xx dùng cho M1.
- L1: mã hoá hình dùng WebCodecs H.264 (Annex-B) và ghép bằng ffmpeg, không thêm thư viện mux, nên không cần ADR phụ thuộc.

## SUGGESTIONS

- Sau khi có bản 4K: Chủ nhà chấm từng cảnh; em chỉnh góc máy và nhịp, rồi dựng lại (khoảng 10–20 phút trên M1 Max).
- Nếu ElevenLabs không kịp: nhạc CC-BY (Kevin MacLeod, cần cho phép tải), thoại chỉ phụ đề.

## DV-093b (25/10/2026): cảnh ngã góc nhìn thứ nhất, diễn viên không xuyên vật thể

Chủ nhà yêu cầu: intro chưa ấn tượng, cần cảnh người lính chạy đến nâng người chơi đang ngã vì bom (góc nhìn thứ nhất, cận cảnh điện ảnh); lính không được chạy xuyên qua xe và vật thể.

STATUS: DONE (sandbox). Giọng C06, C07 vẫn chờ ElevenLabs.

FILES CHANGED:
- `engine/cinematics/track.ts`: khoá camera có `roll` (nghiêng máy khi nằm dưới đất).
- `game/narrative/cinePlayer.ts`:
  - diễn viên đi theo đường navmesh giữa hai khoá (vòng qua xác xe, cây, đá), không nội suy thẳng;
  - quay người mượt tối đa 7 rad/s;
  - khoá `face`: quay về một điểm mà không giơ súng (nói với người dưới đất);
  - tắt cắt khung nhìn cho thân diễn viên khi quay cận (hết cảnh mũ, súng lơ lửng);
  - trả lại mật độ sương khi kết thúc intro (trước đây sự kiện `fog` lọt sang lúc chơi).
- `content/cinematics/intro.cine.json`: 9 shot. Shot mới `s8_nga` (46,5 đến 55,5 s):
  - nổ sát người, chớp đen, quay chậm, lặng tiếng, máy nằm nghiêng dưới đất;
  - Quyết từ lòng suối chạy đến, đứng trên người chơi gọi "Lâm! Lâm! Nghe tôi không?", "Dậy! Đứng dậy, theo tôi!";
  - máy nâng lên ngang mặt Quyết (cận mặt, nổ phía sau), rồi theo anh xông ra suối.
- `content/missions/intro.dialogue.json`, locale: C06, C07. `scripts/voice/lines.mjs`: nhãn giọng.
- `content/levels/truong-son-a.level.json`: hai khoảng trống thực vật quanh chỗ ngã; `nav.bin` bake lại.
- Tests: `tests/e2e/dv093.spec.ts` (mốc kiểm camera dời sang shot đoàn xe 31 s).
- Ảnh: `pov-nga.jpg` (49 đến 55 s).

TEST RESULTS (`evidence_status: sandbox_swiftshader_lifecycle_only`):
- Typecheck 0 lỗi. Unit 306/307 (lỗi duy nhất vẫn là `voice.test`, chờ file giọng).
- E2E `dv093`, `dv092`, `level-truong-son`: 6/6 đạt.

ISSUES:
- Trung bình: tư thế cúi của bộ hoạt ảnh giơ súng che mặt, nên Quyết đứng (không quỳ) khi gọi người chơi. Quỳ đỡ người cần một clip hoạt ảnh riêng.
- Thấp: nhìn ngược lên trời sương vẫn sáng; cần xem bản 4K (`quality=ultra`) trên Mac.
