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
    // Deliberately NOT the server's zone. The browser/server split is where the
    // client's getISOTimestamp meets the server's complete/route — pin the
    // browser to a real offset so that seam is exercised, not hidden. The Next
    // server stays whatever the host is (UTC in CI), which is the point.
    timezoneId: 'America/New_York',
  },
  /**
   * Firefox first, because that's the browser this app is actually read in.
   *
   * These specs ran in Chromium alone for months, and a session's worth of
   * animation work was signed off there while being visibly broken in Firefox —
   * the cycle switch stopped animating after the first toggle. The underlying
   * bug was in both browsers, but only Firefox's timing exposed it, and a
   * Chromium-only suite had no way to say so.
   *
   * Chromium stays because two engines catch what one cannot, and because
   * everything here is fast enough to run twice. Iterating on one:
   * `npx playwright test --project=firefox`.
   */
  projects: [
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Safari's engine. Not Safari — a Playwright build of WebKit — but it's the
    // only way to catch a WebKit-only problem without owning a Mac and a phone.
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    // Phones are the same three engines at a phone's viewport, with touch and a
    // phone user agent: Mobile Safari is WebKit, Mobile Chrome is Chromium.
    // Emulation, not devices — it will not reproduce an iOS-specific bug.
    { name: 'iphone', use: { ...devices['iPhone 15'] } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
  ],
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
