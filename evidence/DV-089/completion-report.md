# DV-089 Completion Report: gói C "chất phim Normandy" (19/10/2026)

STATUS: DONE (chờ Chủ nhà chấm trên Mac). Một mức `film` 0..1 điều khiển màu phim, máy cầm tay, màn trập hẹp; hồi sườn đồi M1 viết lại theo nhịp Normandy.

## FILES CHANGED
- modified:
  - `src/engine/render/post.ts`: uniform `bleach` (bleach-bypass, giữ màu đỏ cam của lửa máu).
  - `src/game/player/camera.ts`: `handheld` (nhiễu cầm tay ba tầng trên pitch/yaw/roll, theo cài đặt rung).
  - `src/engine/render/blastFx.ts`: `staccato` (nhịp khung của hạt nổ/đất/bụi/mưa đất).
  - `src/game/mission/battle.ts`:
    - `fx` kind `film`, `hush`;
    - `strike.near`;
    - lửa và khói chiến trường theo nhịp màn trập.
  - `src/game/mission/types.ts`, `content/schemas/mission.schema.json`: `near`, mô tả kind mới.
  - `src/engine/audio/audio.ts`: lớp "thế giới" (sfx + nền) có lowpass/gain riêng, `hush(depth, s)`; thoại/bộ đàm không qua lớp này.
  - `src/game/game.ts`: `setFilm`, `hush`, `updateFilm`; tim đập khi thế giới lặng; reset.
  - `src/engine/terrain/level.ts`, `content/schemas/terrain-level.schema.json`, `content/levels/truong-son-a.level.json`: `post.film` (M1 = 0,3).
  - `content/missions/truong-son-a.mission.json`:
    - nút mới `n_doi_lull`, `n_doi_barrage`;
    - `n_doi` thêm xung phong, cối quanh người, quả nổ cách 9 m;
    - `n_doi_done` film 0,5.
  - `content/missions/truong-son-a.dialogue.json`, `content/locale/vi.json`, `scripts/voice/lines.mjs`: cue M100–M105; M83 đổi chữ và đọc thì thầm.
  - `public/assets/voice/vi/{M83,M100..M105}.mp3`, hai manifest: 7 file ElevenLabs tạo trên Mac.
  - Tests: `tests/unit/m1Dv085.test.ts` (đi qua hai nút mới), `tests/e2e/shell-shock.spec.ts` (+1 test DV-089), `tests/e2e/shots-shock.spec.ts` (+ảnh A/B).
  - `docs/DECISIONS.md`: dòng DV-089.

## TEST RESULTS
- Typecheck 0 lỗi. Unit 304/304 (voice.test khớp băm 7 file mới).
- E2E `shell-shock` 2/2 PASS (sandbox SwiftShader):
  - mặc định film 0,3, chưa có nhịp màn trập;
  - đặt film 1:
    - sau 4 s film 0,94, bleach 0,94;
    - màn trập 24 khung;
    - cầm tay 0,0033 rad khi đứng yên;
  - `hush` 3 s đang chạy;
  - `strike.near` 9 m: 1 quả nổ, người chơi bị choáng 1 lần;
  - hạ film 0,05: tắt nhịp màn trập.
- Toàn bộ E2E webgl-ci (`npx playwright test --project=webgl-ci`): 25 pass, 9 skip (spec ảnh, `playtime-m1`, `webgpu`), 0 fail, 29,2 phút.
  - Lượt trước khi sửa có 3 lỗi, đã xử lý:
    - `mission.spec` (arena): cue tiền tố D trùng thoại arena → đổi M100–M105;
    - `boot` arena quá hạn 90 s → nhánh `If` trong post;
    - M1 E2E chờ `n_doi` → thêm hai nút mới vào test.
  - Riêng M1 E2E chạy lẻ một mình thì hồi 1 hỏng (Quyết đứng PEEK_FIRE vào mục tiêu đã chết). Lỗi này có cả trên bản DV-088 nguyên gốc, chạy cả bộ thì qua. Không do DV-089; ghi ở ISSUES.
- Ảnh A/B: `07-phim-0.3.png`, `08-phim-1.png` (sandbox, `evidence_status: sandbox_swiftshader_lifecycle_only`).

## ISSUES
- Trung bình: chưa chấm trên Mac.
  - Cần chấm:
    - độ bạc màu;
    - độ rung cầm tay khi chạy;
    - nhịp 24 khung của lửa/khói (có thể thấy "rẻ" thay vì "phim");
    - độ dài 16 s nín thở;
    - mật độ pháo khi xung phong.
  - Tự động không chấm được game feel.
- Thấp (có từ trước): AI Quyết đôi khi kẹt PEEK_FIRE vào toạ độ địch đã chết (thấy khi chạy lẻ M1 E2E, cả bản DV-088); nên xoá mối đe doạ khi mục tiêu chết.
- Thấp: chết giữa dốc thì hồi sinh ở cp3 (đầu `n_doi`), không phát lại đoạn nín thở + pháo (cố ý, tránh lặp).

## DEVIATIONS
- `post.ts`: lớp choáng (DV-088) và lớp bleach chạy trong nhánh `If` theo uniform.
  - Lúc không choáng, không lấy mẫu thêm; lúc film 0, không tính thêm.
  - Lý do: E2E `boot` arena trên SwiftShader vượt hạn 90 s khi hai lớp luôn chạy (1,5 phút → quá hạn).
  - Sau sửa: 1,4 phút, bằng bản DV-088.
  - Đã kiểm ảnh: bleach 1 hạ độ bão hoà trung bình 110 → 49; choáng 1 đổi ảnh rõ.
- `content/schemas/dialogue.schema.json`: mã cue nhận 3 chữ số (M100–M105) vì M00–M99 đã kín. Lần đầu dùng tiền tố D thì trùng thoại màn arena (D01–D06), E2E `mission.spec` bắt được, đã đổi.

## SUGGESTIONS
- Nếu nhịp 24 khung của lửa trông giật quá: chỉ giữ cho cầu lửa/đất văng (blastFx), bỏ cho lửa cháy âm ỉ (`fireField`).
- Áp `fx` kind `film` cho các hồi khác (B-52 chạy vào lòng suối 0,9; bãi đáp 1; rút 0,6) sau khi Chủ nhà duyệt hồi sườn đồi.
- Gói B (lính nền đông, thương binh, kéo đồng đội) chờ clip Mixamo và quyết định mức máu me.
