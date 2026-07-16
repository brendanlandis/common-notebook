import { defineConfig, devices } from '@playwright/test';

// End-to-end tests against the real stack: Strapi + Next + the local sqlite copy.
// They exist because the app is client-rendered — SSR returns `loading...`, so no
// amount of curl or unit testing proves the UI works. The `projectType` bug that
// survived 434 green unit tests lived in the form→API seam these tests drive.
//
// Auth comes from DEV_AUTH_BYPASS (see app/lib/devAuth.ts): no login flow needed,
// but it requires NODE_ENV !== 'production', which is why the server below is
// `next dev` and never `next start`.

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  // These share one real database, so they cannot race each other.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run develop',
      cwd: '../backend',
      url: 'http://localhost:1337/_health',
      reuseExistingServer: true,
      timeout: 120_000,
      // backend/.env holds live production SMTP credentials and sets
      // EMAIL_ENABLED=true. dotenv never overwrites an already-set variable, so
      // this inline false wins and config/plugins.ts installs the sink instead.
      env: { EMAIL_ENABLED: 'false' },
    },
    {
      command: 'npm run dev',
      url: baseURL,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
