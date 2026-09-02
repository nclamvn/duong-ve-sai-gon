/**
 * Audio (PRD AUD-001 [S12]): Web Audio, bus master/sfx/dialogue/radio/music (GainNode), ducking theo priority,
 * PannerNode cho nguồn 3D. G0: SFX placeholder sinh bằng code (noise burst / oscillator) — không file, không license.
 * Voice counter cho budget audio_voices (≤ 32).
 */
export type Bus = 'master' | 'sfx' | 'dialogue' | 'radio' | 'music';

export class AudioEngine {
  ctx: AudioContext | null = null;
  private buses: Record<Bus, GainNode> | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  activeVoices = 0;
  maxVoices = 32;
  peakVoices = 0;
  /** số lần bị từ chối vì quá maxVoices */
  dropped = 0;
  private duckUntil = 0;
  enabled = true;

  /** Phải gọi sau user gesture (click/keydown). Idempotent. */
  init(): boolean {
    if (this.ctx) return true;
    if (typeof AudioContext === 'undefined') return false;
    try {
      const ctx = new AudioContext();
      const mk = (): GainNode => ctx.createGain();
      const master = mk();
      master.connect(ctx.destination);
      const buses: Record<Bus, GainNode> = { master, sfx: mk(), dialogue: mk(), radio: mk(), music: mk() };
      buses.sfx.gain.value = 0.5;
      buses.dialogue.gain.value = 1;
      buses.radio.gain.value = 0.9;
      buses.music.gain.value = 0.6;
      buses.sfx.connect(master);
      buses.dialogue.connect(master);
      buses.radio.connect(master);
      buses.music.connect(master);
      // noise buffer 1 s
      const len = ctx.sampleRate;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let seed = 1234567;
      for (let i = 0; i < len; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        d[i] = (seed / 4294967296) * 2 - 1;
      }
      this.noiseBuffer = buf;
      this.ctx = ctx;
      this.buses = buses;
      if (ctx.state === 'suspended') void ctx.resume();
      return true;
    } catch {
      return false;
    }
  }

  setBusGain(bus: Bus, v: number): void {
    if (this.buses) this.buses[bus].gain.value = v;
  }

  /** Cập nhật listener theo camera (world). */
  setListener(px: number, py: number, pz: number, fx: number, fy: number, fz: number): void {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    if ('positionX' in l && l.positionX) {
      const t = this.ctx.currentTime;
      l.positionX.setValueAtTime(px, t);
      l.positionY.setValueAtTime(py, t);
      l.positionZ.setValueAtTime(pz, t);
      l.forwardX.setValueAtTime(fx, t);
      l.forwardY.setValueAtTime(fy, t);
      l.forwardZ.setValueAtTime(fz, t);
      l.upX.setValueAtTime(0, t);
      l.upY.setValueAtTime(1, t);
      l.upZ.setValueAtTime(0, t);
    } else {
      (l as unknown as { setPosition(x: number, y: number, z: number): void }).setPosition(px, py, pz);
      (l as unknown as { setOrientation(...a: number[]): void }).setOrientation(fx, fy, fz, 0, 1, 0);
    }
  }

  private voiceStart(): boolean {
    if (this.activeVoices >= this.maxVoices) {
      this.dropped++;
      return false;
    }
    this.activeVoices++;
    this.peakVoices = Math.max(this.peakVoices, this.activeVoices);
    return true;
  }

  private voiceEnd(): void {
    this.activeVoices = Math.max(0, this.activeVoices - 1);
  }

  /** Ducking: SFX/music hạ khi có dialogue/radio ưu tiên (AUD-001). */
  duck(ms: number, amount = 0.35): void {
    if (!this.ctx || !this.buses) return;
    const t = this.ctx.currentTime;
    this.duckUntil = t + ms / 1000;
    for (const b of ['sfx', 'music'] as const) {
      const g = this.buses[b].gain;
      g.cancelScheduledValues(t);
      g.setTargetAtTime(amount * (b === 'sfx' ? 0.5 : 0.6), t, 0.03);
      g.setTargetAtTime(b === 'sfx' ? 0.5 : 0.6, this.duckUntil, 0.15);
    }
  }

  private noiseBurst(bus: Bus, durationMs: number, gain: number, filterHz: number, q = 0.7, position?: [number, number, number]): void {
    if (!this.enabled || !this.ctx || !this.buses || !this.noiseBuffer) return;
    if (!this.voiceStart()) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = filterHz;
    filt.Q.value = q;
    const env = ctx.createGain();
    const t = ctx.currentTime;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t + durationMs / 1000);
    src.connect(filt);
    filt.connect(env);
    let out: AudioNode = env;
    if (position) {
      const pan = ctx.createPanner();
      pan.panningModel = 'HRTF';
      pan.distanceModel = 'inverse';
      pan.refDistance = 2;
      pan.maxDistance = 80;
      pan.rolloffFactor = 1.2;
      const tt = ctx.currentTime;
      pan.positionX.setValueAtTime(position[0], tt);
      pan.positionY.setValueAtTime(position[1], tt);
      pan.positionZ.setValueAtTime(position[2], tt);
      env.connect(pan);
      out = pan;
    }
    out.connect(this.buses[bus]);
    src.start(t);
    src.stop(t + durationMs / 1000 + 0.05);
    src.onended = () => this.voiceEnd();
  }

  /** Súng 3 lớp (AUD-002 rút gọn): transient + body + tail. */
  gunshot(): void {
    this.noiseBurst('sfx', 60, 0.9, 6000, 0.5);
    this.noiseBurst('sfx', 140, 0.5, 900, 1.2);
    this.noiseBurst('sfx', 420, 0.18, 300, 0.8);
  }

  /** Súng của bot: 3D positional, ngắn hơn. */
  gunshotAt(position: [number, number, number]): void {
    this.noiseBurst('sfx', 70, 0.7, 4500, 0.6, position);
    this.noiseBurst('sfx', 260, 0.25, 500, 0.9, position);
  }

  impact(material: string, position: [number, number, number]): void {
    const hz = material === 'steel' ? 3200 : material === 'wood' ? 1400 : material === 'flesh' ? 500 : 900;
    this.noiseBurst('sfx', material === 'steel' ? 180 : 90, 0.35, hz, 1.0, position);
  }

  reload(): void {
    this.noiseBurst('sfx', 50, 0.3, 2500, 2);
    setTimeout(() => this.noiseBurst('sfx', 60, 0.35, 1800, 2), 350);
  }

  tone(bus: Bus, freq: number, ms: number, gain = 0.15): void {
    if (!this.enabled || !this.ctx || !this.buses) return;
    if (!this.voiceStart()) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const env = ctx.createGain();
    const t = ctx.currentTime;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    osc.connect(env);
    env.connect(this.buses[bus]);
    osc.start(t);
    osc.stop(t + ms / 1000 + 0.02);
    osc.onended = () => this.voiceEnd();
  }

  /** Radio cue: blip mở + duck SFX trong thời gian thoại. */
  radioCue(durationMs: number): void {
    this.tone('radio', 1200, 80, 0.08);
    this.duck(durationMs);
  }
}
