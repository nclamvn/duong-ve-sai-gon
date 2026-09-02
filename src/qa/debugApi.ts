/**
 * Debug API `window.__ht` cho Playwright/QA (PRD §3 Test, §3.2 qa/debug). Không ship trong release:
 * PROD build chỉ cài khi ?debug=1. TIP-003: metrics tối thiểu; TIP-004/008 mở rộng.
 */
import type { Game } from '@game/game';

export interface HtDebugApi {
  ready: boolean;
  version: string;
  buildHash: string;
  backend: string;
  metrics(): { frames: number; lastFrameMs: number; scale: number; calls: number; triangles: number; tick: number };
  game: Game;
  [k: string]: unknown;
}

declare global {
  interface Window {
    __ht?: HtDebugApi;
  }
}

export function installDebugApi(game: Game, buildHash: string): HtDebugApi | null {
  const params = new URLSearchParams(location.search);
  if (import.meta.env.PROD && params.get('debug') !== '1') return null;
  const api: HtDebugApi = {
    ready: true,
    version: '0.1.0-g0',
    buildHash,
    backend: game.bundle.backend,
    metrics: () => ({
      frames: game.frames,
      lastFrameMs: game.lastFrameMs,
      scale: game.scaler.scale,
      calls: game.renderInfo.calls,
      triangles: game.renderInfo.triangles,
      tick: game.clock.tick,
    }),
    game,
  };
  window.__ht = api;
  return api;
}
