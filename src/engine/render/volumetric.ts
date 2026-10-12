/**
 * Tia nắng thể tích xuyên tán qua sương (DV-080, đồ hoạ AAA lượt 2) — thay cho tia nắng màn hình (DV-063) vốn chỉ hiện khi
 * mặt trời nằm trong khung hình. Pass hậu kỳ nửa phân giải:
 *  - dựng lại vị trí thế giới của pixel từ depth, đi dọc tia camera tới min(độ sâu cảnh, `maxDist`) với `steps` mẫu
 *    (lệch mẫu interleaved-gradient theo pixel → không vạch dải);
 *  - mỗi mẫu P: chiếu ngược theo hướng mặt trời lên mặt tán (độ cao đất dưới camera + `canopyHeight`), đọc bản đồ độ che
 *    tán (CanopyMap, DV-079) + nhiễu khe lá nhỏ → phần nắng lọt tới P (0 tán kín … 1 trống); trên mặt tán = trời thoáng;
 *  - tán xạ một lần: σ(sương tại camera) × pha Henyey–Greenstein (g 0,55, sàn đẳng hướng) × nắng lọt × truyền qua e^(−σt).
 * Kết quả cộng vào HDR trước bloom: dưới tán kín thấy cột sáng nghiêng từ khe tán xuống nền rừng kể cả khi quay lưng/nghiêng
 * với mặt trời; nhìn về phía nắng thì sáng rực (pha thuận). Không đổ bóng thân cây thật (không đọc shadow map) — khe sáng theo
 * tán, đủ cho cảm nhận chiều sâu; thân cây gần che tia nhờ depth.
 * DV-081 sương sát đất: thêm lớp sương bám địa hình (cao độ đọc từ trường cao độ lọc tuyến tính, thang ~2 m) trôi chậm theo
 * gió (nhiễu 3D ~25 m), vừa tán xạ ánh trời (màu sương, tối dưới tán) + nắng qua khe tán, vừa che khuất cảnh → output vec4:
 * rgb = ánh sáng tán xạ cộng thêm, a = độ truyền qua của lớp sương (cảnh × a + rgb). Mẫu dồn gần camera (t ∝ u^1,6).
 * TSL only. Không phụ thuộc game/*.
 */
import { Color, Matrix4, Vector2, Vector3, Vector4, type Node, type PerspectiveCamera, type TextureNode, type Texture } from 'three/webgpu';
import { Fn, uniform, uv, float, vec2, vec3, vec4, int, Loop, exp, max, min, dot, length, smoothstep, mx_noise_float, getViewPosition, rtt, screenCoordinate, fract, select, pow, texture, time, abs, perspectiveDepthToViewZ } from 'three/tsl';
import { canopyMap } from '../vegetation/canopy';

export interface GroundMistOptions {
  /** hệ số tắt dần của sương sát mặt đất (1/m): 0,03 ≈ tầm nhìn 100 m trong sương */
  density?: number;
  /** độ cao thang (m): lên cao bấy nhiêu thì loãng e lần */
  height?: number;
  /** tốc độ trôi (m/s) theo hướng gió */
  speed?: number;
  /** cỡ mảng sương (m) */
  scale?: number;
}

export interface VolumetricOptions {
  /** số mẫu dọc tia (medium 12 · high 20 · ultra 32) */
  steps?: number;
  /** tầm tối đa (m) — xa hơn đã có sương giải tích lo */
  maxDist?: number;
  /** độ cao mặt tán trên đất (m) */
  canopyHeight?: number;
  /** nhân cường độ (nghệ thuật) */
  intensity?: number;
  /** phân giải pass (0,5 = nửa) */
  resolutionScale?: number;
  /** độ bất đối xứng pha (0 đẳng hướng … 0,9 dồn về phía nắng) */
  anisotropy?: number;
  /** DV-081 sương sát đất (false/không có = tắt) */
  mist?: GroundMistOptions | false;
  /** DV-086 lọc khử nhiễu (2 lượt tách trục, giữ mép theo độ sâu) — bỏ hạt dither của mẫu lệch theo pixel; false để so */
  denoise?: boolean;
}

/** DV-081: trường cao độ (engine/terrain/heightField) cho sương bám địa hình */
export interface VolumetricGround {
  texture: Texture;
  x0: number;
  z0: number;
  size: number;
  minY: number;
}

export interface VolumetricEnv {
  /** cao độ đất dưới camera (m) */
  groundY: number;
  /** hệ số tắt dần sương tại camera (1/m) */
  sigma: number;
}

export interface Volumetric {
  /** rgb: HDR cộng thêm · a: độ truyền qua lớp sương sát đất (1 = không sương), đã nửa phân giải + nội suy */
  node: Node<'vec4'>;
  update(camera: PerspectiveCamera, sunDir: readonly [number, number, number], env: VolumetricEnv): void;
  readonly params: Required<Omit<VolumetricOptions, 'mist' | 'denoise'>> & { mist: Required<GroundMistOptions> | null };
  /** cường độ uniform (0 = tắt tạm, vd. ban đêm không trăng) */
  readonly intensity: { value: number };
  /** hướng gió xz cho sương trôi */
  readonly wind: { value: Vector2 };
}

/**
 * Phần nắng lọt tới điểm P qua tán (0..1): chiếu ngược theo hướng nắng lên mặt tán ở độ cao `planeY`, đọc độ che tán + khe tán
 * (nhiễu 5 m / 1,7 m). Dùng chung cho tia thể tích và bụi lơ lửng (DV-081). Trên mặt tán = 1.
 */
export function canopySunLight(P: Node<'vec3'>, sun: Node<'vec3'>, planeY: Node<'float'>): Node<'float'> {
  const sy = max(sun.y, float(0.06));
  const h = planeY.sub(P.y);
  const hit = vec2(P.x, P.z).add(vec2(sun.x, sun.z).mul(h.max(0).div(sy)));
  const c = canopyMap.sampleAt(hit);
  const n1 = mx_noise_float(hit.mul(0.2)).mul(0.5).add(0.5);
  const n2 = mx_noise_float(hit.mul(0.6).add(vec2(13.1, 7.7))).mul(0.5).add(0.5);
  const gap = smoothstep(float(0.62), float(0.76), n1.mul(0.75).add(n2.mul(0.25)));
  // khoảng trống thật (tán thưa) sáng vừa, khe trong tán kín sáng mạnh → tương phản cột/khoảng tối
  const lit = pow(float(1).sub(c), float(2)).mul(0.2).add(c.mul(gap));
  return select(h.greaterThan(0), lit, float(1)) as unknown as Node<'float'>;
}

export function volumetricShafts(
  depth: TextureNode,
  sunColor: readonly [number, number, number],
  opts: VolumetricOptions = {},
  ground: VolumetricGround | null = null,
  ambientColor: readonly [number, number, number] = [0.3, 0.33, 0.3],
): Volumetric {
  const mistOn = !!opts.mist && !!ground;
  const mo = opts.mist || {};
  const p = {
    steps: Math.max(4, Math.min(48, Math.round(opts.steps ?? 16))),
    maxDist: opts.maxDist ?? 36,
    canopyHeight: opts.canopyHeight ?? 18,
    intensity: opts.intensity ?? 3,
    resolutionScale: opts.resolutionScale ?? 0.5,
    anisotropy: opts.anisotropy ?? 0.4,
    mist: mistOn ? { density: mo.density ?? 0.03, height: mo.height ?? 2.2, speed: mo.speed ?? 0.5, scale: mo.scale ?? 24 } : null,
  };
  const projInv = uniform(new Matrix4());
  const camWorld = uniform(new Matrix4());
  const camPos = uniform(new Vector3());
  const sun = uniform(new Vector3(0.4, 0.6, 0.5).normalize());
  const sunCol = uniform(new Color(sunColor[0], sunColor[1], sunColor[2]));
  const ambCol = uniform(new Color(ambientColor[0], ambientColor[1], ambientColor[2]));
  const sigma = uniform(0.004);
  const canopyY = uniform(18);
  const intensity = uniform(p.intensity);
  const wind = uniform(new Vector2(0.8, 0.6));
  /** mặt trời dưới chân trời → tắt (đêm dùng đèn riêng) */
  const fade = uniform(1);
  const groundRect = uniform(new Vector4(ground?.x0 ?? 0, ground?.z0 ?? 0, 1 / (ground?.size ?? 1), ground?.minY ?? 0));
  const steps = p.steps;
  const g = p.anisotropy;
  // khoảng cách dò dài hơn khi có sương (sương sát đất nhìn ngang đi xa) — mẫu dồn gần camera
  const maxDist = mistOn ? Math.max(p.maxDist, 56) : p.maxDist;

  const march = Fn(() => {
    const q = uv();
    const d = depth.sample(q).r;
    const vpos = getViewPosition(q, d, projInv as unknown as Node<'mat4'>);
    const world = (camWorld as unknown as Node<'mat4'>).mul(vec4(vpos, 1.0)).xyz;
    const rel = world.sub(camPos);
    const dist = length(rel).max(1e-3);
    const dir = rel.div(dist);
    const L = min(dist, float(maxDist));
    // interleaved gradient noise (Jimenez) theo pixel của pass
    const jitter = fract(float(52.9829189).mul(fract(dot(screenCoordinate.xy, vec2(0.06711056, 0.00583715)))));
    const sv = sun as unknown as Node<'vec3'>;
    const cosT = dot(dir, sv);
    // pha HG chuẩn hoá về 1 ở đẳng hướng, sàn 0,3 cho tia ngang/ngược nắng vẫn hiện
    const hg = float(1 - g * g).div(pow(float(1 + g * g).sub(cosT.mul(2 * g)), float(1.5)));
    const phase = hg.mul(0.7).add(0.3);
    const sunL = (sunCol as unknown as Node<'vec3'>).mul(phase).mul(intensity).mul(fade);
    const ambL = ambCol as unknown as Node<'vec3'>;
    const acc = vec3(0, 0, 0).toVar();
    const trans = float(1).toVar();
    const gr = groundRect as unknown as Node<'vec4'>;
    const wv = wind as unknown as Node<'vec2'>;
    Loop({ start: int(0), end: int(steps), type: 'int', condition: '<' }, ({ i }) => {
      const u0 = float(i).add(jitter).div(float(steps));
      const t = pow(u0, float(1.6)).mul(L);
      const dt = pow(u0, float(0.6)).mul(L).mul(1.6 / steps);
      const P = camPos.add(dir.mul(t));
      if (mistOn && ground) {
        const mp = p.mist!;
        const hs = texture(ground.texture, vec2(P.x.sub(gr.x).mul(gr.z), P.z.sub(gr.y).mul(gr.z)));
        const gy = hs.r.add(hs.g).add(gr.w);
        const above = P.y.sub(gy).max(0);
        const flow = wv.mul(time.mul(mp.speed));
        const nz = mx_noise_float(vec3(P.x.sub(flow.x).div(mp.scale), P.y.div(mp.scale * 0.35), P.z.sub(flow.y).div(mp.scale))).mul(0.5).add(0.5);
        const nz2 = mx_noise_float(vec3(P.x.sub(flow.x.mul(1.7)).div(mp.scale * 0.33), time.mul(0.05), P.z.sub(flow.y.mul(1.7)).div(mp.scale * 0.33))).mul(0.5).add(0.5);
        const patch = smoothstep(float(0.25), float(0.75), nz.mul(0.75).add(nz2.mul(0.25)));
        const m = exp(above.negate().div(mp.height)).mul(mp.density).mul(patch);
        // ánh trời trong sương: tối dưới tán kín
        const cHere = canopyMap.sampleAt(vec2(P.x, P.z));
        const sunHere = canopySunLight(P, sv, gy.add(p.canopyHeight));
        // nắng trong sương sát đất: 0,35 × (sương dày dễ loá trắng khi nhìn về phía nắng); ánh trời tối dưới tán kín
        const scat = sunL.mul(sunHere.mul(sigma.add(m.mul(0.35)))).add(ambL.mul(m).mul(float(1).sub(cHere.mul(0.55))));
        acc.addAssign(scat.mul(trans).mul(dt));
        trans.mulAssign(exp(m.mul(dt).negate()));
      } else {
        const sunHere = canopySunLight(P, sv, canopyY);
        acc.addAssign(sunL.mul(sunHere.mul(sigma)).mul(exp(sigma.mul(t).negate())).mul(dt));
      }
    });
    return vec4(acc, trans);
  })();

  const tex = rtt(march as unknown as Node<'vec4'>);
  tex.setResolutionScale(p.resolutionScale);
  // DV-086: mẫu lệch interleaved-gradient theo pixel để không vạch dải, nhưng để trần thì thành hạt sạn (nhất là qua sương).
  // Lọc 2 lượt (ngang rồi dọc, 7 mẫu bước 1,5 texel nửa phân giải), trọng số Gauss × giống độ sâu tuyến tính → mịn mà không
  // loang sáng qua mép thân cây/người.
  const near = uniform(0.1);
  const far = uniform(1000);
  const linZ = (q: Node<'vec2'>): Node<'float'> => perspectiveDepthToViewZ(depth.sample(q).r, near, far).negate() as unknown as Node<'float'>;
  const TAPS: Array<[number, number]> = [[-3, 0.07], [-2, 0.13], [-1, 0.2], [0, 0.2], [1, 0.2], [2, 0.13], [3, 0.07]];
  type Tex = { sample(q: Node<'vec2'>): Node<'vec4'>; size(l: Node<'int'>): Node<'ivec2'> };
  const blurPass = (src: Tex, dx: number, dy: number): Node<'vec4'> =>
    Fn(() => {
      const q = uv() as unknown as Node<'vec2'>;
      const ts = vec2(1).div(vec2(src.size(int(0))));
      const z0 = linZ(q);
      const tol = z0.mul(0.06).add(0.25);
      const sum = vec4(0, 0, 0, 0).toVar();
      const wsum = float(0).toVar();
      for (const [o, gw] of TAPS) {
        const qq = q.add(vec2(dx, dy).mul(ts).mul(o * 1.5));
        const w = float(gw).mul(exp(abs(linZ(qq).sub(z0)).div(tol).negate()));
        sum.addAssign(src.sample(qq).mul(w));
        wsum.addAssign(w);
      }
      return sum.div(wsum.max(1e-4));
    })() as unknown as Node<'vec4'>;
  let node = tex as unknown as Node<'vec4'>;
  if (opts.denoise !== false) {
    const h = rtt(blurPass(tex as unknown as Tex, 1, 0));
    h.setResolutionScale(p.resolutionScale);
    const v = rtt(blurPass(h as unknown as Tex, 0, 1));
    v.setResolutionScale(p.resolutionScale);
    node = v as unknown as Node<'vec4'>;
  }

  return {
    node,
    params: p,
    intensity: intensity as unknown as { value: number },
    wind: wind as unknown as { value: Vector2 },
    update(camera, sunDir, env) {
      (projInv.value as Matrix4).copy(camera.projectionMatrixInverse);
      (camWorld.value as Matrix4).copy(camera.matrixWorld);
      (camPos.value as Vector3).setFromMatrixPosition(camera.matrixWorld);
      near.value = camera.near;
      far.value = camera.far;
      (sun.value as Vector3).set(sunDir[0], sunDir[1], sunDir[2]).normalize();
      sigma.value = Math.max(0, env.sigma);
      canopyY.value = env.groundY + p.canopyHeight;
      fade.value = Math.min(1, Math.max(0, sunDir[1] / 0.05));
    },
  };
}
