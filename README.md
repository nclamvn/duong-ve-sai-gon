# Hải Tuyến · Nhiệm vụ 01 · Mắt Bão — Gate G0 (Feasibility)

Cinematic FPS chạy trực tiếp trên trình duyệt (Three.js WebGPU + TSL, Rapier, Recast), tối ưu cho MacBook Pro M1 Max.
Repo này là **Gate G0**: benchmark arena "xấu nhưng đo được" + toàn bộ pipeline chạy end-to-end
(renderer → physics → weapon → bot AI → mission → checkpoint), có telemetry, test và evidence. Không có art.

Nguồn yêu cầu: `docs/PRD.md` (v0.1). Quy trình: Vibecode Kit v6.1 — `docs/RRI.md`, `docs/BLUEPRINT.md`, `docs/tips/`, `evidence/`, `docs/VERIFY.md`.

## Chạy

```bash
npm install                 # Node ≥ 22; deps pin chính xác (ADR-001)
npm run dev                 # http://localhost:5173 — WebGPU nếu có, WebGL 2 fallback
npm run dev -- --open "/?backend=webgl"      # ép fallback
```

Tham số URL: `?backend=webgl|webgpu` · `?autostart=1` · `?overlay=1` (telemetry, F3) · `?debug=1` (window.__ht, chỉ cần ở build PROD) ·
`?quality=low|medium|high` · `?rain=N` · `?shadow=N` · `?dynres=0` · `?seed=N` · `?freefly=1`.

Điều khiển: click để khóa chuột · WASD · Shift chạy · C cúi · Space nhảy · Chuột trái bắn · Chuột phải ADS · R nạp · F tương tác · F3 telemetry · F4 navmesh · Enter (khi chết) nạp checkpoint · Esc thoát khóa chuột.

## Test

```bash
npm run typecheck           # tsc strict
npm run test                # Vitest: 72 unit (core, scaler, telemetry, controller, weapon, ai, mission, i18n)
npm run e2e                 # Playwright project webgl-ci (6 spec) — tự build rồi preview; CI/sandbox chỉ có WebGL 2 (ADR-004)
npm run e2e:webgpu          # Mac có Chrome: HT_WEBGPU=1, kiểm backend webgpu + không device lost
npm run ci                  # typecheck + test + build + e2e
```

Sandbox Linux không có GPU: đặt `HT_CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (Playwright 1.62 kỳ vọng build 1234).

## Benchmark G0 trên M1 Max (bắt buộc trước khi phán quyết)

```bash
npm run bench               # mở Google Chrome: replay 90 s × 3 (seed 7, track arena-v1), median theo frame_p95, in verdict rồi thoát
npm run bench:quick         # 1 × 10 s để thử
npm run bench:webgl         # cùng cảnh qua WebGL 2 để A/B với WebGPU (PRD §10.1)
npm run bench -- --runs 3 --seconds 90 --seed 7 --port 5173
```
Render nội bộ mặc định bị trần 1920 px (PRD §4.1) dù màn Retina DPR 2; `?renderWidth=2560` để thử cao hơn.

Kết thúc, trang POST kết quả về dev server → `evidence/G0/performance-report-<ISO>.json` + `device-profile.json`.
Overlay hiện `verdict PASS|WARN|FAIL · evidence_status`. **Chỉ report có `evidence_status = measured_on_reference_device`
(Mac + Chrome, GPU Apple) mới dùng cho phán quyết G0.** Report từ sandbox/SwiftShader tự động vào `evidence/sandbox/`.

Đọc verdict theo `config/performance-budget.json` (PRD §4.1): mỗi metric `PASS` (≤ target), `WARN` (giữa target và red), `FAIL` (> red), `NA` (chưa đo được — vd gpu_ms nếu không có timestamp-query). Verdict = xấu nhất trong các metric có số.

Ghi chú khi đọc số: `draw_calls` trên backend WebGPU đếm cả sub-draw của BatchedMesh (1 `drawIndexed`/instance trong cùng pipeline) → 200 props hiện ~260 "draw" dù là một batch; trên WebGL 2 với `WEBGL_multi_draw` cùng cảnh chỉ ~60. So sánh giữa hai backend phải nhìn `frame_p95`/`gpu_ms`, không nhìn `draw_calls`.

## Cấu trúc

```
src/engine/{core,render,physics,nav,input,audio}   # không biết mission
src/game/{player,weapons,ai,mission,actors,game.ts} # gameplay; weapons chỉ phát event
src/ui/                                            # DOM overlay: HUD, phụ đề, telemetry, capability (mọi chuỗi qua vi.json)
src/qa/                                            # telemetry, bench, debug API (không ship PROD)
content/{schemas,missions,locale,tuning}           # JSON, không TS
config/performance-budget.json                     # ngưỡng — input, không sửa để "đạt"
docs/ contracts/ evidence/ snapshots/              # audit trail Vibecode
```

Luật cho AI agent: `AGENTS.md`. Quyết định kiến trúc: `docs/ADR/`.

## Trạng thái G0

**GO** (2026-09-02) — đo trên MacBook Pro M1 Max, Chrome 152, WebGPU/Metal: frame p95 **9.1 ms**, 1% low 107 FPS, GPU p95 2.4 ms, 0 hitch,
3 run × 90 s lặp lại ±0.1 ms (`evidence/G0/performance-report-2026-09-02T11-47-08-682Z.json`).
Chi tiết + deferred: `docs/VERIFY.md` (Verify Report của Chủ thầu) và `snapshots/G0/known-issues.md`.

Sau bench, TIP-010 thay khối trụ bằng hình nhân lính 12 bone, mưa mảnh, súng góc nhìn thứ nhất, tracer/flash/spark;
cần chạy lại `npm run bench:quick` để xác nhận vẫn PASS.
