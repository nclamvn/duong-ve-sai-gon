/**
 * Boot: capability screen → renderer → arena → loop. (TIP-003; TIP-004 gắn telemetry/bench; TIP-005+ gắn gameplay.)
 */
import { Game } from '@game/game';
import { showCapability, showFatal } from '@ui/capability';
import { installDebugApi } from '@qa/debugApi';

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
  installDebugApi(game, __BUILD_HASH__);
  const enter = (): void => {
    document.getElementById('hud')!.hidden = false;
    game.start();
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
