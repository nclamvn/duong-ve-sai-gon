/**
 * Mưa GPU (PRD §4 Particles): InstancedMesh + TSL positionNode. Vị trí hạt tính hoàn toàn trong shader
 * từ instanceIndex + time → CPU không cập nhật buffer mỗi frame, không object JS mỗi hạt.
 * TIP-011: hạt sáng lên khi đi qua nón đèn pha (lampGlowAt), splash ring trên sàn (GPU-only, seeded hash).
 */
import { InstancedMesh, PlaneGeometry, MeshBasicNodeMaterial, DoubleSide, Object3D, AdditiveBlending, Color } from 'three/webgpu';
import { uniform, instanceIndex, hash, time, positionLocal, positionWorld, vec3, float, mod, cameraPosition, positionView, smoothstep, floor, fract, vec4 } from 'three/tsl';
import { lampGlowAt, type LampArray } from './materials';
import { splashRing } from './geometry';

export interface Rain {
  mesh: InstancedMesh;
  splash: InstancedMesh;
  intensity: { value: number };
  /** kích thước vùng mưa quanh camera (m) */
  extent: number;
  height: number;
  count: number;
}

function identityInstances(mesh: InstancedMesh, count: number): void {
  const dummy = new Object3D();
  dummy.updateMatrix();
  for (let k = 0; k < count; k++) mesh.setMatrixAt(k, dummy.matrix);
  mesh.instanceMatrix.needsUpdate = true;
}

export function createRain(count = 20000, extent = 70, height = 24, lamps: LampArray | null = null, splashCount = 512): Rain {
  // Vạch mưa mảnh (TIP-010: 0.005 × 0.4 m, mờ, fade sát camera)
  const geo = new PlaneGeometry(0.005, 0.4);
  const intensity = uniform(1.0);
  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide });
  mat.color.setHex(0xb9c6d4);
  mat.opacity = 0.16;
  const dist = positionView.z.negate();
  const baseOpacity = float(0.16).mul(smoothstep(0.4, 2.5, dist)).mul(float(1.0).sub(smoothstep(30.0, 60.0, dist)));
  if (lamps) {
    // trong nón đèn: hạt sáng và rõ hơn (ánh đèn xuyên mưa — PRD §1)
    const glow = lampGlowAt(positionWorld, lamps);
    mat.opacityNode = baseOpacity.mul(float(1.0).add(glow.mul(2.5)));
    mat.colorNode = vec4(vec3(0.73, 0.78, 0.83).mul(float(1.0).add(glow.mul(vec3(1.4, 1.0, 0.5)))), 1.0);
  } else {
    mat.opacityNode = baseOpacity;
  }

  const i = float(instanceIndex);
  const hx = hash(i);
  const hy = hash(i.add(1000.0));
  const hz = hash(i.add(2000.0));
  const speed = float(14.0).add(hash(i.add(3000.0)).mul(6.0));
  const ox = hx.mul(extent).sub(extent * 0.5);
  const oz = hz.mul(extent).sub(extent * 0.5);
  const half = extent * 0.5;
  const px = cameraPosition.x.add(mod(ox.sub(cameraPosition.x).add(half), extent)).sub(half);
  const pz = cameraPosition.z.add(mod(oz.sub(cameraPosition.z).add(half), extent)).sub(half);
  const py = mod(hy.mul(height).sub(time.mul(speed)), height);
  const visible = hash(i.add(4000.0)).lessThan(intensity);
  const yFinal = visible.select(py, float(-50.0));
  mat.positionNode = positionLocal.add(vec3(px, yFinal, pz));

  const mesh = new InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  identityInstances(mesh, count);

  // Splash ring trên sàn: mỗi instance có chu kỳ 0.55 s, vị trí mới mỗi chu kỳ (hash theo cycle), nở + mờ dần
  const sgeo = splashRing();
  const smat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
  smat.color = new Color(0x9fb3c4);
  const si = float(instanceIndex);
  const period = float(0.55);
  const phase = hash(si.add(7000.0));
  const tcyc = time.div(period).add(phase);
  const cycle = floor(tcyc);
  const u = fract(tcyc); // 0 → 1 trong chu kỳ
  const sx = hash(si.add(cycle.mul(13.0)));
  const sz = hash(si.add(cycle.mul(17.0)).add(500.0));
  const R = 14.0;
  const spx = cameraPosition.x.add(sx.mul(R * 2).sub(R));
  const spz = cameraPosition.z.add(sz.mul(R * 2).sub(R));
  const grow = float(0.4).add(u.mul(1.6));
  const svis = hash(si.add(9000.0)).lessThan(intensity);
  const sy = svis.select(float(0.015), float(-50.0));
  smat.positionNode = positionLocal.mul(vec3(grow, 1.0, grow)).add(vec3(spx, sy, spz));
  const sdist = positionView.z.negate();
  let sop = float(1.0).sub(u).mul(0.22).mul(smoothstep(0.3, 1.5, sdist)).mul(float(1.0).sub(smoothstep(8.0, 16.0, sdist)));
  if (lamps) sop = sop.mul(float(0.35).add(lampGlowAt(positionWorld, lamps).mul(2.0)));
  smat.opacityNode = sop;
  const splash = new InstancedMesh(sgeo, smat, splashCount);
  splash.frustumCulled = false;
  splash.castShadow = false;
  splash.receiveShadow = false;
  splash.renderOrder = 3;
  identityInstances(splash, splashCount);

  return { mesh, splash, intensity, extent, height, count };
}
