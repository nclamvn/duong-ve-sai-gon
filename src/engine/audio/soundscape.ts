/**
 * Soundscape rừng Trường Sơn (TIP soundscape): tổng hợp WebAudio thủ tục cho từng kind, không file mẫu.
 * Lịch phát do SoundscapePlan (thuần TS, tất định) quyết; lớp này chỉ dựng đồ thị âm và phát lên bus 'ambience'
 * của AudioEngine. Không phát gì khi audio chưa init (plan vẫn chạy để lịch liên tục).
 *
 * Đồ thị chung (dựng một lần khi audio sẵn sàng):
 *   event: nguồn → env → lowpass không khí (theo khoảng cách) → panner equalpower (không suy hao, tự tính) → dry → bus
 *                                 └→ wetSend (xa thì ướt hơn) → reverbIn → convolver (IR noise tự sinh, có phản xạ
 *                                    sườn núi 0,18 s / 0,55 s) + delay phản hồi 0,42 s → bus
 *   bed (ve sầu, mưa phùn): noise lọc + AM → stereo → bedGain → bus
 * Ngân sách voice: mỗi event giữ 1 voice của AudioEngine (acquireVoice) và tối đa `maxActive` event nền cùng lúc,
 * để nền rừng không lấn tiếng súng.
 */
import type { AudioEngine } from './audio';
import { mulberry32, type Prng } from '@engine/core/prng';
import {
  SoundscapePlan,
  airLowpassHz,
  dbToGain,
  distanceGain,
  greatCallNote,
  type AmbientState,
  type Range2,
  type SoundEvent,
  type SoundscapeConfig,
  type VoiceConfig,
} from './soundscapePlan';

export interface ListenerPos {
  x: number;
  y: number;
  z: number;
}

type Vec3Like = ListenerPos | readonly [number, number, number];

interface Track {
  ctx: AudioContext;
  nodes: AudioNode[];
  last: AudioScheduledSourceNode | null;
  lastStop: number;
}

interface BedNodes {
  gain: GainNode;
  nodes: AudioNode[];
  sources: AudioScheduledSourceNode[];
  target: number;
}

const TAU = Math.PI * 2;

function rng2(x: number | Range2 | undefined, fb: Range2): Range2 {
  if (Array.isArray(x)) return x as Range2;
  if (typeof x === 'number') return [x, x];
  return fb;
}

function num(x: number | Range2 | undefined, fb: number): number {
  return typeof x === 'number' ? x : fb;
}

export class Soundscape {
  readonly plan: SoundscapePlan;
  /** tối đa event nền đang kêu cùng lúc */
  maxActive = 8;
  active = 0;
  dropped = 0;
  private readonly audio: AudioEngine;
  private readonly seed: number;
  private readonly voices = new Map<string, VoiceConfig>();
  private readonly synthPrng: Prng;
  private ctx: AudioContext | null = null;
  private dry: GainNode | null = null;
  private reverbIn: GainNode | null = null;
  private graph: AudioNode[] = [];
  private graphSources: AudioScheduledSourceNode[] = [];
  private noise: AudioBuffer | null = null;
  private readonly beds = new Map<string, BedNodes>();
  private readonly listener: ListenerPos = { x: 0, y: 0, z: 0 };
  private readonly live = new Set<Track>();
  private disposed = false;

  constructor(audio: AudioEngine, cfg: SoundscapeConfig, seed: number) {
    this.audio = audio;
    this.seed = seed >>> 0;
    this.plan = new SoundscapePlan(cfg, seed);
    for (const v of this.plan.cfg.voices) this.voices.set(v.id, v);
    this.synthPrng = mulberry32(this.seed).fork('synth');
  }

  /** Gọi mỗi frame render. `listener` = vị trí camera (world). */
  update(dt: number, state: AmbientState, listener: ListenerPos): void {
    if (this.disposed) return;
    this.listener.x = listener.x;
    this.listener.y = listener.y;
    this.listener.z = listener.z;
    const out = this.plan.update(dt, state);
    if (!this.ready()) return;
    for (const ev of out.events) this.play(ev, null);
    for (const b of out.beds) this.setBed(b.voiceId, b.intensity * dbToGain(b.gainDb));
  }

  /** Âm báo động tự nhiên tại vị trí world (có người đi gần): mang sủa / voọc sủa + đập cành. */
  alarm(position: Vec3Like, kind: 'muntjac' | 'douc'): void {
    if (this.disposed) return;
    const p = Array.isArray(position) ? { x: position[0], y: position[1], z: position[2] } : (position as ListenerPos);
    const dx = p.x - this.listener.x;
    const dz = p.z - this.listener.z;
    const dist = Math.max(1, Math.hypot(dx, p.y - this.listener.y, dz));
    const az = Math.atan2(dx, -dz);
    const ev = this.plan.alarm(kind, az, dist);
    if (!ev || !this.ready()) return;
    this.play(ev, p);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const t = this.ctx?.currentTime ?? 0;
    for (const tr of this.live) {
      try {
        tr.last?.stop(t);
      } catch {
        /* đã dừng */
      }
    }
    for (const b of this.beds.values()) {
      for (const s of b.sources) {
        try {
          s.stop(t);
        } catch {
          /* đã dừng */
        }
      }
      for (const n of b.nodes) n.disconnect();
      b.gain.disconnect();
      this.audio.releaseVoice();
    }
    this.beds.clear();
    for (const s of this.graphSources) {
      try {
        s.stop(t);
      } catch {
        /* đã dừng */
      }
    }
    for (const n of this.graph) n.disconnect();
    this.graph = [];
    this.graphSources = [];
    this.dry = null;
    this.reverbIn = null;
    this.ctx = null;
  }

  // ------------------------------------------------------------ đồ thị chung

  private ready(): boolean {
    if (!this.audio.enabled || !this.audio.ctx) return false;
    if (this.ctx === this.audio.ctx && this.dry) return true;
    const bus = this.audio.busNode('ambience');
    if (!bus) return false;
    this.buildGraph(this.audio.ctx, bus);
    return true;
  }

  private buildGraph(ctx: AudioContext, bus: GainNode): void {
    this.ctx = ctx;
    const p = mulberry32(this.seed).fork('graph');
    // noise 2 s tất định
    const len = ctx.sampleRate * 2;
    const nb = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = p.next() * 2 - 1;
    this.noise = nb;

    const dry = ctx.createGain();
    dry.gain.value = 1;
    dry.connect(bus);
    const reverbIn = ctx.createGain();
    reverbIn.gain.value = 1;

    // IR rừng + sườn núi: đuôi noise suy giảm mũ 2,6 s, lọc tối dần, cộng 2 phản xạ rời
    const irLen = Math.floor(ctx.sampleRate * 2.6);
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < irLen; i++) {
        const t = i / ctx.sampleRate;
        const decay = Math.exp(-t / 0.75);
        const a = 0.25 + 0.7 * Math.min(1, t / 1.2); // tối dần: lọc thông thấp mạnh hơn về cuối
        lp += (p.next() * 2 - 1 - lp) * (1 - a);
        data[i] = lp * decay * (t < 0.012 ? t / 0.012 : 1);
      }
      for (const [tt, g] of [
        [0.18, 0.35],
        [0.55, 0.22],
      ] as const) {
        const i0 = Math.floor((tt + ch * 0.011) * ctx.sampleRate);
        for (let k = 0; k < 220 && i0 + k < irLen; k++) data[i0 + k] = (data[i0 + k] ?? 0) + g * (p.next() * 2 - 1) * Math.exp(-k / 60);
      }
    }
    const conv = ctx.createConvolver();
    conv.normalize = true;
    conv.buffer = ir;
    const convOut = ctx.createGain();
    convOut.gain.value = 0.55;
    reverbIn.connect(conv);
    conv.connect(convOut);
    convOut.connect(bus);

    // vọng sườn núi: delay phản hồi có lọc
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.42;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const dlp = ctx.createBiquadFilter();
    dlp.type = 'lowpass';
    dlp.frequency.value = 1500;
    const dOut = ctx.createGain();
    dOut.gain.value = 0.3;
    reverbIn.connect(delay);
    delay.connect(dlp);
    dlp.connect(fb);
    fb.connect(delay);
    dlp.connect(dOut);
    dOut.connect(bus);

    this.dry = dry;
    this.reverbIn = reverbIn;
    this.graph = [dry, reverbIn, conv, convOut, delay, fb, dlp, dOut];
  }

  // ------------------------------------------------------------ event

  private play(ev: SoundEvent, worldPos: ListenerPos | null): void {
    const ctx = this.ctx;
    const v = this.voices.get(ev.voiceId);
    if (!ctx || !this.dry || !this.reverbIn || !this.noise || !v) return;
    if (this.active >= this.maxActive) {
      this.dropped++;
      return;
    }
    if (!this.audio.acquireVoice()) {
      this.dropped++;
      return;
    }
    this.active++;
    const tr: Track = { ctx, nodes: [], last: null, lastStop: 0 };
    const t0 = ctx.currentTime + 0.02 + Math.max(0, ev.startOffset);
    const env = ctx.createGain();
    env.gain.value = ev.intensity * dbToGain(ev.gainDb) * distanceGain(ev.distanceM);
    const air = ctx.createBiquadFilter();
    air.type = 'lowpass';
    air.frequency.value = airLowpassHz(ev.distanceM);
    const pan = ctx.createPanner();
    pan.panningModel = 'equalpower';
    pan.distanceModel = 'inverse';
    pan.rolloffFactor = 0;
    let px: number;
    let py: number;
    let pz: number;
    if (worldPos) {
      px = worldPos.x;
      py = worldPos.y;
      pz = worldPos.z;
    } else {
      const h = Math.sqrt(Math.max(1, ev.distanceM * ev.distanceM - ev.elevationM * ev.elevationM));
      px = this.listener.x + Math.sin(ev.azimuthRad) * h;
      py = this.listener.y + ev.elevationM;
      pz = this.listener.z - Math.cos(ev.azimuthRad) * h;
    }
    pan.positionX.setValueAtTime(px, ctx.currentTime);
    pan.positionY.setValueAtTime(py, ctx.currentTime);
    pan.positionZ.setValueAtTime(pz, ctx.currentTime);
    const wetSend = ctx.createGain();
    wetSend.gain.value = ev.wet * (0.4 + 0.6 * Math.min(1, ev.distanceM / 800));
    env.connect(air);
    air.connect(pan);
    pan.connect(this.dry);
    air.connect(wetSend);
    wetSend.connect(this.reverbIn);
    tr.nodes.push(env, air, pan, wetSend);

    const p = mulberry32(ev.params.seed);
    switch (ev.kind) {
      case 'gibbon':
        this.gibbon(tr, env, t0, ev, v, p);
        break;
      case 'hornbill':
        if (ev.variant === 'wingbeat') this.hornbillWings(tr, env, t0, ev, v, p);
        else this.hornbillDuet(tr, env, t0, ev, v, p);
        break;
      case 'coucal':
        this.coucal(tr, env, t0, ev, v, p);
        break;
      case 'junglefowl':
        if (ev.variant === 'roost') this.roost(tr, env, t0, ev, p);
        else this.crow(tr, env, t0, ev, p);
        break;
      case 'gecko':
        this.gecko(tr, env, t0, ev, v, p);
        break;
      case 'frogs':
        this.frogs(tr, env, t0, ev, v, p);
        break;
      case 'muntjac':
        this.muntjac(tr, env, t0, ev, p);
        break;
      case 'douc':
        this.douc(tr, env, t0, ev, v, p);
        break;
      default:
        break;
    }
    this.finish(tr);
  }

  private finish(tr: Track): void {
    if (!tr.last) {
      for (const n of tr.nodes) n.disconnect();
      this.active = Math.max(0, this.active - 1);
      this.audio.releaseVoice();
      return;
    }
    this.live.add(tr);
    tr.last.onended = () => {
      for (const n of tr.nodes) n.disconnect();
      this.live.delete(tr);
      this.active = Math.max(0, this.active - 1);
      this.audio.releaseVoice();
    };
  }

  // ------------------------------------------------------------ khối dựng

  private track(tr: Track, src: AudioScheduledSourceNode, t0: number, t1: number): void {
    src.start(t0);
    src.stop(t1);
    tr.nodes.push(src);
    if (t1 >= tr.lastStop) {
      tr.lastStop = t1;
      tr.last = src;
    }
  }

  private osc(tr: Track, type: OscillatorType, hz: number, t0: number, t1: number): OscillatorNode {
    const o = tr.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(hz, t0);
    this.track(tr, o, t0, t1);
    return o;
  }

  private noiseSrc(tr: Track, t0: number, t1: number, p: Prng): AudioBufferSourceNode {
    const s = tr.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.start(t0, p.range(0, 1.9));
    s.stop(t1);
    tr.nodes.push(s);
    if (t1 >= tr.lastStop) {
      tr.lastStop = t1;
      tr.last = s;
    }
    return s;
  }

  private filter(tr: Track, type: BiquadFilterType, hz: number, q = 0.7): BiquadFilterNode {
    const f = tr.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = hz;
    f.Q.value = q;
    tr.nodes.push(f);
    return f;
  }

  private gain(tr: Track, v = 0): GainNode {
    const g = tr.ctx.createGain();
    g.gain.value = v;
    tr.nodes.push(g);
    return g;
  }

  /** bao biên độ một nốt: lên tuyến tính, giữ, tắt (cut = tắt tức thì ở cuối, như gà rừng) */
  private note(g: AudioParam, t: number, peak: number, a: number, hold: number, r: number, cut = false): void {
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(peak, t + a);
    g.setValueAtTime(peak, t + a + hold);
    if (cut) g.setValueAtTime(0, t + a + hold + 0.004);
    else g.linearRampToValueAtTime(0, t + a + hold + r);
  }

  /** tiếng nổ ngắn noise lọc (click, sủa, cành) */
  private burst(tr: Track, out: AudioNode, t: number, durS: number, peak: number, type: BiquadFilterType, hz: number, q: number, p: Prng): void {
    const s = this.noiseSrc(tr, t, t + durS + 0.02, p);
    const f = this.filter(tr, type, hz, q);
    const g = this.gain(tr);
    this.note(g.gain, t, peak, Math.min(0.004, durS * 0.2), 0, durS);
    s.connect(f);
    f.connect(g);
    g.connect(out);
  }

  // ------------------------------------------------------------ vượn

  private gibbon(tr: Track, out: AudioNode, t0: number, ev: SoundEvent, v: VoiceConfig, p: Prng): void {
    const n = Math.max(1, ev.params.count);
    const hz = rng2(v.synth?.['greatHz'], [600, 1600]);
    const main = this.gain(tr);
    const o1 = tr.ctx.createOscillator();
    o1.type = 'sine';
    const o2 = tr.ctx.createOscillator();
    o2.type = 'triangle';
    const g2 = this.gain(tr, 0.12);
    o1.connect(main);
    o2.connect(g2);
    g2.connect(main);
    main.connect(out);
    let t = t0;
    const setF = (f: number, at: number, ramp: boolean): void => {
      if (ramp) {
        o1.frequency.exponentialRampToValueAtTime(f, at);
        o2.frequency.exponentialRampToValueAtTime(f * 2, at);
      } else {
        o1.frequency.setValueAtTime(f, at);
        o2.frequency.setValueAtTime(f * 2, at);
      }
    };
    if (ev.variant === 'great') {
      // great call con cái: nốt cao dần 600 → 1600 Hz, mỗi nốt quét lên, nốt ngắn dần, nhanh dần
      for (let i = 0; i < n; i++) {
        const nt = greatCallNote(i, n, hz);
        const f = nt.hz * p.range(0.97, 1.03);
        setF(f * 0.82, t, false);
        setF(f * 1.12, t + nt.durS * 0.85, true);
        this.note(main.gain, t, 0.9, 0.03, nt.durS * 0.6, nt.durS * 0.37);
        t += nt.durS + nt.gapS;
      }
    } else if (ev.variant === 'intro') {
      // vài nốt mở đầu xen kẽ đực (trầm) / cái (cao)
      for (let i = 0; i < n; i++) {
        const male = i % 2 === 1;
        const f = male ? p.range(650, 800) : p.range(900, 1100);
        const d = p.range(0.2, 0.3);
        setF(f, t, false);
        setF(f * 1.15, t + d, true);
        this.note(main.gain, t, male ? 0.55 : 0.7, 0.03, d * 0.5, d * 0.45);
        t += d + p.range(0.4, 0.6);
      }
    } else {
      // coda / interlude con đực: nốt "u-ố" lên rồi xuống, trầm hơn
      for (let i = 0; i < n; i++) {
        const f = p.range(500, ev.variant === 'coda' ? 900 : 1000);
        const d = ev.variant === 'coda' ? p.range(0.25, 0.35) : p.range(0.15, 0.25);
        setF(f * 0.9, t, false);
        setF(f * 1.25, t + d * 0.45, true);
        setF(f * 0.85, t + d, true);
        this.note(main.gain, t, 0.6, 0.02, d * 0.6, d * 0.38);
        t += d + p.range(0.15, 0.25);
      }
    }
    this.track(tr, o1, t0, t + 0.05);
    this.track(tr, o2, t0, t + 0.05);
  }

  // ------------------------------------------------------------ hồng hoàng

  private hornbillDuet(tr: Track, out: AudioNode, t0: number, ev: SoundEvent, v: VoiceConfig, p: Prng): void {
    const n = Math.max(2, ev.params.count);
    const step = 1 / Math.max(0.2, num(v.synth?.['kokPerSecond'], 1));
    let t = t0;
    for (let i = 0; i < n; i++) {
      // kok của con đực ~ 1 lần/giây; con cái nhập vào sau vài tiếng, cao hơn, lệch nửa nhịp
      this.kok(tr, out, t + p.range(-0.04, 0.04), p.range(380, 440), 0.9, p);
      if (i >= 2) this.kok(tr, out, t + step * 0.5 + p.range(-0.05, 0.05), p.range(520, 600), 0.7, p);
      t += step;
    }
    // hỗn hợp gầm và sủa
    const roarEnd = t + p.range(1.5, 2.5);
    const saw = this.osc(tr, 'sawtooth', p.range(180, 240), t, roarEnd);
    const vib = this.osc(tr, 'sine', 6, t, roarEnd);
    const vibG = this.gain(tr, 18);
    vib.connect(vibG);
    vibG.connect(saw.frequency);
    const bp = this.filter(tr, 'bandpass', 700, 1.5);
    const rg = this.gain(tr);
    this.note(rg.gain, t, 0.45, 0.15, roarEnd - t - 0.5, 0.35);
    saw.connect(bp);
    bp.connect(rg);
    rg.connect(out);
    for (let k = 0; k < 4; k++) this.burst(tr, out, t + 0.2 + k * p.range(0.35, 0.45), 0.09, 0.6, 'bandpass', 950, 3, p);
  }

  private kok(tr: Track, out: AudioNode, t: number, f: number, peak: number, p: Prng): void {
    const o = this.osc(tr, 'sawtooth', f, t, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(f * 0.8, t + 0.1);
    const bp = this.filter(tr, 'bandpass', f * 2.2, 3);
    const g = this.gain(tr);
    this.note(g.gain, t, peak, 0.005, 0.03, 0.06);
    o.connect(bp);
    bp.connect(g);
    g.connect(out);
    this.burst(tr, out, t, 0.06, peak * 0.5, 'bandpass', 900, 4, p);
  }

  private hornbillWings(tr: Track, out: AudioNode, t0: number, ev: SoundEvent, v: VoiceConfig, p: Prng): void {
    // vỗ cánh nặng như đầu máy hơi nước khởi động: các "phì" noise trầm, nhịp nhanh dần, bay qua (to dần rồi nhỏ)
    const n = Math.max(4, ev.params.count);
    const gap = rng2(v.synth?.['puffGapS'], [0.45, 0.3]);
    let t = t0;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const pass = Math.sin(Math.PI * Math.min(1, 0.15 + u * 0.85));
      this.burst(tr, out, t, 0.2, 0.25 + 0.6 * pass, 'bandpass', p.range(260, 360), 0.9, p);
      t += gap[0] + (gap[1] - gap[0]) * u;
    }
  }

  // ------------------------------------------------------------ bìm bịp

  private coucal(tr: Track, out: AudioNode, t0: number, ev: SoundEvent, v: VoiceConfig, p: Prng): void {
    const n = Math.max(3, ev.params.count);
    const hz = rng2(v.synth?.['coopHz'], [300, 450]);
    const o = tr.ctx.createOscillator();
    o.type = 'sine';
    const lp = this.filter(tr, 'lowpass', 700, 0.5);
    const g = this.gain(tr);
    o.connect(lp);
    lp.connect(g);
    g.connect(out);
    let t = t0;
    const gap0 = p.range(0.22, 0.3);
    for (let i = 0; i < n; i++) {
      // chuỗi "coop" trầm, đi xuống, hơi nhanh dần
      const u = n <= 1 ? 0 : i / (n - 1);
      const f = hz[1] - (hz[1] - hz[0]) * u;
      const d = 0.16;
      o.frequency.setValueAtTime(f * 1.04, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.94, t + d);
      this.note(g.gain, t, 0.85, 0.03, d * 0.5, d * 0.45);
      t += d + gap0 * (1 - 0.3 * u);
    }
    this.track(tr, o, t0, t + 0.05);
  }

  // ------------------------------------------------------------ gà rừng

  private crow(tr: Track, out: AudioNode, t0: number, ev: SoundEvent, p: Prng): void {
    // gáy ngắn hơn gà nhà, tắt đột ngột: răng cưa qua 2 formant, 4 âm tiết, cắt cụt cuối
    const syl: readonly (readonly [number, number, number, number])[] = [
      [0, 0.11, 560, 660],
      [0.15, 0.3, 720, 920],
      [0.34, 0.5, 920, 860],
      [0.54, 0.86, 860, 760],
    ];
    const reps = Math.max(1, ev.params.count);
    let base = t0;
    for (let r = 0; r < reps; r++) {
      const k = p.range(0.92, 1.08);
      const end = base + 0.9;
      const o = this.osc(tr, 'sawtooth', syl[0]![2] * k, base, end);
      const f1 = this.filter(tr, 'bandpass', 900, 3);
      const f2 = this.filter(tr, 'bandpass', 2400, 4);
      const g = this.gain(tr);
      const g2 = this.gain(tr, 0.6);
      o.connect(f1);
      o.connect(f2);
      f2.connect(g2);
      f1.connect(g);
      g2.connect(g);
      g.connect(out);
      for (let i = 0; i < syl.length; i++) {
        const [a, b, fa, fb] = syl[i]!;
        o.frequency.setValueAtTime(fa * k, base + a);
        o.frequency.linearRampToValueAtTime(fb * k, base + b);
        this.note(g.gain, base + a, 0.8, 0.012, b - a - 0.03, 0.018, i === syl.length - 1);
      }
      base = end + p.range(2.5, 4);
    }
  }

  private roost(tr: Track, out: AudioNode, t0: number, ev: SoundEvent, p: Prng): void {
    // bay lên cây ngủ lúc hoàng hôn: vỗ cánh ~9 Hz rồi tiếng lá xào
    const n = Math.max(3, ev.params.count);
    let t = t0;
    for (let i = 0; i < n; i++) {
      this.burst(tr, out, t, 0.05, 0.7, 'lowpass', p.range(600, 800), 0.8, p);
      t += 1 / p.range(8, 10);
    }
    this.burst(tr, out, t + 0.05, 0.6, 0.25, 'highpass', 2500, 0.7, p);
  }

  // ------------------------------------------------------------ tắc kè

  private gecko(tr: Track, out: AudioNode, t0: number, ev: SoundEvent, v: VoiceConfig, p: Prng): void {
    const clicks = rng2(v.synth?.['clicks'], [6, 10]);
    const nc = p.int(clicks[0], clicks[1]);
    let t = t0;
    // tràng lách cách nhanh, trầm
    for (let i = 0; i < nc; i++) {
      this.burst(tr, out, t, 0.014, 0.6, 'lowpass', 900, 1, p);
      t += p.range(0.05, 0.075);
    }
    t += 0.5;
    const reps = Math.max(1, ev.params.count);
    for (let i = 0; i < reps; i++) {
      const amp = Math.pow(0.86, i);
      this.syllable(tr, out, t, 0.16, p.range(170, 190), 550, 0.9 * amp, 1.08); // "to"
      this.syllable(tr, out, t + 0.24, 0.2, p.range(200, 220), 1300, 0.85 * amp, 0.9); // "ke"
      t += 0.44 + p.range(0.8, 1.0);
    }
  }

  private syllable(tr: Track, out: AudioNode, t: number, d: number, f0: number, formant: number, peak: number, glide: number): void {
    const o = this.osc(tr, 'square', f0, t, t + d + 0.03);
    o.frequency.linearRampToValueAtTime(f0 * glide, t + d);
    const bp = this.filter(tr, 'bandpass', formant, 2.2);
    const g = this.gain(tr);
    this.note(g.gain, t, peak, 0.012, d * 0.6, d * 0.35);
    o.connect(bp);
    bp.connect(g);
    g.connect(out);
  }

  // ------------------------------------------------------------ ếch nhái

  private frogs(tr: Track, out: AudioNode, t0: number, ev: SoundEvent, v: VoiceConfig, p: Prng): void {
    const n = Math.max(1, ev.params.count);
    const hz = rng2(v.synth?.['croakHz'], [150, 450]);
    const span = p.range(3, 6);
    for (let i = 0; i < n; i++) {
      // tiếng ộp ngắn: vuông + formant, AM xung 25–40 ms (rè "rrrk")
      const t = t0 + p.range(0, span);
      const f = p.range(hz[0], hz[1]);
      const pulses = p.int(3, 8);
      const per = p.range(0.025, 0.04);
      const d = pulses * per;
      const o = this.osc(tr, 'square', f, t, t + d + 0.02);
      const bp = this.filter(tr, 'bandpass', f * 2.2, 3);
      const g = this.gain(tr);
      g.gain.setValueAtTime(0, t);
      const peak = p.range(0.4, 0.9);
      for (let k = 0; k < pulses; k++) {
        const tk = t + k * per;
        g.gain.setValueAtTime(0, tk);
        g.gain.linearRampToValueAtTime(peak, tk + per * 0.3);
        g.gain.linearRampToValueAtTime(0, tk + per * 0.95);
      }
      o.connect(bp);
      bp.connect(g);
      g.connect(out);
    }
  }

  // ------------------------------------------------------------ báo động

  private bark(tr: Track, out: AudioNode, t: number, f0: number, f1: number, formant: number, d: number, p: Prng): void {
    const o = this.osc(tr, 'sawtooth', f0, t, t + d + 0.02);
    o.frequency.exponentialRampToValueAtTime(f1, t + d);
    const bp = this.filter(tr, 'bandpass', formant, 2);
    const g = this.gain(tr);
    this.note(g.gain, t, 0.9, 0.005, d * 0.3, d * 0.65);
    o.connect(bp);
    bp.connect(g);
    g.connect(out);
    this.burst(tr, out, t, d * 0.8, 0.7, 'bandpass', formant, 2, p);
  }

  private muntjac(tr: Track, out: AudioNode, t0: number, ev: SoundEvent, p: Prng): void {
    // sủa gắt ngắn ~1 kHz
    let t = t0;
    for (let i = 0; i < Math.max(1, ev.params.count); i++) {
      this.bark(tr, out, t, p.range(1050, 1150), p.range(580, 650), 1000, 0.12, p);
      t += p.range(0.9, 1.5);
    }
  }

  private douc(tr: Track, out: AudioNode, t0: number, ev: SoundEvent, v: VoiceConfig, p: Prng): void {
    // sủa to + đập cành: tiếng sủa trầm hơn mang, rồi crackle cành lá và vài tiếng đập trầm
    let t = t0;
    for (let i = 0; i < Math.max(1, ev.params.count); i++) {
      this.bark(tr, out, t, p.range(400, 460), p.range(280, 320), 700, 0.14, p);
      t += p.range(0.35, 0.6);
    }
    const crackle = num(v.synth?.['crackleS'], 1.5);
    const nTicks = p.int(20, 40);
    for (let k = 0; k < nTicks; k++) this.burst(tr, out, t0 + 0.1 + p.range(0, crackle), p.range(0.008, 0.025), p.range(0.15, 0.5), 'highpass', p.range(2500, 5000), 0.8, p);
    for (let k = 0; k < 2; k++) this.burst(tr, out, t0 + 0.2 + p.range(0, crackle), 0.08, 0.8, 'lowpass', 200, 0.9, p);
  }

  // ------------------------------------------------------------ lớp nền

  private setBed(id: string, target: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    let b = this.beds.get(id);
    if (!b) {
      if (target < 0.001) return;
      const v = this.voices.get(id);
      if (!v || !this.audio.acquireVoice()) return;
      b = v.kind === 'cicada' ? this.makeCicada(ctx, v) : this.makeDrizzle(ctx, v);
      this.beds.set(id, b);
    }
    if (Math.abs(target - b.target) < 0.005) return;
    b.target = target;
    b.gain.gain.setTargetAtTime(target, ctx.currentTime, 1.5);
  }

  private bedSource(ctx: AudioContext, nodes: AudioNode[], sources: AudioScheduledSourceNode[]): AudioBufferSourceNode {
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.start(ctx.currentTime, this.synthPrng.range(0, 1.9));
    nodes.push(s);
    sources.push(s);
    return s;
  }

  private makeCicada(ctx: AudioContext, v: VoiceConfig): BedNodes {
    // noise dải cao, AM nhanh (rè) và phồng chậm; 2 lớp trái/phải lệch nhịp cho rộng
    const nodes: AudioNode[] = [];
    const sources: AudioScheduledSourceNode[] = [];
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.dry!);
    const band = num(v.synth?.['bandHz'], 4800);
    const buzz = num(v.synth?.['buzzHz'], 28);
    for (const side of [-0.6, 0.6]) {
      const s = this.bedSource(ctx, nodes, sources);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = band * this.synthPrng.range(0.92, 1.08);
      bp.Q.value = 2.5;
      const am = ctx.createGain();
      am.gain.value = 0.5;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = buzz * this.synthPrng.range(0.9, 1.1);
      const lfoG = ctx.createGain();
      lfoG.gain.value = 0.5;
      lfo.connect(lfoG);
      lfoG.connect(am.gain);
      const swell = ctx.createGain();
      swell.gain.value = 0.7;
      const slow = ctx.createOscillator();
      slow.frequency.value = this.synthPrng.range(0.06, 0.12);
      const slowG = ctx.createGain();
      slowG.gain.value = 0.3;
      slow.connect(slowG);
      slowG.connect(swell.gain);
      const sp = ctx.createStereoPanner();
      sp.pan.value = side;
      s.connect(bp);
      bp.connect(am);
      am.connect(swell);
      swell.connect(sp);
      sp.connect(gain);
      lfo.start();
      slow.start();
      nodes.push(bp, am, lfo, lfoG, swell, slow, slowG, sp);
      sources.push(lfo, slow);
    }
    return { gain, nodes, sources, target: 0 };
  }

  private makeDrizzle(ctx: AudioContext, v: VoiceConfig): BedNodes {
    // mưa nhỏ trên tán: hiss dải rộng + lộp độp dải giữa có AM nhẹ, gain theo rain
    const nodes: AudioNode[] = [];
    const sources: AudioScheduledSourceNode[] = [];
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.dry!);
    const hiss = rng2(v.synth?.['hissHz'], [500, 7000]);
    const s1 = this.bedSource(ctx, nodes, sources);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = hiss[0];
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = hiss[1];
    const g1 = ctx.createGain();
    g1.gain.value = 0.6;
    s1.connect(hp);
    hp.connect(lp);
    lp.connect(g1);
    g1.connect(gain);
    const s2 = this.bedSource(ctx, nodes, sources);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = num(v.synth?.['patterHz'], 1800);
    bp.Q.value = 0.7;
    const am = ctx.createGain();
    am.gain.value = 0.35;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 13;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.2;
    lfo.connect(lfoG);
    lfoG.connect(am.gain);
    s2.connect(bp);
    bp.connect(am);
    am.connect(gain);
    lfo.start();
    nodes.push(hp, lp, g1, bp, am, lfo, lfoG);
    sources.push(lfo);
    return { gain, nodes, sources, target: 0 };
  }
}

/** Phương vị (rad, 0 = −Z) từ người nghe tới điểm world — tiện cho game khi muốn đặt alarm theo hướng. */
export function azimuthTo(from: ListenerPos, to: ListenerPos): number {
  const a = Math.atan2(to.x - from.x, -(to.z - from.z));
  return a < 0 ? a + TAU : a;
}
