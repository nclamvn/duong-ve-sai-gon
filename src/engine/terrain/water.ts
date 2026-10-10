/**
 * Mặt nước khe suối và hố bom đọng nước (DV-060). Hai lưới gộp (dải suối + đĩa hố) → 2 draw call.
 * Nước tháng 1: đục nâu xanh, nhám rất thấp để soi trời sương; mặt suối dốc theo đáy khe (polyline của features.json).
 */
import { BufferGeometry, BufferAttribute, Mesh, MeshStandardNodeMaterial, Color, Group } from 'three/webgpu';
import { attribute, float, mx_noise_float, positionWorld, time, vec2, vec3, normalize, transformNormalToView } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { TerrainFeaturesData } from './features';

export interface WaterOptions {
  /** trừ vào cao độ tuyệt đối (khớp TerrainTile.yOffset) */
  yOffset: number;
  /** mực nước trên đáy khe (m) */
  streamDepthM?: number;
  color?: number;
}

export interface WaterBuild {
  group: Group;
  streamTris: number;
  craterTris: number;
}

export function buildWater(data: TerrainFeaturesData, opts: WaterOptions): WaterBuild {
  const group = new Group();
  group.name = 'water';
  const mat = new MeshStandardNodeMaterial({ color: new Color(opts.color ?? 0x1c2315), roughness: 0.05, metalness: 0, transparent: true });
  mat.depthWrite = false;
  // mép nước trong dần (alpha theo đỉnh: giữa dòng/giữa hố đục, mép trong) để không thành tấm phẳng cắt cứng vào bờ
  mat.opacityNode = attribute('alpha', 'float') as unknown as Node<'float'>;
  // gợn nước nhỏ trôi chậm: nhiễu hai tầng làm lệch normal (soi trời sương thành vệt sáng loang)
  const p = positionWorld.xz;
  const t = time.mul(0.35);
  const nx = mx_noise_float(p.mul(0.9).add(vec2(t, t.mul(0.6)))).mul(0.06).add(mx_noise_float(p.mul(3.1).sub(vec2(t.mul(0.8), 0))).mul(0.025));
  const nz = mx_noise_float(p.mul(0.9).add(vec2(5.2, 1.3)).sub(vec2(t.mul(0.5), t))).mul(0.06).add(mx_noise_float(p.mul(3.1).add(vec2(2.7, t.mul(0.7)))).mul(0.025));
  mat.normalNode = transformNormalToView(normalize(vec3(nx, float(1), nz)));
  const depth = opts.streamDepthM ?? 0.28;

  // dải suối: mỗi điểm 2 đỉnh vuông góc hướng chảy, rộng = đáy khe + 0,4 m (mép nước chạm bờ)
  const sp: number[] = [];
  const sa: number[] = [];
  const si: number[] = [];
  for (const s of data.streams) {
    if (!s.water || s.pts.length < 2) continue;
    const base = sp.length / 3;
    for (let q = 0; q < s.pts.length; q++) {
      const p = s.pts[q]!;
      const a = s.pts[Math.max(0, q - 1)]!;
      const b = s.pts[Math.min(s.pts.length - 1, q + 1)]!;
      let tx = b[0] - a[0];
      let tz = b[1] - a[1];
      const L = Math.hypot(tx, tz) || 1;
      tx /= L;
      tz /= L;
      const hw = p[3] / 2 + 0.2;
      const y = p[2] + depth - opts.yOffset;
      sp.push(p[0] - tz * hw, y, p[1] + tx * hw, p[0], y, p[1], p[0] + tz * hw, y, p[1] - tx * hw);
      sa.push(0.04, 0.55, 0.04);
      if (q > 0) {
        const k = base + (q - 1) * 3;
        si.push(k, k + 3, k + 1, k + 1, k + 3, k + 4, k + 1, k + 4, k + 2, k + 2, k + 4, k + 5);
      }
    }
  }
  let streamTris = 0;
  if (si.length) {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(sp), 3));
    g.setAttribute('alpha', new BufferAttribute(new Float32Array(sa), 1));
    g.setIndex(si);
    g.computeVertexNormals();
    const m = new Mesh(g, mat);
    m.name = 'water_streams';
    m.receiveShadow = true;
    group.add(m);
    streamTris = si.length / 3;
  }

  // đĩa hố: bán kính mặt nước theo lòng bát h(d) ≈ đáy + (sâu + gờ)·d²
  const cp: number[] = [];
  const ca: number[] = [];
  const ci: number[] = [];
  const SEG = 20;
  for (const c of data.craters) {
    if (c.waterY === null) continue;
    const rr = c.r * Math.min(0.98, Math.sqrt(Math.max(0, c.waterY - c.bottom) / (c.depth + 0.45))) + 0.25;
    const y = c.waterY - opts.yOffset;
    const base = cp.length / 3;
    cp.push(c.x, y, c.z);
    ca.push(0.78);
    for (let k = 0; k < SEG; k++) {
      const a = (k / SEG) * Math.PI * 2;
      cp.push(c.x + Math.cos(a) * rr, y, c.z + Math.sin(a) * rr);
      ca.push(0.12);
      ci.push(base, base + 1 + ((k + 1) % SEG), base + 1 + k);
    }
  }
  let craterTris = 0;
  if (ci.length) {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(cp), 3));
    g.setAttribute('alpha', new BufferAttribute(new Float32Array(ca), 1));
    g.setIndex(ci);
    g.computeVertexNormals();
    const m = new Mesh(g, mat);
    m.name = 'water_craters';
    m.receiveShadow = true;
    group.add(m);
    craterTris = ci.length / 3;
  }
  return { group, streamTris, craterTris };
}
