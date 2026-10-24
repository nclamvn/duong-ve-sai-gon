import { test, expect } from '@playwright/test';
import { pauseLoop, expectNoErrors } from './helpers';

/**
 * DV-092 đoàn xe cháy dọc đường xe bờ tây suối (M1): xác Zil-157 cháy (vật liệu cháy dùng chung một shader), đường xe có
 * dải trống, navmesh vòng qua xác xe, người chơi không đi xuyên xác xe; ?hdr=1 trên WebGL (không có canvas HDR) chạy không lỗi.
 */
const QUERY = 'backend=webgl&level=truong-son-a&autostart=1&debug=1&quality=low&post=low&shadow=512&calm=1&hdr=1';

test.describe('DV-092 đoàn xe cháy', () => {
  test.setTimeout(400_000);
  test('xác xe, đường xe, navmesh, chặn người chơi, HDR không lỗi', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text());
    });
    await page.goto(`/?${QUERY}`);
    await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 300_000 });
    await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 2, null, { timeout: 200_000 });
    await pauseLoop(page);
    const r = await page.evaluate(() => {
      const H = window.__ht!;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = H.game as any;
      const level = g.terrainLevelDef;
      const wrecks = level.props.filter((p: { kind: string }) => p.kind === 'wreck');
      const groups = g.terrain.props.group.children.filter((c: { name: string }) => c.name.startsWith('wreck_'));
      // vật liệu cháy: mọi mesh xác xe dùng chung node màu (một chương trình shader)
      const colorNodes = new Set<unknown>();
      let meshes = 0;
      for (const grp of groups) {
        grp.traverse((o: { isMesh?: boolean; material?: { colorNode?: unknown; dvHeat?: number } }) => {
          if (!o.isMesh) return;
          meshes++;
          colorNodes.add(o.material!.colorNode);
        });
      }
      // navmesh: tâm xác xe không còn là chỗ đi được (điểm navmesh gần nhất cách tâm > 1 m)
      const navGap = wrecks.map((w: { position: [number, number] }) => {
        const y = g.terrain.heightAt(w.position[0], w.position[1]);
        const n = g.nav.nearest({ x: w.position[0], y, z: w.position[1] });
        return n ? Math.hypot(n.x - w.position[0], n.z - w.position[1]) : 99;
      });
      // đường xe: không thân cây có collider trong 2 m quanh tim đường
      const road = level.roads[0].pts as Array<[number, number]>;
      const dRoad = (x: number, z: number): number => {
        let best = 1e9;
        for (let i = 0; i + 1 < road.length; i++) {
          const a = road[i]!;
          const b = road[i + 1]!;
          const vx = b[0] - a[0];
          const vz = b[1] - a[1];
          const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz)));
          best = Math.min(best, Math.hypot(x - (a[0] + t * vx), z - (a[1] + t * vz)));
        }
        return best;
      };
      const trunksOnRoad = (g.forest?.system.colliders ?? []).filter((c: { position: number[] }) => dRoad(c.position[0]!, c.position[2]!) < 2).length;
      // người chơi chạy thẳng vào xác xe 1 không xuyên qua
      const w = wrecks[0];
      const yaw = w.yaw as number;
      const ax = -Math.cos(yaw);
      const az = Math.sin(yaw);
      // đứng cách tâm 6 m theo phương ngang thân xe rồi chạy vào tâm
      const sx = w.position[0] + az * 6;
      const sz = w.position[1] - ax * 6;
      H.teleport(sx, g.terrain.heightAt(sx, sz) + 0.3, sz);
      const toYaw = Math.atan2(-(w.position[0] - sx), -(w.position[1] - sz));
      g.player.rig.yaw = toYaw;
      g.input = {
        kind: 'replay',
        snapshot: (_t: number, o: Record<string, unknown>) => {
          o.fwd = 1;
          o.right = 0;
          o.sprint = true;
          o.crouch = false;
          o.jump = false;
          o.reload = false;
          o.interact = false;
          o.dx = 0;
          o.dy = 0;
          o.ads = false;
          o.fire = false;
        },
      };
      H.stepSim(180);
      const f = g.player.controller.feet as number[];
      const dCenter = Math.hypot(f[0]! - w.position[0], f[2]! - w.position[1]);
      g.input = g.defaultInput;
      for (let i = 0; i < 3; i++) g.frame(1 / 30);
      return { wrecks: wrecks.length, groups: groups.length, meshes, colorNodes: colorNodes.size, navGap, trunksOnRoad, dCenter, half: w.half };
    });
    console.log(JSON.stringify(r));
    expect(r.wrecks).toBe(5);
    expect(r.groups, 'mỗi xác xe một nhóm mô hình').toBe(5);
    expect(r.meshes).toBeGreaterThanOrEqual(5);
    expect(r.colorNodes, 'một node màu cháy dùng chung').toBe(1);
    for (const d of r.navGap) expect(d, 'navmesh vòng qua xác xe').toBeGreaterThan(1);
    expect(r.trunksOnRoad, 'đường xe không có thân cây').toBe(0);
    expect(r.dCenter, 'người chơi không đi xuyên xác xe').toBeGreaterThan(r.half[2] * 0.9);
    expectNoErrors(errors);
  });
});
