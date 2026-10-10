# Completion Report: DV-061 (gói phe hư cấu) + DV-062 (lớp bảo vệ asset)

evidence_status: sandbox_swiftshader_lifecycle_only

STATUS: PARTIAL (phần code xong; mô hình lính thật chờ Chủ nhà tải từ Sketchfab và itch vì cần đăng nhập)

FILES CHANGED
- created: `src/engine/render/pakCrypto.ts`, `src/engine/render/pak.ts`, `scripts/pack-assets.mjs`, `content/assets/pak.json`, `public/assets/pak/6702e008f92db68e.dvpak`, `content/factions/factions.json`, `src/game/factions.ts`, `src/engine/render/gearFactionA.ts`, `tests/unit/pak.test.ts`, `tests/unit/factions.test.ts`, `evidence/DV-061/*`
- modified: `src/engine/render/loaders.ts` (PakGltfLoader), `src/engine/render/assets.ts` (assetExists thay HEAD), `src/engine/render/camo.ts` (bảng màu), `src/engine/render/gearUS1971.ts` (bảng màu mũ), `src/engine/render/characters.ts` (skin camo_b), `src/game/actors/visual.ts`, `src/game/actors/dummy.ts`, `src/game/game.ts` (factionPack, weaponIdFor, lookFor), `scripts/validate-assets.mjs`, `scripts/convert-ab3dx-vm.mjs`, `content/schemas/asset-manifest.schema.json`, `content/assets/manifest.json`, `package.json` (assets:pack, assets:validate), `tests/e2e/boot.spec.ts`, `AGENTS.md`, `docs/DECISIONS.md`, `docs/ROADMAP-AAA.md`
- removed from public: `public/assets/weapons/ak47_vm.glb` (bản trần, nay ở `assets-src/pak-src/weapons/`)

TEST RESULTS
- typecheck: 0 lỗi
- unit: 191/191 (thêm pak 3, factions 3)
- validate-assets: 112 asset, 0 lỗi; pack-assets --check OK
- E2E boot.spec 7/7 trên build production: viewmodel AB3DX nạp qua `/assets/pak/<hash>.dvpak`, không có request `ak47_vm.glb`; phe hư cấu (A: AK + `gear_boonie_hat`; B: M16A1 + `gear_m1_helmet`), gói lịch sử giữ đúng DV-046
- E2E toàn bộ (webgl-ci, build production): 17/17 passed (14,0 phút)
- Ảnh: `phe-fictional.png` (trái phe A, phải phe B), `phe-historical-1971.png` (so sánh)

ISSUES
- (thấp) Ngoại hình hai phe vẫn là thân Mixamo Swat vẽ lại + đồ procedural; đích là mô hình trong danh sách chọn DV-061.
- (thấp) Khoá giải mã nằm trong bundle: chống lấy file thông thường, không chống người quyết tâm (đúng phạm vi "biện pháp hợp lý").
- (trung bình) Repo trên GitHub: lịch sử git cũ vẫn chứa `ak47_vm.glb` trần từ DV-055. Repo đang private nên rủi ro thấp; nếu sau này công khai repo phải xoá khỏi lịch sử.

DEVIATIONS
- Giải mã bằng WebCrypto (bất đồng bộ, native) thay vì Web Worker như mô tả trong danh sách chọn: WebCrypto đã không chặn luồng chính, thêm worker không có lợi.

SUGGESTIONS
- Khi có file Sketchfab: viết `scripts/convert-soldier.mjs` (đổi tên xương theo soldier.glb để dùng lại clip Mixamo, giảm lưới về ≤ 25k, KTX2, xoá phù hiệu bằng vẽ lại atlas), rồi trỏ gói phe tới mô hình mới.
