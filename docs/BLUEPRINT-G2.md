# BLUEPRINT G2 — M2 "Bản Đông" (Đường 9 – Nam Lào, 2–3/1971)

*Chủ thầu, 2026-09-06. Chủ nhà duyệt kịch bản `docs/story/KICH-BAN-M2-v0.1.md` bằng lệnh "triển khai luôn" (DV-047: năm câu hỏi §9 lấy mặc định của Chủ thầu). Blueprint này ngắn vì thiết kế đã nằm trong kịch bản; nó chỉ chốt **kiến trúc thêm, thứ tự vòng, TIP graph, rủi ro và AC**. G2 chạy xen với phần còn lại của G1-A (D11b tay, ART02 đồ hoạ) — Chủ nhà ưu tiên M2.*

## 1. Mục tiêu

Ba vòng, mỗi vòng chơi được trên Mac và có E2E: **R1** đêm công đồn Điểm cao 31 (C1–C2); **R2** bình minh — DShK bắn trực thăng, một chiếc rơi, băng cho phi công (C3); **R3** xe tăng/xe địch + Đường 9 + Bản Đông + bếp Hoàng Cầm, Út gia nhập (C4–C6). Sau R3: M2 là lát cắt hoàn chỉnh 39′; M1 hoàn chỉnh (đêm AC-130, Thu) làm sau vì dùng lại đêm + súng máy cố định của R1/R2.

## 2. Kiến trúc thêm (engine/game — không đổi kiến trúc G1)

| Phần | Việc | Ghi chú |
|---|---|---|
| Terrain level | **`props[]`**: model manifest hoặc procedural (`wire`, `sandbag_ring`), vị trí x/z + yaw + scale, chạm đất, collider box/cylinder, obstacle navmesh (lăng trụ 4 cạnh), `id` để mission gỡ (rào bị phá) | terrain level hiện chưa có prop nào |
| Trời đêm | Preset `sky` đêm cho terrain level: HDRI `blue_lagoon_night` (có), mặt trăng = sun yếu lạnh, sương dày, CSM ngắn; pháo sáng = FX `flare` (dù + ánh sáng đung đưa) | dùng lại cho M1 đêm |
| Thực vật khô | Species `co_tranh` (cỏ 2 m, đè theo người `press`), khộp = tree_gn thưa, bụi cháy | gen-grass tham số cao/rộng |
| Tương tác | **`Interactables`** (game): điểm + bán kính + giữ F `holdMs` + prompt; sự kiện `INTERACT_DONE`; mission action `interactable`, condition `interact_done` | dùng cho bộc phá, gắn súng, băng bó, ngồi |
| Bộc phá | action `charge {id, prop, fuseMs}` → nổ FX + âm; gỡ prop + collider + nav; sát thương người đứng trong 6 m | R1 |
| Súng máy cố định | `MountedGun` (DShK): người chơi khoá tại bệ, cung ngắm giới hạn, nòng nóng, băng 50, đạn hitscan/tracer tới `sky` flight → sát thương → `heli_down` | R2; dùng lại M1 đêm (12,7 bờ ngầm) |
| Trực thăng rơi | `engine/sky`: flight nhận `damage`, trạng thái `crash` (khói, xoay, rơi tới điểm định trước), xác model | R2 |
| Tù binh | interactable `bandage` 4 s + cutscene camera mắt (DV-005) | R2 |
| Xe | Xe tăng/xe địch theo spline (WIP TIP-023 `hai-tuyen/tip-023-wip`, DV-011) + collider động + vùng tùng thiết; xác xe tĩnh = props | R3 |
| Gọi B40 | Đồng đội bắn theo chỉ mục tiêu (bot state `FIRE_AT` 6 s LOS) | R3 (R1 tạm: hầm M60 = 2 bot sau bao cát) |

Luật giữ nguyên: TSL only; engine không import game; content không TS; Math.random cấm; mọi vật liệu ≤ 16 texture (DV-023); asset lịch sử `registryId` + `approved=false` tới khi cố vấn duyệt; không sự kiện bịa, người thật không thoại (DV-010).

## 3. Task graph

```
R1: TIP-M2-L1 terrain diem-cao-31 + trời đêm + cỏ tranh
    TIP-M2-P1 props terrain + rào/bao cát + FSB layout          ← L1
    TIP-M2-I1 Interactables + bộc phá                             ← P1
    TIP-M2-M1 mission C1–C2 + thoại B01–B14 + E2E                 ← I1
R2: TIP-M2-G1 MountedGun DShK + sky damage/crash + bandage; mission C3 + B15–B20   ← M1
R3: TIP-M2-A1 asset xe (PT-76, M41, M113, M35, jeep, Cobra, UH-1H, M60) qua pane + kiểm nguồn
    TIP-M2-V1 xe spline + tùng thiết                               ← A1
    TIP-M2-L2 terrain duong-9 (Bản Đông 16,635 N 106,428 E) + bếp/binh trạm
    TIP-M2-M2 mission C4–C6 + B21–B42 + Út/Thu + thư 2 + E2E       ← V1, L2
```

Vị trí thật: Điểm cao 31 = 16°42′54″N 106°25′34″E; Bản Đông = 16°38′06″N 106°25′41″E (Wikipedia, S) — hai ô 2 048 m riêng (cách nhau 9 km).

## 4. Rủi ro (theo thứ tự) và cách đỡ

1. **Xe theo spline + collider động** (R3) — WIP HT-MB chưa render/E2E; nếu không kịp: PT-76 tĩnh + tiếng xích, tùng thiết bỏ.
2. **Bắn rơi trực thăng** (R2) — sky flight hiện không nhận sát thương; làm `damage` + `crash` đơn giản (đường rơi parabol tới điểm định trước).
3. **Đêm** — sandbox WebGL2/SwiftShader tối, khó chấm; Chủ nhà chấm trên Mac; E2E kiểm số liệu (ánh sáng, sương), không ảnh.
4. **Perf**: cỏ tranh 2 m mật độ cao + props FSB + đêm CSM — giữ ngân sách D05 (rừng ≤ 12 ms GPU Mac), tam giác ≤ 2,5 M mục tiêu.
5. **Asset xe** cần tài khoản Sketchfab của Chủ nhà (pane) — R3 làm khi Chủ nhà có mặt.

## 5. Acceptance (R1)

- `?level=diem-cao-31&autostart=1`: đêm, sương, đỉnh 543 với FSB (rào 3 lớp, hào bao cát, hầm), tiểu đội 3 người theo; pháo chuẩn bị rồi "Đi".
- Bộc phá: giữ F ở rào → 3 s → nổ; đứng trong 6 m mất ≥ 30 HP; rào mở (đi qua được, bot đi qua được).
- Hầm M60 (2 bot sau bao cát) + hào (6 × 2 đợt) + đỉnh (5) — ERDL/M1/M16A1; cpA hầm chỉ huy, cpB đỉnh sạch; cue B01–B14 đúng thứ tự.
- E2E: vật lý level mới (đứng/dốc/không leo dốc đứng, navmesh, bot bám đất — DV-009) + mission chạy hết C1–C2 trong ≤ 3′ sim; unit graph FakeWorld; CI xanh.
- Không hồi quy M1 (E2E 13 cũ).
