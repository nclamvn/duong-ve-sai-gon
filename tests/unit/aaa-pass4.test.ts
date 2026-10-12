/**
 * DV-082 đồ hoạ AAA lượt 4: bùn bám chân chỉ cho thân có xương, chim/bướm instanced theo số con, nước suối có vị trí ngang
 * dòng và bọt trôi xuôi sau ghềnh.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, MeshStandardNodeMaterial, SkinnedMesh, Skeleton, Bone, BufferAttribute } from 'three/webgpu';
import { WEATHER } from '@engine/render/sceneLight';
import { applyEnvShading } from '@engine/render/envShade';
import { createWildlife } from '@engine/render/wildlife';
import { buildWater } from '@engine/terrain/water';
import type { TerrainFeaturesData } from '@engine/terrain/features';

describe('DV-082 bùn bám ủng/ống quần', () => {
  it('thân có xương nhận bùn (colorNode khác thân không xương), đồ rời không', () => {
    const g = new Group();
    const geo = new BoxGeometry(0.5, 180, 0.3); // đơn vị cm như Mixamo
    const n = geo.attributes['position']!.count;
    geo.setAttribute('skinIndex', new BufferAttribute(new Uint16Array(n * 4), 4));
    geo.setAttribute('skinWeight', new BufferAttribute(new Float32Array(n * 4).fill(0.25), 4));
    const body = new SkinnedMesh(geo, new MeshStandardMaterial());
    const bone = new Bone();
    body.add(bone);
    body.bind(new Skeleton([bone]));
    const helmet = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    g.add(body, helmet);
    WEATHER.forest.value = 0;
    expect(applyEnvShading(g)).toBe(0); // arena: không áp
    WEATHER.forest.value = 1;
    expect(applyEnvShading(g)).toBe(2);
    WEATHER.forest.value = 0;
    const bm = body.material as unknown as MeshStandardNodeMaterial;
    const hm = helmet.material as unknown as MeshStandardNodeMaterial;
    expect(bm.colorNode).toBeTruthy();
    expect(hm.colorNode).toBeTruthy();
    // khác cấu trúc node: thân có nhánh bùn
    expect(bm.colorNode).not.toBe(hm.colorNode);
    expect(geo.boundingBox).toBeTruthy();
  });
});

describe('DV-082 chim và bướm', () => {
  it('một mesh instanced mỗi loại, count = số con; 0 con thì không tạo', () => {
    const w = createWildlife({ birds: 63, bigBirds: 2, butterflies: 28 });
    expect(w.meshes.length).toBe(2);
    expect((w.meshes[0] as unknown as { count: number }).count).toBe(63 + 4);
    expect((w.meshes[1] as unknown as { count: number }).count).toBe(28);
    expect(w.meshes.every((m) => m.frustumCulled === false)).toBe(true);
    const none = createWildlife({ birds: 0, bigBirds: 0, butterflies: 0 });
    expect(none.meshes.length).toBe(0);
  });
});

describe('DV-082 nước suối', () => {
  it('dải suối có thuộc tính ngang dòng −1/0/1; bọt sinh ở ghềnh còn ở điểm sau (trôi xuôi)', () => {
    const data = JSON.parse(readFileSync('public/assets/terrain/truong-son-a/features.json', 'utf8')) as TerrainFeaturesData;
    const w = buildWater(data, { yOffset: 0 });
    const streams = w.group.getObjectByName('water_streams') as Mesh;
    const ac = streams.geometry.getAttribute('across');
    expect(ac).toBeTruthy();
    expect([ac.getX(0), ac.getX(1), ac.getX(2)]).toEqual([-1, 0, 1]);
    const fo = streams.geometry.getAttribute('foam');
    // có điểm không dốc (bọt riêng = 0) mà vẫn còn bọt trôi từ ghềnh phía trên
    let drifted = 0;
    for (let i = 1; i < fo.count; i += 3) if (fo.getX(i) > 0.05 && fo.getX(i) < 0.99) drifted++;
    expect(drifted).toBeGreaterThan(10);
    const craters = w.group.getObjectByName('water_craters') as Mesh | undefined;
    if (craters) expect(craters.geometry.getAttribute('across')).toBeTruthy();
  });
});
