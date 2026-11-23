import { defineConfig, devices } from '@playwright/test'

// End-to-end tests against the local Supabase stack of buspilot-org/server
// (seeded demo school). See README, "End-to-end tests".
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3100'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL,
    // Japanese first: the console's default language.
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], locale: 'ja-JP' } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'pnpm build && pnpm preview',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 240_000,
      },
})
