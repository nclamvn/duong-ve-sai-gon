import { describe, it, expect } from 'vitest';
import { validateRegistries } from '../../scripts/validate-registry.mjs';

/** PRD v0.2 §9 + ADR-D03: registry lịch sử là SOT của "thật" — schema, id, provenance, liên kết asset. */
describe('Registry lịch sử (content/registry, ADR-D03)', () => {
  const r = validateRegistries();
  it('7 registry đúng schema, id duy nhất, P/S có nguồn, X có dispute_note, asset approved không trỏ H/X', () => {
    expect(r.errors, r.errors.join('\n')).toEqual([]);
    expect(r.files).toBe(7);
  });
  it('lượt 1 (M1 1971): ≥ 15 fact; ≥ 60 % mức P/S (cổng G0′ Blueprint §4)', () => {
    let ps = 0;
    let total = 0;
    for (const s of Object.values(r.stats)) {
      ps += s.P + s.S;
      total += s.total;
    }
    expect(total).toBeGreaterThanOrEqual(15);
    expect(ps / total).toBeGreaterThanOrEqual(0.6);
  });
});
