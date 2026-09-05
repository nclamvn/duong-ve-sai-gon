# ADR-D01: Fork engine HT-MB thành repo Đường về Sài Gòn

- Trạng thái: **Chấp nhận** (DV-006, 2026-09-05)

## Bối cảnh
Hai demo Hải Tuyến (arena đêm G0, Phố Vạn Hải G0.6) chứng minh engine Three.js WebGPU/TSL + Rapier + recast + level JSON + pipeline asset chạy 60–120 FPS trên máy chuẩn. Game mới (DVSG) cần toàn bộ engine, test, pipeline, quy trình — nhưng không cần lore/content Hải Tuyến.

## Quyết định
1. Fork tại `8745ba3` (master `hai-tuyen`), giữ lịch sử git để truy được mọi TIP/ADR cũ.
2. Content Hải Tuyến giữ nguyên trong repo làm **fixture test/bench**: `?level=arena` là mặc định (bench, E2E), `?level=pho` là test đô thị (E2E `level-pho.spec`). Không xoá cho tới khi M1 thay thế vai trò bench; khi đó chuyển vào `content/legacy/` bằng ADR mới.
3. Docs HT-MB (PRD, Blueprint, RRI, Verify, Decisions) → `docs/legacy/`; ADR-001..007 và `docs/tips/TIP-0xx` giữ nguyên đường dẫn (evidence cũ tham chiếu).
4. Tên gói `duong-ve-sai-gon`, version `0.1.0-g0p`; UI title đổi; schema `$id` đổi domain.
5. TIP mới đánh số `TIP-Dxx`; decisions `DV-xxx`; ADR `ADR-Dxx`.

## Hệ quả
- CI (typecheck, unit, build, e2e) phải xanh ngay sau fork — không có "sửa sau".
- Mac: `~/Desktop/duong-ve-sai-gon` clone từ `~/Desktop/hai-tuyen` rồi áp bundle; GitHub repo mới do Chủ nhà tạo và push.
- WIP TIP-023 (setpiece) ở nhánh `tip-023-wip` của repo cũ (DV-011).
