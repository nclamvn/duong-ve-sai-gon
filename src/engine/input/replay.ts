/**
 * Replay track (PRD §8 PerformanceReplay: seed + inputTrack tái dựng được; WPN-002 replay seed).
 * Track = keyframe theo tick, giữ trạng thái cho tới keyframe kế. dx/dy chỉ áp ở đúng tick keyframe
 * (mouse là delta), các nút là trạng thái giữ.
 */
import { mulberry32 } from '@engine/core';
import { type InputSnapshot, type InputSource, clearSnapshot } from './input';

export const FLAG = { sprint: 1, crouch: 2, jump: 4, fire: 8, ads: 16, reload: 32, interact: 64 } as const;

export interface TrackFrame {
  tick: number;
  fwd: number;
  right: number;
  flags: number;
  dx: number;
  dy: number;
}

export interface InputTrack {
  name: string;
  seed: number;
  ticks: number;
  frames: TrackFrame[];
}

export class ReplayPlayer implements InputSource {
  readonly kind = 'replay' as const;
  private idx = 0;
  private lastTick = -1;
  constructor(readonly track: InputTrack) {}

  reset(): void {
    this.idx = 0;
    this.lastTick = -1;
  }

  get finished(): boolean {
    return this.lastTick >= this.track.ticks;
  }

  snapshot(tick: number, out: InputSnapshot): void {
    const frames = this.track.frames;
    // tiến idx tới keyframe cuối cùng có tick ≤ tick
    while (this.idx + 1 < frames.length && frames[this.idx + 1]!.tick <= tick) this.idx++;
    const f = frames[this.idx];
    if (!f || f.tick > tick || tick >= this.track.ticks) {
      clearSnapshot(out);
      this.lastTick = tick;
      return;
    }
    out.fwd = f.fwd;
    out.right = f.right;
    out.sprint = (f.flags & FLAG.sprint) !== 0;
    out.crouch = (f.flags & FLAG.crouch) !== 0;
    out.fire = (f.flags & FLAG.fire) !== 0;
    out.ads = (f.flags & FLAG.ads) !== 0;
    // edge input chỉ ở tick keyframe
    const onKey = f.tick === tick;
    out.jump = onKey && (f.flags & FLAG.jump) !== 0;
    out.reload = onKey && (f.flags & FLAG.reload) !== 0;
    out.interact = onKey && (f.flags & FLAG.interact) !== 0;
    // mouse delta: chia đều qua các tick giữa keyframe này và keyframe sau để xoay mượt
    const next = frames[this.idx + 1];
    const span = Math.max(1, (next ? next.tick : this.track.ticks) - f.tick);
    out.dx = f.dx / span;
    out.dy = f.dy / span;
    this.lastTick = tick;
  }
}

/**
 * Track chuẩn "arena-v1": đi vòng arena, quét nhìn, bắn từng nhịp, thỉnh thoảng ADS/cúi/nhảy.
 * Deterministic theo seed. Bench 90 s = 5400 tick.
 */
export function makeArenaTrack(seed: number, seconds: number, hz = 60): InputTrack {
  const prng = mulberry32(seed).fork('arena-track');
  const ticks = Math.floor(seconds * hz);
  const frames: TrackFrame[] = [];
  let tick = 0;
  let phase = 0;
  while (tick < ticks) {
    const segTicks = Math.floor(prng.range(1.0, 3.0) * hz);
    const kind = phase % 4;
    let fwd = 1;
    let right = 0;
    let flags = 0;
    let dx = 0;
    let dy = 0;
    if (kind === 0) {
      // đi tới + quét ngang
      dx = prng.range(-260, 260);
      dy = prng.range(-40, 40);
      if (prng.next() < 0.35) flags |= FLAG.sprint;
    } else if (kind === 1) {
      // strafe + bắn
      right = prng.next() < 0.5 ? 1 : -1;
      fwd = prng.next() < 0.5 ? 0 : 1;
      flags |= FLAG.fire;
      dx = prng.range(-120, 120);
      if (prng.next() < 0.5) flags |= FLAG.ads;
    } else if (kind === 2) {
      // đứng ADS bắn, hoặc cúi
      fwd = 0;
      flags |= FLAG.fire | FLAG.ads;
      if (prng.next() < 0.4) flags |= FLAG.crouch;
      dx = prng.range(-60, 60);
      dy = prng.range(-20, 20);
    } else {
      // quay đầu lớn + nhảy + reload
      fwd = 1;
      dx = prng.range(-700, 700);
      flags |= FLAG.jump;
      if (prng.next() < 0.6) flags |= FLAG.reload;
    }
    frames.push({ tick, fwd, right, flags, dx: Math.round(dx), dy: Math.round(dy) });
    tick += segTicks;
    phase++;
  }
  return { name: 'arena-v1', seed, ticks, frames };
}
