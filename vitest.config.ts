import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@engine': fileURLToPath(new URL('./src/engine', import.meta.url)),
      '@game': fileURLToPath(new URL('./src/game', import.meta.url)),
      '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
      '@qa': fileURLToPath(new URL('./src/qa', import.meta.url)),
      '@content': fileURLToPath(new URL('./content', import.meta.url)),
      '@config': fileURLToPath(new URL('./config', import.meta.url)),
    },
  },
  define: { __BUILD_HASH__: JSON.stringify('test'), __BUILD_MODE__: JSON.stringify('test') },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
    reporters: ['default'],
  },
});
