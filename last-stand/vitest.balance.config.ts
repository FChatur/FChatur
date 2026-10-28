import { defineConfig } from 'vitest/config';

// `npm run balance`: runs the balance harness on every registered map (slow; not part of `npm test`).
export default defineConfig({
  test: {
    include: ['tests/**/*.report.ts'],
    environment: 'node',
  },
});
