import { defineConfig } from 'vitest/config';
import path from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    // Scoped to app/ (plus the page gate beside it) so the Playwright specs in
    // e2e/ stay out. An unscoped glob picks them up and runs @playwright/test's
    // `test`/`expect` against jsdom.
    include: ['app/**/*.{test,spec}.{ts,tsx}', 'proxy.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});

