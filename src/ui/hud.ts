/**
 * HUD FPS cao cấp (TIP-UX02, PRD §8.4 · UX-001): DOM/CSS, mọi chuỗi qua i18n, cập nhật chỉ khi đổi.
 * Bố cục: mục tiêu góc trên trái (6 s nổi rồi thu gọn) · la bàn trên giữa + số hướng · máu (thanh + trạng thái chữ) dưới trái
 * trên minimap · đạn dưới phải (băng to, dự trữ, tên súng, chế độ, thanh băng) · chấm ngắm ẩn khi ADS · hit marker · vòng hướng
 * trúng đạn · vignette máu · marker 3D mục tiêu/đồng đội · prompt · banner. Minimap/bản đồ ở `minimap.ts`.
 */
import './hud.css';
import { t } from './i18n';
import { CompassBar, type CompassMarker } from './compass';
import { Markers3D, type Marker3DInput, type Projector } from './markers';
import { Minimap, type MinimapActor } from './minimap';

export interface HudState {
  health: number;
  maxHealth: number;
  mag: number;
  magSize: number;
  reserve: number;
  weaponState: string;
  /** khoá i18n tên súng (weapon.<id>) — rỗng = không súng */
  weaponKey: string;
  /** khoá i18n chế độ bắn */
  fireModeKey: string;
  spreadDeg: number;
  /** 0..1 */
  ads: number;
  objectiveKey: string | null;
  /** m tới mục tiêu (null = không có điểm) */
  objectiveDist: number | null;
  /** DV-084 đếm ngược mục tiêu (s); null = không */
  objectiveTimer?: number | null;
  promptKey: string | null;
  /** khoá i18n phím prompt (vd. key.f) */
  promptKeyCap: string;
  /** tiến trình giữ phím 0..1 (−1 = không có thanh) */
  promptProgress: number;
  dead: boolean;
  missionComplete: boolean;
  /** độ, 0 = bắc (−z) */
  headingDeg: number;
  /** khoá i18n lệnh tổ hiện tại (AI-T1.5); null = không có tổ */
  squadOrderKey?: string | null;
  /** lựu đạn còn mang (DV-074); undefined = không hiện */
  grenades?: number;
  /** lựu đạn địch gần: phương vị tương đối (độ, 0 = trước, + = phải); null = không có */
  grenadeWarnDeg?: number | null;
  grenadeWarnDist?: number;
  /** áp chế người chơi 0..1 (DV-075): tối viền + mất màu */
  suppression?: number;
  /** DV-078 hồi đêm: số xe qua ngầm / tổng / cháy — null = không hiện */
  convoy?: { crossed: number; total: number; lost: number } | null;
  /** DV-078: đang ngồi đại liên phòng không → thước ngắm vòng thay chấm ngắm */
  aaSight?: boolean;
  /** DV-078: dòng phụ của bảng hoàn thành (điểm đêm) + gợi ý sang hồi tiếp; null = mặc định */
  completeSub?: string | null;
  nextHint?: string | null;
}

const OBJ_FRESH_MS = 6000;

export class Hud {
  private root: HTMLElement;
  private els: Record<'hurt' | 'objective' | 'objLabel' | 'objText' | 'objDist' | 'vitals' | 'vState' | 'vHp' | 'vBar' | 'ammo' | 'mag' | 'res' | 'wname' | 'wmode' | 'segs' | 'reticle' | 'hit' | 'dmg' | 'markers' | 'prompt' | 'promptKey' | 'promptText' | 'promptBar' | 'banner' | 'bannerBig' | 'bannerSub' | 'heading' | 'compass' | 'minimap' | 'squad' | 'squadOrder' | 'gren' | 'gwarn' | 'supp' | 'convoy' | 'aasight' | 'bannerNext', HTMLElement>;
  private last: Partial<HudState> = {};
  readonly state: HudState = { health: 100, maxHealth: 100, mag: 0, magSize: 30, reserve: 0, weaponState: '', weaponKey: '', fireModeKey: 'firemode.auto', spreadDeg: 1, ads: 0, objectiveKey: null, objectiveDist: null, promptKey: null, promptKeyCap: 'key.f', promptProgress: -1, dead: false, missionComplete: false, headingDeg: 0 };
  readonly compass: CompassBar;
  readonly markers: Markers3D;
  readonly minimap: Minimap;
  private objChangedAt = -Infinity;
  private convoyKey = '';
  private hurtFlash = 0;
  private hitTimer = 0;
  private lastFrame = 0;
  /** thống kê cho test */
  readonly stats = { hits: 0, kills: 0, damageIndicators: 0, objectiveChanges: 0 };

  constructor() {
    this.root = document.getElementById('hud')!;
    this.root.innerHTML = `
      <div class="supp" data-testid="suppression"></div>
      <div class="hurt" data-testid="hurt"></div>
      <div class="markers" data-testid="markers"></div>
      <div class="compass" data-testid="compass"></div>
      <div class="heading num" data-testid="heading">000</div>
      <div class="objective" data-testid="objective" hidden><span class="label"></span><span class="text"></span><span class="dist"></span></div>
      <div class="squad" data-testid="squad-order" hidden><span class="order"></span><span class="keys"></span></div>
      <div class="vitals" data-testid="health"><div class="row"><span class="state"></span><span class="hp"></span></div><div class="bar"><i></i></div></div>
      <div class="minimap" data-testid="minimap"><canvas></canvas><span class="n"></span><span class="scale"><i></i><span></span></span></div>
      <div class="ammo" data-testid="ammo"><div><span class="mag"></span><span class="res"></span></div><div class="meta"><span class="label wname"></span><span class="label mode"></span><span class="label gren" data-testid="grenades" hidden></span></div><div class="segs"><i></i></div></div>
      <div class="reticle" data-testid="crosshair"><i class="dot"></i><i class="arm t"></i><i class="arm b"></i><i class="arm l"></i><i class="arm r"></i></div>
      <div class="hit" data-testid="hitmarker"><i></i><i></i><i></i><i></i></div>
      <div class="dmg" data-testid="damage-dir"><i></i><i></i><i></i></div>
      <div class="gwarn" data-testid="grenade-warn" hidden><i></i></div>
      <div class="prompt" data-testid="prompt" hidden><span class="key"></span><span class="ptext"></span><span class="pbar" hidden><i></i></span></div>
      <div class="convoy" data-testid="convoy" hidden></div>
      <div class="aasight" data-testid="aa-sight" hidden><svg viewBox="-100 -100 200 200" aria-hidden="true"><line x1="-14" y1="0" x2="-5" y2="0"/><line x1="5" y1="0" x2="14" y2="0"/><line x1="0" y1="5" x2="0" y2="14"/><circle class="c" r="1.6"/></svg></div>
      <div class="banner" data-testid="banner" hidden><div class="big"></div><div class="sub"></div><div class="next" data-testid="banner-next" hidden></div></div>`;
    const q = (sel: string): HTMLElement => this.root.querySelector(sel)!;
    this.els = {
      hurt: q('.hurt'), objective: q('.objective'), objLabel: q('.objective .label'), objText: q('.objective .text'), objDist: q('.objective .dist'),
      vitals: q('.vitals'), vState: q('.vitals .state'), vHp: q('.vitals .hp'), vBar: q('.vitals .bar i'),
      ammo: q('.ammo'), mag: q('.ammo .mag'), res: q('.ammo .res'), wname: q('.ammo .wname'), wmode: q('.ammo .mode'), segs: q('.ammo .segs i'),
      reticle: q('.reticle'), hit: q('.hit'), dmg: q('.dmg'), markers: q('.markers'), prompt: q('.prompt'), promptKey: q('.prompt .key'), promptText: q('.prompt .ptext'), promptBar: q('.prompt .pbar'),
      banner: q('.banner'), bannerBig: q('.banner .big'), bannerSub: q('.banner .sub'), heading: q('.heading'), compass: q('.compass'), minimap: q('.minimap'),
      squad: q('.squad'), squadOrder: q('.squad .order'), gren: q('.ammo .gren'), gwarn: q('.gwarn'), supp: q('.supp'),
      convoy: q('.convoy'), aasight: q('.aasight'), bannerNext: q('.banner .next'),
    };
    (this.els.squad.querySelector('.keys') as HTMLElement).textContent = t('hud.order.keys');
    this.els.objLabel.textContent = t('hud.objective_label');
    this.compass = new CompassBar(this.els.compass, 90);
    this.markers = new Markers3D(this.els.markers);
    this.minimap = new Minimap(this.els.minimap);
    window.addEventListener('resize', () => this.compass.layout());
  }

  show(visible: boolean): void {
    this.root.hidden = !visible;
    if (visible) this.compass.layout();
  }

  /** trúng địch (do người chơi bắn) */
  hit(kill: boolean): void {
    this.stats.hits++;
    if (kill) this.stats.kills++;
    const el = this.els.hit;
    el.classList.remove('show');
    void el.offsetWidth; // restart animation
    el.classList.toggle('kill', kill);
    el.classList.add('show');
    this.hitTimer = 0.3;
  }

  /** bị trúng đạn từ phương vị tương đối (độ, 0 = trước mặt, dương = phải) */
  damageFrom(relDeg: number): void {
    this.stats.damageIndicators++;
    const arcs = this.els.dmg.children;
    // chọn arc rảnh (không .on) hoặc cái đầu
    let el = arcs[0] as HTMLElement;
    for (const a of arcs) if (!(a as HTMLElement).classList.contains('on')) { el = a as HTMLElement; break; }
    el.classList.remove('on');
    void el.offsetWidth;
    el.style.transform = `rotate(${relDeg.toFixed(1)}deg)`;
    el.classList.add('on');
    this.hurtFlash = Math.min(1, this.hurtFlash + 0.5);
  }

  setCompassMarkers(list: readonly CompassMarker[]): void {
    this.compass.setMarkers(list);
  }

  setMarkers3D(list: readonly Marker3DInput[], project: Projector, eye: [number, number, number], fwd: [number, number, number]): void {
    this.markers.update(list, project, this.root.clientWidth || window.innerWidth, this.root.clientHeight || window.innerHeight, eye, fwd);
  }

  setMinimapActors(player: MinimapActor, others: readonly MinimapActor[], objective: { x: number; z: number } | null): void {
    this.minimap.setActors(player, others, objective);
  }

  /** Cập nhật DOM chỉ khi giá trị đổi (gọi mỗi frame render). */
  update(): void {
    const s = this.state;
    const l = this.last;
    const now = performance.now();
    const dt = this.lastFrame ? Math.min(0.1, (now - this.lastFrame) / 1000) : 0;
    this.lastFrame = now;
    // ---- máu
    if (l.health !== s.health || l.maxHealth !== s.maxHealth) {
      const r = Math.max(0, Math.min(1, s.health / s.maxHealth));
      const stateKey = r >= 0.6 ? 'hud.vitals.stable' : r >= 0.3 ? 'hud.vitals.wounded' : 'hud.vitals.critical';
      this.els.vState.textContent = t(stateKey);
      this.els.vHp.textContent = String(Math.ceil(s.health));
      this.els.vBar.style.transform = `scaleX(${r.toFixed(3)})`;
      this.els.vitals.classList.toggle('wounded', r < 0.6 && r >= 0.3);
      this.els.vitals.classList.toggle('critical', r < 0.3);
      if (l.health !== undefined && s.health < l.health) this.hurtFlash = Math.min(1, this.hurtFlash + 0.35);
      l.health = s.health;
      l.maxHealth = s.maxHealth;
    }
    // vignette: máu thấp + flash
    const hr = 1 - Math.max(0, Math.min(1, s.health / s.maxHealth));
    const vig = Math.min(1, Math.pow(hr, 1.6) * 0.85 + this.hurtFlash * 0.6);
    this.els.hurt.style.opacity = vig.toFixed(3);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.8);
    if (this.hitTimer > 0) this.hitTimer -= dt;
    // ---- đạn
    if (l.mag !== s.mag || l.reserve !== s.reserve || l.weaponState !== s.weaponState || l.weaponKey !== s.weaponKey || l.magSize !== s.magSize || l.fireModeKey !== s.fireModeKey) {
      const has = !!s.weaponKey;
      this.els.ammo.hidden = !has;
      if (has) {
        this.els.mag.textContent = String(s.mag);
        this.els.res.textContent = s.reserve < 0 ? '/ ∞' : `/ ${s.reserve}`;
        this.els.wname.textContent = t(s.weaponKey);
        this.els.wmode.textContent = t(s.fireModeKey);
        this.els.segs.style.transform = `scaleX(${Math.max(0, Math.min(1, s.mag / Math.max(1, s.magSize))).toFixed(3)})`;
        this.els.ammo.classList.toggle('low', s.mag <= Math.max(3, Math.round(s.magSize * 0.15)));
        this.els.ammo.classList.toggle('reloading', s.weaponState === 'RELOAD');
      }
      l.mag = s.mag;
      l.reserve = s.reserve;
      l.weaponState = s.weaponState;
      l.weaponKey = s.weaponKey;
      l.magSize = s.magSize;
      l.fireModeKey = s.fireModeKey;
    }
    // ---- lựu đạn
    if (l.grenades !== s.grenades) {
      this.els.gren.hidden = s.grenades === undefined;
      if (s.grenades !== undefined) {
        this.els.gren.textContent = t('hud.grenades', { n: s.grenades });
        this.els.gren.classList.toggle('empty', s.grenades === 0);
      }
      l.grenades = s.grenades;
    }
    const gw = s.grenadeWarnDeg ?? null;
    if (gw === null) {
      if (!this.els.gwarn.hidden) this.els.gwarn.hidden = true;
    } else {
      this.els.gwarn.hidden = false;
      this.els.gwarn.style.transform = `rotate(${gw.toFixed(1)}deg)`;
      this.els.gwarn.classList.toggle('close', (s.grenadeWarnDist ?? 99) < 5);
    }
    // ---- áp chế
    const sp = Math.max(0, Math.min(1, s.suppression ?? 0));
    if (Math.abs((l.suppression ?? -1) - sp) > 0.01) {
      this.els.supp.style.opacity = sp.toFixed(3);
      l.suppression = sp;
    }
    // ---- đoàn xe (DV-078)
    const cv = s.convoy ?? null;
    const cvKey = cv ? `${cv.crossed}/${cv.total}/${cv.lost}` : '';
    if (this.convoyKey !== cvKey) {
      this.els.convoy.hidden = !cv;
      if (cv) this.els.convoy.textContent = cv.lost > 0 ? `${t('hud.convoy', { n: cv.crossed, total: cv.total })} · ${t('hud.convoy_lost', { n: cv.lost })}` : t('hud.convoy', { n: cv.crossed, total: cv.total });
      this.convoyKey = cvKey;
    }
    if ((l.aaSight ?? false) !== (s.aaSight ?? false)) {
      this.els.aasight.hidden = !s.aaSight;
      this.els.reticle.classList.toggle('off', !!s.aaSight);
      l.aaSight = s.aaSight ?? false;
    }
    // ---- chấm ngắm
    if (Math.abs((l.spreadDeg ?? -1) - s.spreadDeg) > 0.05) {
      this.els.reticle.style.setProperty('--gap', `${(6 + s.spreadDeg * 6).toFixed(0)}px`);
      l.spreadDeg = s.spreadDeg;
    }
    if ((l.ads ?? -1) !== s.ads) {
      this.els.reticle.classList.toggle('ads', s.ads > 0.5);
      l.ads = s.ads;
    }
    // ---- la bàn
    if (l.headingDeg !== s.headingDeg) {
      this.compass.setHeading(s.headingDeg);
      const h = Math.round(((s.headingDeg % 360) + 360) % 360) % 360;
      const txt = String(h).padStart(3, '0');
      if (this.els.heading.textContent !== txt) this.els.heading.textContent = txt;
      l.headingDeg = s.headingDeg;
    }
    // ---- mục tiêu
    if (l.objectiveKey !== s.objectiveKey) {
      const has = !!s.objectiveKey;
      this.els.objective.hidden = !has;
      if (has) {
        this.els.objText.textContent = t(`hud.objective.${s.objectiveKey}`);
        this.els.objective.classList.remove('compact', 'fresh');
        void this.els.objective.offsetWidth;
        this.els.objective.classList.add('fresh');
        this.objChangedAt = now;
        this.stats.objectiveChanges++;
      }
      l.objectiveKey = s.objectiveKey;
      l.objectiveDist = undefined;
    }
    if (s.objectiveKey && now - this.objChangedAt > OBJ_FRESH_MS && !this.els.objective.classList.contains('compact')) this.els.objective.classList.add('compact');
    const timer = s.objectiveTimer ?? null;
    const tSec = timer === null ? null : Math.max(0, Math.ceil(timer));
    if (s.objectiveKey && (l.objectiveDist !== s.objectiveDist || l.objectiveTimer !== tSec)) {
      const d = s.objectiveDist;
      const dist = d === null ? '' : `${Math.round(d)} ${t('unit.m')}`;
      // DV-084: còn giờ → "18 s · 42 m", đỏ nhấp nháy khi ≤ 10 s
      this.els.objDist.textContent = tSec === null ? dist : `${tSec} ${t('unit.s')}${dist ? ` · ${dist}` : ''}`;
      this.els.objective.classList.toggle('urgent', tSec !== null && tSec <= 10);
      if (tSec !== null) this.els.objective.classList.remove('compact');
      l.objectiveDist = d;
      l.objectiveTimer = tSec;
    }
    // ---- lệnh tổ
    if (l.squadOrderKey !== s.squadOrderKey) {
      this.els.squad.hidden = !s.squadOrderKey;
      if (s.squadOrderKey) {
        this.els.squadOrder.textContent = t(s.squadOrderKey);
        this.els.squad.classList.remove('fresh');
        void this.els.squad.offsetWidth;
        this.els.squad.classList.add('fresh');
      }
      l.squadOrderKey = s.squadOrderKey;
    }
    // ---- prompt
    if (l.promptProgress !== s.promptProgress) {
      this.els.promptBar.hidden = s.promptProgress < 0;
      if (s.promptProgress >= 0) (this.els.promptBar.firstElementChild as HTMLElement).style.width = `${Math.round(s.promptProgress * 100)}%`;
      l.promptProgress = s.promptProgress;
    }
    if (l.promptKey !== s.promptKey || l.promptKeyCap !== s.promptKeyCap) {
      this.els.prompt.hidden = !s.promptKey;
      if (s.promptKey) {
        this.els.promptKey.textContent = t(s.promptKeyCap);
        this.els.promptText.textContent = t(`hud.prompt.${s.promptKey}`);
      }
      l.promptKey = s.promptKey;
      l.promptKeyCap = s.promptKeyCap;
    }
    // ---- banner
    if (l.dead !== s.dead || l.missionComplete !== s.missionComplete || l.completeSub !== s.completeSub || l.nextHint !== s.nextHint) {
      const big = s.dead ? t('hud.state.dead') : s.missionComplete ? t('hud.mission_complete') : '';
      const sub = s.dead ? t('hud.state.dead_sub') : s.missionComplete ? s.completeSub ?? t('hud.mission_complete_sub') : '';
      const next = !s.dead && s.missionComplete ? s.nextHint ?? null : null;
      this.els.bannerNext.hidden = !next;
      this.els.bannerNext.textContent = next ?? '';
      l.completeSub = s.completeSub;
      l.nextHint = s.nextHint;
      this.els.banner.hidden = !big;
      this.els.banner.classList.toggle('dead', s.dead);
      this.els.bannerBig.textContent = big;
      this.els.bannerSub.textContent = sub;
      l.dead = s.dead;
      l.missionComplete = s.missionComplete;
    }
    this.minimap.draw(s.headingDeg);
  }
}
