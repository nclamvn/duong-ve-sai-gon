/**
 * Cover scoring (PRD AI-002 seek cover): +gần bot, +marker chắn LOS tới lastKnown, −quá gần mục tiêu.
 * Thuần TS; LOS function inject.
 */
import ai from '@content/tuning/ai.json';
import type { CoverMarker } from '@engine/render/arena';

export interface CoverPick {
  marker: CoverMarker;
  score: number;
  /** marker chắn LOS tới threat (cover "thật") — TIP-018 chỉ đi tới cover thật */
  blocked: boolean;
}

export function pickCover(
  markers: CoverMarker[],
  self: [number, number, number],
  threat: [number, number, number],
  /** true nếu từ điểm (marker, ở tầm mắt) tới threat KHÔNG bị chắn */
  hasLOS: (x: number, y: number, z: number, tx: number, ty: number, tz: number) => boolean,
  eyeHeight = ai.perception.eyeHeight,
  cfg = ai.cover,
): CoverPick | null {
  let best: CoverPick | null = null;
  for (let i = 0; i < markers.length; i++) {
    const m = markers[i]!;
    const dSelf = Math.hypot(m.position[0] - self[0], m.position[2] - self[2]);
    if (dSelf > cfg.maxSearch) continue;
    const dThreat = Math.hypot(m.position[0] - threat[0], m.position[2] - threat[2]);
    if (dThreat < cfg.minDistToTarget) continue;
    // marker "mặt che" hướng về threat: facing · (threat − marker) > 0
    const tx = threat[0] - m.position[0];
    const tz = threat[2] - m.position[2];
    const faceDot = (m.facing[0] * tx + m.facing[2] * tz) / (Math.hypot(tx, tz) || 1);
    if (faceDot < 0.2) continue;
    const blocked = !hasLOS(m.position[0], m.position[1] + eyeHeight * 0.6, m.position[2], threat[0], threat[1], threat[2]);
    let score = -dSelf * cfg.preferNear;
    if (blocked) score += cfg.losBlockBonus * 5;
    score += faceDot * 2;
    if (!best || score > best.score) best = { marker: m, score, blocked };
  }
  return best;
}
