# Fix District browser tests (`@fix-district/e2e`)

Playwright (Chromium) tests for the running app, kept in a private npm workspace so test tooling and the application
have separate packages. Design, safety model and rules for new tests: [docs/framework.md](docs/framework.md).

The application's unit/integration tests are Vitest tests in `../tests` and are separate.

## Run (from the repository root)

There is nothing to start and no setup test to run first. The standard Playwright runner starts what the tests need
(see "How prerequisites work"), so any test, file or folder can be run on its own.

```powershell
npx playwright test                                    # everything (one worker)
npx playwright test repair/customer-submit-persist.spec.ts   # one file
npx playwright test -g "lands on the customer dashboard"     # one test by title
npx playwright test --ui                               # UI mode: pick any test and click Run
$env:E2E_WORKERS = "2"; npx playwright test            # parallel (max 4)

npm run test:e2e:unit         # the safety-guard unit tests (no services needed)
npm run typecheck:e2e         # type check this workspace only
npm run typecheck:all         # app + Vitest + e2e type checks
```

`npm run test:e2e` is the same `playwright test`. From inside `e2e/` the scripts exist without the `e2e` suffix.
The root `playwright.config.js` forwards to `e2e/playwright.config.ts`, so the commands above work from the
repository root. Only E2E browser specs are discovered; Vitest files are excluded.

The test server uses its own `.next-e2e` directory on port 3100, so a normal `npm run dev` (port 3000) can keep
running. It never reuses an existing server: **only one runner session can hold port 3100 at a time** (a CLI run, a
UI-mode session, or a paused agent session). Close one before opening another.

## How prerequisites work

The same steps run in the CLI, in UI mode and in agent (MCP) sessions, because they are part of the config and the
shared fixtures, not a project you select:

| Step | When | What |
| --- | --- | --- |
| Emulator | once per runner session (`webServer` in `playwright.config.ts`) | Reuses a Firestore emulator already answering on the E2E port, otherwise starts the one defined by `../firebase.e2e.json`. Playwright stops only a process it started (and its child processes) at the end of the session. An emulator you started is never stopped. |
| App test server | once per runner session | `next dev` (or build + start in CI) on port 3100 with an explicit emulator-only environment. |
| Emulator identity and cleanliness | once per runner session (`setup/global-setup.ts`) | The emulator hub (`E2E_EMULATOR_HUB`) must confirm that Firestore is on the configured port, so a stray process on the port is refused, not used. The emulator must hold at most 10 leftover requests. Nothing is ever wiped. |
| Environment | once per worker, every test (auto fixture `environment`) | Configuration is valid and the emulator still answers as the E2E emulator. Cheap, read-only. |
| App reads the emulator | once per worker, before a test first uses `emulator`, `seed`, `customer`, `otherCustomer` or `technician` | A record written only to the emulator must appear in the app's own customer list. It is owned by the worker's disposable customer and removed at once. |
| Sessions | on demand | Customers get customer sessions, technicians technician sessions, signed-out tests get none. A signed-out test creates no Clerk user and no record. |

Reuse and independence: users and sessions are created once per worker and reused, but every test gets fresh browser
contexts and its own marker, and its records are deleted by owner afterwards. Nothing depends on test order.

If the emulator ports are held by something that is not the E2E emulator (or by a stale one), the run stops with a
message that names the setting. It does not kill the process. Stop that process yourself, or let it be and use the
reuse path.

Starting an emulator yourself first is still fine and a little faster (`npm run emulators:e2e`, then run tests as
usual); it is reused. A long-running emulator is only as clean as its last run: if a run was killed, restart it.
Agent sessions run these steps on every `planner_setup_page`, `generator_setup_page` and `test_run` call; a
runner-started emulator is restarted on each call, so start one yourself for faster agent sessions.

The emulator is started automatically only for the default host and hub. If you set `E2E_FIRESTORE_EMULATOR_HOST` or
`E2E_EMULATOR_HUB` to other values, run that emulator yourself; it is still validated before use.

## One-time private setup

1. Create a **dedicated Clerk application** (development instance). Never reuse the app in the root `.env.local`.
2. Copy `.env.example` to `.env.local` **in this folder** and fill in the three Clerk values. `.env.local` is
   git-ignored; do not paste its contents anywhere. Setup details: [docs/framework.md](docs/framework.md) section 9.
3. Java 21+ for the Firestore emulator, and `npx playwright install chromium` once.

## What is where

| Path | Purpose |
| --- | --- |
| `playwright.config.ts` | the `chromium` project (no setup project), `webServer` entries for the emulator and the app server, `globalSetup`, explicit app-server environment, artifact policy |
| `config/env.ts` | loads and validates `e2e/.env.local` plus shell, refuses unsafe values |
| `support/` | `safety.ts` guards, `preflight.ts` (emulator identity and leftover checks), `clerk-admin.ts`, `emulator.ts`, `data.ts` |
| `fixtures/index.ts` | `test` / `customerTest` / `technicianTest` / `expect`, including the automatic prerequisites |
| `pages/` | page objects (locators and actions only) |
| `setup/global-setup.ts` | once per runner session: emulator identity and cleanliness |
| `smoke/`, `repair/`, `seed*.spec.ts` | the browser checks and the planner seeds |
| `specs/` | test plans produced by the planner agent (review before generating tests) |
| `unit/` | Vitest tests for the guards (`vitest.config.mts`) |
| `../firebase.e2e.json` | emulator config (port 8086), at the root because the Firebase CLI can only reference rules inside the config's folder |

Generated output (`test-results/`, `playwright-report/`) lands here and is git-ignored. **Treat it as private:** traces,
screenshots and network data can contain cookies and Clerk responses.

## Safety, in short

- Emulator only: loopback host, explicit port, `demo-` project. Live Firebase credentials are blanked for the test server.
- Dedicated Clerk dev app only; live keys and the app's own keys are refused.
- Cleanup is owner-scoped: only the users and records a run created, never a wipe or a pattern sweep.
- No production authentication bypass was added; sign-in uses Clerk's testing helpers.

## Agents (planner / generator / healer)

Definitions: `../.cursor/agents/` (Cursor) and `../.github/agents/` (VS Code / Copilot). Both start the Playwright MCP
server with `--config e2e/playwright.config.ts` (see `../.cursor/mcp.json`, `../.vscode/mcp.json`). The emulator and
app server start automatically, as for any runner (see "How prerequisites work"). A paused seed session holds port
3100 until the next setup call or the end of the session; close UI mode before using agents, and the reverse.
Plans go to `specs/`.

## Windows note

If a run reports the emulator ports (8086, 4401, 9151) in use and the run was not started by this runner, something
else holds them, for example an emulator from an older session. Find it with
`Get-NetTCPConnection -LocalPort 8086 -State Listen` and stop it yourself; the runner never stops a process it did not
start. An emulator the runner starts is stopped with its whole process tree at the end of the session.
