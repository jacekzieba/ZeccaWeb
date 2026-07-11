import { defineConfig, devices } from "@playwright/test";

const LOCAL_SUPABASE_URL = "http://localhost:54321";
const LOCAL_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

export default defineConfig({
  testDir: "./tests/e2e/auth-live",
  fullyParallel: false,
  workers: 1,
  webServer: {
    command: "npm run dev -- --port 3105",
    url: "http://localhost:3105/api/health",
    reuseExistingServer: false,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: LOCAL_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: LOCAL_SUPABASE_PUBLISHABLE_KEY,
    },
  },
  use: {
    baseURL: "http://localhost:3105",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
