/**
 * Vệt đạn đường dài cho hồi đêm (DV-078): đạn vạch đường 12,7 (xanh) bay lên máy bay và đạn 40/20/7,62 (đỏ) từ máy bay xuống —
 * dài hàng trăm mét đến hơn 1 km, ngoài khả năng của WeaponFx (vệt 5 m, 320 m/s). Một InstancedMesh hộp mảnh (gốc ở y = 0, dài
 * theo +y), màu HDR theo instance (bloom), không sương (đêm sương dày vẫn thấy vệt), bề rộng theo khoảng cách camera để không
 * mất hút ở xa. Ghi lại toàn bộ mỗi frame (begin → push → end).
 */
import { BoxGeometry, InstancedMesh, MeshBasicNodeMaterial, AdditiveBlending, Matrix4, Quaternion, Vector3, Color, Mesh, SphereGeometry, type Object3D } from 'three/webgpu';

const _m = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();
const _p = new Vector3();
const _d = new Vector3();
const _up = new Vector3(0, 1, 0);
const _c = new Color();

export class Streaks {
  readonly mesh: InstancedMesh;
  private n = 0;

  constructor(readonly capacity = 192) {
    const geo = new BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const mat = new MeshBasicNodeMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: AdditiveBlending });
    mat.fog = false;
    mat.toneMapped = false;
    this.mesh = new InstancedMesh(geo, mat, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.name = 'night_streaks';
    this.mesh.renderOrder = 30;
    for (let i = 0; i < capacity; i++) this.mesh.setColorAt(i, _c.setRGB(1, 1, 1));
  }

  begin(): void {
    this.n = 0;
  }

  /** vệt từ `a` tới `b`, rộng `w` (m), màu HDR (r,g,b) */
  push(a: readonly number[], b: readonly number[], w: number, r: number, g: number, bl: number): void {
    if (this.n >= this.capacity) return;
    _d.set(b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!);
    const len = _d.length();
    if (len < 1e-3) return;
    _d.divideScalar(len);
    _q.setFromUnitVectors(_up, _d);
    _p.set(a[0]!, a[1]!, a[2]!);
    _s.set(w, len, w);
    _m.compose(_p, _q, _s);
    this.mesh.setMatrixAt(this.n, _m);
    this.mesh.setColorAt(this.n, _c.setRGB(r, g, bl));
    this.n++;
  }

  end(): void {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  get count(): number {
    return this.n;
  }
}

/** chớp sáng ngắn (lửa đầu nòng máy bay/đại liên, tia lửa trúng thân máy bay): pool cầu additive không sương */
export class Flashes {
  private readonly pool: Array<{ mesh: Mesh; life: number; max: number; size: number }> = [];
  private head = 0;

  constructor(parent: Object3D, n = 12) {
    const geo = new SphereGeometry(1, 8, 6);
    for (let i = 0; i < n; i++) {
      const mat = new MeshBasicNodeMaterial({ color: 0xffd9a0, transparent: true, depthWrite: false, blending: AdditiveBlending });
      mat.fog = false;
      mat.toneMapped = false;
      const mesh = new Mesh(geo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 31;
      parent.add(mesh);
      this.pool.push({ mesh, life: 0, max: 0.05, size: 1 });
    }
  }

  fire(at: readonly number[], size: number, life: number, r = 1.6, g = 1.2, b = 0.7): void {
    const f = this.pool[this.head]!;
    this.head = (this.head + 1) % this.pool.length;
    f.mesh.position.set(at[0]!, at[1]!, at[2]!);
    f.size = size;
    f.life = life;
    f.max = life;
    (f.mesh.material as MeshBasicNodeMaterial).color.setRGB(r, g, b);
    f.mesh.scale.setScalar(size);
    f.mesh.visible = true;
  }

  update(dt: number): void {
    for (const f of this.pool) {
      if (!f.mesh.visible) continue;
      f.life -= dt;
      if (f.life <= 0) {
        f.mesh.visible = false;
        continue;
      }
      f.mesh.scale.setScalar(f.size * (0.6 + 0.4 * (f.life / f.max)));
    }
  }
}
