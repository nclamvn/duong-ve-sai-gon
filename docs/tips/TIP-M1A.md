# TIP-M1A — Trận đánh M1 lát cắt trên tuyến Trường Sơn (G1-A, DV-043)

**Deps:** TIP-UX02 (marker/la bàn), D05 rừng, D-SKY (UH-1 treo bãi (−624, 480)). **Ưu tiên:** P0 (Chủ nhà: "không biết đi về đâu, nhiệm vụ gì, quân mình không thấy đâu, không thấy cả quân địch").

## Context
- Level `truong-son-a.level.json` hiện không có mission (MissionHost chạy nhầm `g0-arena` — thoại Hải Tuyến hiện trên màn hình); 1 bot ambient ngủ cách 54 m. Hệ mission data-driven (`src/game/mission/*`, schema `mission.schema.json`): node script/objective/encounter/terminal, action radio/objective/spawn/checkpoint, condition zone_enter/group_dead/flag/timeout.
- Bot (`src/game/ai/bot.ts`): FSM, `deps.target()` = người chơi, bắn layer WORLD|PLAYER. `SquadCoordinator` = tổ địch flanking.
- Kịch bản M1 (`docs/story/KICH-BAN-v0.1.md` §M1): tiểu đội trưởng **Trần Văn Quyết**, **Lê Minh Hải "Hải sáo"**, **Hoàng A Sáng**; giao chiến đầu = chặn toán thám báo trước bãi bốc UH-1. Luật DV-009/010: không bịa sự kiện có tên; thám báo/UH-1 là hoạt động thường (registry `evt.1971.lam_son_719` chờ cố vấn).

## Task
1. `content/missions/truong-son-a.mission.json` + thoại `truong-son-a.dialogue.json` (speaker QUYET/HAI/SANG/GIAO_LIEN; ≤ 2 dòng/phụ đề): n_intro (theo Quyết vào tuyến, obj_m1_follow) → n_ridge (zone điểm quan sát, checkpoint B, Quyết "Nghe đã" — máy bay) → n_block (obj_m1_block: đợt 1 3 thám báo spawn ở cover khuất tầm nhìn ≥ 40 m, đợt 2 3 tên sau 25 s hoặc khi đợt 1 chết) → n_lz (obj_m1_lz: tới bãi bốc; sky trigger `huey_insert` ngay; checkpoint C) → terminal (hoàn thành).
2. `MissionHost`: chọn mission theo `levelId` (truong-son → M1), dialogue theo mission; action mới `sky_trigger` (flight id) + `squad_order` (follow/hold) trong allow-list + schema.
3. Faction: `BotDeps.faction: 'enemy' | 'friend'`, `targetsOf(faction)` trả đối phương gần nhất còn sống (địch: người chơi + đồng đội; ta: địch); hitscan layer theo faction (ta: WORLD|ACTOR, địch: WORLD|PLAYER|ACTOR); HIT: cùng phe không sát thương. `game.spawnBot(id, group, spawn, {faction, name, visual})`.
4. `src/game/ai/squadmate.ts`: hành vi FOLLOW (điểm đội hình sau/cạnh người chơi 3–5 m, path navmesh, chạy khi > 12 m, dừng khi ta dừng, không chắn tầm ngắm — né 1,5 m khi ta ngắm qua họ), HOLD, và khi thấy địch → dùng FSM chiến đấu hiện có (ENGAGE/cover) với mục tiêu địch; bark qua cue ưu tiên (thấy địch, nạp đạn, hạ, bị thương) chống spam ≥ 6 s.
5. Địch thám báo: visual `gear: 'thambao'` (retexture rằn ri hổ procedural từ atlas Swat + mũ đi rừng procedural vành tròn; DV-027), `soldier_thambao.glb`, manifest `historical` + registry `uni.arvn.1971.tiger_stripe` approved: false; súng AK tạm (ghi nợ M16 CC-BY).
6. Level: `botSpawns` cho đồng đội (cạnh spawn) + 2 cụm spawn địch khuất; `coverMarkers` ở khu giao chiến; `zones` ridge/block/lz.
7. Bot đứng yên ambient bỏ (thay bằng đồng đội).

## Acceptance
- E2E `level-truong-son`: chạy mission bằng `stepSim` + teleport: intro → ridge (checkpoint B) → block (6 địch chết bằng `__ht` damage) → lz (Huey hover trigger, `skyStats().runsNow` có huey_insert ≤ 2 s) → MISSION_COMPLETE ×1; đồng đội cách người chơi ≤ 12 m sau 20 s đi; không đồng đội nào chết vì đạn ta/đồng đội; không spawn trong 40 m/tầm nhìn.
- Unit: faction targeting (địch chọn đồng đội gần hơn khi người chơi xa), friendly fire = 0, bark cooldown.
- Ảnh Mac: đồng đội đi cùng có tên khi nhìn, địch rằn ri ở khu giao chiến, marker mục tiêu.

## Constraints
- Không đổi kiến trúc FSM bot; thêm qua deps/faction. Không Math.random. Không literal tiếng Việt trong src. Không đổi tuning ai.json để "dễ".
