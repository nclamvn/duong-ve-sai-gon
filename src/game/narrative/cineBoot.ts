/**
 * DV-093 vào chế độ intro trong engine:
 *   ?cine=intro                   xem trực tiếp (bấm vào màn để có tiếng); &then=play → hết intro vào chơi M1 luôn
 *   ?cine=intro&rec=audio         ghi tiếng thời gian thực → recordings/intro-audio.webm
 *   ?cine=intro&rec=video         dựng hình offline → recordings/intro.h264 (+ ảnh tĩnh); &w=3840&h=2160&mbps=45
 * Chỉ chạy được với dev server (`npm run dev`), nơi plugin ghi file đang chạy.
 */
import type { Game } from '@game/game';
import introJson from '@content/cinematics/intro.cine.json';
import { CinePlayer, type IntroDef } from './cinePlayer';
import { recordAudio, recordVideo } from './cineRecorder';

const CINEMATICS: Record<string, IntroDef> = { intro: introJson as unknown as IntroDef };

function status(): (msg: string) => void {
  const el = document.createElement('div');
  Object.assign(el.style, { position: 'fixed', left: '12px', top: '12px', zIndex: '40', font: '600 14px "Barlow Condensed", sans-serif', color: '#e8dcc0', background: 'rgba(0,0,0,0.6)', padding: '6px 10px', pointerEvents: 'none' });
  document.body.appendChild(el);
  return (msg) => {
    el.textContent = msg;
  };
}

export async function runCine(game: Game, id: string, params: URLSearchParams): Promise<void> {
  const def = CINEMATICS[id];
  if (!def) throw new Error(`unknown cinematic ${id}`);
  const rec = params.get('rec');
  if (rec === 'video') {
    const say = status();
    const cine = new CinePlayer(game, def, { audio: false });
    const w = Number(params.get('w') ?? 3840);
    const h = Number(params.get('h') ?? 2160);
    const t0 = performance.now();
    const r = await recordVideo(game, cine, {
      w,
      h,
      fps: Number(params.get('fps') ?? def.fps ?? 30),
      bitrate: Number(params.get('mbps') ?? 45) * 1e6,
      name: id,
      stillEvery: Number(params.get('stills') ?? 2),
      ...(params.get('from') ? { from: Number(params.get('from')) } : {}),
      ...(params.get('to') ? { to: Number(params.get('to')) } : {}),
      onProgress: (i, n, note) => {
        if (i % 10 === 0 || i === n) {
          const el = (performance.now() - t0) / 1000;
          say(`REC ${id} ${w}x${h} · ${i}/${n} · ${note} · ${el.toFixed(0)} s · left ~${((el / i) * (n - i)).toFixed(0)} s`);
        }
      },
    });
    say(`REC done: ${r.frames} frames · ${(r.bytes / 1e6).toFixed(1)} MB · ${r.codec ?? 'stills only'} -> recordings/${id}.h264`);
    (window as unknown as { __cineDone?: unknown }).__cineDone = r;
    return;
  }
  game.audio.init();
  const cine = new CinePlayer(game, def, { audio: true });
  if (rec === 'audio') {
    const say = status();
    say(`REC audio ${id}...`);
    const r = await recordAudio(game, cine, id);
    say(`REC audio done: ${(r.bytes / 1e6).toFixed(2)} MB -> recordings/${id}-audio.webm`);
    (window as unknown as { __cineDone?: unknown }).__cineDone = r;
    return;
  }
  cine.onEnd = () => {
    if (params.get('then') === 'play') {
      cine.dispose();
      game.beginMission();
    }
  };
  cine.start();
  game.start();
  (window as unknown as { __cine?: unknown }).__cine = cine;
}
