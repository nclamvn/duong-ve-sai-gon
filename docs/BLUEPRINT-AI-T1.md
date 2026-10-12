# BLUEPRINT AI-T1: bộ não chiến thuật cho địch và tổ ta

*Chủ thầu, 2026-10-11. Nguồn: phản hồi chơi thử của Chủ nhà ("địch và quân ta ngu quá, chạy hỗn loạn, không né đạn, không chiến thuật, ít quân, 3 phút thay vì 30 phút, chỉ đạt B"). Chủ nhà chốt: **AI trước, M1 sau**; cảm giác **điện ảnh** (kiểu chiến dịch CoD: ta lì đòn hơn, địch đông và dễ đọc, nhịp nhanh); tổ ta **4–5 người, có lệnh cơ bản**. Quyết định ghi ở DV-071.*

## 1. Chẩn đoán (đo trên mã hiện tại)

| Triệu chứng Chủ nhà thấy | Nguyên nhân trong mã |
|---|---|
| "chạy hỗn loạn" | SEEK_COVER và FLANK **vừa chạy vừa bắn**; dịch ngang ngẫu nhiên mỗi 2,5 s khi ENGAGE; không có khái niệm "lao ngắn rồi nằm xuống" |
| "không né đạn" | đạn sượt chỉ bật cờ `suppressedMs` 1,5 s; không có thanh áp chế; không cúi; capsule luôn đứng |
| "không chiến thuật" | cả level chỉ có **10 điểm nấp đặt tay** (truong-son-a); tổ chỉ cử 1 người ép sườn; không ai yểm trợ ai |
| "quân ta ngu" | đồng đội chỉ đi theo + đứng bắn; không lệnh; không báo hướng địch |
| "bắn vu vơ cũng thắng" | 6 địch, 8 dmg/viên, không ai thật sự đe doạ; không có vé tấn công nên lúc địch bắn trúng, lúc không ai bắn |

## 2. Mục tiêu đo được (AC tổng của T1)

Đo bằng **bộ đo tự động** (T1.6, sim headless, 10 seed) trên arena thử có cây và hố:

| Chỉ số | Ngưỡng |
|---|---|
| Phát bắn khi đang lao (tốc độ > 2,5 m/s, ngoài 8 m) | **0** |
| Tỉ lệ thời gian trong chỗ nấp khi đang bị áp chế | ≥ 70 % |
| Thời gian lộ liên tục dài nhất khi lao | ≤ 4 s |
| Tổ ≥ 3 người khi giao chiến: có lao xen kẽ (một người chạy, người khác bắn yểm trợ) | ≥ 1 lần / 30 s |
| Ép sườn tới góc ≥ 50° so với tổ yểm trợ | ≥ 60 % số lệnh |
| Người chơi bị ≤ 2 địch bắn "thật" cùng lúc (vé tấn công) | 100 % |
| Tổ lùi khi mất ≥ 50 % quân | có |
| Đồng đội báo hướng địch (hướng đồng hồ) trong 2 s từ lúc phát hiện | có |
| Tất định: cùng seed → cùng snapshot | có |

Phần nhìn (cúi, ló, nằm sau gốc cây) Chủ nhà duyệt trên Mac.

## 3. Kiến trúc (thuần TS, không three/DOM trong `src/game/ai/**`)

```
CoverField (T1.1)            điểm ứng viên: cây (collider trụ) + hố bom (vành trong) + marker tay + vòng mẫu địa hình
    │  query(x,z,r) → ứng viên; probe(point, threat) → 'full' | 'low' | 'none' bằng 2 tia (1,0 m và 1,6 m)
    ▼
Tactics (T1.2)               chấm điểm vị trí theo VAI: support | assault | flank | fallback | hold | escort
    │  che chắn, bắn được (ló), quãng chạy lộ, dải tầm theo vai, giãn cách ≥ 4 m, giữ chỗ (reservation)
    ▼
Bot (T1.3)                   FSM chiến đấu mới: ENGAGE (tại chỗ) · SEEK_COVER (lao, KHÔNG bắn) · PEEK_FIRE (nấp/ló)
    │                        · SUPPRESSED (bị ghim) · FLANK (lao theo lệnh) · RETREAT
    │  thanh áp chế 0..1, tư thế stand/crouch (capsule hạ 0,5 m), nạp đạn chỉ khi nấp
    ▼
FireTeam (T1.4)              thay SquadCoordinator: chia yểm trợ / cơ động, lao xen kẽ, ép sườn phối hợp, lùi khi mất quân
AttackTokens (T1.4)          tối đa 2 địch bắn "thật" vào người chơi; còn lại bắn áp chế (tản lớn); loạt đầu cảnh cáo
Squadmates v2 (T1.5)         tổ ta 4–5: dùng chung Tactics với vai 'escort' quanh người chơi; lệnh; báo hướng
AiMetrics (T1.6)             bộ đếm sự kiện + sim arena → ngưỡng ở §2
```

### 3.1 CoverField (T1.1)

- **Nguồn ứng viên**: (a) collider trụ của cây bán kính ≥ 0,2 m: 4–8 điểm quanh thân cách mép 0,55 m, mang `blocker` = tâm thân; (b) hố bom từ `terrainFeatures.craters`: 8 điểm ở 0,6 r (nấp thấp, phải cúi); (c) `coverMarkers` của level (giữ); (d) **vòng mẫu động** quanh bot (8 hướng × 2 bán kính) để bắt nếp đất, gò, bờ khe mà không cần đánh dấu.
- **Kiểm che bằng tia** (không tin hình học): tia ngực-cúi (1,0 m) và tia mắt-đứng (1,6 m) tới mắt mối đe doạ. Chặn cả hai = `full` (nấp đứng, ló ngang); chặn 1,0 m nhưng không chặn 1,6 m = `low` (cúi nấp, đứng lên để bắn); không chặn = `none`.
- **Lọc hình học trước tia** (rẻ): điểm cây chỉ che khi hướng tới mối đe doạ nằm trong nón bề rộng thân cây nhìn từ điểm đó.
- Lưới băm 8 m; dựng một lần khi load level (≤ 30 ms cho ~5 000 cây, có đo).

### 3.2 Tactics (T1.2)

`score = che chắn + bắn được + vai − quãng lộ − chen chúc − giữ chỗ`. Vai:

| Vai | Ý đồ | Dải tầm tới mối đe doạ |
|---|---|---|
| `support` | giữ chỗ có tầm nhìn, bắn áp chế | 18–45 m, ưu tiên `low`/`full` có ló được |
| `assault` | tiến gần hơn mỗi bước ≥ 4 m | 8–25 m |
| `flank` | góc quanh mục tiêu ≥ 50° so với nhóm yểm trợ | 10–30 m |
| `fallback` | xa hơn hiện tại ≥ 8 m, gần điểm neo | 25–60 m |
| `hold` | trong bán kính điểm neo | tuỳ |
| `escort` | (tổ ta) trong 4–15 m quanh người chơi, không chắn hướng bắn của người chơi | tuỳ |

Một bước lao tối đa 14 m (≈ 3–4 s). Quãng lộ = số mẫu trên đường thẳng có tầm nhìn tới mối đe doạ.

### 3.3 Hành vi Bot (T1.3)

- **Bắn trước, lao sau, không bao giờ bắn khi lao** (trừ cự ly < 8 m).
- Chạm địch: phản xạ 0,25–0,45 s → nếu đang trống trải và có chỗ nấp ≤ 10 m thì lao tới đó; không có thì cúi xuống bắn tại chỗ.
- **Thanh áp chế** 0..1: đạn sượt (cách đầu ≤ 2,5 m, càng gần càng nặng), trúng đạn, đạn chạm đất cạnh người. Giảm 0,3/s sau 1 s yên. ≥ 0,35 → ló ngắn, bắn kém; ≥ 0,7 → **bị ghim**: không ló, cúi sát; nếu chỗ đứng không che được thì lao sang chỗ `full` gần nhất.
- **Chu kỳ nấp/ló** theo loại chỗ nấp: `low` → cúi nấp, đứng lên bắn; `full` → bước ngang 0,7–1,6 m ra mép thân cây. Nấp 1,0–2,2 s, ló 1,4–2,4 s.
- **Nạp đạn chỉ khi đang nấp** (băng còn < 30 % và đang nấp thì nạp chủ động).
- **Chỗ nấp bị lộ** (mối đe doạ đổi hướng, probe trả `none`, hoặc trúng đạn khi đang nấp) → đánh giá lại theo vai.
- **Tư thế cúi**: capsule hạ 0,5 m (đầu và thân thấp theo), mắt 1,1 m; visual dùng `crouch_idle`/`crouch_walk_*` đã có.
- **Nằm**: chưa có clip prone trong bộ Mixamo hiện tại → T1 dùng cúi thấp; prone làm khi Chủ nhà tải thêm clip (ghi ở mục 6).

### 3.4 FireTeam + vé tấn công (T1.4)

- Nhóm ≥ 3 khi chạm địch: ~ 1/2 làm **yểm trợ**, còn lại **cơ động**. Mỗi nhóm chỉ **1 người lao một lúc** khi có người khác đang bắn yểm trợ (lao xen kẽ). Người cơ động tiến bằng vai `assault`, sau 2 bước thì một người nhận `flank`.
- Mất ≥ 50 % quân → cả nhóm `fallback` từng người một, rồi giữ.
- **Vé tấn công** (điện ảnh): mỗi 1,5 s chia tối đa 2 vé cho địch đang thấy người chơi rõ nhất và gần nhất; địch không có vé bắn vào người chơi với tản ×3 (đạn sượt, bụi đất, đạn vạch: người chơi thấy áp lực nhưng không chết oan). Loạt đầu tiên của mỗi tay súng vào người chơi luôn trượt có chủ đích (cảnh cáo, báo vị trí).
- Người chơi: máu 100 → **150 hiệu dụng** cho cảm giác điện ảnh (giảm sát thương nhận 1/3), hồi máu sau 5 s không trúng đạn tới 60 %.

### 3.5 Tổ ta (T1.5)

- 5 người: Quyết (tổ trưởng), Long, Đạt, Hoàn, Khang (Chủ nhà đặt tên 2026-10-11; nhân vật chính là Lâm).
- Ngoài chiến đấu: đội hình rắn hàng một trên đường mòn, giãn cách 4–6 m. Trong chiến đấu: vai `escort` quanh người chơi, mỗi người một chỗ nấp, không đứng chắn đường đạn của người chơi.
- **Lệnh** (phím, có thể đổi): `1` theo tôi · `2` giữ vị trí · `3` bắn yểm trợ chỗ tôi nhắm · `4` tiến tới chỗ tôi nhắm. HUD hiện lệnh hiện tại.
- **Báo hướng địch**: "Địch, hướng 2 giờ, 40 mét!" theo hướng nhìn người chơi; phụ đề + cue thoại sẵn có, chống spam.

## 4. TIP graph

| TIP | Việc | Phụ thuộc |
|---|---|---|
| T1.1 | CoverField + test | |
| T1.2 | Tactics + test | T1.1 |
| T1.3 | Bot combat rewrite + cúi/capsule + test cũ cập nhật | T1.2 |
| T1.4 | FireTeam + AttackTokens + máu điện ảnh | T1.3 |
| T1.5 | Tổ ta 4–5 + lệnh + báo hướng + HUD | T1.3 |
| T1.6 | AiMetrics + sim arena + ngưỡng §2 + E2E | T1.4, T1.5 |

Sau T1: **Phase 2** mở rộng M1 lên ~30 phút (hành quân 8–10 phút, B-52, săn trinh sát 3 trận tăng dần, chặn bãi đáp; 25–30 địch; checkpoint).

## 5. Ràng buộc

Không `Math.random` ngoài `engine/core` (dùng `prng.fork`); không chuỗi tiếng Việt trong `src/**/*.ts` (dùng i18n); hiệu năng: AI ≤ 1,5 ms/khung với 30 bot (LOD giữ nguyên, tia kiểm che có ngân sách mỗi tick).

## 6. Rủi ro và việc còn mở

- Clip nằm/bò (prone): cần Chủ nhà tải từ Mixamo (Prone Idle, Prone Forward, Stand To Prone, Prone To Stand) khi muốn có.
- Thoại báo hướng: T1 dùng phụ đề + tiếng hô chung; thu âm riêng làm sau.
- Cảm giác cuối cùng (độ lì, tốc độ, số địch) chỉnh qua `content/tuning/ai.json` sau buổi chơi thử của Chủ nhà.
