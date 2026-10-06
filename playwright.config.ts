import { defineConfig, devices } from "@playwright/test";

// Jeden adres dla serwera, baseURL i zapisanej zgody — inaczej zmiana portu
// po cichu wyłączyłaby zapisaną odmowę i pytanie o zgodę zasłaniałoby treść.
const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: /fake-sync|auth-live|staging-smoke|staging-destructive/,
  // The local landing editor publishes shared state. Keep public-page specs
  // serialized so one editing scenario cannot race the responsive checks.
  workers: 1,
  // W CI jedna ponowna próba: pierwsze wejście na stronę w `next dev` kompiluje
  // ją na zimno i potrafi przekroczyć limit oczekiwania.
  retries: process.env.CI ? 1 : 0,
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: true,
  },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    // Pytanie o zgodę na statystyki jest przyklejone do dołu ekranu i zasłania
    // treść. Specyfikacje startują z zapisaną odmową; samo pytanie sprawdza
    // analytics-consent.spec.ts na czystym stanie przeglądarki.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: BASE_URL,
          localStorage: [{ name: "zecca-web-analytics-consent-v1", value: "denied" }],
        },
      ],
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
