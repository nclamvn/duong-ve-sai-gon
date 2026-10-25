/**
 * DV-094 tựa phim hiện đè lúc đang chơi (intro nối liền vào trận): chữ hiện mờ giữa màn, vạch cam mảnh, rồi tan —
 * không chặn chuột, không dừng trận. Cùng kiểu chữ với tựa trong intro (cineOverlay).
 */
import { t } from './i18n';

export function showTitleCard(opts: { titleKey: string; subKey?: string; delayS?: number; holdS?: number }): () => void {
  const wrap = document.createElement('div');
  wrap.dataset['testid'] = 'title-card';
  Object.assign(wrap.style, {
    position: 'fixed',
    left: '0',
    right: '0',
    top: '34%',
    zIndex: '30',
    pointerEvents: 'none',
    textAlign: 'center',
    opacity: '0',
    transition: 'opacity 0.9s ease-out',
  });
  const title = document.createElement('div');
  title.textContent = t(opts.titleKey);
  Object.assign(title.style, {
    font: '600 clamp(44px, 6.4vw, 104px) "Barlow Condensed", sans-serif',
    letterSpacing: '0.32em',
    paddingLeft: '0.32em',
    color: '#efe6d2',
    textShadow: '0 0 24px rgba(0,0,0,0.85), 0 2px 6px rgba(0,0,0,0.9)',
  });
  const rule = document.createElement('div');
  Object.assign(rule.style, { height: '2px', width: '0px', margin: '10px auto 14px', background: '#c8783a', opacity: '0.75', transition: 'width 1.1s ease-out' });
  wrap.append(title, rule);
  if (opts.subKey) {
    const sub = document.createElement('div');
    sub.textContent = t(opts.subKey);
    Object.assign(sub.style, {
      font: '500 clamp(18px, 2vw, 30px) "Barlow Condensed", sans-serif',
      letterSpacing: '0.4em',
      paddingLeft: '0.4em',
      color: 'rgba(239,230,210,0.85)',
      textShadow: '0 0 12px rgba(0,0,0,0.9)',
    });
    wrap.append(sub);
  }
  document.body.appendChild(wrap);
  const timers: number[] = [];
  const delay = (opts.delayS ?? 1.5) * 1000;
  const hold = (opts.holdS ?? 3.2) * 1000;
  timers.push(
    window.setTimeout(() => {
      wrap.style.opacity = '1';
      rule.style.width = 'min(360px, 40vw)';
    }, delay),
  );
  timers.push(
    window.setTimeout(() => {
      wrap.style.transition = 'opacity 1.4s ease-in';
      wrap.style.opacity = '0';
    }, delay + hold),
  );
  timers.push(window.setTimeout(() => wrap.remove(), delay + hold + 1600));
  return () => {
    for (const id of timers) clearTimeout(id);
    wrap.remove();
  };
}
