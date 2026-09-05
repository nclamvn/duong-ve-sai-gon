# Completion Report — TIP-D02: Nợ perf + KTX2 + validator asset (G0′)

STATUS: **DONE** (2 mục deferred, liệt kê dưới)

## FILES CHANGED
Tạo mới
- `scripts/ktx2.mjs` — KTX2 toàn bộ: texture rời JPG → `.ktx2` (ETC1S diff q160 sRGB / arm q128 linear, UASTC normal RDO), GLB WebP/JPEG → `KHR_texture_basisu`; cập nhật manifest; idempotent (`--only`, `--filter`, `--dry`, `--keep-src`).
- `scripts/validate-assets.mjs` + `.d.mts` — validator (license allow-list, CC-BY attribution, bytes/sha256, `historical → registryId`, texture rời phải KTX2, GLB không còn `image/*` khác ktx2, file lạc, tam giác theo tiền tố WARN/`--strict-tris`).
- `scripts/terrain-bake.mjs` — SRTM 1″ `.hgt` → `height.r16` + `meta.json` + `preview.png` (nền D04, xem DEVIATIONS).
- `src/engine/render/loaders.ts` — một `KTX2Loader` (transcoder `${BASE_URL}basis/`, `detectSupport(renderer)`), `createGltfLoader()` (Meshopt + KTX2).
- `public/basis/basis_transcoder.{js,wasm}` (three r185 examples, Apache-2.0).
- `public/assets/terrain/truong-son-a/{height.r16,meta.json,preview.png}` + manifest entry `terrain_truong_son_a` (`PD-USGov`, `aws-terrain-tiles`).
- `tests/unit/validate-assets.test.ts`; `docs/ADR/ADR-D04-ktx2-pipeline.md` (+ bổ sung ngân sách payload); `docs/tips/TIP-D02.md`; `contracts/TIP-D02.yaml`; `evidence/TIP-D02/*`.

Sửa
- `public/assets/**`: 110 file mã hoá (63 texture rời `.ktx2`, 47 GLB), JPG xoá khỏi `public/` (nguồn còn `assets-src/`). Manifest 145,2 MB → **113,4 MB** (−31,8 MB; gồm +2,1 MB ô terrain).
- `src/engine/render/{assets,weaponModel,characters,fpArms}.ts` — nạp qua `loaders.ts`; `loadTex` `.ktx2` (colorSpace theo loại, `RepeatWrapping`, anisotropy).
- `src/engine/level/facade.ts` — `SignAtlas` (2×10 ô 1024×192 / trang 2048×1920, `remapUv`), biển hiệu gộp 1 mesh/trang, `castShadow = false`; giữ `makeSignTexture()` cho calib.
- `src/engine/level/builder.ts` — InstancedMesh prop `computeBoundingSphere()` + `frustumCulled = true`.
- `content/assets/manifest.json`, `content/schemas/asset-manifest.schema.json` (type `terrain`, source `aws-terrain-tiles`, license `PD-USGov`).
- `config/performance-budget.json` — `initial_payload_mb` 250/400, `level_total_mb` 2500/4000 (PRD v0.2 §11, ADR-D04, DV-013).
- `tests/unit/assets.test.ts` — đọc target từ budget JSON, chấp nhận `PD-USGov`.
- `package.json` — devDep `ktx2-encoder@0.6.0` (pin), scripts `assets:ktx2`, `assets:validate`; `package-lock.json`.
- `docs/DECISIONS.md` — DV-012 … DV-017.

## TEST RESULTS (theo AC)
| AC | Kết quả |
|----|---------|
| `npm run assets:validate` 0 lỗi; 100 % texture KTX2 | **PASS** — 72 asset, 113,4 MB, 0 lỗi, 0 cảnh báo; 63/63 texture rời `.ktx2`, 47/47 GLB chỉ `image/ktx2` |
| Draw `?level=pho&quality=medium` giảm ≥ 150 cùng góc, không lỗi console | **PASS 4/5, deferred 1/5** — spawn −186, a3 −225, b **−146**, c −182, station −183 (TB −184, −27 %); 0 lỗi console; trước 3/5 góc vượt đỏ 650, sau 0/5 (`draws-before-after.txt`, `pho-*.png`) |
| `npm run ci` xanh với KTX2 trên WebGL2 | **PASS** — typecheck OK; unit 17 file / **106/106**; build 4,1 s; e2e webgl-ci **7/7** (bench, boot ×3, level-pho vật lý, mission ×2) — `ci.txt` |
| Mac WebGPU màu đúng (sRGB), không hồng/đen | **CHỜ CHỦ NHÀ** — sandbox chỉ kiểm WebGL2 (transcode RGBA); ảnh probe màu đúng trên WebGL2 |

## ISSUES
- (Thấp) Góc b thiếu 4 draw so với mục tiêu −150 (2,7 %); không tinh chỉnh thêm — phần còn lại (xuống 400) thuộc LOD/impostor D05 và gộp mesh nhà theo dãy D08.
- (Thấp) Tam giác 2,1–3,25 M ở pho, 3/5 góc vượt target 2,5 M (0 vượt đỏ 4 M) — nợ ghi ở DV-014, xử lý ở D05.
- (Ghi nhận) KTX2 làm GLB nhân vật **to hơn trên đĩa** (soldier 6,85 → 11,46 MB; UASTC normal) nhưng bộ nhớ GPU giảm 4–6× và không giải nén JPEG; tổng manifest vẫn giảm 32 MB nhờ texture rời.
- (Ghi nhận) Mã hoá chậm: 35 phút cho 110 file (WASM một luồng); chạy nền, idempotent — chấp nhận ở G0′; nếu G1 thêm 150 bộ texture thì cân nhắc `toktx` trên Mac (ADR bổ sung).

## DEVIATIONS
1. **Thêm nền D04 ngoài scope gốc** (L1, không đổi kiến trúc): `terrain-bake.mjs` + ô `truong-son-a` + entry manifest/schema/allow-list `PD-USGov`. Vì validator quét file lạc trong `public/assets`, ô terrain phải vào manifest ngay; và cần xác nhận sớm sandbox tải được DEM (điều kiện cần của D04). Toạ độ ô chính thức chốt ở D04 (DV-016).
2. `initLoaders(renderer, BASE_URL)` — đường transcoder `${BASE_URL}basis/`, không phải `${BASE_URL}assets/basis/` (lỗi boot "Unexpected identifier 'html'" — DV-017); thêm probe boot arena + pho vào quy trình trước khi đo.
3. Evidence log đặt `.txt` (`*.log` bị gitignore — kế thừa HT-MB).
4. Budget payload sửa theo PRD §11 (DV-013) trong TIP này thay vì TIP riêng — có ADR-D04 bổ sung; không nới để "đạt" (manifest 113 MB dưới cả mốc cũ 150).

## SUGGESTIONS (cho Chủ thầu)
- D04: dùng `truong-son-a` làm ô đầu tiên của `engine/terrain` (r16 1025², 2 m); LOD quadtree 4 mức, splat 4 lớp, heightfield collider Rapier, navmesh bake theo ô; E2E vật lý bắt buộc (DV-009).
- D05: đo Mac trước/sau trên `?level=pho` cùng 5 góc (script `pho-dvsg.mjs` có thể chạy trên Mac với Chrome thật) để có số WebGPU; probe tam giác theo góc cho LOD.
- Sau TIP này Chủ nhà cần: `npm install` (devDep mới `ktx2-encoder`), mở `?level=pho` và `?level=arena` WebGPU kiểm màu (đường nhựa xám, tay găng rằn ri, biển đỏ chữ trắng — không hồng, không đen), rồi push.
