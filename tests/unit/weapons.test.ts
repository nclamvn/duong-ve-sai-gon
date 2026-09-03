import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv';

const manifest = JSON.parse(readFileSync('content/assets/manifest.json', 'utf8')) as {
  assets: Array<{ id: string; license: string; attribution?: string; files: Array<{ path: string }> }>;
};
const schema = JSON.parse(readFileSync('content/schemas/weapon-model.schema.json', 'utf8'));
const files = readdirSync('content/weapons').filter((f) => f.endsWith('.json'));

describe('TIP-014 cấu hình vũ khí glTF (content/weapons, ADR-006)', () => {
  it('có ít nhất AK-74M (người chơi) và HK416 (địch)', () => {
    expect(files).toContain('ak74m.json');
    expect(files).toContain('hk416.json');
  });

  for (const f of files) {
    const cfg = JSON.parse(readFileSync(join('content/weapons', f), 'utf8')) as {
      $comment?: string;
      id: string;
      asset: string;
      model: string;
      anchors: Record<string, [number, number, number]>;
      view: { sightDistance: number; scale: number };
    };
    it(`${f} hợp lệ schema, asset có trong manifest, file GLB tồn tại, anchor hợp lý`, () => {
      const { $comment: _c, ...data } = cfg;
      void _c;
      const ajv = new Ajv({ strict: true, allErrors: true });
      const ok = ajv.validate(schema, data);
      expect(ajv.errors ?? []).toEqual([]);
      expect(ok).toBe(true);
      const asset = manifest.assets.find((a) => a.id === cfg.asset);
      expect(asset, `manifest ${cfg.asset}`).toBeDefined();
      expect(asset!.files.map((x) => x.path)).toContain(`assets/${cfg.model}`);
      expect(existsSync(join('public/assets', cfg.model))).toBe(true);
      // hệ model: nòng −z → muzzle z âm, trên trục nòng (x, y ≈ 0); băng đạn + tay cầm dưới trục
      expect(cfg.anchors.muzzle![2]).toBeLessThan(-0.2);
      expect(Math.abs(cfg.anchors.muzzle![0])).toBeLessThan(0.02);
      expect(Math.abs(cfg.anchors.muzzle![1])).toBeLessThan(0.02);
      expect(cfg.anchors.magazine![1]).toBeLessThan(0);
      expect(cfg.anchors.gripR![1]).toBeLessThan(0);
      expect(cfg.anchors.sight![1]).toBeGreaterThan(0);
      // ADS: điểm ngắm cách camera 0.2–0.5 m (FOV 90, scale 0.5–0.8)
      expect(cfg.view.sightDistance).toBeGreaterThanOrEqual(0.2);
      expect(cfg.view.sightDistance).toBeLessThanOrEqual(0.5);
      expect(cfg.view.scale).toBeGreaterThanOrEqual(0.5);
      expect(cfg.view.scale).toBeLessThanOrEqual(0.8);
    });
  }

  it('CREDITS.md chứa attribution của mọi asset CC-BY (ADR-006) và README có mục Credits', () => {
    const credits = readFileSync('CREDITS.md', 'utf8');
    for (const a of manifest.assets.filter((x) => x.license.startsWith('CC-BY'))) {
      expect(a.attribution, a.id).toBeTruthy();
      expect(credits).toContain(a.attribution!);
    }
    expect(readFileSync('README.md', 'utf8')).toMatch(/## Credits/);
  });
});
