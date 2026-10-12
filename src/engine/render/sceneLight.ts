/**
 * Uniform ánh sáng dùng chung cho material tuỳ biến (DV-079): hướng tới mặt trời, màu × cường độ (linear), tầm bóng CSM.
 * Rig ánh sáng (daylight) ghi một lần khi dựng; material lá (nắng xuyên lá), terrain (bóng tán xa) đọc.
 */
import { Color, Vector3 } from 'three/webgpu';
import { uniform } from 'three/tsl';

export const SUN = {
  /** hướng tới mặt trời (world, đơn vị) */
  dir: uniform(new Vector3(0.4, 0.7, 0.5).normalize()),
  /** màu × cường độ (linear) */
  color: uniform(new Color(1, 1, 1)),
  /** tầm bóng CSM (m) — xa hơn thì dùng bóng tán xấp xỉ */
  shadowFar: uniform(150),
};

/** DV-081: thời tiết dùng chung cho material nhân vật/đồ vật (0 khô … 1 ướt sũng) */
export const WEATHER = {
  wet: uniform(0),
  /** 1 = cảnh rừng có bản đồ độ che tán (nhân vật nhận che sáng tán + viền nắng); 0 = arena/không tán */
  forest: uniform(0),
};

export function setSun(dir: readonly number[], colorHex: number, intensity: number, shadowFar: number): void {
  (SUN.dir.value as Vector3).set(dir[0]!, dir[1]!, dir[2]!).normalize();
  (SUN.color.value as Color).set(colorHex).multiplyScalar(intensity);
  SUN.shadowFar.value = shadowFar;
}
