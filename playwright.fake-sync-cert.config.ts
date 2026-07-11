import { defineConfig, devices } from "@playwright/test";

// Fake-sync e2e seeded with the certification scenario dataset. Mirrors
// playwright.fake-sync.config.ts but on a separate port with the certification
// dataset switch, so it can run alongside the default fake-sync suite.
export default defineConfig({
  testDir: "./tests/e2e/fake-sync-cert",
  webServer: {
    command:
      "NEXT_PUBLIC_FAKE_SYNC=1 NEXT_PUBLIC_FAKE_SYNC_DATASET=certification npm run dev -- --port 3102",
    url: "http://127.0.0.1:3102/api/health",
    reuseExistingServer: false,
  },
  use: {
    baseURL: "http://127.0.0.1:3102",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
