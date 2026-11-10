import type { E2EConfig } from "../config/env";
import { E2ESafetyError } from "./safety";

/**
 * Environment checks that must hold before any test touches the emulator.
 * They run automatically (global setup once per runner session, and a worker
 * fixture once per worker), so a test can be selected and run on its own in
 * the CLI, in UI mode, or in an agent (MCP) session.
 *
 * Nothing here starts, stops or signals a process. Starting the emulator is
 * the runner's webServer entry (playwright.config.ts); this file only decides
 * whether what answers on the configured ports is the intended E2E emulator.
 *
 * Errors name the setting, never its value.
 */

/**
 * The technician queue shows the newest 50 requests across every user, and
 * every parallel worker adds to it. Leftovers from earlier runs eat into that
 * window, so a run refuses to start when more than this many exist.
 */
export const MAX_LEFTOVER_REQUESTS = 10;

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/**
 * Pure: does this emulator-hub payload (GET /emulators) describe a Firestore
 * emulator on the configured address?
 *
 * The hub port is specific to the E2E emulator (the app's own emulator uses a
 * different one), so a hub that answers there and reports Firestore on the
 * configured port identifies the intended emulator. A stray server on the
 * Firestore port, the app's normal emulator, or the Vitest emulator does not.
 */
export function assertHubDescribesFirestore(hub: unknown, emulatorHost: string): void {
  const expectedPort = Number(emulatorHost.slice(emulatorHost.lastIndexOf(":") + 1));
  const firestore =
    typeof hub === "object" && hub !== null
      ? (hub as { firestore?: unknown }).firestore
      : undefined;
  if (typeof firestore !== "object" || firestore === null) {
    throw new E2ESafetyError(
      "The emulator hub does not list a Firestore emulator. Something other than the E2E emulator is answering (E2E_EMULATOR_HUB).",
    );
  }
  const { host, port } = firestore as { host?: unknown; port?: unknown };
  if (typeof host !== "string" || !LOOPBACK_HOSTS.has(host)) {
    throw new E2ESafetyError(
      "The emulator hub reports a Firestore emulator that is not on a loopback address.",
    );
  }
  if (port !== expectedPort) {
    throw new E2ESafetyError(
      "The emulator hub reports Firestore on a different port than E2E_FIRESTORE_EMULATOR_HOST. A different emulator is running.",
    );
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error("not ok");
  return response.json();
}

/**
 * The Firestore emulator answers, and it is the intended E2E emulator (see
 * assertHubDescribesFirestore). Read-only: two GET requests.
 */
export async function verifyEmulator(
  config: Pick<E2EConfig, "emulatorHost" | "emulatorHub">,
): Promise<void> {
  try {
    const response = await fetch(`http://${config.emulatorHost}/`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error("not ok");
  } catch {
    throw new E2ESafetyError(
      "The Firestore emulator is not reachable. The standard runner starts it automatically; if it did not, check that Java is installed and that nothing else holds the E2E emulator ports (see e2e/README.md).",
    );
  }

  let hub: unknown;
  try {
    hub = await fetchJson(`http://${config.emulatorHub}/emulators`);
  } catch {
    throw new E2ESafetyError(
      "Something answers on the E2E_FIRESTORE_EMULATOR_HOST port, but the emulator hub (E2E_EMULATOR_HUB) does not, so it cannot be confirmed as the E2E emulator. It was not used and was not touched.",
    );
  }
  assertHubDescribesFirestore(hub, config.emulatorHost);
}

/** Refuses a run on an emulator still holding many requests from earlier runs. */
export async function assertNoLeftoverRequests(emulator: {
  totalRepairs(): Promise<number>;
}): Promise<void> {
  const total = await emulator.totalRepairs();
  if (total > MAX_LEFTOVER_REQUESTS) {
    throw new E2ESafetyError(
      "The E2E emulator holds leftover requests from earlier runs. Restart that emulator (a runner-started one is discarded after every run). The emulator is never wiped automatically.",
    );
  }
}
