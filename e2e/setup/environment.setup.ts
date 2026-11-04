import { expect, test as setup } from "../fixtures";
import { LIST_NAME, repairRow } from "../pages/repair-list";
import { assertEmulatorReachable } from "../support/emulator";

/**
 * Gate for every browser test: the `chromium` project depends on this one, so
 * nothing else runs if these fail.
 *
 * What this proves, and what it does not:
 *  - The emulator is up and not holding leftovers from earlier runs.
 *  - The app server's REPAIR QUEUE READ path sees data that exists only in the
 *    emulator. A server reading any other database would not show the record.
 *
 * It is one layer of protection, not proof that every operation is isolated.
 * The other layers are: the server is started with an explicit emulator
 * environment (playwright.config.ts), no existing server is ever reused, the
 * test process can only authenticate to the emulator (support/emulator.ts), and
 * every helper re-checks its guards. The write path is exercised by the smoke
 * test that submits a request through the form.
 */
setup.describe.configure({ mode: "serial" });

// Leaves room for workers x per-worker budget inside the technician queue's
// newest-50 window (see SEEDED_REQUESTS_PER_WORKER in config/env.ts).
const MAX_LEFTOVER_REQUESTS = 10;

setup("the Firestore emulator is reachable and clean", async ({ cfg, emulator }) => {
  await assertEmulatorReachable(cfg.emulatorHost);
  expect(
    await emulator.totalRepairs(),
    "The e2e emulator holds leftover requests from earlier runs. Restart it (stop `npm run emulators:e2e`, or just use `npm run test:e2e`).",
  ).toBeLessThanOrEqual(MAX_LEFTOVER_REQUESTS);
});

setup("the app's technician queue reads from the emulator", async ({
  technicianPage,
  seed,
  marker,
}) => {
  // A synthetic owner: the record only has to exist, not belong to a real user.
  await seed({ ownerId: `e2e-canary-${marker}` });

  await technicianPage.goto("/technician");
  await expect(
    repairRow(technicianPage, LIST_NAME.technician, marker),
    "A record that exists only in the emulator is not visible to the app. The app server is not reading the emulator.",
  ).toBeVisible();
});
