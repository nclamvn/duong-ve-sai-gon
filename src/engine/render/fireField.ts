/**
 * DV-086 lửa và khói chiến trường (napalm, hố bom, đồng đội hy sinh) — thay 3 tấm chéo đứng yên của ambientFx bằng hạt:
 *  - ngọn lửa: mỗi đám 20 hạt sinh liên tục ở đáy, bốc lên, thon và nguội dần (trắng vàng → cam → đỏ sẫm), mép bị nhiễu chảy
 *    gặm (không phải hình dán), quay theo camera quanh trục đứng (ngọn luôn thẳng đứng); hạt sinh sau lúc bắt lửa nên đám lửa
 *    bùng lên rồi lụi dần, không hiện đủ ngay;
 *  - tàn lửa: 10 đốm sáng mỗi đám, bay xoắn lên nhanh, tắt dần;
 *  - quầng sáng đất: một tấm nằm sát đất dưới mỗi đám (lửa "đứng" trên đất, không lơ lửng);
 *  - khói: mỗi cột 28 hạt to dần, loãng dần, trôi theo gió, sáng hơn khi lên cao; cột lớn lên từ từ từ lúc cháy, không thành cột
 *    đặc như cột đá; mờ khi sát camera (bớt phủ màn hình).
 * Toàn bộ là 4 InstancedMesh (lửa, tàn, quầng, khói) — 4 draw call bất kể bao nhiêu đám cháy; chỗ chưa dùng co về 0 (không vẽ
 * điểm ảnh nào). Thời gian theo đồng hồ của trận (`update(now)`), hash theo chỉ số (không Math.random). TSL only.
 */
import { InstancedMesh, PlaneGeometry, MeshBasicNodeMaterial, Group, PointLight, Matrix4, Vector3, AdditiveBlending, NormalBlending, DoubleSide, InstancedBufferAttribute, CustomBlending, AddEquation, OneFactor, OneMinusSrcAlphaFactor, type Node } from 'three/webgpu';
import { float, vec3, vec4, uniform, uv, mix, smoothstep, sin, max, mx_noise_float, attribute, cameraProjectionMatrix, cameraViewMatrix, cameraPosition, positionLocal, normalize, length, fract, pow, step, varying } from 'three/tsl';

export interface FireFieldOptions {
  /** số đám lửa tối đa cùng lúc */
  fires?: number;
  /** số cột khói tối đa cùng lúc */
  smokes?: number;
  /** số đèn điểm (gán cho các đám gần camera nhất) */
  lights?: number;
}

export interface FireField {
  readonly group: Group;
  readonly fireCount: number;
  readonly smokeCount: number;
  /** đặt đám lửa vào chỗ `slot` (0..fires−1): tâm, thời điểm bắt/tắt (giây đồng hồ trận), cỡ */
  setFire(slot: number, p: readonly [number, number, number], start: number, end: number, scale: number): void;
  /** đặt cột khói vào chỗ `slot` (màu gốc, độ sáng lên khi bốc cao, cao cột) — xem SMOKE_BLACK / SMOKE_GREY */
  setSmoke(slot: number, p: readonly [number, number, number], start: number, end: number, scale: number, look: SmokeLook): void;
  /** mỗi frame: đồng hồ + vị trí camera (gán đèn cho đám gần nhất; null = các đám đầu tiên) */
  update(now: number, camera: Vector3 | null): void;
  readonly lights: PointLight[];
  readonly stats: { activeFires: number; activeSmokes: number; litFires: number };
}

/** màu khói: gốc (linear rgb), độ sáng lên khi bốc cao (1 ngày nắng · ~0,1 đêm), cao cột (m; 0 = mặc định theo cỡ) */
export interface SmokeLook {
  color: [number, number, number];
  lit: number;
  height?: number;
}
export const SMOKE_BLACK: SmokeLook = { color: [0.045, 0.04, 0.035], lit: 0.5 };
export const SMOKE_GREY: SmokeLook = { color: [0.3, 0.29, 0.27], lit: 0.75 };

const FLAMES = 20;
const EMBERS = 10;
const SMOKE_P = 28;

/** hash [0,1) từ số nguyên (deterministic) */
function h1(i: number, k: number): number {
  let x = (i * 374761393 + k * 668265263) >>> 0;
  x = (x ^ (x >>> 13)) >>> 0;
  x = Math.imul(x, 1274126177) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

type F = Node<'float'>;
type V3 = Node<'vec3'>;

/** bảng instance: center+scale (vec4) và start/end/seed/extra (vec4) */
function makeInstanced(count: number, perSlot: number, seedKey: number): { geo: PlaneGeometry; center: InstancedBufferAttribute; time: InstancedBufferAttribute } {
  const geo = new PlaneGeometry(1, 1);
  const center = new InstancedBufferAttribute(new Float32Array(count * 4), 4);
  const time = new InstancedBufferAttribute(new Float32Array(count * 4), 4);
  center.setUsage(35048);
  time.setUsage(35048);
  const t = time.array as Float32Array;
  for (let i = 0; i < count; i++) {
    t[i * 4] = -1e6; // start
    t[i * 4 + 1] = -1e6; // end (đã tắt)
    t[i * 4 + 2] = h1(i % perSlot, seedKey) * 0.999 + h1(Math.floor(i / perSlot), seedKey + 1) * 0.001;
    t[i * 4 + 3] = 0;
  }
  geo.setAttribute('aCenter', center);
  geo.setAttribute('aTime', time);
  return { geo, center, time };
}

function finishMesh(geo: PlaneGeometry, mat: MeshBasicNodeMaterial, count: number, name: string, order: number): InstancedMesh {
  const mesh = new InstancedMesh(geo, mat, count);
  const m = new Matrix4();
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, m);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.renderOrder = order;
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

/** góc quay quanh trục đứng hướng về camera → offset thế giới của đỉnh quad (rộng w, cao h) */
function uprightQuad(C: V3, w: F, h: F): V3 {
  const toCam = cameraPosition.sub(C);
  const right = normalize(vec3(toCam.z, 0, toCam.x.negate()).add(vec3(1e-4, 0, 0)));
  return C.add(right.mul(positionLocal.x.mul(w))).add(vec3(0, 1, 0).mul(positionLocal.y.mul(h))) as unknown as V3;
}

export function createFireField(opts: FireFieldOptions = {}): FireField {
  const nFire = opts.fires ?? 24;
  const nSmoke = opts.smokes ?? 18;
  const nLight = opts.lights ?? 4;
  const group = new Group();
  group.name = 'fire_field';
  const uT = uniform(0);
  const uWind = uniform(new Vector3(1, 0, 0.35));

  // ---------------------------------------------------------------- ngọn lửa
  const fl = makeInstanced(nFire * FLAMES, FLAMES, 11);
  {
    const c = attribute('aCenter', 'vec4') as unknown as Node<'vec4'>;
    const tm = attribute('aTime', 'vec4') as unknown as Node<'vec4'>;
    const sc = c.w;
    const s = tm.z;
    const s2 = fract(s.mul(7.31));
    const s3 = fract(s.mul(13.7));
    const s4 = fract(s.mul(3.17));
    const period = s2.mul(0.55).add(0.75);
    const ageRaw = uT.sub(tm.x).div(period).add(s);
    const age = fract(ageRaw);
    // hạt sinh lúc uT − age·period: chỉ hiện nếu sinh trong [start, end]
    const birth = uT.sub(age.mul(period));
    const alive = step(tm.x, birth).mul(step(birth, tm.y));
    const env = smoothstep(tm.x, tm.x.add(0.7), uT).mul(smoothstep(tm.y.sub(4), tm.y, uT).oneMinus());
    const shrink = age.mul(0.65).oneMinus();
    const ox = s3.sub(0.5).mul(1.5).mul(sc).mul(shrink);
    const oz = s4.sub(0.5).mul(1.5).mul(sc).mul(shrink);
    const rise = pow(age, float(0.75)).mul(s2.mul(1.4).add(1.3)).mul(sc).mul(env.mul(0.5).add(0.5));
    const turb = sin(uT.mul(4.3).add(s.mul(31))).mul(0.14).mul(sc).mul(age);
    const drift = vec3(uWind.x, 0, uWind.z).mul(age.mul(age).mul(0.55).mul(sc));
    const C = c.xyz.add(vec3(ox.add(turb), rise.add(sc.mul(0.12)), oz)).add(drift) as unknown as V3;
    const size = sc.mul(s3.mul(0.45).add(0.7)).mul(age.mul(0.55).oneMinus()).mul(env.mul(0.45).add(0.55)).mul(alive);
    const P = uprightQuad(C, size.mul(1.1) as unknown as F, size.mul(1.6) as unknown as F);
    // trộn alpha nhân sẵn: rgb = ánh sáng phát ra (cộng), alpha = phần che nền (ít) — lửa vừa phát sáng vừa đủ đặc để giữ màu cam
    // giữa nền sương sáng ban ngày (cộng thuần bị bạc thành trắng, trộn thường thành tấm giấy cắt)
    const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide });
    mat.blending = CustomBlending;
    mat.blendEquation = AddEquation;
    mat.blendSrc = OneFactor;
    mat.blendDst = OneMinusSrcAlphaFactor;
    mat.blendSrcAlpha = OneFactor;
    mat.blendDstAlpha = OneMinusSrcAlphaFactor;
    mat.fog = false;
    mat.vertexNode = cameraProjectionMatrix.mul(cameraViewMatrix.mul(vec4(P, 1)));
    const vAge = varying(age);
    const vSeed = varying(s);
    const vEnv = varying(env);
    const q = uv();
    const y = q.y; // 0 đáy → 1 đỉnh
    // lưỡi lửa uốn ngang theo nhiễu, càng lên cao càng uốn mạnh
    const wig = mx_noise_float(vec3(y.mul(2.6).sub(uT.mul(2.2)), vSeed.mul(31), 0.5)).mul(0.55).mul(y);
    const x = q.x.sub(0.5).mul(2).add(wig);
    // hình giọt: rộng ở đáy, nhọn ở đỉnh
    const d = x.abs().div(pow(y.oneMinus().max(0.02), float(0.7)).mul(0.9).add(0.04));
    const shape = smoothstep(float(0), float(0.22), y).mul(smoothstep(float(0.55), float(1), d).oneMinus());
    // nhiễu chảy 2 tầng gặm mép: đáy đặc, đỉnh vỡ thành lưỡi
    const n1 = mx_noise_float(vec3(x.mul(1.8), y.mul(2.6).sub(uT.mul(3.0)).sub(vSeed.mul(5)), vSeed.mul(17))).mul(0.5).add(0.5);
    const n2 = mx_noise_float(vec3(x.mul(4.4).add(3.7), y.mul(5.6).sub(uT.mul(5.6)).sub(vSeed.mul(9)), vSeed.mul(23).add(1.3))).mul(0.5).add(0.5);
    const tb = n1.mul(0.65).add(n2.mul(0.35)).add(y.oneMinus().mul(0.32));
    const dens = shape.mul(smoothstep(float(0.42), float(0.72), tb));
    const heat = dens.mul(y.mul(0.55).oneMinus()).mul(pow(vAge.oneMinus(), float(0.7))).mul(vEnv);
    // màu theo nhiệt, độ sáng HDR vừa (AgX làm nhạt màu quá sáng thành hồng phấn): đỏ sẫm → cam → vàng
    const c1 = mix(vec3(0.55, 0.08, 0.015), vec3(1.25, 0.42, 0.06), smoothstep(float(0.08), float(0.4), heat));
    const col = mix(c1, vec3(1.55, 1.0, 0.38), smoothstep(float(0.45), float(0.85), heat));
    const a = pow(dens, float(0.85)).mul(smoothstep(float(0), float(0.1), vAge)).mul(smoothstep(float(0.7), float(1), vAge).oneMinus()).mul(vEnv);
    mat.colorNode = vec4(col.mul(a), a.mul(0.5));
    group.add(finishMesh(fl.geo, mat, nFire * FLAMES, 'fire_flames', 21));
  }

  // ---------------------------------------------------------------- tàn lửa
  const em = makeInstanced(nFire * EMBERS, EMBERS, 23);
  {
    const c = attribute('aCenter', 'vec4') as unknown as Node<'vec4'>;
    const tm = attribute('aTime', 'vec4') as unknown as Node<'vec4'>;
    const sc = c.w;
    const s = tm.z;
    const s2 = fract(s.mul(5.71));
    const s3 = fract(s.mul(11.3));
    const period = s2.mul(1.3).add(1.5);
    const age = fract(uT.sub(tm.x).div(period).add(s));
    const birth = uT.sub(age.mul(period));
    const alive = step(tm.x, birth).mul(step(birth, tm.y));
    const ang = s.mul(40).add(uT.mul(s3.mul(2).add(1.2)));
    const rad = age.mul(0.5).add(0.15).mul(sc);
    const C = c.xyz.add(vec3(sin(ang).mul(rad), age.mul(s3.mul(4).add(3)).mul(sc).add(0.4), sin(ang.add(1.57)).mul(rad))).add(vec3(uWind.x, 0, uWind.z).mul(age.mul(1.2).mul(sc))) as unknown as V3;
    const size = float(0.05).add(s2.mul(0.035)).mul(age.mul(0.6).oneMinus()).mul(alive);
    const P = uprightQuad(C, size as unknown as F, size as unknown as F);
    const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending });
    mat.fog = false;
    mat.vertexNode = cameraProjectionMatrix.mul(cameraViewMatrix.mul(vec4(P, 1)));
    const vAge = varying(age);
    const vSeed = varying(s);
    const r = length(uv().sub(0.5)).mul(2);
    const dotA = smoothstep(float(0.25), float(1), r).oneMinus();
    const tw = sin(uT.mul(17).add(vSeed.mul(50))).mul(0.3).add(0.7);
    mat.colorNode = vec4(vec3(1.0, 0.42, 0.08).mul(2.2), dotA.mul(vAge.oneMinus()).mul(tw));
    group.add(finishMesh(em.geo, mat, nFire * EMBERS, 'fire_embers', 22));
  }

  // ---------------------------------------------------------------- quầng sáng đất
  const gl = makeInstanced(nFire, 1, 37);
  {
    const c = attribute('aCenter', 'vec4') as unknown as Node<'vec4'>;
    const tm = attribute('aTime', 'vec4') as unknown as Node<'vec4'>;
    const sc = c.w;
    const on = step(tm.x, uT).mul(step(uT, tm.y));
    const env = smoothstep(tm.x, tm.x.add(0.7), uT).mul(smoothstep(tm.y.sub(4), tm.y, uT).oneMinus());
    const size = sc.mul(3.4).mul(on);
    const P = c.xyz.add(vec3(positionLocal.x.mul(size), 0.08, positionLocal.y.mul(size)));
    const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending });
    mat.fog = false;
    mat.vertexNode = cameraProjectionMatrix.mul(cameraViewMatrix.mul(vec4(P, 1)));
    const vEnv = varying(env);
    const vSeed = varying(tm.z);
    const r = length(uv().sub(0.5)).mul(2);
    const fall = pow(smoothstep(float(0), float(1), r).oneMinus(), float(2));
    const fl2 = sin(uT.mul(9).add(vSeed.mul(20))).mul(0.12).add(sin(uT.mul(23).add(vSeed.mul(7))).mul(0.06)).add(0.82);
    mat.colorNode = vec4(vec3(1.0, 0.3, 0.05).mul(0.9), fall.mul(vEnv).mul(fl2).mul(0.5));
    group.add(finishMesh(gl.geo, mat, nFire, 'fire_glow', 19));
  }

  // ---------------------------------------------------------------- khói
  const sm = makeInstanced(nSmoke * SMOKE_P, SMOKE_P, 51);
  const smLook = new InstancedBufferAttribute(new Float32Array(nSmoke * SMOKE_P * 4), 4);
  smLook.setUsage(35048);
  sm.geo.setAttribute('aLook', smLook);
  {
    const c = attribute('aCenter', 'vec4') as unknown as Node<'vec4'>;
    const tm = attribute('aTime', 'vec4') as unknown as Node<'vec4'>;
    const look = attribute('aLook', 'vec4') as unknown as Node<'vec4'>;
    const sc = c.w;
    const s = tm.z;
    // khói dầu (gốc tối) dày hơn, cột cao hơn
    const black = smoothstep(float(0.06), float(0.2), look.r.add(look.g).add(look.b).div(3)).oneMinus();
    const s2 = fract(s.mul(7.77));
    const s3 = fract(s.mul(3.91));
    const s4 = fract(s.mul(19.3));
    const life = s2.mul(4).add(7);
    const age = fract(uT.sub(tm.x).div(life).add(s));
    const birth = uT.sub(age.mul(life));
    const alive = step(tm.x, birth).mul(step(birth, tm.y));
    const H = max(tm.w, mix(float(11), float(19), black).mul(sc).mul(step(tm.w, float(0.01))));
    const ring = vec3(s3.sub(0.5), 0, s4.sub(0.5)).mul(sc.mul(3.2));
    const drift = vec3(uWind.x, 0, uWind.z).mul(pow(age, float(1.5)).mul(sc).mul(7));
    const wob = vec3(sin(uT.mul(0.6).add(s.mul(9))), 0, sin(uT.mul(0.5).add(s.mul(13)))).mul(age.mul(0.8).mul(sc));
    const C = c.xyz.add(ring).add(vec3(0, pow(age, float(0.8)).mul(H).add(sc.mul(0.6)), 0)).add(drift).add(wob) as unknown as V3;
    const size = mix(float(1.6), float(7.5), pow(age, float(0.6))).mul(sc).mul(s3.mul(0.6).add(0.7)).mul(alive);
    // khói quay về camera (cả trục dọc): quad trong view space
    const viewC = cameraViewMatrix.mul(vec4(C, 1));
    const rot = s.mul(6.28).add(uT.mul(0.12).mul(s4.sub(0.5)));
    const cr = sin(rot.add(1.5708));
    const sr = sin(rot);
    const lx = positionLocal.x.mul(cr).sub(positionLocal.y.mul(sr)).mul(size);
    const ly = positionLocal.x.mul(sr).add(positionLocal.y.mul(cr)).mul(size);
    const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide, blending: NormalBlending });
    mat.fog = false;
    mat.vertexNode = cameraProjectionMatrix.mul(vec4(viewC.xyz.add(vec3(lx, ly, 0)), 1));
    const vAge = varying(age);
    const vSeed = varying(s);
    const vBlack = varying(black);
    const vLook = varying(look);
    const vDist = varying(viewC.z.negate());
    const q = uv().sub(0.5);
    const r = length(q).mul(2);
    const n = mx_noise_float(vec3(q.mul(2.2), vSeed.mul(10).add(uT.mul(0.12)))).mul(0.5).add(0.5);
    const blob = smoothstep(float(0.15), float(1), r.add(n.sub(0.5).mul(0.5))).oneMinus();
    const fadeIn = smoothstep(float(0), float(0.08), vAge);
    const fadeOut = smoothstep(float(0.55), float(1), vAge).oneMinus();
    const near = smoothstep(float(1.5), float(7), vDist);
    const thick = mix(float(0.3), float(0.62), vBlack);
    const alpha = blob.mul(fadeIn).mul(fadeOut).mul(near).mul(thick);
    // khói đen dầu: đáy đen nâu, lên cao loãng xám; khói xám cây cháy: sáng hơn
    const lo = vLook.rgb;
    const hi = lo.add(vec3(0.4, 0.38, 0.36).mul(vLook.a));
    const lit = mix(lo, hi, smoothstep(float(0), float(0.9), vAge)).mul(n.mul(0.25).add(0.85));
    mat.colorNode = vec4(lit, alpha);
    group.add(finishMesh(sm.geo, mat, nSmoke * SMOKE_P, 'fire_smoke', 20));
  }

  // ---------------------------------------------------------------- đèn
  const lights: PointLight[] = [];
  const litSlot: number[] = [];
  for (let i = 0; i < nLight; i++) {
    const l = new PointLight(0xff7a1a, 0, 12, 1.8);
    l.position.set(0, -500, 0);
    l.castShadow = false;
    group.add(l);
    lights.push(l);
    litSlot.push(-1);
  }

  const fires: Array<{ p: [number, number, number]; start: number; end: number; scale: number }> = [];
  for (let i = 0; i < nFire; i++) fires.push({ p: [0, -500, 0], start: -1e6, end: -1e6, scale: 0 });
  const stats = { activeFires: 0, activeSmokes: 0, litFires: 0 };
  const smokeEnd = new Float64Array(nSmoke).fill(-1e6);

  const writeSlot = (geoAttr: { center: InstancedBufferAttribute; time: InstancedBufferAttribute }, slot: number, per: number, p: readonly number[], start: number, end: number, scale: number, extra: number): void => {
    const ca = geoAttr.center.array as Float32Array;
    const ta = geoAttr.time.array as Float32Array;
    for (let k = 0; k < per; k++) {
      const i = slot * per + k;
      ca[i * 4] = p[0]!;
      ca[i * 4 + 1] = p[1]!;
      ca[i * 4 + 2] = p[2]!;
      ca[i * 4 + 3] = scale;
      ta[i * 4] = start;
      ta[i * 4 + 1] = end;
      ta[i * 4 + 3] = extra;
    }
    geoAttr.center.clearUpdateRanges();
    geoAttr.center.addUpdateRange(slot * per * 4, per * 4);
    geoAttr.center.needsUpdate = true;
    geoAttr.time.clearUpdateRanges();
    geoAttr.time.addUpdateRange(slot * per * 4, per * 4);
    geoAttr.time.needsUpdate = true;
  };
  const _c = new Vector3();

  return {
    group,
    lights,
    fireCount: nFire,
    smokeCount: nSmoke,
    stats,
    setFire(slot, p, start, end, scale) {
      if (slot < 0 || slot >= nFire) return;
      writeSlot(fl, slot, FLAMES, p, start, end, scale, 0);
      writeSlot(em, slot, EMBERS, p, start, end, scale, 0);
      writeSlot(gl, slot, 1, p, start, end, scale, 0);
      const f = fires[slot]!;
      f.p = [p[0], p[1], p[2]];
      f.start = start;
      f.end = end;
      f.scale = scale;
    },
    setSmoke(slot, p, start, end, scale, look) {
      if (slot < 0 || slot >= nSmoke) return;
      // khói còn bay sau khi tắt nguồn (hạt cuối sống tới 11 s)
      writeSlot(sm, slot, SMOKE_P, p, start, end, scale, look.height ?? 0);
      const la = smLook.array as Float32Array;
      for (let k = 0; k < SMOKE_P; k++) {
        const i = (slot * SMOKE_P + k) * 4;
        la[i] = look.color[0];
        la[i + 1] = look.color[1];
        la[i + 2] = look.color[2];
        la[i + 3] = look.lit;
      }
      smLook.clearUpdateRanges();
      smLook.addUpdateRange(slot * SMOKE_P * 4, SMOKE_P * 4);
      smLook.needsUpdate = true;
      smokeEnd[slot] = end + 11;
    },
    update(now, cam) {
      uT.value = now;
      // đèn: các đám đang cháy gần camera nhất (đèn luôn trong scene, đám không có đèn chỉ tắt cường độ — số đèn không đổi)
      stats.activeFires = 0;
      const cand: Array<{ i: number; d: number }> = [];
      for (let i = 0; i < nFire; i++) {
        const f = fires[i]!;
        if (now < f.start || now > f.end) continue;
        stats.activeFires++;
        _c.set(f.p[0], f.p[1], f.p[2]);
        cand.push({ i, d: cam ? _c.distanceToSquared(cam) : i });
      }
      cand.sort((a, b) => a.d - b.d);
      stats.litFires = Math.min(nLight, cand.length);
      for (let k = 0; k < nLight; k++) {
        const l = lights[k]!;
        const c = cand[k];
        if (!c) {
          l.intensity = 0;
          l.position.set(0, -500, 0);
          litSlot[k] = -1;
          continue;
        }
        const f = fires[c.i]!;
        const env = Math.min(1, (now - f.start) / 0.7) * Math.min(1, Math.max(0, (f.end - now) / 4));
        const fl1 = Math.sin(now * 11.3 + c.i) * 0.5 + 0.5;
        const fl2 = Math.sin(now * 27.7 + c.i * 2.1) * 0.5 + 0.5;
        l.position.set(f.p[0], f.p[1] + 1.1 * f.scale, f.p[2]);
        l.distance = 11 * f.scale;
        l.intensity = 16 * f.scale * f.scale * env * (0.7 + 0.2 * fl1 + 0.15 * fl2);
        litSlot[k] = c.i;
      }
      let sa = 0;
      for (let i = 0; i < nSmoke; i++) if (now < smokeEnd[i]!) sa++;
      stats.activeSmokes = sa;
    },
  };
}
