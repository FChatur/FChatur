import { defineConfig } from 'vitest/config';

// `npm run test:slow`: long-running stress tests (e.g. the wave-100 soak). Run in CI on every push;
// kept out of `npm test` so the everyday suite stays fast.
export default defineConfig({
  test: {
    include: ['tests/**/*.soak.ts'],
    environment: 'node',
  },
});
