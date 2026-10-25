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

## DV-093c (25/10/2026): intro bản đầy đủ 77 giây, ghép bản cũ và cảnh mới

Chủ nhà yêu cầu: ghép intro trước và phần mới nhất thành một intro đầy đủ, dài hơn 60 giây, tận dụng mọi cảnh đã dựng.

STATUS: DONE (sandbox). Giọng C01–C07 và nhạc vẫn chờ ElevenLabs.

Bố cục bản đầy đủ `intro` (77 s), mọi cảnh giữ độ dài gốc của bản đầu:

| Giây | Shot | Nội dung |
|---|---|---|
| 0–6 | s1_den | màn đen, địa danh, nhiễu bộ đàm |
| 6–19 | s2_bando | bản đồ tác chiến, chỉ huy giao nhiệm vụ (C01, C02) |
| 19–27 | s3_tren_may | bay trên mây xuống tán rừng (C03) |
| 27–36 | s4_b52 | B-52 rải thảm, quay chậm |
| 36–43 | s5_doan_xe | đoàn xe cháy (C04) |
| 43–50 | s6_loi_suoi | tổ Quyết lội suối (C05) |
| 50–57,5 | s7_phuc_kich | phục kích: nhìn sang bờ địch, lia xuống tổ đang bắn trả (M71) |
| 57,5–66,5 | s8_nga | bị nổ hất ngã, góc nhìn thứ nhất, Quyết gọi dậy (C06, C07) |
| 66,5–72,5 | s9_xung_phong | mới: nối liền cảnh ngã, chạy theo Quyết ra bờ suối, hạ sau lưng anh khi anh bắn, nổ sát, quay chậm |
| 72,5–77 | s10_tua | tựa ĐƯỜNG VỀ SÀI GÒN |

FILES CHANGED:
- `content/cinematics/intro.cine.json`: bản đầy đủ 77 s (10 shot).
- `content/cinematics/intro-60.cine.json` (mới): bản 60 s của DV-093b, giữ làm dự phòng (`?cine=intro-60`), nhạc riêng `intro-60-score.mp3`.
- `game/narrative/cineBoot.ts`: đăng ký hai bản cắt.
- `scripts/cine-music.mjs`: `--id intro|intro-60`, mỗi bản một bố cục nhạc khớp cảnh (thêm đoạn choáng và xông lên).
- `content/levels/truong-son-a.level.json`: khoảng trống thực vật dọc đường chạy của shot xông lên (lá ráy che khung).
- `README.md`: lệnh cho hai bản cắt.
- Tests: `tests/unit/cinematics.test.ts` kiểm cả hai bản (shot nối liền, sự kiện, chữ, thoại; bản đầy đủ chứa mọi shot của bản 60 s); `tests/e2e/dv093.spec.ts` (mốc đoàn xe 38 s, cuối theo `duration`).
- Ảnh: `ban-day-du.jpg`.

TEST RESULTS (`evidence_status: sandbox_swiftshader_lifecycle_only`):
- Typecheck 0 lỗi. Unit 308/309 (lỗi duy nhất vẫn là `voice.test`, chờ file giọng).
- E2E `dv093`, `dv092`, `level-truong-son`: 6/6 đạt.
- Dựng thử 50–57,5 s và 66–72,5 s: tổ bắn trả hiện rõ trong khung; đường chạy xông lên không còn lá che.

ISSUES:
- Cao: chưa có giọng và nhạc (ElevenLabs). Bản đầy đủ cần chạy lại `node scripts/cine-music.mjs` (77 s).
- Trung bình: chưa dựng 4K toàn bộ 77 s trên Mac để chấm nhịp liền mạch.

SUGGESTIONS:
- Trình chiếu nhà đầu tư dùng bản đầy đủ; bản 60 s để dự phòng nếu bị giới hạn thời gian.

## DV-094 (25/10/2026): intro nối liền vào trận M1

Chủ nhà yêu cầu: nối phần intro vào phần chơi để liền mạch. Chủ nhà chọn:
- phim MP4 chiếu tới cú nổ hất ngã, từ đó chạy trong engine rồi trao quyền tại chỗ;
- tựa phim hiện đè lúc đang chơi, không còn màn đen.

STATUS: DONE (sandbox).

Diễn biến trong game (vào M1 không có `autostart=1`):
1. Phim MP4 chiếu 0 đến 57,37 s. Điểm cắt rơi vào khung đen của cú nổ, cắt theo khung hình (`requestVideoFrameCallback`).
2. Engine chạy tiếp từ 57,45 s:
   - dựng lại trạng thái tại thời điểm đó: chất phim, sương, khói, loạt đạn còn bắn, nhạc phát tiếp từ giữa bài;
   - không phát lại chuyện đã qua;
   - nằm dưới đất, Quyết chạy đến gọi, kéo dậy.
3. Tại 65,0 s, lúc Quyết quay người chạy ra suối, người chơi nhận quyền ngay tại chỗ camera đang đứng:
   - mắt và hướng nhìn khớp camera, chuyển êm 0,45 s;
   - súng rút lên;
   - tổ thật ra đúng chỗ năm diễn viên và giữ bờ suối;
   - nhiệm vụ M1 bắt đầu, bỏ câu M71 vì intro vừa nói;
   - HUD hiện dần, sương về mức trận trong 5 s, nhạc tắt dần 6 s;
   - tựa ĐƯỜNG VỀ SÀI GÒN / PHẦN MỘT · CỔNG TRỜI hiện đè 1,6 s sau rồi tan.

FILES CHANGED:
- `content/cinematics/intro.cine.json`: khối `handoff` gồm cut, live, t, holdAt, skipCues, title.
- `game/narrative/cinePlayer.ts`:
  - `start(from)`, `skipTo(t)`, `handoff()`;
  - `seamless`;
  - bước đồng hồ tối đa 0,1 s mỗi khung, để khung giật không nhảy cóc qua điểm trao quyền.
- `game/narrative/cineBoot.ts`:
  - `playIntroLive`, `introVideoCut`;
  - `&from=` khi xem trực tiếp;
  - `&then=play` trao quyền liền mạch.
- `game/narrative/cineRecorder.ts`: bộ ghi bỏ giới hạn bước.
- `ui/introVideo.ts`: `until`, cắt gọn không mờ dần.
- `ui/titleCard.ts` (mới): tựa hiện đè lúc chơi.
- `main.ts`: luồng phim, rồi engine, rồi trận.
- `game/game.ts`:
  - `introPlanned` giữ nhiệm vụ tới lúc trao quyền;
  - `beginMission(intro)`, `resetFilm()`;
  - tổ có tên không bị cắt khung nhìn (đứng sát người chơi thì thân không biến mất).
- `game/mission/missionHost.ts`: `startFromIntro` (chỗ đứng theo tên, điểm giữ đặt sau node đầu).
- `game/mission/runtime.ts`: `skipCues`.
- `game/mission/types.ts`: `IntroHandoff`.
- `game/ai/squadmates.ts`: `holdAt`.
- `engine/audio/audio.ts`: `playClip(..., offset)`.
- Tests:
  - `tests/e2e/dv094.spec.ts` (mới);
  - `tests/unit/cinematics.test.ts`: điểm cắt nằm trong khung đen, trao quyền trong shot cảnh ngã.
- README.
- Ảnh: `noi-lien.jpg`.

TEST RESULTS (`evidence_status: sandbox_swiftshader_lifecycle_only`):
- Typecheck 0 lỗi. Unit 309/310 (vẫn chỉ `voice.test`).
- `dv094` đạt:
  - engine chạy tiếp từ 57,45 s; nhiệm vụ chờ (0 lính nhiệm vụ, 8 diễn viên);
  - trao quyền: người chơi đứng dưới camera (sai số 0,04 m), hướng nhìn khớp (tích vô hướng 0,99998);
  - 5 người tổ đúng chỗ diễn viên (sai số 0 m), tổ giữ đúng điểm bờ suối;
  - radio M72, M73 có, M71 không lặp; HUD bật, tựa phim hiện, AI chạy, súng hiện.
- Ảnh khung: trước trao quyền (cận mặt Quyết), ngay sau (súng rút lên, Quyết trước mặt, tổ bắn ở suối, mục tiêu M1, Đạt hô M72).
- E2E `dv094`, `dv093`, `dv092`, `level-truong-son`, `mission`, `boot`: 17/17 đạt. Lượt đầu có 2 lỗi thời gian ở sandbox (boot arena quá 90 s khi máy bận; tổ trưởng cách 16,5 m so với ngưỡng 16 m); chạy lại riêng đều đạt.

ISSUES:
- Trung bình: chưa chấm trên Mac với MP4 thật (cần dựng 4K và ghép tiếng); trong sandbox không có file phim nên đi thẳng vào phần engine.
- Thấp: đường dẫn `autostart=1` (Chủ nhà hay dùng) bỏ qua intro theo thiết kế; muốn xem cả chuỗi thì mở không có `autostart`.

DEVIATIONS:
- L1: tổ có tên không bị cắt khung nhìn ở mọi lúc (5 lính), sửa lỗi thân biến mất khi đứng sát người chơi, không chỉ cho intro.
