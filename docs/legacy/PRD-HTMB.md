**PRODUCT REQUIREMENTS DOCUMENT**

HẢI TUYẾN

**NHIỆM VỤ 01 · MẮT BÃO**

Cinematic first-person shooter chạy trực tiếp trên trình duyệt, tối ưu
cho MacBook Pro M1 Max 32 GB bằng Three.js, WebGPU và quy trình phát
triển có AI hỗ trợ.

| **Thuộc tính**                 | **Giá trị**                                          |
|--------------------------------|------------------------------------------------------|
| **Phiên bản**                  | 0.1                                                  |
| **Ngày**                       | 02/09/2026                                           |
| **Chủ sở hữu sản phẩm**        | Nguyễn Cảnh Lâm                                      |
| **Trạng thái**                 | Draft for feasibility spike                          |
| **Thiết bị chuẩn**             | MacBook Pro M1 Max · 32 GB unified memory            |
| **Nền tảng chuẩn**             | Chrome Stable trên macOS · Safari 26 là mục tiêu phụ |
| **Phạm vi phát hành đầu tiên** | Single-player vertical slice · 12–18 phút            |
| **Tên mã dự án**               | HT-MB                                                |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>NORTH STAR<br />
Trong 30 giây đầu, người chơi phải tin rằng đây là một FPS hiện đại;
trong 15 phút, họ phải thấy rõ WebGPU, Three.js và AI có thể tạo ra một
lát cắt game hoàn chỉnh, ổn định và có bản sắc Việt Nam.</strong></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

Tài liệu này dùng “cào lọc có bằng chứng”: khẳng định về phần cứng,
trình duyệt và thư viện được nối tới nguồn gốc; mọi ngân sách hiệu năng,
số lượng actor và tiến độ là engineering target cần benchmark, không
phải dữ liệu thực nghiệm đã được đảm bảo.

# 0. KẾT LUẬN ĐIỀU HÀNH

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>QUYẾT ĐỊNH<br />
</strong>GO có điều kiện. Làm một vertical slice chơi đơn, một nhiệm vụ,
một bản đồ và một thiết bị chuẩn. Không khởi động art production trước
khi Gate G0 chứng minh 60 FPS ổn định trên đúng máy M1 Max của anh.</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

M1 Max có băng thông bộ nhớ 400 GB/s và tùy cấu hình có GPU 24 hoặc 32
lõi; tuy nhiên trình duyệt không trao quyền truy cập “toàn bộ phần cứng”
như một engine native. WebGPU giảm lớp dịch so với WebGL và ánh xạ tốt
hơn tới Metal, nhưng hiệu năng thực tế vẫn phụ thuộc scene, shader, draw
call, độ phân giải, browser và phiên bản Three.js.
\[S01\]\[S02\]\[S03\]\[S04\]

Three.js hiện cung cấp WebGPURenderer, TSL và fallback WebGL 2. Đây là
nền tảng phù hợp với mục tiêu trình diễn công nghệ, nhưng chính tài liệu
Three.js vẫn đánh dấu renderer là experimental và cảnh báo một số scene
có thể chạy tốt hơn bằng WebGLRenderer. Vì vậy kiến trúc phải có
benchmark đối chứng, feature flags và lock phiên bản theo milestone.
\[S04\]\[S05\]

| **Khía cạnh**                        | **Phán quyết**       | **Điều kiện**                                                                                                    |
|--------------------------------------|----------------------|------------------------------------------------------------------------------------------------------------------|
| Đồ họa “gợi cảm giác Modern Warfare” | Khả thi              | Tập trung lighting, material, animation, audio và camera feel; không chạy theo map rộng hoặc hàng chục hệ thống. |
| Một nhiệm vụ 12–18 phút              | Khả thi              | Một map 250–350 m, 3 vũ khí, 3 archetype địch, 2 đồng đội script.                                                |
| 60 FPS trên M1 Max                   | Khả thi có điều kiện | Render nội bộ 1920×1200, dynamic resolution, asset budgets và profile từng gate.                                 |
| Chất lượng AAA đầy đủ                | Không khả thi        | AI không thay thế motion capture, art direction, sound design và hàng nghìn giờ playtest.                        |
| Multiplayer cạnh tranh ở v0.1        | Loại khỏi phạm vi    | Netcode, anti-cheat, server authority và matchmaking làm tăng rủi ro theo cấp số nhân.                           |
| WebGPU-only không fallback           | Không chấp nhận      | Dùng WebGPU primary nhưng giữ WebGL 2 fallback và smoke test.                                                    |

# 1. TẦM NHÌN SẢN PHẨM

Hải Tuyến là FPS chiến thuật điện ảnh hư cấu đặt trong một đô thị cảng
nhiệt đới Đông Nam Á. Trải nghiệm ưu tiên cảm giác vũ khí, mưa bão, ánh
sáng phản xạ, âm thanh không gian, nhịp độ đội hình và các set piece có
kiểm soát. Ngôn ngữ thoại, giao diện, phụ đề và dấu ấn địa phương đều là
tiếng Việt.

- **Lời hứa thị giác:** mặt đường ướt, ánh đèn xuyên mưa, khói bụi, tia
  lửa và material PBR có chiều sâu.

- **Lời hứa gameplay:** điều khiển mượt, ADS có trọng lượng, recoil dễ
  học nhưng có kỹ năng, AI phản ứng đủ thuyết phục.

- **Lời hứa trình diễn AI:** mọi hệ thống có contract, test, benchmark
  và evidence; không đánh giá chất lượng bằng số dòng code.

- **Lời hứa bản sắc:** bối cảnh, hội thoại và âm thanh Việt Nam nguyên
  bản; không sao chép nhân vật, bản đồ, UI, nhạc hoặc thoại của Call of
  Duty.

Đối tượng chính: người chơi PC yêu FPS điện ảnh; người xem demo quan tâm
WebGPU/Three.js; cộng đồng vibecode muốn thấy một dự án vượt xa website
CRUD; nhà phát triển và nhà đầu tư đánh giá năng lực AI sinh code.

# 2. MỤC TIÊU, PHẠM VI VÀ PHI MỤC TIÊU

| **Nhóm**  | **Trong v0.1**                                                 | **Ngoài v0.1**                                    |
|-----------|----------------------------------------------------------------|---------------------------------------------------|
| Nội dung  | 1 nhiệm vụ; 12–18 phút; 3 checkpoint; 2 nhánh tiếp cận         | Campaign; open world; procedural campaign         |
| Chiến đấu | 3 vũ khí; hitscan; ADS; recoil; reload; 3 loại địch            | Ballistics mô phỏng sâu; 20+ súng; vehicle combat |
| Đồng đội  | 2 NPC có thoại và script hỗ trợ                                | Điều khiển squad tự do; co-op                     |
| Đồ họa    | WebGPU, TSL, PBR, mưa, khói, phản xạ giả lập, post FX chọn lọc | Path tracing; phá hủy toàn scene; hardware RT     |
| Nền tảng  | macOS trên M1 Max; Chrome primary; Safari secondary            | Mobile; console; Windows matrix đầy đủ            |
| Dịch vụ   | Local save, settings, telemetry phát triển                     | Tài khoản, backend game, leaderboard, matchmaking |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>NGUYÊN TẮC CHỐNG PHÌNH PHẠM VI<br />
</strong>Mọi feature mới phải trả lời: feature này có làm nhiệm vụ Mắt
Bão tốt hơn và có được nhìn thấy trong 15 phút demo không? Nếu không,
đưa vào backlog sau v0.1.</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 3. CƠ SỞ KỸ THUẬT VÀ QUYẾT ĐỊNH KIẾN TRÚC

Các quyết định dưới đây là baseline triển khai. “Đã xác minh” chỉ áp
dụng cho khả năng API/thư viện từ nguồn gốc; con số hiệu năng là
engineering default phải được đo trên thiết bị thật.

| **Miền**      | **Lựa chọn**                          | **Lý do**                                                                       | **Gate** |
|---------------|---------------------------------------|---------------------------------------------------------------------------------|----------|
| Build/runtime | Vite + TypeScript strict              | Khởi động nhanh, module ESM, ít abstraction trong render loop.                  | G0       |
| Renderer      | three/webgpu · WebGPURenderer         | WebGPU primary, WebGL 2 fallback; TSL dùng chung WGSL/GLSL. \[S04\]\[S05\]      | G0       |
| Shader/post   | Three Shading Language (TSL)          | Tránh ShaderMaterial/onBeforeCompile không tương thích WebGPURenderer. \[S04\]  | G0–G4    |
| Physics       | @dimforge/rapier3d                    | WASM, collider/rigid body/character controller; fixed timestep. \[S08\]         | G1       |
| Navigation    | recast-navigation-js                  | WASM Recast/Detour, navmesh/path query, Three helpers. \[S09\]                  | G2       |
| Asset         | glTF/GLB + Meshopt + KTX2/Basis       | Three hỗ trợ loader; glTF Transform tự động hóa resize/compress. \[S06\]\[S07\] | G1–G4    |
| Input         | Pointer Lock + raw mouse option       | API phù hợp FPS góc nhìn thứ nhất. \[S11\]                                      | G1       |
| Audio         | Web Audio + Three PositionalAudio     | PannerNode cho nguồn âm 3D; radio/UI tách bus. \[S12\]                          | G3       |
| Test          | Vitest + Playwright + debug API       | Unit, deterministic mission smoke, screenshot/video/trace. \[S13\]              | Mọi gate |
| UI            | DOM/CSS overlay thuần hoặc Preact nhẹ | HUD không nằm trong scene 3D; tránh kéo React vào hot loop.                     | G1       |

# 3.1. Luồng runtime

| **Nhịp**        | **Hệ thống**                                                                    | **Quy tắc**                                          |
|-----------------|---------------------------------------------------------------------------------|------------------------------------------------------|
| 60 Hz fixed     | input snapshot → player controller → physics → hit detection → mission triggers | Không gắn gameplay vào FPS render.                   |
| 5–15 Hz         | perception, cover scoring, path replanning, squad tactics                       | AI LOD theo khoảng cách và mức giao chiến.           |
| Variable render | interpolation → culling → animation pose → render → post                        | Không mutate physics state trong render.             |
| Event driven    | dialogue, objective, checkpoint, VFX/SFX                                        | Event có ID; chạy idempotent; log được.              |
| Background      | asset decode, telemetry aggregation, optional nav query worker                  | Chỉ tách worker sau khi profile chứng minh nút thắt. |

# 3.2. Cấu trúc module đề xuất

| **Package**    | **Trách nhiệm**                                           | **Không được làm**                        |
|----------------|-----------------------------------------------------------|-------------------------------------------|
| engine/core    | clock, scheduler, event bus, entity IDs, lifecycle        | Không biết mission cụ thể.                |
| engine/render  | renderer, TSL materials, lighting, post, quality scaler   | Không quyết định damage/gameplay.         |
| engine/physics | Rapier world, controller, collision layers, queries       | Không điều khiển camera feel.             |
| game/player    | movement, stance, health, interaction                     | Không gọi renderer trực tiếp.             |
| game/weapons   | state machine, recoil, hit, ammo, feedback events         | Không spawn VFX/SFX trực tiếp.            |
| game/ai        | perception, utility/BT, nav, combat actions               | Không hard-code mission timeline.         |
| game/mission   | graph, objectives, encounters, checkpoints, dialogue cues | Không chứa shader hoặc physics low-level. |
| content        | manifest, mission JSON, localization, tuning data         | Không chứa logic TypeScript tùy tiện.     |
| qa/debug       | deterministic seed, overlay, replay inputs, telemetry     | Không ship menu debug trong release.      |

# 4. CHIẾN LƯỢC TỐI ƯU M1 MAX / WEBGPU

Mục tiêu không phải “đẩy GPU lên 100%” mà là giữ chất lượng hình ảnh cao
trong frame budget ổn định. Một game mượt ở 65–80% tải bền vững đáng tin
hơn demo đạt 100% rồi tụt khung hình vì shader compile, GC hoặc thermal
throttling.

| **Trụ cột**      | **Quy tắc triển khai**                                                                                                                        |
|------------------|-----------------------------------------------------------------------------------------------------------------------------------------------|
| **Độ phân giải** | Render scale động 0,65–1,00; UI ở native CSS pixels; không mặc định render theo devicePixelRatio=2 toàn màn hình.                             |
| **Geometry**     | Frustum/occlusion cells, 3 LOD, BatchedMesh/InstancedMesh cho props, giới hạn skinned meshes; giảm draw call trước khi giảm triangle. \[S10\] |
| **Texture**      | KTX2/Basis; atlas hợp lý; 4K chỉ cho hero asset; mipmap bắt buộc; manifest ghi kích thước GPU ước tính. \[S06\]\[S07\]                        |
| **Lighting**     | Một directional key có shadow; tối đa 2 local shadow lights trong shot; phần lớn đèn baked/emissive; probe theo zone.                         |
| **Post FX**      | Node post stack; bloom/grade/vignette nhẹ; SSAO/DoF/motion blur theo quality flag; compile shader khi loading.                                |
| **Particles**    | Instanced/GPU storage buffers cho mưa, bụi, tia lửa; pool decal/impact; không tạo object JS mỗi hạt.                                          |
| **CPU**          | Fixed arrays/pools trong hot path; AI tick theo LOD; navmesh pre-baked; tránh allocation mỗi frame.                                           |
| **Streaming**    | Map chia zone: bến tàu, bãi container, trạm bơm, tháp tín hiệu; preload zone kế tiếp và dispose zone đã khóa.                                 |
| **Đo lường**     | CPU frame, GPU timestamp khi khả dụng, draw calls, triangles, active actors, JS heap, load time và shader hitch vào telemetry.                |

# 4.1. Ngân sách hiệu năng ban đầu

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>TRẠNG THÁI BẰNG CHỨNG<br />
</strong>Tất cả số trong bảng này là
engineering_default_requires_review. Gate G0 phải thay bằng baseline đo
trên chính MacBook M1 Max 32 GB của anh; G4 và G5 phải đo lại với art
gần cuối.</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

| **Chỉ số**            | **Target**                | **Ngưỡng đỏ**        | **Phương pháp đo**                |
|-----------------------|---------------------------|----------------------|-----------------------------------|
| FPS                   | 60 trung bình; 1% low ≥45 | 1% low \<40          | Replay 90 giây, 3 lần, lấy median |
| Frame time            | p95 ≤18,5 ms              | p95 \>22 ms          | Telemetry theo frame              |
| Render nội bộ         | 1920×1200 default         | \>2560×1600 cố định  | Quality scaler report             |
| GPU time              | ≤10,5 ms điển hình        | \>14 ms kéo dài      | Timestamp query/browser profile   |
| CPU game time         | ≤5,0 ms điển hình         | \>8 ms kéo dài       | Performance marks                 |
| Draw calls            | ≤400 điển hình            | \>650                | renderer.info/custom counter      |
| Visible triangles     | ≤2,5 triệu điển hình      | \>4 triệu            | renderer telemetry                |
| Skinned actors        | ≤10 gần camera            | \>14                 | actor counter                     |
| Địch hoạt động        | 8 full AI; 12 tổng        | \>16 full AI         | AI telemetry                      |
| Graphics memory proxy | ≤3,5 GB asset resident    | \>5 GB               | Asset manifest + browser tools    |
| JS heap               | ≤700 MB steady            | \>1 GB hoặc tăng dần | Heap snapshots                    |
| Initial payload       | ≤150 MB                   | \>250 MB             | Network trace                     |
| Tổng level tải dần    | ≤750 MB                   | \>1,2 GB             | Build manifest                    |
| Audio voices          | ≤32 đồng thời             | \>48                 | Audio bus counter                 |

# 5. GAMEPLAY LOOP VÀ HỆ THỐNG

Loop cốt lõi: quan sát → chọn nhịp tiếp cận → di chuyển theo đội → giao
chiến → đổi vị trí/cover → hoàn thành micro-objective → nhận nhịp điện
ảnh → checkpoint.

| **ID**      | **Yêu cầu**                                                                         | **Ưu tiên** | **Tiêu chí nghiệm thu**                                           |
|-------------|-------------------------------------------------------------------------------------|-------------|-------------------------------------------------------------------|
| **PLY-001** | Đi bộ, chạy nước rút, cúi, nhảy thấp và vault tại marker.                           | Must        | Controller không xuyên collider; dừng/slope/step ổn định ở 60 Hz. |
| **PLY-002** | Mouse look có sensitivity, invert Y, raw input khi browser cho phép.                | Must        | Không acceleration ngoài ý muốn; settings lưu lại.                |
| **PLY-003** | Camera bob, landing, recoil và shake tách lớp; mỗi lớp có cường độ.                 | Must        | Có slider 0–100%; không gây drift aim.                            |
| **PLY-004** | Tương tác cửa, terminal, cứu người và nhặt đạn bằng một action.                     | Must        | Prompt đúng theo context; không kích hoạt xuyên tường.            |
| **WPN-001** | AR, SMG giảm thanh, pistol; hip fire, ADS, reload, swap.                            | Must        | State machine không kẹt khi spam input.                           |
| **WPN-002** | Hitscan authoritative local; damage zones; penetration chỉ cho material allow-list. | Must        | Replay seed cho kết quả trúng ổn định.                            |
| **WPN-003** | Recoil pattern + noise, spread theo stance/movement.                                | Must        | Config data-driven; test clamp và reset.                          |
| **WPN-004** | Muzzle, tracer, impact, decal, casing và audio dùng pool.                           | Must        | Không allocation tăng dần sau 5 phút bắn liên tục.                |
| **AI-001**  | Perception sight/hearing có suspicion và last-known position.                       | Must        | Bot điều tra âm thanh, phát hiện line-of-sight và mất dấu hợp lý. |
| **AI-002**  | Patrol, investigate, seek cover, peek/fire, flank, retreat/reload.                  | Must        | Mỗi state có timeout/fallback; không deadlock.                    |
| **AI-003**  | Navmesh + local avoidance; path replanning theo budget.                             | Must        | Không vượt zone cấm; stuck recovery trong 2 giây.                 |
| **AI-004**  | AI LOD: full, reduced, sleep.                                                       | Must        | Offscreen actors không tiêu CPU full-rate.                        |
| **SQD-001** | Hai đồng đội theo spline/navmesh, chọn cover marker và bắn hỗ trợ.                  | Must        | Không chặn cửa; teleport recovery chỉ khi ngoài tầm nhìn.         |
| **SQD-002** | Thoại barks theo event, cooldown và priority.                                       | Must        | Không chồng radio quan trọng với bark thấp.                       |

# 6. KỊCH BẢN NHIỆM VỤ 01 — MẮT BÃO

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>LOGLINE<br />
Trong tâm bão áp sát thành phố cảng Vạn Hải, tổ Sơn Ưng phải xâm nhập
khu cảng bị chiếm, cứu một kỹ sư mạng và khôi phục trạm dẫn đường trước
khi đoàn cứu trợ đi vào vùng tín hiệu giả.</strong></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 6.1. Bối cảnh và nhân vật

Năm 2034, Vạn Hải là thành phố cảng hư cấu đang sơ tán sau siêu bão. Một
công ty an ninh tư nhân phản loạn tên Kình Xám chiếm hệ thống dẫn đường
khẩn cấp, phát tín hiệu giả để chuyển hướng tàu cứu trợ vào vùng cạn.
Đây là thế giới hư cấu; không đại diện cho lực lượng hoặc xung đột có
thật.

| **Nhân vật**                | **Vai trò**        | **Chất giọng / chức năng**                                              |
|-----------------------------|--------------------|-------------------------------------------------------------------------|
| Đại úy VY · “Sơn Ưng 1”     | Chỉ huy tổ         | Ngắn, bình tĩnh, ra lệnh rõ; dẫn nhịp và mở cửa script.                 |
| Thượng sĩ NAM · “Sơn Ưng 2” | Người chơi         | Nhân vật ít thoại; phản hồi ngắn để giữ nhập vai.                       |
| DUY · “Sơn Ưng 3”           | Trinh sát/kỹ thuật | Khô, quan sát tốt; giải thích mục tiêu mà không thành tutorial lộ liễu. |
| AN                          | Kỹ sư mạng dân sự  | Căng thẳng nhưng có năng lực; là chìa khóa khôi phục hệ thống.          |
| TRẠM BẮC                    | Điều phối radio    | Cung cấp đồng hồ, threat update và exfil.                               |

# 6.2. Nhịp nhiệm vụ

| **Thời gian** | **Beat**           | **Gameplay**                                                      | **Kỹ thuật được chứng minh**                             |
|---------------|--------------------|-------------------------------------------------------------------|----------------------------------------------------------|
| 00:00–01:30   | Tiếp cận trong bão | Xuồng lướt qua cảng; học nhìn/ADS; set piece sét đánh.            | Mưa GPU, nước/SSR giả lập, audio 3D, streaming.          |
| 01:30–04:00   | Bến số 4           | Hạ 2 lính gác hoặc lách qua bóng tối; cắt relay phụ.              | Stealth suspicion, takedown/hitscan, interaction.        |
| 04:00–07:00   | Mê cung container  | Hai tuyến: catwalk cao hoặc lối ngập thấp; giao tranh trung bình. | Navmesh, cover AI, decals, batched props, checkpoint.    |
| 07:00–09:30   | Trạm bơm           | Breach, cứu An; mất điện cục bộ, chuyển đèn khẩn cấp.             | Door state, ally handoff, lighting state transition.     |
| 09:30–13:00   | Khôi phục Mắt Bão  | An upload trong 90 giây; địch đánh 3 hướng; người chơi đổi tầng.  | Encounter director, spawn budget, dialogue priority.     |
| 13:00–15:30   | Cần cẩu đổ         | Tín hiệu khôi phục; cần cẩu sập chắn đường; thoát qua kho lạnh.   | Scripted destruction, dust particles, dynamic objective. |
| 15:30–17:00   | Rút khỏi cảng      | Chạy ra cầu tàu, bắn chặn ngắn, lên xuồng.                        | Streaming unload, final score, checkpoint complete.      |

# 6.3. Nhánh tiếp cận và trạng thái

| **Biến**     | **Điều kiện**                                | **Hệ quả**                                                                                         |
|--------------|----------------------------------------------|----------------------------------------------------------------------------------------------------|
| alarm_state  | Không bị phát hiện ở Bến số 4 / bị phát hiện | Stealth: ít địch hơn ở container. Alarm: floodlight đỏ, thêm 1 tổ phản ứng, thoại thay đổi.        |
| relay_cut    | Relay phụ đã tắt trước 04:00                 | Camera giám sát ngừng; upload cuối giảm từ 105 xuống 90 giây.                                      |
| an_health    | An nhận damage trong escort                  | Không game over ngay; tốc độ di chuyển/chất lượng thoại thay đổi; dưới ngưỡng thì checkpoint fail. |
| route_choice | Catwalk / lối ngập                           | Khác góc nhìn và loại encounter; hội tụ tại trạm bơm.                                              |
| ammo_support | Người chơi mở kho phụ                        | Có crate trước defense; đổi lại mất 20–30 giây và dễ kích hoạt patrol.                             |

# 6.4. Thoại tiếng Việt — bản dựng

| **Cue**                 | **Người nói** | **Lời thoại**                                                                                                |
|-------------------------|---------------|--------------------------------------------------------------------------------------------------------------|
| D01 · Intro             | TRẠM BẮC      | Sơn Ưng, còn mười bảy phút trước khi đoàn cứu trợ vào luồng. Tín hiệu từ Vạn Hải đang dẫn họ lệch ba hải lý. |
| D02                     | VY            | Nghe rõ. Tắt máy ngoài phao đỏ. Từ đó đi im lặng.                                                            |
| D03                     | DUY           | Mưa che tiếng chân, nhưng đèn quét vẫn thấy bóng. Bám sát mép kho.                                           |
| D04 · Pier              | VY            | Nam, lính gác bên phải. Hạ gọn hoặc để họ đi qua — anh chọn.                                                 |
| D05 · Stealth success   | DUY           | Relay phụ đã ngủ. Camera phía trong mù rồi.                                                                  |
| D06 · Alarm             | VY            | Lộ rồi. Bỏ im lặng, tiến nhanh trước khi họ khóa trạm bơm.                                                   |
| D07 · Container         | DUY           | Hai đường. Catwalk cao, nhìn rộng. Lối ngập thấp, gần hơn nhưng không có chỗ lùi.                            |
| D08                     | VY            | Nam dẫn. Tôi giữ giữa, Duy khóa đuôi.                                                                        |
| D09 · Ambush            | DUY           | Tiếp xúc, tầng hai! Sau tấm bạt xanh!                                                                        |
| D10                     | VY            | Đừng ghim ở một góc. Đổi cover, ép sườn trái.                                                                |
| D11 · Pump room         | AN            | Đừng bắn! Tôi là An — họ bắt tôi giữ hệ thống chạy.                                                          |
| D12                     | VY            | An, cô khôi phục được Mắt Bão không?                                                                         |
| D13                     | AN            | Được. Nhưng phải lên phòng điều khiển. Ở đây chỉ là bộ lặp.                                                  |
| D14 · Power cut         | DUY           | Mất nguồn chính. Đèn khẩn cấp còn ba mươi phần trăm.                                                         |
| D15                     | VY            | Tốt. Bóng tối cũng che chúng ta. Di chuyển.                                                                  |
| D16 · Upload start      | AN            | Tôi cần chín mươi giây. Nếu relay phụ còn sống, sẽ lâu hơn.                                                  |
| D17                     | TRẠM BẮC      | Kình Xám đang dồn vào ba cửa. Sơn Ưng, giữ cho đến khi tín hiệu chuyển xanh.                                 |
| D18 · Wave 1            | VY            | Cửa đông! Nam giữ cầu thang, Duy nhìn catwalk.                                                               |
| D19 · Wave 2            | DUY           | Khói ở cửa bắc. Họ muốn kéo ta khỏi terminal.                                                                |
| D20 · Low player health | VY            | Nam, lùi nửa nhịp. Tôi che.                                                                                  |
| D21 · Upload 80%        | AN            | Tám mươi phần trăm. Bản đồ luồng đang trở lại.                                                               |
| D22 · Complete          | TRẠM BẮC      | Tín hiệu sạch. Đoàn cứu trợ đã sửa hướng.                                                                    |
| D23 · Collapse          | DUY           | Cần cẩu đang trượt! Chạy!                                                                                    |
| D24                     | VY            | Bỏ giao chiến. Theo vạch vàng ra cầu tàu.                                                                    |
| D25 · Exfil             | AN            | Họ không chỉ muốn cướp hàng. Trong log có lệnh phát tín hiệu từ ngoài thành phố.                             |
| D26 · Outro             | VY            | Giữ file đó. Ra khỏi đây rồi nói tiếp.                                                                       |

# 6.5. Điều kiện hoàn thành, thất bại và checkpoint

| **Loại**          | **Điều kiện**                                                                                                 |
|-------------------|---------------------------------------------------------------------------------------------------------------|
| Complete          | An hoàn tất upload; người chơi và An vào vùng exfil; cinematic outro chạy đúng một lần.                       |
| Fail              | Player health = 0; An health dưới ngưỡng tại segment escort/defense; timer cứu trợ hết trong final objective. |
| Checkpoint CP1    | Relay hoặc bypass hoàn thành; lưu alarm_state, ammo, health, route prep.                                      |
| Checkpoint CP2    | An được giải cứu; lưu trạng thái power, relay_cut, inventory.                                                 |
| Checkpoint CP3    | Upload hoàn thành; khóa encounter, mở đường exfil.                                                            |
| Restart invariant | Mọi door, actor, dialogue, timer, decal pool và mission flag trở về snapshot; không duplicate event.          |

# 7. YÊU CẦU TRÌNH BÀY, ÂM THANH VÀ UX

| **ID**       | **Yêu cầu**                                                        | **Ưu tiên** | **Tiêu chí nghiệm thu**                                       |
|--------------|--------------------------------------------------------------------|-------------|---------------------------------------------------------------|
| **REN-001**  | WebGPU primary; WebGL 2 fallback bằng cùng content path.           | Must        | Capability screen ghi backend; smoke test cả hai.             |
| **REN-002**  | Lighting PBR, tone mapping, fog, wetness, rain và quality tiers.   | Must        | Preset Low/Medium/High không đổi gameplay.                    |
| **REN-003**  | Shader compile/warmup ở loading hoặc trước set piece.              | Must        | Không hitch \>50 ms do shader lần đầu trong replay chuẩn.     |
| **REN-004**  | Dynamic resolution theo GPU/frame pressure.                        | Must        | Scale thay đổi từ từ; UI không mờ; hysteresis chống dao động. |
| **VFX-001**  | Mưa, bụi, tia lửa, muzzle và impact dùng pool/instancing.          | Must        | Không leak sau loop combat 10 phút.                           |
| **AUD-001**  | Bus master, SFX, dialogue, radio, music; ducking theo priority.    | Must        | Thoại objective nghe rõ giữa giao tranh.                      |
| **AUD-002**  | Âm súng 3 lớp: transient, body, tail theo zone.                    | Should      | Indoor/outdoor khác rõ bằng mix/reverb preset.                |
| **UX-001**   | HUD tối giản: ammo, health trạng thái, objective, interact prompt. | Must        | Không che vùng ngắm; scale đúng 16:10 và 16:9.                |
| **UX-002**   | Toàn bộ UI/thoại/phụ đề tiếng Việt; localization key tách data.    | Must        | Không còn chuỗi UI hard-code ngoài dev overlay.               |
| **A11Y-001** | Subtitles, speaker label, text size, background opacity.           | Must        | Đọc được ở 1080p và màn Retina.                               |
| **A11Y-002** | Toggle motion blur, camera shake, head bob; FOV và sensitivity.    | Must        | Settings áp dụng tức thời và lưu IndexedDB.                   |
| **A11Y-003** | Remap keyboard/mouse cơ bản và hold/toggle ADS/crouch.             | Should      | Conflict key được cảnh báo.                                   |

# 8. MISSION DATA VÀ HỢP ĐỒNG NỘI DUNG

Mission không hard-code thành một chuỗi if/else lớn. Nội dung được mô tả
bằng graph data, còn runtime chỉ thực thi node/action đã allow-list.
Cách này giúp AI tạo/đổi kịch bản mà không phá engine.

| **Record**          | **Trường bắt buộc**                                           | **Quy tắc**                                          |
|---------------------|---------------------------------------------------------------|------------------------------------------------------|
| MissionDefinition   | id, version, seedPolicy, startNode, checkpoints, localization | Có schema; version bất biến trong một build.         |
| MissionNode         | id, type, enterConditions, actions, exitConditions, next      | Action idempotent; node có timeout/fallback.         |
| EncounterDefinition | spawnGroups, budget, routes, activation, completion           | Không spawn actor ngoài streaming zone sẵn sàng.     |
| DialogueCue         | cueId, speaker, audio, subtitleKey, priority, interruptPolicy | Không dùng tên file làm ID nghiệp vụ.                |
| CheckpointSnapshot  | missionFlags, actors, player, inventory, doors, timers        | Load phải xóa runtime state cũ trước khi restore.    |
| AssetManifest       | assetId, license, source, hash, LOD, texture budget, owner    | Asset không có license/hash không vào build release. |
| PerformanceReplay   | seed, inputTrack, buildHash, device, browser, metrics         | Kết quả benchmark phải tái dựng được.                |

# 9. QUY TRÌNH PHÁT TRIỂN BẰNG AI

Khuyến nghị dùng mô hình ba vai quen thuộc của anh: Chủ (anh Lâm) khóa
cảm giác, phạm vi và quyết định; Thầu (Codex hoặc Claude ở vai
planner/reviewer) chia hợp đồng; Thợ (Codex CLI hoặc Claude Code) triển
khai từng slice. Nếu dùng cả hai, một bên build, bên còn lại review độc
lập theo evidence thay vì cùng sửa một vùng code.

| **Artifact bắt buộc**          | **Mục đích**                                                                 |
|--------------------------------|------------------------------------------------------------------------------|
| AGENTS.md                      | Luật kiến trúc, lệnh test, vùng cấm, convention, cách ghi completion report. |
| docs/PRD.md                    | Bản nguồn machine-readable của tài liệu này; yêu cầu có ID.                  |
| docs/ADR/\*.md                 | Mỗi quyết định renderer/physics/nav/asset có context, decision, consequence. |
| contracts/\*.yaml              | Mỗi task có scope, file ownership, acceptance, test, evidence output.        |
| config/performance-budget.json | Ngưỡng CI và runtime overlay; không để ngân sách chỉ nằm trong prose.        |
| content/schemas/\*.json        | Schema mission, encounter, dialogue, asset manifest.                         |
| evidence/\<task-id\>/          | Screenshot, video, trace, benchmark JSON, log và completion report.          |
| snapshots/\<gate\>/            | Build hash, lockfile, asset manifest, replay seed và known issues.           |

# 9.1. Hợp đồng task chuẩn

| **Trường**         | **Ví dụ**                                                                         |
|--------------------|-----------------------------------------------------------------------------------|
| Goal               | “ADS chuyển FOV/camera/weapon pose trong 180 ms, không thay aim world direction.” |
| Scope              | game/weapons, game/player/camera; không sửa renderer core.                        |
| Acceptance         | 5 case input; replay deterministic; p95 update \<0,2 ms.                          |
| Visual evidence    | Video 10 giây hip→ADS→fire→reload ở 60 FPS.                                       |
| Automated evidence | Vitest state machine; Playwright debug trigger; perf JSON.                        |
| Rollback           | Feature flag weapons.adsV2; commit/snapshot trước merge.                          |
| Completion report  | File thay đổi, test pass, số đo, debt, rủi ro còn lại.                            |

# 9.2. Những việc AI không được tự quyết

- Mua hoặc nhập asset chưa xác minh license.

- Đổi phiên bản Three.js/Rapier/Recast giữa milestone mà không có ADR và
  benchmark A/B.

- Thêm feature mới để “làm đẹp” khi chưa qua acceptance hiện tại.

- Tự đánh giá “game feel đã tốt” chỉ bằng test tự động; phải có người
  chơi thật và video so sánh.

- Che performance regression bằng giảm chất lượng toàn cục mà không tìm
  nguyên nhân.

- Sao chép code, asset, âm thanh, UI, bản đồ hoặc lời thoại có bản quyền
  từ game tham chiếu.

# 10. GATE, LỘ TRÌNH VÀ TIÊU CHÍ DỪNG

| **Gate**               | **Tuần mục tiêu** | **Phạm vi**                                                  | **Pass bắt buộc**                                                                  |
|------------------------|-------------------|--------------------------------------------------------------|------------------------------------------------------------------------------------|
| G0 · Feasibility       | 1–2               | WebGPU scene, benchmark, input, basic collision, 1 bot dummy | Chrome WebGPU 60 FPS replay; fallback chạy; không device lost; chọn Three version. |
| G1 · Controller/weapon | 3–5               | Movement, camera, AR, hit/impact, greybox 1 zone             | Game feel review; physics deterministic đủ; không state-machine deadlock.          |
| G2 · Combat AI         | 6–8               | Navmesh, perception, cover, 6–8 địch, squad basic            | Encounter 3 phút hoàn thành 10 lần; không stuck; CPU trong budget.                 |
| G3 · Mission greybox   | 9–11              | Toàn bộ graph 12–18 phút, checkpoint, dialogue temp          | Chơi từ đầu đến cuối; restart sạch; hai route hội tụ đúng.                         |
| G4 · Visual target     | 12–15             | Art zone, lighting, rain, audio, animation, set piece        | Một zone “hero” đạt target; perf A/B không vượt ngưỡng đỏ.                         |
| G5 · Content complete  | 16–19             | Toàn map, audio VI, UI/A11y, balance                         | Không blocker; asset license complete; replay/soak pass.                           |
| G6 · Release candidate | 20–22             | Optimization, browser matrix, capture demo                   | 3 run không crash; 1% low đạt; Safari smoke; build reproducible.                   |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>ƯỚC LƯỢNG<br />
</strong>20–22 tuần là baseline cho một người làm toàn thời gian với AI,
dùng asset/animation có license và có hỗ trợ ngắn hạn cho 3D, rigging
hoặc âm thanh. Nếu làm bán thời gian và tự tạo phần lớn asset, nên dự
trù 7–10 tháng. Đây là ước lượng confidence trung bình, phải hiệu chỉnh
sau G1.</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 10.1. Tiêu chí dừng hoặc thu hẹp

| **Trigger**                           | **Hành động**                                                                                             |
|---------------------------------------|-----------------------------------------------------------------------------------------------------------|
| G0 không giữ 60 FPS ở greybox chuẩn   | Giảm render target/feature; benchmark WebGLRenderer; không tiếp tục art production.                       |
| WebGPURenderer thiếu feature critical | Dùng TSL alternative; nếu vẫn chặn, hạ feature hoặc chuyển renderer theo ADR, không patch sâu core Three. |
| AI CPU \>8 ms với 8 địch              | Giảm tick, simplify perception/cover, cache path; chỉ sau đó mới cân nhắc worker.                         |
| Art asset vượt budget \>25%           | Reject/retopo/recompress trước khi tích hợp; không chờ G5.                                                |
| Checkpoint không deterministic        | Dừng viết content mới; sửa snapshot/event idempotency.                                                    |
| Tiến độ trượt \>30% sau G3            | Bỏ route phụ hoặc set piece thứ hai; giữ mission complete.                                                |

# 11. CHIẾN LƯỢC KIỂM THỬ VÀ NGHIỆM THU

| **Lớp test**    | **Phạm vi**                                                             | **Evidence**                                             |
|-----------------|-------------------------------------------------------------------------|----------------------------------------------------------|
| Unit            | weapon state, recoil seed, damage, mission condition, config validation | Vitest report; coverage các module logic.                |
| Schema          | mission/encounter/dialogue/asset manifest                               | JSON Schema validation trong CI.                         |
| Simulation      | fixed-step controller, checkpoint restore, bot stuck recovery           | Deterministic seed + state hash.                         |
| E2E             | boot, chọn backend, load mission, debug teleport, complete objective    | Playwright trace/video/screenshot. \[S13\]               |
| Visual          | HUD 16:9/16:10, lighting target, regression hero shots                  | Approved reference + pixel/perceptual diff có tolerance. |
| Performance     | 90-second replay ở zone nặng nhất                                       | JSON median 3 run; browser/device/build hash.            |
| Soak            | Loop combat 20 phút; checkpoint 20 lần; restart mission                 | Memory trend, leak counters, no crash/device lost.       |
| Human game feel | Aim, recoil, readability, pacing, audio clarity                         | Scorecard 5 người; issue có severity và clip.            |

# 11.1. Definition of Done cho vertical slice

- Nhiệm vụ chơi từ intro đến outro trong 12–18 phút, không dùng debug
  command.

- Ba checkpoint load đúng trạng thái trong 20/20 lần thử.

- Chrome/WebGPU đạt performance gate trên máy chuẩn; Safari 26 hoàn
  thành smoke path.

- WebGL 2 fallback boot và chơi được mission ở quality Medium, dù không
  bắt buộc đạt cùng fidelity.

- Không asset thiếu nguồn/license/hash; không nội dung sao chép từ IP
  tham chiếu.

- Phụ đề tiếng Việt đầy đủ; settings thiết yếu và accessibility toggles
  hoạt động; không P0/P1, P2 phải có workaround và known issue.

# 12. RỦI RO VÀ GIẢM THIỂU

| **Mức** | **Rủi ro**                                         | **Tín hiệu sớm**                                              | **Giảm thiểu**                                                            |
|---------|----------------------------------------------------|---------------------------------------------------------------|---------------------------------------------------------------------------|
| High    | WebGPURenderer experimental / regression phiên bản | Shader thiếu, device lost, WebGL nhanh hơn                    | Pin version; G0 A/B; feature flags; upgrade chỉ tại gate. \[S04\]         |
| High    | Scope bị kéo về AAA                                | Thêm súng/map/vehicle trước mission complete                  | One mission rule; backlog; G3 full greybox trước art polish.              |
| High    | Asset/animation không đồng nhất                    | Tỉ lệ, texel density, skeleton và foot slide lệch             | Art bible; asset validator; retarget test trước mua hàng loạt.            |
| High    | AI sinh code tạo entropy                           | Module cross-import, duplicate systems, test giả              | File ownership; ADR; contract; reviewer độc lập; delete code không dùng.  |
| Medium  | Retina DPR làm GPU quá tải                         | GPU \>14 ms khi fullscreen                                    | Dynamic resolution; cap pixel ratio; presets theo benchmark.              |
| Medium  | GC/memory leak trong VFX/audio                     | Heap tăng sau mỗi encounter                                   | Pools, disposal contract, soak test, asset reference counter.             |
| Medium  | Navmesh/AI stuck                                   | Bot kẹt cửa/catwalk                                           | Off-mesh links; stuck detector; cover marker validation.                  |
| Medium  | Thoại bị chìm trong combat                         | Người test bỏ lỡ objective                                    | Priority/ducking/subtitle; bark cooldown; mix review.                     |
| Medium  | IP quá giống Call of Duty                          | UI, thoại, map silhouette hoặc set piece tương đồng trực tiếp | Original world bible; legal/IP review; chỉ tham chiếu nhịp và chất lượng. |
| Low     | Safari khác hành vi Chrome                         | Shader/post FX sai hoặc input khác                            | Chrome primary; Safari smoke mỗi gate; fallback path.                     |

# 13. BACKLOG SAU v0.1

| **Thứ tự** | **Năng lực**                             | **Điều kiện mở**                                            |
|------------|------------------------------------------|-------------------------------------------------------------|
| 1          | Mission 02 dùng lại engine và asset cảng | G6 ổn định; content authoring \<30% effort mission 01.      |
| 2          | Gamepad và Windows/Chrome matrix         | Input abstraction sạch; performance budget còn dư.          |
| 3          | Squad command tối giản                   | AI/nav đạt độ tin cậy; UI không làm loãng FPS loop.         |
| 4          | Destruction mở rộng                      | Pool/physics budget chứng minh được; authoring pipeline rõ. |
| 5          | Co-op 2 người prototype                  | Chỉ sau khi single-player loop ổn; tạo PRD/netcode riêng.   |
| 6          | Campaign/chapter system                  | Có ít nhất 2 mission chứng minh reuse và save migration.    |

# 14. SOURCE REGISTRY VÀ MỨC TIN CẬY

Registry này tương ứng Gate S0–S3 của phương pháp cào lọc: nguồn gốc
chính thức, claim tối thiểu, evidence role rõ và không biến khả năng API
thành cam kết hiệu năng của game.

| **ID** | **Publisher**                    | **Nguồn**                                              | **Claim dùng trong PRD**                                                                                                                                                                                                   | **Conf.** |
|--------|----------------------------------|--------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------|
| S01    | Apple Support                    | MacBook Pro (16-inch, 2021) - Technical Specifications | M1 Max configurations include 24-core or 32-core GPU; M1 Max memory bandwidth is 400 GB/s                                                                                                                                  | 0.98      |
| S02    | Chrome for Developers            | Chrome ships WebGPU                                    | WebGPU is available by default on Chrome for macOS; WebGPU exposes modern graphics and general-purpose GPU computation                                                                                                     | 0.98      |
| S03    | WebKit                           | WebKit Features in Safari 26.0                         | Safari 26.0 ships WebGPU on macOS; WebGPU maps more directly to Metal than WebGL                                                                                                                                           | 0.98      |
| S04    | Three.js                         | WebGPURenderer manual                                  | WebGPURenderer can fall back to WebGL 2; TSL transpiles to WGSL or GLSL; WebGPURenderer includes a node-based post-processing stack; WebGPURenderer remains experimental and can underperform WebGLRenderer in some scenes | 0.97      |
| S05    | Three.js                         | WebGPURenderer API                                     | WebGPU is the default backend when supported; WebGL 2 is the fallback backend; MSAA and output buffer precision are configurable                                                                                           | 0.98      |
| S06    | Three.js                         | GLTFLoader API                                         | GLTFLoader supports KTX2/Basis textures; GLTFLoader supports Meshopt and Draco compressed geometry                                                                                                                         | 0.98      |
| S07    | glTF Transform project           | glTF Transform                                         | The tool can resize and compress textures; The tool can improve VRAM use with KTX2/Basis Universal                                                                                                                         | 0.96      |
| S08    | Dimforge                         | Rapier JavaScript Getting Started                      | Rapier 3D is distributed as a JavaScript package; Rapier is a WebAssembly module loaded asynchronously                                                                                                                     | 0.98      |
| S09    | isaac-mason/recast-navigation-js | recast-navigation-js                                   | The project is a WebAssembly port of Recast and Detour; It provides navmesh, pathfinding and crowd simulation APIs; It includes helpers for Three.js                                                                       | 0.92      |
| S10    | Three.js                         | BatchedMesh, InstancedMesh and LOD APIs                | BatchedMesh reduces draw calls for many objects sharing a material                                                                                                                                                         | 0.98      |
| S11    | Three.js                         | PointerLockControls API                                | PointerLockControls is designed for first-person 3D games; Raw mouse input can be requested                                                                                                                                | 0.98      |
| S12    | Three.js                         | PositionalAudio API                                    | Three.js exposes 3D positional audio through a PannerNode                                                                                                                                                                  | 0.98      |
| S13    | Microsoft Playwright             | Playwright test use options                            | Playwright can capture screenshots, video and execution traces                                                                                                                                                             | 0.98      |

# 14.1. Liên kết nguồn

**\[S01\] Apple Support — MacBook Pro (16-inch, 2021) - Technical
Specifications:**
[<u>https://support.apple.com/en-hk/111901</u>](https://support.apple.com/en-hk/111901)

**\[S02\] Chrome for Developers — Chrome ships WebGPU:**
[<u>https://developer.chrome.com/blog/webgpu-release</u>](https://developer.chrome.com/blog/webgpu-release)

**\[S03\] WebKit — WebKit Features in Safari 26.0:**
[<u>https://webkit.org/blog/17333/webkit-features-in-safari-26-0/</u>](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)

**\[S04\] Three.js — WebGPURenderer manual:**
[<u>https://threejs.org/manual/en/webgpurenderer</u>](https://threejs.org/manual/en/webgpurenderer)

**\[S05\] Three.js — WebGPURenderer API:**
[<u>https://threejs.org/docs/pages/WebGPURenderer.html</u>](https://threejs.org/docs/pages/WebGPURenderer.html)

**\[S06\] Three.js — GLTFLoader API:**
[<u>https://threejs.org/docs/pages/GLTFLoader.html</u>](https://threejs.org/docs/pages/GLTFLoader.html)

**\[S07\] glTF Transform project — glTF Transform:**
[<u>https://gltf-transform.dev/</u>](https://gltf-transform.dev/)

**\[S08\] Dimforge — Rapier JavaScript Getting Started:**
[<u>https://rapier.rs/docs/user_guides/javascript/getting_started_js/</u>](https://rapier.rs/docs/user_guides/javascript/getting_started_js/)

**\[S09\] isaac-mason/recast-navigation-js — recast-navigation-js:**
[<u>https://github.com/isaac-mason/recast-navigation-js</u>](https://github.com/isaac-mason/recast-navigation-js)

**\[S10\] Three.js — BatchedMesh, InstancedMesh and LOD APIs:**
[<u>https://threejs.org/docs/pages/BatchedMesh.html</u>](https://threejs.org/docs/pages/BatchedMesh.html)

**\[S11\] Three.js — PointerLockControls API:**
[<u>https://threejs.org/docs/pages/PointerLockControls.html</u>](https://threejs.org/docs/pages/PointerLockControls.html)

**\[S12\] Three.js — PositionalAudio API:**
[<u>https://threejs.org/docs/pages/PositionalAudio.html</u>](https://threejs.org/docs/pages/PositionalAudio.html)

**\[S13\] Microsoft Playwright — Playwright test use options:**
[<u>https://playwright.dev/docs/test-use-options</u>](https://playwright.dev/docs/test-use-options)

# 15. CHECKLIST KHỞI ĐỘNG 72 GIỜ

| **Thời điểm** | **Việc phải làm**                                                                                      | **Output**                                   |
|---------------|--------------------------------------------------------------------------------------------------------|----------------------------------------------|
| 0–4 giờ       | Xác định M1 Max 24 hay 32 GPU cores; cập nhật macOS/Chrome; bật dev tools; tạo repo và lock Node.      | device-profile.json; repo sạch; AGENTS.md.   |
| 4–12 giờ      | Vite TS + three/webgpu; scene benchmark gồm 200 props, 8 skinned dummies, mưa, 1 shadow sun, 2 lights. | G0 benchmark scene; WebGPU/WebGL toggle.     |
| 12–20 giờ     | Telemetry overlay: FPS, p95, CPU/GPU proxy, draw calls, tris, actors, heap.                            | performance-report.json; overlay screenshot. |
| 20–32 giờ     | Rapier capsule controller + pointer lock + fixed-step clock.                                           | Movement replay; collision test.             |
| 32–44 giờ     | Một AR greybox: hip/ADS/fire/reload/hit decal/audio placeholder.                                       | Weapon contract pass; 15-second clip.        |
| 44–56 giờ     | Một bot navmesh patrol→detect→cover→fire.                                                              | AI replay 3 phút; stuck log.                 |
| 56–64 giờ     | Một mission node: enter zone→radio→spawn→complete→checkpoint.                                          | Mission schema + restore test.               |
| 64–72 giờ     | Chạy 3 benchmark; lập ADR; quyết định GO/ADJUST/STOP.                                                  | G0 report và snapshot.                       |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>HÀNH ĐỘNG ĐẦU TIÊN ĐỀ XUẤT<br />
Không bắt đầu bằng model súng hay map đẹp. Hãy build “benchmark arena”
xấu nhưng đo được. Nếu arena không đạt frame budget và lifecycle sạch,
art đẹp chỉ làm lỗi đắt hơn.</strong></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**— END OF PRD v0.1 —**
