# DV-078 Completion Report: hồi đêm "Ngầm Ta Lê"

STATUS: DONE (cảm giác chơi, độ khó và hình ảnh chờ Chủ nhà duyệt trên Mac)

## FILES CHANGED

Tạo mới:
- `src/game/night/convoy.ts`: đoàn xe qua ngầm (logic thuần): hàng chờ, qua ngầm từng chiếc, kẹt nước, cháy, chắn ngầm, đẩy, lái xe bị thương, chờ máy bay, người đứng trước mũi xe.
- `src/game/night/gunship.ts`: AC-130A: bay tới, lượn pylon turn, dò 40 ly, loạt 20 ly, báo trước rồi quét minigun ụ súng, áp lực → bỏ vòng → quay lại, rời đi.
- `src/game/night/mountedGun.ts`: DShKM giá phòng không: 600 phát/phút, băng 50, thay hộp, đạn đạo thật, kiểm trúng/sượt máy bay, chạm đất.
- `src/game/night/nightLogic.ts`: ghép ba phần trên + phụ xạ ngồi súng thay + hàm bắn đón `leadAngles`.
- `src/game/night/nightAct.ts`: tích hợp với Game (hình, âm, HUD, F ngồi/rời súng, giữ F đẩy/cứu, thoại theo sự kiện, cờ nhiệm vụ, checkpoint).
- `src/game/night/thuView.ts`: Thu đứng mép ngầm, tư thế tay dựng bằng code, đèn bão + ánh lửa, nón lá.
- `src/game/night/streaks.ts`: vệt đạn đường dài (instanced, không sương) + chớp lửa.
- `content/levels/ngam-ta-le.level.json` (sinh bằng `scripts/gen-level-ngam-ta-le.mjs`), `content/missions/ngam-ta-le.mission.json`, `content/missions/ngam-ta-le.dialogue.json`, `content/tuning/night.json`.
- `public/assets/terrain/truong-son-a/nav-ngam-ta-le.bin`; 46 file giọng `public/assets/voice/vi/N*.mp3`.
- `scripts/voice/find-voices.mjs` (tìm giọng thư viện ElevenLabs, không in khoá).
- Test: `tests/unit/night.test.ts`, `tests/unit/thuView.test.ts`, `tests/e2e/level-ngam-ta-le.spec.ts`, `tests/e2e/shots-ngam.spec.ts` (ảnh, chỉ chạy với `DV_SHOTS`).

Sửa:
- `src/game/game.ts`: level `ngam-ta-le`, NightAct trong vòng sim/render/reset, rừng chừa đường, cảnh âm `ambience`, Enter sang `nextLevel`.
- `src/game/mission/missionHost.ts`: mission/thoại đêm (kèm câu hô dùng chung của M1), `setFlag` công khai, `say(..., bark)`, checkpoint của hồi đêm.
- `src/engine/vegetation/scatter.ts`, `system.ts`, `index.ts`: dải trống (`clearPaths`, `roadClearings`, `ruleWithClear`).
- `src/engine/terrain/level.ts`: `roads` (vẽ đất xới), `navFile`, `nextLevel`, `ambience`, khói `lit`.
- `src/engine/terrain/props.ts`: kiểu props `drum`, `jerrycan`, `chest` (Poly Haven CC0).
- `src/engine/physics/world.ts`: `addKinematicBox` (hộp va chạm xe).
- `src/engine/render/ambientFx.ts`, `src/engine/level/types.ts`: khói ban đêm tối hơn (`lit`).
- `src/engine/audio/audio.ts`: `heavyGun`, `airGun` (tới trễ theo tốc độ âm), `shellHit`, máy xe `truck`.
- `src/ui/hud.ts`, `hud.css`: đếm xe qua ngầm, dấu ngắm khi ngồi 12,7, dòng điểm + gợi ý Enter ở bảng hoàn thành, đạn `∞`.
- `content/levels/truong-son-a.level.json`: `nextLevel: ngam-ta-le`.
- Schema: `terrain-level` (roads, navFile, nextLevel, ambience, vegetation.clear, fx.lit, props mới), `dialogue` (cue N, vai LAIXE).
- `content/voice/cast.json` (THU, LAIXE), `scripts/voice/lines.mjs` (thẻ diễn N), `content/locale/vi.json`.
- `content/registry/weapons.yaml`: `wpn.pavn.dshk_12_7`; manifest: `registryId` cho `wpn_dshk`, `veh_zil157`, `air_c130`, `chr_thu`.
- `scripts/terrain-bake.mjs` (`--out`, props mới, dải trống), `scripts/find-clearing.mjs` (dải trống).

## TEST RESULTS

- `npx tsc --noEmit`: 0 lỗi.
- `npx vitest run`: 270/270 (mới: 16 test hồi đêm + 1 test tư thế Thu dựng từ chính chr_thu.glb).
- E2E `level-ngam-ta-le.spec.ts` (webgl-ci): 2/2.
  - Vật lý: đứng (lệch đất 0,03 m), đi theo đường xuống ngầm, lội nước 2 lần đo, sang bờ xa 10,8 m; nav riêng 10 977 poly; 17 props; 7 656 thân cây, 0 trong dải đường, 0 quanh ụ súng; không đi xuyên thân xe (dừng cách tâm 1,57 m).
  - Cả đêm: gặp Thu → mục tiêu ụ súng → F ngồi súng (HUD "12,7 ly DShK", dấu ngắm) → cờ `gun_manned` → xe đi → AC-130 lượn bắn → bắn đón 32 viên, 10 trúng → bỏ vòng; xe kẹt → rời súng, giữ F đẩy (phụ xạ ngồi thay) → xe nổ máy đi; lái xe bị thương → giữ F cứu (N17) → hết đoàn: N31 + N33 → hoàn thành "Ngầm Ta Lê · qua ngầm 6/8 xe · cứu 1 lái xe".
- Cân bằng (unit test, người chơi giả lập, 4 hạt giống): không ai bắn 1/8; chỉ phụ xạ 3/8; bắn đón sai số 1,5° 3,5/8; bắn đón tốt 6,75/8; một đêm 235 s sau khi máy bay tới.
- `validate-assets`: 0 lỗi, 1 cảnh báo cũ (veh_zil157 47,5k tam giác > 40k). `validate-registry`: 0 lỗi.
- Giọng: 46 file mới, speech-to-text 45/46 ≥ 0,8 (N22 0,79).
- Ảnh kiểm: `night-preview.png` (ngầm, Thu, ngồi súng nhìn AC-130, hàng xe). evidence_status: sandbox_swiftshader_lifecycle_only.
- Toàn bộ E2E (webgl-ci): 23/23 qua (23,5 phút), gồm M1, M2, giọng, lựu đạn và 2 test hồi đêm mới.

## ISSUES

- Trung bình: AC-130 ban đêm rất khó thấy (bóng xám ~10 px ở 1 km, rõ lúc khai hoả và qua vệt đạn). Chủ ý cho đúng thực tế; nếu chơi thử thấy khó bám, đề xuất thêm ánh ống xả rõ hơn hoặc nới vòng lượn xuống thấp.
- Thấp: mô hình máy bay là C-130 có sẵn (helijah, CC-BY), chưa có súng bên sườn của AC-130.
- Thấp: Thu chưa có clip vẫy đèn (tư thế dựng bằng code: giơ đèn, đưa qua lại khi có xe trong ngầm).
- Thấp: lái xe được cứu biến mất (đồng đội đưa đi) thay vì có hoạt cảnh kéo.

## DEVIATIONS

- Đạt không đi cùng tổ như bot mà làm phụ xạ cạnh ụ súng (không AI, không trúng đạn): để khi người chơi xuống ngầm vẫn có người bắn máy bay (không thì một lần xuống đẩy xe là mất cả đoàn). Ảnh hưởng: tổ ở hồi đêm có 4 bot (Quyết, Long, Hoàn, Khang).
- Hồi đêm nối thêm sang M2 (`nextLevel: diem-cao-31`), ngoài yêu cầu M1 → đêm.

## SUGGESTIONS

- Chơi thử trên Mac: độ nhạy chuột khi bắn đón, độ khó (xem cân bằng ở trên), độ tối của cảnh, âm súng máy bay tới trễ ~3 s.
- Nếu muốn khó hơn: giảm `harass.perHit` hoặc tăng `break.holdS` ngắn lại trong `content/tuning/night.json`.
