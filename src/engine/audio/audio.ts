/**
 * Audio (PRD AUD-001 [S12]): Web Audio, bus master/sfx/dialogue/radio/music/ambience (GainNode), ducking theo priority,
 * PannerNode cho nguồn 3D. G0: SFX placeholder sinh bằng code (noise burst / oscillator) — không file, không license.
 * Voice counter cho budget audio_voices (≤ 32).
 */
export type Bus = 'master' | 'sfx' | 'dialogue' | 'radio' | 'music' | 'ambience';

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
  /** DV-088 choáng nổ: master → lowpass → gain → loa (ù tai); ù rít + tim đập đi thẳng ra loa, không qua lọc */
  private shockFilter: BiquadFilterNode | null = null;
  private shockGain: GainNode | null = null;
  private ringOsc: OscillatorNode[] = [];
  private ringGain: GainNode | null = null;
  /** DV-089 lớp "thế giới" (sfx + nền): lowpass + gain riêng để lặng tiếng trận mà thoại vẫn rõ */
  private worldFilter: BiquadFilterNode | null = null;
  private worldGain: GainNode | null = null;

  /** Phải gọi sau user gesture (click/keydown). Idempotent. */
  init(): boolean {
    if (this.ctx) return true;
    if (typeof AudioContext === 'undefined') return false;
    try {
      const ctx = new AudioContext();
      const mk = (): GainNode => ctx.createGain();
      const master = mk();
      const shockFilter = ctx.createBiquadFilter();
      shockFilter.type = 'lowpass';
      shockFilter.frequency.value = 20000;
      shockFilter.Q.value = 0.9;
      const shockGain = mk();
      master.connect(shockFilter);
      shockFilter.connect(shockGain);
      shockGain.connect(ctx.destination);
      this.shockFilter = shockFilter;
      this.shockGain = shockGain;
      // ù rít: hai sóng sin sát nhau (phách chậm) ở ~4 kHz, chạy thường trực với gain 0 → không tạo nút giữa trận
      const ringGain = mk();
      ringGain.gain.value = 0;
      ringGain.connect(ctx.destination);
      for (const hz of [3870, 3884]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = hz;
        o.connect(ringGain);
        o.start();
        this.ringOsc.push(o);
      }
      this.ringGain = ringGain;
      const buses: Record<Bus, GainNode> = { master, sfx: mk(), dialogue: mk(), radio: mk(), music: mk(), ambience: mk() };
      buses.sfx.gain.value = 0.5;
      buses.dialogue.gain.value = 1;
      buses.radio.gain.value = 0.9;
      buses.music.gain.value = 0.6;
      // bus nền rừng (TIP soundscape): không bị duck, mức thấp hơn SFX
      buses.ambience.gain.value = 0.7;
      const worldFilter = ctx.createBiquadFilter();
      worldFilter.type = 'lowpass';
      worldFilter.frequency.value = 20000;
      worldFilter.Q.value = 0.7;
      const worldGain = mk();
      worldFilter.connect(worldGain);
      worldGain.connect(master);
      this.worldFilter = worldFilter;
      this.worldGain = worldGain;
      buses.sfx.connect(worldFilter);
      buses.dialogue.connect(master);
      buses.radio.connect(master);
      buses.music.connect(master);
      buses.ambience.connect(worldFilter);
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
    this.listener[0] = px;
    this.listener[1] = py;
    this.listener[2] = pz;
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

  /** Node bus để module ngoài (Soundscape) nối đồ thị riêng; null khi chưa init. */
  busNode(bus: Bus): GainNode | null {
    return this.buses ? this.buses[bus] : null;
  }

  /** Giữ một voice trong budget audio_voices cho nguồn tự dựng ngoài engine; false khi hết chỗ/chưa init/tắt. */
  acquireVoice(): boolean {
    if (!this.enabled || !this.ctx) return false;
    return this.voiceStart();
  }

  /** Trả voice đã giữ bằng acquireVoice(). */
  releaseVoice(): void {
    this.voiceEnd();
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
  aircraft(kind: 'rotor' | 'jet' | 'prop' | 'truck'): { set(pos: { x: number; y: number; z: number }, vel: { x: number; y: number; z: number }): void; stop(): void } | null {
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
    } else if (kind === 'truck') {
      // DV-078 máy xăng ZIL-157 chạy chậm qua ngầm: răng cưa 34 Hz (≈ 1000 v/ph, 6 xi lanh) + tiếng gầm noise thấp; gần mới nghe
      pan.refDistance = 7;
      pan.maxDistance = 420;
      const saw = ctx.createOscillator();
      saw.type = 'sawtooth';
      saw.frequency.value = 34;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 260;
      saw.connect(lp);
      const sG = ctx.createGain();
      sG.gain.value = 0.32;
      lp.connect(sG);
      sG.connect(out);
      const nl = ctx.createBiquadFilter();
      nl.type = 'bandpass';
      nl.frequency.value = 180;
      nl.Q.value = 0.8;
      const nG = ctx.createGain();
      nG.gain.value = 0.22;
      noise.connect(nl);
      nl.connect(nG);
      nG.connect(out);
      nodes.push(saw);
      gainTarget = 0.5;
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

  /** vị trí người nghe (world) cập nhật ở setListener — tính khoảng cách cho tiếng súng xa (DV-075) */
  readonly listener: [number, number, number] = [0, 0, 0];
  private lastEchoAt = -1;

  private noiseBurst(
    bus: Bus,
    durationMs: number,
    gain: number,
    filterHz: number,
    q = 0.7,
    position?: [number, number, number],
    o?: { delayMs?: number; type?: BiquadFilterType; refDistance?: number; maxDistance?: number },
  ): void {
    if (!this.enabled || !this.ctx || !this.buses || !this.noiseBuffer) return;
    if (!this.voiceStart()) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filt = ctx.createBiquadFilter();
    filt.type = o?.type ?? 'lowpass';
    filt.frequency.value = filterHz;
    filt.Q.value = q;
    const env = ctx.createGain();
    const t = ctx.currentTime + (o?.delayMs ?? 0) / 1000;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t + durationMs / 1000);
    src.connect(filt);
    filt.connect(env);
    let out: AudioNode = env;
    if (position) {
      const pan = ctx.createPanner();
      // DV-091: HRTF (a convolution per voice on the audio thread) only where it is heard — near the head; distant
      // gunfire and echoes (most voices in a big fight) use equal-power panning, inaudibly different at range
      const L = this.listener;
      const near = Math.hypot(position[0] - L[0], position[1] - L[1], position[2] - L[2]) < 18;
      pan.panningModel = near ? 'HRTF' : 'equalpower';
      pan.distanceModel = 'inverse';
      pan.refDistance = o?.refDistance ?? 2;
      pan.maxDistance = o?.maxDistance ?? 80;
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

  /** dãy giả ngẫu nhiên tất định cho biến thiên âm (golden ratio, không Math.random — AGENTS) */
  private jitterSeq = 0;
  private jitter(): number {
    this.jitterSeq = (this.jitterSeq + 0.6180339887) % 1;
    return this.jitterSeq;
  }

  /**
   * DV-063 tiếng suối thủ tục (chưa có bản ghi thật có license — Q3 roadmap): noise qua 3 bộ lọc dải hẹp có tần số trôi chậm
   * (róc rách) + 1 lớp "ục ục" lọc dải điều biến nhanh, lowpass 5 kHz, nguồn 3D. `set(pos, level)` cập nhật vị trí/độ lớn 0..1.
   */
  brook(): { set(pos: { x: number; y: number; z: number }, level: number): void; stop(): void } | null {
    if (!this.enabled || !this.ctx || !this.buses || !this.noiseBuffer) return null;
    if (!this.voiceStart()) return null;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    const sum = ctx.createGain();
    sum.gain.value = 1;
    const nodes: AudioScheduledSourceNode[] = [noise];
    const bands: Array<[number, number, number, number]> = [
      [520, 7, 0.37, 140],
      [1150, 6, 0.61, 260],
      [2300, 5, 1.13, 420],
      [780, 14, 6.5, 220], // ục ục
    ];
    for (const [hz, q, lfoHz, depth] of bands) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = hz;
      bp.Q.value = q;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = lfoHz * (0.85 + this.jitter() * 0.3);
      const lg = ctx.createGain();
      lg.gain.value = depth;
      lfo.connect(lg);
      lg.connect(bp.frequency);
      noise.connect(bp);
      const g = ctx.createGain();
      g.gain.value = q > 10 ? 0.9 : 0.55;
      bp.connect(g);
      g.connect(sum);
      nodes.push(lfo);
    }
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5000;
    const out = ctx.createGain();
    out.gain.value = 0.0001;
    const pan = ctx.createPanner();
    pan.panningModel = 'HRTF';
    pan.distanceModel = 'inverse';
    pan.refDistance = 4;
    pan.maxDistance = 160;
    pan.rolloffFactor = 1.1;
    sum.connect(lp);
    lp.connect(out);
    out.connect(pan);
    pan.connect(this.buses['ambience']);
    for (const n of nodes) n.start(t);
    let stopped = false;
    return {
      set: (pos, level) => {
        if (stopped) return;
        const tt = ctx.currentTime;
        pan.positionX.setTargetAtTime(pos.x, tt, 0.2);
        pan.positionY.setTargetAtTime(pos.y, tt, 0.2);
        pan.positionZ.setTargetAtTime(pos.z, tt, 0.2);
        out.gain.setTargetAtTime(Math.max(0.0001, Math.min(1, level)) * 0.9, tt, 0.4);
      },
      stop: () => {
        if (stopped) return;
        stopped = true;
        const tt = ctx.currentTime;
        out.gain.setTargetAtTime(0.0001, tt, 0.2);
        for (const n of nodes) n.stop(tt + 0.8);
        setTimeout(() => this.voiceEnd(), 900);
      },
    };
  }

  /**
   * DV-063 tiếng bước chân theo mặt đất (thủ tục): lá mục = vài tiếng lạo xạo cao tần; đất nện = tiếng thịch trầm;
   * bùn = "nhóp" lọc dải trượt xuống; đá = cạch ngắn; nước = tiếng lội toé. `loud` 0..1 (đi/chạy/cúi).
   */
  footstep(surface: 'leaves' | 'soil' | 'mud' | 'rock' | 'water', loud = 1, position?: [number, number, number]): void {
    const g = Math.max(0.05, Math.min(1, loud));
    const j = (): number => 0.85 + this.jitter() * 0.3;
    switch (surface) {
      case 'leaves':
        this.noiseBurst('sfx', 70 * j(), 0.18 * g, 380 * j(), 0.8, position);
        for (let k = 0; k < 3; k++) setTimeout(() => this.noiseBurst('sfx', 28 * j(), 0.09 * g, 5200 * j(), 1.4, position), 15 + k * 32 * j());
        break;
      case 'soil':
        this.noiseBurst('sfx', 90 * j(), 0.26 * g, 260 * j(), 0.9, position);
        this.noiseBurst('sfx', 35, 0.06 * g, 2400 * j(), 1, position);
        break;
      case 'mud':
        this.noiseBurst('sfx', 140 * j(), 0.22 * g, 520 * j(), 3.5, position);
        setTimeout(() => this.noiseBurst('sfx', 110 * j(), 0.12 * g, 300 * j(), 5, position), 70);
        break;
      case 'rock':
        this.noiseBurst('sfx', 40 * j(), 0.2 * g, 3100 * j(), 2.2, position);
        this.noiseBurst('sfx', 70, 0.12 * g, 700 * j(), 1, position);
        break;
      case 'water':
        this.noiseBurst('sfx', 220 * j(), 0.3 * g, 1900 * j(), 0.7, position);
        setTimeout(() => this.noiseBurst('sfx', 260 * j(), 0.16 * g, 3600 * j(), 0.6, position), 60);
        break;
    }
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

  /**
   * DV-088 choáng nổ (sóng xung kích sát người): cả trận đánh như bị bịt tai (lowpass tụt xuống ~250–900 Hz rồi mở lại
   * trong `seconds`), tiếng ù rít ~4 kHz nổi lên rồi tắt chậm hơn, âm lượng chung hụt xuống một nhịp. `k` 0..1 theo độ gần.
   * Gọi lại khi đang choáng: lấy mức nặng hơn (không cộng dồn thành điếc hẳn).
   */
  shellShock(k: number, seconds: number): void {
    if (!this.ctx || !this.shockFilter || !this.shockGain || !this.ringGain) return;
    const t = this.ctx.currentTime;
    const kk = Math.max(0, Math.min(1, k));
    const f = this.shockFilter.frequency;
    const cur = f.value;
    const low = 900 - 650 * kk;
    f.cancelScheduledValues(t);
    f.setValueAtTime(Math.min(cur, 20000), t);
    f.exponentialRampToValueAtTime(Math.min(cur, low), t + 0.04);
    // giữ ù một lúc rồi mở dần (tai hồi lại)
    f.setValueAtTime(Math.min(cur, low), t + seconds * 0.3);
    f.exponentialRampToValueAtTime(20000, t + seconds);
    const g = this.shockGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(1 - 0.45 * kk, t + 0.05);
    g.setTargetAtTime(1, t + seconds * 0.35, seconds * 0.25);
    const r = this.ringGain.gain;
    const peak = Math.max(r.value, 0.05 * kk);
    r.cancelScheduledValues(t);
    r.setValueAtTime(r.value, t);
    r.linearRampToValueAtTime(peak, t + 0.15);
    r.setTargetAtTime(0, t + seconds * 0.45, seconds * 0.35);
  }

  /**
   * DV-089 thế giới lặng đi (khoảnh khắc nín thở trước giờ xung phong): tiếng trận và nền rừng chìm xuống, mất cao tần trong
   * ~1,5 s, giữ `seconds`, rồi trở lại trong ~2 s. Thoại/bộ đàm không bị ảnh hưởng. `depth` 0..1.
   */
  hush(depth: number, seconds: number): void {
    if (!this.ctx || !this.worldFilter || !this.worldGain) return;
    const t = this.ctx.currentTime;
    const d = Math.max(0, Math.min(1, depth));
    const f = this.worldFilter.frequency;
    const g = this.worldGain.gain;
    f.cancelScheduledValues(t);
    f.setValueAtTime(f.value, t);
    f.exponentialRampToValueAtTime(2400 - 1700 * d, t + 1.5);
    f.setValueAtTime(2400 - 1700 * d, t + seconds);
    f.exponentialRampToValueAtTime(20000, t + seconds + 2);
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(1 - 0.75 * d, t + 1.5);
    g.setValueAtTime(1 - 0.75 * d, t + seconds);
    g.linearRampToValueAtTime(1, t + seconds + 2);
  }

  /** DV-088 hồi tai ngay (chơi lại/đổi màn) */
  clearShock(): void {
    if (!this.ctx || !this.shockFilter || !this.shockGain || !this.ringGain) return;
    const t = this.ctx.currentTime;
    const world = this.worldFilter && this.worldGain ? ([[this.worldFilter.frequency, 20000], [this.worldGain.gain, 1]] as const) : [];
    for (const [p, v] of [[this.shockFilter.frequency, 20000], [this.shockGain.gain, 1], [this.ringGain.gain, 0], ...world] as const) {
      p.cancelScheduledValues(t);
      p.setValueAtTime(v, t);
    }
  }

  /**
   * DV-088 một nhịp tim (thình-thịch) nghe trong đầu: hai nhát sin trầm 52/46 Hz, nhát sau nhẹ hơn. `k` 0..1 = độ to.
   * Không qua lọc choáng (tiếng trong người), không tính voice budget SFX.
   */
  heartbeat(k: number): void {
    if (!this.enabled || !this.ctx || k <= 0.01) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (const [dt, hz, g] of [[0, 52, 0.42], [0.27, 46, 0.3]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(hz * 1.5, t + dt);
      o.frequency.exponentialRampToValueAtTime(hz, t + dt + 0.05);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t + dt);
      env.gain.exponentialRampToValueAtTime(g * k, t + dt + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.16);
      o.connect(env);
      env.connect(ctx.destination);
      o.start(t + dt);
      o.stop(t + dt + 0.2);
    }
  }

  /** rút chốt + vung tay ném lựu đạn (DV-074) */
  grenadeThrow(): void {
    this.tone('sfx', 2300, 30, 0.05);
    this.noiseBurst('sfx', 160, 0.16, 900, 1.2, undefined, { delayMs: 120, type: 'bandpass' });
  }

  /** lựu đạn chạm đất/cây (k 0..1 theo tốc độ) */
  grenadeBounce(position: [number, number, number], k = 1): void {
    this.noiseBurst('sfx', 45, 0.25 * k + 0.05, 2600, 3, position, { type: 'bandpass' });
    this.noiseBurst('sfx', 70, 0.12 * k, 420, 0.8, position);
  }

  /**
   * Đạn sượt qua người chơi (DV-075): "chát" siêu âm (sóng xung kích, highpass 6 kHz rất ngắn) + "víu" dải 2–3 kHz tại điểm đạn bay
   * gần nhất (HRTF → nghe được bên trái/phải). `k` 0..1 theo độ gần.
   */
  nearMiss(position: [number, number, number], k = 1): void {
    const j = 0.85 + 0.3 * this.jitter();
    this.noiseBurst('sfx', 14, 0.5 * k + 0.15, 6500 * j, 0.6, position, { type: 'highpass', refDistance: 1.5 });
    // DV-088 "chát" sóng xung kích sát tai: thêm một nhát dải 3,2 kHz cực ngắn (đạn bay ngay mang tai nghe như roi quất)
    if (k > 0.35) this.noiseBurst('sfx', 9, 0.55 * k, 3200 * j, 1.4, position, { type: 'bandpass', refDistance: 1.2 });
    this.noiseBurst('sfx', 120 + 60 * this.jitter(), 0.22 * k + 0.05, 2400 * j, 4, position, { type: 'bandpass', refDistance: 1.5 });
  }

  /**
   * Súng xa (DV-075): đến trễ theo tốc độ âm (d/343 s), mất cao tần theo khoảng cách, thân dài + vọng rừng (2 tiếng dội trễ
   * 0,18–0,6 s lọc trầm). Gần (< 25 m) giữ "chát" rõ.
   */
  gunshotFar(position: [number, number, number]): void {
    const L = this.listener;
    const d = Math.hypot(position[0] - L[0], position[1] - L[1], position[2] - L[2]);
    const delay = Math.min(900, (d / 343) * 1000);
    const hi = Math.max(900, 5200 * Math.exp(-d / 180));
    const o = { delayMs: delay, refDistance: 6, maxDistance: 600 };
    if (d < 25) this.noiseBurst('sfx', 40, 0.8, 7000, 0.5, position, o);
    this.noiseBurst('sfx', 80, 0.8, hi, 0.6, position, o);
    this.noiseBurst('sfx', 260 + Math.min(500, d * 2), 0.32, Math.max(260, hi * 0.12), 0.9, position, o);
    // vọng: rừng/đồi trả lại ở hai phía (giới hạn ≤ 1 lần/0,15 s để loạt nhiều súng không ăn hết voice)
    if (!this.ctx || this.ctx.currentTime - this.lastEchoAt < 0.15) return;
    this.lastEchoAt = this.ctx.currentTime;
    const j = this.jitter();
    this.noiseBurst('sfx', 420, 0.1 + Math.min(0.12, d / 900), 520, 0.7, position, { delayMs: delay + 180 + 140 * j, refDistance: 10, maxDistance: 800 });
    this.noiseBurst('sfx', 700, 0.07, 320, 0.7, position, { delayMs: delay + 420 + 180 * j, refDistance: 12, maxDistance: 900 });
  }

  /**
   * DV-078 đại liên 12,7 người chơi bắn: nổ đanh + thân trầm nặng (đạn 12,7×108) + rung 50 Hz + đuôi vọng thung lũng; không 3D
   * (người chơi ngồi sau súng).
   */
  heavyGun(): void {
    const j = this.jitter();
    this.noiseBurst('sfx', 45, 1.0, 4200 + 600 * j, 0.6);
    this.noiseBurst('sfx', 240, 0.8, 300, 1.0);
    this.tone('sfx', 52 + 6 * j, 110, 0.22);
    this.noiseBurst('sfx', 900, 0.12, 380, 0.7, undefined, { delayMs: 140 + 120 * j });
  }

  /**
   * DV-078 súng máy bay bắn từ xa (40 ly / 20 ly / 7,62): tiếng tới trễ đúng tốc độ âm (máy bay cách ~1 km → ~3 s sau chớp lửa),
   * 40 ly = "bộp" trầm từng phát; 20 ly/7,62 = tiếng rền liên tục (răng cưa tần số = nhịp bắn) dài `ms`.
   */
  airGun(position: [number, number, number], kind: 'bofors' | 'vulcan' | 'minigun', ms = 0): void {
    const L = this.listener;
    const d = Math.hypot(position[0] - L[0], position[1] - L[1], position[2] - L[2]);
    const delay = Math.min(5000, (d / 343) * 1000);
    const o = { delayMs: delay, refDistance: 150, maxDistance: 5000 };
    if (kind === 'bofors') {
      this.noiseBurst('sfx', 320, 0.75, 260, 0.9, position, o);
      this.noiseBurst('sfx', 900, 0.2, 140, 0.7, position, { ...o, delayMs: delay + 60 });
      return;
    }
    if (!this.enabled || !this.ctx || !this.buses || !this.noiseBuffer || !this.voiceStart()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay / 1000;
    const dur = Math.max(0.3, ms / 1000);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = kind === 'vulcan' ? 520 : 900;
    bp.Q.value = 0.9;
    const am = ctx.createGain();
    am.gain.value = 0.5;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = kind === 'vulcan' ? 95 : 66; // M61 ~5700 v/ph, minigun ~4000 v/ph
    const og = ctx.createGain();
    og.gain.value = 0.5;
    osc.connect(og);
    og.connect(am.gain);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(kind === 'vulcan' ? 0.7 : 0.5, t + 0.04);
    env.gain.setValueAtTime(kind === 'vulcan' ? 0.7 : 0.5, t + dur);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.35);
    const pan = ctx.createPanner();
    pan.panningModel = 'HRTF';
    pan.distanceModel = 'inverse';
    pan.refDistance = 150;
    pan.maxDistance = 5000;
    pan.positionX.value = position[0];
    pan.positionY.value = position[1];
    pan.positionZ.value = position[2];
    src.connect(bp);
    bp.connect(am);
    am.connect(env);
    env.connect(pan);
    pan.connect(this.buses.sfx);
    src.start(t);
    osc.start(t);
    src.stop(t + dur + 0.4);
    osc.stop(t + dur + 0.4);
    src.onended = () => this.voiceEnd();
  }

  /** DV-078 đạn máy bay chạm đất: 40 ly nổ (nhỏ hơn bộc phá), 20 ly nổ chát, 7,62 xé đất */
  shellHit(position: [number, number, number], kind: 'bofors' | 'vulcan' | 'minigun'): void {
    if (kind === 'bofors') {
      this.noiseBurst('sfx', 420, 0.85, 200, 0.6, position, { refDistance: 8, maxDistance: 900 });
      this.noiseBurst('sfx', 120, 0.5, 2200, 0.9, position, { refDistance: 6, maxDistance: 500 });
    } else if (kind === 'vulcan') this.noiseBurst('sfx', 90, 0.4, 1600, 0.8, position, { refDistance: 4, maxDistance: 400 });
    else this.noiseBurst('sfx', 50, 0.25, 900, 1.0, position, { refDistance: 3, maxDistance: 200 });
  }

  /** súng người chơi thêm đuôi vọng rừng (DV-075) */
  gunshotTail(): void {
    const j = this.jitter();
    this.noiseBurst('sfx', 500, 0.09, 600, 0.7, undefined, { delayMs: 160 + 90 * j });
    this.noiseBurst('sfx', 800, 0.06, 350, 0.7, undefined, { delayMs: 380 + 160 * j });
  }

  reload(): void {
    this.noiseBurst('sfx', 50, 0.3, 2500, 2);
    setTimeout(() => this.noiseBurst('sfx', 60, 0.35, 1800, 2), 350);
  }

  /**
   * DV-084 tiếng rít đạn cối/pháo bay tới: sin quét 1500 → 420 Hz trong `ms`, to dần, đặt tại điểm rơi (3D) — báo trước vụ nổ để
   * người chơi kịp nằm/chạy. Gợn nhẹ (vibrato) cho giống tiếng gió xé.
   */
  incoming(position: [number, number, number], ms = 1100, gain = 0.32): void {
    if (!this.enabled || !this.ctx || !this.buses) return;
    if (!this.voiceStart()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const dur = ms / 1000;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1500, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + dur);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 11;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 22;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain * 0.3, t + dur * 0.4);
    env.gain.exponentialRampToValueAtTime(gain, t + dur * 0.97);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.03);
    const pan = ctx.createPanner();
    pan.panningModel = 'HRTF';
    pan.distanceModel = 'inverse';
    pan.refDistance = 6;
    pan.maxDistance = 200;
    pan.rolloffFactor = 0.6;
    pan.positionX.setValueAtTime(position[0], t);
    pan.positionY.setValueAtTime(position[1] + 25, t);
    pan.positionZ.setValueAtTime(position[2], t);
    pan.positionY.linearRampToValueAtTime(position[1], t + dur);
    osc.connect(env);
    env.connect(pan);
    pan.connect(this.buses.sfx);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
    osc.onended = () => this.voiceEnd();
  }

  /** DV-084 lửa cháy lớn (napalm bùng): tiếng phụt trầm + lách tách */
  whoosh(position: [number, number, number], size = 1): void {
    this.noiseBurst('sfx', 1600 * size, 0.7, 380, 0.6, position, { refDistance: 8, maxDistance: 300 });
    this.noiseBurst('sfx', 900, 0.25, 3200, 1.5, position, { delayMs: 300, type: 'bandpass', refDistance: 4, maxDistance: 120 });
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

  /** giải mã file âm (giọng DV-076); null khi chưa init hoặc lỗi */
  async decode(data: ArrayBuffer): Promise<AudioBuffer | null> {
    if (!this.ctx) return null;
    try {
      return await this.ctx.decodeAudioData(data);
    } catch {
      return null;
    }
  }

  /**
   * Phát một AudioBuffer (giọng DV-076). `position` → nguồn 3D (HRTF, refDistance 3 m); `radio` → lọc dải 350–3200 Hz + méo nhẹ
   * như bộ đàm. Không tính vào voice budget SFX (thoại luôn được nói). Trả hàm dừng.
   */
  playBuffer(buffer: AudioBuffer, bus: Bus, o: { position?: [number, number, number]; gain?: number; radio?: boolean; refDistance?: number } = {}): (() => void) | null {
    if (!this.enabled || !this.ctx || !this.buses) return null;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    let node: AudioNode = src;
    if (o.radio) {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 350;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3200;
      const sh = ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * 2 - 1;
        curve[i] = Math.tanh(2.2 * x) / Math.tanh(2.2);
      }
      sh.curve = curve;
      node.connect(hp);
      hp.connect(lp);
      lp.connect(sh);
      node = sh;
    }
    const g = ctx.createGain();
    g.gain.value = o.gain ?? 1;
    node.connect(g);
    node = g;
    if (o.position) {
      const pan = ctx.createPanner();
      pan.panningModel = 'HRTF';
      pan.distanceModel = 'inverse';
      pan.refDistance = o.refDistance ?? 3;
      pan.maxDistance = 120;
      pan.rolloffFactor = 1;
      const t = ctx.currentTime;
      pan.positionX.setValueAtTime(o.position[0], t);
      pan.positionY.setValueAtTime(o.position[1], t);
      pan.positionZ.setValueAtTime(o.position[2], t);
      node.connect(pan);
      node = pan;
    }
    node.connect(this.buses[bus]);
    src.start();
    return () => {
      try {
        src.stop();
      } catch {
        /* đã dừng */
      }
    };
  }

  /** Radio cue: blip mở + duck SFX trong thời gian thoại. */
  radioCue(durationMs: number): void {
    this.tone('radio', 1200, 80, 0.08);
    this.duck(durationMs);
  }
}
