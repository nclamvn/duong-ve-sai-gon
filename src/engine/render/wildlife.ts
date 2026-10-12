/**
 * Chim và bướm (DV-082): sự sống trong cảnh rừng, hoàn toàn trong shader (một Mesh instanced mỗi loại, `count` = số con,
 * mỗi con sinh từ hash(instanceIndex), không attribute, không CPU mỗi frame ngoài vài uniform).
 *  - Chim nhỏ: từng đàn 5–9 con lượn vòng trên tán (cao 22–45 m trên đất dưới camera, bán kính 18–55 m, 7–11 m/s), vỗ cánh
 *    6–9 Hz xen đoạn liệng; tâm đàn neo theo lưới thế giới 260 m cuộn quanh camera (ra xa thì sang ô đối diện, khuất trong sương).
 *  - Chim lớn (dáng hồng hoàng): vài cặp sải 1,4 m bay thẳng chậm, vỗ cánh nặng 2–3 Hz.
 *  - Bướm: quanh người chơi trong hộp 16 m, cao 0,3–2,2 m, bay chập chờn theo nhiễu, cánh gập 9–13 Hz; cánh vẽ bằng shader
 *    (thuỳ trước/sau, viền tối, đốm), 4 kiểu màu nhiệt đới; sáng theo nắng lọt qua tán như mọi vật trong cảnh.
 * Tắt khi mặt trời dưới chân trời (đêm). TSL only; không phụ thuộc game/*.
 */
import { BufferGeometry, BufferAttribute, DoubleSide, Mesh, MeshStandardNodeMaterial, Vector2 } from 'three/webgpu';
import { uniform, instanceIndex, hash, float, vec2, vec3, sin, cos, fract, floor, time, cameraPosition, positionGeometry, uv, smoothstep, length, mix, select, abs, mx_noise_float, max } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { SUN } from './sceneLight';

export interface WildlifeOptions {
  /** số chim nhỏ (chia đàn 7 con) */
  birds: number;
  /** số cặp chim lớn */
  bigBirds: number;
  butterflies: number;
}

export interface Wildlife {
  meshes: Mesh[];
  /** gọi mỗi frame: cao độ đất dưới camera (bay theo địa hình) */
  update(groundY: number): void;
  readonly wind: { value: Vector2 };
  readonly counts: { birds: number; bigBirds: number; butterflies: number };
  dispose(): void;
}

/** lưới chim: thân thoi + 2 cánh (mỗi cánh 2 tam giác), x = sải (−1..1), z = dọc thân (+ đầu) — đơn vị tương đối */
function birdGeometry(): BufferGeometry {
  // body: mũi (0,0,0.5), đuôi (0,0,-0.55), hai hông (±0.08, 0, 0.05); cánh: gốc (±0.08, 0, 0.12)/(±0.08,0,-0.1), mút (±1, 0, -0.12), giữa mép sau (±0.5,0,-0.22)
  const P = [
    0, 0, 0.5, 0.08, 0, 0.05, -0.08, 0, 0.05, 0, 0.02, -0.55, // 0..3 thân
    0.08, 0, 0.14, 0.08, 0, -0.1, 0.55, 0, 0.02, 1.0, 0, -0.14, 0.5, 0, -0.24, // 4..8 cánh phải
    -0.08, 0, 0.14, -0.08, 0, -0.1, -0.55, 0, 0.02, -1.0, 0, -0.14, -0.5, 0, -0.24, // 9..13 cánh trái
  ];
  const idx = [0, 1, 2, 1, 3, 2, 4, 6, 5, 6, 8, 5, 6, 7, 8, 9, 10, 11, 11, 10, 13, 11, 13, 12];
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(P), 3));
  const n = new Float32Array((P.length / 3) * 3);
  for (let i = 1; i < n.length; i += 3) n[i] = 1;
  g.setAttribute('normal', new BufferAttribute(n, 3));
  g.setIndex(idx);
  return g;
}

/** lưới bướm: hai cánh, mỗi cánh một tứ giác x ∈ [0, ±1], z ∈ [−1, 1]; uv.x = |x|, uv.y theo z */
function butterflyGeometry(): BufferGeometry {
  const P = [0, 0, -1, 1, 0, -1, 1, 0, 1, 0, 0, 1, 0, 0, -1, -1, 0, -1, -1, 0, 1, 0, 0, 1];
  const U = [0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1];
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(P), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(U), 2));
  const n = new Float32Array(24);
  for (let i = 1; i < 24; i += 3) n[i] = 1;
  g.setAttribute('normal', new BufferAttribute(n, 3));
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6]);
  return g;
}

/** xoay (x, z) quanh trục y theo yaw (hướng bay = +z cục bộ → (sin yaw, cos yaw)) */
function yawRotate(x: Node<'float'>, z: Node<'float'>, yaw: Node<'float'>): [Node<'float'>, Node<'float'>] {
  const c = cos(yaw);
  const s = sin(yaw);
  return [x.mul(c).add(z.mul(s)) as unknown as Node<'float'>, z.mul(c).sub(x.mul(s)) as unknown as Node<'float'>];
}

export function createWildlife(o: WildlifeOptions): Wildlife {
  const ground = uniform(0);
  const wind = uniform(new Vector2(0.8, 0.6));
  const day = uniform(1);
  const meshes: Mesh[] = [];
  const t = time;
  const cam = cameraPosition;
  const g = ground as unknown as Node<'float'>;

  // ---------- chim nhỏ + chim lớn: một material, instance < birds là chim nhỏ
  const nSmall = Math.max(0, Math.round(o.birds));
  const nBig = Math.max(0, Math.round(o.bigBirds)) * 2;
  if (nSmall + nBig > 0) {
    const id = float(instanceIndex);
    const isBig = id.greaterThanEqual(float(nSmall));
    const flock = select(isBig, floor(id.sub(nSmall).div(2)).add(1000), floor(id.div(7)));
    const f1 = hash(flock.add(11));
    const f2 = hash(flock.add(23));
    const f3 = hash(flock.add(37));
    const f4 = hash(flock.add(53));
    const b1 = hash(id.add(101));
    const b2 = hash(id.add(211));
    const b3 = hash(id.add(307));
    // tâm đàn neo lưới thế giới 260 m, cuộn quanh camera
    const C = 260;
    const cx = cam.x.add(fract(f1.mul(C).sub(cam.x).div(C)).sub(0.5).mul(C));
    const cz = cam.z.add(fract(f2.mul(C).sub(cam.z).div(C)).sub(0.5).mul(C));
    // chim nhỏ: lượn vòng; chim lớn: bay thẳng qua ô (vòng rất rộng)
    const R = select(isBig, float(400), mix(float(18), float(55), f3));
    const speed = select(isBig, float(5.5), mix(float(7), float(11), f4));
    const dirSign = select(f4.greaterThan(0.5), float(1), float(-1));
    const ang = f1.mul(6.283).add(t.mul(speed).div(R).mul(dirSign));
    // vị trí trong đàn: lệch nhỏ quanh quỹ đạo, lượn sóng riêng
    const offX = b1.sub(0.5).mul(select(isBig, float(4), float(9)));
    const offZ = b2.sub(0.5).mul(select(isBig, float(3), float(7)));
    const alt = g.add(select(isBig, float(32), mix(float(22), float(45), f2))).add(sin(t.mul(0.35).add(b3.mul(20))).mul(2.5)).add(b3.mul(4));
    const px = cx.add(cos(ang).mul(R)).add(offX.add(sin(t.mul(0.9).add(b1.mul(30))).mul(1.2)));
    const pz = cz.add(sin(ang).mul(R)).add(offZ.add(cos(t.mul(0.8).add(b2.mul(30))).mul(1.2)));
    // hướng bay = tiếp tuyến vòng: vận tốc ∝ dirSign·(−sin a, cos a); +z cục bộ quay thành (sin yaw, cos yaw)
    const yaw = select(dirSign.greaterThan(0), ang.negate(), float(Math.PI).sub(ang));
    // vỗ cánh xen liệng
    const flapHz = select(isBig, float(2.4), mix(float(6), float(9), b2));
    const glide = smoothstep(float(-0.2), float(0.4), sin(t.mul(0.5).add(b1.mul(40))));
    const flap = sin(t.mul(flapHz.mul(6.283)).add(b3.mul(6.283))).mul(select(isBig, float(0.45), float(0.7))).mul(mix(float(1), float(0.12), glide));
    const span = select(isBig, float(0.7), mix(float(0.17), float(0.3), b1)); // nửa sải (m)
    const lp = positionGeometry;
    const wingK = abs(lp.x);
    const ly = lp.y.add(wingK.mul(flap));
    const lx = lp.x.mul(float(1).sub(wingK.mul(abs(flap)).mul(0.25)));
    const [rx, rz] = yawRotate(lx.mul(span), lp.z.mul(span), yaw);
    const mat = new MeshStandardNodeMaterial({ roughness: 0.9, metalness: 0, side: DoubleSide });
    mat.positionNode = vec3(px.add(rx), alt.add(ly.mul(span)), pz.add(rz));
    // bụng sáng hơn lưng một chút; chim lớn đen trắng (hồng hoàng)
    const tone = mix(float(0.04), float(0.09), b2);
    mat.colorNode = select(isBig, mix(vec3(0.03, 0.03, 0.03), vec3(0.6, 0.58, 0.52), smoothstep(float(0.62), float(0.8), abs(lp.x))), vec3(tone, tone.mul(0.9), tone.mul(0.75)));
    const mesh = new Mesh(birdGeometry(), mat);
    mesh.count = nSmall + nBig;
    mesh.frustumCulled = false;
    mesh.name = 'wildlife_birds';
    meshes.push(mesh);
  }

  // ---------- bướm
  const nB = Math.max(0, Math.round(o.butterflies));
  if (nB > 0) {
    const id = float(instanceIndex);
    const r1 = hash(id.add(401));
    const r2 = hash(id.add(503));
    const r3 = hash(id.add(607));
    const r4 = hash(id.add(709));
    const B = 16;
    // đường bay chập chờn: trôi chậm + nhiễu hai tầng
    const wv = wind as unknown as Node<'vec2'>;
    const q = t.mul(mix(float(0.15), float(0.3), r4));
    const wx = mx_noise_float(vec2(q, r1.mul(50))).mul(3.0).add(sin(t.mul(2.7).add(r2.mul(20))).mul(0.25));
    const wz = mx_noise_float(vec2(q.add(13), r2.mul(50))).mul(3.0).add(cos(t.mul(2.3).add(r3.mul(20))).mul(0.25));
    const bx = r1.mul(B).add(wx).add(wv.x.mul(t).mul(0.05));
    const bz = r2.mul(B).add(wz).add(wv.y.mul(t).mul(0.05));
    const px = cam.x.add(fract(bx.sub(cam.x).div(B)).sub(0.5).mul(B));
    const pz = cam.z.add(fract(bz.sub(cam.z).div(B)).sub(0.5).mul(B));
    const py = g.add(mix(float(0.3), float(2.2), r3)).add(mx_noise_float(vec2(q.mul(2.0), r3.mul(40))).mul(0.6)).add(sin(t.mul(5.0).add(r4.mul(30))).mul(0.08));
    // hướng = đạo hàm xấp xỉ quãng trôi (nhiễu) → dùng góc nhiễu riêng, đổi hướng mềm
    const yaw = mx_noise_float(vec2(q.mul(0.8), r4.mul(60))).mul(6.283);
    const flapHz = mix(float(9), float(13), r2);
    const fold = sin(t.mul(flapHz.mul(6.283)).add(r1.mul(6.283))).mul(0.55).add(0.45); // 0 mở phẳng … 1 gập đứng (~80°)
    const th = fold.mul(1.4);
    const size = mix(float(0.035), float(0.055), r3); // nửa sải (m)
    const lp = positionGeometry;
    const ax = abs(lp.x);
    const sx = select(lp.x.greaterThanEqual(0), float(1), float(-1));
    const lx = sx.mul(ax.mul(cos(th)));
    const ly = ax.mul(sin(th));
    const [rx, rz] = yawRotate(lx.mul(size), lp.z.mul(size.mul(0.9)), yaw);
    const mat = new MeshStandardNodeMaterial({ roughness: 0.75, metalness: 0, side: DoubleSide });
    mat.positionNode = vec3(px.add(rx), py.add(ly.mul(size)), pz.add(rz));
    // cánh vẽ bằng shader: uv.x = 0 thân → 1 mút, uv.y = 0 sau → 1 trước
    const u = uv();
    const fore = length(vec2(u.x.sub(0.55).mul(1.15), u.y.sub(0.68).mul(1.6)));
    const hind = length(vec2(u.x.sub(0.42).mul(1.5), u.y.sub(0.28).mul(1.7)));
    const shape = max(smoothstep(float(0.44), float(0.5), fore).oneMinus(), smoothstep(float(0.36), float(0.42), hind).oneMinus()).mul(smoothstep(float(0.0), float(0.06), u.x));
    const edge = max(smoothstep(float(0.38), float(0.48), fore).mul(smoothstep(float(0.44), float(0.5), fore).oneMinus()), smoothstep(float(0.3), float(0.4), hind).mul(smoothstep(float(0.36), float(0.42), hind).oneMinus()));
    const spot = smoothstep(float(0.05), float(0.09), length(vec2(u.x.sub(0.7), u.y.sub(0.75)))).oneMinus();
    // 4 kiểu: cam đen, vàng chanh, xanh lam đen, nâu mắt rắn
    const kind = floor(r4.mul(4));
    const c0 = select(kind.lessThan(1), vec3(0.75, 0.28, 0.03), select(kind.lessThan(2), vec3(0.85, 0.75, 0.12), select(kind.lessThan(3), vec3(0.05, 0.22, 0.55), vec3(0.32, 0.2, 0.1))));
    const body = smoothstep(float(0.02), float(0.06), u.x).oneMinus();
    const col = mix(mix(c0, vec3(0.02, 0.02, 0.02), edge.max(body)), vec3(0.9, 0.88, 0.8), spot.mul(0.85));
    mat.colorNode = col;
    mat.opacityNode = shape.max(body.mul(smoothstep(float(0.12), float(0.25), abs(u.y.sub(0.5))).oneMinus())).mul(day as unknown as Node<'float'>);
    mat.alphaTest = 0.5;
    const mesh = new Mesh(butterflyGeometry(), mat);
    mesh.count = nB;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.name = 'wildlife_butterflies';
    meshes.push(mesh);
  }

  return {
    meshes,
    wind: wind as unknown as { value: Vector2 },
    counts: { birds: nSmall, bigBirds: nBig / 2, butterflies: nB },
    update(groundY) {
      ground.value = groundY;
      const sy = (SUN.dir.value as { y: number }).y;
      const on = sy > 0.01 ? 1 : 0;
      day.value = on;
      for (const m of meshes) m.visible = on > 0;
    },
    dispose() {
      for (const m of meshes) {
        m.geometry.dispose();
        (m.material as MeshStandardNodeMaterial).dispose();
        m.removeFromParent();
      }
    },
  };
}
