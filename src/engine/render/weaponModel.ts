/**
 * Model vũ khí glTF (TIP-014, ADR-006): loader + instance chia sẻ geometry/material, anchor (nòng, cửa thoát, tay cầm, đường ngắm,
 * băng đạn) và part chuyển động (băng đạn, bolt) theo cấu hình content/weapons/<id>.json.
 * Hệ model (convert-weapon.mjs): nòng −z, lên +y, gốc trên trục nòng giữa súng, đơn vị m.
 */
import { Group, Object3D, Vector3, Euler, Matrix4, Quaternion, type Texture } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export type Vec3Tuple = [number, number, number];
export interface WeaponPose {
  pos: Vec3Tuple;
  rot: Vec3Tuple;
}
export type AnchorName = 'muzzle' | 'eject' | 'gripR' | 'gripL' | 'sight' | 'magazine';
export interface WeaponModelConfig {
  id: string;
  asset: string;
  model: string;
  length: number;
  anchors: Record<AnchorName, Vec3Tuple>;
  parts: { magazine?: string; bolt?: string; boltTravel?: number };
  view: { scale: number; hip: WeaponPose; ads: WeaponPose; sprint: WeaponPose; sightDistance: number; alignSight?: boolean };
  /**
   * Bàn tay trên súng (TIP-016/017) — một sự thật cho cả tay FP lẫn lính: pose **bone bàn tay Mixamo trong hệ anchor**
   * gripR/gripL (pos m, rot Euler XYZ). FP: hand = anchor · pose. Lính: súng trong bone tay = inverse(pose) rồi dịch −gripR.
   */
  fp: { handR: WeaponPose; handL: WeaponPose; triggerFinger?: number };
}

export interface WeaponAsset {
  cfg: WeaponModelConfig;
  scene: Group;
  triangles: number;
  meshes: number;
}

export interface WeaponInstance {
  /** gốc = gốc model (trục nòng) */
  root: Group;
  model: Group;
  anchors: Record<AnchorName, Object3D>;
  parts: { magazine: Object3D | null; bolt: Object3D | null };
  /** vị trí nghỉ của part (để animate rồi trả về) */
  rest: { magazine: Vector3; bolt: Vector3 };
}

const ANCHORS: AnchorName[] = ['muzzle', 'eject', 'gripR', 'gripL', 'sight', 'magazine'];

let loader: GLTFLoader | null = null;
function gltf(): GLTFLoader {
  if (!loader) {
    loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
  }
  return loader;
}

export async function loadWeaponModel(url: string, cfg: WeaponModelConfig, anisotropy = 8): Promise<WeaponAsset> {
  const g = await gltf().loadAsync(url);
  let triangles = 0;
  let meshes = 0;
  g.scene.traverse((o: Object3D) => {
    const m = o as Object3D & { isMesh?: boolean; geometry?: { index: { count: number } | null; attributes: { position: { count: number } } }; material?: { map?: Texture | null; normalMap?: Texture | null; roughnessMap?: Texture | null } };
    if (!m.isMesh || !m.geometry) return;
    meshes++;
    triangles += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
    for (const t of [m.material?.map, m.material?.normalMap, m.material?.roughnessMap]) if (t) t.anisotropy = anisotropy;
  });
  g.scene.name = `weapon_${cfg.id}`;
  return { cfg, scene: g.scene, triangles: Math.round(triangles), meshes };
}

export function poseToVectors(p: WeaponPose): { pos: Vector3; rot: Euler } {
  return { pos: new Vector3(p.pos[0], p.pos[1], p.pos[2]), rot: new Euler(p.rot[0], p.rot[1], p.rot[2]) };
}

/** Ma trận local của một pose (pos + Euler XYZ), scale 1. */
export function poseToMatrix(p: WeaponPose, out = new Matrix4()): Matrix4 {
  const { pos, rot } = poseToVectors(p);
  return out.compose(pos, new Quaternion().setFromEuler(rot), new Vector3(1, 1, 1));
}

/** Clone chia sẻ geometry/material; anchor = Object3D con của root (world position lấy qua getWorldPosition). */
export function instantiateWeapon(asset: WeaponAsset, opts: { castShadow?: boolean; receiveShadow?: boolean } = {}): WeaponInstance {
  const root = new Group();
  root.name = `weapon_${asset.cfg.id}_inst`;
  const model = asset.scene.clone(true);
  model.traverse((o: Object3D) => {
    const m = o as Object3D & { isMesh?: boolean };
    if (m.isMesh) {
      m.castShadow = opts.castShadow ?? true;
      m.receiveShadow = opts.receiveShadow ?? false;
      m.frustumCulled = false;
    }
  });
  root.add(model);
  const anchors = {} as Record<AnchorName, Object3D>;
  for (const name of ANCHORS) {
    const a = new Object3D();
    a.name = name;
    const v = asset.cfg.anchors[name];
    a.position.set(v[0], v[1], v[2]);
    root.add(a);
    anchors[name] = a;
  }
  const magazine = asset.cfg.parts.magazine ? (model.getObjectByName(asset.cfg.parts.magazine) ?? null) : null;
  const bolt = asset.cfg.parts.bolt ? (model.getObjectByName(asset.cfg.parts.bolt) ?? null) : null;
  return {
    root,
    model,
    anchors,
    parts: { magazine, bolt },
    rest: { magazine: magazine ? magazine.position.clone() : new Vector3(), bolt: bolt ? bolt.position.clone() : new Vector3() },
  };
}
