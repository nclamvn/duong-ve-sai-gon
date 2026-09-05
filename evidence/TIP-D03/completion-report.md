# Completion Report — TIP-D03 (Registry lịch sử, lượt 1)

STATUS: DONE (lượt 1) — lượt 2 nâng P chờ cố vấn/Chủ nhà duyệt

## FILES CHANGED
- Mới: `content/registry/{uniforms,weapons,vehicles,aircraft,places,timeline,daily-life}.yaml`, `content/schemas/registry.schema.json`, `scripts/validate-registry.mjs` + `.d.mts`, `tests/unit/registry.test.ts`, `docs/history/M1.md`, `docs/ADR/ADR-D03-registry-yaml.md`, `evidence/TIP-D03/registry-report.json`.
- Sửa: `content/schemas/asset-manifest.schema.json` (+`historical`, `registryId`, `approved`), `package.json` (`yaml@2.9.0` pin, `registry:check`).

## TEST RESULTS
- `npm run registry:check`: 7 file, 20 fact, 0 lỗi — aircraft 3 (S2 X1), places 4 (S4), timeline 4 (S4), uniforms 5 (S3 H2), vehicles 1 (S1), weapons 3 (S3), daily-life 0.
- unit `registry.test.ts` 2/2 (schema/id/provenance; ≥ 15 fact, ≥ 60 % P/S → 85 % S).
- Validator liên kết manifest: `historical` không có `registryId` → lỗi (test bằng schema; chưa có asset historical nào).

## ISSUES
- (High cho D11) **Chưa có fact P** nào: nguồn lượt 1 là báo (Nhân Dân, Dân trí, Dân Việt) và Wikipedia — tier S. Quân phục Tô Châu và bao xe chỉ H (chưa có nguồn) → asset nhân vật 1971 không được `approved` cho tới khi có hiện vật/ảnh bảo tàng.
- (Medium) "Cổng Trời" chưa có fact vị trí; thám báo ở Lào 1971, OV-10, CKC/K-54/DShK, Gaz-63, TNXP nữ 1971, daily-life M1 chưa có — `docs/history/M1.md` liệt kê đủ.
- (Info) vi.wikipedia không fetch được từ sandbox (cache-only) — dùng báo Việt và en.wikipedia.

## DEVIATIONS
- Registry YAML cần dep `yaml` (ADR-D03) — chỉ dùng script/test, không vào bundle runtime.

## SUGGESTIONS
- Lượt 2 (Chủ nhà + refinery): Bảo tàng Lịch sử Quân sự VN, Bảo tàng Đường Hồ Chí Minh, sách "Lịch sử Bộ đội Trường Sơn", ảnh TTXVN có ngày — để nâng uniforms/weapons/places lên P và điền daily-life.
- Cân nhắc trường `image_ref` (đường dẫn ảnh tham chiếu nội bộ, không phân phối) cho fact P để cố vấn/Thợ đối chiếu asset.
