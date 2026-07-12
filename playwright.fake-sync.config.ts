import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e/fake-sync",
  // These specs share a single dev server and browser-local state (localStorage
  // keys, URL navigation). Running them in parallel against `next dev` caused
  // intermittent failures; serialize to keep the suite deterministic.
  fullyParallel: false,
  workers: 1,
  webServer: {
    command: "NEXT_PUBLIC_FAKE_SYNC=1 npm run dev -- --port 3101",
    url: "http://127.0.0.1:3101/api/health",
    reuseExistingServer: false,
  },
  use: {
    baseURL: "http://127.0.0.1:3101",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
