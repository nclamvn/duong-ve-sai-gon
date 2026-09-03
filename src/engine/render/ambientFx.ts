/**
 * FX môi trường (TIP-019/022): cột khói, lửa, tàn lửa, bụi nắng — TSL, instanced billboard, không Math.random (hash theo id).
 * Khói: quad billboard theo camera, nổi lên + gió, to dần, mờ dần; alpha mềm theo độ sâu (soft particle) qua depth không cần —
 * dùng fade theo khoảng cách camera để tránh cắt cứng. Lửa: 3 tấm chéo với noise cuộn + PointLight nhấp nháy (đèn cố định số lượng).
 */
import { InstancedMesh, Mesh, PlaneGeometry, MeshBasicNodeMaterial, Group, PointLight, Matrix4, Vector3, Color, AdditiveBlending, NormalBlending, DoubleSide, InstancedBufferAttribute } from 'three/webgpu';
import { float, vec3, vec4, uniform, time, positionLocal, cameraViewMatrix, modelWorldMatrix, uv, mix, smoothstep, saturate, sin, cos, mx_noise_float, attribute, cameraProjectionMatrix, length } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { FxDef } from '@engine/level/types';

export interface AmbientFx {
  group: Group;
  lights: PointLight[];
  update(dt: number): void;
  stats: { smokeParticles: number; fires: number; embers: number };
}

type V4Node = ReturnType<typeof vec4>;
type V3Node = ReturnType<typeof vec3>;
type FNode = Node<'float'>;

/**
 * Vertex clip-space cho quad billboard instanced: tâm (local của emitter) → world → view, cộng offset quad trong view space
 * (xoay góc a, nhân size) → projection. Không phụ thuộc phần tử ma trận.
 */
function billboardVertex(center: V3Node, size: FNode, angle: FNode): Node<'vec4'> {
  const worldC = modelWorldMatrix.mul(vec4(center, 1.0));
  const viewC = cameraViewMatrix.mul(worldC);
  const ca = cos(angle);
  const sa = sin(angle);
  const lx = positionLocal.x.mul(ca).sub(positionLocal.y.mul(sa)).mul(size);
  const ly = positionLocal.x.mul(sa).add(positionLocal.y.mul(ca)).mul(size);
  const p = viewC.xyz.add(vec3(lx, ly, 0.0));
  return cameraProjectionMatrix.mul(vec4(p, 1.0));
}

/** hash [0,1) từ số nguyên (deterministic, không Math.random) */
function h1(i: number, k: number): number {
  let x = (i * 374761393 + k * 668265263) >>> 0;
  x = (x ^ (x >>> 13)) >>> 0;
  x = Math.imul(x, 1274126177) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** Cột khói: N quad instanced; mỗi instance có seed → pha đời sống lệch nhau; billboard trong vertex shader. */
function makeSmoke(def: FxDef, idx: number): { mesh: InstancedMesh; count: number } {
  const scale = def.scale ?? 1;
  const count = Math.round(90 * scale);
  const geo = new PlaneGeometry(1, 1);
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    seeds[i * 4] = h1(i, idx * 7 + 1); // pha
    seeds[i * 4 + 1] = h1(i, idx * 7 + 2) * 2 - 1; // lệch x
    seeds[i * 4 + 2] = h1(i, idx * 7 + 3) * 2 - 1; // lệch z
    seeds[i * 4 + 3] = h1(i, idx * 7 + 4); // xoay/kích thước
  }
  geo.setAttribute('seed', new InstancedBufferAttribute(seeds, 4));
  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide, blending: NormalBlending });
  mat.fog = false;
  const col = new Color(def.color ?? 0x1a1816);
  const uCol = uniform(new Vector3(col.r, col.g, col.b));
  const uScale = uniform(scale);
  const life = 9.0; // giây một vòng đời
  const seed = attribute('seed', 'vec4') as unknown as V4Node;
  const t = time.mul(1.0 / life).add(seed.x).fract(); // 0..1 tuổi
  const rise = t.mul(uScale.mul(14.0)); // cao tối đa
  // gió: lệch theo x theo tuổi, cuộn nhẹ theo noise
  const wobble = sin(time.mul(0.7).add(seed.w.mul(6.28))).mul(0.6);
  const px = seed.y.mul(uScale.mul(0.9)).add(t.mul(t).mul(uScale.mul(6.0))).add(wobble.mul(t));
  const pz = seed.z.mul(uScale.mul(0.9)).add(t.mul(uScale.mul(1.5)));
  const size = mix(uScale.mul(1.2), uScale.mul(6.5), smoothstep(0.0, 1.0, t)).mul(seed.w.mul(0.5).add(0.75));
  const angle = seed.w.mul(6.28).add(time.mul(0.15).mul(seed.y));
  mat.vertexNode = billboardVertex(vec3(px, rise, pz), size as unknown as FNode, angle as unknown as FNode);
  const uvC = uv().sub(0.5);
  const r = length(uvC).mul(2.0);
  const n = mx_noise_float(vec3(uv().mul(3.0), time.mul(0.25).add(seed.x.mul(10.0)))).mul(0.5).add(0.5);
  const blob = smoothstep(1.0, 0.15, r.add(n.mul(0.55).sub(0.25)));
  const fadeIn = smoothstep(0.0, 0.12, t);
  const fadeOut = smoothstep(1.0, 0.55, t);
  // sáng dần khi lên cao (loãng, ánh nắng lọt vào)
  const lit = mix(uCol, uCol.add(vec3(0.42, 0.4, 0.38)), t.mul(0.8));
  const alpha = blob.mul(fadeIn).mul(fadeOut).mul(0.42);
  mat.colorNode = vec4(lit, alpha);
  const mesh = new InstancedMesh(geo, mat, count);
  const m = new Matrix4();
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, m);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.position.set(def.position[0], def.position[1], def.position[2]);
  mesh.frustumCulled = false;
  mesh.renderOrder = 20;
  mesh.name = `smoke_${idx}`;
  return { mesh, count };
}

/** Lửa: 3 tấm chéo, noise cuộn lên, gradient vàng→cam→đỏ→trong, additive; + đèn nhấp nháy */
function makeFire(def: FxDef, idx: number): { group: Group; light: PointLight; flicker: (t: number) => void } {
  const scale = def.scale ?? 1;
  const g = new Group();
  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending });
  mat.fog = false;
  const u = uv();
  const x = u.x.sub(0.5).mul(2.0); // −1..1
  const y = u.y; // 0 đáy → 1 đỉnh
  const flow = vec3(x.mul(1.4), y.mul(2.6).sub(time.mul(1.7)), float(idx * 3.1));
  const n1 = mx_noise_float(flow).mul(0.5).add(0.5);
  const n2 = mx_noise_float(flow.mul(2.1).add(vec3(5.2, 1.7, 0.0)).sub(vec3(0, time.mul(1.1), 0))).mul(0.5).add(0.5);
  const n = n1.mul(0.65).add(n2.mul(0.35));
  const taper = float(1.0).sub(y.mul(0.8)); // ngọn thon dần
  const edge = float(1.0).sub(x.abs().div(taper.max(0.08))); // 1 ở giữa, 0 ở mép ngọn
  const core = saturate(edge.mul(1.5).sub(0.35).add(n.sub(0.5).mul(1.1)));
  const fade = smoothstep(1.0, 0.25, y).mul(smoothstep(0.0, 0.08, y)); // tắt dần lên cao, không cắt ở đáy
  const heat = saturate(core.mul(fade));
  const colr = mix(vec3(0.85, 0.12, 0.02), vec3(1.0, 0.5, 0.06), smoothstep(0.1, 0.6, heat));
  const col = mix(colr, vec3(1.0, 0.92, 0.55), smoothstep(0.6, 1.0, heat));
  mat.colorNode = vec4(col.mul(heat.mul(1.15)), heat.mul(0.9));
  for (let k = 0; k < 3; k++) {
    const p = new PlaneGeometry(1.15 * scale, 1.9 * scale);
    p.translate(0, 0.95 * scale, 0);
    const m = new Mesh(p, mat);
    m.rotation.y = (k * Math.PI) / 3 + idx * 0.7;
    m.frustumCulled = false;
    m.renderOrder = 21;
    g.add(m);
  }
  const light = new PointLight(0xff7a1a, 14 * scale * scale, 10 * scale, 1.8);
  light.position.set(0, 1.0 * scale, 0);
  light.castShadow = false;
  g.add(light);
  g.position.set(def.position[0], def.position[1], def.position[2]);
  g.name = `fire_${idx}`;
  const base = 14 * scale * scale;
  const flicker = (t: number): void => {
    const f1 = Math.sin(t * 11.3 + idx) * 0.5 + 0.5;
    const f2 = Math.sin(t * 27.7 + idx * 2.1) * 0.5 + 0.5;
    light.intensity = base * (0.7 + 0.2 * f1 + 0.15 * f2);
  };
  return { group: g, light, flicker };
}

/** Tàn lửa / bụi nắng: điểm nhỏ instanced bay lên (embers, additive) hoặc lơ lửng (dust, alpha nhẹ) */
function makeMotes(def: FxDef, idx: number, kind: 'embers' | 'dust'): InstancedMesh {
  const scale = def.scale ?? 1;
  const count = kind === 'embers' ? 120 : 260;
  const geo = new PlaneGeometry(1, 1);
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    seeds[i * 4] = h1(i, idx * 11 + 5);
    seeds[i * 4 + 1] = h1(i, idx * 11 + 6) * 2 - 1;
    seeds[i * 4 + 2] = h1(i, idx * 11 + 7) * 2 - 1;
    seeds[i * 4 + 3] = h1(i, idx * 11 + 8);
  }
  geo.setAttribute('seed', new InstancedBufferAttribute(seeds, 4));
  const ember = kind === 'embers';
  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide, blending: ember ? AdditiveBlending : NormalBlending });
  mat.fog = false;
  const seed = attribute('seed', 'vec4') as unknown as V4Node;
  const life = ember ? 3.5 : 14.0;
  const t = time.mul(1.0 / life).add(seed.x).fract();
  const spread = ember ? 1.4 * scale : 9.0 * scale;
  const px = seed.y.mul(spread).add(sin(time.mul(1.3).add(seed.w.mul(20.0))).mul(ember ? 0.5 : 0.8).mul(t));
  const pz = seed.z.mul(spread).add(cos(time.mul(0.9).add(seed.w.mul(13.0))).mul(0.4));
  const py = ember ? t.mul(7.0 * scale).add(seed.w.mul(0.5)) : seed.w.mul(4.0).add(sin(time.mul(0.5).add(seed.x.mul(9.0))).mul(0.4));
  const size = ember ? float(0.07).mul(seed.w.mul(0.8).add(0.5)) : float(0.05).mul(seed.w.add(0.5));
  mat.vertexNode = billboardVertex(vec3(px, py, pz), size as unknown as FNode, float(0.0) as unknown as FNode);
  const r = length(uv().sub(0.5)).mul(2.0);
  const dot = smoothstep(1.0, 0.2, r);
  if (ember) {
    const glow = smoothstep(1.0, 0.0, t);
    mat.colorNode = vec4(vec3(1.0, 0.45, 0.1).mul(3.0), dot.mul(glow));
  } else {
    // bụi: sáng ở phía ngược nắng — xấp xỉ bằng hằng, nhấp nháy theo góc
    const tw = sin(time.mul(2.0).add(seed.x.mul(40.0))).mul(0.5).add(0.5);
    mat.colorNode = vec4(vec3(1.0, 0.95, 0.85), dot.mul(0.35).mul(tw.mul(0.6).add(0.4)));
  }
  const mesh = new InstancedMesh(geo, mat, count);
  const m = new Matrix4();
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, m);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.position.set(def.position[0], def.position[1], def.position[2]);
  mesh.frustumCulled = false;
  mesh.renderOrder = 22;
  mesh.name = `${kind}_${idx}`;
  return mesh;
}

export function createAmbientFx(defs: FxDef[], opts: { maxLights?: number } = {}): AmbientFx {
  const group = new Group();
  group.name = 'ambient_fx';
  const lights: PointLight[] = [];
  const flickers: Array<(t: number) => void> = [];
  const stats = { smokeParticles: 0, fires: 0, embers: 0 };
  const maxLights = opts.maxLights ?? 6;
  defs.forEach((d, i) => {
    if (d.kind === 'smoke') {
      const s = makeSmoke(d, i);
      group.add(s.mesh);
      stats.smokeParticles += s.count;
    } else if (d.kind === 'fire') {
      const f = makeFire(d, i);
      if (lights.length >= maxLights) f.light.visible = false;
      else {
        lights.push(f.light);
        flickers.push(f.flicker);
      }
      group.add(f.group);
      stats.fires++;
    } else {
      group.add(makeMotes(d, i, d.kind));
      stats.embers++;
    }
  });
  let t = 0;
  return {
    group,
    lights,
    stats,
    update(dt: number) {
      t += dt;
      for (const f of flickers) f(t);
    },
  };
}

