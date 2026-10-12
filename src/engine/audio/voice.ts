/**
 * Giọng lồng tiếng (DV-076): manifest `assets/voice/manifest.json` do `scripts/voice/generate.mjs` sinh (ElevenLabs). Tải file
 * khi cần (cache bytes + buffer đã giải mã), chọn lần đọc xoay vòng để câu hô không lặp y hệt. Chưa có manifest/file → im lặng,
 * phụ đề vẫn chạy như cũ. Không DOM; fetch + AudioEngine.
 */
import type { AudioEngine, Bus } from './audio';

const MAX_DECODED = 96;

export interface VoiceManifest {
  version: number;
  lines: Record<string, { voice: string; files: string[]; ms: number[] }>;
}

/** khoá tra theo thứ tự ưu tiên: báo hướng theo giờ → theo người nói → cue cố định */
export function voiceKeys(cue: string, speaker: string, vars?: Record<string, string | number>): string[] {
  const out: string[] = [];
  if (vars && vars.h !== undefined) out.push(`${cue}.${speaker}.h${vars.h}`);
  out.push(`${cue}.${speaker}`, cue);
  return out;
}

export class VoiceBank {
  manifest: VoiceManifest | null = null;
  private readonly bytes = new Map<string, Promise<ArrayBuffer | null>>();
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly decoding = new Map<string, Promise<AudioBuffer | null>>();
  private readonly turn = new Map<string, number>();
  readonly stats = { played: 0, missing: 0, late: 0, cancelled: 0 };
  /** số thế hệ theo kênh: huỷ câu đang chờ giải mã khi kênh bị cắt (thoại bị chen ngang) */
  private readonly epoch = new Map<string, number>();

  /** huỷ các lần phát đang chờ giải mã của kênh (câu đã phát thì Game tự dừng) */
  cancel(channel: string): void {
    this.epoch.set(channel, (this.epoch.get(channel) ?? 0) + 1);
  }

  constructor(
    private readonly audio: AudioEngine,
    private readonly baseUrl: string,
    private readonly fetcher: (url: string) => Promise<Response> = (u) => fetch(u),
  ) {}

  async load(): Promise<boolean> {
    try {
      const r = await this.fetcher(`${this.baseUrl}manifest.json`);
      if (!r.ok) return false;
      this.manifest = (await r.json()) as VoiceManifest;
      return true;
    } catch {
      return false;
    }
  }

  /** khoá đầu tiên có trong manifest */
  resolve(keys: readonly string[]): string | null {
    const m = this.manifest;
    if (!m) return null;
    for (const k of keys) if (m.lines[k]) return k;
    return null;
  }

  /** thời lượng (ms) dài nhất của khoá — kéo phụ đề cho khớp lời */
  durationMs(key: string): number {
    const e = this.manifest?.lines[key];
    return e ? Math.max(...e.ms) : 0;
  }

  private fetchBytes(file: string): Promise<ArrayBuffer | null> {
    let p = this.bytes.get(file);
    if (!p) {
      p = this.fetcher(`${this.baseUrl}${file}`)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .catch(() => null);
      this.bytes.set(file, p);
    }
    return p;
  }

  private decode(file: string): Promise<AudioBuffer | null> {
    const have = this.buffers.get(file);
    if (have) return Promise.resolve(have);
    let p = this.decoding.get(file);
    if (!p) {
      p = this.fetchBytes(file).then(async (b) => {
        if (!b) return null;
        // decodeAudioData "tiêu" ArrayBuffer → giải mã bản sao, giữ bytes cho lần sau (trước khi có AudioContext)
        const buf = await this.audio.decode(b.slice(0));
        this.decoding.delete(file);
        if (buf) {
          this.buffers.set(file, buf);
          // giữ tối đa MAX_DECODED buffer (mỗi câu ~0,3 MB PCM): bỏ cái dùng lâu nhất
          if (this.buffers.size > MAX_DECODED) this.buffers.delete(this.buffers.keys().next().value!);
        }
        return buf;
      });
      this.decoding.set(file, p);
    }
    return p;
  }

  /** tải trước file của các khoá (bắt đầu nhiệm vụ) */
  prefetch(keys: Iterable<string>): void {
    const m = this.manifest;
    if (!m) return;
    for (const k of keys) for (const f of m.lines[k]?.files ?? []) void this.fetchBytes(f);
  }

  /** chọn lần đọc kế tiếp (xoay vòng) */
  pick(key: string): { file: string; ms: number } | null {
    const e = this.manifest?.lines[key];
    if (!e || e.files.length === 0) return null;
    const i = (this.turn.get(key) ?? 0) % e.files.length;
    this.turn.set(key, i + 1);
    return { file: e.files[i]!, ms: e.ms[i]! };
  }

  /**
   * Phát khoá: đã giải mã → phát ngay; chưa → giải mã rồi phát nếu trễ ≤ maxLateMs. Trả thời lượng (ms) hoặc 0 khi không có.
   * `stop` của lần phát gần nhất giữ trong `stopLast` (thoại bị cắt).
   */
  play(key: string, bus: Bus, o: { position?: [number, number, number]; gain?: number; radio?: boolean; maxLateMs?: number; channel?: string; onStop?: (stop: () => void) => void } = {}): number {
    const p = this.pick(key);
    if (!p) {
      this.stats.missing++;
      return 0;
    }
    const go = (buf: AudioBuffer): void => {
      const stop = this.audio.playBuffer(buf, bus, o);
      if (stop) {
        this.stats.played++;
        o.onStop?.(stop);
      }
    };
    const ready = this.buffers.get(p.file);
    if (ready) {
      this.buffers.delete(p.file);
      this.buffers.set(p.file, ready); // LRU: mới dùng → cuối hàng
      go(ready);
    }
    else {
      const t0 = performance.now();
      const ch = o.channel ?? '';
      const ep = this.epoch.get(ch) ?? 0;
      void this.decode(p.file).then((buf) => {
        if (!buf) return;
        if ((this.epoch.get(ch) ?? 0) !== ep) {
          this.stats.cancelled++;
          return;
        }
        if (performance.now() - t0 > (o.maxLateMs ?? 400)) {
          this.stats.late++;
          return;
        }
        go(buf);
      });
    }
    return p.ms;
  }
}
