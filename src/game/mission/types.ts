/**
 * Mission types (PRD §8): runtime chỉ thực thi action/condition trong allow-list. Khớp content/schemas/mission.schema.json.
 */
export const ACTION_TYPES = ['radio', 'objective', 'objective_complete', 'spawn', 'checkpoint', 'mission_complete', 'set_flag', 'sky_trigger', 'squad_order', 'interactable', 'bombing', 'reinforce', 'fx', 'strike', 'napalm', 'mortar', 'squad_kill', 'safe_zone', 'group_hunt'] as const;
/** DV-084: hành động chiến trường do MissionHost thực hiện (sự kiện BATTLE) */
export const BATTLE_ACTIONS: ReadonlySet<string> = new Set(['fx', 'strike', 'napalm', 'mortar', 'squad_kill', 'safe_zone']);
export const CONDITION_TYPES = ['zone_enter', 'group_dead', 'flag', 'timeout', 'active_ms', 'always', 'squad_at', 'group_alive_max'] as const;

export type ActionType = (typeof ACTION_TYPES)[number];
export type ConditionType = (typeof CONDITION_TYPES)[number];

export interface MissionAction {
  type: ActionType;
  cue?: string;
  objectiveKey?: string;
  /** objective: zone id làm điểm marker HUD (TIP-UX02) */
  marker?: string;
  group?: string;
  checkpoint?: string;
  flag?: string;
  value?: boolean;
  /** sky_trigger: id lượt bay (engine/sky) */
  flight?: string;
  /** squad_order: lệnh đồng đội (TIP-M1A) */
  order?: 'follow' | 'hold';
  /** squad_order (M1-T2): nhịp đi của tổ; `zone` (dùng chung) = điểm Quyết dẫn tới */
  pace?: 'march' | 'normal' | 'assault';
  /** bombing (M1-T2): rải bom dọc đoạn from → to (x, z) */
  from?: [number, number];
  to?: [number, number];
  count?: number;
  durationMs?: number;
  delayMs?: number;
  radius?: number;
  damage?: number;
  /** interactable (M2 R1): điểm giữ phím tại zone; xong → flag <interactId>; fuseMs → nổ → flag <interactId>_blown + gỡ prop */
  interactId?: string;
  zone?: string;
  holdMs?: number;
  promptKey?: string;
  fuseMs?: number;
  prop?: string;
  blastRadius?: number;
  blastDamage?: number;
  /** DV-084 fx: fire | smoke | embers; mortar: mortar | artillery */
  kind?: string;
  /** DV-084 fx/strike: điểm (x, z); không có thì dùng `zone` */
  at?: [number, number];
  scale?: number;
  height?: number;
  /** DV-084 reinforce: số đợt (kể cả đợt đầu), khoảng cách giữa đợt, trần địch sống toàn màn */
  waves?: number;
  intervalMs?: number;
  maxAlive?: number;
  /** DV-084 squad_kill: khoá tên (name.khang) */
  name?: string;
  /** DV-084 objective: đếm ngược hiện trên HUD (ms) */
  timerMs?: number;
  /** DV-084 mortar: số quả mỗi phút */
  rate?: number;
  /** DV-084 mortar: quả gần nhất không rơi trong bán kính này quanh người chơi (m) */
  spare?: number;
}

export interface MissionCondition {
  type: ConditionType;
  zone?: string;
  group?: string;
  flag?: string;
  value?: boolean;
  ms?: number;
  /** group_alive_max: còn ≤ count */
  count?: number;
}

export interface MissionNode {
  id: string;
  type: 'script' | 'objective' | 'encounter' | 'terminal';
  enterConditions: MissionCondition[];
  actions: MissionAction[];
  exitConditions: MissionCondition[];
  next: string | null;
  timeoutMs?: number;
  fallbackNext?: string | null;
}

export interface MissionZone {
  id: string;
  center: [number, number, number];
  radius: number;
}

export interface SpawnGroup {
  id: string;
  /** grunt = lính HT-MB/địch mặc định; recon = thám báo (rằn ri); squad = đồng đội có tên */
  archetype: 'grunt' | 'recon' | 'squad';
  count: number;
  /** tên spawn point (hoặc danh sách — mỗi bot một điểm, TIP-M1A) */
  spawn: string;
  spawns?: string[];
  budget?: number;
  faction?: 'enemy' | 'friend';
  /** squad: khoá i18n tên từng thành viên (name.quyet …) */
  names?: string[];
  /** M1-T2: patrol (mặc định) · ambush (nằm phục, nổ súng khi ta ≤ ambushRange) · hunt (biết vị trí người chơi, lao tới) */
  behavior?: 'patrol' | 'hold' | 'ambush' | 'hunt';
  /** patrol: tuyến tuần tra riêng (tên spawn point), thay cho marker quanh điểm spawn */
  patrol?: string[];
}

export interface MissionDefinition {
  id: string;
  version: string;
  seedPolicy: 'fixed' | 'random';
  seed?: number;
  startNode: string;
  checkpoints: string[];
  localization: 'vi';
  zones?: MissionZone[];
  spawnGroups?: SpawnGroup[];
  nodes: MissionNode[];
}

export interface DialogueCue {
  cueId: string;
  speaker: string;
  audio: string | null;
  subtitleKey: string;
  priority: number;
  interruptPolicy: 'queue' | 'interrupt' | 'drop';
  durationMs: number;
  bus?: 'dialogue' | 'radio';
}

export interface DialogueSet {
  cues: DialogueCue[];
}

export interface CheckpointSnapshot {
  schemaVersion: 1;
  missionId: string;
  checkpointId: string;
  node: string;
  missionFlags: Record<string, boolean>;
  objectives?: Record<string, 'active' | 'complete'>;
  actors: Array<{ id: string; group: string; position: [number, number, number]; health: number; alive: boolean; state?: string }>;
  player: { position: [number, number, number]; yaw: number; pitch: number; health: number; stance: 'stand' | 'crouch' };
  inventory: { weapon: string; mag: number; reserve: number; grenades?: number };
  doors: Array<{ id: string; open: boolean }>;
  timers: Record<string, number>;
  seed: number;
  tick: number;
}

export interface MissionEvents extends Record<string, unknown> {
  RADIO: { cue: string; speaker: string; subtitleKey: string; durationMs: number; priority: number; interruptPolicy: string; bus: string; vars?: Record<string, string | number>; bark?: boolean };
  OBJECTIVE: { key: string; status: 'active' | 'complete'; marker?: string; timerMs?: number };
  /** DV-084 hành động chiến trường (fx, strike, napalm, mortar, squad_kill, safe_zone) — payload là chính action */
  BATTLE: { action: MissionAction };
  REINFORCE_WAVE: { group: string; wave: number; ids: number };
  /** DV-085 tàn quân của nhóm thôi giữ chỗ, lao vào người chơi (đóng hồi, không để địch nằm lại sau lưng) */
  GROUP_HUNT: { group: string };
  SKY_TRIGGER: { flight: string };
  SQUAD_ORDER: { order: 'follow' | 'hold'; pace?: 'march' | 'normal' | 'assault'; zone?: string };
  BOMBING: { from: [number, number]; to: [number, number]; count: number; durationMs: number; delayMs: number; radius: number; damage: number };
  SPAWN_GROUP: { group: string; count: number; spawn: string };
  INTERACT_DONE: { id: string };
  INTERACTABLE: { id: string; zone: string; holdMs: number; promptKey: string; fuseMs: number; prop: string | null; blastRadius: number; blastDamage: number };
  CHECKPOINT_SAVED: { checkpoint: string };
  MISSION_COMPLETE: { missionId: string };
  MISSION_FLAG: { flag: string; value: boolean };
  NODE_ENTER: { node: string };
  NODE_EXIT: { node: string; next: string | null };
  NODE_TIMEOUT: { node: string; fallback: string | null };
  [k: string]: unknown;
}
