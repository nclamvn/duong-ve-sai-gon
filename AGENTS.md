# AGENTS.md — Hải Tuyến · HT-MB

Tài liệu này là luật cho mọi AI agent (Thợ) làm việc trong repo. Chủ thầu giao việc bằng TIP (`docs/tips/`), Thợ nộp Completion Report (`evidence/<TIP>/`). Nguồn yêu cầu: `docs/PRD.md` (ID có tiêu chí nghiệm thu), `docs/BLUEPRINT.md` (khế ước kiến trúc).

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
| `content/` | mission JSON, locale, tuning, schemas | Không chứa TypeScript |
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
npm run bench          # Mac: mở Chrome, replay 90 s × 3 → evidence/G0/performance-report-*.json
npm run snapshot       # snapshots/G0/
npm run ci             # typecheck + test + build + e2e
```

## 3. Vùng cấm

- Không dùng `ShaderMaterial` / `onBeforeCompile` — chỉ TSL (`three/tsl`) để chạy cả WGSL lẫn GLSL.
- Code render (`engine/render`, `game/actors`, `game/game.ts`) import từ `three/webgpu`. Module logic thuần (`game/player`, `game/weapons`, `game/ai`) chỉ import toán học (Vector3/Quaternion/Euler) từ `'three'` (three.core — cùng class) để chạy được trong Node/Vitest.
- Không tạo object mỗi frame trong hot path (`Vector3`, mảng, closure); dùng scratch + pool.
- Không đổi `config/performance-budget.json` để "đạt". Ngưỡng là input, không phải output.
- Không tải asset/texture/audio/model từ mạng hoặc thư viện chưa xác minh license (PRD §9.2). G0 = procedural.
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

## 6. Những việc AI không được tự quyết (PRD §9.2)
Mua/nhập asset chưa xác minh license · đổi version three/rapier/recast giữa milestone · thêm feature "làm đẹp" khi chưa qua acceptance · tự đánh giá game feel chỉ bằng test tự động · che regression bằng hạ chất lượng toàn cục · sao chép IP tham chiếu.
