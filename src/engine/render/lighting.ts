/**
 * Lighting (PRD §4): 1 directional key có shadow (trăng qua mây bão), đèn pha natri cảng (SpotLight không shadow + nón volumetric giả),
 * 2 point cục bộ, hemisphere yếu, fog, IBL từ HDRI đêm (TIP-011). Không thêm shadow light.
 */
import { DirectionalLight, PointLight, SpotLight, HemisphereLight, FogExp2, Scene, Color, Object3D, Mesh, ConeGeometry, Texture, Group } from 'three/webgpu';
import { createLightConeMaterial, createLampArrayNode, type LampArray } from './materials';
import type { LampDef } from './arena';

export interface LightRig {
  sun: DirectionalLight;
  locals: PointLight[];
  spots: SpotLight[];
  hemi: HemisphereLight;
  /** uniform array vị trí đèn → mưa/splash sáng khi qua nón đèn */
  lampArray: LampArray;
  cones: Group;
  /** quay mục tiêu sun theo player để shadow frustum bám khu vực nhìn */
  followTarget(target: Object3D): void;
  /** bật/tắt nón volumetric (quality) */
  setCones(visible: boolean): void;
}

export interface LightingOptions {
  shadowMapSize?: number;
  environment?: Texture | null;
  lamps?: LampDef[];
  /** cường độ IBL (đêm: 0.25–0.5) */
  environmentIntensity?: number;
}

export function createLighting(scene: Scene, opts: LightingOptions | number = {}): LightRig {
  const o: LightingOptions = typeof opts === 'number' ? { shadowMapSize: opts } : opts;
  const shadowMapSize = o.shadowMapSize ?? 2048;
  scene.background = new Color(0x05070b);
  scene.fog = new FogExp2(0x04060a, 0.02);
  if (o.environment) {
    scene.environment = o.environment;
    scene.environmentIntensity = o.environmentIntensity ?? 0.12;
  }

  // Trăng/đèn trời qua mây bão — lạnh, yếu; shadow duy nhất
  const sun = new DirectionalLight(0x7f93b0, 0.55);
  sun.position.set(30, 45, -20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 160;
  sun.shadow.camera.left = -60;
  sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);

  // Đèn cục bộ: đèn báo đỏ trạm relay + đèn vàng kho
  const lampA = new PointLight(0xffb454, 120, 36, 1.6);
  lampA.position.set(-18, 7, 12);
  const lampB = new PointLight(0xff3b3b, 90, 30, 1.6);
  lampB.position.set(22, 6, -16);
  scene.add(lampA, lampB);

  const hemi = new HemisphereLight(0x22304a, 0x05070a, 0.35);
  scene.add(hemi);

  // Đèn pha natri: SpotLight (không shadow) + nón volumetric giả
  const spots: SpotLight[] = [];
  const cones = new Group();
  cones.name = 'light_cones';
  const lampArray = createLampArrayNode();
  const coneMat = createLightConeMaterial(0xffb060, 0.1);
  (o.lamps ?? []).forEach((l, i) => {
    const s = new SpotLight(l.color, l.intensity ?? 1800, 48, l.angle ?? 0.7, 0.6, 1.4);
    s.position.set(l.position[0], l.position[1], l.position[2]);
    s.target.position.set(l.position[0] + l.direction[0] * 10, l.position[1] + l.direction[1] * 10, l.position[2] + l.direction[2] * 10);
    s.castShadow = false;
    scene.add(s, s.target);
    spots.push(s);
    if (i < lampArray.positions.length) lampArray.positions[i]!.set(l.position[0], l.position[1], l.position[2]);
    // nón: đỉnh tại đèn, mở theo direction; ConeGeometry trục y (đỉnh +y) → dịch để đỉnh ở gốc, quay theo direction
    const h = l.position[1] + 0.5;
    const r = Math.tan(l.angle ?? 0.7) * h * 0.8;
    const geo = new ConeGeometry(r, h, 24, 1, true);
    geo.translate(0, -h / 2, 0);
    const cone = new Mesh(geo, coneMat);
    cone.position.set(l.position[0], l.position[1], l.position[2]);
    cone.lookAt(l.position[0] + l.direction[0], l.position[1] + l.direction[1], l.position[2] + l.direction[2]);
    cone.rotateX(-Math.PI / 2); // lookAt: +z → hướng chiếu; xoay để trục −y (nón) trùng +z
    cone.frustumCulled = true;
    cone.renderOrder = 5;
    cones.add(cone);
  });
  scene.add(cones);

  return {
    sun,
    locals: [lampA, lampB],
    spots,
    hemi,
    lampArray,
    cones,
    followTarget(target: Object3D) {
      sun.target.position.copy(target.position);
      sun.position.set(target.position.x + 30, 45, target.position.z - 20);
    },
    setCones(visible: boolean) {
      cones.visible = visible;
    },
  };
}
