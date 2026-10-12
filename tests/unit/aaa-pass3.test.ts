/**
 * DV-081 đồ hoạ AAA lượt 3: trường cao độ cho sương sát đất (chính xác cm, nội suy tuyến tính), material nhân vật dưới tán
 * (áp một lần, giữ màu nhuộm/map, phát sáng gốc cho chớp trúng đạn), cấu hình sương M1.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { DataUtils, MeshStandardNodeMaterial, MeshStandardMaterial, Mesh, BoxGeometry, Group } from 'three/webgpu';
import { TerrainTile, type TerrainMeta } from '@engine/terrain/tile';
import { makeHeightField } from '@engine/terrain/heightField';
import { WEATHER } from '@engine/render/sceneLight';
import { applyEnvShading, shadeMaterial } from '@engine/render/envShade';

const DIR = 'public/assets/terrain/truong-son-a';
function loadTile(): TerrainTile {
  const meta = JSON.parse(readFileSync(`${DIR}/meta.json`, 'utf8')) as TerrainMeta;
  const buf = readFileSync(`${DIR}/height.r16`);
  return new TerrainTile(meta, new Uint16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), 0);
}

describe('DV-081 trường cao độ sương sát đất', () => {
  const tile = loadTile();
  const hf = makeHeightField(tile);
  const img = hf.texture.image as { data: Uint16Array; width: number };
  const m = img.width;
  const at = (i: number, j: number): number => DataUtils.fromHalfFloat(img.data[(j * m + i) * 2]!) + DataUtils.fromHalfFloat(img.data[(j * m + i) * 2 + 1]!) + hf.minY;
  it('≤ 512², phủ cả ô, tâm texel khớp cao độ ô (sai số < 5 cm dù đồi cao vài trăm mét)', () => {
    expect(m).toBeLessThanOrEqual(512);
    expect(hf.size).toBeGreaterThanOrEqual(tile.sizeM);
    const texel = hf.size / m;
    let worst = 0;
    for (const [i, j] of [[0, 0], [m - 1, m - 1], [Math.floor(m / 3), Math.floor(m / 2)], [100, Math.floor(m * 0.8)], [Math.floor(m * 0.9), 59]] as const) {
      const x = hf.x0 + (i + 0.5) * texel;
      const z = hf.z0 + (j + 0.5) * texel;
      const e = Math.abs(at(i, j) - tile.sample(Math.min(x, tile.half), Math.min(z, tile.half)));
      worst = Math.max(worst, e);
    }
    expect(tile.maxY - tile.minY).toBeGreaterThan(100);
    expect(worst).toBeLessThan(0.05);
  });
});

describe('DV-081 material nhân vật dưới tán', () => {
  it('áp một lần; giữ colorNode nhuộm; có ao/roughness/emissive node; đổi material cổ điển sang node', () => {
    const dyed = new MeshStandardNodeMaterial();
    const marker = dyed.colorNode;
    expect(marker).toBeNull();
    shadeMaterial(dyed);
    const first = dyed.colorNode;
    shadeMaterial(dyed);
    expect(dyed.colorNode).toBe(first);
    expect(dyed.aoNode).toBeTruthy();
    expect(dyed.roughnessNode).toBeTruthy();
    expect(dyed.emissiveNode).toBeTruthy();
    const g = new Group();
    const classic = new MeshStandardMaterial({ color: 0x556644, roughness: 0.8 });
    const a = new Mesh(new BoxGeometry(), classic);
    const b = new Mesh(new BoxGeometry(), classic);
    g.add(a, b);
    WEATHER.forest.value = 0;
    expect(applyEnvShading(g)).toBe(0); // arena: không áp
    WEATHER.forest.value = 1;
    expect(applyEnvShading(g)).toBe(2);
    WEATHER.forest.value = 0;
    expect((a.material as unknown as { isNodeMaterial: boolean }).isNodeMaterial).toBe(true);
    // cùng nguồn → cùng bản node (đồ dùng chung không nhân đôi shader)
    expect(a.material).toBe(b.material);
    expect((a.material as unknown as MeshStandardNodeMaterial).roughness).toBe(0.8);
  });
});

describe('DV-081 cấu hình M1', () => {
  // DV-086 (Chủ nhà chơi trên Mac: "màn hình mờ đục"): sương loãng hơn, tầm nhìn sát đất 150–400 m
  it('sương sát đất bật, mật độ hợp lý (tầm nhìn sát đất 150–400 m), thang cao 1–4 m', () => {
    const lvl = JSON.parse(readFileSync('content/levels/truong-son-a.level.json', 'utf8'));
    const mist = lvl.post.volumetric.mist;
    expect(3 / mist.density).toBeGreaterThan(150);
    expect(3 / mist.density).toBeLessThan(400);
    expect(mist.height).toBeGreaterThan(1);
    expect(mist.height).toBeLessThan(4);
  });
});
