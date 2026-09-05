# TIP-D02: Nợ perf + KTX2 + validator asset (G0′)

## HEADER
- TIP-ID: TIP-D02 · Project: DVSG · Module: `scripts/ktx2.mjs`, `scripts/validate-assets.mjs` (+`.d.mts`), `src/engine/render/loaders.ts` (mới), `assets.ts`, `weaponModel.ts`, `characters.ts`, `fpArms.ts`, `src/engine/level/facade.ts` (atlas biển hiệu), `builder.ts` (culling instanced), `public/basis/` (transcoder), `public/assets/**` (KTX2), `content/assets/manifest.json`, ADR-D04, `tests/unit/validate-assets.test.ts`
- Dependencies: D01 · Priority: P0 · Effort: 24 h Thợ

## TASK
1. **KTX2 toàn bộ** (PRF-004, ADR-D04): texture rời JPG → `.ktx2` (ETC1S diff/arm, UASTC normal, mipmap), GLB WebP/JPEG → `KHR_texture_basisu`; runtime `KTX2Loader` + `GLTFLoader.setKTX2Loader`; manifest cập nhật; JPG xoá khỏi `public/` (nguồn còn ở `assets-src/`).
2. **Nợ perf (HT-MB TIP-026):** atlas biển hiệu (57 mesh + 57 CanvasTexture → ≤ 4 mesh/atlas trang, không đổ bóng), InstancedMesh prop có bounding sphere + frustum culling (trước đây `frustumCulled=false`); đo `?level=pho` trước/sau bằng probe sandbox (WebGL2) — số Mac do Chủ nhà đo ở D05.
3. **Validator asset:** license allow-list, CC-BY attribution, sha256/bytes, `historical → registryId`, texture rời phải KTX2, GLB không còn texture thường, file lạc ngoài manifest, cảnh báo tam giác theo tiền tố (chr_/wpn_/veh_/air_/veg_/prop_). Chạy trong unit test + `npm run assets:validate`.

## ACCEPTANCE CRITERIA
- Given `npm run assets:validate`, Then 0 lỗi; mọi texture trong `public/assets` là KTX2.
- Given `?level=pho&quality=medium` probe sandbox, Then draw giảm ≥ 150 so với TIP-021 (650–740) ở cùng góc nhìn; không lỗi console.
- Given `npm run ci`, Then xanh (unit + e2e) với KTX2 trên WebGL2 (SwiftShader transcode RGBA).
- Given boot WebGPU trên Mac (Chủ nhà), Then texture hiển thị đúng màu (sRGB), không hiện hồng/đen.

## BỔ SUNG TRONG KHI THI CÔNG (ghi DEVIATIONS trong completion report)
4. **Nền tảng cho D04 (không trong scope gốc, L1 — không đổi kiến trúc):** `scripts/terrain-bake.mjs` (SRTM 1″ `.hgt` → `height.r16` + `meta.json` + `preview.png`), ô thử `public/assets/terrain/truong-son-a/` (17,55°N 106,10°E, 2048 m @ 2 m) đưa vào manifest với type `terrain`, source `aws-terrain-tiles`, license `PD-USGov` (schema + validator mở rộng tương ứng). Lý do: validator quét file lạc trong `public/assets` nên ô terrain phải có trong manifest ngay; tải DEM từ sandbox thành công là điều kiện cần của D04 — kiểm sớm để D04 không bị chặn. Toạ độ ô chính thức chốt ở D04 (DV-016).
5. `loaders.ts` nhận `BASE_URL` để đặt đường transcoder `${BASE_URL}basis/` (DV-017).
