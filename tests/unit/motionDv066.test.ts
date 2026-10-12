import { describe, it, expect } from 'vitest';
import { AnimationClip, Bone, Group, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack, type KeyframeTrack } from 'three/webgpu';
import { LocomotionController, directionWeights, wrapAngle, sampleProgress, type LocoClipInfo, type TurnClipInfo } from '@engine/render/locomotion';
import { analysisRig, analyzeLocoClip, analyzeTurnClip, splitUpperLower, upperBodyNames, parseLocoName } from '@engine/render/clipAnalysis';
import { buildMotionLibrary, CharacterInstance, type CharacterAsset } from '@engine/render/characters';

const D = Math.PI / 180;
const clip = (gait: LocoClipInfo['gait'], deg: number, speed: number, duration = 1, phaseOffset = 0): LocoClipInfo => ({ gait, angle: deg * D, speed, duration, phaseOffset });

// deterministic sequence for fuzz-style checks
const lcg = (seed: number) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

describe('DV-066 locomotion blend space (pure)', () => {
  const four = [clip('walk', 0, 1.5), clip('walk', 90, 1.4), clip('walk', 180, 1.3), clip('walk', -90, 1.4)];

  it('direction weights: bracketing samples share by angular distance, sum 1, exact hit = one clip', () => {
    const w = new Float32Array(4);
    directionWeights(four, 'walk', 45 * D, 100 * D, w);
    expect(w[0]).toBeCloseTo(0.5, 5);
    expect(w[1]).toBeCloseTo(0.5, 5);
    w.fill(0);
    const r = directionWeights(four, 'walk', 10 * D, 100 * D, w);
    expect(w[0]).toBeCloseTo(80 / 90, 4);
    expect(w[1]).toBeCloseTo(10 / 90, 4);
    expect(r.speed).toBeCloseTo((80 / 90) * 1.5 + (10 / 90) * 1.4, 4);
    w.fill(0);
    directionWeights(four, 'walk', -170 * D, 100 * D, w); // between back (180) and right (−90), across the ±π seam
    expect(w[2]! + w[3]!).toBeCloseTo(1, 5);
    expect(w[2]).toBeGreaterThan(w[3]!);
    w.fill(0);
    directionWeights(four, 'walk', 90 * D, 100 * D, w);
    expect(w[1]).toBeCloseTo(1, 6);
  });

  it('a single forward clip covers any direction by rotating the body (residual), wide gaps are not interpolated', () => {
    const w = new Float32Array(1);
    const r = directionWeights([clip('walk', 0, 1.5)], 'walk', 70 * D, 100 * D, w);
    expect(w[0]).toBe(1);
    expect(r.residual).toBeCloseTo(70 * D, 6);
    const two = [clip('walk', 0, 1.5), clip('walk', 90, 1.4)];
    const w2 = new Float32Array(2);
    const r2 = directionWeights(two, 'walk', -150 * D, 100 * D, w2); // gap of 270° behind: nearest only
    expect(w2[0]! + w2[1]!).toBeCloseTo(1, 6);
    expect(Math.abs(r2.residual)).toBeGreaterThan(0);
  });

  it('walk → jog → run: gait mix follows speed, playback rate matches speed (no foot sliding), phase is shared', () => {
    const set = [clip('walk', 0, 1.5, 1.2), clip('run', 0, 3.8, 0.7)];
    const c = new LocomotionController(set);
    const step = (vz: number, n: number): void => {
      for (let i = 0; i < n; i++) c.update(1 / 60, { aimYaw: 0, vx: 0, vz: -vz, aiming: false, crouch: false, aimPitch: 0 });
    };
    step(1.5, 120);
    expect(c.moveW).toBeGreaterThan(0.99);
    expect(c.locoW[0]).toBeGreaterThan(0.99);
    expect(c.rate).toBeCloseTo(1, 2);
    step(2.65, 120); // halfway between walk and run
    expect(c.locoW[0]).toBeCloseTo(0.5, 1);
    expect(c.locoW[1]).toBeCloseTo(0.5, 1);
    expect(c.rate).toBeCloseTo(1, 2);
    step(3.8, 120);
    expect(c.locoW[1]).toBeGreaterThan(0.99);
    // phase advance per frame = dt·rate / cycle
    const p0 = c.phase;
    step(3.8, 1);
    expect(wrapAngle((c.phase - p0) * 2 * Math.PI) / (2 * Math.PI)).toBeCloseTo(1 / 60 / 0.7, 3);
    // slow walk below the clip speed: slower cadence, never under 0.55×
    step(0.9, 120);
    expect(c.rate).toBeCloseTo(0.9 / 1.5, 2);
  });

  it('strafing while aiming: body keeps facing the aim, the left-strafe clip carries the gait', () => {
    const c = new LocomotionController([clip('walk', 0, 1.5), clip('walk', 90, 1.4), clip('walk', 180, 1.3), clip('walk', -90, 1.4)]);
    for (let i = 0; i < 120; i++) c.update(1 / 60, { aimYaw: 0, vx: -1.4, vz: 0, aiming: true, crouch: false, aimPitch: 0 }); // −x = left of yaw 0
    expect(Math.abs(c.bodyYaw)).toBeLessThan(0.02);
    expect(c.locoW[1]).toBeGreaterThan(0.98);
    expect(Math.abs(c.twist)).toBeLessThan(0.02);
  });

  it('forward clip only: moving sideways turns the body toward travel, the spine twist keeps the aim (clamped)', () => {
    const c = new LocomotionController([clip('walk', 0, 1.5)]);
    for (let i = 0; i < 180; i++) c.update(1 / 60, { aimYaw: 0, vx: -1.4, vz: 0, aiming: true, crouch: false, aimPitch: 0 });
    expect(c.bodyYaw).toBeCloseTo(80 * D, 2); // travel is +90°, spine allows 80° of twist
    expect(c.twist).toBeCloseTo(-80 * D, 2);
  });

  it('turn in place: upper body leads within 0.2 s, the turn clip carries the legs, body lands on the aim', () => {
    const lin = Array.from({ length: 33 }, (_, i) => i / 32);
    const turns: TurnClipInfo[] = [
      { dir: 1, yawTotal: Math.PI / 2, duration: 1, progress: lin },
      { dir: -1, yawTotal: Math.PI / 2, duration: 1, progress: lin },
    ];
    const c = new LocomotionController([clip('walk', 0, 1.5)], turns);
    const inp = { aimYaw: 0, vx: 0, vz: 0, aiming: true, crouch: false, aimPitch: 0 };
    c.update(1 / 60, inp);
    inp.aimYaw = 90 * D; // target appears on the left
    for (let i = 0; i < 12; i++) c.update(1 / 60, inp);
    expect(c.twist).toBeGreaterThan(0.5); // spine already swinging toward the target
    expect(c.turnIdx).toBe(0);
    let maxSum = 0;
    let minSum = 2;
    for (let i = 0; i < 90; i++) {
      c.update(1 / 60, inp);
      let s = c.standW + c.turnActiveApplied + c.turnOutApplied;
      for (const w of c.locoW) s += w;
      maxSum = Math.max(maxSum, s);
      minSum = Math.min(minSum, s);
    }
    expect(Math.abs(wrapAngle(c.bodyYaw - 90 * D))).toBeLessThan(2 * D);
    expect(maxSum).toBeLessThan(1 + 1e-5);
    expect(minSum).toBeGreaterThan(1 - 1e-5);
    expect(Math.abs(c.twist)).toBeLessThan(5 * D);
  });

  it('no turn clip: body rotates in place at a human rate, small aim changes are absorbed by the spine only', () => {
    const c = new LocomotionController([clip('walk', 0, 1.5)]);
    const inp = { aimYaw: 0, vx: 0, vz: 0, aiming: true, crouch: false, aimPitch: 0.3 };
    c.update(1 / 60, inp);
    inp.aimYaw = 25 * D; // under the 40° threshold
    for (let i = 0; i < 60; i++) c.update(1 / 60, inp);
    expect(c.bodyYaw).toBeCloseTo(0, 6);
    expect(c.twist).toBeCloseTo(25 * D, 2);
    expect(c.pitch).toBeCloseTo(0.3, 2);
    inp.aimYaw = 120 * D;
    c.update(0.1, inp);
    expect(c.bodyYaw).toBeCloseTo(3.2 * 0.1, 3);
    for (let i = 0; i < 120; i++) c.update(1 / 60, inp);
    expect(Math.abs(wrapAngle(c.bodyYaw - 120 * D))).toBeLessThan(0.06);
  });

  it('weights always sum to 1 (stand + gait + turn) under a random input sequence', () => {
    const lin = Array.from({ length: 17 }, (_, i) => i / 16);
    const c = new LocomotionController(
      [clip('walk', 0, 1.5), clip('walk', 90, 1.4), clip('walk', 180, 1.2), clip('walk', -90, 1.4), clip('run', 0, 3.8, 0.7), clip('run', 180, 3.0, 0.7)],
      [{ dir: 1, yawTotal: Math.PI / 2, duration: 0.9, progress: lin }],
    );
    const r = lcg(7);
    const inp = { aimYaw: 0, vx: 0, vz: 0, aiming: false, crouch: false, aimPitch: 0 };
    for (let i = 0; i < 2000; i++) {
      if (i % 40 === 0) {
        inp.aimYaw = (r() - 0.5) * 2 * Math.PI;
        const sp = r() < 0.4 ? 0 : r() * 5;
        const dir = r() * 2 * Math.PI;
        inp.vx = Math.sin(dir) * sp;
        inp.vz = Math.cos(dir) * sp;
        inp.aiming = r() < 0.5;
      }
      c.update(1 / 60, inp);
      let s = c.standW + c.turnActiveApplied + c.turnOutApplied;
      for (const w of c.locoW) {
        expect(w).toBeGreaterThanOrEqual(0);
        s += w;
      }
      expect(s).toBeCloseTo(1, 4);
      expect(Number.isFinite(c.bodyYaw) && Number.isFinite(c.phase)).toBe(true);
    }
  });

  it('progress table lookup and clip-name parsing', () => {
    expect(sampleProgress([0, 0.2, 1], 0.75)).toBeCloseTo(0.6, 6);
    expect(parseLocoName('walk_bl')).toEqual({ gait: 'walk', angle: 135 * D });
    expect(parseLocoName('crouch_walk_r')!.gait).toBe('crouch_walk');
    expect(parseLocoName('rifle_run')).toEqual({ gait: 'run', angle: 0 });
    expect(parseLocoName('rifle_idle')).toBeNull();
  });
});

// ---- synthetic Mixamo-like rig: Hips → Spine → Spine1 → Spine2 → Neck → Head, Hips → Left/RightFoot → ToeBase
function makeRig(): Group {
  const root = new Group();
  root.name = 'RootNode';
  const b = (name: string, parent: { add(o: Bone): unknown }, x = 0, y = 0, z = 0): Bone => {
    const o = new Bone();
    o.name = name;
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };
  const hips = b('mixamorigHips', root, 0, 0.9, 0);
  const s0 = b('mixamorigSpine', hips, 0, 0.1, 0);
  const s1 = b('mixamorigSpine1', s0, 0, 0.12, 0);
  const s2 = b('mixamorigSpine2', s1, 0, 0.14, 0);
  const neck = b('mixamorigNeck', s2, 0, 0.15, 0);
  b('mixamorigHead', neck, 0, 0.1, 0);
  b('mixamorigRightHand', s2, -0.3, 0, 0.3);
  for (const side of ['Left', 'Right']) {
    const f = b(`mixamorig${side}Foot`, hips, side === 'Left' ? 0.1 : -0.1, -0.85, 0);
    b(`mixamorig${side}ToeBase`, f, 0, -0.05, 0.1);
  }
  root.updateMatrixWorld(true);
  return root;
}

/** in-place gait: stance half of the cycle the foot slides opposite to travel at `speed` (dir = travel unit vector x,z) */
function gaitClip(name: string, speed: number, dirX: number, dirZ: number, T = 1, contactStart = 0.25): AnimationClip {
  const n = 40;
  const tracks: KeyframeTrack[] = [];
  for (const side of ['Left', 'Right'] as const) {
    const times: number[] = [];
    const vals: number[] = [];
    const half = (speed * T) / 4; // stance covers ±half
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * T;
      let ph = t / T - contactStart - (side === 'Right' ? 0.5 : 0);
      ph -= Math.floor(ph);
      let s: number;
      let lift = 0;
      if (ph < 0.5) s = half - (ph / 0.5) * 2 * half; // stance: +half → −half
      else {
        const q = (ph - 0.5) / 0.5;
        s = -half + q * 2 * half;
        lift = 0.12 * Math.sin(q * Math.PI);
      }
      times.push(t);
      vals.push((side === 'Left' ? 0.1 : -0.1) + dirX * s, -0.85 + lift, dirZ * s);
    }
    tracks.push(new VectorKeyframeTrack(`mixamorig${side}Foot.position`, times, vals));
  }
  tracks.push(new QuaternionKeyframeTrack('mixamorigSpine1.quaternion', [0, T], [0, 0, 0, 1, 0, 0, 0, 1]));
  return new AnimationClip(name, T, tracks);
}

function turnClip(name: string, deg: number, T = 1): AnimationClip {
  const times: number[] = [];
  const vals: number[] = [];
  const q = new Quaternion();
  for (let i = 0; i <= 20; i++) {
    times.push((i / 20) * T);
    q.setFromAxisAngle(new Vector3(0, 1, 0), (deg * D * i) / 20);
    vals.push(q.x, q.y, q.z, q.w);
  }
  return new AnimationClip(name, T, [new QuaternionKeyframeTrack('mixamorigHips.quaternion', times, vals)]);
}

function poseClip(name: string, T = 2): AnimationClip {
  return new AnimationClip(name, T, [
    new QuaternionKeyframeTrack('mixamorigHips.quaternion', [0, T], [0, 0, 0, 1, 0, 0, 0, 1]),
    new QuaternionKeyframeTrack('mixamorigSpine1.quaternion', [0, T], [0, 0, 0, 1, 0, 0, 0, 1]),
    new VectorKeyframeTrack('mixamorigLeftFoot.position', [0, T], [0.1, -0.85, 0, 0.1, -0.85, 0]),
  ]);
}

describe('DV-066 clip analysis (synthetic rig)', () => {
  it('measures in-place gait speed, travel direction (left = +x of the rig) and left-foot contact phase', () => {
    const rig = analysisRig(makeRig());
    const fwd = analyzeLocoClip(rig, gaitClip('walk_f', 1.4, 0, 1), 1, { speed: 9, angle: 0 });
    expect(fwd.measured).toBe(true);
    expect(fwd.speed).toBeCloseTo(1.4, 1);
    expect(fwd.angle).toBeCloseTo(0, 1);
    expect(fwd.phaseOffset).toBeCloseTo(0.25, 1);
    const left = analyzeLocoClip(rig, gaitClip('walk_l', 1.2, 1, 0), 1, { speed: 9, angle: 0 });
    expect(left.angle).toBeCloseTo(Math.PI / 2, 1);
    expect(left.speed).toBeCloseTo(1.2, 1);
    // a mislabeled clip keeps its measured direction (walk_r file that actually goes back)
    const back = analyzeLocoClip(rig, gaitClip('walk_r', 1.1, 0, -1), 1, { speed: 9, angle: -Math.PI / 2 });
    expect(Math.abs(wrapAngle(back.angle - Math.PI))).toBeLessThan(0.1);
    // file units → metres
    expect(analyzeLocoClip(rig, gaitClip('walk_f', 1.4, 0, 1), 2, { speed: 9, angle: 0 }).speed).toBeCloseTo(2.8, 1);
  });

  it('root-motion clip: speed from the hips drift, then made in place', () => {
    const rig = analysisRig(makeRig());
    const c = gaitClip('run_f', 0.0, 0, 1);
    c.tracks.push(new VectorKeyframeTrack('mixamorigHips.position', [0, 0.5, 1], [0, 0.9, 0, 0, 0.92, 1.5, 0, 0.9, 3]));
    const a = analyzeLocoClip(rig, c, 1, { speed: 9, angle: 0 });
    expect(a.rootMotion).toBe(true);
    expect(a.speed).toBeCloseTo(3, 3);
    expect(a.angle).toBeCloseTo(0, 3);
    const v = c.tracks.find((t) => t.name === 'mixamorigHips.position')!.values;
    expect(v[8]).toBeCloseTo(v[2]!, 5);
    expect(v[4]).toBeCloseTo(0.92, 5); // vertical bob kept
  });

  it('turn clip: yaw measured (left = +), stripped from the hips, normalized monotone progress', () => {
    const t = turnClip('turn_l', 90);
    const info = analyzeTurnClip(makeRig(), t)!;
    expect(info.dir).toBe(1);
    expect(info.yawTotal).toBeCloseTo(Math.PI / 2, 3);
    expect(info.progress[0]).toBeCloseTo(0, 5);
    expect(info.progress[info.progress.length - 1]).toBe(1);
    for (let i = 1; i < info.progress.length; i++) expect(info.progress[i]!).toBeGreaterThanOrEqual(info.progress[i - 1]!);
    const v = t.tracks[0]!.values;
    expect(Math.abs(v[v.length - 1]!)).toBeCloseTo(1, 4); // last key back to identity (w = ±1)
    expect(analyzeTurnClip(makeRig(), turnClip('turn_r', -90))!.dir).toBe(-1);
    expect(analyzeTurnClip(makeRig(), turnClip('turn_x', 10))).toBeNull();
  });

  it('upper/lower split: Spine and below it go up, hips + feet stay down', () => {
    const rig = makeRig();
    const up = upperBodyNames(rig);
    expect(up.has('mixamorigSpine')).toBe(true);
    expect(up.has('mixamorigHead')).toBe(true);
    expect(up.has('mixamorigHips')).toBe(false);
    const s = splitUpperLower(poseClip('rifle_idle'), up);
    expect(s.upper.tracks.map((t) => t.name)).toEqual(['mixamorigSpine1.quaternion']);
    expect(s.lower.tracks.length).toBe(2);
    expect(s.upper.name).toBe('rifle_idle#upper');
  });
});

function makeAsset(names: string[]): CharacterAsset {
  const template = makeRig();
  const clips: AnimationClip[] = [];
  for (const n of names) {
    if (n === 'walk_f') clips.push(gaitClip(n, 1.4, 0, 1));
    else if (n === 'walk_l') clips.push(gaitClip(n, 1.3, 1, 0));
    else if (n === 'run_f') clips.push(gaitClip(n, 3.6, 0, 1, 0.7));
    else if (n === 'turn_l') clips.push(turnClip(n, 90));
    else if (n === 'turn_r') clips.push(turnClip(n, -90));
    else clips.push(poseClip(n, n === 'rifle_fire' ? 0.25 : 2));
  }
  return { template: template as unknown as Group, clips, scale: 1, triangles: 0, hasClip: () => true, motion: buildMotionLibrary(template, clips, 1), props: {}, profile: 'swat' };
}

/** Σ weights over actions of each layer (by clip-name suffix) */
function layerSums(ch: CharacterInstance): { lower: number; upper: number; full: number } {
  const acts = (ch.mixer as unknown as { _actions: Array<{ getClip(): AnimationClip; getEffectiveWeight(): number }> })._actions;
  const r = { lower: 0, upper: 0, full: 0 };
  for (const a of acts) {
    const n = a.getClip().name;
    const w = a.getEffectiveWeight();
    if (n.endsWith('#lower')) r.lower += w;
    else if (n.endsWith('#upper')) r.upper += w;
    else r.full += w;
  }
  return r;
}

describe('DV-066 CharacterInstance layering', () => {
  const names = ['rifle_idle', 'rifle_aim', 'walk_f', 'walk_l', 'run_f', 'turn_l', 'turn_r', 'rifle_fire', 'rifle_reload', 'hit', 'hit_b', 'death_front', 'death_back', 'death_head'];

  it('library: gaits measured, turns found, overlays and death variants indexed', () => {
    const lib = makeAsset(names).motion;
    expect(lib.loco.map((l) => l.name)).toEqual(['walk_f', 'walk_l', 'run_f']);
    expect(lib.loco.every((l) => l.measured)).toBe(true);
    expect(lib.turns.map((t) => t.info.dir)).toEqual([1, -1]);
    expect(lib.overlays.map((o) => `${o.kind}:${o.dir}`)).toEqual(['fire:null', 'reload:null', 'hit:null', 'hit:b']);
    expect(lib.deaths.map((d) => d.dir)).toEqual(['f', 'b', 'head']);
  });

  it('lower and upper layers each sum to 1 while walking, firing, turning; legs keep walking during fire', () => {
    const ch = new CharacterInstance(makeAsset(names));
    const g = new Group();
    g.add(ch.root);
    ch.yawTarget = g;
    let t = 0;
    const frame = (aimYaw: number, vz: number, aiming: boolean): void => {
      ch.drive(aimYaw, 0, -vz, aiming);
      ch.update(1 / 60);
      t += 1 / 60;
      const s = layerSums(ch);
      expect(s.lower + s.full).toBeCloseTo(1, 4);
      expect(s.upper + s.full).toBeCloseTo(1, 4);
    };
    for (let i = 0; i < 60; i++) frame(0, 1.4, false);
    ch.playOnce('fire');
    for (let i = 0; i < 5; i++) frame(0, 1.4, true);
    const acts = (ch.mixer as unknown as { _actions: Array<{ getClip(): AnimationClip; getEffectiveWeight(): number }> })._actions;
    const w = (n: string): number => acts.find((a) => a.getClip().name === n)!.getEffectiveWeight();
    expect(w('rifle_fire#upper')).toBeGreaterThan(0.5);
    expect(w('walk_f#lower')).toBeGreaterThan(0.95); // legs untouched by the shot
    for (let i = 0; i < 60; i++) frame(0, 0, true);
    for (let i = 0; i < 90; i++) frame(Math.PI / 2, 0, true); // turn in place
    expect(Math.abs(wrapAngle(g.rotation.y - Math.PI / 2))).toBeLessThan(0.05);
    expect(t).toBeGreaterThan(3);
  });

  it('aim offset: spine chain turns the chest toward the aim; death from behind picks death_back and zeroes everything else', () => {
    const ch = new CharacterInstance(makeAsset(names));
    const g = new Group();
    g.add(ch.root);
    ch.root.rotation.y = Math.PI; // as SoldierVisual: rig +z → actor −z
    ch.yawTarget = g;
    for (let i = 0; i < 30; i++) {
      ch.drive(0, 0, 0, true);
      ch.update(1 / 60);
    }
    ch.drive(30 * D, 0, 0, true, false, 15 * D); // under the turn threshold: spine only
    for (let i = 0; i < 60; i++) ch.update(1 / 60);
    g.updateMatrixWorld(true);
    const chest = ch.model.getObjectByName('mixamorigSpine2')!;
    const q = chest.getWorldQuaternion(new Quaternion());
    const fwd = new Vector3(0, 0, 1).applyQuaternion(q); // rig forward of the chest in world
    const yaw = Math.atan2(-fwd.x, -fwd.z);
    expect(yaw).toBeCloseTo(30 * D, 1);
    expect(Math.asin(fwd.y)).toBeCloseTo(15 * D, 1);
    expect(g.rotation.y).toBeCloseTo(0, 3); // legs did not move
    ch.playOnce('death', { dir: 'b' });
    for (let i = 0; i < 30; i++) ch.update(1 / 60);
    const acts = (ch.mixer as unknown as { _actions: Array<{ getClip(): AnimationClip; getEffectiveWeight(): number }> })._actions;
    for (const a of acts) {
      const n = a.getClip().name;
      if (n === 'death_back') expect(a.getEffectiveWeight()).toBeCloseTo(1, 5);
      else expect(a.getEffectiveWeight(), n).toBeLessThan(1e-6);
    }
    expect(ch.playOnce('hit')).toBe(false);
  });

  it('hit variants: direction pick with generic fallback; legacy 8-clip soldier still works (forward walk only)', () => {
    const ch = new CharacterInstance(makeAsset(['rifle_idle', 'rifle_aim', 'rifle_walk', 'rifle_run', 'rifle_fire', 'rifle_reload', 'hit', 'death_front']));
    expect(ch.has('walk') && ch.has('run') && ch.has('death') && ch.has('hit')).toBe(true);
    expect(ch.playOnce('hit', { dir: 'l' })).toBe(true);
    expect(ch.playOnce('death', { dir: 'b', head: true })).toBe(true); // falls back to death_front
    for (let i = 0; i < 30; i++) ch.update(1 / 60);
    const s = layerSums(ch);
    expect(s.full).toBeCloseTo(1, 5);
  });
});
