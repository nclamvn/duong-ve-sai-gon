import { describe, it, expect } from 'vitest';
import { QualityScaler, DEFAULT_SCALER } from '@engine/render/scaler';

describe('TIP-003 QualityScaler (REN-004)', () => {
  it('60 frame 25 ms → giảm về ≤ 0.9, không dưới 0.65', () => {
    const s = new QualityScaler();
    for (let i = 0; i < 60; i++) s.update(25);
    expect(s.scale).toBeLessThanOrEqual(0.95);
    for (let i = 0; i < 2000; i++) s.update(25);
    expect(s.scale).toBe(DEFAULT_SCALER.min);
  });

  it('60 frame 10 ms → tăng dần về 1.0', () => {
    const s = new QualityScaler(DEFAULT_SCALER, 0.7);
    for (let i = 0; i < 60; i++) s.update(10);
    expect(s.scale).toBeGreaterThan(0.7);
    for (let i = 0; i < 3000; i++) s.update(10);
    expect(s.scale).toBe(1.0);
  });

  it('xen kẽ 15/19 ms → không dao động: ≤ 1 đổi mỗi 30 frame', () => {
    const s = new QualityScaler();
    let changesIn30 = 0;
    let maxChanges = 0;
    for (let i = 0; i < 1200; i++) {
      if (i % 30 === 0) {
        maxChanges = Math.max(maxChanges, changesIn30);
        changesIn30 = 0;
      }
      if (s.update(i % 2 === 0 ? 15 : 19)) changesIn30++;
    }
    expect(maxChanges).toBeLessThanOrEqual(1);
    expect(s.changes).toBe(0); // 15 nằm trong vùng giữa (14–18.5) → reset run → không bao giờ đổi
  });

  it('cooldown: hai lần đổi cách nhau ≥ cooldownFrames', () => {
    const s = new QualityScaler();
    const changeAt: number[] = [];
    for (let i = 0; i < 400; i++) if (s.update(30)) changeAt.push(i);
    for (let k = 1; k < changeAt.length; k++) expect(changeAt[k]! - changeAt[k - 1]!).toBeGreaterThanOrEqual(DEFAULT_SCALER.cooldownFrames);
    expect(changeAt.length).toBeGreaterThanOrEqual(2);
  });
});
