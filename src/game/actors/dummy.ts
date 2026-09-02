/**
 * Skinned dummy procedural (D-012): capsule 2 đoạn + 3 bone (hips, spine, head), animation sinh code.
 * Mục đích G0: đẩy skinning thật lên GPU để đo, làm bia cho hitscan (hitZones), làm thân cho bot.
 * Không có asset ngoài; không sao chép hình dạng nhân vật từ IP tham chiếu.
 */
import {
  SkinnedMesh, Skeleton, Bone, CapsuleGeometry, SphereGeometry, Mesh, Group, Float32BufferAttribute, Uint16BufferAttribute,
  MeshStandardNodeMaterial, Color,
} from 'three/webgpu';
import { createActorMaterial } from '@engine/render/materials';

export interface HitZones {
  /** tâm đầu (local, m) + bán kính */
  head: { center: [number, number, number]; radius: number };
  /** thân: capsule local từ y0→y1 với bán kính */
  body: { y0: number; y1: number; radius: number };
}

export const DUMMY_HIT_ZONES: HitZones = {
  head: { center: [0, 1.62, 0], radius: 0.16 },
  body: { y0: 0.35, y1: 1.4, radius: 0.28 },
};

export interface DummyOptions {
  color?: number;
  phase?: number;
}

export class Dummy {
  readonly group = new Group();
  readonly mesh: SkinnedMesh;
  readonly headMesh: Mesh;
  readonly bones: { hips: Bone; spine: Bone; head: Bone };
  readonly material: MeshStandardNodeMaterial;
  readonly hitZones = DUMMY_HIT_ZONES;
  health = 100;
  alive = true;
  phase: number;
  private readonly baseColor: Color;

  constructor(opts: DummyOptions = {}) {
    this.phase = opts.phase ?? 0;
    const color = opts.color ?? 0x7a8a6a;
    this.baseColor = new Color(color);
    this.material = createActorMaterial(color);

    // Thân: capsule cao ~1.45 m (0.35 → 1.45), bán kính 0.28
    const geo = new CapsuleGeometry(0.28, 0.85, 4, 12);
    geo.translate(0, 0.35 + 0.28 + 0.425, 0); // đáy capsule tại y=0.35
    const posAttr = geo.attributes.position!;
    const count = posAttr.count;
    const skinIndices = new Uint16Array(count * 4);
    const skinWeights = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const y = posAttr.getY(i);
      // bone 0 hips (y < 0.9), bone 1 spine (0.9–1.5), blend mềm quanh 0.9
      const w1 = Math.min(1, Math.max(0, (y - 0.7) / 0.4));
      skinIndices[i * 4] = 0;
      skinIndices[i * 4 + 1] = 1;
      skinWeights[i * 4] = 1 - w1;
      skinWeights[i * 4 + 1] = w1;
    }
    geo.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndices, 4));
    geo.setAttribute('skinWeight', new Float32BufferAttribute(skinWeights, 4));

    const hips = new Bone();
    hips.name = 'hips';
    hips.position.set(0, 0.35, 0);
    const spine = new Bone();
    spine.name = 'spine';
    spine.position.set(0, 0.55, 0);
    const head = new Bone();
    head.name = 'head';
    head.position.set(0, 0.6, 0);
    hips.add(spine);
    spine.add(head);
    const skeleton = new Skeleton([hips, spine, head]);

    this.mesh = new SkinnedMesh(geo, this.material);
    this.mesh.add(hips);
    this.mesh.bind(skeleton);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = true;

    // Đầu: sphere gắn vào bone head (không skinning) — bia headshot
    this.headMesh = new Mesh(new SphereGeometry(0.16, 12, 10), this.material);
    this.headMesh.position.set(0, 0.12, 0);
    this.headMesh.castShadow = true;
    head.add(this.headMesh);

    this.bones = { hips, spine, head };
    this.group.add(this.mesh);
    this.group.name = 'dummy';
  }

  /** Idle sway theo thời gian mô phỏng — cập nhật ở render (pose), không mutate gameplay. */
  setPose(t: number): void {
    if (!this.alive) return;
    const s = Math.sin(t * 1.7 + this.phase);
    this.bones.spine.rotation.z = s * 0.06;
    this.bones.spine.rotation.x = Math.cos(t * 1.1 + this.phase) * 0.04;
    this.bones.head.rotation.y = Math.sin(t * 0.8 + this.phase * 2) * 0.35;
  }

  applyDamage(amount: number): boolean {
    if (!this.alive) return false;
    this.health = Math.max(0, this.health - amount);
    if (this.health === 0) {
      this.alive = false;
      this.material.color.setHex(0x3a2a2a);
      this.group.rotation.x = -Math.PI / 2; // nằm
      this.group.position.y = 0.3;
      return true;
    }
    this.material.color.copy(this.baseColor).lerp(new Color(0xff5c5c), 1 - this.health / 100);
    return false;
  }

  reset(): void {
    this.health = 100;
    this.alive = true;
    this.material.color.copy(this.baseColor);
    this.group.rotation.set(0, 0, 0);
    this.group.position.y = 0;
    this.bones.spine.rotation.set(0, 0, 0);
    this.bones.head.rotation.set(0, 0, 0);
  }
}
