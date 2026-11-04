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

/**
 * Every spec imports `test` and `expect` from here, never from
 * @playwright/test, so every test gets the same isolation guarantees.
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
  clerkTestingReady: true;
  clerkUsers: ReturnType<typeof createClerkTestUsers>;
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

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // ---- worker scope --------------------------------------------------------
  cfg: [
    async ({}, use) => {
      await use(loadE2EEnv());
    },
    { scope: "worker" },
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

  emulator: [
    async ({ cfg }, use) => {
      await use(createEmulatorData(cfg));
    },
    { scope: "worker" },
  ],

  customer: [
    async ({ browser, cfg, clerkUsers, emulator }, use, workerInfo) => {
      const identity = await createIdentity(browser, cfg, clerkUsers, "customer", workerInfo.workerIndex);
      await use(identity);
      await emulator.deleteOwnedBy(identity.userId);
    },
    { scope: "worker" },
  ],

  otherCustomer: [
    async ({ browser, cfg, clerkUsers, emulator }, use, workerInfo) => {
      const identity = await createIdentity(browser, cfg, clerkUsers, "customer", workerInfo.workerIndex);
      await use(identity);
      await emulator.deleteOwnedBy(identity.userId);
    },
    { scope: "worker" },
  ],

  technician: [
    async ({ browser, cfg, clerkUsers }, use, workerInfo) => {
      await use(await createIdentity(browser, cfg, clerkUsers, "technician", workerInfo.workerIndex));
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
    async ({ ownedIds, consoleNotes, emulator }, use, testInfo) => {
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
