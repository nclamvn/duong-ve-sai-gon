/**
 * Mission types (PRD §8): runtime chỉ thực thi action/condition trong allow-list. Khớp content/schemas/mission.schema.json.
 */
export const ACTION_TYPES = ['radio', 'objective', 'objective_complete', 'spawn', 'checkpoint', 'mission_complete', 'set_flag', 'sky_trigger', 'squad_order'] as const;
export const CONDITION_TYPES = ['zone_enter', 'group_dead', 'flag', 'timeout', 'active_ms', 'always'] as const;

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
}

export interface MissionCondition {
  type: ConditionType;
  zone?: string;
  group?: string;
  flag?: string;
  value?: boolean;
  ms?: number;
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
  inventory: { weapon: string; mag: number; reserve: number };
  doors: Array<{ id: string; open: boolean }>;
  timers: Record<string, number>;
  seed: number;
  tick: number;
}

export interface MissionEvents extends Record<string, unknown> {
  RADIO: { cue: string; speaker: string; subtitleKey: string; durationMs: number; priority: number; interruptPolicy: string; bus: string };
  OBJECTIVE: { key: string; status: 'active' | 'complete'; marker?: string };
  SKY_TRIGGER: { flight: string };
  SQUAD_ORDER: { order: 'follow' | 'hold' };
  SPAWN_GROUP: { group: string; count: number; spawn: string };
  CHECKPOINT_SAVED: { checkpoint: string };
  MISSION_COMPLETE: { missionId: string };
  MISSION_FLAG: { flag: string; value: boolean };
  NODE_ENTER: { node: string };
  NODE_EXIT: { node: string; next: string | null };
  NODE_TIMEOUT: { node: string; fallback: string | null };
  [k: string]: unknown;
}
