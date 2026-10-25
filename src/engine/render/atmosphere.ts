/**
 * Khí quyển cho cảnh terrain (DV-079): thay FogExp2 đều bằng sương theo độ cao + tán xạ về phía mặt trời.
 *
 * - Mật độ giảm theo độ cao: ρ(y) = ρ₀·e^(−(y − y₀)/H) — thung lũng đặc sương, sườn cao và đỉnh núi xa nhô lên khỏi biển mây
 *   (kiểu ảnh rừng Trường Sơn rạng sáng). Độ dày quang học dọc tia camera → điểm lấy tích phân giải tích (Íñigo Quílez,
 *   "better fog"), không vòng lặp: τ = ρ(y_cam)·d·(1 − e^(−k))/k với k = d·dir.y/H.
 * - Thêm một nền đều nhỏ (`base`) để xa tít vẫn mờ (khí quyển), chặn `maxFactor` để thung lũng sâu không đặc như sữa.
 * - Màu sương: màu preset (phía khuất nắng) hoà với màu nắng theo pha Henyey–Greenstein rẻ: pow(max(v·l, 0), sharp)
 *   → nhìn về phía mặt trời sương sáng ấm, quay lưng sương xanh xám lạnh (phối cảnh không khí).
 * Tham số mặc định suy từ mật độ FogExp2 cũ: ở tầm nhìn preset (độ cao y₀) phủ 90 %, 14 m quanh camera trong suốt — cảnh gần
 * rõ, xa mờ dần tuyến tính theo quang học (FogExp2 cũ gần như trong tới 100 m rồi đặc đột ngột).
 */
import { Color, Vector3, type Scene, type Node } from 'three/webgpu';
import { uniform, positionWorld, cameraPosition, float, vec4, exp, max, min, mix, pow, dot, normalize, abs, select, output } from 'three/tsl';

export interface AtmosphereOptions {
  /** màu sương phía khuất nắng (hex sRGB) */
  color: number;
  /** mật độ FogExp2 cũ (ρ) — đổi sang hệ số tắt dần cùng tầm nhìn: σ = 3,912 / V, V = √3,912 / ρ */
  density: number;
  /** độ cao chuẩn y₀ (m, hệ level) nơi tầm nhìn bằng preset */
  baseHeight?: number;
  /** độ cao thang (m): lên cao H mét thì sương loãng e lần */
  scaleHeight?: number;
  /** phần sương đều không theo độ cao (0..1 của σ₀) */
  uniformShare?: number;
  /** màu nắng tán xạ (hex sRGB) và độ mạnh 0..1 */
  sunColor?: number;
  sunScatter?: number;
  /** độ hội tụ quầng sáng quanh mặt trời (số mũ) */
  sunSharpness?: number;
  /** trần mật độ so với ở y₀ (thung lũng sâu) */
  maxFactor?: number;
  /** quãng trong suốt quanh camera (m) — cảnh gần giữ rõ nét */
  startM?: number;
  /** độ phủ sương ở đúng tầm nhìn preset (0,9 = còn 10 % tương phản) */
  coverAtVisibility?: number;
}

export interface Atmosphere {
  /** hướng tới mặt trời (đơn vị) — cập nhật khi mặt trời đổi */
  setSun(dir: readonly number[]): void;
  readonly params: Required<AtmosphereOptions>;
  /** DV-093 global fog density multiplier (1 = preset) */
  readonly densityScale: { value: number };
  /** hệ số sương (0..1) tính trên CPU cùng công thức (test/QA) */
  factorAt(cam: readonly number[], p: readonly number[]): number;
  /** DV-080: hệ số tắt dần (1/m) tại độ cao y — cho tia nắng thể tích */
  sigmaAt(y: number): number;
}

const LN50 = Math.log(50); // tương phản 2 %

export function visibilityFromExp2(density: number): number {
  return Math.sqrt(LN50) / Math.max(1e-6, density);
}

export function createAtmosphere(scene: Scene, opts: AtmosphereOptions): Atmosphere {
  const p: Required<AtmosphereOptions> = {
    color: opts.color,
    density: opts.density,
    baseHeight: opts.baseHeight ?? 0,
    scaleHeight: opts.scaleHeight ?? 110,
    uniformShare: opts.uniformShare ?? 0.18,
    sunColor: opts.sunColor ?? 0xffe2b8,
    sunScatter: opts.sunScatter ?? 0.55,
    sunSharpness: opts.sunSharpness ?? 6,
    maxFactor: opts.maxFactor ?? 3.5,
    startM: opts.startM ?? 14,
    coverAtVisibility: opts.coverAtVisibility ?? 0.9,
  };
  // hệ số tắt dần σ₀ sao cho ở tầm nhìn preset (trừ quãng trong) độ phủ = coverAtVisibility
  const V0 = visibilityFromExp2(p.density);
  const sigma0 = -Math.log(1 - p.coverAtVisibility) / Math.max(1, V0 - p.startM);
  const uSigma = uniform(sigma0 * (1 - p.uniformShare));
  const uBase = uniform(sigma0 * p.uniformShare);
  const uY0 = uniform(p.baseHeight);
  const uH = uniform(p.scaleHeight);
  const uMax = uniform(p.maxFactor);
  const uSun = uniform(new Vector3(0.4, 0.6, 0.5).normalize());
  const uFog = uniform(new Color(p.color));
  const uSunCol = uniform(new Color(p.sunColor));
  const uScatter = uniform(p.sunScatter);

  const rel = positionWorld.sub(cameraPosition);
  const dRaw = rel.length().max(1e-3);
  const dir = rel.div(dRaw);
  const d = dRaw.sub(float(p.startM)).max(0);
  // mật độ tại camera (chặn ở thung lũng sâu)
  const rhoCam = min(exp(cameraPosition.y.sub(uY0).negate().div(uH)), uMax).mul(uSigma);
  // tích phân dọc tia: d·(1 − e^(−k))/k, k → 0 dùng d (tia gần ngang)
  const k = d.mul(dir.y).div(uH);
  const kSafe = select(abs(k).lessThan(1e-3), float(1e-3), k);
  const integ = select(abs(k).lessThan(1e-3), d, d.mul(float(1).sub(exp(kSafe.negate()))).div(kSafe));
  // tia đi xuống sâu (k ≪ 0) thì e^(−k) lớn — chặn bằng trần mật độ × d
  const tauHeight = min(rhoCam.mul(integ), uSigma.mul(uMax).mul(d));
  // DV-093 hệ số mật độ toàn cục (intro: cảnh trên không/xa bớt sương; 1 = theo preset)
  const uScale = uniform(1);
  const tau = tauHeight.add(uBase.mul(d)).mul(uScale);
  const amount = float(1).sub(exp(tau.negate())).clamp(0, 1);
  const phase = pow(max(dot(normalize(dir), uSun), 0), float(p.sunSharpness));
  const fogCol = mix(uFog as unknown as Node<'vec3'>, uSunCol as unknown as Node<'vec3'>, phase.mul(uScatter));
  (scene as unknown as { fogNode: unknown }).fogNode = vec4(mix(output.rgb, fogCol, amount), output.a);
  scene.fog = null;

  return {
    params: p,
    densityScale: uScale as unknown as { value: number },
    setSun(dir) {
      (uSun.value as Vector3).set(dir[0]!, dir[1]!, dir[2]!).normalize();
    },
    sigmaAt(y) {
      const s1 = sigma0 * (1 - p.uniformShare);
      return Math.min(Math.exp(-(y - p.baseHeight) / p.scaleHeight), p.maxFactor) * s1 + sigma0 * p.uniformShare;
    },
    factorAt(cam, q) {
      const rx = q[0]! - cam[0]!;
      const ry = q[1]! - cam[1]!;
      const rz = q[2]! - cam[2]!;
      const dr = Math.max(1e-3, Math.hypot(rx, ry, rz));
      const dd = Math.max(0, dr - p.startM);
      const s1 = sigma0 * (1 - p.uniformShare);
      const rc = Math.min(Math.exp(-(cam[1]! - p.baseHeight) / p.scaleHeight), p.maxFactor) * s1;
      const kk = (dd * (ry / dr)) / p.scaleHeight;
      const ig = Math.abs(kk) < 1e-3 ? dd : (dd * (1 - Math.exp(-kk))) / kk;
      const t = Math.min(rc * ig, s1 * p.maxFactor * dd) + sigma0 * p.uniformShare * dd;
      return Math.min(1, Math.max(0, 1 - Math.exp(-t)));
    },
  };
}
