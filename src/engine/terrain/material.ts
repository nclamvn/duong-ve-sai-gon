/**
 * Vật liệu terrain TSL (TIP-D04, PRD TER-002 rút gọn): vertex lấy cao độ từ texture RGBA8 (R,G = u16) tại
 * (positionGeometry.xz + chunkOffset), váy kéo xuống; fragment splat 4 lớp theo quy tắc slope/height/noise
 * (mùn lá mặc định · đất ướt thấp/thoải · đá dốc triplanar · cỏ tranh cao) + phá lặp hai tỉ lệ + wetness.
 * Normal per-pixel từ texture normal của ô (linear) + normal map lớp (tiếp tuyến xấp xỉ trục x/z).
 */
import { MeshStandardNodeMaterial, Color, type DataTexture } from 'three/webgpu';
import { attribute, positionGeometry, positionWorld, texture, triplanarTexture, transformNormalToView, vec2, vec3, vec4, float, mix, smoothstep, saturate, normalize, mx_noise_float, color, uniform } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { PbrTextureSet } from '../render/assets';
import type { TerrainTile } from './tile';
import { SKIRT_M } from './lod';

/** offset điểm nhận bóng dọc normal terrain (m) — texel CSM 0,1–0,4 m trên dốc; 0,35 m đủ hết acne, lệch bóng prop không đáng kể */
export const SHADOW_NORMAL_BIAS_M = 0.35;

export interface TerrainLayers {
  /** mặc định: mùn lá rừng */
  leaves: PbrTextureSet;
  /** thấp/thoải: đất ướt đường mòn */
  mud: PbrTextureSet;
  /** dốc: đá (triplanar) */
  rock: PbrTextureSet;
  /** cao/thoải: cỏ tranh, rêu */
  grass: PbrTextureSet;
}

export interface LayerTint {
  leaves: number;
  mud: number;
  rock: number;
  grass: number;
}

/** tint mặc định (nhân albedo) — Poly Haven chụp ôn đới, kéo về tông rừng nhiệt đới ẩm/đất đỏ */
export const DEFAULT_LAYER_TINT: LayerTint = { leaves: 0x9a8f6c, mud: 0xc98a62, rock: 0xd9dcd2, grass: 0xb4c86a };

export interface TerrainMaterialOptions {
  /** độ ướt 0..1 (mưa phùn M1) — giảm roughness lớp đất/mùn */
  wetness?: number;
  /** tile (m) lớp gần */
  tileMeters?: number;
  /** tint tổng (grade theo nhiệm vụ) */
  tint?: number;
  /** tint từng lớp (mặc định DEFAULT_LAYER_TINT) */
  layerTint?: LayerTint;
}

export interface TerrainMaterial {
  material: MeshStandardNodeMaterial;
  wetness: { value: number };
}

export function createTerrainMaterial(tile: TerrainTile, heightTex: DataTexture, normalTex: DataTexture, layers: TerrainLayers | null, opts: TerrainMaterialOptions = {}): TerrainMaterial {
  const half = float(tile.half);
  const n = float(tile.n);
  const res = float(tile.resM);
  const minY = float(tile.minY);
  const range = float(tile.maxY - tile.minY || 1);
  const wetness = uniform(opts.wetness ?? 0.2);
  const mat = new MeshStandardNodeMaterial();

  // ---------- vertex: cao độ từ texture (nearest, texel = đỉnh lưới)
  const off = attribute('chunkOffset', 'vec2') as unknown as Node<'vec2'>;
  const wx = positionGeometry.x.add(off.x);
  const wz = positionGeometry.z.add(off.y);
  const uvH = vec2(wx.add(half).div(res).add(0.5).div(n), wz.add(half).div(res).add(0.5).div(n));
  const hs = texture(heightTex, uvH).level(float(0));
  const h = minY.add(hs.r.mul(65280).add(hs.g.mul(255)).div(65535).mul(range));
  const skirt = attribute('skirt', 'float') as unknown as Node<'float'>;
  const y = h.sub(skirt.mul(SKIRT_M));
  const pos = vec3(wx, y, wz);
  mat.positionNode = pos;
  // bias bóng theo normal thật của terrain (geometry instanced không có normal per-vertex → normalBias mặc định = 0 → acne/vạch ngang trên sườn)
  const nV = normalize(texture(normalTex, uvH).level(float(0)).rgb.mul(2.0).sub(1.0));
  mat.receivedShadowPositionNode = pos.add(nV.mul(SHADOW_NORMAL_BIAS_M));

  // ---------- fragment: normal ô (linear) + slope/height
  const uvN = vec2(positionWorld.x.add(half).div(res).add(0.5).div(n), positionWorld.z.add(half).div(res).add(0.5).div(n));
  const nTile = normalize(texture(normalTex, uvN).rgb.mul(2.0).sub(1.0));
  const slope = nTile.y.oneMinus();
  const hN = saturate(positionWorld.y.sub(minY).div(range));
  const nz1 = mx_noise_float(positionWorld.xz.mul(0.02)).mul(0.5).add(0.5);
  const nz2 = mx_noise_float(positionWorld.xz.mul(0.006).add(vec2(13.7, 5.1))).mul(0.5).add(0.5);

  if (!layers) {
    // lite (?assets=0 / unit): màu theo slope/height, không texture
    const base = mix(color(new Color(0x4f5a2e)), color(new Color(0x6b5a3a)), smoothstep(0.05, 0.2, slope));
    const rockC = color(new Color(0x6f6a62));
    mat.colorNode = vec4(mix(base, rockC, smoothstep(0.22, 0.4, slope)), 1.0);
    mat.roughnessNode = float(0.95);
    mat.metalnessNode = float(0.0);
    mat.normalNode = transformNormalToView(nTile);
    return { material: mat, wetness };
  }

  const tileM = opts.tileMeters ?? 4.0;
  const uvA = positionWorld.xz.mul(1.0 / tileM);
  const uvB = positionWorld.xz.mul(1.0 / (tileM * 2.7)).add(vec2(0.37, 0.61));
  const kAnti = smoothstep(0.3, 0.7, nz1);
  /** lấy diff/nor/arm của một lớp với phá lặp hai tỉ lệ */
  const sampleLayer = (t: PbrTextureSet, anti: boolean): { c: Node<'vec3'>; nm: Node<'vec3'>; arm: Node<'vec3'> } => {
    const cA = texture(t.map, uvA);
    const nA = texture(t.normalMap, uvA);
    const aA = texture(t.armMap, uvA);
    if (!anti) return { c: cA.rgb, nm: nA.rgb, arm: aA.rgb };
    const cB = texture(t.map, uvB);
    const nB = texture(t.normalMap, uvB);
    const aB = texture(t.armMap, uvB);
    return { c: mix(cA.rgb, cB.rgb, kAnti), nm: mix(nA.rgb, nB.rgb, kAnti), arm: mix(aA.rgb, aB.rgb, kAnti) };
  };
  const L = sampleLayer(layers.leaves, true);
  const M = sampleLayer(layers.mud, true);
  const G = sampleLayer(layers.grass, false);
  const rockScale = float(1.0 / (tileM * 1.5));
  const R = {
    c: triplanarTexture(texture(layers.rock.map), null, null, rockScale, positionWorld, nTile).rgb,
    arm: triplanarTexture(texture(layers.rock.armMap), null, null, rockScale, positionWorld, nTile).rgb,
  };
  // tint lớp theo tham chiếu Trường Sơn: mùn lá tối ẩm; đất laterit đỏ nâu; cỏ tranh vàng xanh; đá xám xanh rêu
  const tint = opts.layerTint ?? DEFAULT_LAYER_TINT;
  L.c = L.c.mul(color(new Color(tint.leaves)));
  M.c = M.c.mul(color(new Color(tint.mud)));
  G.c = G.c.mul(color(new Color(tint.grass)));
  R.c = R.c.mul(color(new Color(tint.rock)));

  // ---------- trọng số lớp
  const rockW = smoothstep(0.22, 0.4, slope);
  const grassW = smoothstep(0.38, 0.62, hN).mul(smoothstep(0.26, 0.1, slope)).mul(smoothstep(0.28, 0.6, nz2));
  const mudW = saturate(smoothstep(0.14, 0.05, slope).mul(smoothstep(0.35, 0.12, hN).mul(0.6).add(smoothstep(0.45, 0.7, nz1).mul(0.5))));

  let albedo = L.c;
  let nm = L.nm;
  let arm = L.arm;
  albedo = mix(albedo, M.c, mudW);
  nm = mix(nm, M.nm, mudW);
  arm = mix(arm, M.arm, mudW);
  albedo = mix(albedo, G.c, grassW);
  nm = mix(nm, G.nm, grassW);
  arm = mix(arm, G.arm, grassW);
  albedo = mix(albedo, R.c, rockW);
  nm = mix(nm, vec3(0.5, 0.5, 1.0), rockW); // đá: chỉ albedo/arm triplanar, normal chi tiết tắt
  arm = mix(arm, R.arm, rockW);
  // biến thiên macro (đậm/nhạt theo noise lớn) chống phẳng
  const macro = mx_noise_float(positionWorld.xz.mul(0.0025).add(vec2(41.0, 7.0))).mul(0.12).add(1.0);
  albedo = albedo.mul(macro);
  if (opts.tint !== undefined) albedo = albedo.mul(color(new Color(opts.tint)));

  // ---------- normal: tiếp tuyến xấp xỉ theo trục x/z (địa hình gần ngang), OpenGL (+y = +z thế giới)
  const tn = nm.mul(2.0).sub(1.0);
  const detail = vec3(tn.x, 0.0, tn.y).mul(float(0.6).mul(rockW.oneMinus()));
  const nWorld = normalize(nTile.add(detail));

  const wetLayer = mudW.mul(0.8).add(float(0.35)).mul(rockW.oneMinus()).mul(wetness);
  mat.colorNode = vec4(mix(albedo, albedo.mul(0.72), wetLayer), 1.0);
  // roughness sàn cao: đất/mùn ẩm không bóng; ARM Poly Haven (0,5–0,7) làm mặt đất phản chiếu trời ở góc xiên → bạc/nhợt
  mat.roughnessNode = saturate(mix(float(0.92), arm.g, 0.3).sub(wetLayer.mul(0.2)));
  mat.metalnessNode = float(0.0);
  mat.aoNode = arm.r;
  mat.normalNode = transformNormalToView(nWorld);
  return { material: mat, wetness };
}
