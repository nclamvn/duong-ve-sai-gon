## COMPLETION REPORT — TIP-005: Physics + Player controller + Input + Settings

**STATUS:** DONE

**FILES CHANGED:**
- Created: `src/engine/physics/layers.ts` (WORLD/PLAYER/ACTOR/TRIGGER, InteractionGroups helper), `world.ts` (PhysicsWorld: static từ ArenaData, kinematic capsule + ball zone, castRay có mask/exclude + userData, hasLineOfSight), `controller.ts` (CapsuleController: KinematicCharacterController, autostep 0.35/0.2, slope 50°, snap 0.3, walk/sprint/crouch/jump thấp, accel/decel, canStand ray, stateHash, eye(alpha) nội suy), `src/engine/input/pointerLock.ts` (unadjustedMovement + fallback counter)
- Created: `src/game/player/camera.ts` (CameraRig 4 lớp: look/bob+landing/recoil/shake, intensity từ settings, recoil không ghi vào yaw/pitch), `settings.ts` (Settings + sanitize clamp, IndexedDB store ~40 dòng + memory fallback, SettingsStore áp dụng tức thời), `player.ts` (Player: step 60 Hz, render(alpha) → camera, aimDirection, snapshot/restore, damage)
- Created: `content/tuning/player.json`, `src/ui/hud.ts` (health/ammo/objective/prompt/crosshair, DOM diff)
- Modified: `src/game/game.ts` (initPhysics, PhysicsWorld từ 273 collider ArenaData, Player làm cameraDriver, settings → player/input/pointer lock, HUD, physics.step trong sim, free-fly chỉ khi ?freefly=1)
- Created: `tests/unit/controller.test.ts` (10 test)

**TEST RESULTS:** 6/6 AC pass · unit 41/41 · typecheck 0 · build OK
- AC1 đi thẳng vào tường 3 s (sprint): x dừng ở 4.15 < 4.5 − r; y ≥ 0; grounded: PASS
- AC2 bậc 0.3 m → y = 0.32 khi trên bậc; bậc 0.6 m → bị chặn (z > −2.35, y < 0.05): PASS
- AC3 determinism: 2 world độc lập, track seed 3, 600 tick → stateHash bằng nhau: PASS
- AC4 spam jump 240 tick → nhảy 3–14 lần, |vy| ≤ 4, không tích lũy: PASS
- AC5 sensitivity 2 → yaw ×2; invertY → pitch đổi dấu; update → store → SettingsStore mới load() giữ nguyên (memory store trong unit; **IndexedDB thật trong browser**: probe `settings.store.kind === 'indexeddb'`, `get('settings')` trả `{sensitivity 2.5, invertY true}`): PASS
- AC6 recoil kick 2° + 300 ms hồi → yaw/pitch gốc không đổi, recoilPitch < 10% kick: PASS
- Browser probe (WebGL2 headless): Player sprint 180 tick từ z=40 → z=21.8 (≈ 6.5 m/s × 3 s), camera eye y = 1.67, grounded, 0 lỗi console.

**ISSUES DISCOVERED:**
- [Low] Khi grounded, vy giữ −0.5 rồi trừ gravity → hash hiện `vy = −0.66`; là giá trị "giữ tiếp xúc" cho snap-to-ground, không phải rơi. Ghi chú để người đọc hash không hiểu nhầm.
- [Low] Playwright screenshot timeout khi loop đang chạy trên SwiftShader (frame 500+ ms) → E2E TIP-009 sẽ `game.stop()` trước khi chụp.

**DEVIATIONS FROM SPEC:**
- Rapier `castRayAndGetNormal` chỉ trả kết quả sau `world.step()` đầu tiên → PhysicsWorld không có "query trước step"; Game luôn step trong sim nên không ảnh hưởng. Ghi để TIP-006/007 biết khi test đơn vị (gọi `w.step()` trước khi cast).
- Crouch dùng `collider.setHalfHeight` (đổi shape tại chỗ) thay vì 2 collider — đơn giản, deterministic. L1.
- `camera.ts`/`player.ts` import math từ `'three'` (three.core) thay vì `'three/webgpu'` để test trong Node không kéo renderer; cùng class vì cả hai re-export three.core. Ghi thêm vào AGENTS.md §3.

**SUGGESTIONS FOR CHỦ THẦU:**
- Game feel (bob/landing/accel) chỉ mới là số mặc định trong `player.json`; PRD §9.2 nói rõ phải người chơi thật đánh giá → đề nghị đưa vào G1 review với video 10 s như §9.1.
- Nên thêm `?spawn=x,y,z` cho QA teleport nhanh ở E2E (sẽ có `__ht.teleport` ở TIP-008).
