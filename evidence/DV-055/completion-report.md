# Completion Report · DV-055 · Viewmodel AK-47 của AB3DX, dùng nguyên trạng

evidence_status: sandbox_swiftshader_lifecycle_only (ảnh chụp WebGL SwiftShader; phán xét hình ảnh cuối cùng trên Mac WebGPU)

STATUS: DONE

FILES CHANGED
- created: `scripts/convert-ab3dx-vm.mjs`, `src/game/weapons/artistViewmodel.ts`, `src/game/weapons/vmStates.ts`, `tests/unit/vmStates.test.ts`, `public/assets/weapons/ak47_vm.glb`, `evidence/DV-055/*`
- modified: `src/game/weapons/viewmodel.ts`, `src/game/game.ts`, `src/engine/render/assets.ts`, `src/qa/debugApi.ts`, `content/assets/manifest.json`, `CREDITS.md`, `AGENTS.md`, `docs/DECISIONS.md`, `tests/e2e/boot.spec.ts`
- deleted: `public/assets/weapons/akm_vm.glb`

TEST RESULTS
- `npm run typecheck`: xanh
- `npm run test`: 24 file, 153 test xanh (147 cũ + 6 mới) (mới: `vmStates.test.ts` 6 test: rút súng, đi/chạy nước rút, ngắm vào-giữ-ra, bắn phát lại mỗi phát, nạp co giãn theo reloadMs + nạp khi hết đạn, tất định)
- `node scripts/validate-assets.mjs`: 98 asset, 0 lỗi
- `npx playwright test tests/e2e/boot.spec.ts --project webgl-ci`: 6/6 xanh (trong đó "viewmodel FP" kiểm rig nghệ sĩ đã nạp)
- Ảnh trong game (WebGL, vòng rAF tạm dừng để tua clip đúng thời điểm): hông, ngắm, nạp, nạp khi hết đạn, kiểm súng, chạy nước rút

ISSUES
- Thấp: chưa có phím kiểm súng (clip có sẵn, gọi `__ht.vm.inspect()`); clip nhảy, ném lựu đạn, bò, nhặt đồ có trong asset nhưng chưa nối vào lối chơi.
- Thấp: `ak47_vm.glb` 9,3 MB (3 normal map 2048 px UASTC chiếm phần lớn). Hạ normal của phần thân ít thấy xuống 1024 px nếu cần bớt dung lượng.
- Cần Chủ nhà nhìn trên Mac WebGPU: góc nhìn 75°, độ lùi mắt 0,49 m.

DEVIATIONS
- Không có số căn tay nào: vị trí cả bộ suy từ khung cuối clip vào ngắm (xương `Sight` và trục `Grip`).

SUGGESTIONS
- Thêm phím kiểm súng (ví dụ giữ R khi băng còn đầy) qua InputSnapshot + replay flag.
