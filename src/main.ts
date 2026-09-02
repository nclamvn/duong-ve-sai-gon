// TIP-001 bootstrap — thay thế ở TIP-003 bằng boot thật (capability → renderer → arena → loop).
import { t } from '@ui/i18n';

declare const __BUILD_HASH__: string;

const cap = document.getElementById('capability');
if (cap) {
  cap.innerHTML = `<div class="card"><h1>${t('app.title')}</h1><p>HT-MB boot · build ${__BUILD_HASH__}</p></div>`;
}
