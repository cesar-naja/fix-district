import { defineConfig } from "vitest/config";

// Unit tests for the E2E safety guards only (e2e/tests/unit). Pure functions, no
// services. The application's Vitest suite lives in ../tests and is separate.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
