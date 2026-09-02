/**
 * Collision layers (PRD §3.2 engine/physics: collision layers). Rapier InteractionGroups = (memberships << 16) | filter.
 * Collider của layer L: memberships = L, filter = ALL. Ray với mask M: memberships = ALL, filter = M.
 */
export const LAYER = { WORLD: 1, PLAYER: 2, ACTOR: 4, TRIGGER: 8 } as const;
export type Layer = (typeof LAYER)[keyof typeof LAYER];
export const ALL = 0xffff;

export function colliderGroups(layer: number, collidesWith = ALL): number {
  return ((layer & 0xffff) << 16) | (collidesWith & 0xffff);
}

export function rayGroups(hitMask: number): number {
  return ((ALL & 0xffff) << 16) | (hitMask & 0xffff);
}
