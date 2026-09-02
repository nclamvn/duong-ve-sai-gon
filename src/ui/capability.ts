/** Capability screen (PRD REN-001: "Capability screen ghi backend"). */
import { t } from './i18n';
import type { RendererBundle } from '@engine/render/backend';

export interface CapabilityInfo {
  backend: RendererBundle['backend'];
  adapterInfo: RendererBundle['adapterInfo'];
  webgpuAvailable: boolean;
  timestampCapable: boolean;
  buildHash: string;
}

export function showCapability(root: HTMLElement, info: CapabilityInfo, onEnter: () => void, autostart: boolean): void {
  const adapter = info.adapterInfo
    ? [info.adapterInfo.vendor, info.adapterInfo.architecture, info.adapterInfo.description].filter(Boolean).join(' · ') || '—'
    : '—';
  const rows: Array<[string, string]> = [
    [t('cap.backend'), `${info.backend}${info.timestampCapable ? ' · timestamp-query' : ''}`],
    [t('cap.adapter'), adapter],
    [t('cap.dpr'), String(window.devicePixelRatio)],
    [t('cap.viewport'), `${window.innerWidth} × ${window.innerHeight}`],
    [t('cap.build'), info.buildHash],
  ];
  root.innerHTML = `
    <div class="card" data-testid="capability">
      <h1>${t('cap.title')}</h1>
      <table>${rows.map(([k, v]) => `<tr><td>${k}</td><td data-cap="${k}">${v}</td></tr>`).join('')}</table>
      ${!info.webgpuAvailable ? `<p style="color:var(--warn)">${t('cap.webgpu_missing')}</p>` : ''}
      <p style="color:var(--muted);font-size:12px">${t('cap.hint')}</p>
      <button id="cap-enter" data-testid="enter">${t('cap.enter')}</button>
    </div>`;
  const btn = root.querySelector<HTMLButtonElement>('#cap-enter');
  const enter = (): void => {
    root.hidden = true;
    onEnter();
  };
  btn?.addEventListener('click', enter, { once: true });
  if (autostart) enter();
}

export function showFatal(root: HTMLElement, message: string): void {
  root.hidden = false;
  root.innerHTML = `<div class="card"><h1>ERROR</h1><pre style="white-space:pre-wrap;color:var(--danger)">${message}</pre></div>`;
}
