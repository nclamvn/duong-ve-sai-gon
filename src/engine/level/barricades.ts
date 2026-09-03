/**
 * Chướng ngại/xác xe procedural (TIP-019): bao cát, rào bê tông, xác ô tô / xe buýt / xe bọc thép cháy đen, sạp chợ có bạt,
 * đống đổ nát, lốp xe, tấm tôn bay. Mỗi thứ → geometry gộp theo material + collider hộp + cover marker quanh (mặt che).
 * Model thật (Sketchfab CC-BY) thay dần ở TIP-021; hình dáng ở đây đọc được từ xa và khớp collider 1:1.
 */
import { BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, Mesh, MeshStandardNodeMaterial, Group, Color, Vector3, Euler, Quaternion, Matrix4, SphereGeometry, DoubleSide } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createTexturedMaterial } from '@engine/render/materials';
import { mx_noise_float, positionWorld, vec3, float, mix, color as tslColor, attribute, smoothstep, saturate } from 'three/tsl';
import type { PbrTextureSet } from '@engine/render/assets';
import type { BarricadeDef, V3 } from './types';
import type { ColliderDef, CoverMarker } from '@engine/render/arena';

const _m = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion();
const _s = new Vector3(1, 1, 1);
const _c = new Color();

function place(g: BufferGeometry, x: number, y: number, z: number, yaw = 0, pitch = 0, roll = 0): BufferGeometry {
  _p.set(x, y, z);
  _q.setFromEuler(new Euler(pitch, yaw, roll));
  _s.set(1, 1, 1);
  _m.compose(_p, _q, _s);
  g.applyMatrix4(_m);
  return g.index ? g.toNonIndexed() : g;
}

function tint(g: BufferGeometry, hex: number): BufferGeometry {
  _c.set(hex);
  const n = g.attributes['position']!.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = _c.r;
    arr[i * 3 + 1] = _c.g;
    arr[i * 3 + 2] = _c.b;
  }
  g.setAttribute('color', new Float32BufferAttribute(arr, 3));
  return g;
}

export interface BarricadeMaterials {
  sandbag: MeshStandardNodeMaterial;
  charred: MeshStandardNodeMaterial;
  concrete: MeshStandardNodeMaterial;
  rubble: MeshStandardNodeMaterial;
  tarp: MeshStandardNodeMaterial;
  wood: MeshStandardNodeMaterial;
  rubber: MeshStandardNodeMaterial;
  tin: MeshStandardNodeMaterial;
  glassBroken: MeshStandardNodeMaterial;
}

export function createBarricadeMaterials(tex: Record<string, PbrTextureSet> | null): BarricadeMaterials {
  // bao cát: màu vải bố + noise sần
  const sandbag = new MeshStandardNodeMaterial({ roughness: 0.95, metalness: 0 });
  const n = mx_noise_float(positionWorld.mul(vec3(9, 9, 9))).mul(0.5).add(0.5);
  sandbag.colorNode = mix(tslColor(new Color(0x9a8a66)), tslColor(new Color(0xc9b98e)), n);
  sandbag.roughnessNode = float(0.95);
  // xác xe cháy: đen than + loang rỉ theo noise + màu gốc còn sót ở vertex color
  const charred = new MeshStandardNodeMaterial({ roughness: 0.75, metalness: 0.35, vertexColors: true });
  const cn = mx_noise_float(positionWorld.mul(vec3(2.5, 4, 2.5))).mul(0.5).add(0.5);
  const soot = saturate(smoothstep(0.2, 0.62, cn));
  const burnt = soot.mul(0.32).add(0.62); // cháy đen ≥ 62 % mọi nơi, màu gốc chỉ còn loang lổ
  charred.colorNode = mix((attribute('color', 'vec3') as unknown as ReturnType<typeof vec3>).mul(0.8), tslColor(new Color(0x0b0a09)), burnt);
  charred.roughnessNode = mix(float(0.55), float(0.97), burnt);
  charred.metalnessNode = mix(float(0.5), float(0.05), burnt);
  const concrete = tex?.['concrete_wall_001'] ? createTexturedMaterial(tex['concrete_wall_001']!, { tileMeters: 1.6, tint: 0xb0aca4, grime: 0.6 }) : new MeshStandardNodeMaterial({ color: 0x9d9a93, roughness: 0.9 });
  const rubble = tex?.['rubble'] ? createTexturedMaterial(tex['rubble']!, { tileMeters: 2.0, worldUv: 'xz' }) : new MeshStandardNodeMaterial({ color: 0x8b8378, roughness: 0.95 });
  const tarp = new MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.8, vertexColors: true, side: DoubleSide });
  const wood = tex?.['plywood'] ? createTexturedMaterial(tex['plywood']!, { tileMeters: 1.2, tint: 0xa8946c }) : new MeshStandardNodeMaterial({ color: 0x8c7a56, roughness: 0.85 });
  const rubber = new MeshStandardNodeMaterial({ color: 0x141416, roughness: 0.9, metalness: 0 });
  const tin = tex?.['corrugated_iron_02'] ? createTexturedMaterial(tex['corrugated_iron_02']!, { tileMeters: 1.0, tint: 0x9aa0a6, metalness: 0.5, roughnessScale: 0.9, rust: tex['rusty_metal_02'] ? { tex: tex['rusty_metal_02']!, amount: 0.6 } : undefined }) : new MeshStandardNodeMaterial({ color: 0x8a8f93, roughness: 0.6, metalness: 0.5, side: DoubleSide });
  tin.side = DoubleSide;
  const glassBroken = new MeshStandardNodeMaterial({ color: 0x1a2229, roughness: 0.25, metalness: 0.5 });
  return { sandbag, charred, concrete, rubble, tarp, wood, rubber, tin, glassBroken };
}

export interface BarricadeBuild {
  group: Group;
  colliders: ColliderDef[];
  coverMarkers: CoverMarker[];
  navBoxes: Array<{ position: V3; size: V3; yaw: number }>;
  draws: number;
  /** def dùng model thật (TIP-021): builder instance model tại các transform này (đã có collider/cover ở đây) */
  modelInstances: Array<{ model: string; position: V3; yaw: number; tint: number; scale: number }>;
}

export interface BarricadeOptions {
  /** model id có sẵn trong assets (thiếu → procedural) */
  hasModel?: (id: string) => boolean;
}

type Bins = Record<keyof BarricadeMaterials, BufferGeometry[]>;

function coverAround(id: string, x: number, z: number, yaw: number, hx: number, hz: number, out: CoverMarker[], sides: Array<'front' | 'back' | 'left' | 'right'> = ['front', 'back']): void {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  // local +z (front) → world (s, c)? yaw quanh y: local (0,0,1) → (sin yaw, 0, cos yaw)
  const dirs: Record<string, [number, number, number]> = {
    front: [s, c, hz],
    back: [-s, -c, hz],
    right: [c, -s, hx],
    left: [-c, s, hx],
  };
  for (const k of sides) {
    const d = dirs[k]!;
    const off = d[2] + 1.0;
    out.push({ id: `${id}_${k}`, position: [x + d[0] * off, 0, z + d[1] * off], facing: [-d[0], 0, -d[1]] });
  }
}

export function buildBarricades(defs: BarricadeDef[], mats: BarricadeMaterials, seed = 3, opts: BarricadeOptions = {}): BarricadeBuild {
  let s = seed >>> 0 || 1;
  const modelInstances: BarricadeBuild['modelInstances'] = [];
  const useModel = (d: BarricadeDef): boolean => !!d.model && !!d.size && (opts.hasModel?.(d.model) ?? false);
  const rnd = (): number => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const bins: Bins = { sandbag: [], charred: [], concrete: [], rubble: [], tarp: [], wood: [], rubber: [], tin: [], glassBroken: [] };
  const colliders: ColliderDef[] = [];
  const coverMarkers: CoverMarker[] = [];
  const navBoxes: BarricadeBuild['navBoxes'] = [];
  const group = new Group();
  group.name = 'barricades';
  const box = (id: string, x: number, y: number, z: number, hx: number, hy: number, hz: number, yaw: number, material: ColliderDef['material'] = 'concrete'): void => {
    colliders.push({ id, kind: 'box', position: [x, y, z], size: [hx, hy, hz], yaw, material });
    navBoxes.push({ position: [x, y, z], size: [hx, hy, hz], yaw });
  };

  defs.forEach((d, i) => {
    const [x, , z] = d.position;
    const yaw = d.yaw ?? 0;
    const id = `${d.kind}_${i}`;
    switch (d.kind) {
      case 'sandbags': {
        const len = d.length ?? 4;
        if (useModel(d)) {
          // tường bao cát model (dài size[0]) lặp dọc chiều dài; collider theo chiều cao model
          const [ml, mh, mw] = d.size!;
          const n = Math.max(1, Math.round(len / ml));
          for (let k = 0; k < n; k++) {
            const lx = (k - (n - 1) / 2) * ml;
            modelInstances.push({ model: d.model!, position: [x + lx * Math.cos(yaw), 0, z - lx * Math.sin(yaw)], yaw: yaw + (rnd() - 0.5) * 0.06, tint: d.tint ?? 1, scale: d.scale ?? 1 });
          }
          box(id, x, mh / 2, z, (n * ml) / 2, mh / 2, mw / 2, yaw, 'wood');
          coverAround(id, x, z, yaw, (n * ml) / 2, mw / 2, coverMarkers);
          break;
        }
        const rows = 4;
        const bagL = 0.55;
        const nBags = Math.max(2, Math.round(len / bagL));
        for (let r = 0; r < rows; r++) {
          const y = 0.14 + r * 0.24;
          const n = r % 2 === 0 ? nBags : nBags - 1;
          for (let k = 0; k < n; k++) {
            const lx = -len / 2 + bagL / 2 + k * bagL + (r % 2 === 1 ? bagL / 2 : 0);
            const g = new SphereGeometry(0.3, 10, 7);
            g.scale(0.95, 0.42, 0.62);
            bins.sandbag.push(place(g, x + lx * Math.cos(yaw), y, z - lx * Math.sin(yaw), yaw + (rnd() - 0.5) * 0.2));
          }
        }
        box(id, x, 0.5, z, len / 2, 0.5, 0.36, yaw, 'wood');
        coverAround(id, x, z, yaw, len / 2, 0.36, coverMarkers);
        break;
      }
      case 'barrier': {
        const g = new BoxGeometry(2.2, 0.9, 0.5);
        g.translate(0, 0.45, 0);
        bins.concrete.push(place(g, x, 0, z, yaw));
        const top = new BoxGeometry(2.2, 0.15, 0.25);
        top.translate(0, 0.9, 0);
        bins.concrete.push(place(top, x, 0, z, yaw));
        box(id, x, 0.45, z, 1.1, 0.45, 0.25, yaw);
        coverAround(id, x, z, yaw, 1.1, 0.25, coverMarkers);
        break;
      }
      case 'wreck_car':
      case 'wreck_bus':
      case 'wreck_apc': {
        if (useModel(d)) {
          const [L, H, W] = d.size!;
          modelInstances.push({ model: d.model!, position: [x, 0, z], yaw, tint: d.tint ?? (d.burning ? 0.45 : 1), scale: d.scale ?? 1 });
          box(id, x, H / 2, z, L / 2, H / 2, W / 2, yaw, 'steel');
          coverAround(id, x, z, yaw, L / 2, W / 2, coverMarkers, ['front', 'back', 'left', 'right']);
          break;
        }
        const bus = d.kind === 'wreck_bus';
        const apc = d.kind === 'wreck_apc';
        const L = bus ? 10.5 : apc ? 7.2 : 4.4;
        const W = bus ? 2.5 : apc ? 2.9 : 1.8;
        const H = bus ? 3.0 : apc ? 2.3 : 1.45;
        const base = d.color ?? (bus ? 0xd9a441 : apc ? 0x4d5a3c : [0xb43a2a, 0x2f5f9e, 0xd9d4c7, 0x7a7f86][i % 4]!);
        const yaw2 = yaw;
        // thân
        const body = new BoxGeometry(L, H * 0.55, W);
        body.translate(0, 0.45 + H * 0.275, 0);
        bins.charred.push(tint(place(body, x, 0, z, yaw2, (rnd() - 0.5) * 0.04, (rnd() - 0.5) * 0.06), base));
        if (!apc) {
          // khoang kính/mui
          const cab = new BoxGeometry(bus ? L * 0.92 : L * 0.55, H * 0.45, W * 0.92);
          cab.translate(bus ? 0 : -L * 0.05, 0.45 + H * 0.55 + H * 0.225, 0);
          bins.charred.push(tint(place(cab, x, 0, z, yaw2), base));
          const win = new BoxGeometry(bus ? L * 0.9 : L * 0.5, H * 0.3, W * 0.94);
          win.translate(bus ? 0 : -L * 0.05, 0.45 + H * 0.55 + H * 0.25, 0);
          bins.glassBroken.push(place(win, x, 0, z, yaw2));
        } else {
          // tháp pháo + nòng
          const tur = new CylinderGeometry(0.8, 0.95, 0.6, 14);
          tur.translate(0.6, 0.45 + H * 0.55 + 0.3, 0);
          bins.charred.push(tint(place(tur, x, 0, z, yaw2), 0x3d4a30));
          const gun = new CylinderGeometry(0.08, 0.1, 2.6, 8);
          gun.rotateZ(Math.PI / 2);
          gun.translate(2.2, 0.45 + H * 0.55 + 0.35, 0);
          bins.charred.push(tint(place(gun, x, 0, z, yaw2), 0x2a2a2a));
          // bánh 8 (mỗi bên 4)
          for (let k = 0; k < 4; k++) {
            for (const side of [-1, 1]) {
              const wheel = new CylinderGeometry(0.55, 0.55, 0.35, 14);
              wheel.rotateX(Math.PI / 2);
              wheel.translate(-L / 2 + 1.0 + k * ((L - 2) / 3), 0.55, side * (W / 2 + 0.05));
              bins.rubber.push(place(wheel, x, 0, z, yaw2));
            }
          }
        }
        if (!apc) {
          const nW = bus ? 3 : 2;
          for (let k = 0; k < nW; k++) {
            for (const side of [-1, 1]) {
              const wheel = new CylinderGeometry(bus ? 0.5 : 0.34, bus ? 0.5 : 0.34, 0.25, 14);
              wheel.rotateX(Math.PI / 2);
              const wx = bus ? -L / 2 + 1.6 + k * ((L - 3.2) / (nW - 1)) : (k === 0 ? -1 : 1) * L * 0.32;
              wheel.translate(wx, bus ? 0.5 : 0.34, side * (W / 2 - 0.05));
              bins.rubber.push(place(wheel, x, 0, z, yaw2));
            }
          }
        }
        // nắp capo/cửa mở
        if (!bus) {
          const hood = new BoxGeometry(L * 0.3, 0.05, W * 0.8);
          hood.translate(L * 0.35, 0.45 + H * 0.55 + 0.5, 0);
          bins.charred.push(tint(place(hood, x, 0, z, yaw2, 0.6), base));
        }
        box(id, x, 0.45 + H / 2, z, L / 2, H / 2, W / 2, yaw2, 'steel');
        coverAround(id, x, z, yaw2, L / 2, W / 2, coverMarkers, ['front', 'back', 'left', 'right']);
        break;
      }
      case 'stall': {
        // sạp: bàn gỗ 2.4×1.2, 4 cột, mái bạt màu (dốc)
        const tc = d.color ?? 0x1b5fa8;
        const table = new BoxGeometry(2.4, 0.08, 1.2);
        table.translate(0, 0.85, 0);
        bins.wood.push(place(table, x, 0, z, yaw));
        for (const [px, pz] of [[-1.1, -0.5], [1.1, -0.5], [-1.1, 0.5], [1.1, 0.5]] as Array<[number, number]>) {
          const leg = new BoxGeometry(0.06, 2.3, 0.06);
          leg.translate(px, 1.15, pz);
          bins.wood.push(place(leg, x, 0, z, yaw));
          const legT = new BoxGeometry(0.05, 0.85, 0.05);
          legT.translate(px, 0.42, pz);
          bins.wood.push(place(legT, x, 0, z, yaw));
        }
        const roof = new BoxGeometry(2.9, 0.03, 1.7);
        roof.rotateX(-0.2);
        roof.translate(0, 2.35, 0.1);
        bins.tarp.push(tint(place(roof, x, 0, z, yaw), tc));
        // hàng hoá: hộp màu
        for (let k = 0; k < 4; k++) {
          const gb = new BoxGeometry(0.4 + rnd() * 0.3, 0.25 + rnd() * 0.2, 0.35 + rnd() * 0.2);
          gb.translate(-0.8 + k * 0.55, 1.0 + 0.12, (rnd() - 0.5) * 0.5);
          bins.tarp.push(tint(place(gb, x, 0, z, yaw), [0xe63946, 0xf4a261, 0x2a9d8f, 0xffd166, 0x8ecae6][k % 5]!));
        }
        box(id, x, 0.45, z, 1.25, 0.45, 0.65, yaw, 'wood');
        coverAround(id, x, z, yaw, 1.25, 0.65, coverMarkers);
        break;
      }
      case 'rubble': {
        const R = 2.6;
        const g = new SphereGeometry(R, 14, 9, 0, Math.PI * 2, 0, Math.PI / 2);
        g.scale(1, 0.42, 0.8);
        bins.rubble.push(place(g, x, 0, z, yaw));
        for (let k = 0; k < 7; k++) {
          const b = new BoxGeometry(0.5 + rnd() * 0.7, 0.2 + rnd() * 0.3, 0.4 + rnd() * 0.5);
          b.translate((rnd() - 0.5) * R * 1.4, 0.3 + rnd() * 0.6, (rnd() - 0.5) * R);
          bins.concrete.push(place(b, x, 0, z, yaw + rnd() * 3, rnd() * 0.6, rnd() * 0.6));
        }
        box(id, x, 0.5, z, R * 0.9, 0.5, R * 0.7, yaw);
        coverAround(id, x, z, yaw, R * 0.9, R * 0.7, coverMarkers);
        break;
      }
      case 'tires': {
        for (let k = 0; k < 6; k++) {
          const t = new CylinderGeometry(0.34, 0.34, 0.22, 14);
          const ox = (rnd() - 0.5) * 1.2;
          const oz = (rnd() - 0.5) * 1.2;
          if (k < 4) t.translate(ox, 0.11 + (k % 2) * 0.22, oz);
          else {
            t.rotateX(Math.PI / 2);
            t.translate(ox, 0.34, oz);
          }
          bins.rubber.push(place(t, x, 0, z, yaw + rnd()));
        }
        break;
      }
      case 'sheet': {
        // tấm tôn bay: 2 tấm cong nhẹ, một góc cắm xuống
        for (let k = 0; k < 2; k++) {
          const sh = new BoxGeometry(2.4, 0.02, 1.0);
          bins.tin.push(place(sh, x + k * 0.9, 0.05 + k * 0.12, z - k * 0.6, yaw + k * 0.4, 0.05 + k * 0.1, 0.06));
        }
        break;
      }
    }
  });

  let draws = 0;
  for (const k of Object.keys(bins) as Array<keyof BarricadeMaterials>) {
    const parts = bins[k];
    if (parts.length === 0) continue;
    const g = mergeGeometries(parts, false);
    if (!g) throw new Error(`barricade merge failed: ${k}`);
    for (const p of parts) p.dispose();
    const mesh = new Mesh(g, mats[k]);
    mesh.name = `barricade_${k}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    draws++;
  }
  return { group, colliders, coverMarkers, navBoxes, draws, modelInstances };
}
