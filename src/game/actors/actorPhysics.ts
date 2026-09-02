/**
 * Collider cho actor (dummy/bot): capsule body + ball head trên kinematic body, layer ACTOR, userData zone.
 * Dùng chung DUMMY_HIT_ZONES để hitscan (WPN-002 damage zones) và bot LOS.
 */
import type RAPIER from '@dimforge/rapier3d-compat';
import type { PhysicsWorld } from '@engine/physics/world';
import { LAYER } from '@engine/physics/layers';
import { DUMMY_HIT_ZONES, type HitZones } from './dummy';

export interface ActorBody {
  body: RAPIER.RigidBody;
  bodyCollider: RAPIER.Collider;
  headCollider: RAPIER.Collider;
  setPosition(x: number, y: number, z: number): void;
  setEnabled(on: boolean): void;
  dispose(): void;
}

export function attachActorBody(physics: PhysicsWorld, actorId: string, position: [number, number, number], zones: HitZones = DUMMY_HIT_ZONES): ActorBody {
  const b = zones.body;
  const halfHeight = (b.y1 - b.y0) / 2;
  const centerY = b.y0 + halfHeight;
  const { body, collider } = physics.addKinematicCapsule(
    [position[0], position[1] + centerY, position[2]],
    Math.max(0.01, halfHeight - b.radius),
    b.radius,
    { id: `${actorId}:body`, kind: 'actor', material: 'flesh', zone: 'body', actorId },
    LAYER.ACTOR,
  );
  const head = physics.addBallOnBody(body, [zones.head.center[0], zones.head.center[1] - centerY, zones.head.center[2]], zones.head.radius, { id: `${actorId}:head`, kind: 'actor', material: 'flesh', zone: 'head', actorId }, LAYER.ACTOR);
  return {
    body,
    bodyCollider: collider,
    headCollider: head,
    setPosition(x, y, z) {
      body.setNextKinematicTranslation({ x, y: y + centerY, z });
    },
    setEnabled(on) {
      collider.setEnabled(on);
      head.setEnabled(on);
    },
    dispose() {
      physics.removeBody(body);
    },
  };
}
