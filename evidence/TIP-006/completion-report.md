## COMPLETION REPORT — TIP-006: AR weapon greybox

**STATUS:** DONE

**FILES CHANGED:**
- Created: `content/tuning/weapons.json` (ar_v1: rpm 720, mag 30/120, damage head 60/body 24, reload 1900, ADS 180 ms/FOV 55, pattern 10 viên, noise 0.15, spread hip/ads/crouch/air, penetration allow wood/tarp ≤ 0.3 m ×0.6, maxStateMs)
- Created: `src/game/weapons/stateMachine.ts` (IDLE/FIRING/RELOADING/EMPTY/SWAPPING, bảng chuyển tường minh, maxDurationMs fallback + counter, ADS lerp độc lập, auto-reload khi EMPTY, snapshot/restore), `recoil.ts` (pattern + noise seeded, clamp 8°, reset 250 ms, viewKick tách khỏi aim offset), `hitscan.ts` (applySpread nón deterministic, resolveShot: zones, penetration allow-list + thickness, tối đa 1 lần xuyên), `weapon.ts` (Weapon: SM + recoil + hitscan + ammo; chỉ phát event WEAPON_FIRED/HIT/IMPACT/RELOAD_*/WEAPON_EMPTY; onViewKick callback), `fx.ts` (decal 256 InstancedMesh ring, casing 64 với gravity, tracer 16, muzzle 1 mesh — không `new` sau constructor; stats)
- Created: `src/engine/audio/audio.ts` (bus master/sfx/dialogue/radio/music, ducking, PannerNode HRTF cho impact, gunshot 3 lớp noise burst, voice counter ≤ 32 + dropped), `src/game/actors/actorPhysics.ts` (capsule body + ball head trên kinematic body, layer ACTOR, userData zone/actorId)
- Modified: `src/game/game.ts` (actor registry, weapon step sau player trước physics.step, HIT → dummy.applyDamage → ACTOR_DIED + disable collider, audio hooks, HUD ammo/spread, ADS → player FOV, reset)
- Created: `tests/unit/weapon.test.ts` (11 test)

**TEST RESULTS:** 6/6 AC pass · unit 52/52 · typecheck 0 · build OK
- AC1 spam 1000 input seeded, tick 1 ms → state luôn hợp lệ, không state vượt maxDurationMs, fallbacks = 0, ammo ∈ [0, 30]: PASS
- AC2 giữ cò: EMPTY đúng 30 viên sau ≈ 2.5 s → auto reload → RELOAD_END sau ≥ 1880 ms với mag 30, reserve 90; ammo bảo toàn: PASS
- AC3 RecoilTracker seed 1: 2 lần chạy cùng chuỗi kick; 40 viên → pitch ≤ 8°; sau 267 ms không bắn → shotIndex 0: PASS
- AC4 100 shot ADS 0.25° nhắm đầu 10 m → ≥ 95 head; hip moving 3.2° → < 60: PASS. Zones head 60 / body 24; miss → concrete.
- AC5 pool 256 với 18 000 tick bắn: factory calls = 256, không tăng: PASS (mô phỏng bằng Pool core trong unit; WeaponFx thật đếm `stats.created = 84` cố định trong browser probe)
- AC6 5 phút bắn (18 000 tick): event ring giữ 512, `impacts === fired === kicks`, ammo bảo toàn: PASS
- Penetration: gỗ 0.2 m → 2 kết quả, damage ×0.6; thép → 1 kết quả. Determinism: cùng seed → cùng chuỗi `WEAPON_FIRED.dir`.
- Browser probe (WebGL2): teleport trước dummy_0 6 m, ADS bắn → 2 head hit (60+60) → dummy chết, collider tắt, 5 shot sau đó IMPACT sàn; HUD "23 / 120 dự trữ"; decals 7, casings 7, tracer 1; 0 lỗi console. Screenshot `evidence/TIP-006/weapon-webgl.png`.

**ISSUES DISCOVERED:**
- [Low] Muzzle flash là plane phẳng gắn camera → hiện thành tam giác giữa màn hình ở góc nhìn headless. Greybox chấp nhận; G4 thay bằng sprite/billboard TSL.
- [Low] Dummy chết xoay group −90° quanh gốc chân → nằm dọc theo hướng nhìn, trong ảnh trông như capsule dựng. Không ảnh hưởng gameplay.
- [Info] AudioContext không khởi tạo trong headless (không user gesture) → `audio.ctx = null`, mọi call no-op. Đúng thiết kế; trên Mac click đầu tiên sẽ mở.

**DEVIATIONS FROM SPEC:**
- Spec ghi "reload bị hủy nếu spam? → không" — đã giữ: RELOADING không bị pressFire cắt. Nhưng `pressReload` khi mag đầy bị bỏ qua (spec không nói) — L1.
- Audio dùng PannerNode trực tiếp thay vì `THREE.PositionalAudio` (cùng PannerNode bên dưới [S12]) để không kéo AudioListener/Object3D vào bus logic; ducking/priority ở G0 là hàm `duck(ms)` gọi từ radio cue (TIP-008). L1.
- Casing/tracer cập nhật `instanceMatrix.needsUpdate` mỗi frame (64 + 16 matrix = 5 KB upload) — chấp nhận, nhỏ hơn 1 draw call; không phải "object mỗi hạt".

**SUGGESTIONS FOR CHỦ THẦU:**
- `recoilPattern` hiện là số bịa hợp lý; PRD §9.1 yêu cầu video 10 s hip→ADS→fire→reload ở 60 FPS do người chơi xem — nên chạy trên Mac khi bench (dùng `?freefly=0` mặc định + pointer lock).
- Đề nghị TIP-007 dùng cùng `resolveShot` cho bot (spread 4°, damage 8) để hai bên chung một luật hitscan.
