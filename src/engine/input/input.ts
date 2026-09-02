/**
 * Input snapshot (PRD §3.1: "input snapshot → player controller"). Một interface cho cả bàn phím/chuột
 * thật lẫn replay track → gameplay không phân biệt nguồn, benchmark deterministic.
 */
export interface InputSnapshot {
  /** -1..1 tiến/lùi */
  fwd: number;
  /** -1..1 phải/trái */
  right: number;
  sprint: boolean;
  crouch: boolean;
  jump: boolean;
  fire: boolean;
  ads: boolean;
  reload: boolean;
  interact: boolean;
  /** delta chuột tích lũy từ snapshot trước (pixel) */
  dx: number;
  dy: number;
}

export interface InputSource {
  /** Ghi snapshot cho tick hiện tại vào `out` (không allocation). */
  snapshot(tick: number, out: InputSnapshot): void;
  readonly kind: 'keyboard' | 'replay' | 'none';
}

export function emptySnapshot(): InputSnapshot {
  return { fwd: 0, right: 0, sprint: false, crouch: false, jump: false, fire: false, ads: false, reload: false, interact: false, dx: 0, dy: 0 };
}

export function clearSnapshot(s: InputSnapshot): void {
  s.fwd = 0;
  s.right = 0;
  s.sprint = s.crouch = s.jump = s.fire = s.ads = s.reload = s.interact = false;
  s.dx = 0;
  s.dy = 0;
}

export const NULL_INPUT: InputSource = { kind: 'none', snapshot: (_t, out) => clearSnapshot(out) };

export interface KeyBindings {
  forward: string[];
  back: string[];
  left: string[];
  right: string[];
  sprint: string[];
  crouch: string[];
  jump: string[];
  reload: string[];
  interact: string[];
}

export const DEFAULT_BINDINGS: KeyBindings = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  crouch: ['KeyC', 'ControlLeft'],
  jump: ['Space'],
  reload: ['KeyR'],
  interact: ['KeyF'],
};

/** Bàn phím + chuột (pointer lock). Mouse delta tích lũy giữa hai snapshot; nút giữ theo trạng thái. */
export class KeyboardMouseInput implements InputSource {
  readonly kind = 'keyboard' as const;
  private keys = new Set<string>();
  private dx = 0;
  private dy = 0;
  private fire = false;
  private ads = false;
  /** jump/reload/interact là edge: bấm 1 lần → true đúng 1 snapshot */
  private edges = { jump: false, reload: false, interact: false };
  bindings: KeyBindings = DEFAULT_BINDINGS;
  adsHold = true;
  private adsToggle = false;
  /** chỉ nhận chuột khi pointer lock trên element này (null = luôn nhận, dùng cho test) */
  lockTarget: Element | null;

  constructor(lockTarget: Element | null) {
    this.lockTarget = lockTarget;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    this.keys.add(e.code);
    if (this.bindings.jump.includes(e.code)) this.edges.jump = true;
    if (this.bindings.reload.includes(e.code)) this.edges.reload = true;
    if (this.bindings.interact.includes(e.code)) this.edges.interact = true;
    if (e.code === 'Space') e.preventDefault();
  };
  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };
  private onMouseMove = (e: MouseEvent): void => {
    if (this.lockTarget && document.pointerLockElement !== this.lockTarget) return;
    this.dx += e.movementX;
    this.dy += e.movementY;
  };
  private onMouseDown = (e: MouseEvent): void => {
    if (this.lockTarget && document.pointerLockElement !== this.lockTarget) return;
    if (e.button === 0) this.fire = true;
    if (e.button === 2) {
      if (this.adsHold) this.ads = true;
      else this.adsToggle = !this.adsToggle;
    }
  };
  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.fire = false;
    if (e.button === 2 && this.adsHold) this.ads = false;
  };
  private onBlur = (): void => {
    this.keys.clear();
    this.fire = false;
    this.ads = false;
  };

  attach(target: Window = window): void {
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('mousemove', this.onMouseMove);
    target.addEventListener('mousedown', this.onMouseDown);
    target.addEventListener('mouseup', this.onMouseUp);
    target.addEventListener('blur', this.onBlur);
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  detach(target: Window = window): void {
    target.removeEventListener('keydown', this.onKeyDown);
    target.removeEventListener('keyup', this.onKeyUp);
    target.removeEventListener('mousemove', this.onMouseMove);
    target.removeEventListener('mousedown', this.onMouseDown);
    target.removeEventListener('mouseup', this.onMouseUp);
    target.removeEventListener('blur', this.onBlur);
  }

  private has(codes: string[]): boolean {
    for (let i = 0; i < codes.length; i++) if (this.keys.has(codes[i]!)) return true;
    return false;
  }

  snapshot(_tick: number, out: InputSnapshot): void {
    const b = this.bindings;
    out.fwd = (this.has(b.forward) ? 1 : 0) - (this.has(b.back) ? 1 : 0);
    out.right = (this.has(b.right) ? 1 : 0) - (this.has(b.left) ? 1 : 0);
    out.sprint = this.has(b.sprint);
    out.crouch = this.has(b.crouch);
    out.jump = this.edges.jump;
    out.reload = this.edges.reload;
    out.interact = this.edges.interact;
    out.fire = this.fire;
    out.ads = this.adsHold ? this.ads : this.adsToggle;
    out.dx = this.dx;
    out.dy = this.dy;
    this.dx = 0;
    this.dy = 0;
    this.edges.jump = this.edges.reload = this.edges.interact = false;
  }
}
