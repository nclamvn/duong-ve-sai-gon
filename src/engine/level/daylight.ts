/**
 * Ánh sáng ban ngày (TIP-019, ADR-007): mặt trời DirectionalLight + cascaded shadow (CSMShadowNode), hemisphere trời/đất,
 * HDRI làm nền trời + IBL, sương bụi nhẹ. Trả LightRig tương thích game (không đèn pha, lampArray rỗng).
 */
import { DirectionalLight, HemisphereLight, FogExp2, Scene, Color, Object3D, Group, Texture, EquirectangularReflectionMapping, PointLight, SpotLight } from 'three/webgpu';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import { createLampArrayNode } from '@engine/render/materials';
import type { LightRig } from '@engine/render/lighting';
import type { LevelSky } from './types';

export interface DaylightOptions {
  environment?: Texture | null;
  sky?: Texture | null;
  /** tắt CSM (WebGL2 CI / quality thấp) → shadow thường */
  csm?: boolean;
  shadowMapSize?: number;
}

export interface DaylightRig extends LightRig {
  csm: CSMShadowNode | null;
  /** hướng tới mặt trời (đơn vị) — cho lớp viewmodel bắt chước */
  sunDir: [number, number, number];
  sunColor: number;
  sunIntensity: number;
}

export function createDaylight(scene: Scene, def: LevelSky, opts: DaylightOptions = {}): DaylightRig {
  const az = (def.sun.azimuthDeg * Math.PI) / 180;
  const el = (def.sun.elevationDeg * Math.PI) / 180;
  const dir: [number, number, number] = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
  if (opts.sky) {
    opts.sky.mapping = EquirectangularReflectionMapping;
    scene.background = opts.sky;
    scene.backgroundIntensity = def.skyIntensity;
  } else scene.background = new Color(0x9fc2e6);
  if (opts.environment) {
    scene.environment = opts.environment;
    scene.environmentIntensity = def.envIntensity;
  }
  scene.fog = new FogExp2(def.fog.color, def.fog.density);

  const sun = new DirectionalLight(def.sun.color, def.sun.intensity);
  sun.position.set(dir[0] * 80, dir[1] * 80, dir[2] * 80);
  sun.castShadow = true;
  const size = opts.shadowMapSize ?? def.csm.mapSize;
  sun.shadow.mapSize.set(size, size);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  let csm: CSMShadowNode | null = null;
  if (opts.csm !== false) {
    csm = new CSMShadowNode(sun, { cascades: def.csm.cascades, maxFar: def.csm.maxFar, mode: 'practical', lightMargin: 60 });
    csm.fade = true;
    sun.shadow.shadowNode = csm;
  } else {
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 220;
    sun.shadow.camera.left = -70;
    sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 70;
    sun.shadow.camera.bottom = -70;
  }
  scene.add(sun, sun.target);

  const hemi = new HemisphereLight(def.hemi.sky, def.hemi.ground, def.hemi.intensity);
  scene.add(hemi);
  const cones = new Group();
  cones.name = 'light_cones';
  const spots: SpotLight[] = [];
  const locals: PointLight[] = [];
  return {
    sun,
    locals,
    spots,
    hemi,
    lampArray: createLampArrayNode(),
    cones,
    csm,
    sunDir: dir,
    sunColor: def.sun.color,
    sunIntensity: def.sun.intensity,
    followTarget(target: Object3D) {
      if (csm) return; // CSM bám frustum camera
      sun.target.position.copy(target.position);
      sun.position.set(target.position.x + dir[0] * 80, dir[1] * 80, target.position.z + dir[2] * 80);
    },
    setCones() {
      /* ban ngày không nón đèn */
    },
  };
}
