/**
 * DV-093 phát intro (MP4 dựng sẵn từ engine) toàn màn trước khi vào chơi; giữ Space 1 s hoặc Esc để bỏ qua.
 * Màn đã nạp xong từ trước (không nạp song song khi phim chạy → phim không giật). Thiếu file → bỏ qua ngay.
 */
import { t } from './i18n';

/**
 * `until` (giây, DV-094): dừng phim tại đó, giữ nền đen thêm vài khung rồi gỡ (không mờ dần) — engine nối tiếp phía sau từ
 * khung đen. Bỏ qua (giữ Space / Esc) trả về như hết phim.
 */
export type IntroVideoResult = 'missing' | 'played';

export async function playIntroVideo(url: string, opts: { until?: number } = {}): Promise<IntroVideoResult> {
  try {
    const head = await fetch(url, { method: 'HEAD' });
    const ct = head.headers.get('content-type') ?? '';
    if (!head.ok || /html|text/i.test(ct)) return 'missing';
  } catch {
    return 'missing';
  }
  const wrap = document.createElement('div');
  Object.assign(wrap.style, { position: 'fixed', inset: '0', background: '#000', zIndex: '50', display: 'flex', alignItems: 'center', justifyContent: 'center' });
  const v = document.createElement('video');
  v.src = url;
  v.playsInline = true;
  v.preload = 'auto';
  Object.assign(v.style, { width: '100%', height: '100%', objectFit: 'contain', background: '#000' });
  const hint = document.createElement('div');
  hint.textContent = t('cine.skip');
  Object.assign(hint.style, { position: 'absolute', right: '28px', bottom: '22px', font: '500 15px "Barlow Condensed", sans-serif', letterSpacing: '0.12em', color: 'rgba(232,220,192,0.55)', opacity: '0', transition: 'opacity 0.4s' });
  const bar = document.createElement('div');
  Object.assign(bar.style, { position: 'absolute', right: '28px', bottom: '14px', height: '2px', width: '0px', background: '#c8783a' });
  wrap.append(v, hint, bar);
  document.body.appendChild(wrap);
  await new Promise<void>((resolve) => {
    let held = 0;
    let holding = false;
    let last = performance.now();
    let raf = 0;
    let finished = false;
    const done = (cut = false): void => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
      if (cut) {
        // cắt ở khung đen: dừng phim, giữ nền đen thêm 2 khung cho engine dựng khung đầu rồi gỡ (không mờ dần)
        v.pause();
        v.style.visibility = 'hidden';
        hint.remove();
        bar.remove();
        requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => wrap.remove())));
      } else {
        wrap.style.transition = 'opacity 0.5s';
        wrap.style.opacity = '0';
        setTimeout(() => wrap.remove(), 550);
      }
      resolve();
    };
    const tick = (now: number): void => {
      const dt = (now - last) / 1000;
      last = now;
      held = holding ? held + dt : Math.max(0, held - dt * 2);
      bar.style.width = `${Math.min(1, held) * 120}px`;
      if (held >= 1) return done();
      if (opts.until !== undefined && v.currentTime >= opts.until) return done(true);
      raf = requestAnimationFrame(tick);
    };
    const down = (e: KeyboardEvent): void => {
      hint.style.opacity = '1';
      if (e.code === 'Escape') return done();
      if (e.code === 'Space') {
        holding = true;
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent): void => {
      if (e.code === 'Space') holding = false;
    };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    v.addEventListener('ended', () => done(opts.until !== undefined), { once: true });
    v.addEventListener('error', () => done(), { once: true });
    raf = requestAnimationFrame(tick);
    // cắt chính xác theo khung đang hiện (rVFC), không đợi timeupdate ~250 ms
    const rvfc = (v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: (now: number, m: { mediaTime: number }) => void) => number }).requestVideoFrameCallback;
    if (opts.until !== undefined && rvfc) {
      const watch = (_n: number, m: { mediaTime: number }): void => {
        if (m.mediaTime >= opts.until!) done(true);
        else if (!finished) rvfc.call(v, watch);
      };
      rvfc.call(v, watch);
    }
    v.play().catch(() => done());
  });
  return 'played';
}
