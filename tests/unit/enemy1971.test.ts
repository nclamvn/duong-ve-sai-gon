/**
 * TIP-D11c / DV-046 — địch 1971 "chuẩn rằn ri Mỹ": mũ sắt M1 + dây đeo M1956 procedural, M16A1 CC-BY là asset lịch sử có registry,
 * registry có fact ERDL/M1/M1956/M16A1. (Shader ERDL là TSL — kiểm bằng ảnh evidence, không unit.)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Box3, Object3D, Vector3 } from 'three/webgpu';
import { m1HelmetGeometry, m1956BeltGeometry, m1956SuspenderGeometry, attachGearUS1971, GEAR_US_TRIANGLES, M1_HEAD_OFFSET } from '@engine/render/gearUS1971';
import { findChestBone } from '@engine/render/gear1971';

const manifest = JSON.parse(readFileSync('content/assets/manifest.json', 'utf8')) as {
  assets: Array<{ id: string; license: string; historical?: boolean; registryId?: string; approved?: boolean; triangles?: { output: number }; files: Array<{ path: string }> }>;
};

describe('TIP-D11c địch 1971: mũ sắt M1 + M1956 procedural, M16A1 CC-BY', () => {
  it('mũ sắt M1: rộng 30–36 cm (sọ Swat ×1,35), dài hơn rộng, cao 15–19 cm, vành cụp dưới gốc ≤ 3 cm; tổng trang bị < 4 000 tam giác', () => {
    const h = m1HelmetGeometry();
    h.computeBoundingBox();
    const hs = h.boundingBox!.getSize(new Vector3());
    expect(hs.x).toBeGreaterThan(0.3);
    expect(hs.x).toBeLessThan(0.36);
    expect(hs.z).toBeGreaterThan(hs.x);
    expect(hs.y).toBeGreaterThan(0.15);
    expect(hs.y).toBeLessThan(0.19);
    expect(h.boundingBox!.min.y).toBeLessThan(0);
    expect(h.boundingBox!.min.y).toBeGreaterThan(-0.03);
    const b = m1956BeltGeometry();
    b.computeBoundingBox();
    const bs = b.boundingBox!.getSize(new Vector3());
    expect(bs.x).toBeGreaterThan(0.38); // vòng hông + bi đông/xẻng hai bên
    expect(bs.x).toBeLessThan(0.5);
    expect(b.boundingBox!.min.y).toBeLessThan(-0.12); // túi treo dưới thắt lưng
    const s = m1956SuspenderGeometry();
    s.computeBoundingBox();
    expect(s.boundingBox!.getSize(new Vector3()).y).toBeGreaterThan(0.25);
    const t = GEAR_US_TRIANGLES();
    expect(t.helmet + t.belt + t.suspenders).toBeLessThan(4000);
  });

  it('attachGearUS1971: mũ vào bone đầu (lên ≥ 10 cm, trùm sọ ±0,12), dây vai vào Spine2, thắt lưng vào Hips; thiếu bone → bỏ; dispose gỡ sạch', () => {
    const model = new Object3D();
    const head = new Object3D();
    head.name = 'mixamorig:Head';
    const spine2 = new Object3D();
    spine2.name = 'mixamorig:Spine2';
    const hips = new Object3D();
    hips.name = 'mixamorig:Hips';
    model.add(head, spine2, hips);
    const g = attachGearUS1971({ head, chest: findChestBone(model), hips });
    expect(g.helmet?.parent).toBe(head);
    expect(g.suspenders?.parent).toBe(spine2);
    expect(g.belt?.parent).toBe(hips);
    expect(M1_HEAD_OFFSET.pos.y).toBeGreaterThanOrEqual(0.1);
    head.updateMatrixWorld(true);
    const box = new Box3().setFromObject(g.helmet!);
    expect(box.min.x).toBeLessThan(-0.12);
    expect(box.max.x).toBeGreaterThan(0.12);
    expect(g.helmet!.children.map((c) => c.name).sort()).toEqual(['gear_m1_band', 'gear_m1_cover']);
    g.dispose();
    expect(g.helmet?.parent).toBeNull();
    expect(g.belt?.parent).toBeNull();
    expect(g.suspenders?.parent).toBeNull();
    const none = attachGearUS1971({ head: null, chest: null, hips: null });
    expect(none.helmet).toBeNull();
    expect(none.belt).toBeNull();
    expect(none.suspenders).toBeNull();
  });

  it('weapon_m16a1: CC-BY có attribution, historical + registryId wpn.us.m16a1 + approved=false, ≤ 20 k tam giác; registry có ERDL/M1/M1956/M16A1', () => {
    const a = manifest.assets.find((x) => x.id === 'weapon_m16a1');
    expect(a).toBeDefined();
    expect(a!.license).toBe('CC-BY-4.0');
    expect(a!.historical).toBe(true);
    expect(a!.registryId).toBe('wpn.us.m16a1');
    expect(a!.approved).toBe(false);
    expect(a!.triangles!.output).toBeLessThanOrEqual(20000);
    expect(a!.files.map((f) => f.path)).toContain('assets/weapons/m16a1.glb');
    const uni = readFileSync('content/registry/uniforms.yaml', 'utf8');
    const wpn = readFileSync('content/registry/weapons.yaml', 'utf8');
    for (const id of ['uni.us.1971.erdl_camo', 'uni.us.1971.helmet_m1_cover', 'uni.us.1956.web_gear']) expect(uni).toContain(`id: ${id}`);
    expect(wpn).toContain('id: wpn.us.m16a1');
    // attribution trong CREDITS.md (ADR-006)
    expect(readFileSync('CREDITS.md', 'utf8')).toContain('m16a1-gameasset-3579009c6e444cf5bd8d2646954e45d7');
  });
});
