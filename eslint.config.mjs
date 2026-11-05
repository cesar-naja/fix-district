import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Playwright fixtures receive a `use` callback, which the React hooks rule
  // mistakes for a hook. Browser tests contain no React code.
  {
    files: ["e2e/**/*.ts"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-e2e/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Playwright output (browser tests live in the e2e workspace).
    "e2e/playwright-report/**",
    "e2e/test-results/**",
    "e2e/blob-report/**",
  ]),
]);

export default eslintConfig;
