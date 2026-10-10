/**
 * Trang bị phe A hư cấu (DV-061): mũ tai bèo vải mềm (boonie) thay mũ cối của gói lịch sử + bao xe AK 3 túi dùng lại
 * của gear1971. Dựng procedural (tạm thời, tới khi có mô hình nhân vật thật trong danh sách chọn DV-061).
 * Kích thước theo sọ Swat như gear1971 (to hơn đầu thật ~1,35×): chỏm cao ~10 cm, vành mềm rộng ~6 cm cụp xuống.
 */
import { Mesh, LatheGeometry, MeshStandardNodeMaterial, DoubleSide, Vector2, Vector3, Euler, type BufferGeometry, type Object3D } from 'three/webgpu';
import { attachGear1971, type Gear1971 } from './gear1971';

/** kaki ô-liu phai, sáng hơn bao xe một chút để mũ tách khỏi nền lá */
export const BOONIE_COLOR = 0x5f6a4c;
let boonieGeo: BufferGeometry | null = null;
let boonieMat: MeshStandardNodeMaterial | null = null;

/** Gốc = mặt phẳng chân chỏm, +y lên, +z trước. Vành võng xuống phía trước/sau nhiều hơn hai bên (kéo dài z). */
export function boonieHatGeometry(): BufferGeometry {
  if (boonieGeo) return boonieGeo;
  const pts: Vector2[] = [
    new Vector2(0, 0.112),
    new Vector2(0.07, 0.11),
    new Vector2(0.112, 0.098), // chỏm phẳng, vai chỏm tròn
    new Vector2(0.128, 0.07),
    new Vector2(0.134, 0.03), // thành chỏm (có dải băng lá)
    new Vector2(0.136, 0.0),
    new Vector2(0.15, -0.006), // gốc vành
    new Vector2(0.18, -0.02),
    new Vector2(0.2, -0.036), // mép vành cụp
    new Vector2(0.203, -0.042),
    new Vector2(0.196, -0.04), // mặt dưới
    new Vector2(0.15, -0.012),
    new Vector2(0.13, 0.002),
  ];
  const g = new LatheGeometry(pts, 36);
  g.scale(1.0, 1.0, 1.1);
  g.computeVertexNormals();
  boonieGeo = g;
  return g;
}

/** Bone đầu Swat (y 1,558 m bind) → chân chỏm ~1,67 m, đội hơi lệch sau. */
export const BOONIE_HEAD_OFFSET = { pos: new Vector3(0, 0.118, -0.004), rot: new Euler(-0.08, 0, 0) };

/** `helmet` = mũ tai bèo (cùng khe với mũ cối của gear1971 để code/QA đọc chung) */
export type GearFactionA = Gear1971;

export function attachGearFactionA(bones: { head: Object3D | null; chest: Object3D | null }): GearFactionA {
  const base = attachGear1971(bones, { helmet: false });
  let hat: Mesh | null = null;
  if (bones.head) {
    boonieMat ??= new MeshStandardNodeMaterial({ color: BOONIE_COLOR, roughness: 0.95, metalness: 0, side: DoubleSide });
    hat = new Mesh(boonieHatGeometry(), boonieMat);
    hat.name = 'gear_boonie_hat';
    hat.position.copy(BOONIE_HEAD_OFFSET.pos);
    hat.rotation.copy(BOONIE_HEAD_OFFSET.rot);
    hat.castShadow = true;
    hat.receiveShadow = true;
    hat.frustumCulled = false;
    bones.head.add(hat);
  }
  return {
    ...base,
    helmet: hat,
    dispose: () => {
      base.dispose();
      hat?.removeFromParent();
    },
  };
}
