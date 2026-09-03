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
| D-041 | Chủ nhà | "Tải assets hộ tôi" → Thợ tải Mixamo (Swat Guy + 8 clip rifle/hit/death) qua trình duyệt tích hợp với tài khoản Adobe đã đăng nhập; không nhập mật khẩu; FBX nguồn gitignore, sha256 vào manifest | TIP-012 |
| D-042 | Thợ (L1) | Texture Mixamo 4K PNG → JPEG 2K khi convert (GLB 92.6 → 7.2 MB); `sharp` devDep; KTX2 vẫn nợ G4 | TIP-012 |
| D-043 | Thợ (L1) | Mixamo không kèm vũ khí → AR procedural gắn bone RightHand, offset rot (π/2,0,π) pos (0,0.05,−0.07) calibrate bằng ảnh; thay GLB CC0 sau nếu Chủ nhà chọn | TIP-012 evidence rifle-*.png |
| D-044 | Thợ (L1) | Hit zone giữ tĩnh (không bám bone) ở G0.5 — rig chuẩn hoá 1.82 m trùng Dummy; nợ G1 khi có tư thế cúi/ngã | TIP-012 deviation |
| D-045 | Chủ nhà | Làm ngay trước G1: lửa nòng tại súng địch + súng model thật cho địch **và** người chơi ("hoàn hảo về vũ khí của mình") | Yêu cầu 2026-09-03 → TIP-014 |
| D-046 | Chủ nhà | Mở chính sách asset sang **CC-BY (Sketchfab)** cho vũ khí, credit bắt buộc (README/CREDITS/UI); người chơi **AK-74M**, địch **AR-15/HK416** | ADR-006; Thợ rà CC0 không có súng hiện đại đạt chuẩn |
| D-047 | Thợ (L1) | Pipeline `convert-weapon.mjs` chuẩn hoá hệ súng tự động (nòng −z, lên +y, gốc trên trục nòng) + `--drop/--cut` bỏ prop trang trí; cấu hình anchor/pose là JSON `content/weapons/` (schema) | TIP-014 |
| D-048 | Thợ (L1) | Súng PBR đen chìm vào đêm → viewmodel dùng material riêng (color ×1.25, metal 0.6, IBL 2) + đèn fill 1.1 cd con của root; bot có 1 PointLight nòng riêng (số đèn cố định) | TIP-014 evidence vm-*.png |
| D-049 | Thợ (L1) | ADS căn đường ngắm bằng anchor `sight` (0.34 m trước camera) thay vì pose tay chỉnh; reload nâng súng lên-giữa để thấy băng đạn tháo/lắp; sprint hạ súng | TIP-014 |
| D-050 | Thầu | Credit CC-BY sinh từ manifest → `CREDITS.md` + màn capability + README; `assets.test`/`weapons.test` chặn asset CC-BY thiếu attribution | ADR-006 |
