# Đường về Sài Gòn — Gate G0′ (kế thừa engine Hải Tuyến)

FPS chiến dịch chơi đơn, điện ảnh, chạy trực tiếp trên trình duyệt (Three.js WebGPU + TSL, Rapier, Recast), 8 nhiệm vụ từ Trường Sơn 1971 đến Sài Gòn 30/4/1975, "thật đến từng cái dép" — mọi chi tiết lịch sử có nguồn trong `content/registry/`.

Repo fork từ engine **Hải Tuyến (HT-MB)** tại `8745ba3` (ADR-D01): renderer, physics, nav, AI, weapons, level JSON, pipeline asset, test và quy trình giữ nguyên; content Hải Tuyến (arena đêm, Phố Vạn Hải) chỉ còn là **fixture bench/E2E** (`?level=arena` mặc định, `?level=pho`), không phải content game.

Nguồn yêu cầu: `docs/PRD.md` (v0.2) · kịch bản `docs/story/KICH-BAN-v0.1.md` · khế ước `docs/BLUEPRINT-G1.md` · quyết định `docs/DECISIONS.md` (DV-xxx) · ADR `docs/ADR/` · TIP `docs/tips/TIP-Dxx.md` · evidence `evidence/`. Tài liệu HT-MB cũ: `docs/legacy/`.

Lộ trình: **G0′** (fork, nợ perf, KTX2, registry 1971, prototype terrain DEM + rừng) → **G1** lát cắt "Cổng Trời" 15 phút → G1.5 M1 hoàn chỉnh (đêm, AC-130) → G2 Hồi I → G3 Hà Nội → G4 Hồi III → G5/G6.

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
```bash
npm run assets:ktx2       # KTX2/Basis toàn bộ texture (ADR-D04, TIP-D02): JPG rời → .ktx2, GLB → KHR_texture_basisu; chỉ mã hoá file chưa KTX2; chậm (WASM), chạy nền
npm run assets:validate   # validator (TIP-D02): license allow-list, CC-BY attribution, sha256, historical→registryId, 100 % KTX2, file lạc, tam giác theo tiền tố
```
**Mọi pipeline asset kết thúc bằng `npm run assets:ktx2`** — JPG/WebP không được vào `public/assets` (validator/unit test chặn). Transcoder Basis (`public/basis/`, three r185, Apache-2.0) nạp qua `src/engine/render/loaders.ts`.
`public/assets/` (≈120 MB KTX2, đã commit) là bản tối ưu; nguồn gốc nằm ở `assets-src/` (gitignore; texture Poly Haven tải lại được bằng `fetch-assets --force <id>`).

Terrain DEM (TIP-D04, ADR-D05 — `?level=truong-son`): SRTM 1″ public domain qua Terrain Tiles on AWS →
`node scripts/terrain-bake.mjs --hgt assets-src/dem/N17E106.hgt --lat 17.55 --lon 106.10 --size 2048 --res 2 --id truong-son-a`
→ `public/assets/terrain/<id>/{height.r16,meta.json,preview.png}`; navmesh bake: `node scripts/terrain-bake.mjs --nav --id truong-son-a --yOffset 691.2 --navRect -192 512 512 512`
→ `nav.bin` (+ manifest); thêm `--level content/levels/truong-son-a.level.json` để bake **obstacle thân cây** (bot đi vòng cây, DV-040); `node scripts/find-clearing.mjs <x> <z> 300 18 0.08` tìm bãi trống tự nhiên trong rừng scatter (điểm treo đổ quân/LZ, DV-042). Bầu trời (TIP-D-SKY): khối `airTraffic` của level → `engine/sky` (lịch bay seeded, model `air_*` mũi +x, node tên `rotor|blade|prop` quay). Level: `content/levels/truong-son-a.level.json` (schema `terrain-level.schema.json`; spawn/waypoint theo x/z, y từ terrain). Nhân vật Mixamo (Swat Guy + 8 clip,
tải bằng tài khoản Adobe): FBX trong `assets-src/mixamo/` (xem `docs/tips/TIP-012.md`) → `node scripts/convert-mixamo.mjs` (FBX2glTF, gộp clip,
texture 2K JPEG, meshopt) → `assets-src/mixamo/soldier-swat.glb` (giữ bản gốc, không commit) → **lính QGP 1971** (TIP-D11a):
`node scripts/retexture-1971.mjs` (bỏ gear hiện đại, sơn lại atlas: vải Tô Châu từ Poly Haven CC0 `assets-src/polyhaven/stretch_poplin/`, tay trần)
→ `node scripts/extract-arms.mjs` (tay FP) → `node scripts/ktx2.mjs --only models --filter soldier` → `public/assets/characters/{soldier,soldier_arms}.glb`
+ manifest `soldier_mixamo` (historical, `registryId uni.pavn.1971.field_uniform_green`, `approved: false`). Mũ cối + bao xe dựng procedural (`src/engine/render/gear1971.ts`, gắn bone `Head`/`Spine2`).

Rừng loài thật (TIP-D05, ADR-D06 — CC-BY Sketchfab, kiểm rip DV-026): nguồn `assets-src/sketchfab/<slug>/` + cấu hình `content/vegetation/species.json` (node biến thể, material lá, chiều cao, tỉ lệ LOD, attribution) →
`node scripts/convert-vegetation.mjs [--only id,id]` (chuẩn hoá gốc/chiều cao, 3 LOD: tỉa thẻ lá + meshopt simplify, `_WIND`, material `leaf_*/bark_*` MASK) → `node scripts/ktx2.mjs --only models`
→ `public/assets/vegetation/<id>.glb` + manifest `veg_<id>`. Đặt cây bằng khối `vegetation` trong level terrain JSON (seed, rect, luật mỗi loài: perHa/slope/height/noise/clump/lod/cast/collider) —
`?level=truong-son` có rừng mặc định; `?veg=0` tắt, `?veg=1` bật cả khi `assets=0`, `?vegDensity=0.5&vegLod=0.8&vegShadow=0&impostor=0` để A/B; `__ht.vegetationStats()`, `__ht.setWind(0.9)`.
Bầu trời (TIP-D-SKY): khối `airTraffic` trong level terrain (lượt bay seeded F-4/UH-1/A-1/C-130, treo đổ quân, dù phi công; model manifest `air_*` — thiếu → bỏ lượt); `?sky=0` tắt, `?sky=1` bật khi lite, `?skyModel=<id>` ép model (CI: `veh_mi24`); `__ht.skyStats()`, `skyAdvance(s)`, `skyDrop(x,y,z)`.
Cỏ procedural (không asset ngoài, CC0): `node scripts/gen-grass.mjs [--seed 7 --tex 512]` → `grass.glb` + manifest `veg_grass` (`source: procedural`) → KTX2. Luật cây thêm `sink` (chôn gốc theo dốc), `noiseId` (mọc theo trường noise loài khác), `press` (đè cỏ). Khói/lửa xa: khối `fx` trong level terrain (kind smoke/fire, position x/z, `height` cột khói m).

Vũ khí glTF (TIP-014, ADR-006 — CC-BY Sketchfab, Chủ nhà đăng nhập, Thợ tải): nguồn `assets-src/sketchfab/<slug>/` →
`npm run assets:weapon -- --src assets-src/sketchfab/ak74m --id weapon_ak74m --length 0.943 --title … --author … --url …` →
`public/assets/weapons/<id>.glb` + manifest (attribution); cấu hình anchor/pose ở `content/weapons/<id>.json` (schema `weapon-model.schema.json`).
`npm run assets:credits` sinh `CREDITS.md`; màn capability hiển thị credit CC-BY.

Model xe/khí tài/prop (TIP-021, D-060 — CC-BY Sketchfab, **không nhận asset rip từ game**: đọc mô tả/tag/tên material trước khi tải):
`npm run assets:model -- --src assets-src/sketchfab/<slug> --id veh_<slug> --length 7.1 --title … --author … --url … --use …`
(`--scale`, `--pre x:90` xoay trước khi căn trục, `--flip`/`--yaw90`, `--keep/--drop` node, `--merge-mats`, `--no-join` giữ pivot rotor, `--split-joints rotor_01,tail_rotor_02:z` tách cánh quạt từ skin thành node pivot quay được, `--texture 1024`) → `public/assets/models/<id>.glb` (dài theo +x, đáy y=0, tâm xz=0)
+ manifest (`size`). Đặt vào level bằng `BarricadeDef.model/size` (xác xe: collider + cover 4 mặt) hoặc `PropDef` (collider/cover tuỳ chọn, `roll` cho xe ngã).

Tham số hình ảnh: `?quality=low|medium|high` · `?post=off|low|medium|high` (low = bloom+FXAA, medium = +GTAO, high = +SSR chỉ WebGPU) ·
`?taa=1` (TRAA thử nghiệm) · `?assets=0` (lite: không model/HDRI) · `?character=0` (lính procedural) · `?weapons=0` (súng procedural) · `?cones=0` · `?splash=0` ·
`?fps=60|120|0` (cap khi chơi, mặc định 60 — màn 120 Hz đỡ giật; bench không cap) · `?arms=0` (tắt cánh tay FP).

Hiệu chỉnh tay cầm súng (TIP-017, chỉ dev/`?debug=1`): `?calib=soldier&post=off&rain=0` (lính đứng yên, đèn sáng, camera orbit `&az=&el=&dist=&h=`) hoặc `?calib=fp` (góc nhìn thứ nhất). Console: `__ht.calib.pose('aim')`, `.fit()` (khớp súng vào pose animation), `.measure()`, `.setHand('L', pos, rot)`, `.exportJson()` → dán vào `content/weapons/<id>.json` mục `fp`.

## Credits

Tài sản bên thứ ba liệt kê đầy đủ trong [`CREDITS.md`](CREDITS.md) (sinh từ manifest). CC-BY 4.0 (ghi công bắt buộc, ADR-006):
"AK-74M Assault Rifle" by FJH · "HK 416 A7" by r4m · "Low-poly BTR-70" by veightyfive · "Abandoned Wrecked Bus" by BytesCrafter · "Burned-out Cars" by Renafox ·
"Lightbody '90 MD Utility" by Daniel Zhabotinsky · "Ural 4320" by Brout · "Old Scooter" by Nadia Ribitis · "Mi-24 Hind" by Duane's Mind · "Sandbag Wall 02/05" by Pypunk · "AK 47" by Aleksei Vlasov (CRWDE) · rừng: "Tree GN" by Node_λrt · "Free Bamboo Set" by JonhGillessen · "Banana Tree" by DJMiddi · "Tropical Plants Pack M02P" by MozzarellaARC · "Elephant Ear Plant" by BANDANNA (Sketchfab).
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
