# BLUEPRINT: Hải Tuyến · HT-MB · Gate G0 (Feasibility)
## Vibecode Kit v6.1 · Contractor: Claude · Status: APPROVED (auto, D-005)

### PROJECT INFO
| Field | Value |
|-------|-------|
| Project | Hải Tuyến — Nhiệm vụ 01 · Mắt Bão (HT-MB) |
| Nature | Web UI (canvas + DOM overlay) + Realtime fixed-step simulation + Single player, local state |
| Gate | G0 · Feasibility — "benchmark arena xấu nhưng đo được" |
| Date | 2026-09-02 |
| Thiết bị chuẩn | MacBook Pro M1 Max 32 GB · Chrome Stable |

### GOALS
**Primary Goal:** Chứng minh pipeline Three.js WebGPU + Rapier + Recast + mission data-driven chạy end-to-end, có telemetry, có test, để ra phán quyết GO/ADJUST/STOP trước khi tốn tiền cho art.
**Target Audience:** Chủ nhà (quyết định G0) · Thợ ở các gate sau (kế thừa engine) · cộng đồng vibecode (đọc evidence).
**Key Message:** Không có số đo trên M1 Max thì chưa có gì để tin. Mọi con số trong repo đều gắn `evidence_status`.

### VISION — phân loại theo vision-guide
| Dimension | Kết luận |
|---|---|
| Interface | Canvas WebGPU/WebGL2 toàn màn hình + DOM overlay (HUD, telemetry, capability screen) |
| Data flow | Content JSON (mission, tuning, locale) → validate schema → runtime; telemetry → JSON → dev server → `evidence/` |
| User model | Single player; dev overlay cho Operator; debug API cho QA |
| Lifecycle | Realtime: fixed 60 Hz sim → variable render; event-driven mission |
| Scale | Personal / demo; không backend |
| State | In-memory + CheckpointSnapshot; settings IndexedDB |

### ARCHITECTURE
```
                 ┌───────────────────────── src/main.ts (boot) ─────────────────────────┐
                 │ capability screen → chọn backend → load content → init physics/nav   │
                 │ → build arena → start Game loop                                      │
                 └──────────────────────────────────────────────────────────────────────┘
   engine/core            engine/render            engine/physics        engine/nav
   clock (fixed 60Hz)     backend select           Rapier world          Recast navmesh
   events (id, idem.)     TSL materials/rain       capsule controller    path query
   scheduler tiers        lighting, fog            ray/shape queries     stuck helpers
   prng, pools, ids       scaler (dyn. res.)
        ▲                     ▲                        ▲                    ▲
        │ tick60 / tick10 / render(alpha)              │                    │
   game/player ──── game/weapons ──── game/ai ──── game/mission ──── game/actors
   move/stance      state machine    perception     graph runtime     skinned dummy
   camera layers    recoil/hitscan   bot FSM/LOD    checkpoint        (procedural)
        │                 │  events (FIRE, HIT, RADIO, OBJECTIVE, CHECKPOINT …)
        ▼                 ▼
   ui/ (hud, subtitles, overlay, i18n)         qa/ (telemetry, debugApi, bench, replay)
                                               └─► POST /__bench → scripts/bench-plugin (Vite) → evidence/G0/*.json
```
Quy tắc cứng (từ PRD §3.2): module `engine/*` không biết mission; `game/weapons` không spawn VFX/SFX trực tiếp (phát event); `game/ai` không hard-code timeline; `content/` không chứa logic TS; `qa/debug` không ship trong build release (`import.meta.env.PROD` gate).

### RUNTIME LOOP (PRD §3.1)
```
requestAnimationFrame
  ├─ input snapshot (pointer lock, keys)          [render thread, read-only]
  ├─ accumulator += dt; while (acc ≥ 1/60):        [60 Hz fixed]
  │     player.step → physics.step → weapons.step → hits → mission.step(events)
  │     every 6th tick (10 Hz): ai.think (perception, cover, replan)
  ├─ alpha = acc / (1/60) → interpolate transforms [render, không mutate sim]
  ├─ camera layers compose (look + bob + recoil + shake)
  ├─ scaler.update(frameTime) → renderer.setPixelRatio
  └─ renderer.render → telemetry.sample(frame)
```

### DESIGN SYSTEM (UI overlay tối giản — không phải art)
Font: `Inter, system-ui` (HUD) · `JetBrains Mono, monospace` (telemetry) · Màu: nền `#0b0f14`, chữ `#e6edf3`, accent objective `#ffb454`, danger `#ff5c5c`, ok `#3fb950`. HUD không che tâm ngắm; scale bằng CSS `clamp()` cho 16:10 và 16:9.

### TECH STACK (pinned — ADR-001..003)
| Layer | Package | Version |
|---|---|---|
| Build | vite | 8.2.2 |
| Lang | typescript (strict, `noUncheckedIndexedAccess`) | 7.0.2 |
| Render | three (`three/webgpu`, `three/tsl`) | 0.185.1 |
| Physics | @dimforge/rapier3d-compat | 0.20.0 |
| Nav | recast-navigation, @recast-navigation/three | 0.43.1 |
| Schema | ajv | 8.20.0 |
| Unit test | vitest | 4.1.11 |
| E2E | @playwright/test | 1.62.1 |

### FILE STRUCTURE
```
hai-tuyen/
├── AGENTS.md                      # luật kiến trúc, lệnh test, vùng cấm, completion report
├── package.json · tsconfig.json · vite.config.ts · vitest.config.ts · playwright.config.ts
├── index.html
├── config/performance-budget.json # PRD §4.1, evidence_status
├── content/
│   ├── schemas/{mission,dialogue,checkpoint,performance-replay}.schema.json
│   ├── missions/g0-arena.mission.json
│   ├── locale/vi.json
│   └── tuning/{weapons,ai,player}.json
├── docs/ {PRD.md, RRI.md, BLUEPRINT.md, DECISIONS.md, ADR/ADR-00x.md, tips/TIP-00x.md, VERIFY.md}
├── contracts/TIP-00x.yaml
├── evidence/TIP-00x/completion-report.md · evidence/G0/performance-report-*.json
├── snapshots/G0/{build-hash.txt, package-lock.json, known-issues.md}
├── scripts/{bench-plugin.ts, snapshot.mjs}
├── src/
│   ├── main.ts
│   ├── engine/core/{clock,events,scheduler,prng,pool,ids}.ts
│   ├── engine/render/{backend,materials,lighting,rain,scaler,arena,telemetryHooks}.ts
│   ├── engine/physics/{world,controller,layers}.ts
│   ├── engine/nav/navmesh.ts
│   ├── engine/input/{pointerLock,input,replay}.ts
│   ├── engine/audio/audio.ts
│   ├── game/player/{player,camera,settings}.ts
│   ├── game/weapons/{stateMachine,recoil,hitscan,weapon,fx}.ts
│   ├── game/ai/{perception,bot,cover,lod}.ts
│   ├── game/mission/{types,loader,runtime,checkpoint}.ts
│   ├── game/actors/dummy.ts
│   ├── ui/{i18n,hud,subtitles,overlay,capability}.ts
│   └── qa/{telemetry,debugApi,bench}.ts
└── tests/unit/*.test.ts · tests/e2e/*.spec.ts
```

### RRI REQUIREMENTS MATRIX
| Blueprint Section | Requirements | Source |
|---|---|---|
| Scaffold + governance | G0-01, G0-14 | PRD §9, §15 |
| engine/core | G0-06 | PRD §3.1 |
| engine/render + arena | G0-02, G0-03, G0-05 | PRD REN-001/004, §4, §15 |
| qa/telemetry + bench | G0-04, G0-12, G0-16 | PRD §4, §8, §11 |
| engine/physics + game/player + input | G0-07, G0-08 | PRD PLY-001..003, A11Y-002 |
| game/weapons | G0-09 | PRD WPN-001..004 |
| game/ai + engine/nav | G0-10 | PRD AI-001..004 |
| game/mission + content | G0-11, G0-15 | PRD §6.5, §8, UX-002 |
| tests | G0-13 | PRD §11 |

### TASK DECOMPOSITION PREVIEW
```
TIP-001 Scaffold + governance ─────────────────────────────┐
   ▼                                                        │
TIP-002 engine/core (clock, events, prng, pool, scheduler)  │
   ▼                                                        │
TIP-003 Renderer backend + benchmark arena + scaler         │
   ▼                                                        │
TIP-004 Telemetry overlay + replay + bench harness          │
   ▼                                                        │
TIP-005 Physics + player controller + input + settings      │
   ▼                                                        │
TIP-006 AR weapon greybox (SM, recoil, hitscan, pools)      │
   ▼                                                        │
TIP-007 Navmesh + bot AI (perception, FSM, LOD, stuck)      │
   ▼                                                        │
TIP-008 Mission node + schema + checkpoint + debug API      │
   ▼                                                        │
TIP-009 E2E Playwright + snapshot G0 + evidence ◄───────────┘
   ▼
VERIFY (Contractor) → bench trên M1 Max → GO/ADJUST/STOP
```
Estimated: 9 TIP · ~4–5k LOC TS · ≥25 unit tests · ≥4 E2E.

### CHECKPOINT
- [x] Architecture khớp PRD §3, §3.1, §3.2
- [x] Design overlay tối giản, không art (PRD §15 "xấu nhưng đo được")
- [x] Requirements G0-01..16 phủ checklist 72h
- [x] Task decomposition tuyến tính vì mỗi TIP phụ thuộc TIP trước (1 Thợ)
- [x] Không thiếu: bench trên Mac (G0-16), audit trail (G0-14)

APPROVED — auto theo D-005 (Human quyết ở RRI Q3). Human review lại tại VERIFY.
