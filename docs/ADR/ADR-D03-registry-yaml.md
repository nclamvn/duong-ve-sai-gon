# ADR-D03: Registry lịch sử dạng YAML + dependency `yaml` 2.9.0

- Trạng thái: **Chấp nhận** (2026-09-05, TIP-D03)

## Bối cảnh
PRD v0.2 §9 định nghĩa 7 registry lịch sử (uniforms, weapons, vehicles, aircraft, places, timeline, daily-life) là SOT của "thật", mỗi fact có provenance P/S/H/X, nguồn, trạng thái tranh chấp, và được asset/kịch bản tham chiếu bằng id. Quy trình cào–lọc–làm giàu và registry-hygiene của Chủ nhà làm việc trên YAML.

## Quyết định
1. Registry là YAML tại `content/registry/<name>.yaml`, schema JSON tại `content/schemas/registry.schema.json`, validator `scripts/validate-registry.mjs` (chạy trong unit test + CI).
2. Thêm dependency `yaml` 2.9.0 (MIT, không dependency con), pin chính xác; chỉ dùng trong script/test/build-time, **không** trong bundle runtime (runtime đọc bản JSON sinh ra `content/registry/*.json` khi cần).
3. Mỗi fact: `id` (`<registry>.<nhóm>.<slug>`), `value`, `provenance_level` ∈ {P, S, H, X}, `sources[]` (url, title, publisher, accessed, quote ≤ 300 ký tự), `disputed`, `used_by[]`, `notes`. Fact H/X không được asset `approved` tham chiếu; validator chặn.

## Hệ quả
- `npm install` trên Mac sau khi pull (deps thay đổi).
- Manifest asset thêm trường `registryId` (tuỳ chọn cho asset "vô danh", bắt buộc cho asset lịch sử — validator kiểm khi `historical: true`).
