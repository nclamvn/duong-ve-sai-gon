## COMPLETION REPORT — TIP-010: Visual refine sau G0 bench (soldier, mưa, viewmodel, FX, telemetry)

**STATUS:** DONE

**FILES CHANGED:**
- Rewritten: `src/game/actors/dummy.ts` — hình nhân lính procedural: 12 bone (hips/spine/head/armL/foreL/armR/foreR/rifle/thighL/shinL/thighR/shinR), **1 SkinnedMesh/actor** (30 primitive gộp bằng `mergeGeometries`, vertex color + attribute `emissive` cho visor phát sáng → `MeshStandardNodeMaterial.emissiveNode = attribute('emissive')`), helmet + vành + visor, giáp ngực, ba lô, đệm gối, bao tay, súng trường (thân/nòng/băng/báng/ống ngắm) trong bone `rifle`. Animation code: idle thở + nhìn quanh, đi (đùi/cẳng/tay/hips bob theo `motion.speed`), nâng súng khi `motion.aiming`, hit-flash 80 ms qua `material.color`, chết → ngã 0.35 s. Class vẫn tên `Dummy`, API cũ + `DUMMY_HIT_ZONES` **không đổi**.
- Modified: `src/game/actors/botActor.ts` — `syncVisual` lọc tốc độ hiển thị từ delta vị trí, `aiming = state === PEEK_FIRE`; bot màu nâu đỏ / visor cam, dummy xám xanh / visor cyan để phân biệt phe.
- Modified: `src/engine/render/rain.ts` — vạch 0.005 × 0.4 m, opacity 0.16, `opacityNode = smoothstep(0.4, 2.5, −positionView.z) × fade xa 30–60 m`; vị trí vẫn GPU-only (0 `needsUpdate` CPU).
- Created: `src/game/weapons/viewmodel.ts` — AR góc nhìn thứ nhất procedural gắn camera (receiver, rail, ốp lót, nòng, giảm giật, băng, tay cầm, báng, đầu ruồi/thước ngắm, tay kéo, 2 bao tay), scale 0.62; hip ↔ ADS lerp (`weapon.ads`), sway chuột có lag, bob theo `CameraRig.bobOffset` × tốc độ, kick khi bắn, dip khi reload, `muzzleWorld` cho FX. ADS: đầu ruồi trùng tâm màn hình (ảnh `ads-view-webgl.png`).
- Rewritten: `src/game/weapons/fx.ts` — pool cố định: tracer 24 (0.006 m, vệt 5 m bay 320 m/s, additive), spark 96 (nón quanh hướng bắn, 6–15 m/s, gravity, drag, 0.12–0.22 s), muzzle flash 6 (ngôi sao 3 tia + lõi + cánh dọc nòng, 35 ms, xoay ngẫu nhiên), casing 64 (7 × 7 × 20 mm, văng từ receiver), decal 256 (giữ), **PointLight nòng luôn trong scene** (intensity 0 khi nghỉ, 70 → 0 trong 50 ms). Player: flash + 8 spark + tracer + light + casing tại `muzzleWorld`; bot: flash 0.7 + 5 spark + tracer tại nòng, không light.
- Modified: `src/game/game.ts` — tạo `WeaponViewModel`, camera vào scene, `lastInputDx/Dy` cho sway, viewModel ẩn khi free-fly/chết, `Telemetry(16384)`.
- Modified: `src/qa/telemetry.ts` — **bug fix**: `totalMs` chỉ tính mẫu còn trong ring (trừ mẫu bị ghi đè); thêm `wallMs` → `duration_s` thật; capacity mặc định 16384.
- Modified: `tests/unit/telemetry.test.ts` (+1 test overflow), `tests/e2e/boot.spec.ts` (bones 3 → 12, viewmodel gắn camera, bone-motion đo `spine.rotation.x`, chụp ảnh qua rAF), `tests/e2e/helpers.ts` (+`renderFramesRaf`).
- Created: `docs/tips/TIP-010.md`, `contracts/TIP-010.yaml`, `evidence/TIP-010/{fps-view,ads-view,soldier-lineup}-webgl.png`, `evidence/G0/*` (report M1 Max copy từ Mac).

**TEST RESULTS:** 7/7 AC pass (sandbox WebGL2/SwiftShader; số hiệu năng trên Mac chờ Chủ nhà chạy lại `npm run bench:quick`)
- AC1 Soldier: `skeleton.bones.length === 12` ×8 (E2E boot), 1 SkinnedMesh/actor, visor trong cùng geometry; `DUMMY_HIT_ZONES` không đổi; 75 unit + 6 E2E pass, không sửa ngưỡng nào ngoài bones: PASS
- AC2 Bot đi: `thighL/thighR = ∓0.29…∓0.51` khi speed 3 m/s, ≈ 0 khi đứng; chết → `group.rotation.x → −π/2` trong 0.35 s (probe lineup + code): PASS
- AC3 Rain: plane 0.005, opacity 0.16, hạt < 0.4 m opacity 0 (TSL); `needsUpdate` CPU = 0 (chỉ uniform time): PASS
- AC4 Viewmodel: `viewModel.root.parent === camera` (E2E); ADS đầu ruồi ở tâm (ảnh); kick/dip qua `onShot/onReload`; `muzzleWorld` thay đổi theo camera (probe: (11.63, 1.48, 7.35) khi đứng tại dummy_0 + 4.5 m): PASS
- AC5 Bắn hết đạn 150 phát (30 + 120 dự trữ, 4 lần reload) trong 1 200 tick: `fx.stats.created` = 189 trước = 189 sau, `decalWraps 0`, casing pool 64 quay vòng; muzzle light decay 50 ms → 0 (probe `pool.mjs`, 0 lỗi console): PASS
- AC6 Telemetry capacity 16 / 40 mẫu 10 ms → `fps_avg = 100`, `frames = 16`, `duration_s = 0.4` (unit): PASS
- AC7 `npm run ci` exit 0 (typecheck + 75 unit + build + 6 E2E webgl-ci, 1.1 min). Ảnh WebGL2: súng góc thấp phải, hình nhân lính (helmet/visor/giáp/ba lô/súng), mưa mảnh: PASS

**ISSUES DISCOVERED:**
- [High→fixed] `Telemetry.fps_avg` sai khi số frame > capacity ring: `totalMs` cộng dồn mọi frame nhưng chia cho `count` (bị kẹp ở capacity) → report M1 Max ghi `fps_avg 91` trong khi `1% low 106.8` và `p95 9.1 ms` (≈ 110–120 FPS thật). Số G0 khác (p95, 1% low, GPU, draw, heap) **không bị ảnh hưởng** vì tính từ mẫu trong ring. Fix + unit test + capacity 16384 (đủ 90 s × 120 Hz = 10 800).
- [Medium, QA-only] three r185 (`three/webgpu`) cập nhật skeleton **1 lần mỗi `frameId`** — `frameId` chỉ tăng trong rAF nội bộ của renderer, không tăng theo `renderer.render()`. Gọi `game.frame()` nhiều lần trong 1 task JS (kiểu `renderFrames` của E2E) → bone matrices cũ trong khi `bindMatrixInverse` mới → hình nhân méo trong ảnh chụp (đã thấy ở ảnh probe đầu). Trong game thật (1 frame/rAF) không xảy ra. Thêm `renderFramesRaf` cho screenshot; probe TIP-010 chụp qua rAF.
- [Low] `heap_start = heap_end = 33.53 MB` trong report M1 Max: Chrome lượng tử hoá/giới hạn tần suất cập nhật `performance.memory` → trend heap 90 s không đủ nhạy. G1: chạy Chrome với `--enable-precise-memory-info` cho soak 10 phút.
- [Low] Khi hình nhân quay mặt về camera, súng bị rút ngắn phối cảnh nên khó thấy → đổi màu thép súng 0x33383e (sáng hơn giáp) — vẫn là greybox procedural.

**DEVIATIONS FROM SPEC:**
- TIP ghi tracer "6 m / 350 m/s" → dùng 5 m / 320 m/s (cùng bậc, nhìn đỡ "vệt laser" ở tầm 10–20 m). L1.
- Muzzle flash: 3 tia + lõi + 1 cánh dọc nòng thay vì "3 plane chéo" — nhìn từ góc thứ nhất cần cả mặt phẳng vuông góc và song song nòng. L1.
- Casing thêm vào FX (không trong TASK) vì pool đã có sẵn từ TIP-006, chỉ đổi kích thước/điểm văng.

**SUGGESTIONS FOR CHỦ THẦU:**
- Chủ nhà chạy `npm run bench:quick` (1 run 30 s) rồi `npm run bench` để xác nhận PASS sau soldier/viewmodel/spark; kỳ vọng draw ≈ 165 (8 soldier + bot vẫn 1 draw/actor), tris tăng ~40k (soldier ≈ 4.8k tri/actor), GPU vẫn < 4 ms.
- Game feel súng (kick/sway/bob) và "ấn tượng thị giác" của hình nhân là việc **người thật** đánh giá (PRD §9.2) — mời Chủ nhà chơi 2 phút, ghi lại 3 điều muốn chỉnh.
