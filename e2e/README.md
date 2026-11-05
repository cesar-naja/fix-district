# Fix District browser tests (`@fix-district/e2e`)

Playwright (Chromium) tests for the running app, kept in a private npm workspace so test tooling and the application
have separate packages. Design, safety model and rules for new tests: [docs/framework.md](docs/framework.md).

The application's unit/integration tests are Vitest tests in `../tests` and are separate.

## Run (from the repository root)

```powershell
npm run test:e2e              # emulator + app test server + browser tests (one worker)
npm run test:e2e:unit         # the 17 safety-guard unit tests (no services needed)
npm run typecheck:e2e         # type check this workspace only
npm run typecheck:all         # app + Vitest + e2e type checks

$env:E2E_WORKERS = "2"; npm run test:e2e     # parallel (max 4)
```

Filtered or repeated runs need the emulator running in a second terminal:

```powershell
npm run emulators:e2e                                   # terminal 1
npx playwright test -c e2e/playwright.config.ts smoke/roles.spec.ts --workers=2 --repeat-each=3   # terminal 2
# or: npm run test:e2e:run
```

From inside `e2e/` the same scripts exist without the `e2e` suffix: `npm test`, `npm run test:run`,
`npm run test:unit`, `npm run emulators`, `npm run typecheck`.

`npm run test:e2e` builds nothing into `.next`: the test server uses its own `.next-e2e` directory on port 3100, so a
normal `npm run dev` (port 3000) can keep running. It never reuses an existing server.

## One-time private setup

1. Create a **dedicated Clerk application** (development instance). Never reuse the app in the root `.env.local`.
2. Copy `.env.example` to `.env.local` **in this folder** and fill in the three Clerk values. `.env.local` is
   git-ignored; do not paste its contents anywhere. Setup details: [docs/framework.md](docs/framework.md) section 9.
3. Java 21+ for the Firestore emulator, and `npx playwright install chromium` once.

## What is where

| Path | Purpose |
| --- | --- |
| `playwright.config.ts` | projects (`setup` gate, `chromium`), explicit app-server environment, artifact policy |
| `config/env.ts` | loads and validates `e2e/.env.local` plus shell, refuses unsafe values |
| `support/` | `safety.ts` guards, `clerk-admin.ts`, `emulator.ts`, `data.ts` |
| `fixtures/index.ts` | `test` / `customerTest` / `technicianTest` / `expect` |
| `pages/` | page objects (locators and actions only) |
| `setup/` | environment gate (emulator reachable and clean, read canary) |
| `smoke/`, `seed*.spec.ts` | the current 14 checks and the planner seeds |
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
server with `--config e2e/playwright.config.ts` (see `../.cursor/mcp.json`, `../.vscode/mcp.json`). Start
`npm run emulators:e2e` before using them. Plans go to `specs/`.

## Windows note

After `emulators:exec` the Java emulator can outlive the run. If the next run reports port 8086 in use, stop the process
listening on 8086 (and 9151 / 4401).
