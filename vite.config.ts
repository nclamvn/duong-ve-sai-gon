import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import { benchPlugin } from './scripts/bench-plugin';

function gitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'dev';
  }
}

const alias = {
  '@engine': fileURLToPath(new URL('./src/engine', import.meta.url)),
  '@game': fileURLToPath(new URL('./src/game', import.meta.url)),
  '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
  '@qa': fileURLToPath(new URL('./src/qa', import.meta.url)),
  '@content': fileURLToPath(new URL('./content', import.meta.url)),
  '@config': fileURLToPath(new URL('./config', import.meta.url)),
};

export default defineConfig(({ mode }) => ({
  resolve: { alias },
  define: {
    __BUILD_HASH__: JSON.stringify(gitHash()),
    __BUILD_MODE__: JSON.stringify(mode),
  },
  plugins: [benchPlugin()],
  optimizeDeps: {
    // WASM packages: keep them out of the pre-bundler (ADR-002, ADR-003)
    exclude: ['@dimforge/rapier3d-compat', 'recast-navigation', '@recast-navigation/core', '@recast-navigation/wasm'],
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 4000,
  },
  server: { port: 5173, strictPort: false },
}));
