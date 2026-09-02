/** AI LOD (PRD AI-004): FULL (< 30 m hoặc ALERT) · REDUCED (30–60 m) · SLEEP (> 60 m hoặc offscreen ≥ 5 s không ALERT). */
import ai from '@content/tuning/ai.json';
import type { AwarenessState } from './perception';

export type AiLod = 'FULL' | 'REDUCED' | 'SLEEP';

export function computeLod(distance: number, awareness: AwarenessState, offscreenMs: number, cfg = ai.lod): AiLod {
  if (awareness === 'ALERT') return 'FULL';
  if (distance > cfg.reducedRange) return 'SLEEP';
  if (offscreenMs >= cfg.offscreenSleepMs && awareness === 'UNAWARE') return 'SLEEP';
  if (distance > cfg.fullRange) return 'REDUCED';
  return 'FULL';
}

/** true nếu điểm p nằm trong nón nhìn của camera (fov + margin) */
export function isOnScreen(camPos: [number, number, number], camFwd: [number, number, number], p: [number, number, number], fovDeg = 90, marginDeg = 20): boolean {
  const dx = p[0] - camPos[0];
  const dy = p[1] - camPos[1];
  const dz = p[2] - camPos[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  const dot = (dx * camFwd[0] + dy * camFwd[1] + dz * camFwd[2]) / len;
  return dot >= Math.cos((((fovDeg / 2 + marginDeg) * Math.PI) / 180));
}
