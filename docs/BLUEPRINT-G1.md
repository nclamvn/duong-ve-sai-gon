# BLUEPRINT G0′ + G1 — "Cổng Trời" 15 phút

*Chủ thầu (Claude) · 05/09/2026 · dựa trên PRD v0.2 (§19–24, mục 8 sửa) + Kịch bản v0.1 + engine HT-MB e203f1e/8745ba3. Trạng thái: CHỜ APPROVED của Chủ nhà. Blueprint là khế ước: sau approve, đổi kiến trúc thì quay lại Vision.*

---

## 1. Phán quyết của Chủ thầu về PRD v0.2

Bản v0.2 làm đúng việc một bản đánh giá phải làm: kéo dự án về **một lát cắt 15 phút phải hay** trước khi nói tới tám nhiệm vụ, và đưa UI/tiếp cận/điện ảnh vào G1 thay vì để G5. Tôi nhận toàn bộ DD-201…DD-208, luật PLY-008 sửa, mục tiêu p95 ≤ 16,67 ms ở G1, và tám gói backlog §23.2. Có sáu chỗ cần chốt lại vì người đánh giá không có Kịch bản v0.1 và repo trong tay:

| # | Điểm v0.2 | Phán quyết | Lý do |
|---|---|---|---|
| R1 | "Chưa có kịch bản; không gán quan hệ Thu/Hải/Quyết; DD-208 cần giải thích Quảng Trị → Hà Nội → 1973" | **Đã có.** Kịch bản v0.1 định nghĩa đủ: Thành bị thương nhẹ sau Thành cổ → an dưỡng Bắc → trao nhật ký Hải cho mẹ ở Khâm Thiên (M4); 1973 là cảnh cắt trao trả tù binh. "Đồng đội" trong CINE-00 = **anh Quyết**; câu "Theo tôi xuống ngầm" là của Quyết | Không sửa kịch bản; casting theo nhân vật đã có |
| R2 | Lát cắt G1 ban ngày, chưa có đêm/AC-130/thám báo (DD-201) | **Nhận, có điều kiện.** G1 = 15 phút ngày đúng §20.2; **G1.5 "M1 hoàn chỉnh"** (đêm, AC-130, B-52 rung đất, săn thám báo, Thu ở binh trạm) là gate riêng trước G2 — vì "máy bay là thời tiết" là bản sắc, không được rơi khỏi lộ trình | Chủ nhà đặt hàng cảnh 1 là rừng + khí tài; hai demo cho thấy "wow" cần set piece |
| R3 | Phim mở đầu dựng ngoại tuyến bằng Blender, xuất MP4 (§21.1, §22.1) | **Đề xuất đảo ưu tiên:** cutscene **trong engine** là chính (camera track JSON, cùng asset/ánh sáng/hậu kỳ gameplay), và một công cụ **ghi cutscene thành MP4 1080p24** bằng Chrome trên Mac + ffmpeg cho hai chỗ cần phát khi đang tải (CINE-00, briefing). Blender chỉ là phương án dự phòng nếu animatic 20–30 s trong engine không đạt ở TIP-D11 | Không có nghệ sĩ Blender; AI dựng camera track/timeline tốt hơn dựng phim ngoại tuyến; giữ một nguồn asset; kích thước media nhỏ hơn 330–550 MB |
| R4 | p95 ≤ 16,67 ms là mục tiêu G1; budget JSON hiện 18,5 | **Nhận.** `config/performance-budget.json` thêm `frame_p95.target_g1 = 16.67` bằng ADR; ngưỡng đỏ giữ; không sửa để "đạt" | Luật D-054 |
| R5 | "Chưa có registry, chưa có repo/bench" | Đúng ở thời điểm đánh giá. G0′ có sẵn việc này (PRD §18): registry skeleton + lượt cào 1971, fork repo, bench arena cũ | — |
| R6 | Phụ đề/caption "[Động cơ phía trên, bên trái]" | **Nhận và nối với cơ chế "tai"** của M1: caption chỉ nói cái người chơi đã nghe được (cùng ngưỡng với audio), không tiết lộ thêm | Tránh caption thành wallhack |

Ngoài ra, một quyết định tôi đề xuất thêm để G1 không thành "demo súng đẹp": **khẩu mẫu là AK-47/Type 56 báng gỗ 1971** (không dùng AK-74M của HT-MB), vì tay và súng là lớp 0–2 m của §20.4 và là thứ cố vấn lịch sử nhìn đầu tiên.

## 2. Mục tiêu G0′ và G1

**G0′ (2 tuần):** engine sạch tên mới, CI xanh, nợ perf trả, KTX2, registry 1971 lượt đầu, và hai prototype đo được (terrain DEM, rừng instanced). Kết thúc bằng ADR rừng: GO/ADJUST cho G1.

**G1 (6–8 tuần):** lát cắt Cổng Trời 15 phút theo §20.2 chơi được từ menu tới checkpoint C không debug; một khẩu AK-47 1971 hoàn chỉnh; một đồng đội (Quyết) có ba khoảnh khắc; một ô rừng đạt mẫu; UI shell + save + tiếp cận; media player + handoff; animatic CINE-00/CINE-M1 trong engine; playtest 5 người + bench Mac; VERIFY G1 theo §23.3.

Ngoài G1: đêm, AC-130, thám báo, Thu, Hải/Sáng/Út đầy đủ (G1.5); bơi, cõng, tùng thiết (G2); đô thị (G3).

## 3. Kiến trúc thêm cho G1 (kế thừa HT-MB, xem PRD §10)

| Package mới | G0′/G1 làm gì | Ràng buộc |
|---|---|---|
| `engine/terrain` | tile heightmap từ DEM (1 ô 512 m cho G0′, 4 ô cho G1), LOD, splat 4 lớp, heightfield collider, navmesh bake theo ô | Bake offline (`scripts/terrain-bake.mjs`); không sinh lúc chạy |
| `engine/vegetation` | scatter cell (seeded), InstancedMesh theo loài × LOD, gió TSL, impostor cây tán, culling theo ô, đè cỏ ≤ 8 tác nhân | Toàn rừng ≤ 40 draw; compute LOD là mục tiêu, CPU theo ô là fallback |
| `engine/streaming` | ô kế tiếp nạp trước, ô đã qua giải phóng, warmup shader theo ô | Hitch ≤ 50 ms |
| `engine/cinematics` | timeline JSON: camera track (Catmull-Rom + look-at), cue thoại/phụ đề, fade, sự kiện; media player (video + WebVTT + 3 track âm); trạng thái MENU→PREPARE→VIDEO/READY→HANDOFF→PLAYING; `scripts/capture-cine.mjs` ghi MP4 | Không chứa logic mission; mission không phụ thuộc video chạy hết (§22.2) |
| `game/squad` (mở rộng từ TIP-024 dự kiến) | đồng đội có tên theo spline/navmesh, tương tác "giúp/đưa bi đông", barks có ưu tiên | 0 lệnh ở G1 |
| `game/narrative` | thư (màn tĩnh), save chiến dịch v1 (`schemaVersion`, `cinematicsSeen`), túi thư | Migrate test từ ngày đầu |
| `ui/` | shell menu/settings/pause/fail/complete, token §8.3, i18n vi, focus/keyboard, HUD theo ngữ cảnh §8.4 | DOM/CSS; không React trong hot loop |
| `content/registry` | 7 YAML + schema + validator + `docs/history/M1.md` | Refinery/registry-hygiene |

## 4. Task graph

Ký hiệu: **D** = TIP của dự án mới (tránh trùng TIP-0xx của HT-MB). Effort = giờ Thợ (Claude Code) ước; Chủ nhà = việc chỉ anh làm được.

### G0′ — 2 tuần

| TIP | Việc | Phụ thuộc | Evidence | Effort |
|---|---|---|---|---|
| D01 Fork & dọn | Fork `hai-tuyen` → repo `duong-ve-sai-gon` (Chủ nhà tạo GitHub private); đổi tên, bỏ content Vạn Hải khỏi build mặc định (giữ `?level=arena` bench + Phố làm test đô thị), AGENTS.md thêm luật lịch sử/asset/E2E vật lý; CI xanh | Chủ nhà tạo repo | CI log, bench arena không tụt | 8 h |
| D02 Nợ perf + KTX2 | TIP-026 cũ: gộp material, atlas biển hiệu, bóng chọn lọc, `ktx2` pipeline (toàn bộ texture), validator asset (license, sha256, registryId, tri/texel) | D01 | bench `arena`, `pho` trước/sau; manifest KTX2 | 24 h |
| D03 Registry 1971 | Skeleton 7 registry + JSON Schema + validator; lượt cào–lọc đầu cho `uniforms/weapons/vehicles/aircraft` 1971 (bộ đội Trường Sơn, TNXP, thám báo, AK/CKC/K-54/12,7, Zil-157/Gaz-63, AC-130/OV-10/UH-1); `docs/history/M1.md` khởi tạo | — (song song) | báo cáo provenance P/S/H/X; Chủ nhà duyệt lượt 1 | 24 h + Chủ nhà 3 h |
| D04 Terrain prototype | `engine/terrain`: 1 ô DEM Trường Sơn (toạ độ Chủ nhà chọn, license DEM ghi ADR), LOD, splat, heightfield collider, navmesh bake; E2E vật lý đi/dốc | D01 | ảnh + bench + E2E | 32 h |
| D05 Rừng prototype | `engine/vegetation`: 20–40 k instance 5 loài placeholder CC0, gió, 3 LOD + impostor, culling ô, đè cỏ; đo GPU Mac ở 1920 px | D04 | bench Mac 3 run; **ADR-D01 Rừng: GO/ADJUST** | 40 h |

Cổng G0′: CI xanh; rừng prototype ≤ 12 ms GPU ở 1920 px trên M1 Max (Chủ nhà chạy bench); registry 1971 lượt 1 có ≥ 60 % fact tier P/S; ADR rừng ký.

### G1 — 6–8 tuần, ba bước theo §23.1

**Bước 1 — Blockout và điều khiển (tuần 1–2)**

| TIP | Việc | Phụ thuộc | Evidence | Effort |
|---|---|---|---|---|
| D06 UI shell (UX01) | Menu, khởi động lần đầu, settings (âm/phụ đề/giảm chuyển động/FOV ngang quy đổi/độ nhạy), tạm dừng, thất bại, hoàn thành, chọn nhiệm vụ, túi thư; token §8.3, i18n vi, focus/keyboard, lỗi save; nền menu tĩnh + động 30 FPS | D01 | clip keyboard flow 3 viewport; UX-101/103/104/105 | 40 h |
| D07 Save chiến dịch v1 | schema, IndexedDB, migrate test, `cinematicsSeen`, checkpoint tách trạng thái nhân vật cốt truyện/lính mới (§20.3) | D06 | unit migrate; E2E reload giữa phim | 16 h |
| D08 M1 blockout 15 phút (M101) | Tuyến §20.2 trên terrain 4 ô: lối hẹp, khoảng sáng, chỗ khuất, ngầm nông (không bơi), encounter 4–6 địch hai tuyến cover + lối rút, 3 checkpoint A/B/C; controller thêm bò; sức bền mang nặng; E2E vật lý toàn tuyến; encounter director vùng | D04, D05 | full run không debug; E2E `level-m1.spec`; reset invariant | 48 h |
| D09 "Tai" + âm nền M1 | Audio bus, ambience rừng ngày theo seed, động cơ xa chưa định danh có hướng/khoảng cách (HRTF), caption tương đương cùng ngưỡng nghe; tiếng dép/vải/thở | D08 | clip tắt hình nghe hướng; UX-106 | 24 h |

**Bước 2 — Mẫu tay/súng/đồng đội và encounter (tuần 3–5)**

| TIP | Việc | Phụ thuộc | Evidence | Effort |
|---|---|---|---|---|
| D10 AK-47 Type 56 1971 (GF01) | Chọn model CC-BY (kiểm rip), `convert-weapon`, fit tay (`?calib`), ADS 180–240 ms, recoil 3 lớp, reload có huỷ + thời điểm nạp xác định, impact/âm theo vật liệu (đất, gỗ, đá, kim loại) pool, không hit-marker arcade | D03 duyệt súng, D08 | clip hip→ADS→bắn→thay băng; test ammo state; cố vấn ký súng | 32 h + Chủ nhà đăng nhập Sketchfab |
| D11 Nhân vật 1971 lớp 0–2 m và 2–15 m (ART01a) | Kế hoạch §7.4 tầng 1–2 cho **một** nhân vật: thân Mixamo retexture Tô Châu, mũ cối, dép, bao xe, ba lô, bi đông gắn bone; tay FP 1971 (áo, tay trần); clip Mixamo + IK; **hạn 3 tuần** chứng minh | D03 duyệt uniform | ảnh cùng ánh sáng/pose với ảnh tham chiếu; cố vấn chấm; nếu trượt → ADR đặt riêng | 48 h |
| D12 Ô rừng mẫu + palette M1 (ART01b) | Thay placeholder bằng 6–8 loài CC0/CC-BY đúng vùng (dương xỉ, chuối rừng, dây leo, tán), impostor thật, splat đất mùn/đá/bùn, ánh sáng nhỏ lọt tán (tia nắng chỉ ở 1–2 shot), grade M1, bụi/lá bay khi có động cơ; kiểm alpha overdraw; "không bức tường xanh" | D05, D08 | bench Mac; ảnh hero 3 góc; A/B với ảnh tư liệu (người chấm) | 48 h |
| D13 Quyết — ba khoảnh khắc (SQD) | Đồng đội theo tuyến, ra hiệu dừng ("Nghe đã"), giúp qua ngầm (bàn tay), nhận bi đông (tương tác tuỳ chọn, một câu đáp, không XP); barks ưu tiên; nhận diện silhouette/giọng/dấu khi nhìn | D08, D11 | clip 3 khoảnh khắc; 4/5 người thử kể được Quyết | 32 h |
| D14 AI archetype thám báo/lính Sài Gòn cho encounter mẫu | Tuning từ TIP-018; luật công bằng §20.3 (không nhìn xuyên cỏ đậm, nghe ≠ biết toạ độ), không spawn trước mắt; đầu hàng có tín hiệu (PLY-008 sửa) dù G1 chưa dùng | D08 | ai.test + probe timeline; E2E encounter 10 lần | 24 h |

**Bước 3 — Điện ảnh, handoff, playtest (tuần 5–8)**

| TIP | Việc | Phụ thuộc | Evidence | Effort |
|---|---|---|---|---|
| D15 Cinematics player + handoff (CIN01) | `engine/cinematics`: timeline JSON, camera track, media player (video + WebVTT + 3 track), trạng thái §22.2, skip/pause/error/autoplay bị chặn/pointer lock lỗi, handoff 12 s; `content/cinematics/*.json` | D06, D07 | CIN-201…205 bằng E2E logic; clip handoff trên Mac | 40 h |
| D16 Animatic CINE-00 + CINE-M1 trong engine (CIN02) | Dựng theo shot list §21.3–21.4 bằng asset M1 blockout, tiếng tạm có nhãn, phụ đề; `scripts/capture-cine.mjs` ghi MP4 1080p24 thử | D15, D08 | animatic 90 s + 40 s; Chủ nhà chốt nhịp; quyết in-engine/Blender | 32 h |
| D17 20–30 s hoàn thiện → CINE-00 (CIN03) | Đoạn S04–S07 với asset D11/D12; nhạc mô-típ tạm có license; sau duyệt mới render cả 90 s | D11, D12, D16 | CIN-206/207 trên Mac; manifest media + nguồn | 32 h |
| D18 Perf pass G1 | Bench `m1-v1` 90 s × 3 (báo cả ba run), soak 20 phút, đổi ô; p95 ≤ 16,67; FX Tier B có điều kiện, Tier C tắt | D12, D17 | JSON + overlay Mac; ADR nếu cắt FX | 24 h |
| D19 QA G1 + VERIFY (QA01) | 5 người chơi mới (Chủ nhà mời), hai đường vào, quay màn hình, scorecard §23.3; cố vấn kiểm sử M1; VERIFY G1 theo Vibecode (coverage REQ-ID, scenario, health, READY/NOT) | tất cả | raw observations + clip + VERIFY-G1.md | 16 h + Chủ nhà 1 ngày |

Tổng Thợ: G0′ ≈ 128 h; G1 ≈ 456 h. Với nhịp phiên như HT-MB (≈ 25–30 h Thợ/tuần) → G0′ 2 tuần, G1 ≈ 8 tuần. Đường găng: D04 → D05 → D08 → D12 → D17 → D18 → D19; D11 song song có hạn 3 tuần.

## 5. Yêu cầu bao phủ (REQ-ID của PRD v0.2 mà G1 phải chạm)

PLY-001 (+bò), PLY-007, PLY-008 (tín hiệu, chưa kích hoạt luật), WPN-001 (AK-47 1971), WPN-003 (chưa, đạn bay để G2), WPN-006, AI-001 (2 archetype), SQD-001/003, MIS-001 (graph + 3 checkpoint), MIS-002, REN-001 (sky profile M1 ngày), REN-005, REN-006, TER-001…003, VEG-001…006, VFX-001, AUD-001…004, UX-001…003, UX-005, A11Y-001/002, UX-101…107, GUN-201/202, ENC-201, CIN-201…209, PRF-001…005, DAT (registry 4/7), AST 7.1/7.2/7.5/7.6. Không chạm ở G1: WAT, VEH, CTY, WPN-004, AUD-005 (giọng thật), RAT chứng nhận.

## 6. Việc của Chủ nhà trong G0′/G1

Tạo repo GitHub `duong-ve-sai-gon` (private) và push như quy trình cũ; chọn toạ độ ô Trường Sơn đầu tiên (hoặc để tôi đề xuất theo Đường 20); đăng nhập Sketchfab khi Thợ tải AK-47 và cây; duyệt lượt 1 registry 1971 (3 giờ) và mời một cố vấn lịch sử; chạy bench Mac ở D05, D12, D18; mời 5 người chơi thử ở D19; **quyết ba việc ở §7**.

## 7. Cần APPROVED và ba quyết định

1. **APPROVED Blueprint này** (G0′ + G1 như §4; G1.5 đêm/AC-130 là gate riêng trước G2).
2. **Điện ảnh:** in-engine + ghi MP4 (đề xuất của tôi, R3) hay dựng ngoại tuyến Blender như v0.2.
3. **Repo:** fork thành `duong-ve-sai-gon` (đề xuất) hay tiếp tục trong `hai-tuyen`.

Sau APPROVED, tôi phát TIP-D01 và D03 ngay (song song), rồi D04.
