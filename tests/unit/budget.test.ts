import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import budget from '@config/performance-budget.json';
import missionSchema from '@content/schemas/mission.schema.json';
import dialogueSchema from '@content/schemas/dialogue.schema.json';
import checkpointSchema from '@content/schemas/checkpoint.schema.json';
import replaySchema from '@content/schemas/performance-replay.schema.json';
import { readFileSync } from 'node:fs';

describe('TIP-001 governance', () => {
  it('performance-budget.json giữ nguyên 14 hàng PRD §4.1 (hàng FPS tách avg + 1% low = 15 metric) và evidence_status', () => {
    expect(Object.keys(budget.metrics)).toHaveLength(15);
    expect(budget.evidence_status).toBe('engineering_default_requires_review');
    expect(budget.metrics.frame_p95.target).toBe(18.5);
    expect(budget.metrics.frame_p95.red).toBe(22);
    expect(budget.metrics.fps_1pct_low.target).toBe(45);
  });

  it('mission.schema từ chối {} vì thiếu trường bắt buộc PRD §8', () => {
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(missionSchema);
    expect(validate({})).toBe(false);
    const missing = (validate.errors ?? []).filter((e) => e.keyword === 'required').map((e) => e.params.missingProperty as string);
    for (const f of ['id', 'version', 'seedPolicy', 'startNode', 'checkpoints', 'localization']) expect(missing).toContain(f);
  });

  it('4 schema compile được với ajv strict', () => {
    const ajv = new Ajv({ allErrors: true, strict: true });
    for (const s of [missionSchema, dialogueSchema, checkpointSchema, replaySchema]) expect(() => ajv.compile(s)).not.toThrow();
  });

  it('AGENTS.md có đủ 5 mục bắt buộc', () => {
    const md = readFileSync('AGENTS.md', 'utf8');
    for (const h of ['## 1. Kiến trúc', '## 2. Lệnh', '## 3. Vùng cấm', '## 4. Completion Report', '## 5. Escalation']) expect(md).toContain(h);
  });

  it('dependencies pin chính xác (không ^ ~)', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
    for (const v of [...Object.values(pkg.dependencies), ...Object.values(pkg.devDependencies)]) expect(v).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/); // pin chính xác; cho phép hậu tố prerelease (fbx2gltf 0.9.7-p1)
  });
});
