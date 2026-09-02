## COMPLETION REPORT — TIP-013: Súng và FX chân thực (viewmodel PBR, flash flipbook, khói/bụi, lỗ đạn, vỏ đạn đồng)

**STATUS:** DONE (sandbox) — chờ Chủ nhà chấm trên Mac cùng TIP-011/012

**FILES CHANGED:**
- Rewritten: `src/game/weapons/viewmodel.ts` — AR procedural PBR: RoundedBox vát cạnh (receiver, ốp lót, băng đạn cong, báng, tay cầm), rail picatinny 12 rãnh, 12 lỗ tản nhiệt, cửa thoát vỏ + viên đạn đồng lộ, cò + vòng cò, cần khoá, nút tháo băng, ống báng, đế cao su, giảm giật có khe; thép = `metal_plate` CC0 (normal + roughness từ arm) tint gunmetal/barrel/rail; polymer nhám + vết mòn (noise theo positionLocal); bao tay vải + 4 ngón ôm ốp + ngón trỏ trên cò. **Gộp geometry theo material → 7 draw** (trước ~60). Xuất `ejectWorld` (cửa thoát vỏ) cho FX.
- Created: `src/game/weapons/fxTextures.ts` — texture canvas procedural seeded (mulberry32): flipbook muzzle flash 4×4 (lõi + tia + đốm), khói mềm, lỗ đạn (tâm đen, vành ráp, vết nứt).
- Modified: `src/game/weapons/fx.ts` — muzzle flash = 2 quad flipbook (đĩa vuông góc nòng + cánh dọc nòng), frame ngẫu nhiên mỗi frame (nhấp nháy); **puff pool 40** (khói nòng 2/phát, bụi va chạm 3/impact; billboard CPU, alpha per-instance, nở √t, chậm dần); impact vào thép → 6 spark; decal dùng texture lỗ đạn + attribute `decalKind` (máu tint đỏ thẫm); vỏ đạn MeshStandard đồng (metalness 0.95) văng từ `ejectWorld`; `fx.stats.puffsActive`.
- Modified: `src/game/game.ts` — viewmodel nhận texture thép; `fx.ejectWorld`.

**TEST RESULTS:** `npm run ci` exit 0 — 84 unit + 6 E2E (5.0 min); 0 lỗi console; `fx.created` cố định (pool +40 puff).
- Ảnh sandbox medium: `evidence/TIP-013/{overview,container,lamp}-medium-webgl.png` — flash cầu lửa cam mềm + tia + spark, súng có rail/lỗ tản nhiệt/bao tay, ánh nòng trên sàn.
- Draw: overview 261 (WebGL) — viewmodel gộp material trả lại 50 draw so với bản chưa gộp (311).

**ISSUES DISCOVERED:**
- [Low] Thép súng nhìn vẫn khá phẳng dưới ánh nòng (texture metal_plate 1K tint tối, normal 0.6) → G4 cân nhắc texture riêng cho súng (CC0 "scratched metal") hoặc GLB súng CC0 do Chủ nhà chọn (TIP-013 mục input tuỳ chọn).
- [Info] FOV viewmodel = FOV camera (90°): méo nhẹ ở báng; camera riêng 55° cần pass compose trước post stack — hoãn (D-10).
- [Info] Tay nhân vật thật (Mixamo) cho góc nhìn thứ nhất chưa làm — cần rig tay riêng; G1.

**DEVIATIONS FROM SPEC:** không có GLB súng CC0 (Chủ nhà chưa cung cấp) → procedural PBR; tracer giữ TIP-010 (bloom lo phần glow).

**SUGGESTIONS FOR CHỦ THẦU:** chấm chung với TIP-011/012 trên Mac; nếu WARN bench → giảm puff 40 → 24, flash 6 → 4.
