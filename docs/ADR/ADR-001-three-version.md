# ADR-001: Pin Three.js 0.185.1 cho Gate G0

**Status:** Accepted · 2026-09-02 · Quyết định D-001

## Context
PRD §3 chọn `three/webgpu` WebGPURenderer + TSL với WebGL 2 fallback. Tài liệu Three vẫn đánh dấu WebGPURenderer là experimental và có thể chậm hơn WebGLRenderer ở một số scene [S04]. Mỗi bản phát hành Three (hàng tháng) có thể đổi API TSL/node.

## Decision
Pin chính xác `three@0.185.1` (latest stable tại ngày quyết định) và `@types/three@0.185.4`. Không nâng version trong suốt G0. Nâng chỉ tại ranh giới gate, kèm ADR mới và benchmark A/B (replay cùng seed, cùng build hash device) trước/sau.

## Consequences
- (+) Shader/TSL không đổi hành vi giữa các TIP; benchmark so sánh được.
- (+) Regression do version được cô lập khỏi regression do code.
- (−) Có thể bỏ lỡ fix WebGPU mới; chấp nhận, đưa vào checklist gate.
- Rollback: `npm ci` với lockfile trong `snapshots/G0/`.
