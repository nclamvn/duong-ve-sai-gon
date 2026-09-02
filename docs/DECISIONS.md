# Decisions Log — HT-MB G0 (gom từ RRI + Completion Reports + Verify)

| ID | Ai | Quyết định | Lý do / nguồn |
|----|----|-----------|---------------|
| D-001 | Thầu | Pin three 0.185.1 hết G0 | ADR-001 |
| D-002 | Thầu | rapier3d-compat (WASM inline) | ADR-002; unit test Node |
| D-003 | Thầu | Navmesh sinh runtime ở G0 | ADR-003 |
| D-004 | Thầu | HUD DOM/CSS thuần | PRD §3 |
| D-005 | Chủ nhà | Auto-approve Blueprint | RRI Q3 |
| D-006 | Chủ nhà | Repo về ~/Desktop/hai-tuyen (lam-local) | RRI Q2 |
| D-007 | Chủ nhà | Thầu điều khiển Chrome trên Mac để bench | RRI Q4 |
| D-008 | Thầu | Code/identifier/dev-log tiếng Anh; UI/phụ đề/docs tiếng Việt | UX-002; i18n.test grep |
| D-009 | Thầu | mulberry32 seeded, fork theo label; không Math.random | WPN-002, §8 |
| D-010 | Thầu | RRI rút gọn 4 câu | PRD đã là RRI đầy đủ |
| D-011 | Thầu | Settings IndexedDB + memory fallback | A11Y-002 |
| D-012 | Thầu | Dummy procedural, không asset | PRD §9.2 |
| D-013 | Thợ (L1, Thầu chấp nhận) | Budget 15 metric (FPS tách avg/1% low) | TIP-001 |
| D-014 | Thợ (L1) | KeyboardMouseInput kéo lên TIP-004 để bench hoán đổi input | TIP-004 |
| D-015 | Thợ (L1) | Telemetry đọc `drawCalls` (per-frame) thay vì `calls` (tích lũy) | TIP-003 bug |
| D-016 | Thợ (L1) | Module logic import math từ 'three' core; render từ 'three/webgpu' | TIP-005; AGENTS §3 |
| D-017 | Thợ (L1) | Audio PannerNode trực tiếp thay PositionalAudio | TIP-006 |
| D-018 | Thợ (L1) | Bot engageRange = sightRange 40; PEEK_FIRE reset stateMs khi bắn | TIP-007 |
| D-019 | Thợ (L1) | Phụ đề chạy theo sim time | TIP-008 |
| D-020 | Thợ (L1) | stateHash bỏ tick/timers/checkpointId/actor FSM state | TIP-008 |
| D-021 | Thợ (L1) | Report sandbox → evidence/sandbox, không lẫn evidence/G0 | TIP-009 |
| D-022 | Thầu | Sandbox không có WebGPU → CI verify WebGL2; WebGPU + bench chỉ trên Mac | ADR-004 |
| D-023 | Thầu | VERIFY = READY-với-deferred; phán quyết G0 chờ số đo reference device | docs/VERIFY.md |
