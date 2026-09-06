/**
 * Boot: capability screen → renderer → arena → loop → (bench nếu ?bench=1).
 * TIP-003 boot · TIP-004 overlay/bench · TIP-005+ gameplay.
 */
import { Game } from '@game/game';
import { showCapability, showFatal } from '@ui/capability';
import { Overlay } from '@ui/overlay';
import { installDebugApi } from '@qa/debugApi';
import { runBench, submitReport } from '@qa/bench';
import { installCalib, type CalibMode } from '@qa/calib';
import { t } from '@ui/i18n';

declare const __BUILD_HASH__: string;

async function boot(): Promise<void> {
  const app = document.getElementById('app')!;
  const capRoot = document.getElementById('capability')!;
  const canvas = document.createElement('canvas');
  app.appendChild(canvas);
  const params = new URLSearchParams(location.search);
  const game = new Game({ canvas, search: location.search });
  try {
    await game.init();
  } catch (err) {
    showFatal(capRoot, String((err as Error)?.stack ?? err));
    throw err;
  }
  const overlay = new Overlay(game.telemetry, () => ({
    backend: game.bundle.backend,
    buildHash: __BUILD_HASH__,
    tick: game.clock.tick,
    scale: game.scaler.scale,
    clampCount: game.clock.clampCount,
  }));
  // Telemetry chỉ khi ?overlay=1 (hoặc bench); F3 bật/tắt lúc chơi — Chủ nhà: bảng thông số không hiện mặc định (DV-044)
  overlay.toggle(params.get('overlay') === '1');
  game.onFrame = () => overlay.update(performance.now());
  const api = installDebugApi(game, __BUILD_HASH__);
  const calib = params.get('calib');
  if (api && (calib === 'soldier' || calib === 'fp')) api.calib = installCalib(game, calib as CalibMode, params);

  const enter = (): void => {
    document.getElementById('hud')!.hidden = false;
    game.start();
    if (params.get('bench') === '1') {
      const runs = Number(params.get('runs') ?? 3);
      const seconds = Number(params.get('seconds') ?? 90);
      overlay.toggle(true);
      void runBench(game, { runs, seconds, seed: game.seed, buildHash: __BUILD_HASH__ }, (msg) => overlay.setExtra(() => msg)).then(async (report) => {
        if (api) api.benchReport = report;
        const res = await submitReport(report);
        overlay.setExtra(() => `${res.saved ? t('bench.done') : t('bench.saved_local')} · verdict ${report.verdict} · ${report.evidence_status}`);
        if (api) api.benchSaved = res;
      });
    }
  };
  showCapability(
    capRoot,
    {
      backend: game.bundle.backend,
      adapterInfo: game.bundle.adapterInfo,
      webgpuAvailable: game.bundle.webgpuAvailable,
      timestampCapable: game.bundle.timestampCapable,
      buildHash: __BUILD_HASH__,
    },
    enter,
    params.get('autostart') === '1',
  );
}

void boot();
