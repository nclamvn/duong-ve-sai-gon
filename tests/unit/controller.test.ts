import { describe, it, expect, beforeAll } from 'vitest';
import { initPhysics, PhysicsWorld } from '@engine/physics/world';
import { CapsuleController } from '@engine/physics/controller';
import { emptySnapshot, type InputSnapshot } from '@engine/input/input';
import { CameraRig } from '@game/player/camera';
import { SettingsStore, memoryStore, sanitize, DEFAULT_SETTINGS } from '@game/player/settings';
import { makeArenaTrack, ReplayPlayer } from '@engine/input/replay';

const DT = 1 / 60;

function makeWorld(extra: (w: PhysicsWorld) => void = () => undefined): PhysicsWorld {
  const w = new PhysicsWorld();
  w.addStatic({ kind: 'box', position: [0, -0.5, 0], size: [40, 0.5, 40], yaw: 0 }, { id: 'floor', kind: 'world', material: 'concrete' });
  // tường tại x = 5 (mặt trong x = 4.5)
  w.addStatic({ kind: 'box', position: [5, 2, 0], size: [0.5, 2, 20], yaw: 0 }, { id: 'wall', kind: 'world', material: 'concrete' });
  extra(w);
  return w;
}

function run(w: PhysicsWorld, c: CapsuleController, ticks: number, input: (t: number, s: InputSnapshot) => void, yaw = 0): void {
  const s = emptySnapshot();
  for (let t = 0; t < ticks; t++) {
    input(t, s);
    c.step(s, yaw, DT);
    w.step();
  }
}

beforeAll(async () => {
  await initPhysics();
});

describe('TIP-005 CapsuleController (PLY-001)', () => {
  it('đi thẳng vào tường 3 s → không xuyên; không rơi qua sàn', () => {
    const w = makeWorld();
    const c = new CapsuleController(w, [0, 0, 0]);
    // yaw = -π/2 → forward = (-sin(-π/2), 0, -cos(-π/2)) = (1, 0, 0) → đi về +x
    run(w, c, 180, (_t, s) => { s.fwd = 1; s.sprint = true; }, -Math.PI / 2);
    expect(c.feet[0]).toBeLessThan(4.5 - c.cfg.radius + 1e-3);
    expect(c.feet[0]).toBeGreaterThan(3.5);
    expect(c.feet[1]).toBeGreaterThanOrEqual(-1e-3);
    expect(c.grounded).toBe(true);
  });

  it('bậc 0.3 m → bước lên; bậc 0.6 m → bị chặn', () => {
    const low = makeWorld((w) => w.addStatic({ kind: 'box', position: [0, 0.15, -3], size: [3, 0.15, 1], yaw: 0 }, { id: 'step', kind: 'world', material: 'concrete' }));
    const c1 = new CapsuleController(low, [0, 0, 0]);
    run(low, c1, 60, (_t, s) => { s.fwd = 1; }); // 60 tick ≈ 3.5 m → đang đứng trên bậc (z ∈ [-4,-2])
    expect(c1.feet[2]).toBeLessThan(-2.2);
    expect(c1.feet[2]).toBeGreaterThan(-4);
    expect(c1.feet[1]).toBeGreaterThan(0.25);

    const high = makeWorld((w) => w.addStatic({ kind: 'box', position: [0, 0.3, -3], size: [3, 0.3, 1], yaw: 0 }, { id: 'step', kind: 'world', material: 'concrete' }));
    const c2 = new CapsuleController(high, [0, 0, 0]);
    run(high, c2, 150, (_t, s) => { s.fwd = 1; });
    expect(c2.feet[2]).toBeGreaterThan(-2.0 - c2.cfg.radius);
    expect(c2.feet[1]).toBeLessThan(0.05);
  });

  it('deterministic: cùng track → stateHash bằng nhau ở 600 tick (2 world độc lập)', () => {
    const hashes: string[] = [];
    for (let k = 0; k < 2; k++) {
      const w = makeWorld();
      const c = new CapsuleController(w, [0, 0, 0]);
      const player = new ReplayPlayer(makeArenaTrack(3, 10));
      const s = emptySnapshot();
      let yaw = 0;
      for (let t = 0; t < 600; t++) {
        player.snapshot(t, s);
        yaw -= s.dx * 0.0022;
        c.step(s, yaw, DT);
        w.step();
      }
      hashes.push(c.stateHash());
    }
    expect(hashes[0]).toBe(hashes[1]);
    expect(hashes[0]).not.toBe('0.0000,0.0000,0.0000|stand|0.0000|1');
  });

  it('spam jump 60 lần: chỉ nhảy khi grounded; |vy| ≤ 4', () => {
    const w = makeWorld();
    const c = new CapsuleController(w, [0, 0, 0]);
    let maxVy = 0;
    let jumps = 0;
    run(w, c, 240, (_t, s) => {
      s.jump = true; // edge mỗi tick — spam
      if (c.justJumped) jumps++;
      maxVy = Math.max(maxVy, Math.abs(c.vy));
    });
    expect(maxVy).toBeLessThanOrEqual(4);
    expect(jumps).toBeGreaterThan(2);
    expect(jumps).toBeLessThan(15); // không nhảy mỗi tick
    expect(c.feet[1]).toBeLessThan(1.0);
  });

  it('cúi: chiều cao giảm; đứng dậy bị chặn dưới trần thấp', () => {
    const w = makeWorld((w) => w.addStatic({ kind: 'box', position: [0, 1.6, 0], size: [2, 0.1, 2], yaw: 0 }, { id: 'ceiling', kind: 'world', material: 'concrete' }));
    const c = new CapsuleController(w, [0, 0, 0]);
    run(w, c, 10, (_t, s) => { s.crouch = true; });
    expect(c.stance).toBe('crouch');
    expect(c.height).toBe(1.2);
    run(w, c, 10, () => undefined);
    expect(c.stance).toBe('crouch'); // trần 1.5 m (1.6 − 0.1) → không đứng được
    c.teleport(10, 0, 10);
    run(w, c, 10, () => undefined);
    expect(c.stance).toBe('stand');
  });
});

describe('TIP-005 CameraRig (PLY-002/003)', () => {
  it('sensitivity 2 → yaw đổi gấp đôi; invertY đổi dấu pitch', () => {
    const a = new CameraRig();
    a.look(10, 10, 1, false);
    const b = new CameraRig();
    b.look(10, 10, 2, false);
    expect(b.yaw).toBeCloseTo(a.yaw * 2, 9);
    const inv = new CameraRig();
    inv.look(10, 10, 1, true);
    expect(inv.pitch).toBeCloseTo(-a.pitch, 9);
  });

  it('recoil kick 2° rồi hồi 300 ms không input → yaw/pitch gốc không đổi (drift = 0)', () => {
    const r = new CameraRig();
    r.look(120, -35, 1, false);
    const yaw0 = r.yaw;
    const pitch0 = r.pitch;
    r.kick((2 * Math.PI) / 180, 0.002);
    expect(r.recoilPitch).toBeGreaterThan(0);
    for (let i = 0; i < 18; i++) r.step(DT, 0, true, false);
    expect(r.yaw).toBe(yaw0);
    expect(r.pitch).toBe(pitch0);
    expect(r.recoilPitch).toBeLessThan((2 * Math.PI) / 180 * 0.1);
  });

  it('pitch clamp ±89°', () => {
    const r = new CameraRig();
    r.look(0, -100000, 5, false);
    expect(r.pitch).toBeCloseTo((89 * Math.PI) / 180, 6);
  });
});

describe('TIP-005 Settings (A11Y-002)', () => {
  it('sanitize clamp và bỏ giá trị sai kiểu', () => {
    const s = sanitize({ sensitivity: 99, fov: 10, invertY: 'yes' as unknown as boolean, bob: -5 });
    expect(s.sensitivity).toBe(5);
    expect(s.fov).toBe(70);
    expect(s.invertY).toBe(false);
    expect(s.bob).toBe(0);
  });

  it('update lưu store, load lại giữ nguyên; listener nhận tức thời', async () => {
    const store = memoryStore();
    const a = new SettingsStore(store);
    let seen = 0;
    a.onChange(() => seen++);
    await a.update({ sensitivity: 2, invertY: true });
    expect(seen).toBe(2);
    const b = new SettingsStore(store);
    const loaded = await b.load();
    expect(loaded.sensitivity).toBe(2);
    expect(loaded.invertY).toBe(true);
    expect(loaded.fov).toBe(DEFAULT_SETTINGS.fov);
  });
});
