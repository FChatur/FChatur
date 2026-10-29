import { defineConfig } from 'vitest/config';

// `npm run art`: renders sprite contact sheets to art-preview/ for review (not part of `npm test`).
export default defineConfig({
  test: {
    include: ['tests/**/*.art.ts'],
    environment: 'node',
  },
});
