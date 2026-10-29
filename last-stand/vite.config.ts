import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import pkg from './package.json';
import { SOUNDTRACK } from './src/config/audio';

// The soundtrack files can be withheld from the repository (licensing pending, see docs/AUDIO.md). The
// build notices and ships a game that runs without music, with no failed downloads.
const soundtrackAvailable = existsSync(`public/audio/music/${SOUNDTRACK.id}/${SOUNDTRACK.chunks[0].file}.ogg`);

export default defineConfig({
  // Relative base so the build works from any sub-path (GitHub Pages, Cloudflare Pages, a zip).
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __SOUNDTRACK_AVAILABLE__: JSON.stringify(soundtrackAvailable),
  },
  build: {
    // Supported browsers: current Chrome, Edge, Firefox and Safari, back to roughly 2022 releases.
    // Newer syntax is downlevelled; CSS colour-mix() has plain fallbacks in style.css.
    target: ['es2020', 'chrome100', 'edge100', 'firefox100', 'safari15'],
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
