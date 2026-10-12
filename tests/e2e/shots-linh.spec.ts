/**
 * Ảnh kiểm chứng hệ chuyển động lính (DV-066) trong cảnh rừng Trường Sơn: đội hình đi/chạy, địch giơ súng ngắm thẳng vào
 * người chơi (xoay ngực + ngẩng), vừa đi vừa bắn (chân vẫn bước), xoay tại chỗ (ngực dẫn trước, chân theo sau), trúng đạn rồi ngã.
 * Không chạy trong CI: `DV_SHOTS=<thư mục> npx playwright test tests/e2e/shots-linh.spec.ts`.
 * Lính ở đây do script điều khiển (gỡ khỏi AI) để khung hình lặp lại được; ảnh SwiftShader chỉ để so, chấm thật trên Mac.
 */
import { test } from '@playwright/test';

const OUT = process.env.DV_SHOTS;

test.describe('ảnh lính DV-066', () => {
  test.skip(!OUT, 'chỉ chạy khi đặt DV_SHOTS');
  test('đội hình, ngắm, vừa đi vừa bắn, xoay tại chỗ, trúng đạn', async ({ page }) => {
    test.setTimeout(900_000);
    await page.goto(`/?backend=webgl&level=truong-son&autostart=1&debug=1&quality=low&shadow=1024${process.env.DV_SHOTS_Q ?? ''}`);
    await page.waitForFunction(() => window.__ht?.ready === true, null, { timeout: 300_000 });
    await page.waitForFunction(() => (window.__ht?.metrics().frames ?? 0) >= 2, null, { timeout: 300_000 });
    await page.evaluate(() => {
      const H = window.__ht!;
      const g = H.game as unknown as Record<string, unknown> & { stop(): void };
      g.stop();
      document.getElementById('hud')!.hidden = true;
      document.getElementById('subtitles')!.style.display = 'none';
      (g as unknown as { aiPaused: boolean }).aiPaused = true;
      // khung hình kiểu ống kính 50° (FOV chơi 90° làm lính nhỏ), ẩn súng góc nhìn 1
      (g as unknown as { player: { baseFov: number } }).player.baseFov = 50;
      (g as unknown as { vmScene: { visible: boolean } }).vmScene.visible = false;
      // các bot của nhiệm vụ: dời xa để không lọt khung
      for (const b of (g as unknown as { bots: Map<string, { bot: { position: number[] } }> }).bots.values()) b.bot.position[2] = (b.bot.position[2] ?? 0) + 400;
    });

    /** Đặt camera + kịch bản lính (chạy trong trang). */
    const scene = async (name: string, cam: { x: number; z: number; yaw: number; pitch: number }, actors: unknown[], pre: number, shots: number[]): Promise<void> => {
      await page.evaluate(
        async ({ name, cam, actors, pre, shots }) => {
          type Spec = { id: string; faction: 'friend' | 'enemy'; fwd: number; side: number; vel?: [number, number]; aim?: 'cam' | number; aiming?: boolean; fireEvery?: number; swingAt?: number; swingTo?: number; dieAt?: number; hitAt?: number };
          type Vis = {
            group: { position: { set(x: number, y: number, z: number): void; x: number; y: number; z: number }; rotation: { y: number }; visible: boolean };
            motion: { speed: number; aiming: boolean; yaw?: number; vx?: number; vz?: number; pitch?: number };
            setPose(t: number): void;
            onFire(): void;
            applyDamage(n: number, hit?: { from?: readonly [number, number, number]; zone?: string }): boolean;
            reset(): void;
          };
          const H = window.__ht!;
          const g = H.game as unknown as {
            bots: Map<string, unknown>;
            squadmates?: { remove(id: string): void };
            spawnBot(id: string, group: string, p: [number, number, number], o: { faction: 'friend' | 'enemy'; archetype?: 'grunt' | 'recon' | 'squad' }): { dummy: Vis };
            player: { rig: { yaw: number; pitch: number } };
            frame(dt: number): void;
          };
          const W = window as unknown as { __probe?: Record<string, Vis>; __shotTaken?: number; __shotReady?: number };
          W.__shotTaken = 0;
          W.__shotReady = 0;
          W.__probe ??= {};
          for (const v of Object.values(W.__probe)) v.group.visible = false;
          const hy = (x: number, z: number): number => H.terrainHeight(x, z) ?? 0;
          H.teleport(cam.x, hy(cam.x, cam.z) + 0.05, cam.z);
          g.player.rig.yaw = cam.yaw;
          g.player.rig.pitch = cam.pitch;
          const eye: [number, number, number] = [cam.x, hy(cam.x, cam.z) + 1.65, cam.z];
          const f = [-Math.sin(cam.yaw), -Math.cos(cam.yaw)];
          const r = [Math.cos(cam.yaw), -Math.sin(cam.yaw)];
          const list = (actors as Spec[]).map((s) => {
            let vis = W.__probe![s.id];
            if (!vis) {
              const b = g.spawnBot(s.id, 'probe', [cam.x, hy(cam.x, cam.z), cam.z], { faction: s.faction, archetype: s.faction === 'friend' ? 'squad' : 'grunt' });
              g.bots.delete(s.id);
              g.squadmates?.remove(s.id);
              vis = b.dummy;
              W.__probe![s.id] = vis;
            }
            vis.reset();
            vis.group.visible = true;
            const x = cam.x + f[0]! * s.fwd + r[0]! * s.side;
            const z = cam.z + f[1]! * s.fwd + r[1]! * s.side;
            return { s, vis, x, z, lastFire: -1, dead: false, hit: false, swung: false };
          });
          let t = 1000;
          const dt = 1 / 60;
          let elapsed = 0;
          const tick = (): void => {
            elapsed += dt;
            t += dt;
            for (const a of list) {
              const s = a.s;
              const [vf, vs] = s.vel ?? [0, 0];
              // vel in camera frame (fwd, side) → world
              const vx = f[0]! * vf + r[0]! * vs;
              const vz = f[1]! * vf + r[1]! * vs;
              if (!a.dead) {
                a.x += vx * dt;
                a.z += vz * dt;
              }
              const y = hy(a.x, a.z);
              a.vis.group.position.set(a.x, y, a.z);
              let yaw = typeof s.aim === 'number' ? s.aim : Math.atan2(-(eye[0] - a.x), -(eye[2] - a.z));
              if (s.aim === undefined) yaw = Math.hypot(vx, vz) > 0.1 ? Math.atan2(-vx, -vz) : cam.yaw + Math.PI;
              if (s.swingAt !== undefined && elapsed >= s.swingAt) yaw += s.swingTo ?? 0;
              const horiz = Math.hypot(eye[0] - a.x, eye[2] - a.z);
              const m = a.vis.motion;
              m.yaw = yaw;
              m.vx = a.dead ? 0 : vx;
              m.vz = a.dead ? 0 : vz;
              m.speed = Math.hypot(m.vx, m.vz);
              m.aiming = s.aiming ?? false;
              m.pitch = s.aim === 'cam' ? Math.atan2(eye[1] - (y + 1.6), Math.max(0.5, horiz)) : 0;
              if (s.fireEvery && !a.dead && elapsed - a.lastFire >= s.fireEvery) {
                a.vis.onFire();
                a.lastFire = elapsed;
              }
              if (s.hitAt !== undefined && !a.hit && elapsed >= s.hitAt) {
                a.hit = true;
                a.vis.applyDamage(10, { from: eye, zone: 'body' });
              }
              if (s.dieAt !== undefined && !a.dead && elapsed >= s.dieAt) {
                a.dead = true;
                a.vis.applyDamage(1000, { from: eye, zone: 'body' });
              }
              a.vis.setPose(t);
            }
          };
          while (elapsed < pre) tick();
          const frameOnce = (): Promise<void> =>
            new Promise<void>((res) =>
              requestAnimationFrame(() => {
                tick();
                g.frame(dt);
                res();
              }),
            );
          const marks = shots.slice();
          const W2 = W;
          for (const at of marks) {
            while (elapsed < at - 2 * dt) tick();
            await frameOnce();
            await frameOnce();
            W2.__shotReady = (W2.__shotReady ?? 0) + 1;
            // wait for the test to grab the screenshot
            await new Promise<void>((res) => {
              const w = window as unknown as { __shotTaken?: number };
              const iv = setInterval(() => {
                if ((w.__shotTaken ?? 0) >= W2.__shotReady!) {
                  clearInterval(iv);
                  res();
                }
              }, 20);
            });
          }
          void name;
        },
        { name, cam, actors, pre, shots },
      ).then(() => undefined);
    };

    // page.evaluate above awaits screenshot handshakes; run it concurrently with a screenshot loop
    const shoot = async (name: string, run: Promise<void>, count: number): Promise<void> => {
      for (let i = 0; i < count; i++) {
        await page.waitForFunction((k) => ((window as unknown as { __shotReady?: number }).__shotReady ?? 0) > k, i, { timeout: 300_000 });
        await page.screenshot({ path: `${OUT}/${name}-${i + 1}.png` });
        await page.evaluate((k) => ((window as unknown as { __shotTaken: number }).__shotTaken = k + 1), i);
      }
      await run;
    };

    const start = { x: -186, z: 524, yaw: Math.PI / 4, pitch: -0.08 };
    // 1. đội hình: đồng đội đi về phía camera + một người chạy ngang; địch đứng ngắm thẳng camera; địch vừa tiến vừa bắn
    await shoot(
      '1-doi-hinh',
      scene(
        'doi-hinh',
        start,
        [
          { id: 'p_walk', faction: 'friend', fwd: 9, side: -2.2, vel: [-1.3, 0] },
          { id: 'p_run', faction: 'friend', fwd: 12, side: -7, vel: [0, 3.6] },
          { id: 'p_aim', faction: 'enemy', fwd: 7, side: 2.6, aim: 'cam', aiming: true },
          { id: 'p_fire', faction: 'enemy', fwd: 13, side: 0.8, vel: [-1.1, 0], aim: 'cam', aiming: true, fireEvery: 0.13 },
        ],
        1.5,
        [1.6, 2.05],
      ),
      2,
    );
    // 2. xoay tại chỗ: địch đang ngắm camera, mục tiêu chuyển 100° sang trái → ngực dẫn, chân theo
    await shoot(
      '2-xoay',
      scene('xoay', { ...start, pitch: -0.1 }, [{ id: 'p_turn', faction: 'enemy', fwd: 4.2, side: 0, aim: 'cam', aiming: true, swingAt: 1.0, swingTo: (100 * Math.PI) / 180 }], 0.5, [0.95, 1.15, 1.45, 2.4]),
      4,
    );
    // 4. clip 8 hướng: địch vừa ngắm camera vừa đi ngang sang trái; một tên lùi về sau vẫn chĩa súng
    await shoot(
      '4-ngang-lui',
      scene(
        'ngang-lui',
        { ...start, pitch: -0.1 },
        [
          { id: 'p_strafe', faction: 'enemy', fwd: 6, side: 1.5, vel: [0, -1.6], aim: 'cam', aiming: true },
          { id: 'p_back', faction: 'friend', fwd: 4.5, side: -1.6, vel: [1.4, 0], aim: 'cam', aiming: true },
        ],
        0.6,
        [0.9, 1.15],
      ),
      2,
    );
    // 3. trúng đạn bên hông rồi gục (người bắn là camera)
    await shoot(
      '3-trung-dan',
      scene('trung-dan', { ...start, pitch: -0.12 }, [{ id: 'p_die', faction: 'enemy', fwd: 5, side: 0.5, vel: [0, 1.2], aiming: false, hitAt: 1.0, dieAt: 1.6 }], 0.5, [1.15, 1.75, 3.6]),
      3,
    );
  });
});
