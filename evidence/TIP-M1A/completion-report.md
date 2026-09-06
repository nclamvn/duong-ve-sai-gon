# Completion Report — TIP-M1A: Trận đánh M1 lát cắt trên tuyến Trường Sơn (G1-A, DV-043)

STATUS: **DONE (sandbox) — chờ ảnh Mac WebGPU; asset thám báo là shader tạm (D11c)**

## FILES CHANGED
- Mới: `content/missions/truong-son-a.mission.json` (n_intro → n_ridge cpB → n_to_block → n_block đợt 1 (timeout 25 s → đợt 2) → n_wave2 → n_block_done cpC → n_lz sky_trigger UH-1 → n_done), `content/missions/truong-son-a.dialogue.json` (M01–M15: Quyết/Hải/Sáng), `src/game/ai/squadmates.ts` (Quyết dẫn/dừng chờ/đuổi, Hải theo đội hình, hold, bark chống spam), `src/engine/render/camo.ts` (rằn ri hổ TSL cho thám báo), `tests/unit/hud-m1.test.ts`.
- Sửa: `src/game/mission/types.ts|runtime.ts|loader.ts` + `content/schemas/mission.schema.json` (action `sky_trigger`, `squad_order`, `objective.marker`; condition `active_ms`; spawnGroup `archetype recon|squad`, `faction`, `spawns[]`, `names[]`), `content/schemas/dialogue.schema.json` (speaker QUYET/HAI/SANG/THANH/GIAO_LIEN, cue M##), `src/game/mission/missionHost.ts` (mission theo level; `objectiveMarker`; `say()` bark; spawn theo điểm riêng + tuyến tuần tra = cover marker quanh spawn; SKY_TRIGGER/SQUAD_ORDER; restore giữ faction/tên), `src/game/ai/bot.ts` (deps `faction`/`hitMask`/`followGoal`, `AI_RELOAD`, speedMul, đồng đội không nghe tiếng chân ta), `src/game/actors/botActor.ts` (faction, nameKey, lastFireTick), `src/game/game.ts` (`Squadmates`, `spawnBot(opts)`, `nearestHostile` theo phe, HIT: cùng phe không sát thương, bark contact/reload/kill/hurt/cover, bỏ bot ambient ở truong-son), `src/engine/render/characters.ts` (skin `recon`), `src/engine/sky/traffic.ts` (`trigger()`), `content/levels/truong-son-a.level.json` (spawn sq_/rc1_/rc2_, zones ridge/block/lz, 10 cover marker sau gốc cây (script), điểm treo UH-1 = bãi bốc (−292, 306) trong navRect, lượt huey_insert chỉ theo mission), `tests/e2e/level-truong-son.spec.ts` (test M1 + skyTrigger), `src/qa/debugApi.ts` (`squad()`, `skyTrigger()`).

## TEST RESULTS (theo AC TIP-M1A)
| AC | Kết quả |
|---|---|
| Mission chạy hết bằng stepSim + teleport, MISSION_COMPLETE ×1, 3 checkpoint | ✅ E2E + unit graph (active_ms không tính thời gian chờ zone) |
| Đồng đội theo: Hải ≤ 12 m, Quyết dẫn trước ≤ 16 m sau 12 s | ✅ E2E (`followerDist`, `leaderDist`) + unit goalFor |
| Cùng phe không sát thương (ta → đồng đội, đồng đội → đồng đội); địch → đồng đội có | ✅ E2E HIT theo shooter |
| Địch không spawn trong 40 m/tầm nhìn | ✅ E2E minDist > 40 (thực tế ~70 m, sau cây) |
| UH-1 tới bãi ≤ 2 s sau khi vào zone | ✅ E2E `runsNow` có huey_insert |
| Unit faction/bark/mission schema+locale | ✅ 8/8 |
| Ảnh: đồng đội có tên khi nhìn, thám báo rằn ri, marker | ✅ sandbox `sandbox-quyet-lead.jpg`, `sandbox-hai-follow.jpg`, `sandbox-recon-contact.jpg` + `sandbox-recon-crop.jpg` (mờ WebGL2) — chờ Mac |

## ISSUES
- (trung) Thám báo = shader rằn ri trên atlas QGP (mặt nạ vải theo sắc độ) + không mũ cối; chưa có mũ đi rừng/M16 — **D11c** retexture thật (cần `assets-src/mixamo/soldier-swat.glb` — không còn trong sandbox lẫn Mac; phải dựng lại từ `swat.fbx` 115 MB) + M16/CAR-15 CC-BY.
- (trung) Đồng đội dùng FSM địch (cover/peek/flank) — chưa né tầm ngắm người chơi; chưa có "giúp qua ngầm/bi đông" (D13 đầy đủ).
- (thấp) Bark chưa có audio (chỉ phụ đề); thoại tiếng — D09.
- (thấp) Quyết dừng chờ theo khoảng cách tới mục tiêu — trên đường vòng navmesh dài có thể chờ sớm.

## DEVIATIONS
- LZ/điểm treo dời từ (−624, 480) (ngoài navRect, bot không tới được) về (−292, 306) trong navRect (find-clearing 22 m).
- `huey_insert` bỏ lịch tự động (first 100000) — chỉ mission kích hoạt; E2E bầu trời dùng `skyTrigger`.
- Địch bắn được đồng đội (layer ACTOR) và ngược lại; người chơi **không** sát thương đồng đội (tạm miễn — PRD §20.3 chưa nói; Chủ nhà quyết).

## SUGGESTIONS
- Cố vấn: thám báo VNCH 1971 (rằn ri hổ/ERDL, CAR-15, PRC-25) → registry `uni.arvn.1971.tiger_stripe`; hoạt động thám báo + UH-1 bốc trên tuyến 20 (evt registry).
- D13: né tầm ngắm, "Nghe đã" dừng cả tổ (hold khi Quyết giơ tay), giúp qua ngầm; D14: archetype thám báo tuning riêng (rút lui về bãi khi bị áp đảo).
