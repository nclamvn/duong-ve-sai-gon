/**
 * DV-094b màn "bấm phím bất kỳ" trước intro khi vào thẳng (`autostart=1`, chưa có cú bấm nào): trình duyệt chặn phát tiếng và
 * phim có tiếng cho tới cú bấm đầu tiên. Vào bằng nút trên màn năng lực thiết bị (đã có cú bấm) thì qua ngay.
 */
import { t } from './i18n';

export function pressStart(needed: boolean): Promise<void> {
  if (!needed) return Promise.resolve();
  const wrap = document.createElement('div');
  wrap.dataset['testid'] = 'press-start';
  Object.assign(wrap.style, { position: 'fixed', inset: '0', background: '#000', zIndex: '55', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' });
  const msg = document.createElement('div');
  msg.textContent = t('cine.press_start');
  Object.assign(msg.style, { font: '500 clamp(16px, 1.6vw, 24px) "Barlow Condensed", sans-serif', letterSpacing: '0.3em', color: 'rgba(232,220,192,0.8)', animation: 'dvBlink 1.6s ease-in-out infinite' });
  const style = document.createElement('style');
  style.textContent = '@keyframes dvBlink { 0%, 100% { opacity: 0.25 } 50% { opacity: 1 } }';
  wrap.append(style, msg);
  document.body.appendChild(wrap);
  return new Promise((resolve) => {
    const go = (e: Event): void => {
      e.preventDefault();
      window.removeEventListener('keydown', go, true);
      window.removeEventListener('pointerdown', go, true);
      wrap.remove();
      resolve();
    };
    window.addEventListener('keydown', go, true);
    window.addEventListener('pointerdown', go, true);
  });
}
