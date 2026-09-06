/**
 * Chế độ hiệu chỉnh tay cầm súng (TIP-017) — `?calib=soldier|fp` (chỉ debug; PROD cần thêm ?debug=1).
 * Đèn sáng trung tính, AI khoá, camera orbit quanh lính (hoặc FP đứng yên), trục tại anchor gripR/gripL + bone tay,
 * cầu tại khớp ngón. `window.__ht.calib`: orbit / pose / fp / setHand / measure / exportJson.
 * Số đo tính trong **hệ bone bàn tay** (world quaternion, không scale, đơn vị m): grip phải nằm ở tâm cung ngón.
 */
import { HemisphereLight, DirectionalLight, AxesHelper, Mesh, SphereGeometry, MeshBasicNodeMaterial, Object3D, Vector3, Quaternion, Euler, Color } from 'three/webgpu';
import type { Game } from '@game/game';
import type { SoldierVisual } from '@game/actors/visual';
import type { WeaponPose, WeaponModelConfig } from '@engine/render/weaponModel';
import { applyGripPivot } from '@engine/render/rifleProp';
import { NULL_INPUT } from '@engine/input/input';

export type CalibMode = 'soldier' | 'fp';
type Side = 'R' | 'L';
type Vec3 = [number, number, number];

export interface HandMeasure {
  side: Side;
  /** anchor grip trong hệ bone tay (m) */
  grip: Vec3;
  /** tâm cung ngón (Index/Middle/Ring/Pinky đốt 1–3) trong hệ bone tay */
  fingerCentroid: Vec3;
  /** |grip − centroid| (m) */
  error: number;
  /** trục co ngón (Index → Pinky) trong hệ bone tay */
  curlAxis: Vec3;
  /** góc nhọn giữa trục co ngón và trục tay cầm/ốp lót của súng (°) */
  axisAngleDeg: number;
  /** lòng bàn tay (+z bone) biểu diễn trong hệ súng */
  palmInGun: Vec3;
  /** cổ tay ↔ đích IK (m), chỉ tay có IK */
  ikError?: number;
}

const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'] as const;
const _p = new Vector3();
const _q = new Quaternion();
const _qi = new Quaternion();
const _hp = new Vector3();
const _c = new Vector3();
const _a = new Vector3();
const _b = new Vector3();
const _g = new Vector3();
const _gq = new Quaternion();

function bone(root: Object3D, side: Side, name: string): Object3D | null {
  const s = side === 'R' ? 'Right' : 'Left';
  return root.getObjectByName(`mixamorig${s}${name}`) ?? root.getObjectByName(`mixamorig:${s}${name}`) ?? null;
}

/** điểm world → hệ bone (quaternion world, gốc tại bone, không scale) */
function toHandFrame(hand: Object3D, world: Vector3, out: Vector3): Vector3 {
  hand.getWorldPosition(_hp);
  hand.getWorldQuaternion(_q);
  _qi.copy(_q).invert();
  return out.copy(world).sub(_hp).applyQuaternion(_qi);
}

function r3(v: Vector3): Vec3 {
  return [+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)];
}

/**
 * Đo một bàn tay so với anchor grip. `gunAxisLocal` = trục tay cầm (phải: tay cầm ngả sau 15°) hoặc ốp lót (trái: trục nòng) trong hệ súng.
 */
export function measureHand(root: Object3D, side: Side, grip: Object3D, gunRoot: Object3D, ikError?: number): HandMeasure | null {
  const hand = bone(root, side, 'Hand');
  if (!hand) return null;
  hand.updateWorldMatrix(true, true);
  grip.updateWorldMatrix(true, false);
  grip.getWorldPosition(_p);
  const gripLocal = toHandFrame(hand, _p, new Vector3());
  _c.set(0, 0, 0);
  let n = 0;
  const idx = new Vector3();
  const pky = new Vector3();
  for (const f of FINGERS) {
    for (let i = 1; i <= 3; i++) {
      const b = bone(root, side, `Hand${f}${i}`);
      if (!b) continue;
      b.getWorldPosition(_p);
      toHandFrame(hand, _p, _a);
      _c.add(_a);
      n++;
      if (f === 'Index') idx.add(_a);
      if (f === 'Pinky') pky.add(_a);
    }
  }
  if (n === 0) return null;
  _c.divideScalar(n);
  const curl = new Vector3().copy(pky).sub(idx).normalize();
  // trục súng (world) → hệ bone tay
  gunRoot.getWorldQuaternion(_gq);
  const gunAxis = side === 'R' ? _g.set(0, Math.cos(0.26), -Math.sin(0.26)) : _g.set(0, 0, -1);
  gunAxis.applyQuaternion(_gq);
  hand.getWorldQuaternion(_q);
  _b.copy(gunAxis).applyQuaternion(_qi.copy(_q).invert()).normalize();
  const cosT = Math.abs(Math.max(-1, Math.min(1, curl.dot(_b))));
  // lòng bàn tay (+z bone) trong hệ súng
  const palm = new Vector3(0, 0, 1).applyQuaternion(_q).applyQuaternion(_gq.clone().invert());
  const m: HandMeasure = {
    side,
    grip: r3(gripLocal),
    fingerCentroid: r3(_c),
    error: +gripLocal.distanceTo(_c).toFixed(4),
    curlAxis: r3(curl),
    axisAngleDeg: +((Math.acos(cosT) * 180) / Math.PI).toFixed(1),
    palmInGun: r3(palm),
  };
  if (ikError !== undefined) m.ikError = +ikError.toFixed(4);
  return m;
}

/** hướng súng trong hệ nhân vật (Mixamo nhìn +z): yaw > 0 = lệch trái người, pitch > 0 = chúc xuống, roll = nghiêng */
export function gunInChar(gunRoot: Object3D, charRoot: Object3D): { forwardInChar: Vec3; upInChar: Vec3; yawDeg: number; pitchDeg: number; rollDeg: number } {
  gunRoot.updateWorldMatrix(true, false);
  gunRoot.getWorldQuaternion(_gq);
  charRoot.getWorldQuaternion(_q);
  _qi.copy(_q).invert();
  const f = new Vector3(0, 0, -1).applyQuaternion(_gq).applyQuaternion(_qi);
  const u = new Vector3(0, 1, 0).applyQuaternion(_gq).applyQuaternion(_qi);
  const yaw = (Math.atan2(f.x, f.z) * 180) / Math.PI; // +z = trước người; +x = trái người
  const pitch = (-Math.asin(Math.max(-1, Math.min(1, f.y))) * 180) / Math.PI;
  const right = new Vector3().crossVectors(f, new Vector3(0, 1, 0)).normalize();
  const upRef = new Vector3().crossVectors(right, f).normalize();
  const roll = (Math.atan2(u.dot(right), u.dot(upRef)) * 180) / Math.PI;
  return { forwardInChar: r3(f), upInChar: r3(u), yawDeg: +yaw.toFixed(1), pitchDeg: +pitch.toFixed(1), rollDeg: +roll.toFixed(1) };
}

export interface FitResult {
  handR: WeaponPose;
  handL: WeaponPose;
  /** |PL−PR| đo trên animation vs |gripL−gripR| của súng (m) */
  handSpan: number;
  gripSpan: number;
  gun: ReturnType<typeof gunInChar>;
}

/** tâm cung ngón (world) + gốc/hướng bone bàn tay */
function handWorld(root: Object3D, side: Side): { centroid: Vector3; pos: Vector3; quat: Quaternion } | null {
  const hand = bone(root, side, 'Hand');
  if (!hand) return null;
  const c = new Vector3();
  let n = 0;
  for (const f of FINGERS) {
    for (let i = 1; i <= 3; i++) {
      const b = bone(root, side, `Hand${f}${i}`);
      if (!b) continue;
      c.add(b.getWorldPosition(_p));
      n++;
    }
  }
  if (n === 0) return null;
  c.divideScalar(n);
  return { centroid: c, pos: hand.getWorldPosition(new Vector3()), quat: hand.getWorldQuaternion(new Quaternion()) };
}

/**
 * Khớp súng vào pose animation (2 điểm): gripR tại tâm cung ngón phải, trục gripR→gripL trùng hướng tới tâm cung ngón trái,
 * roll để "lên" của súng gần "lên" thế giới nhất. Trả pose bàn tay trong hệ anchor (cùng định nghĩa fp.handR/handL).
 */
export function fitGunToPose(root: Object3D, cfg: WeaponModelConfig, charRoot: Object3D, up = new Vector3(0, 1, 0)): FitResult | null {
  const R = handWorld(root, 'R');
  const L = handWorld(root, 'L');
  if (!R || !L) return null;
  const gR = new Vector3(...cfg.anchors.gripR);
  const gL = new Vector3(...cfg.anchors.gripL);
  const ug = new Vector3().subVectors(gL, gR);
  const gripSpan = ug.length();
  ug.normalize();
  const uw = new Vector3().subVectors(L.centroid, R.centroid);
  const handSpan = uw.length();
  uw.normalize();
  const q1 = new Quaternion().setFromUnitVectors(ug, uw);
  const y1 = new Vector3(0, 1, 0).applyQuaternion(q1);
  y1.addScaledVector(uw, -y1.dot(uw)).normalize();
  const upP = up.clone().addScaledVector(uw, -up.dot(uw)).normalize();
  const cosT = Math.max(-1, Math.min(1, y1.dot(upP)));
  const sign = new Vector3().crossVectors(y1, upP).dot(uw) < 0 ? -1 : 1;
  const qRoll = new Quaternion().setFromAxisAngle(uw, Math.acos(cosT) * sign);
  const qGun = qRoll.multiply(q1);
  const qGunInv = qGun.clone().invert();
  const toPose = (hand: { pos: Vector3; quat: Quaternion }, anchorWorld: Vector3): WeaponPose => {
    const pos = hand.pos.clone().sub(anchorWorld).applyQuaternion(qGunInv);
    const rot = new Euler().setFromQuaternion(qGunInv.clone().multiply(hand.quat), 'XYZ');
    return { pos: [+pos.x.toFixed(4), +pos.y.toFixed(4), +pos.z.toFixed(4)], rot: [+rot.x.toFixed(4), +rot.y.toFixed(4), +rot.z.toFixed(4)] };
  };
  const gripLWorld = R.centroid.clone().add(gL.clone().sub(gR).applyQuaternion(qGun));
  const tmp = new Object3D();
  tmp.quaternion.copy(qGun);
  tmp.updateMatrixWorld(true);
  return { handR: toPose(R, R.centroid), handL: toPose(L, gripLWorld), handSpan: +handSpan.toFixed(4), gripSpan: +gripSpan.toFixed(4), gun: gunInChar(tmp, charRoot) };
}

type FpChain = { shoulder: Vector3; target: Vector3; reach: number; err: number };
export interface ReachInfo {
  shoulder: Vec3;
  target: Vec3;
  dist: number;
  reach: number;
  err: number;
}

export interface CalibApi {
  mode: CalibMode;
  /** khớp súng vào pose animation hiện tại của lính (idle/walk/aim) và áp luôn */
  fit(apply?: boolean): FitResult | null;
  orbit(azDeg: number, elDeg: number, dist: number, height?: number): void;
  pose(state: 'idle' | 'walk' | 'aim'): void;
  fp(pose: 'hip' | 'ads' | 'sprint'): void;
  setHand(side: Side, pos: Vec3, rot: Vec3, weaponId?: string): void;
  getHand(side: Side, weaponId?: string): WeaponPose;
  measure(): {
    weapon: string;
    R: HandMeasure | null;
    L: HandMeasure | null;
    gun?: { forwardInChar: Vec3; upInChar: Vec3; yawDeg: number; pitchDeg: number; rollDeg: number };
    /** FP: vai/đích trong hệ camera, khoảng cách vs tầm với */
    reach?: { R: ReachInfo | null; L: ReachInfo | null };
  };
  exportJson(weaponId?: string): string;
  helpers(v: boolean): void;
}

function addHelpers(root: Object3D, size: number, list: Object3D[]): void {
  const mat = new MeshBasicNodeMaterial({ color: new Color(0xffe040) });
  const matI = new MeshBasicNodeMaterial({ color: new Color(0x40ff80) });
  const geo = new SphereGeometry(1, 8, 6);
  for (const side of ['R', 'L'] as Side[]) {
    const hand = bone(root, side, 'Hand');
    if (hand) {
      const ax = new AxesHelper(1);
      hand.getWorldScale(_p);
      ax.scale.setScalar(size / (_p.x || 1));
      hand.add(ax);
      list.push(ax);
    }
    for (const f of [...FINGERS, 'Thumb']) {
      for (let i = 1; i <= 3; i++) {
        const b = bone(root, side, `Hand${f}${i}`);
        if (!b) continue;
        const s = new Mesh(geo, f === 'Index' ? matI : mat);
        b.getWorldScale(_p);
        s.scale.setScalar((size * 0.12) / (_p.x || 1));
        b.add(s);
        list.push(s);
      }
    }
  }
}

function anchorHelper(anchor: Object3D, size: number, list: Object3D[]): void {
  const ax = new AxesHelper(size);
  anchor.add(ax);
  list.push(ax);
  const s = new Mesh(new SphereGeometry(size * 0.15, 10, 8), new MeshBasicNodeMaterial({ color: new Color(0xff3060) }));
  anchor.add(s);
  list.push(s);
}

export function installCalib(game: Game, mode: CalibMode, params: URLSearchParams): CalibApi {
  const scene = game.scene;
  scene.add(new HemisphereLight(0xffffff, 0x8090a0, 2.2));
  const sun = new DirectionalLight(0xfff2e0, 2.5);
  sun.position.set(3, 6, 4);
  scene.add(sun);
  game.vmScene.add(new HemisphereLight(0xffffff, 0x8090a0, 2.2));
  const sunVm = new DirectionalLight(0xfff2e0, 2.5);
  sunVm.position.set(3, 6, 4);
  game.vmScene.add(sunVm);
  game.aiPaused = true;
  const helpers: Object3D[] = [];
  game.input = NULL_INPUT;

  const weapons = game.assets?.weapons ?? {};
  const soldierWeaponId = game.weaponIdFor('enemy'); // ?botWeapon=ak47: lính cầm khẩu người chơi → fit() ra pose fp cho khẩu đó (TIP-D10)
  const fpWeaponId = game.playerWeaponId;
  const bot = game.bots.get('bot_a');
  const soldier = bot?.dummy.kind === 'gltf' ? (bot.dummy as SoldierVisual) : null;
  const target = new Vector3();
  let orbitAz = Number(params.get('az') ?? 35);
  let orbitEl = Number(params.get('el') ?? 10);
  let orbitDist = Number(params.get('dist') ?? 1.6);
  let orbitH = Number(params.get('h') ?? 1.2);

  if (mode === 'soldier' && bot && soldier) {
    const ps = game.arena.playerSpawn;
    const p = bot.bot.position;
    p[0] = ps[0];
    p[1] = 0;
    p[2] = ps[2] - 3;
    bot.bot.yaw = Math.PI; // mặt về +z (về phía spawn)
    bot.syncBody();
    game.viewModelHidden = true;
    game.cameraDriver = () => {
      target.set(p[0], p[1] + orbitH, p[2]);
      const az = (orbitAz * Math.PI) / 180;
      const el = (orbitEl * Math.PI) / 180;
      game.camera.position.set(target.x + Math.sin(az) * Math.cos(el) * orbitDist, target.y + Math.sin(el) * orbitDist, target.z + Math.cos(az) * Math.cos(el) * orbitDist);
      game.camera.lookAt(target);
    };
    addHelpers(soldier.char.model, 0.08, helpers);
    const att = soldier.attached;
    if (att?.anchors) {
      anchorHelper(att.anchors.gripR, 0.06, helpers);
      anchorHelper(att.anchors.gripL, 0.06, helpers);
    }
  } else if (mode === 'fp') {
    game.fpOverride = { ads: 0, sprint: false };
    if (game.fpArms) addHelpers(game.fpArms.model, 0.05, helpers);
    const fa = game.viewModel.fpAnchors;
    if (fa) {
      anchorHelper(fa.gripR, 0.04, helpers);
      anchorHelper(fa.gripL, 0.04, helpers);
    }
    game.player.rig.reset(0, Number(params.get('pitch') ?? -0.25));
  }

  const cfgOf = (id: string): WeaponModelConfig | null => weapons[id]?.cfg ?? null;
  const applyToSoldiers = (): void => {
    for (const b of game.bots.values()) {
      const s = b.dummy as SoldierVisual;
      if (s.kind === 'gltf' && s.attached?.weapon && s.rifle) applyGripPivot(s.rifle, s.attached.weapon);
    }
  };

  const api: CalibApi = {
    mode,
    orbit: (az, el, dist, height) => {
      orbitAz = az;
      orbitEl = el;
      orbitDist = dist;
      if (height !== undefined) orbitH = height;
    },
    pose: (state) => {
      if (!bot) return;
      bot.dummy.motion.speed = state === 'walk' ? 3 : 0;
      bot.dummy.motion.aiming = state === 'aim';
      bot.bot.state = state === 'aim' ? 'PEEK_FIRE' : 'PATROL'; // syncVisual đọc aiming từ state (AI đã khoá)
    },
    fit: (apply = true) => {
      if (!soldier?.attached?.weapon) return null;
      soldier.ikEnabled = false;
      soldier.applyRawPose();
      const r = fitGunToPose(soldier.char.model, soldier.attached.weapon.cfg, soldier.char.root);
      soldier.ikEnabled = true;
      if (r && apply) {
        api.setHand('R', r.handR.pos, r.handR.rot, soldierWeaponId);
        api.setHand('L', r.handL.pos, r.handL.rot, soldierWeaponId);
      }
      return r;
    },
    fp: (pose) => {
      game.fpOverride = { ads: pose === 'ads' ? 1 : 0, sprint: pose === 'sprint' };
    },
    setHand: (side, pos, rot, weaponId) => {
      const cfg = cfgOf(weaponId ?? (mode === 'fp' ? fpWeaponId : soldierWeaponId));
      if (!cfg) return;
      const h = side === 'R' ? cfg.fp.handR : cfg.fp.handL;
      h.pos = [pos[0], pos[1], pos[2]];
      h.rot = [rot[0], rot[1], rot[2]];
      if (side === 'R') applyToSoldiers();
    },
    getHand: (side, weaponId) => {
      const cfg = cfgOf(weaponId ?? (mode === 'fp' ? fpWeaponId : soldierWeaponId));
      if (!cfg) return { pos: [0, 0, 0], rot: [0, 0, 0] };
      return side === 'R' ? cfg.fp.handR : cfg.fp.handL;
    },
    measure: () => {
      if (mode === 'soldier' && soldier?.attached?.anchors && soldier.rifle) {
        const a = soldier.attached.anchors;
        const gunRoot = soldier.rifle.children[0] ?? soldier.rifle;
        return {
          weapon: soldierWeaponId,
          R: measureHand(soldier.char.model, 'R', a.gripR, gunRoot),
          L: measureHand(soldier.char.model, 'L', a.gripL, gunRoot, soldier.ikErrorL),
          gun: gunInChar(gunRoot, soldier.char.root),
        };
      }
      const fa = game.viewModel.fpAnchors;
      if (mode === 'fp' && game.fpArms && fa) {
        const gunRoot = fa.gripR.parent ?? fa.gripR;
        const d = game.fpArms.debugInfo();
        const cam = game.camera;
        cam.updateMatrixWorld(true);
        const inCam = (v: Vector3): Vec3 => r3(cam.worldToLocal(v.clone()));
        const reach = (x: FpChain | null) => (x ? { shoulder: inCam(x.shoulder), target: inCam(x.target), dist: +x.shoulder.distanceTo(x.target).toFixed(3), reach: +x.reach.toFixed(3), err: +x.err.toFixed(3) } : null);
        return { weapon: fpWeaponId, R: measureHand(game.fpArms.model, 'R', fa.gripR, gunRoot), L: measureHand(game.fpArms.model, 'L', fa.gripL, gunRoot), reach: { R: reach(d.R), L: reach(d.L) } };
      }
      return { weapon: '', R: null, L: null };
    },
    exportJson: (weaponId) => {
      const cfg = cfgOf(weaponId ?? (mode === 'fp' ? fpWeaponId : soldierWeaponId));
      return cfg ? JSON.stringify(cfg.fp, null, 2) : '';
    },
    helpers: (v) => {
      for (const h of helpers) h.visible = v;
    },
  };
  return api;
}
