# ADR-002: @dimforge/rapier3d-compat, fixed timestep 1/60

**Status:** Accepted · 2026-09-02 · Quyết định D-002

## Context
PRD §3 chọn Rapier (WASM, character controller, fixed timestep) [S08]. Gói `rapier3d` yêu cầu bundler xử lý `.wasm` + top-level `import`; gói `-compat` nhúng WASM base64 và `await RAPIER.init()`, chạy được cả trong browser lẫn Node (Vitest).

## Decision
Dùng `@dimforge/rapier3d-compat@0.20.0`. `PhysicsWorld.timestep = 1/60`, step chỉ trong vòng sim của `FixedClock`. Controller là `KinematicCharacterController` (không rigid body động cho player) để determinism và feel dễ kiểm soát.

## Consequences
- (+) Unit test controller/hitscan chạy trong Node, determinism kiểm bằng `stateHash()`.
- (+) Không cần cấu hình wasm loader trong Vite.
- (−) Payload lớn hơn ~30% so với `.wasm` tách rời; chấp nhận ở G0 (ngân sách payload 150 MB còn xa). Xem lại tại G4 khi tối ưu payload.
