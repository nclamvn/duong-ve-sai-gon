/**
 * Mưa GPU (PRD §4 Particles): InstancedMesh + TSL positionNode. Vị trí hạt tính hoàn toàn trong shader
 * từ instanceIndex + time → CPU không cập nhật buffer mỗi frame, không object JS mỗi hạt.
 */
import { InstancedMesh, PlaneGeometry, MeshBasicNodeMaterial, DoubleSide, Object3D } from 'three/webgpu';
import { uniform, instanceIndex, hash, time, positionLocal, vec3, float, mod, cameraPosition } from 'three/tsl';

export interface Rain {
  mesh: InstancedMesh;
  intensity: { value: number };
  /** kích thước vùng mưa quanh camera (m) */
  extent: number;
  height: number;
  count: number;
}

export function createRain(count = 20000, extent = 70, height = 24): Rain {
  const geo = new PlaneGeometry(0.012, 0.55);
  const intensity = uniform(1.0);
  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide });
  mat.color.setHex(0xaab8c8);
  mat.opacity = 0.35;

  const i = float(instanceIndex);
  const hx = hash(i);
  const hy = hash(i.add(1000.0));
  const hz = hash(i.add(2000.0));
  const speed = float(14.0).add(hash(i.add(3000.0)).mul(6.0));
  const ox = hx.mul(extent).sub(extent * 0.5);
  const oz = hz.mul(extent).sub(extent * 0.5);
  // Vùng mưa bám theo camera: px ∈ [cam.x − E/2, cam.x + E/2), hạt đứng yên trong thế giới cho tới khi wrap
  const half = extent * 0.5;
  const px = cameraPosition.x.add(mod(ox.sub(cameraPosition.x).add(half), extent)).sub(half);
  const pz = cameraPosition.z.add(mod(oz.sub(cameraPosition.z).add(half), extent)).sub(half);
  const py = mod(hy.mul(height).sub(time.mul(speed)), height);
  // Hạt ngoài "intensity" bị đẩy xuống dưới sàn (ẩn) để giảm mưa không cần đổi instance count
  const visible = hash(i.add(4000.0)).lessThan(intensity);
  const yFinal = visible.select(py, float(-50.0));
  mat.positionNode = positionLocal.add(vec3(px, yFinal, pz));

  const mesh = new InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  const dummy = new Object3D();
  dummy.updateMatrix();
  for (let k = 0; k < count; k++) mesh.setMatrixAt(k, dummy.matrix); // identity — vị trí thật tính trong shader
  mesh.instanceMatrix.needsUpdate = true;
  return { mesh, intensity, extent, height, count };
}
