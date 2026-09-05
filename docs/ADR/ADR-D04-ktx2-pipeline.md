# ADR-D04: KTX2/Basis cho toàn bộ texture + dependency `ktx2-encoder`

- Trạng thái: **Chấp nhận** (2026-09-05, TIP-D02) — trả nợ KTX2 của HT-MB (ADR-005 "KTX2 là nợ G4"), PRD DVSG PRF-004 "bắt buộc từ G2".

## Bối cảnh
Texture JPEG/WebP giải nén thành RGBA8 trên GPU (1K = 4–5,3 MB mỗi ảnh, chưa mipmap). Level 8 map, 150–200 bộ texture + ~150 texture trong GLB → bộ nhớ GPU vượt 3,5 GB. KTX2 (Basis Universal) transcode sang định dạng nén GPU (ASTC trên Apple, BC trên desktop, ETC2 trên mobile): 1K ETC1S ≈ 0,7 MB, UASTC ≈ 1,3 MB, có mipmap sẵn, tải nhanh hơn.

Sandbox không tải được `toktx` (KTX-Software, GitHub releases bị chặn); `ktx2-encoder` (MIT, WASM của basis_universal Apache-2.0) chạy trong Node bằng `sharp` giải mã, tích hợp gltf-transform (`KHR_texture_basisu`).

## Quyết định
1. `devDependencies`: `ktx2-encoder` **0.6.0** pin chính xác; chỉ dùng trong `scripts/ktx2.mjs`, không vào bundle.
2. Quy tắc mã hoá: diffuse/baseColor/emissive → **ETC1S q160 sRGB perceptual**; ORM/arm/khác → **ETC1S q128 linear**; normal → **UASTC** (normal preset, RDO λ1, level 1, zstd). Mipmap sinh lúc mã hoá. Kích thước giữ (1K mặc định, 2K hero).
3. Runtime: `src/engine/render/loaders.ts` — một `KTX2Loader` (transcoder `public/basis/` copy từ three r185 `examples/jsm/libs/basis`, Apache-2.0) `detectSupport(renderer)` sau `renderer.init()`; mọi `GLTFLoader` qua `createGltfLoader()` (Meshopt + KTX2); texture rời `.ktx2` qua `loadTex`.
4. Validator (`scripts/validate-assets.mjs`, unit test): texture rời phải `.ktx2`; GLB không còn `image/*` khác `image/ktx2`; fail CI.
5. Nguồn JPEG/WebP còn trong `assets-src/` (gitignore) và trong quy trình fetch/convert (fetch-assets tải JPG → ktx2.mjs mã hoá; convert-model/convert-weapon xuất WebP → ktx2.mjs). Bước `npm run assets:ktx2` là bước cuối của mọi pipeline asset.

## Hệ quả
- Mã hoá chậm (UASTC 1K ≈ 20–40 s WASM một luồng): chạy nền, chỉ mã hoá file chưa KTX2 (idempotent).
- WebGL2 fallback trên SwiftShader (CI) transcode về RGBA không nén — chỉ kiểm logic; chất lượng/hiệu năng đo trên Mac.
- `flipY` không áp dụng cho texture nén — texture rời tile theo worldUv nên không ảnh hưởng; glTF đã đúng chuẩn.

## Bổ sung — ngân sách payload
`config/performance-budget.json`: `initial_payload_mb` 150/250 (HT-MB, một arena) → **250/400** và `level_total_mb` 750/1200 → **2500/4000** theo PRD DVSG v0.2 §11 (payload một nhiệm vụ 8 map, KTX2). Đây là thay đổi theo PRD đã duyệt, không phải nới để "đạt": KTX2 làm GLB **to hơn trên đĩa** (WebP q88 rất nhỏ; UASTC normal 1K ≈ 1,3 MB) nhưng bộ nhớ GPU giảm 4–6× và không phải giải nén JPEG; số đo ghi ở evidence/TIP-D02.
