# Fix District: Playwright E2E framework

Status: **implemented and verified with one worker.** The full suite (setup gate, role seeds, smoke checks) passes against the dedicated Clerk development application and the isolated emulator. Parallel execution is **not** claimed reliable until the two-worker check in section 10 passes.

Browser tests live in `e2e/` and run with Playwright. Vitest (`tests/`) is separate.

## 1. Decisions applied

| Decision | Result |
| --- | --- |
| Dedicated Clerk development application | Required. The runner refuses `pk_live_`/`sk_live_` keys, a key identical to the one in `.env.local`, and a Frontend API host you have not typed in to confirm the key. |
| `next dev` locally on 3100, production build in CI | `E2E_SERVER_MODE=dev` (default) or `build` (default when `CI` is set). |
| Separate build directory and lock | **Verified**, see section 5. |
| Chromium only, one worker | `projects: setup, chromium`. `workers` defaults to 1 (`E2E_WORKERS`, max 4). |
| Authenticated planner seeds | `e2e/seed.customer.spec.ts`, `e2e/seed.technician.spec.ts` (disposable user plus emulator data). |
| Remote-readonly target | Deferred. Not built. Remote base URLs are refused. |
| Existing `e2e/` directory | Kept. |

## 2. Layout (inside the existing `e2e/`)

```
e2e/
  seed.spec.ts                  signed-out planner seed (kept, now uses fixtures)
  seed.customer.spec.ts         planner seed: disposable customer + one emulator request
  seed.technician.spec.ts       planner seed: disposable technician + one queued request
  setup/environment.setup.ts    gate project: emulator check, read canary
  smoke/public.spec.ts          signed-out smoke (4 tests)
  smoke/roles.spec.ts           per-role smoke (5 tests)
  config/env.ts                 load + validate E2E env, refuse unsafe values
  support/safety.ts             pure guards (unit-tested in tests/unit/e2e-safety.test.ts)
  support/clerk-admin.ts        create/delete tagged disposable Clerk users
  support/emulator.ts           emulator-only Admin SDK: seed, owner-scoped delete, snapshot
  support/data.ts               unique marker, synthetic data (literals)
  fixtures/index.ts             test/expect, worker + test fixtures, role variants
  pages/repair-form.page.ts     /customer/new interactions
  pages/repair-list.ts          row lookup by marker
playwright.config.ts            projects, explicit server environment, artifact policy
firebase.e2e.json               emulator: 8086 (hub 4401, logging 4501, websocket 9151)
.env.e2e.example                placeholders only
```

The e2e code imports **nothing** from `lib/` or `tests/`. Collection name and stored field names are re-declared in `support/emulator.ts`, and labels and values are literals, so a change to the app's validation constants or storage shape cannot silently change what a test expects.

## 3. Components

| File | Responsibility |
| --- | --- |
| `config/env.ts` | Reads `.env.e2e.local` (shell wins), validates, freezes. Errors name the setting, never the value. Also rejects an inherited `FIRESTORE_EMULATOR_HOST` that differs from the configured one (it caught a stale value in my own shell). |
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

**Not yet checked with a real session**: a normal `npm run dev` on port 3000 running at the same time as the E2E server. The lock and directory isolation are verified; the combined run is part of section 10.

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

- `test-results/`, `playwright-report/`, `blob-report/` are git-ignored. Keep them private; do not attach or share them publicly.
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
3. **Copy three values** from the new application's *API keys* page into `.env.e2e.local` (created from `.env.e2e.example`): publishable key, secret key, and the **Frontend API host** (no `https://`). The host is a deliberate confirmation that these keys are the dedicated app.
4. **CI (optional, when you want it):** add repository secrets `E2E_CLERK_PUBLISHABLE_KEY`, `E2E_CLERK_SECRET_KEY`, `E2E_CLERK_FRONTEND_API`.

No roles are set by hand: the framework gives the technician role only to its own disposable users, through the Backend API. Your personal accounts are never touched.

## 10. Verification status

| Item | Status |
| --- | --- |
| `tsc`, `eslint`, `npm test` (10 files, 97 tests incl. 17 guard tests) | Passing |
| Config fails fast and names the missing settings without values | Verified |
| Guard behaviour (non-loopback host, non-`demo-` project, live keys, wrong Clerk app, tag mismatch) | Unit tested |
| E2E emulator starts on 8086 beside the normal one on 8085 | Verified |
| Emulator helper: seed, budget, owner-scoped delete leaves other owners alone | Verified against the real emulator |
| App server starts on 3100 with `.next-e2e` and the forced environment | Verified (placeholder Clerk key) |
| Full run, one worker, dedicated Clerk dev app (`npm run test:e2e`) | **14 of 14 passed**: 2 setup, 3 seeds, 4 signed-out smoke, 5 role smoke (customer submit stored in the emulator, technician sees a seeded request, both 403 checks) |
| No user-deletion warnings in that run | Observed (users are deleted by ID after the tag re-check) |
| Two-worker parallel run | **Not run. No parallel-reliability claim.** |

Known harmless noise in a passing run: `[Clerk Testing] FAPI request failed ... route.fetch: Target page, context or browser has been closed` is logged by `@clerk/testing` when a test's browser context closes while Clerk background requests are still in flight. The test has already finished. That log line includes a Clerk dev-browser ID in a URL, so treat run output as sensitive (section 8).

After you finish section 9:

```powershell
# One worker. Starts the emulator. Expect 14 tests: 2 setup, 9 smoke, 3 seeds.
npm run test:e2e

# Parallel check, two workers:
$env:E2E_WORKERS = "2"; npm run test:e2e

# Repeated parallel check (emulator in a second terminal: npm run emulators:e2e):
npx playwright test --workers=2 --repeat-each=3
```

Reliability of parallel runs should only be claimed after those pass repeatedly, with a normal `npm run dev` running alongside.

**Windows note.** After `emulators:exec` the Java emulator process can stay alive (the README documents the same for port 8085). If the next run says the port is taken, stop the process on 8086:
`Get-NetTCPConnection -LocalPort 8086 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`.
Use `npm run test:e2e:run` or `npx playwright test <args>` for filtered runs (with `npm run emulators:e2e` running); `npm run test:e2e` cannot forward arguments to Playwright.

## 11. Browser tests vs Vitest

| | Vitest | Playwright |
| --- | --- | --- |
| Location / names | `tests/`, `*.test.ts(x)` | `e2e/`, `*.spec.ts`, `*.setup.ts` |
| Auth | Mocked | Real Clerk dev sessions |
| App code | Imported (`server-only` stubbed) | Black box over HTTP; no `lib/` imports |
| Firestore | Emulator 8085, `demo-fix-district`, wiped between tests | Emulator 8086, `demo-fix-district-e2e`, owner-scoped cleanup only |
| Commands | `npm test`, `npm run test:unit` | `npm run test:e2e` |

Only exception: `tests/unit/e2e-safety.test.ts` imports the pure guard module `e2e/support/safety.ts` (no I/O, no imports) so the guards are unit tested. Nothing else crosses.

## 12. Rules for new tests

- Import `test` / `expect` from `e2e/fixtures`, never from `@playwright/test`.
- Independent tests: no order dependence, no `describe.serial`, no module-level mutable state, no data created in `beforeAll` for other tests.
- No fixed sleeps (use web-first assertions or `expect.poll`), no hardcoded record IDs, no counts or order assertions on shared lists.
- Use accessible locators (`getByRole`, `getByLabel`); the app has no test IDs.
- State expected business outcomes as literals in the test.
- Keep demo data synthetic; never attach auth responses or tokens.

## 13. Out of scope for this step

Production auth bypass or test-only routes, any live Firestore access, automatic stale-user sweeping, the remote-readonly target, other browsers, and the full repair test suite. The planner has **not** been run; it waits for the section 9 setup and a passing seed run.
