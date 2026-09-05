# Completion Report — TIP-D01 (Fork engine → Đường về Sài Gòn)

STATUS: DONE (chờ Chủ nhà tạo GitHub repo + push + `npm install`)

## FILES CHANGED
- Repo mới `duong-ve-sai-gon` fork từ `hai-tuyen@8745ba3` (lịch sử giữ). Mac: `~/Desktop/duong-ve-sai-gon` tạo bằng copy `.git` + reset (clone thường bị kẹt lock trên mount), `assets-src/` copy sang.
- Sửa: `package.json` (name/version/description, script `registry:check`, dep `yaml`), `index.html` (title), `content/locale/vi.json` (app.title, ov.title), `config/performance-budget.json` ($comment, `frame_p95.target_g1`), `content/schemas/*.schema.json` ($id), `scripts/fetch-assets.mjs`, `scripts/bench.mjs`, `src/game/game.ts` (level mặc định `arena`), `AGENTS.md` (mục 0 luật DVSG, package mới, asset, việc không tự quyết), `README.md`.
- Docs: `docs/legacy/{PRD-HTMB,BLUEPRINT-HTMB-G0,BLUEPRINT-HTMB-G06,RRI-HTMB,VERIFY-HTMB-G0,DECISIONS-HTMB}.md` (git mv); mới `docs/PRD.md` (v0.2), `docs/story/KICH-BAN-v0.1.md`, `docs/BLUEPRINT-G1.md`, `docs/THIET-KE-DIEN-ANH-v0.2.md`, `docs/DECISIONS.md` (DV-001..011), `docs/ADR/ADR-D01-fork-engine.md`, `ADR-D02-budget-target-g1.md`.
- WIP TIP-023 (setpiece technical/flyby + spline, chưa nghiệm thu) tìm thấy chưa commit trong sandbox HT-MB → nhánh `tip-023-wip` của `hai-tuyen` (1e608ff), không vào fork (DV-011).

## TEST RESULTS (`ci.log`)
- typecheck OK · unit 104/104 (16 file) · build OK · e2e webgl-ci 7/7 (boot, bench, webgpu-smoke, mission ×2, level-pho…) 4,7 phút.
- AC "không còn Hải Tuyến trong package/index/vi.json/schema": đạt (vi.json app.title ghi rõ "engine kế thừa Hải Tuyến — content thử nghiệm"; thoại/mission Hải Tuyến giữ làm fixture).

## ISSUES
- (Info) Mac `.git/zz-parked/` có 75 lock file cũ copy theo từ hai-tuyen — vô hại.
- (Low) `npm install` trên Mac bắt buộc (dep `yaml` mới) — Chủ nhà chạy trong Terminal macOS, không qua VM.

## DEVIATIONS
- Level mặc định đổi `pho` → `arena` (ADR-D01 §2) — tránh game mở ra Phố Vạn Hải như content chính.

## SUGGESTIONS
- D02 nên bắt đầu từ `?level=pho` (650–740 draw) làm bài đo cho gộp material/atlas; bench track `pho` giữ để so sánh.
