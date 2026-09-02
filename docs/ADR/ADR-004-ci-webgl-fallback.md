# ADR-004: CI chỉ xác minh đường WebGL 2; WebGPU đo trên thiết bị chuẩn

**Status:** Accepted · 2026-09-02 · Scan gap G-01

## Context
Sandbox build (Linux, không GPU) chạy Chromium 141 headless: `navigator.gpu` không tồn tại dù bật `--enable-unsafe-webgpu` với 6 tổ hợp flag; WebGL 2 chạy qua SwiftShader. PRD §4.1 đã yêu cầu mọi số hiệu năng phải đo trên chính M1 Max.

## Decision
- Playwright project `webgl-ci`: boot `?backend=webgl`, kiểm lifecycle (không exception, mission hoàn thành, checkpoint restore, bench POST). Không dùng số FPS từ đây.
- Playwright project `webgpu` (`HT_WEBGPU=1`, channel `chrome`, headed) chạy trên Mac: kiểm backend `webgpu`, adapter info, không device lost.
- Mọi `performance-report.json` sinh trong sandbox gắn `evidence_status: sandbox_swiftshader_lifecycle_only`; chỉ report có `measured_on_reference_device` mới được dùng cho phán quyết G0.

## Consequences
- (+) Fallback path được test liên tục (REN-001 yêu cầu smoke cả hai).
- (−) Regression WebGPU-only chỉ bắt được khi chạy trên Mac → đưa `npm run e2e:webgpu` vào checklist mỗi TIP render.
