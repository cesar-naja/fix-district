import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { loadE2EEnv, REPO_ROOT } from './config/env';

/**
 * Browser (E2E) tests. Design and rules: docs/framework.md and README.md in
 * this workspace.
 *
 * Everything environment-specific comes from config/env.ts, which validates it
 * and refuses unsafe values (live Clerk keys, non-demo Firebase projects,
 * non-loopback hosts). Run from the repository root with `npm run test:e2e`,
 * which also starts the Firestore emulator these tests use. The application's
 * Vitest suite (../tests) is separate.
 *
 * Paths here are resolved from this file, so the config behaves the same when
 * started from the repository root, from e2e/, or by an MCP server.
 */
const env = loadE2EEnv();

/**
 * The app server's environment is built explicitly. It never inherits live
 * Firebase settings from the root .env.local: the emulator is forced, the
 * project is a "demo-" one, and the live service-account values are overridden
 * with empty strings (Next.js does not override variables that are already set,
 * empty included). lib/firebase/admin.ts also takes its credential-free
 * emulator branch whenever FIRESTORE_EMULATOR_HOST is set.
 */
const serverEnv: Record<string, string> = {
  // Separate build directory, so this server can run beside a normal
  // `npm run dev` (next dev locks <distDir>/dev/lock). See next.config.ts.
  // Relative to the repository root, where the Next.js app lives.
  NEXT_DIST_DIR: '.next-e2e',

  FIRESTORE_EMULATOR_HOST: env.emulatorHost,
  FIREBASE_PROJECT_ID: env.firebaseProjectId,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: env.firebaseProjectId,
  FIREBASE_CLIENT_EMAIL: '',
  FIREBASE_PRIVATE_KEY: '',
  GOOGLE_APPLICATION_CREDENTIALS: '',
  NEXT_PUBLIC_FIREBASE_API_KEY: '',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: '',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: '',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '',
  NEXT_PUBLIC_FIREBASE_APP_ID: '',
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: '',

  // The dedicated Clerk application, and the same sign-in routes as the root .env.example.
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: env.clerk.publishableKey,
  CLERK_SECRET_KEY: env.clerk.secretKey,
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: '/sign-in',
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: '/sign-up',
  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: '/',
  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: '/',
};

const serverCommand =
  env.serverMode === 'build'
    ? `npx next build && npx next start -p ${env.port}`
    : `npx next dev -p ${env.port}`;

export default defineConfig({
  testDir: '.',
  /* Only browser specs. e2e/unit holds Vitest tests for the safety guards. */
  testMatch: '**/*.spec.ts',
  testIgnore: ['**/node_modules/**', 'unit/**'],
  /* Generated artifacts stay inside this workspace (git-ignored, keep private). */
  outputDir: path.join(__dirname, 'test-results'),
  /* Tests are independent, so files and tests inside them may run in parallel. */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  /* One worker by default. Raise with E2E_WORKERS (max 4). */
  workers: env.workers,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: path.join(__dirname, 'playwright-report') }],
  ],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: env.baseUrl,
    /*
     * Traces, screenshots, and videos can contain cookies, request headers, and
     * Clerk responses. Keep them private: they are git-ignored, and CI keeps
     * traces off unless you opt in. Test data is synthetic.
     */
    trace: env.trace,
    screenshot: 'only-on-failure',
    video: 'off',
    /*
     * Bound single actions and navigations. Without these an action on an
     * element that never becomes actionable waits until the test timeout, and
     * in a planner/generator MCP session (which has no test timeout) it waits
     * forever.
     */
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      /* Gate: emulator is up, and the app server reads from it. */
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      testIgnore: [/.*\.setup\.ts/, '**/node_modules/**', 'unit/**'],
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: serverCommand,
    /* The Next.js app lives at the repository root, not in this workspace. */
    cwd: REPO_ROOT,
    url: env.baseUrl,
    /* Never attach to a server that is already running: it could be pointed at live data. */
    reuseExistingServer: false,
    timeout: env.serverMode === 'build' ? 300_000 : 120_000,
    env: serverEnv,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
