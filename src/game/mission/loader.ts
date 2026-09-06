/**
 * Mission loader: validate JSON Schema (ajv) + allow-list action/condition + tham chiếu node/zone/group/cue.
 * Lỗi → MissionValidationError liệt kê path (PRD §8 "Có schema").
 */
import Ajv, { type ErrorObject } from 'ajv';
import missionSchema from '@content/schemas/mission.schema.json';
import dialogueSchema from '@content/schemas/dialogue.schema.json';
import checkpointSchema from '@content/schemas/checkpoint.schema.json';
import { ACTION_TYPES, CONDITION_TYPES, type MissionDefinition, type DialogueSet, type CheckpointSnapshot } from './types';

export class MissionValidationError extends Error {
  constructor(
    readonly problems: string[],
    what: string,
  ) {
    super(`${what} invalid:\n${problems.join('\n')}`);
    this.name = 'MissionValidationError';
  }
}

const ajv = new Ajv({ allErrors: true, strict: true });
const validateMission = ajv.compile(missionSchema);
const validateDialogue = ajv.compile(dialogueSchema);
const validateCheckpoint = ajv.compile(checkpointSchema);

function fmt(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? ''}${e.params && 'allowedValues' in e.params ? ` (${(e.params as { allowedValues: unknown[] }).allowedValues.join('|')})` : ''}`);
}

export function loadMission(json: unknown): MissionDefinition {
  if (!validateMission(json)) throw new MissionValidationError(fmt(validateMission.errors), 'MissionDefinition');
  const def = json as unknown as MissionDefinition;
  const problems: string[] = [];
  const nodeIds = new Set(def.nodes.map((n) => n.id));
  const zoneIds = new Set((def.zones ?? []).map((z) => z.id));
  const groupIds = new Set((def.spawnGroups ?? []).map((g) => g.id));
  if (!nodeIds.has(def.startNode)) problems.push(`/startNode: '${def.startNode}' not found`);
  def.nodes.forEach((n, ni) => {
    if (n.next !== null && !nodeIds.has(n.next)) problems.push(`/nodes/${ni}/next: '${n.next}' not found`);
    if (n.fallbackNext && !nodeIds.has(n.fallbackNext)) problems.push(`/nodes/${ni}/fallbackNext: '${n.fallbackNext}' not found`);
    n.actions.forEach((a, ai) => {
      if (!(ACTION_TYPES as readonly string[]).includes(a.type)) problems.push(`/nodes/${ni}/actions/${ai}/type: '${a.type}' not in allow-list`);
      if (a.type === 'spawn' && (!a.group || !groupIds.has(a.group))) problems.push(`/nodes/${ni}/actions/${ai}/group: '${a.group}' not declared in spawnGroups`);
      if (a.type === 'checkpoint' && (!a.checkpoint || !def.checkpoints.includes(a.checkpoint))) problems.push(`/nodes/${ni}/actions/${ai}/checkpoint: '${a.checkpoint}' not declared in checkpoints`);
      if (a.type === 'radio' && !a.cue) problems.push(`/nodes/${ni}/actions/${ai}: radio missing cue`);
      if ((a.type === 'objective' || a.type === 'objective_complete') && !a.objectiveKey) problems.push(`/nodes/${ni}/actions/${ai}: missing objectiveKey`);
      if (a.type === 'set_flag' && (!a.flag || typeof a.value !== 'boolean')) problems.push(`/nodes/${ni}/actions/${ai}: set_flag missing flag/value`);
      if (a.type === 'objective' && a.marker && !zoneIds.has(a.marker)) problems.push(`/nodes/${ni}/actions/${ai}/marker: zone '${a.marker}' not found`);
      if (a.type === 'sky_trigger' && !a.flight) problems.push(`/nodes/${ni}/actions/${ai}: sky_trigger missing flight`);
    });
    [...n.enterConditions, ...n.exitConditions].forEach((c, ci) => {
      if (!(CONDITION_TYPES as readonly string[]).includes(c.type)) problems.push(`/nodes/${ni}/conditions/${ci}/type: '${c.type}' not in allow-list`);
      if (c.type === 'zone_enter' && (!c.zone || !zoneIds.has(c.zone))) problems.push(`/nodes/${ni}/conditions/${ci}/zone: '${c.zone}' not found`);
      if (c.type === 'group_dead' && (!c.group || !groupIds.has(c.group))) problems.push(`/nodes/${ni}/conditions/${ci}/group: '${c.group}' not found`);
    });
    if (n.type === 'terminal' && n.next !== null) problems.push(`/nodes/${ni}: terminal node must have next = null`);
    if (n.type !== 'terminal' && n.next === null) problems.push(`/nodes/${ni}: non-terminal node must have next`);
  });
  if (problems.length) throw new MissionValidationError(problems, 'MissionDefinition');
  return def;
}

export function loadDialogue(json: unknown): DialogueSet {
  if (!validateDialogue(json)) throw new MissionValidationError(fmt(validateDialogue.errors), 'DialogueCueSet');
  return json as unknown as DialogueSet;
}

export function validateSnapshot(json: unknown): CheckpointSnapshot {
  if (!validateCheckpoint(json)) throw new MissionValidationError(fmt(validateCheckpoint.errors), 'CheckpointSnapshot');
  return json as unknown as CheckpointSnapshot;
}
