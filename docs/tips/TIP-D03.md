# TIP-D03: Registry lịch sử — skeleton 7 file, schema, validator, lượt cào–lọc 1 cho 1971 (G0′)

## HEADER
- TIP-ID: TIP-D03 · Project: DVSG · Module: `content/registry/*.yaml`, `content/schemas/registry.schema.json`, `scripts/validate-registry.mjs` (+ `.d.mts`), `tests/unit/registry.test.ts`, `docs/history/M1.md`, `content/schemas/asset-manifest.schema.json` (historical/registryId/approved), ADR-D03, dep `yaml@2.9.0`
- Dependencies: — (song song D01) · Priority: P0 · Effort: 24 h Thợ + 3 h Chủ nhà duyệt

## TASK
1. Schema fact (id theo prefix registry, value, year, force, provenance_level P/S/H/X, sources{url,title,publisher,accessed,quote≤300,tier}, disputed/dispute_note, used_by, notes).
2. Validator: schema + id duy nhất + P/S có nguồn + P cần nguồn tier P + X có dispute_note + asset `historical` phải có `registryId` + asset `approved` không trỏ H/X. Chạy trong unit test và `npm run registry:check`.
3. Lượt 1: cào–lọc fact cho M1/M2 1971 từ nguồn kiểm được (Nhân Dân, Dân trí, Dân Việt, Wikipedia — tier S) với trích nguyên văn; fact chưa có nguồn ghi H thẳng thắn; con số hai bên khác nhau ghi X.
4. `docs/history/M1.md`: bảng chi tiết kịch bản ↔ fact ↔ trạng thái ↔ việc còn lại.

## ACCEPTANCE CRITERIA
- Given `npm run registry:check`, Then 7 file, 0 lỗi, báo cáo P/S/H/X từng registry.
- Given lượt 1, Then ≥ 15 fact, ≥ 60 % P/S (cổng G0′); mọi fact H có `notes` nói rõ thiếu gì.
- Given asset manifest có `historical: true`, Then thiếu `registryId` → test fail.
