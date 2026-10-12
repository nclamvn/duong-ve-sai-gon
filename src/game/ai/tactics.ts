/**
 * Tactics (AI-T1.2, DV-071): chấm điểm vị trí chiến đấu theo VAI, trên ứng viên của CoverField.
 *
 * score = che chắn + bắn được + vai − quãng chạy − quãng lộ − chen chúc. Hai lượt: lượt rẻ (khoảng cách, góc, dải tầm) xếp hạng
 * toàn bộ ứng viên; lượt đắt (tia) chỉ cho `probeBudget` ứng viên đầu. Giữ chỗ: khoá ứng viên đang có người chiếm/đang tới.
 * Thuần TS.
 */
import ai from '@content/tuning/ai.json';
import { CoverField, type CoverCandidate, type CoverKind, type CoverQuality } from './coverField';

type V3 = [number, number, number];

export type TacticalRole = 'support' | 'assault' | 'flank' | 'fallback' | 'hold' | 'escort';

export interface TacticalQuery {
  self: V3;
  /** chân + mắt mối đe doạ chính */
  threat: V3;
  threatEye: V3;
  role: TacticalRole;
  /** vị trí đồng đội cùng phe (giãn cách) */
  allies?: readonly V3[];
  /** vị trí nhóm yểm trợ (vai flank: tạo góc với họ quanh mục tiêu) */
  support?: readonly V3[];
  /** điểm neo (hold/escort/fallback): người chơi, vị trí giữ, điểm rút */
  anchor?: V3;
  anchorRadius?: number;
  /** quãng một lần lao tối đa (m) */
  maxMove?: number;
  /** khoá đã có người giữ (trừ khoá của chính mình) */
  reserved?: ReadonlySet<string>;
  /** chỉ chấp nhận chỗ che thật (bị ghim) */
  needCover?: boolean;
  /** escort: hướng bắn của người chơi (đơn vị, ngang) để không đứng chắn */
  anchorFwd?: [number, number];
}

export interface TacticalPick {
  key: string;
  kind: CoverKind;
  pos: V3;
  quality: CoverQuality;
  /** điểm ló (cover 'full') hoặc null — 'low' ló bằng cách đứng lên tại chỗ */
  peek: V3 | null;
  peekSide: number;
  /** đứng ở chỗ (hoặc ló) thấy được mục tiêu */
  canFire: boolean;
  exposure: number;
  score: number;
}

const T = ai.tactics;

/** dải tầm ưa thích theo vai [min, max] (m) */
export function roleBand(role: TacticalRole): [number, number] {
  const b = (T.bands as Record<string, number[]>)[role];
  return b ? [b[0]!, b[1]!] : [6, 60];
}

function angleAround(c: V3, p: V3): number {
  return Math.atan2(p[2] - c[2], p[0] - c[0]);
}

function angDiff(a: number, b: number): number {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

interface Scored {
  c: CoverCandidate;
  pre: number;
}

export class TacticalEvaluator {
  readonly stats = { queries: 0, probed: 0, picks: 0, none: 0 };
  private readonly cands: CoverCandidate[] = [];
  private readonly scored: Scored[] = [];
  private readonly peekTmp: V3 = [0, 0, 0];

  constructor(readonly field: CoverField) {}

  /** điểm sơ bộ (không tia); −Infinity = loại */
  private preScore(c: CoverCandidate, q: TacticalQuery): number {
    const dSelf = Math.hypot(c.x - q.self[0], c.z - q.self[2]);
    const dThreat = Math.hypot(c.x - q.threat[0], c.z - q.threat[2]);
    const dCurThreat = Math.hypot(q.self[0] - q.threat[0], q.self[2] - q.threat[2]);
    if (dThreat < T.minDistToThreat) return -Infinity;
    if (q.reserved?.has(c.key)) return -Infinity;
    const [bMin, bMax] = roleBand(q.role);
    let s = -dSelf * T.travelCost;
    if (dThreat < bMin) s -= (bMin - dThreat) * T.bandCost;
    else if (dThreat > bMax) s -= (dThreat - bMax) * T.bandCost;
    else s += T.inBandBonus;
    // giãn cách
    if (q.allies) for (const a of q.allies) if (Math.hypot(a[0] - c.x, a[2] - c.z) < T.spacing) s -= T.crowdCost;
    switch (q.role) {
      case 'assault': {
        const prog = dCurThreat - dThreat;
        if (prog < T.assaultMinProgress) s -= T.assaultBackCost + Math.max(0, -prog) * 0.3;
        else s += Math.min(T.assaultProgressCap, prog * T.assaultProgressGain);
        break;
      }
      case 'flank': {
        const sup = q.support && q.support.length ? q.support : null;
        if (sup) {
          const a = angleAround(q.threat, [c.x, c.y, c.z]);
          let minD = Math.PI;
          for (const p of sup) minD = Math.min(minD, angDiff(a, angleAround(q.threat, p)));
          const need = (T.flankAngleDeg * Math.PI) / 180;
          if (minD < need) s -= ((need - minD) * 180) / Math.PI * T.flankAngleCost;
          else s += T.flankBonus + (minD - need) * 2;
        }
        break;
      }
      case 'fallback': {
        const back = dThreat - dCurThreat;
        if (back < T.fallbackMinGain) s -= T.fallbackShortCost;
        else s += Math.min(6, back * 0.4);
        if (q.anchor) s -= Math.hypot(c.x - q.anchor[0], c.z - q.anchor[2]) * 0.05;
        break;
      }
      case 'hold':
      case 'escort': {
        if (q.anchor) {
          const dA = Math.hypot(c.x - q.anchor[0], c.z - q.anchor[2]);
          const r = q.anchorRadius ?? (q.role === 'escort' ? T.escortMax : 12);
          const rMin = q.role === 'escort' ? T.escortMin : 0;
          if (dA > r) s -= (dA - r) * 1.2;
          else if (dA < rMin) s -= (rMin - dA) * 2;
          else s += 2;
          // không đứng chắn hướng bắn của người chơi
          if (q.role === 'escort' && q.anchorFwd) {
            const vx = c.x - q.anchor[0];
            const vz = c.z - q.anchor[2];
            const along = vx * q.anchorFwd[0] + vz * q.anchorFwd[1];
            const perp = Math.abs(vx * q.anchorFwd[1] - vz * q.anchorFwd[0]);
            if (along > 0 && perp < T.escortLaneHalf) s -= T.escortLaneCost;
          }
        }
        break;
      }
      case 'support':
        break;
    }
    // nguồn có vật chắn thật (thân cây, hố, marker) ưu tiên được thử tia trước nếp đất mẫu vòng (thường trống)
    if (c.kind !== 'ring') s += T.sourceBonus;
    return s;
  }

  /** chọn vị trí tốt nhất; null nếu không ứng viên nào đạt */
  pick(q: TacticalQuery, probeBudget: number = T.probeBudget): TacticalPick | null {
    this.stats.queries++;
    const maxMove = q.maxMove ?? T.maxMove;
    const cands = this.field.candidates(q.self[0], q.self[2], maxMove, q.threat, this.cands);
    const sc = this.scored;
    sc.length = 0;
    for (const c of cands) {
      const pre = this.preScore(c, q);
      if (pre > -Infinity) sc.push({ c, pre });
    }
    sc.sort((a, b) => b.pre - a.pre || (a.c.key < b.c.key ? -1 : a.c.key > b.c.key ? 1 : 0));
    let best: TacticalPick | null = null;
    const n = Math.min(probeBudget, sc.length);
    for (let i = 0; i < n; i++) {
      const { c, pre } = sc[i]!;
      if (best && pre + T.maxProbeGain < best.score) break; // không thể vượt
      this.stats.probed++;
      const quality = this.field.probe(c.x, c.y, c.z, q.threatEye);
      if (q.needCover && quality === 'none') continue;
      let s = pre + (quality === 'full' ? T.fullBonus : quality === 'low' ? T.lowBonus : -T.noneCost);
      let peek: V3 | null = null;
      let side = 0;
      let canFire: boolean;
      if (quality === 'full') {
        side = this.field.peekPoint(c.x, c.y, c.z, q.threatEye, this.peekTmp, 1);
        canFire = side !== 0;
        if (canFire) peek = [this.peekTmp[0], this.peekTmp[1], this.peekTmp[2]];
      } else canFire = quality === 'low' || this.field.canSee(c.x, c.y, c.z, q.threatEye);
      if (canFire) s += q.role === 'support' ? T.fireBonusSupport : T.fireBonus;
      else if (q.role === 'support') s -= T.fireBonusSupport;
      const exposure = this.field.exposure(q.self, [c.x, c.y, c.z], q.threatEye);
      s -= exposure * T.exposureCost;
      if (!best || s > best.score) best = { key: c.key, kind: c.kind, pos: [c.x, c.y, c.z], quality, peek, peekSide: side, canFire, exposure, score: s };
    }
    if (best) this.stats.picks++;
    else this.stats.none++;
    return best;
  }
}
