import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import Ajv from 'ajv';

const manifest = JSON.parse(readFileSync('content/assets/manifest.json', 'utf8')) as {
  totalBytes: number;
  assets: Array<{ id: string; type: string; license: string; url: string; authors?: string[]; attribution?: string; files: Array<{ path: string; bytes: number; sha256: string }> }>;
};
const schema = JSON.parse(readFileSync('content/schemas/asset-manifest.schema.json', 'utf8'));

describe('ADR-005 asset manifest (CC0/Mixamo, có hash, trong ngân sách payload)', () => {
  it('manifest hợp lệ schema', () => {
    const ajv = new Ajv({ strict: true, allErrors: true });
    const ok = ajv.validate(schema, manifest);
    expect(ajv.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });

  it('mọi file tồn tại trong public/, đúng bytes + sha256; license ∈ {CC0-1.0, Mixamo, CC-BY}; CC-BY phải có attribution + url + authors (ADR-006)', () => {
    for (const a of manifest.assets) {
      expect(['CC0-1.0', 'Mixamo', 'CC-BY-4.0', 'CC-BY-3.0']).toContain(a.license);
      if (a.license.startsWith('CC-BY')) {
        expect(a.attribution, `${a.id} attribution`).toMatch(/licensed under/);
        expect(a.url, `${a.id} url`).toMatch(/^https:\/\/sketchfab\.com\//);
        expect((a.authors ?? []).length, `${a.id} authors`).toBeGreaterThan(0);
      }
      for (const f of a.files) {
        const p = join('public', f.path);
        expect(existsSync(p), p).toBe(true);
        expect(statSync(p).size).toBe(f.bytes);
        expect(createHash('sha256').update(readFileSync(p)).digest('hex')).toBe(f.sha256);
      }
    }
  });

  it('tổng payload asset ≤ 60 MB ở slice G0.5 (KTX2 là nợ — ADR-005) và khớp totalBytes', () => {
    const sum = manifest.assets.reduce((s, a) => s + a.files.reduce((t, f) => t + f.bytes, 0), 0);
    expect(sum).toBe(manifest.totalBytes);
    expect(sum).toBeLessThanOrEqual(60 * 1048576);
  });

  it('src/engine/render/assets.ts chỉ tham chiếu id có trong manifest', () => {
    const src = readFileSync('src/engine/render/assets.ts', 'utf8');
    const ids = new Set(manifest.assets.map((a) => a.id));
    const texIds = /TEXTURE_IDS = \[([^\]]+)\]/.exec(src)![1]!.match(/'([a-z0-9_]+)'/g)!.map((s) => s.replaceAll("'", ''));
    const modelIds = /MODEL_IDS = \[([^\]]+)\]/.exec(src)![1]!.match(/'([a-z0-9_]+)'/g)!.map((s) => s.replaceAll("'", ''));
    const hdri = /HDRI_ID = '([a-z0-9_]+)'/.exec(src)![1]!;
    for (const id of [...texIds, ...modelIds, hdri]) expect(ids.has(id), id).toBe(true);
  });
});
