# BLUEPRINT G0.6 — "Phố Vạn Hải, sáng sau bão" (màn showcase)

Bản chính thức nằm trong Project Claude (`hai-tuyen/BLUEPRINT-G06.md`); bản này là bản sao cho repo. Trạng thái: chờ Chủ nhà APPROVED (2026-09-03). ADR-007.

## Mục tiêu đo được
| # | Tiêu chí | Cách đo |
|---|---|---|
| W1 | Khung hình ban ngày, đô thị nhiều màu, khói lửa, xe/khí tài, lính cầm súng đúng tay | Chủ nhà chấm trên Mac (WebGPU) tại 3 điểm giao tranh; ảnh `evidence/G06/` |
| W2 | Địch "có IQ": bắn ≤ 0,8 s khi thấy, bắn khi di chuyển, cover thật, ép sườn theo tổ | `ai.test` + probe + chơi thử |
| W3 | 60 fps M1 Max 1920×1200, 1% low ≥ 45, p95 ≤ 18,5 ms trên track `pho-v1` | `npm run bench` (budget không đổi) |
| W4 | Mọi asset có license + credit; không IP CoD | `assets.test`, `CREDITS.md` |
| W5 | Toàn bộ có TIP / Completion Report / VERIFY | `docs/tips`, `evidence/` |

## Layout 160 × 120 m
Nam (spawn tổ Sơn Ưng) → [A] Đầu phố: chốt Kình Xám (bao cát, rào bê tông, xe bọc thép cháy; 3–4 địch) → phố chính 12 m nhà ống hai bên → [B] Chợ: sạp, bạt màu, sạp cháy + khói, 5–6 địch + xạ thủ ban công, hẻm phụ ép sườn, checkpoint → [C] Ngã tư: xe buýt cháy chắn đường, bán tải súng máy tiến vào theo spline, trực thăng bay qua → Bắc: trạm dẫn đường (mục tiêu).

## Hệ thống
Level JSON + builder (`content/levels/pho-van-hai.level.json`, `engine/level/builder.ts`) · Sun + CSM 3 cascade + HDRI ngày + haze · `engine/render/facade.ts` nhà ống procedural + biển hiệu canvas · `scripts/convert-model.mjs` + asset Sketchfab CC-BY/CC0, Poly Haven · khói/lửa/bụi TSL particles · spline + xe kịch bản (bán tải MG = Bot biến thể, trực thăng) · đồng đội `game/ai/ally.ts` (SQD-001) + barks · AI TIP-018 · calib TIP-017 · bench track `pho-v1`.

## TIP graph
TIP-017, TIP-018 → TIP-019 (level format + blockout + nắng/CSM/mặt đất) → TIP-020 (nhà ống/chợ), TIP-021 (asset xe/prop), TIP-022 (khói lửa bụi) → TIP-023 (set piece + encounter A/B/C), TIP-024 (đồng đội) → TIP-025 (kịch bản + thoại + checkpoint) → TIP-026 (perf + evidence + VERIFY + clip). Ước lượng 5–6 phiên.

## Rủi ro
CSM + 9 lính skinned có bóng + khói fill-rate → giới hạn 4 lính cast shadow, 6 cột khói, particle nửa độ phân giải; draw call ≤ 400 nhờ merge mặt tiền/instancing. Asset xe CC-BY có thể thiếu → fallback CC0/procedural + ADR. Sketchfab cần đăng nhập lại.
