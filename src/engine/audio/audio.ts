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

  /**
   * Nguồn âm máy bay 3D liên tục (TIP-D-SKY, AUD-003 "động cơ xa có hướng/khoảng cách"): procedural, không file.
   *  rotor: xung "phành phạch" 10,8 Hz (Huey 2 cánh 324 v/ph) = noise lowpass 320 Hz nhân AM + sine 27 Hz thân;
   *  jet: noise bandpass 900 Hz + lowpass 2,8 kHz, rít nhẹ 2,4 kHz; prop: răng cưa 85 Hz + noise.
   *  Doppler: playbackRate = 1 − v_radial/343 (vận tốc tương đối theo tia tới người nghe), kẹp ±25 %.
   * Panner inverse, refDistance 40, maxDistance 3000. Trả null khi chưa init/không còn voice.
   */
  aircraft(kind: 'rotor' | 'jet' | 'prop'): { set(pos: { x: number; y: number; z: number }, vel: { x: number; y: number; z: number }): void; stop(): void } | null {
    if (!this.enabled || !this.ctx || !this.buses || !this.noiseBuffer) return null;
    if (!this.voiceStart()) return null;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0.0001;
    const pan = ctx.createPanner();
    pan.panningModel = 'HRTF';
    pan.distanceModel = 'inverse';
    pan.refDistance = 40;
    pan.maxDistance = 3000;
    pan.rolloffFactor = 1;
    out.connect(pan);
    pan.connect(this.buses.sfx);
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    const nodes: AudioScheduledSourceNode[] = [noise];
    let gainTarget = 0.5;
    if (kind === 'rotor') {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 320;
      lp.Q.value = 0.9;
      const am = ctx.createGain();
      am.gain.value = 0.35;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 10.8;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 0.35;
      lfo.connect(lfoG);
      lfoG.connect(am.gain);
      noise.connect(lp);
      lp.connect(am);
      am.connect(out);
      const body = ctx.createOscillator();
      body.type = 'sine';
      body.frequency.value = 27;
      const bodyG = ctx.createGain();
      bodyG.gain.value = 0.25;
      body.connect(bodyG);
      bodyG.connect(out);
      nodes.push(lfo, body);
      gainTarget = 0.7;
    } else if (kind === 'jet') {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900;
      bp.Q.value = 0.6;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2800;
      noise.connect(bp);
      bp.connect(lp);
      lp.connect(out);
      const whine = ctx.createOscillator();
      whine.type = 'sine';
      whine.frequency.value = 2400;
      const wG = ctx.createGain();
      wG.gain.value = 0.02;
      whine.connect(wG);
      wG.connect(out);
      nodes.push(whine);
      gainTarget = 0.9;
    } else {
      const saw = ctx.createOscillator();
      saw.type = 'sawtooth';
      saw.frequency.value = 85;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 600;
      saw.connect(lp);
      const sG = ctx.createGain();
      sG.gain.value = 0.18;
      lp.connect(sG);
      sG.connect(out);
      const nl = ctx.createBiquadFilter();
      nl.type = 'lowpass';
      nl.frequency.value = 500;
      const nG = ctx.createGain();
      nG.gain.value = 0.15;
      noise.connect(nl);
      nl.connect(nG);
      nG.connect(out);
      nodes.push(saw);
      gainTarget = 0.55;
    }
    const t0 = ctx.currentTime;
    for (const n of nodes) n.start(t0);
    out.gain.setTargetAtTime(gainTarget, t0, 0.5);
    let stopped = false;
    const l = ctx.listener;
    const lp = { x: 0, y: 0, z: 0 };
    return {
      set: (pos, vel) => {
        if (stopped) return;
        const t = ctx.currentTime;
        pan.positionX.setTargetAtTime(pos.x, t, 0.05);
        pan.positionY.setTargetAtTime(pos.y, t, 0.05);
        pan.positionZ.setTargetAtTime(pos.z, t, 0.05);
        // Doppler theo vận tốc xuyên tâm (người nghe đứng yên tương đối)
        if ('positionX' in l && l.positionX) {
          lp.x = l.positionX.value;
          lp.y = l.positionY.value;
          lp.z = l.positionZ.value;
        }
        const dx = lp.x - pos.x;
        const dy = lp.y - pos.y;
        const dz = lp.z - pos.z;
        const d = Math.hypot(dx, dy, dz) || 1;
        const vr = (vel.x * dx + vel.y * dy + vel.z * dz) / d; // > 0: đang tới
        const rate = Math.max(0.75, Math.min(1.25, 1 + vr / 343));
        noise.playbackRate.setTargetAtTime(rate, t, 0.1);
        for (const n of nodes) if ((n as OscillatorNode).detune) (n as OscillatorNode).detune.setTargetAtTime(1200 * Math.log2(rate), t, 0.1);
      },
      stop: () => {
        if (stopped) return;
        stopped = true;
        const t = ctx.currentTime;
        out.gain.setTargetAtTime(0.0001, t, 0.3);
        for (const n of nodes) n.stop(t + 1.5);
        setTimeout(() => {
          out.disconnect();
          pan.disconnect();
          this.voiceEnd();
        }, 1700);
      },
    };
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

  /**
   * Súng 3 lớp (AUD-002 rút gọn): transient + body + tail. `weaponId` chọn hồ sơ: `ak47` (7,62×39, TIP-D10) trầm hơn,
   * thân dài hơn, đuôi vang rừng; mặc định AR 5,56.
   */
  gunshot(weaponId = 'ar_v1'): void {
    if (weaponId === 'ak47') {
      this.noiseBurst('sfx', 55, 0.95, 4200, 0.6);
      this.noiseBurst('sfx', 170, 0.55, 620, 1.1);
      this.noiseBurst('sfx', 560, 0.22, 220, 0.7);
      return;
    }
    this.noiseBurst('sfx', 60, 0.9, 6000, 0.5);
    this.noiseBurst('sfx', 140, 0.5, 900, 1.2);
    this.noiseBurst('sfx', 420, 0.18, 300, 0.8);
  }

  /** Súng của bot: 3D positional, ngắn hơn. */
  gunshotAt(position: [number, number, number]): void {
    this.noiseBurst('sfx', 70, 0.7, 4500, 0.6, position);
    this.noiseBurst('sfx', 260, 0.25, 500, 0.9, position);
  }

  /** đạn chạm vật liệu (GUN-202): thép chói/dài, gỗ khô, đất (terrain) đục ngắn trầm, mặc định bê tông */
  impact(material: string, position: [number, number, number]): void {
    const hz = material === 'steel' ? 3200 : material === 'wood' ? 1400 : material === 'flesh' ? 500 : material === 'earth' ? 380 : 900;
    const ms = material === 'steel' ? 180 : material === 'earth' ? 120 : 90;
    this.noiseBurst('sfx', ms, material === 'earth' ? 0.3 : 0.35, hz, material === 'earth' ? 0.7 : 1.0, position);
  }

  /** Nổ bộc phá/lựu đạn (M2 R1): ầm trầm dài + tiếng vỡ + đuôi ù; duck bus khác 0,6 s */
  explosion(position: [number, number, number], size = 1): void {
    this.noiseBurst('sfx', 520 * size, 0.95, 140, 0.5, position);
    this.noiseBurst('sfx', 160, 0.6, 1800, 0.9, position);
    this.tone('sfx', 48, 420 * size, 0.35);
    this.duck(600, 0.5);
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
