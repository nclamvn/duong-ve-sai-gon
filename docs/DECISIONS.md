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
| D-051 | Thợ (L1) | SSRNode r185: alpha = khoảng cách hit → **cộng thẳng** rgb, không trộn theo alpha (TIP-011 sai → vệt đen trên Mac); dielectric dùng metalness tối thiểu 0.22 cho sàn ướt | TIP-015 đo trên Mac |
| D-052 | Thợ (L1) | Mưa 20k → 9k (high), GTAO 12 → 8 mẫu: đo M1 Max 1920 px mưa ≈ 2 ms, GTAO ≈ 3.8 ms; nhìn tương đương — ghi rõ, không phải hạ chất lượng ngầm | TIP-015 |
| D-053 | Thợ (L1) | Frame pacing: cap 60 fps khi chơi (màn 120 Hz + frame 9–10 ms → xen kẽ 8.3/16.7 = giật); `?fps=` đổi, bench không cap | TIP-015 |
| D-054 | Thầu | Timestamp GPU tổng các pass chồng lấn trên GPU Apple → loại mẫu > 1.05 × frame, NA khi đa số; `frame_p95` là trần GPU. Không sửa budget | TIP-015 |
| D-055 | Chủ nhà | Góc nhìn thứ nhất phải thấy cánh tay trái (áo + bao tay) như tham chiếu CoD — chỉ tham chiếu tư thế, không dùng asset CoD | Yêu cầu 2026-09-03 → TIP-016 |
| D-056 | Thợ (L1) | Tay FP = mesh tay lọc từ Swat Guy (cùng skeleton) + IK 2 khớp bám anchor gripR/gripL của súng (offset bone trong JSON `fp`); không dùng clip animation tay → mọi pose/reload tự đúng | TIP-016 |
| D-057 | Chủ nhà | Sau khi chơi (2026-09-03): AI coding làm được game, nhưng phải sửa (1) súng không nằm trên tay — FP và địch ("súng treo trước ngực"), (2) AI địch "IQ quá tệ" (đứng trước mặt không bắn), (3) thay bối cảnh đêm-hộp bằng **đô thị ban ngày khói lửa, nhiều màu, có khí tài/xe** — một màn "wow" chứng minh AI coding + quy trình | Yêu cầu 2026-09-03 → ADR-007, Blueprint G0.6 |
| D-058 | Chủ nhà | Bối cảnh màn mới: **Vạn Hải sáng hôm sau bão** — giữ lore PRD §6, nhà ống nhiều màu, biển hiệu Việt, đổ nát + giao tranh | RRI G0.6 Q1 |
| D-059 | Chủ nhà | Quy mô: **một khu phố 160 × 120 m, 3 điểm giao tranh** (đầu phố / chợ / ngã tư), 8–10 phút, 2 đồng đội bắn hỗ trợ | RRI G0.6 Q2 |
| D-060 | Chủ nhà | Asset: mở rộng **CC-BY Sketchfab cho mọi loại** (xe, nhà, prop) + Poly Haven CC0, credit bắt buộc; **khí tài dạng kịch bản** (spline, kinematic, không lái) | RRI G0.6 Q3, ADR-007 |
| D-061 | Chủ nhà | Thứ tự: **TIP-017 súng trong tay + TIP-018 AI trước**, rồi màn mới (TIP-019..026) | RRI G0.6 Q4 |
| D-062 | Thầu | X-Ray tay cầm: offset súng bone tay ước lượng bằng ảnh tối → grip lệch ~15 cm khỏi ngón trỏ, tay trái lính không IK; AI: FSM cover-first — thấy địch là chạy đi tìm cover (không bắn khi di chuyển), không cover thì vẫn chu kỳ peek/ẩn 1,8/1,4 s nên đứng yên không bắn | Probe `bot2.mjs`, `grip.mjs` 2026-09-03 |
| D-063 | Thợ (L1) | Một sự thật "bàn tay ở đâu trên súng": `fp.handR/handL` (bone tay trong hệ anchor) dùng cho cả tay FP (thuận) lẫn lính (nghịch đảo); bỏ trường `hand`; số lấy từ **fit 2 điểm trên clip `rifle_aim`** (gripR = tâm cung ngón phải, gripR→gripL theo hai tay; span Mixamo 0,306 m ≈ HK416 0,308 m) qua `?calib=soldier` — không chỉnh bằng mắt nữa | TIP-017 |
| D-064 | Thợ (L1) | Bug TIP-016: IK dùng chung scratch `_q2` → hướng bàn tay FP sai ~17° (test armIk bắt được) → `armIk.ts` tách scratch, thêm test; độ dài đốt đo trong hệ root (không lẫn scale tổ tiên) | TIP-017 |
| D-065 | Thợ (L1) | Viewmodel "FOV" bằng nhóm scale (k,k,1) con của camera: súng + cánh tay **kích thước thật, khoảng cách thật** (tầm với 0,5 m tới ốp lót) mà hình chiếu y hệt FOV hẹp (k = 0,62); IK chạy khi scale tạm 1 rồi ép lại; đèn fill 1,1 → 0,45 cd | TIP-017 (tay trái không với tới ốp lót ở hip: 0,46 m > 0,31 m) |
| D-066 | Thầu | AI TIP-018: bắn trước – di chuyển sau (ENGAGE phản xạ 250–450 ms), bắn khi di chuyển trong nón trước mặt, cover chỉ khi chắn LOS ≤ 12 m, không cover thì đứng bắn + dịch chuyển ngắn, tổ ≥ 2 → 1 bot ép sườn ≥ 60°, nghe tiếng chân chạy ≤ 9 m, đạn sượt → nấp; ngắm ngực, spread 6° → 3° sau 1,5 s | TIP-018, test ai.test 15/15 |
