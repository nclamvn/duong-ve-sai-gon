/**
 * Hậu kỳ điện ảnh cho cảnh rừng (DV-063): tia nắng xuyên tán (light shafts màn hình) và chỉnh màu phim nhựa.
 *
 * Tia nắng: kiểu GPU Gems 3 ch.13 — mặt nạ "lỗ trời" từ depth (pixel depth = 1 là trời lọt qua kẽ lá) rồi làm nhoè hướng tâm
 * về vị trí mặt trời trên màn hình, suy giảm theo mẫu. Không cần shadow map (tương thích CSM), chi phí = `samples` lần đọc depth.
 * Chỉ bật khi mặt trời ở trước camera và thấp (bình minh/chiều): `visibility` do host cập nhật mỗi frame.
 *
 * Chỉnh màu: trên LDR sau tone map — nâng đen (lift), cong tương phản S, tách tông (bóng xanh rêu lạnh, sáng vàng ấm),
 * giảm bão hoà xanh lá (phim nhựa 70s không xanh chói), độ phơi tổng. Tham số là dữ liệu level (`post.grade`).
 */
import { Vector3, type PerspectiveCamera, type Node, type TextureNode } from 'three/webgpu';
import { Fn, Loop, float, int, vec2, vec3, uv, uniform, mix, smoothstep, max, clamp, dot, length, pow } from 'three/tsl';

export interface ShaftOptions {
  /** cường độ cộng vào HDR (đơn vị màu mặt trời) */
  intensity?: number;
  /** số mẫu dọc tia */
  samples?: number;
  /** độ dài tia (0..1 khoảng cách tới mặt trời) */
  density?: number;
  /** suy giảm mỗi mẫu */
  decay?: number;
  /** góc mặt trời trên chân trời (độ) mà tia tắt hẳn */
  maxElevationDeg?: number;
}

export interface FilmGrade {
  /** nâng đen 0..0,1 */
  lift?: number;
  /** cong S 0..1 */
  contrast?: number;
  /** bão hoà tổng (1 = giữ) */
  saturation?: number;
  /** giảm riêng bão hoà vùng xanh lá 0..1 */
  greenDesat?: number;
  /** màu đổ vào bóng tối (sRGB 0..1) */
  shadowTint?: [number, number, number];
  /** màu đổ vào vùng sáng (sRGB 0..1) */
  highlightTint?: [number, number, number];
  /** độ mạnh tách tông 0..1 */
  split?: number;
  /** nhân sáng tổng */
  exposure?: number;
}

export const DEFAULT_GRADE: Required<FilmGrade> = {
  lift: 0.025,
  contrast: 0.35,
  saturation: 0.9,
  greenDesat: 0.3,
  shadowTint: [0.27, 0.34, 0.33],
  highlightTint: [0.62, 0.52, 0.36],
  split: 0.22,
  exposure: 1.0,
};

export interface LightShafts {
  /** HDR cộng thêm (vec3) */
  node: Node<'vec3'>;
  /** cập nhật vị trí mặt trời màn hình + độ hiện; gọi mỗi frame trước render */
  update(camera: PerspectiveCamera, sunDir: readonly [number, number, number]): void;
  /** 0..1 lần cập nhật cuối (QA) */
  readonly visibility: { value: number };
}

const _v = new Vector3();
const _f = new Vector3();

export function lightShafts(depth: TextureNode, sunColor: readonly [number, number, number], opts: ShaftOptions = {}): LightShafts {
  const sunUV = uniform(vec2(0.5, 0.5));
  const vis = uniform(0);
  const samples = Math.max(8, Math.min(64, opts.samples ?? 28));
  const density = float(opts.density ?? 0.85);
  const decay = float(opts.decay ?? 0.955);
  const intensity = float(opts.intensity ?? 0.9);
  const maxEl = Math.sin(((opts.maxElevationDeg ?? 28) * Math.PI) / 180);
  const color = vec3(sunColor[0], sunColor[1], sunColor[2]);

  const node = Fn(() => {
    const p = uv();
    const delta = sunUV.sub(p).mul(density).div(float(samples));
    const acc = float(0).toVar();
    const w = float(1).toVar();
    const q = p.toVar();
    // lệch mẫu theo pixel chống dải (banding) khi ít mẫu
    const jitter = dot(p, vec2(12.9898, 78.233)).sin().mul(43758.5453).fract();
    q.addAssign(delta.mul(jitter));
    Loop({ start: int(0), end: int(samples), type: 'int', condition: '<' }, () => {
      q.addAssign(delta);
      const d = depth.sample(q).r;
      const sky = smoothstep(float(0.99999), float(1.0), d);
      acc.addAssign(sky.mul(w));
      w.mulAssign(decay);
    });
    // mạnh hơn gần mặt trời, tắt dần ra mép
    const r = length(p.sub(sunUV));
    const fall = smoothstep(float(1.1), float(0.0), r);
    return color.mul(acc.div(float(samples)).mul(intensity).mul(vis).mul(fall));
  })() as unknown as Node<'vec3'>;

  const visibility = { value: 0 };
  return {
    node,
    visibility,
    update(camera, sunDir) {
      _v.set(sunDir[0], sunDir[1], sunDir[2]).multiplyScalar(1000).add(camera.position);
      camera.getWorldDirection(_f);
      const facing = _f.x * sunDir[0] + _f.y * sunDir[1] + _f.z * sunDir[2];
      _v.project(camera);
      const low = sunDir[1] <= 0 ? 0 : 1 - Math.min(1, Math.max(0, (sunDir[1] - maxEl * 0.5) / (maxEl * 0.5)));
      // mặt trời trước camera (facing > 0) và gần khung hình
      const onScreen = 1 - Math.min(1, Math.max(0, (Math.max(Math.abs(_v.x), Math.abs(_v.y)) - 1.2) / 0.8));
      const v = facing > 0 ? Math.min(1, facing * 1.6) * onScreen * low : 0;
      sunUV.value.set(_v.x * 0.5 + 0.5, 1 - (_v.y * 0.5 + 0.5));
      vis.value = v;
      visibility.value = v;
    },
  };
}

/** Chỉnh màu phim trên LDR sRGB (0..1). */
export function filmGrade(c: Node<'vec3'>, g: FilmGrade = {}): Node<'vec3'> {
  const o = { ...DEFAULT_GRADE, ...g };
  return Fn(() => {
    let x = c.mul(float(o.exposure));
    const l0 = dot(x, vec3(0.2126, 0.7152, 0.0722));
    // giảm xanh lá chói: kênh g vượt trung bình r,b
    const greenness = clamp(x.g.sub(max(x.r, x.b)).mul(4.0), 0, 1);
    x = mix(x, vec3(l0), greenness.mul(float(o.greenDesat)));
    const l = dot(x, vec3(0.2126, 0.7152, 0.0722));
    x = mix(vec3(l), x, float(o.saturation));
    // tách tông theo độ sáng
    const sh = pow(float(1).sub(l), float(2.0));
    const hi = pow(l, float(2.0));
    const st = vec3(o.shadowTint[0], o.shadowTint[1], o.shadowTint[2]).sub(0.33);
    const ht = vec3(o.highlightTint[0], o.highlightTint[1], o.highlightTint[2]).sub(0.5);
    x = x.add(st.mul(sh).mul(float(o.split))).add(ht.mul(hi).mul(float(o.split)));
    // cong S + nâng đen
    x = mix(x, smoothstep(float(0), float(1), clamp(x, 0, 1)), float(o.contrast));
    x = x.mul(float(1).sub(o.lift)).add(float(o.lift));
    return clamp(x, 0, 1);
  })() as unknown as Node<'vec3'>;
}
