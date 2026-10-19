/**
 * DV-088 vết cháy xém của vụ nổ trên mặt đất: lõi than đen, vành tro nâu xám, tia đất văng toả ra theo hình sao, mép bị nhiễu
 * gặm. Một InstancedMesh (1 draw call), vòng tròn 48 vết: vết cũ nhất nhường chỗ, còn lại ở nguyên tới hết màn (chiến trường
 * càng đánh càng loang lổ). Ô chưa dùng co về 0 nhưng vẫn vẽ → shader biên dịch lúc nạp, không giật ở vụ nổ đầu. TSL only.
 */
import { InstancedMesh, PlaneGeometry, MeshStandardNodeMaterial, Matrix4, Quaternion, Vector3, InstancedBufferAttribute, type Node } from 'three/webgpu';
import { float, vec2, vec3, uv, smoothstep, length, atan, mx_noise_float, attribute, varying, mix, fract } from 'three/tsl';

export interface Scorch {
  readonly mesh: InstancedMesh;
  /** vết cháy tại `p` (mặt đất), bán kính nổ `radius` (m), pháp tuyến mặt đất `n` */
  spawn(p: readonly [number, number, number], radius: number, n?: readonly [number, number, number], napalm?: boolean): void;
  readonly stats: { placed: number };
  reset(): void;
}

const CAP = 48;

function h1(i: number, k: number): number {
  let x = (i * 374761393 + k * 668265263) >>> 0;
  x = (x ^ (x >>> 13)) >>> 0;
  x = Math.imul(x, 1274126177) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

type F = Node<'float'>;

export function createScorch(): Scorch {
  const geo = new PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  // aSeed: hạt giống, napalm 0/1
  const seedAttr = new InstancedBufferAttribute(new Float32Array(CAP * 2), 2);
  geo.setAttribute('aSeed', seedAttr);
  const mat = new MeshStandardNodeMaterial({ transparent: true, depthWrite: false });
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -2;
  mat.polygonOffsetUnits = -4;
  const a = attribute('aSeed', 'vec2') as unknown as Node<'vec2'>;
  const vSeed = varying(a.x) as unknown as F;
  const vNap = varying(a.y) as unknown as F;
  const q = uv().sub(0.5);
  const r = length(q).mul(2);
  const ang = atan(q.y, q.x);
  // tia văng: nhiễu theo góc → mép ngoài dài ngắn khác nhau (hình sao bùng nổ)
  const rays = mx_noise_float(vec2(ang.mul(3.2), vSeed.mul(41))).mul(0.5).add(0.5);
  const fine = mx_noise_float(vec2(q.mul(9).add(vSeed.mul(7)))).mul(0.5).add(0.5);
  const blotch = mx_noise_float(vec2(q.mul(3.1).sub(vSeed.mul(13)))).mul(0.5).add(0.5);
  const reach = rays.mul(rays).mul(0.55).add(0.4);
  const rr = r.add(fine.sub(0.5).mul(0.22)).add(blotch.sub(0.5).mul(0.18));
  const outer = smoothstep(reach.mul(0.6), reach, rr).oneMinus() as unknown as F;
  const core = smoothstep(float(0.12), float(0.42), rr).oneMinus() as unknown as F;
  // than đen ở lõi, tro xám nâu ở vành, đất bị lật (nâu đỏ) loang theo blotch
  const char = vec3(0.018, 0.016, 0.014);
  const ash = mix(vec3(0.11, 0.095, 0.085), vec3(0.16, 0.09, 0.055), blotch.mul(fract(vSeed.mul(5.3))));
  const col = mix(ash, char, core.max(vNap.mul(0.5)));
  mat.colorNode = col;
  mat.opacityNode = outer.mul(mix(float(0.62), float(0.92), core)).mul(fine.mul(0.35).add(0.75)).min(0.95);
  mat.roughnessNode = float(1);
  mat.metalnessNode = float(0);
  const mesh = new InstancedMesh(geo, mat, CAP);
  mesh.name = 'blast_scorch';
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.renderOrder = 2;
  const zero = new Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < CAP; i++) mesh.setMatrixAt(i, zero);
  mesh.instanceMatrix.needsUpdate = true;

  const m = new Matrix4();
  const qn = new Quaternion();
  const qy = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const nv = new Vector3();
  const pos = new Vector3();
  const sc = new Vector3();
  let head = 0;
  const stats = { placed: 0 };
  const sa = seedAttr.array as Float32Array;

  return {
    mesh,
    stats,
    spawn(p, radius, n = [0, 1, 0], napalm = false) {
      const i = head;
      head = (head + 1) % CAP;
      const s = h1(stats.placed, 77);
      nv.set(n[0], n[1], n[2]).normalize();
      qn.setFromUnitVectors(up, nv);
      qy.setFromAxisAngle(up, s * Math.PI * 2);
      qn.multiply(qy);
      // vết rộng ~1,3× bán kính sát thương (napalm loang rộng hơn), dày đặc tối thiểu 2,4 m
      const d = Math.max(2.4, radius * (napalm ? 2.0 : 1.3) * 2) * (0.85 + 0.3 * h1(stats.placed, 91));
      pos.set(p[0], p[1], p[2]).addScaledVector(nv, 0.04);
      sc.set(d, 1, d);
      m.compose(pos, qn, sc);
      mesh.setMatrixAt(i, m);
      mesh.instanceMatrix.needsUpdate = true;
      sa[i * 2] = s;
      sa[i * 2 + 1] = napalm ? 1 : 0;
      seedAttr.needsUpdate = true;
      stats.placed++;
    },
    reset() {
      for (let i = 0; i < CAP; i++) mesh.setMatrixAt(i, zero);
      mesh.instanceMatrix.needsUpdate = true;
      head = 0;
    },
  };
}
