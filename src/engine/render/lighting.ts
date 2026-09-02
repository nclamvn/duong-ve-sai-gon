/**
 * Lighting (PRD §4 Lighting): 1 directional key có shadow, tối đa 2 local light, hemisphere yếu, fog.
 */
import { DirectionalLight, PointLight, HemisphereLight, FogExp2, Scene, Color, Object3D } from 'three/webgpu';

export interface LightRig {
  sun: DirectionalLight;
  locals: PointLight[];
  hemi: HemisphereLight;
  /** quay mục tiêu sun theo player để shadow frustum bám khu vực nhìn */
  followTarget(target: Object3D): void;
}

export function createLighting(scene: Scene, shadowMapSize = 2048): LightRig {
  scene.background = new Color(0x0b1016);
  scene.fog = new FogExp2(0x0b1016, 0.012);

  // Trăng/đèn trời qua mây bão — lạnh, yếu
  const sun = new DirectionalLight(0x9fb4cc, 3.2);
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

  // Đèn cảng: vàng natri + đèn báo đỏ (floodlight alarm state dùng sau)
  const lampA = new PointLight(0xffb454, 260, 50, 1.4);
  lampA.position.set(-18, 7, 12);
  const lampB = new PointLight(0xff3b3b, 160, 40, 1.4);
  lampB.position.set(22, 6, -16);
  scene.add(lampA, lampB);

  const hemi = new HemisphereLight(0x46586e, 0x0a0d12, 1.1);
  scene.add(hemi);

  return {
    sun,
    locals: [lampA, lampB],
    hemi,
    followTarget(target: Object3D) {
      sun.target.position.copy(target.position);
      sun.position.set(target.position.x + 30, 45, target.position.z - 20);
    },
  };
}
