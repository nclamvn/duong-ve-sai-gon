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

Dev server bind `127.0.0.1:5173` (như preview/bench — macOS resolve `localhost` → `::1` nên `127.0.0.1` từng bị refused): `npm run dev` →
`http://127.0.0.1:5173/?autostart=1`. Nếu "ERR_CONNECTION_REFUSED": dev server chưa chạy hoặc đã tắt — chạy lại `npm run dev` trong Terminal và để nguyên.

## Asset (ADR-005 — G0.5 look-dev)

```bash
npm run assets          # tải texture/HDRI/model CC0 từ Poly Haven → public/assets/, tối ưu glTF (meshopt) và ghi content/assets/manifest.json
npm run assets:verify   # kiểm file + sha256 khớp manifest (CI/unit test cũng kiểm)
```
`public/assets/` (≈44 MB, đã commit) là bản tối ưu; nguồn gốc nằm ở `assets-src/` (gitignore). Nhân vật Mixamo (Swat Guy + 8 clip,
tải bằng tài khoản Adobe): FBX trong `assets-src/mixamo/` (xem `docs/tips/TIP-012.md`) → `node scripts/convert-mixamo.mjs` (FBX2glTF, gộp clip,
texture 2K JPEG, meshopt) → `public/assets/characters/soldier.glb` + mục `soldier_mixamo` trong manifest.

Vũ khí glTF (TIP-014, ADR-006 — CC-BY Sketchfab, Chủ nhà đăng nhập, Thợ tải): nguồn `assets-src/sketchfab/<slug>/` →
`npm run assets:weapon -- --src assets-src/sketchfab/ak74m --id weapon_ak74m --length 0.943 --title … --author … --url …` →
`public/assets/weapons/<id>.glb` + manifest (attribution); cấu hình anchor/pose ở `content/weapons/<id>.json` (schema `weapon-model.schema.json`).
`npm run assets:credits` sinh `CREDITS.md`; màn capability hiển thị credit CC-BY.

Model xe/khí tài/prop (TIP-021, D-060 — CC-BY Sketchfab, **không nhận asset rip từ game**: đọc mô tả/tag/tên material trước khi tải):
`npm run assets:model -- --src assets-src/sketchfab/<slug> --id veh_<slug> --length 7.1 --title … --author … --url … --use …`
(`--scale`, `--keep/--drop` node, `--merge-mats`, `--no-join` giữ pivot rotor, `--texture 1024`) → `public/assets/models/<id>.glb` (dài theo +x, đáy y=0, tâm xz=0)
+ manifest (`size`). Đặt vào level bằng `BarricadeDef.model/size` (xác xe: collider + cover 4 mặt) hoặc `PropDef` (collider/cover tuỳ chọn, `roll` cho xe ngã).

Tham số hình ảnh: `?quality=low|medium|high` · `?post=off|low|medium|high` (low = bloom+FXAA, medium = +GTAO, high = +SSR chỉ WebGPU) ·
`?taa=1` (TRAA thử nghiệm) · `?assets=0` (lite: không model/HDRI) · `?character=0` (lính procedural) · `?weapons=0` (súng procedural) · `?cones=0` · `?splash=0` ·
`?fps=60|120|0` (cap khi chơi, mặc định 60 — màn 120 Hz đỡ giật; bench không cap) · `?arms=0` (tắt cánh tay FP).

Hiệu chỉnh tay cầm súng (TIP-017, chỉ dev/`?debug=1`): `?calib=soldier&post=off&rain=0` (lính đứng yên, đèn sáng, camera orbit `&az=&el=&dist=&h=`) hoặc `?calib=fp` (góc nhìn thứ nhất). Console: `__ht.calib.pose('aim')`, `.fit()` (khớp súng vào pose animation), `.measure()`, `.setHand('L', pos, rot)`, `.exportJson()` → dán vào `content/weapons/<id>.json` mục `fp`.

## Credits

Tài sản bên thứ ba liệt kê đầy đủ trong [`CREDITS.md`](CREDITS.md) (sinh từ manifest). CC-BY 4.0 (ghi công bắt buộc, ADR-006):
"AK-74M Assault Rifle" by FJH · "HK 416 A7" by r4m · "Low-poly BTR-70" by veightyfive · "Abandoned Wrecked Bus" by BytesCrafter · "Burned-out Cars" by Renafox ·
"Lightbody '90 MD Utility" by Daniel Zhabotinsky · "Ural 4320" by Brout · "Old Scooter" by Nadia Ribitis · "Mi-24 Hind" by Duane's Mind · "Sandbag Wall 02/05" by Pypunk (Sketchfab).
CC0: Poly Haven (texture, HDRI, prop). Nhân vật + animation: Adobe Mixamo.

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

TIP-010 (hình nhân lính 12 bone, mưa mảnh, súng góc nhìn thứ nhất, tracer/flash/spark): bench:quick PASS 119.9 FPS, p95 9.1 ms → G0 đóng.

## G0.5 — Look-dev slice (ADR-005)

Chủ nhà đánh giá G0 "game thập niên 90" → chèn look-dev trước G1: TIP-011 render pipeline (IBL, post stack, texture PBR CC0, hình khối cảng),
TIP-012 nhân vật Mixamo, TIP-013 súng + FX chân thực. Mục tiêu: một góc arena đạt "chân thực điện ảnh" đêm mưa cảng Vạn Hải, bench vẫn PASS.
Cả ba TIP DONE trong sandbox (WebGL 2, CI xanh) — chờ Chủ nhà `npm install && npm run bench:quick` rồi chơi trên Mac WebGPU (SSR chỉ thấy ở đó).
TIP-014 (ADR-006): súng thật CC-BY — người chơi AK-74M (ADS theo đường ngắm, reload băng đạn, bolt giật, sprint hạ súng), địch HK416 + lửa nòng/tracer/đèn từ đầu nòng.
TIP-015 (hotfix sau bench Mac): SSR r185 trộn sai → vệt đen (sửa), GTAO/mưa theo số đo, cap 60 fps khi chơi; đo trên M1 Max: high 86.7 fps p95 17.2 (trước 60.5 / 33 ms).
TIP-016: cánh tay góc nhìn thứ nhất (mesh tay Mixamo `scripts/extract-arms.mjs` + IK bám anchor súng, `content/weapons/*.json` mục `fp`).
