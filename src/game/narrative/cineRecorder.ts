/**
 * DV-093 bộ ghi intro.
 *  - Hình (offline, `?cine=intro&rec=video`): vòng lặp game dừng; mỗi khung phim đúng 1/fps giây (không phụ thuộc máy nhanh
 *    chậm) → render ở kích thước cố định (mặc định 3840×2160), ghép lớp phủ (tựa, phụ đề, bản đồ) bằng Canvas 2D, mã hoá
 *    H.264 phần cứng bằng WebCodecs (luồng Annex-B) và gửi từng đoạn về dev server (`/__cine/write`, scripts/cine-plugin.ts).
 *    Chụp thêm ảnh tĩnh mỗi `stillEvery` giây để duyệt nhanh.
 *  - Tiếng (thời gian thực, `rec=audio`): chạy intro bình thường, thu đúng tiếng ra loa (AudioEngine.recordTap) bằng
 *    MediaRecorder → webm/opus. Hai bản ghép bằng ffmpeg (scripts/cine-mux.mjs). Cùng đồng hồ biên tập nên khớp nhau.
 */
import type { Game } from '@game/game';
import type { CinePlayer } from './cinePlayer';

export interface VideoRecordOptions {
  w: number;
  h: number;
  fps: number;
  bitrate: number;
  /** tên file trong recordings/ (không đuôi) */
  name: string;
  stillEvery: number;
  /** preview a range only (s); default the whole cinematic */
  from?: number;
  to?: number;
  onProgress?: (frame: number, total: number, note: string) => void;
}

const H264 = ['avc1.640034', 'avc1.640033', 'avc1.64002a', 'avc1.640028'];

async function post(name: string, body: Blob, append: boolean): Promise<void> {
  const r = await fetch(`/__cine/write?name=${encodeURIComponent(name)}&append=${append ? 1 : 0}`, { method: 'POST', body });
  if (!r.ok) throw new Error(`cine write ${name}: ${r.status}`);
}

async function pickCodec(w: number, h: number, fps: number, bitrate: number): Promise<VideoEncoderConfig | null> {
  if (typeof VideoEncoder === 'undefined') return null;
  for (const codec of H264) {
    const cfg: VideoEncoderConfig = { codec, width: w, height: h, bitrate, framerate: fps, avc: { format: 'annexb' }, hardwareAcceleration: 'prefer-hardware', latencyMode: 'quality', bitrateMode: 'variable' };
    try {
      const s = await VideoEncoder.isConfigSupported(cfg);
      if (s.supported) return s.config ?? cfg;
    } catch {
      /* thử codec sau */
    }
  }
  return null;
}

export async function recordVideo(game: Game, cine: CinePlayer, o: VideoRecordOptions): Promise<{ frames: number; bytes: number; codec: string | null }> {
  const { w, h, fps } = o;
  const comp = document.createElement('canvas');
  comp.width = w;
  comp.height = h;
  const ctx = comp.getContext('2d', { alpha: false })!;
  const cfg = await pickCodec(w, h, fps, o.bitrate);
  let err: unknown = null;
  let chunks: Uint8Array[] = [];
  let chunkBytes = 0;
  let total = 0;
  let posted = false;
  const enc = cfg
    ? new VideoEncoder({
        output: (chunk) => {
          const b = new Uint8Array(chunk.byteLength);
          chunk.copyTo(b);
          chunks.push(b);
          chunkBytes += b.length;
          total += b.length;
        },
        error: (e) => {
          err = e;
        },
      })
    : null;
  if (enc && cfg) enc.configure(cfg);
  const flushNet = async (): Promise<void> => {
    if (chunkBytes === 0) return;
    const blob = new Blob(chunks as BlobPart[]);
    chunks = [];
    chunkBytes = 0;
    await post(`${o.name}.h264`, blob, posted);
    posted = true;
  };
  game.stop();
  game.animLod = false;
  game.setFixedRender({ w, h });
  const from = o.from ?? 0;
  cine.t = from;
  cine.start();
  const N = Math.round(((o.to ?? cine.def.duration) - from) * fps);
  const stillStep = Math.max(1, Math.round(o.stillEvery * fps));
  for (let i = 0; i < N; i++) {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    game.frame(1 / fps);
    ctx.drawImage(game.bundle.canvas, 0, 0, w, h);
    cine.overlay.paint(ctx, w, h);
    if (enc) {
      const vf = new VideoFrame(comp, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
      enc.encode(vf, { keyFrame: i % (fps * 2) === 0 });
      vf.close();
      while (enc.encodeQueueSize > 3) await new Promise<void>((r) => setTimeout(r, 4));
      if (chunkBytes > 6e6) await flushNet();
    }
    if (i % stillStep === 0) {
      const png = await new Promise<Blob | null>((r) => comp.toBlob((b) => r(b), 'image/jpeg', 0.92));
      if (png) await post(`${o.name}-still-${String(Math.round(from + (i + 1) / fps)).padStart(2, '0')}.jpg`, png, false);
    }
    if (err) throw err;
    o.onProgress?.(i + 1, N, cfg ? cfg.codec : 'stills only (no H.264 encoder)');
  }
  if (enc) {
    await enc.flush();
    await flushNet();
    enc.close();
  }
  game.setFixedRender(null);
  return { frames: N, bytes: total, codec: cfg ? cfg.codec : null };
}

/** realtime pass: plays the intro and records what reaches the speakers */
export async function recordAudio(game: Game, cine: CinePlayer, name: string): Promise<{ bytes: number }> {
  const stream = game.audio.recordTap();
  if (!stream || typeof MediaRecorder === 'undefined') throw new Error('audio tap unavailable (click to start audio first)');
  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
  const mr = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 256_000 });
  const parts: Blob[] = [];
  mr.ondataavailable = (e) => {
    if (e.data.size > 0) parts.push(e.data);
  };
  const ended = new Promise<void>((r) => {
    cine.onEnd = () => r();
  });
  mr.start(1000);
  cine.start();
  game.start();
  await ended;
  await new Promise<void>((r) => setTimeout(r, 400));
  const stopped = new Promise<void>((r) => (mr.onstop = () => r()));
  mr.stop();
  await stopped;
  const blob = new Blob(parts, { type: mime });
  await post(`${name}-audio.webm`, blob, false);
  return { bytes: blob.size };
}
