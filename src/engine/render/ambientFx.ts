/**
 * FX môi trường (TIP-019/022): cột khói, lửa, tàn lửa, bụi nắng — TSL, instanced billboard, không Math.random (hash theo id).
 * Khói: quad billboard theo camera, nổi lên + gió, to dần, mờ dần; alpha mềm theo độ sâu (soft particle) qua depth không cần —
 * dùng fade theo khoảng cách camera để tránh cắt cứng. DV-086: lửa và khói chuyển sang trường hạt chung (fireField: lửa bốc, tàn
 * bay, quầng sáng đất, khói cuộn; đèn cố định số lượng); file này giữ tàn lửa rời và bụi nắng.
 */
import { InstancedMesh, PlaneGeometry, MeshBasicNodeMaterial, Group, PointLight, Matrix4, Color, AdditiveBlending, NormalBlending, DoubleSide, InstancedBufferAttribute } from 'three/webgpu';
import { float, vec3, vec4, time, positionLocal, cameraViewMatrix, modelWorldMatrix, uv, smoothstep, sin, cos, attribute, cameraProjectionMatrix, length } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { FxDef } from '@engine/level/types';
import { createFireField, type FireField } from './fireField';

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
  const dot = smoothstep(0.2, 1.0, r).oneMinus();
  if (ember) {
    const glow = smoothstep(0.0, 1.0, t).oneMinus();
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
  const stats = { smokeParticles: 0, fires: 0, embers: 0 };
  // DV-086: lửa/khói dùng trường hạt chung (engine/render/fireField) — lửa bốc thật, khói cuộn thay vì cột đặc
  const fireDefs = defs.filter((d) => d.kind === 'fire');
  const smokeDefs = defs.filter((d) => d.kind === 'smoke');
  let field: FireField | null = null;
  if (fireDefs.length || smokeDefs.length) {
    field = createFireField({ fires: Math.max(1, fireDefs.length), smokes: Math.max(1, smokeDefs.length), lights: Math.min(opts.maxLights ?? 6, fireDefs.length) });
    // đang cháy sẵn từ lâu (hạt ở trạng thái ổn định ngay khi vào màn)
    fireDefs.forEach((d, i) => field!.setFire(i, d.position, -1000, 1e9, (d.scale ?? 1) * 1.2));
    smokeDefs.forEach((d, i) => {
      const c = new Color(d.color ?? 0x1a1816);
      field!.setSmoke(i, d.position, -1000, 1e9, d.scale ?? 1, { color: [c.r, c.g, c.b], lit: d.lit ?? 1, height: d.height ?? 0 });
    });
    group.add(field.group);
    stats.fires = fireDefs.length;
    stats.smokeParticles = smokeDefs.length * 28;
  }
  defs.forEach((d, i) => {
    if (d.kind === 'embers' || d.kind === 'dust') {
      group.add(makeMotes(d, i, d.kind));
      stats.embers++;
    }
  });
  let t = 0;
  return {
    group,
    lights: field ? [...field.lights] : [],
    stats,
    update(dt: number) {
      t += dt;
      field?.update(t, null);
    },
  };
}
