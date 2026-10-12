/**
 * Mặt nước khe suối và hố bom đọng nước (DV-060). Hai lưới gộp (dải suối + đĩa hố) → 2 draw call.
 * Nước tháng 1: đục nâu xanh, nhám rất thấp để soi trời sương; mặt suối dốc theo đáy khe (polyline của features.json).
 * DV-082: bọt kéo thành vệt dọc dòng (nhiễu giãn theo hướng chảy) và trôi xuôi sau ghềnh (bọt tắt dần ~75 %/9 m), đường bọt
 * mảnh sát hai bờ, lòng suối sâu sẫm hơn mép (thấy đáy ở mép), phản chiếu trời tăng theo góc xiên (Fresnel: nhìn xiên
 * mặt nước như gương, nhìn thẳng xuống thấy đáy); hố bom nước tù có váng rêu/lá trôi lấm tấm.
 */
import { BufferGeometry, BufferAttribute, Mesh, MeshStandardNodeMaterial, Color, Group } from 'three/webgpu';
import { attribute, float, mx_noise_float, positionWorld, time, vec2, vec3, normalize, transformNormalToView, uniform, fract, abs, mix, smoothstep, length, sin, exp, clamp, max, dot, pow, cameraPosition } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { TerrainFeaturesData } from './features';
import { canopyMap } from '../vegetation/canopy';

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
  /** DV-063: người lội (x, z thế giới, độ mạnh 0..1 theo tốc độ) → gợn vòng quanh chân; 0 = không */
  setWader(x: number, z: number, strength: number): void;
}

export function buildWater(data: TerrainFeaturesData, opts: WaterOptions): WaterBuild {
  const group = new Group();
  group.name = 'water';
  const mat = new MeshStandardNodeMaterial({ color: new Color(opts.color ?? 0x1c2315), roughness: 0.05, metalness: 0, transparent: true });
  mat.depthWrite = false;
  // mép nước trong dần (alpha theo đỉnh: giữa dòng/giữa hố đục, mép trong) để không thành tấm phẳng cắt cứng vào bờ
  // DV-063: nước chảy theo hướng dốc (flow theo polyline, tốc độ theo độ dốc đáy), bọt trắng ở đoạn dốc, gợn vòng quanh chân người lội.
  // Flow map hai pha (Vlachos 2010): nhiễu dời theo flow trong hai pha lệch nửa chu kỳ, trộn tam giác → không bị kéo xé theo thời gian.
  const flow = attribute('flow', 'vec2') as unknown as Node<'vec2'>;
  const foamA = attribute('foam', 'float') as unknown as Node<'float'>;
  // DV-082: vị trí ngang dòng −1 (bờ trái) … 0 (giữa) … 1 (bờ phải); hố: 0 tâm → 1 mép
  const across = attribute('across', 'float') as unknown as Node<'float'>;
  const p = positionWorld.xz;
  const T = time.mul(0.5);
  const ph0 = fract(T);
  const ph1 = fract(T.add(0.5));
  const w0 = float(1).sub(abs(ph0.mul(2).sub(1)));
  const w1 = float(1).sub(w0);
  const ripples = (q: Node<'vec2'>): Node<'vec2'> =>
    vec2(
      mx_noise_float(q.mul(0.9)).mul(0.06).add(mx_noise_float(q.mul(3.1).add(vec2(1.7, 4.2))).mul(0.03)),
      mx_noise_float(q.mul(0.9).add(vec2(5.2, 1.3))).mul(0.06).add(mx_noise_float(q.mul(3.1).add(vec2(2.7, 0.4))).mul(0.03)),
    ) as unknown as Node<'vec2'>;
  // nước đọng (flow 0): trôi chậm như cũ
  const still = vec2(time.mul(0.12), time.mul(0.07));
  const pa = p.sub(flow.mul(ph0.mul(2.0))).add(still);
  const pb = p.sub(flow.mul(ph1.mul(2.0))).add(still).add(vec2(0.37, 0.71));
  const n2 = ripples(pa as unknown as Node<'vec2'>).mul(w0).add(ripples(pb as unknown as Node<'vec2'>).mul(w1));
  // chỗ dốc gợn mạnh hơn (nước réo)
  const rough = float(1).add(foamA.mul(1.6));
  // gợn vòng quanh chân người lội: sóng tròn lan ra, tắt theo khoảng cách
  const wader = uniform(vec2(1e6, 1e6));
  const waderK = uniform(0);
  const dW = p.sub(wader);
  const rW = length(dW).max(0.001);
  const ring = sin(rW.mul(9.0).sub(time.mul(7.0))).mul(exp(rW.mul(-0.9))).mul(waderK).mul(0.35);
  const ringN = dW.div(rW).mul(ring);
  mat.normalNode = transformNormalToView(normalize(vec3(n2.x.mul(rough).add(ringN.x), float(1), n2.y.mul(rough).add(ringN.y))));
  // bọt: vệt trắng đục ở đoạn dốc, vỡ theo nhiễu trôi cùng dòng. DV-082: nhiễu giãn theo hướng chảy (dọc 0,4 · ngang 2,6)
  // → vệt bọt kéo dài như nước réo thật thay vì đốm tròn
  const spd = length(flow);
  const dirF = flow.div(spd.max(1e-4));
  const perp = vec2(dirF.y.negate(), dirF.x);
  const streakA = vec2(dot(pa, dirF).mul(0.4), dot(pa, perp).mul(2.6));
  const streakB = vec2(dot(pb, dirF).mul(0.4), dot(pb, perp).mul(2.6));
  const streaks = mx_noise_float(streakA).mul(w0).add(mx_noise_float(streakB).mul(w1));
  const foamNoise = mx_noise_float((pa as unknown as Node<'vec2'>).mul(2.2)).mul(w0).add(mx_noise_float((pb as unknown as Node<'vec2'>).mul(2.2)).mul(w1));
  const flowing = smoothstep(float(0.05), float(0.25), spd);
  const streakFoam = foamA.mul(smoothstep(float(0.05), float(0.45), streaks.mul(0.7).add(foamNoise.mul(0.3)))).mul(flowing);
  const blobFoam = foamA.mul(smoothstep(float(-0.15), float(0.35), foamNoise)).mul(float(1).sub(flowing));
  // đường bọt mảnh sát bờ (nước chạm đá/đất), đứt quãng theo nhiễu
  const a = abs(across);
  const shore = smoothstep(float(0.72), float(0.9), a).mul(smoothstep(float(0.92), float(1.02), a).oneMinus()).mul(smoothstep(float(0.0), float(0.4), foamNoise.add(0.2))).mul(flowing.mul(0.55).add(0.15));
  const foam = clamp(streakFoam.add(blobFoam).add(shore).add(ring.max(0).mul(0.6)), 0, 1);
  // nước tù (hố bom): váng rêu, lá vụn lấm tấm, nhiều hơn gần mép
  const scumN = mx_noise_float(p.mul(0.9).add(vec2(3.1, 8.4))).mul(0.6).add(mx_noise_float(p.mul(4.3)).mul(0.4));
  const scum = float(1).sub(flowing).mul(smoothstep(float(0.18), float(0.42), scumN)).mul(smoothstep(float(0.2), float(0.85), a)).mul(0.85);
  // lòng sâu sẫm, mép trong (thấy đáy)
  const base = new Color(opts.color ?? 0x1c2315);
  const deep = vec3(base.r * 0.6, base.g * 0.7, base.b * 0.65);
  const shallow = vec3(base.r * 1.6, base.g * 1.45, base.b * 1.2);
  const water = mix(deep, shallow, smoothstep(float(0.2), float(0.95), a));
  const withScum = mix(water, vec3(0.09, 0.1, 0.035), scum);
  mat.colorNode = mix(withScum, vec3(0.62, 0.64, 0.6), foam);
  mat.roughnessNode = mix(mix(float(0.05), float(0.6), scum), float(0.55), foam);
  // Fresnel (Schlick, n = 1,33): nhìn xiên mặt nước gần như gương đặc (thấy trời/tán phản chiếu), nhìn thẳng thấy đáy
  const V = normalize(cameraPosition.sub(positionWorld));
  const fres = float(0.02).add(float(0.98).mul(pow(float(1).sub(max(V.y, float(0))), float(5))));
  const alpha0 = attribute('alpha', 'float') as unknown as Node<'float'>;
  mat.opacityNode = max(max(alpha0.add(fres.mul(0.7)).min(0.97), foam.mul(0.85)), scum) as unknown as Node<'float'>;
  // dưới tán kín mặt nước soi tán tối chứ không soi trời sáng (IBL là ảnh trời trống): che phản chiếu theo độ che tán
  mat.aoNode = mix(float(1), float(0.4), canopyMap.sample()) as unknown as Node<'float'>;
  const depth = opts.streamDepthM ?? 0.28;

  // dải suối: mỗi điểm 2 đỉnh vuông góc hướng chảy, rộng = đáy khe + 0,4 m (mép nước chạm bờ)
  const sp: number[] = [];
  const sa: number[] = [];
  const sf: number[] = [];
  const sfo: number[] = [];
  const sac: number[] = [];
  const si: number[] = [];
  for (const s of data.streams) {
    if (!s.water || s.pts.length < 2) continue;
    const base = sp.length / 3;
    let drift = 0;
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
      // tốc độ theo độ dốc đáy quanh điểm (m/m): khe phẳng 0,3 m/s, ghềnh tới ~1,5 m/s
      const grade = Math.abs(b[2] - a[2]) / Math.max(0.5, L);
      const spd = 0.3 + Math.min(1.2, grade * 12);
      for (let r = 0; r < 3; r++) sf.push(tx * spd, tz * spd);
      // DV-082: bọt sinh ở ghềnh trôi xuôi và tan dần (~75 % mỗi điểm ~9 m)
      const fo0 = Math.min(1, Math.max(0, (grade - 0.04) / 0.1));
      drift = Math.max(fo0, drift * 0.75);
      const fo = drift;
      sfo.push(fo * 0.7, fo, fo * 0.7);
      sac.push(-1, 0, 1);
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
    g.setAttribute('flow', new BufferAttribute(new Float32Array(sf), 2));
    g.setAttribute('foam', new BufferAttribute(new Float32Array(sfo), 1));
    g.setAttribute('across', new BufferAttribute(new Float32Array(sac), 1));
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
  const cac: number[] = [];
  const ci: number[] = [];
  const SEG = 32;
  for (const c of data.craters) {
    if (c.waterY === null) continue;
    const rr = c.r * Math.min(0.98, Math.sqrt(Math.max(0, c.waterY - c.bottom) / (c.depth + 0.45))) + 0.25;
    const y = c.waterY - opts.yOffset;
    const base = cp.length / 3;
    cp.push(c.x, y, c.z);
    ca.push(0.78);
    cac.push(0);
    for (let k = 0; k < SEG; k++) {
      const a = (k / SEG) * Math.PI * 2;
      cp.push(c.x + Math.cos(a) * rr, y, c.z + Math.sin(a) * rr);
      ca.push(0.12);
      cac.push(1);
      ci.push(base, base + 1 + ((k + 1) % SEG), base + 1 + k);
    }
  }
  let craterTris = 0;
  if (ci.length) {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(cp), 3));
    g.setAttribute('alpha', new BufferAttribute(new Float32Array(ca), 1));
    g.setAttribute('flow', new BufferAttribute(new Float32Array((ca.length) * 2), 2));
    g.setAttribute('foam', new BufferAttribute(new Float32Array(ca.length), 1));
    g.setAttribute('across', new BufferAttribute(new Float32Array(cac), 1));
    g.setIndex(ci);
    g.computeVertexNormals();
    const m = new Mesh(g, mat);
    m.name = 'water_craters';
    m.receiveShadow = true;
    group.add(m);
    craterTris = ci.length / 3;
  }
  return {
    group,
    streamTris,
    craterTris,
    setWader: (x, z, strength) => {
      wader.value.set(x, z);
      waderK.value = strength;
    },
  };
}
