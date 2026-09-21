import { defineConfig } from "vitest/config";

export default defineConfig({
  // Match Next.js: components use the automatic JSX runtime and don't import React.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // Pokrycie liczymy tam, gdzie liczy się poprawność liczb: silniki wyceny i metryk,
    // importery i zapis/odczyt rekordów synchronizacji. Komponenty React sprawdzają
    // testy e2e (Playwright), więc nie wchodzą do progów. Progi to „zapadka”: tuż pod
    // dzisiejszym wynikiem, żeby pokrycie nie spadało po cichu — podnoś je razem z testami.
    coverage: {
      provider: "v8",
      include: ["src/domain/**", "src/features/import/**", "src/sync/records/**", "src/lib/**"],
      exclude: ["src/**/*.tsx", "src/sync/dev/**"],
      reporter: ["text-summary", "json-summary"],
      thresholds: {
        "src/domain/**": { lines: 92, statements: 92, branches: 85, functions: 90 },
        "src/features/import/*-parser.ts": { lines: 88, statements: 88, branches: 80, functions: 90 },
        "src/sync/records/**": { lines: 92, statements: 92, branches: 83, functions: 92 },
      },
    },
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
