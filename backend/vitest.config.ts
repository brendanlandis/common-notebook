import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // `src/**` is the app; `scripts/**` covers the pure helpers extracted from
    // the plain-JS ops scripts (e.g. lib/todoToTaskData.js) so their logic is
    // tested without booting Strapi. tsconfig excludes `**/*.test.*`, so neither
    // is type-checked on prod boot.
    include: ['src/**/*.test.ts', 'scripts/**/*.test.js'],
  },
});
