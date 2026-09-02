## COMPLETION REPORT — TIP-009: E2E Playwright + Snapshot G0 + Evidence

**STATUS:** DONE

**FILES CHANGED:**
- Created: `tests/e2e/helpers.ts` (bootGame, pauseLoop, renderFrames, expectNoErrors), `boot.spec.ts` (3 test: boot WebGL2 + số liệu arena + bone xoay + drawCalls < 650; capability screen + nút vào; PROD không `__ht`/overlay), `mission.spec.ts` (2 test: intro → D01 → teleport zone → D03 + spawn 2 + prompt → kill → n_done + banner + MISSION_COMPLETE ×1 → chơi 20 s → load cp0 ×5 hash khớp; chết → respawn không checkpoint → reset), `bench.spec.ts` (POST /__bench → file schema hợp lệ, evidence_status sandbox, overlay verdict), `webgpu.spec.ts` (project `webgpu`, skip có lý do khi không `HT_WEBGPU=1`)
- Created: `scripts/snapshot.mjs` (build-hash.txt git+dist sha256, package-lock copy, manifest.json 66 file, replay-seed.txt, known-issues.md gom từ 9 completion report), `contracts/TIP-001..009.yaml` (8 trường), `README.md` (cài/chạy/test/bench/đọc verdict/cấu trúc)
- Modified: `scripts/bench-plugin.ts` (report `sandbox_swiftshader_lifecycle_only` → `evidence/sandbox/`, không lẫn `evidence/G0/`), `src/engine/render/backend.ts` (WebGL2 adapterInfo = UNMASKED_RENDERER để capability screen + `classifyEvidence` nhận SwiftShader), `.gitignore` (+evidence/sandbox)

**TEST RESULTS:** 4/4 AC pass
- AC1 `npm run ci` (typecheck + 72 unit + build + e2e webgl-ci) exit 0; 6/6 spec pass trong 46 s; `webgpu.spec` skip với lý do ADR-004: PASS
- AC2 `npm run snapshot` → 5 file `snapshots/G0/`; `build-hash.txt` git = HEAD (đánh dấu dirty nếu working tree chưa commit): PASS
- AC3 9 contract YAML, mỗi file 8 trường (id/goal/scope/acceptance/tests/evidence/rollback/status), status khớp completion report: PASS
- AC4 README có lệnh bench, giải thích verdict PASS/WARN/FAIL/NA theo budget, ghi chú draw_calls WebGPU: PASS
- Screenshots: `evidence/TIP-009/{boot-webgl,mission-complete,bench-overlay}.png`

**ISSUES DISCOVERED:**
- [Medium→fixed] Playwright `devices['Desktop Chrome']` dùng UA Chrome thường (không "HeadlessChrome") → classifyEvidence xếp sandbox thành `non_reference_device`. Sửa: WebGL2 backend đọc `WEBGL_debug_renderer_info` → "SwiftShader" → sandbox. Trên Mac Chrome WebGL2 sẽ ra "ANGLE (Apple, Apple M1 Max, Metal)" → reference.
- [Low] Preview server cũ (từ probe trước) còn sống với plugin cũ làm 1 spec fail giả; `reuseExistingServer: true` tiện cho dev nhưng CI nên kill port 4173 trước. Ghi vào README? Đã ghi ở known-issues.
- [Info] `tests/e2e` import JSON cần đọc file thay vì `import` (Node ESM đòi import attribute).

**DEVIATIONS FROM SPEC:**
- E2E dùng `stepSim` + `renderFrames` thay vì chờ frame thật: SwiftShader ~0.5 s/frame khiến mọi "chờ N frame" vượt timeout; sim vẫn là code thật, chỉ bỏ render giữa các bước. L1 — ghi trong helpers.
- Không có `tests/e2e` cho teleport bằng `__ht.teleport` riêng — đã gộp vào mission.spec.

**SUGGESTIONS FOR CHỦ THẦU:**
- Sau khi commit TIP-009, chạy lại `npm run snapshot` để `build-hash.txt` hết "dirty" và khớp HEAD — đưa vào VERIFY.
- Trên Mac: `npm run e2e:webgpu` rồi `npm run bench` là 2 lệnh duy nhất còn thiếu để đóng G0.
