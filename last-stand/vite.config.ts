import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build works from any sub-path (GitHub Pages, Cloudflare Pages, a zip).
  base: './',
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
