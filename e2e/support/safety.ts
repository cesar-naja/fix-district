/**
 * Guards that keep browser tests away from anything real. Pure functions with
 * no I/O and no imports, so they are cheap to unit test (tests/unit) and safe
 * to call from every helper that writes.
 *
 * Every violation throws. Messages name the setting, never its value.
 */

export class E2ESafetyError extends Error {
  constructor(message: string) {
    super(`[e2e safety] ${message}`);
    this.name = "E2ESafetyError";
  }
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/** Splits "host:port". Requires an explicit numeric port. */
function splitHostPort(hostPort: string): { host: string; port: number } {
  const match = /^(\[[^\]]+\]|[^:]+):(\d{1,5})$/.exec(hostPort.trim());
  if (!match) {
    throw new E2ESafetyError(
      "The emulator host must look like 127.0.0.1:8086 (host and explicit port).",
    );
  }
  return { host: match[1], port: Number(match[2]) };
}

/**
 * The Firestore emulator must be on this machine, on an explicit port, and its
 * project ID must use the reserved "demo-" prefix (which can never name a real
 * Firebase project).
 */
export function assertEmulatorOnly(hostPort: string, projectId: string): void {
  const { host } = splitHostPort(hostPort);
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new E2ESafetyError(
      "The Firestore emulator host must be a loopback address (127.0.0.1 or localhost).",
    );
  }
  if (!projectId.startsWith("demo-")) {
    throw new E2ESafetyError(
      'The Firebase project ID for tests must start with "demo-".',
    );
  }
}

/** The app under test must be served from this machine. */
export function assertLocalBaseUrl(baseUrl: string): void {
  let host: string;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    throw new E2ESafetyError("The base URL is not a valid URL.");
  }
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new E2ESafetyError(
      "The base URL must be a loopback address. Remote targets are not supported.",
    );
  }
}

/** Clerk development keys only. Production keys are refused outright. */
export function assertClerkTestKeys(
  publishableKey: string,
  secretKey: string,
): void {
  if (!publishableKey.startsWith("pk_test_")) {
    throw new E2ESafetyError(
      "E2E_CLERK_PUBLISHABLE_KEY must be a Clerk development key (pk_test_...).",
    );
  }
  if (!secretKey.startsWith("sk_test_")) {
    throw new E2ESafetyError(
      "E2E_CLERK_SECRET_KEY must be a Clerk development key (sk_test_...).",
    );
  }
}

/** The Frontend API host encoded inside a publishable key, or null. */
export function publishableKeyHost(publishableKey: string): string | null {
  const encoded = publishableKey.replace(/^pk_(test|live)_/, "");
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    if (!decoded.endsWith("$")) return null;
    const host = decoded.slice(0, -1).toLowerCase();
    return /^[a-z0-9.-]+$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

/**
 * The test Clerk application must be a dedicated one, not the application used
 * for local development. Two independent checks:
 *  - the key must differ from the one the app's own .env.local uses, and
 *  - the person configuring the tests must type the Frontend API host of the
 *    dedicated application, and it must match the key. This is a deliberate
 *    confirmation that cannot be satisfied by copying a key from elsewhere.
 */
export function assertDedicatedClerkApp(input: {
  publishableKey: string;
  confirmedFrontendApi: string;
  localAppPublishableKey?: string;
}): void {
  const host = publishableKeyHost(input.publishableKey);
  if (!host) {
    throw new E2ESafetyError(
      "E2E_CLERK_PUBLISHABLE_KEY is not a valid Clerk publishable key.",
    );
  }
  const confirmed = input.confirmedFrontendApi
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  if (confirmed !== host) {
    throw new E2ESafetyError(
      "E2E_CLERK_FRONTEND_API must equal the Frontend API host of the dedicated Clerk application (see .env.e2e.example).",
    );
  }
  if (
    input.localAppPublishableKey &&
    input.localAppPublishableKey === input.publishableKey
  ) {
    throw new E2ESafetyError(
      "E2E_CLERK_PUBLISHABLE_KEY is the same key the app uses in .env.local. Tests need their own dedicated Clerk application.",
    );
  }
}

/** Metadata stamped on every user the framework creates. */
export type FrameworkUserTag = {
  framework: "fix-district-e2e";
  runId: string;
  app: string;
};

export function frameworkUserTag(runId: string, appHost: string): FrameworkUserTag {
  return { framework: "fix-district-e2e", runId, app: appHost };
}

/**
 * A user may be deleted only when its public metadata carries this run's tag
 * for this Clerk application. Matching an email pattern or an age is never
 * enough.
 */
export function isTaggedForRun(
  publicMetadata: unknown,
  runId: string,
  appHost: string,
): boolean {
  if (typeof publicMetadata !== "object" || publicMetadata === null) return false;
  const tag = (publicMetadata as { e2e?: unknown }).e2e;
  if (typeof tag !== "object" || tag === null) return false;
  const { framework, runId: taggedRun, app } = tag as Partial<FrameworkUserTag>;
  return (
    framework === "fix-district-e2e" && taggedRun === runId && app === appHost
  );
}
