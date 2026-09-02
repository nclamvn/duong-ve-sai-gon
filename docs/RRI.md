# RRI REPORT: Hải Tuyến · HT-MB · Gate G0
Generated: 2026-09-02 · Contractor: Claude (Chủ thầu) · Homeowner: Nguyễn Cảnh Lâm

PRD v0.1 đã trả lời sẵn ~90% câu hỏi RRI (tech stack, budget, mission graph, 24 REQ-ID có tiêu chí
nghiệm thu). Vì vậy RRI được rút gọn: 4 câu CHALLENGE/GUIDED ở đúng chỗ Human phải quyết, phần còn
lại auto-answer từ PRD + Scan. Lý do rút gọn ghi ở D-010.

## REQUIREMENTS MATRIX (phạm vi G0 — chọn ở RRI Q1)

| REQ-ID | Requirement | Source | Priority | Persona |
|--------|-------------|--------|----------|---------|
| G0-01 | Scaffold Vite + TypeScript strict; deps pinned; AGENTS.md; ADR; `config/performance-budget.json` từ PRD §4.1 | PRD §3, §9, §15 (0–4h) | P0 | Developer |
| G0-02 | Renderer: `three/webgpu` WebGPURenderer primary, WebGL 2 fallback cùng content path; capability screen ghi backend; override `?backend=webgl` | PRD REN-001, §3 | P0 | Operator |
| G0-03 | Benchmark arena: ≥200 props batched/instanced, 8 skinned dummies, mưa GPU instanced, 1 directional shadow, 2 local lights, fog, wet-ground TSL | PRD §15 (4–12h), §4 | P0 | Developer |
| G0-04 | Telemetry: FPS, frame p95, CPU game ms, GPU proxy, draw calls, tris, actors, JS heap; overlay DOM; `performance-report.json` theo schema PerformanceReplay | PRD §4 Đo lường, §4.1, §8, §15 (12–20h) | P0 | Operator |
| G0-05 | Dynamic resolution 0.65–1.00 theo frame pressure, hysteresis, UI native pixels | PRD REN-004, §4 | P0 | End User |
| G0-06 | Fixed-step 60 Hz gameplay + interpolation render; không mutate physics trong render; scheduler 60 Hz / 10 Hz / render / event | PRD §3.1 | P0 | Developer |
| G0-07 | Rapier capsule character controller: đi/chạy/cúi/nhảy thấp; không xuyên collider; step/slope ổn định | PRD PLY-001, §15 (20–32h) | P0 | End User |
| G0-08 | Pointer Lock + mouse look: sensitivity, invert Y, raw input khi có; settings lưu IndexedDB; camera bob/recoil/shake tách lớp có cường độ | PRD PLY-002, PLY-003, A11Y-002 | P0 | End User |
| G0-09 | Một AR greybox: hip/ADS/fire/reload state machine không kẹt khi spam; hitscan local authoritative + damage zones; recoil pattern + seeded noise; spread theo stance; muzzle/impact/decal/casing dùng pool; audio placeholder | PRD WPN-001..004, §15 (32–44h) | P0 | End User |
| G0-10 | Một bot: navmesh Recast, patrol → detect (sight + hearing, suspicion, last-known) → cover → peek/fire → retreat; timeout/fallback mỗi state; stuck recovery ≤2 s; AI LOD full/reduced/sleep | PRD AI-001..004, §15 (44–56h) | P0 | QA |
| G0-11 | Một mission node data-driven: schema JSON (ajv) cho MissionDefinition/Node/DialogueCue/CheckpointSnapshot; runtime chỉ chạy action allow-list; enter zone → radio (phụ đề VI) → spawn → complete → checkpoint; restore sạch, không duplicate event | PRD §6.5, §8, §15 (56–64h) | P0 | Business |
| G0-12 | Debug API `window.__ht` cho Playwright: seed, teleport, state hash, metrics, trigger mission; không ship trong release build | PRD §3 Test, §3.2 qa/debug, §11 | P0 | QA |
| G0-13 | Test: Vitest unit (weapon SM, recoil, damage, mission condition, schema, scaler, checkpoint) + Playwright E2E (boot, backend, load mission, complete objective) chạy WebGL2 ở CI và project `webgpu` trên Mac | PRD §11 | P0 | QA |
| G0-14 | Audit trail: `contracts/<TIP>.yaml`, `evidence/<TIP>/completion-report.md`, `snapshots/G0/` (build hash, lockfile, manifest, seed, known issues) | PRD §9, §9.1 | P0 | Operator |
| G0-15 | Mọi chuỗi UI/phụ đề qua localization key `content/locale/vi.json`; HUD tối giản (ammo, health, objective, prompt) | PRD UX-001, UX-002 | P1 | End User |
| G0-16 | `npm run bench`: mở Chrome, chạy replay 90 s × 3 (seeded), tự POST kết quả về dev server → `evidence/G0/performance-report-*.json`; Contractor ra phán quyết GO/ADJUST/STOP | RRI Q4, PRD §15 (64–72h), §10.1 | P0 | Operator |

Ngoài phạm vi G0 (đưa vào G1+): 3 vũ khí, 2 đồng đội (SQD-*), 7 beat mission, AUD-001/002 mix thật, art, Safari smoke.

## AUTO-ANSWERED (từ PRD + Scan)
- STACK: Vite + TS strict · three/webgpu + TSL · @dimforge/rapier3d-compat · recast-navigation · Vitest + Playwright · DOM/CSS HUD → theo PRD §3, không hỏi lại.
- BUDGET: bảng §4.1 chuyển nguyên trạng vào `config/performance-budget.json` với `evidence_status: engineering_default_requires_review`.
- MISSION DATA: 7 record §8 → 4 schema JSON dùng trong G0 (mission, node, dialogue, checkpoint); asset manifest & encounter để G1.
- CI: sandbox không có WebGPU (Scan G-01) → CI verify WebGL2 path; WebGPU/60 FPS chỉ đo trên M1 Max.

## DECISIONS LOG

| ID | Decision | Options | Chosen | Rationale |
|----|----------|---------|--------|-----------|
| D-001 | Phiên bản Three.js | r185.1 (latest 2026-09-02) vs pin cũ hơn | **0.185.1**, lock đến hết G0 | Latest stable có WebGPURenderer + TSL ổn định nhất; đổi version chỉ tại gate kèm ADR + A/B (PRD §9.2). → ADR-001 |
| D-002 | Gói Rapier | `rapier3d` (wasm file) vs `rapier3d-compat` (wasm inline) | **rapier3d-compat 0.20.0** | Chạy cả browser lẫn Node (Vitest) không cần cấu hình wasm loader; cùng API. → ADR-002 |
| D-003 | Navmesh | pre-bake vs generate runtime | **Generate runtime từ greybox** ở G0, pre-bake từ G2 | Greybox thay đổi liên tục; bake sớm là lãng phí. → ADR-003 |
| D-004 | HUD/UI | DOM/CSS thuần vs Preact | **DOM/CSS thuần** | G0 chỉ có overlay + HUD tối giản; không kéo framework vào hot loop (PRD §3). |
| D-005 | Checkpoint Blueprint | Chờ APPROVED vs auto-approve | **Auto-approve** | Human quyết ở RRI Q3; Human review Blueprint + VERIFY REPORT ở cuối. Audit trail vẫn đủ (Blueprint, TIP, Completion, Verify). |
| D-006 | Nơi giao repo | Folder Mac vs zip | **~/Desktop/hai-tuyen** trên lam-local (đã cấp quyền) | Human quyết ở RRI Q2. |
| D-007 | Đo benchmark thật | Human tự chạy vs Contractor điều khiển Chrome | **Contractor điều khiển Chrome trên Mac** sau khi build | Human quyết ở RRI Q4; cần approve computer-use lúc chạy. |
| D-008 | Ngôn ngữ | — | Code/identifier tiếng Anh; docs, UI, phụ đề, report tiếng Việt | Thống nhất với PRD UX-002 và cộng đồng vibecode VN. |
| D-009 | Determinism | Math.random vs seeded PRNG | **mulberry32 seeded** cho recoil noise, AI, spawn; input replay track JSON | PRD WPN-002 "replay seed cho kết quả trúng ổn định", §8 PerformanceReplay. |
| D-010 | RRI rút gọn 4 câu | 40–60 câu chuẩn vs rút gọn | **Rút gọn** | PRD đã là output của một RRI đầy đủ; hỏi lại là biến Human thành người gật đầu (nguyên tắc 4, 7). |
| D-011 | Settings storage | localStorage vs IndexedDB | **IndexedDB** (wrapper ~40 dòng) | PRD A11Y-002 nói rõ IndexedDB. |
| D-012 | Skinned dummies | Tải GLB có license vs procedural | **Procedural** (capsule + bones, animation sinh bằng code) | PRD §9.2: không nhập asset chưa xác minh license; G0 chỉ cần tải skinning thật lên GPU. |

## OPEN QUESTIONS
- OQ-001: M1 Max của anh 24 hay 32 GPU cores → `device-profile.json` sẽ tự ghi `adapter.info` khi chạy bench trên Mac.
- OQ-002: Safari 26 smoke path — không nằm trong session này; chỉ chạy sau khi G0 GO.
- OQ-003: Node có sẵn trên Mac (ngoài Node của Claude desktop) — kiểm khi chạy bench qua computer-use.
