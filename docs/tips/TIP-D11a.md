# TIP-D11a: Lính QGP 1971 lớp 2–15 m + tay FP 1971 (ART01a, DV-025 asset sprint)

## HEADER
- TIP-ID: TIP-D11a · Project: DVSG · Module: `scripts/retexture-1971.mjs` (mới), `src/engine/render/gear1971.ts` (mới), `src/game/actors/visual.ts` (+`gear`), `src/game/actors/dummy.ts` (`DummyOptions.gear`), `src/game/game.ts` (bot/dummy `gear: 'pavn1971'`), `public/assets/characters/{soldier,soldier_arms}.glb` (tái sinh), manifest `soldier_mixamo` (historical/registryId/approved), `tests/unit/soldier1971.test.ts`
- Dependencies: D10 (AK-47 — bot cầm AK để ảnh tham chiếu đúng), D03 registry `uni.pavn.1971.*` · Priority: P0 (asset sprint, sau D10) · Effort: 24 h Thợ (D11 tổng 48 h — phần b: mesh thân/đầu/bàn chân mới, dép cao su, ba lô, bi đông)

## CONTEXT
- Chủ nhà (DV-025): tay FP rằn ri + găng đen Swat Guy "sai hết so với PRD về trang phục lính VN trước 1975". PRD §7.4 tầng 1–2: thân Mixamo **retexture** Tô Châu, mũ cối/dép/bao xe gắn bone; tay FP áo xanh, tay trần. "Procedural trước" (AskUserQuestion) — CC-BY sau nếu cố vấn yêu cầu.
- Nguồn: Mixamo Swat Guy (`assets-src/mixamo/soldier-swat.glb` = `convert-mixamo` output trước KTX2, sha trong manifest) — atlas 1001 (áo/quần/đầu) + 1002 (gear: giáp, kính, bao, giày, găng). Vải: Poly Haven CC0 `stretch_poplin` (dệt). Registry lượt 1: `field_uniform_green` tier **H** (chưa nguồn P/S) → `approved: false`; `helmet_pith`/`sandals_rubber` tier S; `chest_rig_type56` tier H.
- Giới hạn mesh gốc: **không có sọ riêng** (vỏ mũ Swat là "đầu", mặt = balaclava tới mũi), **không có bàn chân** (giày là gear) → đầu/giày giữ lại sơn da/đen tạm; dép cao su + đầu thật là D11b.

## TASK
1. `scripts/retexture-1971.mjs`: island = thành phần liên thông đỉnh; phân loại theo bbox (tỷ lệ bbox mesh): 1001 bỏ đệm gối/túi/tai nghe/kính; đầu+mặt → DA; thắt lưng → da nâu; còn lại → VẢI; 1002 chỉ giữ bàn tay+cổ tay (|x| ≥ 73 % nửa rộng T-pose) → DA và giày (y ≤ 10 %) → ĐEN, còn lại bỏ. Albedo = màu lớp × dệt poplin × sáng/tối gốc (blur, chuẩn hoá **theo island** để bỏ chênh lệch sơn gốc, nén tương phản); normal vùng da phẳng; ORM: AO sàn (kính gốc AO = 0 → đen), metal 0, roughness sàn; bỏ emissive. Giữ skeleton/8 clip → `extract-arms.mjs` dùng lại → tay FP tự có da + áo.
2. `src/engine/render/gear1971.ts`: mũ cối lathe (chỏm bầu dục 0,30 × 0,34 m, cao 0,125 m, vành nghiêng, hai mặt) gắn `Head` (+13,5 cm), bao xe 3 túi + nắp + dây vai gắn `Spine2` (+19 cm trước); material vải olive; cache geometry. `SoldierVisual` gắn khi `opts.gear === 'pavn1971'`; game đặt cho bot + dummy.
3. Pipeline: `node scripts/retexture-1971.mjs && node scripts/extract-arms.mjs && node scripts/ktx2.mjs --only models --filter soldier` → manifest (`historical`, `registryId uni.pavn.1971.field_uniform_green`, `approved false`, sourceFiles GLB gốc + vải CC0, triangles).
4. Evidence sandbox: ảnh lính idle/aim + đầu gần + tay FP hip (`evidence/TIP-D11a/`); Chủ nhà chụp Mac WebGPU cùng góc để chấm; cố vấn duyệt màu/kiểu (registry lượt 1).

## ACCEPTANCE CRITERIA
- Given `?level=arena` (hoặc truong-son), Then bot/dummy không còn rằn ri/giáp/kính/đệm gối; áo quần xanh olive, tay trần, mũ cối, bao xe; tay FP: ống tay olive + bàn tay da; `assets:validate` 0 lỗi; unit `soldier1971.test` + CI xanh.
- Given manifest, Then `soldier_mixamo.historical=true`, `registryId` ∈ registry `uniforms.yaml`, `approved=false`; tam giác còn < 45 % gốc.
- Given Chủ nhà xem Mac WebGPU, Then ảnh 3 góc được chấm (mũ vừa đầu, bao xe không xuyên áo, tay FP "tay trần" đạt) — mục còn lại ghi D11b.

## CONSTRAINTS
- Không sửa `extract-arms.mjs`/`convert-mixamo.mjs`; không đổi skeleton/clip (IK, calib, FpArms dùng chung); `engine/*` không import `game/*`; TSL only; không tiếng Việt trong src runtime string.
- Không ship texture gốc Swat (Mixamo license cho phép dẫn xuất trong game); không thêm asset Sketchfab ở D11a.
