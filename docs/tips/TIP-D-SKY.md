# TIP-D-SKY: "Máy bay là thời tiết" — bầu trời ambient M1 (Chủ nhà 2026-09-06: "cần bổ sung khói lửa, máy bay… tiêm kích, trực thăng và lính dù")

## HEADER
- TIP-ID: TIP-D-SKY · Project: DVSG · Module: `src/engine/sky/{traffic,parachute,index}.ts` (mới), `src/engine/audio/audio.ts` (+`aircraft()`), `src/engine/terrain/level.ts` (+`airTraffic?`), `content/levels/truong-son-a.level.json` (+`airTraffic`), `content/schemas/terrain-level.schema.json`, `src/game/game.ts` (`sky`, gust → rừng, âm), `src/qa/debugApi.ts` (`skyStats/skyAdvance/skyDrop`), `tests/e2e/level-truong-son.spec.ts` (+test bầu trời), asset `public/assets/models/air_*.glb` (Chủ nhà tải Sketchfab CC-BY → `convert-model.mjs`)
- Dependencies: D04 terrain, D05 rừng (gió VEG-002), D09 âm (bus sfx) · Priority: P1 (bản sắc M1 theo Blueprint R2 — "máy bay là thời tiết") · Effort: 16 h Thợ (engine + test) + 4 h asset

## CONTEXT
- Blueprint R2/G1.5: máy bay là "thời tiết" của M1 — luôn có tiếng động cơ xa, tiêm kích lướt qua thung lũng, trực thăng theo tuyến; AC-130 đêm là G1.5. PRD AUD-003 (động cơ xa có hướng/khoảng cách, HRTF), VEG-002 (gió mạnh khi trực thăng), DV-009/010 (fact lịch sử → registry, không bịa).
- 1971 tuyến 20 Quyết Thắng (Quảng Bình): F-4 Phantom (USAF/USN), A-1 Skyraider (USAF/VNAF), OV-10 FAC, C-130, B-52 cao; trực thăng UH-1/CH-47 Mỹ–VNCH (Lam Sơn 719, 2–3/1971, Đường 9 – Nam Lào) và thám báo SOG đổ **bằng trực thăng**. **Không có nhảy dù ồ ạt xuống Trường Sơn 1971** → "lính dù" thể hiện bằng (a) đổ quân/treo trực thăng, (b) một dù phi công nhảy khỏi máy bay trúng đạn — chờ cố vấn ký registry `evt.1971.lam_son_719`.
- Mi-24 HT-MB không dùng (không có ở chiến trường 1971) — chỉ làm stand-in CI (`?skyModel=veh_mi24`).

## TASK
1. `SkyTraffic` (engine, không import game): lịch seeded (PRNG `hashString('sky', seed)`), mỗi `FlightDef` (model, kind heli/jet/prop, count 1–3 đội hình so le, agl [min,max] trên **max địa hình dọc đường** (không đâm núi), speed, period, first, radius, hover {at, seconds, agl}, parachute {count}, gust, spin regex, spinRate, bank, sound); đường thẳng qua điểm ngẫu nhiên trong ±300 m quanh tâm (hoặc điểm treo), dài 2R; treo: giảm tốc 250 m, treo, tăng tốc rời; rotor quay; mũi theo hướng bay (model +x → −z); gió xoáy trực thăng (< 150 m AGL, bán kính gust) → hook `onGust`; nguồn âm 3D theo hook `sound`.
2. Dù phi công procedural (`parachute.ts`): vòm lathe 24 múi gợn mép + 12 dây + người treo; rơi 4,5–5,7 m/s, trôi theo gió tầng cao, đung đưa; chạm đất → xẹp, biến mất sau 20 s. Thả ở giữa đường bay của lượt `parachute` khi cách người nghe ≥ 400 m; `dropParachute(x,y,z)` cho set piece.
3. Âm: `AudioEngine.aircraft('rotor'|'jet'|'prop')` — procedural (rotor: xung 10,8 Hz Huey 2 cánh 324 v/ph; jet: noise bandpass 900 Hz + rít 2,4 kHz; prop: răng cưa 85 Hz), panner HRTF inverse refDistance 40 / maxDistance 3000, **Doppler** theo vận tốc xuyên tâm (playbackRate/detune, kẹp ±25 %).
4. Level `airTraffic` (schema): F-4 cặp (180–320 m AGL, 190 m/s, 150–260 s), F-4 trúng đạn → 1 dù (350–520 m, 600–900 s), UH-1 cặp (70–120 m, 42 m/s, 120–240 s, gust 90), UH-1 treo đổ quân tại (−560, 240) 25 s ở 4 m (420–720 s), A-1 tuần tiễu (250–400 m), C-130 cao (650–950 m). Tham số `?sky=0|1`, `?skyModel=<id>`; debug `__ht.skyStats()`, `skyAdvance(s)`, `skyDrop(x,y,z)`.
5. Asset (Chủ nhà đăng nhập Sketchfab, Thợ tải + `convert-model.mjs --no-join` giữ node rotor): UH-1B TonyWony `08d48d13…` (13 k), F-4 andertan `1ea38a66…` (62,7 k → simplify ≤ 15 k) + ETAN798 `1f6c51fc…` (8,3 k, xa), A-1 Rhine_Lab `226b2272…` (58 k → simplify), C-130 Tyler_Dave `5acfb2eb…` (25,5 k); manifest `air_*` CC-BY attribution; KTX2; ngân sách validator `air_` 15 k.
6. Test: E2E `bầu trời` (stand-in): 6 lượt có lịch, sau 60 s có lượt bay và cao hơn địa hình > 30 m, treo đúng điểm/AGL 2–8 m, gust > 0,3 và gió rừng > 0,5 khi đứng dưới, ≥ 1 dù tới 330 s, không lỗi console.

## ACCEPTANCE CRITERIA
- Given Mac `?level=truong-son`, Then trong 5 phút đầu thấy ≥ 1 cặp tiêm kích lướt qua có tiếng, ≥ 1 cặp trực thăng theo tuyến có bóng lướt trên tán và gió lay cây khi bay gần; UH-1 treo ở bãi (−560, 240); một dù trắng rơi xa sau khi F-4 bay qua; không lỗi console.
- Given CI (`skyModel=veh_mi24`), Then E2E bầu trời xanh; unit/typecheck/build xanh.
- Given cố vấn, Then registry `evt.1971.lam_son_719` (tier P) + ghi chú "dù = phi công, không phải đổ bộ dù" được duyệt; asset air_* `approved` sau khi kiểm chủng loại/sơn (F-4 USAF/USN, UH-1B/D, A-1H/J).

## CONSTRAINTS
- Không đặt tay lượt bay (seeded); không Mi-24 trong level; không bịa sự kiện (lính dù ồ ạt) — chờ cố vấn; máy bay ≤ 15 k tam giác LOD0 (validator `air_`), bóng castShadow (CSM ≤ 180 m: chỉ trực thăng thấp có bóng trên tán).
- Nguồn âm ≤ 6 lượt đồng thời (voice budget 32); B-52/AC-130 (đêm) → G1.5; bắn hạ máy bay/AA → D08 set piece.
