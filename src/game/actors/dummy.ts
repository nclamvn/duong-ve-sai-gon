/**
 * Soldier procedural (TIP-010, thay dummy capsule): hình nhân lính — helmet + visor phát sáng, giáp, ba lô, súng.
 * MỘT SkinnedMesh/actor: geometry gộp (BufferGeometryUtils.mergeGeometries), vertex color + attribute `emissive`,
 * 12 bone, animation sinh bằng code (idle / đi / aim / ngã). Không asset ngoài (PRD §9.2), không sao chép IP.
 * Giữ tên class `Dummy` + API cũ (group, mesh, bones, hitZones, applyDamage, reset, setPose) để không đụng
 * physics/hitscan/mission. hitZones KHÔNG đổi (head 1.62 r0.16 · body 0.35–1.4 r0.28).
 */
import {
  SkinnedMesh, Skeleton, Bone, Group, BoxGeometry, CylinderGeometry, SphereGeometry, CapsuleGeometry, BufferGeometry,
  Float32BufferAttribute, Uint16BufferAttribute, MeshStandardNodeMaterial, Color, Vector3,
} from 'three/webgpu';
import { attribute } from 'three/tsl';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface HitZones {
  head: { center: [number, number, number]; radius: number };
  body: { y0: number; y1: number; radius: number };
}

export const DUMMY_HIT_ZONES: HitZones = {
  head: { center: [0, 1.62, 0], radius: 0.16 },
  body: { y0: 0.35, y1: 1.4, radius: 0.28 },
};

export interface DummyOptions {
  /** màu giáp chính (mặc định olive graphite) */
  color?: number;
  /** màu visor phát sáng */
  visor?: number;
  phase?: number;
  /** trang bị procedural theo thời kỳ (TIP-D11a): 'pavn1971' = mũ cối + bao xe AK gắn bone (chỉ nhân vật glTF) */
  gear?: 'pavn1971';
}

type BoneName = 'hips' | 'spine' | 'head' | 'armL' | 'foreL' | 'armR' | 'foreR' | 'rifle' | 'thighL' | 'shinL' | 'thighR' | 'shinR';
const BONE_ORDER: BoneName[] = ['hips', 'spine', 'head', 'armL', 'foreL', 'armR', 'foreR', 'rifle', 'thighL', 'shinL', 'thighR', 'shinR'];

/** Vị trí rest (world/mesh space) của gốc mỗi bone và cha */
const REST: Record<BoneName, { parent: BoneName | null; pos: [number, number, number] }> = {
  hips: { parent: null, pos: [0, 0.95, 0] },
  spine: { parent: 'hips', pos: [0, 0.18, 0] }, // 1.13
  head: { parent: 'spine', pos: [0, 0.42, 0] }, // 1.55
  armL: { parent: 'spine', pos: [0.27, 0.34, 0] }, // vai trái 1.47
  foreL: { parent: 'armL', pos: [0, -0.28, 0] },
  armR: { parent: 'spine', pos: [-0.27, 0.34, 0] },
  foreR: { parent: 'armR', pos: [0, -0.28, 0] },
  rifle: { parent: 'spine', pos: [-0.04, 0.3, -0.1] }, // súng ngang ngực (≈1.43 m), nòng hướng −z (mặt trước)
  thighL: { parent: 'hips', pos: [0.11, -0.05, 0] },
  shinL: { parent: 'thighL', pos: [0, -0.42, 0] },
  thighR: { parent: 'hips', pos: [-0.11, -0.05, 0] },
  shinR: { parent: 'thighR', pos: [0, -0.42, 0] },
};

interface Part {
  geo: BufferGeometry;
  bone: BoneName;
  color: number;
  emissive?: number;
}

/** Đặt geometry vào không gian bone-local rồi dịch tới world-rest của bone; gán skinIndex/skinWeight/color/emissive. */
function bakePart(part: Part, boneIndex: number, boneWorld: Vector3): BufferGeometry {
  const g = part.geo;
  g.translate(boneWorld.x, boneWorld.y, boneWorld.z);
  const n = g.attributes['position']!.count;
  const idx = new Uint16Array(n * 4);
  const w = new Float32Array(n * 4);
  const col = new Float32Array(n * 3);
  const emi = new Float32Array(n * 3);
  const c = new Color(part.color);
  const e = new Color(part.emissive ?? 0x000000);
  for (let i = 0; i < n; i++) {
    idx[i * 4] = boneIndex;
    w[i * 4] = 1;
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
    emi[i * 3] = e.r;
    emi[i * 3 + 1] = e.g;
    emi[i * 3 + 2] = e.b;
  }
  g.setAttribute('skinIndex', new Uint16BufferAttribute(idx, 4));
  g.setAttribute('skinWeight', new Float32BufferAttribute(w, 4));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setAttribute('emissive', new Float32BufferAttribute(emi, 3));
  if (g.attributes['uv']) g.deleteAttribute('uv');
  return g;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, rot?: [number, number, number]): BufferGeometry {
  const g = new BoxGeometry(w, h, d);
  if (rot) g.rotateX(rot[0]).rotateY(rot[1]).rotateZ(rot[2]);
  g.translate(x, y, z);
  return g;
}
function cyl(r: number, h: number, x: number, y: number, z: number, seg = 10): BufferGeometry {
  const g = new CylinderGeometry(r, r * 0.92, h, seg);
  g.translate(x, y, z);
  return g;
}

export class Dummy {
  readonly group = new Group();
  readonly mesh: SkinnedMesh;
  readonly material: MeshStandardNodeMaterial;
  readonly bones: Record<BoneName, Bone>;
  readonly hitZones = DUMMY_HIT_ZONES;
  health = 100;
  alive = true;
  phase: number;
  /** trạng thái animation — Game/BotActor ghi */
  motion = { speed: 0, aiming: false };
  private walkPhase = 0;
  private lastT = 0;
  private deathT = -1;
  private readonly hitFlash = { until: 0 };

  constructor(opts: DummyOptions = {}) {
    this.phase = opts.phase ?? 0;
    const armor = opts.color ?? 0x3d453a;
    const visor = opts.visor ?? 0xff7a2a;
    const dark = 0x1c1f22;
    const pad = 0x2a2f2b;
    const gun = 0x33383e; // thép tối nhưng sáng hơn giáp ngực để nhìn rõ súng từ phía trước
    const skinTone = 0x2b2622; // balaclava/mặt nạ

    // --- Bones (rest pose)
    const bones = {} as Record<BoneName, Bone>;
    const world = {} as Record<BoneName, Vector3>;
    for (const name of BONE_ORDER) {
      const b = new Bone();
      b.name = name;
      const r = REST[name];
      b.position.set(r.pos[0], r.pos[1], r.pos[2]);
      bones[name] = b;
      if (r.parent) bones[r.parent]!.add(b);
      world[name] = r.parent ? world[r.parent]!.clone().add(b.position) : b.position.clone();
    }
    this.bones = bones;

    // --- Parts (bone-local geometry; bakePart dịch tới world rest)
    const parts: Part[] = [
      // hông + thắt lưng
      { geo: box(0.34, 0.16, 0.22, 0, 0.02, 0), bone: 'hips', color: pad },
      { geo: box(0.36, 0.05, 0.24, 0, 0.11, 0), bone: 'hips', color: dark },
      // thân + giáp ngực + ba lô + cổ
      { geo: box(0.38, 0.44, 0.24, 0, 0.2, 0), bone: 'spine', color: armor },
      { geo: box(0.32, 0.26, 0.06, 0, 0.24, -0.14), bone: 'spine', color: pad }, // giáp ngực (mặt trước −z)
      { geo: box(0.3, 0.34, 0.14, 0, 0.16, 0.18), bone: 'spine', color: dark }, // ba lô (sau lưng +z)
      { geo: cyl(0.06, 0.08, 0, 0.44, 0, 8), bone: 'spine', color: skinTone },
      // vai (pad)
      { geo: box(0.14, 0.1, 0.2, 0.27, 0.36, 0), bone: 'spine', color: pad },
      { geo: box(0.14, 0.1, 0.2, -0.27, 0.36, 0), bone: 'spine', color: pad },
      // đầu + helmet + vành + visor (emissive) + mặt nạ
      { geo: new SphereGeometry(0.11, 12, 10).translate(0, 0.1, 0), bone: 'head', color: skinTone },
      { geo: new SphereGeometry(0.145, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55).translate(0, 0.1, 0), bone: 'head', color: armor },
      { geo: box(0.3, 0.03, 0.3, 0, 0.09, -0.02), bone: 'head', color: dark },
      { geo: box(0.17, 0.045, 0.03, 0, 0.11, -0.125), bone: 'head', color: 0x000000, emissive: visor }, // visor phát sáng phía trước
      // tay: trên/cẳng (capsule) + bao tay
      { geo: new CapsuleGeometry(0.055, 0.2, 3, 8).translate(0, -0.14, 0), bone: 'armL', color: armor },
      { geo: new CapsuleGeometry(0.05, 0.18, 3, 8).translate(0, -0.13, 0), bone: 'foreL', color: pad },
      { geo: box(0.08, 0.08, 0.09, 0, -0.27, 0), bone: 'foreL', color: dark },
      { geo: new CapsuleGeometry(0.055, 0.2, 3, 8).translate(0, -0.14, 0), bone: 'armR', color: armor },
      { geo: new CapsuleGeometry(0.05, 0.18, 3, 8).translate(0, -0.13, 0), bone: 'foreR', color: pad },
      { geo: box(0.08, 0.08, 0.09, 0, -0.27, 0), bone: 'foreR', color: dark },
      // súng (bone rifle trong cẳng tay phải): thân, nòng, băng đạn, báng, ống ngắm
      { geo: box(0.05, 0.08, 0.5, 0, 0, -0.1), bone: 'rifle', color: gun },
      { geo: new CylinderGeometry(0.014, 0.014, 0.34, 8).rotateX(Math.PI / 2).translate(0, 0.02, -0.52), bone: 'rifle', color: gun },
      { geo: box(0.04, 0.16, 0.06, 0, -0.1, -0.06), bone: 'rifle', color: dark },
      { geo: box(0.05, 0.07, 0.22, 0, -0.01, 0.24), bone: 'rifle', color: pad },
      { geo: box(0.03, 0.05, 0.12, 0, 0.065, -0.02), bone: 'rifle', color: dark },
      // chân: đùi, cẳng, giày
      { geo: new CapsuleGeometry(0.075, 0.3, 3, 8).translate(0, -0.21, 0), bone: 'thighL', color: armor },
      { geo: box(0.13, 0.08, 0.15, 0, -0.32, -0.02), bone: 'thighL', color: pad }, // đệm gối
      { geo: new CapsuleGeometry(0.06, 0.3, 3, 8).translate(0, -0.2, 0), bone: 'shinL', color: pad },
      { geo: box(0.12, 0.1, 0.26, 0, -0.43, -0.05), bone: 'shinL', color: dark },
      { geo: new CapsuleGeometry(0.075, 0.3, 3, 8).translate(0, -0.21, 0), bone: 'thighR', color: armor },
      { geo: box(0.13, 0.08, 0.15, 0, -0.32, -0.02), bone: 'thighR', color: pad },
      { geo: new CapsuleGeometry(0.06, 0.3, 3, 8).translate(0, -0.2, 0), bone: 'shinR', color: pad },
      { geo: box(0.12, 0.1, 0.26, 0, -0.43, -0.05), bone: 'shinR', color: dark },
    ];
    const baked = parts.map((p) => bakePart(p, BONE_ORDER.indexOf(p.bone), world[p.bone]!));
    const merged = mergeGeometries(baked, false);
    if (!merged) throw new Error('soldier merge failed');
    merged.computeVertexNormals();
    for (const b of baked) b.dispose();

    this.material = new MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.2 });
    this.material.emissiveNode = attribute('emissive', 'vec3');

    this.mesh = new SkinnedMesh(merged, this.material);
    this.mesh.add(bones.hips);
    this.mesh.bind(new Skeleton(BONE_ORDER.map((n) => bones[n])));
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = true;
    this.group.add(this.mesh);
    this.group.name = 'soldier';
    this.applyRestPose();
  }

  private applyRestPose(): void {
    const b = this.bones;
    for (const name of BONE_ORDER) {
      const r = REST[name];
      b[name].position.set(r.pos[0], r.pos[1], r.pos[2]);
      b[name].rotation.set(0, 0, 0);
    }
    // tư thế cầm súng: tay phải gập cầm báng, tay trái vươn đỡ ốp lót, súng chĩa tới trước
    // (mặt trước là −z; rotation.x dương đưa tay về phía trước)
    b.armR.rotation.set(0.65, -0.3, -0.15);
    b.foreR.rotation.set(0.9, 0, 0);
    b.armL.rotation.set(0.95, 0.5, 0.2);
    b.foreL.rotation.set(0.5, -0.3, -0.3);
    b.rifle.rotation.set(0.05, 0, 0);
    b.spine.rotation.set(0.08, 0, 0);
  }

  /** Pose theo thời gian mô phỏng (giây). Gọi ở render. */
  setPose(t: number): void {
    const dt = this.lastT > 0 ? Math.min(0.1, Math.max(0, t - this.lastT)) : 0;
    this.lastT = t;
    if (!this.alive) {
      this.animateDeath(t);
      return;
    }
    const b = this.bones;
    const speed = this.motion.speed;
    const moving = speed > 0.3;
    this.walkPhase += dt * (moving ? 6.5 * Math.min(1.4, speed / 3.5) : 0);
    const ph = this.walkPhase;
    const amp = moving ? Math.min(1, speed / 3.5) * 0.62 : 0;
    const swingL = Math.sin(ph) * amp;
    const swingR = Math.sin(ph + Math.PI) * amp;
    b.thighL.rotation.x = swingL;
    b.thighR.rotation.x = swingR;
    b.shinL.rotation.x = Math.max(0, -Math.sin(ph - 0.6)) * amp * 1.3;
    b.shinR.rotation.x = Math.max(0, -Math.sin(ph + Math.PI - 0.6)) * amp * 1.3;
    // thở + nhấp nhô khi đi
    const breathe = Math.sin(t * 1.6 + this.phase) * 0.02;
    const bob = moving ? Math.abs(Math.sin(ph)) * 0.035 : 0;
    b.hips.position.y = REST.hips.pos[1] + bob;
    b.spine.rotation.x = 0.08 + breathe + (this.motion.aiming ? 0.06 : 0) + (moving ? 0.05 : 0);
    b.spine.rotation.y = moving ? Math.sin(ph) * 0.06 : Math.sin(t * 0.7 + this.phase) * 0.03;
    b.head.rotation.y = this.motion.aiming ? 0 : Math.sin(t * 0.8 + this.phase * 2) * 0.35;
    b.head.rotation.x = this.motion.aiming ? -0.1 : Math.sin(t * 0.5 + this.phase) * 0.06;
    // tay đung đưa nhẹ khi đi, nâng súng khi ngắm
    const aim = this.motion.aiming ? 1 : 0;
    b.armR.rotation.x = 0.65 + aim * 0.1 + (moving ? Math.sin(ph) * 0.05 : 0);
    b.armL.rotation.x = 0.95 + aim * 0.08 + (moving ? Math.sin(ph) * 0.05 : 0);
    b.rifle.rotation.x = 0.05 + aim * 0.08;
    b.rifle.position.y = REST.rifle.pos[1] + aim * 0.12;
    // hit flash: vertexColors nhân với material.color → overbright ngắn
    if (t < this.hitFlash.until) this.material.color.setRGB(2.6, 2.2, 2.0);
    else this.material.color.setRGB(1, 1, 1);
  }

  private animateDeath(t: number): void {
    if (this.deathT < 0) this.deathT = t;
    const k = Math.min(1, (t - this.deathT) / 0.35);
    const ease = 1 - (1 - k) * (1 - k);
    this.group.rotation.x = -Math.PI / 2 * ease;
    this.group.position.y = 0.25 * ease;
    const b = this.bones;
    b.armR.rotation.x = 0.65 - ease * 1.1;
    b.armL.rotation.x = 0.95 - ease * 1.3;
    b.thighL.rotation.x = ease * 0.3;
    b.thighR.rotation.x = -ease * 0.2;
  }

  applyDamage(amount: number): boolean {
    if (!this.alive) return false;
    this.health = Math.max(0, this.health - amount);
    this.hitFlash.until = this.lastT + 0.08;
    if (this.health === 0) {
      this.alive = false;
      this.deathT = -1;
      return true;
    }
    return false;
  }

  reset(): void {
    this.health = 100;
    this.alive = true;
    this.deathT = -1;
    this.walkPhase = 0;
    this.motion.speed = 0;
    this.motion.aiming = false;
    this.group.rotation.set(0, 0, 0);
    this.group.position.y = 0;
    this.material.color.setHex(0xffffff);
    this.applyRestPose();
  }
}
