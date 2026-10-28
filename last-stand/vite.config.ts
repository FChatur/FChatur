import { defineConfig } from 'vitest/config';
import pkg from './package.json';

export default defineConfig({
  // Relative base so the build works from any sub-path (GitHub Pages, Cloudflare Pages, a zip).
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: 'es2022',
    // Phaser alone is ~1.2 MB minified; split it so game code changes don't bust its cache.
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: { phaser: ['phaser'] },
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
