# AGENTS.md — Đường về Sài Gòn (DVSG)

Tài liệu này là luật cho mọi AI agent (Thợ) làm việc trong repo. Chủ thầu giao việc bằng TIP (`docs/tips/TIP-Dxx.md`), Thợ nộp Completion Report (`evidence/<TIP>/`). Nguồn yêu cầu: `docs/PRD.md` (v0.2, ID có tiêu chí nghiệm thu), `docs/BLUEPRINT-G1.md` (khế ước kiến trúc G0′/G1), `docs/story/KICH-BAN-v0.1.md` (kịch bản), `docs/DECISIONS.md` (DV-xxx). Engine kế thừa Hải Tuyến (HT-MB): luật cũ ở `docs/legacy/`, ADR-001..007 và TIP-0xx vẫn có hiệu lực trừ khi bị ghi đè.

## 0. Luật riêng của DVSG (PRD v0.2 §7, §9, §12, §20–22)

- **Lịch sử có nguồn.** Mọi asset/chi tiết lịch sử (quân phục, súng, xe, máy bay, biển hiệu, đồ dùng, ngày giờ, tên đường) phải trỏ tới entry trong `content/registry/*.yaml` có `provenance_level` P hoặc S; H phải viết mờ, X không dùng. Manifest asset lịch sử có `registryId`; validator CI chặn. Người thật có tên **không có lời thoại bịa**; con số tranh chấp giữ cả hai bên.
- **Asset:** Mixamo, CC0, CC-BY (attribution bắt buộc), tự dựng, đặt riêng có hợp đồng. **Không** asset từ game khác dù dán nhãn CC — kiểm mô tả/tag/tên material/tác giả trước khi tải (D-072). Không nhạc/lời bài hát có bản quyền. Không nhân bản giọng người thật; TTS chỉ ở bản dev.
- **Mỗi level mới có E2E vật lý người chơi** trong CI (đứng, chạy, bậc, nước, lên xe khi có) — ảnh không thay thế (D-075).
- **Điện ảnh không chặn mission:** `game/narrative` quyết phim/checkpoint, `engine/cinematics` chịu media/camera/timeline; mission không phụ thuộc video chạy hết; skip vẫn chờ READY (collider, navmesh, spawn đứng được).
- **Luật công bằng AI (PRD §20.3):** không nhìn xuyên cỏ đậm người chơi không nhìn xuyên được; nghe ≠ biết toạ độ; không spawn trước mắt/sau lưng vừa dọn/trong collider; người đầu hàng có tín hiệu đọc được và không quay sang bắn lén trong cùng encounter.
- **Đo trước art:** rừng/đô thị phải đạt budget trên máy chuẩn trước khi làm asset đẹp; `target_g1` p95 16,67 ms (ADR-D02).
- **Không mở nhiệm vụ mới** khi nhiệm vụ hiện tại chưa qua gate; không hạ chất lượng toàn cục để che regression.
- Tiếng Việt chỉ trong content JSON/YAML/i18n và docs; code/identifier/log tiếng Anh (D-008).

## 1. Kiến trúc (không thương lượng trong một gate)

| Package | Trách nhiệm | KHÔNG được làm |
|---|---|---|
| `src/engine/core` | clock fixed-step, event bus, scheduler, prng, pool, ids | Không biết mission; không import three/DOM |
| `src/engine/render` | backend WebGPU/WebGL2, TSL material, lighting, rain, scaler, arena greybox | Không quyết định damage/gameplay; không import `game/*` |
| `src/engine/physics` | Rapier world, capsule controller, collision layers, ray | Không điều khiển camera feel |
| `src/engine/nav` | Recast navmesh build + query | Không chứa logic AI |
| `src/engine/input` | pointer lock, input snapshot, replay track | Không diễn giải gameplay |
| `src/game/player` | movement, stance, health, camera layers, settings | Không gọi renderer trực tiếp |
| `src/game/weapons` | state machine, recoil, hitscan, ammo | Không spawn VFX/SFX trực tiếp — phát event |
| `src/game/ai` | perception, FSM, cover, LOD | Không hard-code mission timeline |
| `src/game/mission` | graph runtime, objective, checkpoint, dialogue cue | Không chứa shader/physics low-level |
| `content/` | mission JSON, level JSON, locale, tuning, schemas, **registry YAML**, cinematics JSON | Không chứa TypeScript |
| `src/engine/terrain` · `vegetation` · `streaming` · `cinematics` (G0′/G1) | terrain DEM tile/LOD/collider; scatter instancing/gió/impostor; ô nạp/giải phóng; timeline/camera track/media | Không biết mission; không import `game/*` |
| `src/game/squad` · `game/narrative` (G1) | đồng đội có tên, lệnh theo cấp, barks; thư, save chiến dịch, cutscene state | Không hard-code map; không chứa shader |
| `src/qa` | telemetry, debug API, bench, replay | Không ship trong release (gate `import.meta.env.PROD`) |

Nhịp runtime (PRD §3.1): sim 60 Hz fixed → AI 10 Hz → render interpolation. **Không mutate physics trong render.** Event có ID và idempotent.

## 2. Lệnh

```
npm install            # deps pin chính xác — không nâng version giữa gate (ADR-001)
npm run dev            # http://localhost:5173  (?backend=webgl để ép fallback, ?autostart=1, ?overlay=1, ?debug=1)
npm run typecheck      # tsc strict
npm run test           # vitest unit (Node; rapier/recast chạy qua wasm-compat)
npm run build && npm run e2e   # Playwright project webgl-ci (sandbox: HT_CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome)
npm run e2e:webgpu     # chỉ trên Mac có Chrome: HT_WEBGPU=1
npm run bench          # Mac: mở Chrome, replay 90 s × 3 → evidence/bench/performance-report-*.json (track arena; m1-v1 ở G1)
npm run snapshot       # snapshots/G0/
npm run ci             # typecheck + test + build + e2e
```

## 3. Vùng cấm

- Không dùng `ShaderMaterial` / `onBeforeCompile` — chỉ TSL (`three/tsl`) để chạy cả WGSL lẫn GLSL.
- Code render (`engine/render`, `game/actors`, `game/game.ts`) import từ `three/webgpu`. Module logic thuần (`game/player`, `game/weapons`, `game/ai`) chỉ import toán học (Vector3/Quaternion/Euler) từ `'three'` (three.core — cùng class) để chạy được trong Node/Vitest.
- Không tạo object mỗi frame trong hot path (`Vector3`, mảng, closure); dùng scratch + pool.
- Không đổi `config/performance-budget.json` để "đạt". Ngưỡng là input, không phải output.
- Asset (ADR-005/006/007, PRD DVSG §7): CC0 qua `scripts/fetch-assets.mjs`, CC-BY qua `scripts/convert-weapon.mjs` / `convert-model.mjs` (attribution), Mixamo do Chủ nhà tải vào `assets-src/`; mọi file phải có trong `content/assets/manifest.json` (nguồn, license, sha256, `registryId` nếu là asset lịch sử). Không asset từ game tham chiếu hay asset rip.
- TSL: không đảo cạnh `smoothstep(a, b, x)` với a > b (undefined GLSL/WGSL → nón đèn thành kim tự tháp, TIP-011); viết `smoothstep(b, a, x).oneMinus()`. Vị trí/kích thước visual không được lệch collider (`tests/unit/arena.test.ts` khoá hash ArenaData).
- Không thêm dependency ngoài `package.json` mà không có ADR.
- Không sao chép UI, thoại, bản đồ, tên, âm thanh từ Call of Duty hay game tham chiếu.
- Không ghi literal tiếng Việt trong `src/**/*.ts` ngoài `src/ui/i18n.ts` — mọi chuỗi qua `content/locale/vi.json`.

## 4. Completion Report (bắt buộc mỗi TIP)

`evidence/<TIP-ID>/completion-report.md`:
```
STATUS: DONE | PARTIAL | BLOCKED
FILES CHANGED: created / modified
TEST RESULTS: AC pass/fail từng dòng, số test, lệnh đã chạy
ISSUES: severity + mô tả + đề xuất
DEVIATIONS: what + why + impact (chỉ L1)
SUGGESTIONS: cho Chủ thầu — không tự ý làm
```
Kèm evidence: screenshot/JSON/log. Số đo trong sandbox phải gắn `evidence_status: sandbox_swiftshader_lifecycle_only`.

## 5. Escalation

| Level | Ai | Ví dụ |
|---|---|---|
| L1 | Thợ tự quyết, ghi DEVIATIONS | tên biến, tách helper, workaround nội bộ không đổi contract |
| L2 | Thợ → Chủ thầu | spec mơ hồ, đổi pattern ảnh hưởng TIP khác |
| L3 | Chủ thầu → Chủ nhà | đổi kiến trúc Blueprint, business rule, scope, security |

Luật một câu: *quyết định có làm thay đổi điều đã approve (TIP/Blueprint/contract) hoặc ảnh hưởng ngoài TIP hiện tại không?* Có → L2. Nghi ngờ → chọn level cao hơn.

## 6. Những việc AI không được tự quyết (PRD DVSG §12; kế thừa HT-MB §9.2)
Mua/nhập asset chưa xác minh license hoặc nghi rip · gán lời thoại cho người thật · dùng con số lịch sử tranh chấp như sự thật · nhân bản giọng người thật · đổi version three/rapier/recast giữa gate · mở nhiệm vụ mới khi nhiệm vụ hiện tại chưa qua gate · thêm feature "làm đẹp" khi chưa qua acceptance · tự đánh giá game feel chỉ bằng test tự động · che regression bằng hạ chất lượng toàn cục · sao chép IP tham chiếu.
