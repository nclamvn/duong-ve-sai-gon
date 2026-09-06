# TIP-M2-R1 — "Điểm cao 31" đêm công đồn (M2 vòng 1, Blueprint G2, DV-047)

**Deps:** kịch bản `docs/story/KICH-BAN-M2-v0.1.md` C1–C2 (duyệt "triển khai luôn"), D11c địch ERDL/M1/M16A1, mission runtime M1A, terrain D04, thực vật D05. **Ưu tiên:** P0 (Chủ nhà: "triển khai luôn" M2).

## Context
- Terrain level chưa có prop (chỉ DEM + rừng); mission chưa có tương tác giữ phím; chưa có đêm; chưa có nổ.
- Đồi 31 = Điểm cao 543 (16°42′54″N 106°25′34″E theo Wikipedia S) — DEM SRTM N16E106 cho đỉnh 541 m tại 16,704 N 106,409 E (lệch 1,2 km S / 1,8 km W so toạ độ Wikipedia); lấy đỉnh DEM. Không tái hiện sơ đồ FSB thật.

## Task (đã làm)
1. **Terrain `diem-cao-31`**: `terrain-bake --lat 16.703 --lon 106.409 --size 2048 --res 2` (z 317–541 m), `--map`, `--nav` (obstacle cây + props; 2 329 poly); manifest `terrain_diem_cao_31` (PD-USGov). Level sinh bằng `scripts/gen-level-diem-cao-31.mjs`: spawn yên ngựa SW (−402, 274), yOffset 396,7, navRect (−160, 60) 700×700; đêm: HDRI `dikhololo_night` (CC0, sao/Ngân Hà, không đèn — `blue_lagoon_night` có đèn cảng bị loại), trăng = sun 0,28 lạnh, sương 0,0028, CSM 120 m; thực vật khô: **cỏ tranh `grass_tall`** (gen-grass `--tall`: 1,45–2,1 m, vàng rơm, đè theo người) 9 000/ha dưới cao độ 0,93 (đỉnh phát quang), khộp 6/ha, tre 4/ha, dương xỉ; FX lửa/khói; C-130 thả pháo sáng bay cao.
2. **Props terrain** (`src/engine/terrain/props.ts`, schema `props[]`): model manifest (bao cát 05/02, thùng, hòm đạn, phuy, tủ máy) → InstancedMesh; **rào concertina procedural** (xoắn ống r 0,45 m bước 0,26 m + cọc, 6,4 m; đoạn cố định gộp 1 mesh, đoạn `_gap` riêng) — collider hộp theo bbox, obstacle nav (bake offline cùng bảng `PROP_HALF`), `remove(id)` ẩn + game gỡ collider. FSB: 3 lớp rào cung SW ±52° (r 100/88/76), hào bao cát r 58, hầm M60, hầm cối, hầm chỉ huy đỉnh, 2 vị trí 105 mm (thùng — chưa có model pháo), bãi trực thăng — 178 props.
3. **Interactables** (`MissionHost`): action `interactable {interactId, zone, holdMs, promptKey, fuseMs, prop, blastRadius, blastDamage}` → prompt HUD + thanh tiến trình (`promptProgress`), giữ F đủ → flag `<id>`; ngòi → `game.explode()` → flag `<id>_blown` + gỡ prop. **Nổ** (`WeaponFx.explosion`, `audio.explosion`, rung camera): người chơi trong bán kính mất máu (cúi ×0,25), bot trúng như đạn (shooter player).
4. **Pháo chuẩn bị** (flag `arty`): đạn 122 rơi quanh zone `top` mỗi 0,8–1,5 s, đất rung dù ở xa. **Pháo sáng** (`engine/render/flares`, flag `flares`): đèn treo dù rơi 2,4 m/s, đung đưa, 9 000 cd, tối đa 2–3 quả, bắn mỗi 9–14 s. **Tiếng xích** (flag `tanks`): âm trầm + rung 14 s (R3 thay PT-76 thật).
5. **Mission `m2-ban-dong-r1`** + thoại B01–B14 + locale: n_intro → n_approach (zone foot_31; briefing, pháo 30 s) → n_go (rào 1) → n_wire2 (spawn hầm M60 2, rào 2) → n_wire3 → n_mg (spawn hào 6) → n_trench (spawn đỉnh 5) → n_cp (zone cp, cpA, tắt pháo sáng) → n_tanks (cpB) → n_done. Địch = archetype recon (ERDL + M1 + M16A1).
6. Level mới đăng ký: `?level=diem-cao-31` (nút "Vào Điểm cao 31 (M2)"); M1 vẫn mặc định.

## Acceptance (đạt trong sandbox)
- E2E `level-diem-cao-31` (2 test): vật lý (đứng/lên dốc/không xuyên, navmesh 2 329 poly bake sẵn, 178 props = 178 collider, **rào chặn người chơi**, 3 đồng đội bám đất) + mission (pháo ≥ 6 đạn/12 s không sát thương ở xa; rào 1: giữ F → cờ → 3 s → nổ, **đứng mất ≥ 25 máu**, rào gỡ, **đi qua được**; rào 2 **cúi ≤ 10**; hầm M60 2 → hào 6 + đỉnh 5 → cpA → cpB → hoàn thành; cue B08–B14).
- Unit `mission-m2` (3): schema/tham chiếu/locale; graph FakeWorld hết C1–C2 với flag arty/flares/tanks đúng lúc; level 3 `_gap` duy nhất, model props trong danh sách nạp, cỏ tranh đè, HDRI đêm, concertina ≤ 2 000 tam giác.
- Ảnh sandbox `evidence/TIP-M2-R1/`: cỏ tranh + tre đêm; 3 lớp rào silhouette dưới pháo sáng; hào bao cát.

## Deviations / nợ
- Gọi B40 (Sáng diệt hầm M60) → R3; R1 hầm = 2 lính sau bao cát. PT-76 → R3 (âm + thoại). 105 mm chưa có model (thùng đạn thay). Quai cằm/mũ sắt địch ban đêm chưa chấm được trên sandbox (tối) — Chủ nhà chấm Mac.
- Pháo sáng không đổ bóng động (PointLight; CSM chỉ mặt trời) — "bóng quay" của kịch bản chờ ART02.
- Cỏ tranh mật độ 9 000/ha: bench Mac (D05 GO/ADJUST) trước khi tăng.

## Constraints giữ
TSL only; engine không import game; content không TS; seeded (rng fork `mission-host`); vật liệu mới không thêm texture (DV-023); asset lịch sử registry (DEM PD, HDRI CC0, cỏ procedural CC0).
