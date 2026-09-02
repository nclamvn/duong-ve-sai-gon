# VERIFY REPORT: Hải Tuyến · HT-MB · Gate G0
Contractor: Claude (Chủ thầu) · 2026-09-02 · Build `9e9066d` · Kiểm ngược độc lập, không tin Completion Report

Phương pháp: chạy lại `npm run ci` trên working tree sạch (typecheck + 72 unit + build + 6 E2E); grep vùng cấm AGENTS.md;
đọc code đường nóng (renderStep, simStep); soak 10 phút sim trong browser thật; đối chiếu từng REQ-ID với evidence.
Mọi số hiệu năng ở đây là `sandbox_swiftshader_lifecycle_only` — không phải số G0.

## REQUIREMENT COVERAGE (đếm theo REQ-ID trong docs/RRI.md)

| REQ | Trạng thái | Bằng chứng kiểm lại | Ghi chú Verify |
|---|---|---|---|
| G0-01 Scaffold + governance | Implemented ✅ | budget.test (5), deps pin 0 lỗi, ADR-001..004, AGENTS.md | TS 7.0 bỏ baseUrl — đã xử lý |
| G0-02 Renderer WebGPU/WebGL2 | Implemented, **verified một nửa** ⚠ | E2E boot webgl2 ✓; capability ghi backend + renderer thật; onDeviceLost → event | Nhánh WebGPU chưa chạy được ở sandbox (ADR-004) → `npm run e2e:webgpu` trên Mac |
| G0-03 Benchmark arena | Implemented ✅ | 260 props (200 BatchedMesh + 60 instanced), 8 SkinnedMesh 3 bone, mưa 20k GPU, 1 sun shadow + 2 point, fog, wet TSL; drawCalls 63 WebGL | Ảnh evidence/TIP-003 |
| G0-04 Telemetry + report | Implemented ✅ | telemetry.test (9), E2E bench: file hợp lệ schema, GPU timestamp hoạt động cả SwiftShader | `calls` vs `drawCalls` bug đã bắt |
| G0-05 Dynamic resolution | Implemented ✅ | scaler.test (4), áp vào setPixelRatio khi đổi, UI DOM không đổi | Chưa quan sát trên GPU thật |
| G0-06 Fixed-step 60 Hz | Implemented ✅ | core.test; renderStep không gọi physics/sim (đọc code); `stepSim` tách render | clampCount vào telemetry |
| G0-07 Capsule controller | Implemented ✅ | controller.test (5): tường, bậc 0.3/0.6, determinism 600 tick, spam jump, crouch trần | Game feel chưa người thật đánh giá (PRD §9.2) |
| G0-08 Pointer lock + settings | Implemented ✅ | settings IndexedDB thật trong Chromium (probe), unadjustedMovement + fallback counter, rig 4 lớp, recoil drift 0 | Raw input không kiểm được headless |
| G0-09 AR weapon | Implemented ✅ | weapon.test (11): SM spam, mag cycle, recoil seed, ADS ≥95/100, penetration, pool cố định 18k tick | Muzzle flash phẳng — deferred G4 |
| G0-10 Bot AI | Implemented ✅ | ai.test (9): navmesh, perception, FSM 10 seed × 3 phút, stuck, LOD; probe browser 16 shot/5 hit | Cover marker cần width — deferred G2 |
| G0-11 Mission node + checkpoint | Implemented ✅ | mission.test (9) + E2E: allow-list reject, idempotent, timeout fallback, restore 20/20 hash | Bot FSM sau restore về PATROL — chấp nhận G0 |
| G0-12 Debug API | Implemented ✅ | E2E: PROD không `__ht`; 12 hàm QA | — |
| G0-13 Test Vitest + Playwright | Implemented ✅ | 72 unit / 6 E2E pass; webgpu spec skip có lý do | Không có ESLint (xem Technical Health) |
| G0-14 Audit trail | Implemented ✅ | 9 contracts, 9 completion report, snapshots/G0 khớp HEAD, known-issues tự gom | — |
| G0-15 i18n + HUD | Implemented ✅ | i18n.test grep 0 literal VI ngoài i18n.ts; HUD ammo/health/objective/prompt/banner | — |
| G0-16 Bench trên Mac | Implemented, **chưa đo** ⚠ | Harness E2E ✓ (POST, schema, evidence_status); report sandbox tự vào evidence/sandbox | Số G0 thật = việc còn lại duy nhất |

```
REQUIREMENT COVERAGE:
├── Total Requirements: 16
├── Implemented: 16
├── Verified đầy đủ trong sandbox: 14
├── Verified một phần (cần Mac): 2  (G0-02 nhánh WebGPU, G0-16 số đo chuẩn)
├── Missing: 0
└── Coverage: 16/16 = 100% implemented · 14/16 = 87.5% verified-in-sandbox
```

## SCENARIO RESULTS

```
Unit (Vitest):        72 passed / 0 failed  (9 file)
E2E (Playwright):      6 passed / 0 failed / 1 skipped (webgpu — chỉ Mac)
Probe browser (Thầu):  soak 10 phút sim (36 000 tick): 0.03 ms/tick CPU, heap 99–115 MB dao động GC không tăng đơn điệu,
                       fx.created = 84 cố định, event ring = 512 cố định, duplicates 0, audio dropped 0, clock clamp 0,
                       player chết 2 lần → respawn từ cp0 đúng, 0 lỗi console
Restart invariant:     restore ×20 hash khớp (unit FakeWorld) + ×20 (browser Game thật) + ×5 (E2E)
Deadlock/stuck:        FSM 10 seed × 3 phút: 0 timeout; stuck giả → replan 2 s, teleport 4 s
```

Fail có severity: **không có fail**. Skip: 1 (webgpu, lý do môi trường, không phải lỗi).

## TECHNICAL HEALTH

```
Build:        PASS (vite 8.2.2, 892 kB JS gzip 247 kB — gồm three.webgpu + rapier + recast WASM inline)
Type errors:  0 (tsc strict, noUncheckedIndexedAccess)
Lint:         KHÔNG CẤU HÌNH — repo chưa có ESLint/Prettier (thiếu, xem Deferred D-1)
Tests:        72 unit + 6 E2E pass; 1 skip
Vùng cấm:     ShaderMaterial/onBeforeCompile 0 · engine/* import game/* 0 · content/*.ts 0 · Math.random 0 ·
              deps không pin 0 · asset ngoài 0 · literal VI ngoài i18n 0
Kiến trúc:    game/ai import *type* CoverMarker từ engine/render/arena (type-only, không runtime) — nợ nhỏ D-3
LOC:          src 6 204 dòng / 55 file TS; tests 1 542 dòng
Git:          10 commit, working tree sạch, snapshots/G0/build-hash = HEAD
```

## CRITICAL ISSUES
Không có P0/P1.

## DEFERRED (P2 — Human quyết ship hay fix)
- D-1 Chưa có ESLint/Prettier: code sạch nhờ tsc strict, nhưng "Lint" trong TECHNICAL HEALTH đang trống. Đề nghị thêm ở G1 kèm ADR (không đổi code).
- D-2 Muzzle flash là plane phẳng gắn camera, nhìn như tam giác (evidence TIP-006/008). Greybox; G4.
- D-3 `CoverMarker` type nằm trong `engine/render/arena.ts` nhưng `game/ai` cần → nên tách `engine/core/types` ở G2 khi bake marker kèm width.
- D-4 Bot FSM sau restore checkpoint về PATROL (path/timer nội bộ không snapshot). Đúng PRD ở mức vị trí/máu/alive; G3 quyết có lưu awareness không.
- D-5 Draw call trên backend WebGPU đếm cả sub-draw BatchedMesh (~260 cho 200 props) — không phải regression, là cách đếm của three r185; README đã ghi. Cân nhắc metric riêng `pipeline_switches` ở G4.
- D-6 Game feel (bob/recoil/accel) chưa qua người chơi thật — PRD §9.2 cấm tự đánh giá bằng test → G1 review với video 10 s.

## DECISIONS NEEDED FROM CHỦ NHÀ
1. **Đo G0 trên M1 Max ngay** (RRI Q4 anh chọn tôi điều khiển Chrome): `npm install && npm run e2e:webgpu && npm run bench` trong `~/Desktop/hai-tuyen`. Kết quả → GO / ADJUST / STOP theo PRD §10.1. Khuyến nghị: làm ngay, vì mọi thứ khác đã xanh.
2. Chấp nhận 6 mục Deferred ở trên như known issues của G0 (không mục nào chặn bench). Khuyến nghị: chấp nhận, đưa D-1 vào TIP đầu G1.

## OVERALL STATUS
**READY-với-deferred** — 16/16 REQ implemented, 0 fail, 6 deferred P2 liệt kê ở trên.
Phán quyết G0 (60 FPS trên M1 Max) **chưa thể ra** cho tới khi có `performance-report` với `evidence_status = measured_on_reference_device`.
