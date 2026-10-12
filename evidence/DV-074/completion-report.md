# Completion Report: DV-074 + DV-075 (lựu đạn; cảm giác đấu súng)

evidence_status: sandbox_swiftshader_sim (cảm giác nghe/nhìn chưa duyệt trên Mac)

STATUS: DONE (phần làm được không cần tải thêm)

FILES CHANGED
- created: `content/tuning/grenade.json`, `src/game/weapons/grenades.ts`, `src/game/weapons/grenadeView.ts`, `tests/unit/grenades.test.ts`, `tests/e2e/grenade-gunfeel.spec.ts`
- modified: `src/game/ai/bot.ts` (ném + né lựu đạn), `src/game/ai/squadmates.ts` (hô "Lựu đạn!"), `src/game/game.ts` (hệ lựu đạn, phím G, nổ có vật che, đạn sượt + áp chế), `src/engine/audio/audio.ts` (tiếng ném/nảy, đạn sượt, súng xa có độ trễ + vọng, đuôi vọng súng người chơi), `src/engine/render/post.ts` (uniform `stress`), `src/game/weapons/fx.ts` (bụi theo vật liệu, vệt đạn theo phe), `src/ui/{hud.ts,hud.css}` (số lựu đạn, cảnh báo hướng, viền áp chế), `src/game/mission/{missionHost,types}.ts` + `content/schemas/checkpoint.schema.json` (lựu đạn trong checkpoint), `content/missions/{truong-son-a,diem-cao-31}.dialogue.json` + `content/locale/vi.json` (M26, nhãn HUD), `tests/unit/aiWorld.ts`, `docs/DECISIONS.md`

TEST RESULTS
- typecheck 0 lỗi; unit 245/245 (thêm 8: lời giải ném rơi đúng ± 0,4 m ở 8–30 m và chênh cao −3/+2 m; nảy, nằm yên, không xuyên đất, nổ đúng fuse một lần; dội lại khi ném vào thân cây; giới hạn số quả; địch ném vào người chơi đứng yên ở 12–30 m, rơi trong 9 m quanh người chơi, mỗi người ≤ 1 quả; bot chạy khỏi lựu đạn ra ngoài bán kính trước khi nổ rồi đánh tiếp; tổ ta không mang lựu đạn). Bộ đo AI-T1 giữ nguyên ngưỡng.
- E2E webgl-ci 20/20 (6 spec ảnh/đo thời lượng bỏ qua theo cờ môi trường). E2E mới trên level Trường Sơn thật (rừng bật):

| Kiểm | Kết quả |
|---|---|
| HUD trước/sau | "Lựu đạn ×2" → "Lựu đạn ×1" |
| Người chơi ném, nằm yên cách ≥ 6 m, nổ | 1 lần nổ; địch đứng cạnh (AI dừng) còn 42 máu |
| Địch có AI đứng cạnh chỗ rơi | né 1 lần, lúc nổ đã cách 7,5 m |
| Địch ném vào người chơi | tổ ta hô M26, HUD hiện cảnh báo hướng, người chơi đứng cách 1,5 m còn 53 máu |
| 16 phát đạn sượt từ 10 m, lệch 1 m | 17 lần "sượt", áp chế lên 1,0, viền tối hiện, 4 s sau về 0 |

ISSUES
- (thấp) Áp chế đầy sau khoảng 6 phát sượt sát; nếu Chủ nhà thấy màn hình xám quá nhanh: giảm hệ số trong `playerNearMiss` (0,07 + 0,16·k).
- (thấp) Người chơi ném không có động tác tay trên viewmodel (chưa có clip); lựu đạn bay ra từ trước mặt.
- (thấp) Tiếng vẫn là âm thủ tục (noise lọc). Bản ghi thật cần Chủ nhà cho phép tải gói CC0.

DEVIATIONS
- Tiếp tế lựu đạn ở checkpoint (không có trong kế hoạch): M1 dài 30 phút, 2 quả cho cả nhiệm vụ là quá ít để người chơi thử.
- Lựu đạn của người chơi không gây sát thương cho tổ ta (giữ luật "người chơi không bắn được đồng đội" đang có).

SUGGESTIONS
- Chơi thử trận dốc (cp5) và bãi đáp: đó là chỗ địch nằm giữ và người chơi nằm im lâu, lựu đạn hai phía sẽ xuất hiện nhiều nhất.
- Tải 4 clip Mixamo nằm (Prone Idle, Prone Forward, Stand To Prone, Prone To Stand) để làm tư thế nằm; khi có nằm, nổ lựu đạn với người nằm nên giảm thêm.
