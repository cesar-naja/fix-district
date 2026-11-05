# Fix District: Playwright E2E framework

Status: **implemented and verified**, see section 10 for exactly what was run.

Browser tests live in `e2e/`, a **private npm workspace** (`@fix-district/e2e`) with its own `package.json`, `tsconfig.json`, Playwright config, scripts and [README](../README.md). The Next.js application and its Vitest suite (`tests/`) stay at the repository root. There is one root `package-lock.json`.

## 1. Decisions applied

| Decision | Result |
| --- | --- |
| Dedicated Clerk development application | Required. The runner refuses `pk_live_`/`sk_live_` keys, a key identical to the one in `.env.local`, and a Frontend API host you have not typed in to confirm the key. |
| `next dev` locally on 3100, production build in CI | `E2E_SERVER_MODE=dev` (default) or `build` (default when `CI` is set). |
| Separate build directory and lock | **Verified**, see section 5. |
| Chromium only, one worker | `projects: setup, chromium`. `workers` defaults to 1 (`E2E_WORKERS`, max 4). |
| Authenticated planner seeds | `e2e/seed.customer.spec.ts`, `e2e/seed.technician.spec.ts` (disposable user plus emulator data). |
| Remote-readonly target | Deferred. Not built. Remote base URLs are refused. |
| Existing `e2e/` directory | Kept, and now a private npm workspace. |

## 2. Layout

```
e2e/                            private npm workspace "@fix-district/e2e"
  package.json                  scripts + browser-test-only dependencies
  tsconfig.json                 type checks e2e only (no app files)
  playwright.config.ts          projects, explicit server environment, artifact policy
  vitest.config.mts             runs unit/ (pure guard tests)
  README.md                     how to run, configure, and extend
  .env.example                  placeholders only (copy to .env.local, git-ignored)
  docs/framework.md             this document
  specs/                        planner output (reviewed plans)
  unit/safety.test.ts           Vitest tests for support/safety.ts (17)
  seed.spec.ts                  signed-out planner seed (kept, now uses fixtures)
  seed.customer.spec.ts         planner seed: disposable customer + one emulator request
  seed.technician.spec.ts       planner seed: disposable technician + one queued request
  setup/environment.setup.ts    gate project: emulator check, read canary
  smoke/public.spec.ts          signed-out smoke (4 tests)
  smoke/roles.spec.ts           per-role smoke (5 tests)
  config/env.ts                 load + validate E2E env, refuse unsafe values
  support/safety.ts             pure guards (unit-tested in unit/safety.test.ts)
  support/clerk-admin.ts        create/delete tagged disposable Clerk users
  support/emulator.ts           emulator-only Admin SDK: seed, owner-scoped delete, snapshot
  support/data.ts               unique marker, synthetic data (literals)
  fixtures/index.ts             test/expect, worker + test fixtures, role variants
  pages/repair-form.page.ts     /customer/new interactions
  pages/repair-list.ts          row lookup by marker
firebase.e2e.json               (repository root) emulator: 8086 (hub 4401, logging 4501, websocket 9151)
```

**Why `firebase.e2e.json` is the one E2E file outside `e2e/`.** The Firebase CLI treats the folder containing the config as the project directory and rejects `..` references ("is outside of project directory"). The Firestore rules and indexes are owned by the app at the repository root, so a config inside `e2e/` could not reference them without copying them (which would let the tests drift from the real rules). The workspace scripts pass `--config ../firebase.e2e.json`.

Generated artifacts (`e2e/test-results/`, `e2e/playwright-report/`) and the private `e2e/.env.local` stay under `e2e/` and are git-ignored.

The e2e code imports **nothing** from the application (`lib/`, `app/`, `components/`) or from `tests/`. Collection name and stored field names are re-declared in `support/emulator.ts`, and labels and values are literals, so a change to the app's validation constants or storage shape cannot silently change what a test expects.

## 3. Components

| File | Responsibility |
| --- | --- |
| `config/env.ts` | Reads `e2e/.env.local` (shell wins; paths resolved from the file's own location), validates, freezes. Errors name the setting, never the value. Also rejects an inherited `FIRESTORE_EMULATOR_HOST` that differs from the configured one (it caught a stale value in my own shell). |
| `support/safety.ts` | `assertEmulatorOnly` (loopback host, explicit port, `demo-` project), `assertLocalBaseUrl`, `assertClerkTestKeys`, `assertDedicatedClerkApp`, `isTaggedForRun`. |
| `support/clerk-admin.ts` | Creates users with email only (no password), `+clerk_test` address, tagged in public metadata. Technician role set through private metadata via the Backend API, exactly as production does. Deletes **only IDs it created in this run**, after re-reading the user and confirming the tag. |
| `support/emulator.ts` | Own Admin app, project ID only, no credential, `FIRESTORE_EMULATOR_HOST` forced. `seedRepair` (per-worker budget), `deleteOwnedBy`, `repairsOwnedBy`, `totalRepairs`. |
| `fixtures/index.ts` | Worker scope: `cfg`, Clerk testing token, Clerk user admin, `emulator`, lazy `customer` / `otherCustomer` / `technician` identities (in-memory session). Test scope: `marker`, `seed`, `customerPage` / `otherCustomerPage` / `technicianPage`, and an auto `testHygiene` (failure notes, then owner-scoped cleanup). Variants `customerTest` / `technicianTest` make the default `page` already signed in (used by planner seeds). |
| `pages/*` | Interactions and locators only. Assertions stay in tests. |
| `setup/environment.setup.ts` | Gate. `chromium` depends on it. |

## 4. Safety layers and what they do and do not prove

1. **Config guards**: dev Clerk keys only, dedicated app confirmation, loopback emulator with a `demo-` project, loopback base URL, port is not 3000.
2. **Explicit server environment** (`playwright.config.ts`): `FIRESTORE_EMULATOR_HOST` and a `demo-` project forced; `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `GOOGLE_APPLICATION_CREDENTIALS` and the web Firebase config overridden with empty strings (verified: Next does not override variables already set, empty included). `lib/firebase/admin.ts` also takes its credential-free emulator branch whenever the emulator host is set.
3. **No server reuse**: `reuseExistingServer: false`, on port 3100.
4. **Test-side Firestore access** is emulator-only (project ID, no credential) and **owner-scoped**: deletes are `where ownerId == <test user>`. The emulator-wide wipe is never called.
5. **Separate emulator** (8086, `demo-fix-district-e2e`) from Vitest's (8085), so neither suite can wipe the other.
6. **Gate canary** (`environment.setup.ts`): seeds a record that exists only in the emulator and requires the **technician queue** to show it.

**What the canary does not prove.** It shows that the queue's *read* path sees the emulator. It is not proof that every operation, collection, or code path is isolated. Layers 2 to 4 are the actual protection; the canary is a tripwire for one failure mode (server pointed at a different database). The *write* path is exercised separately by the smoke test that submits a request through the form and then finds it in the emulator, which runs only after the gate passes.

## 5. Build-directory and lock isolation (verified)

| Check | Result |
| --- | --- |
| Two `next dev` in this directory, different ports, same `distDir` | **Refused**: `Another next dev server is already running` (lock at `<distDir>/dev/lock`). Separate ports alone are not sufficient. |
| Two `next dev`, `NEXT_DIST_DIR=.next-e2e` for the second | **Both ran**, each with its own `dev/lock`. |
| Effect on tracked files | Next rewrote `tsconfig.json` (added `.next-e2e` type paths, reformatted arrays). I reverted that and pre-added the two `include` entries in the file's own style. |
| Emulators side by side | 8085/4400/4500/9150 (normal) and 8086/4401/4501/9151 (E2E) coexist. |
| E2E server via Playwright | Started on 3100 using `.next-e2e` (verified with a placeholder Clerk key). |

App-config change required: `distDir: process.env.NEXT_DIST_DIR || ".next"` in `next.config.ts` (unchanged behaviour when the variable is unset). Also added `.next-e2e` to `.gitignore`, ESLint ignores, and `tsconfig.json` includes.

**Checked with a real session** (workspace restructure verification): a normal `npm run dev` on port 3000 (the app's own `.next`, holding `.next/dev/lock`) stayed up and healthy while the E2E server ran on 3100 from `.next-e2e`, including two-worker runs and an MCP planner session. See section 10.

## 6. Authentication

`@clerk/testing`'s `clerk.signIn({ emailAddress })` signs in through a sign-in token created with the Backend API: no passwords, no email codes, no UI scripting. Nothing is added to the app. Identities are per worker, created on first use, and removed when the worker ends. Each worker holds its own customer so "My repairs" is deterministic; tests inside a worker run one at a time and clean up after themselves.

Cleanup of users is **scoped by ownership, not pattern**: users carry `publicMetadata.e2e = { framework, runId, app }`; only IDs created by this process are deleted, after re-checking that tag. **Automatic stale-user sweeping is deferred.** If a run crashes, delete leftovers by hand in the test application's Dashboard (emails look like `e2e-<runid>-w0-customer-<hex>+clerk_test@example.com`).

## 7. Test data and the technician queue

- Tests find their data by a unique `marker` in model and description, never by position, count, or ID.
- Preconditions are written directly to the emulator with `seed`. Seeded IDs are random 40-hex strings.
- **Newest-50 window.** The technician queue shows the newest 50 requests across all users. Each worker may hold at most **8** seeded requests (`SEEDED_REQUESTS_PER_WORKER`), `E2E_WORKERS` is capped at **4** (32 < 50), and the gate fails if the emulator already holds more than 10 leftovers. Tests needing many rows must use an owner-scoped list, not the queue. Empty-queue and 50-row behaviour stay in Vitest.
- Cleanup runs on pass and fail: per test (owner-scoped), per worker (owner-scoped, then users), and the emulator is discarded after `emulators:exec`.

## 8. Failure artifacts and sensitivity

Treat everything Playwright writes as **potentially sensitive**. Traces, screenshots, videos, network data and console output can contain cookies, request headers, Clerk responses, and Clerk Testing Token URLs. An in-memory `storageState` does **not** make artifacts credential-free.

- `e2e/test-results/`, `e2e/playwright-report/`, `e2e/blob-report/` are git-ignored. Keep them private; do not attach or share them publicly.
- Trace: `retain-on-failure` locally, **off in CI** unless `E2E_TRACE` is set. Screenshot: on failure. Video: off.
- Test data is synthetic. No real customer data, credentials, or tokens are used or attached.
- The framework attaches only: browser console errors and warnings (JWT-like strings and query values scrubbed, 500 characters max) and the emulator documents owned by the failed test. It never attaches authentication responses, cookies, storage state, or tokens.
- CI uploads the HTML report **only on failure**, retained 3 days.

## 9. Private configuration you must complete (not done, cannot be done by me)

I did not read `.env.local` values, create any Clerk resource, or touch your accounts.

1. **Create a new Clerk application** (free development instance), e.g. "Fix District E2E". Do not reuse the one in `.env.local`.
2. **Align its authentication settings with your existing app.** I cannot see your Clerk Dashboard, so compare these two applications side by side:
   - Email address enabled as an identifier (required; the sign-in helper looks users up by email). Match your existing app's other identifiers, password, and name requirements.
   - Multi-factor authentication **off** (the helper does not support MFA).
   - Restrictions: allowlist **off**, and "block email subaddresses" **off** (tests use `+clerk_test@example.com` addresses). Test mode on (the default on development instances).
   - Social connections, organizations, and billing are not needed.
3. **Copy three values** from the new application's *API keys* page into `e2e/.env.local` (created from `e2e/.env.example`): publishable key, secret key, and the **Frontend API host** (no `https://`). The host is a deliberate confirmation that these keys are the dedicated app.
4. **CI (optional, when you want it):** add repository secrets `E2E_CLERK_PUBLISHABLE_KEY`, `E2E_CLERK_SECRET_KEY`, `E2E_CLERK_FRONTEND_API`.

No roles are set by hand: the framework gives the technician role only to its own disposable users, through the Backend API. Your personal accounts are never touched.

## 10. Verification status

| Item | Status |
| --- | --- |
| `npm run lint`, `typecheck` (app only), `typecheck:tests`, `typecheck:e2e`, `next build` (runs its own type check) | Passing. Each check covers only its own files (app 57, Vitest 29, e2e 17; e2e pulls in no app files) |
| Root Vitest (`npm test`, emulator on 8085): 9 files, 80 tests; e2e guard tests (`npm run test:e2e:unit`): 1 file, 17 tests | Passing |
| Config fails fast and names the missing settings without values | Verified |
| Guard behaviour (non-loopback host, non-`demo-` project, live keys, wrong Clerk app, tag mismatch) | Unit tested |
| E2E emulator starts on 8086 beside the normal one on 8085 | Verified |
| Emulator helper: seed, budget, owner-scoped delete leaves other owners alone | Verified against the real emulator |
| App server starts on 3100 with `.next-e2e` and the forced environment | Verified (placeholder Clerk key) |
| Full run, one worker, dedicated Clerk dev app (`npm run test:e2e`) | **14 of 14 passed**: 2 setup, 3 seeds, 4 signed-out smoke, 5 role smoke (customer submit stored in the emulator, technician sees a seeded request, both 403 checks) |
| No user-deletion warnings in that run | Observed (users are deleted by ID after the tag re-check) |
| Two workers, then three more consecutive two-worker runs, with a normal dev server running on port 3000 | **14 of 14 passed every time** (plus later one- and two-worker runs after adding action timeouts). The dev server was not disturbed |
| Teardown | Dedicated Clerk app held 0 users before; 2 framework-tagged users were seen mid-run; **0 total, 0 tagged after every run** (checked by count, no identifiers printed). Emulator `repairRequests`: seen mid-run, **0 after**. Planner seed sessions end through the same teardown |
| Relocated Playwright config via MCP | The `run-test-mcp-server --config` launched exactly as in `.cursor/mcp.json` lists all 6 spec/setup files; `planner_setup_page` ran the setup gate and the customer and technician seeds; `planner_save_plan` wrote `e2e/specs/repair-workflow.md` |

The parallel claim is supported by those repeated runs on this machine, with one extra safeguard: seeded rows per worker are capped, and tests locate their own rows by marker. It has not been run in CI.

Known harmless noise in a passing run: `[Clerk Testing] FAPI request failed ... route.fetch: Target page, context or browser has been closed` is logged by `@clerk/testing` when a test's browser context closes while Clerk background requests are still in flight. The test has already finished. That log line includes a Clerk dev-browser ID in a URL, so treat run output as sensitive (section 8).

Commands (from the repository root):

```powershell
# One worker. Starts the emulator. Expect 14 tests: 2 setup, 9 smoke, 3 seeds.
npm run test:e2e

# Parallel, two workers:
$env:E2E_WORKERS = "2"; npm run test:e2e

# Filtered or repeated (emulator in a second terminal: npm run emulators:e2e):
npx playwright test -c e2e/playwright.config.ts --workers=2 --repeat-each=3
```

**Planner/generator/healer sessions** need the emulator running (`npm run emulators:e2e`); the MCP server starts the app server itself. Snapshots and console logs the MCP browser tools write go to a `.playwright-mcp/` folder in the repository root (git-ignored, delete it when done). A planner seed stays paused (its disposable user and records alive) until the session ends. Verified: running another `planner_setup_page` (for example with the signed-out `e2e/seed.spec.ts`, which creates nothing) ends the previous seed through its normal teardown. Closing the page with `browser_close` did **not** end it, and killing the MCP process would skip teardown, so check the dedicated Clerk app for leftovers (users tagged `fix-district-e2e`) after an interrupted session.

**Windows note.** After `emulators:exec` the Java emulator process can stay alive (the README documents the same for port 8085). If the next run says the port is taken, stop the process on 8086:
`Get-NetTCPConnection -LocalPort 8086 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`.
Use `npm run test:e2e:run` or `npx playwright test <args>` for filtered runs (with `npm run emulators:e2e` running); `npm run test:e2e` cannot forward arguments to Playwright.

## 11. Browser tests vs Vitest

| | Vitest | Playwright |
| --- | --- | --- |
| Package | root `package.json` | `@fix-district/e2e` workspace |
| Location / names | `tests/`, `*.test.ts(x)` | `e2e/`, `*.spec.ts`, `*.setup.ts` |
| TypeScript check | `npm run typecheck:tests` | `npm run typecheck:e2e` |
| Auth | Mocked | Real Clerk dev sessions |
| App code | Imported (`server-only` stubbed) | Black box over HTTP; no `lib/` imports |
| Firestore | Emulator 8085, `demo-fix-district`, wiped between tests | Emulator 8086, `demo-fix-district-e2e`, owner-scoped cleanup only |
| Commands | `npm test`, `npm run test:unit` | `npm run test:e2e` |

Nothing crosses: the workspace's guard tests (`e2e/unit/`) have their own Vitest config and are run by `npm run test:e2e:unit`; the root Vitest config only includes `tests/`.

## 12. Rules for new tests

- Import `test` / `expect` from `e2e/fixtures`, never from `@playwright/test`.
- Independent tests: no order dependence, no `describe.serial`, no module-level mutable state, no data created in `beforeAll` for other tests.
- No fixed sleeps (use web-first assertions or `expect.poll`), no hardcoded record IDs, no counts or order assertions on shared lists.
- Use accessible locators (`getByRole`, `getByLabel`); the app has no test IDs.
- State expected business outcomes as literals in the test.
- Keep demo data synthetic; never attach auth responses or tokens.

## 13. Out of scope for this step

Production auth bypass or test-only routes, any live Firestore access, automatic stale-user sweeping, the remote-readonly target, other browsers, and the full repair test suite. The planner has **not** been run; it waits for the section 9 setup and a passing seed run.
