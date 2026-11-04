import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  E2ESafetyError,
  assertClerkTestKeys,
  assertDedicatedClerkApp,
  assertEmulatorOnly,
  assertLocalBaseUrl,
} from "../support/safety";

/**
 * The single place browser-test configuration is read and validated.
 *
 * Values come from the shell, or from `.env.e2e.local` (git-ignored) when it
 * exists. Real shell variables win over the file. Everything is prefixed
 * `E2E_`, so nothing is inherited from the app's own `.env.local`, which may
 * hold live credentials.
 *
 * Errors name the setting that is wrong. They never contain its value.
 */

export type E2EConfig = Readonly<{
  /** Identifies this run in marker strings and Clerk user tags. */
  runId: string;
  port: number;
  baseUrl: string;
  /** "dev" runs next dev; "build" runs next build then next start (CI). */
  serverMode: "dev" | "build";
  workers: number;
  trace: "off" | "on" | "retain-on-failure" | "on-first-retry";
  emulatorHost: string;
  firebaseProjectId: string;
  clerk: Readonly<{
    publishableKey: string;
    secretKey: string;
    frontendApi: string;
  }>;
}>;

/**
 * The technician queue shows the newest 50 requests across every user, and
 * every parallel worker adds to it. Each worker may therefore keep at most
 * this many seeded requests alive at once, and the worker count is capped so
 * that workers x budget always stays well under the queue window.
 */
export const SEEDED_REQUESTS_PER_WORKER = 8;
export const MAX_WORKERS = 4;

const DEFAULTS = {
  port: "3100",
  emulatorHost: "127.0.0.1:8086",
  firebaseProjectId: "demo-fix-district-e2e",
  workers: "1",
} as const;

let cached: E2EConfig | undefined;

function loadEnvFile(): void {
  const file = path.resolve(process.cwd(), ".env.e2e.local");
  // Does not override variables already set in the shell.
  if (existsSync(file)) process.loadEnvFile(file);
}

/** The key the app itself uses in .env.local, only to refuse reusing it. Never logged. */
function localAppPublishableKey(): string | undefined {
  try {
    const file = path.resolve(process.cwd(), ".env.local");
    const text = readFileSync(file, "utf8");
    const match = /^\s*NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY\s*=\s*"?([^"\r\n#]+?)"?\s*$/m.exec(
      text,
    );
    return match?.[1];
  } catch {
    return undefined;
  }
}

export function loadE2EEnv(): E2EConfig {
  if (cached) return cached;
  loadEnvFile();

  const problems: string[] = [];
  const read = (name: string, fallback?: string): string => {
    const value = process.env[name]?.trim();
    if (value) return value;
    if (fallback !== undefined) return fallback;
    problems.push(`${name} is not set`);
    return "";
  };

  const publishableKey = read("E2E_CLERK_PUBLISHABLE_KEY");
  const secretKey = read("E2E_CLERK_SECRET_KEY");
  const frontendApi = read("E2E_CLERK_FRONTEND_API");
  const port = Number(read("E2E_PORT", DEFAULTS.port));
  const emulatorHost = read("E2E_FIRESTORE_EMULATOR_HOST", DEFAULTS.emulatorHost);
  const firebaseProjectId = read("E2E_FIREBASE_PROJECT_ID", DEFAULTS.firebaseProjectId);
  const workers = Number(read("E2E_WORKERS", DEFAULTS.workers));
  const serverMode = read("E2E_SERVER_MODE", process.env.CI ? "build" : "dev");
  const trace = read("E2E_TRACE", process.env.CI ? "off" : "retain-on-failure");

  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    problems.push("E2E_PORT must be a port number between 1024 and 65535");
  }
  if (port === 3000) {
    problems.push("E2E_PORT must not be 3000 (that is the normal dev server's port)");
  }
  if (!Number.isInteger(workers) || workers < 1 || workers > MAX_WORKERS) {
    problems.push(`E2E_WORKERS must be a whole number from 1 to ${MAX_WORKERS}`);
  }
  if (serverMode !== "dev" && serverMode !== "build") {
    problems.push('E2E_SERVER_MODE must be "dev" or "build"');
  }
  if (!["off", "on", "retain-on-failure", "on-first-retry"].includes(trace)) {
    problems.push("E2E_TRACE must be off, on, retain-on-failure, or on-first-retry");
  }

  // `firebase emulators:exec` exports FIRESTORE_EMULATOR_HOST. If it is set and
  // disagrees with the configured host, the wrong emulator is running.
  const inherited = process.env.FIRESTORE_EMULATOR_HOST?.trim();
  if (inherited && inherited !== emulatorHost) {
    problems.push(
      "FIRESTORE_EMULATOR_HOST in the environment does not match E2E_FIRESTORE_EMULATOR_HOST (is another emulator, such as the Vitest one, selected?)",
    );
  }

  if (problems.length > 0) {
    throw new E2ESafetyError(
      `E2E configuration is incomplete or invalid:\n - ${problems.join("\n - ")}\nSee .env.e2e.example.`,
    );
  }

  // Hard guards. These throw on any violation.
  assertEmulatorOnly(emulatorHost, firebaseProjectId);
  assertClerkTestKeys(publishableKey, secretKey);
  assertDedicatedClerkApp({
    publishableKey,
    confirmedFrontendApi: frontendApi,
    localAppPublishableKey: localAppPublishableKey(),
  });

  const baseUrl = `http://localhost:${port}`;
  assertLocalBaseUrl(baseUrl);

  // One run ID for the whole run: set once in the runner, inherited by workers.
  process.env.E2E_RUN_ID ??= randomBytes(3).toString("hex");
  const runId = process.env.E2E_RUN_ID;
  if (!/^[a-z0-9]{4,12}$/.test(runId)) {
    throw new E2ESafetyError("E2E_RUN_ID must be 4 to 12 lowercase letters or digits.");
  }

  // @clerk/testing reads these from the environment.
  process.env.CLERK_PUBLISHABLE_KEY = publishableKey;
  process.env.CLERK_SECRET_KEY = secretKey;

  cached = Object.freeze({
    runId,
    port,
    baseUrl,
    serverMode: serverMode as "dev" | "build",
    workers,
    trace: trace as E2EConfig["trace"],
    emulatorHost,
    firebaseProjectId,
    clerk: Object.freeze({ publishableKey, secretKey, frontendApi }),
  });
  return cached;
}
