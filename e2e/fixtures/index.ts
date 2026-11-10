import {
  expect,
  test as base,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { clerk, clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";
import { loadE2EEnv, type E2EConfig } from "../config/env";
import { createClerkTestUsers, type TestRole, type TestUser } from "../support/clerk-admin";
import { uniqueMarker, type RepairFormInput } from "../support/data";
import { createEmulatorData, type EmulatorData } from "../support/emulator";
import { verifyEmulator } from "../support/preflight";
import { LIST_NAME, repairRow } from "../pages/repair-list";

/**
 * Every spec imports `test` and `expect` from here, never from
 * @playwright/test, so every test gets the same isolation guarantees and the
 * same automatic prerequisites. No setup test has to run first.
 *
 * Prerequisites, and where each one lives:
 *  - once per runner session (CLI run, UI session, agent run): the emulator is
 *    started or reused, validated as the intended E2E emulator and checked for
 *    leftovers (playwright.config.ts webServer + setup/global-setup.ts);
 *  - once per worker, for every test (auto fixture `environment`): the
 *    configuration is valid and the emulator still answers as the E2E one;
 *  - once per worker, before a test first touches data (`emulator`, `customer`,
 *    `otherCustomer`, `technician`, and so `seed` and the role pages): the app
 *    server is proven to read this emulator (`appReadsEmulator`).
 * A signed-out test needs none of the data prerequisites, so it creates no
 * Clerk user and no record, and stays signed out.
 *
 * Scopes:
 *  - worker: configuration, Clerk testing token, Clerk user admin, emulator
 *    access, and one disposable signed-in user per role. Created lazily (only
 *    when a test asks for them) and deleted when the worker ends.
 *  - test: a unique marker, fresh browser contexts for each actor, and the
 *    cleanup of every record the test owned, on pass and on failure.
 *
 * Nothing mutable lives at module scope.
 */

type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;

/** A disposable Clerk user plus its signed-in session, held in memory only. */
export type Identity = TestUser & { storageState: StorageState };

type WorkerFixtures = {
  cfg: E2EConfig;
  /** Auto. The emulator answers and is the intended E2E emulator. */
  environment: void;
  clerkTestingReady: true;
  clerkUsers: ReturnType<typeof createClerkTestUsers>;
  /** Internal: emulator access without the app-reads-emulator proof (used for cleanup). */
  emulatorData: EmulatorData;
  /** Internal: true once the app server was shown to read this emulator. */
  appReadsEmulator: true;
  /** Internal: raw identities. Tests use the public ones below. */
  customerIdentity: Identity;
  otherCustomerIdentity: Identity;
  technicianIdentity: Identity;
  /** Emulator access for tests; first use proves the app reads this emulator. */
  emulator: EmulatorData;
  customer: Identity;
  otherCustomer: Identity;
  technician: Identity;
};

type SeedArgs = {
  /** Clerk user ID that owns the record (use an identity's `userId`). */
  ownerId: string;
  overrides?: Partial<RepairFormInput>;
};

type TestFixtures = {
  /** Unique to this test. Put it in the data you create and find it by it. */
  marker: string;
  /** Clerk user IDs whose repair records are removed after this test. */
  ownedIds: Set<string>;
  /** Browser console and page errors collected during this test. */
  consoleNotes: string[];
  /** Runs after every test: failure notes, then owner-scoped cleanup. */
  testHygiene: void;
  /** Writes a repair request straight into the emulator as a precondition. */
  seed: (args: SeedArgs) => Promise<string>;
  customerPage: Page;
  otherCustomerPage: Page;
  technicianPage: Page;
};

/** Removes tokens and query strings before text is kept in an artifact. */
function scrub(text: string): string {
  return text
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]*/g, "[jwt]")
    .replace(/([?&][\w.-]+)=[^&\s"']+/g, "$1=[redacted]")
    .slice(0, 500);
}

function watch(page: Page, notes: string[]): void {
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      notes.push(`console.${message.type()}: ${scrub(message.text())}`);
    }
  });
  page.on("pageerror", (error) => {
    notes.push(`pageerror: ${scrub(error.message)}`);
  });
}

/** Creates the user, signs in once through Clerk's testing helper, keeps the session. */
async function createIdentity(
  browser: Browser,
  cfg: E2EConfig,
  users: ReturnType<typeof createClerkTestUsers>,
  role: TestRole,
  workerIndex: number,
): Promise<Identity> {
  const user = await users.create(role, workerIndex);
  const context = await browser.newContext({ baseURL: cfg.baseUrl });
  try {
    const page = await context.newPage();
    // Clerk requires an unprotected page that loads Clerk before signing in.
    await page.goto("/");
    await clerk.signIn({ page, emailAddress: user.email });
    // /dashboard sends each user to their role's page. This also proves the
    // role was applied the way production applies it.
    await page.goto("/dashboard");
    await expect(
      page,
      `A disposable ${role} should land on /${role} after signing in`,
    ).toHaveURL(new RegExp(`/${role}$`));
    return { ...user, storageState: await context.storageState() };
  } finally {
    await context.close();
  }
}

async function openAs(
  browser: Browser,
  cfg: E2EConfig,
  identity: Identity,
  ownedIds: Set<string>,
  notes: string[],
): Promise<{ context: BrowserContext; page: Page }> {
  ownedIds.add(identity.userId);
  const context = await browser.newContext({
    baseURL: cfg.baseUrl,
    storageState: identity.storageState,
  });
  await setupClerkTestingToken({ context });
  const page = await context.newPage();
  watch(page, notes);
  return { context, page };
}

/**
 * The app test server reads the emulator these tests use: a record written
 * only to the emulator must appear in the app's own customer list. A server
 * pointed at any other database would not show it. This proves the READ path
 * for one query; the layers in docs/framework.md (explicit server environment,
 * emulator-only test access, owner-scoped cleanup) are the actual protection.
 * The record is owned by the worker's disposable customer and removed at once.
 */
async function verifyAppReadsEmulator(
  browser: Browser,
  cfg: E2EConfig,
  emulator: EmulatorData,
  customer: Identity,
  workerIndex: number,
): Promise<void> {
  const marker = uniqueMarker(cfg.runId, workerIndex);
  await emulator.seedRepair({ ownerId: customer.userId, marker });
  try {
    const { context, page } = await openAs(browser, cfg, customer, new Set(), []);
    try {
      await page.goto("/customer");
      await expect(
        repairRow(page, LIST_NAME.customer, marker),
        "A record that exists only in the emulator is not visible to the app. The app server is not reading the emulator.",
      ).toBeVisible({ timeout: 30_000 });
    } finally {
      await context.close();
    }
  } finally {
    await emulator.deleteOwnedBy(customer.userId);
  }
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // ---- worker scope --------------------------------------------------------
  cfg: [
    async ({}, use) => {
      await use(loadE2EEnv());
    },
    { scope: "worker" },
  ],

  // Runs for every test in the worker (signed-out ones included). Cheap: two
  // read-only requests. Global setup already did the same once per session;
  // repeating it here keeps a single selected test safe on its own and catches
  // an emulator that stopped or was swapped mid-session.
  environment: [
    async ({ cfg }, use) => {
      await verifyEmulator(cfg);
      await use();
    },
    { scope: "worker", auto: true },
  ],

  clerkTestingReady: [
    async ({ cfg }, use) => {
      // Fetches a Clerk Testing Token so Clerk's bot protection lets tests through.
      await clerkSetup({
        publishableKey: cfg.clerk.publishableKey,
        secretKey: cfg.clerk.secretKey,
        dotenv: false,
      });
      await use(true);
    },
    { scope: "worker" },
  ],

  clerkUsers: [
    async ({ cfg, clerkTestingReady }, use) => {
      if (!clerkTestingReady) throw new Error("Clerk testing is not ready.");
      const users = createClerkTestUsers(cfg);
      await use(users);
      await users.deleteCreated();
    },
    { scope: "worker" },
  ],

  // The test side's own access to the emulator: emulator-only, owner-scoped.
  // Internal, so cleanup never has to wait for (or trigger) the app proof.
  emulatorData: [
    async ({ cfg, environment }, use) => {
      void environment;
      await use(createEmulatorData(cfg));
    },
    { scope: "worker" },
  ],

  // Proves, once per worker, that the app server reads THIS emulator: a record
  // that exists only here must show up in the app's own customer list. It uses
  // the worker's customer, so the user is created once and reused by the tests.
  appReadsEmulator: [
    async ({ browser, cfg, emulatorData, customerIdentity }, use, workerInfo) => {
      await verifyAppReadsEmulator(browser, cfg, emulatorData, customerIdentity, workerInfo.workerIndex);
      await use(true);
    },
    { scope: "worker", timeout: 120_000 },
  ],

  // Raw identities: created lazily, deleted (records first, then the user) when
  // the worker ends. Tests get them through the public fixtures below.
  customerIdentity: [
    async ({ browser, cfg, clerkUsers, emulatorData }, use, workerInfo) => {
      const identity = await createIdentity(browser, cfg, clerkUsers, "customer", workerInfo.workerIndex);
      await use(identity);
      await emulatorData.deleteOwnedBy(identity.userId);
    },
    { scope: "worker", timeout: 90_000 },
  ],

  otherCustomerIdentity: [
    async ({ browser, cfg, clerkUsers, emulatorData }, use, workerInfo) => {
      const identity = await createIdentity(browser, cfg, clerkUsers, "customer", workerInfo.workerIndex);
      await use(identity);
      await emulatorData.deleteOwnedBy(identity.userId);
    },
    { scope: "worker", timeout: 90_000 },
  ],

  technicianIdentity: [
    async ({ browser, cfg, clerkUsers }, use, workerInfo) => {
      await use(await createIdentity(browser, cfg, clerkUsers, "technician", workerInfo.workerIndex));
    },
    { scope: "worker", timeout: 90_000 },
  ],

  // Public fixtures. Using any of them guarantees the app-reads-emulator proof
  // has passed in this worker.
  emulator: [
    async ({ emulatorData, appReadsEmulator }, use) => {
      if (!appReadsEmulator) throw new Error("The app was not shown to read the emulator.");
      await use(emulatorData);
    },
    { scope: "worker" },
  ],

  customer: [
    async ({ customerIdentity, appReadsEmulator }, use) => {
      if (!appReadsEmulator) throw new Error("The app was not shown to read the emulator.");
      await use(customerIdentity);
    },
    { scope: "worker" },
  ],

  otherCustomer: [
    async ({ otherCustomerIdentity, appReadsEmulator }, use) => {
      if (!appReadsEmulator) throw new Error("The app was not shown to read the emulator.");
      await use(otherCustomerIdentity);
    },
    { scope: "worker" },
  ],

  technician: [
    async ({ technicianIdentity, appReadsEmulator }, use) => {
      if (!appReadsEmulator) throw new Error("The app was not shown to read the emulator.");
      await use(technicianIdentity);
    },
    { scope: "worker" },
  ],

  // ---- test scope ----------------------------------------------------------
  marker: async ({ cfg }, use, testInfo) => {
    await use(uniqueMarker(cfg.runId, testInfo.workerIndex));
  },

  ownedIds: async ({}, use) => {
    await use(new Set<string>());
  },

  consoleNotes: async ({}, use) => {
    await use([]);
  },

  testHygiene: [
    // Uses the internal emulator access on purpose: a signed-out test owns
    // nothing, and must not create a Clerk user just to clean up nothing.
    async ({ ownedIds, consoleNotes, emulatorData: emulator }, use, testInfo) => {
      await use();
      try {
        if (testInfo.status !== testInfo.expectedStatus) {
          if (consoleNotes.length > 0) {
            await testInfo.attach("browser-console", {
              body: consoleNotes.join("\n"),
              contentType: "text/plain",
            });
          }
          // Synthetic test data only; no credentials or tokens.
          const documents: Record<string, unknown> = {};
          for (const ownerId of ownedIds) documents[ownerId] = await emulator.repairsOwnedBy(ownerId);
          await testInfo.attach("emulator-documents", {
            body: JSON.stringify(documents, null, 2),
            contentType: "application/json",
          });
        }
      } finally {
        // Owner-scoped only. Never a wipe of the emulator.
        for (const ownerId of ownedIds) await emulator.deleteOwnedBy(ownerId);
      }
    },
    { auto: true },
  ],

  page: async ({ page, clerkTestingReady, consoleNotes }, use) => {
    if (!clerkTestingReady) throw new Error("Clerk testing is not ready.");
    await setupClerkTestingToken({ page });
    watch(page, consoleNotes);
    await use(page);
  },

  seed: async ({ emulator, ownedIds, marker }, use) => {
    await use(async ({ ownerId, overrides }) => {
      ownedIds.add(ownerId);
      return emulator.seedRepair({ ownerId, marker, overrides });
    });
  },

  customerPage: async ({ browser, cfg, customer, ownedIds, consoleNotes }, use) => {
    const { context, page } = await openAs(browser, cfg, customer, ownedIds, consoleNotes);
    await use(page);
    await context.close();
  },

  otherCustomerPage: async ({ browser, cfg, otherCustomer, ownedIds, consoleNotes }, use) => {
    const { context, page } = await openAs(browser, cfg, otherCustomer, ownedIds, consoleNotes);
    await use(page);
    await context.close();
  },

  technicianPage: async ({ browser, cfg, technician, ownedIds, consoleNotes }, use) => {
    const { context, page } = await openAs(browser, cfg, technician, ownedIds, consoleNotes);
    await use(page);
    await context.close();
  },
});

/**
 * Variants where the default `page` is already signed in as a disposable user
 * of that role. Use these for single-actor tests and for planner/generator
 * seeds (the agents drive the default page). Use `customerPage` /
 * `technicianPage` instead when one test needs several actors at once.
 */
export const customerTest = test.extend({
  storageState: async ({ customer, ownedIds }, use) => {
    ownedIds.add(customer.userId);
    await use(customer.storageState);
  },
});

export const technicianTest = test.extend({
  storageState: async ({ technician, ownedIds }, use) => {
    ownedIds.add(technician.userId);
    await use(technician.storageState);
  },
});

export { expect };
