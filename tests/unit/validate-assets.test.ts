import { describe, it, expect } from 'vitest';
import { validateAssets } from '../../scripts/validate-assets.mjs';

/** TIP-D02 / PRD DVSG §7 + PRF-004: manifest ↔ file, license allow-list, CC-BY attribution, historical→registryId, KTX2 bắt buộc, không file lạc. */
describe('validate-assets (TIP-D02)', () => {
  const r = validateAssets();
  it('0 lỗi (file/hash/license/KTX2/manifest)', () => {
    expect(r.errors, r.errors.slice(0, 20).join('\n')).toEqual([]);
  });
  it('tổng ≤ initial_payload_mb.target (PRD DVSG §11: 250 MB) và cảnh báo tam giác chỉ là cảnh báo cho asset kế thừa', () => {
    expect(r.totalMB).toBeLessThanOrEqual(250);
    expect(Array.isArray(r.warnings)).toBe(true);
  });
});
