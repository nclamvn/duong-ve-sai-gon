## COMPLETION REPORT — TIP-003: Renderer backend + Benchmark Arena + Dynamic Resolution

**STATUS:** DONE (1 AC đo trong sandbox thay vì trên WebGPU — xem ISSUES)

**FILES CHANGED:**
- Created: `src/engine/render/backend.ts` (WebGPURenderer, forceWebGL/?backend=, adapter.info, timestamp-query capability, onDeviceLost → event), `scaler.ts` (QualityScaler hysteresis + cooldown), `lighting.ts` (1 sun shadow 2048 + 2 point + hemi + FogExp2), `materials.ts` (TSL wet ground: puddle noise → roughness/colour; prop/actor material), `rain.ts` (InstancedMesh 20 000, positionNode từ instanceIndex+time+cameraPosition — CPU không cập nhật buffer), `arena.ts` (ArenaData: 200 props BatchedMesh + 60 drum InstancedMesh + 8 cover + 4 tường + sàn; 273 collider, 213 nav mesh, 16 cover marker, 12 waypoint, zones, spawns), `telemetryHooks.ts`
- Created: `src/game/actors/dummy.ts` (SkinnedMesh capsule + 3 bone + head sphere, hitZones, applyDamage/reset), `src/game/game.ts` (integrator: FixedClock → Scheduler → render nội suy; reset hooks; scaler apply), `src/engine/input/freeFly.ts`, `src/ui/capability.ts`, `src/qa/debugApi.ts` (tối thiểu), `src/main.ts` (boot thật)
- Created: `tests/unit/scaler.test.ts` (4 test)
- Modified: `index.html` (favicon data: để bỏ 404)

**TEST RESULTS:** 6 AC — 5 PASS, 1 PASS-với-điều-kiện
- AC1 backend: `?backend=webgl` → capability screen ghi `webgl2`, cùng content path. PASS. Nhánh WebGPU **chưa chạy được ở sandbox** (ADR-004) → kiểm trên Mac ở TIP-009 `e2e:webgpu`.
- AC2 draw calls: WebGL2 headless `drawCalls = 63` (có shadow pass), 33 khi tắt batched → BatchedMesh = 1 draw nhờ `WEBGL_multi_draw`. PASS. **Lưu ý:** trên backend WebGPU r185, BatchedMesh phát 1 `drawIndexed`/instance trong cùng pipeline và `info.render.drawCalls` đếm từng cái → dự kiến ~260 trên Mac; đó là sub-draw không đổi state, không phải 260 draw call đúng nghĩa. Ghi vào telemetry note.
- AC3 8 dummy đều `SkinnedMesh`, `skeleton.bones.length === 3`. PASS. Bone xoay theo `simTime` (setPose) — probe 4 frame ở SwiftShader chưa đủ thấy đổi; kiểm lại ở E2E TIP-009 với ≥ 60 frame.
- AC4 rain GPU: 2 s render → `position.needsUpdate` set 0 lần, `instanceMatrix.needsUpdate` 0 lần. PASS.
- AC5 QualityScaler: 4/4 unit test (giảm về 0.65, tăng về 1.0, không dao động ở 15/19 ms, cooldown ≥ 30 frame). PASS.
- AC6 headless WebGL2 `?autostart=1`: 120 frame không exception; `__ht.metrics().frames ≥ 100`. PASS. Screenshot `evidence/TIP-003/arena-webgl.png`.

Số đo sandbox (evidence_status: sandbox_swiftshader_lifecycle_only): tris 91 703 (rain 20k) / 34 051 (rain 4k); CPU frame 1.4 ms; FPS thật ≈ 1–2 (SwiftShader) — vô nghĩa cho G0.

**ISSUES DISCOVERED:**
- [Medium] `renderer.info.render.calls` trong WebGPURenderer là tổng `render()` tích lũy, không phải draw call/frame → đã đổi sang `drawCalls`. Nếu không phát hiện, telemetry sẽ báo sai gấp hàng trăm lần.
- [Low] SwiftShader chậm (~1–2 FPS ở 1280×800 + shadow 2048 + rain 20k) → thêm `?rain=N&shadow=N` để CI chạy nhanh; không ảnh hưởng build Mac.
- [Low] Rain hạt sát camera (< 0.5 m) hiện thành vạch to. Chấp nhận ở greybox; G4 xử lý bằng fade theo khoảng cách.

**DEVIATIONS FROM SPEC:**
- Không dùng PMREM/RoomEnvironment cho "phản xạ giả": wet ground dùng roughness thấp + point light specular là đủ thấy vũng nước phản chiếu đèn (ảnh). Bỏ để giảm 1 render target ở G0. L1 — có thể thêm ở G4 khi có art.
- Cover marker: 2/khối (2 mặt dài) thay vì "4 mặt" → 16 marker; đủ cho 1 bot. L1.
- Free-fly được giữ lại dưới `?freefly=1` làm công cụ QA thay vì xóa ở TIP-005.

**SUGGESTIONS FOR CHỦ THẦU:**
- Đưa `drawCalls` + ghi chú "WebGPU batched sub-draw" vào README bench để người đọc số không hiểu nhầm khi so WebGL/WebGPU.
- Thêm preset `?quality=low|medium|high` (REN-002) ở TIP-004 để CI và Mac dùng cùng cơ chế thay vì tham số rời `rain`/`shadow`.
