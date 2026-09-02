# ADR-003: recast-navigation-js, navmesh sinh runtime ở G0

**Status:** Accepted · 2026-09-02 · Quyết định D-003

## Context
PRD §3 chọn recast-navigation-js (WASM Recast/Detour, helper Three) [S09] và §4 yêu cầu navmesh pre-baked cho CPU. Ở G0 arena greybox thay đổi liên tục theo TIP.

## Decision
`recast-navigation@0.43.1` (+ `@recast-navigation/three`, `/generators`). Navmesh sinh lúc boot từ `ArenaData.navGeometry` (solo navmesh, cs 0.3 / ch 0.2). Pre-bake + serialize (`exportNavMesh`) chuyển sang G2 khi layout ổn định.

## Consequences
- (+) Không có pipeline bake phải bảo trì khi greybox còn đổi.
- (−) Boot tốn thêm ~50–200 ms; đo và ghi trong telemetry `nav_build_ms`.
- Import mặc định dùng `wasm-compat` (inline) → chạy trong Node cho unit test path query.
