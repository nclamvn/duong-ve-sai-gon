import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Box3, Object3D, Vector3 } from 'three/webgpu';
import { pithHelmetGeometry, chestRigGeometry, attachGear1971, findChestBone, GEAR_TRIANGLES, HELMET_HEAD_OFFSET } from '@engine/render/gear1971';

const manifest = JSON.parse(readFileSync('content/assets/manifest.json', 'utf8')) as {
  assets: Array<{ id: string; historical?: boolean; registryId?: string; approved?: boolean; sourceFiles?: Array<{ path: string }>; triangles?: { source: number; output: number }; use?: string }>;
};

describe('TIP-D11a lính QGP 1971: retexture Swat Guy + trang bị procedural', () => {
  it('soldier_mixamo là asset lịch sử: historical, registryId uni.pavn.1971.*, approved=false (tier H — DV-009), nguồn ghi vải CC0 + GLB gốc', () => {
    const a = manifest.assets.find((x) => x.id === 'soldier_mixamo');
    expect(a).toBeTruthy();
    expect(a!.historical).toBe(true);
    expect(a!.registryId).toMatch(/^uni\.pavn\.1971\./);
    expect(a!.approved).toBe(false);
    expect(a!.use).toMatch(/retexture-1971/);
    const src = (a!.sourceFiles ?? []).map((f) => f.path).join(' ');
    expect(src).toMatch(/soldier-swat\.glb/);
    expect(src).toMatch(/stretch_poplin/);
    // bỏ gear hiện đại: còn ≤ 45 % tam giác gốc (Swat 46 297 → ~17 000)
    expect(a!.triangles!.output / a!.triangles!.source).toBeLessThan(0.45);
    expect(a!.triangles!.output).toBeGreaterThan(12000);
  });

  it('registry có mục mũ cối / dép cao su / quân phục / bao xe 1971 (uniforms.yaml) — asset trỏ vào id tồn tại', () => {
    const reg = readFileSync('content/registry/uniforms.yaml', 'utf8');
    for (const id of ['uni.pavn.1971.helmet_pith', 'uni.pavn.1971.sandals_rubber', 'uni.pavn.1971.field_uniform_green', 'uni.pavn.1971.chest_rig_type56']) expect(reg).toContain(`id: ${id}`);
    const a = manifest.assets.find((x) => x.id === 'soldier_mixamo')!;
    expect(reg).toContain(`id: ${a.registryId}`);
  });

  it('mũ cối: kích thước theo registry (~29–31 × 33–36 cm, cao 12–15 cm), gốc ở mặt vành; bao xe 3 túi ~27–32 cm ngang; tổng < 3 000 tam giác', () => {
    const h = pithHelmetGeometry();
    h.computeBoundingBox();
    const hb = h.boundingBox!;
    const hs = hb.getSize(new Vector3());
    expect(hs.x).toBeGreaterThan(0.29);
    expect(hs.x).toBeLessThan(0.40);
    expect(hs.z).toBeGreaterThan(hs.x); // dài hơn rộng (trước–sau)
    expect(hs.y).toBeGreaterThan(0.12);
    expect(hs.y).toBeLessThan(0.16);
    expect(hb.min.y).toBeLessThan(0); // vành nghiêng xuống dưới gốc
    expect(hb.min.y).toBeGreaterThan(-0.04);
    const r = chestRigGeometry();
    r.computeBoundingBox();
    const rs = r.boundingBox!.getSize(new Vector3());
    expect(rs.x).toBeGreaterThan(0.27);
    expect(rs.x).toBeLessThan(0.34);
    expect(rs.y).toBeGreaterThan(0.25); // túi + dây vai
    const t = GEAR_TRIANGLES();
    expect(t.helmet + t.rig).toBeLessThan(3000);
  });

  it('attachGear1971 gắn vào bone đầu/ngực (offset mũ: lên ≥ 10 cm để vành trên lông mày), thiếu bone → bỏ qua, dispose gỡ sạch', () => {
    const model = new Object3D();
    const head = new Object3D();
    head.name = 'mixamorig:Head';
    const spine2 = new Object3D();
    spine2.name = 'mixamorig:Spine2';
    model.add(head, spine2);
    expect(findChestBone(model)).toBe(spine2);
    const g = attachGear1971({ head, chest: findChestBone(model) });
    expect(g.helmet?.parent).toBe(head);
    expect(g.rig?.parent).toBe(spine2);
    expect(HELMET_HEAD_OFFSET.pos.y).toBeGreaterThanOrEqual(0.1);
    // mũ bao trùm quanh gốc bone (sọ Swat rộng ±0,11 m)
    head.updateMatrixWorld(true);
    const box = new Box3().setFromObject(g.helmet!);
    expect(box.min.x).toBeLessThan(-0.12);
    expect(box.max.x).toBeGreaterThan(0.12);
    g.dispose();
    expect(g.helmet?.parent).toBeNull();
    expect(g.rig?.parent).toBeNull();
    const none = attachGear1971({ head: null, chest: null });
    expect(none.helmet).toBeNull();
    expect(none.rig).toBeNull();
  });
});
