/**
 * Máy trạng thái clip cho viewmodel của nghệ sĩ (DV-055). Thuần TypeScript, không import three: chỉ quyết định
 * "lúc này phát clip nào, phát kiểu gì, chuyển trong bao lâu". Lớp render (artistViewmodel.ts) làm phần còn lại.
 *
 * Luật DV-054: code chỉ CHỌN và TRỘN clip có sẵn của nghệ sĩ, không giả động tác bằng biến đổi thủ tục.
 *
 * Ba tầng, tầng trên đè tầng dưới:
 *   1. hành động  — rút súng, nạp đạn, bắn: chạy hết một lần rồi trả quyền
 *   2. chuyển tiếp — vào/ra ngắm, bắt đầu/kết thúc chạy nước rút: chạy một lần rồi sang vòng lặp tương ứng
 *   3. nền        — đứng yên, đi, chạy nước rút, ngắm đứng, ngắm đi: vòng lặp
 */

/**
 * cách phát một clip: `loop` lặp · `once` phát từ đầu một lần rồi dừng ở khung cuối ·
 * `hold` đứng yên ở khung cuối (tư thế ngắm đứng = khung cuối của clip vào ngắm)
 */
export type VmPlayMode = 'loop' | 'once' | 'hold';

export interface VmRequest {
  clip: string;
  mode: VmPlayMode;
  /** giây trộn từ clip đang phát sang clip này */
  fade: number;
  timeScale: number;
  /** tăng mỗi lần cần phát lại từ đầu dù cùng clip (bắn liên thanh) */
  token: number;
}

export interface VmInput {
  /** 0..1 */
  ads: number;
  /** m/s ngang */
  speed: number;
  sprinting: boolean;
}

/** tên clip trong ak47_vm.glb (scripts/convert-ab3dx-vm.mjs) */
export const VM_CLIPS = {
  draw: 'First',
  idle: 'idle',
  walk: 'walk',
  sprintIn: 'sprint_Start',
  sprint: 'sprint_Loop',
  sprintOut: 'sprint_End',
  adsIn: 'Ads_idle_first',
  adsIdle: 'Ads_idle',
  adsWalk: 'Ads_walk',
  adsOut: 'Ads_idle_end',
  fireHip: 'Fire_Auto_Loop',
  fireAds: 'Ads_Fire_Auto',
  reload: 'Reload',
  reloadDry: 'Reload_From_dry',
  inspect: 'inspect',
} as const;

/** ngưỡng: dưới mức này coi như đứng yên; trên mức kia cùng cờ sprint mới chạy nước rút */
const MOVE_MIN = 0.6;
const SPRINT_MIN = 3.5;
/** đi thong thả trong clip walk tương ứng tốc độ này; nhanh hơn thì clip chạy nhanh hơn, có trần */
const WALK_REF = 2.6;

interface Action {
  clip: string;
  left: number;
  timeScale: number;
  fadeIn: number;
  fadeOut: number;
}

export class VmStateMachine {
  private readonly dur: Readonly<Record<string, number>>;
  private action: Action | null = null;
  private transition: { clip: string; left: number } | null = null;
  private mode: 'hip' | 'ads' | 'sprint' = 'hip';
  private token = 0;
  private last: VmRequest | null = null;

  /** @param durations thời lượng (giây) của từng clip có trong asset */
  constructor(durations: Readonly<Record<string, number>>) {
    this.dur = durations;
  }

  has(clip: string): boolean {
    return (this.dur[clip] ?? 0) > 0;
  }

  /** rút súng: lúc vào màn và sau khi hồi sinh */
  draw(): void {
    this.startAction(VM_CLIPS.draw, 1, 0.05, 0.2);
  }

  /** mỗi phát đạn: phát lại clip bắn liên thanh từ đầu (giật, bolt, vỏ đạn trong clip của nghệ sĩ) */
  shot(adsNow: boolean): void {
    if (this.action && /Reload/.test(this.action.clip)) return;
    this.startAction(adsNow ? VM_CLIPS.fireAds : VM_CLIPS.fireHip, 1, 0.03, 0.12);
  }

  /** nạp đạn: clip co giãn cho khớp đúng thời gian nạp của súng trong game */
  reload(durationS: number, empty: boolean): void {
    const clip = empty && this.has(VM_CLIPS.reloadDry) ? VM_CLIPS.reloadDry : VM_CLIPS.reload;
    const d = this.dur[clip] ?? durationS;
    this.startAction(clip, durationS > 0.05 ? d / durationS : 1, 0.12, 0.2);
  }

  inspect(): void {
    if (this.action) return;
    this.startAction(VM_CLIPS.inspect, 1, 0.2, 0.25);
  }

  reset(): void {
    this.action = null;
    this.transition = null;
    this.mode = 'hip';
    this.last = null;
  }

  /** gọi mỗi khung hình; trả về yêu cầu MỚI khi cần đổi clip, null khi giữ nguyên */
  update(dt: number, inp: VmInput): VmRequest | null {
    const want = this.decide(dt, inp);
    const l = this.last;
    if (l && l.clip === want.clip && l.mode === want.mode && l.token === want.token && Math.abs(l.timeScale - want.timeScale) < 0.05) return null;
    this.last = want;
    return want;
  }

  private startAction(clip: string, timeScale: number, fadeIn: number, fadeOut: number): void {
    if (!this.has(clip)) return;
    this.token++;
    this.action = { clip, left: (this.dur[clip] ?? 0) / Math.max(0.05, timeScale), timeScale, fadeIn, fadeOut };
  }

  private decide(dt: number, inp: VmInput): VmRequest {
    const adsOn = inp.ads >= 0.5;
    const moving = inp.speed > MOVE_MIN;
    const sprint = inp.sprinting && !adsOn && inp.speed > SPRINT_MIN;

    // 1. hành động
    let fadeOut = 0.15;
    if (this.action) {
      this.action.left -= dt;
      if (this.action.left > 0) return { clip: this.action.clip, mode: 'once', fade: this.action.fadeIn, timeScale: this.action.timeScale, token: this.token };
      fadeOut = this.action.fadeOut;
      this.action = null;
      // sau hành động, vào thẳng trạng thái nền đúng, không phát lại clip chuyển tiếp
      this.mode = adsOn ? 'ads' : sprint ? 'sprint' : 'hip';
      this.transition = null;
    }

    // 2. chuyển tiếp: bắt đầu khi chế độ đổi
    const target: 'hip' | 'ads' | 'sprint' = adsOn ? 'ads' : sprint ? 'sprint' : 'hip';
    if (target !== this.mode) {
      const from = this.mode;
      this.mode = target;
      let clip: string | null = null;
      if (target === 'ads') clip = VM_CLIPS.adsIn;
      else if (target === 'sprint') clip = VM_CLIPS.sprintIn;
      else if (from === 'ads') clip = VM_CLIPS.adsOut;
      else if (from === 'sprint') clip = VM_CLIPS.sprintOut;
      if (clip && this.has(clip)) {
        this.token++;
        this.transition = { clip, left: this.dur[clip] ?? 0 };
      } else this.transition = null;
    }
    if (this.transition) {
      this.transition.left -= dt;
      if (this.transition.left > 0) {
        return { clip: this.transition.clip, mode: 'once', fade: 0.1, timeScale: 1, token: this.token };
      }
      fadeOut = 0.15;
      this.transition = null;
    }

    // 3. nền
    if (this.mode === 'ads') {
      if (moving && this.has(VM_CLIPS.adsWalk)) return { clip: VM_CLIPS.adsWalk, mode: 'loop', fade: 0.2, timeScale: walkScale(inp.speed), token: 0 };
      // ngắm đứng yên: vòng thở của nghệ sĩ; thiếu clip đó thì giữ khung cuối của clip vào ngắm
      if (this.has(VM_CLIPS.adsIdle)) return { clip: VM_CLIPS.adsIdle, mode: 'loop', fade: 0.15, timeScale: 1, token: 0 };
      return { clip: VM_CLIPS.adsIn, mode: 'hold', fade: 0.2, timeScale: 1, token: 0 };
    }
    if (this.mode === 'sprint') return { clip: VM_CLIPS.sprint, mode: 'loop', fade: fadeOut, timeScale: 1, token: 0 };
    if (moving) return { clip: VM_CLIPS.walk, mode: 'loop', fade: Math.max(fadeOut, 0.2), timeScale: walkScale(inp.speed), token: 0 };
    return { clip: VM_CLIPS.idle, mode: 'loop', fade: Math.max(fadeOut, 0.25), timeScale: 1, token: 0 };
  }
}

function walkScale(speed: number): number {
  return Math.max(0.75, Math.min(1.5, speed / WALK_REF));
}
