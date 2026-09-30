import { defineConfig } from 'vitest/config';

// Own config so vitest doesn't pick up the frontend's root vitest.config.ts,
// whose dependencies aren't installed in the api package.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
});
