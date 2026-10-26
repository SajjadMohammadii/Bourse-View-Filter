import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  // Relative base so dist/index.html works from file:// with no server.
  base: './',
  plugins: [viteSingleFile()],
  worker: {
    // Classic (IIFE) worker inlined as a blob: works when opened from file://.
    format: 'iife',
  },
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 5000,
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/golden/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/core/**'],
      reporter: ['text-summary', 'html'],
    },
  },
});
