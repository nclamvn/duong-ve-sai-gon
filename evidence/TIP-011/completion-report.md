## COMPLETION REPORT — TIP-011: Look-dev slice — render pipeline, môi trường, vật liệu thật (G0.5)

**STATUS:** DONE (sandbox WebGL2) — **chờ Chủ nhà xác nhận trên M1 Max WebGPU** (bench:quick + nhìn)

**FILES CHANGED:**
- Created: `scripts/fetch-assets.mjs` (Poly Haven API → `public/assets/`, manifest có sha256/bytes/license/authors, `--verify`), `scripts/optimize-models.mjs` (glTF-Transform: weld → meshopt simplify 0.25 → dedup/prune → quantize → reorder → EXT_meshopt_compression → .glb), `content/assets/manifest.json` (18 asset CC0, **35.4 MB**), `content/schemas/asset-manifest.schema.json`, `tests/unit/assets.test.ts` (4), `tests/unit/arena.test.ts` (hash "sự thật" ArenaData).
- Created: `src/engine/render/assets.ts` (texture diff/nor_gl/arm 1K, 9 GLB meshopt, HDRI → PMREM), `src/engine/render/geometry.ts` (metricBox/metricCylinder UV theo mét, container 20 ft, crate, pallet+crate, cuộn cáp, thùng phuy có gân, cột đèn, splash ring), `src/engine/render/post.ts` (RenderPipeline: MRT output/normal/metalness/roughness → GTAO 0.5× → SSR 0.5× (reflectNonMetals cho sàn ướt) → bloom → AgX+sRGB → FXAA/TRAA → film grain 0.08 → vignette 0.32).
- Rewritten: `src/engine/render/materials.ts` (createWetGround texture + vũng nước + gợn mưa TSL; createTexturedMaterial tint/rust overlay/normal/AO từ arm; emissive HDR; nón volumetric; lampGlowAt), `src/engine/render/arena.ts` (visual cảng trên CÙNG collider: container 4 màu + khung thép, 200 prop = crate/pallet/cuộn cáp gộp 2 mesh, 60 thùng phuy instanced, 6 cột đèn natri + 4 đèn pha nóc container, biển "CẢNG VẠN HẢI" emissive (i18n `sign.port`), ~50 prop glTF CC0 nóc container + chân tường), `src/engine/render/lighting.ts` (IBL HDRI đêm 0.12, trăng 0.55 + shadow, 10 SpotLight không shadow, nón additive, fog 0.02), `src/engine/render/rain.ts` (hạt sáng trong nón đèn, 512 splash ring GPU-only).
- Modified: `quality.ts` (+post/assets/splashCount/lightCones/taa; `?post= ?assets=0 ?splash= ?cones=0 ?taa=1`), `backend.ts` (exposure 1.0; tone map AgX khi có post), `game.ts` (loadAssets → buildArena(assets, signText) → createLighting(env, lamps) → createRain(lamps) → `post.render()`), `fx.ts` (flash/tracer/spark HDR giảm cho bloom; đèn nòng decay 1, 3.5 cd), `vite.config.ts` (`assetsDir: 'bundle'` để `/assets/` là CC0), `content/locale/vi.json` (+sign.port, loading.assets), `.gitignore` (assets-src/), `package.json` (+`assets`, `assets:verify`, `models:optimize`; devDeps @gltf-transform/{core,extensions,functions} 4.5.0, meshoptimizer 1.2.0 — chỉ script, không vào bundle).
- Docs: `docs/ADR/ADR-005-lookdev-slice-asset-policy.md`, `docs/tips/TIP-011..013.md`.

**TEST RESULTS:** 6/6 AC (sandbox) — AC1 (Chủ nhà chấm) và AC2 (bench Mac) **chờ**
- AC1 Ảnh WebGPU high trên Mac — **chờ Chủ nhà**. Sandbox WebGL2 (SwiftShader, 1280×800): `evidence/TIP-011/{overview,container,lamp}-{low,medium,high}-webgl.png` — sàn asphalt ướt phản chiếu, container rỉ, crate/pallet/cuộn cáp/thùng phuy texture thật, đèn natri có bloom + nón, mưa sáng dưới đèn, splash, biển hiệu, AO chân crate (medium/high).
- AC2 bench:quick Mac — **chờ**. Sandbox: draw 249 (WebGL) / tris 1.02 M ở overview (từ 163 / 120 k) — trong budget 400 / 2.5 M.
- AC3 CI `?quality=low&backend=webgl`: `npm run ci` exit 0 — 84 unit (12 file) + 6 E2E (4.6 min, tải asset trong SwiftShader ~33 s/boot). 0 lỗi console ở cả 3 tier.
- AC4 Manifest: schema pass, 18 asset, mọi file tồn tại + sha256 khớp, 35.4 MB ≤ 60 MB; `assets.ts` chỉ dùng id có trong manifest.
- AC5 Collider: `arenaTruthHash(7) = 6a9af6f2…d34b66` **giống hệt** trước/sau (unit test khoá) — physics/nav/AI không đổi; chuỗi prng của props/drum giữ nguyên, trang trí dùng fork `arena-deco`.
- AC6 governance.test 0 vi phạm; i18n 0 literal.

**ISSUES DISCOVERED:**
- [High→fixed] `smoothstep(a, b, x)` với a > b (tôi viết 3 chỗ: nón đèn, rust mask, lampGlow) là undefined trong GLSL/WGSL → nón đèn hiện thành kim tự tháp đặc. Sửa thành `smoothstep(b, a, x).oneMinus()`. **Bài học ghi AGENTS**: không bao giờ đảo cạnh smoothstep.
- [High→fixed] Đèn pha nóc container 1600 cd chiếu thẳng vào camera ở 7 m → sàn cháy trắng + bloom phủ nửa màn hình (tưởng là flash). Giảm 260 cd, góc 0.5. Đèn nòng 70 cd decay 1.8 → súng sát đèn cháy trắng → 3.5 cd decay 1.
- [Blocker WebGL2, ghi known-issue] three r185 `SSRNode` sinh GLSL `max(int(trunc(...)), 1.0)` → shader fragment không compile trên backend WebGL 2 (WGSL không bị). SSR chỉ bật khi `backend === 'webgpu'`; fallback high = GTAO + bloom + FXAA. **Không thể xác minh SSR trong sandbox — cần Mac.**
- [Medium, tắt mặc định] TRAA trên WebGL2 sandbox làm ảnh tối ~60% sau 12 frame (history/velocity nghi sai trên WebGL). Để `?taa=1` cho Chủ nhà thử trên WebGPU; mặc định FXAA.
- [Low] `PMREMGenerator.fromEquirectangularAsync` cảnh báo deprecated (r185: dùng `await renderer.init()` rồi `fromEquirectangular`). Đổi ở TIP sau.
- [Low] Boot sandbox 33 s (PMREM + 27 texture + 9 GLB trong SwiftShader); E2E 4.6 min. CI vẫn dưới timeout; nếu cần nhanh: `?assets=0` (lite).
- [Info] `draw_calls` 249 WebGL (cũ 163 WebGPU) — 4 lớp container + khung + 2 mesh gộp props + drums + ~50 prop glTF clone (mỗi clone 1–8 draw). Nếu WebGPU đếm cao (BatchedMesh đã bỏ), cân nhắc InstancedMesh per model ở TIP-013.

**DEVIATIONS FROM SPEC:**
- Props glTF CC0 chỉ đặt **trên nóc container và sát chân tường** (không collider) — thay vì thay hộp/trụ trong bãi (kích thước không khớp collider; đổi collider là đổi navmesh/AI). Crate/pallet/cuộn cáp procedural có texture thật khớp collider 1:1.
- TRAA không bật mặc định (xem issue). SSR không có trên WebGL2 (bug three).
- Chưa KTX2 (ADR-005 nợ); texture 1K JPG, tổng 35.4 MB.

**SUGGESTIONS FOR CHỦ THẦU:**
- Chủ nhà: `cd ~/Desktop/hai-tuyen && npm install && npm run bench:quick` → gửi verdict + ảnh overlay; rồi `npm run dev` mở `http://127.0.0.1:5173/?autostart=1` chơi 2 phút. Nếu WebGPU lỗi shader: thử `?post=medium`, `?post=low`, `?post=off` để khoanh vùng pass.
- Nếu SSR trên WebGPU đúng: đây là lúc chụp "hero shot" cho D-6; nếu p95 vượt 18.5 ms → giảm `ssr.resolutionScale` 0.5 → 0.35 hoặc `gtao.samples` 12 → 8 (không hạ toàn cục).
