/**
 * Bụi, phấn hoa, bào tử lơ lửng trong cột nắng (DV-081). Một Sprite instanced (không attribute: hạt sinh từ hash(instanceIndex)),
 * hộp 14 × 7 × 14 m bám camera và cuộn tròn (hạt ra khỏi một mặt thì vào từ mặt đối diện, không có lúc trống), trôi chậm theo
 * gió + lắc nhẹ. Mỗi hạt sáng theo đúng phần nắng lọt qua tán tại chỗ nó (canopySunLight, cùng hàm với tia thể tích) × pha
 * tán xạ dồn về phía nắng → ngoài cột nắng gần như vô hình, trong cột nắng lấp lánh như bụi trong ảnh rừng ngược sáng.
 * Cộng sáng, không ghi depth, không sương (fog = false: ở gần, sương giải tích không đáng kể). TSL only.
 */
import { AdditiveBlending, Sprite, SpriteNodeMaterial, Vector2 } from 'three/webgpu';
import { uniform, instanceIndex, hash, float, vec2, vec3, vec4, fract, sin, time, cameraPosition, uv, smoothstep, length, dot, normalize, max, pow, mix } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { SUN } from './sceneLight';
import { canopySunLight } from './volumetric';

export interface DustOptions {
  count: number;
  /** cỡ hộp quanh camera (m) — ngang, cao */
  boxM?: number;
  boxH?: number;
  /** đường kính hạt (m) */
  sizeM?: number;
  /** độ sáng (nghệ thuật) */
  intensity?: number;
  /** độ cao mặt tán trên đất (m), như tia thể tích */
  canopyHeight?: number;
}

export interface DustMotes {
  sprite: Sprite;
  /** gió xz (cùng đối tượng với gió rừng khi gán) */
  readonly wind: { value: Vector2 };
  /** gọi mỗi frame: cao độ đất dưới camera */
  update(groundY: number): void;
  dispose(): void;
}

export function createDustMotes(o: DustOptions): DustMotes {
  const B = o.boxM ?? 14;
  const H = o.boxH ?? 7;
  const wind = uniform(new Vector2(0.8, 0.6));
  const ground = uniform(0);
  const canopyH = o.canopyHeight ?? 18;
  const mat = new SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
  mat.fog = false;

  const id = float(instanceIndex);
  const r1 = hash(id);
  const r2 = hash(id.add(1731.0));
  const r3 = hash(id.add(3907.0));
  const r4 = hash(id.add(5113.0));
  const wv = wind as unknown as Node<'vec2'>;
  // trôi theo gió 0,12 m/s + lắc theo pha riêng; cuộn trong hộp bám camera
  const t = time;
  const drift = vec3(
    wv.x.mul(t).mul(0.12).add(sin(t.mul(0.31).add(r4.mul(40))).mul(0.35)),
    sin(t.mul(0.17).add(r1.mul(30))).mul(0.25).add(t.mul(0.015)),
    wv.y.mul(t).mul(0.12).add(sin(t.mul(0.27).add(r2.mul(50))).mul(0.35)),
  );
  const base = vec3(r1.mul(B), r2.mul(H), r3.mul(B)).add(drift);
  const cam = cameraPosition;
  const g = ground as unknown as Node<'float'>;
  const rel = vec3(
    fract(base.x.sub(cam.x).div(B)).sub(0.5).mul(B),
    fract(base.y.sub(g).div(H)).mul(H),
    fract(base.z.sub(cam.z).div(B)).sub(0.5).mul(B),
  );
  const P = vec3(cam.x.add(rel.x), g.add(rel.y).sub(0.3), cam.z.add(rel.z));
  mat.positionNode = P;
  const size = float(o.sizeM ?? 0.03).mul(mix(float(0.5), float(1.4), r4));
  mat.scaleNode = vec2(size, size);

  // độ sáng: nắng lọt qua tán × pha (dồn về phía nắng) × mờ dần ở mép hộp và sát mắt
  const sun = SUN.dir as unknown as Node<'vec3'>;
  const lit = canopySunLight(P, sun, g.add(canopyH));
  const toP = P.sub(cam);
  const d = length(toP).max(1e-3);
  const view = toP.div(d);
  const fwd = pow(max(dot(normalize(view), sun), float(0)), float(4)).mul(3.0).add(0.25);
  const edge = smoothstep(float(B * 0.3), float(B * 0.5), d).oneMinus().mul(smoothstep(float(0.35), float(0.9), d));
  const shape = smoothstep(float(0.1), float(0.5), length(uv().sub(0.5))).oneMinus();
  const twinkle = sin(t.mul(mix(float(1.5), float(4.0), r3)).add(r2.mul(60))).mul(0.3).add(0.7);
  const k = lit.mul(fwd).mul(edge).mul(twinkle).mul(float(o.intensity ?? 2.5));
  const sc = SUN.color as unknown as Node<'vec3'>;
  mat.colorNode = vec4(sc.mul(k).mul(shape), shape.mul(k).min(1));

  const sprite = new Sprite(mat);
  sprite.count = Math.max(1, Math.round(o.count));
  sprite.frustumCulled = false;
  sprite.name = 'dust_motes';
  sprite.renderOrder = 5;
  return {
    sprite,
    wind: wind as unknown as { value: Vector2 },
    update(groundY) {
      ground.value = groundY;
    },
    dispose() {
      mat.dispose();
      sprite.geometry.dispose();
      sprite.removeFromParent();
    },
  };
}
