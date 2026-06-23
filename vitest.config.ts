import { defineConfig } from "vitest/config";

export default defineConfig({
  // Match Next.js: components use the automatic JSX runtime and don't import React.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
