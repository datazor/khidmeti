// vitest.config.mts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only run tests in convex/ directory with Vitest
    include: ['convex/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
  },
});