# Completion Report — TIP-021 (Khí tài & phương tiện thật Sketchfab CC-BY)

STATUS: DONE

## FILES CHANGED
- Mới: `scripts/convert-model.mjs` (chuẩn hoá + nướng skin + merge-mats + join + material override + manifest), `docs/tips/TIP-021.md`, `contracts/TIP-021.yaml`, `public/assets/models/veh_{btr70,wreck_bus,wreck_car_a,wreck_car_b,pickup,ural,scooter,mi24}.glb`, `prop_sandbag_{02,05}.glb`, `evidence/TIP-021/*`.
- Sửa: `src/engine/level/types.ts` (BarricadeDef.model/size/scale/tint; PropDef.roll/pitch/tint), `barricades.ts` (model-backed: collider/cover từ size, `modelInstances`), `builder.ts` (`instanceModel()` chung, instanceColor), `src/engine/render/assets.ts` (`loadModel`), `src/qa/debugApi.ts` (`spawnModel`), `scripts/gen-level-pho.mjs` + `content/levels/pho-van-hai.level.json` (VEH table, 7+1 xe máy, bán tải, Ural), `content/assets/manifest.json` (+11, −1), `content/schemas/asset-manifest.schema.json` (`size`), `scripts/fetch-assets.mjs` (bỏ modular_electricity_poles), `CREDITS.md`, `README.md`, `package.json` (`assets:model`), `tests/unit/level.test.ts`, `docs/DECISIONS.md` (D-072..D-074).
- Xoá: `public/assets/models/modular_electricity_poles.glb` (6 MB, không dùng).

## TEST RESULTS
- Unit: 102/102 (level.test thêm kiểm model của barricade ∈ `models` + size; assets.test schema/sha256/payload 145,2 MB ≤ 150; weapons.test CREDITS chứa 12 attribution CC-BY).
- Typecheck + build: sạch.
- Render sandbox (WebGL2 swiftshader, medium 1280×720) `pho-21-*.png`: draw 652–741, tri 2,7–3,4 M (TIP-019: 620–683 / 2,4–3,1 M) — trong AC TIP-019 (≤ 700 ± ), mục tiêu 400 vẫn là nợ TIP-026.
- Lineup `lineup.jpg` (`__ht.spawnModel`): tỉ lệ đúng (BTR-70 7,1 m, Ural 7,6 m, bán tải 5,4 m, buýt 10,5 m, xe hơi 4,3 m, Vespa 1,75 m, Mi-24 17 m).
- E2E không chạy lại (E2E dùng `?level=arena`, builder không chạm; sẽ chạy trong TIP-026 VERIFY).

## ISSUES
- (Low) Draw +30–60 so với TIP-019 do model xe đổ bóng 2 cascade; bán tải 8 primitive (8 material). Nợ TIP-026 (atlas/gộp material).
- (Low) Bao cát Pypunk không có texture màu (metal 1 → trắng gương) → override `--basecolor 9a8862 --rough 0.95 --metal 0` lúc convert.
- (Info) Sketchfab "1K glb" của "Abandoned Wrecked Bus" có skin tầm thường → ba lần đầu trôi 1,5 m + bbox sai; đã nướng skin trong converter (D-073).

## DEVIATIONS
- **Đổi model**: BTR-80 (42manako) và helicopter mi-8 (tnikita) đã tải nhưng **loại** vì rip từ game (Squad / CoD BO2) — PRD §9.2. Thay BTR-70 (veightyfive) + Mi-24 Hind (Duane's Mind). Hai file rip chỉ nằm trong `~/Downloads` của Chủ nhà (`btr-80.glb`, `helicopter_mi-8.glb`) — nên xoá tay.
- Mi-24 chỉ mới convert + manifest (node rotor giữ pivot), chưa bay — TIP-023.
- Bỏ `modular_electricity_poles` khỏi manifest/fetch để giữ payload ≤ 150 MB (không sửa budget).

## SUGGESTIONS
- TIP-023: technical = `veh_pickup` + MG procedural trên spline ở lane đông; Mi-24 bay ngang 2 lần (mở màn + trước trạm), rotor quay từ node `Top_Rotor_*`/`Tail_Rotor_*`.
- TIP-026: gộp material bán tải (8 → 2), instanced shadow chỉ cascade gần cho xe máy, đo bench `pho-v1`.
- Có thể thêm 1–2 xe hơi nguyên vẹn (CC-BY, kiểm rip) đỗ vỉa hè để phố "sống" hơn; hiện chỉ xe cháy + bán tải + Ural + Vespa.

## HOTFIX (TIP-021b, sau khi Chủ nhà chơi e203f1e trên Mac)
- Lỗi: chỉ thấy trời mây — builder level thiếu collider mặt đất (`floor`) → người chơi rơi xuyên đất từ giây đầu. Lỗi có từ TIP-019, không lộ vì probe sandbox 2 frame + bot navmesh + E2E `level=arena`.
- Sửa: `builder.ts` thêm collider `floor` (fill size) + collider vỉa hè 15 cm (autostep 0,35 bước qua; hình khớp collider).
- Kiểm: `probe-ground.txt` (đứng 3 s feet y 0,016 grounded; sprint 6 s tới z 41 trước bao cát; sang trái lên vỉa hè y 0,169) và E2E mới `tests/e2e/level-pho.spec.ts` (`e2e-level-pho.txt`: 1 passed) — chạy trong `npm run ci`.
