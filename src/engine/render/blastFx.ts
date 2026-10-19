/**
 * DV-087 vụ nổ chiến trường (lựu đạn, cối, pháo, bom, napalm) — thay chớp + vài búi khói của WeaponFx.explosion bằng hạt có khối,
 * tính giải tích trong shader theo tuổi của vụ nổ (không cập nhật hạt trên CPU):
 *  - cầu lửa: 12 hạt bung ra trong 0,15 s, trắng vàng → cam → đỏ sẫm rồi hoá khói đen cuộn lên (napalm: to, lâu, cam đậm);
 *  - đất đá văng: 24 cục đất bay theo đường đạn đạo (trọng lực), rơi xuống mặt đất thì tắt;
 *  - bụi đất (một mesh, ba vai theo chỉ số hạt): cột đất phụt thẳng lên rồi toả ra, vòng bụi sát mặt đất lan ra như sóng
 *    xung kích, đám bụi lơ lửng trôi theo gió 12–16 s (để lại màn khói bụi chiến trường).
 * 3 InstancedMesh cho mọi vụ nổ cùng lúc (3 draw call); ô chưa dùng co về 0. Hash theo chỉ số (không Math.random). TSL only.
 */
import { InstancedMesh, PlaneGeometry, MeshBasicNodeMaterial, Group, Matrix4, Vector2, NormalBlending, DoubleSide, InstancedBufferAttribute, CustomBlending, AddEquation, OneFactor, OneMinusSrcAlphaFactor, type Node } from 'three/webgpu';
import { float, vec3, vec4, uniform, uv, mix, smoothstep, sin, cos, exp, mx_noise_float, attribute, cameraProjectionMatrix, cameraViewMatrix, length, fract, pow, step, varying, max, min, positionLocal } from 'three/tsl';

export interface BlastFxOptions {
  /** số vụ nổ cùng lúc tối đa */
  blasts?: number;
}

export type BlastKind = 'dirt' | 'napalm';

export interface BlastFx {
  readonly group: Group;
  /** vụ nổ tại `p` (mặt đất), bán kính sát thương `radius` (m) → cỡ hình */
  spawn(p: readonly [number, number, number], radius: number, kind?: BlastKind): void;
  /**
   * DV-088 mưa đất: vụ nổ sát người → đất cát rơi lộp độp quanh người chơi trong ~2 s (sau khi cột đất lên tới đỉnh).
   * `feet` = chân người chơi (mặt đất), `k` 0..1 theo độ gần.
   */
  rain(feet: readonly [number, number, number], k: number): void;
  /**
   * DV-090 đất đá văng thẳng về phía người xem: vụ nổ gần trước mặt → 18 cục đất bay vụt qua sát mặt/hai bên trong ~0,4 s
   * (trước khi bùn bám kính). `p` tâm nổ, `eye` mắt người chơi, `k` 0..1.
   */
  spray(p: readonly [number, number, number], eye: readonly [number, number, number], k: number): void;
  /** mỗi frame: dt (s) */
  update(dt: number): void;
  /**
   * DV-089 màn trập hẹp kiểu phim chiến tranh: > 0 thì hạt nổ/đất/bụi chuyển động theo nhịp `staccato` khung/giây (24 = phim),
   * giật cục sắc nét trong khi máy (người chơi) vẫn mượt 60 khung. 0 = mượt.
   */
  staccato: number;
  /** độ sáng của bụi/khói (1 ngày nắng · ~0,15 đêm) */
  readonly light: { value: number };
  /** hướng gió (x, z) — Game gán chung uniform gió của rừng */
  readonly wind: { value: Vector2 };
  readonly stats: { spawned: number; active: number; rains: number; sprays: number };
}

const FIREBALL = 16;
const DEBRIS = 24;
const DUST = 34; // 10 cột + 14 vòng + 10 đám lơ lửng
/** DV-088 hạt mưa đất mỗi lần, số lần cùng lúc */
const RAIN = 96;
const RAINS = 4;
/** DV-090 cục đất vụt qua mặt mỗi lần, số lần cùng lúc */
const SPRAY = 18;
const SPRAYS = 4;
const COLUMN = 10;
const RING = 14;
/** sống lâu nhất của một vụ nổ (s) — đám bụi lơ lửng */
const MAX_LIFE = 16;

type F = Node<'float'>;
type V3 = Node<'vec3'>;

function h1(i: number, k: number): number {
  let x = (i * 374761393 + k * 668265263) >>> 0;
  x = (x ^ (x >>> 13)) >>> 0;
  x = Math.imul(x, 1274126177) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** bảng instance: aCenter (x, y, z, cỡ R) · aTime (bắt đầu, hạt giống, loại 0 đất / 1 napalm, chỉ số hạt trong vụ) */
function makeInstanced(blasts: number, per: number, seedKey: number): { geo: PlaneGeometry; center: InstancedBufferAttribute; time: InstancedBufferAttribute } {
  const geo = new PlaneGeometry(1, 1);
  const n = blasts * per;
  const center = new InstancedBufferAttribute(new Float32Array(n * 4), 4);
  const time = new InstancedBufferAttribute(new Float32Array(n * 4), 4);
  center.setUsage(35048);
  time.setUsage(35048);
  const t = time.array as Float32Array;
  for (let i = 0; i < n; i++) {
    t[i * 4] = -1e6;
    t[i * 4 + 1] = h1(i, seedKey);
    t[i * 4 + 2] = 0;
    t[i * 4 + 3] = i % per;
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

/** quad quay về camera (view space), xoay `rot`, cỡ `size` */
function billboard(C: V3, size: F, rot: F): Node<'vec4'> {
  const viewC = cameraViewMatrix.mul(vec4(C, 1));
  const c = cos(rot);
  const s = sin(rot);
  const lx = positionLocal.x.mul(c).sub(positionLocal.y.mul(s)).mul(size);
  const ly = positionLocal.x.mul(s).add(positionLocal.y.mul(c)).mul(size);
  return cameraProjectionMatrix.mul(vec4(viewC.xyz.add(vec3(lx, ly, 0)), 1));
}

/** đám mờ có mép bị nhiễu gặm (uv quad), hạt giống `seed`, thời gian `t` */
function puff(seed: F, t: F, edge: number): F {
  const q = uv().sub(0.5);
  const r = length(q).mul(2);
  // hai tầng nhiễu: khối cuộn to + mép vụn — không thành quả cầu mờ
  const n1 = mx_noise_float(vec3(q.mul(2.4), seed.mul(17).add(t.mul(0.35)))).mul(0.5).add(0.5);
  const n2 = mx_noise_float(vec3(q.mul(6.2).add(3.1), seed.mul(29).add(t.mul(0.6)))).mul(0.5).add(0.5);
  const n = n1.mul(0.65).add(n2.mul(0.35));
  return smoothstep(float(edge), float(0.85), r.add(n.sub(0.5).mul(0.95))).oneMinus().mul(n.mul(0.5).add(0.6)).min(1) as unknown as F;
}

export function createBlastFx(opts: BlastFxOptions = {}): BlastFx {
  const nB = opts.blasts ?? 16;
  const group = new Group();
  group.name = 'blast_fx';
  const uT = uniform(0);
  const uLight = uniform(1);
  const uWind = uniform(new Vector2(0.8, 0.6));

  // ---------------------------------------------------------------- cầu lửa → khói đen
  const fb = makeInstanced(nB, FIREBALL, 7);
  {
    const c = attribute('aCenter', 'vec4') as unknown as Node<'vec4'>;
    const tm = attribute('aTime', 'vec4') as unknown as Node<'vec4'>;
    const R = c.w;
    const s = tm.y;
    const nap = tm.z;
    const s2 = fract(s.mul(7.31));
    const s3 = fract(s.mul(13.7));
    const s4 = fract(s.mul(3.17));
    const t = uT.sub(tm.x);
    const life = mix(float(2.6), float(4.2), nap);
    const on = step(float(0), t).mul(step(t, life));
    // hướng bung: nửa cầu trên, dồn lên trên
    const th = s2.mul(6.2832);
    const up = s3.mul(0.75).add(0.25);
    const hr = up.mul(up).oneMinus().sqrt();
    const dir = vec3(cos(th).mul(hr), up, sin(th).mul(hr));
    const burst = float(1).sub(exp(t.mul(-9))).mul(R).mul(mix(float(0.42), float(0.7), nap)).mul(s4.mul(0.6).add(0.4));
    // khói nóng bốc lên sau khi bung
    const rise = max(t.sub(0.25), float(0)).mul(R).mul(0.38);
    const C = c.xyz.add(dir.mul(burst)).add(vec3(0, rise.add(R.mul(0.12)), 0)).add(vec3(uWind.x, 0, uWind.y).mul(t.mul(t).mul(0.12))) as unknown as V3;
    const grow = float(1).sub(exp(t.mul(-6)));
    const size = R.mul(s3.mul(0.32).add(0.3)).mul(grow.mul(0.75).add(0.25)).mul(t.div(life).mul(0.9).add(1)).mul(mix(float(1), float(1.5), nap)).mul(on);
    const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide });
    mat.blending = CustomBlending;
    mat.blendEquation = AddEquation;
    mat.blendSrc = OneFactor;
    mat.blendDst = OneMinusSrcAlphaFactor;
    mat.blendSrcAlpha = OneFactor;
    mat.blendDstAlpha = OneMinusSrcAlphaFactor;
    mat.fog = false;
    mat.vertexNode = billboard(C, size as unknown as F, s.mul(6.28).add(t.mul(s2.sub(0.5))) as unknown as F);
    const vT = varying(t);
    const vS = varying(s);
    const vNap = varying(nap);
    const vLife = varying(life);
    const shape = puff(vS as unknown as F, vT as unknown as F, 0.2);
    // nhiệt: 1 lúc nổ → 0 sau ~0,7 s (napalm ~1,6 s), mép nguội trước tâm
    const q = uv().sub(0.5);
    const rr = length(q).mul(2);
    const cool = mix(float(0.7), float(1.6), vNap);
    const heat = smoothstep(float(0), cool, vT).oneMinus().mul(rr.mul(0.6).oneMinus().max(0)).mul(shape);
    const fireCol = mix(vec3(0.9, 0.18, 0.02), mix(vec3(2.2, 0.9, 0.18), vec3(3.2, 2.6, 1.6), smoothstep(float(0.55), float(0.95), heat)), smoothstep(float(0.08), float(0.5), heat));
    const smokeCol = mix(vec3(0.04, 0.035, 0.03), vec3(0.12, 0.1, 0.085), smoothstep(float(0.5), vLife, vT)).mul(uLight.mul(0.8).add(0.2));
    const fade = smoothstep(vLife.mul(0.45), vLife, vT).oneMinus();
    const smokeA = shape.mul(fade).mul(0.85);
    const glow = smoothstep(float(0.02), float(0.25), heat);
    const rgb = fireCol.mul(heat.mul(1.4)).add(smokeCol.mul(smokeA).mul(glow.oneMinus()));
    const a = smokeA.mul(glow.mul(0.6).oneMinus());
    mat.colorNode = vec4(rgb, a);
    group.add(finishMesh(fb.geo, mat, nB * FIREBALL, 'blast_fireball', 23));
  }

  // ---------------------------------------------------------------- đất đá văng (đạn đạo)
  const db = makeInstanced(nB, DEBRIS, 19);
  {
    const c = attribute('aCenter', 'vec4') as unknown as Node<'vec4'>;
    const tm = attribute('aTime', 'vec4') as unknown as Node<'vec4'>;
    const R = c.w;
    const s = tm.y;
    const s2 = fract(s.mul(5.71));
    const s3 = fract(s.mul(11.3));
    const s4 = fract(s.mul(2.93));
    const t = uT.sub(tm.x);
    const th = s2.mul(6.2832);
    const elev = s3.mul(0.9).add(0.55); // 30°–85° so với mặt đất
    const sp = s4.mul(0.9).add(0.6).mul(R.sqrt()).mul(4.2);
    const vx = cos(th).mul(cos(elev)).mul(sp);
    const vz = sin(th).mul(cos(elev)).mul(sp);
    const vy = sin(elev).mul(sp);
    const y = vy.mul(t).sub(t.mul(t).mul(4.9));
    const C = c.xyz.add(vec3(vx.mul(t), y.add(0.2), vz.mul(t))) as unknown as V3;
    // tắt khi rơi chạm đất (đi xuống và thấp hơn tâm)
    const landed = step(y, float(0)).mul(step(float(0.15), t));
    const on = step(float(0), t).mul(step(t, float(4))).mul(landed.oneMinus());
    const size = R.mul(0.035).add(0.05).mul(s3.mul(0.9).add(0.4)).mul(on);
    const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide, blending: NormalBlending });
    mat.fog = false; // vertexNode riêng: sương của three tính theo vị trí gốc của quad (sai), nên tắt
    mat.vertexNode = billboard(C, size as unknown as F, t.mul(s2.sub(0.5).mul(14)) as unknown as F);
    const vS = varying(s);
    const q = uv().sub(0.5);
    const n = mx_noise_float(vec3(q.mul(5), vS.mul(31))).mul(0.5).add(0.5);
    const clod = smoothstep(float(0.55), float(0.85), length(q).mul(2).add(n.sub(0.5).mul(0.8))).oneMinus();
    const col = vec3(0.075, 0.05, 0.035).mul(n.mul(0.6).add(0.7)).mul(uLight.mul(0.8).add(0.2));
    mat.colorNode = vec4(col, clod);
    group.add(finishMesh(db.geo, mat, nB * DEBRIS, 'blast_debris', 22));
  }

  // ---------------------------------------------------------------- bụi đất: cột, vòng sát đất, đám lơ lửng
  const du = makeInstanced(nB, DUST, 31);
  {
    const c = attribute('aCenter', 'vec4') as unknown as Node<'vec4'>;
    const tm = attribute('aTime', 'vec4') as unknown as Node<'vec4'>;
    const R = c.w;
    const s = tm.y;
    const nap = tm.z;
    const k = tm.w;
    const s2 = fract(s.mul(6.13));
    const s3 = fract(s.mul(17.1));
    const s4 = fract(s.mul(4.37));
    const t = uT.sub(tm.x);
    const isCol = step(k, float(COLUMN - 0.5));
    const isRing = step(float(COLUMN - 0.5), k).mul(step(k, float(COLUMN + RING - 0.5)));
    const isCloud = isCol.add(isRing).oneMinus();
    const wind = vec3(uWind.x, 0, uWind.y);
    const th = s2.mul(6.2832);
    // cột đất: phụt lên (cản không khí), toả nhẹ, rơi bụi
    const vUp = s3.mul(8).add(7).mul(R.sqrt()).mul(0.55);
    const kd = float(1.7);
    const yCol = vUp.div(kd).mul(float(1).sub(exp(t.mul(kd).negate()))).sub(t.mul(t).mul(0.35));
    const spread = R.mul(0.25).mul(s4).mul(float(1).sub(exp(t.mul(-2))));
    const PCol = vec3(cos(th).mul(spread), yCol.max(0), sin(th).mul(spread)).add(wind.mul(t.mul(0.5)));
    const sizeCol = R.mul(mix(float(0.22), float(0.85), float(1).sub(exp(t.mul(-0.9))))).mul(s4.mul(0.5).add(0.75));
    const aCol = smoothstep(float(0), float(0.08), t).mul(smoothstep(float(1.8), float(5.5), t).oneMinus()).mul(0.75);
    // vòng bụi sát đất: lan ra rất nhanh rồi chậm lại
    const ang = k.sub(COLUMN).div(RING).mul(6.2832).add(s2.mul(0.4));
    const rr = R.mul(1.9).mul(float(1).sub(exp(t.mul(-3.2)))).mul(s3.mul(0.35).add(0.8));
    const PRing = vec3(cos(ang).mul(rr), R.mul(0.08).add(t.mul(0.25)), sin(ang).mul(rr)).add(wind.mul(t.mul(0.6)));
    const sizeRing = R.mul(mix(float(0.25), float(0.9), float(1).sub(exp(t.mul(-1.4))))).mul(s4.mul(0.5).add(0.75));
    const aRing = smoothstep(float(0), float(0.05), t).mul(smoothstep(float(1.5), float(7), t).oneMinus()).mul(0.75);
    // đám bụi/khói lơ lửng: hiện sau ~0,5 s, nở to, trôi theo gió, tan sau 12–16 s
    const cr = R.mul(1.2).mul(s3.add(0.25));
    const PCloud = vec3(cos(th).mul(cr), R.mul(0.35).add(t.mul(0.22)), sin(th).mul(cr)).add(wind.mul(t.mul(0.75)));
    const sizeCloud = R.mul(mix(float(0.9), float(2.6), pow(min(t.div(14), float(1)), float(0.6)))).mul(s4.mul(0.4).add(0.8));
    const aCloud = smoothstep(float(0.4), float(2.5), t).mul(smoothstep(float(8), float(MAX_LIFE), t).oneMinus()).mul(0.5);
    const P = PCol.mul(isCol).add(PRing.mul(isRing)).add(PCloud.mul(isCloud));
    const on = step(float(0), t).mul(step(t, float(MAX_LIFE)));
    const size = sizeCol.mul(isCol).add(sizeRing.mul(isRing)).add(sizeCloud.mul(isCloud)).mul(on).mul(mix(float(1), float(0.7), nap));
    const alpha = aCol.mul(isCol).add(aRing.mul(isRing)).add(aCloud.mul(isCloud));
    const C = c.xyz.add(P) as unknown as V3;
    const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide, blending: NormalBlending });
    mat.fog = false; // vertexNode riêng: sương của three tính theo vị trí gốc của quad (sai), nên tắt
    mat.vertexNode = billboard(C, size as unknown as F, s.mul(6.28).add(t.mul(s2.sub(0.5).mul(0.25))) as unknown as F);
    const vS = varying(s);
    const vT = varying(t);
    const vA = varying(alpha);
    const vCloud = varying(isCloud);
    const vNap = varying(nap);
    const vDist = varying(cameraViewMatrix.mul(vec4(C, 1)).z.negate());
    const shape = puff(vS as unknown as F, vT as unknown as F, 0.15);
    // đất đỏ bazan → bụi xám nâu khi loãng; napalm để lại khói xám tối
    const earth = mix(vec3(0.3, 0.17, 0.1), vec3(0.36, 0.31, 0.26), vCloud);
    const col = mix(earth, vec3(0.14, 0.13, 0.12), vNap).mul(uLight.mul(0.85).add(0.15));
    const near = smoothstep(float(1.2), float(6), vDist);
    mat.colorNode = vec4(col, shape.mul(vA).mul(near));
    group.add(finishMesh(du.geo, mat, nB * DUST, 'blast_dust', 21));
  }

  // ---------------------------------------------------------------- DV-088 mưa đất quanh người chơi
  const rn = makeInstanced(RAINS, RAIN, 43);
  {
    const c = attribute('aCenter', 'vec4') as unknown as Node<'vec4'>;
    const tm = attribute('aTime', 'vec4') as unknown as Node<'vec4'>;
    const K = c.w;
    const s = tm.y;
    const s2 = fract(s.mul(7.77));
    const s3 = fract(s.mul(15.3));
    const s4 = fract(s.mul(3.91));
    // rơi lệch nhau 0,35–2,2 s sau vụ nổ (cục to rơi trước, bụi mịn sau), từ độ cao 3–9 m, quanh người 0,6–6 m
    const delay = s3.mul(1.85).add(0.35);
    const t = uT.sub(tm.x).sub(delay);
    const th = s2.mul(6.2832);
    const rad = s4.mul(s4).mul(5.4).add(0.6);
    const y0 = s.mul(6).add(3);
    const y = y0.sub(t.mul(t).mul(4.9));
    const wind = vec3(uWind.x, 0, uWind.y).mul(t.mul(0.35));
    const C = c.xyz.add(vec3(cos(th).mul(rad), y, sin(th).mul(rad))).add(wind) as unknown as V3;
    const on = step(float(0), t).mul(step(float(0), y)).mul(step(s.mul(0.999), K));
    // phần lớn hạt cát nhỏ, ~1/6 là cục đất bằng đầu ngón tay
    const clod = step(float(0.83), s2);
    const size = mix(float(0.02).add(s4.mul(0.035)), float(0.07).add(s4.mul(0.06)), clod).mul(on);
    const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide, blending: NormalBlending });
    mat.fog = false;
    mat.vertexNode = billboard(C, size as unknown as F, t.mul(s2.sub(0.5).mul(10)) as unknown as F);
    const vS = varying(s);
    const vDist = varying(cameraViewMatrix.mul(vec4(C, 1)).z.negate());
    const q = uv().sub(0.5);
    const n = mx_noise_float(vec3(q.mul(4), vS.mul(23))).mul(0.5).add(0.5);
    const grain = smoothstep(float(0.5), float(0.9), length(q).mul(2).add(n.sub(0.5).mul(0.7))).oneMinus();
    const col = vec3(0.09, 0.06, 0.04).mul(n.mul(0.5).add(0.75)).mul(uLight.mul(0.8).add(0.2));
    mat.colorNode = vec4(col, grain.mul(smoothstep(float(0.12), float(0.5), vDist)).mul(0.95));
    group.add(finishMesh(rn.geo, mat, RAINS * RAIN, 'blast_rain', 24));
  }
  let rainHead = 0;

  // ---------------------------------------------------------------- DV-090 đất đá vụt qua mặt
  const sp = makeInstanced(SPRAYS, SPRAY, 57);
  const spTarget = new InstancedBufferAttribute(new Float32Array(SPRAYS * SPRAY * 4), 4);
  spTarget.setUsage(35048);
  sp.geo.setAttribute('aTarget', spTarget);
  {
    const c = attribute('aCenter', 'vec4') as unknown as Node<'vec4'>;
    const tm = attribute('aTime', 'vec4') as unknown as Node<'vec4'>;
    const tg = attribute('aTarget', 'vec4') as unknown as Node<'vec4'>;
    const K = c.w;
    const s = tm.y;
    const s2 = fract(s.mul(5.13));
    const s3 = fract(s.mul(9.71));
    const s4 = fract(s.mul(2.37));
    const delay = s3.mul(0.12).add(0.02);
    const t = uT.sub(tm.x).sub(delay);
    // hướng: từ tâm nổ (nâng 0,3 m) tới điểm lệch quanh mắt (±1,6 m ngang, −0,6..+1,4 m dọc), bay vượt qua thêm 40 %
    const from = c.xyz.add(vec3(0, 0.3, 0));
    const fwd = tg.xyz.sub(from);
    const L = length(fwd).max(0.5);
    const dir = fwd.div(L);
    const side = vec3(dir.z.negate(), 0, dir.x).normalize();
    const aim = tg.xyz.add(side.mul(s2.sub(0.5).mul(3.2))).add(vec3(0, s4.mul(2).sub(0.6), 0));
    const v = aim.sub(from).normalize().mul(s.mul(10).add(20));
    const C = from.add(v.mul(t)).add(vec3(0, t.mul(t).mul(-4.9), 0)) as unknown as V3;
    const life = L.mul(1.4).div(s.mul(10).add(20));
    const on = step(float(0), t).mul(step(t, life)).mul(step(s.mul(0.999), K));
    const size = mix(float(0.04), float(0.16), s2.mul(s4)).mul(on);
    const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide, blending: NormalBlending });
    mat.fog = false;
    mat.vertexNode = billboard(C, size as unknown as F, t.mul(s2.sub(0.5).mul(24)) as unknown as F);
    const vS = varying(s);
    const vDist = varying(cameraViewMatrix.mul(vec4(C, 1)).z.negate());
    const q = uv().sub(0.5);
    const n = mx_noise_float(vec3(q.mul(5), vS.mul(19))).mul(0.5).add(0.5);
    const clod = smoothstep(float(0.5), float(0.85), length(q).mul(2).add(n.sub(0.5).mul(0.9))).oneMinus();
    const col = vec3(0.08, 0.052, 0.034).mul(n.mul(0.6).add(0.7)).mul(uLight.mul(0.8).add(0.2));
    mat.colorNode = vec4(col, clod.mul(smoothstep(float(0.18), float(0.45), vDist)));
    group.add(finishMesh(sp.geo, mat, SPRAYS * SPRAY, 'blast_spray', 25));
  }
  let sprayHead = 0;

  const starts = new Float64Array(nB).fill(-1e6);
  let head = 0;
  const stats = { spawned: 0, active: 0, rains: 0, sprays: 0 };
  let now = 0;

  const write = (g: { center: InstancedBufferAttribute; time: InstancedBufferAttribute }, slot: number, per: number, p: readonly number[], R: number, kind: number): void => {
    const ca = g.center.array as Float32Array;
    const ta = g.time.array as Float32Array;
    for (let k = 0; k < per; k++) {
      const i = slot * per + k;
      ca[i * 4] = p[0]!;
      ca[i * 4 + 1] = p[1]!;
      ca[i * 4 + 2] = p[2]!;
      ca[i * 4 + 3] = R;
      ta[i * 4] = now;
      // hạt giống đổi theo lần nổ (cùng ô nổ lại không y hệt)
      ta[i * 4 + 1] = h1(i, stats.spawned + 101);
      ta[i * 4 + 2] = kind;
    }
    g.center.clearUpdateRanges();
    g.center.addUpdateRange(slot * per * 4, per * 4);
    g.center.needsUpdate = true;
    g.time.clearUpdateRanges();
    g.time.addUpdateRange(slot * per * 4, per * 4);
    g.time.needsUpdate = true;
  };

  return {
    group,
    light: uLight as unknown as { value: number },
    wind: uWind as unknown as { value: Vector2 },
    stats,
    spawn(p, radius, kind = 'dirt') {
      // ô rảnh lâu nhất (vòng tròn): vụ nổ cũ nhất nhường chỗ
      const slot = head;
      head = (head + 1) % nB;
      const R = Math.max(2.2, Math.min(10, radius * 0.6));
      const k = kind === 'napalm' ? 1 : 0;
      write(fb, slot, FIREBALL, p, R, k);
      write(db, slot, DEBRIS, p, R, k);
      write(du, slot, DUST, p, R, k);
      starts[slot] = now;
      stats.spawned++;
    },
    rain(feet, k) {
      const slot = rainHead;
      rainHead = (rainHead + 1) % RAINS;
      // aCenter.w = tỉ lệ hạt bật (k thấp → ít hạt), so với hạt giống trong shader
      write(rn, slot, RAIN, feet, Math.max(0.2, Math.min(1, k)), 0);
      stats.rains++;
    },
    staccato: 0,
    spray(p, eye, k) {
      const slot = sprayHead;
      sprayHead = (sprayHead + 1) % SPRAYS;
      write(sp, slot, SPRAY, p, Math.max(0.3, Math.min(1, k)), 0);
      const ta = spTarget.array as Float32Array;
      for (let j = 0; j < SPRAY; j++) {
        const i = slot * SPRAY + j;
        ta[i * 4] = eye[0];
        ta[i * 4 + 1] = eye[1];
        ta[i * 4 + 2] = eye[2];
        ta[i * 4 + 3] = 0;
      }
      spTarget.clearUpdateRanges();
      spTarget.addUpdateRange(slot * SPRAY * 4, SPRAY * 4);
      spTarget.needsUpdate = true;
      stats.sprays++;
    },
    update(dt) {
      now += dt;
      uT.value = this.staccato > 0 ? Math.floor(now * this.staccato) / this.staccato : now;
      let a = 0;
      for (let i = 0; i < nB; i++) if (now - starts[i]! < MAX_LIFE) a++;
      stats.active = a;
    },
  };
}
