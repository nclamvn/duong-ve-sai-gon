import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { Scene } from 'three/webgpu';
import { buildArena } from '@engine/render/arena';

/** Hash phần "sự thật" của ArenaData (collider/waypoint/cover/spawn/zone) — visual đổi (TIP-011) không được đổi hash này. */
export function arenaTruthHash(seed = 7): string {
  const a = buildArena(new Scene(), seed);
  const truth = {
    size: a.size,
    colliders: a.colliders.map((c) => [c.id, c.kind, c.position.map((v) => +v.toFixed(4)), c.size.map((v) => +v.toFixed(4)), +c.yaw.toFixed(4), c.material]),
    waypoints: a.waypoints,
    coverMarkers: a.coverMarkers.map((m) => [m.id, m.position.map((v) => +v.toFixed(4)), m.facing.map((v) => +v.toFixed(4))]),
    playerSpawn: a.playerSpawn,
    botSpawns: a.botSpawns,
    dummySpawns: a.dummySpawns,
    zones: a.zones,
    navMeshes: a.navGeometry.length,
  };
  return createHash('sha256').update(JSON.stringify(truth)).digest('hex');
}

describe('ArenaData truth (physics/nav/AI) bất biến qua các TIP visual', () => {
  it('hash collider/waypoint/spawn khớp snapshot G0', () => {
    // snapshot lấy tại commit 8802852 (G0 GO). Đổi giá trị này = đổi physics/nav/AI → phải có TIP + ADR riêng.
    expect(arenaTruthHash(7)).toBe('6a9af6f2555ab122f0ed5f64eec64529b50ae63d80264015ebbc406989d34b66');
  });
});
