import { describe, it, expect } from 'vitest';
import raw from '@content/ecology/soundscape.truong-son.json';
import { AudioEngine } from '@engine/audio/audio';
import { Soundscape } from '@engine/audio/soundscape';
import { parseSoundscapeConfig, type AmbientState } from '@engine/audio/soundscapePlan';

// WebAudio giả tối thiểu cho Node: kiểm đồ thị dựng không ném lỗi, tham số hữu hạn, voice được trả lại.
class FakeParam {
  value = 0;
  calls = 0;
  private chk(v: number, t: number): void {
    this.calls++;
    if (!Number.isFinite(v) || !Number.isFinite(t) || t < 0) throw new Error(`bad automation ${v} @ ${t}`);
  }
  setValueAtTime(v: number, t: number): this {
    this.chk(v, t);
    return this;
  }
  linearRampToValueAtTime(v: number, t: number): this {
    this.chk(v, t);
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number): this {
    this.chk(v, t);
    if (v <= 0) throw new Error('exponential ramp to <= 0');
    return this;
  }
  setTargetAtTime(v: number, t: number, c: number): this {
    this.chk(v, t);
    if (!(c > 0)) throw new Error('bad time constant');
    return this;
  }
  cancelScheduledValues(): this {
    return this;
  }
}

class FakeNode {
  connected = 0;
  connect(dst: unknown): unknown {
    if (!dst) throw new Error('connect to nothing');
    this.connected++;
    return dst;
  }
  disconnect(): void {
    this.connected = 0;
  }
}

const sources: FakeSource[] = [];
let created = 0;
class FakeSource extends FakeNode {
  onended: (() => void) | null = null;
  started = false;
  stopAt = Infinity;
  frequency = new FakeParam();
  detune = new FakeParam();
  playbackRate = new FakeParam();
  offset = new FakeParam();
  type = 'sine';
  buffer: unknown = null;
  loop = false;
  constructor() {
    super();
    created++;
    sources.push(this);
  }
  start(t = 0): void {
    if (this.started) throw new Error('start twice');
    if (!Number.isFinite(t)) throw new Error('bad start');
    this.started = true;
  }
  stop(t = 0): void {
    if (!this.started) throw new Error('stop before start');
    this.stopAt = t;
  }
}

class FakeBuffer {
  private ch: Float32Array[];
  constructor(n: number, len: number) {
    this.ch = Array.from({ length: n }, () => new Float32Array(len));
  }
  getChannelData(i: number): Float32Array {
    return this.ch[i]!;
  }
}

class FakeCtx {
  currentTime = 0;
  sampleRate = 8000;
  state = 'running';
  destination = new FakeNode();
  listener = { positionX: new FakeParam(), positionY: new FakeParam(), positionZ: new FakeParam(), forwardX: new FakeParam(), forwardY: new FakeParam(), forwardZ: new FakeParam(), upX: new FakeParam(), upY: new FakeParam(), upZ: new FakeParam() };
  createGain(): FakeNode & { gain: FakeParam } {
    return Object.assign(new FakeNode(), { gain: new FakeParam() });
  }
  createBiquadFilter(): FakeNode {
    return Object.assign(new FakeNode(), { type: 'lowpass', frequency: new FakeParam(), Q: new FakeParam() });
  }
  createPanner(): FakeNode {
    return Object.assign(new FakeNode(), { panningModel: '', distanceModel: '', rolloffFactor: 1, refDistance: 1, maxDistance: 1, positionX: new FakeParam(), positionY: new FakeParam(), positionZ: new FakeParam() });
  }
  createStereoPanner(): FakeNode {
    return Object.assign(new FakeNode(), { pan: new FakeParam() });
  }
  createDelay(): FakeNode {
    return Object.assign(new FakeNode(), { delayTime: new FakeParam() });
  }
  createConvolver(): FakeNode {
    return Object.assign(new FakeNode(), { normalize: true, buffer: null });
  }
  createOscillator(): FakeSource {
    return new FakeSource();
  }
  createBufferSource(): FakeSource {
    return new FakeSource();
  }
  createBuffer(n: number, len: number): FakeBuffer {
    return new FakeBuffer(n, len);
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
}

const cfg = parseSoundscapeConfig(raw as unknown);
const SUNRISE = 382;
const SUNSET = 1057;

function withFakeAudio<T>(fn: (audio: AudioEngine, ctx: FakeCtx) => T): T {
  const g = globalThis as unknown as { AudioContext?: unknown };
  const prev = g.AudioContext;
  g.AudioContext = FakeCtx;
  try {
    const audio = new AudioEngine();
    expect(audio.init()).toBe(true);
    return fn(audio, audio.ctx as unknown as FakeCtx);
  } finally {
    g.AudioContext = prev;
  }
}

function endAll(ctx: FakeCtx): void {
  for (const s of sources.splice(0)) if (s.stopAt <= ctx.currentTime && s.onended) s.onended();
}

describe('Soundscape (WebAudio giả)', () => {
  it('không phát gì khi audio chưa init, plan vẫn chạy', () => {
    const audio = new AudioEngine();
    const sc = new Soundscape(audio, cfg, 9);
    const st: AmbientState = { localMin: SUNRISE - 20, sunriseMin: SUNRISE, sunsetMin: SUNSET, month: 1, rain: 0.5, wind: 0 };
    for (let i = 0; i < 3000; i++) {
      st.localMin += 1 / 60;
      sc.update(1, st, { x: 0, y: 0, z: 0 });
    }
    sc.alarm([10, 0, 10], 'muntjac');
    expect(audio.activeVoices).toBe(0);
    expect(sc.active).toBe(0);
    expect(sc.plan.counts.get('gibbon-nomascus')!).toBeGreaterThan(0);
    sc.dispose();
  });

  it('mọi kind dựng đồ thị không lỗi, tôn trọng trần voice và trả voice khi xong', () => {
    withFakeAudio((audio, ctx) => {
      const sc = new Soundscape(audio, cfg, 21);
      const st: AmbientState = { localMin: 0, sunriseMin: SUNRISE, sunsetMin: SUNSET, month: 6, rain: 0, wind: 0.2 };
      const kinds = new Set<string>();
      const created0 = created;
      // chạy 1 ngày tháng 6, nửa sau mưa (ếch, mưa phùn), bước 5 s
      for (let i = 0; i < (1440 * 60) / 5; i++) {
        st.localMin = (i * 5) / 60;
        st.rain = st.localMin > 18 * 60 ? 0.7 : 0;
        ctx.currentTime += 5;
        sc.update(5, st, { x: 1, y: 2, z: 3 });
        expect(sc.active).toBeLessThanOrEqual(sc.maxActive);
        ctx.currentTime += 30;
        endAll(ctx);
      }
      sc.alarm({ x: 30, y: 0, z: -40 }, 'muntjac');
      sc.alarm([5, 20, 5], 'douc');
      ctx.currentTime += 60;
      endAll(ctx);
      for (const [id, n] of sc.plan.counts) if (n > 0) kinds.add(cfg.voices.find((v) => v.id === id)!.kind);
      for (const k of ['gibbon', 'hornbill', 'coucal', 'junglefowl', 'gecko', 'frogs', 'muntjac', 'douc']) expect(kinds.has(k)).toBe(true);
      let planned = 0;
      for (const n of sc.plan.counts.values()) planned += n;
      expect(created - created0).toBeGreaterThan(planned);
      expect(sc.dropped).toBeLessThan(planned * 0.05);
      expect(sc.plan.counts.get('muntjac-alarm')).toBe(1);
      expect(sc.plan.counts.get('douc-alarm')).toBe(1);
      expect(sc.active).toBe(0);
      // còn lại đúng 2 voice của lớp nền (ve sầu tháng 6 + mưa phùn)
      expect(audio.activeVoices).toBe(2);
      sc.dispose();
      expect(audio.activeVoices).toBe(0);
    });
  });

  it('API AudioEngine cũ giữ nguyên; bus ambience tồn tại', () => {
    withFakeAudio((audio) => {
      expect(audio.busNode('ambience')).not.toBeNull();
      audio.setBusGain('ambience', 0.4);
      audio.gunshot();
      audio.tone('sfx', 440, 100);
      expect(audio.activeVoices).toBeGreaterThan(0);
    });
  });
});
