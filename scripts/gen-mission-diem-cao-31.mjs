#!/usr/bin/env node
/**
 * Sinh content/missions/diem-cao-31.mission.json + diem-cao-31.dialogue.json (M2 R1 — C1 "Chân đồi" + C2 "Hàng rào",
 * kịch bản docs/story/KICH-BAN-M2-v0.1.md §3, Blueprint G2 R1). Cue B01–B14 + bark dùng lại M10–M15 (locale vi.json).
 * Chạy: node scripts/gen-mission-diem-cao-31.mjs
 */
import { writeFileSync, readFileSync } from 'node:fs';

const level = JSON.parse(readFileSync('content/levels/diem-cao-31.level.json', 'utf8'));
const z = (id) => ({ id, center: [level.zones[id].center[0], 0, level.zones[id].center[1]], radius: level.zones[id].radius });
const zones = ['foot_31', 'w1', 'w2', 'w3', 'mg', 'trench', 'cp', 'top', 'lz'].map(z);

const node = (id, type, enter, actions, exit, next, timeoutMs = 0, fallbackNext = null) => ({ id, type, enterConditions: enter, actions, exitConditions: exit, next, timeoutMs, fallbackNext });
const radio = (cue) => ({ type: 'radio', cue });
const charge = (k, prop) => ({ type: 'interactable', interactId: `${k}_charge`, zone: k, holdMs: 2600, promptKey: 'charge', fuseMs: 3000, prop, blastRadius: 6, blastDamage: 35 });

const nodes = [
  node('n_intro', 'script', [{ type: 'always' }], [
    { type: 'spawn', group: 'squad' },
    { type: 'squad_order', order: 'follow' },
    radio('B01'),
    { type: 'objective', objectiveKey: 'obj_m2_foot', marker: 'foot_31' },
    { type: 'checkpoint', checkpoint: 'cp0' },
  ], [{ type: 'always' }], 'n_approach'),
  // C1 chân đồi: briefing + pháo chuẩn bị 20 s (flag arty → game bắn pháo lên đỉnh) + 3 phút im (rút còn 6 s)
  node('n_approach', 'script', [{ type: 'zone_enter', zone: 'foot_31' }], [
    { type: 'squad_order', order: 'hold' },
    radio('B02'),
    radio('B03'),
    radio('B04'),
    radio('B05'),
    radio('B06'),
    { type: 'set_flag', flag: 'arty', value: true },
    { type: 'objective', objectiveKey: 'obj_m2_wait', marker: 'foot_31' },
  ], [{ type: 'active_ms', ms: 30000 }], 'n_go'),
  node('n_go', 'script', [{ type: 'always' }], [
    { type: 'set_flag', flag: 'arty', value: false },
    { type: 'set_flag', flag: 'flares', value: true },
    radio('B07'),
    { type: 'squad_order', order: 'follow' },
    { type: 'objective', objectiveKey: 'obj_m2_wire1', marker: 'w1' },
    charge('w1', 'wire_1_gap'),
  ], [{ type: 'flag', flag: 'w1_charge_blown', value: true }], 'n_wire2'),
  // C2a: hầm M60 mở máy khi rào 1 nổ
  node('n_wire2', 'encounter', [{ type: 'always' }], [
    { type: 'spawn', group: 'para_mg' },
    radio('B08'),
    radio('B09'),
    { type: 'objective', objectiveKey: 'obj_m2_wire2', marker: 'w2' },
    charge('w2', 'wire_2_gap'),
  ], [{ type: 'flag', flag: 'w2_charge_blown', value: true }], 'n_wire3'),
  node('n_wire3', 'encounter', [{ type: 'always' }], [
    { type: 'objective', objectiveKey: 'obj_m2_wire3', marker: 'w3' },
    charge('w3', 'wire_3_gap'),
  ], [{ type: 'flag', flag: 'w3_charge_blown', value: true }], 'n_mg'),
  // C2b: hoả điểm (R1: 2 lính sau bao cát; R3 thay bằng gọi B40)
  node('n_mg', 'encounter', [{ type: 'always' }], [
    { type: 'objective', objectiveKey: 'obj_m2_mg', marker: 'mg' },
    { type: 'spawn', group: 'para_trench' },
  ], [{ type: 'group_dead', group: 'para_mg' }], 'n_trench'),
  // C2c: hào + hầm chỉ huy
  node('n_trench', 'encounter', [{ type: 'always' }], [
    radio('B10'),
    { type: 'objective', objectiveKey: 'obj_m2_trench', marker: 'cp' },
    { type: 'spawn', group: 'para_top' },
  ], [{ type: 'group_dead', group: 'para_trench' }], 'n_cp', 150000, 'n_cp'),
  node('n_cp', 'objective', [{ type: 'zone_enter', zone: 'cp' }], [
    radio('B11'),
    radio('B12'),
    { type: 'set_flag', flag: 'flares', value: false },
    { type: 'checkpoint', checkpoint: 'cpA' },
    { type: 'objective', objectiveKey: 'obj_m2_top', marker: 'top' },
  ], [{ type: 'group_dead', group: 'para_top' }], 'n_tanks', 180000, 'n_tanks'),
  // C2d: tiếng xích — R1 chưa có xe; tăng lên yên ngựa = âm + thoại; R3 thay bằng PT-76 thật
  node('n_tanks', 'script', [{ type: 'always' }], [
    { type: 'set_flag', flag: 'tanks', value: true },
    radio('B13'),
    radio('B14'),
    { type: 'checkpoint', checkpoint: 'cpB' },
    { type: 'objective', objectiveKey: 'obj_m2_hold', marker: 'top' },
  ], [{ type: 'active_ms', ms: 14000 }], 'n_done'),
  node('n_done', 'terminal', [{ type: 'always' }], [{ type: 'objective_complete', objectiveKey: 'obj_m2_hold' }, { type: 'mission_complete' }], [{ type: 'always' }], null),
];

const mission = {
  $schema: '../schemas/mission.schema.json',
  id: 'm2-ban-dong-r1',
  version: '0.1.0',
  seedPolicy: 'fixed',
  seed: 1971,
  startNode: 'n_intro',
  checkpoints: ['cp0', 'cpA', 'cpB'],
  localization: 'vi',
  zones,
  spawnGroups: [
    { id: 'squad', archetype: 'squad', faction: 'friend', count: 3, spawn: 'sq_quyet', spawns: ['sq_quyet', 'sq_hai', 'sq_sang'], names: ['name.quyet', 'name.hai', 'name.sang'] },
    { id: 'para_mg', archetype: 'recon', faction: 'enemy', count: 2, spawn: 'mg_a', spawns: ['mg_a', 'mg_b'], budget: 2 },
    { id: 'para_trench', archetype: 'recon', faction: 'enemy', count: 6, spawn: 'tr_0', spawns: ['tr_0', 'tr_1', 'tr_2', 'tr_3', 'tr_4', 'tr_5'], budget: 6 },
    { id: 'para_top', archetype: 'recon', faction: 'enemy', count: 5, spawn: 'top_0', spawns: ['top_0', 'top_1', 'top_2', 'top_3', 'top_4'], budget: 5 },
  ],
  nodes,
};
writeFileSync('content/missions/diem-cao-31.mission.json', JSON.stringify(mission, null, 2) + '\n');

const cue = (cueId, speaker, durationMs, priority = 6, bus = 'dialogue') => ({ cueId, speaker, audio: null, subtitleKey: `dlg.${cueId}`, priority, interruptPolicy: 'queue', durationMs, bus });
const dialogue = {
  cues: [
    cue('B01', 'HAI', 9000, 7),
    cue('B02', 'QUYET', 6500, 7),
    cue('B03', 'THANH', 1500, 6),
    cue('B04', 'QUYET', 4500, 6),
    cue('B05', 'SANG', 3800, 5),
    cue('B06', 'TRUNG_DOI', 3500, 6, 'radio'),
    cue('B07', 'QUYET', 1400, 8),
    cue('B08', 'SANG', 4200, 6),
    cue('B09', 'QUYET', 3000, 7),
    cue('B10', 'HAI', 1800, 5),
    cue('B11', 'HAI', 2600, 5),
    cue('B12', 'QUYET', 3400, 6),
    cue('B13', 'QUYET', 5200, 7),
    cue('B14', 'SANG', 3200, 5),
    // bark dùng chung với M1 (M10–M15) — cùng speaker map trong Squadmates
    cue('M10', 'HAI', 1500, 3),
    cue('M11', 'QUYET', 1600, 3),
    cue('M12', 'SANG', 1600, 3),
    cue('M13', 'QUYET', 1800, 4),
    cue('M14', 'HAI', 1600, 3),
    cue('M15', 'SANG', 2000, 3),
    cue('M05', 'HAI', 2500, 4),
    cue('M06', 'SANG', 2500, 4),
  ],
};
writeFileSync('content/missions/diem-cao-31.dialogue.json', JSON.stringify(dialogue, null, 2) + '\n');
console.log(`mission: ${nodes.length} nodes, ${zones.length} zones; dialogue ${dialogue.cues.length} cues`);
