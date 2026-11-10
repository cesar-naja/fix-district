import { loadE2EEnv } from "../config/env";
import { createEmulatorData } from "../support/emulator";
import { assertNoLeftoverRequests, verifyEmulator } from "../support/preflight";

/**
 * Runs once per runner session: `playwright test`, a UI-mode session, and every
 * agent (MCP) run. The runner has already started or reused the emulator and
 * started the app server (webServer entries in playwright.config.ts).
 *
 * What it settles before any worker starts:
 *  - the configuration is valid and safe (loadE2EEnv throws otherwise),
 *  - what answers on the emulator ports is the intended E2E emulator, and
 *  - the emulator is not full of leftovers from earlier runs.
 *
 * Checks that need a signed-in session (the app really reads this emulator)
 * live in the shared fixtures, so they run per worker and only for tests that
 * touch data. Nothing here creates users or records.
 */
export default async function globalSetup(): Promise<void> {
  const cfg = loadE2EEnv();
  await verifyEmulator(cfg);
  await assertNoLeftoverRequests(createEmulatorData(cfg));
}
