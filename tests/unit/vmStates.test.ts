import { describe, it, expect } from 'vitest';
import { VmStateMachine, VM_CLIPS } from '@game/weapons/vmStates';

const DUR: Record<string, number> = {
  First: 0.83,
  idle: 3.33,
  walk: 0.83,
  sprint_Start: 0.5,
  sprint_Loop: 0.67,
  sprint_End: 0.83,
  Ads_idle_first: 0.38,
  Ads_walk: 0.83,
  Ads_idle_end: 0.58,
  Fire_Auto_Loop: 0.17,
  Ads_Fire_Auto: 0.17,
  Reload: 2.58,
  Reload_From_dry: 3.29,
  inspect: 5.71,
};
const still = { ads: 0, speed: 0, sprinting: false };

/** chạy n khung 1/60 s, trả về clip cuối cùng được yêu cầu */
function run(sm: VmStateMachine, frames: number, inp = still): string | null {
  let last: string | null = null;
  for (let i = 0; i < frames; i++) {
    const r = sm.update(1 / 60, inp);
    if (r) last = r.clip;
  }
  return last;
}

describe('VmStateMachine (DV-055: chỉ chọn và trộn clip của nghệ sĩ)', () => {
  it('vào màn: rút súng rồi về đứng yên', () => {
    const sm = new VmStateMachine(DUR);
    sm.draw();
    expect(sm.update(1 / 60, still)?.clip).toBe(VM_CLIPS.draw);
    expect(run(sm, 60)).toBe(VM_CLIPS.idle);
  });

  it('đi → walk, chạy nước rút → sprint_Start rồi sprint_Loop, thả → sprint_End rồi idle', () => {
    const sm = new VmStateMachine(DUR);
    expect(run(sm, 2, { ads: 0, speed: 2, sprinting: false })).toBe(VM_CLIPS.walk);
    const fast = { ads: 0, speed: 6, sprinting: true };
    expect(sm.update(1 / 60, fast)?.clip).toBe(VM_CLIPS.sprintIn);
    expect(run(sm, 40, fast)).toBe(VM_CLIPS.sprint);
    expect(sm.update(1 / 60, still)?.clip).toBe(VM_CLIPS.sprintOut);
    expect(run(sm, 60)).toBe(VM_CLIPS.idle);
  });

  it('ngắm: phát clip vào ngắm một lần rồi GIỮ khung cuối; bỏ ngắm phát clip ra ngắm', () => {
    const sm = new VmStateMachine(DUR);
    const ads = { ads: 1, speed: 0, sprinting: false };
    const first = sm.update(1 / 60, ads)!;
    expect(first.clip).toBe(VM_CLIPS.adsIn);
    expect(first.mode).toBe('once');
    let hold = null;
    for (let i = 0; i < 40; i++) hold = sm.update(1 / 60, ads) ?? hold;
    expect(hold?.clip).toBe(VM_CLIPS.adsIn);
    expect(hold?.mode).toBe('hold');
    expect(sm.update(1 / 60, still)?.clip).toBe(VM_CLIPS.adsOut);
  });

  it('ngắm đứng: có clip Ads_idle thì lặp vòng thở của nghệ sĩ sau clip vào ngắm', () => {
    const sm = new VmStateMachine({ ...DUR, Ads_idle: 2.0 });
    const ads = { ads: 1, speed: 0, sprinting: false };
    expect(sm.update(1 / 60, ads)?.clip).toBe(VM_CLIPS.adsIn);
    let r = null;
    for (let i = 0; i < 40; i++) r = sm.update(1 / 60, ads) ?? r;
    expect(r?.clip).toBe(VM_CLIPS.adsIdle);
    expect(r?.mode).toBe('loop');
  });

  it('mỗi phát đạn phát lại clip bắn từ đầu (token đổi), hết clip thì về nền', () => {
    const sm = new VmStateMachine(DUR);
    run(sm, 2);
    sm.shot(false);
    const a = sm.update(1 / 60, still)!;
    expect(a.clip).toBe(VM_CLIPS.fireHip);
    sm.shot(false);
    const b = sm.update(1 / 60, still)!;
    expect(b.clip).toBe(VM_CLIPS.fireHip);
    expect(b.token).not.toBe(a.token);
    expect(run(sm, 30)).toBe(VM_CLIPS.idle);
    sm.shot(true);
    expect(sm.update(1 / 60, { ads: 1, speed: 0, sprinting: false })?.clip).toBe(VM_CLIPS.fireAds);
  });

  it('nạp đạn co giãn đúng thời gian của súng; hết đạn dùng clip nạp khi rỗng; bắn không cắt ngang nạp', () => {
    const sm = new VmStateMachine(DUR);
    sm.reload(2.5, false);
    const r = sm.update(1 / 60, still)!;
    expect(r.clip).toBe(VM_CLIPS.reload);
    expect(r.timeScale).toBeCloseTo(2.58 / 2.5, 3);
    sm.shot(false);
    expect(sm.update(1 / 60, still)).toBeNull();
    expect(run(sm, Math.ceil(2.5 * 60))).toBe(VM_CLIPS.idle);
    sm.reload(2.5, true);
    expect(sm.update(1 / 60, still)?.clip).toBe(VM_CLIPS.reloadDry);
  });

  it('tất định: cùng chuỗi đầu vào cho cùng chuỗi yêu cầu', () => {
    const seq = (): string[] => {
      const sm = new VmStateMachine(DUR);
      sm.draw();
      const out: string[] = [];
      for (let i = 0; i < 400; i++) {
        if (i === 100) sm.shot(false);
        if (i === 200) sm.reload(2.5, i % 2 === 0);
        const inp = { ads: i > 300 ? 1 : 0, speed: i > 50 && i < 90 ? 3 : 0, sprinting: false };
        const r = sm.update(1 / 60, inp);
        if (r) out.push(`${i}:${r.clip}:${r.mode}`);
      }
      return out;
    };
    expect(seq()).toEqual(seq());
  });
});
