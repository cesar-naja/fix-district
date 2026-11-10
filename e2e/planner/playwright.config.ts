import path from 'node:path';
import { defineConfig } from '@playwright/test';
import baseConfig from '../playwright.config';

/**
 * Config for the Playwright test MCP server (planner / generator / healer
 * agents), referenced by ../../.cursor/mcp.json and ../../.vscode/mcp.json with
 * the repo-relative path `e2e/planner/playwright.config.ts`.
 *
 * It reuses the regular config unchanged (webServer, globalSetup, safety
 * environment, timeouts), and only points test discovery at the planner seeds.
 * The regular suite (`npx playwright test`) never lists these seeds.
 */
export default defineConfig({
  ...baseConfig,
  testDir: path.join(__dirname, 'seeds'),
  testMatch: 'seed*.spec.ts',
});
