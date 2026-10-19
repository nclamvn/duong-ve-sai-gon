import { describe, it, expect } from 'vitest';
import { CameraRig } from '@game/player/camera';
import { LensDirt } from '@ui/lensDirt';

describe('DV-088 choáng nổ', () => {
  it('loạng choạng: nghiêng về phía bị hất rồi lắc lại và tắt hẳn, không đổi yaw/pitch gốc', () => {
    const rig = new CameraRig();
    rig.reset(0.3, -0.1);
    rig.stumble(1, 1);
    let peak = 0;
    let crossed = false;
    for (let i = 0; i < 30; i++) {
      rig.step(1 / 60, 0, true, false);
      peak = Math.max(peak, rig.stumbleRoll);
    }
    expect(peak).toBeGreaterThan(0.08);
    expect(peak).toBeLessThan(0.3);
    for (let i = 0; i < 60; i++) {
      rig.step(1 / 60, 0, true, false);
      if (rig.stumbleRoll < 0) crossed = true;
    }
    expect(crossed).toBe(true);
    for (let i = 0; i < 600; i++) rig.step(1 / 60, 0, true, false);
    expect(Math.abs(rig.stumbleRoll)).toBeLessThan(1e-4);
    expect(Math.abs(rig.stumblePitch)).toBeLessThan(1e-4);
    expect(rig.yaw).toBeCloseTo(0.3, 9);
    expect(rig.pitch).toBeCloseTo(-0.1, 9);
  });

  it('cài đặt rung 0 → không loạng choạng; reset xoá', () => {
    const rig = new CameraRig();
    rig.intensity.shake = 0;
    rig.stumble(1, -1);
    rig.step(1 / 60, 0, true, false);
    expect(rig.stumbleRoll).toBe(0);
    rig.intensity.shake = 1;
    rig.stumble(1, -1);
    rig.step(1 / 60, 0, true, false);
    expect(rig.stumbleRoll).toBeLessThan(0);
    rig.reset();
    expect(rig.stumbleRoll).toBe(0);
  });

  it('bùn ống kính không có DOM: an toàn, độ phủ 0', () => {
    const l = new LensDirt(null);
    l.splash(1);
    l.update(1);
    expect(l.opacity).toBe(0);
    expect(l.splats).toBe(0);
  });
});
