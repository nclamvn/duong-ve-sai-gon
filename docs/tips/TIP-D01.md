# TIP-D01: Fork engine HT-MB → repo Đường về Sài Gòn, dọn tên, luật mới, CI xanh (G0′)

## HEADER
- TIP-ID: TIP-D01 · Project: DVSG · Module: repo, `package.json`, `index.html`, `content/locale/vi.json`, `config/performance-budget.json`, `content/schemas/*`, `scripts/{fetch-assets,bench}.mjs`, `src/game/game.ts` (level mặc định), `AGENTS.md`, `README.md`, `docs/`
- Dependencies: DV-004 (APPROVED Blueprint G1), Chủ nhà tạo GitHub repo `duong-ve-sai-gon`
- Priority: P0 · Effort: 8 h Thợ

## TASK
1. Fork tại `hai-tuyen@8745ba3` (giữ lịch sử); bỏ remote cũ. WIP TIP-023 chưa commit trong sandbox → nhánh `tip-023-wip` của repo cũ (DV-011).
2. Đổi tên gói/version/title/i18n/schema `$id`/user-agent; budget `$comment` + `frame_p95.target_g1 = 16.67` (ADR-D02).
3. Level mặc định `arena` (content Hải Tuyến = fixture bench/E2E); `?level=pho` giữ test đô thị.
4. Docs: HT-MB → `docs/legacy/`; thêm `docs/PRD.md` (v0.2), `docs/story/KICH-BAN-v0.1.md`, `docs/BLUEPRINT-G1.md`, `docs/THIET-KE-DIEN-ANH-v0.2.md`, `docs/DECISIONS.md` (DV-001..011), ADR-D01/D02.
5. AGENTS.md: mục 0 "Luật riêng DVSG" (lịch sử có nguồn, asset rip, E2E vật lý, điện ảnh không chặn mission, luật công bằng AI, đo trước art, không mở nhiệm vụ mới, tiếng Việt chỉ trong content).
6. CI: typecheck, unit, build, e2e (webgl-ci) xanh.

## ACCEPTANCE CRITERIA
- Given `npm run ci`, Then xanh trên repo mới; bench arena không tụt (Chủ nhà đo trên Mac ở D05).
- Given `npm run dev`, Then title "Đường về Sài Gòn · G0′", level arena; `?level=pho` vẫn chạy.
- Given grep, Then không còn "Hải Tuyến/HT-MB" trong `package.json`, `index.html`, `vi.json` (trừ ghi chú kế thừa), schema `$id`.
