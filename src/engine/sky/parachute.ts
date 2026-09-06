/**
 * Dù đơn (phi công nhảy khỏi máy bay trúng đạn — TIP-D-SKY): vòm dù lathe 24 múi có gợn mép, dây dù, người treo (hình khối
 * tối, chỉ nhìn ở ≥ 400 m). Procedural, không asset. Rơi 5 m/s, đung đưa; chạm đất → vòm xẹp (scale y) rồi biến mất sau 20 s.
 */
import { BufferGeometry, Float32BufferAttribute, Group, LatheGeometry, LineBasicMaterial, LineSegments, Mesh, MeshStandardNodeMaterial, CapsuleGeometry, DoubleSide, Vector2 } from 'three/webgpu';
import type { Prng } from '../core/prng';

export interface Parachute {
  group: Group;
  /** m/s */
  descent: number;
  swing: number;
  yaw: number;
  alive: boolean;
  land(groundY: number): void;
  done(now: number): boolean;
  dispose(): void;
}

let canopyGeo: LatheGeometry | null = null;
let linesGeo: BufferGeometry | null = null;
let bodyGeo: CapsuleGeometry | null = null;
const CANOPY_R = 4.2;
const LINE_L = 6.5;

function canopy(): LatheGeometry {
  if (canopyGeo) return canopyGeo;
  const pts: Vector2[] = [];
  // nửa cầu dẹt (vòm dù tròn C-9): r = R·sin, y = R·0,55·cos, mép hơi cụp
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * (Math.PI / 2) * 0.98;
    pts.push(new Vector2(Math.sin(a) * CANOPY_R, Math.cos(a) * CANOPY_R * 0.55 + LINE_L));
  }
  canopyGeo = new LatheGeometry(pts, 24);
  // gợn mép 24 múi: dời đỉnh mép theo sin
  const pos = canopyGeo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r > CANOPY_R * 0.9) {
      const ang = Math.atan2(z, x);
      const k = 1 - 0.06 * (0.5 + 0.5 * Math.cos(ang * 12));
      pos.setXYZ(i, x * k, pos.getY(i) - 0.25 * (1 - k) * 10, z * k);
    }
  }
  pos.needsUpdate = true;
  canopyGeo.computeVertexNormals();
  return canopyGeo;
}

function lines(): BufferGeometry {
  if (linesGeo) return linesGeo;
  const v: number[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    v.push(Math.cos(a) * CANOPY_R * 0.92, LINE_L + 0.2, Math.sin(a) * CANOPY_R * 0.92, 0, 1.2, 0);
  }
  linesGeo = new BufferGeometry();
  linesGeo.setAttribute('position', new Float32BufferAttribute(v, 3));
  return linesGeo;
}

export function createParachute(prng: Prng): Parachute {
  const g = new Group();
  g.name = 'parachute';
  const white = new MeshStandardNodeMaterial({ color: 0xe8e3d6, roughness: 0.9, side: DoubleSide });
  const cap = new Mesh(canopy(), white);
  cap.castShadow = false;
  const ln = new LineSegments(lines(), new LineBasicMaterial({ color: 0x6b665c }));
  bodyGeo ??= new CapsuleGeometry(0.28, 1.2, 3, 8);
  const body = new Mesh(bodyGeo, new MeshStandardNodeMaterial({ color: 0x3a3a34, roughness: 0.95 }));
  body.position.y = 0.6;
  g.add(cap, ln, body);
  let landedAt = -1;
  const p: Parachute = {
    group: g,
    descent: 4.5 + prng.range(0, 1.2),
    swing: prng.range(0, 6.28),
    yaw: prng.range(0, 6.28),
    alive: true,
    land(groundY) {
      if (!p.alive) return;
      p.alive = false;
      g.position.y = groundY;
      cap.scale.set(1.15, 0.12, 1.15);
      cap.position.y = -LINE_L + 0.4;
      ln.visible = false;
      body.rotation.z = Math.PI / 2;
      body.position.set(0.6, 0.3, 0);
      landedAt = -2; // đánh dấu; thời điểm đặt ở done()
    },
    done(now) {
      if (p.alive) return false;
      if (landedAt === -2) landedAt = now;
      return now - landedAt > 20;
    },
    dispose() {
      white.dispose();
      (body.material as MeshStandardNodeMaterial).dispose();
    },
  };
  return p;
}
