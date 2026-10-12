# Completion Report: DV-071 (AI-T1, bộ não chiến thuật cho địch và tổ ta)

evidence_status: sandbox_headless_metrics + swiftshader_e2e (cảm giác chơi chưa duyệt trên Mac)

STATUS: DONE (Phase 1 "AI trước"); Phase 2 (M1 30 phút) chưa bắt đầu

FILES CHANGED
- created: `src/game/ai/coverField.ts`, `src/game/ai/tactics.ts`, `tests/unit/aiT1.test.ts`, `tests/unit/aiWorld.ts`, `tests/e2e/ai-t1.spec.ts`, `docs/BLUEPRINT-AI-T1.md`
- rewritten: `src/game/ai/bot.ts` (FSM chiến đấu), `src/game/ai/squad.ts` (FireTeams + AttackTokens thay SquadCoordinator), `src/game/ai/squadmates.ts` (5 người, lệnh, báo hướng)
- modified: `src/game/actors/botActor.ts` (cúi hạ capsule, visual crouch), `src/game/game.ts` (dựng CoverField, tổ, vé, hồi máu, phím 1–4, báo hướng, sát thương điện ảnh), `src/game/mission/{missionHost,types}.ts`, `src/ui/{hud.ts,hud.css,subtitles.ts}`, `content/tuning/ai.json`, `content/missions/truong-son-a.{mission,dialogue}.json`, `content/levels/truong-son-a.level.json`, `content/locale/vi.json`, `content/schemas/dialogue.schema.json`, `tests/unit/{ai,hud-m1}.test.ts`, `tests/e2e/level-truong-son.spec.ts`, `docs/DECISIONS.md`

TEST RESULTS
- typecheck 0 lỗi; unit 235/235 (mới: 20 ở `aiT1.test.ts`)
- Bộ đo AI (rừng thử 100 × 100 m, 4 địch vs người chơi giả bắn loạt 3–6 phát, nạp đạn; 10 seed × 60 s):

| Chỉ số (Blueprint §2) | Ngưỡng | Đo được |
|---|---|---|
| Phát bắn khi đang lao (ngoài 8 m) | 0 | **0** / 1 332 phát |
| Thời gian nấp (hoặc đang lao vào chỗ che) khi bị áp chế | ≥ 70 % | **88 %** trung bình, thấp nhất 85,7 % |
| Lộ liên tục khi lao | ≤ 4 s | **3,8 s** lớn nhất |
| Lao có người bắn yểm trợ | ≥ 1 / 30 s | **84 / 102** lần lao (≈ 8 lần/phút/tổ) |
| Ép sườn tới góc ≥ 50° so với nhóm yểm trợ | ≥ 60 % | **9 / 10** |
| Địch bắn thật vào người chơi cùng lúc | ≤ 2 | **2** |
| Trúng người chơi từ địch không có vé | thấp | **8,5 %** (10 / 117) |
| Tổ lùi khi mất ≥ 50 % quân | có | 8 / 8 lần đủ điều kiện |
| Tất định cùng seed | có | có |

- E2E: 19/19 (mới `ai-t1.spec.ts`). Trường Sơn thật, rừng bật: **3 358 thân cây + 143 hố bom + 10 marker** thành nguồn chỗ nấp (trước: 10 marker tay); trận chặn đợt 1 + đợt 2 trong 45 s sim: hai tổ AI cùng nấp, lao, bắn (0 phát khi lao), tổ ta báo hướng "M20", lệnh phím 2/4/1 đổi lệnh và HUD hiện lệnh; không lỗi console.

ISSUES
- (CAO, đã sửa) Từ TIP-M1A tia bắn của bot xuất phát trong quả cầu đầu của chính nó: mọi phát vào lớp ACTOR trúng chính mình → **địch chưa từng bắn trúng người chơi, đồng đội chưa từng trúng địch**. Đây là một phần lý do "bắn vu vơ cũng thắng". Sửa: đầu nòng cách mắt 0,35 m; test chặn hồi quy (tắt sửa → test bắt 9 lần tự trúng).
- (trung bình, đã sửa) Đồng đội sau lưng người chơi bị LOD cho "ngủ" giữa trận (khuất màn hình > 5 s); bot ngủ không nghe tiếng súng.
- (trung bình) Chưa có tư thế nằm/bò: bộ Mixamo hiện tại không có clip prone; bị ghim thì cúi sát.
- (trung bình) Báo hướng và lệnh chỉ có phụ đề, chưa thu âm.
- (thấp) Bộc phá/pháo/ngã không giảm sát thương điện ảnh (chỉ đạn địch giảm 1/3). `level-diem-cao-31.spec.ts` bước bộc phá tạm dừng AI để đo riêng sát thương bộc phá vì súng M60 giờ bắn trúng thật.
- (thấp) Người chơi giờ bị bắn trúng thật (sau khi sửa lỗi trên): độ khó điện ảnh (2/3 sát thương, hồi máu, 2 vé) cần Chủ nhà chơi thử để chỉnh.

DEVIATIONS
- "Nằm" trong Blueprint §3.3 thay bằng cúi thấp tới khi có clip.
- Đức, Toàn: hai chiến sĩ thêm không có trong kịch bản gốc (tên tạm, không thoại riêng); Chủ nhà đổi tên tuỳ ý.

SUGGESTIONS
- Tải từ Mixamo: Prone Idle, Prone Forward, Stand To Prone, Prone To Stand, Crouch To Stand (để có nằm và đứng dậy thật).
- Phase 2 dùng bộ đo này cho từng trận của M1 (3 trận săn thám báo tăng dần + chặn bãi đáp).
