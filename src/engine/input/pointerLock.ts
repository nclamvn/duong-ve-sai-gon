/**
 * Pointer Lock (PRD PLY-002 [S11]): raw input (unadjustedMovement) khi browser cho phép, fallback thường.
 */
export interface PointerLockController {
  request(): void;
  readonly locked: boolean;
  rawInput: boolean;
  onChange(fn: (locked: boolean) => void): () => void;
  /** đếm lần fallback (unadjustedMovement không hỗ trợ) — telemetry/debug */
  readonly fallbacks: number;
}

export function createPointerLock(target: HTMLElement, rawInput = true): PointerLockController {
  const listeners = new Set<(locked: boolean) => void>();
  let fallbacks = 0;
  const ctl: PointerLockController = {
    rawInput,
    get locked() {
      return document.pointerLockElement === target;
    },
    get fallbacks() {
      return fallbacks;
    },
    request() {
      if (document.pointerLockElement === target) return;
      const fn = target.requestPointerLock as unknown as (opts?: { unadjustedMovement: boolean }) => Promise<void> | undefined;
      if (ctl.rawInput) {
        try {
          const p = fn.call(target, { unadjustedMovement: true });
          if (p && typeof p.catch === 'function') {
            p.catch(() => {
              fallbacks++;
              target.requestPointerLock();
            });
          }
          return;
        } catch {
          fallbacks++;
        }
      }
      target.requestPointerLock();
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === target;
    for (const l of listeners) l(locked);
  });
  return ctl;
}
