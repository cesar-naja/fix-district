# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\repair\customer-submit-persist.spec.ts >> Customer repair submission and persistence >> Submit a valid repair, open its details, reload, verify the saved values persist
- Location: e2e\repair\customer-submit-persist.spec.ts:24:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3100/
Call log:
  - navigating to "http://localhost:3100/", waiting until "load"

```

# Test source

```ts
  1   | import {
  2   |   expect,
  3   |   test as base,
  4   |   type Browser,
  5   |   type BrowserContext,
  6   |   type Page,
  7   | } from "@playwright/test";
  8   | import { clerk, clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";
  9   | import { loadE2EEnv, type E2EConfig } from "../config/env";
  10  | import { createClerkTestUsers, type TestRole, type TestUser } from "../support/clerk-admin";
  11  | import { uniqueMarker, type RepairFormInput } from "../support/data";
  12  | import { createEmulatorData, type EmulatorData } from "../support/emulator";
  13  | 
  14  | /**
  15  |  * Every spec imports `test` and `expect` from here, never from
  16  |  * @playwright/test, so every test gets the same isolation guarantees.
  17  |  *
  18  |  * Scopes:
  19  |  *  - worker: configuration, Clerk testing token, Clerk user admin, emulator
  20  |  *    access, and one disposable signed-in user per role. Created lazily (only
  21  |  *    when a test asks for them) and deleted when the worker ends.
  22  |  *  - test: a unique marker, fresh browser contexts for each actor, and the
  23  |  *    cleanup of every record the test owned, on pass and on failure.
  24  |  *
  25  |  * Nothing mutable lives at module scope.
  26  |  */
  27  | 
  28  | type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;
  29  | 
  30  | /** A disposable Clerk user plus its signed-in session, held in memory only. */
  31  | export type Identity = TestUser & { storageState: StorageState };
  32  | 
  33  | type WorkerFixtures = {
  34  |   cfg: E2EConfig;
  35  |   clerkTestingReady: true;
  36  |   clerkUsers: ReturnType<typeof createClerkTestUsers>;
  37  |   emulator: EmulatorData;
  38  |   customer: Identity;
  39  |   otherCustomer: Identity;
  40  |   technician: Identity;
  41  | };
  42  | 
  43  | type SeedArgs = {
  44  |   /** Clerk user ID that owns the record (use an identity's `userId`). */
  45  |   ownerId: string;
  46  |   overrides?: Partial<RepairFormInput>;
  47  | };
  48  | 
  49  | type TestFixtures = {
  50  |   /** Unique to this test. Put it in the data you create and find it by it. */
  51  |   marker: string;
  52  |   /** Clerk user IDs whose repair records are removed after this test. */
  53  |   ownedIds: Set<string>;
  54  |   /** Browser console and page errors collected during this test. */
  55  |   consoleNotes: string[];
  56  |   /** Runs after every test: failure notes, then owner-scoped cleanup. */
  57  |   testHygiene: void;
  58  |   /** Writes a repair request straight into the emulator as a precondition. */
  59  |   seed: (args: SeedArgs) => Promise<string>;
  60  |   customerPage: Page;
  61  |   otherCustomerPage: Page;
  62  |   technicianPage: Page;
  63  | };
  64  | 
  65  | /** Removes tokens and query strings before text is kept in an artifact. */
  66  | function scrub(text: string): string {
  67  |   return text
  68  |     .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]*/g, "[jwt]")
  69  |     .replace(/([?&][\w.-]+)=[^&\s"']+/g, "$1=[redacted]")
  70  |     .slice(0, 500);
  71  | }
  72  | 
  73  | function watch(page: Page, notes: string[]): void {
  74  |   page.on("console", (message) => {
  75  |     if (message.type() === "error" || message.type() === "warning") {
  76  |       notes.push(`console.${message.type()}: ${scrub(message.text())}`);
  77  |     }
  78  |   });
  79  |   page.on("pageerror", (error) => {
  80  |     notes.push(`pageerror: ${scrub(error.message)}`);
  81  |   });
  82  | }
  83  | 
  84  | /** Creates the user, signs in once through Clerk's testing helper, keeps the session. */
  85  | async function createIdentity(
  86  |   browser: Browser,
  87  |   cfg: E2EConfig,
  88  |   users: ReturnType<typeof createClerkTestUsers>,
  89  |   role: TestRole,
  90  |   workerIndex: number,
  91  | ): Promise<Identity> {
  92  |   const user = await users.create(role, workerIndex);
  93  |   const context = await browser.newContext({ baseURL: cfg.baseUrl });
  94  |   try {
  95  |     const page = await context.newPage();
  96  |     // Clerk requires an unprotected page that loads Clerk before signing in.
> 97  |     await page.goto("/");
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3100/
  98  |     await clerk.signIn({ page, emailAddress: user.email });
  99  |     // /dashboard sends each user to their role's page. This also proves the
  100 |     // role was applied the way production applies it.
  101 |     await page.goto("/dashboard");
  102 |     await expect(
  103 |       page,
  104 |       `A disposable ${role} should land on /${role} after signing in`,
  105 |     ).toHaveURL(new RegExp(`/${role}$`));
  106 |     return { ...user, storageState: await context.storageState() };
  107 |   } finally {
  108 |     await context.close();
  109 |   }
  110 | }
  111 | 
  112 | async function openAs(
  113 |   browser: Browser,
  114 |   cfg: E2EConfig,
  115 |   identity: Identity,
  116 |   ownedIds: Set<string>,
  117 |   notes: string[],
  118 | ): Promise<{ context: BrowserContext; page: Page }> {
  119 |   ownedIds.add(identity.userId);
  120 |   const context = await browser.newContext({
  121 |     baseURL: cfg.baseUrl,
  122 |     storageState: identity.storageState,
  123 |   });
  124 |   await setupClerkTestingToken({ context });
  125 |   const page = await context.newPage();
  126 |   watch(page, notes);
  127 |   return { context, page };
  128 | }
  129 | 
  130 | export const test = base.extend<TestFixtures, WorkerFixtures>({
  131 |   // ---- worker scope --------------------------------------------------------
  132 |   cfg: [
  133 |     async ({}, use) => {
  134 |       await use(loadE2EEnv());
  135 |     },
  136 |     { scope: "worker" },
  137 |   ],
  138 | 
  139 |   clerkTestingReady: [
  140 |     async ({ cfg }, use) => {
  141 |       // Fetches a Clerk Testing Token so Clerk's bot protection lets tests through.
  142 |       await clerkSetup({
  143 |         publishableKey: cfg.clerk.publishableKey,
  144 |         secretKey: cfg.clerk.secretKey,
  145 |         dotenv: false,
  146 |       });
  147 |       await use(true);
  148 |     },
  149 |     { scope: "worker" },
  150 |   ],
  151 | 
  152 |   clerkUsers: [
  153 |     async ({ cfg, clerkTestingReady }, use) => {
  154 |       if (!clerkTestingReady) throw new Error("Clerk testing is not ready.");
  155 |       const users = createClerkTestUsers(cfg);
  156 |       await use(users);
  157 |       await users.deleteCreated();
  158 |     },
  159 |     { scope: "worker" },
  160 |   ],
  161 | 
  162 |   emulator: [
  163 |     async ({ cfg }, use) => {
  164 |       await use(createEmulatorData(cfg));
  165 |     },
  166 |     { scope: "worker" },
  167 |   ],
  168 | 
  169 |   customer: [
  170 |     async ({ browser, cfg, clerkUsers, emulator }, use, workerInfo) => {
  171 |       const identity = await createIdentity(browser, cfg, clerkUsers, "customer", workerInfo.workerIndex);
  172 |       await use(identity);
  173 |       await emulator.deleteOwnedBy(identity.userId);
  174 |     },
  175 |     { scope: "worker" },
  176 |   ],
  177 | 
  178 |   otherCustomer: [
  179 |     async ({ browser, cfg, clerkUsers, emulator }, use, workerInfo) => {
  180 |       const identity = await createIdentity(browser, cfg, clerkUsers, "customer", workerInfo.workerIndex);
  181 |       await use(identity);
  182 |       await emulator.deleteOwnedBy(identity.userId);
  183 |     },
  184 |     { scope: "worker" },
  185 |   ],
  186 | 
  187 |   technician: [
  188 |     async ({ browser, cfg, clerkUsers }, use, workerInfo) => {
  189 |       await use(await createIdentity(browser, cfg, clerkUsers, "technician", workerInfo.workerIndex));
  190 |     },
  191 |     { scope: "worker" },
  192 |   ],
  193 | 
  194 |   // ---- test scope ----------------------------------------------------------
  195 |   marker: async ({ cfg }, use, testInfo) => {
  196 |     await use(uniqueMarker(cfg.runId, testInfo.workerIndex));
  197 |   },
```