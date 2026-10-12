/**
 * DV-079 khí quyển + độ che tán: sương theo độ cao giữ đúng tầm nhìn preset ở độ cao chuẩn, thung lũng đặc hơn, đỉnh cao
 * loãng hơn; bản đồ độ che tán: dưới cây kín, khoảng trống không, mép mềm.
 */
import { describe, it, expect } from 'vitest';
import { Scene } from 'three/webgpu';
import { createAtmosphere, visibilityFromExp2 } from '@engine/render/atmosphere';
import { CanopyMap } from '@engine/vegetation/canopy';

describe('DV-079 khí quyển', () => {
  const density = 0.0033; // ~ M1 rạng sáng (tầm nhìn 600 m)
  const scene = new Scene();
  const atm = createAtmosphere(scene, { color: 0x9fb09d, density });
  const V = visibilityFromExp2(density);

  it('thay FogExp2 bằng fogNode; ở độ cao chuẩn tầm nhìn ≈ preset (ngưỡng 2 %)', () => {
    expect(scene.fog).toBeNull();
    expect((scene as unknown as { fogNode: unknown }).fogNode).toBeTruthy();
    expect(V).toBeGreaterThan(500);
    expect(V).toBeLessThan(700);
    const f = atm.factorAt([0, 0, 0], [V, 0, 0]);
    expect(f).toBeGreaterThan(0.85);
    expect(f).toBeLessThan(0.95);
    // quãng trong quanh camera
    expect(atm.factorAt([0, 0, 0], [12, 0, 0])).toBe(0);
    expect(atm.factorAt([0, 0, 0], [40, 0, 0])).toBeLessThan(0.15);
  });

  it('thung lũng đặc hơn, nhìn lên đỉnh cao loãng hơn; trần mật độ chặn thung lũng sâu', () => {
    const level = atm.factorAt([0, 0, 0], [300, 0, 0]);
    const valley = atm.factorAt([0, -120, 0], [300, -120, 0]);
    const ridge = atm.factorAt([0, 0, 0], [300, 180, 0]);
    expect(valley).toBeGreaterThan(level);
    expect(ridge).toBeLessThan(level);
    const deep = atm.factorAt([0, -600, 0], [100, -600, 0]);
    expect(deep).toBeLessThan(1);
    expect(deep).toBeGreaterThan(atm.factorAt([0, -120, 0], [100, -120, 0]));
  });
});

describe('DV-079 bản đồ độ che tán', () => {
  it('dưới tán ≈ kín, khoảng trống = 0, mép giảm dần; ngoài vùng = 0', () => {
    const c = new CanopyMap();
    const rect = { x: 0, z: 0, w: 512, h: 512 };
    const trees = [];
    for (let x = -100; x <= 100; x += 6) for (let z = -100; z <= 100; z += 6) trees.push({ x, z, r: 5, k: 0.85 });
    c.fill(rect, trees);
    expect(c.at(0, 0)).toBeGreaterThan(0.85);
    expect(c.at(200, 200)).toBe(0);
    expect(c.at(104, 0)).toBeLessThan(c.at(90, 0));
    expect(c.at(400, 0)).toBe(0);
    expect(c.stats.trees).toBe(trees.length);
    expect(c.stats.closed).toBeGreaterThan(0.1);
  });
});
