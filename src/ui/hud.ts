/**
 * HUD tối giản (PRD UX-001): ammo, máu, objective, prompt, crosshair. DOM, không che tâm ngắm.
 * Mọi chuỗi qua i18n. TIP-005 máu/crosshair · TIP-006 ammo/spread · TIP-008 objective/prompt.
 */
import { t } from './i18n';

export interface HudState {
  health: number;
  maxHealth: number;
  mag: number;
  reserve: number;
  weaponState: string;
  spreadDeg: number;
  objectiveKey: string | null;
  promptKey: string | null;
  dead: boolean;
  missionComplete: boolean;
}

export class Hud {
  private root: HTMLElement;
  private els: { health: HTMLElement; ammo: HTMLElement; objective: HTMLElement; prompt: HTMLElement; crosshair: HTMLElement; banner: HTMLElement };
  private last: Partial<HudState> = {};
  readonly state: HudState = { health: 100, maxHealth: 100, mag: 0, reserve: 0, weaponState: '', spreadDeg: 1, objectiveKey: null, promptKey: null, dead: false, missionComplete: false };

  constructor() {
    this.root = document.getElementById('hud')!;
    this.root.innerHTML = `
      <div class="objective" data-testid="objective"></div>
      <div class="crosshair" data-testid="crosshair"></div>
      <div class="prompt" data-testid="prompt" hidden></div>
      <div class="health" data-testid="health"></div>
      <div class="ammo" data-testid="ammo"></div>
      <div class="banner" data-testid="banner" hidden style="position:absolute;left:50%;top:40%;transform:translateX(-50%);font-size:1.6em;letter-spacing:.2em;color:var(--accent)"></div>`;
    const q = (sel: string): HTMLElement => this.root.querySelector(sel)!;
    this.els = { health: q('.health'), ammo: q('.ammo'), objective: q('.objective'), prompt: q('.prompt'), crosshair: q('.crosshair'), banner: q('.banner') };
  }

  show(visible: boolean): void {
    this.root.hidden = !visible;
  }

  /** Cập nhật DOM chỉ khi giá trị đổi (4 Hz đủ, gọi mỗi frame vẫn rẻ nhờ diff). */
  update(): void {
    const s = this.state;
    const l = this.last;
    if (l.health !== s.health) {
      this.els.health.textContent = `${t('hud.health')} ${Math.ceil(s.health)}`;
      this.els.health.style.color = s.health <= 30 ? 'var(--danger)' : 'var(--fg)';
      l.health = s.health;
    }
    if (l.mag !== s.mag || l.reserve !== s.reserve || l.weaponState !== s.weaponState) {
      this.els.ammo.innerHTML = s.weaponState ? `${s.mag} <small>/ ${s.reserve} ${t('hud.ammo_reserve')}</small>` : '';
      this.els.ammo.style.color = s.mag === 0 ? 'var(--danger)' : 'var(--fg)';
      l.mag = s.mag;
      l.reserve = s.reserve;
      l.weaponState = s.weaponState;
    }
    if (Math.abs((l.spreadDeg ?? -1) - s.spreadDeg) > 0.05) {
      this.els.crosshair.style.setProperty('--gap', `${(6 + s.spreadDeg * 6).toFixed(0)}px`);
      l.spreadDeg = s.spreadDeg;
    }
    if (l.objectiveKey !== s.objectiveKey) {
      this.els.objective.textContent = s.objectiveKey ? t(`hud.objective.${s.objectiveKey}`) : '';
      l.objectiveKey = s.objectiveKey;
    }
    if (l.promptKey !== s.promptKey) {
      this.els.prompt.hidden = !s.promptKey;
      this.els.prompt.textContent = s.promptKey ? t(`hud.prompt.${s.promptKey}`) : '';
      l.promptKey = s.promptKey;
    }
    if (l.dead !== s.dead || l.missionComplete !== s.missionComplete) {
      const text = s.dead ? t('hud.state.dead') : s.missionComplete ? t('hud.mission_complete') : '';
      this.els.banner.hidden = !text;
      this.els.banner.textContent = text;
      l.dead = s.dead;
      l.missionComplete = s.missionComplete;
    }
  }
}
