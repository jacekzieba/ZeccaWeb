import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e/staging-smoke",
  webServer: {
    command: "NEXT_PUBLIC_FAKE_SYNC= npm run dev -- --port 3102",
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
