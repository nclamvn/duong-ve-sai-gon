/**
 * Hitscan (PRD WPN-002): local authoritative, cone spread deterministic (prng), damage zones, penetration chỉ cho
 * material allow-list và độ dày ≤ max. Không biết VFX — trả HitResult để weapon phát event.
 */
import type { Prng } from '@engine/core';
import type { PhysicsWorld, ColliderUserData } from '@engine/physics/world';
import { LAYER } from '@engine/physics/layers';
import type RAPIER from '@dimforge/rapier3d-compat';

const DEG = Math.PI / 180;

export interface HitResult {
  kind: 'world' | 'actor';
  point: [number, number, number];
  normal: [number, number, number];
  material: string;
  actorId: string | null;
  zone: 'head' | 'body' | null;
  damage: number;
  penetrated: boolean;
  distance: number;
}

export interface HitscanSpec {
  damage: { head: number; body: number };
  penetrationAllow: string[];
  penetrationMaxThickness: number;
  penetrationDamageMul: number;
  range: number;
}

/** Xoay hướng `dir` ngẫu nhiên trong nón spreadDeg (deterministic). Ghi vào out. */
export function applySpread(dir: [number, number, number], spreadDeg: number, prng: Prng, out: [number, number, number]): [number, number, number] {
  if (spreadDeg <= 0) {
    out[0] = dir[0];
    out[1] = dir[1];
    out[2] = dir[2];
    return out;
  }
  // góc lệch ~ sqrt(u) * spread để phân bố đều trên đĩa; phương vị đều
  const theta = Math.sqrt(prng.next()) * spreadDeg * DEG;
  const phi = prng.next() * Math.PI * 2;
  // basis vuông góc với dir
  const dx = dir[0];
  const dy = dir[1];
  const dz = dir[2];
  let ux: number;
  let uy: number;
  let uz: number;
  if (Math.abs(dy) < 0.99) {
    // u = normalize(cross(dir, up))
    ux = dz;
    uy = 0;
    uz = -dx;
  } else {
    ux = 1;
    uy = 0;
    uz = 0;
  }
  const ul = Math.hypot(ux, uy, uz) || 1;
  ux /= ul;
  uy /= ul;
  uz /= ul;
  // v = cross(dir, u)
  const vx = dy * uz - dz * uy;
  const vy = dz * ux - dx * uz;
  const vz = dx * uy - dy * ux;
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  const a = Math.cos(phi) * s;
  const b = Math.sin(phi) * s;
  out[0] = dx * c + ux * a + vx * b;
  out[1] = dy * c + uy * a + vy * b;
  out[2] = dz * c + uz * a + vz * b;
  const l = Math.hypot(out[0], out[1], out[2]) || 1;
  out[0] /= l;
  out[1] /= l;
  out[2] /= l;
  return out;
}

const scratchDir: [number, number, number] = [0, 0, 0];

export function resolveShot(
  world: PhysicsWorld,
  origin: [number, number, number],
  aimDir: [number, number, number],
  spreadDeg: number,
  spec: HitscanSpec,
  prng: Prng,
  exclude: RAPIER.Collider | undefined,
  results: HitResult[],
  hitMask: number = LAYER.WORLD | LAYER.ACTOR,
): HitResult[] {
  results.length = 0;
  const dir = applySpread(aimDir, spreadDeg, prng, scratchDir);
  let ox = origin[0];
  let oy = origin[1];
  let oz = origin[2];
  let remaining = spec.range;
  let mul = 1;
  let penetrated = false;
  for (let bounce = 0; bounce < 2; bounce++) {
    const hit = world.castRay(ox, oy, oz, dir[0], dir[1], dir[2], remaining, hitMask, exclude);
    if (!hit) break;
    const data: ColliderUserData | null = hit.data;
    const isActor = data?.kind === 'actor' || data?.kind === 'player';
    const zone = isActor ? (data?.zone ?? 'body') : null;
    const dmg = isActor ? (zone === 'head' ? spec.damage.head : spec.damage.body) * mul : 0;
    results.push({
      kind: isActor ? 'actor' : 'world',
      point: [hit.point[0], hit.point[1], hit.point[2]],
      normal: [hit.normal[0], hit.normal[1], hit.normal[2]],
      material: data?.material ?? 'concrete',
      actorId: isActor ? (data?.actorId ?? data?.id ?? null) : null,
      zone,
      damage: dmg,
      penetrated,
      distance: spec.range - remaining + hit.toi,
    });
    if (isActor) break;
    const mat = data?.material ?? 'concrete';
    const thick = data?.thickness ?? 1;
    if (!spec.penetrationAllow.includes(mat) || thick > spec.penetrationMaxThickness) break;
    // xuyên: tiếp tục từ điểm ra phía sau vật (thick + epsilon)
    const step = thick + 0.02;
    ox = hit.point[0] + dir[0] * step;
    oy = hit.point[1] + dir[1] * step;
    oz = hit.point[2] + dir[2] * step;
    remaining -= hit.toi + step;
    mul *= spec.penetrationDamageMul;
    penetrated = true;
    if (remaining <= 0) break;
  }
  return results;
}
