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
| D-024 | Chủ nhà | G0 bench trên M1 Max: 3 × 90 s PASS (p95 9.1 ms, GPU 2.4 ms, 0 hitch) | evidence/G0/performance-report-2026-09-02T11-47-08-682Z.json |
| D-025 | Thầu | **Phán quyết G0 = GO** (PRD §10.1), kèm điều kiện bench:quick sau TIP-010 vẫn PASS | docs/VERIFY.md vòng 2 |
| D-026 | Chủ nhà | Địch phải là hình người ấn tượng (không khối trụ); mưa nhỏ/mờ; có súng góc nhìn thứ nhất; tracer mảnh + tóe lửa nòng | Review trực tiếp sau bench → TIP-010 |
| D-027 | Thợ (L1) | Soldier procedural 12 bone, 1 SkinnedMesh/actor, visor emissive qua attribute; hitZones giữ nguyên để không đụng hitscan/test | TIP-010 |
| D-028 | Thợ (L1) | Muzzle PointLight luôn trong scene (intensity 0 khi nghỉ) — tránh recompile shader khi đổi số đèn | TIP-010 |
| D-029 | Thợ (L1) | Telemetry: tổng ms chỉ trong ring, capacity 16384, `duration_s` từ wallMs | TIP-010 bug fps_avg |
| D-030 | Thầu | governance.test grep vùng cấm AGENTS.md (Math.random/ShaderMaterial/engine→game/content TS) chạy trong `npm test` | Verify vòng 2 bắt Math.random |
| D-031 | Thầu | E2E screenshot có SkinnedMesh phải render qua rAF (`renderFramesRaf`) — three r185 cập nhật skeleton theo frameId | TIP-010 D-8 |
| D-032 | Chủ nhà | bench:quick sau TIP-010 PASS (119.9 FPS, p95 9.1 ms, GPU 2.5 ms, draws 321, tris 120k) → G0 đóng hẳn | ảnh overlay 2026-09-02 22:21 |
| D-033 | Chủ nhà | G0 "nghèo nàn, cảm giác game thập niên 90" → cần chân thực: texture, súng, làn đạn, tia lửa, kẻ địch, vật thể | Review sau khi chơi |
| D-034 | Chủ nhà | Chính sách asset: **Mixamo** (nhân vật/animation, tự tải) + **CC0** (Poly Haven/ambientCG/Kenney/Quaternius/Sketchfab CC0); manifest license từng file | ADR-005 |
| D-035 | Chủ nhà | Chèn **G0.5 Look-dev slice** trước G1 (đổi thứ tự gate PRD, ADR-005) | ADR-005 |
| D-036 | Chủ nhà | Hướng hình ảnh: **chân thực điện ảnh** — đêm mưa cảng Vạn Hải | ADR-005 |
| D-037 | Thợ (L1) | Prop glTF CC0 chỉ đặt nơi không cần collider (nóc container, chân tường); prop trong bãi = procedural có texture khớp collider 1:1; `arenaTruthHash` khoá | TIP-011 |
| D-038 | Thợ (L1) | SSR chỉ WebGPU (SSRNode r185 sinh GLSL lỗi trên WebGL 2); TRAA tắt mặc định (`?taa=1`) | TIP-011 known-issue |
| D-039 | Thợ (L1) | Texture 1K JPG, ≤ 60 MB ở slice; KTX2 nợ trước G4; Vite `assetsDir: bundle` để `/assets/` là CC0 | ADR-005 |
| D-040 | Thầu | Luật TSL thêm vào AGENTS: không đảo cạnh `smoothstep` (undefined) — dùng `.oneMinus()` | TIP-011 bug nón đèn |
