/**
 * Viewmodel của nghệ sĩ (DV-055): AK-47 + cánh tay AB3DX dùng NGUYÊN TRẠNG.
 *
 * Luật DV-054: không phẫu thuật mesh, không IK đè lên tay. Lớp này chỉ làm ba việc:
 *   1. đặt cả bộ vào khung camera viewmodel — một phép biến đổi cứng duy nhất, suy ra từ chính tư thế ngắm của
 *      nghệ sĩ: mắt nằm trên đường ngắm (xương `Sight` = khe thước ngắm), nhìn dọc trục nòng (trục +Z của xương
 *      `Grip`). Vì thế khi ngắm, đầu ruồi nằm đúng tâm màn hình mà không cần căn tay từng số;
 *   2. phát clip theo VmStateMachine (chọn và trộn, không giả động tác);
 *   3. trả điểm đầu nòng (xương `Barrel`) và cửa thoát vỏ đạn (`Bullet_Socket`) cho FX.
 */
import { Group, Object3D, Vector3, Quaternion, Matrix4, AnimationMixer, LoopOnce, LoopRepeat, Color, MeshStandardNodeMaterial, type AnimationAction, type AnimationClip, type Mesh, type MeshStandardMaterial } from 'three/webgpu';
import { recolorGreyFabricNode } from '@engine/render/camo';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { VmStateMachine, VM_CLIPS, type VmInput, type VmRequest } from './vmStates';

/**
 * Mắt lùi sau khe thước ngắm bao nhiêu, mét. 0,49 = đúng độ sâu tâm xương đầu của rig so với khe ngắm trong tư thế
 * ngắm của nghệ sĩ (đo trên clip Ads_idle_first), tức camera đặt đúng chỗ nghệ sĩ đặt khi dựng clip.
 */
export const EYE_RELIEF = 0.49;
/** góc nhìn dọc của camera viewmodel khi dùng rig này, độ — rig dựng cho máy quay đầu người, không co như súng rời */
export const ARTIST_VM_FOV = 75;

export interface ArtistViewmodelAsset {
  scene: Group;
  clips: AnimationClip[];
}

export interface ArtistViewmodelOptions {
  /** DV-065: màu vải tay áo (sRGB hex) theo gói phe; thiếu = giữ nguyên màu nghệ sĩ */
  sleeveColor?: number;
}

/** material tay AB3DX (vải tay áo xám + găng da) — chỉ những material này được nhuộm */
const ARMS_MATERIAL = /Manny/i;

/** thay material tay bằng bản node có colorNode nhuộm vải xám sang màu quân phục; găng/da giữ nguyên (mặt nạ bão hoà) */
function dyeSleeves(old: MeshStandardMaterial, color: number): MeshStandardNodeMaterial {
  const c = new Color(color); // Color.set từ hex sRGB → lưu linear
  const m = new MeshStandardNodeMaterial();
  m.name = `${old.name}_dyed`;
  m.map = old.map;
  m.normalMap = old.normalMap;
  m.normalScale.copy(old.normalScale);
  m.roughnessMap = old.roughnessMap;
  m.metalnessMap = old.metalnessMap;
  m.aoMap = old.aoMap;
  m.roughness = old.roughness;
  m.metalness = old.metalness;
  m.color.copy(old.color);
  m.side = old.side;
  m.transparent = old.transparent;
  m.alphaTest = old.alphaTest;
  if (old.map) m.colorNode = recolorGreyFabricNode(old.map, [c.r, c.g, c.b]);
  return m;
}

export class ArtistViewmodel {
  readonly root = new Group();
  readonly muzzle: Object3D;
  readonly eject: Object3D;
  readonly triangles: number;
  private readonly rig: Group;
  private readonly mixer: AnimationMixer;
  private readonly clips = new Map<string, AnimationClip>();
  private readonly sm: VmStateMachine;
  private current: AnimationAction | null = null;

  /** số material tay đã nhuộm (QA) */
  readonly dyedMaterials: number;

  constructor(asset: ArtistViewmodelAsset, opts: ArtistViewmodelOptions = {}) {
    this.root.name = 'artist_vm';
    this.rig = skeletonClone(asset.scene) as Group;
    let tris = 0;
    const dyed = new Map<unknown, MeshStandardNodeMaterial>();
    this.rig.traverse((o: Object3D) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      if (opts.sleeveColor !== undefined) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        const next = mats.map((mt) => {
          const sm = mt as MeshStandardMaterial;
          if (!ARMS_MATERIAL.test(sm.name)) return mt;
          let d = dyed.get(sm);
          if (!d) {
            d = dyeSleeves(sm, opts.sleeveColor!);
            dyed.set(sm, d);
          }
          return d;
        });
        m.material = Array.isArray(m.material) ? next : next[0]!;
      }
      m.castShadow = false;
      m.receiveShadow = false;
      m.frustumCulled = false; // xương kéo lưới ra ngoài bounding box gốc khi nạp đạn/kiểm súng
      const g = m.geometry;
      tris += (g.index ? g.index.count : g.attributes.position!.count) / 3;
    });
    this.triangles = Math.round(tris);
    this.dyedMaterials = dyed.size;
    for (const c of asset.clips) this.clips.set(c.name, c);
    this.mixer = new AnimationMixer(this.rig);

    const need = (name: string): Object3D => {
      const o = this.rig.getObjectByName(name);
      if (!o) throw new Error(`artist viewmodel: missing node ${name}`);
      return o;
    };
    this.muzzle = need('Barrel');
    this.eject = this.rig.getObjectByName('Bullet_Socket') ?? this.muzzle;

    this.alignToEye(need('Grip'), need('Sight'));
    this.root.add(this.rig);

    const durations: Record<string, number> = {};
    for (const [n, c] of this.clips) durations[n] = c.duration;
    this.sm = new VmStateMachine(durations);
    this.sm.draw();
  }

  /**
   * Đặt rig sao cho, ở khung cuối clip vào ngắm, mắt (gốc camera) nằm trên đường ngắm và nhìn dọc trục nòng.
   * Tính một lần lúc nạp; mọi clip khác chạy trong cùng khung này nên hông/chạy/nạp đạn tự rơi đúng chỗ.
   */
  private alignToEye(grip: Object3D, sight: Object3D): void {
    const ads = this.clips.get(VM_CLIPS.adsIn);
    if (ads) {
      const a = this.mixer.clipAction(ads);
      a.play();
      a.time = ads.duration;
      this.mixer.update(0);
    }
    this.rig.updateMatrixWorld(true);
    const q = new Quaternion();
    grip.getWorldQuaternion(q);
    const f = new Vector3(0, 0, 1).applyQuaternion(q);
    const u = new Vector3(0, 1, 0).applyQuaternion(q);
    const eye = new Vector3();
    sight.getWorldPosition(eye).addScaledVector(f, -EYE_RELIEF);
    // khung camera: −Z nhìn tới, +Y lên
    const zc = f.clone().negate();
    const yc = u.clone().addScaledVector(zc, -u.dot(zc)).normalize();
    const xc = new Vector3().crossVectors(yc, zc);
    const cam = new Matrix4().makeBasis(xc, yc, zc).setPosition(eye);
    cam.invert().decompose(this.rig.position, this.rig.quaternion, this.rig.scale);
    this.rig.updateMatrix();
    this.mixer.stopAllAction();
  }

  get fov(): number {
    return ARTIST_VM_FOV;
  }

  /** đang phát hành động (bắn/nạp/rút) — không xoay khối tay súng sang tư thế chạy */
  get busy(): boolean {
    return this.sm.busy;
  }

  onShot(adsNow: boolean): void {
    this.sm.shot(adsNow);
  }

  onReload(durationMs: number, empty: boolean): void {
    this.sm.reload(durationMs / 1000, empty);
  }

  inspect(): void {
    this.sm.inspect();
  }

  reset(): void {
    this.sm.reset();
    this.sm.draw();
  }

  update(dt: number, inp: VmInput): void {
    const req = this.sm.update(dt, inp);
    if (req) this.play(req);
    this.mixer.update(dt);
  }

  private play(r: VmRequest): void {
    const clip = this.clips.get(r.clip);
    if (!clip) return;
    const next = this.mixer.clipAction(clip);
    const same = next === this.current;
    next.enabled = true;
    next.setEffectiveTimeScale(r.timeScale);
    next.setEffectiveWeight(1);
    if (r.mode === 'loop') {
      next.setLoop(LoopRepeat, Infinity);
      next.clampWhenFinished = false;
      if (!same) next.reset();
    } else {
      next.setLoop(LoopOnce, 1);
      next.clampWhenFinished = true;
      if (r.mode === 'once') next.reset();
      else if (!same) {
        // hold: đứng ở khung cuối
        next.reset();
        next.time = clip.duration;
      }
    }
    next.play();
    if (this.current && !same) this.current.crossFadeTo(next, r.fade, false);
    else if (!this.current) next.fadeIn(r.fade);
    this.current = next;
  }
}
