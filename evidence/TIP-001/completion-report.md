## COMPLETION REPORT — TIP-001: Scaffold + Governance

**STATUS:** DONE

**FILES CHANGED:**
- Created: `package.json` (deps pin chính xác, 12 scripts), `tsconfig.json` (strict + noUncheckedIndexedAccess, paths @engine/@game/@ui/@qa/@content/@config), `vite.config.ts` (alias, define __BUILD_HASH__, optimizeDeps.exclude WASM, benchPlugin), `vitest.config.ts`, `playwright.config.ts` (project webgl-ci + webgpu, HT_CHROME/HT_WEBGPU), `index.html` (layer DOM: capability/hud/subtitles/overlay + CSS design tokens), `.gitignore`
- Created: `config/performance-budget.json` (15 metric từ 14 hàng PRD §4.1, evidence_status), `content/schemas/{mission,dialogue,checkpoint,performance-replay}.schema.json`, `content/locale/vi.json` (35 key: capability, HUD, objective, speaker, D01/D02/D03/D05/D06)
- Created: `AGENTS.md` (6 mục), `docs/ADR/ADR-001..004`, `scripts/bench-plugin.ts` (đã hoàn chỉnh POST /__bench → evidence/G0/, không còn là stub), `src/ui/i18n.ts`, `src/main.ts` (bootstrap tạm), `tests/unit/budget.test.ts` (5 test)

**TEST RESULTS:** 4/4 AC pass
- AC1 `npm install && typecheck && build` → exit 0, build 52 ms, không peer warning. PASS
- AC2 `npm run test` → 5/5 pass (budget 15 metric + evidence_status; schema reject {}; 4 schema compile ajv strict; AGENTS.md 5 mục; deps pin). PASS
- AC3 mission.schema validate `{}` → fail với missingProperty đủ 6 trường. PASS
- AC4 AGENTS.md có 5 mục bắt buộc (+ mục 6 PRD §9.2). PASS

**ISSUES DISCOVERED:**
- [Low] TypeScript 7.0 đã bỏ `baseUrl` và bắt `paths` phải tương đối → đã sửa. Ghi vào AGENTS.md? Không cần; tsconfig là nguồn.

**DEVIATIONS FROM SPEC:**
- Budget có 15 metric thay vì "14 chỉ số": hàng "FPS: 60 trung bình; 1% low ≥45" của PRD tách thành `fps_avg` và `fps_1pct_low` vì hai ngưỡng khác nhau (target 60 / red null vs target 45 / red 40). L1 — không đổi ngưỡng nào của PRD.
- `bench-plugin.ts` viết hoàn chỉnh ngay (TIP nói stub, hoàn thiện ở TIP-004): 60 dòng, không phụ thuộc gì khác; tránh sửa 2 lần. L1.
- Không cài `cross-env`; script `e2e:webgpu` dùng cú pháp POSIX `HT_WEBGPU=1 …` (macOS/Linux OK; Windows ngoài phạm vi PRD).

**SUGGESTIONS FOR CHỦ THẦU:**
- `performance-replay.schema.json` có `evidence_status` enum 3 giá trị (reference device / non-reference / sandbox) — đề nghị Chủ thầu dùng field này làm điều kiện phán quyết G0 thay vì tin tên file.
- E2E `webgpu` project dùng `channel: 'chrome'` → trên Mac cần Chrome Stable cài sẵn; nếu không có, Playwright sẽ báo lỗi rõ.
